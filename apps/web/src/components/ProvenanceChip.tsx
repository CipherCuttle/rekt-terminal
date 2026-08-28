import type{Provenance}from'../types/api';
export function ProvenanceChip({p}:{p:Provenance}){const cls=p.state==='CONFIRMED'?'ok':p.state==='STALE'?'warn':p.state==='UNAVAILABLE'?'na':p.state==='ESTIMATED'?'est':'drv';return <span className={`prov ${cls}`} title={`${p.source} · ${p.asOf} · ${p.method}${p.block?` · block ${p.block}`:''}`}>{p.state}</span>}
