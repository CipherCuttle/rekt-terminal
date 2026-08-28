export type ProvenanceState='CONFIRMED'|'DERIVED'|'ESTIMATED'|'STALE'|'UNAVAILABLE';
export type Provenance={state:ProvenanceState;source:string;asOf:string;block?:number;method:string};
export type RadarAsset={id:string;symbol:string;name:string;chainId:57073;quote:string;venue:string;pairAddress:string;tokenAddress:string;verified:boolean;priceEth:number|null;priceUsd:number|null;change5m:number|null;change1h:number|null;change6h:number|null;buys:number|null;sells:number|null;buyers:number|null;volume24hUsd:number|null;liquidityUsd:number|null;fdvUsd:number|null;ageMinutes:number|null;heat:number|null;freshness:ProvenanceState;imageUrl?:string;provenance:Provenance};
export type Bar={time:number;open:number;high:number;low:number;close:number;volume:number};
export type WalletTrace={address:string;classifier:string;confidence:number|null;visibleValueUsd:number|null;eth:number|null;addressAgeDays:number|null;rektHeld:number|null;rektBought30d:number|null;rektSold30d:number|null;medianHold:string|null;longestHold:string|null;reasons:string[];provenance:Provenance};
export type StreamEnvelope={type:string;seq:number;serverTime:number;payload:any};
