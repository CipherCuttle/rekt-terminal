import { useEffect, useMemo, useRef, useState } from 'react';
import { api, streamUrl } from './lib/api';
import { localEvent } from './lib/local-fixtures';
import type { RadarAsset, StreamEnvelope, WalletTrace } from './types/api';
import { GrainField, type Quality } from './effects/GrainField';
import { MarketChart } from './lib/chart';
import { ProvenanceChip } from './components/ProvenanceChip';

const money=(n:number|null)=>n==null?'—':n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1e3?`$${(n/1e3).toFixed(1)}K`:`$${n.toFixed(2)}`;
const pct=(n:number|null)=>n==null?'—':`${n>=0?'+':''}${n.toFixed(1)}%`;
const eth=(n:number|null)=>n==null?'—':n>=1?n.toFixed(4):n.toFixed(7);
const age=(m:number|null)=>m==null?'—':m<60?`${Math.round(m)}m`:m<1440?`${Math.floor(m/60)}h`:`${Math.floor(m/1440)}d`;
const short=(a:string)=>a&&a.startsWith('0x')?`${a.slice(0,6)}…${a.slice(-4)}`:a;

function useReduced(){
  const [q,setQ]=useState(matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)'),f=()=>setQ(m.matches);m.addEventListener('change',f);return()=>m.removeEventListener('change',f)},[]);
  return [q,setQ] as const;
}
function usePerf(){
  const [p,setP]=useState({fps:60,p95:16.7,tier:'ULTRA' as Quality});
  useEffect(()=>{let raf=0,last=performance.now(),arr:number[]=[],frames=0,at=last,tier:Quality='ULTRA',bad=0,good=0;const tiers:Quality[]=['ULTRA','HIGH','LOW','TERMINAL'];
    const loop=(t:number)=>{raf=requestAnimationFrame(loop);const d=t-last;last=t;if(d<500)arr.push(d);if(arr.length>600)arr.shift();frames++;if(t-at>1000){const s=[...arr].sort((a,b)=>a-b),p95=s[Math.min(s.length-1,Math.floor(s.length*.95))]||16.7,fps=frames;frames=0;at=t;if(p95>18){bad++;good=0}else if(p95<12){good++;bad=0}else{bad=good=0}let i=tiers.indexOf(tier);if(bad>=3&&i<3){tier=tiers[++i];bad=0}else if(good>=12&&i>0){tier=tiers[--i];good=0}setP({fps,p95,tier})}};
    raf=requestAnimationFrame(loop);return()=>cancelAnimationFrame(raf)},[]);
  return p;
}

