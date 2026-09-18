import {describe, expect, it} from 'vitest';
import {PERIPHERAL_MOTIONS, validatePeripheralMotion, type PeripheralMotionDefinition} from './peripheral-motion';

describe('peripheral motion contracts', () => {
  it('keeps every declared static anchor fixed and every moving layer on its declared track', () => {
    expect(validatePeripheralMotion()).toEqual([]);
  });

  it('rejects accidental movement of a static layer', () => {
    const first = PERIPHERAL_MOTIONS[0];
    const layer = first.layers[0];
    const broken: PeripheralMotionDefinition = {
      ...first,
      layers: [{...layer, frames: [layer.frames[0], {...layer.frames[1], x: layer.frames[1].x + 1}, layer.frames[2], layer.frames[3]]}, ...first.layers.slice(1)],
    };
    expect(validatePeripheralMotion([broken]).some(violation => violation.message.includes('drifted'))).toBe(true);
  });

  it('rejects orthogonal jitter on a moving layer', () => {
    const sourceRx = PERIPHERAL_MOTIONS.find(def => def.cue === 'SOURCE_RX')!;
    const packetIndex = sourceRx.layers.findIndex(layer => layer.id === 'packet');
    const packet = sourceRx.layers[packetIndex];
    const layers = sourceRx.layers.slice();
    layers[packetIndex] = {...packet, frames: [packet.frames[0], {...packet.frames[1], y: packet.frames[1].y + 1}, packet.frames[2], packet.frames[3]]};
    expect(validatePeripheralMotion([{...sourceRx, layers}]).some(violation => violation.message.includes('orthogonal drift'))).toBe(true);
  });

  it('rejects a backwards jump on a monotonic track', () => {
    const sourceRx = PERIPHERAL_MOTIONS.find(def => def.cue === 'SOURCE_RX')!;
    const packetIndex = sourceRx.layers.findIndex(layer => layer.id === 'packet');
    const packet = sourceRx.layers[packetIndex];
    const layers = sourceRx.layers.slice();
    layers[packetIndex] = {...packet, frames: [packet.frames[0], {...packet.frames[1], x: 100}, {...packet.frames[2], x: 70}, packet.frames[3]]};
    expect(validatePeripheralMotion([{...sourceRx, layers}]).some(violation => violation.message.includes('reversed'))).toBe(true);
  });
});
