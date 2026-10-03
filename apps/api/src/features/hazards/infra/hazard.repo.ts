import { db, desc, sql } from '@repo/db';
import { seismicEvents } from '@repo/db/schema';

export async function listRecentHazards(limit = 50) {
  return db
    .select()
    .from(seismicEvents)
    .orderBy(desc(seismicEvents.ingestedAt))  // was occurredAt
    .limit(limit);
}

export async function countHazards(): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)` }).from(seismicEvents);
  return Number(result[0]?.count ?? 0);
}