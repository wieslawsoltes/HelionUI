// These tests exercise harness wiring with a non-executing fake device.
// Native acceptance still requires tests/shaders.html or npm run check:native.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {syntaxFixtures,validateShaderPipelines} from './shader-compile-suite.js';
import {arenaLayout} from '../src/gpu/arena-layout.js';
import {validatedLimits} from '../src/core/compiler.js';
import {kernels} from '../src/gpu/shader-library.js';
import {checkLogicalGrouping} from '../tools/check-wgsl-logic.mjs';
const shaders=Object.fromEntries(await Promise.all((await readdir(new URL('../shaders/',import.meta.url))).filter(f=>f.endsWith('.wgsl')).map(async f=>[f.slice(0,-5),await readFile(new URL('../shaders/'+f,import.meta.url),'utf8')])));
function fakeDevice({acceptBroken=false,rejectFixed=false,failPipeline=false}={}){
 const calls={modules:[],compute:[],render:[],listeners:0};
 return {calls,
  addEventListener(){calls.listeners++;},removeEventListener(){calls.listeners--;},
  pushErrorScope(){},async popErrorScope(){return null;},
  createShaderModule(descriptor){calls.modules.push(descriptor);return{async getCompilationInfo(){
   const broken=syntaxFixtures.some(f=>f.broken===descriptor.code),fixed=syntaxFixtures.some(f=>f.fixed===descriptor.code);
   return {messages:((broken&&!acceptBroken)||(fixed&&rejectFixed))?[{type:'error',message:'simulated compiler rejection'}]:[]};
  }};},
  createBindGroupLayout(descriptor){return descriptor;},createPipelineLayout(descriptor){return descriptor;},
  async createComputePipelineAsync(descriptor){if(failPipeline)throw new Error('simulated pipeline failure');calls.compute.push(descriptor);return{};},
  async createRenderPipelineAsync(descriptor){calls.render.push(descriptor);return{};}
 };
}
async function runWithFake(fake){
 const old=globalThis.GPUShaderStage;globalThis.GPUShaderStage={COMPUTE:4};
 try{return await validateShaderPipelines(fake,shaders,arenaLayout(validatedLimits({})).constants);}
 finally{if(old===undefined)delete globalThis.GPUShaderStage;else globalThis.GPUShaderStage=old;}
}
test('native compile harness attempts all entries but explicitly reports no execution (fake)',async()=>{
 const d=fakeDevice(),r=await runWithFake(d);
 assert.equal(r.status,'PASS');assert.equal(r.gpuExecutionVerified,false);
 assert.equal(d.calls.compute.length,kernels.length+4);assert.equal(d.calls.render.length,6);
 assert.equal(d.calls.modules.length,r.coreModules+10);assert.equal(r.compilation,'partitioned');assert.equal(d.calls.listeners,0);
 for(const entry of kernels)assert.ok(d.calls.compute.some(p=>p.compute.entryPoint===entry));
});
for(const [name,options,message] of [
 ['accepted invalid source',{acceptBroken:true},/accepted invalid fixture/],
 ['rejected repaired source',{rejectFixed:true},/simulated compiler rejection/],
 ['pipeline rejection',{failPipeline:true},/simulated pipeline failure/]
])test(`native compile harness cannot turn ${name} into success (fake)`,async()=>{
 const d=fakeDevice(options);await assert.rejects(()=>runWithFake(d),message);assert.equal(d.calls.listeners,0);
});
test('native designer negative controls contain the reported syntax and repaired controls pass the guard',()=>{
 for(const f of syntaxFixtures.slice(1)){
  assert.equal(checkLogicalGrouping(f.broken).length,1);
  assert.deepEqual(checkLogicalGrouping(f.fixed),[]);
 }
});
