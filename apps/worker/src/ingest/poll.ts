// In-process poll loop. This is the EventBridge swap seam: everything past
// fetchUsgsFeed() + ingestHazardEvent() is identical whether this loop or an
// EventBridge-invoked HTTP handler is what calls runIngestCycle().

import { fetchUsgsFeed } from './usgs.client';
import { ingestHazardEvent } from './ingest-hazard-event';

const POLL_INTERVAL_MS = 60_000;

export async function runIngestCycle(): Promise<void> {
  const events = await fetchUsgsFeed();

  let insertedCount = 0;
  for (const event of events) {
    try {
      const { inserted } = await ingestHazardEvent(event);
      if (inserted) insertedCount++;
    } catch (err) {
      // One bad event shouldn't take down the whole poll cycle.
      console.error(`Failed to ingest hazard event ${event.id}:`, err);
    }
  }

  console.log(`Ingest cycle: ${events.length} fetched, ${insertedCount} new`);
}

export function startPolling(): void {
  runIngestCycle().catch((err) => console.error('Initial ingest cycle failed:', err));

  setInterval(() => {
    runIngestCycle().catch((err) => console.error('Ingest cycle failed:', err));
  }, POLL_INTERVAL_MS);
}