export default function App(){
  const [mode,setMode]=useState<'fixture'|'live'>('fixture');
  const [scenario,setScenario]=useState('NORMAL');
  const [items,setItems]=useState<RadarAsset[]>([]);
  const [selected,setSelected]=useState<RadarAsset|null>(null);
  const [screen,setScreen]=useState<'radar'|'terminal'|'nft'>('radar');
  const [wallet,setWallet]=useState<WalletTrace|null>(null);
  const [query,setQuery]=useState('');
  const [status,setStatus]=useState<any>(null);
  const [rm,setRm]=useReduced();
  const perf=usePerf();

  const loadRadar=async()=>{try{const r=await api.radar(mode);setItems(r.items);if(r.items[0]&&!selected)setSelected(r.items[0]);if(mode==='live'&&!r.items.length)setSelected(null)}catch{if(mode==='live'){setItems([]);setSelected(null)}}};
  useEffect(()=>{loadRadar().catch(()=>{});api.status().then(setStatus).catch(()=>{})},[mode]);
  useEffect(()=>{const t=setInterval(()=>api.status().then(setStatus).catch(()=>{}),10000);return()=>clearInterval(t)},[]);
  const open=(a:RadarAsset)=>{setSelected(a);setScreen('terminal')};
  const search=async()=>{const q=query.trim();if(!q)return;const local=items.find(a=>a.symbol.toLowerCase()===q.toLowerCase()||a.tokenAddress.toLowerCase()===q.toLowerCase());if(local)return open(local);try{const r=await api.search(q),p=r.items?.[0];if(p){const a:RadarAsset={id:p.pairAddress,symbol:p.baseToken?.symbol||'TOKEN',name:p.baseToken?.name||'Unknown',chainId:57073,quote:p.quoteToken?.symbol||'WETH',venue:p.dexId||'INK DEX',pairAddress:p.pairAddress,tokenAddress:p.baseToken?.address||'',verified:false,priceEth:Number(p.priceNative||0)||null,priceUsd:Number(p.priceUsd||0)||null,change5m:Number(p.priceChange?.m5||0)||0,change1h:Number(p.priceChange?.h1||0)||0,change6h:Number(p.priceChange?.h6||0)||0,buys:Number(p.txns?.h24?.buys||0)||0,sells:Number(p.txns?.h24?.sells||0)||0,buyers:null,volume24hUsd:Number(p.volume?.h24||0)||0,liquidityUsd:Number(p.liquidity?.usd||0)||0,fdvUsd:Number(p.fdv||0)||null,ageMinutes:p.pairCreatedAt?(Date.now()-p.pairCreatedAt)/60000:null,heat:null,freshness:'DERIVED',imageUrl:p.info?.imageUrl,provenance:{state:'DERIVED',source:'DEXSCREENER',asOf:new Date().toISOString(),method:'search result'}};setMode('live');setItems(x=>[a,...x.filter(y=>y.pairAddress!==a.pairAddress)]);open(a)}}catch{}};

  return <>
    <GrainField quality={perf.tier} reduced={rm}/><div className="crt-scanlines"/><div className="crt-vignette"/>
    <div id="app">
      <header id="topbar">
        <div><div className="brand">REKT<span>//</span>INK</div><div className="brand-sub">MARKET INTELLIGENCE TERMINAL · CHAIN 57073 · ETH</div></div>
        <nav className="nav">{[['radar','INK//RADAR'],['terminal','ASSET//TERMINAL'],['nft','REKT//NFT']].map(([k,l])=><button key={k} className={screen===k?'active':''} onClick={()=>setScreen(k as any)}>{l}</button>)}</nav>
        <input className="search" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="SEARCH / PASTE 0x CONTRACT"/>
        <div className="grow"/>
        {mode==='fixture'&&<select value={scenario} onChange={e=>setScenario(e.target.value)} aria-label="Replay load"><option>NORMAL</option><option>ACTIVE</option><option>MANIA</option><option>PATHOLOGICAL</option></select>}
        <select value={mode} onChange={e=>setMode(e.target.value as any)}><option value="fixture">DATA · FIXTURE</option><option value="live">DATA · LIVE</option></select>
        <button onClick={()=>setRm(!rm)}>RM {rm?'ON':'OFF'}</button>
      </header>
      <main>
        {screen==='radar'&&<Radar items={items} onOpen={open}/>} 
        {screen==='terminal'&&selected&&<Terminal asset={selected} mode={mode} scenario={scenario} onWallet={async a=>{try{setWallet(await api.wallet(a,mode))}catch{setWallet(null)}}}/>} 
        {screen==='nft'&&<Nft mode={mode} onWallet={async a=>{try{setWallet(await api.wallet(a,mode))}catch{setWallet(null)}}}/>} 
      </main>
      <footer id="statusbar"><span className={`chip ${status?.ok?'ok':'warn'}`}>INK {status?.blockNumber?`HEAD ${status.blockNumber}`:'HEAD —'}</span><span className="chip">SOURCE {mode.toUpperCase()}</span><span className="chip">FPS {perf.fps}</span><span className="chip">p95 {perf.p95.toFixed(1)}ms</span><span className="chip">FX {perf.tier}</span>{mode==='fixture'&&<span className="chip">LOAD {scenario}</span>}<div className="grow"/><span className="chip">ETH NATIVE · CHAIN 57073</span></footer>
    </div>
    {wallet&&<WalletDrawer data={wallet} onClose={()=>setWallet(null)}/>} 
  </>;
}

