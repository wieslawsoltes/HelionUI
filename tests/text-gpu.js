import { DRAW_HEADER_WORDS } from '../src/gpu/arena-layout.js';
import {h,compile,HelionSurface,Opcode,Key} from '../src/index.js';
import {fromBits} from '../src/core/schema.js';
import {fixtureFont} from './font-fixture.mjs';
import {textReference} from './text-reference.mjs';
const log=document.querySelector('#text-log'),button=document.querySelector('#run-text');
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const near=(a,b,e=.005)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
async function readPixels(surface){
 const {w,h}=surface.viewport,stride=Math.ceil(w*4/256)*256,buffer=surface.device.createBuffer({size:stride*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 try{const encoder=surface.device.createCommandEncoder();encoder.copyTextureToBuffer({texture:surface.output},{buffer,bytesPerRow:stride,rowsPerImage:h},[w,h]);surface.device.queue.submit([encoder.finish()]);await buffer.mapAsync(GPUMapMode.READ);return new Uint8Array(buffer.getMappedRange()).slice();}
 finally{buffer.unmap();buffer.destroy();}
}
export async function runTextChecks(){
 button.disabled=true;log.textContent='';const checks=[],result={status:'RUNNING',nativeGPU:true,checks,started:new Date().toISOString()};let surface;
 const pass=name=>{checks.push(name);log.textContent+=`PASS  ${name}\n`;};
 try{
  const font=fixtureFont();const view=h('Canvas',{background:'#102030'},
   h('TextBlock',{id:'kerned',x:12,y:12,text:'AV',fontSize:40,foreground:'#f0f8ff'}),
   h('TextBlock',{id:'unkerned',x:200,y:12,text:'AV',fontSize:40,kerning:false,foreground:'#f0f8ff'}),
   h('TextBlock',{id:'ligature',x:12,y:70,text:'fi',fontSize:40}),
   h('TextBlock',{id:'unligated',x:200,y:70,text:'fi',fontSize:40,ligatures:false}),
   h('TextBlock',{id:'composed',x:12,y:128,text:'Å',fontSize:40}),
   h('TextBlock',{id:'decomposed',x:200,y:128,text:'A\u030A',fontSize:40}),
   h('TextBlock',{id:'mark',x:12,y:190,text:'A\u0301',fontSize:40}),
   h('TextBlock',{id:'astral',x:200,y:190,text:'🙂',fontSize:40}),
   h('TextBox',{id:'editor',x:12,y:256,width:440,height:46,fontSize:20,background:'#203040'}),
   h('TextBlock',{id:'wrapped',x:12,y:322,width:100,text:'AA AA AA\nAV',fontSize:20,wrap:true,textDecoration:'underline'}),
   h('TextBlock',{id:'large',x:490,y:30,text:'A',fontSize:120,foreground:'#b1dbe8'}));
  const compiled=compile(view,{fonts:[font],limits:{maxDimension:768,maxPrimitives:4096,maxJobs:32768,maxStrips:65536,maxAlphaTiles:32768,glyphCacheSlots:128}});
  surface=await HelionSurface.mount(document.querySelector('#font-canvas'),compiled,{autoStart:false,input:false,performanceHUD:false,pixelRatio:1,damageTracking:false});
  result.adapter=surface.adapterInfo;pass('all native shader modules and real-font/cache pipelines create');
  let now=surface.startTime;const step=async()=>{assert(surface.render(now+=16.667),'Frame admission failed');await surface.lastSubmissionCompletion;assert(!surface.faulted&&!surface.errors.length,surface.errors.join('\n'));};
  await step();const reads=surface.stats.readbackBytes;await step();assert(surface.stats.readbackBytes===reads,'Cache warmed through an implicit readback');
  let snap=await surface.inspect({includeHeap:true});assert(snap.state[15]===0,`Arena overflow ${snap.state[15]}`);
  const desired=id=>Array.from(snap.nodes.slice(surface.id(id)*72+50,surface.id(id)*72+52),fromBits);
  near(desired('kerned')[0],44.8);near(desired('unkerned')[0],48);near(desired('ligature')[0],19.2);near(desired('unligated')[0],22);
  near(desired('composed')[0],desired('decomposed')[0]);near(desired('composed')[1],44);
  const r=textReference(compiled,surface.id('wrapped'));const measured=r.measure('AA AA AA\nAV',20,100);near(desired('wrapped')[1],measured[1]);
  pass('native measure uses GPOS kerning, GSUB ligature advances, NFC composition and line metrics');
  assert(snap.state[51]>0,'Warm glyph cache has no hits');assert(snap.state[52]===0,'Unchanged warm keys unexpectedly miss');assert(snap.state[53]>0,'Oversize glyph did not use analytic bypass');
  pass('warm cache reuses exact coverage; oversized glyphs render analytically');
  // Validate logical placement using the actual GPU-emitted display list.
  const staging=surface.device.createBuffer({size:surface.drawBuffer.size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
  const enc=surface.device.createCommandEncoder();enc.copyBufferToBuffer(surface.drawBuffer,0,staging,0,staging.size);surface.device.queue.submit([enc.finish()]);await staging.mapAsync(GPUMapMode.READ);
  const display=new Uint32Array(staging.getMappedRange().slice(0)),df=new Float32Array(display.buffer);staging.unmap();staging.destroy();
  const primitives=id=>{const result=[];let index=display[4+surface.id(id)];while(index!==0xffffffff){const at=DRAW_HEADER_WORDS+index*32;result.push({kind:display[at+12],path:display[at+13],rect:[...df.slice(at+16,at+20)]});index=display[at+14];}return result;};
  assert(primitives('ligature').filter(p=>p.kind===4).length===1,'Ligature emitted more than one glyph');
  assert(primitives('decomposed').filter(p=>p.kind===4).length===1,'Composed source cluster emitted twice');
  const marks=primitives('mark').filter(p=>p.kind===4).reverse();assert(marks.length===2,'Mark attachment did not emit both outlines');near(marks[1].rect[0]-marks[0].rect[0],12);near(marks[1].rect[1]-marks[0].rect[1],-28);
  pass('actual emitted glyph IDs/counts and GPOS mark-to-base origins are correct');
  for(const [label,change] of [['baseline',()=>{}],['integer translation',()=>surface.set('kerned','translateX',1)],['fractional translation',()=>surface.set('kerned','translateX',.375)],['rotation',()=>surface.set('kerned','rotation',.17)],['scaled text',()=>{surface.set('kerned','scaleX',1.5);surface.set('kerned','scaleY',1.5);} ]]){
   surface.options.glyphCache=true;change();await step();const cached=await readPixels(surface);surface.options.glyphCache=false;await step();const direct=await readPixels(surface);
   assert(cached.length===direct.length&&cached.every((v,i)=>v===direct[i]),`Cached and analytic pixels differ: ${label}`);pass(`cached/reference pixels agree exactly: ${label}`);
  }
  surface.options.glyphCache=true;surface.options.damageTracking=true;
  const id=surface.id('editor'),state=64+id*16;
  surface.send(Opcode.Down,{target:id});surface.send(Opcode.Up,{target:id});await step();snap=await surface.inspect({includeNodes:false});const layoutRuns=snap.state[11],upload=surface.stats.uploadedBytes,readBefore=surface.stats.readbackBytes;
  const sample='AV fi A\u030A';for(const c of sample)surface.send(Opcode.Text,{c:c.codePointAt(0)});await step();
  assert(surface.stats.uploadedBytes-upload===64+Array.from(sample).length*32,'Font editing changed packet bytes');assert(surface.stats.readbackBytes===readBefore,'Text edit read back state implicitly');
  surface.send(Opcode.Key,{c:Key.End});surface.send(Opcode.Key,{c:Key.ArrowLeft});await step();snap=await surface.inspect({includeNodes:false});assert(snap.state[state+5]===6,'Left did not skip the combining sequence');
  surface.send(Opcode.Key,{c:Key.ArrowRight});surface.send(Opcode.Key,{c:Key.Backspace});await step();snap=await surface.inspect({includeHeap:true});assert(snap.state[state+4]===6,'Backspace split a base/mark sequence');assert(snap.state[11]===layoutRuns,'Typing reran Measure/Arrange');
  pass('native text editing uses combining boundaries and unchanged 64 + 32×N protocol without layout');
  result.status='PASS';result.stats={...surface.stats};log.textContent+='\nPASS — native subset checked on this adapter. Not a full shaping or speed guarantee.\n';
 }catch(error){result.status='FAIL';result.error=error.stack||String(error);log.textContent+=`\nFAIL  ${result.error}\n`;}
 finally{surface?.dispose();button.disabled=false;result.finished=new Date().toISOString();globalThis.__HELION_TEXT_RESULT__=result;}
 return result;
}
button.addEventListener('click',runTextChecks);if(new URLSearchParams(location.search).has('autorun'))runTextChecks();
