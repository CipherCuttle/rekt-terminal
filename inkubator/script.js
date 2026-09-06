(()=>{"use strict";
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse=matchMedia('(pointer:coarse)').matches;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const sections=$$('[data-section]'),nav=$$('.nav button'),mobileProgress=$('#mobileProgress');
function go(i){$('#s'+i)?.scrollIntoView({behavior:reduced?'auto':'smooth',block:'start'})}
$$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(Number(b.dataset.go))));
const secObs=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;const i=Number(e.target.dataset.section);nav.forEach((n,j)=>n.classList.toggle('on',i===j));if(mobileProgress)mobileProgress.style.width=((i+1)/sections.length*100)+'%'}),{threshold:.35});sections.forEach(s=>secObs.observe(s));
const loop=$$('#loop button'),ex=$('#loopExplain');loop.forEach(n=>n.addEventListener('click',()=>{loop.forEach(x=>x.classList.remove('on'));n.classList.add('on');ex.textContent=n.dataset.copy||''}));
const toast=$('#toast');let tt;function showToast(t){toast.textContent=t;toast.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>toast.classList.remove('show'),1450)}
async function cp(t){try{await navigator.clipboard.writeText(t);showToast('COPIED')}catch{showToast('COPY BLOCKED')}}
const one='REKT INK(CUBATOR) = a community build experiment that turns culture into a loop: challenge → ship → flex → reward → repeat.';
const pitch='REKT INK(CUBATOR) // Round 000\n\nI build and run the whole thing. REKT puts up 250 USDT + a few REKT/Chibis, brand approval, official posts and judging weight. We hand-pick 8 founding builders + open 2 wildcard slots, give them 7 days to ship something working, then turn every build into content. Success = 15 enter → 10 ship → 3 slap → 2 stay.';
$('#copyOne').addEventListener('click',()=>cp(one));$('#copyPitch').addEventListener('click',()=>cp(pitch));$('#sharePitch').addEventListener('click',async()=>{if(navigator.share){try{return await navigator.share({title:'REKT INK(CUBATOR)',text:pitch,url:location.href})}catch{}}cp(location.href)});
function lifecycle(canvas,draw,targetFps=30){let raf=0,last=0,visible=true;function tick(t){raf=requestAnimationFrame(tick);if(!visible||document.hidden||t-last<1000/targetFps)return;last=t;draw(t)}const io=new IntersectionObserver(e=>{visible=e[0].isIntersecting;if(visible&&!reduced&&!raf)raf=requestAnimationFrame(tick)},{threshold:.01});io.observe(canvas);document.addEventListener('visibilitychange',()=>{if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0}else if(!document.hidden&&visible&&!reduced&&!raf)raf=requestAnimationFrame(tick)});if(reduced)draw(0);else raf=requestAnimationFrame(tick);return()=>{io.disconnect();if(raf)cancelAnimationFrame(raf)}}
function fitCanvas(c,dprCap){const r=c.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,dprCap);c.width=Math.max(1,Math.round(r.width*d));c.height=Math.max(1,Math.round(r.height*d));const x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);return x}

