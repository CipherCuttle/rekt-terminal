import {MOTION_SECONDS} from './motion-tokens';

const ms = (seconds: number) => Math.round(seconds * 1000);

export type PeripheralTone = 'context' | 'observed' | 'attention' | 'blocked' | 'proven' | 'stale';
export type PeripheralAuthority = 'CONTEXT' | 'STATUS' | 'CLAIMED' | 'OBSERVED' | 'PROVEN' | 'UNKNOWN';
export type PeripheralCueKind =
  | 'SOURCE_LINK'
  | 'SOURCE_RX'
  | 'OBSERVED'
  | 'NEXT_MOVE_CHANGED'
  | 'MISSION_BLOCKED'
  | 'HELP_BEACON'
  | 'VERIFYING'
  | 'VERIFY_PASS'
  | 'SHIP_SUBMITTED'
  | 'SHIP_PROVEN'
  | 'RECEIPT'
  | 'STALE'
  | 'UNAVAILABLE';

export type Primitive =
  | {kind: 'circle'; cx: number; cy: number; r: number; fill?: boolean}
  | {kind: 'rect'; x: number; y: number; width: number; height: number; rx?: number; fill?: boolean}
  | {kind: 'line'; x1: number; y1: number; x2: number; y2: number; dash?: string}
  | {kind: 'path'; d: string; fill?: boolean}
  | {kind: 'polygon'; points: string; fill?: boolean};

export type LayerFrame = Readonly<{x: number; y: number; visible: boolean}>;

export type LayerPolicy =
  | {kind: 'fixed'; visibilityMayChange?: boolean}
  | {kind: 'track'; axis: 'x' | 'y'; direction: 'increasing' | 'decreasing' | 'either'; minTravel: number; maxOrthogonalDrift?: number}
  | {kind: 'toggle'};

export type PeripheralLayer = Readonly<{
  id: string;
  tone?: PeripheralTone | 'ink';
  primitive: Primitive;
  policy: LayerPolicy;
  frames: readonly [LayerFrame, LayerFrame, LayerFrame, LayerFrame];
}>;

export type PeripheralMotionDefinition = Readonly<{
  cue: PeripheralCueKind;
  label: string;
  authority: PeripheralAuthority;
  tone: PeripheralTone;
  durationMs: number;
  layers: readonly PeripheralLayer[];
}>;

const F = (x: number, y: number, visible = true): LayerFrame => ({x, y, visible});
const SAME = (x: number, y: number): readonly [LayerFrame, LayerFrame, LayerFrame, LayerFrame] => [F(x,y),F(x,y),F(x,y),F(x,y)];
const VIS = (x: number, y: number, on: readonly [boolean, boolean, boolean, boolean]): readonly [LayerFrame, LayerFrame, LayerFrame, LayerFrame] => [F(x,y,on[0]),F(x,y,on[1]),F(x,y,on[2]),F(x,y,on[3])];
const TRACK_X = (xs: readonly [number, number, number, number], y: number): readonly [LayerFrame, LayerFrame, LayerFrame, LayerFrame] => [F(xs[0],y),F(xs[1],y),F(xs[2],y),F(xs[3],y)];
const TRACK_Y = (x: number, ys: readonly [number, number, number, number], visibility: readonly [boolean, boolean, boolean, boolean] = [true,true,true,true]): readonly [LayerFrame, LayerFrame, LayerFrame, LayerFrame] => [F(x,ys[0],visibility[0]),F(x,ys[1],visibility[1]),F(x,ys[2],visibility[2]),F(x,ys[3],visibility[3])];

