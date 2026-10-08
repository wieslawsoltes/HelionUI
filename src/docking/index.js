import {validateDockSnapshot} from './validation.js';
export function DockTabs(panes,active=panes[0]){if(!Array.isArray(panes))throw new TypeError('DockTabs requires pane IDs');return {type:'tabs',panes:[...panes],active};}
export function DockSplit(orientation,ratio,first,second){if(!['horizontal','vertical'].includes(orientation)||!(ratio>=.1&&ratio<=.9))throw new RangeError('DockSplit: horizontal/vertical, ratio .1.. .9');return {type:'split',orientation,ratio,first,second};}
export const DockCommand=Object.freeze({activate:0,close:1,reopen:2,float:3,dock:4,splitHorizontal:5,splitVertical:6,ratio:7,maximize:8});
export class DockController {
 constructor(surface,id){this.surface=surface;this.id=surface.id(id);this.meta=surface.manifest.docks?.find(d=>d.node===this.id);if(!this.meta)throw new TypeError('Expected a DockWorkspace');}
 command(name,pane,group=0){if(!(name in DockCommand))throw new TypeError(`Unknown dock command ${name}`);const node=this.surface.id(pane);if(!this.meta.panes.some(p=>p.node===node))throw new TypeError('Pane does not belong to workspace');this.surface.send(11,{target:this.id,c:DockCommand[name],a:node,b:group});return this;}
 async _snapshot(){const s=this.surface;const bytes=await s.readHeapRange(this.meta.pointer,16);const head=new Uint32Array(bytes);const records=new Uint32Array(await s.readHeapRange(this.meta.tree,31*12));const panes=[];for(const p of this.meta.panes){const words=new Uint32Array(await s.readHeapRange(p.pointer,16));const floats=new Float32Array(words.buffer);panes.push({id:p.id,group:words[1],closed:!!words[2],floating:!!words[3],bounds:Array.from(floats.slice(4,8))});}return {format:'helion-dock-layout-1',revision:head[13],root:head[1],nodes:Array.from({length:head[0]},(_,i)=>{const a=i*12;return {type:records[a],parent:records[a+1],first:records[a+2],second:records[a+3],ratio:new Float32Array(records.buffer)[a+4],axis:records[a+5],active:this.meta.panes.find(p=>p.node===records[a+6])?.id??null};}),panes};}
 async snapshot(){return this.surface.platformSnapshot(()=>this._snapshot());}
 async restore(layout){
  const value=validateDockSnapshot(layout,this.meta.panes.map(p=>p.id));const s=this.surface;
  return s.platformSnapshot(async()=>{
   const tree=new Uint32Array(31*12),tf=new Float32Array(tree.buffer);
   for(let i=0;i<value.nodes.length;i++){const node=value.nodes[i],at=i*12;tree.set([node.type,node.parent,node.first??0,node.second??0,0,node.axis??0,node.active==null?0xffffffff:s.id(node.active)],at);tf[at+4]=node.ratio||0;}
   const writes=[[this.meta.tree,tree],[this.meta.pointer,new Uint32Array([value.nodes.length,value.root])],[this.meta.pointer+5,new Uint32Array([0xffffffff])],[this.meta.pointer+10,new Uint32Array([0xffffffff,0,0])]];
   for(let i=0;i<value.panes.length;i++){const pane=value.panes[i],meta=this.meta.panes.find(p=>p.id===pane.id),a=new Uint32Array(7),f=new Float32Array(a.buffer);a.set([pane.group,Number(pane.closed),Number(pane.floating)]);f.set(pane.bounds,3);writes.push([meta.pointer+1,a],[meta.pointer+11,new Uint32Array([i+1])]);}
   writes.push([this.meta.pointer+14,new Uint32Array([value.panes.length])]);
   for(const [at,data]of writes){s.device.queue.writeBuffer(s.heapBuffer,at*4,data);s.stats.uploadedBytes+=data.byteLength;}
   // An ordered opcode invalidates GPU Measure/Arrange after the uploaded topology.
   s.send(11,{target:this.id,c:9,a:this.meta.panes[0].node});return this;
  });
 }

}
