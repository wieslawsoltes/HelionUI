/** Test-only source-body adapter. Not a native compiler, GPU emulator or UI fallback. */
import {readFile} from 'node:fs/promises';
import {scalarFunctions,translateScalarBody,noFallthrough} from './editor-kernel-host.mjs';
import {scalarTypography} from './typography-kernel-host.mjs';
const funcs=scalarFunctions(await readFile(new URL('../shaders/typography-ui.wgsl',import.meta.url),'utf8'));
const code=funcs.map(f=>noFallthrough(translateScalarBody(f.code)).replace(/\barray<u32,\s*2>\(/g,'Array.of(').replace(/\bvec2<u32>\(/g,'vec2(').replace(/atomicStore\(&scratch\[([^\]]+)\],([^;]+)\)/g,'(scratch[$1]=$2)')).join('\n');
export function scalarUITypography(compiled){
 const p={...compiled,runs:compiled.shapedTexts},c=scalarTypography(p),heap=c.heap,float=new Float32Array(heap.buffer),state=compiled.state.slice(),stateF=new Float32Array(state.buffer),u=new Uint32Array(compiled.nodes.buffer,compiled.nodes.byteOffset,compiled.nodes.byteLength/4),f=new Float32Array(u.buffer,u.byteOffset,u.length),scratch=new Uint32Array(64);
 const vector=(a,at)=>({x:a[at],y:a[at+1],z:a[at+2],w:a[at+3]});
 const nodes=Array.from({length:compiled.nodeCount},(_,i)=>Object.fromEntries(['info','text','size','limits','margin','paint','placement','tracks','misc','action','bind','config','available','rect','clip','matrix','translation','aux'].map((k,j)=>[k,vector(['info','text','paint','placement','tracks','action','bind','aux'].includes(k)?u:f,i*72+j*4)])));
 const cs=i=>64+i*16,owner=i=>{const e=nodes[i].config.w;return nodes[i].info.x===36&&e&&heap[e+36]?heap[heap[e+36]]:i;};
 const api={...c.run,heap,state,nodes,scratch,NONE:0xffffffff,cs,extension:n=>n.config.w,templateContentOwner:owner,textLength:i=>{const o=owner(i);return nodes[o].info.x===9?state[cs(o)+4]:nodes[i].text.w;},visible:i=>{for(let n=i,j=0;n!==0xffffffff&&j<32;j++,n=nodes[n].info.y)if(nodes[n].text.y&32)return false;return true;},contentRect:n=>n.rect,overflow:v=>{state[15]|=v;},sf:i=>stateF[i],hf:i=>float[i],hsetf:(i,n)=>float[i]=n,select:(a,b,t)=>t?b:a,min:Math.min,max:Math.max,floor:Math.floor,ceil:Math.ceil,abs:Math.abs,u32:x=>x>>>0,bitcast:x=>x,vec2:(x,y)=>({x,y}),toBits:x=>new Uint32Array(new Float32Array([x]).buffer)[0]};
 const run=new Function(...Object.keys(api),code+'\nreturn {'+funcs.map(x=>x.name).join(',')+'};')(...Object.values(api));
 return {...c,nodes,state,stateF,scratch,ui:run,all(){c.run._reset();for(let i=0;i<p.runs.length;i++)run.shapeTextRuns({x:i});return this;},layout(){for(let i=0;i<p.runs.length;i++)run.layoutTextRuns({x:i});return this;}};
}
