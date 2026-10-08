import {AUTO_TARGET,fbits,nextPowerOfTwo} from '../core/schema.js';
import {valueAt} from './index.js';
export const SOURCE_WORDS=24;
export function hashKey(k){return Math.imul(k^(k>>>16),0x45d9f3b)>>>0;}
export function packDataSource(heap,t,source,rowsAt,columns) {
  const capacity=nextPowerOfTwo(source.capacity),d=heap.alloc(SOURCE_WORDS),keys=heap.alloc(capacity),live=heap.alloc(capacity),hashSize=capacity*2;
  const hk=heap.alloc(hashSize),hs=heap.alloc(hashSize),free=heap.alloc(capacity),pool=heap.alloc(source.stringCapacity),sparePool=heap.alloc(source.stringCapacity),inbox=heap.alloc(source.inboxCapacity);
  heap.words.fill(AUTO_TARGET,hs,hs+hashSize);let used=0;
  source.rows.forEach((r,i)=>{const key=valueAt(r,source.key);heap.words[keys+i]=key;heap.words[live+i]=1;let h=hashKey(key)&(hashSize-1);while(heap.words[hs+h]!==AUTO_TARGET)h=(h+1)&(hashSize-1);heap.words[hk+h]=key;heap.words[hs+h]=i;
    columns.forEach((c,k)=>{const v=valueAt(r,c.field);if(c.type==='text'){const chars=Array.from(String(v??''),c=>c.codePointAt(0));if(used+chars.length+1>source.stringCapacity)throw new RangeError('Initial strings exceed DataSource arena');heap.words[rowsAt+i*8+k]=pool+used;heap.words[pool+used]=chars.length;heap.words.set(chars,pool+used+1);used+=chars.length+1;}else heap.words[rowsAt+i*8+k]=fbits(c.type==='boolean'?(v?1:0):(v??0));});
  });
  heap.set(d,[0x48445331,source.capacity,source.rows.length,0,keys,live,hk,hs,hashSize-1,free,0,source.rows.length,pool,source.stringCapacity,used,inbox,source.inboxCapacity,0,0,0,sparePool,0,0,0]);heap.words[t+35]=d;
  return {pointer:d,capacity:source.capacity,key:source.key,dataColumns:columns,rows:rowsAt,table:t,inbox,inboxCapacity:source.inboxCapacity,stringCapacity:source.stringCapacity};
}
