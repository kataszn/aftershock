// Fetches + parses the USGS real-time feed into a minimal typed shape.
// Ingest layer only extracts what we store — no filtering, no scoring here.

const USGS_FEED_URL =
  'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';

export type UsgsFeature = {
  type: 'Feature';
  properties: {
    mag: number;
    place: string;
    time: number; // epoch ms
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number, number]; // [lon, lat, depthKm]
  };
  id: string;
};

export type RawHazardEvent = {
  id: string;
  magnitude: number;
  place: string;
  occurredAt: Date;
  lat: number;
  lon: number;
  depthKm: number;
};

export async function fetchUsgsFeed(): Promise<RawHazardEvent[]> {
  const res = await fetch(USGS_FEED_URL);
  if (!res.ok) {
    throw new Error(`USGS feed fetch failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as { features: UsgsFeature[] };

  return body.features.map(toRawHazardEvent);
}

function toRawHazardEvent(feature: UsgsFeature): RawHazardEvent {
  const [lon, lat, depthKm] = feature.geometry.coordinates;

  return {
    id: feature.id,
    magnitude: feature.properties.mag,
    place: feature.properties.place,
    occurredAt: new Date(feature.properties.time),
    lat,
    lon,
    depthKm,
  };
}