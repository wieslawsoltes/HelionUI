import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FrameGate } from '../src/gpu/frame-gate.js';
import { SubmissionTasks } from '../src/gpu/submission.js';
import { packFrameInterval,timestampMilliseconds,decodePerformance } from '../src/gpu/performance.js';
import { metricPacket,queryWords,applyMetricReference,emptyMetrics } from './metrics-reference.mjs';
const close=(a,b,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const result=(options,queries=queryWords())=>decodePerformance(applyMetricReference(emptyMetrics(),metricPacket(options),queries));
test('direct intervals fit a 64-byte packet without consuming invalidation bit',()=>{
 for(const ms of [0,.001,.3,8.333333,16.66666,1000,100000,2097151])for(const invalidate of [false,true]){
  const word=packFrameInterval(ms,invalidate);assert.equal(word&1,Number(invalidate));close((word>>>1)/1024,ms,1/1024);
 }
 for(const ms of [NaN,Infinity,-1,3000000])assert.equal(packFrameInterval(ms),0);
});
test('u64 timestamps subtract low words with borrow before conversion to milliseconds',()=>{
 const start=0xabcdef12fffffff0n,end=start+300000n;
 const pair=n=>[Number(n&0xffffffffn),Number(n>>32n)];close(timestampMilliseconds(pair(start),pair(end)),.3);
});
test('reversed or implausibly old timestamps are invalid, never fake zero GPU work',()=>{
 assert.equal(timestampMilliseconds([1000,5],[500,5]),-1);assert.equal(timestampMilliseconds([0,0],[0,100]),-1);
 assert.equal(timestampMilliseconds([5,7],[5,7]),0,'equal quantized timestamps remain representable');
});
test('complete GPU span includes every phase including HUD and presentation',()=>{
 const r=result({});close(r.current.totalMs,.3);close(r.current.passSumMs,.3);
 close(r.current.uiRenderMs,.17);close(r.current.phasesMs.hud,.03);close(r.current.phasesMs.present,.06);
});
test('CPU encode, GPU span and between-pass idle/preemption are independent quantities',()=>{
 const r=result({cpuEncode:.3},queryWords(undefined,10000000n,2));
 close(r.current.totalMs,14.3);close(r.current.passSumMs,.3);close(r.current.cpuEncodeMs,.3);
});
test('GPU fields become N/A in CPU-only mode, not incorrectly substituted CPU durations',()=>{
 const r=result({flags:0,cpuEncode:.3,cpuLayout:.025});assert.equal(r.source,'cpu-encoding-only');
 close(r.current.totalMs,.3);close(r.current.layoutMs,.025);assert.equal(r.current.uiRenderMs,-1);
 assert.ok(Object.values(r.current.phasesMs).every(x=>x===-1));assert.equal(r.current.passSumMs,-1);assert.equal(r.current.dataMs,-1);
});
test('skipped optional passes use explicit zero, ignoring stale query slot contents',()=>{
 const q=queryWords();q[4]=0xffffffff;q[5]=0xffffffff;q[8]=0xffffffff;q[9]=0xffffffff;
 const r=result({flags:2|512},q);
 assert.equal(r.current.phasesMs.layout,0);assert.equal(r.current.phasesMs.data,0);assert.equal(r.current.phasesMs.hud,0);assert.equal(r.current.phasesMs.glyph,0);assert.equal(r.timestampErrors,0);
});
test('malformed active pair remains invalid in both current values and detailed history',()=>{
 const q=queryWords();q[15]=q[13]-1;const r=result({},q);
 assert.ok(r.timestampErrors>0);assert.equal(r.current.phasesMs.scene,-1);assert.equal(r.current.passSumMs,-1);
});
test('FPS is elapsed-time rate, not arithmetic mean of instantaneous reciprocal rates',()=>{
 const words=emptyMetrics();for(const [i,interval] of [1,2,4].entries())applyMetricReference(words,metricPacket({interval,serial:i+1}),queryWords());
 close(decodePerformance(words).submitFPS,3000/7,.001);
});
test('long stalls stay in graph history and invalidate rather than inflate the rate',()=>{
 const words=emptyMetrics();for(const interval of [8,8,1500])applyMetricReference(words,metricPacket({interval}),queryWords());
 const r=decodePerformance(words);assert.equal(r.current.submitIntervalMs,1500);assert.equal(r.submitFPS,0);
 applyMetricReference(words,metricPacket({interval:10}),queryWords());close(decodePerformance(words).submitFPS,100);
});
test('mode-change reset does not mix rates from ASAP and vsync',()=>{
 const w=emptyMetrics();applyMetricReference(w,metricPacket({interval:8}),queryWords());
 applyMetricReference(w,metricPacket({flags:2|64,reset:true,interval:0}),queryWords());const r=decodePerformance(w);
 assert.equal(r.history.length,1);assert.equal(r.submissionMode,'asap');assert.equal(r.submitFPS,0);
});
test('extended histories retain phase-to-frame correspondence after multiple wraps',()=>{
 const w=emptyMetrics();for(let i=1;i<=300;i++)applyMetricReference(w,metricPacket({serial:i,interval:i/10}),queryWords());
 const r=decodePerformance(w);assert.equal(r.history.length,120);assert.equal(r.history[0].frame,181);assert.equal(r.current.frame,300);
 for(const row of r.history)close(row.submitIntervalMs,row.frame/10,1/1024);
});
test('invalid or old metric schema is rejected instead of mislabeling old Render values',()=>{
 assert.throws(()=>decodePerformance(new Uint32Array(512)),/schema/);assert.throws(()=>decodePerformance(emptyMetrics()),/schema/);
});
test('zero gate means no app acknowledgement throttle, bounded modes remain explicit',()=>{
 const gate=new FrameGate();for(let i=0;i<500;i++)assert.ok(gate.acquire());gate.release(500);assert.equal(gate.inFlight,0);
 for(const limit of [8,16,32]){const g=new FrameGate(limit);for(let i=0;i<limit;i++)assert.ok(g.acquire());assert.equal(g.acquire(),false);}
});
test('real MessageChannel task scheduler yields, cancels stale jobs, and disposes',async()=>{
 const pump=new SubmissionTasks();let ran=0;
 try {
  pump.schedule(()=>ran++);assert.equal(ran,0);pump.cancel();
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Task did not execute')),1000);pump.schedule(()=>{ran++;clearTimeout(timeout);resolve();});});
  assert.equal(ran,1);pump.schedule(()=>ran++);pump.dispose();await new Promise(resolve=>setTimeout(resolve,5));assert.equal(ran,1);
 }finally{pump.dispose();}
});
test('time delta packing does not accidentally invalidate all retained tiles',async()=>{
 for(const file of ['input','strips']){const source=await readFile(new URL(`../shaders/${file}.wgsl`,import.meta.url),'utf8');
  assert.doesNotMatch(source,/frame\.flags\.x\s*!=/);assert.match(source,/\(frame\.flags\.x&1u\)!=0u/);
 }
});
test('renderer metric shader has bounded per-frame histories and no f32-uptime interval subtraction',async()=>{
 const s=await readFile(new URL('../shaders/metrics.wgsl',import.meta.url),'utf8');assert.match(s,/rangeSummary\(mask\)/);assert.match(s,/metricFrame.flags.x>>1u/);assert.match(s,/512u\+slot\*24u/);assert.doesNotMatch(s,/metricFrame.viewport.w/);
});

test('GPU completion rate exposes overload instead of inflating FPS by merely submitting more',()=>{
 const w=emptyMetrics();for(let i=0;i<120;i++)applyMetricReference(w,metricPacket({serial:i+1,interval:1000/120}),queryWords(undefined,BigInt(1000000000+i*20000000)));
 const r=decodePerformance(w);close(r.submitFPS,120,.01);close(r.gpuCompletionFPS,50);close(r.current.gpuCompletionIntervalMs,20);
});
test('quantized equal completion timestamps do not drop frames from the GPU rate numerator',()=>{
 const w=emptyMetrics();for(let i=0;i<5;i++)applyMetricReference(w,metricPacket({serial:i+1,interval:.03}),queryWords(undefined,1000000000n+BigInt(Math.floor(i/2)*100000)));
 close(decodePerformance(w).gpuCompletionFPS,20000,.01);
});

test('GPU clock reversal produces a rate gap and explicit error without falsifying pass costs',()=>{
 const w=emptyMetrics();applyMetricReference(w,metricPacket({serial:1}),queryWords(undefined,5000000000n));
 applyMetricReference(w,metricPacket({serial:2}),queryWords(undefined,1000000000n));const r=decodePerformance(w);
 assert.equal(r.gpuCompletionFPS,null);assert.equal(r.current.gpuCompletionIntervalMs,-1);assert.equal(r.timestampErrors,1);close(r.current.passSumMs,.3);
});
