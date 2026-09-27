import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/aftershock';

export const pool = new Pool({ connectionString, max: 10 });

export const db = drizzle(pool, { schema });