export const RISK_THRESHOLDS = {
  LOW_MAX: 0.3,
  MODERATE_MAX: 1.0,
  HIGH_MAX: 2.5,
} as const;

export type RiskBucket = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export function bucketForScore(score: number): RiskBucket {
  if (score > RISK_THRESHOLDS.HIGH_MAX) return 'CRITICAL';
  if (score >= RISK_THRESHOLDS.MODERATE_MAX) return 'HIGH';
  if (score >= RISK_THRESHOLDS.LOW_MAX) return 'MODERATE';
  return 'LOW';
}

// The floor a score had to cross to land in this bucket — i.e. what an
// alert's `threshold` column should record as "why did this fire."
export function thresholdCrossedFor(bucket: RiskBucket): number {
  switch (bucket) {
    case 'CRITICAL': return RISK_THRESHOLDS.HIGH_MAX;
    case 'HIGH': return RISK_THRESHOLDS.MODERATE_MAX;
    case 'MODERATE': return RISK_THRESHOLDS.LOW_MAX;
    case 'LOW': return 0;
  }
}

export const MIN_ALERTABLE_MAGNITUDE = 4.0;