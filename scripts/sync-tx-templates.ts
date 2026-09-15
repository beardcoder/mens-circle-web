/**
 * Push the mail templates in this repo into the listmonk instance.
 *
 *   bun run listmonk:sync            # write
 *   bun run listmonk:sync --dry-run  # show what would change, write nothing
 *
 * Why this exists: the transactional templates and the campaign template live
 * in listmonk's *database*, not on its file system. `--static-dir` only
 * overlays the file-based SYSTEM templates (the ones under
 * `listmonk/static/email-templates/`), so those ship with the image and are
 * always current — but the six tx templates and the newsletter template are
 * rows in Postgres that nothing updates when the files here change. Redesign
 * the templates, deploy, and every mail still goes out in the old design until
 * somebody re-pastes six files by hand in the listmonk UI. That gap is exactly
 * how the poster redesign failed to reach a single inbox.
 *
 * Reads the same env as the server (LISTMONK_URL / _API_USER / _API_TOKEN and
 * the LISTMONK_TX_* ids). Idempotent: a template whose stored body already
 * matches the file is left untouched, so re-running is free.
 *
 * Each template is matched in this order:
 *   1. the id in its LISTMONK_TX_* / LISTMONK_CAMPAIGN_TEMPLATE_ID env var,
 *   2. otherwise an existing template with the same name,
 *   3. otherwise it is created, and the new id is printed for the env.
 *
 * It refuses to overwrite a template whose type does not match (a `tx` file
 * onto a `campaign` row), because that means an env var points at the wrong
 * row and clobbering it would take the newsletter design with it.
 */
import { readFile } from 'node:fs/promises';
import { config, listmonkApiConfigured } from '../src/lib/server/config';

/** The app builds the German subject line and passes it in the tx payload. */
const SUBJECT = '{{ .Tx.Data.subject }}';
const ROOT = new URL('../', import.meta.url);
const DRY_RUN = process.argv.includes('--dry-run');

type TemplateType = 'tx' | 'campaign';

interface Spec {
  path: string;
  env: string;
  name: string;
  type: TemplateType;
}

/**
 * `name` is only used when the template has to be created — an existing one
 * keeps whatever the operator called it in the UI.
 */
const TEMPLATES: Spec[] = [
  {
    path: 'listmonk/tx-templates/registration-confirmation.html',
    env: 'LISTMONK_TX_REGISTRATION_CONFIRMATION',
    name: 'Anmeldebestätigung',
    type: 'tx',
  },
  {
    path: 'listmonk/tx-templates/waitlist-confirmation.html',
    env: 'LISTMONK_TX_WAITLIST_CONFIRMATION',
    name: 'Warteliste – Bestätigung',
    type: 'tx',
  },
  {
    path: 'listmonk/tx-templates/waitlist-promotion.html',
    env: 'LISTMONK_TX_WAITLIST_PROMOTION',
    name: 'Warteliste – Nachrücken',
    type: 'tx',
  },
  {
    path: 'listmonk/tx-templates/event-reminder.html',
    env: 'LISTMONK_TX_EVENT_REMINDER',
    name: 'Termin-Erinnerung',
    type: 'tx',
  },
  {
    path: 'listmonk/tx-templates/event-message.html',
    env: 'LISTMONK_TX_EVENT_MESSAGE',
    name: 'Nachricht an Teilnehmer',
    type: 'tx',
  },
  {
    path: 'listmonk/tx-templates/admin-notification.html',
    env: 'LISTMONK_TX_ADMIN_NOTIFICATION',
    name: 'Admin-Benachrichtigung',
    type: 'tx',
  },
  {
    path: 'listmonk/static/campaign-templates/mens-circle.html',
    env: 'LISTMONK_CAMPAIGN_TEMPLATE_ID',
    name: 'Männerkreis — Newsletter',
    type: 'campaign',
  },
];

interface ApiResult {
  ok: boolean;
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

interface Template {
  id: number;
  name?: string;
  type?: string;
  subject?: string;
  body?: string;
}

const api = async (method: string, path: string, payload?: unknown): Promise<ApiResult> => {
  const res = await fetch(config.LISTMONK_URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `token ${config.LISTMONK_API_USER}:${config.LISTMONK_API_TOKEN}`,
    },
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    // non-JSON / empty body
  }
  return { ok: res.ok, status: res.status, body: parsed };
};

/** listmonk reports its own errors in `message`; fall back to the status. */
const errorText = (res: ApiResult): string => res.body?.message || `HTTP ${res.status}`;

const listTemplates = async (): Promise<Template[]> => {
  const res = await api('GET', '/api/templates?per_page=all');
  if (!res.ok) throw new Error(`Templates konnten nicht gelesen werden: ${errorText(res)}`);
  const data = res.body?.data;
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.results) ? data.results : [];
};

const envId = (key: string): number => {
  const n = Number.parseInt(process.env[key] ?? '', 10);
  return Number.isNaN(n) || n <= 0 ? 0 : n;
};

const resolveId = (spec: Spec, existing: Template[]): number =>
  envId(spec.env) || (existing.find((t) => t.name === spec.name)?.id ?? 0);

