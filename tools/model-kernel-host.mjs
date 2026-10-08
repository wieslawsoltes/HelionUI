/** Test-only scalar replay of the actual models.wgsl bodies. No GPU execution. */
import {readFile} from 'node:fs/promises';
import {compile,h} from '../src/core/compiler.js';
import {scalarFunctions,translateScalarBody,noFallthrough} from './editor-kernel-host.mjs';
const source=await readFile(new URL('../shaders/models.wgsl',import.meta.url),'utf8');
export function scalarModels(models){
 const compiled=compile(h('Grid',{models})),{heap,state}=compiled,hf32=new Float32Array(heap.buffer);const scratch=new ArrayBuffer(4),u=new Uint32Array(scratch),f=new Float32Array(scratch);
 const bodies=scalarFunctions(source).filter(x=>!['pullModels','pushModels'].includes(x.name));
 const env={heap,state,VIEW_FEATURES:7,u32:x=>x>>>0,i32:x=>x|0,f32:Math.fround,hf:i=>hf32[i],toBits:x=>{f[0]=x;return u[0];},fromBits:x=>{u[0]=x;return f[0];},select:(a,b,c)=>c?b:a,min:Math.min,max:Math.max,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),abs:Math.abs,sin:Math.sin,cos:Math.cos,sqrt:Math.sqrt,floor:Math.floor,ceil:Math.ceil,round:Math.round};
 const k=new Function(...Object.keys(env),bodies.map(x=>noFallthrough(translateScalarBody(x.code))).join('\n')+`\nreturn {${bodies.map(x=>x.name).join(',')}};`)(...Object.values(env));
 return {compiled,heap,state,kernel:k,evaluate(){for(let y=0;y<compiled.models.length;y++)for(let x=0;x<compiled.models[y].count;x++)k.evaluateModels({x,y});return this;},value(name,field,row=0){const m=compiled.models.find(m=>m.name===name);return k.modelRead(m.pointer,m.fields.find(f=>f.name===field).index,row);},set(name,field,value,row=0){const m=compiled.models.find(m=>m.name===name);k.modelCommand(m.index,row,0,value,m.fields.find(f=>f.name===field).index);return this;},execute(name,command,arg=0,row=0){const m=compiled.models.find(m=>m.name===name);k.modelCommand(m.index,row,m.commands.indexOf(command)+1,arg,0);return this;}};
}
