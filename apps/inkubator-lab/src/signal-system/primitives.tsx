import {Button} from '@base-ui/react/button';
import {Dialog} from '@base-ui/react/dialog';
import {Tabs} from '@base-ui/react/tabs';
import {Tooltip} from '@base-ui/react/tooltip';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Circle,
  CircleDot,
  Clock3,
  GitCommitHorizontal,
  HelpCircle,
  Radio,
  ShieldCheck,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type {ReactNode} from 'react';
import styles from './SignalSystem.module.css';

export type InkSignalState =
  | 'UNKNOWN'
  | 'CLAIMED'
  | 'ACTIVE'
  | 'OBSERVED'
  | 'PROVEN'
  | 'ATTENTION'
  | 'BLOCKED'
  | 'STALE'
  | 'FAILED';

const signalIcons: Record<InkSignalState, LucideIcon> = {
  UNKNOWN: Circle,
  CLAIMED: CircleDot,
  ACTIVE: Zap,
  OBSERVED: Radio,
  PROVEN: ShieldCheck,
  ATTENTION: AlertTriangle,
  BLOCKED: XCircle,
  STALE: Clock3,
  FAILED: XCircle,
};

export function InkButton({
  children,
  tone = 'standard',
  disabled = false,
  onClick,
  type = 'button',
}: {
  children: ReactNode;
  tone?: 'standard' | 'primary' | 'proof' | 'danger';
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  const style = tone === 'primary' ? {color: 'var(--ink-text-inverse)'} : undefined;
  return <Button className={styles.button} data-tone={tone} disabled={disabled} onClick={onClick} style={style} type={type}>{children}</Button>;
}

export function InkIconButton({label, children, disabled = false, onClick}: {label: string; children: ReactNode; disabled?: boolean; onClick?: () => void}) {
  return <Button className={styles.iconButton} aria-label={label} disabled={disabled} onClick={onClick}>{children}</Button>;
}

export function InkFrame({
  label,
  meta,
  children,
  attention = false,
  artifact = false,
  className = '',
}: {
  label: string;
  meta?: ReactNode;
  children: ReactNode;
  attention?: boolean;
  artifact?: boolean;
  className?: string;
}) {
  return (
    <section className={`${styles.frame} ${className}`} data-attention={attention || undefined} data-artifact={artifact || undefined}>
      <header className={styles.frameHeader}><span>{label}</span>{meta ? <span>{meta}</span> : null}</header>
      <div className={styles.frameBody}>{children}</div>
    </section>
  );
}

export function InkSignal({state, source, label}: {state: InkSignalState; source?: string; label?: string}) {
  const Icon = signalIcons[state];
  return (
    <span className={styles.signal} data-ink-signal={state} aria-label={`${label ?? state}${source ? `, source ${source}` : ''}`}>
      <span className={styles.signalGlyph} aria-hidden="true"><Icon size={13} strokeWidth={state === 'PROVEN' ? 2.7 : 1.8} /></span>
      <span>{label ?? state}</span>
      {source ? <span className={styles.signalSource}>/ {source}</span> : null}
    </span>
  );
}

export function InkMetaStrip({items}: {items: Array<{label: string; value: ReactNode}>}) {
  return <div className={styles.metaStrip}>{items.map((item) => <span className={styles.metaItem} key={item.label}>{item.label} <b>{item.value}</b></span>)}</div>;
}

export function InkPortrait({initials, label, size = 120}: {initials: string; label: string; size?: number}) {
  return <div className={styles.portrait} role="img" aria-label={label} style={{width: size, height: Math.round(size * 1.18)}}><span className={styles.portraitInitials}>{initials}</span></div>;
}

export function InkThread({items}: {items: Array<{title: string; detail: string; state: InkSignalState}>}) {
  return (
    <div className={styles.thread} aria-label="Mission thread">
      {items.map((item) => (
        <div className={styles.threadItem} data-ink-signal={item.state} key={`${item.title}-${item.state}`}>
          <span className={styles.threadRail} aria-hidden="true"><i className={styles.threadNode} /></span>
          <span className={styles.threadCopy}><strong>{item.title}</strong><span>{item.detail}</span></span>
          <span className={styles.threadState}><InkSignal state={item.state} /></span>
        </div>
      ))}
    </div>
  );
}

export function InkEvent({title, body, time, kind = 'commit'}: {title: string; body: string; time: string; kind?: 'commit' | 'signal' | 'help'}) {
  const Icon = kind === 'commit' ? GitCommitHorizontal : kind === 'help' ? HelpCircle : Radio;
  return (
    <article className={styles.event}>
      <span className={styles.eventIcon} aria-hidden="true"><Icon size={17} /></span>
      <div><strong>{title}</strong><p>{body}</p></div>
      <time>{time}</time>
    </article>
  );
}

export function InkBeacon({title, body, action = 'OFFER ASSIST'}: {title: string; body: string; action?: string}) {
  return (
    <div className={styles.beacon}>
      <span className={styles.beaconIcon} aria-hidden="true"><HelpCircle size={21} /></span>
      <div><strong>{title}</strong><p>{body}</p></div>
      <InkButton>{action}</InkButton>
    </div>
  );
}

export function InkTabs({
  defaultValue,
  items,
}: {
  defaultValue: string;
  items: Array<{value: string; label: string; content: ReactNode}>;
}) {
  return (
    <Tabs.Root className={styles.tabsRoot} defaultValue={defaultValue}>
      <Tabs.List className={styles.tabsList}>
        {items.map((item) => <Tabs.Tab key={item.value} className={styles.tab} value={item.value}>{item.label}</Tabs.Tab>)}
        <Tabs.Indicator className={styles.tabIndicator} />
      </Tabs.List>
      {items.map((item) => <Tabs.Panel key={item.value} className={styles.tabPanel} value={item.value}>{item.content}</Tabs.Panel>)}
    </Tabs.Root>
  );
}

export function InkDialog({trigger, title, description, children}: {trigger: ReactNode; title: string; description: string; children?: ReactNode}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className={styles.button}>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.dialogBackdrop} />
        <Dialog.Popup className={styles.dialogPopup}>
          <Dialog.Title className={styles.dialogTitle}>{title}</Dialog.Title>
          <Dialog.Description className={styles.dialogDescription}>{description}</Dialog.Description>
          {children}
          <div className={styles.dialogActions}><Dialog.Close className={styles.dialogClose}>CLOSE</Dialog.Close></div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function InkTooltip({label, children}: {label: string; children: ReactNode}) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger className={styles.tooltipTrigger} aria-label={label}>{children}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={8}>
            <Tooltip.Popup className={styles.tooltipPopup}>{label}</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

export function InkInlineAction({children}: {children: ReactNode}) {
  return <span aria-hidden="true" style={{display: 'inline-flex', alignItems: 'center', gap: 6}}>{children}<ArrowRight size={14} /></span>;
}

export function InkProofMark({label = 'PROVEN'}: {label?: string}) {
  return <InkSignal state="PROVEN" label={label} />;
}

export function InkCheck({label}: {label: string}) {
  return <span style={{display: 'inline-flex', gap: 6, alignItems: 'center'}}><Check size={14} aria-hidden="true" />{label}</span>;
}