function Radar({items,onOpen}:{items:RadarAsset[];onOpen:(a:RadarAsset)=>void}){
  const [tab,setTab]=useState('TRENDING');
  const list=useMemo(()=>[...items].sort((a,b)=>tab==='NEW'?(a.ageMinutes??1e12)-(b.ageMinutes??1e12):tab==='GAINERS'?(b.change1h??-1e9)-(a.change1h??-1e9):(b.heat??0)-(a.heat??0)),[items,tab]);
  return <section className="screen"><div className="tabs">{['TRENDING','NEW','GAINERS','IGNITION','REKT','WATCHLIST'].map(t=><button className={tab===t?'active':''} onClick={()=>setTab(t)} key={t}>{t}</button>)}</div><div className="panel radar-panel"><div className="radar-scroll"><table className="radar"><thead><tr><th className="al">ASSET</th><th>PRICE ETH</th><th>USD</th><th>5M</th><th>1H</th><th>6H</th><th>BUYS</th><th>SELLS</th><th>BYRS</th><th>VOL 24H</th><th>LIQ</th><th>FDV</th><th>AGE</th><th>HEAT</th><th>FRESH</th></tr></thead><tbody>{list.map(a=><tr key={a.id} onClick={()=>onOpen(a)} tabIndex={0} onKeyDown={e=>(e.key==='Enter'||e.key===' ')&&onOpen(a)}><td><div className="asset-cell"><div className="sigil">{a.symbol.slice(0,2)}</div><div><div><b>{a.symbol}</b> <span className="quote">/{a.quote}</span> {a.verified&&<span className="verified">✓</span>}</div><small>{a.venue} · {short(a.tokenAddress)}</small></div></div></td><td>{eth(a.priceEth)}</td><td>{money(a.priceUsd)}</td><td className={(a.change5m??0)>=0?'up':'dn'}>{pct(a.change5m)}</td><td className={(a.change1h??0)>=0?'up':'dn'}>{pct(a.change1h)}</td><td className={(a.change6h??0)>=0?'up':'dn'}>{pct(a.change6h)}</td><td>{a.buys??'—'}</td><td>{a.sells??'—'}</td><td>{a.buyers??'—'}</td><td>{money(a.volume24hUsd)}</td><td>{money(a.liquidityUsd)}</td><td>{money(a.fdvUsd)}</td><td>{age(a.ageMinutes)}</td><td><div className="heat"><i style={{transform:`scaleX(${(a.heat??0)/100})`}}/><span>{a.heat??'—'}</span></div></td><td><ProvenanceChip p={a.provenance}/></td></tr>)}</tbody></table></div><div className="hint">CLICK / ENTER TO OPEN · STABLE ORDER PER TAB · SOURCE STATE IS NEVER COLOR-ONLY</div></div></section>;
}

