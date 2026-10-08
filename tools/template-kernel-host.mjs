/** Test-only scalar execution of template WGSL; NOT a native compiler or renderer. */
import {readFile} from 'node:fs/promises';
import {compile} from '../src/core/compiler.js';
import {fbits,fromBits} from '../src/core/schema.js';
import {scalarFunctions,translateScalarBody,noFallthrough} from './editor-kernel-host.mjs';
const source=await readFile(new URL('../shaders/templates.wgsl',import.meta.url),'utf8');
const exclude=new Set(['rankTemplateTree']);
const functions=scalarFunctions(source).filter(f=>!exclude.has(f.name));
let code=functions.map(f=>noFallthrough(translateScalarBody(f.code))).join('\n')
 .replace(/bitcast<vec4<f32>>\(/g,'vectorFromBits(')
 .replace(/vec([234])<(?:f32|u32)>\(/g,'vec$1(')
 .replace(/any\(padding!=nodePadding\(nodes\[recipient\]\)\)/g,'vectorDifferent(padding,nodePadding(nodes[recipient]))')
 .replace(/atomicOr\(&scratch\[([^\]]+)\],([^;]+?)\)/g,'atomicOr($1,$2)');
// All right shifts in these selected shader helpers operate on u32.
code=code.replace(/(?<!>)>>(?!>)/g,'>>>');
const fields=['info','text','size','limits','margin','paint','placement','tracks','misc','action','bind','config','available','rect','clip','matrix','translation','aux'];
const integers=new Set(['info','text','paint','placement','tracks','action','bind','aux']);
export function scalarTemplate(view,options={}){
 const compiled=options.compiled??compile(view,options),heap=compiled.heap,state=compiled.state,hf32=new Float32Array(heap.buffer),sf32=new Float32Array(state.buffer),u=new Uint32Array(compiled.nodes.buffer),f=new Float32Array(u.buffer),scratch=new Uint32Array(16);
 function vector(...a){if(a.length===1)a=Array(4).fill(a[0]);for(const [k,j]of Object.entries({x:0,y:1,z:2,w:3}))Object.defineProperty(a,k,{get:()=>a[j],set:v=>a[j]=v,configurable:true});return a;}
 let stateScans=0;const nodes=Array.from({length:compiled.nodeCount},(_,i)=>{const n={};fields.forEach((key,w)=>Object.defineProperty(n,key,{get(){const b=integers.has(key)?u:f,at=i*72+w*4,a=vector(...b.slice(at,at+4));for(let j=0;j<4;j++)Object.defineProperty(a,['x','y','z','w'][j],{get:()=>b[at+j],set:v=>b[at+j]=v,configurable:true});return a;},set(v){(integers.has(key)?u:f).set(v,i*72+w*4);}}));return n;});
 const cs=i=>64+i*16;const frame={counts:{x:compiled.nodeCount},viewport:{w:0}},stage={p:{x:0}};
 const visible=i=>{for(let depth=0;i!==0xffffffff&&depth<32;depth++,i=nodes[i].info.y)if(nodes[i].text.y&32)return false;return true;};
 const enabled=i=>{for(let depth=0;i!==0xffffffff&&depth<32;depth++,i=nodes[i].info.y)if(nodes[i].text.y&16)return false;return true;};
 const boundValue=i=>nodes[i].bind.y===1?(sf32[cs(nodes[i].bind.x)]*fromBits(nodes[i].bind.z)+fromBits(nodes[i].bind.w)):sf32[cs(i)];
 const palette=()=>compiled.templateSystem?heap[compiled.templateSystem.pointer+2]:state[6];
 const pseudoState=i=>(state[1]===i?1:0)|(state[2]===i?2:0)|(state[0]===i?4:0)|(sf32[cs(i)]>.5?8:0)|(!enabled(i)?16:0)|(palette()?64:32);
 const nodePadding=n=>{const e=n.config.w;if(e&&(heap[e+1]&1))return vector(...hf32.slice(e+8,e+12));return vector(n.limits.z);};
 const api={onStateScan:()=>stateScans++,heap,state,nodes,frame,stage,scratch,NONE:0xffffffff,INF:1e7,VIEW_FEATURES:255,extension:n=>n.config.w,cs,hf:i=>hf32[i],hsetf:(i,v)=>hf32[i]=v,sf:i=>sf32[i],setf:(i,v)=>sf32[i]=v,visible,enabled,boundValue,pseudoState,nodePadding,
  textLength:i=>nodes[i].info.x===9?state[cs(i)+4]:nodes[i].text.w,vectorFromBits:v=>vector(...v.map(fromBits)),contentRect:n=>vector(n.rect.x,n.rect.y,n.rect.z,n.rect.w),vec2:vector,vec3:vector,vec4:vector,vectorDifferent:(a,b)=>a.some((v,j)=>v!==b[j]),
  select:(a,b,c)=>c?b:a,clamp:(n,a,b)=>Math.max(a,Math.min(n,b)),min:Math.min,max:Math.max,floor:Math.floor,pow:Math.pow,u32:x=>x>>>0,f32:Math.fround,toBits:fbits,fromBits,
  atomicOr:(at,v)=>scratch[at]|=v,
  mix:(a,b,t)=>Array.isArray(a)?a.map((v,j)=>v+(b[j]-v)*t):a+(b-a)*t,
  pack4x8unorm:v=>v.reduce((n,c,j)=>(n|(Math.round(Math.max(0,Math.min(c,1))*255)<<(j*8)))>>>0,0),unpack4x8unorm:v=>[0,8,16,24].map(n=>((v>>>n)&255)/255),
  eased:(t,m)=>m===1?t*t*(3-2*t):t,dsRec:(d,k)=>heap[d+5]+heap[d+64]+k*96,dsData:d=>heap[d+5],dsNode:(d,k)=>heap[d+2]+k,dsAlive:(d,k)=>k<heap[d+1]&&heap[heap[d+5]+heap[d+64]+k*96]!==0,dsReject:(d,c)=>{heap[d+54]=c;heap[d+55]++;}};
 const kernel=new Function(...Object.keys(api),code.replace(/function templateState\([^)]*\)\s*\{/, '$& onStateScan();')+`\nreturn {${functions.map(f=>f.name).join(',')}};`)(...Object.values(api));
 const result={get stateScans(){return stateScans;},compiled,heap,state,nodes,frame,stage,kernel,scratch,cs,id:n=>compiled.ids.get(n),value:(name,property)=>{const i=typeof name==='number'?name:compiled.ids.get(name);return property==='value'?sf32[cs(i)]:property==='opacity'?sf32[cs(i)+3]:nodes[i][property];},step(time=0){frame.viewport.w=time;scratch[8]=0;kernel.synchronizeDesignerTemplates();for(let level=0;level<compiled.templateLevels;level++){stage.p.x=level;for(let i=0;i<compiled.nodeCount;i++)kernel.resolveTemplateLayout({x:i});}for(let level=0;level<compiled.templateLevels;level++){stage.p.x=level;for(let i=0;i<compiled.nodeCount;i++)kernel.resolveTemplateVisuals({x:i});}return result;}};
 return result;
}
