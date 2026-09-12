import type {AriaRole, ReactNode, Ref} from 'react';
import {INSTRUMENT_MODES, useInstrumentNavigation, type InstrumentMode} from './InstrumentNavigation';
import '../instrument-os/instrument-os.css';
import './terminal-shell.css';
import './terminal-shell-v2.css';
import './coherence-foundation-v0.css';
import './faceplate.css';
import './faceplate-a11y.css';
import './connection-context.css';
import './readability-v1.css';
import './view-mode.css';
import {ConnectionContextStrip} from './ConnectionContext';
import {useViewMode, ViewModeToggle} from './ViewMode';

export {INSTRUMENT_MODES};
export type {InstrumentMode};

const MODE_CUES: Record<InstrumentMode, string> = {
  WORLD: 'AROUND YOU',
  COMMAND: 'WHAT NOW?',
  PROJECT: 'THIS BUILD',
  PLAYER: 'YOUR RECORD',
  SHIP: 'PROVE IT',
};

export type TerminalReadout = {
  label: string;
  value: ReactNode;
};

export type TerminalShellProps = {
  mode: InstrumentMode;
  kicker: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  readout?: TerminalReadout[];
  eventStatus?: ReactNode;
  enabledModes?: InstrumentMode[];
  onModeSelect?: (mode: InstrumentMode) => void;
  children: ReactNode;
  workspaceClassName?: string;
  footerItems?: ReactNode[];
  className?: string;
  rootRef?: Ref<HTMLElement>;
  role?: AriaRole;
  motion?: string;
  motionPolicy?: 'full' | 'reduced';
  crt?: 'on' | 'off';
  eventSequence?: number;
};

export function TerminalShell({
  mode,
  kicker,
  title,
  description,
  readout = [],
  eventStatus,
  enabledModes,
  onModeSelect,
  children,
  workspaceClassName = '',
  footerItems = [],
  className = '',
  rootRef,
  role,
  motion,
  motionPolicy,
  crt = 'off',
  eventSequence,
}: TerminalShellProps) {
  const integratedNavigation = useInstrumentNavigation();
  const viewMode = useViewMode();
  const effectiveModes = enabledModes ?? integratedNavigation?.enabledModes ?? [mode];
  const effectiveSelect = onModeSelect ?? integratedNavigation?.onModeSelect;
  const enabled = new Set(effectiveModes);
  const shellVariant = 'v2';

  return (
    <main
      ref={rootRef}
      role={role}
      className={`ios-lab ios-shell ios-shell-v2 ${className}`.trim()}
      data-shell="terminal"
      data-shell-variant={shellVariant}
      data-mode={mode.toLowerCase()}
      data-view-mode={viewMode?.mode.toLowerCase() ?? 'advanced'}
      data-motion={motion}
      data-motion-policy={motionPolicy}
      data-crt={crt}
      data-event-sequence={eventSequence}
    >
      <a className="faceplate-skip" href="#instrument-workspace">Skip to instrument</a>
      <div className="faceplate-topbar">
        <a className="faceplate-brand" href="?mode=command"><strong>REKT<i>//</i></strong><span className="faceplate-brand-label">INKUBATOR</span></a>
        <span className="faceplate-purpose">TECHNICAL FACEPLATE / LIVE PRODUCT</span>
        <span className="faceplate-series">{mode} / INSTRUMENT SERIES</span>
        <ViewModeToggle />
        <span className="faceplate-registration" aria-hidden="true" />
      </div>

      <header className="ios-lab-header ios-shell-header">
        <span className="faceplate-head-reg" aria-hidden="true" />
        <div>
          <small>{kicker}</small>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {readout.length > 0 ? (
          <div className="ios-shell-readout" aria-label="Mode readout">
            {readout.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <b>{item.value}</b>
              </div>
            ))}
          </div>
        ) : null}
      </header>

      {eventStatus ? <div className="ios-event-status ios-shell-event" aria-live="polite">{eventStatus}</div> : null}
      <ConnectionContextStrip />

      <section className="ios-shell-chassis">
        <nav className="ios-mode-rail ios-shell-mode-rail" aria-label="Instrument mode">
          <span className="ios-rail-label">MODE / SELECT</span>
          {INSTRUMENT_MODES.map((item, index) => {
            const isEnabled = enabled.has(item);
            const isCurrent = item === mode;
            return (
              <button
                key={item}
                type="button"
                aria-pressed={isCurrent}
                disabled={!isEnabled}
                data-mode={item.toLowerCase()}
                data-availability={isEnabled ? 'enabled' : 'pending'}
                onClick={() => isEnabled && effectiveSelect?.(item)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <b>{item}</b>
                <small>{MODE_CUES[item]} · {isCurrent ? 'CURRENT' : isEnabled ? 'AVAILABLE' : 'PENDING'}</small>
              </button>
            );
          })}
          <span className="ios-rail-tail">OS/02 · RKT-01</span>
          <div className="faceplate-rail-imprint" aria-hidden="true">
            <span className="faceplate-reg" />
            <p>SAME DEGENS.<br /><b>HIGHER PURPOSE.</b></p>
            <small>REKT / INKUBATOR / UNIT 01</small>
          </div>
        </nav>

        <section id="instrument-workspace" tabIndex={-1} className={`ios-shell-workspace ${workspaceClassName}`.trim()} aria-label={`${mode} workspace`}>
          {children}
        </section>
      </section>

      {footerItems.length > 0 ? (
        <footer className="ios-lab-footer ios-shell-footer">
          {footerItems.map((item, index) => <span key={index}>{item}</span>)}
        </footer>
      ) : null}
    </main>
  );
}
