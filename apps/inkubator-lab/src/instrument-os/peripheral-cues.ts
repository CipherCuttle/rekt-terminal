import type {PeripheralAuthority, PeripheralCueKind} from './peripheral-motion';

export type PeripheralCue = Readonly<{
  kind: PeripheralCueKind;
  eventId: string;
  authority: PeripheralAuthority;
}>;

const authorityRequired: Partial<Record<PeripheralCueKind, PeripheralAuthority>> = {
  SOURCE_RX: 'OBSERVED',
  OBSERVED: 'OBSERVED',
  VERIFY_PASS: 'OBSERVED',
  SHIP_SUBMITTED: 'CLAIMED',
  SHIP_PROVEN: 'PROVEN',
  RECEIPT: 'PROVEN',
};

const priority: Record<PeripheralCueKind, number> = {
  SHIP_PROVEN: 100,
  RECEIPT: 95,
  MISSION_BLOCKED: 90,
  UNAVAILABLE: 88,
  STALE: 86,
  VERIFY_PASS: 80,
  VERIFYING: 75,
  SHIP_SUBMITTED: 70,
  OBSERVED: 65,
  SOURCE_RX: 60,
  NEXT_MOVE_CHANGED: 50,
  HELP_BEACON: 40,
  SOURCE_LINK: 30,
};

export function assertCueAuthority(cue: PeripheralCue): void {
  const required = authorityRequired[cue.kind];
  if (required && cue.authority !== required) {
    throw new Error(`${cue.kind} requires ${required} authority; received ${cue.authority}`);
  }
}

export function arbitratePeripheralCues(cues: readonly PeripheralCue[]): PeripheralCue[] {
  const unique = new Map<string, PeripheralCue>();
  for (const cue of cues) {
    assertCueAuthority(cue);
    unique.set(`${cue.kind}:${cue.eventId}`, cue);
  }
  const sorted = [...unique.values()].sort((a,b) => priority[b.kind] - priority[a.kind]);
  const proven = sorted.find(cue => cue.kind === 'SHIP_PROVEN');
  const receipt = sorted.find(cue => cue.kind === 'RECEIPT' && cue.eventId === proven?.eventId);
  if (proven && receipt) return [proven, receipt];
  return sorted.slice(0, 3);
}
