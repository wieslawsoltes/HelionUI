/** Test-only adapter executing scalar authoring WGSL bodies as JavaScript.
 * Not a shader compiler, GPU emulator, renderer or production fallback. Vector
 * pointer gestures and rasterization require tests/designer.html on WebGPU. */
import {readFile} from 'node:fs/promises';
import {scalarFunctions,translateScalarBody,noFallthrough} from './editor-kernel-host.mjs';
import {compile} from '../src/core/compiler.js';
import {h} from '../src/core/declaration.js';
import {fbits,fromBits} from '../src/core/schema.js';
import {DesignCommand} from '../src/designer/schema.js';
import {decodeDesignSnapshot} from '../src/designer/document.js';
const source=await readFile(new URL('../shaders/designer.wgsl',import.meta.url),'utf8');
const skipped=new Set(['dsGroup','dsAlign','dsDrag','dsSurfacePointer','dsTreePointer','dsInspectorPointer','dsColorPointer','dsTimelinePointer','dsRoute','dsWorld','dsViewportOrigin','dsZoom','dsFit','dsHandlePosition','dsSelectionBounds']);
const templateSource=await readFile(new URL('../shaders/templates.wgsl',import.meta.url),'utf8');
const bodies=[...scalarFunctions(templateSource).filter(f=>f.name==='dsTemplatesValid'),...scalarFunctions(source)].filter(f=>!skipped.has(f.name));
let code=bodies.map(f=>noFallthrough(translateScalarBody(f.code
 .replace(/\b(\w+)\s*\/=\s*(\d+)u/g,'$1=u32($1/$2)')
 .replace(/\b(\w+)\s*\/\s*(\d+)u/g,'u32($1/$2)')))).join('\n')
 .replace(/vec([234])<(?:f32|u32)>\(/g,'vec$1(');
// All right shifts in these selected shader helpers operate on u32.
code=code.replace(/(?<!>)>>(?!>)/g,'>>>');
const vec=(...args)=>{const a=args.flatMap(v=>typeof v==='object'?Array.from(v):[v]);return a;};
function vector(size,...args){let a=vec(...args);if(a.length===1)a=Array(size).fill(a[0]);while(a.length<size)a.push(0);for(const[key,index]of Object.entries({x:0,y:1,z:2,w:3})){if(index<size)Object.defineProperty(a,key,{get:()=>a[index],set:v=>a[index]=v,configurable:true});}Object.defineProperty(a,'xy',{get:()=>a.slice(0,2)});Object.defineProperty(a,'zw',{get:()=>a.slice(2,4)});return a;}
const fields=['info','text','size','limits','margin','paint','placement','tracks','misc','action','bind','config','available','rect','clip','matrix','translation','aux'];
const integer=new Set(['info','text','paint','placement','tracks','action','bind','aux']);
export function scalarDesigner(project={}){
 const c=compile(h('DesignSurface',{id:'design',designDocument:{capacity:16,history:4,...project}}));
 const meta=c.designers[0],d=meta.pointer,heap=c.heap,hf32=new Float32Array(heap.buffer),state=c.state,sf32=new Float32Array(state.buffer),nf32=new Float32Array(c.nodes.buffer,c.nodes.byteOffset,c.nodes.byteLength/4),nu32=new Uint32Array(c.nodes.buffer,c.nodes.byteOffset,c.nodes.byteLength/4);
 const nodes=Array.from({length:c.nodeCount},(_,i)=>{const n={};fields.forEach((name,w)=>{Object.defineProperty(n,name,{get:()=>{const backing=integer.has(name)?nu32:nf32,at=i*72+w*4;const v=vector(4,...backing.slice(at,at+4));for(let j=0;j<4;j++)Object.defineProperty(v,['x','y','z','w'][j],{get:()=>backing[at+j],set:x=>backing[at+j]=x,configurable:true});return v;},set:v=>(integer.has(name)?nu32:nf32).set(v,i*72+w*4)});});return n;});
 const transform=(m,t,p)=>vector(2,m.x*p[0]+m.z*p[1]+t[0],m.y*p[0]+m.w*p[1]+t[1]);
 const inverse=(m,t,p)=>{const det=m.x*m.w-m.y*m.z;return vector(2,((p[0]-t[0])*m.w-(p[1]-t[1])*m.z)/det,(-(p[0]-t[0])*m.y+(p[1]-t[1])*m.x)/det);};
 const frame={counts:{x:c.nodeCount},viewport:{w:0}};
 const api={heap,nodes,state,frame,NONE:0xffffffff,INF:1e7,VIEW_FEATURES:160,templateLink:()=>0,
  DS_RECORD:96,DS_NAME:64,DS_TEXT:512,DS_TRACK:52,DS_KEYS:12,DS_STATE:12,
  hf:i=>hf32[i],hsetf:(i,x)=>hf32[i]=x,sf:i=>sf32[i],setf:(i,x)=>sf32[i]=x,
  extension:n=>n.config.w,child:(n,j)=>heap[n.info.z+j],cs:i=>64+i*16,select:(a,b,c)=>c?b:a,
  degrees:x=>x*180/Math.PI,radians:x=>x*Math.PI/180,min:Math.min,max:Math.max,abs:Math.abs,floor:Math.floor,round:Math.round,fract:x=>x-Math.floor(x),clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),mix:(a,b,t)=>a+(b-a)*t,
  u32:x=>Math.max(0,Math.min(0xffffffff,Math.trunc(x)))>>>0,i32:x=>x|0,f32:Math.fround,toBits:fbits,fromBits,
  vec2f:(...args)=>vector(2,...args),vec2:(...args)=>vector(2,...args),vec3:(...args)=>vector(3,...args),vec4:(...args)=>vector(4,...args),
  transform,inverse,contentRect:n=>vector(4,n.rect.x+n.limits.z,n.rect.y+n.limits.z,n.rect.z-2*n.limits.z,n.rect.w-2*n.limits.z),
  eased:(t,mode)=>mode===0?t:mode===1?t*t*(3-2*t):mode===3?t*t*t:mode===4?1-(1-t)**3:t,
  dsGroup:()=>{throw new Error('Vector group operations require native gate');},dsAlign:()=>{throw new Error('Vector alignment requires native gate');},dsZoom:()=>{},dsFit:()=>{},
  contains:()=>false,visible:()=>true,boundsOf:r=>vector(4,r.x,r.y,r.x+r.z,r.y+r.w)};
 const kernel=new Function(...Object.keys(api),`let _;${code}\nreturn {${bodies.map(f=>f.name).join(',')}};`)(...Object.values(api));
 function update(){kernel.synchronizeDesigners({x:meta.node});for(let k=0;k<meta.capacity;k++){const i=meta.slots[k],r=kernel.dsRec(d,k);nodes[i].rect=vector(4,hf32[r+8],hf32[r+9],Math.max(1,hf32[r+10]),Math.max(1,hf32[r+11]));nodes[i].matrix=vector(4,1,0,0,1);nodes[i].translation=vector(4,0,0,1,0);kernel.animateDesigners({x:i});}return result;}
 const result={compiled:c,meta,d,heap,state,nodes,kernel,frame,update,rec:k=>kernel.dsRec(d,k),value:(k,f)=>hf32[kernel.dsRec(d,k)+f],raw:(k,f)=>heap[kernel.dsRec(d,k)+f],
  command(name,a=0,b=0,x=0,y=0){kernel.dsCommand(d,DesignCommand[name],a,b,x,y);return update();},
  select(k,add=false){kernel.dsSelect(d,k,add);return result;},
  text(value,name='text',field=0){const p=Array.from(value,c=>c.codePointAt(0));heap.set(p,meta.inbox);return result.command(name,field,p.length,1);},
  snapshot(){return decodeDesignSnapshot(heap.slice(meta.data,meta.data+meta.offsets.words),meta);}};
 update();return result;
}
