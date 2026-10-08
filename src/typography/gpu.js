import {Run,GLYPH_WORDS} from './schema.js';
import {scalarText} from './pack.js';
import {normalizeParagraph,Paragraph,LINE_WORDS,POSITION_WORDS} from './layout.js';
const SOURCES=['unicode','shaping','shaping-bidi','paragraph'];
export async function typographyShaderSource(){
 const pieces=await Promise.all(SOURCES.map(async name=>{
  const bank=globalThis.__HELION_SHADERS__;
  const embedded=bank?.[name]??bank?.[name+'.wgsl']??bank?.[`shaders/${name}.wgsl`];
  if(typeof embedded==='string')return embedded;
  const response=await fetch(new URL(`../../shaders/${name}.wgsl`,import.meta.url));
  if(!response.ok)throw new Error(`Typography shader ${name}: HTTP ${response.status}`);return response.text();
 }));
 return `struct TypographyParameters {directory:u32,count:u32,first:u32,reserved:u32}
@group(0) @binding(0) var<storage,read_write> heap:array<u32>;
@group(0) @binding(1) var<uniform> typographyParameters:TypographyParameters;
fn hf(p:u32)->f32{return bitcast<f32>(heap[p]);}
fn hsetf(p:u32,x:f32){heap[p]=bitcast<u32>(x);}
${pieces.join('\n')}
@compute @workgroup_size(32) fn shapeRuns(@builtin(global_invocation_id) id:vec3<u32>){if(id.x<typographyParameters.count){shapeRun(heap[typographyParameters.directory+typographyParameters.first+id.x]);}}
@compute @workgroup_size(32) fn layoutRuns(@builtin(global_invocation_id) id:vec3<u32>){if(id.x<typographyParameters.count){layoutRun(heap[typographyParameters.directory+typographyParameters.first+id.x]);}}`;
}
/** Decode an explicit snapshot. Never used to populate UI text or schedule frames. */
export function decodeTypography(heap,run){
 const p=run.pointer;if(!(heap instanceof Uint32Array)||p+64>heap.length)throw new TypeError('Invalid typography heap snapshot');
 const floats=new Float32Array(heap.buffer,heap.byteOffset,heap.length),count=heap[p+Run.count],length=heap[p+Run.length];
 const range=(at,n)=>{if(!Number.isSafeInteger(at)||at<0||at+n>heap.length)throw new RangeError('Corrupt typography range');return at;};
 if(count>run.capacity||length>run.inputCapacity)throw new RangeError('Corrupt typography counts');
 const records=range(heap[p+Run.glyphs],count*GLYPH_WORDS),order=range(heap[p+Run.order],count),boundary=range(heap[p+Run.boundaries],length+1),caret=range(heap[p+Run.carets],(length+1)*2);
 const glyphs=[];for(let v=0;v<count;v++){const logical=heap[order+v];if(logical>=count)throw new RangeError('Corrupt glyph order');const g=records+logical*GLYPH_WORDS;glyphs.push({id:heap[g],cluster:heap[g+1],clusterEnd:heap[g+2],codepoint:heap[g+3],face:heap[g+4],level:heap[g+6],advanceX:floats[g+8],advanceY:floats[g+9],offsetX:floats[g+10],offsetY:floats[g+11],x:floats[g+12],y:floats[g+13],hidden:(heap[g+19]&1)!==0,logicalIndex:logical});}
 const boundaries=[];for(let i=0;i<=length;i++)if(heap[boundary+i])boundaries.push(i);
 const carets=Array.from({length:length+1},(_,i)=>({leading:floats[caret+i*2],trailing:floats[caret+i*2+1]}));
 let paragraph=null;const l=heap[p+Run.layout];if(l){range(l,32);const n=heap[l+Paragraph.lineCount];if(n>run.capacity+1)throw new RangeError('Corrupt paragraph lines');
  const lines=range(heap[l+Paragraph.lines],n*LINE_WORDS),positions=range(heap[l+Paragraph.positions],count*POSITION_WORDS),visual=range(heap[l+Paragraph.order],count),pc=range(heap[l+Paragraph.carets],(length+1)*4);
  paragraph={valid:heap[l+Paragraph.valid]===1,width:floats[l+Paragraph.measuredWidth],height:floats[l+Paragraph.measuredHeight],fontSize:floats[l+Paragraph.fontSize],lineCount:n,
   lines:Array.from({length:n},(_,j)=>{const x=lines+j*LINE_WORDS;return {glyphStart:heap[x],glyphEnd:heap[x+1],start:heap[x+2],end:heap[x+3],level:heap[x+4],x:floats[x+5],width:floats[x+6],top:floats[x+7],baseline:floats[x+8],height:floats[x+9],ascent:floats[x+10],descent:floats[x+11]};}),
   positions:Array.from({length:count},(_,j)=>{const x=positions+j*4;return {x:floats[x],y:floats[x+1],advance:floats[x+2],line:heap[x+3]};}),
   visualOrder:Array.from(heap.subarray(visual,visual+count)),
   carets:Array.from({length:length+1},(_,j)=>({leading:[floats[pc+j*4],floats[pc+j*4+1]],trailing:[floats[pc+j*4+2],floats[pc+j*4+3]]}))};
 }
 return {valid:heap[p+Run.valid]===1,errors:heap[p+Run.errors],warnings:heap[p+Run.featureWarnings]&0xfffffffe,revision:heap[p+Run.revision],processedRevision:heap[p+Run.completed],shapeCount:heap[p+Run.shapes],operations:heap[p+Run.steps],advance:floats[p+Run.advance],ascent:floats[p+Run.ascent],descent:floats[p+Run.descent],lineCount:heap[p+Run.lineCount],paragraphLevel:heap[p+Run.paragraphLevel],glyphs,boundaries,carets,paragraph};
}
/** Snapshot only mutable output for one run; no raw font tables or outlines. */
export function typographyReadbackPlan(run){
 const ranges=[];let words=4;const add=(name,source,length)=>{const item={name,source,destination:words,length};ranges.push(item);words+=length;return item;};
 add('run',run.pointer,64);add('glyphs',run.glyphs,run.capacity*20);add('boundaries',run.boundaries,run.inputCapacity+1);add('order',run.order,run.capacity);add('carets',run.carets,(run.inputCapacity+1)*2);
 add('layout',run.layout,32);add('lines',run.lineRecords,(run.capacity+1)*12);add('positions',run.positions,run.capacity*4);add('visualOrder',run.visualOrder,run.capacity);add('paragraphCarets',run.paragraphCarets,(run.inputCapacity+1)*4);
 return {ranges,bytes:words*4};
}
function relocateSnapshot(words,run,plan){const at=Object.fromEntries(plan.ranges.map(r=>[r.name,r.destination])),p=at.run,l=at.layout;
 for(const name of ['glyphs','boundaries','order','carets','layout'])words[p+Run[name]]=at[name];
 for(const [name,key] of [['lines','lines'],['positions','positions'],['visualOrder','order'],['paragraphCarets','carets']])words[l+Paragraph[key]]=at[name];
 return decodeTypography(words,{...run,pointer:p});
}
const bits=value=>new Uint32Array(new Float32Array([value]).buffer)[0];
/** Owns buffers, never the caller's device or frame scheduler. All mutation
 * methods enqueue data; encode() neither submits nor performs any readback. */
