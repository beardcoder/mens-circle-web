<script lang="ts">
  import { onDestroy } from 'svelte';
  import { clamp } from '@lib/helpers';

  type Phase = 'idle' | 'breathing' | 'retention' | 'recovery' | 'complete';

  interface SessionConfig {
    breaths: number;
    rounds: number;
    recoveryHold: number;
  }

  const PHASE_LABEL: Record<Phase, string> = {
    idle: 'Bereit',
    breathing: 'Atmen',
    retention: 'Halten',
    recovery: 'Erholung',
    complete: 'Geschafft',
  };

  const PICKER_ITEM_WIDTH = 72;
  const PICKER_MIN = 10;
  const PICKER_MAX = 60;
  const PICKER_STEP = 5;
  const DRAG_THRESHOLD_PX = 4;
  const INHALE_MS = 1800;
  const EXHALE_MS = 1800;
  const CYCLE_MS = INHALE_MS + EXHALE_MS;

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function circleMotion(phase: Phase): string | null {
    if (phase === 'breathing') return 'wave';
    if (phase === 'retention') return 'hold-high';
    if (phase === 'recovery') return 'hold-low';
    return null;
  }

  // ─── Reactive state ────────────────────────────────────────────────
  let phase = $state<Phase>('idle');
  let round = $state(0);
  let breath = $state(0);
  let timerSeconds = $state(0);
  let settingBreaths = $state(35);
  let settingRounds = $state(3);
  let settingRecovery = $state(15);
  let session = $state<SessionConfig | null>(null);

  const isActive = $derived(
    phase === 'breathing' || phase === 'retention' || phase === 'recovery',
  );
  const sessionRounds = $derived(session?.rounds ?? settingRounds);
  const sessionBreaths = $derived(session?.breaths ?? settingBreaths);
  const motion = $derived(circleMotion(phase));

  const counterText = $derived.by(() => {
    switch (phase) {
      case 'idle':
        return `${settingRounds} Runden · ${settingBreaths} Atemzüge`;
      case 'breathing':
        return `Atemzug ${breath}`;
      case 'retention':
        return `Halten · ${formatTime(timerSeconds)}`;
      case 'recovery':
        return `Halten · ${timerSeconds}s`;
      case 'complete':
        return 'Nimm dir einen Moment, spüre nach.';
    }
  });

  const startLabel = $derived(
    phase === 'complete' ? 'Erneut starten' : 'Atemübung starten',
  );
  const holdLabel = $derived(
    phase === 'recovery' ? 'Weiteratmen' : 'Atem freigeben',
  );
  const showStart = $derived(phase === 'idle' || phase === 'complete');
  const showHold = $derived(phase === 'retention' || phase === 'recovery');

  // ─── Scheduling ────────────────────────────────────────────────────
  let timerHandle: number | null = null;
  let breathHandle: number | null = null;
  let rafHandle: number | null = null;

  function clearScheduled(): void {
    if (breathHandle !== null) {
      window.clearInterval(breathHandle);
      breathHandle = null;
    }
    if (timerHandle !== null) {
      window.clearTimeout(timerHandle);
      timerHandle = null;
    }
    if (rafHandle !== null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
  }

  // ─── Phase transitions ─────────────────────────────────────────────
  function enterIdle(): void {
    clearScheduled();
    phase = 'idle';
    round = 0;
    breath = 0;
    timerSeconds = 0;
    session = null;
  }

  function finishSession(): void {
    clearScheduled();
    phase = 'complete';
  }

  function startBreathing(): void {
    clearScheduled();
    phase = 'breathing';
    round += 1;
    breath = 1;
    timerSeconds = 0;

    const startedAt = performance.now();
    const breathLimit = session?.breaths ?? settingBreaths;

    breathHandle = window.setInterval(() => {
      if (phase !== 'breathing') return;
      breath += 1;
      if (breath > breathLimit) startRetention();
    }, CYCLE_MS);

    const tick = (): void => {
      if (phase !== 'breathing') return;
      timerSeconds = Math.floor((performance.now() - startedAt) / 1000);
      timerHandle = window.setTimeout(tick, 1000);
    };
    timerHandle = window.setTimeout(tick, 1000);
  }

  function startRetention(): void {
    clearScheduled();
    phase = 'retention';
    timerSeconds = 0;

    const startedAt = performance.now();
    let lastSecond = -1;

    const loop = (): void => {
      if (phase !== 'retention') return;
      const elapsed = Math.floor((performance.now() - startedAt) / 1000);
      if (elapsed !== lastSecond) {
        lastSecond = elapsed;
        timerSeconds = elapsed;
      }
      rafHandle = requestAnimationFrame(loop);
    };
    rafHandle = requestAnimationFrame(loop);
  }

  function startRecovery(): void {
    clearScheduled();
    phase = 'recovery';

    let remaining = session?.recoveryHold ?? settingRecovery;
    timerSeconds = remaining;

    const tick = (): void => {
      remaining -= 1;
      timerSeconds = remaining;

      if (remaining <= 0) {
        const limit = session?.rounds ?? settingRounds;
        if (round >= limit) finishSession();
        else startBreathing();
        return;
      }
      timerHandle = window.setTimeout(tick, 1000);
    };
    timerHandle = window.setTimeout(tick, 1000);
  }

  function beginSession(): void {
    session = {
      breaths: settingBreaths,
      rounds: settingRounds,
      recoveryHold: settingRecovery,
    };
    round = 0;
    breath = 0;
    timerSeconds = 0;
    startBreathing();
  }

  // ─── Actions ───────────────────────────────────────────────────────
  function onCircleClick(): void {
    if (phase === 'idle' || phase === 'complete') beginSession();
  }

  function onHoldClick(): void {
    if (phase === 'retention') {
      startRecovery();
      return;
    }
    if (phase === 'recovery') {
      const limit = session?.rounds ?? settingRounds;
      if (round >= limit) finishSession();
      else startBreathing();
    }
  }

  function adjustRounds(delta: number): void {
    if (!isActive) settingRounds = clamp(settingRounds + delta, 1, 6);
  }

  function adjustRecovery(delta: number): void {
    if (!isActive) settingRecovery = clamp(settingRecovery + delta, 5, 30);
  }

  onDestroy(clearScheduled);

  // ─── iOS-style swipe picker (Svelte action) ────────────────────────
  function picker(track: HTMLElement): { destroy: () => void } {
    const values: number[] = [];
    for (let v = PICKER_MIN; v <= PICKER_MAX; v += PICKER_STEP) values.push(v);

    const pickerEl = track.closest<HTMLElement>('.breathing-picker');

    track.replaceChildren(
      ...values.map((value) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'breathing-picker__item';
        item.dataset.value = String(value);
        item.textContent = String(value);
        item.setAttribute('aria-label', `${value} Atemzüge`);
        return item;
      }),
    );

    const items = Array.from(
      track.querySelectorAll<HTMLElement>('.breathing-picker__item'),
    );

    const indexOfValue = (v: number): number =>
      clamp(Math.round((v - PICKER_MIN) / PICKER_STEP), 0, values.length - 1);

    let currentIndex = indexOfValue(settingBreaths);
    let dragOffset = 0;
    let pointerId: number | null = null;
    let dragStartX = 0;
    let dragStartIndex = 0;
    let dragged = false;

    const applyTransform = (animated: boolean): void => {
      track.style.transition = animated
        ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'
        : 'none';
      track.style.transform = `translate3d(${
        -currentIndex * PICKER_ITEM_WIDTH + dragOffset
      }px, 0, 0)`;
    };

    const highlight = (index: number): void => {
      items.forEach((item, i) => {
        item.classList.toggle('is-active', i === index);
        item.tabIndex = i === index ? 0 : -1;
      });
    };

    const setIndex = (index: number, animated = true): void => {
      currentIndex = clamp(index, 0, values.length - 1);
      settingBreaths = values[currentIndex] as number;
      highlight(currentIndex);
      applyTransform(animated);
    };

    const onPointerDown = (e: PointerEvent): void => {
      if (isActive) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointerId = e.pointerId;
      dragStartX = e.clientX;
      dragStartIndex = currentIndex;
      dragged = false;
      track.setPointerCapture(e.pointerId);
      pickerEl?.classList.add('is-dragging');
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (pointerId !== e.pointerId) return;
      const delta = e.clientX - dragStartX;
      if (!dragged && Math.abs(delta) > DRAG_THRESHOLD_PX) dragged = true;
      dragOffset = delta;
      applyTransform(false);
    };

    const onPointerEnd = (e: PointerEvent): void => {
      if (pointerId !== e.pointerId) return;
      const indexDelta = Math.round(-dragOffset / PICKER_ITEM_WIDTH);
      pointerId = null;
      dragOffset = 0;
      pickerEl?.classList.remove('is-dragging');
      if (dragged) setIndex(dragStartIndex + indexDelta, true);
      else applyTransform(true);
    };

    const onClick = (e: MouseEvent): void => {
      if (isActive) {
        e.preventDefault();
        return;
      }
      if (dragged) {
        e.preventDefault();
        e.stopPropagation();
        dragged = false;
        return;
      }
      const target = (e.target as HTMLElement).closest<HTMLElement>(
        '.breathing-picker__item',
      );
      if (!target?.dataset.value) return;
      setIndex(indexOfValue(Number.parseInt(target.dataset.value, 10)), true);
    };

    const onKeydown = (e: KeyboardEvent): void => {
      if (isActive) return;
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          e.preventDefault();
          setIndex(currentIndex - 1);
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          e.preventDefault();
          setIndex(currentIndex + 1);
          break;
        case 'Home':
          e.preventDefault();
          setIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setIndex(values.length - 1);
          break;
      }
    };

    const onWheel = (e: WheelEvent): void => {
      if (isActive) return;
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (e.deltaX > 10) setIndex(currentIndex + 1);
      else if (e.deltaX < -10) setIndex(currentIndex - 1);
    };

    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', onPointerEnd);
    track.addEventListener('pointercancel', onPointerEnd);
    track.addEventListener('click', onClick);
    pickerEl?.addEventListener('keydown', onKeydown);
    pickerEl?.addEventListener('wheel', onWheel, { passive: false });

    setIndex(currentIndex, false);

    return {
      destroy() {
        track.removeEventListener('pointerdown', onPointerDown);
        track.removeEventListener('pointermove', onPointerMove);
        track.removeEventListener('pointerup', onPointerEnd);
        track.removeEventListener('pointercancel', onPointerEnd);
        track.removeEventListener('click', onClick);
        pickerEl?.removeEventListener('keydown', onKeydown);
        pickerEl?.removeEventListener('wheel', onWheel);
      },
    };
  }
