import test from 'node:test';
import assert from 'node:assert/strict';
import {guardShaderEntries,instrumentPipelinePreparation} from '../tools/startup-compile-probe.mjs';
import {resourcesForEntry} from '../src/gpu/shader-library.js';

test('compile probe uses a uniform workgroup guard and preserves entries, bindings and line maps',()=>{
  const code='@group(0) @binding(5) var<storage,read_write> scratch:array<atomic<u32>>;\n'+
    '@compute @workgroup_size(64) fn main(@builtin(global_invocation_id) id:vec3<u32>){workgroupBarrier();atomicStore(&scratch[id.x],1u);}\n'+
    '@compute @workgroup_size(1) fn empty(){}\n';
  const program={code,sections:[{name:'test.wgsl',startLine:1,endLine:4}]};
  const result=guardShaderEntries(program,['main','empty','absent'],1234567890);
  assert.equal(result.sections,program.sections);
  assert.equal(result.code.split('\n').length,code.split('\n').length);
  assert.match(result.code,/fn main\(@builtin\(global_invocation_id\) id:vec3<u32>,@builtin\(workgroup_id\) compileProbeGroup:vec3<u32>\)/);
  assert.match(result.code,/fn empty\(@builtin\(workgroup_id\) compileProbeGroup:vec3<u32>\)/);
  assert.match(result.code,/if\(compileProbeGroup.x==1234567890u\)\{return;\}workgroupBarrier/);
  assert.deepEqual(resourcesForEntry(result.code,'main'),resourcesForEntry(code,'main'));
  assert.equal(program.code,code);
});
test('compile probe reuses an existing workgroup input and varies native code per run',()=>{
  const p={code:'@compute @workgroup_size(1) fn main(@builtin(workgroup_id) group:vec3<u32>){workgroupBarrier();}'};
  const a=guardShaderEntries(p,['main'],1000000000),b=guardShaderEntries(p,['main'],1000000001);
  assert.equal((a.code.match(/@builtin\(workgroup_id\)/g)||[]).length,1);
  assert.match(a.code,/if\(group.x==1000000000u\)/);assert.notEqual(a.code,b.code);
  for(const bad of [0,999999999,2000000000,NaN,Infinity,1000000000.5])assert.throws(()=>guardShaderEntries(p,['main'],bad),RangeError);
});
test('pipeline instrumentation fails closed when its injection site changes',()=>{
  assert.throws(()=>instrumentPipelinePreparation('changed source',1000000000),/no longer matches/);
  const result=instrumentPipelinePreparation('createCheckedShaderModule(device,programs.get(name),label)',1000000000);
  assert.match(result,/createCheckedShaderModule\(device,compileProbeProgram\(programs.get\(name\)\),label\)/);
  assert.match(result,/guardShaderEntries\(p,kernels,1000000000\)/);
});