function Terminal({asset,mode,scenario,onWallet}:{asset:RadarAsset;mode:'fixture'|'live';scenario:string;onWallet:(a:string)=>void}){
  const box=useRef<HTMLDivElement>(null),chart=useRef<MarketChart|null>(null),panel=useRef<HTMLDivElement>(null);
  const [events,setEvents]=useState<any[]>([]),[head,setHead]=useState<number|null>(null),[source,setSource]=useState('CONNECTING');
  const [live,setLive]=useState({priceEth:asset.priceEth,priceUsd:asset.priceUsd});
  const [dropped,setDropped]=useState(0);
  const pending=useRef({priceEth:asset.priceEth,priceUsd:asset.priceUsd});
  useEffect(()=>{setLive({priceEth:asset.priceEth,priceUsd:asset.priceUsd});pending.current={priceEth:asset.priceEth,priceUsd:asset.priceUsd};},[asset.id]);
  useEffect(()=>{
    if(!box.current)return;
    chart.current?.destroy();
    chart.current=new MarketChart(box.current);
    let disposed=false;
    api.bars(asset,mode).then(b=>{if(!disposed)chart.current?.load(b)}).catch(()=>{if(!disposed)setSource('HISTORY UNAVAILABLE')});
    setEvents([]);setDropped(0);
    if(mode==='live')api.trades(asset).then(r=>setEvents((r.trades||[]).slice(0,60).map((t:any,i:number)=>({id:t.id||i,label:t.side,msg:`${t.volumeUsd?money(t.volumeUsd):''} ${t.txHash?short(t.txHash):''}`,wallet:t.wallet||null})))).catch(()=>{});

    let localTimer=0,localSeq=0,localStarted=false,rafBatch=0,droppedLocal=0;
    const queue:StreamEnvelope[]=[];
    const flushBatch=()=>{
      rafBatch=0;if(disposed||!queue.length)return;
      const batch=queue.splice(0,queue.length);
      let latestHead:number|null=null,latestSource:string|null=null;
      let latestChart:{price:number;side:number;volume:number;time:number}|null=null;
      let nextEth=pending.current.priceEth,nextUsd=pending.current.priceUsd;
      let sweepSide:number|null=null;
      const tape:any[]=[];
      for(const m of batch){
        if(m.type==='HEAD'){latestHead=Number(m.payload.number);continue}
        if(m.type==='SOURCE_STATUS'){latestSource=String(m.payload.state);continue}
        if(m.type==='BUY'||m.type==='SELL'||m.type==='SWEEP'){
          const p=m.payload,pe=Number(p.priceEth),side=Number(p.side),qty=Number(p.qty||1);
          if(Number.isFinite(pe)&&pe>0){
            latestChart={price:pe,side,volume:qty,time:Math.floor(m.serverTime/1000)};
            nextEth=pe;
            if(asset.priceUsd&&asset.priceEth)nextUsd=pe*(asset.priceUsd/asset.priceEth);
          }
          if(m.type==='SWEEP')sweepSide=side;
          tape.push({id:`${m.seq}`,label:m.type,msg:`${p.symbol} ${p.qty} @ ${eth(pe)} ETH`,wallet:p.wallet||null});
          continue;
        }
        if(m.type==='MARKET_UPDATE'){
          const p=m.payload,pe=Number(p.priceNative||0)||null,pu=Number(p.priceUsd||0)||null;
          nextEth=pe;nextUsd=pu;
          if(pu)latestChart={price:pu,side:1,volume:1,time:Math.floor(m.serverTime/1000)};
        }
      }
      if(latestHead!=null)setHead(latestHead);
      if(latestSource)setSource(latestSource);
      if(latestChart)chart.current?.update(latestChart.price,latestChart.side,latestChart.volume,latestChart.time);
      if(sweepSide!=null){chart.current?.sweep(sweepSide);panel.current?.animate([{boxShadow:'0 0 0 1px rgba(139,255,88,.85),0 0 22px rgba(139,255,88,.28)'},{boxShadow:'0 0 0 1px rgba(139,255,88,0),0 0 0 rgba(139,255,88,0)'}],{duration:800,easing:'ease-out'})}
      pending.current={priceEth:nextEth,priceUsd:nextUsd};setLive({priceEth:nextEth,priceUsd:nextUsd});
      if(tape.length)setEvents(old=>[...tape.reverse(),...old].slice(0,60));
      if(droppedLocal)setDropped(droppedLocal);
    };
    const enqueue=(m:StreamEnvelope)=>{
      if(queue.length>=4000){queue.shift();droppedLocal++}
      queue.push(m);
      if(!rafBatch)rafBatch=requestAnimationFrame(flushBatch);
    };
    const startLocal=()=>{if(localStarted||disposed||mode!=='fixture')return;localStarted=true;setSource('LOCAL FIXTURE');const rate=scenario==='PATHOLOGICAL'?100:scenario==='MANIA'?250:scenario==='ACTIVE'?50:5;const emit=()=>enqueue(localEvent(++localSeq,asset.symbol) as StreamEnvelope);if(scenario==='PATHOLOGICAL')for(let i=0;i<1000;i++)emit();localTimer=window.setInterval(emit,Math.max(4,Math.floor(1000/rate)))};
    let ws:WebSocket|null=null;
    try{
      ws=new WebSocket(streamUrl(mode,asset,scenario));
      const fallback=window.setTimeout(()=>{if(ws?.readyState!==WebSocket.OPEN)startLocal()},900);
      ws.onopen=()=>{clearTimeout(fallback);setSource(mode==='fixture'?'SERVER FIXTURE':'LIVE')};
      ws.onclose=()=>{clearTimeout(fallback);if(mode==='fixture')startLocal();else setSource('DISCONNECTED')};
      ws.onerror=()=>{if(mode!=='fixture')setSource('DEGRADED')};
      ws.onmessage=e=>{try{enqueue(JSON.parse(e.data))}catch{}};
    }catch{startLocal()}
    return()=>{disposed=true;if(rafBatch)cancelAnimationFrame(rafBatch);clearInterval(localTimer);ws?.close();chart.current?.destroy();chart.current=null}
  },[asset.id,mode,scenario]);
  const chartUnit=mode==='live'?'USD':'ETH';
  return <section className="screen term-grid"><div className="panel chart-panel" ref={panel}><div className="p-head"><div className="term-id"><b>{asset.symbol}</b><span>/{asset.quote} · {asset.venue}</span></div><div className="grow"/><span className={`chip ${source==='LIVE'||source==='SERVER FIXTURE'||source==='LOCAL FIXTURE'?'ok':'warn'}`}>{source}</span><span className="chip">{head?`HEAD ${head}`:'HEAD —'}</span></div><div className="metrics"><Metric l="PRICE" v={`${eth(live.priceEth)} ETH`} p={asset.provenance}/><Metric l="USD" v={money(live.priceUsd)} p={asset.provenance}/><Metric l="1H" v={pct(asset.change1h)} p={asset.provenance}/><Metric l="VOL" v={money(asset.volume24hUsd)} p={asset.provenance}/><Metric l="LIQ" v={money(asset.liquidityUsd)} p={asset.provenance}/><Metric l="FDV" v={money(asset.fdvUsd)} p={asset.provenance}/></div><div ref={box} className="chart-box"/><div className="chart-foot">LIGHTWEIGHT CHARTS V5 · {chartUnit} OHLCV · setData HISTORY → update LIVE · DROP {dropped}</div></div><div className="side-col"><div className="panel tape-panel"><div className="p-head">LIVE EVENT TAPE <div className="grow"/>{events.length} EV</div><div className="tape">{events.map(e=><div className="trow" key={e.id}><span className={`tt ${String(e.label).toLowerCase()}`}>{e.label}</span><span className="tmsg">{e.msg} {e.wallet&&<button className="addrbtn" onClick={()=>onWallet(e.wallet)}>{short(e.wallet)}</button>}</span></div>)}</div></div><div className="panel provenance-panel"><div className="p-head">MARKET IDENTITY</div><KV k="TOKEN" v={short(asset.tokenAddress)}/><KV k="PAIR" v={short(asset.pairAddress)}/><KV k="CHAIN" v="INK · 57073"/><KV k="QUOTE" v={asset.quote}/><KV k="METHOD" v={asset.provenance.method}/></div></div></section>;
}

