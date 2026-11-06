import {partitionShaderProgram,shaderPartition} from './shader-partitions.js';
import {boundedWait,timeoutOption} from '../startup/lifecycle.js';
import { kernels, loadShaders, resourcesForEntry, shaderProgram, diagnosticProgram } from './shader-library.js';
import { createCheckedShaderModule } from './shader-diagnostics.js';
import {entryEnabled} from './view-features.js';
import { arenaLayout } from './arena-layout.js';

/** Bounded parallel compilation. Startup can fail fast; every worker promise is observed. */
export async function parallelTasks(tasks, concurrency = 4, progress = () => {}, { failFast = false, signal } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new RangeError('pipelineConcurrency must be an integer from 1 to 32');
  const results = new Array(tasks.length); let next = 0, done = 0, failure;
  await Promise.all(Array.from({ length: Math.min(tasks.length, concurrency) }, async () => {
    for (;;) {
      if(signal?.aborted)throw signal.reason || new Error('Pipeline preparation cancelled');
      if(failFast && failure)break;
      const index = next++; if (index >= tasks.length) break;
      try { results[index] = await tasks[index](); } catch (error) { failure ??= error; if(failFast)throw error; }
      try { progress(++done, tasks.length); } catch (error) { failure ??= error; }
    }
  }));
  if (failure) throw failure;
  return results;
}

