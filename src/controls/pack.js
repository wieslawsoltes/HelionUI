import {normalizeItems} from './index.js';
import {AUTO_TARGET,fbits} from '../core/schema.js';
export function packList(heap,props,resolve,index){
 const capacity=props.itemCapacity??256,textCapacity=props.itemTextCapacity??32768;const normalized=normalizeItems(props.items??[],{capacity,textCapacity});
 const p=heap.alloc(24),records=heap.alloc(capacity*8),strings=heap.alloc(textCapacity),visible=heap.alloc(capacity),inbox=heap.alloc(4+capacity*8+textCapacity);let offset=0;
 normalized.items.forEach((r,k)=>{heap.set(records+k*8,[r.key,strings+offset,r.text.length,r.parent,r.depth,r.flags,0,0]);heap.words.set(r.text,strings+offset);offset+=r.text.length;});
 const rowHeight=Number(props.rowHeight??32);if(!Number.isFinite(rowHeight)||rowHeight<16||rowHeight>160)throw new RangeError('List rowHeight must be 16–160');
 heap.set(p,[normalized.items.length,capacity,records,strings,textCapacity,visible,fbits(rowHeight),0,resolve(props.filter),AUTO_TARGET,inbox,4+capacity*8+textCapacity,index,1,0,0,0,0,0,0,0,0,0,0]);
 return {pointer:p,capacity,textCapacity,index,inbox,inboxCapacity:4+capacity*8+textCapacity};
}
