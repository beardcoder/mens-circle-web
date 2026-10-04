/** The hero's breathing ground: one soft, warm body drawn by a fragment shader. */

/** Seconds. The rest is the short pause after the out-breath. */
const INHALE = 4;
const EXHALE = 6;
const REST = 0.7;

/** The inner layer follows the outer one this much later (seconds), like tissue behind skin. */
const LAG = 0.45;

/** Canvas pixels per CSS pixel. The field is soft, so the browser's upscale costs nothing visible. */
const SCALE = 0.5;

/** Longest step the clock takes in one frame, so a stalled frame never jumps the breath. */
const MAX_STEP = 0.1;

/** Milliseconds; a little under 1/60 s so 60 Hz screens never skip. */
const MIN_FRAME = 15;

interface Cycle {
  start: number;
  inhale: number;
  exhale: number;
  rest: number;
  depth: number;
}

/** Deterministic variation in [-1, 1]: each cycle differs a little, without randomness. */
const wander = (index: number, rate: number, phase: number): number => Math.sin(index * rate + phase);

function cycleAt(index: number, start: number): Cycle {
  return {
    start,
    inhale: INHALE + 0.35 * wander(index, 0.83, 0.4),
    exhale: EXHALE + 0.5 * wander(index, 0.57, 2.1),
    rest: REST + 0.25 * wander(index, 1.31, 4),
    depth: 0.86 + 0.14 * wander(index, 0.39, 1.2),
  };
}

const cycleEnd = (c: Cycle): number => c.start + c.inhale + c.exhale + c.rest;

/** Sine ease: zero velocity at both ends, so every turn is soft. */
const ease = (u: number): number => 0.5 - 0.5 * Math.cos(Math.PI * u);

/** Breath depth in [0, depth] at clock `t`. The out-breath falls early and settles slowly. */
function breathAt(c: Cycle, t: number): number {
  const u = t - c.start;
  if (u < c.inhale) return c.depth * ease(u / c.inhale);
  const out = (u - c.inhale) / c.exhale;
  if (out < 1) return c.depth * (1 - ease(1 - (1 - out) ** 1.6));
  return 0;
}

const VERTEX = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;

uniform vec2 uRes;    // canvas size, px
uniform vec3 uBody;   // centre (px, y up) and radius (px)
uniform vec3 uBreath; // outer breath, inner (lagging) breath, clock in seconds
uniform vec4 uFlesh;  // straight rgb + alpha
uniform vec4 uCore;
uniform float uFade;  // share of the height that fades out at the bottom; 0 = none
out vec4 outColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float n = mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  return n * 2.0 - 1.0;
}

// The outline's radius at angle a: low lobes that drift on their own and lean into the breath.
float contour(float a, float t, float b, float seed) {
  return 1.0
    + 0.060 * sin(2.0 * a + 0.13 * t + seed + 0.6 * b)
    + 0.038 * sin(3.0 * a - 0.09 * t + 1.7 * seed + 0.9 * b)
    + 0.022 * sin(5.0 * a + 0.07 * t + 2.3 * seed);
}

// Coverage of one layer. The in-breath lifts and widens it, more in height than in width.
float body(vec2 p, float b, float t, float seed, float solid, float edge) {
  p.y -= 0.045 * b;
  p /= vec2(1.0 + 0.075 * b, 1.0 + 0.11 * b);
  p += 0.09 * vec2(noise(p * 1.1 + vec2(0.031 * t, 3.7 + seed)), noise(p * 1.1 + vec2(5.2 + seed, -0.027 * t)));
  float d = length(p) / contour(atan(p.y, p.x), t, b, seed);
  return 1.0 - smoothstep(solid, edge, d);
}

