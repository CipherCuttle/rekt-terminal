import {useEffect, useRef, useState} from 'react';
import {useGSAP} from '@gsap/react';
import {useQuery} from '@tanstack/react-query';
import gsap from 'gsap';
import type {
  InkubatorApiClient,
  ProjectDiscoveryList,
  PublicPlayerList,
  WorldSignalList,
  WorldSignalView,
} from '../generated/inkubator-api-client';
import {createInkubatorApiClient} from '../inkubator-api';
import {MOTION_EASE, MOTION_SECONDS} from '../instrument-os/motion-tokens';
import {TerminalShell} from '../shell/TerminalShell';
import './live-world.css';

gsap.registerPlugin(useGSAP);

type WorldClient = Pick<InkubatorApiClient, 'discoverProjects' | 'discoverPlayers' | 'listWorldSignals'>;

export type LiveWorldProps = {
  client?: WorldClient;
  refetchIntervalMs?: number | false;
};

const projectKey = ['inkubator', 'world', 'projects'] as const;
const playerKey = ['inkubator', 'world', 'players'] as const;
const signalKey = ['inkubator', 'world', 'signals'] as const;

type UnsupportedWorldSignal = {
  display_kind: 'UNSUPPORTED';
  signal_id: string;
  project_id: string | null;
  project_name: string | null;
  truth_state: string | null;
  occurred_at: string | null;
  reason: string;
};

type DisplayWorldSignal = WorldSignalView | UnsupportedWorldSignal;

const supportedKinds = {
  HELP_BEACON_OPENED: 'CLAIMED',
  ASSIST_ACCEPTED: 'OBSERVED',
  EXTERNAL_TEST_RECORDED: 'OBSERVED',
} as const;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function unsupportedSignal(raw: unknown, index: number, reason: string): UnsupportedWorldSignal {
  const value = isRecord(raw) ? raw : {};
  return {
    display_kind: 'UNSUPPORTED',
    signal_id: typeof value.signal_id === 'string' && value.signal_id ? value.signal_id : `unsupported-${index + 1}`,
    project_id: typeof value.project_id === 'string' ? value.project_id : null,
    project_name: typeof value.project_name === 'string' && value.project_name ? value.project_name : null,
    truth_state: typeof value.truth_state === 'string' ? value.truth_state : null,
    occurred_at: typeof value.occurred_at === 'string' && !Number.isNaN(Date.parse(value.occurred_at)) ? value.occurred_at : null,
    reason,
  };
}

function normalizeWorldSignals(input: unknown): DisplayWorldSignal[] {
  if (input === undefined) return [];
  if (!Array.isArray(input)) return [unsupportedSignal(input, 0, 'WORLD SIGNAL PROJECTION IS NOT AN ARRAY')];

  const seenIds = new Set<string>();
  return input.map((raw, index) => {
    if (!isRecord(raw)) return unsupportedSignal(raw, index, 'WORLD SIGNAL ROW IS MALFORMED');
    const schemaVersion = raw.schema_version;
    const signalId = raw.signal_id;
    const kind = raw.kind;
    const projectId = raw.project_id;
    const projectName = raw.project_name;
    const occurredAt = raw.occurred_at;
    const truthState = raw.truth_state;
    const expectedTruth = typeof kind === 'string' && kind in supportedKinds
      ? supportedKinds[kind as keyof typeof supportedKinds]
      : undefined;
    const valid = schemaVersion === 'world.signal.public.v1'
      && typeof signalId === 'string'
      && signalId.length > 0
      && !seenIds.has(signalId)
      && typeof kind === 'string'
      && expectedTruth !== undefined
      && truthState === expectedTruth
      && typeof projectId === 'string'
      && projectId.length > 0
      && typeof projectName === 'string'
      && projectName.length > 0
      && typeof occurredAt === 'string'
      && !Number.isNaN(Date.parse(occurredAt));

    if (!valid) {
      const reason = schemaVersion !== 'world.signal.public.v1'
        ? 'UNSUPPORTED WORLD SIGNAL SCHEMA'
        : expectedTruth === undefined
          ? 'UNKNOWN WORLD EVENT KIND'
          : truthState !== expectedTruth
            ? 'WORLD EVENT / TRUTH MISMATCH'
            : 'MALFORMED WORLD SIGNAL ROW';
      return unsupportedSignal(raw, index, reason);
    }

    seenIds.add(signalId);
    return raw as unknown as WorldSignalView;
  });
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  return reducedMotion;
}

function isSupportedSignal(signal: DisplayWorldSignal): signal is WorldSignalView {
  return !('display_kind' in signal);
}

function signalTime(value: string | null) {
  return value ? `${value.slice(11, 19)} UTC` : 'TIME UNAVAILABLE';
}

