import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

vi.mock('./reactbits-pro', () => ({
  GrainWave: ({className = ''}: {className?: string}) => <div data-testid="grain-wave" className={className} />,
  DitherWave: ({className = ''}: {className?: string}) => <div data-testid="dither-wave" className={className} />,
  SquircleShift: ({className = ''}: {className?: string}) => <div data-testid="squircle-shift" className={className} />,
}));

import AppV3 from './AppV3';
import {showcase15} from './data/showcase-tokens';

afterEach(() => cleanup());

describe('Inkubator comeback v3', () => {
  it('lands the challenge, operating principle and real-media signal in the hero', () => {
    const {container} = render(<AppV3 />);
    expect(screen.getByRole('heading', {name: /BUILD SOMETHING WEIRD.*PUT IT ON THE INTERNET/i})).toBeTruthy();
    expect(screen.getByText('MAKE DEGENS SHIP.')).toBeTruthy();
    expect(screen.getByText('CURATED ART')).toBeTruthy();
    expect(screen.getByText('LIVE SALES')).toBeTruthy();
    const heroMedia = container.querySelector('.d3-signal-media img') as HTMLImageElement | null;
    expect(heroMedia?.src).not.toContain('frame-time=1');
  });

  it('keeps the page to six clear beats and merges the machine with the value exchange', () => {
    const {container} = render(<AppV3 />);
    expect(container.querySelectorAll('main.d3 > section').length).toBe(6);
    expect(screen.getByText('5 STEPS. NO DECK.', {exact: false})).toBeTruthy();
    expect(screen.getByText('MAKE THE THING.')).toBeTruthy();
    expect(screen.getByText('CREATE THE PULL.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: /AMPLIFY/}));
    expect(screen.getByText('Clip it. Post it. Let it travel.')).toBeTruthy();
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
    render(<AppV3 />);
    expect(showcase15).toHaveLength(15);
    expect(showcase15.find((token) => token.tokenId === '249')?.rarityRank).toBe(98);
    expect(showcase15.find((token) => token.tokenId === '4712')?.rarityRank).toBe(347);
    expect(screen.getByText('#249')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'CHIBI HOOD'}));
  });

  it('shows the bounded roadmap as direction rather than promises', () => {
    render(<AppV3 />);
    expect(screen.getByText(/DIRECTION, NOT PROMISES/i)).toBeTruthy();
    expect(screen.getByText('PROVE THE LOOP', {exact: false})).toBeTruthy();
    expect(screen.getByText('TURN ON LIVE SIGNAL', {exact: false})).toBeTruthy();
    expect(screen.getByText('COMPOUND THE WORLD', {exact: false})).toBeTruthy();
    expect(screen.getByRole('heading', {name: /DUMB IDEA.*MAKE IT REAL/i})).toBeTruthy();
  });
});
