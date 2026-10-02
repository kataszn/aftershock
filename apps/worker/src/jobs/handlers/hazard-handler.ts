import { db } from '@repo/db';
import { structures, riskAssessments } from '@repo/db/schema';
import type { HazardDetected } from '@repo/shared/events';
import { haversineDistanceKm, maxQueryRadiusKm } from '@repo/shared/geo';
import { scoreRisk } from '../scoring';
import { bucketForScore, MIN_ALERTABLE_MAGNITUDE } from '@repo/shared';
import { runJobExecution } from '../job-execution';
import { dispatchAlert } from '../../alerts/dispatch-alert';
import { logger, metrics } from '../../telemetry';

function assertHazardDetected(payload: unknown): HazardDetected {
  const p = payload as Partial<HazardDetected>;
  if (
    typeof p?.hazardEventId !== 'string' ||
    typeof p?.magnitude !== 'number' ||
    typeof p?.lat !== 'number' ||
    typeof p?.lon !== 'number' ||
    typeof p?.depthKm !== 'number'
  ) {
    throw new Error(`Malformed hazard.detected payload: ${JSON.stringify(payload)}`);
  }
  return p as HazardDetected;
}

export async function processHazardEvent(rawPayload: unknown): Promise<void> {
  const event = assertHazardDetected(rawPayload);
  if (event.magnitude < MIN_ALERTABLE_MAGNITUDE) {
    return; // below threshold — no structure could score high enough to matter
  }

  const radiusKm = maxQueryRadiusKm(event.magnitude);

  const allStructures = await db.select().from(structures);

  const inRange = allStructures
    .map((s) => ({
      structure: s,
      distanceKm: haversineDistanceKm(event.lat, event.lon, Number(s.lat), Number(s.lon)),
    }))
    .filter(({ distanceKm }) => distanceKm <= radiusKm);
  logger.debug(
    { hazardEventId: event.hazardEventId, radiusKm, inRange: inRange.length },
    'geo-match complete',
  );

  for (const { structure, distanceKm } of inRange) {
    const idempotencyKey = `job:${event.hazardEventId}:${structure.id}`;

    await runJobExecution({
      idempotencyKey,
      jobType: 'risk.score',
      payload: { hazardEventId: event.hazardEventId, structureId: structure.id },
      run: async () => {
        const riskScore = scoreRisk({
          magnitude: event.magnitude,
          distanceKm,
          depthKm: event.depthKm,
          structureType: structure.structureType,
        });
        const bucket = bucketForScore(riskScore);
        const alertTriggered = bucket === 'HIGH' || bucket === 'CRITICAL';
        metrics.riskAssessmentsTotal.inc({ bucket });
        logger.debug(
          { hazardEventId: event.hazardEventId, structureId: structure.id, riskScore, bucket, alertTriggered },
          'risk scored',
        );

        await db
          .insert(riskAssessments)
          .values({
            seismicEventId: event.hazardEventId,
            structureId: structure.id,
            distanceKm: distanceKm.toString(),
            riskScore: riskScore.toString(),
            alertTriggered,
          })
          .onConflictDoNothing({
            target: [riskAssessments.seismicEventId, riskAssessments.structureId],
          });

        if (alertTriggered) {
          await dispatchAlert({
            hazardEventId: event.hazardEventId,
            structureId: structure.id,
            riskScore,
            bucket,
          });
        }

        return { riskScore, bucket, alertTriggered };
      },
    });
  }
}