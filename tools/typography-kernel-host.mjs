/** Test-only scalar translation of the actual WGSL bodies. This is neither a
 * native shader compiler nor a CPU runtime fallback. See tests/typography.html. */
import {readFile} from 'node:fs/promises';
import {scalarFunctions,translateScalarBody,noFallthrough} from './editor-kernel-host.mjs';
const sources=await Promise.all(['unicode','shaping','shaping-bidi','paragraph'].map(s=>readFile(new URL('../shaders/'+s+'.wgsl',import.meta.url),'utf8')));
const functions=sources.flatMap(s=>scalarFunctions(s));
// WGSL unsigned shifts operate on u32, unlike JS's signed shift operator.
const code=functions.map(f=>noFallthrough(translateScalarBody(f.code).replace(/\bvec2<u32>\(/g,'vec2(')).replace(/(?<!>)>>(?!>)/g,'>>>').replace(/\bvar\b/g,'let').replaceAll('{',`{if(++_ticks>4000000)throw new Error('Scalar budget: ${f.name}');`)).join('\n');
export function scalarTypography(prepared){
 const heap=prepared.heap.slice(),floats=new Float32Array(heap.buffer);const b=new ArrayBuffer(4),u=new Uint32Array(b),f=new Float32Array(b);
 const vec2=(a=0,b=a)=>({x:a,y:b,0:a,1:b});
 const api={vec2,heap,hf:i=>floats[i],hsetf:(i,n)=>{floats[i]=n;},select:(a,b,c)=>c?b:a,min:Math.min,max:Math.max,floor:Math.floor,ceil:Math.ceil,abs:Math.abs,round:Math.round,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),u32:x=>x>>>0,i32:x=>x|0,f32:Math.fround,toBits:x=>{f[0]=x;return u[0];},fromBits:x=>{u[0]=x;return f[0];}};
 const run=new Function(...Object.keys(api),`let _ticks=0;${code}\nreturn {_reset(){_ticks=0;},${functions.map(f=>f.name).join(',')}};`)(...Object.values(api));
 return {heap,run,shape(index=0){run._reset();run.shapeRun(prepared.runs[index].pointer);return this;}};
}
