import { db, desc, eq } from '@repo/db';
import { alerts, structures, seismicEvents } from '@repo/db/schema';

export async function listRecentAlerts(limit = 50) {
  return db
    .select({
      id: alerts.id,
      riskScore: alerts.riskScore,
      threshold: alerts.threshold,
      createdAt: alerts.createdAt,
      deliveredAt: alerts.deliveredAt,
      structureName: structures.name,
      structureType: structures.structureType,
      hazardMagnitude: seismicEvents.magnitude,
      hazardPlace: seismicEvents.locationName,
    })
    .from(alerts)
    .innerJoin(structures, eq(alerts.structureId, structures.id))
    .innerJoin(seismicEvents, eq(alerts.seismicEventId, seismicEvents.id))
    .orderBy(desc(alerts.createdAt))
    .limit(limit);
}