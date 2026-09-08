import {useEffect, useRef, useState} from 'react';
import {useGSAP} from '@gsap/react';
import {useQuery} from '@tanstack/react-query';
import gsap from 'gsap';
import type {
  InkubatorApiClient,
  ProjectDiscoveryList,
  PublicPlayerList,
  WorldSignalList,
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

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
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

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function projectPosition(projectId: string) {
  const hash = hashString(projectId);
  const angle = ((hash % 360) / 180) * Math.PI;
  const radius = 82 + ((hash >>> 9) % 118);
  return {
    x: 300 + Math.cos(angle) * radius,
    y: 220 + Math.sin(angle) * radius * 0.78,
  };
}

function observationTone(state: string) {
  if (state === 'OBSERVED') return 'observed';
  if (state === 'ACTIVE') return 'active';
  if (state === 'STALE') return 'stale';
  if (state === 'FAILED') return 'failed';
  return 'unknown';
}

function FeedError({label, error}: {label: string; error: unknown}) {
  return (
    <div className="world-feed-error" role="status">
      <small>{label} FEED UNAVAILABLE</small>
      <strong>{errorMessage(error, `${label.toLowerCase()}_feed_unavailable`)}</strong>
    </div>
  );
}

function NetworkRadar({projects, signals, reducedMotion}: {
  projects: ProjectDiscoveryList;
  signals: WorldSignalList;
  reducedMotion: boolean;
}) {
  const projectById = new Map(projects.map((entry) => [entry.project.project_id, entry]));
  const recentSignals = [...signals].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, 12);

  return (
    <div className="world-radar" data-motion-policy={reducedMotion ? 'reduced' : 'full'}>
      <svg viewBox="0 0 600 440" role="img" aria-label="Public Inkubator project and signal radar">
        <g className="world-radar-grid" aria-hidden="true">
          <circle cx="300" cy="220" r="58" />
          <circle cx="300" cy="220" r="118" />
          <circle cx="300" cy="220" r="178" />
          <path d="M300 25v390M45 220h510M118 77l364 286M118 363L482 77" />
        </g>
        <g className="world-radar-core" aria-hidden="true">
          <circle cx="300" cy="220" r="9" />
          <circle cx="300" cy="220" r="17" />
          <path className="world-radar-sweep" d="M300 220L300 36" />
        </g>
        <g className="world-radar-signals" aria-hidden="true">
          {recentSignals.map((signal) => {
            const project = projectById.get(signal.project_id);
            if (!project) return null;
            const point = projectPosition(signal.project_id);
            return (
              <line
                key={signal.signal_id}
                x1="300"
                y1="220"
                x2={point.x}
                y2={point.y}
                data-signal-id={signal.signal_id}
                data-truth={signal.truth_state.toLowerCase()}
              />
            );
          })}
        </g>
        <g className="world-radar-projects">
          {projects.map((entry) => {
            const point = projectPosition(entry.project.project_id);
            const tone = observationTone(entry.project.observation_state);
            return (
              <g
                key={entry.project.project_id}
                className="world-radar-node"
                data-tone={tone}
                transform={`translate(${point.x} ${point.y})`}
              >
                <circle r="8" />
                <circle className="world-radar-node-ring" r="14" />
                <text x="18" y="-2">{entry.project.name.slice(0, 24)}</text>
                <text className="world-radar-node-state" x="18" y="10">{entry.project.mission_state} / {entry.project.observation_state}</text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="world-radar-legend" aria-hidden="true">
        <span data-tone="observed">OBSERVED</span>
        <span data-tone="active">ACTIVE</span>
        <span data-tone="stale">STALE</span>
        <span data-tone="failed">FAILED</span>
      </div>
    </div>
  );
}

function SignalRail({signals}: {signals: WorldSignalList}) {
  const ordered = [...signals].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  if (!ordered.length) return <div className="world-empty"><small>SIGNAL BUS</small><strong>NO PUBLIC SIGNALS</strong></div>;

  return (
    <ol className="world-signals">
      {ordered.slice(0, 10).map((signal) => (
        <li key={signal.signal_id} data-signal-id={signal.signal_id} data-truth={signal.truth_state.toLowerCase()}>
          <span>{signal.truth_state}</span>
          <div><strong>{signal.project_name}</strong><small>{signal.kind.replaceAll('_', ' ')}</small></div>
          <time dateTime={signal.occurred_at}>{signal.occurred_at}</time>
        </li>
      ))}
    </ol>
  );
}

function WorldProjection({
  projects,
  projectsError,
  players,
  playersError,
  signals,
  signalsError,
  newSignalIds,
  eventSequence,
}: {
  projects: ProjectDiscoveryList;
  projectsError?: unknown;
  players: PublicPlayerList;
  playersError?: unknown;
  signals: WorldSignalList;
  signalsError?: unknown;
  newSignalIds: string[];
  eventSequence: number;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const openBeacons = projects.filter((entry) => entry.open_help_beacon?.state === 'OPEN');
  const observedSignals = signals.filter((signal) => signal.truth_state === 'OBSERVED').length;

  useGSAP(() => {
    if (eventSequence === 0 || reducedMotion || newSignalIds.length === 0) return;
    const root = rootRef.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement | SVGElement>('[data-signal-id]'))
      .filter((target) => newSignalIds.includes(target.getAttribute('data-signal-id') ?? ''));
    if (!targets.length) return;
    gsap.timeline({defaults: {ease: MOTION_EASE.signal}})
      .fromTo(targets, {opacity: 0.18, filter: 'brightness(1.8)'}, {opacity: 1, filter: 'brightness(1)', duration: MOTION_SECONDS.signal, stagger: 0.05});
  }, {scope: rootRef, dependencies: [eventSequence, reducedMotion], revertOnUpdate: true});

  return (
    <TerminalShell
      rootRef={rootRef}
      mode="WORLD"
      kicker="REKT INK(CUBATOR) // PUBLIC WORLD"
      title="UNDERGROUND BUILD NETWORK"
      description="Public network instrument. It renders only canonical public projections; private repository metadata and private command state never enter this surface."
      readout={[
        {label: 'PROJECTS', value: String(projects.length)},
        {label: 'BUILDERS', value: String(players.length)},
        {label: 'SIGNALS', value: String(signals.length)},
      ]}
      eventStatus={`PUBLIC SIGNAL BUS // ${observedSignals} OBSERVED / ${signals.length - observedSignals} CLAIMED`}
      workspaceClassName="world-workspace"
      footerItems={[
        'PUBLIC PROJECTION ONLY',
        'SIGNAL MOTION // FEED DELTAS ONLY',
        'CLAIMED ≠ OBSERVED ≠ PROVEN',
      ]}
      className="world-live"
      eventSequence={eventSequence}
    >
      <section className="world-sector world-sector--radar">
        <header><span>00</span><strong>NETWORK / RADAR</strong><i aria-hidden="true" /></header>
        <div>{projectsError ? <FeedError label="PROJECT" error={projectsError} /> : <NetworkRadar projects={projects} signals={signals} reducedMotion={reducedMotion} />}</div>
      </section>

      <section className="world-sector world-sector--signals">
        <header><span>01</span><strong>LIVE PUBLIC SIGNALS</strong><i aria-hidden="true" /></header>
        <div>{signalsError ? <FeedError label="SIGNAL" error={signalsError} /> : <SignalRail signals={signals} />}</div>
      </section>

      <section className="world-sector world-sector--beacons">
        <header><span>08</span><strong>HELP BEACONS</strong><i aria-hidden="true" /></header>
        <div>
          {projectsError ? <FeedError label="PROJECT" error={projectsError} /> : openBeacons.length ? (
            <ul className="world-beacons">
              {openBeacons.map((entry) => (
                <li key={entry.open_help_beacon!.beacon_id}>
                  <div><small>{entry.project.name}</small><strong>{entry.open_help_beacon!.summary}</strong></div>
                  <span>{entry.open_help_beacon!.skills_needed.join(' / ') || 'OPEN HELP'}</span>
                </li>
              ))}
            </ul>
          ) : <div className="world-empty"><small>HELP BAND</small><strong>NO OPEN BEACONS</strong></div>}
        </div>
      </section>

      <section className="world-sector world-sector--builders">
        <header><span>05</span><strong>BUILDERS / CAPABILITY BAND</strong><i aria-hidden="true" /></header>
        <div>
          {playersError ? <FeedError label="PLAYER" error={playersError} /> : players.length ? (
            <ul className="world-builders">
              {players.slice(0, 12).map((player) => (
                <li key={player.player_id}>
                  <strong>{player.display_name}</strong>
                  <span>CAN HELP // {player.can_help_with.join(' / ') || 'UNDECLARED'}</span>
                  <small>NEEDS // {player.skills_needed.join(' / ') || 'NONE DECLARED'}</small>
                </li>
              ))}
            </ul>
          ) : <div className="world-empty"><small>BUILDER BAND</small><strong>NO PUBLIC BUILDERS</strong></div>}
        </div>
      </section>
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

  useEffect(() => {
    if (!signalQuery.data) return;
    const next = new Set(signalQuery.data.map((signal) => signal.signal_id));
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
      <TerminalShell mode="WORLD" kicker="REKT INK(CUBATOR) // PUBLIC WORLD" title="UNDERGROUND BUILD NETWORK" description="Connecting canonical public network projections." workspaceClassName="world-loading" className="world-live">
        <div><small>WORLD INSTRUMENT</small><h2>CONNECTING PUBLIC SIGNAL BUS</h2><p>Waiting for project, builder and world-signal projections.</p></div>
      </TerminalShell>
    );
  }

  if (allFailed) {
    return (
      <TerminalShell mode="WORLD" kicker="REKT INK(CUBATOR) // PUBLIC WORLD" title="UNDERGROUND BUILD NETWORK" description="Canonical public network projection unavailable." workspaceClassName="world-loading world-loading--error" className="world-live" role="alert">
        <div><small>WORLD INSTRUMENT</small><h2>WORLD LINK UNAVAILABLE</h2><p>{errorMessage(signalQuery.error ?? projectQuery.error ?? playerQuery.error, 'world_projection_unavailable')}</p><p>No development fixture fallback is permitted.</p></div>
      </TerminalShell>
    );
  }

  return (
    <WorldProjection
      projects={projectQuery.data ?? []}
      projectsError={projectQuery.error}
      players={playerQuery.data ?? []}
      playersError={playerQuery.error}
      signals={signalQuery.data ?? []}
      signalsError={signalQuery.error}
      newSignalIds={newSignalIds}
      eventSequence={eventSequence}
    />
  );
}
