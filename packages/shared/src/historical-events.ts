// packages/shared/src/historical-events.ts
// A small, fixed set of real, named USGS events — not arbitrary user input.
// Prevents the endpoint from being "inject any payload you want" (which
// would undercut the real-data story) and keeps the demo deterministic.

export const HISTORICAL_EVENTS = {
  'miyazaki-m7.1': {
    id: 'us6000na48',
    magnitude: 7.1,
    place: '20 km SSW of Miyazaki, Japan',
    occurredAt: new Date('2024-08-08T08:19:15.130Z'),
    lat: 31.745,
    lon: 131.3534,
    depthKm: 25.0,
  },
  'geysers-m2.4': {
    id: 'nc74001234',
    magnitude: 2.4,
    place: '7 km NW of The Geysers, CA',
    occurredAt: new Date('2026-09-25T00:00:00.000Z'),
    lat: 38.8183327,
    lon: -122.8131638,
    depthKm: 1.83,
  },
} as const;

export type HistoricalEventKey = keyof typeof HISTORICAL_EVENTS;