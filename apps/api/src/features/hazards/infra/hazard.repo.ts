import { db, desc } from '@repo/db';
import { seismicEvents } from '@repo/db/schema';

export async function listRecentHazards(limit = 50) {
  return db.select().from(seismicEvents).orderBy(desc(seismicEvents.occurredAt)).limit(limit);
}