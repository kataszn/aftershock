import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Load the root .env so DATABASE_URL is available to drizzle-kit and the runtime client.
// Repo root is three levels up from this file: packages/db/src/env.ts
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

config({ path: path.join(repoRoot, '.env') });