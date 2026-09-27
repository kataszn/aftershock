export type Tagged<T, Tag extends string> = T & { readonly __tag: Tag };

export type HazardDetected = {
  type: 'hazard.detected';
  hazardEventId: Tagged<string, 'HazardEventId'>;
  magnitude: number;
  lat: number;
  lon: number;
  depthKm: number;
  occurredAt: Date;
};

export type AlertTriggered = {
  type: 'alert.triggered';
  alertId: Tagged<string, 'AlertId'>;
  structureId: Tagged<string, 'StructureId'>;
  hazardEventId: Tagged<string, 'HazardEventId'>;
  riskScore: number;
  riskBucket: 'HIGH' | 'CRITICAL';
};

export type DomainEvent = HazardDetected | AlertTriggered;