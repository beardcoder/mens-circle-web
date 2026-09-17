/**
 * SQLite → S3 backup. Snapshots the database, gzips it, uploads it and prunes
 * past the retention window. `VACUUM INTO`, not `cp`: copying a live SQLite file
 * is not crash-safe under WAL.
 *
 * Run on a schedule (Coolify "Scheduled Task" or host crontab), e.g. hourly:
 *
 *   docker exec <web-container> bun run scripts/backup-db.ts
 *
 * Required env:
 *   BACKUP_S3_BUCKET           target bucket
 *   BACKUP_S3_ACCESS_KEY_ID    (or AWS_ACCESS_KEY_ID)
 *   BACKUP_S3_SECRET_ACCESS_KEY(or AWS_SECRET_ACCESS_KEY)
 *
 * Optional env:
 *   DATABASE_PATH              source db (default ./data/mens-circle.db)
 *   BACKUP_S3_PREFIX           key prefix (default "mens-circle-db")
 *   BACKUP_S3_REGION           region (default "auto")
 *   BACKUP_S3_ENDPOINT         custom endpoint for R2/MinIO (else AWS)
 *   BACKUP_RETENTION_DAYS      prune older than N days (default 30; 0 = keep all)
 */
import { Database } from 'bun:sqlite';
import { gzipSync } from 'node:zlib';
import { existsSync, rmSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

function env(key: string, fallback = ''): string {
  const v = process.env[key];
  return v && v.length > 0 ? v : fallback;
}

function fail(message: string): never {
  console.error(`[backup] ${message}`);
  process.exit(1);
}

const dbPath = (() => {
  const p = env('DATABASE_PATH', './data/mens-circle.db');
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
})();

const bucket = env('BACKUP_S3_BUCKET');
const accessKeyId = env('BACKUP_S3_ACCESS_KEY_ID', env('AWS_ACCESS_KEY_ID'));
const secretAccessKey = env('BACKUP_S3_SECRET_ACCESS_KEY', env('AWS_SECRET_ACCESS_KEY'));
const region = env('BACKUP_S3_REGION', env('AWS_REGION', 'auto'));
const endpoint = env('BACKUP_S3_ENDPOINT', env('AWS_ENDPOINT_URL_S3'));
const prefix = env('BACKUP_S3_PREFIX', 'mens-circle-db').replace(/\/+$/, '');
const retentionDays = Number.parseInt(env('BACKUP_RETENTION_DAYS', '30'), 10);

if (!bucket) fail('BACKUP_S3_BUCKET is not set — nothing to upload to.');
if (!accessKeyId || !secretAccessKey) {
  fail('S3 credentials missing — set BACKUP_S3_ACCESS_KEY_ID / BACKUP_S3_SECRET_ACCESS_KEY.');
}
// Bail rather than let bun:sqlite create an empty file at a mistyped path.
if (!existsSync(dbPath)) fail(`database not found at ${dbPath} (check DATABASE_PATH).`);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const snapshotPath = resolve('/tmp', `mens-circle-${stamp}.db`);
const key = `${prefix}/mens-circle-${stamp}.db.gz`;

console.log(`[backup] snapshotting ${dbPath} → ${snapshotPath}`);
try {
  // Read-write open: an explicit `{ readonly: … }` trips bun:sqlite's flag
  // handling with SQLITE_MISUSE, and VACUUM INTO needs a normal connection.
  const db = new Database(dbPath);
  db.run(`VACUUM INTO '${snapshotPath.replace(/'/g, "''")}'`);
  db.close();
} catch (err) {
  fail(`snapshot failed: ${String(err)}`);
}

let gz: Buffer;
try {
  const raw = await Bun.file(snapshotPath).arrayBuffer();
  gz = gzipSync(Buffer.from(raw));
} catch (err) {
  rmSync(snapshotPath, { force: true });
  fail(`gzip failed: ${String(err)}`);
}

const s3 = new Bun.S3Client({ accessKeyId, secretAccessKey, bucket, region, ...(endpoint ? { endpoint } : {}) });
try {
  await s3.write(key, gz, { type: 'application/gzip' });
  console.log(`[backup] uploaded s3://${bucket}/${key} (${(gz.byteLength / 1024).toFixed(1)} KiB)`);
} catch (err) {
  rmSync(snapshotPath, { force: true });
  fail(`upload failed: ${String(err)}`);
}

rmSync(snapshotPath, { force: true });

/** Objects past the cutoff — never the upload just made. */
type Listed = { key?: string; lastModified?: string | Date };
function isExpired(obj: Listed | undefined, cutoff: number): obj is Listed & { key: string } {
  if (!obj?.key || obj.key === key) return false;
  const modified = obj.lastModified ? new Date(obj.lastModified).getTime() : NaN;
  return Number.isFinite(modified) && modified < cutoff;
}

async function pruneExpired(cutoff: number): Promise<number> {
  let token: string | undefined;
  let pruned = 0;
  do {
    const page = await s3.list({
      prefix: `${prefix}/`,
      maxKeys: 1000,
      ...(token ? { continuationToken: token } : {}),
    });
    for (const obj of page?.contents ?? []) {
      if (!isExpired(obj, cutoff)) continue;
      await s3.delete(obj.key);
      pruned++;
    }
    token = page?.isTruncated ? page?.nextContinuationToken : undefined;
  } while (token);
  return pruned;
}

if (retentionDays > 0 && typeof s3.list === 'function') {
  try {
    const pruned = await pruneExpired(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    if (pruned > 0) {
      console.log(`[backup] pruned ${pruned} backup(s) older than ${retentionDays} day(s)`);
    }
  } catch (err) {
    // Best-effort: a failed prune must not fail the backup.
    console.warn(`[backup] prune skipped: ${String(err)}`);
  }
}

console.log('[backup] done.');
