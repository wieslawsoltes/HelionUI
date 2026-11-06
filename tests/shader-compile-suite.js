import {partitionShaderProgram,shaderPartition} from '../src/gpu/shader-partitions.js';
import {boundedWait} from '../src/startup/lifecycle.js';
/** Native compile-only suite shared by Node/Dawn and tests/shaders.html.
 * No font download, arena allocation, command submission, pixel readback, or
 * claim of GPU execution. Shader errors are not swallowed or converted to passes.
 */
import {BUILD_VERSION} from '../src/version.js';
import {kernels,shaderProgram,resourcesForEntry,diagnosticProgram} from '../src/gpu/shader-library.js';
import {createCheckedShaderModule,ShaderCompilationError} from '../src/gpu/shader-diagnostics.js';

export const syntaxFixtures = [
 {
  name:'Reported DataGrid comparator',
  broken:'fn regression(compare:i32,descending:bool)->bool { return select(compare<0,compare>0,descending); }',
  fixed:'fn regression(compare:i32,descending:bool)->bool { return select((compare<0), (compare>0), descending); }'
 },
 {
  name:'Reported designer kind predicate',
  broken:'fn dsAllowed(kind:u32)->bool{return kind>=1u&&kind<=18u&&kind!=11u||kind==20u;}',
  fixed:'fn dsAllowed(kind:u32)->bool{return (kind>=1u&&kind<=18u&&kind!=11u)||kind==20u;}'
 },
 {
  name:'Reported designer property ranges',
  broken:'fn regression(field:u32,v:f32)->bool { if(field==22u&&(v<=0.0||v>1024.0)||field==25u&&(v<0.0||v>1.0)||(field==27u||field==28u)&&(v<.001||v>64.0)){return false;} return true; }',
  fixed:'fn regression(field:u32,v:f32)->bool { if((field==22u&&(v<=0.0||v>1024.0))||(field==25u&&(v<0.0||v>1.0))||((field==27u||field==28u)&&(v<.001||v>64.0))){return false;} return true; }'
 }
];
export async function validateShaderPipelines(device, shaders, constants, progress = () => {}, {compilation='partitioned',timeoutMs=30000,signal}={}) {
 const wait=(promise,stage)=>boundedWait(promise,{timeoutMs,signal,stage});
 const unexpected = [];
 const onError = event => unexpected.push(event.error.message);
 device.addEventListener('uncapturederror', onError);
 try {
  const rejectedFixtures = [];
  for(const fixture of syntaxFixtures){
   let rejected = false;
   try { await createCheckedShaderModule(device, {code:fixture.broken,sections:[]}, fixture.name); }
   catch(error) { if(!(error instanceof ShaderCompilationError)) throw error; rejected = true; }
   if(!rejected) throw new Error(`Native compiler accepted invalid fixture: ${fixture.name}`);
   await createCheckedShaderModule(device, {code:fixture.fixed,sections:[]}, fixture.name+' / repaired');
   rejectedFixtures.push(fixture.name); progress(fixture.name+' / repaired accepted');
  }
  const program = shaderProgram(shaders, {...constants, VIEW_FEATURES:511});
  const programs=compilation==='monolithic'?new Map([['monolithic',program]]):partitionShaderProgram(program,kernels);
  const modules=new Map();

  for (const entry of kernels) {
    const name=compilation==='monolithic'?'monolithic':shaderPartition(entry);
    if(!modules.has(name)){progress(`Compiling ${name} module`);modules.set(name,await wait(createCheckedShaderModule(device,programs.get(name),`Helion ${name} kernels`),`native module ${name}`));}
    const module=modules.get(name);
    const entries = resourcesForEntry(program.code, entry).map(({ binding }) => {
      const descriptor = { binding, visibility: GPUShaderStage.COMPUTE };
      if(binding===12)descriptor.texture={sampleType:'float',viewDimension:'2d'};
      else if (binding === 8) descriptor.storageTexture = { access: 'write-only', format: 'rgba8unorm' };
      else descriptor.buffer = { type: binding === 0 || binding === 9 ? 'uniform' : binding === 7 || binding === 10 ? 'read-only-storage' : 'storage', hasDynamicOffset: binding === 9 };
      return descriptor;
    });
    const bindLayout = device.createBindGroupLayout({ entries, label: entry });
    const layout = device.createPipelineLayout({ bindGroupLayouts: [bindLayout] });
    await wait(device.createComputePipelineAsync({ label: entry, layout, compute: { module, entryPoint: entry } }),`native pipeline ${entry}`);
    progress(entry);
  }
  const metrics = await createCheckedShaderModule(device, { code: shaders.metrics, sections: [] }, 'GPU timing history');
  await device.createComputePipelineAsync({ layout: 'auto', compute: { module: metrics, entryPoint: 'recordMetrics' } });
  const present = await createCheckedShaderModule(device, diagnosticProgram(shaders, 'present'), 'Helion compute HUD');
  await device.createComputePipelineAsync({layout:'auto',compute:{module:present,entryPoint:'compositeHud'}});
  const minimal = await createCheckedShaderModule(device, diagnosticProgram(shaders, 'blit'), 'Pixel-exact presentation');
  for (const format of ['rgba8unorm','bgra8unorm']) for(const [vertex,fragment] of [['vertex','blitFragment'],['hudVertex','hudBlitFragment'],['vertex','hudFullscreenFragment']]) {
    await device.createRenderPipelineAsync({layout:'auto',vertex:{module:minimal,entryPoint:vertex},fragment:{module:minimal,entryPoint:fragment,targets:[{format}]}});
  }
  const hud = await createCheckedShaderModule(device, diagnosticProgram(shaders, 'hud'), 'Resident font HUD');
  for (const entryPoint of ['rasterHudFont', 'buildHudText']) await device.createComputePipelineAsync({ layout: 'auto', compute: { module: hud, entryPoint } });

  if(unexpected.length) throw new Error(unexpected.join('\n'));
  return {status:'PASS',version:BUILD_VERSION,compilation,coreModules:programs.size,computePipelines:kernels.length+4,
   presentationFormats:2,presentationEntryPoints:3,rejectedFixtures,
   invalidComparatorRejected:true,invalidDesignerExpressionsRejected:true,
   gpuExecutionVerified:false,renderedPixelsVerified:false};
 } finally { device.removeEventListener('uncapturederror', onError); }
}
