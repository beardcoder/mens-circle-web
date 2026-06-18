import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit config — powers `bun run db:studio` (a quick DB browser/editor for
 * the admin) and migration generation during development. The running app
 * creates its schema idempotently on boot (see src/server/db/index.ts), so this
 * is a dev convenience, not part of the deploy path.
 */
export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './src/server/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_PATH || './data/app.db',
  },
});
