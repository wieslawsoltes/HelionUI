import test from 'node:test';
import assert from 'node:assert/strict';
import { QueueProgress } from '../src/gpu/queue-progress.js';
import { FrameOpportunityLog } from '../src/gpu/frame-sync.js';
import { timingMask, decodePerformance } from '../src/gpu/performance.js';
import { metricPacket, emptyMetrics, applyMetricReference, queryWords } from './metrics-reference.mjs';
function make(queueOverride) {
 const pending=[],events=[],errors=[];let now=100;
 const queue=queueOverride??{onSubmittedWorkDone(){return new Promise((resolve,reject)=>pending.push({resolve,reject}));}};
 const p=new QueueProgress(queue,{now:()=>now,onComplete:e=>events.push(e),onError:e=>errors.push(e)});
 return {p,pending,events,errors,advance:d=>{now+=d;}};
}
test('independent tails are requested synchronously, not chained through completion callbacks',async()=>{
 const f=make();const p1=f.p.request(1,{independent:true}),p2=f.p.request(2,{independent:true});
 assert.equal(f.pending.length,2);assert.notEqual(p1,p2);assert.equal(f.events.length,0);
 f.advance(17);f.pending[0].resolve();await p1;assert.equal(f.events[0].released,1);
 assert.equal(f.pending.length,2,'completion must not request another tail');
 f.advance(1);f.pending[1].resolve();await p2;assert.equal(f.events[1].released,1);assert.equal(f.p.acknowledged,2);
});
test('same serial reuses its in-flight fence and never duplicates credit',async()=>{
 const f=make();const a=f.p.request(1,{independent:true});assert.equal(f.p.request(1,{force:true}),a);
 assert.equal(f.p.requests,1);f.pending[0].resolve();await a;await f.p.request(1,{force:true});
 assert.equal(f.p.requests,1);assert.equal(f.events.length,1);
});
test('later completion acknowledges a prefix once even with reversed callback delivery',async()=>{
 const f=make();const a=f.p.request(1,{independent:true}),b=f.p.request(2,{independent:true});
 f.pending[1].resolve();await b;assert.equal(f.p.pending.size,0);assert.equal(f.events[0].released,2);
 f.pending[0].resolve();await a;assert.equal(f.events[1].released,0);assert.equal(f.p.acknowledged,2);
});
test('unbounded reference retains sparse progress and explicit latest-tail capture',async()=>{
 const f=make(),a=f.p.request(1);assert.equal(f.p.request(16),a);assert.equal(f.p.requests,1);
 const b=f.p.request(24,{force:true});assert.equal(f.p.requests,2);assert.equal(f.p.lastRequested,24);
 f.pending[0].resolve();f.pending[1].resolve();await Promise.all([a,b]);assert.equal(f.p.acknowledged,24);
});
test('switching from sparse to bounded requests a current tail immediately',async()=>{
 const f=make();const a=f.p.request(1),b=f.p.request(22,{independent:true});assert.equal(f.pending.length,2);
 f.pending[1].resolve();await b;assert.equal(f.events[0].released,22);f.pending[0].resolve();await a;
});
test('disposal ignores late completions without unhandled promise rejection',async()=>{
 const f=make(),a=f.p.request(1,{independent:true});f.p.dispose();f.pending[0].resolve();await a;
 assert.equal(f.events.length,0);assert.equal(f.p.pending.size,0);await f.p.request(2);assert.equal(f.p.requests,1);
});
test('queue failure propagates to explicit waiters and does not silently return frame credit',async()=>{
 const f=make(),a=f.p.request(1,{independent:true});f.pending[0].reject(new Error('device lost'));
 await assert.rejects(a,/device lost/);assert.equal(f.errors.length,1);assert.equal(f.events.length,0);assert.equal(f.p.acknowledged,0);
});
test('synchronous queue errors are reported through the same asynchronous failure contract',async()=>{
 const f=make({onSubmittedWorkDone(){throw new Error('destroyed');}});
 await assert.rejects(f.p.request(1,{independent:true}),/destroyed/);assert.equal(f.errors.length,1);
});
test('invalid checkpoint serials fail before touching the queue',()=>{
 const f=make();for(const n of [-1,.1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>f.p.request(n),/serial/);
 assert.equal(f.p.requests,0);
});
test('opportunity history retains deferrals and real callback gaps without inventing scanout drops',()=>{
 const l=new FrameOpportunityLog(3);l.record(0,1,0,1,0,2);l.record(8,9,0,2,1,2);l.record(16,17,1,0,2,2);l.record(80,81,0,3,1,2);
 const r=l.inspect();assert.equal(r.counts['deferred-capacity'],1);assert.equal(r.counts.submitted,2);
 assert.deepEqual(r.samples.map(x=>x.submittedFrame),[2,null,3]);assert.equal(r.callbackIntervalMs.max,64);
 assert.match(r.scope,/NOT hardware/);assert.throws(()=>new FrameOpportunityLog(1));
});
test('new pacing provenance bit neither changes measured GPU phases nor fabricates GPU cost',()=>{
 for(let flags=0;flags<4096;flags++)assert.equal(timingMask(flags),timingMask(flags|4096));
 const plain=decodePerformance(applyMetricReference(emptyMetrics(),metricPacket({flags:2}),queryWords()));
 const paced=decodePerformance(applyMetricReference(emptyMetrics(),metricPacket({flags:2|4096}),queryWords()));
 assert.equal(plain.vsyncPacing,'unbounded');assert.equal(paced.vsyncPacing,'bounded');
 assert.deepEqual(plain.current,paced.current);assert.deepEqual(plain.rawTimestamps,paced.rawTimestamps);
});
