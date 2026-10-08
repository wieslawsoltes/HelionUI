/** Conservative checks for the controlled sources; NOT native WGSL validation. */
export function checkFunctionGraph(source) {
 const text=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 const functions=new Map(),errors=[];const pattern=/\bfn\s+(\w+)\s*\(/g;let match;
 while((match=pattern.exec(text))){const name=match[1],start=text.indexOf('{',pattern.lastIndex);let depth=1,end=start+1;while(depth&&end<text.length){if(text[end]==='{')depth++;if(text[end]==='}')depth--;end++;}if(functions.has(name))errors.push(`Duplicate function ${name}`);functions.set(name,text.slice(start,end));pattern.lastIndex=end;}
 const visiting=new Set(),done=new Set();
 const visit=(name,path)=>{if(visiting.has(name)){errors.push(`Recursive WGSL call graph: ${[...path,name].join(' -> ')}`);return;}if(done.has(name))return;visiting.add(name);for(const call of functions.get(name).matchAll(/\b(\w+)\s*\(/g))if(functions.has(call[1]))visit(call[1],[...path,name]);visiting.delete(name);done.add(name);};
 for(const name of functions.keys())visit(name,[]);
 return errors;
}

/** Additional conservative call-name/arity checks, not a WGSL type checker. */
export function checkFunctionCalls(source){
 const text=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 const definitions=new Map(),errors=[];
 function argumentsAt(start,types=false){let depth=1,brackets=0,angle=0,count=0,content=false,end=start+1;
  for(;end<text.length;end++){const c=text[end];if(c==='('){depth++;content=true;}else if(c===')'){if(--depth===0)break;}else if(c==='['||c==='{')brackets++;else if(c===']'||c==='}')brackets--;else if(types&&c==='<')angle++;else if(types&&c==='>')angle--;else if(c===','&&depth===1&&brackets===0&&angle===0){count++;content=false;}else if(!/\s/.test(c))content=true;}
  return {count:count+Number(content),end};
 }
 for(const match of text.matchAll(/\bfn\s+(\w+)\s*\(/g)){const args=argumentsAt(match.index+match[0].lastIndexOf('('),true);definitions.set(match[1],args.count);}
 const types=new Set([...text.matchAll(/\bstruct\s+(\w+)/g)].map(m=>m[1]));
 const builtins=new Set('abs acos acosh all any arrayLength asin asinh atan atanh atan2 ceil clamp cos cosh countLeadingZeros countOneBits countTrailingZeros cross degrees determinant distance dot dot4I8Packed dot4U8Packed exp exp2 extractBits faceForward firstLeadingBit firstTrailingBit floor fma fract frexp insertBits inverseSqrt ldexp length log log2 max min mix modf normalize pow quantizeToF16 radians reflect refract reverseBits round saturate sign sin sinh smoothstep sqrt step tan tanh transpose trunc select pack4x8snorm pack4x8unorm pack2x16snorm pack2x16unorm pack2x16float unpack4x8snorm unpack4x8unorm unpack2x16snorm unpack2x16unorm unpack2x16float atomicLoad atomicStore atomicAdd atomicSub atomicMax atomicMin atomicAnd atomicOr atomicXor atomicExchange atomicCompareExchangeWeak storageBarrier textureBarrier workgroupBarrier workgroupUniformLoad textureDimensions textureNumLayers textureNumLevels textureNumSamples textureLoad textureStore textureSample textureSampleLevel textureSampleGrad textureSampleCompare textureSampleCompareLevel textureGather textureGatherCompare textureSampleBaseClampToEdge dpdx dpdy fwidth dpdxCoarse dpdyCoarse fwidthCoarse dpdxFine dpdyFine fwidthFine f32 f16 i32 u32 bool if for while switch loop return binding group builtin workgroup_size align size location interpolate invariant id must_use diagnostic'.split(' '));
 for(const m of text.matchAll(/\b(\w+)\s*\(/g)){
  const name=m[1];if(definitions.has(name)){if(/\bfn\s*$/.test(text.slice(Math.max(0,m.index-5),m.index)))continue;const n=argumentsAt(m.index+m[0].lastIndexOf('(')).count;if(n!==definitions.get(name))errors.push(`${name}: call has ${n} arguments; declaration requires ${definitions.get(name)}`);
  }else if(!types.has(name)&&!builtins.has(name))errors.push(`Unknown WGSL call ${name}`);
 }
 return [...new Set(errors)];
}
