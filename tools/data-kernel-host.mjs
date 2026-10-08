/** Test-only scalar replay of data-source.wgsl bodies. NOT a native WGSL
 * compiler/GPU emulator or runtime fallback. Hash overflow is explicitly u32. */
import {readFile} from 'node:fs/promises';
import {compile,h} from '../src/core/compiler.js';
import {dataSource,encodeDataBatch} from '../src/data/index.js';
import {scalarFunctions,translateScalarBody} from './editor-kernel-host.mjs';
const source=await readFile(new URL('../shaders/data-source.wgsl',import.meta.url),'utf8');
const query=await readFile(new URL('../shaders/data.wgsl',import.meta.url),'utf8');
export function scalarData(options={}){
 const compiled=compile(h('DataGrid',{id:'table',itemsSource:dataSource({capacity:32,stringCapacity:1024,inboxCapacity:8192,columns:[{field:'name',type:'text'},{field:'value',type:'number'},{field:'enabled',type:'boolean'}],...options})}));
 const {heap,state}=compiled,meta=compiled.tables[0].source,t=meta.table,d=meta.pointer,fh=new Float32Array(heap.buffer);
 const words=new Uint32Array(1),floats=new Float32Array(words.buffer);
 const env={heap,state,nodes:[{info:{x:11},action:{w:t}}],frame:{counts:{x:1}},NONE:0xffffffff,select:(a,b,c)=>c?b:a,vec2:(x,y)=>({x,y}),u32:x=>x>>>0,f32:Math.fround,min:Math.min,max:Math.max,hf:i=>fh[i],hsetf:(i,x)=>fh[i]=x,toBits:x=>{floats[0]=x;return words[0];},fromBits:x=>{words[0]=x;return floats[0];}};
 const bodies=[...scalarFunctions(source),...scalarFunctions(query).filter(f=>['lessRow','lower'].includes(f.name))],code=bodies.map(f=>translateScalarBody(f.code).replace(/vec2<u32>\(/g,'vec2(').replace(/return \(key\^\(key>>16\)\)\*0x45d9f3b;/,'return Math.imul(key^(key>>>16),0x45d9f3b)>>>0;')).join('\n');
 const kernel=new Function(...Object.keys(env),code+`\nreturn {${bodies.map(f=>f.name).join(',')}};`)(...Object.values(env));let serial=0;
 return {compiled,heap,state,meta,kernel,apply(operations,options){const data=encodeDataBatch(meta,operations,options);heap.set(data,meta.inbox);kernel.applyDataSource(0,1,data.length,0,++serial);return this;},get revision(){return heap[d+3];},get result(){return heap[d+19];},get rejected(){return heap[d+18];},rows(){const result=[];for(let i=0;i<heap[d+11];i++){if(!kernel.sourceAlive(t,i))continue;const at=heap[meta.rows+i*8];result.push({id:heap[heap[d+4]+i],name:String.fromCodePoint(...heap.subarray(at+1,at+1+heap[at])),value:fh[meta.rows+i*8+1],enabled:!!fh[meta.rows+i*8+2]});}return result;}};
}
