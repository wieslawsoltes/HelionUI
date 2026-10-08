/** Serializable typed GPU model declarations, not JavaScript objects kept in sync. */
const types=new Set(['f32','u32','i32','bool']);
export function field(type='f32',initial=0){if(!types.has(type))throw new TypeError('Field type: f32/u32/i32/bool');return {type,initial};}
export function computed(type,value){if(!types.has(type))throw new TypeError('Invalid computed type');return {type,expression:value};}
export const ref=name=>({op:'field',name});
const binary=['add','sub','mul','div','min','max','lt','le','gt','ge','eq','and','or'];
const unary=['neg','abs','sin','cos','sqrt','floor','ceil','round','not'];
export const expr=Object.freeze({ref,arg:()=>({op:'arg'}),...Object.fromEntries(binary.map(op=>[op,(a,b)=>({op,args:[a,b]})])),...Object.fromEntries(unary.map(op=>[op,a=>({op,args:[a]})])),clamp:(a,lo,hi)=>({op:'clamp',args:[a,lo,hi]}),select:(condition,yes,no)=>({op:'select',args:[condition,yes,no]})});
export function defineModel(fields,{count=1,commands={}}={}){return {format:'helion-gpu-model-1',fields,count,commands};}
export const defineViewModel=defineModel;
export function modelBinding(model,field,options={}){return {model,field,...options};}
export class ModelController{
 constructor(surface,name){this.surface=surface;this.meta=surface.manifest.models?.find(m=>m.name===name);if(!this.meta)throw new ReferenceError(`Unknown model ${name}`);}
 set(field,value,row=0){const f=this.meta.fields.find(f=>f.name===field);if(!f||f.computed)throw new TypeError('Set requires a writable field');this.check(row);const v=Number(value);if(!Number.isFinite(v)||!Number.isFinite(Math.fround(v)))throw new RangeError('Non-finite field value');if(f.type==='bool'&&![0,1].includes(v)||f.type==='u32'&&(!Number.isInteger(v)||v<0||v>16777216)||f.type==='i32'&&(!Number.isInteger(v)||Math.abs(v)>16777216))throw new RangeError('Command integer values must be exact f32 integers');this.surface.send(12,{target:0,x:this.meta.index,y:row,a:v,b:f.index,c:0});return this;}
 execute(name,arg=0,row=0){this.check(row);if(!Number.isFinite(Number(arg))||!Number.isFinite(Math.fround(Number(arg))))throw new TypeError('Finite command argument required');const n=this.meta.commands.indexOf(name);if(n<0)throw new ReferenceError(`Unknown model command ${name}`);this.surface.send(12,{target:0,x:this.meta.index,y:row,a:Number(arg),c:n+1});return this;}
 check(row){if(!Number.isInteger(row)||row<0||row>=this.meta.count)throw new RangeError('Model row out of range');}
 async snapshot({start=0,count=this.meta.count-start}={}){this.check(start);if(!Number.isInteger(count)||count<0||count>this.meta.count-start)throw new RangeError('Invalid snapshot range');return this.surface.platformSnapshot(async()=>{const result={};for(const f of this.meta.fields){const bytes=await this.surface.readHeapRange(f.data+start,count);const a=f.type==='f32'?new Float32Array(bytes):f.type==='i32'?new Int32Array(bytes):new Uint32Array(bytes);result[f.name]=f.type==='bool'?Array.from(a,Boolean):Array.from(a);}const header=new Uint32Array(await this.surface.readHeapRange(this.meta.pointer,16));const errors=new Uint32Array(await this.surface.readHeapRange(header[10]+start,count));const revisions=new Uint32Array(await this.surface.readHeapRange(header[9]+start,count));return {name:this.meta.name,start,count,fields:result,errors:Array.from(errors),revisions:Array.from(revisions)};});}
}
