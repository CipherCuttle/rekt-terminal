import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MotionLab } from './MotionLab';

describe('MotionLab', () => {
  it('renders neutral and REKT scenes from one shared motion surface', () => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => ({
        fillStyle: '', strokeStyle: '', lineWidth: 1,
        fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), stroke: vi.fn(),
        moveTo: vi.fn(), lineTo: vi.fn(), save: vi.fn(), translate: vi.fn(),
        rotate: vi.fn(), restore: vi.fn(), quadraticCurveTo: vi.fn(), ellipse: vi.fn(),
        fill: vi.fn(), scale: vi.fn(),
      })),
    });

    render(<MotionLab />);
    expect(screen.getByLabelText('neutral motion scene')).toBeInTheDocument();
    expect(screen.getByLabelText('rekt motion scene')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '600ms' }));
    expect(screen.getByRole('button', { name: 'PLAY' })).toBeInTheDocument();

    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: getContext,
    });
  });
});
