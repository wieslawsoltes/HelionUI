/** Optional real-browser frame pacing probe. Host callback gaps are not
 * compositor dropped-frame counts; GPU readback happens only after capture. */
import {parseArgs} from 'node:util';
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
const {values:a}=parseArgs({options:{base:{type:'string',default:'http://127.0.0.1:8080/'},path:{type:'string',default:'designer/'},seconds:{type:'string',default:'6'},width:{type:'string',default:'1280'},height:{type:'string',default:'900'},dpr:{type:'string',default:'1'},channel:{type:'string',default:'chrome'},timing:{type:'string',default:'frame'},trace:{type:'boolean',default:false},pointer:{type:'boolean',default:false},output:{type:'string',default:'frame-profile.json'}}});
const seconds=Number(a.seconds),width=Number(a.width),height=Number(a.height),dpr=Number(a.dpr);
if(!['off','frame','stages'].includes(a.timing))throw new Error('--timing must be off, frame or stages');
if(!Number.isFinite(seconds)||seconds<1||seconds>20||![width,height].every(n=>Number.isInteger(n)&&n>=320&&n<=4096)||!Number.isFinite(dpr)||dpr<=0||dpr>4)throw new Error('Invalid capture dimensions/duration');
const {chromium}=await import(process.env.HELION_PLAYWRIGHT_MODULE||'playwright');
const output=resolve(a.output);await mkdir(dirname(output),{recursive:true});
const result={status:'RUNNING',base:a.base,path:a.path,seconds,width,height,dpr,timing:a.timing,trace:a.trace,pointer:a.pointer,scope:'Host rAF/encoding/acknowledgement observations and explicit post-capture GPU metrics; not scanout or compositor drop counts.',errors:[]};
let browser;
try{
 browser=await chromium.launch({channel:a.channel,headless:false,chromiumSandbox:true});result.browser=browser.version();
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});
 page.on('pageerror',e=>result.errors.push(e.stack||String(e)));
 await page.goto(new URL(a.path,a.base).href);
 await page.waitForFunction(()=>{const s=globalThis.helionDesigner||globalThis.helionWorkbench||globalThis.helionTypography||globalThis.helion;return s?.stats.completedFrames>0||s?.faulted||document.querySelector('#boot.failed');},null,{timeout:90000});
 await page.evaluate(detail=>{const s=globalThis.helionDesigner||globalThis.helionWorkbench||globalThis.helionTypography||globalThis.helion;if(!s||s.faulted)throw Error(s?.errors.join('\n')||'App failed to mount');globalThis.profileSurface=s;s.setPerformanceHUD(false);s.setTimingDetail(detail);},a.timing);
 await page.waitForTimeout(1000);
 let cdp;if(a.trace){cdp=await page.context().newCDPSession(page);await cdp.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline.frame,cc,gpu,viz',transferMode:'ReturnAsStream'});}
 result.initial=await page.evaluate(async base=>{
   const s=globalThis.profileSurface,{FrameSyncLog,FrameOpportunityLog}=await import(new URL('src/gpu/frame-sync.js',base));
   s.frameSyncLog=new FrameSyncLog(4096);s.opportunityLog=new FrameOpportunityLog(4096);
   const m=s.manifest;return{stats:{...s.stats},time:performance.now(),viewport:s.resolution,adapter:{vendor:s.adapterInfo.vendor,architecture:s.adapterInfo.architecture},manifest:{nodes:m.nodeCount,depth:m.maxDepth,templateLevels:m.templateLevels,templateLayout:m.templateLayout,shapedTexts:m.shapedTexts?.length,designers:m.designers?.length},startup:s.startup};
 },a.base);
 if(a.pointer){const end=Date.now()+seconds*1000;let i=0;while(Date.now()<end){await page.mouse.move(width*.5+Math.sin(i*.1)*width*.1,height*.45+Math.cos(i*.1)*height*.1);i++;await page.waitForTimeout(8);}}
 else await page.waitForTimeout(seconds*1000);
 result.capture=await page.evaluate(()=>{const s=globalThis.profileSurface;return{time:performance.now(),stats:{...s.stats},sync:s.inspectFrameSync(),errors:[...s.errors]};});
 if(a.trace){const complete=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const{stream}=await complete;let trace='';for(;;){const r=await cdp.send('IO.read',{handle:stream});trace+=r.base64Encoded?Buffer.from(r.data,'base64').toString():r.data;if(r.eof)break;}await cdp.send('IO.close',{handle:stream});result.traceFile=output.replace(/(?:\.json)?$/,'.trace.json');await writeFile(result.traceFile,trace);const events=JSON.parse(trace).traceEvents;result.traceEvents=Object.fromEntries(['DroppedFrame','CommitPresentedFrameToCA','Scheduler::MissedBeginFrameDropped','Scheduler::BeginFrameDropped'].map(name=>[name,events.filter(e=>e.name===name).length]));}
 result.metrics=await page.evaluate(()=>globalThis.profileSurface.inspectPerformance());
 result.resident=await page.evaluate(async()=>{const s=globalThis.profileSurface;s.stop();await s.whenSubmittedWorkDone();const snapshot=await s.inspect({includeNodes:false});const n=s.viewport.tileCols*s.viewport.tileRows,b=s.device.createBuffer({size:(n+20)*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),e=s.device.createCommandEncoder();e.copyBufferToBuffer(s.scratchBuffer,0,b,0,64);e.copyBufferToBuffer(s.drawBuffer,0,b,64,16);e.copyBufferToBuffer(s.scratchBuffer,s.constants.DAMAGE*4,b,80,n*4);s.device.queue.submit([e.finish()]);try{await b.mapAsync(GPUMapMode.READ);s.stats.readbackBytes+=(n+20)*4;const u=new Uint32Array(b.getMappedRange());return{state:[...snapshot.state.slice(0,64)],scratch:[...u.slice(0,16)],draw:[...u.slice(16,20)],dirtyTiles:u.slice(20).filter(x=>x!==0).length,totalTiles:n};}finally{b.destroy();}});
 const before=result.initial.stats,after=result.capture.stats;
 result.delta=Object.fromEntries(['frames','completedFrames','skippedSubmissions','rafCapacityDeferrals','animationFrameCallbacks','readbackBytes','uploadedBytes'].map(k=>[k,(after[k]||0)-(before[k]||0)]));
 const intervals=result.capture.sync.opportunities.samples.slice(1).map((s,i)=>s.callbackStampMs-result.capture.sync.opportunities.samples[i].callbackStampMs),sorted=[...intervals].sort((a,b)=>a-b),nominal=sorted[Math.floor(sorted.length*.25)];
 result.callbackGaps={referenceIntervalMs:nominal,intervals:intervals.length,longerThanOneAndHalfIntervals:intervals.filter(x=>x>nominal*1.5).length,note:'Relative to observed lower-quartile rAF interval; not hardware-vsync or compositor drop measurement.'};
 if(result.errors.length||result.capture.errors.length||result.resident.state[15]||result.delta.readbackBytes||!result.delta.completedFrames)throw new Error('Frame capture failed correctness/no-readback checks');
 result.status='PASS';
}catch(e){result.status='FAIL';result.error=e.stack||String(e);}
finally{await browser?.close();await writeFile(output,JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify({status:result.status,delta:result.delta,traceEvents:result.traceEvents,gaps:result.callbackGaps,cpuEncode:result.capture?.sync.cpuEncodeMs,cpuSubmit:result.capture?.sync.cpuSubmitMs,error:result.error}));
process.exitCode=result.status==='PASS'?0:1;