const dot = (id: string, cx: number, cy: number, r = 3, tone: PeripheralLayer['tone'] = 'ink', frames = SAME(0,0), policy: LayerPolicy = {kind:'fixed'}): PeripheralLayer => ({id,tone,primitive:{kind:'circle',cx,cy,r,fill:true},policy,frames});
const line = (id: string, x1: number, y1: number, x2: number, y2: number, tone: PeripheralLayer['tone'] = 'ink', frames = SAME(0,0), policy: LayerPolicy = {kind:'fixed'}, dash?: string): PeripheralLayer => ({id,tone,primitive:{kind:'line',x1,y1,x2,y2,dash},policy,frames});
const rect = (id: string, x: number, y: number, width: number, height: number, tone: PeripheralLayer['tone'] = 'ink', frames = SAME(0,0), policy: LayerPolicy = {kind:'fixed'}, fill=false): PeripheralLayer => ({id,tone,primitive:{kind:'rect',x,y,width,height,fill},policy,frames});
const path = (id: string, d: string, tone: PeripheralLayer['tone'] = 'ink', frames = SAME(0,0), policy: LayerPolicy = {kind:'fixed'}): PeripheralLayer => ({id,tone,primitive:{kind:'path',d},policy,frames});
const polygon = (id: string, points: string, tone: PeripheralLayer['tone'] = 'ink', frames = SAME(0,0), policy: LayerPolicy = {kind:'fixed'}): PeripheralLayer => ({id,tone,primitive:{kind:'polygon',points,fill:true},policy,frames});

const focusCorners = (prefix: string, tone: PeripheralLayer['tone'] = 'ink'): PeripheralLayer[] => [
  path(prefix+'-tl','M46 34h10M46 34v10',tone), path(prefix+'-tr','M104 34h10M114 34v10',tone),
  path(prefix+'-bl','M46 62v10M46 72h10',tone), path(prefix+'-br','M114 62v10M104 72h10',tone),
];

