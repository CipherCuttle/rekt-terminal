import {Activity, GitBranch, ShieldCheck, Users} from 'lucide-react';
import {useMemo} from 'react';
import './tokens.css';
import styles from './SignalSystem.module.css';
import {evidence, fixtureAcceptedShip, fixtureEvents, fixtureMission, fixtureThread, worldSignals} from './fixtures';
import {
  InkBeacon,
  InkButton,
  InkEvent,
  InkFrame,
  InkMetaStrip,
  InkPortrait,
  InkSignal,
  InkTabs,
  InkThread,
} from './primitives';
import {EvidenceRow, ExternalArtifactLink, MissionHeader, NextMove, ObservationDialog, ProvenanceHelp} from './patterns';

export type GoldenScreen = 'world' | 'command' | 'project' | 'player' | 'ship';

const screens: Array<{id: GoldenScreen; label: string}> = [
  {id: 'world', label: 'WORLD'},
  {id: 'command', label: 'COMMAND'},
  {id: 'project', label: 'PROJECT'},
  {id: 'player', label: 'PLAYER'},
  {id: 'ship', label: 'SHIP'},
];

function screenFromLocation(): GoldenScreen {
  const requested = new URLSearchParams(window.location.search).get('screen')?.toLowerCase();
  return screens.some((screen) => screen.id === requested) ? requested as GoldenScreen : 'command';
}

function Shell({screen, mode, children}: {screen: GoldenScreen; mode: 'broadcast' | 'cockpit' | 'artifact'; children: React.ReactNode}) {
  return (
    <div className={styles.root} data-ink-mode={mode}>
      <div className={`${styles.shell} ${mode === 'broadcast' ? styles.broadcastShell : ''} ${mode === 'artifact' ? styles.artifactShell : ''}`}>
        <nav className={styles.nav} aria-label="Golden screen navigation">
          <div className={styles.brand}><i className={styles.brandMark} aria-hidden="true" /><span>REKT / INK(CUBATOR)</span></div>
          <div className={styles.navLinks}>
            {screens.map((item) => (
              <a
                key={item.id}
                className={`${styles.navLink} ${item.id === screen ? styles.navLinkActive : ''}`}
                href={`?lab=signals&screen=${item.id}`}
                aria-current={item.id === screen ? 'page' : undefined}
              >
                {item.label}
              </a>
            ))}
          </div>
          <span className={styles.navMeta}>{screen === 'world' ? 'BROADCAST / DEVELOPMENT FIXTURE' : `${mode.toUpperCase()} / SIGNAL SYSTEM V0`}</span>
        </nav>
        <main className={`${styles.page} ${screen === 'world' ? styles.world : ''} ${screen === 'ship' ? styles.ship : ''}`}>
          {children}
        </main>
      </div>
    </div>
  );
}

function WorldScreen() {
  return (
    <Shell screen="world" mode="broadcast">
      <section className={styles.worldHero}>
        <div>
          <span className={styles.kicker}>ROUND 01 / DEVELOPMENT FIXTURE</span>
          <h1>BUILD SOMETHING WEIRD. SHIP IT.</h1>
          <p>This is not a feed of clicks. It is a broadcast of meaningful builder state: what is moving, what needs help, and what actually crossed a proof boundary.</p>
          <div className={styles.missionActions}>
            <InkButton tone="primary">DECLARE A MISSION</InkButton>
            <InkButton>SEE WHAT NEEDS HELP</InkButton>
          </div>
        </div>
        <div className={styles.worldSignalRail} aria-label="World signals">
          <span className={styles.kicker}>FIXTURE SIGNALS / NOT LIVE DATA</span>
          {worldSignals.map((signal) => (
            <div className={styles.worldPulse} key={signal.name}>
              <InkSignal state={signal.state} />
              <div><strong>{signal.name}</strong><span>{signal.detail}</span></div>
            </div>
          ))}
        </div>
      </section>
      <InkMetaStrip items={[
        {label: 'BUILDERS ACTIVE', value: '08'},
        {label: 'HELP BEACONS', value: '03'},
        {label: 'SHIPS THIS ROUND', value: '05'},
        {label: 'CURRENT SIGNAL', value: 'EXTERNAL TESTING'},
      ]} />
      <div className={styles.worldGrid}>
        <InkFrame label="WHAT IS MOVING" meta={<InkSignal state="ACTIVE" />}>
          <InkEvent title="Ghost Key entered external test" body="One builder outside the Party is testing the critical path." time="NOW" kind="signal" />
          <InkEvent title="Tiny God received proof" body="A versioned rule accepted the current artifact evidence." time="08M" kind="signal" />
        </InkFrame>
        <InkFrame label="NEEDS HELP" meta="03 OPEN">
          <InkBeacon title="BREAK THIS ON MOBILE" body="Mica needs a hostile tester before Ship preparation." action="I CAN TEST" />
        </InkFrame>
        <InkFrame label="LATEST SHIP" meta={<InkSignal state="PROVEN" />} artifact>
          <div style={{display: 'grid', minHeight: 170, alignContent: 'space-between', gap: 24}}>
            <div><span className={styles.kicker}>NOISEWAVE / TINY GOD</span><h2 style={{fontSize: 'clamp(1.8rem,3vw,3.2rem)', margin: '12px 0', lineHeight: .96}}>A TINY GAME THAT ACTUALLY RUNS.</h2></div>
            <ExternalArtifactLink />
          </div>
        </InkFrame>
      </div>
    </Shell>
  );
}

