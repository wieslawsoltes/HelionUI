import { METRICS_BYTES, decodePerformance } from '../src/gpu/performance.js';
import { metricPacket, queryWords, applyMetricReference, emptyMetrics } from './metrics-reference.mjs';
const button=document.querySelector('#run'),log=document.querySelector('#log');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const near=(a,b)=>Math.abs(a-b)<=Math.max(.0001,Math.abs(b)*.0001);
export async function runTimingGate(){
 button.disabled=true;const result={status:'RUNNING',scope:'Native metric arithmetic/interface checks; NOT a frame-rate benchmark',checks:[],started:new Date().toISOString()};
 globalThis.__HELION_METRICS_RESULT__=result;let device;const resources=[];
 try {
  if(!navigator.gpu)throw new Error('WebGPU unavailable');const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw new Error('No adapter');
  const native=adapter.features.has('timestamp-query');device=await adapter.requestDevice({requiredFeatures:native?['timestamp-query']:[]});result.adapter=adapter.info;
  const faults=[];device.addEventListener('uncapturederror',e=>faults.push(e.error.message));
  const source=await (await fetch('../shaders/metrics.wgsl')).text(),module=device.createShaderModule({code:source});
  const messages=await module.getCompilationInfo();assert(!messages.messages.some(x=>x.type==='error'),messages.messages.map(x=>x.message).join('\n'));
  const pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'recordMetrics'}});
  const buffer=(size,usage)=>{const b=device.createBuffer({size,usage});resources.push(b);return b;};
  const frame=buffer(64,GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST);
  const queries=buffer(128,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC|(native?GPUBufferUsage.QUERY_RESOLVE:0));
  const state=buffer(256,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST);
  const setLayout=executed=>device.queue.writeBuffer(state,58*4,new Uint32Array([Number(executed)]));setLayout(true);
  const history=buffer(METRICS_BYTES,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC);
  const bindings=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:frame}},{binding:1,resource:{buffer:queries}},{binding:2,resource:{buffer:history}},{binding:3,resource:{buffer:state}}]});
  const record=e=>{const p=e.beginComputePass();p.setPipeline(pipeline);p.setBindGroup(0,bindings);p.dispatchWorkgroups(1);p.end();};
  async function read(source){const staging=device.createBuffer({size:source.size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
   try{const e=device.createCommandEncoder();e.copyBufferToBuffer(source,0,staging,0,source.size);device.queue.submit([e.finish()]);await staging.mapAsync(GPUMapMode.READ);return new Uint32Array(staging.getMappedRange().slice(0));}
   finally{staging.unmap();staging.destroy();}
  }
  function compare(actual,expected){
   const a=decodePerformance(actual),b=decodePerformance(expected);assert(a.sampleFrame===b.sampleFrame&&a.timestampErrors===b.timestampErrors,'Sample/error mismatch');
   assert(a.submissionMode===b.submissionMode&&a.source===b.source,'Timing mode mismatch');
   for(const key of ['submitFPS','rafHz','rafBudgetMs'])assert(near(a[key],b[key]),`${key}: ${a[key]} != ${b[key]}`);
   for(const key of ['submitIntervalMs','layoutMs','totalMs','dataMs','cpuEncodeMs','uiRenderMs','passSumMs','coveredMs','overlapMs','gapMs','computeCoveredMs'])assert(near(a.current[key],b.current[key]),`${key}: ${a.current[key]} != ${b.current[key]}`);
   for(const key of Object.keys(b.current.phasesMs))assert(near(a.current.phasesMs[key],b.current.phasesMs[key]),`phase ${key}`);
   assert(a.history.length===b.history.length,'History length mismatch');assert(JSON.stringify(a.rawTimestamps)===JSON.stringify(b.rawTimestamps),'Exact raw timestamps/provenance mismatch');assert(a.current.layoutExecuted===b.current.layoutExecuted,'Actual layout flag');
   if(b.gpuCompletionFPS===null)assert(a.gpuCompletionFPS===null,'GPU completion FPS must be unavailable');else assert(near(a.gpuCompletionFPS,b.gpuCompletionFPS),'GPU completion rate mismatch');
   for(let i=0;i<b.history.length;i++){assert(a.history[i].frame===b.history[i].frame,'History frame mismatch');for(const key of ['submitIntervalMs','gpuCompletionIntervalMs','cpuEncodeMs','totalMs'])assert(near(a.history[i][key],b.history[i][key]),`history ${i} ${key}`);} 
  }
  const cases=[
   {name:'0.300 ms nanosecond conversion with low-word rollover',options:{}},
   {name:'CPU encode is independent of 14.3 ms GPU span and 0.3 ms pass sum',options:{cpuEncode:.3},queries:queryWords(undefined,123456789n,2)},
   {name:'CPU-only mode reports missing GPU timings as unavailable',options:{flags:0}},
   {name:'Skipped layout/data/glyph/HUD slots are ignored',options:{flags:2|512}},
   {name:'Reversed active pair is invalid, not zero',options:{},queries:(()=>{const q=queryWords();q[15]=q[13]-1;return q;})()},
   {name:'Encoded but inactive layout is idle, not a fictitious execution',options:{},layoutExecuted:false},
   {name:'Compact merged phases are unavailable, never fake independent zeros',options:{flags:2}},
   {name:'Overlapping pass ranges are unioned, not added',options:{},queries:(()=>{const q=queryWords(),v=new DataView(q.buffer);for(let i=0;i<8;i++){v.setBigUint64(i*16,1000000000n+BigInt(i*10000),true);v.setBigUint64(i*16+8,1000200000n+BigInt(i*10000),true);}return q;})()},
   {name:'Direct 0.3 ms submit delta is independent of animation uptime',options:{interval:.3}},
   {name:'Long stall is retained without reporting high FPS',options:{interval:1500}},
   {name:'ASAP mode and metric epoch reset',options:{flags:2|64,interval:0}}
  ];
  for(const [index,c] of cases.entries()){
   const packet=metricPacket({...c.options,reset:true,serial:index+1}),timestamps=c.queries??queryWords(),expected=applyMetricReference(emptyMetrics(),packet,timestamps,c.layoutExecuted??!!(packet[9]&4));setLayout(c.layoutExecuted??!!(packet[9]&4));
   device.queue.writeBuffer(history,0,emptyMetrics());device.queue.writeBuffer(frame,0,packet);device.queue.writeBuffer(queries,0,timestamps);
   const e=device.createCommandEncoder();record(e);device.queue.submit([e.finish()]);compare(await read(history),expected);result.checks.push(c.name);log.textContent=JSON.stringify(result,null,2);
  }
  // Multiple queued samples exercise ordered reuse and ring wrapping without per-sample fences.
  setLayout(true);const expected=emptyMetrics(),timestamps=queryWords();device.queue.writeBuffer(history,0,expected);device.queue.writeBuffer(queries,0,timestamps);
  for(let i=1;i<=260;i++){
   const packet=metricPacket({serial:i,interval:4+(i%3),reset:i===1});applyMetricReference(expected,packet,timestamps);
   device.queue.writeBuffer(frame,0,packet);const e=device.createCommandEncoder();record(e);device.queue.submit([e.finish()]);
  }
  compare(await read(history),expected);result.checks.push('260 queued samples preserve frame/history correspondence through wrapping');
  const overload=emptyMetrics();device.queue.writeBuffer(history,0,overload);
  for(let i=0;i<120;i++){
   const packet=metricPacket({serial:i+1,interval:1000/120,reset:i===0}),raw=queryWords(undefined,1000000000n+BigInt(i)*20000000n);applyMetricReference(overload,packet,raw);
   device.queue.writeBuffer(frame,0,packet);device.queue.writeBuffer(queries,0,raw);const e=device.createCommandEncoder();record(e);device.queue.submit([e.finish()]);
  }
  compare(await read(history),overload);result.checks.push('Synthetic 120 Hz host submissions and 50 Hz GPU end timestamps remain independent (not measured performance)');
  if(native){
   const querySet=device.createQuerySet({type:'timestamp',count:16});resources.push(querySet);
   const work=buffer(4,GPUBufferUsage.STORAGE),m=device.createShaderModule({code:'@group(0) @binding(0) var<storage,read_write> data:array<u32>; @compute @workgroup_size(1) fn run(){ var value=data[0]; for(var i=0u;i<1000u;i++){value=value*1664525u+1013904223u;} data[0]=value; }'});
   const compute=await device.createComputePipelineAsync({layout:'auto',compute:{module:m,entryPoint:'run'}});
   const group=device.createBindGroup({layout:compute.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:work}}]});
   const packet=metricPacket({reset:true,serial:999});device.queue.writeBuffer(frame,0,packet);const e=device.createCommandEncoder();
   const drawModule=device.createShaderModule({code:'@vertex fn v(@builtin(vertex_index) i:u32)->@builtin(position) vec4<f32>{let p=array<vec2<f32>,3>(vec2<f32>(-1,-1),vec2<f32>(3,-1),vec2<f32>(-1,3));return vec4<f32>(p[i],0,1);}@fragment fn f()->@location(0)vec4<f32>{return vec4<f32>(.2,.3,.4,1);}'});
   const draw=await device.createRenderPipelineAsync({layout:'auto',vertex:{module:drawModule,entryPoint:'v'},fragment:{module:drawModule,entryPoint:'f',targets:[{format:'rgba8unorm'}]}});
   const target=device.createTexture({size:[32,32],format:'rgba8unorm',usage:GPUTextureUsage.RENDER_ATTACHMENT});resources.push(target);
   for(let i=0;i<7;i++){const p=e.beginComputePass({timestampWrites:{querySet,beginningOfPassWriteIndex:i*2,endOfPassWriteIndex:i*2+1}});p.setPipeline(compute);p.setBindGroup(0,group);p.dispatchWorkgroups(1);p.end();}
   const rp=e.beginRenderPass({colorAttachments:[{view:target.createView(),loadOp:'clear',storeOp:'store',clearValue:[0,0,0,1]}],timestampWrites:{querySet,beginningOfPassWriteIndex:14,endOfPassWriteIndex:15}});rp.setPipeline(draw);rp.draw(3);rp.end();
   e.resolveQuerySet(querySet,0,16,queries,0);record(e);device.queue.submit([e.finish()]);
   const raw=await read(queries),actual=await read(history);compare(actual,applyMetricReference(emptyMetrics(),packet,raw));
   result.probe=decodePerformance(actual);result.checks.push('Actual pass timestamps agree with independent BigInt subtraction; this tiny workload is not the app benchmark');
  } else result.timestampFeature='Unavailable: synthetic timestamp arithmetic executed on GPU, actual timestamp query probe skipped';
  assert(!faults.length,faults.join('\n'));result.status='PASS';
 }catch(error){result.status='FAIL';result.error=error.stack||String(error);}
 finally{resources.forEach(x=>x.destroy());device?.destroy();button.disabled=false;result.finished=new Date().toISOString();log.textContent=JSON.stringify(result,null,2);globalThis.__HELION_METRICS_RESULT__=result;}
 return result;
}
button.addEventListener('click',runTimingGate);if(new URLSearchParams(location.search).has('autorun'))runTimingGate();
