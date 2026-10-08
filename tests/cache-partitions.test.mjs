/** Independent host ownership oracle. Does NOT execute the WGSL. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {arenaLayout} from '../src/gpu/arena-layout.js';
import {compile,h} from '../src/core/compiler.js';
import {resourcesForEntry,shaderSource} from '../src/gpu/shader-library.js';
const hash=key=>{
 let x=2166136261;for(const word of key)x=Math.imul((x^word)>>>0,16777619)>>>0;
 x=Math.imul((x^(x>>>16))>>>0,0x85ebca6b)>>>0;return (x^(x>>>13))>>>0;
};
function plan(capacity,frames){
 const partitions=Math.max(1,capacity/32),width=capacity/partitions,slots=Array(capacity).fill(null),output=[];
 let serial=0;
 for(const requests of frames){
  ++serial;const assignments=Array(requests.length).fill(-1),jobs=[],refs=new Set();let hits=0,bypass=0;
  // Requests in different owners may execute in ANY interleaving. Ownership is disjoint.
  for(let owner=0;owner<partitions;owner++){
   for(let i=requests.length-1;i>=0;i--){
    const key=requests[i];if((hash(key)&(partitions-1))!==owner)continue;
    let selected=-1,replacement=-1,age=Infinity;
    for(let at=owner*width;at<(owner+1)*width;at++){
     const s=slots[at];if(!s){replacement=at;break;}
     if(s.key.every((v,j)=>v===key[j])){selected=at;break;}
     if(s.frame!==serial&&s.frame<age){replacement=at;age=s.frame;}
    }
    if(selected<0){selected=replacement;if(selected<0){bypass++;continue;}
     assert.ok(!refs.has(selected),'must not evict a referenced slot');slots[selected]={key:[...key],frame:serial};jobs.push({slot:selected,key:[...key]});
    }else{hits++;slots[selected].frame=serial;}
    refs.add(selected);assignments[i]=selected;
   }
  }
  assert.equal(new Set(jobs.map(x=>x.slot)).size,jobs.length,'miss jobs are disjoint');
  assert.ok(jobs.length<=capacity);assert.equal(hits+bypass+jobs.length,requests.length);
  for(let i=0;i<assignments.length;i++)if(assignments[i]>=0)assert.deepEqual(slots[assignments[i]].key,requests[i]);
  output.push({assignments,jobs,hits,bypass});
 }
 return output;
}
const key=n=>[n>>>0,0x41d00000,0,0,0x41d00000,0x3e800000,0x3f000000];
for(const size of [1,2,16,32,64,128,2048,8192])test(`partition owners never overlap or exceed the arena: ${size} slots`,()=>{
 const limits=compile(h('Border'),{limits:{glyphCacheSlots:size}}).limits;
 const a=arenaLayout(limits),c=a.constants;
 assert.equal(c.GLYPH_SLOTS,c.GLYPH_SHARDS*(size/c.GLYPH_SHARDS));
 assert.ok(c.GLYPH_REQUESTS>=c.GLYPH_BUCKETS+c.GLYPH_SHARDS);
 assert.ok(c.GLYPH_STATS>=c.GLYPH_REQUESTS+limits.maxPrimitives*12);
 assert.equal(a.scratchBytes,(c.GLYPH_STATS+16)*4);
 const requests=Array.from({length:Math.min(size*2,5000)},(_,i)=>key(i));
 plan(size,[requests,requests.slice().reverse(),requests.map(k=>[...k.slice(0,5),0,k[6]])]);
});
test('exact repeated glyphs share one raster job, never merely a hash match',()=>{
 const a=key(1),b=key(2);const [cold,warm]=plan(2048,[[a,b,a,b,a],[b,a,a,b]]);
 assert.equal(cold.jobs.length,2);assert.equal(cold.hits,3);assert.equal(warm.jobs.length,0);assert.equal(warm.hits,4);
 assert.equal(cold.assignments[0],cold.assignments[2]);assert.notEqual(cold.assignments[0],cold.assignments[1]);
});
test('full same-shard pressure bypasses safely without evicting any current reference',()=>{
 const values=[];for(let n=1;values.length<40;n++){const k=key(n);if((hash(k)&63)===3)values.push(k);}
 const [r]=plan(2048,[values]);assert.equal(r.jobs.length,32);assert.equal(r.bypass,8);
 assert.ok(r.assignments.filter(x=>x>=0).every(x=>Math.floor(x/32)===3));
});
test('fractional origin and every matrix component remain exact key fields',()=>{
 const original=key(4),variants=Array.from({length:7},(_,i)=>original.map((v,j)=>j===i?(v+1)>>>0:v));
 const [result]=plan(2048,[[original,...variants]]);assert.equal(result.jobs.length,8);assert.equal(result.bypass,0);
});
test('many arbitrary frame/request orderings preserve exact final slot ownership',()=>{
 let random=0x4a62931;const next=()=>{random^=random<<13;random^=random>>>17;random^=random<<5;return random>>>0;};
 const frames=Array.from({length:150},()=>Array.from({length:300},()=>key(next()%800)));
 plan(128,frames);plan(2048,frames);
});
test('GPU request publication uses dispatch boundaries, not locks or cross-group waits',async()=>{
 const names=['common','templates','designer','curve-coverage','unicode','shaping','shaping-bidi','paragraph','typography-ui','text','editor','editor-render','models','docking','controls','presenter','data-source','layout','input','data','flatten','emit','designer-render','strips','glyph-cache'];
 const shaders=Object.fromEntries(await Promise.all(names.map(async n=>[n,await readFile(new URL(`../shaders/${n}.wgsl`,import.meta.url),'utf8')])));
 const source=shaderSource(shaders,{}),cache=shaders['glyph-cache'];
 assert.match(cache,/atomicExchange\(&scratch\[GLYPH_BUCKETS/);
 assert.match(cache,/@compute @workgroup_size\(64\)\s*fn prepareGlyphCache/);
 assert.doesNotMatch(cache,/atomicCompareExchange|workgroupBarrier|storageBarrier/);
 assert.ok(!resourcesForEntry(source,'rasterGlyphCache').some(r=>r.binding===6));
 assert.match(cache,/fn finishGlyphRequests[\s\S]*indirect\[21\]=state\[52\]/);
});
test('HUD warm kerning no longer traverses OpenType tables',async()=>{
 const common=await readFile(new URL('../shaders/hud-common.wgsl',import.meta.url),'utf8');
 const warm=common.slice(common.indexOf('fn hudPair(left:'),common.indexOf('fn hudAreaPrimitive'));
 assert.match(warm,/hudFontFloat\(HUD_PAIR_TABLE/);assert.doesNotMatch(warm,/hudHeap|for\(|while\(/);
 const raster=await readFile(new URL('../shaders/hud.wgsl',import.meta.url),'utf8');
 assert.match(raster,/if\(kind==0u\)[\s\S]*hudPairFromFont\(code,32u\+right\)/);
});
