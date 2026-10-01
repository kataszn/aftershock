// Checks scoring formula against the real USGS fixtures 
// (M7.1 Miyazaki, M2.4 The Geysers) 

import { describe, it, expect } from 'vitest';
import { scoreRisk, bucketForScore, magnitudeFactor, effectiveRadiusKm, typeMultiplier } from './scoring';

// Real USGS events used as fixtures 
const MIYAZAKI_M7_1 = {
  magnitude: 7.1,
  depthKm: 25.0,
  eventId: 'us6000na48',
};

const GEYSERS_M2_4 = {
  magnitude: 2.4,
  depthKm: 1.83,
  eventId: 'nc74001234',
};

describe('scoreRisk — worked example (M6.2, depth 10km, bridge, 80km)', () => {
  it('matches the hand-computed value from the design doc (~1.24)', () => {
    const score = scoreRisk({
      magnitude: 6.2,
      distanceKm: 80,
      depthKm: 10,
      structureType: 'bridge',
    });

    expect(score).toBeCloseTo(1.24, 1);
    expect(bucketForScore(score)).toBe('HIGH');
  });
});

describe('scoreRisk — M7.1 Miyazaki (real event, should alert)', () => {
  it('scores CRITICAL at the epicenter', () => {
    const score = scoreRisk({
      magnitude: MIYAZAKI_M7_1.magnitude,
      distanceKm: 0,
      depthKm: MIYAZAKI_M7_1.depthKm,
      structureType: 'bridge',
    });

    expect(bucketForScore(score)).toBe('CRITICAL');
  });

  it('still scores HIGH at 200km out', () => {
    const score = scoreRisk({
      magnitude: MIYAZAKI_M7_1.magnitude,
      distanceKm: 200,
      depthKm: MIYAZAKI_M7_1.depthKm,
      structureType: 'bridge',
    });

    expect(bucketForScore(score)).toBe('HIGH');
  });

  it('drops below LOW near the max query radius (~643km)', () => {
    const score = scoreRisk({
      magnitude: MIYAZAKI_M7_1.magnitude,
      distanceKm: 600,
      depthKm: MIYAZAKI_M7_1.depthKm,
      structureType: 'bridge',
    });

    expect(bucketForScore(score)).toBe('LOW');
  });
});

describe('scoreRisk — M2.4 The Geysers (real event, should never reach scoring)', () => {
  it('would score LOW even at the epicenter — confirms the M4.0 job-level filter is doing real work, not filtering out events that mattered anyway', () => {
    const score = scoreRisk({
      magnitude: GEYSERS_M2_4.magnitude,
      distanceKm: 0,
      depthKm: GEYSERS_M2_4.depthKm,
      structureType: 'bridge',
    });

    expect(bucketForScore(score)).toBe('LOW');
  });
});

describe('typeMultiplier', () => {
  it('throws on an unrecognized structure type', () => {
    expect(() => typeMultiplier('building')).toThrow('Unknown structure type');
  });

  it('accepts all five agreed types', () => {
    for (const type of ['dam', 'bridge', 'unreinforced_masonry', 'reinforced_high_rise', 'generic_structure']) {
      expect(() => typeMultiplier(type)).not.toThrow();
    }
  });
});

describe('magnitudeFactor / effectiveRadiusKm — sanity checks from the design doc', () => {
  it('magnitudeFactor(5) === 1.0, the M5 baseline', () => {
    expect(magnitudeFactor(5)).toBeCloseTo(1.0, 5);
  });

  it('effectiveRadiusKm(5) === 50, the M5 baseline radius', () => {
    expect(effectiveRadiusKm(5)).toBeCloseTo(50, 5);
  });
});