/** Deterministic QUEUE MODEL, NOT a browser/GPU benchmark.
 * Exercises the real FrameGate and QueueProgress classes against a single-server
 * queue with explicitly chosen service and notification times.
 */
import { FrameGate } from '../src/gpu/frame-gate.js';
import { QueueProgress } from '../src/gpu/queue-progress.js';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export async function simulate({ policy = 'paced', hz = 120, durationMs = 3000, gpuServiceMs = .3, notificationMs = 13 } = {}) {
  let now = 0, gpuTail = 0, serial = 0, deferrals = 0, peakHardwareWork = 0;
  const gate = new FrameGate(policy === 'unbounded' ? 0 : 2), events = [], frames = [];
  const queue = { onSubmittedWorkDone() {
    const readyAt = Math.max(now, gpuTail) + notificationMs;
    return new Promise(resolve => events.push({ at: readyAt, resolve }));
  } };
  const progress = new QueueProgress(queue, { now: () => now, onComplete: ({ released }) => {
    gate.release(released);
    // Precisely the old defect: register the newer tail only AFTER an older
    // callback has arrived, even when that newer GPU frame already completed.
    if (policy === 'legacy-chained' && gate.inFlight > 0) progress.request(serial);
  } });
  async function advance(target) {
    for (;;) {
      events.sort((a,b)=>a.at-b.at); if (!events.length || events[0].at > target + 1e-9) break;
      const event = events.shift(); now = event.at; event.resolve(); await Promise.resolve(); await Promise.resolve();
    }
    now = target;
  }
  const callbacks = Math.floor(durationMs * hz / 1000), step = 1000 / hz;
  for (let i = 0; i < callbacks; i++) {
    await advance(i * step);
    if (!gate.acquire()) { deferrals++; continue; }
    serial++;
    const start = Math.max(now, gpuTail), end = start + gpuServiceMs; gpuTail = end;
    frames.push({ serial, submittedAt: now, gpuStart: start, gpuEnd: end });
    peakHardwareWork = Math.max(peakHardwareWork, frames.filter(f=>f.gpuEnd>now).length);
    if (policy === 'paced') progress.request(serial, { independent: true });
    else if (policy === 'legacy-chained' || serial === 1 || serial - progress.lastRequested >= 16) progress.request(serial);
  }
  await advance(durationMs);
  const summarize = a => { a.sort((a,b)=>a-b); const q=p=>a[Math.floor((a.length-1)*p)]??null;return{median:q(.5),p95:q(.95),max:q(1)}; };
  const result = { policy, modelOnly: true, assumptions: { hz, durationMs, gpuServiceMs, notificationMs,
      queue:'serial nonpreemptive; ideal periodic rAF; no browser compositor, driver, DVFS, or scanout model' },
    callbacks, submissions: serial, deferrals, completedByEnd: frames.filter(f=>f.gpuEnd<=durationMs).length,
    unacknowledgedAtEnd: gate.inFlight, peakUnacknowledged: gate.peak, peakUnfinishedModelFrames: peakHardwareWork,
    modelSubmitToGpuEndMs: summarize(frames.map(f=>f.gpuEnd-f.submittedAt)),
    checkpoints: progress.requests };
  progress.dispose();return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const scenarios=[];
  for(const gpuServiceMs of [.3,12]) for(const policy of ['unbounded','legacy-chained','paced'])
    scenarios.push(await simulate({gpuServiceMs,notificationMs:gpuServiceMs<1?13:1,policy}));
  const report={scope:'Deterministic scheduling regression model. NOT measured hardware FPS, latency or dropped display frames.',scenarios};
  const output=process.argv.find(x=>x.startsWith('--output='))?.slice(9);
  if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
