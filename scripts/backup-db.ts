/** SQLite → S3 backup. */
import { Database } from 'bun:sqlite';
import { existsSync, rmSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

function env(key: string, fallback = ''): string {
  const v = process.env[key];
  return v && v.length > 0 ? v : fallback;
}

/** Whether the required S3 destination env is present — mirrors listmonkApiConfigured(). */
export function backupConfigured(): boolean {
  return (
    env('BACKUP_S3_BUCKET').length > 0 &&
    env('BACKUP_S3_ACCESS_KEY_ID', env('AWS_ACCESS_KEY_ID')).length > 0 &&
    env('BACKUP_S3_SECRET_ACCESS_KEY', env('AWS_SECRET_ACCESS_KEY')).length > 0
  );
}

interface BackupConfig {
  dbPath: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  endpoint: string;
  prefix: string;
  retentionDays: number;
}

/** Reads and validates env into a config, or throws with the missing piece. */
function readConfig(): BackupConfig {
  const dbPathEnv = env('DATABASE_PATH', './data/mens-circle.db');
  const dbPath = isAbsolute(dbPathEnv) ? dbPathEnv : resolve(process.cwd(), dbPathEnv);
  const bucket = env('BACKUP_S3_BUCKET');
  const accessKeyId = env('BACKUP_S3_ACCESS_KEY_ID', env('AWS_ACCESS_KEY_ID'));
  const secretAccessKey = env('BACKUP_S3_SECRET_ACCESS_KEY', env('AWS_SECRET_ACCESS_KEY'));

  if (!bucket) throw new Error('BACKUP_S3_BUCKET is not set — nothing to upload to.');
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('S3 credentials missing — set BACKUP_S3_ACCESS_KEY_ID / BACKUP_S3_SECRET_ACCESS_KEY.');
  }
  // Bail rather than let bun:sqlite create an empty file at a mistyped path.
  if (!existsSync(dbPath)) throw new Error(`database not found at ${dbPath} (check DATABASE_PATH).`);

  return {
    dbPath,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: env('BACKUP_S3_REGION', env('AWS_REGION', 'auto')),
    endpoint: env('BACKUP_S3_ENDPOINT', env('AWS_ENDPOINT_URL_S3')),
    prefix: env('BACKUP_S3_PREFIX', 'mens-circle-db').replace(/\/+$/, ''),
    retentionDays: Number.parseInt(env('BACKUP_RETENTION_DAYS', '30'), 10),
  };
}

/** Snapshots `dbPath` via `VACUUM INTO` and gzips the result. Cleans up the snapshot file itself. */
async function snapshotToGzip(dbPath: string, snapshotPath: string): Promise<Uint8Array> {
  console.log(`[backup] snapshotting ${dbPath} → ${snapshotPath}`);
  try {
    // Read-write open: an explicit `{ readonly: … }` trips bun:sqlite's flag
    // handling with SQLITE_MISUSE, and VACUUM INTO needs a normal connection.
    const db = new Database(dbPath);
    db.run(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`);
    db.close();
  } catch (err) {
    throw new Error(`snapshot failed: ${String(err)}`, { cause: err });
  }

  try {
    return Bun.gzipSync(await Bun.file(snapshotPath).bytes());
  } catch (err) {
    throw new Error(`gzip failed: ${String(err)}`, { cause: err });
  } finally {
    rmSync(snapshotPath, { force: true });
  }
}

/** Objects past the cutoff — never the upload just made. */
type Listed = { key?: string; lastModified?: string | Date };
function isExpired(obj: Listed | undefined, cutoff: number, currentKey: string): obj is Listed & { key: string } {
  if (!obj?.key || obj.key === currentKey) return false;
  const modified = obj.lastModified ? new Date(obj.lastModified).getTime() : NaN;
  return Number.isFinite(modified) && modified < cutoff;
}

async function pruneExpired(s3: Bun.S3Client, prefix: string, currentKey: string, cutoff: number): Promise<number> {
  let token: string | undefined;
  let pruned = 0;
  do {
    const page = await s3.list({
      prefix: `${prefix}/`,
      maxKeys: 1000,
      ...(token ? { continuationToken: token } : {}),
    });
    for (const obj of page?.contents ?? []) {
      if (!isExpired(obj, cutoff, currentKey)) continue;
      await s3.delete(obj.key);
      pruned++;
    }
    token = page?.isTruncated ? page?.nextContinuationToken : undefined;
  } while (token);
  return pruned;
}

/** Best-effort: a failed prune must not fail the backup. */
async function pruneIfConfigured(s3: Bun.S3Client, config: BackupConfig, currentKey: string): Promise<void> {
  if (config.retentionDays <= 0 || typeof s3.list !== 'function') return;
  try {
    const cutoff = Date.now() - config.retentionDays * 24 * 60 * 60 * 1000;
    const pruned = await pruneExpired(s3, config.prefix, currentKey, cutoff);
    if (pruned > 0) {
      console.log(`[backup] pruned ${pruned} backup(s) older than ${config.retentionDays} day(s)`);
    }
  } catch (err) {
    console.warn(`[backup] prune skipped: ${String(err)}`);
  }
}

/** One backup pass: snapshot, gzip, upload, prune. Throws on any failure. */
export async function runBackup(): Promise<void> {
  const config = readConfig();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotPath = resolve('/tmp', `mens-circle-${stamp}.db`);
  const key = `${config.prefix}/mens-circle-${stamp}.db.gz`;

  const gz = await snapshotToGzip(config.dbPath, snapshotPath);

  const s3 = new Bun.S3Client({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    bucket: config.bucket,
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
  });
  try {
    await s3.write(key, gz, { type: 'application/gzip' });
    console.log(`[backup] uploaded s3://${config.bucket}/${key} (${(gz.byteLength / 1024).toFixed(1)} KiB)`);
  } catch (err) {
    throw new Error(`upload failed: ${String(err)}`, { cause: err });
  }

  await pruneIfConfigured(s3, config, key);

  console.log('[backup] done.');
}

if (import.meta.main) {
  try {
    await runBackup();
  } catch (err) {
    console.error(`[backup] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
