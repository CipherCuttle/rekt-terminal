// @vitest-environment jsdom

import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionLab } from './MotionLab';

describe('MotionLab', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
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
  });

  afterEach(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: originalGetContext,
    });
    vi.unstubAllGlobals();
  });

  it('renders neutral and REKT scenes from one shared motion surface', () => {
    render(<MotionLab />);
    expect(screen.getByLabelText('neutral motion scene')).toBeInTheDocument();
    expect(screen.getByLabelText('rekt motion scene')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '600ms' }));
    expect(screen.getByRole('button', { name: 'PLAY' })).toBeInTheDocument();
  });
});
