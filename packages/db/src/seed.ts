// Real, small, named structures — not a synthetic dataset. 
// Run once against a fresh DB: `tsx packages/db/src/seed.ts`

import { db } from './client';
import { structures } from './schema';

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

async function seed() {
  console.log(`Seeding ${SEED_STRUCTURES.length} structures...`);

  for (const s of SEED_STRUCTURES) {
    await db.insert(structures).values({
      name: s.name,
      lat: s.lat.toString(),
      lon: s.lon.toString(),
      structureType: s.structureType,
    });
  }

  console.log('Done.');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });