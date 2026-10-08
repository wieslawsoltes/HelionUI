import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker as NodeWorker } from 'node:worker_threads';
import { buildWorkerSource } from '../tools/build-worker.mjs';
import { h, compile, HeapBuilder } from '../src/core/compiler.js';
import { fbits, fromBits } from '../src/core/schema.js';
import { FrameCadence } from '../src/gpu/cadence.js';
import { parallelTasks } from '../src/gpu/pipeline-library.js';
import { resourcesForEntry } from '../src/gpu/shader-library.js';
import { combiningRanges } from '../src/text/fonts.js';
import { fixtureFont, makeTestFont } from './font-fixture.mjs';
import { prepareView, prepare } from '../src/startup/prepare.js';
import { prepareScene } from '../src/startup/prepare-core.js';
import { cacheSignature, compiledDigest, validCachedScene, readStartupCache, writeStartupCache } from '../src/startup/cache.js';
import { createCheckedShaderModule } from '../src/gpu/shader-diagnostics.js';

const scene=()=>h('Grid',{rows:'40 *'},h('TextBox',{id:'text',text:'AV fi A\u030a'}),h('DataGrid',{id:'table',row:1,rowCount:1024}));
const fonts=()=>[fixtureFont()];
function equalScene(a,b) { for(const name of ['nodes','state','heap'])assert.deepEqual(a[name],b[name],`${name} exactly equal`);assert.deepEqual(a.ids,b.ids);assert.deepEqual(a.fonts,b.fonts); }
test('typed heap preserves zero initialization, old values and bounded growth',()=>{
 const b=new HeapBuilder(200000);assert.equal(b.alloc(65530),4);b.words[100]=0xffffffff;
 const at=b.push([1,-1,2**32+7]);assert.equal(at,65534);assert.equal(b.words[100],0xffffffff);
 assert.deepEqual([...b.finish().slice(-3)],[1,0xffffffff,7]);assert.equal(b.finish().length,65537);
 assert.ok(b.words.subarray(65537).every(x=>x===0));assert.throws(()=>b.alloc(200000));assert.throws(()=>b.alloc(-1));assert.throws(()=>b.set(200000,[1]));
});
test('shared f32 conversion preserves zeros, subnormals, extremes and reentrant coercion',()=>{
 const original=value=>{const a=new Float32Array([value]);return new Uint32Array(a.buffer)[0];};
 const values=[0,-0,1,-1,1e-40,-1e-40,1e30,Infinity,-Infinity,NaN];
 for(let i=0;i<2000;i++) values.push(Math.sin(i)*2**(i%280-140));
 for(const value of values) assert.equal(fbits(value),original(value));
 assert.ok(Object.is(fromBits(0x80000000),-0));
 assert.equal(fbits({valueOf(){fbits(19);return .25;}}),original(.25));
 assert.throws(()=>fbits(1n),TypeError);assert.throws(()=>fbits({valueOf:()=>1n}),TypeError);
});
test('bulk native mark discovery exactly matches the previous per-codepoint Unicode predicate',()=>{
 const MARK_RANGES = combiningRanges(); assert.ok(Object.isFrozen(MARK_RANGES));
 const predicate=/\p{M}/u;let range=0;
 for(let cp=0;cp<0x110000;cp++){
  while(range<MARK_RANGES.length&&cp>MARK_RANGES[range+1])range+=2;
  const actual=range<MARK_RANGES.length&&cp>=MARK_RANGES[range];
  const expected=predicate.test(String.fromCodePoint(cp))||(cp>=0xfe00&&cp<=0xfe0f)||(cp>=0xe0100&&cp<=0xe01ef);
  assert.equal(actual,expected,`U+${cp.toString(16)}`);
 }
 assert.equal(combiningRanges(),MARK_RANGES);
});
test('shader resource analysis is cached by exact source and ignores irrelevant prose',()=>{
 const s='fn a(){ state[0]=0u; } fn b(){ a(); }';const first=resourcesForEntry(s,'b');
 assert.equal(resourcesForEntry(s,'b'),first);assert.ok(Object.isFrozen(first));assert.deepEqual(first.map(x=>x.binding),[2]);
 assert.deepEqual(resourcesForEntry(s.replace('state','heap'),'b').map(x=>x.binding),[3]);
});
for(const hz of [30,60,90,120,144,165,240])test(`cadence clock retains actual ${hz}Hz rather than assuming 60`,()=>{
 const c=new FrameCadence();for(let i=0;i<500;i++)c.tick(1e6+i*1000/hz);
 assert.ok(Math.abs(c.hz-hz)<.0001);assert.ok(Math.abs((c.packed>>>16)/256-1000/hz)<1/256);
 c.tick(1e6+100000);assert.equal(c.hz,0);assert.equal(c.packed,0);
});
test('cadence changes adapt in time, not a fixed number of low-refresh frames',()=>{
 const c=new FrameCadence();let t=0;for(let i=0;i<120;i++){c.tick(t);t+=1000/60;}
 for(let i=0;i<400;i++){c.tick(t);t+=1000/240;}assert.ok(Math.abs(c.hz-240)<.2);
 c.reset();assert.equal(c.hz,0);c.tick(1);c.tick(1);assert.equal(c.hz,0);c.tick(NaN);assert.equal(c.hz,0);
});
test('parallel pipelines launch a bounded batch before waiting for completion',async()=>{
 let active=0,peak=0;const releases=[];const tasks=Array.from({length:12},(_,i)=>()=>new Promise(resolve=>{active++;peak=Math.max(peak,active);releases.push(()=>{active--;resolve(i);});}));
 const result=parallelTasks(tasks,4);assert.equal(releases.length,4);
 for(let batch=0;batch<3;batch++){for(const done of releases.splice(0))done();await Promise.resolve();await Promise.resolve();}
 assert.deepEqual(await result,[0,1,2,3,4,5,6,7,8,9,10,11]);assert.equal(peak,4);assert.equal(active,0);
});
test('parallel pipeline failures wait for all in-flight resources to settle',async()=>{
 const ran=[];await assert.rejects(parallelTasks(Array.from({length:8},(_,i)=>async()=>{ran.push(i);if(i===2)throw new Error('pipeline rejected');return i;}),4),/pipeline rejected/);assert.equal(ran.length,8);
 for(const bad of [0,33,1.5,NaN])await assert.rejects(parallelTasks([],bad),RangeError);
});
test('concurrent shader-module checks pop error scopes before yielding',async()=>{
 const stack=[], pending=[];const device={pushErrorScope(){stack.push(1);},createShaderModule(){assert.equal(stack.length,1);return{getCompilationInfo:()=>new Promise(resolve=>pending.push(resolve))};},popErrorScope(){assert.equal(stack.length,1);stack.pop();return Promise.resolve(null);}};
 const promises=Array.from({length:3},()=>createCheckedShaderModule(device,{code:'',sections:[]},'module'));
 assert.equal(stack.length,0);for(const done of pending)done({messages:[]});await Promise.all(promises);
});
test('worker-disabled asynchronous preparation produces exact full scene bytes',async()=>{
 const f=fonts(),v=scene();const result=await prepareView(v,{fonts:f,startupWorker:false});equalScene(result.compiled,compile(v,{fonts:f}));assert.equal(result.stats.worker,false);
 equalScene(await prepare(v,{fonts:f,startupWorker:false}),result.compiled);
});
test('startup abort does not silently return a compiled result',async()=>{
 const controller=new AbortController();controller.abort(new Error('cancelled'));await assert.rejects(prepareView(scene(),{fonts:fonts(),signal:controller.signal}),/cancelled/);
});
const workerSource=await buildWorkerSource();
test('standalone worker has no unresolved document import-map dependency or font binary',()=>{
 assert.doesNotMatch(workerSource,/@helion\.bundle|import\.meta|^\s*import\s/m);assert.match(workerSource,/self\.postMessage\(\{ type: 'ready'/);assert.doesNotMatch(workerSource,/data:font/);
});
test('actual isolated worker execution transfers exact compiled arrays and manifest',async()=>{
 const prefix=`const {parentPort}=require('node:worker_threads');globalThis.self={postMessage:(value,list)=>parentPort.postMessage(value,list),close:()=>parentPort.close()};parentPort.on('message',data=>self.onmessage({data}));\n`;
 const worker=new NodeWorker(prefix+workerSource,{eval:true});const f=fonts(),v=scene();
 try {
  const result=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('Worker timeout')),15000);
   worker.on('error',error=>{clearTimeout(timer);reject(error);});
   worker.on('message',message=>{
    if(message.type==='ready')worker.postMessage({view:v,options:{fonts:f}});
    else if(message.type==='error'){clearTimeout(timer);reject(new Error(message.message));}
    else if(message.type==='result'){clearTimeout(timer);resolve(message);}
   });
  });
  equalScene(result.compiled,compile(v,{fonts:f}));assert.equal(result.stats.cache,'disabled');
 }finally{await worker.terminate();}
});
test('malformed fonts rejected by the worker do not become a placeholder or host fallback',async()=>{
 const worker=new NodeWorker(`const{parentPort}=require('node:worker_threads');globalThis.self={postMessage:(v,t)=>parentPort.postMessage(v,t),close:()=>parentPort.close()};parentPort.on('message',data=>self.onmessage({data}));\n`+workerSource,{eval:true});
 try{const result=await new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',m=>{if(m.type==='ready')worker.postMessage({view:scene(),options:{fontSources:[{source:new Uint8Array([1,2,3])}]}});if(m.type==='error'||m.type==='result')resolve(m);});});assert.equal(result.type,'error');assert.match(result.message,/Truncated|font/i);}finally{await worker.terminate();}
});
const sourceOptions={startupCache:'test-v1',fontSources:[{source:'https://example.invalid/static-font-v1.ttf',weight:400}]};
test('startup cache key includes declarations, styles, limits, source and application revision',async()=>{
 const v=scene(),key=await cacheSignature(v,sourceOptions);assert.equal(key.length,64);assert.equal(key,await cacheSignature(v,{fontSources:sourceOptions.fontSources,startupCache:'test-v1'}));
 for(const variant of [{...sourceOptions,startupCache:'test-v2'},{...sourceOptions,limits:{maxRows:2048}},{...sourceOptions,fontSources:[{...sourceOptions.fontSources[0],weight:600}]}])assert.notEqual(key,await cacheSignature(v,variant));
 const changed=scene();changed.children[0].props.text+='x';assert.notEqual(key,await cacheSignature(changed,sourceOptions));
});
test('cache does not persist local fonts, prepared faces, unsupported values or nonfinite declarations',async()=>{
 for(const options of [{fonts:fonts()},{fontSources:[{source:new Uint8Array([1])}]},{fontSources:[{source:new Blob(['font'])}]},{startupCache:false}])assert.equal(await cacheSignature(scene(),{...sourceOptions,...options}),null);
 assert.equal(await cacheSignature(h('TextBlock',{fontSize:NaN}),sourceOptions),null);
});
test('cache digest detects changes to font geometry, state, nodes and manifest',async()=>{
 const a=compile(scene(),{fonts:fonts()}),digest=await compiledDigest(a);assert.ok(validCachedScene(a));
 for(const part of ['nodes','heap','state']){const b=structuredClone(a);b[part][0]^=1;assert.notEqual(await compiledDigest(b),digest);}
 const b=structuredClone(a);b.fonts[0].family+=' changed';assert.notEqual(await compiledDigest(b),digest);
 assert.equal(validCachedScene({...a,version:2}),false);assert.equal(validCachedScene({...a,nodes:a.nodes.slice(1)}),false);
});
function fakeDatabase(record){
 return {record, transaction(){const db=this,tx={abort(){tx.onabort?.();},objectStore(){return{get(){const r={};queueMicrotask(()=>{r.result=db.record;r.onsuccess?.();});return r;},put(value){db.record=structuredClone(value);queueMicrotask(()=>tx.oncomplete?.());}};}};return tx;}};
}
test('lossless cache hit restores INITIAL data; corruption and revision mismatches are misses',async()=>{
 const c=compile(scene(),{fonts:fonts()}),signature='key',digest=await compiledDigest(c),db=fakeDatabase();assert.equal(await writeStartupCache(db,signature,c,digest),true);
 equalScene(await readStartupCache(db,signature),c);assert.equal(await readStartupCache(db,'different'),null);
 db.record.compiled.heap[50]^=1;assert.equal(await readStartupCache(db,signature),null);
 assert.equal(await readStartupCache(null,signature),null);assert.equal(await writeStartupCache(null,signature,c,digest),false);
});
test('font preparation failure does not report a successful cache result',async()=>{await assert.rejects(prepareScene(scene(),{fontSources:[{source:new Uint8Array([1,2])}]}),/Truncated|font/i);});

test('progress observer failure still settles every scheduled pipeline',async()=>{
 let ran=0;await assert.rejects(parallelTasks(Array.from({length:9},()=>async()=>{ran++;}),4,()=>{throw new Error('observer failed');}),/observer failed/);assert.equal(ran,9);
});
test('public asynchronous preparation reports elapsed times without letting observers corrupt compilation',async()=>{
 const events=[];const c=await prepare(scene(),{fonts:fonts(),startupWorker:false,onStartup:e=>events.push(e)});
 assert.equal(c.version,3);assert.ok(events.length>1);assert.ok(events.every(e=>Number.isFinite(e.elapsedMs)&&e.elapsedMs>=0));
 for(let i=1;i<events.length;i++)assert.ok(events[i].elapsedMs>=events[i-1].elapsedMs);
});
test('CSP worker-construction rejection falls back to the exact compiler with no placeholder',async()=>{
 const old=Object.getOwnPropertyDescriptor(globalThis,'Worker');
 Object.defineProperty(globalThis,'Worker',{configurable:true,value:class{constructor(){throw new Error('Blocked by CSP');}}});
 try{const f=fonts(),v=scene(),result=await prepareView(v,{fonts:f});assert.equal(result.stats.worker,false);equalScene(result.compiled,compile(v,{fonts:f}));}
 finally{if(old)Object.defineProperty(globalThis,'Worker',old);else delete globalThis.Worker;}
});
test('relative runtime font URLs resolve against the document, not worker location',async()=>{
 const saved=new Map();for(const name of ['Worker','document','fetch'])saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));
 let received;const bytes=makeTestFont();
 Object.defineProperty(globalThis,'Worker',{configurable:true,value:undefined});
 Object.defineProperty(globalThis,'document',{configurable:true,value:{baseURI:'https://example.invalid/app/index.html'}});
 Object.defineProperty(globalThis,'fetch',{configurable:true,value:async source=>{received=String(source);return new Response(bytes);}});
 try{const r=await prepareView(scene(),{fontSources:[{source:'./assets/font.ttf'}]});assert.equal(received,'https://example.invalid/app/assets/font.ttf');assert.equal(r.compiled.textMode,'opentype');}
 finally{for(const [name,value]of saved){if(value)Object.defineProperty(globalThis,name,value);else delete globalThis[name];}}
});
test('repeat startup bypasses font fetch/parse/compile and restores the complete initial scene',async()=>{
 const saved=new Map();for(const name of ['indexedDB','fetch'])saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));
 const db=fakeDatabase();db.close=()=>{};let fetches=0;
 Object.defineProperty(globalThis,'indexedDB',{configurable:true,value:{open(){const r={result:db};queueMicrotask(()=>r.onsuccess?.());return r;}}});
 Object.defineProperty(globalThis,'fetch',{configurable:true,value:async()=>{fetches++;return new Response(makeTestFont());}});
 try{
  const first=await prepareScene(scene(),sourceOptions);assert.equal(first.stats.cache,'miss');assert.equal(await first.persisted,true);assert.equal(fetches,1);
  const second=await prepareScene(scene(),sourceOptions);assert.equal(second.stats.cache,'hit');assert.equal(second.stats.fontMs,0);assert.equal(second.stats.compileMs,0);assert.equal(fetches,1);equalScene(first.compiled,second.compiled);
  const changed=scene();changed.children[0].props.text+='V';const third=await prepareScene(changed,sourceOptions);await third.persisted;assert.equal(third.stats.cache,'miss');assert.equal(fetches,2);
 }finally{for(const[name,value]of saved){if(value)Object.defineProperty(globalThis,name,value);else delete globalThis[name];}}
});
