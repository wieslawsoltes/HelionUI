import {fbits,AUTO_TARGET} from '../core/schema.js';
/** Fixed-capacity GPU docking tree, references only retained child nodes. */
export function packDocks(heap,list,u){
 const result=[];
 for(const root of list.filter(n=>n.type==='DockWorkspace')){
  const panes=root.childIds.map(id=>list[id]);if(!panes.length||panes.length>16||panes.some(p=>p.type!=='DockItem'))throw new RangeError('DockWorkspace requires 1–16 direct DockItem children');
  const pointer=heap.alloc(16),tree=heap.alloc(31*12),paneList=heap.push(panes.map(p=>p.index));const ids=new Map(panes.map(p=>[p.id,p]));const used=new Set();const assigned=new Map();let count=0;
  const add=(node,parent=AUTO_TARGET)=>{if(count>=31)throw new RangeError('Dock tree exceeds 31 records');const index=count++,at=tree+index*12;
   if(node.type==='split'){const ratio=Number(node.ratio??.5);if(!['horizontal','vertical'].includes(node.orientation)||!Number.isFinite(ratio)||ratio<.1||ratio>.9)throw new RangeError('Invalid DockSplit');const first=add(node.first,index),second=add(node.second,index);heap.set(at,[1,parent,first,second,fbits(ratio),node.orientation==='vertical'?1:0,AUTO_TARGET]);}
   else if(node.type==='tabs'){if(!Array.isArray(node.panes))throw new TypeError('DockTabs panes required');const members=node.panes.map(id=>{if(!ids.has(id)||used.has(id))throw new TypeError(`Unknown/duplicate dock pane ${id}`);used.add(id);assigned.set(id,index);return ids.get(id);});const requested=node.active??members[0]?.id;const candidate=members.find(p=>p.id===requested);const active=candidate&&!candidate.props.closed?candidate:members.find(p=>!p.props.closed);if(members.length&&!candidate)throw new TypeError('Active pane must belong to its group');heap.set(at,[0,parent,0,0,0,0,active?.index??AUTO_TARGET]);}
   else throw new TypeError('Dock layout requires split or tabs');return index;};
  add(root.props.dockLayout??{type:'tabs',panes:panes.map(p=>p.id)});if(used.size!==panes.length)throw new TypeError('Every DockItem must occur exactly once in dockLayout');
  heap.set(pointer,[count,0,tree,panes.length,paneList,AUTO_TARGET,0,0,0,0,AUTO_TARGET,0,0,0,0,0]);u[root.index*72+68]=pointer;
  const manifest=[];for(const pane of panes){const p=heap.alloc(16);let end=pane.index+1;while(end<list.length&&list[end].depth>pane.depth)end++;const [title]=heap.string(pane.props.title??pane.id,0,true);
   heap.set(p,[root.index,assigned.get(pane.id),pane.props.closed?1:0,0,fbits(80),fbits(70),fbits(560),fbits(360),title,pane.props.canClose===false?0:1,end-pane.index,0,0,0,0,0]);u[pane.index*72+68]=p;manifest.push({node:pane.index,id:pane.id,pointer:p,subtreeNodes:end-pane.index});
  }result.push({node:root.index,pointer,tree,panes:manifest});
 }
 for(const pane of list.filter(n=>n.type==='DockItem'))if(pane.parent===AUTO_TARGET||list[pane.parent].type!=='DockWorkspace')throw new TypeError('DockItem must be a direct DockWorkspace child');
 return result;
}