/** No view/font dependency: adapter, shader compilation and fonts overlap. */
export async function prepareGPU(limits, options, startup, report) {
  const { constants, scratchBytes, drawBytes, glyphCacheBytes } = arenaLayout(limits);
  const needed = Math.max(scratchBytes, drawBytes, glyphCacheBytes);
  let device;
  const timeoutMs=timeoutOption(options.pipelineTimeoutMs,30000,'pipelineTimeoutMs');
  const wait=(promise,stage,onLate)=>boundedWait(promise,{signal:options.signal,timeoutMs,stage,onLate});
  const cancelled=()=>device?.destroy();
  if(options.signal?.aborted)throw options.signal.reason||new Error('GPU preparation cancelled');
  const errors = [];
  const adapterStart = performance.now();
  const [adapter, shaders] = await Promise.all([
    wait(navigator.gpu.requestAdapter({ powerPreference: options.powerPreference || 'high-performance' }),'adapter'), wait(loadShaders(),'shader fetch')
  ]);
  startup.adapterAndShadersMs = performance.now() - adapterStart;
  if (!adapter) throw new Error('The browser did not provide a WebGPU adapter. Check browser graphics settings and driver support.');
  if (needed > adapter.limits.maxStorageBufferBindingSize || needed > adapter.limits.maxBufferSize) throw new Error('Configured arenas exceed this adapter’s storage-buffer limits.');
  const profiling = options.performanceHUD === true || options.profiling === true;
  const gpuTiming = profiling && options.gpuTiming !== false && adapter.features.has('timestamp-query');
  // Reserve enough device capacity before the independent font compiler finishes.
  // This requests limits, not allocations. Actual heap size is checked at upload.
  const largest = Math.max(needed, limits.maxHeapWords * 4);
  const requiredLimits = {
    maxStorageBufferBindingSize: Math.min(adapter.limits.maxStorageBufferBindingSize, Math.max(128 * 1024 * 1024, largest)),
    maxBufferSize: Math.min(adapter.limits.maxBufferSize, Math.max(256 * 1024 * 1024, largest))
  };
  const concurrency = options.pipelineConcurrency ?? 8;
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new RangeError('pipelineConcurrency must be 1–32');
  try {
    let begin = performance.now();
    device = await wait(adapter.requestDevice({ requiredFeatures: gpuTiming ? ['timestamp-query'] : [], requiredLimits }), 'device', late=>late.destroy());
    options.signal?.addEventListener('abort',cancelled,{once:true});
    startup.deviceMs = performance.now() - begin;
    const onError = event => errors.push(event.error.message);
    device.addEventListener('uncapturederror', onError);
    const program = shaderProgram(shaders, {...constants,VIEW_FEATURES:options.viewFeatures??511}), format = navigator.gpu.getPreferredCanvasFormat();
    const compilation=options.shaderCompilation??'partitioned';
    if(!['partitioned','monolithic'].includes(compilation))throw new TypeError('shaderCompilation must be partitioned or monolithic');
    const enabled=kernels.filter(entry=>entryEnabled(entry,options.viewFeatures??511));
    const programs=compilation==='partitioned'?partitionShaderProgram(program,enabled):new Map([['monolithic',program]]);
    const modules=new Map();
    startup.shaderCompilation=compilation;
    startup.shaderPrograms=[...programs].map(([name,p])=>({name,bytes:new TextEncoder().encode(p.code).byteLength,entries:p.entries??enabled}));
    const getModule=entry=>{
      const name=compilation==='partitioned'?shaderPartition(entry):'monolithic';
      if(!modules.has(name)){report('shaders',`Compiling ${name} module`);modules.set(name,wait(createCheckedShaderModule(device,programs.get(name),`Helion ${name} compute kernels`),`shader ${name}`));}
      return modules.get(name);
    };
    const single = name => ({ code: shaders[name], sections: [{ name: `shaders/${name}.wgsl`, startLine: 1, endLine: shaders[name].split('\n').length }] });
    begin = performance.now(); report('shaders', 'Validating shader modules');
    // The diagnostic font/graph compiler is deliberately NOT a prerequisite
    // for the first full-quality UI frame. A tiny independent blit is sufficient.
    const [blitModule, metricsModule] = await Promise.all([
      wait(createCheckedShaderModule(device, diagnosticProgram(shaders, 'blit'), 'Helion minimal canvas copy'),'canvas module'),
      wait(createCheckedShaderModule(device, single('metrics'), 'Helion resident timing history'),'metrics module')
    ]);
    startup.shaderModulesMs = performance.now() - begin;
    startup.pipelineEntries = [];
    const timed = (name, task) => async () => {
      const start = performance.now();
      try { return await wait(task(),`pipeline ${name}`); }
      finally { startup.pipelineEntries.push({ name, startMs: start - startup.startedAt, elapsedMs: performance.now() - start }); }
    };
    let hudPromise;
    const prepareHUD = () => hudPromise ??= (async () => {
      const started = performance.now(); report('hud-pipelines', 'Preparing the optional GPU font/graph overlay');
      const programs = await Promise.allSettled([
        wait(createCheckedShaderModule(device, diagnosticProgram(shaders, 'present'), 'Helion diagnostic presentation'),'HUD presentation module'),
        wait(createCheckedShaderModule(device, diagnosticProgram(shaders, 'hud'), 'Helion diagnostic font/layout'),'HUD font module')
      ]);
      const failed = programs.find(p => p.status === 'rejected'); if (failed) throw failed.reason;
      const [presentModule, hudModule] = programs.map(p => p.value);
      let presentPipeline, hudFullscreenPipeline; const hudPipelines = new Map();
      const work = [timed('hud-copy', async () => {
        presentPipeline = await device.createRenderPipelineAsync({label:'GPU HUD quad copy',layout:'auto',vertex:{module:blitModule,entryPoint:'hudVertex'},fragment:{module:blitModule,entryPoint:'hudBlitFragment',targets:[{format}]},primitive:{topology:'triangle-list'}});
        hudFullscreenPipeline = await device.createRenderPipelineAsync({label:'HUD fullscreen reference copy',layout:'auto',vertex:{module:blitModule,entryPoint:'vertex'},fragment:{module:blitModule,entryPoint:'hudFullscreenFragment',targets:[{format}]},primitive:{topology:'triangle-list'}});
      }), timed('compositeHud', async () => {
        hudPipelines.set('compositeHud', await device.createComputePipelineAsync({label:'HUD compute compositor',layout:'auto',compute:{module:presentModule,entryPoint:'compositeHud'}}));
      })];
      for (const entry of ['rasterHudFont', 'buildHudText']) work.push(timed(entry, async () => {
        hudPipelines.set(entry, await device.createComputePipelineAsync({ label: entry, layout: 'auto', compute: { module: hudModule, entryPoint: entry } }));
      }));
      await parallelTasks(work, concurrency,()=>{}, {failFast:true,signal:options.signal});
      startup.hudPipelineMs = performance.now() - started;
      return { presentPipeline, hudFullscreenPipeline, hudPipelines };
    })();
    const pipelines = new Map(), layouts = new Map();
    const tasks = enabled.map(entry => timed(entry, async () => {
      const module=await getModule(entry);
      const used = resourcesForEntry(program.code, entry);
      // Resource roles are fixed by the ABI. Equal binding sets can share both
      // native layout objects and, once uploaded, the same surface bind groups.
      const key = used.map(({binding}) => binding).join(',');
      let shared = layouts.get(key);
      if (!shared) {
        const entries = used.map(({ binding }) => {
          const descriptor = { binding, visibility: GPUShaderStage.COMPUTE };
          if(binding===12)descriptor.texture={sampleType:'float',viewDimension:'2d'};
          else if (binding === 8) descriptor.storageTexture = { access: 'write-only', format: 'rgba8unorm' };
          else descriptor.buffer = { type: binding === 0 || binding === 9 ? 'uniform' : binding === 7 || binding === 10 ? 'read-only-storage' : 'storage', hasDynamicOffset: binding === 9 };
          return descriptor;
        });
        const bindLayout = device.createBindGroupLayout({ entries, label: `Helion bindings ${key}` });
        const layout = device.createPipelineLayout({ bindGroupLayouts: [bindLayout] });
        shared = {bindLayout,layout}; layouts.set(key,shared);
      }
      const pipeline = await device.createComputePipelineAsync({ layout:shared.layout, compute: { module, entryPoint: entry }, label: entry });
      pipelines.set(entry, { pipeline, layout: shared.bindLayout, used, dynamic: used.some(x => x.binding === 9) });
    }));
    let blitPipeline, metricsPipeline;
    tasks.push(timed('canvas-copy', async () => { blitPipeline = await device.createRenderPipelineAsync({ label: 'UI canvas copy', layout: 'auto', vertex: { module: blitModule, entryPoint: 'vertex' }, fragment: { module: blitModule, entryPoint: 'blitFragment', targets: [{ format }] }, primitive: { topology: 'triangle-list' } }); }));
    tasks.push(timed('recordMetrics', async () => { metricsPipeline = await device.createComputePipelineAsync({ label: 'recordMetrics', layout: 'auto', compute: { module: metricsModule, entryPoint: 'recordMetrics' } }); }));
    begin = performance.now();
    const prepared = await Promise.all([
      parallelTasks(tasks, concurrency, (done, total) => report('pipelines', `Preparing UI pipelines ${done}/${total}`, { done, total }),{failFast:true,signal:options.signal}),
      options.deferHUD === false ? prepareHUD() : Promise.resolve(null)
    ]);
    const hud = prepared[1];
    startup.pipelineMs = performance.now() - begin; startup.pipelineConcurrency = concurrency;
    if (errors.length) throw new Error(errors.join('\n'));
    device.removeEventListener?.('uncapturederror', onError);
    options.signal?.removeEventListener('abort',cancelled);
    return { device, adapter, shaders, source: program.code, constants, pipelines, presentPipeline: hud?.presentPipeline, hudFullscreenPipeline: hud?.hudFullscreenPipeline, blitPipeline, metricsPipeline, hudPipelines: hud?.hudPipelines || new Map(), prepareHUD, format, gpuTiming, requiredLimits };
  } catch (error) { options.signal?.removeEventListener('abort',cancelled);device?.destroy(); throw error; }
}
