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

function orderedSignals(signals: WorldSignalList) {
  return [...signals].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

function signalKind(kind: WorldSignalView['kind']) {
  return kind.replaceAll('_', ' ');
}

function signalTime(value: string) {
  return value.slice(11, 19) || value;
}

function FeedError({label, error}: {label: string; error: unknown}) {
  return (
    <div className="world-feed-error" role="status">
      <small>{label} FEED UNAVAILABLE</small>
      <strong>{errorMessage(error, `${label.toLowerCase()}_feed_unavailable`)}</strong>
    </div>
  );
}

function NetworkField({projects, signals, latestSignal, reducedMotion}: {
  projects: ProjectDiscoveryList;
  signals: WorldSignalList;
  latestSignal?: WorldSignalView;
  reducedMotion: boolean;
}) {
  const projectById = new Map(projects.map((entry) => [entry.project.project_id, entry]));
  const recentSignals = orderedSignals(signals).slice(0, 12);

  return (
    <div className="world-network-field world-radar" data-motion-policy={reducedMotion ? 'reduced' : 'full'}>
      <div className="world-field-stage">
        <svg viewBox="0 0 600 440" role="img" aria-labelledby="world-field-title world-field-description">
          <title id="world-field-title">Public Inkubator network field</title>
          <desc id="world-field-description">
            Public project nodes with signal routes and open-help beacons. Node positions are deterministic layout only; they do not encode progress, category, relationship or importance.
          </desc>
          <g className="world-field-grid" aria-hidden="true">
            <circle cx="300" cy="220" r="58" />
            <circle cx="300" cy="220" r="118" />
            <circle cx="300" cy="220" r="178" />
            <path d="M300 25v390M45 220h510M118 77l364 286M118 363L482 77" />
          </g>
          <g className="world-field-core" aria-hidden="true">
            <circle cx="300" cy="220" r="9" />
            <circle cx="300" cy="220" r="17" />
            <path d="M300 202v-18M300 238v18M282 220h-18M318 220h18" />
            <text x="300" y="288" textAnchor="middle">RX / PUBLIC BUS</text>
          </g>
          <g className="world-field-routes" aria-hidden="true">
            {recentSignals.map((signal) => {
              const project = projectById.get(signal.project_id);
              if (!project) return null;
              const point = projectPosition(signal.project_id);
              return (
                <line
                  key={signal.signal_id}
                  className={signal.signal_id === latestSignal?.signal_id ? 'world-field-route world-field-route--latest' : 'world-field-route'}
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
          <g className="world-field-help-routes" aria-hidden="true">
            {projects.map((entry) => {
              if (entry.open_help_beacon?.state !== 'OPEN') return null;
              const point = projectPosition(entry.project.project_id);
              return <path key={entry.project.project_id} d={`M${point.x} ${point.y} L${point.x + 27} ${point.y - 22}`} />;
            })}
          </g>
          <g className="world-field-projects">
            {projects.map((entry) => {
              const point = projectPosition(entry.project.project_id);
              const tone = observationTone(entry.project.observation_state);
              const hasOpenHelp = entry.open_help_beacon?.state === 'OPEN';
              const isLatestTarget = entry.project.project_id === latestSignal?.project_id;
              return (
                <g
                  key={entry.project.project_id}
                  className="world-network-node"
                  data-project-id={entry.project.project_id}
                  data-tone={tone}
                  data-help-open={hasOpenHelp ? 'true' : 'false'}
                  data-current-target={isLatestTarget ? 'true' : 'false'}
                  transform={`translate(${point.x} ${point.y})`}
                >
                  <title>{`${entry.project.name}: ${entry.project.observation_state}${hasOpenHelp ? ', OPEN HELP' : ''}`}</title>
                  <circle r="8" />
                  <circle className="world-network-node-ring" r="14" />
                  {hasOpenHelp ? <rect className="world-network-node-beacon" x="11" y="-22" width="7" height="7" /> : null}
                  <text x="18" y="-2">{entry.project.name.slice(0, 24)}</text>
                  <text className="world-network-node-state" x="18" y="10">{entry.project.observation_state}</text>
                </g>
              );
            })}
          </g>
        </svg>
        <div className="world-field-core-caption">
          <span className="world-field-glyph" aria-hidden="true">⌁</span>
          <span><b>PUBLIC RX</b><small>signals route to public projects</small></span>
        </div>
      </div>
      <div className="world-field-index-wrap">
        <div className="world-field-legend" aria-label="Network field key">
          <span data-tone="observed"><i aria-hidden="true" />OBSERVED PROJECT</span>
          <span data-tone="active"><i aria-hidden="true" />ACTIVE PROJECT</span>
          <span data-tone="stale"><i aria-hidden="true" />STALE OBSERVATION</span>
          <span data-tone="failed"><i aria-hidden="true" />FAILED OBSERVATION</span>
          <span data-tone="help"><i aria-hidden="true" />OPEN HELP BEACON</span>
        </div>
        <ol className="world-project-index" aria-label="Public projects in network field">
          {projects.map((entry, index) => (
            <li key={entry.project.project_id} data-project-id={entry.project.project_id} data-observation={entry.project.observation_state}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{entry.project.name}</strong>
              <small>{entry.project.observation_state}{entry.open_help_beacon?.state === 'OPEN' ? ' / HELP OPEN' : ''}</small>
            </li>
          ))}
        </ol>
        <p className="world-layout-note">POSITIONS = LAYOUT ONLY // NO PROGRESS, CATEGORY, RELATIONSHIP OR IMPORTANCE</p>
      </div>
    </div>
  );
}

function CurrentSignal({signal, error}: {signal?: WorldSignalView; error?: unknown}) {
  return (
    <section className="world-intercept" aria-labelledby="world-intercept-title">
      <header className="world-instrument-header">
        <div><span>RX / 01</span><h2 id="world-intercept-title">LATEST PUBLIC SIGNAL</h2></div>
        <small>ONE CURRENT LOCUS // FEED DELTA ONLY</small>
      </header>
      {error ? <FeedError label="SIGNAL" error={error} /> : signal ? (
        <div className="world-current-signal" data-signal-id={signal.signal_id} data-truth={signal.truth_state.toLowerCase()}>
          <span className="world-current-signal-mark" aria-hidden="true">RX</span>
          <div>
            <small>{signal.truth_state} // {signalKind(signal.kind)}</small>
            <strong>{signal.project_name}</strong>
            <p>Public event received by the World signal bus. Truth ceiling: {signal.truth_state}; no stronger authority is inferred.</p>
          </div>
          <time dateTime={signal.occurred_at}>{signalTime(signal.occurred_at)} UTC</time>
        </div>
      ) : (
        <div className="world-empty world-empty--inline"><small>SIGNAL BUS</small><strong>NO PUBLIC SIGNALS YET</strong></div>
      )}
    </section>
  );
}

function HelpBand({projects, error, latestSignal}: {projects: ProjectDiscoveryList; error?: unknown; latestSignal?: WorldSignalView}) {
  const openBeacons = projects.filter((entry) => entry.open_help_beacon?.state === 'OPEN');
  return (
    <section className="world-support-band world-help-band" aria-labelledby="world-help-title">
      <header className="world-instrument-header">
        <div><span>BEACON / 08</span><h2 id="world-help-title">PROJECT NEEDS HELP</h2></div>
        <small>ATTACHED TO NETWORK FIELD</small>
      </header>
      {error ? <FeedError label="PROJECT" error={error} /> : openBeacons.length ? (
        <ul className="world-beacons">
          {openBeacons.map((entry) => (
            <li key={entry.open_help_beacon!.beacon_id} data-project-id={entry.project.project_id} data-current-target={entry.project.project_id === latestSignal?.project_id ? 'true' : 'false'}>
              <span className="world-beacon-mark" aria-hidden="true">!</span>
              <div><small>{entry.project.name}</small><strong>{entry.open_help_beacon!.summary}</strong></div>
              <span className="world-beacon-skills">NEEDS // {entry.open_help_beacon!.skills_needed.join(' / ') || 'OPEN HELP'}</span>
            </li>
          ))}
        </ul>
      ) : <div className="world-empty"><small>HELP BAND</small><strong>NO OPEN BEACONS</strong></div>}
    </section>
  );
}

function BuilderBand({players, error}: {players: PublicPlayerList; error?: unknown}) {
  return (
    <section className="world-support-band world-builder-band" aria-labelledby="world-builder-title">
      <header className="world-instrument-header">
        <div><span>CAPABILITY / 05</span><h2 id="world-builder-title">BUILDER CAPABILITY</h2></div>
        <small>PUBLIC SELF-DESCRIPTION // NOT MATCHING</small>
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

function RecentActivity({signals, error}: {signals: WorldSignalList; error?: unknown}) {
  const ordered = orderedSignals(signals);
  return (
    <section className="world-activity" aria-labelledby="world-activity-title">
      <header className="world-instrument-header">
        <div><span>TRACE / 12</span><h2 id="world-activity-title">RECENT PUBLIC ACTIVITY</h2></div>
        <small>CANONICAL WORLD SIGNALS</small>
      </header>
      {error ? <FeedError label="SIGNAL" error={error} /> : ordered.length ? (
        <ol className="world-signals">
          {ordered.slice(0, 10).map((signal) => (
            <li key={signal.signal_id} data-signal-id={signal.signal_id} data-truth={signal.truth_state.toLowerCase()}>
              <span>{signal.truth_state}</span>
              <div><strong>{signal.project_name}</strong><small>{signalKind(signal.kind)}</small></div>
              <time dateTime={signal.occurred_at}>{signalTime(signal.occurred_at)} UTC</time>
            </li>
          ))}
        </ol>
      ) : <div className="world-empty"><small>SIGNAL BUS</small><strong>NO PUBLIC SIGNALS YET</strong></div>}
    </section>
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
  const latestSignal = orderedSignals(signals)[0];
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
      title="LIVING PUBLIC NETWORK"
      description="WHAT IS ALIVE IN THE INKUBATOR RIGHT NOW? A public network instrument of canonical projects, builders and signals."
      readout={[
        {label: 'PROJECTS', value: String(projects.length)},
        {label: 'BUILDERS', value: String(players.length)},
        {label: 'SIGNALS', value: String(signals.length)},
      ]}
      eventStatus={signalsError ? 'PUBLIC SIGNAL BUS // UNAVAILABLE' : `PUBLIC SIGNAL BUS // ${observedSignals} OBSERVED / ${signals.length - observedSignals} CLAIMED`}
      workspaceClassName="world-workspace"
      footerItems={[
        'PUBLIC PROJECTION ONLY',
        'SIGNAL MOTION // FEED DELTAS ONLY',
        'CLAIMED ≠ OBSERVED ≠ PROVEN',
      ]}
      className="world-live"
      eventSequence={eventSequence}
    >
      <div className="world-instrument" data-field-count="1">
        <CurrentSignal signal={latestSignal} error={signalsError} />

        <section className="world-field-panel" aria-labelledby="world-field-panel-title">
          <header className="world-instrument-header world-field-panel-header">
            <div><span>FIELD / 00</span><h2 id="world-field-panel-title">NETWORK FIELD</h2></div>
            <small>PUBLIC PROJECTS / SIGNAL ROUTES / LAYOUT ONLY</small>
          </header>
          <div>{projectsError ? <FeedError label="PROJECT" error={projectsError} /> : <NetworkField projects={projects} signals={signals} latestSignal={latestSignal} reducedMotion={reducedMotion} />}</div>
        </section>

        <div className="world-support-grid">
          <HelpBand projects={projects} error={projectsError} latestSignal={latestSignal} />
          <BuilderBand players={players} error={playersError} />
        </div>

        <RecentActivity signals={signals} error={signalsError} />
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
      <TerminalShell mode="WORLD" kicker="REKT INK(CUBATOR) // PUBLIC WORLD" title="LIVING PUBLIC NETWORK" description="Connecting canonical public network projections." workspaceClassName="world-loading" className="world-live">
        <div><small>WORLD INSTRUMENT</small><h2>CONNECTING PUBLIC SIGNAL BUS</h2><p>Waiting for project, builder and world-signal projections.</p></div>
      </TerminalShell>
    );
  }

  if (allFailed) {
    return (
      <TerminalShell mode="WORLD" kicker="REKT INK(CUBATOR) // PUBLIC WORLD" title="LIVING PUBLIC NETWORK" description="Canonical public network projection unavailable." workspaceClassName="world-loading world-loading--error" className="world-live" role="alert">
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
