import { db } from '@repo/db';
import { structures } from '@repo/db/schema';

export async function listStructures() {
  return db.select().from(structures);
}