import {describe, expect, it} from 'vitest';
import {arbitratePeripheralCues, assertCueAuthority, type PeripheralCue} from './peripheral-cues';

describe('peripheral cue authority', () => {
  it('rejects PROVEN visuals without PROVEN authority', () => {
    expect(() => assertCueAuthority({kind:'SHIP_PROVEN', eventId:'receipt-1', authority:'OBSERVED'})).toThrow(/requires PROVEN authority/);
  });

  it('keeps verifier PASS at OBSERVED authority', () => {
    expect(() => assertCueAuthority({kind:'VERIFY_PASS', eventId:'verify-1', authority:'PROVEN'})).toThrow(/requires OBSERVED authority/);
  });

  it('dedupes cues and limits simultaneous visual chatter', () => {
    const cues: PeripheralCue[] = [
      {kind:'SOURCE_RX', eventId:'obs-1', authority:'OBSERVED'},
      {kind:'SOURCE_RX', eventId:'obs-1', authority:'OBSERVED'},
      {kind:'OBSERVED', eventId:'obs-1', authority:'OBSERVED'},
      {kind:'NEXT_MOVE_CHANGED', eventId:'obs-1', authority:'CONTEXT'},
      {kind:'HELP_BEACON', eventId:'beacon-1', authority:'STATUS'},
    ];
    const selected = arbitratePeripheralCues(cues);
    expect(selected).toHaveLength(3);
    expect(selected.map(cue => cue.kind)).toEqual(['OBSERVED','SOURCE_RX','NEXT_MOVE_CHANGED']);
  });

  it('keeps PROVEN and receipt as one receipt-id ceremony sequence', () => {
    const selected = arbitratePeripheralCues([
      {kind:'RECEIPT', eventId:'receipt-9', authority:'PROVEN'},
      {kind:'SHIP_PROVEN', eventId:'receipt-9', authority:'PROVEN'},
      {kind:'NEXT_MOVE_CHANGED', eventId:'next-2', authority:'CONTEXT'},
    ]);
    expect(selected.map(cue => cue.kind)).toEqual(['SHIP_PROVEN','RECEIPT']);
  });
});
