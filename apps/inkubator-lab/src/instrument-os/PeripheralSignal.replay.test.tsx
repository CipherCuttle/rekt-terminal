import {render} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {PeripheralSignal} from './PeripheralSignal';

describe('PeripheralSignal replay memory', () => {
  it('does not replay the same canonical event after eventId is temporarily absent', () => {
    const {container, rerender} = render(<PeripheralSignal cue="SOURCE_RX" eventId="observation-1" />);
    rerender(<PeripheralSignal cue="SOURCE_RX" />);
    rerender(<PeripheralSignal cue="SOURCE_RX" eventId="observation-1" />);
    expect(container.querySelector('svg[data-motion-contract="v1"]')).toHaveAttribute('data-frame', '4');
  });
});
