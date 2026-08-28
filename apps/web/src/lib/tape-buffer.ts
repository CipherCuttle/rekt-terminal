/**
 * Bounded, throttled event-tape buffer.
 *
 * The tape is the highest-frequency surface in the app and the least important.
 * It gets its own external store so a 250 msg/s scenario repaints one small
 * list at 4 Hz instead of re-rendering the terminal.
 */
import type { TapeRow } from './market-feed';

const MAX_ROWS = 40;
const THROTTLE_MS = 250;

export class TapeBuffer {
  private rows: readonly TapeRow[] = [];
  private snapshot: readonly TapeRow[] = [];
  private readonly listeners = new Set<() => void>();
  private pending: ReturnType<typeof setTimeout> | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): readonly TapeRow[] => this.snapshot;

  push(rows: readonly TapeRow[]): void {
    if (rows.length === 0) return;
    this.rows = [...rows, ...this.rows].slice(0, MAX_ROWS);
    if (this.pending !== null) return;
    this.pending = setTimeout(() => {
      this.pending = null;
      this.snapshot = this.rows;
      for (const listener of this.listeners) listener();
    }, THROTTLE_MS);
  }

  clear(): void {
    this.rows = [];
    this.snapshot = [];
    for (const listener of this.listeners) listener();
  }

  dispose(): void {
    if (this.pending !== null) clearTimeout(this.pending);
    this.pending = null;
    this.listeners.clear();
  }
}
