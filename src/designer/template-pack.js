import {Kind,fbits} from '../core/schema.js';
import {DESIGN_TEMPLATE_PARTS} from './template-catalog.js';
/** Prepare immutable native blueprints and bounded reusable GPU part slots.
 * The CPU never selects live instances. Selection, allocation/reuse and undo run
 * in rankTemplateTree's ordered GPU setup, before layout and binding evaluation.
 */
export function packDesignerTemplates(heap,list,nodes,state,designers,templateData,resolve){
 const nf=new Float32Array(nodes.buffer);
 for(const d of designers){if(!d.templates?.length)continue;
  const ownerName=list[d.node].id;const prototypes=d.templates.map((t,index)=>{const owner=resolve(`${ownerName}::prototype-${index}`);const info=templateData.templates.find(t=>t.owner===owner);if(!info)throw new Error('Missing prepared designer template');return info;});
  const catalog=heap.push(prototypes.flatMap(p=>[Kind[p.targetType],p.parts.length,p.owner,0]));
  const records=heap.alloc(d.templateCapacity*8),directory=heap.push([prototypes.length,d.templateCapacity,catalog,records,d.node,DESIGN_TEMPLATE_PARTS,0,0]);heap.words[d.pointer+118]=directory;
  d.templateDirectory=directory;d.templatePools=[];
  for(let pool=0;pool<d.templateCapacity;pool++){
   const partIDs=Array.from({length:DESIGN_TEMPLATE_PARTS},(_,j)=>resolve(`${ownerName}::template-pool-${pool}-${j}`));const idsPointer=heap.push(partIDs),variants=[];
   for(const [templateIndex,p]of prototypes.entries()){
    const remap=new Map(p.parts.map((id,j)=>[id,partIDs[j]]));remap.set(p.owner,0xffffffff);
    const native=[],controlState=[];let inheritFonts=0;
    for(const [ordinal,id]of p.parts.entries()){
     const words=Array.from(nodes.slice(id*72,id*72+72));const floats=new Float32Array(Uint32Array.from(words).buffer);const sourceExtension=nf[id*72+47];
     const extension=heap.push(Array.from(heap.words.slice(sourceExtension,sourceExtension+40)));const oldLink=heap.words[sourceExtension+36];
     const link=heap.push([0xffffffff,heap.words[oldLink+1],ordinal,heap.words[oldLink+3]]);heap.words[extension+36]=link;heap.words[extension+34]=d.pointer;heap.words[extension+35]=0xffffffff;heap.words[extension+38]=0;
     if(heap.words[extension+25]){const count=heap.words[extension+25],ptr=heap.words[extension+24];heap.words[extension+24]=heap.push(Array.from(heap.words.slice(ptr,ptr+count*16)));}
     words[1]=remap.get(words[1])??words[1];const children=Array.from({length:words[3]},(_,j)=>remap.get(heap.words[words[2]+j]));if(children.some(x=>x==null))throw new Error('Designer template children must belong to their namescope');words[2]=heap.push(children.length?children:[0]);
     // Grid tracks contain arranged sizes, so each instance/variant owns them.
     for(const axis of [28,30])if(words[axis]&&words[axis+1]){const ptr=words[axis],length=words[axis+1]*4;words[axis]=heap.push(Array.from(heap.words.slice(ptr,ptr+length)));}
     words[47]=fbits(extension);
     if(words[40]!==0xffffffff&&remap.has(words[40]))words[40]=remap.get(words[40]);if(words[37]!==0xffffffff&&remap.has(words[37]))words[37]=remap.get(words[37]);
     native.push(...words);controlState.push(...state.slice(64+id*16,64+id*16+16));
     // Explicit font overrides remain in the blueprint; other glyphs use the owner face.
     const original=partByOrdinal(d.templates[templateIndex].root,ordinal);if(!['fontFamily','fontWeight','fontStyle','FontFamily','FontWeight','FontStyle'].some(k=>original?.props?.[k]!=null))inheritFonts|=1<<ordinal;
    }
    const info=heap.push(Array.from(heap.words.slice(p.pointer,p.pointer+20)));heap.words[info]=0xffffffff;heap.words[info+1]=remap.get(p.root);heap.words[info+9]=remap.get(p.native)??0xffffffff;heap.words[info+12]=remap.get(p.content)??0xffffffff;heap.words[info+13]=heap.push(p.parts.map(id=>remap.get(id)));heap.words[info+15]=d.pointer;heap.words[info+16]=0xffffffff;
    const originalGroups=heap.words[p.pointer+4],groupCount=heap.words[p.pointer+5];if(groupCount)heap.words[info+4]=heap.push(Array.from(heap.words.slice(originalGroups,originalGroups+groupCount*4)));
    const plans=[];for(let j=0;j<p.planCount;j++){const record=Array.from(heap.words.slice(p.planPointer+j*24,p.planPointer+(j+1)*24));record[23]=record[0]===p.owner?1:0;record[0]=remap.get(record[0]);if(record[0]==null)throw new Error('Unmapped designer template plan');plans.push(...record);}
    heap.words[info+2]=plans.length?heap.push(plans):0;
    const variant=heap.push([heap.push(native),p.parts.length,info,heap.push(controlState),inheritFonts,heap.push([heap.words[info+1]]),0,0]);variants.push(variant);
   }
   const at=records+pool*8;heap.set(at,[0xffffffff,0,idsPointer,heap.push(variants),0,0,0,0]);d.templatePools.push({pointer:at,parts:partIDs,variants});
  }
 }
}
function partByOrdinal(root,index){let cursor=0,result;const walk=n=>{if(cursor++===index)result=n;n.children.forEach(walk);};walk(root);return result;}
