import {BUILD_VERSION} from '../src/version.js';
import { HelionSurface, h, Opcode, DEFAULT_FONT_SOURCES } from '../src/index.js';
import { createShowcase } from '../examples/showcase.js';
import { fixtureFont } from './font-fixture.mjs';
const run = document.querySelector('#run'), save = document.querySelector('#save'), log = document.querySelector('#log');
let surface, result;
const raf = () => new Promise(requestAnimationFrame);
function check() {
  if(document.hidden)throw new Error('Hidden page: foreground scheduling run invalidated.');
  if(surface?.faulted)throw new Error(surface.errors.join('\n')||'GPU failure');
}
async function drain() {
  let timer;
  try { await Promise.race([surface.whenSubmittedWorkDone(), new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Queue drain exceeded 15 seconds. Work is not assumed completed.')),15000);})]); }
  finally { clearTimeout(timer); }
}
async function observe(ms, scroll) {
  const begin=performance.now();let previous=null,ticks=0,peak=0;
  while(performance.now()-begin<ms){
    const stamp=await raf();check();ticks++;peak=Math.max(peak,surface.stats.pendingAcknowledgements);
    if(scroll&&previous!=null)surface.send(Opcode.Wheel,{target:surface.id('resources'),b:Math.min(50,stamp-previous)*.6});
    previous=stamp;
  }
  return {ticks,peak};
}
run.addEventListener('click',async()=>{
 run.disabled=true;save.disabled=true;
 const full=document.querySelector('#workload').value==='showcase';
 const hud=document.querySelector('#hud').checked,detail=document.querySelector('#timing').value;
 const limits=document.querySelector('#reverse').checked?[0,2,0]:[2,0,2],duration=Number(document.querySelector('#duration').value);
 result={version:BUILD_VERSION,status:'RUNNING',userAgent:navigator.userAgent,startedAt:new Date().toISOString(),
   scope:'Same-version native policy comparison. No physical scanout, input-to-photon or old-release FPS claim.',
   workload:full?'full-real-font-showcase':'small-original-fixture',limits,timingDetail:detail,hud,phases:[]};
 try{
  check();log.textContent='Preparing the scene once; pipeline/asset startup is outside the measured phases.';
  const files=[...document.querySelector('#fonts').files];
  const fonts=full?{fontSources:files.length?files.map(source=>({source})):DEFAULT_FONT_SOURCES}:{fonts:[fixtureFont()]};
  const view=full?createShowcase():h('Grid',{rows:'40 *',padding:12,background:'#102431'},
    h('TextBlock',{text:'Vsync scheduling probe',fontSize:18}),
    h('DataGrid',{id:'resources',row:1,rowCount:128,rowHeight:30}));
  surface=await HelionSurface.mount(document.querySelector('#pacing-surface'),view,{...fonts,autoStart:false,input:false,
    performanceHUD:hud,timingDetail:detail,profiling:true,submissionMode:'vsync',maxFramesInFlight:2});
  if(!surface.render())throw new Error('Initial frame not admitted');await drain();
  if(hud){await surface.ensureHUD();if(surface.hudError)throw new Error(surface.hudError);surface.render();await drain();}
  const viewport={...surface.viewport};result.adapter=surface.adapterInfo;result.viewport=viewport;
  result.startup={...surface.startup};result.fonts=surface.manifest.fonts;
  for(const [index,limit] of limits.entries()){
    surface.stop();await drain();surface.setMaxFramesInFlight(limit);
    surface.set('resources','scrollY',0);surface.render();await drain();
    log.textContent=`Arm ${index+1}/3: ${limit?'paced (2)':'unbounded reference'} — warming up…`;
    surface.start();await observe(1000,false);
    // Reset and drain once between warmup and measurement, NEVER once per frame.
    surface.stop();await drain();surface.start();
    const before={...surface.stats},begin=performance.now();
    log.textContent=`Arm ${index+1}/3: ${limit?'paced (2)':'unbounded reference'} — continuous scroll, ${duration/1000}s…`;
    const observed=await observe(duration,true),end=performance.now(),after={...surface.stats};
    surface.stop();const drainStart=performance.now();await drain();const drainMs=performance.now()-drainStart;
    const timing=await surface.inspectPerformance(),snapshot=await surface.inspect({includeNodes:false});
    if(snapshot.errors.length||snapshot.state[15])throw new Error(`Invalid GPU run: ${snapshot.errors.join('; ')} overflow=${snapshot.state[15]}`);
    if(surface.viewport.w!==viewport.w||surface.viewport.h!==viewport.h||surface.viewport.dpr!==viewport.dpr)throw new Error('Viewport changed; repeat with a fixed viewport.');
    const callbacks=after.animationFrameCallbacks-before.animationFrameCallbacks,submissions=after.frames-before.frames;
    const deferrals=after.rafCapacityDeferrals-before.rafCapacityDeferrals;
    if(limit&&observed.peak>limit)throw new Error('Bounded admission invariant violated');
    result.phases.push({index,limit,elapsedMs:end-begin,callbacks,submissions,capacityDeferrals:deferrals,
      callbackHz:callbacks*1000/(end-begin),submissionHz:submissions*1000/(end-begin),
      observedPeakUnacknowledged:observed.peak,unacknowledgedAtStop:after.pendingAcknowledgements,
      drainNotificationMs:drainMs,checkpointRequests:after.completionCheckpoints-before.completionCheckpoints,
      explicitUploads:after.uploadedBytes-before.uploadedBytes,readbackBytesDuringPhase:after.readbackBytes-before.readbackBytes,
      timing,frameSync:surface.inspectFrameSync(),overflow:snapshot.state[15]});
  }
  result.status='COMPLETED';
 }catch(error){result.status='FAILED';result.error=error.stack||String(error);}
 finally{surface?.dispose();surface=null;result.finishedAt=new Date().toISOString();log.textContent=JSON.stringify(result,null,2);
   globalThis.__HELION_PACING_RESULT__=result;run.disabled=false;save.disabled=false;}
});
save.addEventListener('click',()=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='helion-native-pacing.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
