import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PwaStatus, staticAssetUrlsFromDocument } from '../pwa';

const originalOnline = navigator.onLine;

afterEach(() => {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: originalOnline });
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('MOBILE_PWA_V0 runtime shell', () => {
  it('announces offline state without implying cached LIVE evidence is valid', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    render(<PwaStatus />);

    expect(screen.getByText('OFFLINE')).toBeInTheDocument();
    expect(screen.getByText(/LIVE API responses are never cached/)).toBeInTheDocument();
    expect(screen.getByText(/practice qualification waits for fresh evidence/)).toBeInTheDocument();
  });

  it('clears the offline notice when connectivity returns', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    render(<PwaStatus />);
    expect(screen.getByText('OFFLINE')).toBeInTheDocument();

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    fireEvent(window, new Event('online'));
    expect(screen.queryByText('OFFLINE')).toBeNull();
  });

  it('collects only same-origin static assets for offline shell warming', () => {
    const script = document.createElement('script');
    script.src = '/assets/app.js';
    document.head.append(script);

    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/assets/app.css';
    document.head.append(style);

    const external = document.createElement('script');
    external.src = 'https://example.com/external.js';
    document.head.append(external);

    expect(staticAssetUrlsFromDocument(document)).toEqual(expect.arrayContaining([
      new URL('/assets/app.js', window.location.href).href,
      new URL('/assets/app.css', window.location.href).href,
    ]));
    expect(staticAssetUrlsFromDocument(document).some((url) => url.includes('example.com'))).toBe(false);
  });
});
