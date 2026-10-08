import {packLayoutFont,packRun,packUnicode,normalizeTypography,packPlan} from './pack.js';
import {packNodeExtension} from '../core/extensions.js';
import {fbits} from '../core/schema.js';

/** Preparation only. Every mutable run has exclusive storage, even when template
 * parts alias a parent's immutable style or editable text. No CPU shaping here. */
export function packUITypography(heap,list,nodes,state,fonts,fontPointers,options={}) {
 const floats=new Float32Array(nodes.buffer,nodes.byteOffset,nodes.length),runs=[];
 const dynamic=new Set(), poolExtensions=new Map(), catalogs=new Map();
 for(const d of options.designers??[]){for(const i of d.slots)dynamic.add(i);for(const pool of d.templatePools??[]){for(const variant of pool.variants){const native=heap.words[variant],count=heap.words[variant+1];for(let j=0;j<count;j++){const kind=heap.words[native+j*72];if([5,6,7,9,21,36].includes(kind))dynamic.add(pool.parts[j]);const e=new Float32Array(heap.words.buffer)[native+j*72+47];if(!poolExtensions.has(pool.parts[j]))poolExtensions.set(pool.parts[j],[]);poolExtensions.get(pool.parts[j]).push(e);}}}}
 const eligible=new Set(['TextBlock','Button','CheckBox','TextBox','ContentPresenter','NativeContentPresenter']);
 // Extension addresses live in f32 node words. Allocate all potentially needed
 // extensions before large shaping arenas; their pointed-to directories are u32.
 for(const n of list){const t=n.typography,p=n.props;if(t.shaping==='simple')continue;
  const wants=dynamic.has(n.index)||n.type==='Drawing'||n.type==='TextBox'||n.type==='NativeContentPresenter'||(n.type==='DataGrid'&&t.shaping==='opentype')||((eligible.has(n.type))&&(t.shaping==='opentype'||t.shape.features!=null||t.shape.script!=null||t.shape.language!=null||t.shape.direction!=null||p.textCapacity!=null||p.templateExpressions?.text!=null||/[^\u0000-\u007f]/u.test(String(p.text??''))));
  const at=n.index*72+47;if(wants&&!floats[at])floats[at]=packNodeExtension(heap,{...p,textShaping:'opentype'},n.type,nodes,state,n.index);
 }
 let unicode=0;
 const initializeFaces=chain=>chain.map(font=>{const face=fontPointers.get(font);heap.set(face+13,[packLayoutFont(heap,font),unicode||(unicode=packUnicode(heap))]);return face;});
 const add=(n,offset,length,capacity,size,mode,record=0)=>{
  const t=n.typography,chain=fonts;const faces=initializeFaces(chain);const run=packRun(heap,chain,faces,'',{
   ...t.shape,kerning:t.kerning,ligatures:t.ligatures,inputCapacity:capacity,capacity:Math.max(32,capacity*3),fontSize:size,
   lineHeight:t.lineHeight,letterSpacing:t.spacing,alignment:t.alignment,wrap:false,operationBudget:options.typographyOperationBudget??4000000
  });
  const key=JSON.stringify(t.shape);let catalog=catalogs.get(key);if(!catalog){catalog=heap.push([chain.length,...chain.flatMap((font,j)=>[faces[j],...Array.from({length:4},(_,flags)=>packPlan(heap,font,normalizeTypography({...t.shape,kerning:!!(flags&1),ligatures:!!(flags&2)})))])]);catalogs.set(key,catalog);}
  heap.set(run.pointer+52,[catalog,chain.length,0xffffffff]);const kern=normalizeTypography(t.shape).features.kern;heap.set(run.pointer+56,[kern==null?0:kern===0?1:2]);
  const source=heap.push([n.index,mode,offset,length,mode===1?fbits(size):0,record,0,0]);heap.set(run.pointer+63,[source]);heap.set(run.pointer+40,[n.index]);
  // The first synchronization copies from the actual retained string, including
  // TemplateBinding aliases applied later than initial packing.
  heap.set(run.pointer+4,[0]);heap.set(run.pointer+5,[0xffffffff]);
  runs.push({...run,node:n.index,source,mode});return run.pointer;
 };
 for(const n of list){const p=n.props,t=n.typography,mode=t.shaping;
  if(!['auto','simple','opentype'].includes(mode))throw new TypeError('textShaping must be auto, simple or opentype');
  // Validate feature selection even on a string that currently takes the simple path.
  normalizeTypography(t.shape);
  if(p.shapingCapacity!=null&&(!Number.isInteger(p.shapingCapacity)||p.shapingCapacity<1||p.shapingCapacity>4096))throw new RangeError('shapingCapacity must be 1–4096');
  if(mode==='simple')continue;
  const o=n.index*72,records=[];let gridMap=0;
  if(dynamic.has(n.index)||(eligible.has(n.type)&&!(n.type==='ContentPresenter'&&n.childIds.length))){
   const owner=n.props.templatePart?.owner?list.find(x=>x.id===n.props.templatePart.owner):n;
   const mutable=dynamic.has(n.index)||n.type==='TextBox'||owner?.type==='TextBox'||p.textCapacity!=null||p.templateExpressions?.text!=null;
   const text=String(owner?.props.text??p.text??'');
   const explicit=mode==='opentype'||t.shape.features!=null||t.shape.script!=null||t.shape.language!=null||t.shape.direction!=null;
   if(mutable||explicit||/[^\u0000-\u007f]/u.test(text)){
    const initial=Array.from(text).length;
    const capacity=Math.max(dynamic.has(n.index)?256:16,initial,n.type==='TextBox'||owner?.type==='TextBox'?options.textCapacity??256:p.textCapacity??(p.templateExpressions?.text?256:0),p.shapingCapacity??0);
    if(capacity>4096)throw new RangeError('UI shaping is bounded to 4096 scalars per string; use the standalone paragraph API for larger runs');
    records.push(add(n,nodes[o+6],nodes[o+7],capacity,t.size,0));
   }
  }
  // Explicit complex-text tables reserve a rolling 128-row cache, not one
  // glyph run for every record. Sorting/filtering changes its source on-device.
  if(n.type==='DataGrid'&&mode==='opentype'){
   const table=nodes[o+39],columns=heap.words[table+2],defs=heap.words[table+9];gridMap=heap.alloc(129*8);
   const capacity=p.shapingCapacity??96;
   for(let col=0;col<columns;col++){
    const c=defs+col*8,headerLength=heap.words[c+1];
    const header=add(n,heap.words[c],headerLength,Math.max(16,headerLength),Math.max(1,t.size-.5),3,c);records.push(header);heap.words[gridMap+col]=header;
    if(heap.words[c+2]!==0)continue;
    for(let slot=0;slot<128;slot++){const run=add(n,0,0,capacity,t.size,2,col);const src=heap.words[run+63];heap.words[src+6]=slot;records.push(run);heap.words[gridMap+(slot+1)*8+col]=run;}
   }
  }
  if(n.type==='Drawing'){
   const base=nodes[o+68],commands=heap.words[base],count=heap.words[base+1];
   for(let j=0;j<count;j++){const c=commands+j*24;if(heap.words[c]!==2)continue;const offset=heap.words[c+5],length=heap.words[c+6];
    const isUnicode=heap.words.subarray(offset,offset+length).some(v=>v>127);
    if(mode==='opentype'||isUnicode||t.shape.features!=null||t.shape.direction!=null){
     if(length>4096)throw new RangeError('Drawing text shaping is bounded to 4096 scalars');
     const size=new Float32Array(heap.words.buffer)[c+7];records.push(add(n,offset,length,Math.max(16,length),size,1,c));
    }
   }
  }
  if(records.length){let e=floats[o+47];if(!e){e=packNodeExtension(heap,{...p,textShaping:'opentype'},n.type,nodes,state,n.index);floats[o+47]=e;}const directory=heap.push([records.length,...records,gridMap]);heap.set(e+39,[directory]);for(const variantExtension of poolExtensions.get(n.index)??[])heap.set(variantExtension+39,[directory]);}
 }
 if(runs.length){const directory=heap.push(runs.map(r=>r.pointer));heap.set(0,[directory,runs.length,unicode,0x48545931]);}
 return runs;
}