function Metric({l,v,p}:{l:string;v:string;p:any}){return <div className="metric"><div className="lbl">{l}<ProvenanceChip p={p}/></div><div className="mv">{v}</div></div>}
function WalletDrawer({data,onClose}:{data:WalletTrace;onClose:()=>void}){useEffect(()=>{const f=(e:KeyboardEvent)=>e.key==='Escape'&&onClose();addEventListener('keydown',f);return()=>removeEventListener('keydown',f)},[onClose]);return <aside id="drawer" className="open" aria-label="Wallet trace inspector"><div className="d-head"><b>WALLET//TRACE</b><span className="chip">{short(data.address)}</span><div className="grow"/><button onClick={onClose}>ESC ×</button></div><div className="d-body"><div><div className="lbl">VISIBLE ONCHAIN VALUE · NEVER NET WORTH</div><div className="bigval">{money(data.visibleValueUsd)}</div><div>{data.eth==null?'—':`${data.eth.toFixed(4)} ETH`}</div></div><div><span className="clsbadge">{data.classifier}</span>{data.confidence!=null&&<div className="confidence"><i style={{transform:`scaleX(${data.confidence})`}}/></div>}</div><KV k="ADDRESS AGE" v={data.addressAgeDays==null?'UNAVAILABLE':`${data.addressAgeDays}d`}/><KV k="REKT HELD" v={data.rektHeld==null?'UNAVAILABLE':String(data.rektHeld)}/><KV k="REKT BOUGHT 30D" v={data.rektBought30d==null?'UNAVAILABLE':String(data.rektBought30d)}/><KV k="REKT SOLD 30D" v={data.rektSold30d==null?'UNAVAILABLE':String(data.rektSold30d)}/><KV k="MEDIAN HOLD" v={data.medianHold??'UNAVAILABLE'}/><div><div className="lbl">WHY</div><ul className="why">{data.reasons.map(x=><li key={x}>{x}</li>)}</ul></div><div><ProvenanceChip p={data.provenance}/><p className="note">{data.provenance.source} · {data.provenance.method}</p></div></div></aside>}
function Nft({mode,onWallet}:{mode:'fixture'|'live';onWallet:(a:string)=>void}){const[n,setN]=useState<any>(null),[revealed,setRevealed]=useState(false),[unavailable,setUnavailable]=useState(false);useEffect(()=>{setN(null);setUnavailable(false);api.nft('0x0000000000000000000000000000000000000000','413',mode).then(setN).catch(()=>setUnavailable(true))},[mode]);if(unavailable)return <section className="screen"><div className="panel empty">LIVE NFT SEMANTICS · UNAVAILABLE<br/><small>SALE CLASSIFICATION FAILS CLOSED UNTIL REKT CONTRACT + MARKETPLACE/PAYMENT EVIDENCE ADAPTERS ARE CONFIGURED.</small></div></section>;if(!n)return <section className="screen"><div className="panel empty">NFT {mode.toUpperCase()} LOADING…</div></section>;return <section className="screen nft-grid"><div className="panel nft-art"><div className="p-head">{n.name}<div className="grow"/><span className="chip ok">ERC-721 · INK</span></div><button className={`pixel-art ${revealed?'revealed':''}`} onClick={()=>setRevealed(true)} aria-label="Reveal NFT artwork"><div className="rekt-face">{revealed?<><span>REKT</span><br/><span>0413</span></>:<><span>PIXEL</span><br/><span>REVEAL</span></>}</div></button><KV k="CURRENT OWNER" v={short(n.owner)}/><button className="trace" onClick={()=>onWallet(n.owner)}>TRACE OWNER → WALLET//TRACE</button></div><div className="panel"><div className="p-head">PROVENANCE TIMELINE · SALE ≠ TRANSFER</div><div className="nftstats"><Metric l="FLOOR" v={`${n.floorEth} ETH`} p={n.provenance}/><Metric l="SALES 30D" v={String(n.sales30d)} p={n.provenance}/><Metric l="VOL 30D" v={`${n.volume30dEth} ETH`} p={n.provenance}/><Metric l="HOLDERS" v={String(n.holders)} p={n.provenance}/></div><div className="timeline">{n.timeline.map((e:any)=><div className={`tl ${e.type==='SALE_CONFIRMED'?'sale':'xfer'}`} key={e.at}><time>{e.at.slice(0,16).replace('T',' ')}</time><b>{e.type}</b><span>{e.from?short(e.from):'MINT'} → {short(e.to)} {e.priceEth!=null?`· ${e.priceEth} ETH`:e.type==='TRANSFER'?'· NOT A SALE · NO PAYMENT EVIDENCE':''}</span></div>)}</div></div></section>}
function KV({k,v}:{k:string;v:string}){return <div className="kv"><span>{k}</span><b>{v}</b></div>}
