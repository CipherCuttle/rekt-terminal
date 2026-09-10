export type FieldVectorFamily = 'SIGNAL_BODY' | 'VERIFY_SCOPE';
export type FieldVectorVariant = 'A' | 'B' | 'C';
export type VisualRole = 'METAPHOR' | 'STATUS' | 'MEASUREMENT';
export type VisualAuthority = 'CONTEXT' | 'STATUS' | 'OBSERVED' | 'PROVEN';
export type SemanticTone = 'ink' | 'context' | 'observed' | 'attention' | 'blocked' | 'proven' | 'stale';

export type FieldVectorScene = Readonly<{
  id: `${FieldVectorFamily}_${FieldVectorVariant}`;
  family: FieldVectorFamily;
  variant: FieldVectorVariant;
  title: string;
  dominantRole: VisualRole;
  authorityCeiling: VisualAuthority;
  measurementSource?: string;
  accentTones: readonly SemanticTone[];
  continuousMotion: boolean;
  continuousProcess?: string;
  mascotPolicy: 'STATIC_CANONICAL';
  reducedMotion: 'STATIC_MEANINGFUL_FRAME';
}>;

/**
 * Art-calibration scenes only. These are not production telemetry screens yet.
 * Any numeric/trace content shown by the lab is explicitly deterministic fixture data.
 */
export const FIELD_VECTOR_MASTER_SCENES: readonly FieldVectorScene[] = [
  {
    id: 'SIGNAL_BODY_A', family: 'SIGNAL_BODY', variant: 'A', title: 'SIGNAL BODY / CARRIER',
    dominantRole: 'METAPHOR', authorityCeiling: 'OBSERVED', accentTones: ['observed', 'attention'],
    continuousMotion: true, continuousProcess: 'fixture signal carrier', mascotPolicy: 'STATIC_CANONICAL', reducedMotion: 'STATIC_MEANINGFUL_FRAME',
  },
  {
    id: 'SIGNAL_BODY_B', family: 'SIGNAL_BODY', variant: 'B', title: 'SIGNAL BODY / GATE',
    dominantRole: 'STATUS', authorityCeiling: 'OBSERVED', accentTones: ['observed'],
    continuousMotion: false, mascotPolicy: 'STATIC_CANONICAL', reducedMotion: 'STATIC_MEANINGFUL_FRAME',
  },
  {
    id: 'SIGNAL_BODY_C', family: 'SIGNAL_BODY', variant: 'C', title: 'SIGNAL BODY / ROUTE',
    dominantRole: 'METAPHOR', authorityCeiling: 'STATUS', accentTones: ['context', 'attention'],
    continuousMotion: true, continuousProcess: 'fixture route pulse', mascotPolicy: 'STATIC_CANONICAL', reducedMotion: 'STATIC_MEANINGFUL_FRAME',
  },
  {
    id: 'VERIFY_SCOPE_A', family: 'VERIFY_SCOPE', variant: 'A', title: 'VERIFY SCOPE / TRACE',
    dominantRole: 'MEASUREMENT', authorityCeiling: 'OBSERVED', measurementSource: 'deterministic verify fixture v0', accentTones: ['observed', 'attention'],
    continuousMotion: true, continuousProcess: 'fixture verifier scan', mascotPolicy: 'STATIC_CANONICAL', reducedMotion: 'STATIC_MEANINGFUL_FRAME',
  },
  {
    id: 'VERIFY_SCOPE_B', family: 'VERIFY_SCOPE', variant: 'B', title: 'VERIFY SCOPE / COMPARE',
    dominantRole: 'MEASUREMENT', authorityCeiling: 'OBSERVED', measurementSource: 'deterministic compare fixture v0', accentTones: ['observed'],
    continuousMotion: true, continuousProcess: 'fixture comparator sweep', mascotPolicy: 'STATIC_CANONICAL', reducedMotion: 'STATIC_MEANINGFUL_FRAME',
  },
  {
    id: 'VERIFY_SCOPE_C', family: 'VERIFY_SCOPE', variant: 'C', title: 'VERIFY SCOPE / CAPTURE',
    dominantRole: 'STATUS', authorityCeiling: 'PROVEN', accentTones: ['observed', 'proven'],
    continuousMotion: false, mascotPolicy: 'STATIC_CANONICAL', reducedMotion: 'STATIC_MEANINGFUL_FRAME',
  },
] as const;

export function assertFieldVectorMasterScenes(scenes: readonly FieldVectorScene[] = FIELD_VECTOR_MASTER_SCENES) {
  if (scenes.length !== 6) throw new Error('field-vector calibration requires exactly six master candidates');
  const ids = new Set<string>();
  for (const scene of scenes) {
    if (ids.has(scene.id)) throw new Error(`${scene.id}: duplicate scene id`);
    ids.add(scene.id);
    if (scene.mascotPolicy !== 'STATIC_CANONICAL') throw new Error(`${scene.id}: REKT mascot must remain static in v0`);
    if (scene.accentTones.length > 2) throw new Error(`${scene.id}: too many simultaneous semantic accent roles`);
    if (scene.dominantRole === 'MEASUREMENT' && !scene.measurementSource) throw new Error(`${scene.id}: measurement requires an explicit fixture/source`);
    if (scene.continuousMotion && !scene.continuousProcess) throw new Error(`${scene.id}: continuous motion requires a declared continuous process`);
    if (scene.reducedMotion !== 'STATIC_MEANINGFUL_FRAME') throw new Error(`${scene.id}: reduced motion must preserve meaning`);
  }
}
