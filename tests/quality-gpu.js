/** Native compute correctness gate; readbacks here are explicit tests, not the UI loop. */
import {h,HelionSurface,loadFonts,DEFAULT_FONT_SOURCES} from '../src/index.js';
import {loadShaders} from '../src/gpu/shader-library.js';
import {fixtureFont} from './font-fixture.mjs';
import {quadraticArea} from './curve-reference.mjs';
import {seeded} from './reference.mjs';
const canvas=document.querySelector('#canvas'),log=document.querySelector('#log'),run=document.querySelector('#run'),preview=document.querySelector('#preview');
const assert=(ok,message)=>{if(!ok)throw new Error(message);};let active;
const limits={maxDimension:4096,maxRenderTiles:16384,maxPrimitives:8192,maxJobs:65536,maxStrips:131072,maxAlphaTiles:98304,glyphCacheSlots:512};
function curvedFont(){const f=fixtureFont();f.family='Original curved quality fixture';f.glyphs[2]={...f.glyphs[2],bounds:[0,-.7,.6,0],segments:[
 [1,.3,0,.6,0,.6,-.35,0,0],[1,.6,-.35,.6,-.7,.3,-.7,0,0],
 [1,.3,-.7,0,-.7,0,-.35,0,0],[1,0,-.35,0,0,.3,0,0,0]
]};return f;}
function specimen(){return h('Grid',{rows:'42 36 40 56 86 *',gap:6,padding:16,background:'#101923'},
 h('TextBlock',{fontSize:24,text:'Sharp text. Resident outlines. Native pixels.'}),
 h('TextBlock',{row:1,fontSize:11,text:'11 px: Aa Bb Cc 0123456789 | ilI1 O0 rn m AV office fi fl'}),
 h('TextBlock',{row:2,fontSize:14,text:'14 px: Zażółć gęślą jaźń · Ελληνικά · Кириллица'}),
 h('TextBox',{row:3,id:'input',text:'Fractional placement: 0.375 px',fontSize:17,translateX:.375}),
 h('TextBlock',{row:4,fontSize:56,text:'Aa 0123 ffi',translateX:.625,translateY:.25}),
 h('Grid',{row:5,columns:'* *',gap:12},
  h('CodeEditor',{id:'code',fontSize:14,text:'// Compute-rendered source\nconst sharp = true;\nconst value = 3.141592;\nreturn Helion.h("Button", {\n  text: "Resident text"\n});',language:'javascript',minimap:false}),
  h('Grid',{column:1,rows:'48 *',gap:8},
   h('ScrollViewer',{height:42,width:175.375},h('TextBlock',{fontSize:24,text:'Clipped curves AVATAR 012345',width:460})),
   h('DataGrid',{row:1,id:'table',rowCount:12,fontSize:13,rowHeight:28})))
 );}
