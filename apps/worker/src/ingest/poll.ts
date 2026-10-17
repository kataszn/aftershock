// In-process poll loop. This is the EventBridge swap seam: everything past
// fetchUsgsFeed() + ingestHazardEvent() is identical whether this loop or an
// EventBridge-invoked HTTP handler is what calls runIngestCycle().

import { fetchUsgsFeed } from './usgs.client';
import { ingestHazardEvent } from '@repo/db';
import { logger, metrics } from '../telemetry';

// Poll cadence. BASE is how often we check while events are actively landing.
// A cycle that ingests nothing doubles the wait (capped at MAX) so a quiet feed
// costs far fewer DB round-trips; any cycle that inserts an event snaps the
// cadence straight back to BASE. The USGS feed returns duplicates for up to an
// hour, so "inserted === 0" is the signal that there is genuinely nothing new
// to write and no reason to keep hitting the DB at full rate.
const BASE_POLL_INTERVAL_MS = 60_000;
const MAX_POLL_INTERVAL_MS = 15 * 60_000;
const BACKOFF_MULTIPLIER = 2;

export type IngestCycleResult = {
  fetched: number;
  inserted: number;
};

export async function runIngestCycle(): Promise<IngestCycleResult> {
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

  return { fetched: events.length, inserted: insertedCount };
}

export function startPolling(): void {
  // Self-scheduling timeout rather than setInterval: the delay changes between
  // cycles, and a timeout can't overlap with a still-running cycle.
  let intervalMs = BASE_POLL_INTERVAL_MS;

  const tick = async (): Promise<void> => {
    try {
      const { inserted } = await runIngestCycle();

      if (inserted > 0) {
        if (intervalMs !== BASE_POLL_INTERVAL_MS) {
          logger.info(
            { nextPollMs: BASE_POLL_INTERVAL_MS },
            'new events ingested, resetting poll cadence',
          );
        }
        intervalMs = BASE_POLL_INTERVAL_MS;
      } else {
        const nextMs = Math.min(intervalMs * BACKOFF_MULTIPLIER, MAX_POLL_INTERVAL_MS);
        if (nextMs !== intervalMs) {
          logger.info(
            { nextPollMs: nextMs },
            'no new events ingested, backing off poll cadence',
          );
        }
        intervalMs = nextMs;
      }
    } catch (err) {
      // A failing fetch/structure shouldn't be retried at full rate either.
      logger.error({ err }, 'ingest cycle failed');
      intervalMs = Math.min(intervalMs * BACKOFF_MULTIPLIER, MAX_POLL_INTERVAL_MS);
    }

    metrics.ingestPollInterval.set(intervalMs / 1000);
    setTimeout(tick, intervalMs);
  };

  metrics.ingestPollInterval.set(intervalMs / 1000);
  void tick();
}