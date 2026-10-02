// Geospatial helpers for the 3D viewer.
//
// The scene uses a unified scale: 1 relative scene unit = 1 real-world km.
// The scene origin (0, 0, 0) is the surface point directly above the
// epicenter. North is -Z, East is +X, and Y is elevation (surface = 0,
// depth = negative Y).

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two lat/lon points, in kilometres. */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** Initial bearing (degrees clockwise from true north) from point 1 to point 2. */
export function initialBearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δλ = toRad(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export interface SceneOffset {
  /** East offset in scene units (km). */
  x: number;
  /** North offset in scene units (km), mapped to -Z. */
  z: number;
  /** Real-world horizontal distance in km. */
  distanceKm: number;
  /** Bearing from origin to target, degrees clockwise from north. */
  bearingDeg: number;
}

/**
 * Convert a target lat/lon into a horizontal scene offset from an origin
 * lat/lon, using real haversine distance and bearing. 1 unit = 1 km.
 */
export function projectToScene(
  originLat: number,
  originLon: number,
  targetLat: number,
  targetLon: number,
): SceneOffset {
  const distanceKm = haversineDistanceKm(originLat, originLon, targetLat, targetLon);
  const bearingDeg = initialBearingDeg(originLat, originLon, targetLat, targetLon);
  const bearingRad = (bearingDeg * Math.PI) / 180;

  // Bearing 0° = north = -Z; bearing 90° = east = +X.
  const x = distanceKm * Math.sin(bearingRad);
  const z = -distanceKm * Math.cos(bearingRad);

  return { x, z, distanceKm, bearingDeg };
}

/** Slant distance from a hypocenter at `depthKm` to a surface point `horizontalKm` away. */
export function slantDistanceKm(depthKm: number, horizontalKm: number): number {
  return Math.hypot(depthKm, horizontalKm);
}
