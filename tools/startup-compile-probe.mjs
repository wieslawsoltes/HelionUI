/** Test instrumentation only. The uniform guard is outside WebGPU's maximum
 * workgroup count and changes native code without changing legal dispatches.
 * This discourages OS shader-cache reuse; it is not a production-page timing.
 */
export function guardShaderEntries(program,entries,guard) {
  if(!Number.isInteger(guard)||guard<1000000000||guard>=2000000000)throw new RangeError('Invalid compile probe guard');
  let code=program.code;
  for(const name of entries){
    const start=code.indexOf(`fn ${name}(`);if(start<0)continue;
    const brace=code.indexOf('{',start),end=code.lastIndexOf(')',brace),header=code.slice(start,end);
    const existing=/@builtin\(workgroup_id\)\s*(\w+)/.exec(header);
    const id=existing?.[1]??'compileProbeGroup';
    if(!existing)code=code.slice(0,end)+(header.endsWith('(')?'':',')+`@builtin(workgroup_id) ${id}:vec3<u32>`+code.slice(end);
    const body=code.indexOf('{',start)+1;
    code=code.slice(0,body)+`if(${id}.x==${guard}u){return;}`+code.slice(body);
  }
  return {...program,code};
}

export function instrumentPipelinePreparation(source,guard){
  const call='createCheckedShaderModule(device,programs.get(name),';
  if(!source.includes(call))throw new Error('Pipeline benchmark instrumentation no longer matches source');
  return source.replace(call,'createCheckedShaderModule(device,compileProbeProgram(programs.get(name)),')+
    `\n${guardShaderEntries.toString()}\nfunction compileProbeProgram(p){return guardShaderEntries(p,kernels,${guard});}\n`;
}
