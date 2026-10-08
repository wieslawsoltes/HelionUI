import test from 'node:test';import assert from 'node:assert/strict';
import { simulate } from '../tools/simulate-pacing.mjs';
for(const hz of [60,90,120,144,165,240])test(`queue model: paced ${hz}Hz retains every fast-work rAF with 1.5-period notification delay`,async()=>{
 const r=await simulate({hz,gpuServiceMs:.2,notificationMs:1500/hz});
 assert.equal(r.submissions,r.callbacks);assert.equal(r.deferrals,0);assert.equal(r.peakUnacknowledged,2);
});
test('queue model: independent fences remove the legacy chained-notification bubbles',async()=>{
 const old=await simulate({policy:'legacy-chained'}),paced=await simulate({policy:'paced'});
 assert.ok(old.deferrals>0);assert.equal(paced.deferrals,0);assert.equal(paced.submissions,paced.callbacks);
});
test('queue model: 12ms work at 120Hz is bounded instead of building seconds of stale work',async()=>{
 const unbounded=await simulate({policy:'unbounded',gpuServiceMs:12,notificationMs:1});
 const paced=await simulate({policy:'paced',gpuServiceMs:12,notificationMs:1});
 assert.ok(unbounded.peakUnfinishedModelFrames>100);assert.ok(unbounded.modelSubmitToGpuEndMs.max>1000);
 assert.ok(paced.peakUnfinishedModelFrames<=2);assert.ok(paced.modelSubmitToGpuEndMs.max<=24);
 assert.ok(paced.deferrals>0,'not a false guarantee of 120 completed frames/s when work exceeds capacity');
 assert.ok(Math.abs(paced.completedByEnd-unbounded.completedByEnd)<=2,'bound latency, not manufacture throughput');
});