(function asciiHero(){
 const hero=$('#s0'),c=$('#asciiHero'),x=c.getContext('2d');
 let px=innerWidth*.74,py=innerHeight*.45,tx=px,ty=py,lastTX=tx,lastTY=ty,velocity=0,burst=[],trail=[];
 const glyphs='REKTINK<>[]{}#%+/*01░▒▓';
 function size(){fitCanvas(c,coarse?1.15:1.35)}
 function hoodOuter(ctx,cx,cy,s){
  ctx.save();ctx.translate(cx,cy);ctx.scale(s,s);ctx.beginPath();
  ctx.moveTo(0,-106);
  ctx.bezierCurveTo(54,-105,84,-72,92,-27);
  ctx.bezierCurveTo(99,12,84,51,54,82);
  ctx.lineTo(70,111);
  ctx.bezierCurveTo(102,128,126,149,142,180);
  ctx.lineTo(-142,180);
  ctx.bezierCurveTo(-126,149,-102,128,-70,111);
  ctx.lineTo(-54,82);
  ctx.bezierCurveTo(-84,51,-99,12,-92,-27);
  ctx.bezierCurveTo(-84,-72,-54,-105,0,-106);
  ctx.closePath();ctx.restore();
 }
 function faceOpening(ctx,cx,cy,s){
  ctx.save();ctx.translate(cx,cy);ctx.scale(s,s);ctx.beginPath();
  ctx.moveTo(0,-72);
  ctx.bezierCurveTo(39,-70,61,-45,64,-12);
  ctx.bezierCurveTo(68,22,50,49,0,82);
  ctx.bezierCurveTo(-50,49,-68,22,-64,-12);
  ctx.bezierCurveTo(-61,-45,-39,-70,0,-72);
  ctx.closePath();ctx.restore();
 }
 function lineArt(ctx,cx,cy,s,a=1){
  ctx.save();ctx.translate(cx,cy);ctx.scale(s,s);ctx.lineWidth=1.5/s;
  ctx.strokeStyle=`rgba(67,216,255,${.5*a})`;ctx.fillStyle=`rgba(255,122,34,${.9*a})`;
  ctx.beginPath();ctx.moveTo(-30,-18);ctx.bezierCurveTo(-18,-31,-7,-25,-10,-5);ctx.bezierCurveTo(-16,4,-23,1,-27,-6);ctx.bezierCurveTo(-36,-2,-39,-10,-30,-18);ctx.fill();
  ctx.beginPath();ctx.moveTo(30,-18);ctx.bezierCurveTo(18,-31,7,-25,10,-5);ctx.bezierCurveTo(16,4,23,1,27,-6);ctx.bezierCurveTo(36,-2,39,-10,30,-18);ctx.fill();
  ctx.beginPath();ctx.moveTo(-45,15);ctx.lineTo(-22,35);ctx.lineTo(0,25);ctx.lineTo(22,35);ctx.lineTo(45,15);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-36,38);ctx.quadraticCurveTo(0,58,36,38);ctx.quadraticCurveTo(0,72,-36,38);ctx.stroke();
  for(let i=-28;i<=28;i+=8){ctx.beginPath();ctx.moveTo(i,45);ctx.lineTo(i+2,58);ctx.stroke()}
  ctx.restore();
 }
 function draw(t){
  const w=c.clientWidth,h=c.clientHeight,time=t*.001;
  px+=(tx-px)*(coarse?.085:.19);py+=(ty-py)*(coarse?.085:.19);velocity*=.9;
  x.fillStyle='#160622';x.fillRect(0,0,w,h);
  const cell=coarse?17:13,cols=Math.ceil(w/cell)+7,rows=Math.ceil(h/cell)+7;
  const aura=Math.min(coarse?165:220,(coarse?125:145)+velocity*.42);
  x.textAlign='center';x.textBaseline='middle';x.font=`800 ${Math.max(8,cell*.62)}px ui-monospace,monospace`;
  for(let yy=-4;yy<rows;yy++)for(let xx=-4;xx<cols;xx++){
   const baseX=xx*cell+(yy%2)*cell*.18,baseY=yy*cell;
   const drift=((time*(10+(yy%8))+(yy*11))%(cell*6));
   let gx=baseX,gy=baseY+drift-cell*3;
   const dx=gx-px,dy=gy-py,d=Math.hypot(dx,dy),inf=Math.max(0,1-d/aura);
   const kick=inf*inf*Math.min(18,velocity*.08+4);
   if(d>1){gx+=dx/d*kick;gy+=dy/d*kick}
   const noise=(Math.sin(xx*.63+yy*.91+time*1.25)+1)*.5,band=(Math.sin(yy*.29-time*1.18)+1)*.5;
   const a=.20+noise*.26+band*.12+inf*.27;
   const rare=((xx*13+yy*19+Math.floor(time*4))%79===0);
   const col=inf>.12?`rgba(67,216,255,${Math.min(.95,a)})`:(rare?`rgba(255,122,34,${Math.min(.88,a)})`:`rgba(${155+Math.round(noise*72)},${55+Math.round(noise*44)},${220+Math.round(noise*30)},${Math.min(.76,a)})`);
   x.save();x.translate(gx,gy);x.rotate(Math.PI/2);x.fillStyle=col;x.fillText(glyphs[Math.abs(xx*17+yy*31+Math.floor(time*10))%glyphs.length],0,0);x.restore();
  }
  trail.unshift({x:px,y:py});trail=trail.slice(0,5);
  trail.slice(1).forEach((p,i)=>{x.save();x.globalCompositeOperation='destination-out';x.globalAlpha=.10*(1-i/5);hoodOuter(x,p.x,p.y,coarse?.48:.58);x.fillStyle='#000';x.fill();x.restore()});
  x.save();x.globalCompositeOperation='destination-out';
  const rg=x.createRadialGradient(px,py,28,px,py,aura);rg.addColorStop(0,'rgba(0,0,0,.42)');rg.addColorStop(.55,'rgba(0,0,0,.18)');rg.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=rg;x.beginPath();x.arc(px,py,aura,0,Math.PI*2);x.fill();
  x.fillStyle='#000';hoodOuter(x,px,py,coarse?.56:.69);x.fill();
  x.restore();
  x.save();x.strokeStyle='rgba(67,216,255,.68)';x.shadowColor='rgba(67,216,255,.55)';x.shadowBlur=20;x.lineWidth=1.5;hoodOuter(x,px,py,coarse?.56:.69);x.stroke();x.shadowBlur=0;faceOpening(x,px,py-2,coarse?.56:.69);x.strokeStyle='rgba(247,242,251,.30)';x.stroke();x.restore();
  lineArt(x,px,py-2,coarse?.56:.69,Math.min(1,.65+velocity*.003));
  burst=burst.filter(b=>t-b.t<780);
  burst.forEach(b=>{const p=(t-b.t)/780,r=28+p*300;x.beginPath();x.arc(b.x,b.y,r,0,Math.PI*2);x.strokeStyle=`rgba(255,122,34,${(1-p)*.62})`;x.lineWidth=2+8*(1-p);x.stroke()});
 }
 function pointFromEvent(e){const r=hero.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}
 hero.addEventListener('pointermove',e=>{const p=pointFromEvent(e);lastTX=tx;lastTY=ty;tx=p.x;ty=p.y;velocity=Math.min(120,Math.hypot(tx-lastTX,ty-lastTY)*8)});
 hero.addEventListener('pointerdown',e=>{const p=pointFromEvent(e);tx=p.x;ty=p.y;burst.push({x:p.x,y:p.y,t:performance.now()});velocity=100});
 hero.addEventListener('pointerenter',e=>{const p=pointFromEvent(e);tx=p.x;ty=p.y});
 if(coarse&&!reduced){let a=0;setInterval(()=>{a+=.8;tx=innerWidth*(.63+.15*Math.sin(a*.79));ty=Math.min(innerHeight*.70,innerHeight*(.38+.14*Math.cos(a*.57)));velocity=24},1800)}
 addEventListener('resize',size,{passive:true});size();draw(0);lifecycle(c,draw,coarse?22:32)
})();

