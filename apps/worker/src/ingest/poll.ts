// In-process poll loop. This is the EventBridge swap seam: everything past
// fetchUsgsFeed() + ingestHazardEvent() is identical whether this loop or an
// EventBridge-invoked HTTP handler is what calls runIngestCycle().

import { fetchUsgsFeed } from './usgs.client';
import { ingestHazardEvent } from '@repo/db';
import { logger, metrics } from '../telemetry';

const POLL_INTERVAL_MS = 60_000;

export async function runIngestCycle(): Promise<void> {
  const endTimer = metrics.ingestCycleDuration.startTimer();
  const events = await fetchUsgsFeed();

  let insertedCount = 0;
  for (const event of events) {
    try {
      const { inserted } = await ingestHazardEvent(event);
      if (inserted) {
        insertedCount++;
        metrics.ingestEventsTotal.inc({ result: 'inserted' });
      } else {
        metrics.ingestEventsTotal.inc({ result: 'duplicate' });
      }
    } catch (err) {
      // One bad event shouldn't take down the whole poll cycle.
      metrics.ingestEventsTotal.inc({ result: 'error' });
      logger.error({ err, eventId: event.id }, 'failed to ingest hazard event');
    }
  }

  endTimer();
  logger.info(
    { fetched: events.length, inserted: insertedCount },
    'ingest cycle complete',
  );
}

export function startPolling(): void {
  runIngestCycle().catch((err) => logger.error({ err }, 'initial ingest cycle failed'));

  setInterval(() => {
    runIngestCycle().catch((err) => logger.error({ err }, 'ingest cycle failed'));
  }, POLL_INTERVAL_MS);
}