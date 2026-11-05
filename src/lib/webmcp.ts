/**
 * WebMCP: the pages offer a few tools to an AI agent in the visitor's browser,
 * through `document.modelContext.registerTool()` (W3C Web Machine Learning CG draft;
 * Chrome from 149 in an origin trial). Where the browser has no model context, nothing
 * happens. Reading tools answer from the public data. Form tools only fill a form in:
 * the person agrees to the privacy policy and submits it themselves, so no agent gives
 * consent or signs anyone up; they never touch the honeypot. See docs/webmcp.md.
 */
import type { PublicEvents } from '@components/event/types';

interface ToolAnnotations {
  /** Changes nothing: an agent may call it without asking. */
  readOnlyHint?: boolean;
}

interface InputSchema {
  type: 'object';
  properties: Record<string, object>;
  required?: string[];
}

export interface Tool {
  /** ASCII letters, digits, `-`, `_`, `.`; a verb for what happens. */
  name: string;
  /** Shown to the person: German, like the site. */
  title: string;
  /** For the model: what the tool does and when to use it. */
  description: string;
  inputSchema: InputSchema;
  annotations?: ToolAnnotations;
  /** The answer goes back to the agent as text, a failure too (see `readInput`). */
  execute: (input: Record<string, unknown>, options: { signal: AbortSignal }) => Promise<string> | string;
}

interface ModelContext {
  registerTool: (tool: Tool, options?: { signal?: AbortSignal }) => Promise<void>;
}

/** Offers a tool until the returned function is called. */
export function provideTool(tool: Tool): () => void {
  const context = (document as Document & { modelContext?: ModelContext }).modelContext;
  const controller = new AbortController();

  // Rejected where the `tools` permission is off: the page simply offers nothing.
  context?.registerTool(tool, { signal: controller.signal }).catch(() => {});

  return () => controller.abort();
}

/** A text field the form tool fills: the control's `name`, and how to describe and bound it. */
export interface Field {
  name: string;
  description: string;
  required?: boolean;
  maxLength: number;
  email?: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What is wrong with one value, in words the agent can act on; `null` when it fits. */
function problem(field: Field, value: string): string | null {
  if (!value) return field.required ? `${field.name} fehlt.` : null;

  if (value.length > field.maxLength) return `${field.name} darf höchstens ${field.maxLength} Zeichen haben.`;

  return field.email && !EMAIL.test(value) ? `${field.name} ist keine gültige E-Mail-Adresse.` : null;
}

/**
 * The values to fill in, trimmed, and every problem at once. Problems go back as the
 * tool's answer, not as an error: a browser passes a thrown message on only as
 * "invocation failed", and the agent needs the words to correct its input.
 */
export function readInput(
  fields: Field[],
  input: Record<string, unknown>,
): { values: Record<string, string>; problems: string[] } {
  const values = Object.fromEntries(
    fields.map(({ name }) => {
      const raw = input[name];

      return [name, typeof raw === 'string' ? raw.trim() : ''];
    }),
  );

  const problems = fields.map((field) => problem(field, values[field.name])).filter((text) => text !== null);

  return { values, problems };
}

const schema = (fields: Field[]): InputSchema => ({
  type: 'object',
  properties: Object.fromEntries(
    fields.map((field) => [
      field.name,
      {
        type: 'string',
        description: field.description,
        maxLength: field.maxLength,
        ...(field.email ? { format: 'email' } : {}),
      },
    ]),
  ),
  required: fields.filter((field) => field.required).map((field) => field.name),
});

interface FormToolOptions {
  name: string;
  title: string;
  description: string;
  form: HTMLFormElement;
  fields: Field[];
  /** Where the person continues: the privacy consent, or the button. */
  next: HTMLElement | null;
  /** What the agent tells the person once the form is filled in. */
  done: string;
}

/**
 * A tool that fills a form in and hands it to the person: each value is set as if
 * typed (an `input` event, so the form clears its messages and counts), then the form
 * scrolls into view and the focus waits where the person continues.
 */
export const formTool = ({ form, fields, next, done, ...tool }: FormToolOptions): Tool => ({
  ...tool,
  inputSchema: schema(fields),
  execute: (input) => {
    const { values, problems } = readInput(fields, input);

    if (problems.length > 0) return `Nichts ausgefüllt. Bitte korrigieren: ${problems.join(' ')}`;

    for (const [name, value] of Object.entries(values)) {
      const control = form.elements.namedItem(name);

      if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) continue;

      control.value = value;
      control.dispatchEvent(new Event('input', { bubbles: true }));
    }

    next?.focus({ preventScroll: true });
    (next ?? form).scrollIntoView({
      block: 'center',
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });

    return done;
  },
});

/** The upcoming evenings as the agent reads them: one line each, with the page to register on. */
export function eventsText({ events }: Pick<PublicEvents, 'events'>, origin: string): string {
  if (events.length === 0)
    return `Gerade ist kein Abend geplant. Über neue Termine informiert die E-Mail-Benachrichtigung: ${origin}/event#benachrichtigung`;

  const lines = events.slice(0, 6).map(({ slug, view }) => {
    const date = view.title.filter(Boolean).join(' ');
    const rows = view.rows.map((row) => `${row.label}: ${row.value}`).join('; ');

    return `- ${date} · ${rows} · Anmeldung: ${origin}/event/${slug}#anmeldung`;
  });

  return [`Kommende Abende (${events.length}):`, ...lines].join('\n');
}
