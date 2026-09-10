import type {AriaRole, ReactNode, Ref} from 'react';
import {INSTRUMENT_MODES, useInstrumentNavigation, type InstrumentMode} from './InstrumentNavigation';
import '../instrument-os/instrument-os.css';
import './terminal-shell.css';
import './terminal-shell-v2.css';
import './coherence-foundation-v0.css';
import './faceplate.css';

export {INSTRUMENT_MODES};
export type {InstrumentMode};

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
      data-motion={motion}
      data-motion-policy={motionPolicy}
      data-crt={crt}
      data-event-sequence={eventSequence}
    >
      <a className="faceplate-skip" href="#instrument-workspace">Skip to instrument</a>
      <div className="faceplate-topbar"><a className="faceplate-brand" href="?mode=command"><strong>REKT//</strong> INKUBATOR</a><span>{mode} / INSTRUMENT SERIES</span></div>

      <header className="ios-lab-header ios-shell-header">
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

      <section className="ios-shell-chassis">
        <nav className="ios-mode-rail ios-shell-mode-rail" aria-label="Instrument mode">
          <span className="ios-rail-label">MODE</span>
          {INSTRUMENT_MODES.map((item) => {
            const isEnabled = enabled.has(item);
            return (
              <button
                key={item}
                type="button"
                aria-pressed={item === mode}
                disabled={!isEnabled}
                data-mode={item.toLowerCase()}
                data-availability={isEnabled ? 'enabled' : 'pending'}
                onClick={() => isEnabled && effectiveSelect?.(item)}
              >
                <span>{item.slice(0, 1)}</span><b>{item}</b>
              </button>
            );
          })}
          <span className="ios-rail-tail">OS/02</span>
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
