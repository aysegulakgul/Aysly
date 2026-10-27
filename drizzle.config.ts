import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/shared/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://aysly:aysly_local_dev@127.0.0.1:5433/aysly',
  },
  strict: true,
  verbose: true,
});