function signalKind(kind: WorldSignalView['kind']) {
  return kind.replaceAll('_', ' ');
}

function orderedSignals(signals: DisplayWorldSignal[]) {
  return signals
    .map((signal, index) => ({signal, index, time: signal.occurred_at ? Date.parse(signal.occurred_at) : Number.NEGATIVE_INFINITY}))
    .sort((a, b) => b.time - a.time || b.signal.signal_id.localeCompare(a.signal.signal_id) || a.index - b.index)
    .map(({signal}) => signal);
}

function FeedError({label, error}: {label: string; error: unknown}) {
  return (
    <div className="world-feed-error" role="status">
      <small>{label} FEED UNAVAILABLE</small>
      <strong>{errorMessage(error, `${label.toLowerCase()}_feed_unavailable`)}</strong>
    </div>
  );
}

function ProjectContextLink({projectId, projectName}: {projectId: string; projectName: string}) {
  return <a className="world-context-link" href={`?mode=project&project=${encodeURIComponent(projectId)}`} aria-label={`Open project context for ${projectName}`}>OPEN PROJECT CONTEXT ↗</a>;
}

function SignalDetails({signal, latest = false}: {signal: WorldSignalView; latest?: boolean}) {
  return (
    <article
      className={`world-signal-detail${latest ? ' world-signal-detail--now' : ''}`}
      data-signal-id={signal.signal_id}
      data-truth={signal.truth_state.toLowerCase()}
      data-now={latest ? 'true' : 'false'}
    >
      <div className="world-signal-mark" aria-hidden="true">{latest ? 'NOW' : 'RX'}</div>
      <div className="world-signal-copy">
        <div className="world-signal-meta">
          <span className="world-truth" data-truth={signal.truth_state.toLowerCase()}>{signal.truth_state}</span>
          <span>{signalKind(signal.kind)}</span>
        </div>
        <h3>{signal.project_name}</h3>
        <p>{latest ? 'Most recent supported public event in the World projection.' : 'Public event retained in temporal order.'}</p>
        <ProjectContextLink projectId={signal.project_id} projectName={signal.project_name} />
      </div>
      <time dateTime={signal.occurred_at}>{signalTime(signal.occurred_at)}</time>
    </article>
  );
}

function UnsupportedSignal({signal}: {signal: UnsupportedWorldSignal}) {
  return (
    <li className="world-signal-row world-signal-row--unsupported" data-truth="unsupported">
      <span className="world-truth world-truth--unsupported">UNSUPPORTED</span>
      <div>
        <strong>WORLD SIGNAL NOT RENDERED</strong>
        <small>{signal.reason}</small>
      </div>
      <time dateTime={signal.occurred_at ?? undefined}>{signalTime(signal.occurred_at)}</time>
    </li>
  );
}

function NowPanel({signal, error}: {signal?: WorldSignalView; error?: unknown}) {
  return (
    <section className="world-now" aria-labelledby="world-now-title">
      <header className="world-section-header">
        <div><span>NOW</span><h2 id="world-now-title">LATEST SUPPORTED SIGNAL</h2></div>
        <small>ONE CURRENT LOCUS // PROJECTION TIME</small>
      </header>
      {error ? <FeedError label="SIGNAL" error={error} /> : signal ? <SignalDetails signal={signal} latest /> : (
        <div className="world-empty world-empty--display"><small>SIGNAL BUS</small><strong>NO SUPPORTED PUBLIC SIGNALS</strong><p>WORLD is quiet; no synthetic activity is shown.</p></div>
      )}
    </section>
  );
}

function SignalTape({signals, latestSignal, error}: {signals: DisplayWorldSignal[]; latestSignal?: WorldSignalView; error?: unknown}) {
  const ordered = orderedSignals(signals);
  const continuation = latestSignal ? ordered.filter((signal) => signal.signal_id !== latestSignal.signal_id) : ordered;

  return (
    <section className="world-tape" aria-labelledby="world-tape-title">
      <header className="world-section-header">
        <div><span>TAPE</span><h2 id="world-tape-title">SIGNAL TAPE</h2></div>
        <small>NEWEST → OLDEST // PUBLIC TEMPORAL CONTINUITY</small>
      </header>
      {error ? <FeedError label="SIGNAL" error={error} /> : continuation.length ? (
        <ol className="world-signal-list">
          {continuation.map((signal) => isSupportedSignal(signal)
            ? <li className="world-signal-row" key={signal.signal_id} data-signal-id={signal.signal_id} data-truth={signal.truth_state.toLowerCase()}>
              <span className="world-truth" data-truth={signal.truth_state.toLowerCase()}>{signal.truth_state}</span>
              <div><strong>{signal.project_name}</strong><small>{signalKind(signal.kind)}</small><ProjectContextLink projectId={signal.project_id} projectName={signal.project_name} /></div>
              <time dateTime={signal.occurred_at}>{signalTime(signal.occurred_at)}</time>
            </li>
            : <UnsupportedSignal key={`${signal.signal_id}-${signal.reason}`} signal={signal} />)}
        </ol>
      ) : <div className="world-empty"><small>SIGNAL TAPE</small><strong>NO EARLIER PUBLIC SIGNALS</strong></div>}
    </section>
  );
}

