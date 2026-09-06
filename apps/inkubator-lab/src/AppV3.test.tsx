import {act, cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

vi.mock('./reactbits-pro', () => ({
  GrainWave: ({className = ''}: {className?: string; startupDelayMs?: number}) => <div data-testid="grain-wave" className={className} />,
  DitherWave: ({className = ''}: {className?: string}) => <div data-testid="dither-wave" className={className} />,
  SquircleShift: ({className = ''}: {className?: string}) => <div data-testid="squircle-shift" className={className} />,
}));

import AppV3 from './AppV3';
import {showcase15} from './data/showcase-tokens';
import {inkubatorState} from './generated/inkubator-state';

const compact = (value: string | null | undefined) => value?.replace(/\s+/g, '') ?? '';

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('Inkubator comeback v3', () => {
  it('lands the challenge and progressively wakes animated hero media', () => {
    vi.useFakeTimers();
    const {container} = render(<AppV3 />);
    expect(screen.getByRole('heading', {name: /BUILD SOMETHING WEIRD.*PUT IT ON THE INTERNET/i})).toBeTruthy();
    expect(screen.getByText('MAKE DEGENS SHIP.')).toBeTruthy();
    expect(screen.getByText('CURATED ART')).toBeTruthy();
    expect(screen.getByText('LIVE SALES')).toBeTruthy();
    const heroMedia = container.querySelector('.d3-signal-media img') as HTMLImageElement | null;
    expect(heroMedia?.src).toContain('frame-time=1');
    expect(heroMedia?.getAttribute('fetchpriority') ?? heroMedia?.getAttribute('fetchPriority')).toBe('high');
    act(() => vi.advanceTimersByTime(2500));
    expect(heroMedia?.src).not.toContain('frame-time=1');
  });

  it('keeps the page to six clear beats and merges the machine with the value exchange', () => {
    const {container} = render(<AppV3 />);
    expect(container.querySelectorAll('main.d3 > section').length).toBe(6);
    expect(compact(container.querySelector('.d3-machine-copy h2')?.textContent)).toBe('5STEPS.NODECK.');
    expect(screen.getByText('MAKE THE THING.')).toBeTruthy();
    expect(screen.getByText('CREATE THE PULL.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: /AMPLIFY/}));
    expect(screen.getByText('Clip it. Post it. Let it travel.')).toBeTruthy();
  });

  it('renders protocol-backed player and receipt state without pretending the fixture is a real ship or real reputation', () => {
    const {container} = render(<AppV3 />);
    expect(screen.getByText(/DEVELOPMENT FIXTURE · NOT A REAL SHIP/i)).toBeTruthy();
    expect(screen.getAllByText('NULL GHOST').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/SHIP RECEIPT \/\/ RDEV-S001/i)).toBeTruthy();
    expect(screen.getByText(/fixture data never enters rankings/i)).toBeTruthy();
    expect(compact(container.querySelector('.d3-player-facts')?.textContent)).toBe('SHIPS—ROUNDS—RANK—');
    expect(inkubatorState.receipts[0].digest).toMatch(/^[a-f0-9]{64}$/);
    fireEvent.click(screen.getByText(/VIEW TECHNICAL EVIDENCE/i));
    expect(screen.getByText(inkubatorState.receipts[0].digest)).toBeTruthy();
  });

  it('makes the comeback the emotional center without pretending live metrics exist', () => {
    render(<AppV3 />);
    expect(screen.getByRole('heading', {name: /TWO YEARS.*STILL HERE/i})).toBeTruthy();
    expect(screen.getByText('A FEW STAYED')).toBeTruthy();
    expect(screen.getByText('BUILD THE COMEBACK')).toBeTruthy();
    expect(screen.getAllByText('COLLECTOR PENDING').length).toBe(3);
    expect(screen.queryByText('1,284')).toBeNull();
    expect(screen.queryByText('2,941')).toBeNull();
  });

  it('encodes the curated rarity and market Showcase 15', () => {
    const {container} = render(<AppV3 />);
    expect(showcase15).toHaveLength(15);
    expect(showcase15.find((token) => token.tokenId === '249')?.rarityRank).toBe(98);
    expect(showcase15.find((token) => token.tokenId === '4712')?.rarityRank).toBe(347);
    expect(screen.getByText('#249')).toBeTruthy();
    const gallery = container.querySelector('.d3-comeback-stage');
    expect(gallery).toBeTruthy();
    fireEvent.click(within(gallery as HTMLElement).getByRole('button', {name: 'CHIBI HOOD'}));
    expect(within(gallery as HTMLElement).getByText('#4712')).toBeTruthy();
  });

  it('shows the bounded roadmap as direction rather than promises', () => {
    const {container} = render(<AppV3 />);
    expect(screen.getByText(/DIRECTION, NOT PROMISES/i)).toBeTruthy();
    const roadmapTitles = Array.from(container.querySelectorAll('.d3-roadmap-rail h3')).map((node) => compact(node.textContent));
    expect(roadmapTitles).toEqual(['PROVETHELOOP', 'TURNONLIVESIGNAL', 'COMPOUNDTHEWORLD']);
    expect(compact(container.querySelector('.d3-open h2')?.textContent)).toBe('DUMBIDEA?MAKEITREAL.');
  });
});
