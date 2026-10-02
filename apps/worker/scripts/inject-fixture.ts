// worker/src/scripts/inject-fixture.ts
// Manually injects a known real USGS event through the real ingest path —
// bypasses fetchUsgsFeed() only, everything downstream (outbox, relay,
// queue, scoring) runs exactly as it would live. Run with: tsx worker/src/scripts/inject-fixture.ts

import { ingestHazardEvent } from '@repo/db';
import { createLogger } from '@repo/telemetry';
import type { RawHazardEvent } from '../src/ingest/usgs.client';

const logger = createLogger({ service: 'aftershock-inject-fixture' });

const MIYAZAKI_M7_1: RawHazardEvent = {
  id: 'us6000na48',
  magnitude: 7.1,
  place: '20 km SSW of Miyazaki, Japan',
  occurredAt: new Date('2024-08-08T08:19:15.130Z'), // real USGS 'time'
  lat: 31.745,
  lon: 131.3534,
  depthKm: 25.0,
};

ingestHazardEvent(MIYAZAKI_M7_1)
  .then((result) => {
    logger.info({ result }, 'fixture injected');
    process.exit(0);
  })
  .catch((err) => {
    logger.error({ err }, 'injection failed');
    process.exit(1);
  });