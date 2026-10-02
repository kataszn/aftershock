// Real, small, named structures — not a synthetic dataset. 
// Run once against a fresh DB: `tsx packages/db/src/seed.ts`

import { and, eq, notInArray } from 'drizzle-orm';
import { db } from './client';
import { structures, webhookSubscriptions } from './schema';
import { createLogger } from '@repo/telemetry';

const logger = createLogger({ service: 'aftershock-seed' });

const SEED_STRUCTURES = [
  // Japan — near the Miyazaki fixture, for an end-to-end demo run
  { name: 'Nichinan Coastal Bridge', lat: 31.6, lon: 131.37, structureType: 'bridge' as const },
  { name: 'Miyazaki City Hall', lat: 31.911, lon: 131.424, structureType: 'reinforced_high_rise' as const },
  { name: 'Oyodo River Dam', lat: 32.05, lon: 131.3, structureType: 'dam' as const },

  // California — near the Geysers fixture, should never alert (M2.4 filtered pre-scoring)
  { name: 'Geysers Geothermal Access Bridge', lat: 38.79, lon: -122.78, structureType: 'bridge' as const },
  { name: 'Cloverdale Historic District', lat: 38.806, lon: -123.017, structureType: 'unreinforced_masonry' as const },

  // Nigeria — ties the portfolio back to your own positioning, real coordinates
  { name: 'Third Mainland Bridge', lat: 6.4698, lon: 3.4023, structureType: 'bridge' as const },
  { name: 'Federal Ministry of Works and Housing HQ', lat: 9.0579, lon: 7.4951, structureType: 'reinforced_high_rise' as const },

  // A generic control case
  { name: 'Riverside Community Center', lat: 34.0, lon: -117.4, structureType: 'generic_structure' as const },
];

const SEED_WEBHOOKS_SUBSCRIPTIONS = [
  // A real receiving endpoint, part of your own deployed service — doubles
  // as both your test target during development and a legitimate "this is
  // how a real consumer would receive alerts" demo piece in the writeup.
  // Must match the API route: webhookTestRouter.post('/receive') mounted at
  // /api/webhooks → full path is /api/webhooks/receive.
  { 
    url: 'http://localhost:8000/api/webhooks/receive', 
    secret: 'supersecret',
  },
];

async function seedStructures() {
  logger.info({ count: SEED_STRUCTURES.length }, 'seeding structures');

  let inserted = 0;
  let skipped = 0;

  for (const s of SEED_STRUCTURES) {
    const existing = await db
      .select({ id: structures.id, structureType: structures.structureType })
      .from(structures)
      .where(eq(structures.name, s.name))
      .limit(1);

    const match = existing[0];
    if (match) {
      if (match.structureType === s.structureType) {
        logger.debug({ name: s.name }, 'skip structure — already exists with matching type');
        skipped++;
        continue;
      }
      logger.warn(
        { name: s.name, existingType: match.structureType, seedType: s.structureType },
        'skip structure — already exists with different type',
      );
      skipped++;
      continue;
    }

    await db.insert(structures).values({
      name: s.name,
      lat: s.lat.toString(),
      lon: s.lon.toString(),
      structureType: s.structureType,
    });
    inserted++;
  }

  logger.info({ inserted, skipped }, 'structures seeded');
}

async function seedWebhookSubscriptions() {
  logger.info({ count: SEED_WEBHOOKS_SUBSCRIPTIONS.length }, 'seeding webhook subscriptions');

  let inserted = 0;
  let updated = 0;
  let deactivated = 0;

  const seedUrls = SEED_WEBHOOKS_SUBSCRIPTIONS.map((w) => w.url);

  for (const w of SEED_WEBHOOKS_SUBSCRIPTIONS) {
    const existing = await db
      .select({ id: webhookSubscriptions.id, secret: webhookSubscriptions.secret, active: webhookSubscriptions.active })
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.url, w.url))
      .limit(1);

    const match = existing[0];
    if (match) {
      // Refresh the row so the seed is the source of truth: re-activate if it
      // was previously deactivated, and update the secret if it changed.
      if (!match.active || match.secret !== w.secret) {
        await db
          .update(webhookSubscriptions)
          .set({ active: true, secret: w.secret })
          .where(eq(webhookSubscriptions.id, match.id));
        updated++;
      }
      logger.debug({ url: w.url, active: match.active }, 'skip webhook — already exists');
      continue;
    }

    await db.insert(webhookSubscriptions).values({
      url: w.url,
      secret: w.secret,
    });
    inserted++;
  }

  // Deactivate any subscription that is no longer part of the seed list —
  // prevents stale URLs (e.g. a renamed endpoint) from receiving deliveries.
  const stale = await db
    .update(webhookSubscriptions)
    .set({ active: false })
    .where(and(eq(webhookSubscriptions.active, true), notInArray(webhookSubscriptions.url, seedUrls)));

  deactivated = stale.rowCount ?? 0;

  logger.info({ inserted, updated, deactivated }, 'webhook subscriptions seeded');
}

async function seed() {
  logger.info('seed started');
  await seedStructures();
  await seedWebhookSubscriptions();
  logger.info('seed completed');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, 'seed failed');
    process.exit(1);
  });