// Pure risk-scoring logic — Formula is a deliberately legible, tunable engineering-judgment model
// inspired by standard seismic attenuation principles, not a calibrated GMPE.

import { RISK_THRESHOLDS } from '@repo/shared';

// Basic structure model for now
export type StructureType =
  | 'dam'
  | 'bridge'
  | 'unreinforced_masonry'
  | 'reinforced_high_rise'
  | 'generic_structure';

export type RiskBucket = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

const TYPE_MULTIPLIERS: Record<StructureType, number> = {
  dam: 1.5,
  bridge: 1.3,
  unreinforced_masonry: 1.6,
  reinforced_high_rise: 0.8,
  generic_structure: 1.0,
};

export function magnitudeFactor(magnitude: number): number {
  return Math.pow(2, magnitude - 5);
}

export function effectiveRadiusKm(magnitude: number): number {
  return 50 * Math.pow(2, magnitude - 5);
}

export function distanceDecay(distanceKm: number, magnitude: number): number {
  const radius = effectiveRadiusKm(magnitude);
  return Math.exp(-distanceKm / radius);
}

export function depthFactor(depthKm: number): number {
  return 1 / (1 + depthKm / 50);
}

export function typeMultiplier(structureType: string): number {
  const known = TYPE_MULTIPLIERS[structureType as StructureType];
  if (known === undefined) {
    // Fail loud rather than silently defaulting — an unrecognized type in
    // structure data is a data bug worth surfacing
    throw new Error(`Unknown structure type: "${structureType}"`);
  }
  return known;
}

export type ScoreRiskArgs = {
  magnitude: number;
  distanceKm: number;
  depthKm: number;
  structureType: string;
};

export function scoreRisk({ magnitude, distanceKm, depthKm, structureType }: ScoreRiskArgs): number {
  return (
    magnitudeFactor(magnitude) *
    distanceDecay(distanceKm, magnitude) *
    depthFactor(depthKm) *
    typeMultiplier(structureType)
  );
}

export function bucketForScore(score: number): RiskBucket {
  if (score > RISK_THRESHOLDS.HIGH_MAX) return 'CRITICAL';
  if (score >= RISK_THRESHOLDS.MODERATE_MAX) return 'HIGH';
  if (score >= RISK_THRESHOLDS.LOW_MAX) return 'MODERATE';
  return 'LOW';
}