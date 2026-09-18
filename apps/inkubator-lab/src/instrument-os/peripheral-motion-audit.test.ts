import {describe, expect, it} from 'vitest';
import {motionDebugSummary} from './peripheral-motion';

const EXPECTED_LAYER_ROLES = [
  {cue:'SOURCE_LINK', fixedLayers:['carrier'], movingLayers:[], toggledLayers:['arc-1','arc-2','arc-3']},
  {cue:'SOURCE_RX', fixedLayers:['rail','receiver'], movingLayers:['packet'], toggledLayers:[]},
  {cue:'OBSERVED', fixedLayers:['rail','capture-left','capture-right'], movingLayers:['evidence'], toggledLayers:[]},
  {cue:'NEXT_MOVE_CHANGED', fixedLayers:['slot-1','slot-2','slot-3','slot-4'], movingLayers:['pointer'], toggledLayers:[]},
  {cue:'MISSION_BLOCKED', fixedLayers:['rail','wall'], movingLayers:['packet'], toggledLayers:['impact']},
  {cue:'HELP_BEACON', fixedLayers:['mast','beacon'], movingLayers:[], toggledLayers:['arc-1','arc-2','arc-3']},
  {cue:'VERIFYING', fixedLayers:['verify-tl','verify-tr','verify-bl','verify-br','target'], movingLayers:['scan'], toggledLayers:[]},
  {cue:'VERIFY_PASS', fixedLayers:['pass-tl','pass-tr','pass-bl','pass-br','target'], movingLayers:[], toggledLayers:['check']},
  {cue:'SHIP_SUBMITTED', fixedLayers:['rail','dock'], movingLayers:['package'], toggledLayers:[]},
  {cue:'SHIP_PROVEN', fixedLayers:['proven-tl','proven-tr','proven-bl','proven-br'], movingLayers:[], toggledLayers:['proof-core','check','ray-top','ray-bottom','ray-left','ray-right']},
  {cue:'RECEIPT', fixedLayers:['printer'], movingLayers:['paper'], toggledLayers:[]},
  {cue:'STALE', fixedLayers:['source'], movingLayers:[], toggledLayers:['arc-1','arc-2','arc-3','hollow']},
  {cue:'UNAVAILABLE', fixedLayers:['source'], movingLayers:[], toggledLayers:['arc-1','arc-2','arc-3','slash']},
] as const;

describe('peripheral moving/static asset audit', () => {
  it('requires an intentional test change before any layer can change motion role', () => {
    expect(motionDebugSummary().map(({durationMs: _durationMs, ...roles}) => roles)).toEqual(EXPECTED_LAYER_ROLES);
  });
});
