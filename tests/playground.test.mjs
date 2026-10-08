import {fileURLToPath} from 'node:url';
/** Authoring worker execution and host-message validation; NOT browser/GPU execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {buildAuthoringSource} from '../tools/build-worker.mjs';
import {compile,h} from '../src/index.js';
import {fixtureFont} from './font-fixture.mjs';
import {examples} from '../playground/examples.js';
import {AppSandbox,applicationBootstrap,SANDBOX_CSP,sandboxDocument,validatePlaygroundView} from '../src/playground/sandbox.js';
const root=fileURLToPath(new URL('..',import.meta.url));
const bundle=await buildAuthoringSource(root);
function startWorker(code){
 const script=`const {parentPort}=require('node:worker_threads');globalThis.postMessage=m=>parentPort.postMessage(m);globalThis.addEventListener=(type,fn)=>{if(type==='message')parentPort.on('message',data=>fn({data}));};\n${bundle}\n${applicationBootstrap(code)}`;
 return new Worker(script,{eval:true});
}
async function execute(code){const worker=startWorker(code),messages=[];try{return await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Authoring worker timed out')),3000);worker.on('message',m=>{messages.push(m);if(m.type==='error'||m.type==='executed'){clearTimeout(timeout);resolve(messages);}});worker.on('error',e=>{clearTimeout(timeout);reject(e);});});}finally{await worker.terminate();}}
for(const example of examples)test(`actual isolated Node authoring worker: ${example.name}`,async()=>{const messages=await execute(example.code);assert.ok(!messages.some(m=>m.type==='error'),messages.find(m=>m.type==='error')?.message);const view=validatePlaygroundView(messages.find(m=>m.type==='view').view);const c=compile(view,{fonts:[fixtureFont()],styles:example.css});assert.ok(c.nodeCount>0);if(example.name.toLowerCase().includes('datagrid'))assert.equal(c.tables[0].rowCount,65536);});
test('authoring bundle contains only reusable authoring modules, not runtime/GPU/font loader',()=>{assert.ok(bundle.includes('DrawingContext'));assert.ok(bundle.includes('GlyphRun'));assert.ok(!bundle.includes('requestAdapter'));assert.ok(!bundle.includes('class HelionSurface'));assert.ok(!bundle.includes('function loadFont'));assert.ok(!bundle.includes('document.'));});
test('worker can emit runtime scalar commands without a CPU view mirror',async()=>{const result=await execute("app(Helion.h('Slider',{id:'s',value:0}));set('s','value',.75);");assert.equal(result.filter(m=>m.type==='view').length,1);assert.deepEqual(result.find(m=>m.type==='set'),{type:'set',id:'s',property:'value',value:.75});});
test('bad app scripts report errors instead of silently replacing preview contents',async()=>{const result=await execute("throw new Error('deliberate test failure')");assert.equal(result.at(-1).type,'error');assert.match(result.at(-1).message,/deliberate test failure/);});
test('infinite app computation is terminable while the controller remains responsive',async()=>{const worker=startWorker('while(true){}');try{await new Promise(r=>worker.once('online',r));const time=performance.now();await new Promise(r=>setTimeout(r,35));assert.ok(performance.now()-time<1500);const exit=await worker.terminate();assert.equal(typeof exit,'number');}finally{await worker.terminate();}});
test('playground rejects overlarge or malformed declaration trees before GPU allocation',()=>{assert.throws(()=>validatePlaygroundView({type:'Panel'}),/return a Helion view/);assert.throws(()=>validatePlaygroundView(h('Panel',{},...Array.from({length:513},()=>h('Border')))),/limits/);let tree=h('Border');for(let i=0;i<30;i++)tree=h('Panel',{},tree);assert.throws(()=>validatePlaygroundView(tree),/limits/);});
test('sandbox document declares a network-disabled worker policy and no same-origin privilege',()=>{assert.ok(SANDBOX_CSP.includes("connect-src 'none'"));assert.ok(SANDBOX_CSP.includes("worker-src blob:"));assert.ok(SANDBOX_CSP.includes("form-action 'none'"));assert.ok(sandboxDocument().includes('event.source!==parent'));assert.ok(!sandboxDocument().includes('allow-same-origin'));});
test('host sandbox ignores wrong senders/channel/revision and disposes stale listeners',()=>{
 const saved=new Map(),listeners=new Set(),frames=[],messages=[];const set=(key,value)=>{saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});};
 set('addEventListener',(_type,fn)=>listeners.add(fn));set('removeEventListener',(_type,fn)=>listeners.delete(fn));
 set('document',{body:{append(frame){frames.push(frame);}},createElement(){return {attrs:{},setAttribute(k,v){this.attrs[k]=v;},contentWindow:{sent:[],postMessage(m){this.sent.push(m);}},remove(){this.removed=true;}};}});
 let sandbox;try{sandbox=new AppSandbox({bundle,onMessage:(type,data)=>messages.push({type,data})});sandbox.run('return null');const frame=frames[0],listener=[...listeners][0];assert.equal(frame.attrs.sandbox,'allow-scripts');
 listener({source:{},data:{helionSandboxReady:true}});assert.equal(frame.contentWindow.sent.length,0);listener({source:frame.contentWindow,data:{helionSandboxReady:true}});const init=frame.contentWindow.sent[0];
 listener({source:frame.contentWindow,data:{helion:'spoof',run:init.run,type:'view',data:{}}});assert.equal(messages.length,0);
 listener({source:frame.contentWindow,data:{helion:init.channel,run:init.run+1,type:'view',data:{}}});assert.equal(messages.length,0);
 listener({source:frame.contentWindow,data:{helion:init.channel,run:init.run,type:'view',data:{view:h('Panel')}}});assert.equal(messages.length,1);
 sandbox.run('return null');assert.ok(frame.removed);assert.equal(listeners.size,1);sandbox.dispose();assert.equal(listeners.size,0);assert.ok(frames[1].removed);
 }finally{sandbox?.dispose();for(const[k,v]of saved){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}}
});

test('actual authoring worker responds to GPU host actions with dynamic source/list/text/model/editor commands',async()=>{
 const worker=startWorker(`app(Helion.h('Button',{id:'button',action:Helion.hostAction('update')}));app.onAction(event=>{app.data('grid','patch',event.key,{name:'changed'});app.items('list',[{key:2,label:'Live'}]);app.text('label','Done');app.model('vm','execute','increment',1);app.editor('source','insert','!');});`);
 try{
  const messages=[];await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Worker action timeout')),3000);worker.on('error',reject);worker.on('message',m=>{messages.push(m);if(m.type==='error'){clearTimeout(timer);reject(new Error(m.message));}if(m.type==='executed')worker.postMessage({type:'host-action',event:{name:'update',key:4294967294}});if(m.type==='editor'){clearTimeout(timer);resolve();}});});
  assert.deepEqual(messages.find(m=>m.type==='data'),{type:'data',id:'grid',operation:'patch',args:[4294967294,{name:'changed'}]});assert.deepEqual(messages.find(m=>m.type==='text'),{type:'text',id:'label',value:'Done'});assert.ok(messages.some(m=>m.type==='items'));assert.ok(messages.some(m=>m.type==='model'));
 }finally{await worker.terminate();}
});
test('actual authoring worker can publish a replacement view without becoming a second renderer',async()=>{const result=await execute("app(Helion.h('TextBlock',{text:'one'}));app(Helion.h('ListBox',{items:['two']}));");assert.equal(result.filter(x=>x.type==='view').length,2);assert.equal(result.filter(x=>x.type==='view')[1].view.type,'ListBox');});