void main() {
  float t = uBreath.z;
  vec2 p = (gl_FragCoord.xy - uBody.xy) / uBody.z;
  // A slow wander of the whole body, a few pixels over minutes.
  p += 0.02 * vec2(sin(0.041 * t), sin(0.029 * t + 1.3));

  float flesh = uFlesh.a * body(p, uBreath.x, t, 0.0, 0.45, 1.2);
  // The core sits low and left, and warms a little as it fills.
  float core = uCore.a * (0.85 + 0.15 * uBreath.y) * body((p + vec2(0.08, 0.05)) * 1.25, uBreath.y, t, 2.4, 0.0, 0.95);

  // Core over flesh, premultiplied.
  float a = core + flesh * (1.0 - core);
  vec3 rgb = uCore.rgb * core + uFlesh.rgb * flesh * (1.0 - core);

  // Fade out above a section's lower edge so it never cuts the body with a line.
  float fade = uFade > 0.0 ? smoothstep(0.0, uFade, gl_FragCoord.y / uRes.y) : 1.0;
  // Half an 8-bit step of fixed dither: no banding in the long, faint gradients.
  float n = (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  a = clamp((a + n) * fade, 0.0, 1.0);
  outColor = vec4(clamp((rgb + n) * fade, 0.0, a), a);
}`;

type Rgba = [number, number, number, number];

/** Computed colours are serialised as `rgb()`/`rgba()` or `color(srgb …)`. */
function parseColor(value: string): Rgba {
  const n = (value.match(/[\d.]+/g) ?? []).map(Number);
  const unit = value.startsWith('color(') ? 1 : 255;
  return [(n[0] ?? 0) / unit, (n[1] ?? 0) / unit, (n[2] ?? 0) / unit, n[3] ?? 1];
}

/** Resolves a custom property through `color`, so `light-dark()` follows the active mode. */
function readColor(el: HTMLElement, name: string): Rgba {
  el.style.color = `var(${name})`;
  const value = getComputedStyle(el).color;
  el.style.removeProperty('color');
  return parseColor(value);
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  // eslint-disable-next-line no-console
  console.error('[breath]', gl.getShaderInfoLog(shader));
  return null;
}

function link(gl: WebGL2RenderingContext): WebGLProgram | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!vertex || !fragment) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

type UniformName = 'uRes' | 'uBody' | 'uBreath' | 'uFlesh' | 'uCore' | 'uFade';

class BreathingGround {
  private gl: WebGL2RenderingContext | null = null;
  private uniforms = new Map<UniformName, WebGLUniformLocation | null>();
  private flesh: Rgba = [0, 0, 0, 0];
  private core: Rgba = [0, 0, 0, 0];
  private body: [number, number, number] = [0, 0, 1];
  private fade = 0.22;

  private index = 0;
  private cycle = cycleAt(0, 0);
  private clock = 0;
  private outer = 0;
  private inner = 0;

  private raf = 0;
  private last: number | null = null;
  private inView = false;
  private live = false;
  /** No WebGL2 or a shader that failed: the CSS still stays for good. */
  private broken = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
    private readonly reduced: MediaQueryList,
  ) {}

  /** Runs only while on screen, in a visible tab and with motion allowed. */
  sync(): void {
    const run = this.inView && !document.hidden && !this.reduced.matches && this.ready();
    if (run && !this.raf) {
      this.last = null;
      this.raf = requestAnimationFrame(this.frame);
    } else if (!run && this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    // The CSS still shows whenever the canvas has nothing current to show.
    this.root.toggleAttribute('data-live', this.live && !this.reduced.matches);
  }

  setInView(inView: boolean): void {
    this.inView = inView;
    this.sync();
  }

  /** Reads colours and geometry from CSS; call on mode change and resize. */
  measure(): void {
    this.flesh = readColor(this.canvas, '--breath-flesh');
    this.core = readColor(this.canvas, '--breath-core');

    const { width, height } = this.root.getBoundingClientRect();
    const w = Math.max(1, Math.round(width * SCALE));
    const h = Math.max(1, Math.round(height * SCALE));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    const style = getComputedStyle(this.root);
    const x = Number.parseFloat(style.getPropertyValue('--breath-x'));
    const y = Number.parseFloat(style.getPropertyValue('--breath-y'));
    const radius = Number.parseFloat(style.getPropertyValue('--breath-radius'));
    const fade = Number.parseFloat(style.getPropertyValue('--breath-fade'));
    this.fade = Number.isFinite(fade) ? fade : 0.22;
    this.body = [
      (Number.isFinite(x) ? x : 0.5) * w,
      (1 - (Number.isFinite(y) ? y : 0.5)) * h,
      Math.max(1, (Number.isFinite(radius) ? radius : width * 0.3) * SCALE),
    ];
  }

  /** The context is created only once motion is allowed; a lost context drops back to the still. */
  private ready(): boolean {
    if (this.gl || this.broken || this.reduced.matches) return this.gl !== null;
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    });
    // A lost context waits for `webglcontextrestored` instead of giving up.
    if (gl?.isContextLost()) return false;
    const program = gl && link(gl);
    if (!gl || !program) {
      this.broken = true;
      return false;
    }

    gl.useProgram(program);
    for (const name of ['uRes', 'uBody', 'uBreath', 'uFlesh', 'uCore', 'uFade'] as const) {
      this.uniforms.set(name, gl.getUniformLocation(program, name));
    }
    this.gl = gl;
    this.measure();
    return true;
  }

  lose(): void {
    this.gl = null;
    this.live = false;
    this.sync();
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    // 120 Hz screens draw every other frame: this motion gains nothing above 60.
    if (this.last !== null && now - this.last < MIN_FRAME) return;
    const step = this.last === null ? 0 : Math.min((now - this.last) / 1000, MAX_STEP);
    this.last = now;
    this.advance(step);
    this.draw();
    if (!this.live) {
      this.live = true;
      this.root.toggleAttribute('data-live', true);
    }
  };

  /** One continuous clock: a new cycle starts at rest, so no restart is ever visible. */
  private advance(step: number): void {
    this.clock += step;
    while (this.clock >= cycleEnd(this.cycle)) this.cycle = cycleAt(++this.index, cycleEnd(this.cycle));
    this.outer = breathAt(this.cycle, this.clock);
    this.inner += (this.outer - this.inner) * (1 - Math.exp(-step / LAG));
  }

  private draw(): void {
    const gl = this.gl;
    if (!gl) return;
    const u = (name: UniformName) => this.uniforms.get(name) ?? null;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform2f(u('uRes'), this.canvas.width, this.canvas.height);
    gl.uniform3f(u('uBody'), ...this.body);
    gl.uniform3f(u('uBreath'), this.outer, this.inner, this.clock);
    gl.uniform4f(u('uFlesh'), ...this.flesh);
    gl.uniform4f(u('uCore'), ...this.core);
    gl.uniform1f(u('uFade'), this.fade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

export function initBreath(): void {
  const root = document.querySelector<HTMLElement>('[data-breath]');
  const canvas = root?.querySelector('canvas');
  if (!root || !canvas) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const ground = new BreathingGround(root, canvas, reduced);

  new IntersectionObserver(([entry]) => ground.setInView(entry?.isIntersecting ?? false)).observe(root);
  new ResizeObserver(() => ground.measure()).observe(root);
  // The mode lives on <html> (theme.ts) or follows the OS; either way the colours re-resolve.
  new MutationObserver(() => ground.measure()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-mode', 'data-mode-resolved'],
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => ground.measure());

  document.addEventListener('visibilitychange', () => ground.sync());
  reduced.addEventListener('change', () => ground.sync());

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    ground.lose();
  });
  canvas.addEventListener('webglcontextrestored', () => ground.sync());
}
