// packages/shared/src/geo.ts
// Pure geo math — haversineDistanceKm is the actual distance calc;
// effectiveRadiusKm/maxQueryRadiusKm mirror the same
// magnitude-scaled radius logic from scoring.ts, why? Because the job needs to
// know "how far to even look" before it can score anything.

const EARTH_RADIUS_KM = 6371;

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

export function effectiveRadiusKm(magnitude: number): number {
  return 50 * Math.pow(2, magnitude - 5);
}

// 3x effective radius — beyond this, distanceDecay's contribution to risk
// is ~5% or less regardless of structure type, so it's not worth querying
// past this point. See scoring.ts / design doc for the derivation.
export function maxQueryRadiusKm(magnitude: number): number {
  const ABSOLUTE_CEILING_KM = 1000; // safety valve for extreme (M8+) magnitudes
  return Math.min(3 * effectiveRadiusKm(magnitude), ABSOLUTE_CEILING_KM);
}