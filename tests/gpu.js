import { h, compile, HelionSurface, Opcode, Key } from '../src/index.js';
import { fromBits, AUTO_TARGET } from '../src/core/schema.js';
import { layoutReference } from './layout-reference.mjs';

const output = document.querySelector('#log'), button = document.querySelector('#run');
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const near = (a,b,e=.05) => assert(Math.abs(a-b)<=e, `Expected ${b}, got ${a}`);
export async function runGPUChecks() {
 button.disabled = true; output.textContent = ''; const checks = []; let surface;
 const log = text => { output.textContent += text + '\n'; };
 const pass = name => { checks.push({ name, status: 'PASS' }); log(`PASS  ${name}`); };
 const result = { status: 'RUNNING', checks, nativeGPU: true, adapter: null };
 globalThis.__HELION_TEST_RESULT__ = result;
 try {
  assert(navigator.gpu, 'WebGPU unavailable. This is NOT a GPU pass; use a permitted localhost/HTTPS browser with WebGPU.');
  const data = [{name:'beta',status:0,value:20},{name:'Alpha',status:0,value:5},{name:'BETA',status:1,value:2},{name:'Delta',status:0,value:2},{name:'Gamma',status:2,value:-1.5},{name:'Lambda',status:0,value:12.25}];
  const compiled = compile(h('Grid',{rows:'38 38 32 * 48',gap:6,padding:8,background:'#102030'},
   h('Grid',{columns:'200 *'},h('CheckBox',{id:'enabled',text:'Ready only'}),h('Button',{column:1,id:'increment',text:'Increment',action:{type:'increment',target:'meter',value:.1}})),
   h('TextBox',{id:'filter',row:1}),h('Slider',{id:'meter',row:2,value:.25}),
   h('DataGrid',{id:'table',row:3,data,dataColumns:[{title:'Name',field:'name',type:'text',width:220},{title:'Status',field:'status',type:'status',width:110},{title:'Value',field:'value',type:'number',width:160,editable:true}],filter:'filter',activeOnly:'enabled',rowHeight:32}),
   h('Border',{id:'motion',row:4,width:60,height:30,background:'#ff4020',clip:false,animations:[{property:'translateX',from:0,to:60,duration:2,alternate:true}]})),
   {limits:{maxRows:128,maxDimension:768,maxPrimitives:4096,maxJobs:65536,maxStrips:131072,maxAlphaTiles:65536}});
  const reference=layoutReference(compiled,640,480);
  surface=await HelionSurface.mount(document.querySelector('#test-canvas'),compiled,{input:false,autoStart:false,pixelRatio:1,performanceHUD:true,onError:error=>log(`DEVICE ERROR: ${error.message}`)});
  result.adapter=surface.adapterInfo ? {vendor:surface.adapterInfo.vendor,architecture:surface.adapterInfo.architecture,device:surface.adapterInfo.device,description:surface.adapterInfo.description} : null;
  pass('30 core compute pipelines, resident metrics and HUD presentation pipelines create');
  let now=surface.startTime;
  const step=async()=>{surface.render(now+=16.667);await surface.device.queue.onSubmittedWorkDone();assert(surface.errors.length===0,surface.errors.join('\n'));};
  await step();
  assert(surface.stats.readbackBytes===0,'Normal frame unexpectedly read GPU data');
  const bytes=surface.stats.uploadedBytes; await step(); assert(surface.stats.uploadedBytes-bytes===64,'Idle frame must upload exactly 64 payload bytes'); pass('normal frames: 64-byte clock/viewport payload, zero explicit readbacks');
  let snap=await surface.inspect({includeHeap:true}); const rect=id=>Array.from(snap.nodes.slice(surface.id(id)*72+52,surface.id(id)*72+56),fromBits);
  for(let i=0;i<reference.length;i++) for(let j=0;j<4;j++) near(fromBits(snap.nodes[i*72+52+j]),reference[i].rect[j]); pass('native Measure / Arrange agrees with layout reference');
  assert(snap.state[15]===0,`Arena overflow bits ${snap.state[15]}`); pass('small scene has no bounded-arena overflow');
  const meta=compiled.tables[0].offset, stateSlot=id=>64+surface.id(id)*16;
  const click=async(x,y)=>{surface.send(Opcode.Down,{x,y});surface.send(Opcode.Up,{x,y});await step();};
  const clickControl=async id=>{const [x,y,w,hh]=rect(id);await click(x+w/2,y+hh/2);};
  await clickControl('enabled');snap=await surface.inspect({includeHeap:true});near(fromBits(snap.state[stateSlot('enabled')]),1);assert(snap.heap[meta+10]===4,'GPU Ready filter count');pass('GPU hit testing, checkbox action and status filtering');
  await clickControl('enabled'); await clickControl('filter');
  snap=await surface.inspect({includeHeap:false}); const textLayoutBefore=snap.state[11], textSortBefore=snap.state[50];
  for(const ch of 'beTa') surface.send(Opcode.Text,{c:ch.codePointAt(0)}); await step();snap=await surface.inspect({includeHeap:true});
  assert(snap.heap[meta+10]===2,'GPU text filter must be ASCII-case-insensitive');assert(snap.state[stateSlot('filter')+4]===4,'GPU edit length');assert(snap.state[11]===textLayoutBefore,'Typing must not execute Measure/Arrange');assert(snap.state[50]===textSortBefore,'Typing must not re-sort the cached order');pass('GPU text editing and filtering reuse sorted order without layout');
  surface.send(Opcode.Key,{c:Key.A,a:2});surface.send(Opcode.Key,{c:Key.Backspace});await step();snap=await surface.inspect({includeHeap:true});assert(snap.heap[meta+10]===6,'Filter clear restores six rows');
  const [tx,ty]=rect('table');await click(tx+220+110+60,ty+20);snap=await surface.inspect({includeHeap:true});
  const order=[...snap.heap.slice(snap.heap[meta+4],snap.heap[meta+4]+6)];const expected=data.map((_,id)=>id).sort((a,b)=>data[a].value-data[b].value||a-b);assert(JSON.stringify(order)===JSON.stringify(expected),'GPU stable ascending numeric sort');pass('stable numeric GPU block/merge sorting');
  await click(tx+40,ty+42+16);snap=await surface.inspect({includeHeap:true});const identity=snap.heap[meta+17];assert(identity===expected[0],'Row identity mismatch');
  await click(tx+390,ty+20);snap=await surface.inspect({includeHeap:true});assert(snap.heap[meta+17]===identity,'Sorting changed selected identity');assert(snap.heap[meta+16]===5,'Selection visible position not restored');pass('selection identity survives reverse sorting');
  // Resize the first header boundary without layout invalidation.
  const layoutCount=snap.state[11], column=snap.heap[meta+9], width=fromBits(snap.heap[column+4]);
  surface.send(Opcode.Down,{x:tx+width,y:ty+15});surface.send(Opcode.Move,{x:tx+width+28,y:ty+15});surface.send(Opcode.Up,{x:tx+width+28,y:ty+15});await step();snap=await surface.inspect({includeHeap:true});near(fromBits(snap.heap[column+4]),width+28);assert(snap.state[11]===layoutCount,'Column resizing unnecessarily ran layout');pass('column resizing stays on GPU without a layout pass');
  // Select numeric column, enter editing, replace its selected text, then commit.
  await click(tx+width+28+110+50,ty+42+16);surface.send(Opcode.Key,{c:Key.Enter});await step();
  for(const ch of '42.5') surface.send(Opcode.Text,{c:ch.codePointAt(0)});surface.send(Opcode.Key,{c:Key.Enter});await step();snap=await surface.inspect({includeHeap:true});
  near(fromBits(snap.heap[snap.heap[meta+3]+snap.heap[meta+17]*8+2]),42.5);pass('GPU numeric-cell editing and decimal commit');
  // Submitting property updates must not map state or invoke CPU controls.
  const countBefore=snap.state[11], reads=surface.stats.readbackBytes;surface.set('meter','value',.75);surface.set('motion','opacity',.8);await step();assert(surface.stats.readbackBytes===reads,'Property update triggered implicit readback');snap=await surface.inspect({includeHeap:false});near(fromBits(snap.state[stateSlot('meter')]),.75);assert(snap.state[11]===countBefore,'Composition/value-only update ran Measure/Arrange');pass('composition and value updates avoid layout and implicit readback');
  // Test-only storage-texture copy: root corner has an exact solid background.
  const buffer=surface.device.createBuffer({size:256,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  const encoder=surface.device.createCommandEncoder();encoder.copyTextureToBuffer({texture:surface.output,origin:{x:2,y:2}}, {buffer,bytesPerRow:256,rowsPerImage:1},[1,1,1]);surface.device.queue.submit([encoder.finish()]);await buffer.mapAsync(GPUMapMode.READ);const pixel=[...new Uint8Array(buffer.getMappedRange()).slice(0,4)];buffer.unmap();buffer.destroy();
  [16,32,48,255].forEach((v,i)=>near(pixel[i],v,2));pass('native sparse-strip raster/composition texture contains expected solid color');
  // Freeze visible animation by hiding its node; two equal scenes should rasterize
  // no tiles. The test scene has no changing upload/strip counter labels.
  surface.set('motion','opacity',0); await step(); await step();
  snap=await surface.inspect({includeHeap:false});assert(snap.state[45]===0,'Unchanged retained scene must generate zero raster strips');
  pass('unchanged retained display list produces zero raster strips');
  const pixels=async()=>{
   const width=surface.viewport.w,height=surface.viewport.h,stride=Math.ceil(width*4/256)*256;
   const staging=surface.device.createBuffer({size:stride*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
   const encoder=surface.device.createCommandEncoder();encoder.copyTextureToBuffer({texture:surface.output},{buffer:staging,bytesPerRow:stride,rowsPerImage:height},[width,height,1]);
   surface.device.queue.submit([encoder.finish()]);await staging.mapAsync(GPUMapMode.READ);const result=new Uint8Array(staging.getMappedRange()).slice();staging.unmap();staging.destroy();return result;
  };
  surface.set('meter','value',.2);await step();const cached=await pixels();
  surface.options.damageTracking=false;await step();const full=await pixels();surface.options.damageTracking=true;
  assert(cached.length===full.length && cached.every((value,i)=>value===full[i]),'Dirty-tile output differs from full-render reference');
  pass('dirty-tile output exactly matches full-frame rendering after a slider change');
  result.timingMode=surface.gpuTiming?'GPU timestamp queries':'CPU encoding fallback';
  assert(surface.errors.length===0,surface.errors.join('\n'));result.status='PASS';result.stats={...surface.stats};log('\nPASS — native small-scene gates passed on this adapter. This is not exhaustive renderer, IME, mobile or performance qualification.');
 } catch(error) {result.status='FAIL';result.error=error.stack||String(error);log(`\nFAIL  ${result.error}`);}
 finally {surface?.dispose();button.disabled=false;result.finished=new Date().toISOString();globalThis.__HELION_TEST_RESULT__=result;}
 return result;
}
button.addEventListener('click',runGPUChecks);
if(new URLSearchParams(location.search).has('autorun')) runGPUChecks();
