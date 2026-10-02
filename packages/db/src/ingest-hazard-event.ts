import { db } from './client';
import { seismicEvents, outbox } from './schema';

export type RawHazardEvent = {
  id: string;
  magnitude: number;
  place: string;
  occurredAt: Date;
  lat: number;
  lon: number;
  depthKm: number;
  isReplay?: boolean;
};

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
        isReplay: event.isReplay ?? false,
      })
      .onConflictDoNothing({ target: seismicEvents.id })
      .returning({ id: seismicEvents.id });

    if (inserted.length === 0) return { inserted: false };

    await tx.insert(outbox).values({
      eventType: 'hazard.detected',
      payload: {
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