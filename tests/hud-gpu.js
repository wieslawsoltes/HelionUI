/** Native HUD gate. Explicit readbacks belong only to this test, not to the app. */
import {h,compile,HelionSurface,loadFonts,DEFAULT_FONT_SOURCES} from '../src/index.js';
import {fixtureFont} from './font-fixture.mjs';
import { METRICS_BYTES } from '../src/gpu/performance.js';
import {polygonPixelCoverage} from './hud-reference.mjs';
const canvas=document.querySelector('#hud-canvas'),log=document.querySelector('#hud-log'),button=document.querySelector('#run-hud'),previewButton=document.querySelector('#preview-hud');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
let active;
async function readBuffer(surface,source){
 const b=surface.device.createBuffer({size:source.size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 try{const e=surface.device.createCommandEncoder();e.copyBufferToBuffer(source,0,b,0,source.size);surface.device.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);return new Uint32Array(b.getMappedRange().slice(0));}
 finally{b.unmap();b.destroy();}
}
async function capturePresentation(surface){
 const {w,h}=surface.viewport,stride=Math.ceil(w*4/256)*256;
 const texture=surface.device.createTexture({size:[w,h],format:surface.format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
 const b=surface.device.createBuffer({size:stride*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 try{const e=surface.device.createCommandEncoder(),p=e.beginRenderPass({colorAttachments:[{view:texture.createView(),loadOp:'clear',storeOp:'store',clearValue:[0,0,0,1]}]});
  p.setPipeline(surface.hudFullscreenPipeline);p.setBindGroup(0,surface.hudFullscreenBindGroup);p.draw(3);p.end();
  e.copyTextureToBuffer({texture},{buffer:b,bytesPerRow:stride},[w,h]);surface.device.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);
  return {bytes:new Uint8Array(b.getMappedRange().slice(0)),stride,w,h};
 }finally{b.unmap();b.destroy();texture.destroy();}
}
async function mount(fonts){
 active?.dispose();const compiled=compile(h('Border',{background:'#102030'}),{fonts,limits:{maxDimension:1536,maxPrimitives:1024,maxJobs:8192,maxStrips:16384,maxAlphaTiles:8192,glyphCacheSlots:128}});
 active=await HelionSurface.mount(canvas,compiled,{autoStart:false,input:false,performanceHUD:true,deferHUD:false,pixelRatio:1});return {surface:active,compiled};
}
async function step(surface){assert(surface.render(performance.now()),'Frame admission failed');await surface.lastSubmissionCompletion;assert(!surface.faulted&&!surface.errors.length,surface.errors.join('\n'));}
export async function runHudChecks(){
 button.disabled=true;previewButton.disabled=true;log.textContent='';const result={status:'RUNNING',nativeGPU:true,checks:[],started:new Date().toISOString(),performanceMeasured:false};globalThis.__HELION_HUD_RESULT__=result;
 const pass=message=>{result.checks.push(message);log.textContent+=`PASS  ${message}\n`;};
 try{
  const {surface,compiled}=await mount([fixtureFont()]);result.adapter=surface.adapterInfo;pass('native core, font-HUD and presentation pipelines create');
  await step(surface);const font1=await readBuffer(surface,surface.hudFontBuffer),planRuns=font1[1];
  assert(planRuns===1,'HUD font did not rasterize exactly once');assert(surface.stats.uploadedBytes===64,'Initial normal frame payload is not 64 bytes');
  const face=compiled.state[32],page=compiled.heap[compiled.heap[face+5]],gid=compiled.heap[page+65]-1,path=compiled.heap[compiled.heap[face+4]+gid*4];
  const slot=95+65-32,at=16+slot*8,f=new Float32Array(font1.buffer),em=f[at+1],ox=f[at+3],oy=f[at+4],w=font1[at+5],height=font1[at+6];
  assert(font1[at]===path,'HUD did not reuse the retained real-outline record');assert(font1[at+7]===1,'Fixture glyph was not cached');
  const polygon=[[0,0],[Math.fround(Math.fround(.3)*em),Math.fround(Math.fround(-.7)*em)],[Math.fround(Math.fround(.6)*em),0]];
  let fractional=0,maxDifference=0;
  for(let y=0;y<height;y++)for(let x=0;x<w;x++){
   const word=font1[1536+slot*1024+y*16+(x>>>2)],actual=(word>>>((x&3)*8))&255;
   const expected=Math.round(polygonPixelCoverage(polygon,ox+x,oy+y)*255);maxDifference=Math.max(maxDifference,Math.abs(actual-expected));
   if(actual>0&&actual<255)fractional++;
  }
  assert(maxDifference<=1,`Native analytical mask differs from independent clipped-polygon reference by ${maxDifference}/255`);
  assert(fractional>10,'Glyph mask has no antialiased boundary coverage');result.maxCoverageDifference=maxDifference;
  pass('native font mask matches independent triangle/pixel area within one 8-bit coverage unit');
  await step(surface);assert((await readBuffer(surface,surface.hudFontBuffer))[1]===planRuns,'Warm frame rebuilt HUD font masks');
  const draw=await readBuffer(surface,surface.hudDrawBuffer);assert(draw[0]>100&&draw[0]<512,'HUD text list is unexpectedly empty or full');assert(draw[1]===0,'HUD allocation/bin overflow');
  pass('warm GPU-formatted counters and labels reuse font masks, with no HUD arena overflow');
  const capture=await capturePresentation(surface);assert(capture.bytes.length===capture.stride*capture.h,'Presentation readback size');
  const levels=new Set();for(let y=0;y<capture.h;y++)for(let x=0;x<capture.w;x++)levels.add(capture.bytes[y*capture.stride+x*4]);
  assert(levels.size>32,'Expected smooth coverage/gradient tones in native presentation');pass('native final presentation contains smooth coverage rather than a binary glyph mask');
  surface.setPerformanceHUD(false);await step(surface);assert((await readBuffer(surface,surface.hudFontBuffer))[1]===planRuns,'Hidden HUD rasterized fonts');
  surface.options.pixelRatio=1.5;surface.resizePending=true;await step(surface);surface.setPerformanceHUD(true);await step(surface);
  const resized=await readBuffer(surface,surface.hudFontBuffer);assert(resized[1]===planRuns+1,'Changed DPR did not refresh the cached masks once');
  assert(Math.abs(new Float32Array(resized.buffer)[0]-1.5)<.0001,'Cached HUD pixel scale is stale');
  pass('hidden/show lifecycle and DPR change rebuild masks once at the correct scale');
  await step(surface);assert((await readBuffer(surface,surface.hudFontBuffer))[1]===planRuns+1,'Warm resized frame rerasterized masks');
  assert(surface.stats.uploadedBytes===surface.stats.frames*64,'HUD increased the normal per-frame payload');assert(surface.stats.readbackBytes===0,'Normal HUD invoked diagnostic inspect/readback');
  pass('normal frame upload remains 64 bytes, and the runtime does not invoke diagnostic readback');
  result.status='PASS';result.stats={...surface.stats};log.textContent+='\nPASS on this adapter. This is not a throughput, full-font fidelity, or display-rate benchmark.\n';
 }catch(error){result.status='FAIL';result.error=error.stack||String(error);log.textContent+=`\nFAIL  ${result.error}\n`;}
 finally{button.disabled=false;previewButton.disabled=false;result.finished=new Date().toISOString();globalThis.__HELION_HUD_RESULT__=result;}
 return result;
}
async function preview(){
 previewButton.disabled=true;button.disabled=true;
 try{
  const file=document.querySelector('#hud-font-file').files[0],fonts=await loadFonts(file?[{source:file}]:[DEFAULT_FONT_SOURCES[0]]),{surface}=await mount(fonts);await step(surface);
  const words=new Uint32Array(METRICS_BYTES/4),f=new Float32Array(words.buffer);words[1]=120;words[2]=1;f[3]=50;f[4]=16.6;f[5]=0;f[6]=18.9;f[7]=.1;f[11]=1000/119;f[12]=119;words[13]=120;words[28]=120;f[9]=49.5;words[31]=3;f[17]=.3;f[14]=.04;f[15]=.1;f[20]=18.5;f[21]=18.9;f[3392]=18.9;f[3393]=0;f[3394]=0;f[3395]=18.8;words[3396]=0;words[3397]=0;
  for(let j=0;j<120;j++){f[32+j*4]=16.6+(j===66?42:j%13===0?3:0);f[32+j*4+1]=j===46?2.8:0;f[32+j*4+2]=18.9+Math.sin(j*.2)*.35;}
  // TEST-ONLY deterministic history injection. Never used by the showcase or frame loop.
  surface.device.queue.writeBuffer(surface.metricsBuffer,0,words);const e=surface.device.createCommandEncoder(),p=e.beginComputePass();
  p.setPipeline(surface.hudPipelines.get('buildHudText'));p.setBindGroup(0,surface.hudBindGroups.get('buildHudText'));p.dispatchWorkgroups(1);p.setPipeline(surface.hudPipelines.get('compositeHud'));p.setBindGroup(0,surface.hudCompositeBindGroup);p.dispatchWorkgroups(Math.ceil(surface.hudOutputSize[0]/8),Math.ceil(surface.hudOutputSize[1]/8));p.end();
  const r=e.beginRenderPass({colorAttachments:[{view:surface.context.getCurrentTexture().createView(),loadOp:'clear',storeOp:'store',clearValue:[0,0,0,1]}]});
  r.setPipeline(surface.hudFullscreenPipeline);r.setBindGroup(0,surface.hudFullscreenBindGroup);r.draw(3);r.end();surface.device.queue.submit([e.finish()]);await surface.device.queue.onSubmittedWorkDone();
  log.textContent='Real-font GPU preview with SYNTHETIC history, not measured FPS.\nFont: '+fonts[0].family+'\nThe isolated spike exceeds the 50 ms plot range and must retain its clipping marker.\n';
 }catch(error){log.textContent=error.stack||String(error);}finally{button.disabled=false;previewButton.disabled=false;}
}
button.addEventListener('click',runHudChecks);previewButton.addEventListener('click',preview);
if(new URLSearchParams(location.search).has('autorun'))runHudChecks();
