/** Validate a saved topology before any GPU write. No mutable CPU layout mirror. */
export function validateDockSnapshot(value, paneIds) {
  if(value?.format!=='helion-dock-layout-1'||!Array.isArray(value.nodes)||!Array.isArray(value.panes))throw new TypeError('Invalid docking snapshot');
  const n=value.nodes.length;if(n<1||n>31||!Number.isInteger(value.root)||value.root<0||value.root>=n)throw new RangeError('Invalid docking root/capacity');
  const expected=new Set(paneIds),seenPanes=new Set(),seen=new Set();
  const walk=(index,parent,depth)=>{
    if(!Number.isInteger(index)||index<0||index>=n||seen.has(index)||depth>30)throw new TypeError('Cyclic/duplicate docking topology');
    seen.add(index);const node=value.nodes[index];if(node.parent!==parent||![0,1].includes(node.type))throw new TypeError('Invalid docking parent/type');
    if(node.type===1){if(![0,1].includes(node.axis)||!Number.isFinite(node.ratio)||node.ratio<.1||node.ratio>.9)throw new RangeError('Invalid split ratio/axis');walk(node.first,index,depth+1);walk(node.second,index,depth+1);}
    else if(node.active!=null&&!expected.has(node.active))throw new TypeError('Unknown active pane');
  };
  walk(value.root,0xffffffff,0);if(seen.size!==n)throw new TypeError('Unreachable docking records');
  for(const pane of value.panes){if(!expected.has(pane.id)||seenPanes.has(pane.id))throw new TypeError('Unknown/duplicate pane');seenPanes.add(pane.id);
    if(!Number.isInteger(pane.group)||pane.group<0||pane.group>=n||value.nodes[pane.group].type!==0)throw new TypeError('Pane group must be a leaf');
    if(typeof pane.closed!=='boolean'||typeof pane.floating!=='boolean'||!Array.isArray(pane.bounds)||pane.bounds.length!==4||!pane.bounds.every(v=>Number.isFinite(v)&&v>=0&&v<=1e7)||pane.bounds[2]<160||pane.bounds[3]<100)throw new RangeError('Invalid floating rectangle/flags');
  }
  if(seenPanes.size!==expected.size)throw new TypeError('Snapshot must contain every pane');
  for(let i=0;i<n;i++){const node=value.nodes[i];if(node.type===0&&node.active!=null){const p=value.panes.find(p=>p.id===node.active);if(p.group!==i||p.closed||p.floating)throw new TypeError('Active pane must be open and docked in its leaf');}}
  return structuredClone(value);
}
