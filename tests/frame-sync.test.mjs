/** Host algorithms/reference checks. Native WGSL/pixels require frame-sync.html. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {timestampRanges,decodePerformance,timingMask,timingDetail,RAW_OFFSET,EXTRA_OFFSET} from '../src/gpu/performance.js';
import {metricPacket,queryWords,applyMetricReference,emptyMetrics,rangeOracle} from './metrics-reference.mjs';
import {FrameSyncLog,hudScissor} from '../src/gpu/frame-sync.js';
import {FrameCadence} from '../src/gpu/cadence.js';
import {DRAW_HEADER_WORDS,DRAW_HEADS} from '../src/gpu/arena-layout.js';
const near=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
function ranges(list) {const q=queryWords(),v=new DataView(q.buffer);for(const[i,a,b]of list){v.setBigUint64(i*16,1000000000000000000n+BigInt(Math.round(a*1e6)),true);v.setBigUint64(i*16+8,1000000000000000000n+BigInt(Math.round(b*1e6)),true);}return q;}
test('overlapping 15ms/16ms pass ranges produce 16ms covered, not 31ms busy time',()=>{
 const q=ranges([[0,0,15],[7,.1,16.1]]),r=timestampRanges(q,129);
 near(r.spanMs,16.1);near(r.coveredMs,16.1);near(r.overlapMs,14.9);near(r.sumMs,31);near(r.gapMs,0);
 const v=decodePerformance(applyMetricReference(emptyMetrics(),metricPacket({flags:2}),q));
 near(v.current.totalMs,16.1);near(v.current.overlapMs,14.9);assert.equal(v.current.phasesMs.hud,-1,'merged HUD must be unavailable');
});
test('frame envelope uses earliest start and latest end, not assumed encoding order',()=>{
 const q=ranges([[0,4,18],[7,1,17]]),r=timestampRanges(q,129);
 near(r.spanMs,17);near(r.coveredMs,17);near(r.overlapMs,13);
 const v=decodePerformance(applyMetricReference(emptyMetrics(),metricPacket({flags:2}),q));near(v.current.totalMs,17);
});
test('time gaps remain visible and are never rounded down to a convenient CPU duration',()=>{
 const r=timestampRanges(ranges([[0,0,.2],[7,16,16.1]]),129);
 near(r.spanMs,16.1);near(r.coveredMs,.3);near(r.gapMs,15.8);near(r.overlapMs,0);
});
test('duplicate and nested timestamp ranges count coverage exactly once',()=>{
 const r=timestampRanges(ranges([[0,0,1],[1,0,1],[2,.2,.6],[3,1,1]]),15);
 near(r.spanMs,1);near(r.coveredMs,1);near(r.sumMs,2.4);near(r.overlapMs,1.4);
});
test('10000 randomized interval sets agree with independent signed-endpoint sweep oracle',()=>{
 let seed=0x13524678;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let c=0;c<10000;c++){
  const values=[];for(let i=0;i<8;i++){const a=random()%200000/1000;values.push([i,a,a+random()%100000/1000]);}
  const q=ranges(values),mask=1+random()%255,a=timestampRanges(q,mask),b=rangeOracle(q,mask);
  assert.equal(a.valid,b.valid);for(const[key,ref]of [['spanMs','span'],['coveredMs','covered'],['overlapMs','overlap'],['gapMs','gaps'],['sumMs','sum']])near(a[key],b[ref],1e-9);
 }
});
test('invalid active ranges are explicit; unmeasured stale or reversed slots are ignored',()=>{
 const q=queryWords();q[6]=0;q[7]=0;assert.equal(timestampRanges(q,2).valid,false);
 assert.equal(timestampRanges(q,129).valid,true);assert.equal(timestampRanges(q,0).valid,false);
 assert.throws(()=>timestampRanges(new Uint32Array(5),1),/sixteen/);
});
test('layout marker distinguishes executed layout from an encoded zero-work layout pass',()=>{
 const q=queryWords(),p=metricPacket();const idle=decodePerformance(applyMetricReference(emptyMetrics(),p,q,false));
 assert.equal(idle.current.layoutExecuted,false);assert.equal(idle.current.layoutMs,0);near(idle.current.phasesMs.layout,.02);
 const executed=decodePerformance(applyMetricReference(emptyMetrics(),p,q,true));assert.equal(executed.current.layoutExecuted,true);near(executed.current.layoutMs,.02);
});
test('compact masks bracket true split work while merged stages remain unavailable',()=>{
 assert.equal(timingMask(2),129);assert.equal(timingMask(2|4),139);assert.equal(timingMask(2|8),141);assert.equal(timingMask(2|4|8),143);
 assert.equal(timingMask(2|512|4|8|256|1),255);assert.equal(timingMask(2|512),169);assert.equal(timingMask(512),0);
 assert.equal(timingDetail(),'frame');assert.throws(()=>timingDetail('fake'),/timingDetail/);
});
test('raw u64 timestamp words and submitted serial stay exact through history wrap',()=>{
 const w=emptyMetrics();for(let i=0;i<150;i++)applyMetricReference(w,metricPacket({serial:i+1,flags:2}),queryWords(undefined,999999999999990000n+BigInt(i)*1000000n));
 const r=decodePerformance(w);assert.equal(r.rawTimestampFrame,150);assert.equal(r.current.frame,150);assert.equal(r.rawTimestamps[0].startNs,'1000000000148990000');
 assert.equal(r.rawTimestamps[1].measured,false);assert.equal(r.rawTimestamps[1].startNs,'0');assert.equal(w[EXTRA_OFFSET+6],129);assert.ok(RAW_OFFSET+32<=w.length);
});
test('rAF cadence counts observations over time, not smoothed reciprocal or nominal Hz',()=>{
 const c=new FrameCadence();c.tick(0);c.tick(1);c.tick(3);c.tick(7);near(c.hz,3000/7);near(c.intervalMs,7/3);
 c.tick(1000);assert.equal(c.hz,0);for(let i=1;i<=180;i++)c.tick(1000+i*1000/240);near(c.hz,240);assert.ok(c.count<=120);
 c.tick(NaN);assert.equal(c.hz,0);
});
test('host log preserves real intervals and makes no claims about GPU queue depth',()=>{
 const log=new FrameSyncLog(2);for(let i=0;i<3;i++)log.record(i+1,i*8,i*8+1,i*8+1,i*8+1.2,i*8+1.3,i*8+1.4,1);
 const r=log.inspect();assert.deepEqual(r.samples.map(x=>x.frame),[2,3]);near(r.cpuEncodeMs.median,.2);near(r.cpuSubmitMs.median,.1);near(r.submitIntervalMs.median,8);near(r.callbackOffsetMs.median,1);
 assert.match(r.scope,/not GPU/);assert.throws(()=>new FrameSyncLog(1),/capacity/);
});
test('scissor conservatively contains every possible panel/shadow contribution at all tested scales',()=>{
 for(const [width,height] of [[1600,900],[1000,700],[320,568],[100,100],[1,1]])for(const dpr of [.5,1,1.25,2]){
  const v={width,height,dpr,w:Math.max(1,Math.floor(width*dpr)),h:Math.max(1,Math.floor(height*dpr))},r=hudScissor(v);
  assert.ok(r.every(Number.isInteger));assert.ok(r.every(n=>n>=0));
  const scale=Math.max(.01,Math.min(1,(width-16)/420,(height-16)/338)),x=Math.max(8,width-420*scale-12),y=Math.max(8,height-338*scale-74);
  // Test the rounded rectangle's conservative bounding box, including its 10px shadow.
  for(let py=0;py<v.h;py+=Math.max(1,Math.floor(v.h/41)))for(let px=0;px<v.w;px+=Math.max(1,Math.floor(v.w/41))){
   const qx=(px+.5)/dpr,qy=(py+.5)/dpr;
   if(qx>=x-10*scale&&qx<=x+430*scale&&qy>=y-10*scale&&qy<=y+348*scale)assert.ok(px>=r[0]&&px<r[0]+r[2]&&py>=r[1]&&py<r[1]+r[3]);
  }
 }
});
test('partitioned painter keys remain ordered across all 512 nodes and 130 grid sections',()=>{
 assert.equal(DRAW_HEADS,2708);assert.equal(DRAW_HEADER_WORDS%4,0);
 for(let node=0;node<512;node++){
  let previous=node*8388608+32767;
  for(let section=0;section<130;section++){const first=node*8388608+(section+1)*32768,last=first+32767;assert.ok(first>previous);assert.ok(last<2**32);assert.ok(512+section<DRAW_HEADS);previous=last;}
  assert.ok(previous<(node+1)*8388608);
 }
});
test('independent section allocation interleavings do not change painter order or list traversal',()=>{
 let seed=71337;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(let pass=0;pass<100;pass++){
  const lists=Array.from({length:130},(_,i)=>Array.from({length:rand()%32},(_,j)=>({key:17*8388608+(i+1)*32768+j,id:`${i}:${j}`})));
  const pending=lists.map(x=>[...x]),items=[],heads=Array(130).fill(-1);let live=lists.flat().length;
  while(live){const i=rand()%130;if(!pending[i].length)continue;items.push({...pending[i].shift(),next:heads[i]});heads[i]=items.length-1;live--;}
  assert.deepEqual(items.toSorted((a,b)=>a.key-b.key).map(x=>x.id),lists.flat().map(x=>x.id));
  heads.forEach((head,i)=>{const actual=[];while(head>=0){actual.push(items[head].id);head=items[head].next;}assert.deepEqual(actual.reverse(),lists[i].map(x=>x.id));});
 }
});
test('new GPU display-list and layout markers retain explicit overflow and no workgroup spin locks',async()=>{
 const emit=await readFile(new URL('../shaders/emit.wgsl',import.meta.url),'utf8'),input=await readFile(new URL('../shaders/input.wgsl',import.meta.url),'utf8');
 assert.match(emit,/emissionRemaining==0u/);assert.match(emit,/emissionHead=512u\+section/);assert.match(emit,/@workgroup_size\(32\)/);assert.match(input,/state\[58\]=0u/);assert.match(input,/state\[58\]=1u/);
});

// ABI-3 words 54..57 hold live font composition/combining directories. The new
// per-frame marker uses reserved word 58; clearing 54 would corrupt accents.
test('layout instrumentation never aliases the retained Unicode font directories',async()=>{
 const compiler=await readFile(new URL('../src/core/compiler.js',import.meta.url),'utf8');
 const input=await readFile(new URL('../shaders/input.wgsl',import.meta.url),'utf8');
 const metrics=await readFile(new URL('../shaders/metrics.wgsl',import.meta.url),'utf8');
 assert.match(compiler,/state\[54\] = packedFonts\.composition/);
 assert.match(compiler,/state\[57\] = marks\.length \/ 2/);
 assert.doesNotMatch(input,/state\[5[4-7]\]\s*(?:[+*/-]?=|\+\+|--)/);
 assert.match(input,/state\[58\]=0u/);assert.match(input,/state\[58\]=1u/);
 assert.match(metrics,/metricState\[58\]!=0u/);
 assert.doesNotMatch(compiler,/state\[58\]\s*=/,'word 58 starts zero in existing ABI-3 compiled objects');
});
