import { db, desc, eq, sql } from '@repo/db';
import { alerts, structures, seismicEvents, alertDeliveries } from '@repo/db/schema';

export async function countAlerts(): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)` }).from(alerts);
  return Number(result[0]?.count ?? 0);
}

export async function countCriticalAlerts(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(alerts)
    .where(sql`${alerts.riskScore} > 2.5`);
  return Number(result[0]?.count ?? 0);
}

export async function listRecentAlerts(limit = 50) {
  return db
    .select({
      id: alerts.id,
      riskScore: alerts.riskScore,
      threshold: alerts.threshold,
      createdAt: alerts.createdAt,
      structureName: structures.name,
      structureType: structures.structureType,
      hazardMagnitude: seismicEvents.magnitude,
      hazardPlace: seismicEvents.locationName,
      hazardLat: seismicEvents.lat,
      hazardLon: seismicEvents.lon,
      hazardDepthKm: seismicEvents.depthKm,
      isReplay: seismicEvents.isReplay,
      deliveredCount: sql<number>`count(*) filter (where ${alertDeliveries.status} = 'DELIVERED')`,
      totalSubscribers: sql<number>`count(${alertDeliveries.id})`,
    })
    .from(alerts)
    .innerJoin(structures, eq(alerts.structureId, structures.id))
    .innerJoin(seismicEvents, eq(alerts.seismicEventId, seismicEvents.id))
    .leftJoin(alertDeliveries, eq(alertDeliveries.alertId, alerts.id))
    .groupBy(alerts.id, structures.name, structures.structureType, seismicEvents.magnitude, seismicEvents.locationName, seismicEvents.lat, seismicEvents.lon, seismicEvents.depthKm, seismicEvents.isReplay)
    .orderBy(desc(alerts.createdAt))
    .limit(limit);
}