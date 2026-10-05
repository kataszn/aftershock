// Shapes returned by the Aftershock API. Kept intentionally close to the
// raw JSON so the client stays a thin, honest mirror of the backend.

export interface Structure {
  id: string;
  name: string;
  lat: string;
  lon: string;
  structureType: string;
  createdAt: string;
}

export interface Hazard {
  id: string;
  magnitude: string;
  depthKm: string;
  lat: string;
  lon: string;
  locationName: string | null;
  occurredAt: string;
  ingestedAt: string;
  isReplay: boolean;
}

export interface Alert {
  id: string;
  riskScore: string;
  threshold: string;
  createdAt: string;
  structureName: string;
  structureType: string;
  hazardMagnitude: string;
  hazardPlace: string | null;
  hazardLat: string;
  hazardLon: string;
  hazardDepthKm: string;
  isReplay: boolean;
  deliveredCount: number;
  totalSubscribers: number;
}

export interface DashboardSummary {
  totalStructures: number;
  totalHazards: number;
  totalAlerts: number;
  highRiskAlerts: number;
  criticalAlerts: number;
  deliveryCoverage: number;
}

export interface DashboardSnapshot {
  generatedAt: string;
  summary: DashboardSummary;
  structures: Structure[];
  hazards: Hazard[];
  alerts: Alert[];
}

export interface ReplayResponse {
  note?: string;
  error?: string;
  event?: { id: string; magnitude: number; place: string };
}
