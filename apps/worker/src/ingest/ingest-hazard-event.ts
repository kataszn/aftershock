// Idempotent ingest: insert-or-skip on USGS's own event ID, write an outbox
// row only when the insert actually happened. One transaction, one guarantee:
// re-polling the feed never creates duplicate downstream work.

import { db } from '@repo/db';
import { seismicEvents, outbox } from '@repo/db';
import type { RawHazardEvent } from './usgs.client';

export async function ingestHazardEvent(event: RawHazardEvent): Promise<{ inserted: boolean }> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(seismicEvents)
      .values({
        id: event.id,
        magnitude: event.magnitude.toString(),
        depthKm: event.depthKm.toString(),
        lat: event.lat.toString(),
        lon: event.lon.toString(),
        locationName: event.place,
        occurredAt: event.occurredAt,
      })
      .onConflictDoNothing({ target: seismicEvents.id })
      .returning({ id: seismicEvents.id });

    if (inserted.length === 0) {
      // Already ingested on a prior poll — nothing new to relay downstream.
      return { inserted: false };
    }

    await tx.insert(outbox).values({
      eventType: 'hazard.detected',
      payload: {
        type: 'hazard.detected',
        hazardEventId: event.id,
        magnitude: event.magnitude,
        lat: event.lat,
        lon: event.lon,
        depthKm: event.depthKm,
        occurredAt: event.occurredAt.toISOString(),
      },
    });

    return { inserted: true };
  });
}