export const PERIPHERAL_MOTIONS: readonly PeripheralMotionDefinition[] = [
  {cue:'SOURCE_LINK',label:'SOURCE LINK',authority:'CONTEXT',tone:'context',durationMs:ms(MOTION_SECONDS.signal),layers:[
    dot('carrier',54,52,3,'ink'),
    path('arc-1','M66 43 Q76 52 66 61','ink',VIS(0,0,[false,true,true,true]),{kind:'toggle'}),
    path('arc-2','M74 36 Q91 52 74 68','ink',VIS(0,0,[false,false,true,true]),{kind:'toggle'}),
    path('arc-3','M82 29 Q106 52 82 75','ink',VIS(0,0,[false,false,false,true]),{kind:'toggle'}),
  ]},
  {cue:'SOURCE_RX',label:'SOURCE RX',authority:'OBSERVED',tone:'observed',durationMs:ms(MOTION_SECONDS.signal),layers:[
    line('rail',30,52,112,52,'ink',SAME(0,0),{kind:'fixed'},'2 6'),
    path('receiver','M124 34h8v36h-8','ink'),
    dot('packet',0,0,4,'observed',TRACK_X([32,58,86,112],52),{kind:'track',axis:'x',direction:'increasing',minTravel:70,maxOrthogonalDrift:0}),
  ]},
  {cue:'OBSERVED',label:'OBSERVED',authority:'OBSERVED',tone:'observed',durationMs:ms(MOTION_SECONDS.signal),layers:[
    line('rail',28,52,102,52,'ink',SAME(0,0),{kind:'fixed'},'2 6'),
    path('capture-left','M108 34h-8v36h8','ink'), path('capture-right','M124 34h8v36h-8','ink'),
    rect('evidence',-5,-5,10,10,'observed',TRACK_X([30,54,80,116],52),{kind:'track',axis:'x',direction:'increasing',minTravel:70,maxOrthogonalDrift:0}),
  ]},
  {cue:'NEXT_MOVE_CHANGED',label:'NEXT MOVE',authority:'CONTEXT',tone:'context',durationMs:ms(MOTION_SECONDS.mode),layers:[
    dot('slot-1',42,52,4,'ink'),dot('slot-2',66,52,4,'ink'),dot('slot-3',90,52,4,'ink'),dot('slot-4',114,52,4,'ink'),
    polygon('pointer','-5,-7 7,0 -5,7','context',TRACK_X([42,66,90,114],52),{kind:'track',axis:'x',direction:'increasing',minTravel:60,maxOrthogonalDrift:0}),
  ]},
  {cue:'MISSION_BLOCKED',label:'BLOCKED',authority:'STATUS',tone:'blocked',durationMs:ms(MOTION_SECONDS.mechanical),layers:[
    line('rail',30,52,104,52,'ink',SAME(0,0),{kind:'fixed'},'2 6'),
    line('wall',116,32,116,72,'blocked'),
    dot('packet',0,0,4,'blocked',TRACK_X([32,56,82,104],52),{kind:'track',axis:'x',direction:'increasing',minTravel:60,maxOrthogonalDrift:0}),
    path('impact','M107 42l5 5M107 62l5-5','blocked',VIS(0,0,[false,false,false,true]),{kind:'toggle'}),
  ]},
  {cue:'HELP_BEACON',label:'HELP BEACON',authority:'STATUS',tone:'attention',durationMs:ms(MOTION_SECONDS.signal),layers:[
    path('mast','M80 58v18M73 76h14M80 58l-7 10M80 58l7 10','ink'),
    dot('beacon',80,52,3,'attention'),
    path('arc-1','M72 46 Q80 39 88 46','attention',VIS(0,0,[false,true,true,true]),{kind:'toggle'}),
    path('arc-2','M64 39 Q80 25 96 39','attention',VIS(0,0,[false,false,true,true]),{kind:'toggle'}),
    path('arc-3','M56 32 Q80 10 104 32','attention',VIS(0,0,[false,false,false,true]),{kind:'toggle'}),
  ]},
  {cue:'VERIFYING',label:'VERIFYING',authority:'STATUS',tone:'observed',durationMs:ms(MOTION_SECONDS.mode),layers:[
    ...focusCorners('verify'), rect('target',72,44,16,16,'ink'),
    line('scan',58,0,102,0,'observed',TRACK_Y(0,[36,46,56,66]),{kind:'track',axis:'y',direction:'increasing',minTravel:24,maxOrthogonalDrift:0}),
  ]},
  {cue:'VERIFY_PASS',label:'PASS / OBSERVED',authority:'OBSERVED',tone:'observed',durationMs:ms(MOTION_SECONDS.signal),layers:[
    ...focusCorners('pass'), rect('target',72,44,16,16,'ink'),
    path('check','M68 53l8 8 17-20','observed',VIS(0,0,[false,false,true,true]),{kind:'toggle'}),
  ]},
  {cue:'SHIP_SUBMITTED',label:'SHIP SUBMITTED',authority:'CLAIMED',tone:'context',durationMs:ms(MOTION_SECONDS.mode),layers:[
    line('rail',30,48,112,48,'ink',SAME(0,0),{kind:'fixed'},'2 6'),
    path('dock','M104 62v14h32V62','ink'),
    rect('package',-6,-6,12,12,'context',TRACK_X([32,58,86,118],48),{kind:'track',axis:'x',direction:'increasing',minTravel:70,maxOrthogonalDrift:0}),
  ]},
  {cue:'SHIP_PROVEN',label:'PROVEN',authority:'PROVEN',tone:'proven',durationMs:ms(MOTION_SECONDS.ceremony),layers:[
    ...focusCorners('proven'),
    dot('proof-core',80,53,2,'proven',VIS(0,0,[false,true,false,false]),{kind:'toggle'}),
    path('check','M62 54l12 12 26-30','proven',VIS(0,0,[false,false,true,true]),{kind:'toggle'}),
    line('ray-top',80,20,80,28,'proven',VIS(0,0,[false,false,false,true]),{kind:'toggle'}),
    line('ray-bottom',80,78,80,86,'proven',VIS(0,0,[false,false,false,true]),{kind:'toggle'}),
    line('ray-left',42,53,50,53,'proven',VIS(0,0,[false,false,false,true]),{kind:'toggle'}),
    line('ray-right',110,53,118,53,'proven',VIS(0,0,[false,false,false,true]),{kind:'toggle'}),
  ]},
  {cue:'RECEIPT',label:'RECEIPT',authority:'PROVEN',tone:'proven',durationMs:ms(MOTION_SECONDS.signal),layers:[
    path('printer','M54 30h52v18H54zM60 48h40','ink'),
    path('paper','M62 0h36v34H62M69 10h22M69 17h22M69 24h17','proven',TRACK_Y(0,[47,52,58,64],[false,true,true,true]),{kind:'track',axis:'y',direction:'increasing',minTravel:10,maxOrthogonalDrift:0}),
  ]},
  {cue:'STALE',label:'STALE',authority:'UNKNOWN',tone:'stale',durationMs:ms(MOTION_SECONDS.signal),layers:[
    dot('source',58,52,4,'stale'),
    path('arc-1','M68 43 Q78 52 68 61','stale',VIS(0,0,[true,true,true,false]),{kind:'toggle'}),
    path('arc-2','M76 36 Q93 52 76 68','stale',VIS(0,0,[true,true,false,false]),{kind:'toggle'}),
    path('arc-3','M84 29 Q108 52 84 75','stale',VIS(0,0,[true,false,false,false]),{kind:'toggle'}),
    path('hollow','M53 47h10v10H53z','stale',VIS(0,0,[false,false,false,true]),{kind:'toggle'}),
  ]},
  {cue:'UNAVAILABLE',label:'UNAVAILABLE',authority:'UNKNOWN',tone:'stale',durationMs:ms(MOTION_SECONDS.signal),layers:[
    dot('source',58,52,4,'stale'),
    path('arc-1','M68 43 Q78 52 68 61','stale',VIS(0,0,[true,true,true,false]),{kind:'toggle'}),
    path('arc-2','M76 36 Q93 52 76 68','stale',VIS(0,0,[true,true,false,false]),{kind:'toggle'}),
    path('arc-3','M84 29 Q108 52 84 75','stale',VIS(0,0,[true,false,false,false]),{kind:'toggle'}),
    path('slash','M72 72l32-40','stale',VIS(0,0,[false,false,false,true]),{kind:'toggle'}),
  ]},
] as const;