export class GpuTypography{
 static async create(device,prepared,{source}={}){
  if(!device?.queue||prepared?.version!==1||!(prepared.heap instanceof Uint32Array))throw new TypeError('A WebGPU device and prepared typography are required');
  if(prepared.heap.byteLength>(device.limits?.maxStorageBufferBindingSize??Infinity))throw new RangeError('Typography heap exceeds device storage binding limit');
  const self=new GpuTypography();self.device=device;const {heap,...metadata}=prepared;
  self.prepared=structuredClone(metadata);self.revisions=prepared.runs.map(()=>1);self.layoutRevisions=prepared.runs.map(()=>1);self.disposed=false;self.readbackBytes=0;
  try{
   self.heap=device.createBuffer({label:'Typography retained heap',size:heap.byteLength,usage:128|8|4});
   self.parameters=device.createBuffer({label:'Typography run dispatch',size:16,usage:64|8});
   device.queue.writeBuffer(self.heap,0,heap);device.queue.writeBuffer(self.parameters,0,new Uint32Array([prepared.directory,prepared.runs.length,0,0]));
   const module=device.createShaderModule({label:'Helion retained typography',code:source??await typographyShaderSource()});
   const info=await module.getCompilationInfo(),errors=info.messages.filter(m=>m.type==='error');if(errors.length)throw new Error(errors.map(e=>`${e.lineNum}:${e.linePos}: ${e.message}`).join('\n'));
   self.pipelines=[];self.bindGroups=[];
   for(const entryPoint of ['shapeRuns','layoutRuns']){const pipeline=await device.createComputePipelineAsync({label:'Typography '+entryPoint,layout:'auto',compute:{module,entryPoint}});self.pipelines.push(pipeline);self.bindGroups.push(device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:self.heap}},{binding:1,resource:{buffer:self.parameters}}]}));}
   return self;
  }catch(error){self.dispose();throw error;}
 }
 assertActive(){if(this.disposed)throw new Error('Typography instance has been disposed');}
 run(index){this.assertActive();if(!Number.isInteger(index)||index<0||index>=this.prepared.runs.length)throw new RangeError('Invalid run index');return this.prepared.runs[index];}
 updateText(index,text){const run=this.run(index),codes=scalarText(text);if(codes.length>run.inputCapacity)throw new RangeError('Text exceeds retained input capacity');const revision=((this.revisions[index]+1)>>>0)||1;this.revisions[index]=revision;const q=this.device.queue;if(codes.length)q.writeBuffer(this.heap,run.input*4,new Uint32Array(codes));q.writeBuffer(this.heap,(run.pointer+Run.length)*4,new Uint32Array([codes.length,revision,0]));return this;}
 updateLayout(index,options){const run=this.run(index);if(!options||typeof options!=='object')throw new TypeError('Paragraph options required');
  const allowed=['width','fontSize','lineHeight','letterSpacing','alignment','textAlignment','wrap','tabSize'];for(const key of Object.keys(options))if(!allowed.includes(key))throw new TypeError('Unknown paragraph option '+key);
  const merged={...run.paragraph,...options};if(Object.hasOwn(options,'textAlignment')&&!Object.hasOwn(options,'alignment'))merged.alignment=options.textAlignment;const value=normalizeParagraph(merged);run.paragraph=value;const revision=((this.layoutRevisions[index]+1)>>>0)||1;this.layoutRevisions[index]=revision;const q=this.device.queue;
  q.writeBuffer(this.heap,run.layout*4,new Uint32Array([bits(value.width),bits(value.fontSize),bits(value.lineHeight),bits(value.letterSpacing),['left','center','right','start','end'].indexOf(value.alignment),['none','word','character'].indexOf(value.wrap),revision]));
  q.writeBuffer(this.heap,(run.layout+18)*4,new Uint32Array([value.tabSize]));return this;
 }
 setDirection(index,direction){const run=this.run(index);const code=['auto','ltr','rtl'].indexOf(direction);if(code<0)throw new TypeError('Invalid direction');run.config.direction=direction;this.device.queue.writeBuffer(this.heap,(run.pointer+17)*4,new Uint32Array([code]));this.revisions[index]=((this.revisions[index]+1)>>>0)||1;this.device.queue.writeBuffer(this.heap,(run.pointer+4)*4,new Uint32Array([this.revisions[index]]));return this;}
 encode(encoder,{layout=true}={}){this.assertActive();const pass=encoder.beginComputePass({label:'Typography retained runs'});for(let i=0;i<(layout?2:1);i++){pass.setPipeline(this.pipelines[i]);pass.setBindGroup(0,this.bindGroups[i]);pass.dispatchWorkgroups(Math.ceil(this.prepared.runs.length/32));}pass.end();return this;}
 get output(){this.assertActive();return Object.freeze({buffer:this.heap,directory:this.prepared.directory,count:this.prepared.runs.length,glyphStrideBytes:80,runStrideBytes:256,lineStrideBytes:48,positionStrideBytes:16,runs:structuredClone(this.prepared.runs)});}
 async snapshot(index=0){const run=this.run(index),plan=typographyReadbackPlan(run);const read=this.device.createBuffer({label:'Explicit typography run snapshot',size:plan.bytes,usage:1|8});
  try{const encoder=this.device.createCommandEncoder();for(const r of plan.ranges)encoder.copyBufferToBuffer(this.heap,r.source*4,read,r.destination*4,r.length*4);this.device.queue.submit([encoder.finish()]);await read.mapAsync(1);const words=new Uint32Array(read.getMappedRange()).slice();read.unmap();this.readbackBytes+=plan.bytes;return relocateSnapshot(words,run,plan);}finally{read.destroy();}
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.heap?.destroy();this.parameters?.destroy();}
}
