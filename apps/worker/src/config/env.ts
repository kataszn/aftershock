import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Load the root .env for the worker process. Kept independent of @repo/db/env
// so the worker owns its own environment loading and doesn't depend on the db
// package's module side effects.
// Repo root is four levels up from this file: apps/worker/src/config/env.ts
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');

config({ path: path.join(repoRoot, '.env') });
