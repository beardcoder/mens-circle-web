import { defineConfig } from 'drizzle-kit';

// drizzle-kit config — used to generate SQL migrations from the schema:
//   bunx drizzle-kit generate
// The generated SQL under ./drizzle is applied at runtime on server boot
// (see src/lib/server/db/index.ts), so it ships with the build.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_PATH || './data/mens-circle.db',
  },
});
