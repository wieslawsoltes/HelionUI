import {BUILD_VERSION} from '../src/version.js';
import { HelionSurface, DEFAULT_FONT_SOURCES, Opcode, clearStartupCache } from '../src/index.js';
import { METRICS_BYTES, decodePerformance } from '../src/gpu/performance.js';
import { createShowcase } from '../examples/showcase.js';
const runButton=document.querySelector('#run'),saveButton=document.querySelector('#save'),log=document.querySelector('#log');
let result,active;
const frame=()=>new Promise(requestAnimationFrame);
const distribution=values=>{const a=[...values].sort((x,y)=>x-y);return{samples:a.length,median:a[Math.floor(a.length*.5)]??null,p95:a[Math.min(a.length-1,Math.floor(a.length*.95))]??null,max:a.at(-1)??null};};
const failWhenHidden=()=>{if(document.hidden)throw new Error('The page was hidden; background throttling invalidates this foreground cadence run.');};
async function readMetrics(surface){
 const buffer=surface.device.createBuffer({size:METRICS_BYTES,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
 try{
  const encoder=surface.device.createCommandEncoder({label:'Explicit AFTER-phase benchmark metrics read'});
  encoder.copyBufferToBuffer(surface.metricsBuffer,0,buffer,0,METRICS_BYTES);surface.device.queue.submit([encoder.finish()]);
  await buffer.mapAsync(GPUMapMode.READ);surface.stats.readbackBytes+=METRICS_BYTES;
  return new Uint32Array(buffer.getMappedRange().slice(0));
 }finally{buffer.unmap();buffer.destroy();}
}
async function phase(surface,name,duration){
 // The renderer independently schedules its selected submission loop; this observer never admits a
 // frame, waits for a fence, maps a buffer or polls GPU control state inside a phase.
 surface.start();
 const warmup=performance.now();while(performance.now()-warmup<1000){await frame();failWhenHidden();if(surface.faulted)throw new Error(surface.errors.join('\n'));}
 const intervals=[];let previous=null,ticks=0,wheels=0;
 const begin=await frame(),before={...surface.stats};const target=surface.id('resources');let last=begin;
 do{
  last=await frame();failWhenHidden();if(surface.faulted)throw new Error(surface.errors.join('\n'));
  if(previous!=null)intervals.push(last-previous);previous=last;ticks++;
  if(name==='fractional-scroll'){
   // Rate is elapsed time, not a fixed distance per refresh. No CPU hit testing.
   const dt=Math.min(intervals.at(-1)||0,50);
   surface.send(Opcode.Wheel,{target,b:dt*.6});wheels++;
  }
 }while(last-begin<duration);
 const after={...surface.stats},elapsedMs=last-begin;
 surface.stop();await surface.lastSubmissionCompletion; // OUTSIDE the measured interval
 const words=await readMetrics(surface),snapshot=await surface.inspect({includeNodes:false});
 if(snapshot.errors.length)throw new Error(snapshot.errors.join('\n'));
 if(snapshot.state[15])throw new Error(`Arena overflow ${snapshot.state[15]}; incomplete pixels invalidate the performance run.`);
 const performanceSnapshot=decodePerformance(words);if(performanceSnapshot.timestampErrors)throw new Error('Invalid GPU timestamp intervals; timing run rejected rather than treating missing values as zero.');
 const count=Math.min(after.frames-before.frames,120),f=new Float32Array(words.buffer),rows=[];
 for(let i=0;i<count;i++){const slot=(words[0]+120-count+i)%120;rows.push([...f.slice(32+slot*4,36+slot*4)]);}
 return{name,elapsedMs,observerCallbacks:ticks,observerRafHz:intervals.length?1000*intervals.length/intervals.reduce((a,b)=>a+b,0):null,
  observerIntervalMs:distribution(intervals),appRafCallbacks:after.animationFrameCallbacks-before.animationFrameCallbacks,
  submittedFrames:after.frames-before.frames,submittedFps:(after.frames-before.frames)*1000/elapsedMs,
  acknowledgedBeforeStop:after.completedFrames-before.completedFrames,skippedSubmissions:after.skippedSubmissions-before.skippedSubmissions,
  peakPendingAcknowledgementsSinceMount:after.peakFramesInFlight,queuedWheelCommands:wheels,
  explicitFrameUploadBytes:after.uploadedBytes-before.uploadedBytes,
  timingWindow:{note:'Last at most 120 admitted frames; explicit readback only after stopping and draining.',samples:count,
   admittedIntervalMs:distribution(rows.map(x=>x[0])),layoutMs:distribution(rows.map(x=>x[1])),gpuSpanOrCpuEncodeMs:distribution(rows.map(x=>x[2])),
   dataMs:surface.gpuTiming?distribution(rows.map(x=>x[3])):null,mode:surface.gpuTiming?'GPU timestamp ms':'CPU encode ms — NOT GPU duration'},
  performanceSnapshot,hostSync:surface.inspectFrameSync(),overflowBits:snapshot.state[15]};
}
runButton.addEventListener('click',async()=>{
 runButton.disabled=true;saveButton.disabled=true;
 const submissionMode=document.querySelector('#mode').value;
 const timingDetail=document.querySelector('#timing-detail').value,parallelGrid=!document.querySelector('#serial-grid').checked,hudScissor=!document.querySelector('#full-hud').checked;
 const maxFramesInFlight=Number(document.querySelector('#credits').value),duration=Number(document.querySelector('#duration').value);
 const files=[...document.querySelector('#fonts').files];
 result={version:BUILD_VERSION,status:'RUNNING',started:new Date().toISOString(),userAgent:navigator.userAgent,maxFramesInFlight,submissionMode,timingDetail,parallelGrid,hudScissor,
  scope:'Real fonts, complete 65536-row scene, normal DPR/resolution policy, selected continuous submission loop. Not physical presentation/scanout, not old-version full-engine A/B. Second mount may benefit from HTTP, driver and optional scene caches.',
  fontSource:files.length?'Local user-selected files; NOT persisted':'Pinned Noto Sans runtime URLs',runs:[]};
 try{
  failWhenHidden();
  result.cacheCleared=document.querySelector('#clear').checked?await clearStartupCache():false;
  for(const attempt of ['first-start','repeat-start']){
   const progress=[];log.textContent=`${attempt}: preparing full scene and native pipelines…`;
   active=await HelionSurface.mount(document.querySelector('#test-surface'),createShowcase(),{
    fontSources:files.length?files.map(source=>({source})):DEFAULT_FONT_SOURCES,
    startupWorker:true,startupCache:'native-startup-cadence-v1',maxFramesInFlight,submissionMode,timingDetail,parallelGrid,hudScissor,performanceHUD:true,input:false,
    onStartup:event=>{progress.push(event);log.textContent=`${attempt}: ${event.detail} (${event.elapsedMs.toFixed(0)} ms)`;}
   });
   const firstWait=performance.now();
   while(active.startup.status!=='ready'){
    await frame();failWhenHidden();if(active.faulted)throw new Error(active.errors.join('\n')||'GPU startup failed');
    if(performance.now()-firstWait>120000)throw new Error('No completed first full-quality frame within 120 seconds.');
   }
   // Do not mix optional HUD compilation into the steady-state phases.
   await active.ensureHUD();
   if(active.hudError)throw new Error(active.hudError);
   active.render(performance.now());await active.whenSubmittedWorkDone();
   active.startup.firstHUDCompletedMs=performance.now()-active.startup.startedAt;
   const run={attempt,adapter:active.adapterInfo,viewport:{...active.viewport},startup:{...active.startup},progress,
    rows:65536,views:active.manifest.nodeCount,fonts:active.manifest.fonts,gpuTiming:active.gpuTiming,phases:[]};result.runs.push(run);
   active.stop();await active.lastSubmissionCompletion;
   for(const name of ['idle','fractional-scroll']){run.phases.push(await phase(active,name,duration));log.textContent=JSON.stringify(result,null,2);}
   run.finalStats={...active.stats};active.dispose();active=null;
  }
  result.status='COMPLETED';
 }catch(error){result.status='FAIL';result.error=error.stack||String(error);}
 finally{active?.dispose();active=null;result.finished=new Date().toISOString();log.textContent=JSON.stringify(result,null,2);globalThis.__HELION_STARTUP_RESULT__=result;runButton.disabled=false;saveButton.disabled=false;}
});
saveButton.addEventListener('click',()=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='helion-native-startup-cadence.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
