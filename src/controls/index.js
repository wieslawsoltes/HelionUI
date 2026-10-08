import {h} from '../core/declaration.js';
import {Opcode,AUTO_TARGET} from '../core/schema.js';
export const ACTION_EVENT_CAPACITY=520;
export const ACTION_OUTBOX_BYTES=16+ACTION_EVENT_CAPACITY*24;
export function hostAction(name,value=0){if(typeof name!=='string'||!name||name.length>128||!Number.isFinite(value))throw new TypeError('Host action requires a name and finite argument');return {type:'host',name,value};}
export const Toolbar=(props,...children)=>h('ScrollViewer',{height:40,...props},h('StackPanel',{orientation:'horizontal',gap:6,padding:4},...children));
export const StatusBar=(props,...children)=>h('Grid',{height:28,columns:'* auto',...props},...children);
export const Menu=(props)=>h('ListBox',{rowHeight:32,...props});
export const ToggleButton=(props)=>h('CheckBox',{height:34,...props});
export const Separator=(props)=>h('Border',{width:1,background:'#304358',...props});
export const Popup=(props,...children)=>h('Border',{zIndex:1000,background:'#172637',borderColor:'#3b5970',borderWidth:1,radius:10,padding:16,...props},...children);
export function Dialog(props={},...children){const {width=560,height=420,padding=20,background='#172637',...root}=props;return h('Modal',{background:'#00000088',zIndex:1000,...root},h('Border',{width,height,padding,background,radius:10,borderWidth:1,borderColor:'#3b5970',horizontalAlignment:'center',verticalAlignment:'center'},...children));}
/** Flatten a tree once at ingestion. Expansion, selection and visible indexing live on-device. */
export function normalizeItems(items,{capacity=256,textCapacity=32768}={}){
 if(!Array.isArray(items)||!Number.isInteger(capacity)||capacity<1||capacity>4096||!Number.isInteger(textCapacity)||textCapacity<1||textCapacity>1048576)throw new TypeError('Invalid list capacity or items');
 const result=[],keys=new Set(),explicit=new Set();let chars=0,nextKey=0,scanned=0;
 function scan(item,depth=0){if(++scanned>capacity||depth>31)throw new RangeError('List capacity/tree depth exceeded');if(typeof item==='string')return;if(!item||typeof item!=='object')throw new TypeError('Invalid list item');if(item.key!=null){if(!Number.isInteger(item.key)||item.key<0||item.key>=AUTO_TARGET||explicit.has(item.key))throw new TypeError('List keys must be unique unsigned integers');explicit.add(item.key);}if(item.children!=null){if(!Array.isArray(item.children))throw new TypeError('children must be an array');for(const child of item.children)scan(child,depth+1);}}
 for(const item of items)scan(item);
 const allocateKey=()=>{while(explicit.has(nextKey)||keys.has(nextKey))nextKey++;return nextKey++;};
 function visit(item,parent=AUTO_TARGET,depth=0){if(typeof item==='string')item={label:item};if(!item||depth>31)throw new TypeError('Invalid item/tree depth');const index=result.length,key=item.key??allocateKey();if(!Number.isInteger(key)||key<0||key>=AUTO_TARGET||keys.has(key))throw new TypeError('List keys must be unique unsigned integers');keys.add(key);const text=Array.from(String(item.label??item.text??''),c=>c.codePointAt(0));if(text.some(c=>c>=0xd800&&c<=0xdfff))throw new TypeError('Invalid Unicode scalar');chars+=text.length;if(result.length>=capacity||chars>textCapacity)throw new RangeError('List capacity exceeded');const children=item.children??[];if(!Array.isArray(children))throw new TypeError('children must be an array');result.push({key,text,parent,depth,flags:(children.length?1:0)|(item.expanded===false?0:2)|(item.disabled?4:0)});for(const child of children)visit(child,index,depth+1);}
 for(const item of items)visit(item);return {items:result,chars};
}
export function encodeListItems(items,limits){const value=normalizeItems(items,limits),n=value.items.length,words=new Uint32Array(4+n*8+value.chars);words.set([1,n,value.chars,words.length]);let at=4+n*8;value.items.forEach((r,k)=>{words.set([r.key,at,r.text.length,r.parent,r.depth,r.flags,0,0],4+k*8);words.set(r.text,at);at+=r.text.length;});return words;}
export class ListController{
 constructor(surface,name){this.surface=surface;this.id=surface.id(name);this.meta=surface.manifest.lists?.find(x=>x.node===this.id);if(!this.meta)throw new TypeError('Expected ListBox/TreeView');}
 replace(items){const data=encodeListItems(items,this.meta);this.surface.commands.pushBulk(Opcode.Controls,{target:this.id,c:2,a:data.length},data,this.meta.inbox);this.wake();return this;}
 select(key){return this.keyCommand(3,key);}
 toggle(key){return this.keyCommand(4,key);}
 keyCommand(code,key){if(!Number.isInteger(key)||key<0||key>=AUTO_TARGET)throw new TypeError('Invalid item key');this.surface.commands.pushBulk(Opcode.Controls,{target:this.id,c:code,a:1},new Uint32Array([key]),this.meta.inbox);this.wake();return this;}
 wake(){if(this.surface.running||this.surface.options.autoStart!==false)this.surface.invalidate();}
 async snapshot(){return this.surface.platformSnapshot(async()=>{const d=new Uint32Array(await this.surface.readHeapRange(this.meta.pointer,24));return {count:d[0],visibleCount:d[7],selectedKey:d[9]===AUTO_TARGET?null:d[9],revision:d[14],rejectedUpdates:d[17]};});}
}
/** Event-driven GPU action readback, never an idle-frame/control-state poll. */
export class ActionBridge{
 constructor(surface){this.surface=surface;this.pending=new Set();this.delivery=Promise.resolve();}
 encode(encoder,packet){const s=this.surface;if(!s.options.onAction||!s.manifest.actionOutbox||!packet.actionCandidate)return null;const size=ACTION_OUTBOX_BYTES;const buffer=s.device.createBuffer({label:'Explicit input-action outbox snapshot',size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});encoder.copyBufferToBuffer(s.heapBuffer,s.manifest.actionOutbox*4,buffer,0,size);this.pending.add(buffer);return buffer;}
 submitted(buffer){if(!buffer)return;const s=this.surface;const read=buffer.mapAsync(GPUMapMode.READ).then(()=>{s.stats.actionReadbackBytes=(s.stats.actionReadbackBytes??0)+buffer.size;s.stats.readbackBytes+=buffer.size;return new Uint32Array(buffer.getMappedRange().slice(0));});read.catch(()=>{});
 this.delivery=this.delivery.then(async()=>{const words=await read;if(s.disposed)return;if(words[1])s.options.onDiagnosticsError?.(new Error('GPU action outbox overflow'));for(let k=0;k<Math.min(ACTION_EVENT_CAPACITY,words[0]);k++){const o=4+k*6,name=s.manifest.hostActions[words[o]-1];if(name){try{Promise.resolve(s.options.onAction({name,target:words[o+1],sequence:words[o+2],value:new Float32Array(words.buffer)[o+3],key:words[o+4],frame:words[o+5]})).catch(error=>s.options.onDiagnosticsError?.(error));}catch(error){s.options.onDiagnosticsError?.(error);}}}}).catch(error=>{if(!s.disposed)s.options.onDiagnosticsError?.(error);}).finally(()=>{buffer.destroy();this.pending.delete(buffer);if(!s.disposed&&(s.running||s.commands.length))s.invalidate();});}
 cancel(buffer){if(buffer){buffer.destroy();this.pending.delete(buffer);}}
 dispose(){for(const b of this.pending)b.destroy();this.pending.clear();}
}
