/** Actual WebGPU pixel/reference gate. All reads are explicit test operations. */
import {h,HelionSurface,Opcode,Key} from '../src/index.js';
import {fixtureFont} from './font-fixture.mjs';
import {hudScissor} from '../src/gpu/frame-sync.js';
const canvas=document.querySelector('#surface-test'),log=document.querySelector('#log'),button=document.querySelector('#run');
const assert=(v,m)=>{if(!v)throw new Error(m);};
async function pixels(surface,texture,encode){
 const {w,h}=surface.viewport,stride=Math.ceil(w*4/256)*256;
 const buffer=surface.device.createBuffer({size:stride*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 try{
  const e=surface.device.createCommandEncoder();encode?.(e);e.copyTextureToBuffer({texture},{buffer,bytesPerRow:stride},[w,h]);surface.device.queue.submit([e.finish()]);
  await buffer.mapAsync(GPUMapMode.READ);const mapped=new Uint8Array(buffer.getMappedRange()),tight=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)tight.set(mapped.subarray(y*stride,y*stride+w*4),y*w*4);return tight;
 }finally{buffer.unmap();buffer.destroy();}
}
async function presentation(surface,scissored){
 const t=surface.device.createTexture({size:[surface.viewport.w,surface.viewport.h],format:surface.format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
 try{return await pixels(surface,t,e=>{
  const p=e.beginRenderPass({colorAttachments:[{view:t.createView(),clearValue:[0,0,0,1],loadOp:'clear',storeOp:'store'}]});
  if(scissored){p.setPipeline(surface.blitPipeline);p.setBindGroup(0,surface.blitBindGroup);p.draw(3);p.setPipeline(surface.presentPipeline);p.setBindGroup(0,surface.presentBindGroup);p.draw(6);}
  if(!scissored){p.setPipeline(surface.hudFullscreenPipeline);p.setBindGroup(0,surface.hudFullscreenBindGroup);p.draw(3);}p.end();
 });}finally{t.destroy();}
}
function equal(a,b,label){assert(a.length===b.length,`${label}: dimensions`);let count=0,max=0;for(let i=0;i<a.length;i++){if(a[i]!==b[i])count++;max=Math.max(max,Math.abs(a[i]-b[i]));}assert(count===0,`${label}: ${count} byte differences, max ${max}`);}
export async function runFrameSyncGate(){
 button.disabled=true;const result={status:'RUNNING',scope:'Native real-outline fixture and exact pixel regression; not a performance benchmark',started:new Date().toISOString(),checks:[]};let surface;
 globalThis.__HELION_FRAME_SYNC_RESULT__=result;
 const pass=m=>{result.checks.push(m);log.textContent=JSON.stringify(result,null,2);};
 try{
  const view=h('Grid',{rows:'42 *',padding:10,gap:6,background:'#102030'},h('TextBox',{id:'filter',fontSize:14}),
   h('DataGrid',{id:'grid',row:1,rowCount:1024,filter:'filter',fontSize:14,rowHeight:33,borderWidth:1,borderColor:'#557799'}));
  surface=await HelionSurface.mount(canvas,view,{fonts:[fixtureFont()],startupWorker:false,input:false,autoStart:false,performanceHUD:true,deferHUD:false,pixelRatio:1.25,damageTracking:false});result.adapter=surface.adapterInfo;
  const fixed=surface.startTime+100;const step=async()=>{const before=surface.stats.readbackBytes;assert(surface.render(fixed),'Frame rejected');await surface.whenSubmittedWorkDone();assert(surface.stats.readbackBytes===before,'Implicit runtime readback');assert(!surface.faulted,surface.errors.join('\n'));};
  await step();pass('native modules and both presentation pipelines create and execute');
  const grid=surface.id('grid'),filter=surface.id('filter');
  const scenarios=[
   ['initial',()=>{}],['fractional vertical scroll',()=>surface.set('grid','scrollY',67.375)],
   ['integer scroll',()=>surface.set('grid','scrollY',132)],
   ['selection',()=>{surface.send(Opcode.Down,{target:grid,x:60,y:168});surface.send(Opcode.Up,{target:grid,x:60,y:168});}],
   ['header sort',()=>{surface.send(Opcode.Down,{target:grid,x:60,y:72});surface.send(Opcode.Up,{target:grid,x:60,y:72});}],
   ['filter',()=>{surface.send(Opcode.Down,{target:filter,x:20,y:20});surface.send(Opcode.Up,{target:filter,x:20,y:20});for(const c of 'cir')surface.send(Opcode.Text,{c:c.codePointAt(0)});}],
   ['empty query',()=>{surface.send(Opcode.Key,{c:Key.End});for(const c of 'zzzz')surface.send(Opcode.Text,{c:c.codePointAt(0)});}],
   ['clear query',()=>surface.set('filter','textClear',0)],
   ['fractional translation',()=>surface.set('grid','translateX',.375)],
   ['opacity',()=>surface.set('grid','opacity',.7)],
   ['hide',()=>surface.set('grid','visible',0)],['show',()=>surface.set('grid','visible',1)]
  ];
  for(const [name,change]of scenarios){
   change();surface.options.damageTracking=true;surface.options.parallelGrid=true;await step();const parallel=await pixels(surface,surface.output);
   surface.options.damageTracking=false;await step();equal(parallel,await pixels(surface,surface.output),`${name}: retained/full`);
   surface.options.parallelGrid=false;await step();const serial=await pixels(surface,surface.output);equal(parallel,serial,name);
   const state=await surface.inspect({includeNodes:false});assert(state.state[15]===0,`${name}: overflow ${state.state[15]}`);pass(`exact serial/parallel UI pixels: ${name}`);
  }
  surface.options.parallelGrid=true;surface.options.damageTracking=true;await step();const retained=await pixels(surface,surface.output);surface.options.damageTracking=false;await step();equal(retained,await pixels(surface,surface.output),'retained versus full');pass('retained damage and full raster agree after row-mode changes');
  surface.options.damageTracking=true;await step();await step();
  const args=surface.device.createBuffer({size:16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  try{
   const e=surface.device.createCommandEncoder();e.copyBufferToBuffer(surface.indirectBuffer,24,args,0,12);e.copyBufferToBuffer(surface.scratchBuffer,0,args,12,4);surface.device.queue.submit([e.finish()]);await args.mapAsync(GPUMapMode.READ);
   const words=new Uint32Array(args.getMappedRange());assert(words[0]===0&&words[1]===1&&words[2]===1&&words[3]===0,'Clean frame must produce zero job dispatches and zero jobs');
  }finally{args.destroy();}
  equal(retained,await pixels(surface,surface.output),'clean frame retains pixels');pass('GPU damage reduction skips job construction on clean frames without a host readback');
  surface.set('grid','opacity',1);surface.set('grid','translateX',0);await step();
  const compact=await pixels(surface,surface.output);surface.setTimingDetail('stages');await step();equal(compact,await pixels(surface,surface.output),'timing mode');pass('compact/stages changes measurement boundaries, not UI pixels');
  for(const dpr of [1,1.25,2]){
   surface.options.pixelRatio=dpr;surface.resizePending=true;await step();await step();
   equal(await presentation(surface,false),await presentation(surface,true),`HUD scissor DPR ${dpr}`);pass(`exact full/scissored HUD pixels at DPR ${dpr}`);
  }
  result.hostSync=surface.inspectFrameSync();result.metrics=await surface.inspectPerformance();result.status='PASS';pass('normal rendering keeps 64-byte frame metadata; test-only snapshots are explicit');
 }catch(e){result.status='FAIL';result.error=e.stack||String(e);}
 finally{surface?.dispose();button.disabled=false;result.finished=new Date().toISOString();log.textContent=JSON.stringify(result,null,2);}
 return result;
}
button.addEventListener('click',runFrameSyncGate);if(new URLSearchParams(location.search).has('autorun'))runFrameSyncGate();