/** A campaign template carries no subject — only the tx ones do. */
const payloadFor = (spec: Spec, name: string, body: string): Record<string, string> =>
  spec.type === 'tx' ? { name, type: 'tx', subject: SUBJECT, body } : { name, type: 'campaign', body };

const isCurrent = (spec: Spec, tpl: Template, body: string): boolean =>
  tpl.body === body && (spec.type !== 'tx' || tpl.subject === SUBJECT);

type Outcome = 'created' | 'updated' | 'unchanged' | 'skipped' | 'failed';

interface Report {
  spec: Spec;
  outcome: Outcome;
  id: number;
  note: string;
}

const create = async (spec: Spec, body: string): Promise<Report> => {
  if (DRY_RUN) return { spec, outcome: 'created', id: 0, note: 'würde neu angelegt' };
  const res = await api('POST', '/api/templates', payloadFor(spec, spec.name, body));
  if (!res.ok) return { spec, outcome: 'failed', id: 0, note: errorText(res) };
  const id: number = res.body?.data?.id ?? 0;
  return { spec, outcome: 'created', id, note: `${spec.env}=${id} setzen` };
};

/** Guards that must hold before the stored row may be overwritten. */
const blockingReason = (spec: Spec, res: ApiResult, tpl: Template): string => {
  if (!res.ok) return `Template #${tpl.id} nicht lesbar (${errorText(res)}) — ${spec.env} prüfen`;
  if (tpl.type && tpl.type !== spec.type) {
    return `Template #${tpl.id} hat type="${tpl.type}", erwartet "${spec.type}" — ${spec.env} zeigt auf die falsche Vorlage`;
  }
  return '';
};

const update = async (spec: Spec, body: string, id: number): Promise<Report> => {
  const current = await api('GET', `/api/templates/${id}`);
  const tpl: Template = { id, ...(current.body?.data ?? {}) };

  const blocked = blockingReason(spec, current, tpl);
  if (blocked) return { spec, outcome: current.ok ? 'skipped' : 'failed', id, note: blocked };

  if (isCurrent(spec, tpl, body)) return { spec, outcome: 'unchanged', id, note: '' };
  if (DRY_RUN) return { spec, outcome: 'updated', id, note: 'würde überschrieben' };

  const res = await api('PUT', `/api/templates/${id}`, payloadFor(spec, tpl.name || spec.name, body));
  if (!res.ok) return { spec, outcome: 'failed', id, note: errorText(res) };
  return { spec, outcome: 'updated', id, note: '' };
};

const sync = async (spec: Spec, existing: Template[]): Promise<Report> => {
  let body: string;
  try {
    body = await readFile(new URL(spec.path, ROOT), 'utf8');
  } catch (err) {
    return { spec, outcome: 'failed', id: 0, note: `Datei nicht lesbar: ${String(err)}` };
  }
  const id = resolveId(spec, existing);
  return id > 0 ? update(spec, body, id) : create(spec, body);
};

const MARK: Record<Outcome, string> = {
  created: '+',
  updated: '~',
  unchanged: '=',
  skipped: '!',
  failed: '×',
};

const printReports = (reports: Report[]): void => {
  for (const r of reports) {
    const file = r.spec.path.replace(/^listmonk\//, '');
    const id = r.id > 0 ? `#${r.id}` : '—';
    const note = r.note ? ` — ${r.note}` : '';
    console.log(`  ${MARK[r.outcome]} ${file.padEnd(46)} ${id.padEnd(6)} ${r.outcome}${note}`);
  }
};

const printNewIds = (reports: Report[]): void => {
  const created = reports.filter((r) => r.outcome === 'created' && r.id > 0);
  if (created.length === 0) return;
  console.log('\n[sync] Neu angelegt — diese IDs in die Umgebung eintragen:');
  for (const r of created) console.log(`  ${r.spec.env}=${r.id}`);
};

const main = async (): Promise<void> => {
  if (!listmonkApiConfigured()) {
    console.error('[sync] LISTMONK_URL / LISTMONK_API_USER / LISTMONK_API_TOKEN fehlen.');
    process.exit(1);
  }

  console.log(`[sync] ${config.LISTMONK_URL}${DRY_RUN ? '  (dry run — es wird nichts geschrieben)' : ''}`);
  const existing = await listTemplates();

  // Sequential on purpose: seven small writes against one self-hosted instance,
  // and the output stays in the order of the table above.
  const reports: Report[] = [];
  for (const spec of TEMPLATES) {
    reports.push(await sync(spec, existing));
  }

  printReports(reports);
  printNewIds(reports);

  const bad = reports.filter((r) => r.outcome === 'failed' || r.outcome === 'skipped');
  if (bad.length > 0) {
    console.error(`\n[sync] ${bad.length} Vorlage(n) nicht synchronisiert.`);
    process.exit(1);
  }
  console.log('\n[sync] fertig.');
};

try {
  await main();
} catch (err) {
  console.error('[sync] Abbruch:', err instanceof Error ? err.message : String(err));
  process.exit(1);
}