function HelpBand({projects, error, latestSignal}: {projects: ProjectDiscoveryList; error?: unknown; latestSignal?: WorldSignalView}) {
  const openBeacons = projects.filter((entry) => entry.open_help_beacon?.state === 'OPEN');
  return (
    <section className="world-support-band world-help-band" aria-labelledby="world-help-title">
      <header className="world-section-header">
        <div><span>PUBLIC HELP</span><h2 id="world-help-title">HELP BEACONS</h2></div>
        <small>PUBLIC REQUESTS // CLAIMED</small>
      </header>
      {error ? <FeedError label="PROJECT" error={error} /> : openBeacons.length ? (
        <ul className="world-beacons">
          {openBeacons.map((entry) => (
            <li key={entry.open_help_beacon!.beacon_id} data-project-id={entry.project.project_id} data-current-target={entry.project.project_id === latestSignal?.project_id ? 'true' : 'false'}>
              <span className="world-beacon-mark" aria-hidden="true">!</span>
              <div><small>{entry.project.name}</small><strong>{entry.open_help_beacon!.summary}</strong><span>NEEDS // {entry.open_help_beacon!.skills_needed.join(' / ') || 'OPEN HELP'}</span></div>
              <ProjectContextLink projectId={entry.project.project_id} projectName={entry.project.name} />
            </li>
          ))}
        </ul>
      ) : <div className="world-empty"><small>HELP BEACONS</small><strong>NO OPEN BEACONS</strong></div>}
    </section>
  );
}

function BuilderBand({players, error}: {players: PublicPlayerList; error?: unknown}) {
  return (
    <section className="world-support-band world-builder-band" aria-labelledby="world-builder-title">
      <header className="world-section-header">
        <div><span>PUBLIC SKILLS</span><h2 id="world-builder-title">BUILDER CAPABILITY</h2></div>
        <small>SELF-DESCRIPTION // NOT MATCHING</small>
      </header>
      {error ? <FeedError label="PLAYER" error={error} /> : players.length ? (
        <ul className="world-builders">
          {players.slice(0, 12).map((player) => (
            <li key={player.player_id}>
              <strong>{player.display_name}</strong>
              <span>CAN HELP WITH // {player.can_help_with.join(' / ') || 'UNDECLARED'}</span>
              <small>NEEDS // {player.skills_needed.join(' / ') || 'NONE DECLARED'}</small>
            </li>
          ))}
        </ul>
      ) : <div className="world-empty"><small>BUILDER BAND</small><strong>NO PUBLIC BUILDERS</strong></div>}
    </section>
  );
}