export type MotionContractViolation = Readonly<{cue: PeripheralCueKind; layer: string; frame?: number; message: string}>;

function primitiveBounds(primitive: Primitive): {minX:number;minY:number;maxX:number;maxY:number} | null {
  if (primitive.kind === 'circle') return {minX:primitive.cx-primitive.r,minY:primitive.cy-primitive.r,maxX:primitive.cx+primitive.r,maxY:primitive.cy+primitive.r};
  if (primitive.kind === 'rect') return {minX:primitive.x,minY:primitive.y,maxX:primitive.x+primitive.width,maxY:primitive.y+primitive.height};
  if (primitive.kind === 'line') return {minX:Math.min(primitive.x1,primitive.x2),minY:Math.min(primitive.y1,primitive.y2),maxX:Math.max(primitive.x1,primitive.x2),maxY:Math.max(primitive.y1,primitive.y2)};
  return null;
}

export function validatePeripheralMotion(definitions: readonly PeripheralMotionDefinition[] = PERIPHERAL_MOTIONS): MotionContractViolation[] {
  const violations: MotionContractViolation[] = [];
  const cueNames = new Set<string>();
  for (const def of definitions) {
    if (cueNames.has(def.cue)) violations.push({cue:def.cue,layer:'*',message:'duplicate cue definition'});
    cueNames.add(def.cue);
    const layerNames = new Set<string>();
    for (const layer of def.layers) {
      if (layerNames.has(layer.id)) violations.push({cue:def.cue,layer:layer.id,message:'duplicate layer id'});
      layerNames.add(layer.id);
      const visibleFrames = layer.frames.map((frame,index)=>({frame,index})).filter(({frame})=>frame.visible);
      const firstVisible = visibleFrames[0]?.frame;
      if (!firstVisible && layer.policy.kind !== 'toggle') violations.push({cue:def.cue,layer:layer.id,message:'layer is never visible'});
      if (layer.policy.kind === 'fixed' || layer.policy.kind === 'toggle') {
        for (const {frame,index} of visibleFrames) {
          if (!firstVisible) continue;
          if (frame.x !== firstVisible.x || frame.y !== firstVisible.y) violations.push({cue:def.cue,layer:layer.id,frame:index,message:`fixed/toggle layer drifted from (${firstVisible.x},${firstVisible.y}) to (${frame.x},${frame.y})`});
        }
        if (layer.policy.kind === 'fixed' && !layer.policy.visibilityMayChange && layer.frames.some(frame => !frame.visible)) violations.push({cue:def.cue,layer:layer.id,message:'fixed layer visibility changed'});
      }
      if (layer.policy.kind === 'track') {
        const p = layer.policy;
        const coords = visibleFrames.map(({frame})=>p.axis === 'x' ? frame.x : frame.y);
        const orth = visibleFrames.map(({frame})=>p.axis === 'x' ? frame.y : frame.x);
        const maxDrift = orth.length ? Math.max(...orth) - Math.min(...orth) : 0;
        if (maxDrift > (p.maxOrthogonalDrift ?? 0)) violations.push({cue:def.cue,layer:layer.id,message:`orthogonal drift ${maxDrift}px exceeds ${p.maxOrthogonalDrift ?? 0}px`});
        if (coords.length > 1) {
          const travel = Math.max(...coords)-Math.min(...coords);
          if (travel < p.minTravel) violations.push({cue:def.cue,layer:layer.id,message:`travel ${travel}px is below declared ${p.minTravel}px`});
          for (let i=1;i<coords.length;i++) {
            const delta = coords[i]-coords[i-1];
            if (p.direction === 'increasing' && delta < 0) violations.push({cue:def.cue,layer:layer.id,frame:visibleFrames[i].index,message:'track reversed direction'});
            if (p.direction === 'decreasing' && delta > 0) violations.push({cue:def.cue,layer:layer.id,frame:visibleFrames[i].index,message:'track reversed direction'});
          }
        }
      }
      const bounds = primitiveBounds(layer.primitive);
      if (bounds) layer.frames.forEach((frame,index)=>{
        if (!frame.visible) return;
        const minX=bounds.minX+frame.x, maxX=bounds.maxX+frame.x, minY=bounds.minY+frame.y, maxY=bounds.maxY+frame.y;
        if (minX < 0 || minY < 0 || maxX > 160 || maxY > 96) violations.push({cue:def.cue,layer:layer.id,frame:index,message:`layer exceeds 160x96 stage: [${minX},${minY}]..[${maxX},${maxY}]`});
      });
    }
  }
  return violations;
}

export function assertPeripheralMotionContracts(definitions: readonly PeripheralMotionDefinition[] = PERIPHERAL_MOTIONS): void {
  const violations = validatePeripheralMotion(definitions);
  if (violations.length) throw new Error('Peripheral motion contract failed:\n' + violations.map(v=>`${v.cue}/${v.layer}${v.frame === undefined ? '' : `/f${v.frame+1}`}: ${v.message}`).join('\n'));
}

export function motionDebugSummary(definitions: readonly PeripheralMotionDefinition[] = PERIPHERAL_MOTIONS) {
  return definitions.map(def => ({cue:def.cue,durationMs:def.durationMs,fixedLayers:def.layers.filter(layer=>layer.policy.kind==='fixed').map(layer=>layer.id),movingLayers:def.layers.filter(layer=>layer.policy.kind==='track').map(layer=>layer.id),toggledLayers:def.layers.filter(layer=>layer.policy.kind==='toggle').map(layer=>layer.id)}));
}