async function step(surface,now){assert(surface.render(now),'Frame admission refused');await surface.whenSubmittedWorkDone();assert(!surface.faulted&&!surface.errors.length,surface.errors.join('\n'));}
async function pixels(surface,output=surface.output,width=surface.viewport.w,height=surface.viewport.h){
 const stride=Math.ceil(width*4/256)*256,b=surface.device.createBuffer({size:stride*height,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 try{const e=surface.device.createCommandEncoder();e.copyTextureToBuffer({texture:output},{buffer:b,bytesPerRow:stride},[width,height]);surface.device.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const raw=new Uint8Array(b.getMappedRange()),tight=new Uint8Array(width*height*4);for(let y=0;y<height;y++)tight.set(raw.subarray(y*stride,y*stride+width*4),y*width*4);return tight;}finally{b.unmap();b.destroy();}
}
async function presentation(surface,quad){const {w,h}=surface.viewport,output=surface.device.createTexture({size:[w,h],format:surface.format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
 try{const e=surface.device.createCommandEncoder(),p=e.beginRenderPass({colorAttachments:[{view:output.createView(),loadOp:'clear',storeOp:'store',clearValue:[0,0,0,1]}]});if(quad){p.setPipeline(surface.blitPipeline);p.setBindGroup(0,surface.blitBindGroup);p.draw(3);p.setPipeline(surface.presentPipeline);p.setBindGroup(0,surface.presentBindGroup);p.draw(6);}else{p.setPipeline(surface.hudFullscreenPipeline);p.setBindGroup(0,surface.hudFullscreenBindGroup);p.draw(3);}p.end();surface.device.queue.submit([e.finish()]);return await pixels(surface,output,w,h);}finally{output.destroy();}}
async function mathGate(device){
 const random=seeded(78123),cases=[[[0,0],[1,0],[1,1]],[[.25,-2],[.25,.5],[.25,2]],[[0,0],[.5,2],[1,0]]];
 for(let j=0;j<768;j++)cases.push(Array.from({length:3},()=>[(random()-.5)*8,(random()-.5)*8]));
 const data=new Float32Array(cases.length*8);cases.forEach((p,j)=>data.set(p.flat(),j*8));
 const buffers=[];const make=(size,usage)=>{const b=device.createBuffer({size,usage});buffers.push(b);return b;};
 try{
  const a=make(data.byteLength,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST),b=make(cases.length*4,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC),out=make(cases.length*4,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ);device.queue.writeBuffer(a,0,data);
  const shaders=await loadShaders(),code=shaders['curve-coverage']+`\n@group(0) @binding(0) var<storage,read> cases:array<vec4<f32>>;\n@group(0) @binding(1) var<storage,read_write> output:array<f32>;\n@compute @workgroup_size(64) fn probe(@builtin(global_invocation_id) id:vec3<u32>){let i=id.x;if(i>=arrayLength(&output)){return;}let a=cases[i*2u];let b=cases[i*2u+1u];output[i]=curveQuadraticArea(a.xy,a.zw,b.xy);}`;
  const module=device.createShaderModule({code}),info=await module.getCompilationInfo();assert(!info.messages.some(m=>m.type==='error'),info.messages.map(m=>m.message).join('\n'));
  const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'probe'}}),bind=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:a}},{binding:1,resource:{buffer:b}}]});
  const e=device.createCommandEncoder(),p=e.beginComputePass();p.setPipeline(pipeline);p.setBindGroup(0,bind);p.dispatchWorkgroups(Math.ceil(cases.length/64));p.end();e.copyBufferToBuffer(b,0,out,0,cases.length*4);device.queue.submit([e.finish()]);await out.mapAsync(GPUMapMode.READ);
  const result=new Float32Array(out.getMappedRange());let maxError=0;
  for(let j=0;j<cases.length;j++){const input=[0,2,4].map(k=>[data[j*8+k],data[j*8+k+1]]),expected=quadraticArea(...input);assert(Number.isFinite(result[j]),`Nonfinite curve result ${j}`);maxError=Math.max(maxError,Math.abs(result[j]-expected));}
  assert(maxError<.0005,`Native quadratic error ${maxError}`);out.unmap();return{cases:cases.length,maxAbsoluteAreaError:maxError};
 }finally{for(const b of buffers)b.destroy();}
}
export async function runQualityGate(){run.disabled=preview.disabled=true;active?.dispose();active=null;const result={status:'RUNNING',scope:'Native correctness, not performance',checks:[],started:new Date().toISOString()};globalThis.__HELION_QUALITY_RESULT__=result;const pass=label=>{result.checks.push(label);log.textContent=JSON.stringify(result,null,2);};
 try{
  const adapter=await navigator.gpu.requestAdapter();assert(adapter,'No WebGPU adapter');const device=await adapter.requestDevice();try{result.math=await mathGate(device);}finally{device.destroy();}pass('Quadratic WGSL output agrees with the high-precision host oracle');
  active=await HelionSurface.mount(canvas,specimen(),{fonts:[curvedFont()],startupWorker:false,input:false,autoStart:false,performanceHUD:true,deferHUD:false,limits,pixelRatio:1});const s=active;result.adapter=s.adapterInfo;const now=s.startTime+120;
  for(const ratio of [1,1.25,2]){
   s.options.pixelRatio=ratio;s.resizePending=true;s.options.glyphCache=true;s.setTextQuality('sharp');await step(s,now);await step(s,now);
   const cached=await pixels(s);s.options.glyphCache=false;s.resized=true;await step(s,now);const direct=await pixels(s);
   assert(cached.length===direct.length&&cached.every((v,j)=>v===direct[j]),`Cache/direct pixel mismatch at DPR ${ratio}`);
   const counters=await s.inspect({includeNodes:false});assert(counters.state[15]===0,`Arena overflow ${counters.state[15]}`);pass(`Sharp cache/direct output agrees at DPR ${ratio}`);
   s.options.glyphCache=true;s.setTextQuality('reference');await step(s,now);s.setTextQuality('sharp');await step(s,now);const restored=await pixels(s);assert(direct.every((v,j)=>v===restored[j]),`Stale cache after quality switch at DPR ${ratio}`);
   const quad=await presentation(s,true),full=await presentation(s,false);assert(quad.every((v,j)=>v===full[j]),`Compute HUD pixel-copy disagreement at DPR ${ratio}`);pass(`Quality switch invalidates coverage and HUD quad/fullscreen copies agree at DPR ${ratio}`);
  }
  result.resolution=s.resolution;result.status='PASS';result.performanceMeasured=false;
 }catch(error){result.status='FAIL';result.error=error.stack||String(error);}finally{active?.dispose();active=null;run.disabled=preview.disabled=false;result.finished=new Date().toISOString();log.textContent=JSON.stringify(result,null,2);}return result;
}
async function realPreview(){run.disabled=preview.disabled=true;active?.dispose();active=null;
 try{log.textContent='Loading the real font and compiling GPU pipelines…';const local=document.querySelector('#font').files[0],fonts=await loadFonts(local?[{source:local}]:[DEFAULT_FONT_SOURCES[0]]);active=await HelionSurface.mount(canvas,specimen(),{fonts,performanceHUD:true,limits});log.textContent='Real-font specimen; live measurements, not a benchmark certificate.\n'+JSON.stringify(active.resolution,null,2);}catch(e){log.textContent=e.stack||String(e);}finally{run.disabled=preview.disabled=false;}}
run.onclick=runQualityGate;preview.onclick=realPreview;
document.querySelector('#quality').onclick=e=>{if(!active)return;active.setTextQuality(active.textQuality==='sharp'?'reference':'sharp');e.target.textContent=active.textQuality==='sharp'?'Sharp curves':'Flattened reference';};
document.querySelector('#resolution').onclick=e=>{if(!active)return;active.setResolutionMode(active.resolutionMode==='native'?'balanced':'native');e.target.textContent=active.resolutionMode==='native'?'Native pixels':'Balanced 2048';};
if(new URLSearchParams(location.search).has('autorun'))runQualityGate();