function WorldProjection({projects, projectsError, players, playersError, signals, signalsError, newSignalIds, eventSequence}: {
  projects: ProjectDiscoveryList;
  projectsError?: unknown;
  players: PublicPlayerList;
  playersError?: unknown;
  signals: DisplayWorldSignal[];
  signalsError?: unknown;
  newSignalIds: string[];
  eventSequence: number;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const ordered = orderedSignals(signals);
  const latestSignal = ordered.find(isSupportedSignal);
  const observedSignals = signals.filter((signal) => isSupportedSignal(signal) && signal.truth_state === 'OBSERVED').length;
  const claimedSignals = signals.filter((signal) => isSupportedSignal(signal) && signal.truth_state === 'CLAIMED').length;
  const unsupportedSignals = signals.filter((signal) => !isSupportedSignal(signal)).length;

  useGSAP(() => {
    if (eventSequence === 0 || reducedMotion || newSignalIds.length === 0) return;
    const root = rootRef.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>('[data-signal-id]'))
      .filter((target) => newSignalIds.includes(target.getAttribute('data-signal-id') ?? ''));
    if (!targets.length) return;
    gsap.timeline({defaults: {ease: MOTION_EASE.signal}})
      .fromTo(targets, {opacity: 0.28, filter: 'brightness(1.6)'}, {opacity: 1, filter: 'brightness(1)', duration: MOTION_SECONDS.signal, stagger: 0.05});
  }, {scope: rootRef, dependencies: [eventSequence, reducedMotion], revertOnUpdate: true});

  return (
    <TerminalShell
      rootRef={rootRef}
      mode="WORLD"
      kicker="REKT INK(CUBATOR) // PUBLIC WORLD"
      title="PUBLIC SIGNALS"
      description="WHAT IS HAPPENING AROUND ME THAT I WOULD OTHERWISE MISS? A broadcast of supported public events, help requests and truthful temporal continuity."
      readout={[
        {label: 'PROJECTS', value: String(projects.length)},
        {label: 'BUILDERS', value: String(players.length)},
        {label: 'SIGNALS', value: String(signals.length)},
      ]}
      eventStatus={signalsError ? 'PUBLIC SIGNAL BUS // UNAVAILABLE' : `PUBLIC SIGNAL BUS // ${observedSignals} OBSERVED / ${claimedSignals} CLAIMED${unsupportedSignals ? ` / ${unsupportedSignals} UNSUPPORTED` : ''}`}
      workspaceClassName="world-workspace"
      footerItems={[
        'PUBLIC PROJECTION ONLY',
        'SIGNAL MOTION // FEED DELTAS ONLY',
        'CLAIMED ≠ OBSERVED ≠ PROVEN',
      ]}
      className="world-live"
      eventSequence={eventSequence}
    >
      <div className="world-instrument">
        <NowPanel signal={latestSignal} error={signalsError} />
        <SignalTape signals={signals} latestSignal={latestSignal} error={signalsError} />
        <div className="world-support-grid">
          <HelpBand projects={projects} error={projectsError} latestSignal={latestSignal} />
          <BuilderBand players={players} error={playersError} />
        </div>
      </div>
    </TerminalShell>
  );
}

export default function LiveWorld({client = createInkubatorApiClient(), refetchIntervalMs = 2500}: LiveWorldProps) {
  const projectQuery = useQuery({queryKey: projectKey, queryFn: () => client.discoverProjects(), refetchInterval: refetchIntervalMs, retry: 1});
  const playerQuery = useQuery({queryKey: playerKey, queryFn: () => client.discoverPlayers(), refetchInterval: refetchIntervalMs, retry: 1});
  const signalQuery = useQuery({queryKey: signalKey, queryFn: () => client.listWorldSignals(), refetchInterval: refetchIntervalMs, retry: 1});
  const previousSignalIds = useRef<Set<string> | null>(null);
  const [newSignalIds, setNewSignalIds] = useState<string[]>([]);
  const [eventSequence, setEventSequence] = useState(0);
  const normalizedSignals = normalizeWorldSignals(signalQuery.data);

  useEffect(() => {
    if (!signalQuery.data) return;
    const next = new Set(normalizeWorldSignals(signalQuery.data).filter(isSupportedSignal).map((signal) => signal.signal_id));
    const previous = previousSignalIds.current;
    previousSignalIds.current = next;
    if (!previous) return;
    const added = [...next].filter((id) => !previous.has(id));
    if (!added.length) return;
    setNewSignalIds(added);
    setEventSequence((value) => value + 1);
  }, [signalQuery.data, signalQuery.dataUpdatedAt]);

  const allPending = projectQuery.isPending && playerQuery.isPending && signalQuery.isPending;
  const allFailed = projectQuery.isError && playerQuery.isError && signalQuery.isError;

  if (allPending) {
    return (
      <TerminalShell mode="WORLD" kicker="REKT INK(CUBATOR) // PUBLIC WORLD" title="PUBLIC SIGNALS" description="Connecting canonical public projections." workspaceClassName="world-loading" className="world-live">
        <div><small>WORLD INSTRUMENT</small><h2>CONNECTING PUBLIC SIGNAL BUS</h2><p>Waiting for project, builder and world-signal projections.</p></div>
      </TerminalShell>
    );
  }

  if (allFailed) {
    return (
      <TerminalShell mode="WORLD" kicker="REKT INK(CUBATOR) // PUBLIC WORLD" title="PUBLIC SIGNALS" description="Canonical public projection unavailable." workspaceClassName="world-loading world-loading--error" className="world-live" role="alert">
        <div><small>WORLD INSTRUMENT</small><h2>WORLD LINK UNAVAILABLE</h2><p>{errorMessage(signalQuery.error ?? projectQuery.error ?? playerQuery.error, 'world_projection_unavailable')}</p><p>No development fixture fallback is permitted.</p></div>
      </TerminalShell>
    );
  }

  return <WorldProjection projects={projectQuery.data ?? []} projectsError={projectQuery.error} players={playerQuery.data ?? []} playersError={playerQuery.error} signals={normalizedSignals} signalsError={signalQuery.error} newSignalIds={newSignalIds} eventSequence={eventSequence} />;
}