</script>

<div
  class="breathing-app"
  data-motion-essential
  data-phase={phase}
  style="--breathing-cycle-ms: {CYCLE_MS}ms"
>
  <div class="breathing-app__stage" aria-live="polite">
    <button
      type="button"
      class="breathing-app__circle"
      data-motion={motion ?? undefined}
      onclick={onCircleClick}
    >
      <span class="breathing-app__ring breathing-app__ring--1" aria-hidden="true"></span>
      <span class="breathing-app__ring breathing-app__ring--2" aria-hidden="true"></span>
      <span class="breathing-app__ring breathing-app__ring--3" aria-hidden="true"></span>
      <span class="breathing-app__core" aria-hidden="true"></span>
      <span class="breathing-app__label">
        <span class="breathing-app__phase">{PHASE_LABEL[phase]}</span>
        <span class="breathing-app__counter">{counterText}</span>
      </span>
    </button>
  </div>

  <div class="breathing-app__meta">
    <div class="breathing-app__meta-item">
      <span class="breathing-app__meta-label">Runde</span>
      <span class="breathing-app__meta-value">{round} / {sessionRounds}</span>
    </div>
    <div class="breathing-app__meta-item">
      <span class="breathing-app__meta-label">Atemzug</span>
      <span class="breathing-app__meta-value">{breath} / {sessionBreaths}</span>
    </div>
    <div class="breathing-app__meta-item">
      <span class="breathing-app__meta-label">Zeit</span>
      <span class="breathing-app__meta-value">{formatTime(timerSeconds)}</span>
    </div>
  </div>

  <div class="breathing-app__controls">
    {#if showStart}
      <button
        type="button"
        class="btn btn--primary btn--icon breathing-app__start"
        aria-label={startLabel}
        title={startLabel}
        onclick={beginSession}
      >
        <svg class="icon" aria-hidden="true" focusable="false"><use href="#icon-play"></use></svg>
      </button>
    {/if}
    {#if showHold}
      <button type="button" class="btn btn--outline" onclick={onHoldClick}>
        {holdLabel}
      </button>
    {/if}
    <button type="button" class="btn btn--ghost" onclick={enterIdle}>
      Zurücksetzen
    </button>
  </div>

  <div class="breathing-app__settings">
    <div class="breathing-app__setting breathing-app__setting--picker">
      <span class="breathing-app__setting-label">Atemzüge je Runde</span>
      <div
        class="breathing-picker"
        role="slider"
        tabindex="0"
        aria-label="Atemzüge je Runde"
        aria-valuemin="10"
        aria-valuemax="60"
        aria-valuenow={settingBreaths}
        aria-disabled={isActive ? 'true' : undefined}
      >
        <div class="breathing-picker__indicator" aria-hidden="true"></div>
        <div class="breathing-picker__track" use:picker></div>
        <div class="breathing-picker__fade breathing-picker__fade--start" aria-hidden="true"></div>
        <div class="breathing-picker__fade breathing-picker__fade--end" aria-hidden="true"></div>
      </div>
    </div>

    <div class="breathing-app__setting breathing-app__setting--stepper">
      <span class="breathing-app__setting-label">Runden</span>
      <div class="breathing-stepper">
        <button
          type="button"
          class="breathing-stepper__btn"
          aria-label="Eine Runde weniger"
          disabled={isActive || settingRounds <= 1}
          onclick={() => adjustRounds(-1)}
        >
          −
        </button>
        <span
          class="breathing-stepper__value"
          role="spinbutton"
          aria-valuemin="1"
          aria-valuemax="6"
          aria-valuenow={settingRounds}
        >{settingRounds}</span>
        <button
          type="button"
          class="breathing-stepper__btn"
          aria-label="Eine Runde mehr"
          disabled={isActive || settingRounds >= 6}
          onclick={() => adjustRounds(1)}
        >
          +
        </button>
      </div>
    </div>

    <div class="breathing-app__setting breathing-app__setting--stepper">
      <span class="breathing-app__setting-label">Erholungs-Halt (Sek.)</span>
      <div class="breathing-stepper">
        <button
          type="button"
          class="breathing-stepper__btn"
          aria-label="Erholungs-Halt verringern"
          disabled={isActive || settingRecovery <= 5}
          onclick={() => adjustRecovery(-1)}
        >
          −
        </button>
        <span
          class="breathing-stepper__value"
          role="spinbutton"
          aria-valuemin="5"
          aria-valuemax="30"
          aria-valuenow={settingRecovery}
        >{settingRecovery}</span>
        <button
          type="button"
          class="breathing-stepper__btn"
          aria-label="Erholungs-Halt erhöhen"
          disabled={isActive || settingRecovery >= 30}
          onclick={() => adjustRecovery(1)}
        >
          +
        </button>
      </div>
    </div>
  </div>
</div>
