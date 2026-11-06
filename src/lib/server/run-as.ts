/**
 * In the container, scripts started by `docker exec` (Coolify's scheduled task) run as
 * root. With `RUN_AS` set (the Dockerfile sets `bun`) such a script restarts itself
 * as that user before touching the database, so SQLite's files never end up owned by
 * root. Outside the container (`RUN_AS` unset) or when not root it does nothing.
 * Resolves only when the script should go on in this process.
 */
export async function runAsAppUser(): Promise<void> {
  const user = process.env.RUN_AS;

  if (!user || process.getuid?.() !== 0) return;

  const child = Bun.spawn(
    ['setpriv', `--reuid=${user}`, `--regid=${user}`, '--init-groups', process.execPath, ...process.argv.slice(1)],
    { stdio: ['inherit', 'inherit', 'inherit'] },
  );

  process.exit(await child.exited);
}