function CommandScreen() {
  return (
    <Shell screen="command" mode="cockpit">
      <div className={styles.content}>
        <div className={styles.commandGrid}>
          <section className={styles.commandMain}>
            <InkFrame label="MISSION / CURRENT" meta="ROUND 01">
              <div className={styles.commandMission}>
                <MissionHeader title={fixtureMission.title} goal={fixtureMission.goal} state="ACTIVE">
                  <InkButton>EDIT FOCUS</InkButton>
                </MissionHeader>
              </div>
              <InkMetaStrip items={[
                {label: 'SHIP CONDITION', value: 'PUBLIC ARTIFACT + EXTERNAL TEST'},
                {label: 'CURRENT FOCUS', value: 'EXTERNAL TEST'},
                {label: 'SOURCE', value: 'PRIVATE'},
              ]} />
            </InkFrame>
            <NextMove title={fixtureMission.nextMove} detail="One outside builder. One critical path. Do not add features while this is unresolved." action="OPEN TEST REQUEST" />
            <InkFrame label="THE THREAD" meta={<InkSignal state="ATTENTION" label="1 GATE NEEDS ACTION" />}>
              <div className={styles.commandThread}><InkThread items={fixtureThread} /></div>
            </InkFrame>
          </section>
          <aside className={styles.commandSide}>
            <InkFrame label="BLOCKER" attention meta={<InkSignal state="BLOCKED" />}>
              <strong>{fixtureMission.blocker}</strong>
              <p style={{color: 'var(--ink-text-secondary)', lineHeight: 1.55}}>The build can continue, but Ship readiness cannot advance until the external test is recorded.</p>
            </InkFrame>
            <InkFrame label="HELP / PARTY" meta="3 MEMBERS">
              <InkBeacon title="HOSTILE MOBILE TEST" body="Need someone who did not build this flow." action="COPY BEACON" />
              <div style={{display: 'flex', gap: 10, marginTop: 18}} aria-label="Party members">
                <InkPortrait initials="CC" label="CipherCuttle" size={54} />
                <InkPortrait initials="HS" label="Honeyslop" size={54} />
                <InkPortrait initials="M?" label="Open Party slot" size={54} />
              </div>
            </InkFrame>
            <InkFrame label="MEANINGFUL ACTIVITY" meta={<Activity size={14} />}>
              {fixtureEvents.map((event) => <InkEvent key={event.title} {...event} />)}
            </InkFrame>
            <InkFrame label="EVIDENCE" meta={<span style={{display: 'inline-flex', gap: 6, alignItems: 'center'}}>SOURCE STATE <ProvenanceHelp /></span>}>
              {evidence.map((item) => <EvidenceRow key={item.label} {...item} />)}
              <div style={{marginTop: 16}}><ObservationDialog /></div>
            </InkFrame>
          </aside>
        </div>
      </div>
    </Shell>
  );
}

