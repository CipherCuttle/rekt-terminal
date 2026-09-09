import type {ReactNode} from 'react';

export function PrintedHeader({number, title, detail}: {number: string; title: string; detail?: string}) {
  return <header className="iv2-printed-header"><span className="iv2-micro">{number} /</span><h2>{title}</h2>{detail && <span className="iv2-micro">{detail}</span>}</header>;
}

export function DisplayWell({children, className = '', label}: {children: ReactNode; className?: string; label: string}) {
  return <section className={`iv2-display ${className}`} aria-label={label}>{children}<i className="iv2-fastener" aria-hidden="true" /></section>;
}

export type RecordTruth = 'CLAIMED' | 'OBSERVED' | 'PROVEN' | 'CONNECTED' | 'SUBMITTED';
export function TruthLabel({truth}: {truth: RecordTruth}) {
  return <span className="iv2-truth" data-truth={truth}><i aria-hidden="true" />{truth}</span>;
}
