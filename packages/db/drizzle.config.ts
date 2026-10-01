import { defineConfig } from 'drizzle-kit';
import './src/env';

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/aftershock',
  },
  verbose: true,
  strict: true,
});