function ProjectScreen() {
  return (
    <Shell screen="project" mode="cockpit">
      <section className={styles.projectHero}>
        <div className={styles.projectArtifact}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span className={styles.kicker}>PROJECT / REKT MACHINE</span>
            <InkSignal state="OBSERVED" source="GITHUB" />
          </div>
          <div className={styles.projectArtifactMark}>BUILD<br />→SHIP</div>
          <span style={{color: 'var(--ink-text-meta)', font: '600 var(--ink-size-meta)/1 var(--ink-font-signal)'}}>PRIVATE SOURCE / PUBLIC SAFE PROJECTION</span>
        </div>
        <div className={styles.projectAside}>
          <InkSignal state="ACTIVE" />
          <h1>REKT MACHINE</h1>
          <p style={{color: 'var(--ink-text-secondary)', lineHeight: 1.6}}>A persistent Project can outlive this Mission. The current Mission is the specific commitment to ship a testable outcome.</p>
          <InkMetaStrip items={[
            {label: 'MISSION', value: 'SHIP THE WEIRD LITTLE THING'},
            {label: 'STACK', value: 'REACT / FASTIFY / POSTGRES'},
          ]} />
        </div>
      </section>
      <div className={styles.projectBody}>
        <InkFrame label="PROJECT STATE" meta={<GitBranch size={14} />}>
          <InkTabs defaultValue="thread" items={[
            {value: 'thread', label: 'THREAD', content: <InkThread items={fixtureThread} />},
            {value: 'evidence', label: 'EVIDENCE', content: <div>{evidence.map((item) => <EvidenceRow key={item.label} {...item} />)}</div>},
            {value: 'activity', label: 'ACTIVITY', content: <div>{fixtureEvents.map((event) => <InkEvent key={event.title} {...event} />}</div>},
          ]} />
        </InkFrame>
        <div style={{display: 'grid', gap: 20}}>
          <InkFrame label="NEXT MOVE"><NextMove index="N" title="Get the external test result" detail="Do not promote OBSERVED repository activity into proof of usability." action="REQUEST TEST" /></InkFrame>
          <InkFrame label="HELP BEACON"><InkBeacon title="WHO CAN BREAK THE MOBILE FLOW?" body="Need one person with no project context." /></InkFrame>
        </div>
      </div>
    </Shell>
  );
}

function PlayerScreen() {
  return (
    <Shell screen="player" mode="cockpit">
      <section className={styles.playerHero}>
        <InkPortrait initials="CC" label="CipherCuttle portrait" size={190} />
        <div>
          <span className={styles.kicker}>PLAYER / BUILDER</span>
          <h1>CIPHERCUTTLE</h1>
          <p>Current Mission first. Ship history and useful contribution form the story; follower count and universal XP do not.</p>
          <div className={styles.missionActions}><InkSignal state="ACTIVE" label="BUILDING" /><InkButton>WATCH PROJECT</InkButton></div>
        </div>
        <div className={styles.playerStat}><strong>03</strong><span>ACCEPTED SHIPS</span><br /><br /><strong>07</strong><span>ACCEPTED ASSISTS</span></div>
      </section>
      <div className={styles.playerBody}>
        <div style={{display: 'grid', gap: 20}}>
          <InkFrame label="CURRENT MISSION" meta={<InkSignal state="ACTIVE" />}>
            <MissionHeader eyebrow="NOW BUILDING" title={fixtureMission.title} goal={fixtureMission.currentFocus} state="ACTIVE" />
          </InkFrame>
          <InkFrame label="CAREER THREAD" meta="OUTCOMES / HELP">
            <InkThread items={[
              {title: 'REKT MACHINE', detail: 'Current Mission · external test next', state: 'ACTIVE'},
              {title: 'INKFIGHTER PROTOTYPE', detail: 'Accepted Ship Receipt · Round 00', state: 'PROVEN'},
              {title: 'ASSIST / KRAKMASK TOOL', detail: 'Debug assist accepted by Project owner', state: 'PROVEN'},
              {title: 'DEAD TERMINAL', detail: 'Closed without Ship · retained as history', state: 'STALE'},
            ]} />
          </InkFrame>
        </div>
        <div style={{display: 'grid', gap: 20}}>
          <InkFrame label="HELP HISTORY" meta={<Users size={14} />}>
            <InkEvent title="ACTUALLY HELPFUL" body="Accepted debug Assist on Krakmask Tool." time="R00" kind="help" />
            <InkEvent title="EXTERNAL TEST" body="Tested another builder's critical flow." time="R00" kind="help" />
          </InkFrame>
          <InkFrame label="EARNED TRAITS" meta="RULE-BASED">
            <div style={{display: 'grid', gap: 14}}>
              <InkSignal state="PROVEN" label="WORKING URL OR GTFO" source="SHIP RULE V1" />
              <InkSignal state="PROVEN" label="ACTUALLY HELPFUL" source="ASSIST RULE V1" />
              <InkSignal state="UNKNOWN" label="TOUCH GRASS" source="EXTERNAL TEST" />
            </div>
          </InkFrame>
        </div>
      </div>
    </Shell>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}

function ShipScreen() {
  const ship = fixtureAcceptedShip;
  const party = ship.builders.filter((builder) => builder.role === 'PARTY');
  return (
    <Shell screen="ship" mode="artifact">
      <section className={styles.shipArtifact} aria-label="Accepted shipped artifact">
        <div className={styles.shipWindow}>
          <span className={styles.kicker}>ARTIFACT / DEVELOPMENT FIXTURE</span>
          <strong>{ship.artifact.title}</strong>
          <a href={ship.artifact.url} target="_blank" rel="noreferrer">OPEN THE THING ↗</a>
        </div>
      </section>
      <aside className={styles.shipReceipt}>
        <span className={styles.kicker}>SHIP / ACCEPTED ARTIFACT / DEVELOPMENT FIXTURE</span>
        <InkSignal state="PROVEN" label="SHIP ACCEPTED" source="SHIP RULE V1" />
        <h1>{ship.artifact.title} / ROUND 01</h1>
        <p>The artifact dominates. The PROVEN state belongs to the accepted Ship fact; Party and Assist attribution remain historical credits from their own bounded source state.</p>
        <div className={styles.receiptId}>{ship.receipt_id}<br />receipt: {ship.receipt_schema_version}<br />rule: {ship.acceptance_rule_version}<br />evidence ceiling: {ship.truth_state}</div>
        <InkFrame label="ACCEPTANCE CHAIN" artifact>
          <EvidenceRow label="PUBLIC ARTIFACT" detail="Reachable bounded target" state="OBSERVED" source="VERIFIER" />
          <EvidenceRow label="TRUSTED REVIEW" detail="Bounded human review recorded" state="OBSERVED" source="HUMAN" />
          <EvidenceRow label="SHIP RULE" detail="Required observations satisfied deterministic server rule" state="PROVEN" source="INKUBATOR" />
        </InkFrame>
        <InkFrame label="BUILDERS / SHIP-TIME SNAPSHOT" meta={`${ship.builders.length} CREDITED`} artifact>
          <div style={{display: 'flex', gap: 10, flexWrap: 'wrap'}} aria-label="Ship builders">
            {ship.builders.map((builder) => <InkPortrait key={builder.player_id} initials={initials(builder.display_name)} label={`${builder.display_name} · ${builder.role}`} size={54} />)}
          </div>
          {ship.assists.map((assist) => <InkEvent key={assist.assist_id} title={`ASSIST / ${assist.display_name}`} body="Accepted before Ship and preserved in the immutable Ship-time attribution snapshot." time="SHIP" kind="help" />)}
        </InkFrame>
        <InkMetaStrip items={[
          {label: 'OWNER', value: ship.builders.find((builder) => builder.role === 'OWNER')?.display_name ?? ship.owner_player_id},
          {label: 'PARTY', value: String(party.length).padStart(2, '0')},
          {label: 'ASSISTS', value: String(ship.assists.length).padStart(2, '0')},
          {label: 'ROUND', value: '01'},
        ]} />
        <div className={styles.missionActions}><InkButton tone="proof"><span style={{display: 'inline-flex', gap: 7, alignItems: 'center'}}><ShieldCheck size={15} /> RECEIPT {ship.receipt_id.slice(0, 8).toUpperCase()}</span></InkButton><a href={ship.artifact.url} target="_blank" rel="noreferrer">OPEN ARTIFACT ↗</a></div>
      </aside>
    </Shell>
  );
}

const screenComponents: Record<GoldenScreen, () => JSX.Element> = {
  world: WorldScreen,
  command: CommandScreen,
  project: ProjectScreen,
  player: PlayerScreen,
  ship: ShipScreen,
};

export default function GoldenScreens({screen}: {screen?: GoldenScreen}) {
  const resolved = useMemo(() => screen ?? screenFromLocation(), [screen]);
  const Screen = screenComponents[resolved];
  return <Screen />;
}
