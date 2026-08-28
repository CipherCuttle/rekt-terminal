/**
 * React bindings for the practice domain.
 *
 * `useSyncExternalStore` is the whole integration: components read immutable
 * snapshots and call typed intents. There is no reducer, no context-held
 * economic state, and no derived balance living in React.
 */
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import type { MarketFeedStore, FeedSnapshot } from './feed-store';
import type { PracticeSessionStore, PracticeSnapshot } from './store';

export interface PracticeRuntime {
  session: PracticeSessionStore;
  feed: MarketFeedStore;
}

const PracticeContext = createContext<PracticeRuntime | null>(null);

export function PracticeProvider({ runtime, children }: { runtime: PracticeRuntime; children: ReactNode }) {
  return <PracticeContext.Provider value={runtime}>{children}</PracticeContext.Provider>;
}

export function usePracticeRuntime(): PracticeRuntime {
  const runtime = useContext(PracticeContext);
  if (!runtime) throw new Error('usePracticeRuntime must be used inside a PracticeProvider');
  return runtime;
}

export function usePracticeSnapshot(): PracticeSnapshot {
  const { session } = usePracticeRuntime();
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
}

export function useFeedSnapshot(): FeedSnapshot {
  const { feed } = usePracticeRuntime();
  return useSyncExternalStore(feed.subscribe, feed.getSnapshot, feed.getSnapshot);
}
