/** Compact display formatters for market-data floats (never for ledger values). */

export const money = (n: number | null): string =>
  n == null ? '—' : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(2)}`;

export const pct = (n: number | null): string => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`);

export const ethShort = (n: number | null): string => (n == null ? '—' : n >= 1 ? n.toFixed(4) : n.toFixed(7));

export const age = (m: number | null): string =>
  m == null ? '—' : m < 60 ? `${Math.round(m)}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;

export const short = (a: string): string => (a && a.startsWith('0x') ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export const secondsAgo = (ms: number): string => (ms < 1000 ? 'now' : `${Math.floor(ms / 1000)}s`);
