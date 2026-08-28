export function mulberry32(seed){let a=seed>>>0;return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
export function hashStr(s){let h=7;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return h>>>0;}
export function evmAddr(seed){const r=mulberry32(hashStr(seed));let s='';for(let i=0;i<40;i++)s+=Math.floor(r()*16).toString(16);return `0x${s}`;}
export class SeqGate{
  constructor(window=64){this.expected=1;this.pending=new Map();this.window=window;this.stats={ok:0,dup:0,ooo:0,gap:0,snap:0};}
  ingest(ev,onApply){
    if(ev.type==='SNAPSHOT'){this.stats.snap++;onApply(ev);this.expected=ev.seq+1;this.pending.clear();return 'SNAPSHOT';}
    if(ev.seq===this.expected){this.stats.ok++;onApply(ev);this.expected++;
      while(this.pending.has(this.expected)){const p=this.pending.get(this.expected);this.pending.delete(this.expected);this.stats.ooo++;this.stats.ok++;onApply(p);this.expected++;}
      return 'OK';
    }
    if(ev.seq<this.expected){this.stats.dup++;return 'DUP';}
    this.pending.set(ev.seq,ev);
    if(this.pending.size>this.window){this.stats.gap++;this.pending.clear();return 'GAP';}
    return 'OOO';
  }
}
export function makeProducer(seed='REKT-INK'){
  let nextSeq=1,n=0;const queue=[];
  return {next(){
    if(queue.length)return queue.shift();
    const k=n++;
    const make=seq=>{const r=mulberry32(hashStr(`${seed}:${seq}`));return {seq,type:r()<0.52?'BUY':'SELL',side:r()<0.52?1:-1,qty:20+Math.floor(r()*4000)};};
    if(k>20&&k%149===0){const e=make(nextSeq++);queue.push({...e});return e;}
    if(k>0&&k%211===0){const a=make(nextSeq),b=make(nextSeq+1);nextSeq+=2;queue.push(a);return b;}
    if(k>0&&k%389===0){const e=make(nextSeq);nextSeq+=2;return e;}
    return make(nextSeq++);
  }};
}