(function grain(){const c=$('#grain'),x=c.getContext('2d');function size(){fitCanvas(c,coarse?1.05:1.2)}function draw(t){const w=c.clientWidth,h=c.clientHeight;x.fillStyle='#050307';x.fillRect(0,0,w,h);const count=22;for(let i=0;i<count;i++){const q=i/(count-1),base=h*(.15+.7*q),amp=20+33*Math.sin(q*Math.PI),phase=t*.00032*(.75+q*.55)+i*.39;x.beginPath();for(let xx=-20;xx<=w+20;xx+=8){const yy=base+Math.sin(xx*.012+phase)*amp+Math.sin(xx*.004-phase*.7)*16;xx===-20?x.moveTo(xx,yy):x.lineTo(xx,yy)}const r=Math.round(139+(220-139)*q),g=Math.round(92+(59-92)*q),b=Math.round(246+(234-246)*q);x.strokeStyle=`rgba(${r},${g},${b},${.05+.12*Math.sin(q*Math.PI)})`;x.lineWidth=.7+(i%3)*.14;x.stroke()}for(let i=0;i<Math.floor(w*h/15000);i++){x.fillStyle='rgba(247,242,251,.035)';x.fillRect(Math.random()*w,Math.random()*h,1,1)}}addEventListener('resize',size,{passive:true});size();draw(0);lifecycle(c,draw,coarse?18:24)})();
if(!reduced&&!coarse)$$('.reward').forEach(card=>{card.addEventListener('pointermove',e=>{const r=card.getBoundingClientRect(),u=(e.clientX-r.left)/r.width,v=(e.clientY-r.top)/r.height;card.style.setProperty('--mx',u*100+'%');card.style.setProperty('--my',v*100+'%');card.style.transform=`rotateX(${(0.5-v)*4.5}deg) rotateY(${(u-.5)*6}deg) translateY(-2px)`});card.addEventListener('pointerleave',()=>card.style.transform='')});
})();
