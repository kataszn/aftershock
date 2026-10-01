// Records an alert and queues its delivery via the outbox (same pattern as hazard ingest).

import { db } from '@repo/db';
import { alerts } from '@repo/db/schema';
import { outbox } from '@repo/db/schema';
import type { RiskBucket } from '../jobs/scoring';
import { thresholdCrossedFor } from '@repo/shared';


export type DispatchAlertArgs = {
  hazardEventId: string;
  structureId: string;
  riskScore: number;
  bucket: RiskBucket;
};

export async function dispatchAlert({
  hazardEventId,
  structureId,
  riskScore,
  bucket,
}: DispatchAlertArgs): Promise<void> {
  if (bucket !== 'HIGH' && bucket !== 'CRITICAL') {
    // Guard against misuse — dispatchAlert should only ever be called for
    // buckets that actually cross a threshold. Fail if that invariant breaks.
    throw new Error(`dispatchAlert called with non-alerting bucket: ${bucket}`);
  }

  await db.transaction(async (tx) => {
    const [alert] = await tx
      .insert(alerts)
      .values({
        seismicEventId: hazardEventId,
        structureId,
        riskScore: riskScore.toString(),
        threshold: thresholdCrossedFor(bucket).toString(),
      })
      .returning({ id: alerts.id });

    if (!alert) {
      throw new Error('Failed to create alert');
    }

    await tx.insert(outbox).values({
      eventType: 'alert.triggered',
      payload: {
        alertId: alert.id,
        hazardEventId,
        structureId,
        riskScore,
        bucket,
      },
    });
  });
}