import {describe, expect, it} from 'vitest';
import {assertFieldVectorMasterScenes, FIELD_VECTOR_MASTER_SCENES} from './field-vector-contract';

describe('FIELD_VECTOR master-scene contract', () => {
  it('keeps the bounded six-candidate calibration set valid', () => {
    expect(() => assertFieldVectorMasterScenes()).not.toThrow();
    expect(FIELD_VECTOR_MASTER_SCENES.map(scene => scene.id)).toEqual([
      'SIGNAL_BODY_A', 'SIGNAL_BODY_B', 'SIGNAL_BODY_C',
      'VERIFY_SCOPE_A', 'VERIFY_SCOPE_B', 'VERIFY_SCOPE_C',
    ]);
  });

  it('keeps REKT static and semantic accents restrained', () => {
    expect(FIELD_VECTOR_MASTER_SCENES.every(scene => scene.mascotPolicy === 'STATIC_CANONICAL')).toBe(true);
    expect(Math.max(...FIELD_VECTOR_MASTER_SCENES.map(scene => scene.accentTones.length))).toBeLessThanOrEqual(2);
  });

  it('rejects fake measurement and unexplained continuous motion', () => {
    expect(FIELD_VECTOR_MASTER_SCENES.filter(scene => scene.dominantRole === 'MEASUREMENT').every(scene => Boolean(scene.measurementSource))).toBe(true);
    expect(FIELD_VECTOR_MASTER_SCENES.filter(scene => scene.continuousMotion).every(scene => Boolean(scene.continuousProcess))).toBe(true);
  });
});
