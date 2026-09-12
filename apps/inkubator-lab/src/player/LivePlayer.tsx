import {useEffect, useMemo, useState, type KeyboardEvent} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {
  CheevoView,
  InkubatorApiClient,
  PlayerHistoryEntryView,
  PlayerHistoryView,
  PlayerProfileView,
  PlayerReputationView,
  PrivatePlayer,
} from '../generated/inkubator-api-client';
import {InkubatorApiError} from '../generated/inkubator-api-client';
import {createInkubatorApiClient} from '../inkubator-api';
import {TerminalShell} from '../shell/TerminalShell';
import './live-player-v2.css';

type PlayerClient = Pick<InkubatorApiClient, 'getMe' | 'getMyProfile' | 'getMyHistory' | 'getPlayerReputation'>;

export type LivePlayerProps = {
  client?: PlayerClient;
  refetchIntervalMs?: number | false;
};

const meKey = ['inkubator', 'player', 'me'] as const;
const profileKey = ['inkubator', 'player', 'profile'] as const;
const historyKey = ['inkubator', 'player', 'history'] as const;
const reputationKey = (playerId: string) => ['inkubator', 'player', playerId, 'reputation'] as const;

const HISTORY_LABELS: Record<PlayerHistoryEntryView['kind'], string> = {
  SHIP_ACCEPTED: 'Ship accepted',
  ASSIST_ACCEPTED: 'Assist accepted',
  EXTERNAL_TEST_RECORDED: 'External test recorded',
  CHEEVO_AWARDED: 'Cheevo earned',
  MISSION_BLOCKED: 'Mission blocked',
  MISSION_RECOVERED: 'Mission recovered',
  MISSION_CLOSED_NOT_SHIPPED: 'Mission closed without Ship',
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function entryOwner(kind: PlayerHistoryEntryView['kind']) {
  if (kind === 'SHIP_ACCEPTED') return 'SHIP';
  if (kind === 'CHEEVO_AWARDED') return 'PLAYER';
  if (kind === 'MISSION_BLOCKED' || kind === 'MISSION_RECOVERED' || kind === 'MISSION_CLOSED_NOT_SHIPPED') return 'COMMAND';
  return 'PROJECT';
}

function entryReference(entry: PlayerHistoryEntryView) {
  return entry.receipt_id ?? entry.assist_id ?? entry.test_result_id ?? entry.cheevo_award_id ?? entry.mission_id ?? entry.entry_id;
}

function entryDetail(entry: PlayerHistoryEntryView) {
  if (entry.kind === 'SHIP_ACCEPTED') return entry.artifact_title ?? entry.project_name ?? 'Accepted Ship';
  if (entry.kind === 'EXTERNAL_TEST_RECORDED') return `${entry.project_name ?? 'Project'}${entry.outcome ? ` / ${entry.outcome}` : ''}`;
  if (entry.kind === 'CHEEVO_AWARDED') return entry.cheevo_key ?? 'Versioned recognition';
  return entry.project_name ?? entry.mission_id ?? 'Builder record';
}

function truthBoundary(truth: PlayerHistoryEntryView['truth_state']) {
  if (truth === 'PROVEN') return 'A server-derived proof boundary was crossed. The record remains evidence-linked and versioned.';
  if (truth === 'OBSERVED') return 'A canonical observation exists. Observation does not imply acceptance or proof.';
  return 'A declaration or state transition is recorded. It does not establish observation or proof.';
}

function TruthLabel({truth}: {truth: PlayerHistoryEntryView['truth_state'] | 'PROVEN'}) {
  return <span className="player-truth" data-truth={truth.toLowerCase()}><i aria-hidden="true" />{truth}</span>;
}

function ProjectionUnavailable({label, error}: {label: string; error: unknown}) {
  return <div className="player-projection-error" role="status"><small>{label} LINK UNAVAILABLE</small><strong>{errorMessage(error, `${label.toLowerCase()}_projection_unavailable`)}</strong></div>;
}

function HistoryInspector({entry}: {entry?: PlayerHistoryEntryView}) {
  if (!entry) return <aside className="player-inspector player-inspector--empty"><span>PROVENANCE INSPECTOR</span><h3>No record selected.</h3><p>Context appears when a canonical history record is available.</p></aside>;
  return (
    <aside className="player-inspector faceplate-inspector" aria-label="Selected builder record">
      <span>SELECTED RECORD</span>
      <TruthLabel truth={entry.truth_state} />
      <h3 key={entry.entry_id} className="faceplate-selection-response">{HISTORY_LABELS[entry.kind]}</h3>
      <p>{entryDetail(entry)}</p>
      <dl>
        <div><dt>RECORDED / UTC</dt><dd><time dateTime={entry.occurred_at}>{entry.occurred_at}</time></dd></div>
        <div><dt>OWNING SURFACE</dt><dd>{entryOwner(entry.kind)}</dd></div>
        <div><dt>REFERENCE</dt><dd><code>{entryReference(entry)}</code></dd></div>
        {entry.role ? <div><dt>ROLE</dt><dd>{entry.role}</dd></div> : null}
      </dl>
      {entry.project_id ? <a href={`?mode=${entry.kind === 'SHIP_ACCEPTED' ? 'ship' : 'project'}&project=${encodeURIComponent(entry.project_id)}${entry.kind === 'SHIP_ACCEPTED' && entry.receipt_id ? `&receipt=${encodeURIComponent(entry.receipt_id)}` : ''}`}>Open {entry.kind === 'SHIP_ACCEPTED' ? 'receipt' : 'project'} ↗</a> : null}
      <div className="player-boundary"><small>READ THIS AS</small><p>{truthBoundary(entry.truth_state)}</p></div>
    </aside>
  );
}

function HistoryInstrument({history, error}: {history?: PlayerHistoryView; error?: unknown}) {
  const denied = error instanceof InkubatorApiError && [401,403].includes(error.status);
  const visibleHistory = denied ? undefined : history;
  const entries = useMemo(() => [...(visibleHistory?.entries ?? [])].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)), [visibleHistory]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const selected = entries.find((entry) => entry.entry_id === selectedId) ?? entries.at(-1);

  useEffect(() => {
    if (!entries.length) setSelectedId(undefined);
    else if (!selectedId || !entries.some((entry) => entry.entry_id === selectedId)) setSelectedId(entries.at(-1)?.entry_id);
  }, [entries, selectedId]);

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === 'ArrowDown') next = Math.min(entries.length - 1, index + 1);
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = entries.length - 1;
    else return;
    event.preventDefault();
    const nextEntry = entries[next];
    setSelectedId(nextEntry.entry_id);
    document.querySelector<HTMLButtonElement>(`[data-player-history-id="${CSS.escape(nextEntry.entry_id)}"]`)?.focus();
  }

  return (
    <section className="player-history-section" aria-labelledby="player-history-heading">
      <header className="player-printed-head"><span>01 /</span><h2 id="player-history-heading">THE BUILDER RECORD</h2><small>SEQUENCE, NOT A PROGRESS SCORE</small></header>
      <div className="player-record-grid faceplate-split">
        <section className="player-history-display faceplate-display" aria-label="Chronological builder history">
          <header><div><small>CAREER THREAD / CANONICAL</small><h3>Build history<span aria-hidden="true">_</span></h3></div><b>{String(entries.length).padStart(2, '0')}<small>RECORDS</small></b></header>
          <div className="player-history-ruler"><span>OLDEST</span><span>→</span><span>NEWEST</span></div>
          {error ? <ProjectionUnavailable label="HISTORY" error={error} /> : null}
          {error && visibleHistory ? <p role="status">STALE HISTORY SNAPSHOT / Last received records.</p> : null}
          {!visibleHistory ? error ? null : <div className="player-empty player-empty--dark" role="status"><strong>CONNECTING HISTORY</strong><p>Waiting for the builder record.</p></div> : entries.length ? (
            <ol className="player-history-list">
              {entries.map((entry, index) => (
                <li key={entry.entry_id}>
                  <button
                    type="button"
                    className="faceplate-record"
                    data-player-history-id={entry.entry_id}
                    aria-pressed={entry.entry_id === selected?.entry_id}
                    onClick={() => setSelectedId(entry.entry_id)}
                    onKeyDown={(event) => onKeyDown(event, index)}
                  >
                    <time dateTime={entry.occurred_at}>{entry.occurred_at.slice(0, 10)}<small>{entry.occurred_at.slice(11, 16)} UTC</small></time>
                    <span className="player-thread-node" data-truth={entry.truth_state.toLowerCase()} aria-hidden="true"><i /></span>
                    <span className="player-history-copy"><strong>{HISTORY_LABELS[entry.kind]}</strong><small>{entryDetail(entry)}</small></span>
                    <TruthLabel truth={entry.truth_state} />
                    <span aria-hidden="true">→</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : <div className="player-empty player-empty--dark"><strong>NO HISTORY RECORDED</strong><p>The canonical PLAYER history projection contains no records.</p></div>}
          <footer><span>↑ ↓ HOME END TO INSPECT</span><span>CLAIMED ≠ OBSERVED ≠ PROVEN</span></footer>
        </section>
        <HistoryInspector entry={denied ? undefined : selected} />
      </div>
    </section>
  );
}

function EarnedEvidence({reputation, error}: {reputation?: PlayerReputationView; error?: unknown}) {
  const cheevos = reputation?.cheevos ?? [];
  return (
    <section className="player-earned" aria-labelledby="player-earned-heading">
      <header className="player-printed-head"><span>02 /</span><h2 id="player-earned-heading">EARNED, WITH EVIDENCE</h2><small>{reputation?.rule_version ?? 'NO REPUTATION PROJECTION'}</small></header>
      {error ? <ProjectionUnavailable label="REPUTATION" error={error} /> : reputation ? (
        <>
          <dl className="player-metrics" aria-label="Reputation metrics">
            <div><dt>SHIPS</dt><dd>{reputation.metrics.ships}</dd></div>
            <div><dt>SHIPPED ASSISTS</dt><dd>{reputation.metrics.shipped_assists}</dd></div>
            <div><dt>PROJECTS ASSISTED</dt><dd>{reputation.metrics.shipped_projects_assisted}</dd></div>
            <div><dt>EXTERNAL TESTS</dt><dd>{reputation.metrics.tested_shipped_projects}</dd></div>
          </dl>
          {cheevos.length ? <ul className="player-cheevos">{cheevos.map((cheevo) => <Cheevo key={`${cheevo.key}-${cheevo.earned_at}`} cheevo={cheevo} />)}</ul> : <div className="player-empty"><strong>NO EARNED RECOGNITION</strong><p>No versioned Cheevo rule has awarded evidence on this projection.</p></div>}
        </>
      ) : <div className="player-empty"><strong>CONNECTING REPUTATION</strong></div>}
    </section>
  );
}

function Cheevo({cheevo}: {cheevo: CheevoView}) {
  return <li><span className="player-cheevo-mark" aria-hidden="true">↗</span><div><small>CHEEVO / {cheevo.rule_version}</small><strong>{cheevo.label}</strong><p>{cheevo.description}</p><code>{cheevo.evidence.source_type}:{cheevo.evidence.source_id}</code></div><TruthLabel truth="PROVEN" /></li>;
}

function PlayerProjection({me, profile, profileError, history, historyError, reputation, reputationError}: {
  me: PrivatePlayer;
  profile?: PlayerProfileView;
  profileError?: unknown;
  history?: PlayerHistoryView;
  historyError?: unknown;
  reputation?: PlayerReputationView;
  reputationError?: unknown;
}) {
  const identity = (!profileError && profile?.character_name?.trim()) || me.display_name;
  return (
    <TerminalShell
      mode="PLAYER"
      kicker="REKT INK(CUBATOR) // LIVE PLAYER"
      title="Builder history."
      description="What was declared. What was observed. What was earned. Durable record, never universal XP."
      readout={[
        {label: 'PLAYER', value: me.player_id},
        {label: 'HISTORY', value: historyError ? 'UNAVAILABLE' : history ? String(history.entries.length) : 'CONNECTING'},
        {label: 'SHIPS', value: reputationError ? 'UNAVAILABLE' : reputation ? String(reputation.metrics.ships) : 'CONNECTING'},
      ]}
      eventStatus="PLAYER RECORD // CANONICAL PRIVATE HISTORY + PUBLIC RULE-DERIVED REPUTATION"
      workspaceClassName="player-workspace"
      footerItems={['GENERATED API CLIENT', 'NO FOLLOWER SCORE / NO UNIVERSAL XP', 'CLAIMED ≠ OBSERVED ≠ PROVEN']}
      className="player-live"
    >
      <section className="player-identity" aria-labelledby="player-identity-name">
        <div className="player-identity-copy"><small>PLAYER / THE DURABLE RECORD</small><h2 id="player-identity-name">{identity}</h2><p>{(!profileError && profile?.bio) || 'Builder identity. History and evidence remain separate from self-description.'}</p></div>
        <div className="player-capabilities">
          {profileError ? <ProjectionUnavailable label="PROFILE" error={profileError} /> : <><div><small>CAN HELP WITH</small><strong>{profile?.can_help_with.join(' / ') || 'UNDECLARED'}</strong></div><div><small>SKILLS NEEDED</small><strong>{profile?.skills_needed.join(' / ') || 'NONE DECLARED'}</strong></div>{profile?.character_archetype ? <div><small>ARCHETYPE</small><strong>{profile.character_archetype}</strong></div> : null}</>}
        </div>
      </section>
      <HistoryInstrument history={history} error={historyError} />
      <EarnedEvidence reputation={reputation} error={reputationError} />
    </TerminalShell>
  );
}

export default function LivePlayer({client = createInkubatorApiClient(), refetchIntervalMs = 5000}: LivePlayerProps) {
  const meQuery = useQuery({queryKey: meKey, queryFn: () => client.getMe(), refetchInterval: refetchIntervalMs, retry: 1});
  const profileQuery = useQuery({queryKey: profileKey, queryFn: () => client.getMyProfile(), refetchInterval: refetchIntervalMs, retry: false});
  const historyQuery = useQuery({queryKey: historyKey, queryFn: () => client.getMyHistory(), refetchInterval: refetchIntervalMs, retry: false});
  const playerId = meQuery.data?.player_id;
  const reputationQuery = useQuery({queryKey: reputationKey(playerId ?? 'pending'), queryFn: () => client.getPlayerReputation(playerId!), enabled: Boolean(playerId), refetchInterval: refetchIntervalMs, retry: false});

  if (meQuery.isPending) {
    return <TerminalShell mode="PLAYER" kicker="REKT INK(CUBATOR) // LIVE PLAYER" title="Builder history." description="Connecting canonical player identity." workspaceClassName="player-loading" className="player-live"><div><small>PLAYER RECORD</small><h2>CONNECTING PLAYER BUS</h2><p>Waiting for the canonical private player identity.</p></div></TerminalShell>;
  }

  if (meQuery.isError || !meQuery.data) {
    return <TerminalShell mode="PLAYER" kicker="REKT INK(CUBATOR) // LIVE PLAYER" title="Builder history." description="Canonical player identity unavailable." workspaceClassName="player-loading player-loading--error" className="player-live"><div role="alert"><small>PLAYER RECORD</small><h2>PLAYER LINK UNAVAILABLE</h2><p>{errorMessage(meQuery.error, 'player_projection_unavailable')}</p><p>No development fixture fallback is permitted.</p></div></TerminalShell>;
  }

  return <PlayerProjection me={meQuery.data} profile={profileQuery.data} profileError={profileQuery.error} history={historyQuery.data} historyError={historyQuery.error} reputation={reputationQuery.data} reputationError={reputationQuery.error} />;
}
