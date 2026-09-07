import {ArrowUpRight, CircleHelp, ExternalLink, RadioTower} from 'lucide-react';
import type {ReactNode} from 'react';
import {InkButton, InkDialog, InkSignal, InkTooltip, type InkSignalState} from './primitives';
import styles from './SignalSystem.module.css';

export function MissionHeader({
  eyebrow = 'CURRENT MISSION',
  title,
  goal,
  state,
  children,
}: {
  eyebrow?: string;
  title: string;
  goal: string;
  state: InkSignalState;
  children?: ReactNode;
}) {
  return (
    <header className={styles.missionHeader}>
      <span className={styles.kicker}>{eyebrow}</span>
      <h1 className={styles.missionTitle}>{title}</h1>
      <p className={styles.missionGoal}>{goal}</p>
      <div className={styles.missionActions}>
        <InkSignal state={state} />
        {children}
      </div>
    </header>
  );
}

export function NextMove({index = '01', title, detail, action = 'DO THE THING'}: {index?: string; title: string; detail: string; action?: string}) {
  return (
    <section className={styles.nextMove} aria-labelledby={`next-move-${index}`}>
      <span className={styles.nextMoveIndex}>{index}</span>
      <div><strong id={`next-move-${index}`}>{title}</strong><p>{detail}</p></div>
      <InkButton tone="primary">{action}</InkButton>
    </section>
  );
}

export function EvidenceRow({label, detail, state, source}: {label: string; detail: string; state: InkSignalState; source?: string}) {
  return (
    <div className={styles.evidenceRow}>
      <span className={styles.evidenceLabel}>{label}</span>
      <span className={styles.evidenceDetail}>{detail}</span>
      <InkSignal state={state} source={source} />
    </div>
  );
}

export function ProvenanceHelp() {
  return (
    <InkTooltip label="OBSERVED means a trusted adapter reported the event. It does not automatically mean the Mission requirement is proven.">
      <CircleHelp size={16} aria-hidden="true" />
    </InkTooltip>
  );
}

export function ObservationDialog() {
  return (
    <InkDialog
      trigger={<span style={{display: 'inline-flex', alignItems: 'center', gap: 7}}><RadioTower size={15} /> VIEW PROVENANCE</span>}
      title="OBSERVATION PROVENANCE"
      description="Human-readable state stays first. Technical provenance is available when you need to inspect where the Signal came from."
    >
      <div style={{display: 'grid', gap: 10, marginBottom: 18}}>
        <EvidenceRow label="SOURCE" detail="GitHub App / signed push delivery" state="OBSERVED" source="GITHUB" />
        <EvidenceRow label="PRIVACY" detail="Private source identity is not projected publicly" state="PROVEN" source="POLICY" />
      </div>
    </InkDialog>
  );
}

export function ExternalArtifactLink({label = 'OPEN ARTIFACT'}: {label?: string}) {
  return <InkButton><span style={{display: 'inline-flex', alignItems: 'center', gap: 7}}>{label}<ExternalLink size={14} /></span></InkButton>;
}

export function TinyOutbound({children}: {children: ReactNode}) {
  return <span style={{display: 'inline-flex', alignItems: 'center', gap: 5}}>{children}<ArrowUpRight size={13} aria-hidden="true" /></span>;
}
