import { useEffect, useState } from 'react';

const UPDATE_EVENT = 'rekt:pwa-update-ready';
let registration: ServiceWorkerRegistration | null = null;
let reloadOnControllerChange = false;

export function staticAssetUrlsFromDocument(doc: Document = document): string[] {
  const urls = new Set<string>();
  const add = (value: string | null) => {
    if (!value) return;
    try {
      const url = new URL(value, doc.baseURI);
      if (url.origin !== window.location.origin) return;
      if (!/\.(?:css|js|mjs|woff2?|svg|png|webp|ico)$/i.test(url.pathname)) return;
      urls.add(url.href);
    } catch {
      // Ignore malformed/non-URL resource attributes.
    }
  };

  doc.querySelectorAll<HTMLScriptElement>('script[src]').forEach((node) => add(node.src));
  doc.querySelectorAll<HTMLLinkElement>('link[href]').forEach((node) => add(node.href));
  performance.getEntriesByType('resource').forEach((entry) => add(entry.name));
  return [...urls];
}

function announceUpdateReady() {
  window.dispatchEvent(new Event(UPDATE_EVENT));
}

async function cacheLoadedStaticAssets(worker: ServiceWorker) {
  worker.postMessage({ type: 'CACHE_URLS', urls: staticAssetUrlsFromDocument() });
}

export async function registerPwa(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });

      if (registration.waiting && navigator.serviceWorker.controller) announceUpdateReady();

      registration.addEventListener('updatefound', () => {
        const installing = registration?.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) announceUpdateReady();
        });
      });

      const active = registration.active ?? registration.waiting ?? registration.installing;
      if (active) await cacheLoadedStaticAssets(active);

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration?.update();
      });
    } catch (error) {
      console.warn('PWA registration failed', error);
    }
  }, { once: true });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloadOnControllerChange) return;
    reloadOnControllerChange = false;
    window.location.reload();
  });
}

export function activatePwaUpdate() {
  if (!registration?.waiting) return;
  reloadOnControllerChange = true;
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
}

export function PwaStatus() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onUpdate = () => setUpdateReady(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener(UPDATE_EVENT, onUpdate);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener(UPDATE_EVENT, onUpdate);
    };
  }, []);

  if (online && !updateReady) return null;

  return (
    <div className="pwa-status-stack" aria-live="polite">
      {!online && (
        <div className="pwa-status pwa-offline" role="status">
          <strong>OFFLINE</strong>
          <span>LIVE API responses are never cached. Displayed market values may be stale; practice qualification waits for fresh evidence.</span>
        </div>
      )}
      {updateReady && (
        <div className="pwa-status pwa-update" role="status">
          <span>APP UPDATE READY</span>
          <button type="button" onClick={activatePwaUpdate}>APPLY + RELOAD</button>
        </div>
      )}
    </div>
  );
}
