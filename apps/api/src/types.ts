export type ProvenanceState='CONFIRMED'|'DERIVED'|'ESTIMATED'|'STALE'|'UNAVAILABLE';
export interface Provenance {state:ProvenanceState;source:string;asOf:string;block?:number;method:string}
export interface RadarAsset {id:string;symbol:string;name:string;chainId:57073;quote:string;venue:string;pairAddress:string;tokenAddress:string;verified:boolean;priceEth:number|null;priceUsd:number|null;change5m:number|null;change1h:number|null;change6h:number|null;buys:number|null;sells:number|null;buyers:number|null;volume24hUsd:number|null;liquidityUsd:number|null;fdvUsd:number|null;ageMinutes:number|null;heat:number|null;freshness:ProvenanceState;imageUrl?:string;provenance:Provenance}
export interface StreamEnvelope {type:string;seq:number;serverTime:number;payload:Record<string,unknown>}
