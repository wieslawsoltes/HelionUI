import {BUILD_VERSION} from '../src/version.js';
import { HelionSurface, Opcode, Key, loadFonts, DEFAULT_FONT_SOURCES } from '../src/index.js';
import { METRICS_BYTES, decodePerformance } from '../src/gpu/performance.js';
import { createShowcase } from '../examples/showcase.js';
const button = document.querySelector('#run-benchmark'), save = document.querySelector('#save-results'), log = document.querySelector('#benchmark-log');
const summary = values => {
  const sorted = [...values].sort((a,b) => a-b);
  return { samples: values.length, median: sorted[Math.floor(sorted.length*.5)] ?? 0, p95: sorted[Math.min(sorted.length-1, Math.floor(sorted.length*.95))] ?? 0, max: sorted.at(-1) ?? 0 };
};
const asFloat = bits => new Float32Array(new Uint32Array([bits]).buffer)[0];
let results;
async function readBuffer(surface, buffer, bytes) {
  const staging=surface.device.createBuffer({size:bytes,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  try {
    const encoder=surface.device.createCommandEncoder();encoder.copyBufferToBuffer(buffer,0,staging,0,bytes);surface.device.queue.submit([encoder.finish()]);
    await staging.mapAsync(GPUMapMode.READ); const words=new Uint32Array(staging.getMappedRange().slice(0));
    // Explicit benchmark-only readback, never used by the normal renderer.
    surface.stats.readbackBytes+=bytes;
    return words;
  } finally {staging.unmap();staging.destroy();}
}
button.addEventListener('click', async () => {
  button.disabled=true;save.disabled=true;
  const comparison=document.querySelector('#comparison').value, order=document.querySelector('#comparison-order').value;
  results={version:BUILD_VERSION,status:'RUNNING',comparison,order,userAgent:navigator.userAgent,started:new Date().toISOString(),
    notes:'Same-version A/B only. Completion includes host encoding, submitted GPU work and callback delivery, not input-to-photon or physical presentation. Cache and direct paths use the same analytical coverage and exact transform/subpixel keys. GPU timing is null when unsupported. Cold misses and fractional scrolling are measured separately. Each phase has 4 warmups and 40 samples.',runs:[]};
  let surface;
  try {
    const files=[...document.querySelector('#benchmark-fonts').files];
    log.textContent='Preparing real fonts before timed frame measurements…';
    const fontStart=performance.now();const fonts=await loadFonts(files.length?files.map(source=>({source})):DEFAULT_FONT_SOURCES);
    results.fontPreparationMs=performance.now()-fontStart;
    results.fontSource=files.length?'user-selected local files':'pinned public Noto Sans sources';
    const configurations=order==='optimized-first'?[true,false]:[false,true];
    for(const optimized of configurations) {
      const glyphCache=comparison==='glyph'?optimized:true, damageTracking=comparison==='damage'?optimized:true;
      const mountStart=performance.now();
      surface=await HelionSurface.mount(document.querySelector('#benchmark-surface'),createShowcase(),{fonts,input:false,autoStart:false,pixelRatio:1,performanceHUD:true,deferHUD:false,maxFramesInFlight:1,damageTracking,glyphCache});
      const run={mode:comparison==='glyph'?(optimized?'exact-glyph-cache':'direct-outline-reference'):(optimized?'retained-damage':'full-frame-reference'),
        glyphCache,damageTracking,mountMs:performance.now()-mountStart,adapter:surface.adapterInfo,timestampQueries:surface.gpuTiming,
        viewport:{...surface.viewport},fonts:surface.manifest.fonts,rows:65536,phases:[]};results.runs.push(run);
      const step=async issue=>{
        await new Promise(requestAnimationFrame);const started=performance.now();issue?.();
        if(!surface.render())throw new Error('Unexpected benchmark frame admission failure');
        await surface.lastSubmissionCompletion;
        if(surface.errors.length)throw new Error(surface.errors.join('\n'));
        return performance.now()-started;
      };
      const click=id=>{surface.send(Opcode.Down,{target:surface.id(id)});surface.send(Opcode.Up,{target:surface.id(id)});};
      run.coldFirstFrameMs=await step();
      const coldState=await readBuffer(surface,surface.stateBuffer,256);
      run.coldCache={hits:coldState[51],misses:coldState[52],bypasses:coldState[53]};
      await step(()=>click('pause'));
      const geometry=await surface.inspect({includeNodes:true});
      const node=surface.id('resources')*72,rect=Array.from(geometry.nodes.slice(node+52,node+56),asFloat);
      const wheel=b=>surface.send(Opcode.Wheel,{target:surface.id('resources'),x:rect[0]+70,y:rect[1]+100,b});
      const phases=[
        ['idle',()=>{}],
        ['integer-scroll',()=>wheel(19)],
        ['fractional-scroll',()=>wheel(19.375)],
        ['text-filter',i=>{if(!(i%2))surface.send(Opcode.Text,{c:97});else surface.send(Opcode.Key,{c:Key.Backspace});}],
        ['numeric-sort',()=>{const p={target:surface.id('resources'),x:rect[0]+215+118+105+40,y:rect[1]+20};surface.send(Opcode.Down,p);surface.send(Opcode.Up,p);}]
      ];
      for(const [name,issue] of phases) {
        if(name==='text-filter')await step(()=>click('search'));
        if(name==='numeric-sort')await step(()=>surface.set('search','textClear',0));
        for(let i=0;i<4;i++)await step(()=>issue(i));
        const completion=[],layoutEncode=[],renderEncode=[];
        for(let i=0;i<40;i++){completion.push(await step(()=>issue(i)));layoutEncode.push(surface.stats.cpuLayoutEncodeMs);renderEncode.push(surface.stats.cpuRenderEncodeMs);}
        // Once per phase, after timing, not a readback/queue stall inside a measured frame.
        const words=await readBuffer(surface,surface.metricsBuffer,METRICS_BYTES),state=await readBuffer(surface,surface.stateBuffer,256);
        const performanceSnapshot=decodePerformance(words);if(performanceSnapshot.timestampErrors)throw new Error(`Invalid GPU timestamps in ${name}; timing run rejected`);
        const f=new Float32Array(words.buffer),samples=[];
        for(let i=0;i<40;i++){const slot=(words[0]+120-40+i)%120;samples.push(Array.from(f.slice(32+slot*4,36+slot*4)));}
        const phase={name,performanceSnapshot,completionLatencyMs:summary(completion),cpuLayoutEncodeMs:summary(layoutEncode),cpuRenderEncodeMs:summary(renderEncode),
          gpuLayoutMs:surface.gpuTiming?summary(samples.map(s=>s[1])):null,gpuSpanMs:surface.gpuTiming?summary(samples.map(s=>s[2])):null,gpuQueryMs:surface.gpuTiming?summary(samples.map(s=>s[3])):null,
          lastFrameGlyphCache:{hits:state[51],misses:state[52],bypasses:state[53]},overflowBits:state[15]};
        if(state[15])throw new Error(`Overflow in ${name}: ${state[15]}; incomplete output invalidates this performance run`);
        run.phases.push(phase);log.textContent=JSON.stringify(results,null,2);
      }
      run.stats={...surface.stats};surface.dispose();surface=null;
    }
    results.status='PASS';
  }catch(error){results.status='FAIL';results.error=error.stack||String(error);}
  finally{surface?.dispose();results.finished=new Date().toISOString();log.textContent=JSON.stringify(results,null,2);button.disabled=false;save.disabled=false;globalThis.__HELION_BENCHMARK_RESULT__=results;}
});
save.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(results,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='helion-native-typography-performance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
