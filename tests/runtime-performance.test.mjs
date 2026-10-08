import {createWorkbench} from '../src/playground/workbench.js';
/** Host API/encoding regression tests with a deliberately non-executing WebGPU fake.
 * These tests do NOT compile WGSL, execute GPU algorithms, or prove frame rate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { HelionSurface } from '../src/gpu/runtime.js';
import { h, compile } from '../src/core/compiler.js';
import { fixtureFont } from './font-fixture.mjs';
import { diagnosticFont } from '../src/text/fonts.js';
import { Opcode } from '../src/core/schema.js';
const shaders = Object.fromEntries(await Promise.all(['common','templates','designer','curve-coverage','unicode','shaping','shaping-bidi','paragraph','typography-ui','text','editor','editor-render','models','docking','controls','presenter','data-source','layout','input','data','flatten','emit','designer-render','strips','glyph-cache','present','metrics','hud-common','hud-viewport','hud','blit'].map(async name => [name, await readFile(new URL(`../shaders/${name}.wgsl`, import.meta.url), 'utf8')])));
async function fixture({ timestamps = true, options = {}, rafFirstId = 1, viewOverride = null } = {}) {
  const saved = new Map(), writes = [], graphs = [], pending = [], requests = [], querySets = [], maps = [];
  const set = (name, value) => { saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { configurable: true, writable: true, value }); };
  set('GPUBufferUsage', { MAP_READ: 1, COPY_SRC: 4, COPY_DST: 8, UNIFORM: 64, STORAGE: 128, INDIRECT: 256, QUERY_RESOLVE: 512 });
  set('GPUTextureUsage', { COPY_SRC: 1, TEXTURE_BINDING: 4, STORAGE_BINDING: 8 });
  set('GPUShaderStage', { COMPUTE: 4 }); set('GPUMapMode', { READ: 1 });
  set('__HELION_SHADERS__', shaders); set('ResizeObserver', class { observe() {} disconnect() {} });
  set('window', { devicePixelRatio: 1 }); const listeners = new Map();
  set('document', { hidden: false, addEventListener(type, callback) { listeners.set(type, callback); } });
  let clock = 1000; set('performance', { now: () => clock });
  const taskMessages = [];
  set('MessageChannel', class {
    constructor() { const self = this; this.closed = false;
      this.port1 = { onmessage: null, close() { self.closed = true; } };
      this.port2 = { postMessage(value) { taskMessages.push(() => { if (!self.closed) self.port1.onmessage?.({ data: value }); }); }, close() { self.closed = true; } };
    }
  });
  let nextRAF = rafFirstId - 1; const rafs = new Map(); set('requestAnimationFrame', fn => { rafs.set(++nextRAF, fn); return nextRAF; }); set('cancelAnimationFrame', id => rafs.delete(id));
  let serial = 0;
  const device = {
    addEventListener() {}, lost: new Promise(() => {}), pushErrorScope() {}, popErrorScope: async () => null,
    createBuffer(d) { return { ...d, id: ++serial, destroy() {this.destroyed=true;}, mapAsync() { maps.push(this); return Promise.resolve(); }, getMappedRange() { return new ArrayBuffer(this.size); }, unmap() {} }; },
    createTexture(d) { return { ...d, createView: () => ({}), destroy() {} }; },
    createShaderModule: d => ({ ...d, getCompilationInfo: async () => ({ messages: [] }) }),
    createBindGroupLayout: d => d, createPipelineLayout: d => d, createBindGroup: d => d,
    createComputePipelineAsync: async d => ({ ...d, getBindGroupLayout: () => ({}) }),
    createRenderPipelineAsync: async d => ({ ...d, getBindGroupLayout: () => ({}) }),
    createQuerySet(d) { const q = { ...d, destroy() {} }; querySets.push(q); return q; },
    createCommandEncoder() {
      const commands = [];
      return {
        beginComputePass(descriptor = {}) {
          const record = { type: 'compute', descriptor, dispatches: [] }; commands.push(record); let pipeline, group;
          return { setPipeline(p) { pipeline = p; }, setBindGroup(_index, g, offsets) { group = g; },
            dispatchWorkgroups(...counts) { record.dispatches.push({ entry: pipeline.compute.entryPoint, counts, group }); },
            dispatchWorkgroupsIndirect(buffer, offset) {
              assert.ok(!group.entries.some(e => e.binding === 6), 'indirect consumers must not write their argument buffer');
              record.dispatches.push({ entry: pipeline.compute.entryPoint, indirectOffset: offset, group });
            }, end() {} };
        },
        beginRenderPass(descriptor) { const record = { type: 'present', descriptor, draws: [] }; commands.push(record); let pipeline, scissor = null; return { setPipeline(p) { pipeline = p; }, setBindGroup(_i, g) { record.group = g; }, setScissorRect(...rect) { scissor = rect; }, draw() { record.draws.push({ entry: pipeline.fragment.entryPoint, scissor, group: record.group }); }, end() {} }; },
        resolveQuerySet(querySet, first, count, buffer, offset) { commands.push({ type: 'resolve', querySet, first, count, buffer, offset }); },
        copyBufferToBuffer(source,sourceOffset,destination,destinationOffset,size) {commands.push({type:'copy',source,sourceOffset,destination,destinationOffset,size});}, finish: () => commands
      };
    },
    queue: {
      writeBuffer(buffer, offset, data, start = 0, size) {
        const bytes = ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
        writes.push({ buffer, offset, data: bytes.slice(start, size == null ? undefined : start + size) });
      }, submit(commands) { graphs.push(...commands); }, onSubmittedWorkDone() { return new Promise((resolve, reject) => { resolve.reject = reject; pending.push(resolve); }); }
    }, destroy() {this.destroyed=true;}
  };
  const adapter = { info: { description: 'NON-EXECUTING HOST TEST FAKE' }, features: new Set(timestamps ? ['timestamp-query'] : []), limits: { maxStorageBufferBindingSize: 256 * 1024 ** 2, maxBufferSize: 256 * 1024 ** 2 }, requestDevice: async descriptor => { requests.push(descriptor); return device; } };
  set('navigator', { gpu: { requestAdapter: async () => adapter, getPreferredCanvasFormat: () => 'bgra8unorm' } });
  const context = { configure() {}, unconfigure() {}, getCurrentTexture: () => ({ createView: () => ({}) }) };
  const canvas = { width: 0, height: 0, getContext: () => context, getBoundingClientRect: () => ({ width: 640, height: 480 }) };
  const view = viewOverride ?? h('Grid', { rows: '40 *' }, h('TextBox', { id: 'filter' }), h('DataGrid', { id: 'table', row: 1, rowCount: 65536, filter: 'filter' }));
  let surface;
  const restore = () => { surface?.dispose(); for (const [name, value] of saved) { if (value) Object.defineProperty(globalThis, name, value); else delete globalThis[name]; } };
  try { surface = await HelionSurface.mount(canvas, view, { input: false, autoStart: false, performanceHUD: true, deferHUD: false, fonts: [diagnosticFont()], ...options }); }
  catch (e) { restore(); throw e; }
  return { surface, device, writes, graphs, requests, querySets, maps, rafs, pending, close: restore,
    tick(now) { clock=now; const jobs=[...rafs.values()]; rafs.clear(); for(const callback of jobs) callback(now); },
    async acknowledge(index = 0) { const done = pending.splice(index, 1)[0]; if (!done) throw new Error("No such checkpoint"); done(); await Promise.resolve(); await Promise.resolve(); },
    async complete() { for(let i=0; i<64 && pending.length; i++) { for (const done of pending.splice(0)) done(); await Promise.resolve(); await Promise.resolve(); } },
    advance(ms) { clock += ms; }, task() { taskMessages.shift()?.(); }, taskMessages,
    visible(value) { document.hidden = !value; listeners.get('visibilitychange')?.(); },
    latest() { return graphs.at(-1); }
  };
}
const dispatches = graph => graph.flatMap(p => p.dispatches ?? []);
test('runtime host: strict one-frame mode refuses stale submissions before draining or uploading input', async () => {
  const f = await fixture({options:{maxFramesInFlight:1}}); try {
    assert.equal(f.surface.render(), true); const writes = f.writes.length, graphCount = f.graphs.length;
    for (const c of 'hello') f.surface.send(Opcode.Text, { c: c.codePointAt(0) });
    assert.equal(f.surface.render(), false); assert.equal(f.writes.length, writes); assert.equal(f.graphs.length, graphCount); assert.equal(f.surface.commands.length, 5);
    await f.complete(); assert.equal(f.surface.render(), true); assert.equal(f.surface.commands.length, 0);
    assert.equal(f.surface.stats.peakFramesInFlight, 1); assert.equal(f.maps.length, 0); await f.complete();
  } finally { f.close(); }
});
test('runtime host: typing omits Measure/Arrange and pointer discovery', async () => {
  const f = await fixture(); try {
    f.surface.render(); await f.complete(); f.surface.send(Opcode.Text, { c: 97 }); f.surface.render();
    const entries = dispatches(f.latest()).map(d => d.entry);
    for (const forbidden of ['measure', 'arrange', 'constraints', 'hitTest']) assert.ok(!entries.includes(forbidden), forbidden);
    assert.ok(entries.includes('input')); assert.ok(entries.includes('filterScan')); assert.equal(entries.filter(e => e === 'sortBlocks').length, 1); assert.equal(entries.filter(e => e === 'mergeRows').length, 8);
    // GPU indirect args, not this fake, decide whether cached sorting executes.
    assert.equal(f.surface.frameU[9] & 4, 0); await f.complete();
  } finally { f.close(); }
});
test('runtime host: scrolling omits layout, query and sort graphs', async () => {
  const f = await fixture(); try {
    f.surface.render(); await f.complete(); f.surface.send(Opcode.Wheel, { x: 30, y: 160, b: 42 }); f.surface.render();
    const entries = dispatches(f.latest()).map(d => d.entry);
    for (const forbidden of ['measure', 'arrange', 'filterScan', 'sortBlocks', 'mergeRows']) assert.ok(!entries.includes(forbidden), forbidden);
    assert.ok(entries.includes('damage')); assert.ok(entries.includes('composite')); await f.complete();
  } finally { f.close(); }
});
test('runtime host: timestamps resolve directly into GPU storage, zero readback', async () => {
  const f = await fixture({options:{timingDetail:'stages'}}); try {
    assert.deepEqual(f.requests[0].requiredFeatures, ['timestamp-query']); f.surface.render();
    const graph = f.latest(), resolved = graph.find(p => p.type === 'resolve');
    assert.equal(resolved.buffer, f.surface.timingBuffer); assert.equal(resolved.count, 16); assert.equal(resolved.offset, 0);
    assert.equal(graph.filter(p => p.descriptor?.timestampWrites).length, 7);
    assert.ok(dispatches(graph).some(d => d.entry === 'recordMetrics')); assert.equal(f.maps.length, 0);
    assert.equal(f.surface.stats.readbackBytes, 0); assert.equal(f.surface.stats.uploadedBytes, 64); await f.complete();
  } finally { f.close(); }
});
test('runtime host: unsupported timestamps select explicitly labelled CPU fallback', async () => {
  const f = await fixture({ timestamps: false }); try {
    assert.deepEqual(f.requests[0].requiredFeatures, []); assert.equal(f.querySets.length, 0); f.surface.render();
    assert.equal(f.surface.gpuTiming, false); assert.equal(f.surface.frameU[9] & 2, 0);
    assert.ok(!f.latest().some(p => p.type === 'resolve' || p.descriptor?.timestampWrites));
    assert.ok(f.surface.frameF[10] >= 0); assert.ok(f.surface.frameF[11] >= 0); assert.equal(f.maps.length, 0); await f.complete();
  } finally { f.close(); }
});
test('runtime host: display-list ping-pong reads previous and writes distinct current storage', async () => {
  const f = await fixture(); try {
    f.surface.render(); const first = f.surface.drawBuffer; await f.complete(); f.surface.render();
    const damage = dispatches(f.latest()).find(d => d.entry === 'damage');
    const current = damage.group.entries.find(e => e.binding === 4).resource.buffer;
    const previous = damage.group.entries.find(e => e.binding === 10).resource.buffer;
    assert.notEqual(current, previous); assert.equal(previous, first); assert.equal(current, f.surface.drawBuffer); await f.complete();
  } finally { f.close(); }
});
test('runtime host: hidden HUD stops timing work and preserves 64-byte frame packets', async () => {
  const f = await fixture(); try {
    f.surface.render(); await f.complete(); f.surface.setPerformanceHUD(false); const before = f.surface.stats.uploadedBytes;
    f.surface.render(); assert.equal(f.surface.stats.uploadedBytes - before, 64);
    assert.equal(f.surface.frameU[9] & 1, 0); assert.ok(!f.latest().some(p => p.type === 'resolve' || p.descriptor?.timestampWrites));
    assert.ok(!dispatches(f.latest()).some(d => d.entry === 'recordMetrics')); await f.complete();
  } finally { f.close(); }
});
test('runtime host: optional full-render reference sets damage flag without forcing layout', async () => {
  const f = await fixture({ options: { damageTracking: false } }); try {
    f.surface.render(); await f.complete(); f.surface.render();
    assert.equal(f.surface.frameU[9] & 16, 16); assert.equal(f.surface.frameU[8] & 1, 0); assert.equal(f.surface.frameU[9] & 4, 0); await f.complete();
  } finally { f.close(); }
});

test('runtime host: real-font cache stages keep the 64-byte frame payload and never map', async () => {
 const f=await fixture({options:{fonts:[fixtureFont()]}});
 try { const before=f.writes.length;f.surface.render();await f.complete();const stages=dispatches(f.latest()).map(d=>d.entry);
  assert.ok(stages.indexOf('damage')<stages.indexOf('prepareGlyphCache'));assert.ok(stages.indexOf('rasterGlyphCache')<stages.indexOf('buildJobs'));
  assert.equal(f.writes.slice(before).reduce((sum,w)=>sum+w.data.length,0),64);assert.equal(f.maps.length,0);
  assert.equal(f.surface.options.fonts,undefined,'runtime must not retain host outline assets');
  assert.ok(f.surface.manifest.fonts[0].glyphCount>0);
 } finally {f.close();}
});
test('runtime host: exact-font reference mode omits cache dispatches without changing renderer quality settings',async()=>{
 const f=await fixture({options:{fonts:[fixtureFont()],glyphCache:false}});try{f.surface.render();await f.complete();const names=dispatches(f.latest()).map(d=>d.entry);
  assert.ok(!names.includes('prepareGlyphCache'));assert.ok(!names.includes('rasterGlyphCache'));assert.ok(names.includes('makeStrips'));assert.equal(f.surface.viewport.dpr,1);assert.equal(f.maps.length,0);
 }finally{f.close();}
});

// These exercise the real host scheduler against a fake GPU; not display benchmarks.
test('runtime host: explicit two-frame limit rejects a third before input upload', async () => {
 const f=await fixture({options:{maxFramesInFlight:2}}); try {
  assert.equal(f.surface.gate.limit,2); assert.ok(f.surface.render()); assert.ok(f.surface.render());
  f.surface.send(Opcode.Text,{c:65});const writes=f.writes.length;
  assert.equal(f.surface.render(),false);assert.equal(f.writes.length,writes);assert.equal(f.surface.commands.length,1);
  await f.complete();assert.ok(f.surface.render());assert.equal(f.surface.commands.length,0);assert.equal(f.surface.stats.peakFramesInFlight,2);
  await f.complete();
 } finally {f.close();}
});
for(const hz of [60,90,120,144,165,240]) test(`runtime host: ${hz}Hz explicit unbounded reference submits every rAF despite 20-tick-late acknowledgements`,async()=>{
 const f=await fixture({options:{maxFramesInFlight:0}});try{
  const interval=1000/hz, base=f.surface.startTime; f.surface.start();
  assert.equal(f.surface.gate.limit,0); assert.equal(f.surface.submissionMode,'vsync');
  for(let i=0;i<180;i++){
   if(i && i%20===0){for(const done of f.pending.splice(0))done();await Promise.resolve();}
   assert.equal(f.rafs.size,1); f.tick(base+i*interval);
  }
  assert.equal(f.surface.stats.frames,180);assert.equal(f.surface.stats.animationFrameCallbacks,180);
  assert.equal(f.surface.stats.skippedSubmissions,0);assert.ok(f.surface.gate.peak>2);
  assert.ok(f.surface.stats.completionCheckpoints<=12,'progress is batched, not one fence per frame');
  assert.ok(Math.abs(f.surface.stats.rafHz-hz)<.001);
  const encodedMs=(f.surface.frameU[9]>>>16)/256;assert.ok(Math.abs(encodedMs-interval)<1/256);
  const directMs=(f.surface.frameU[8]>>>1)/1024;assert.ok(Math.abs(directMs-interval)<1/1024);
  f.surface.stop();const frames=f.surface.stats.frames,complete=f.surface.whenSubmittedWorkDone();
  await f.complete();await complete;assert.equal(f.rafs.size,0);assert.equal(f.surface.stats.frames,frames);assert.equal(f.surface.gate.inFlight,0);
 }finally{f.close();}
});
test('runtime host: explicit bounded overload keeps rAF and preserves queued discrete input',async()=>{
 const f=await fixture({options:{maxFramesInFlight:2}});try{
  f.surface.start();const t=f.surface.startTime;
  f.tick(t);f.tick(t+8.333);f.surface.send(Opcode.Text,{c:65});const writes=f.writes.length;
  for(let i=2;i<32;i++) f.tick(t+i*8.333);
  assert.equal(f.surface.stats.frames,2);assert.equal(f.surface.stats.animationFrameCallbacks,32);
  assert.equal(f.surface.stats.skippedSubmissions,30);assert.equal(f.surface.commands.length,1);assert.equal(f.writes.length,writes);
  assert.equal(f.rafs.size,1);await f.complete();assert.equal(f.surface.stats.frames,2,'GPU completion is only a credit return');
  f.tick(t+32*8.333);assert.equal(f.surface.commands.length,0);assert.equal(f.surface.stats.frames,3);
  assert.equal(f.maps.length,0);f.surface.stop();await f.complete();
 }finally{f.close();}
});
test('runtime host: manual rendering does not invent a browser refresh frequency',async()=>{
 const f=await fixture();try{f.surface.render();assert.equal(f.surface.frameU[9]>>>16,0);assert.equal(f.surface.stats.animationFrameCallbacks,0);await f.complete();}finally{f.close();}
});
test('runtime host: no font sources or prepared outline objects are retained in surface options',async()=>{
 const f=await fixture({options:{fonts:[fixtureFont()]}});try{
  assert.equal(f.surface.options.fonts,undefined);assert.equal(f.surface.options.fontSources,undefined);
  assert.equal(f.surface.startup.pipelineConcurrency,4);assert.ok(f.surface.startup.compileMs>=0);
 }finally{f.close();}
});

test('runtime HUD: first display creates font masks before formatting and presentation',async()=>{
 const f=await fixture({options:{fonts:[fixtureFont()]}});try{
  const writes=f.writes.length;f.surface.render();const stages=dispatches(f.latest()).map(x=>x.entry);
  assert.ok(stages.indexOf('recordMetrics')>stages.indexOf('buildHudText'));
  assert.ok(stages.indexOf('rasterHudFont')<stages.indexOf('buildHudText'));
  assert.equal(dispatches(f.latest()).find(x=>x.entry==='rasterHudFont').counts[0],190);
  const hud=dispatches(f.latest()).find(x=>x.entry==='compositeHud');assert.equal(hud.group.entries.find(x=>x.binding===4).resource.buffer,f.surface.hudFontBuffer);
  const present=f.latest().find(x=>x.type==='present');assert.ok(!present.group.entries.some(x=>x.binding===4),'final blit must not access glyphs');
  assert.equal(f.writes.slice(writes).reduce((sum,w)=>sum+w.data.length,0),64);assert.equal(f.maps.length,0);await f.complete();
 }finally{f.close();}
});
test('runtime HUD: warm updates reuse glyph masks and do not share the app glyph cache',async()=>{
 const f=await fixture();try{
  f.surface.render();await f.complete();f.surface.render();const stages=dispatches(f.latest()).map(x=>x.entry);
  assert.ok(!stages.includes('rasterHudFont'));assert.ok(stages.includes('buildHudText'));assert.notEqual(f.surface.hudFontBuffer,f.surface.glyphCacheBuffer);
  assert.equal(f.surface.hudFontBuffer.size,820484);assert.equal(f.surface.hudDrawBuffer.size,56840);await f.complete();
 }finally{f.close();}
});
test('runtime HUD: disabling diagnostics omits mask and text work; show reuses cached font',async()=>{
 const f=await fixture();try{
  f.surface.render();await f.complete();f.surface.setPerformanceHUD(false);f.surface.render();
  assert.ok(!dispatches(f.latest()).some(x=>['rasterHudFont','buildHudText'].includes(x.entry)));await f.complete();
  f.surface.setPerformanceHUD(true);f.surface.render();const stages=dispatches(f.latest()).map(x=>x.entry);
  assert.ok(!stages.includes('rasterHudFont'));assert.ok(stages.includes('buildHudText'));await f.complete();
 }finally{f.close();}
});
test('runtime HUD: DPR change rerasterizes real-font masks once without extra frame uploads',async()=>{
 const f=await fixture();try{
  f.surface.render();await f.complete();f.surface.options.pixelRatio=1.5;f.surface.resizePending=true;
  const writes=f.writes.length;f.surface.render();assert.ok(dispatches(f.latest()).some(x=>x.entry==='rasterHudFont'));
  assert.equal(f.writes.slice(writes).reduce((sum,w)=>sum+w.data.length,0),64);await f.complete();
  f.surface.render();assert.ok(!dispatches(f.latest()).some(x=>x.entry==='rasterHudFont'));await f.complete();
 }finally{f.close();}
});
test('runtime HUD: same-scale window resize keeps masks, refreshes layout and bins',async()=>{
 const f=await fixture();try{
  f.surface.render();await f.complete();f.surface.canvas.getBoundingClientRect=()=>({width:740,height:600});f.surface.resizePending=true;f.surface.render();
  const stages=dispatches(f.latest()).map(x=>x.entry);assert.ok(!stages.includes('rasterHudFont'));assert.ok(stages.includes('buildHudText'));await f.complete();
 }finally{f.close();}
});
test('runtime HUD: deferred first display after hidden resize prepares at the new scale',async()=>{
 const f=await fixture({options:{performanceHUD:false}});try{
  f.surface.render();await f.complete();assert.ok(!dispatches(f.latest()).some(x=>x.entry==='rasterHudFont'));
  f.surface.options.pixelRatio=2;f.surface.resizePending=true;f.surface.render();await f.complete();
  f.surface.setPerformanceHUD(true);f.surface.render();assert.ok(dispatches(f.latest()).some(x=>x.entry==='rasterHudFont'));await f.complete();assert.equal(f.maps.length,0);
 }finally{f.close();}
});

// New regressions explicitly distinguish the scheduler from physical GPU throughput.
test('explicit unbounded reference submits without even a single completion acknowledgement',async()=>{
 const f=await fixture({options:{maxFramesInFlight:0}});try{
  f.surface.start(); const t=f.surface.startTime;
  for(let i=0;i<300;i++){ if(i%7===0)f.surface.send(Opcode.Text,{target:0,c:97}); f.tick(t+i*1000/120); }
  assert.equal(f.surface.stats.rafSubmissions,300);assert.equal(f.surface.stats.frames,300);assert.equal(f.surface.stats.skippedSubmissions,0);
  assert.equal(f.surface.commands.length,0);assert.equal(f.surface.stats.completionCheckpoints,1);assert.equal(f.pending.length,1);assert.equal(f.maps.length,0);
 }finally{f.close();}
});
test('ASAP is off by default; opt-in uses bounded, yielding tasks, not rAF or promise spins',async()=>{
 const f=await fixture();try{
  assert.equal(f.surface.submissionMode,'vsync');assert.equal(f.taskMessages.length,0);
  f.surface.start();f.surface.setSubmissionMode('asap');
  assert.equal(f.surface.gate.limit,8);assert.equal(f.taskMessages.length,1);
  f.tick(1001);assert.equal(f.surface.stats.frames,0,'ASAP rAF callback is observation only');
  for(let i=0;i<8;i++){assert.equal(f.taskMessages.length,1);f.advance(.3);f.task();assert.equal(f.surface.stats.frames,i+1);}
  assert.equal(f.taskMessages.length,0);assert.equal(f.surface.stats.asapSubmissions,8);assert.equal(f.surface.stats.rafSubmissions,0);
  for(let i=0;i<12;i++)f.tick(1010+i*8.333);assert.equal(f.surface.stats.frames,8,'no unbounded submit queue');
  await f.complete();assert.equal(f.surface.stats.frames,8,'acknowledgement only posts a task');assert.equal(f.taskMessages.length,1);
  f.task();assert.equal(f.surface.stats.frames,9);assert.equal(f.maps.length,0);
 }finally{f.close();}
});
test('ASAP toggle, stop and delayed messages cannot duplicate or resurrect a loop',async()=>{
 const f=await fixture();try{
  f.surface.start();f.surface.setSubmissionMode('asap');assert.equal(f.taskMessages.length,1);
  f.surface.setSubmissionMode('vsync');f.task();assert.equal(f.surface.stats.frames,0);
  f.tick(1010);assert.equal(f.surface.stats.frames,1);assert.equal(f.rafs.size,1);
  f.surface.setSubmissionMode('asap');f.task();assert.equal(f.surface.stats.frames,2);
  f.surface.stop();const total=f.surface.stats.frames;while(f.taskMessages.length)f.task();await f.complete();
  assert.equal(f.surface.stats.frames,total);assert.equal(f.rafs.size,0);assert.equal(f.taskMessages.length,0);
 }finally{f.close();}
});
test('visibility cancels ASAP tasks and rAF; resume resets timing and keeps selected mode',async()=>{
 const f=await fixture({options:{submissionMode:'asap'}});try{
  f.surface.start();f.visible(false);f.task();assert.equal(f.surface.stats.frames,0);assert.equal(f.rafs.size,0);
  f.visible(true);assert.equal(f.taskMessages.length,1);f.task();assert.equal(f.surface.stats.frames,1);assert.ok(f.surface.frameU[9]&128);assert.equal(f.surface.frameU[8]>>>1,0);
 }finally{f.close();}
});
test('complete GPU timing wraps HUD and presentation, then records a single same-frame sample',async()=>{
 const f=await fixture({options:{fonts:[fixtureFont()],timingDetail:'stages'}});try{
  f.surface.render();const g=f.latest(),timed=g.filter(x=>x.descriptor?.timestampWrites);
  assert.equal(timed.length,8);assert.deepEqual(timed.map(x=>x.descriptor.timestampWrites.beginningOfPassWriteIndex),[0,2,4,6,8,10,12,14]);
  assert.deepEqual(timed.map(x=>x.descriptor.timestampWrites.endOfPassWriteIndex),[1,3,5,7,9,11,13,15]);
  const present=g.findIndex(x=>x.type==='present'),resolve=g.findIndex(x=>x.type==='resolve'),record=g.findIndex(x=>x.dispatches?.some(d=>d.entry==='recordMetrics'));
  assert.ok(present<resolve&&resolve<record);assert.equal(record,g.length-1);
  assert.equal(f.surface.metricsBuffer.size,16384);assert.equal(f.surface.timingBuffer.size,128);assert.equal(f.maps.length,0);
 }finally{f.close();}
});
test('skipped layout/data/glyph/HUD phases are explicitly flagged and never read as stale timestamps',async()=>{
 const f=await fixture({options:{timingDetail:'stages'}});try{
  f.surface.render();await f.complete();f.surface.setPerformanceHUD(false);f.surface.options.profiling=true;f.surface.profiling=true;f.surface.render();
  const indexes=f.latest().filter(x=>x.descriptor?.timestampWrites).map(x=>x.descriptor.timestampWrites.beginningOfPassWriteIndex);
  assert.deepEqual(indexes,[0,6,10,14]);assert.equal(f.surface.frameU[9]&(1|4|8|256),0);
 }finally{f.close();}
});
test('direct submission intervals survive many hours of animation uptime and reset after mode switch',async()=>{
 const f=await fixture();try{
  f.advance(24*60*60*1000);f.surface.render();f.advance(.3);f.surface.render();
  assert.ok(Math.abs((f.surface.frameU[8]>>>1)/1024-.3)<1/1024);
  f.surface.setSubmissionMode('asap');f.advance(9000);f.surface.render();assert.equal(f.surface.frameU[8]>>>1,0);assert.ok(f.surface.frameU[9]&128);
 }finally{f.close();}
});
test('completion callback wall delay never becomes a GPU or CPU encode duration',async()=>{
 const f=await fixture();try{
  f.surface.render();const bytes=f.writes.at(-1).data.slice();f.advance(250);await f.complete();
  assert.equal(f.surface.stats.lastCompletionLatencyMs,250);assert.deepEqual(f.writes.at(-1).data,bytes);
  assert.equal(f.surface.frameF[10],0);assert.equal(f.surface.frameF[11],0);assert.equal(f.surface.stats.skippedSubmissions,0);
 }finally{f.close();}
});
test('explicit fence captures the latest tail without introducing a normal-loop gate',async()=>{
 const f=await fixture({options:{maxFramesInFlight:0}});try{
  for(let i=0;i<5;i++)f.surface.render();assert.equal(f.surface.stats.completionCheckpoints,1);
  const completion=f.surface.lastSubmissionCompletion;assert.equal(f.surface.stats.completionCheckpoints,2);await f.complete();await completion;
  assert.equal(f.surface.stats.completedFrames,5);assert.equal(f.surface.stats.pendingAcknowledgements,0);assert.equal(f.surface.gate.limit,0);
 }finally{f.close();}
});
test('invalid scheduling options fail before allocation and preserve the prior valid mode',async()=>{
 const f=await fixture();try{
  assert.throws(()=>f.surface.setSubmissionMode('unlimited'),/submissionMode/);assert.equal(f.surface.submissionMode,'vsync');
 }finally{f.close();}
 await assert.rejects(()=>fixture({options:{asapFramesInFlight:0}}),/asapFramesInFlight/);
 await assert.rejects(()=>fixture({options:{maxFramesInFlight:33}}),/maxFramesInFlight/);
});

test('profiling disabled combines input, UI, and glyph work into one compute pass',async()=>{
 const f=await fixture({options:{performanceHUD:false,profiling:false,fonts:[fixtureFont()]}});try{
  f.surface.render();await f.complete();f.surface.render();
  const g=f.latest(),compute=g.filter(x=>x.type==='compute');assert.equal(compute.length,1,'combined input and UI render');
  assert.ok(compute[0].dispatches.some(x=>x.entry==='emit'));assert.ok(compute[0].dispatches.some(x=>x.entry==='rasterGlyphCache'));assert.ok(compute[0].dispatches.some(x=>x.entry==='composite'));
  assert.equal(f.surface.stats.readbackBytes,0);
 }finally{f.close();}
});

test('default compact profiling uses one compute range and one canvas range on a warm real-font frame',async()=>{
 const f=await fixture({options:{fonts:[fixtureFont()]}});try{
  f.surface.render();await f.complete();f.surface.render();
  const graph=f.latest(),timed=graph.filter(x=>x.descriptor?.timestampWrites);
  assert.deepEqual(timed.map(x=>x.descriptor.timestampWrites.beginningOfPassWriteIndex),[0,14]);
  assert.equal(f.surface.frameU[9]&512,0);assert.equal(f.surface.timingDetail,'frame');
  const names=timed[0].dispatches.map(x=>x.entry);
  for(const n of ['clearFrame','emit','emitGridParts','damage','rasterGlyphCache','composite','buildHudText'])assert.ok(names.includes(n),n);
  const draw=graph.find(x=>x.type==='present');assert.deepEqual(draw.draws.map(d=>d.entry),['blitFragment','hudBlitFragment']);
  assert.equal(draw.draws[0].scissor,null);assert.equal(draw.draws[1].scissor,null,'quad bounds come from GPU vertex positions');assert.ok(names.includes('compositeHud'));assert.ok(f.surface.hudOutputSize[0]<f.surface.viewport.w);
  assert.equal(f.surface.stats.uploadedBytes,128);assert.equal(f.maps.length,0);
 }finally{f.close();}
});
test('stage profiling is opt-in, uses new epoch, and does not remount or consume state',async()=>{
 const f=await fixture({options:{fonts:[fixtureFont()]}});try{
  f.surface.render();await f.complete();const heap=f.surface.heapBuffer;
  assert.equal(f.surface.setTimingDetail('stages'),f.surface);assert.equal(f.surface.heapBuffer,heap);
  f.surface.render();assert.ok(f.surface.frameU[9]&512);assert.ok(f.surface.frameU[9]&128);
  assert.deepEqual(f.latest().filter(x=>x.descriptor?.timestampWrites).map(x=>x.descriptor.timestampWrites.beginningOfPassWriteIndex),[0,6,8,10,12,14]);
  assert.throws(()=>f.surface.setTimingDetail('bogus'),/timingDetail/);assert.equal(f.surface.timingDetail,'stages');
  f.surface.setTimingDetail('frame');f.surface.render();assert.equal(f.surface.frameU[9]&512,0);
 }finally{f.close();}
});
test('parallel row emission preserves separate section heads and dispatch dependency order',async()=>{
 const f=await fixture();try{
  f.surface.render();const calls=dispatches(f.latest()),names=calls.map(x=>x.entry);
  assert.ok(names.indexOf('emit')<names.indexOf('emitGridParts'));assert.ok(names.indexOf('emitGridParts')<names.indexOf('damage'));
  assert.deepEqual(calls.find(x=>x.entry==='emitGridParts').counts,[5]);assert.deepEqual(calls.find(x=>x.entry==='damage').counts,[43]);
  f.surface.options.parallelGrid=false;f.surface.render();assert.ok(f.surface.frameU[9]&1024);assert.equal(f.maps.length,0);
 }finally{f.close();}
});
test('HUD reference switch and hidden mode do not add a canvas render pass or readback',async()=>{
 const f=await fixture({options:{hudScissor:false}});try{
  f.surface.render();let p=f.latest().filter(x=>x.type==='present');assert.equal(p.length,1);assert.deepEqual(p[0].draws.map(x=>x.entry),['hudFullscreenFragment']);
  f.surface.setPerformanceHUD(false);f.surface.render();p=f.latest().filter(x=>x.type==='present');assert.equal(p.length,1);assert.deepEqual(p[0].draws.map(x=>x.entry),['blitFragment']);assert.equal(f.maps.length,0);
 }finally{f.close();}
});
test('host sync inspection does not fence or map and records actual callback/submission identity',async()=>{
 const f=await fixture({options:{maxFramesInFlight:0}});try{
  f.surface.start();for(let i=0;i<270;i++)f.tick(1000+i*1000/144);
  const writes=f.writes.length,checkpoints=f.surface.stats.completionCheckpoints,r=f.surface.inspectFrameSync();
  assert.equal(r.samples.length,240);assert.equal(r.samples[0].frame,31);assert.equal(r.samples.at(-1).frame,270);assert.equal(r.everyRaf,true);
  assert.ok(Math.abs(r.submitIntervalMs.median-1000/144)<1e-8);assert.ok(r.samples.every(x=>x.source==='raf'));
  assert.equal(f.maps.length,0);assert.equal(f.writes.length,writes);assert.equal(f.surface.stats.completionCheckpoints,checkpoints);
 }finally{f.close();}
});

test('recovery: deferred HUD is absent from the first-frame critical pipeline graph', async () => {
 const f=await fixture({options:{deferHUD:true}}); try {
  assert.equal(f.surface.hudReady,false);
  assert.ok(f.surface.startup.pipelineEntries.every(p=>!['hud-present','buildHudText','rasterHudFont'].includes(p.name)));
  f.surface.render(); const first=dispatches(f.latest()).map(d=>d.entry);
  assert.ok(first.includes('emitGridParts'));assert.ok(first.includes('recordMetrics'));
  assert.ok(!first.includes('buildHudText'));
  assert.deepEqual(f.latest().find(p=>p.type==='present').draws.map(d=>d.entry),['blitFragment']);
  assert.equal(f.surface.frameU[9]&1,0);
  await f.complete();await f.surface.ensureHUD();assert.equal(f.surface.hudReady,true);
  const count=f.surface.startup.pipelineEntries.length;
  f.surface.render();assert.ok(dispatches(f.latest()).some(d=>d.entry==='rasterHudFont'));
  await f.complete();await f.surface.ensureHUD();assert.equal(f.surface.startup.pipelineEntries.length,count);
  assert.equal(f.maps.length,0);
 }finally{f.close();}
});
test('recovery: compiling the optional HUD never gates live submissions or drops input',async()=>{
 const f=await fixture({options:{deferHUD:true}});try{
  const original=f.surface.prepareHUD;let release;
  f.surface.prepareHUD=()=>new Promise(resolve=>{release=()=>original().then(resolve);});
  f.surface.render();await f.complete();assert.equal(f.surface.hudReady,false);
  for(let i=0;i<8;i++){f.advance(8.333);f.surface.send(Opcode.Text,{c:97+i});assert.equal(f.surface.render(),true);await f.complete();}
  assert.equal(f.surface.commands.length,0);assert.equal(f.surface.stats.skippedSubmissions,0);
  await release();await f.surface.ensureHUD();assert.equal(f.surface.hudReady,true);assert.equal(f.maps.length,0);
 }finally{f.close();}
});
test('recovery: a hidden HUD does not start compilation and showing starts only once',async()=>{
 const f=await fixture({options:{deferHUD:true,performanceHUD:false}});try{
  f.surface.render();await f.complete();assert.equal(f.surface.hudPreparation,undefined);
  f.surface.setPerformanceHUD(true);const promise=f.surface.hudPreparation;
  f.surface.setPerformanceHUD(false);f.surface.setPerformanceHUD(true);assert.equal(f.surface.hudPreparation,promise);
  await promise;assert.equal(f.surface.hudReady,true);
 }finally{f.close();}
});
test('recovery: late diagnostic compiler completion cannot resurrect a disposed surface',async()=>{
 const f=await fixture({options:{deferHUD:true}});try{
  const original=f.surface.prepareHUD;let release;f.surface.prepareHUD=()=>new Promise(resolve=>{release=()=>original().then(resolve);});
  f.surface.render();await f.complete();f.surface.dispose();await release();await f.surface.hudPreparation;
  assert.equal(f.surface.hudReady,false);assert.equal(f.surface.running,false);assert.equal(f.rafs.size,0);
 }finally{f.close();}
});
test('recovery: Timing off retains FPS history but writes/resolves no GPU timestamps',async()=>{
 const f=await fixture();try{
  f.surface.render();await f.complete();f.surface.setTimingDetail('off');f.surface.render();
  assert.equal(f.surface.frameU[9]&2,0);assert.equal(f.surface.frameU[9]&128,128);
  assert.equal(f.latest().filter(p=>p.descriptor?.timestampWrites).length,0);
  assert.equal(f.latest().filter(p=>p.type==='resolve').length,0);
  assert.ok(dispatches(f.latest()).some(d=>d.entry==='recordMetrics'));
  assert.ok(dispatches(f.latest()).some(d=>d.entry==='buildHudText'));
  f.surface.setTimingDetail('frame');f.surface.render();assert.ok(f.latest().some(p=>p.type==='resolve'));
  assert.equal(f.maps.length,0);
 }finally{f.close();}
});
test('recovery: parallel exact-cache discovery/planning/publication precedes raster consumption',async()=>{
 const f=await fixture({options:{fonts:[fixtureFont()]}});try{
  const before=f.writes.length;f.surface.render();const d=dispatches(f.latest()),names=d.map(x=>x.entry);
  for(const [a,b] of [['damage','collectGlyphRequests'],['collectGlyphRequests','prepareGlyphCache'],['prepareGlyphCache','finishGlyphRequests'],['finishGlyphRequests','rasterGlyphCache'],['rasterGlyphCache','makeStrips']])assert.ok(names.indexOf(a)<names.indexOf(b),`${a} before ${b}`);
  assert.deepEqual(d.find(x=>x.entry==='prepareGlyphCache').counts,[1]);
  assert.equal(f.surface.constants.GLYPH_SHARDS,64);
  assert.equal(f.writes.length-before,1);assert.equal(f.writes.at(-1).data.length,64);
  assert.equal(f.maps.length,0);
 }finally{f.close();}
});

// Independent controlled-source static-use traversal checks the descriptor that
// the runtime hands to a native auto-layout. It does not execute or compile WGSL.
test('recovery: HUD auto-layout resources exactly match reachable shader globals',async()=>{
 const f=await fixture();try{
  const source=(shaders['hud-common']+'\n'+shaders.hud).replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  const bodies=new Map();for(const m of source.matchAll(/\bfn\s+(\w+)\s*\(/g)){
   const start=source.indexOf('{',m.index);let level=1,end=start+1;
   for(;end<source.length&&level;end++){if(source[end]==='{')level++;else if(source[end]==='}')level--;}
   bodies.set(m[1],source.slice(start,end));
  }
  const globals=[...source.matchAll(/@binding\((\d+)\)\s*var<[^>]+>\s*(\w+)/g)].map(m=>({binding:+m[1],name:m[2]}));
  for(const entry of ['rasterHudFont','buildHudText']){
   const visited=new Set();let reachable='';const visit=name=>{if(visited.has(name))return;visited.add(name);const body=bodies.get(name);reachable+=body;
    for(const m of body.matchAll(/\b(\w+)\s*\(/g))if(bodies.has(m[1]))visit(m[1]);};visit(entry);
   const expected=globals.filter(g=>new RegExp(`\\b${g.name}\\b`).test(reachable)).map(g=>g.binding).sort((a,b)=>a-b);
   const supplied=f.surface.hudBindGroups.get(entry).entries.map(e=>e.binding).sort((a,b)=>a-b);
   assert.deepEqual(supplied,expected,entry);
  }
  assert.deepEqual(f.surface.hudBindGroups.get('buildHudText').entries.map(e=>e.binding),[0,3,4,5]);
 }finally{f.close();}
});

// 0.7 pacing regressions. Real runtime, non-executing GPU test double.
for(const hz of [60,90,120,144,165,240]) test(`paced default keeps every ${hz}Hz opportunity with independently delayed acknowledgements`,async()=>{
 const f=await fixture();try{
  assert.equal(f.surface.maxFramesInFlight,2);assert.equal(f.surface.gate.limit,2);
  f.surface.start();const t=f.surface.startTime,step=1000/hz;
  // Each notification arrives between the first and SECOND subsequent rAF.
  // Two overlapping frames must retain throughput, without chained fences.
  for(let i=0;i<240;i++){
   if(i>=2) await f.acknowledge();
   f.tick(t+i*step);
   assert.equal(f.surface.stats.frames,i+1);assert.equal(f.rafs.size,1);
  }
  assert.equal(f.surface.stats.completionCheckpoints,240);
  assert.equal(f.surface.stats.rafCapacityDeferrals,0);assert.equal(f.surface.gate.peak,2);
  assert.ok(Math.abs(f.surface.stats.rafHz-hz)<.001);
  assert.equal(f.surface.frameU[9]&4096,4096);assert.equal(f.maps.length,0);
  f.surface.stop();await f.complete();assert.equal(f.surface.gate.inFlight,0);assert.equal(f.rafs.size,0);
 }finally{f.close();}
});
test('paced frames register independent tails before ANY earlier callback, and never issue a catch-up draw',async()=>{
 const f=await fixture();try{
  f.surface.start();const t=f.surface.startTime;f.tick(t);f.tick(t+8.333);
  assert.equal(f.pending.length,2,'the old chained checkpoint implementation fails here');
  const frames=f.surface.stats.frames;await f.acknowledge(1);
  assert.equal(f.surface.gate.inFlight,0,'a later tail proves the complete submitted prefix finished');
  assert.equal(f.surface.stats.frames,frames);assert.equal(f.rafs.size,1);
  f.tick(t+16.666);assert.equal(f.surface.stats.frames,3);
  await f.acknowledge(0);assert.equal(f.surface.gate.inFlight,1,'late older callback cannot return credit twice');
 }finally{f.close();}
});
test('overload defers BEFORE consuming commands, touching the canvas or writing frame buffers',async()=>{
 const f=await fixture();try{
  let acquired=0;const original=f.surface.context.getCurrentTexture;
  f.surface.context.getCurrentTexture=()=>{acquired++;return original();};
  f.surface.start();const t=f.surface.startTime;f.tick(t);f.tick(t+8.333);
  for(const c of 'AB')f.surface.send(Opcode.Text,{c:c.codePointAt(0)});
  f.surface.send(Opcode.Key,{c:8});f.surface.send(Opcode.Text,{c:67});
  const writes=f.writes.length;
  for(let i=2;i<22;i++)f.tick(t+i*8.333);
  assert.equal(acquired,2);assert.equal(f.writes.length,writes);assert.equal(f.surface.commands.length,4);
  assert.equal(f.surface.stats.rafCapacityDeferrals,20);assert.equal(f.surface.stats.skippedSubmissions,20);
  const r=f.surface.inspectFrameSync();assert.equal(r.opportunities.samples.length,22);
  assert.equal(r.opportunities.counts['deferred-capacity'],20);assert.equal(r.opportunities.counts.submitted,2);
  assert.equal(r.pacing.unacknowledgedFrames,2);assert.equal(r.pacing.acknowledgementStrategy,'independent-per-submission');
  const before=f.graphs.length;await f.acknowledge();assert.equal(f.graphs.length,before);
  f.tick(t+22*8.333);assert.equal(f.surface.commands.length,0);assert.equal(acquired,3);
  const input=f.writes.slice(writes).find(w=>w.buffer===f.surface.eventBuffer),u=new Uint32Array(input.data.buffer,input.data.byteOffset,input.data.byteLength/4);
  assert.equal(input.data.byteLength,128);assert.deepEqual([u[6],u[14],u[22],u[30]],[65,66,8,67]);
  assert.ok(Math.abs(f.surface.frameF[3]-22*8.333/1000)<1e-6,'latest rAF animation clock, not replay of deferred clocks');
  assert.equal(f.maps.length,0);assert.equal(f.surface.stats.uploadedBytes,3*64+4*32);
 }finally{f.close();}
});
test('a long callback gap produces exactly ONE fresh submission, not catch-up frames',async()=>{
 const f=await fixture();try{
  f.surface.start();const t=f.surface.startTime;f.tick(t);await f.complete();
  f.tick(t+800);assert.equal(f.surface.stats.frames,2);assert.equal(f.surface.stats.animationFrameCallbacks,2);
  assert.equal(f.surface.stats.rafHz,0);assert.equal(f.surface.stats.rafCapacityDeferrals,0);assert.equal(f.rafs.size,1);
 }finally{f.close();}
});
test('duplicate/backward rAF timestamps cannot produce two renders for the same opportunity',async()=>{
 const f=await fixture();try{
  f.surface.start();const t=f.surface.startTime;f.tick(t);await f.complete();f.tick(t);f.tick(t-1);
  assert.equal(f.surface.stats.frames,1);assert.equal(f.surface.stats.duplicateRafCallbacks,2);
  assert.equal(f.surface.inspectFrameSync().opportunities.counts['duplicate-callback'],2);
  f.tick(t+8);assert.equal(f.surface.stats.frames,2);
 }finally{f.close();}
});
test('rAF handle zero is a valid pending handle, not a missing request',async()=>{
 const f=await fixture({rafFirstId:0});try{
  f.surface.start();assert.equal(f.surface.raf,0);f.surface.invalidate();assert.equal(f.rafs.size,1);
  f.surface.stop();assert.equal(f.rafs.size,0);await f.complete();assert.equal(f.surface.stats.frames,0);
 }finally{f.close();}
});
test('live pacing switch drains already queued work without resetting state or pretending it completed',async()=>{
 const f=await fixture({options:{maxFramesInFlight:0}});try{
  for(let i=0;i<12;i++)f.surface.render();f.surface.send(Opcode.Text,{c:65});
  f.surface.setMaxFramesInFlight(2);assert.equal(f.surface.gate.inFlight,12);assert.equal(f.surface.render(),false);
  await f.complete();assert.equal(f.surface.gate.inFlight,0);assert.equal(f.surface.commands.length,1);
  assert.ok(f.surface.render());assert.equal(f.surface.commands.length,0);
  f.surface.setMaxFramesInFlight(0);assert.equal(f.surface.maxFramesInFlight,0);assert.ok(f.surface.render());assert.equal(f.surface.frameU[9]&4096,0);
  assert.throws(()=>f.surface.setMaxFramesInFlight(-1),/maxFrames/);assert.equal(f.surface.maxFramesInFlight,0);
 }finally{f.close();}
});
test('ASAP bound is independent of the default vsync limit and mode switches cannot resurrect stale tasks',async()=>{
 const f=await fixture({options:{asapFramesInFlight:5}});try{
  f.surface.start();f.surface.setSubmissionMode('asap');assert.equal(f.surface.gate.limit,5);
  f.surface.setMaxFramesInFlight(1);assert.equal(f.surface.gate.limit,5);
  f.task();f.surface.setSubmissionMode('vsync');assert.equal(f.surface.gate.limit,1);
  const before=f.surface.stats.frames;while(f.taskMessages.length)f.task();assert.equal(f.surface.stats.frames,before);
  await f.complete();assert.equal(f.surface.stats.frames,before);assert.equal(f.rafs.size,1);
 }finally{f.close();}
});
test('hide/resume never clears unacknowledged work or submits from a completion callback',async()=>{
 const f=await fixture();try{
  f.surface.start();const t=f.surface.startTime;f.tick(t);f.tick(t+8);f.visible(false);
  assert.equal(f.rafs.size,0);assert.equal(f.surface.gate.inFlight,2);
  f.visible(true);f.tick(t+1000);assert.equal(f.surface.stats.frames,2);assert.equal(f.surface.stats.rafCapacityDeferrals,1);
  await f.complete();assert.equal(f.surface.stats.frames,2);
  f.tick(t+1008);assert.equal(f.surface.stats.frames,3);assert.equal(f.surface.gate.inFlight,1);
 }finally{f.close();}
});
test('stop/dispose prevents all late completion and scheduled work from restarting rendering',async()=>{
 const f=await fixture();try{
  f.surface.start();f.tick(f.surface.startTime);f.surface.stop();await f.complete();assert.equal(f.rafs.size,0);
  f.surface.start();f.tick(f.surface.startTime+9);f.surface.dispose();await f.complete();
  assert.equal(f.rafs.size,0);assert.equal(f.surface.stats.frames,2);assert.equal(f.surface.progress.pending.size,0);
 }finally{f.close();}
});

test('framework host: state styling adds only its gated compute dispatch, no extra frame uploads/readback',async()=>{
 const f=await fixture({options:{styles:'TextBox:focus { BorderBrush: #22ccff; }'}});try{
  const before=f.surface.stats.uploadedBytes;assert.equal(f.surface.manifest.styleNodes,1);f.surface.render();
  assert.ok(dispatches(f.latest()).some(d=>d.entry==='resolveStyles'));assert.equal(f.surface.stats.uploadedBytes-before,64);assert.equal(f.maps.length,0);await f.complete();
 }finally{f.close();}
 const clean=await fixture();try{clean.surface.render();assert.ok(!dispatches(clean.latest()).some(d=>d.entry==='resolveStyles'));await clean.complete();}finally{clean.close();}
});
test('framework host: animation controls send ordered single 32-byte commands with no new layout graph',async()=>{
 const f=await fixture();try{f.surface.render();await f.complete();const before=f.surface.stats.uploadedBytes;
  f.surface.controlAnimation('filter','pause').controlAnimation('filter','seek',.5).controlAnimation('filter','resume');f.surface.render();
  assert.equal(f.surface.stats.uploadedBytes-before,64+3*32);assert.ok(!dispatches(f.latest()).some(d=>d.entry==='measure'));assert.equal(f.maps.length,0);await f.complete();
  assert.throws(()=>f.surface.controlAnimation('filter','invalid'));assert.throws(()=>f.surface.controlAnimation('unknown','pause'));
 }finally{f.close();}
});


test('workbench runtime encodes device editor/model stages in dependency order',async()=>{
 const f=await fixture({viewOverride:createWorkbench({code:'const x=1;',css:'',notes:'Hello'}),options:{performanceHUD:false}});try{
  f.surface.render();const calls=dispatches(f.latest()),names=calls.map(c=>c.entry);
  assert.ok(names.indexOf('analyzeEditors')<names.indexOf('layoutEditors'));
  assert.ok(names.indexOf('pullModels')<names.indexOf('evaluateModels'));
  assert.ok(names.indexOf('evaluateModels')<names.indexOf('pushModels'));
  assert.ok(names.indexOf('layoutEditors')<names.indexOf('emitEditorParts'));
  assert.ok(names.indexOf('emitEditorParts')<names.indexOf('damage'));
  assert.deepEqual(calls.find(c=>c.entry==='pullModels').counts,[1]);
  assert.deepEqual(calls.find(c=>c.entry==='emitEditorParts').counts,[5,3]);assert.equal(f.maps.length,0);
 }finally{f.close();}
});
test('ordinary surfaces omit editor/model native pipeline creation',async()=>{
 const f=await fixture();try{for(const name of ['analyzeEditors','layoutEditors','emitEditorParts','pullModels','evaluateModels','pushModels'])assert.ok(!f.surface.pipelines.has(name));}finally{f.close();}
});
test('bulk editor inputs preserve FIFO order and account for payloads without mapping',async()=>{
 const f=await fixture({viewOverride:h('CodeEditor',{id:'e',text:'abc',documentCapacity:256}),options:{performanceHUD:false}});try{
  f.surface.render();await f.complete();const editor=f.surface.editor('e'),before=f.surface.stats.uploadedBytes;
  editor.insert('one').insert('two');assert.equal(f.rafs.size,0,'autoStart:false does not arm rendering');
  f.surface.render();assert.equal(f.surface.commands.length,1);assert.equal(f.surface.stats.uploadedBytes-before,64+32+12);await f.complete();
  f.surface.render();assert.equal(f.surface.commands.length,0);assert.equal(f.surface.stats.uploadedBytes-before,2*(64+32+12));assert.equal(f.maps.length,0);
 }finally{f.close();}
});
test('platform operations serialize and normal rAF remains paused until the boundary closes',async()=>{
 const f=await fixture({viewOverride:h('CodeEditor',{id:'e',text:'abc',documentCapacity:256}),options:{performanceHUD:false}});try{
  const order=[];f.surface.start();f.tick(1016);await f.complete();let release;
  const one=f.surface.platformSnapshot(async()=>{order.push('first');await new Promise(r=>release=r);order.push('released');return 1;});
  const two=f.surface.platformSnapshot(()=>{order.push('second');return 2;});
  for(let k=0;k<20&&!release;k++){await Promise.resolve();await f.complete();}
  assert.ok(release);assert.equal(f.rafs.size,0);assert.equal(f.surface.platformBarrier,true);release();
  for(let k=0;k<20;k++){await Promise.resolve();await f.complete();}
  assert.equal(await one,1);assert.equal(await two,2);assert.deepEqual(order,['first','released','second']);assert.equal(f.surface.platformBarrier,false);assert.equal(f.rafs.size,1);
 }finally{f.close();}
});

import {dataSource} from '../src/data/index.js';
import {hostAction,ACTION_OUTBOX_BYTES} from '../src/controls/index.js';
import {createGPUShell} from '../src/playground/gpu-shell.js';
test('dynamic runtime: host action reads only eligible input packets, never idle/move/scroll frames',async()=>{
 const f=await fixture({viewOverride:h('Button',{id:'run',text:'Run',action:hostAction('run')}),options:{performanceHUD:false,onAction:()=>{}}});try{
  f.surface.render();await f.complete();f.surface.send(Opcode.Move,{x:2,y:2});f.surface.render();await f.complete();assert.equal(f.maps.length,0);
  f.surface.send(Opcode.Up,{target:f.surface.id('run')});f.surface.render();const copy=f.latest().find(x=>x.type==='copy');assert.equal(copy.size,ACTION_OUTBOX_BYTES);assert.equal(f.maps.length,1);await f.surface.actionBridge.delivery;assert.equal(f.surface.stats.actionReadbackBytes,ACTION_OUTBOX_BYTES);assert.equal(copy.destination.destroyed,true);await f.complete();
  f.surface.render();await f.complete();assert.equal(f.maps.length,1);
 }finally{f.close();}
});
test('dynamic runtime: independent action readbacks preserve callback ordering and isolate callback failures',async()=>{
 const received=[],errors=[];const f=await fixture({viewOverride:h('Button',{id:'run',text:'Run',action:hostAction('run')}),options:{performanceHUD:false,onAction:e=>{received.push(e.sequence);if(e.sequence===1)throw new Error('observer');},onDiagnosticsError:e=>errors.push(e.message)}});try{
  const bridge=f.surface.actionBridge,reads=[];for(let sequence=1;sequence<=2;sequence++){const e=f.device.createCommandEncoder(),b=bridge.encode(e,{actionCandidate:true}),words=new Uint32Array(b.size/4);words.set([1,0,0,0,1,0,sequence,0,0,sequence]);b.mapAsync=()=>new Promise(r=>reads.push(r));b.getMappedRange=()=>words.buffer;bridge.submitted(b);}
  reads[1]();await Promise.resolve();assert.deepEqual(received,[]);reads[0]();await bridge.delivery;assert.deepEqual(received,[1,2]);assert.deepEqual(errors,['observer']);assert.equal(bridge.pending.size,0);
 }finally{f.close();}
});
test('dynamic runtime: outbox saturation defers before consuming input or uploading',async()=>{
 const f=await fixture({viewOverride:h('Button',{id:'run',action:hostAction('run')}),options:{performanceHUD:false,onAction:()=>{}}});try{
  for(let k=0;k<8;k++)f.surface.actionBridge.pending.add({destroy(){}});f.surface.send(Opcode.Up,{target:0});const writes=f.writes.length;assert.equal(f.surface.render(),false);assert.equal(f.surface.commands.length,1);assert.equal(f.writes.length,writes);assert.equal(f.surface.stats.actionBackpressure,1);f.surface.actionBridge.pending.clear();assert.ok(f.surface.render());await f.surface.actionBridge.delivery;await f.complete();
 }finally{f.close();}
});
test('dynamic runtime: canceled encoder releases unsubmitted event snapshot buffers',async()=>{
 const f=await fixture({viewOverride:h('Button',{id:'run',action:hostAction('run')}),options:{performanceHUD:false,onAction:()=>{}}});try{
  const create=f.device.createCommandEncoder;f.device.createCommandEncoder=()=>{const e=create();e.finish=()=>{throw new Error('encoder failed');};return e;};f.surface.send(Opcode.Up,{target:0});assert.throws(()=>f.surface.render(),/encoder failed/);assert.equal(f.surface.actionBridge.pending.size,0);assert.equal(f.surface.gate.inFlight,0);
 }finally{f.close();}
});
test('dynamic runtime: data rows and list updates preserve immutable bulk packets without normal readback',async()=>{
 const view=h('Grid',{},h('DataGrid',{id:'grid',itemsSource:dataSource({columns:[{field:'name',type:'text'}],rows:[],capacity:16})}),h('ListBox',{id:'list',items:[],itemCapacity:8}));
 const f=await fixture({viewOverride:view,options:{performanceHUD:false}});try{
  f.surface.render();await f.complete();f.surface.dataSource('grid').upsert({id:9,name:'new'});f.surface.list('list').replace(['First']);assert.equal(f.surface.commands.length,2);f.surface.render();assert.equal(f.surface.commands.length,1);assert.ok(dispatches(f.latest()).some(x=>x.entry==='filterScan'));await f.complete();f.surface.render();assert.equal(f.surface.commands.length,0);assert.ok(dispatches(f.latest()).some(x=>x.entry==='layoutLists'));assert.equal(f.maps.length,0);await f.complete();
 }finally{f.close();}
});
test('dynamic runtime: a preview borrows device/pipelines and contributes to one owning frame submission',async()=>{
 const f=await fixture({viewOverride:createGPUShell({code:'return Helion.h("Panel");'}),options:{performanceHUD:false,profiling:false}});try{
  const parent=f.surface,originalHeap=parent.heapBuffer,originalNodes=parent.nodeBuffer,requests=f.requests.length;
  parent.render();await f.complete();const child=await parent.attachSurface('preview',h('TextBox',{id:'text',text:'child'}),{fonts:[diagnosticFont()],startupWorker:false});assert.ok(child);assert.equal(child.device,parent.device);assert.equal(child.ownerSurface,parent);assert.equal(f.requests.length,requests);assert.equal(child.pipelines.get('emit').pipeline,parent.pipelines.get('emit').pipeline);assert.notEqual(child.pipelines.get('emit'),parent.pipelines.get('emit'));assert.notEqual(child.heapBuffer,parent.heapBuffer);assert.equal(child.manifest.editorInboxCapacity,65536);
  const start=f.graphs.length,parentBytes=parent.stats.uploadedBytes,childBytes=child.stats.uploadedBytes;parent.render();assert.equal(f.graphs.length-start,1);assert.equal(f.latest().filter(p=>p.type==='present').length,1);assert.equal(dispatches(f.latest()).filter(x=>x.entry==='composite').length,2);assert.equal(child.frameU[9]&8192,8192);assert.equal(child.input,null);assert.equal(f.maps.length,0);assert.equal(child.stats.uploadedBytes-childBytes,64);assert.equal(parent.stats.uploadedBytes-parentBytes,96,'Parent enable command plus uniform');assert.equal(parent.heapBuffer,originalHeap);assert.equal(parent.nodeBuffer,originalNodes);await f.complete();
  parent.start();assert.equal(f.rafs.size,1);assert.equal(child.running,false);parent.stop();parent.detachSurface();await f.complete();assert.equal(child.disposed,true);assert.notEqual(f.device.destroyed,true);assert.equal(parent.heapBuffer,originalHeap);
 }finally{f.close();}
});
test('dynamic runtime: preview resize changes texture/metadata without a DOM preview rectangle or workspace remount',async()=>{
 const f=await fixture({viewOverride:h('SurfacePresenter',{id:'preview',presenterWidth:400,presenterHeight:300}),options:{performanceHUD:false}});try{
  const child=await f.surface.attachSurface('preview',h('Button',{text:'Hi'}),{fonts:[diagnosticFont()],startupWorker:false});const heap=f.surface.heapBuffer;f.surface.setPresenterSize(390,844);assert.equal(child.viewport.width,390);assert.equal(child.viewport.height,844);assert.equal(f.surface.heapBuffer,heap);assert.equal(f.writes.at(-1).data.byteLength,8);assert.throws(()=>f.surface.setPresenterSize(0,32));f.surface.setPresenterSize(0,0);assert.equal(child.viewport.width,f.surface.viewport.width);assert.equal(child.viewport.height,f.surface.viewport.height);f.surface.render();await f.complete();assert.equal(f.maps.length,0);
 }finally{f.close();}
});
test('dynamic runtime: unsupported nested/optional feature attachments fail without losing the old preview',async()=>{
 const f=await fixture({viewOverride:h('SurfacePresenter',{id:'preview'}),options:{performanceHUD:false}});try{
  const old=await f.surface.attachSurface('preview',h('TextBlock',{text:'kept'}),{fonts:[diagnosticFont()],startupWorker:false});await assert.rejects(()=>f.surface.attachSurface('preview',h('SurfacePresenter'),{fonts:[diagnosticFont()],startupWorker:false}),/Nested/);await assert.rejects(()=>f.surface.attachSurface('preview',h('CodeEditor'),{fonts:[diagnosticFont()],startupWorker:false}),/required/);assert.equal(f.surface.embedded.surface,old);assert.equal(old.disposed,false);
 }finally{f.close();}
});
test('dynamic runtime: detach cancels in-progress attachment before it can replace a newer state',async()=>{
 const f=await fixture({viewOverride:h('SurfacePresenter',{id:'preview'}),options:{performanceHUD:false}});try{
  const pending=f.surface.attachSurface('preview',h('TextBlock',{text:'late'}),{fonts:[diagnosticFont()],startupWorker:false});f.surface.detachSurface();assert.equal(await pending,null);assert.equal(f.surface.embedded,null);assert.notEqual(f.device.destroyed,true);
 }finally{f.close();}
});
test('dynamic runtime: GPU editor change delivery is explicitly enabled and unrelated editor input is not a host polling loop',async()=>{
 const f=await fixture({viewOverride:h('CodeEditor',{id:'source',changeAction:'source-change',documentCapacity:256}),options:{performanceHUD:false,onAction:()=>{}}});try{
  f.surface.send(Opcode.Text,{c:97});f.surface.render();await f.complete();assert.equal(f.maps.length,0);f.surface.options.editorChangeEvents=true;f.surface.send(Opcode.Text,{c:98});f.surface.render();await f.surface.actionBridge.delivery;await f.complete();assert.equal(f.maps.length,1);
 }finally{f.close();}
});

test('dynamic runtime: Fit writes a frame template once and copies GPU-derived dimensions before child work',async()=>{
 const f=await fixture({viewOverride:h('SurfacePresenter',{id:'p'}),options:{performanceHUD:false,profiling:false}});try{
  const child=await f.surface.attachSurface('p',h('TextBox',{id:'text'}),{fonts:[diagnosticFont()],startupWorker:false});const before=f.writes.length;f.surface.render();
  const graph=f.latest(),prepare=graph.findIndex(p=>p.dispatches?.some(d=>d.entry==='preparePresenterFrame')),copy=graph.findIndex(p=>p.type==='copy'&&p.destination===child.frameBuffer),secondClear=graph.findIndex((p,i)=>i>copy&&p.dispatches?.some(d=>d.entry==='clearFrame'));
  assert.ok(prepare>=0&&copy>prepare&&secondClear>copy);assert.equal(graph[copy].source,f.surface.forwardedBuffer);assert.equal(graph[copy].sourceOffset,67588*4);assert.equal(graph[copy].size,64);
  const writes=f.writes.slice(before);assert.equal(writes.filter(w=>w.buffer===child.frameBuffer).length,0);assert.equal(writes.filter(w=>w.buffer===f.surface.forwardedBuffer&&w.offset===67588*4).length,1);assert.equal(f.maps.length,0);await f.complete();
 }finally{f.close();}
});

test('sharp text runtime: defaults select direct curves and native pixels without extra uploads',async()=>{
 const f=await fixture();try{
  assert.equal(f.surface.textQuality,'sharp');assert.equal(f.surface.resolutionMode,'native');
  f.surface.render();assert.equal(f.surface.frameU[9]&16384,0);assert.equal(f.surface.stats.uploadedBytes,64);
  assert.ok(f.surface.hudOutput);assert.ok(dispatches(f.latest()).some(d=>d.entry==='compositeHud'));
  assert.equal(f.maps.length,0);await f.complete();
 }finally{f.close();}
});
test('sharp text runtime: live quality switches invalidate pixels and HUD masks, not text metrics or documents',async()=>{
 const f=await fixture();try{
  f.surface.render();await f.complete();const heap=f.surface.heapBuffer,node=f.surface.nodeBuffer;
  f.surface.setTextQuality('reference');assert.ok(f.surface.resized&&f.surface.hudFontDirty);f.surface.render();await f.complete();
  assert.equal(f.surface.frameU[9]&16384,16384);assert.equal(f.surface.frameU[8]&1,1);
  assert.ok(dispatches(f.latest()).some(d=>d.entry==='rasterHudFont'));
  f.surface.setTextQuality('sharp');f.surface.render();await f.complete();assert.equal(f.surface.frameU[9]&16384,0);
  assert.equal(f.surface.heapBuffer,heap);assert.equal(f.surface.nodeBuffer,node);assert.equal(f.surface.stats.uploadedBytes,192);assert.equal(f.maps.length,0);
  assert.throws(()=>f.surface.setTextQuality('sharpen'));
 }finally{f.close();}
});
test('sharp text runtime: DPR changes without CSS resize recreate native output and masks',async()=>{
 const f=await fixture();try{
  f.surface.render();await f.complete();window.devicePixelRatio=3;f.surface.render();await f.complete();
  assert.equal(f.surface.viewport.w,1920);assert.equal(f.surface.viewport.h,1440);assert.equal(f.surface.viewport.dpr,3);
  assert.ok(dispatches(f.latest()).some(d=>d.entry==='rasterHudFont'));assert.equal(f.surface.resolution.limitedBy,null);
  const resolution=f.surface.resolution;resolution.w=1;assert.equal(f.surface.viewport.w,1920,'diagnostics must return a copy');
  assert.equal(f.maps.length,0);assert.equal(f.surface.stats.uploadedBytes,128);
 }finally{f.close();}
});
test('sharp text runtime: balanced/native mode switches preserve buffer identity and expose the cap',async()=>{
 const f=await fixture();try{
  f.surface.canvas.getBoundingClientRect=()=>({width:1920,height:1080});window.devicePixelRatio=2;f.surface.resizePending=true;
  f.surface.render();await f.complete();const state=f.surface.stateBuffer,heap=f.surface.heapBuffer;assert.equal(f.surface.viewport.w,3840);
  f.surface.setResolutionMode('balanced');f.surface.render();await f.complete();assert.equal(f.surface.viewport.w,2048);assert.equal(f.surface.resolution.limitedBy,'balanced-policy');
  f.surface.setResolutionMode('native');f.surface.render();await f.complete();assert.equal(f.surface.viewport.w,3840);assert.equal(f.surface.resolution.nativeResolution,true);
  assert.equal(f.surface.heapBuffer,heap);assert.equal(f.surface.stateBuffer,state);assert.equal(f.maps.length,0);assert.throws(()=>f.surface.setResolutionMode('upscale'));
 }finally{f.close();}
});
test('sharp text runtime: hidden HUD skips mask, format and compute compositor dispatches',async()=>{
 const f=await fixture();try{
  f.surface.render();await f.complete();const texture=f.surface.hudOutput;f.surface.setPerformanceHUD(false);f.surface.render();await f.complete();
  const entries=dispatches(f.latest()).map(d=>d.entry);for(const entry of ['rasterHudFont','buildHudText','compositeHud'])assert.ok(!entries.includes(entry));
  assert.equal(f.surface.hudOutput,texture);f.surface.setPerformanceHUD(true);f.surface.render();await f.complete();
  assert.ok(dispatches(f.latest()).some(d=>d.entry==='compositeHud'));assert.ok(!dispatches(f.latest()).some(d=>d.entry==='rasterHudFont'));
  assert.equal(f.maps.length,0);
 }finally{f.close();}
});
test('sharp text runtime: copy stages cannot access font outlines or glyph masks',async()=>{
 const f=await fixture();try{
  f.surface.render();await f.complete();const draws=f.latest().find(p=>p.type==='present').draws;
  for(const draw of draws){assert.ok(!draw.group.entries.some(e=>e.resource.buffer===f.surface.heapBuffer||e.resource.buffer===f.surface.hudFontBuffer));}
  const compute=dispatches(f.latest()).find(d=>d.entry==='compositeHud');assert.ok(compute.group.entries.some(e=>e.resource.buffer===f.surface.heapBuffer));
  assert.ok(compute.group.entries.some(e=>e.binding===7));assert.equal(f.latest().filter(p=>p.type==='present').length,1);
 }finally{f.close();}
});
test('sharp text runtime: exact device pixel observation controls the integer backing size',async()=>{
 const f=await fixture();try{
  window.devicePixelRatio=2;f.surface.resize();f.surface.canvas.getBoundingClientRect=()=>({width:99.66,height:80});
  f.surface.pixelObservation={w:200,h:160,width:99.66,height:80};f.surface.resizePending=true;f.surface.render();await f.complete();
  assert.equal(f.surface.viewport.w,200);assert.equal(f.surface.viewport.devicePixelBox,true);assert.equal(f.surface.stats.uploadedBytes,64);
 }finally{f.close();}
});

test('sharp text runtime: missing optional limits in precompiled scenes normalize before arena allocation',async()=>{
 const c=compile(h('TextBlock',{text:'Compiled'}),{fonts:[diagnosticFont()]});delete c.limits.maxRenderTiles;
 const f=await fixture({viewOverride:c});try{
  assert.equal(f.surface.manifest.limits.maxRenderTiles,65536);
  assert.equal(f.surface.constants.DAMAGE,f.surface.gpuTemplate.constants.DAMAGE);
  assert.equal(f.surface.constants.GLYPH_STATS,f.surface.gpuTemplate.constants.GLYPH_STATS);
  assert.equal(c.limits.maxRenderTiles,undefined,'the supplied compiled manifest is not mutated');
 }finally{f.close();}
});

test('runtime host: partitioned pipelines exclude irrelevant functions without changing the graph',async()=>{
 const f=await fixture();try{
  const kernel=f.surface.pipelines.get('flatten').pipeline.compute.module.code;
  assert.doesNotMatch(kernel,/fn (?:editorCommand|dsCommand)\(/);
  assert.equal(f.surface.startup.shaderCompilation,'partitioned');
  assert.ok(f.surface.startup.shaderPrograms.length>1);
  f.surface.render();await f.complete();assert.equal(f.maps.length,0);
 }finally{f.close();}
});
test('runtime host: monolithic compilation remains a same-feature diagnostic reference',async()=>{
 const f=await fixture({options:{shaderCompilation:'monolithic'}});try{
  assert.match(f.surface.pipelines.get('flatten').pipeline.compute.module.code,/fn dsCommand\(/);
  assert.equal(f.surface.startup.shaderPrograms.length,1);f.surface.render();await f.complete();
 }finally{f.close();}
});
test('runtime host: a GPU notification stall stops submissions but does not forge completed frames',async()=>{
 let observed;const f=await fixture({options:{gpuWatchdogMs:10,onError:error=>observed=error}});
 try{f.surface.start();f.tick(1000);await new Promise(resolve=>setTimeout(resolve,35));
  assert.ok(observed);assert.match(observed.message,/GPU progress notifications stopped/);assert.equal(f.surface.faulted,true);
  assert.equal(f.surface.stats.completedFrames,0);assert.equal(f.surface.gate.inFlight,1);const frames=f.surface.stats.frames;
  f.tick(1016);assert.equal(f.surface.stats.frames,frames);await f.complete();assert.equal(f.surface.stats.completedFrames,1);assert.equal(f.surface.faulted,true);
 }finally{f.close();}
});
