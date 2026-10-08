import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {ProgressWatchdog} from '../src/gpu/progress-watchdog.js';
import {startupWorkerPlan} from '../src/startup/worker-source.js';
import {prepareView} from '../src/startup/prepare.js';
import {HelionSurface} from '../src/gpu/runtime.js';
import {h,compile} from '../src/core/compiler.js';
import {fixtureFont} from './font-fixture.mjs';
import {launchApplication} from '../src/platform/launch.js';
import {launchScript,launchPages} from '../tools/launch-bootstrap.mjs';
import {BUILD_VERSION} from '../src/version.js';

async function globals(values,body) {
  const saved = new Map(Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for (const [key,value] of Object.entries(values)) Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  try { return await body(); }
  finally { for (const [key,descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis,key,descriptor); else delete globalThis[key]; } }
}
function nativeLikeTimers() {
  const jobs=new Map(); let next=0,sets=0,clears=0;
  return {jobs,get sets(){return sets;},get clears(){return clears;},
    setTimeout:function(fn,delay){assert.equal(this,globalThis,'setTimeout requires the Window/Worker receiver');assert.equal(typeof fn,'function');sets++;const id=next++;jobs.set(id,{fn,delay});return id;},
    clearTimeout:function(id){assert.equal(this,globalThis,'clearTimeout requires the Window/Worker receiver');clears++;jobs.delete(id);}
  };
}
test('default watchdog timers keep native global receiver through submit, complete and dispose',async()=>{
  const timers=nativeLikeTimers();await globals({setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout},()=>{
    const w=new ProgressWatchdog({timeoutMs:10});w.submitted(1);assert.equal(w.timer,0);assert.equal(timers.jobs.size,1);
    w.completed(1);assert.equal(timers.jobs.size,0);w.submitted(2);w.dispose();assert.equal(timers.jobs.size,0);
    assert.equal(timers.sets,2);assert.equal(timers.clears,2);
  });
});
test('watchdog native defaults retain suspension and real-prefix rearm semantics',async()=>{
  const timers=nativeLikeTimers();await globals({setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout},()=>{
    const w=new ProgressWatchdog({timeoutMs:10});w.submitted(2);w.suspend();assert.equal(timers.jobs.size,0);
    w.suspend(false);w.completed(1);assert.equal(timers.jobs.size,1);const handle=w.timer;w.completed(0);assert.equal(w.timer,handle);w.dispose();
  });
});
test('receiver-sensitive regression rejects the previous instance-method timer pattern',async()=>{
  const timers=nativeLikeTimers();await globals({setTimeout:timers.setTimeout},()=>{
    const broken={schedule:globalThis.setTimeout};assert.throws(()=>broken.schedule(()=>{},10),/receiver/);
  });
});
test('watchdog injected timer functions still work and a stall never creates completion credit',()=>{
  let callback,now=0,report;const w=new ProgressWatchdog({timeoutMs:10,now:()=>now,schedule:fn=>(callback=fn,0),cancel:()=>{},onStall:value=>report=value});
  w.submitted(2);now=12;callback();assert.deepEqual(report,{submitted:2,acknowledged:0,notificationGapMs:12});assert.equal(w.acknowledged,0);w.dispose();
});
test('a disabled watchdog never invokes a native timer',async()=>{
  await globals({setTimeout(){throw new Error('unexpected timer');}},()=>{const w=new ProgressWatchdog({timeoutMs:0});w.submitted(1);w.dispose();});
});
const source='\'use strict\'; self.postMessage({type:"ready"});';
test('embedded preparation uses an exact classic script, independent of its data-module URL',()=>{
  assert.deepEqual(startupWorkerPlan({embeddedSource:source,moduleURL:'data:text/javascript;base64,AA==',documentURL:'https://app.test/app/'}),{type:'classic',source});
});
test('unbundled source keeps a same-origin module worker with its own dependency resolution',()=>{
  const plan=startupWorkerPlan({moduleURL:'http://127.0.0.1:8080/src/startup/prepare.js',documentURL:'http://127.0.0.1:8080/designer/'});
  assert.equal(plan.type,'module');assert.equal(plan.url.href,'http://127.0.0.1:8080/src/startup/prepare-worker.js');
});
for(const documentURL of ['file:///private/app.html','data:text/html,App'])test(`reject ${documentURL.split(':')[0]} worker origins before constructing a Worker`,()=>{
  assert.throws(()=>startupWorkerPlan({embeddedSource:source,documentURL}),/isolated origins/);
});
for(const moduleURL of ['data:text/javascript;base64,AA==','blob:https://app.test/id'])test(`missing embedded source cannot resolve a worker through ${moduleURL.split(':')[0]} module aliases`,()=>{
  assert.throws(()=>startupWorkerPlan({moduleURL,documentURL:'https://app.test/'}),/embedded startup worker is missing/);
});
test('cross-origin source-worker entry is rejected before a failing browser constructor',()=>{
  assert.throws(()=>startupWorkerPlan({moduleURL:'https://cdn.test/src/startup/prepare.js',documentURL:'https://app.test/'}),/share an origin/);
});
test('HTTP origin comparison includes scheme and port',()=>{
  for(const moduleURL of ['https://app.test/src/startup/prepare.js','http://app.test:8081/src/startup/prepare.js'])assert.throws(()=>startupWorkerPlan({moduleURL,documentURL:'http://app.test:8080/'}),/share an origin/);
});
test('unsupported local source-worker entry reports serving instructions',()=>{
  assert.throws(()=>startupWorkerPlan({moduleURL:'file:///src/startup/prepare.js'}),/HTTP\(S\)/);
});

const view=()=>h('TextBox',{id:'text',text:'AV ffi'});
async function fakeWorker({construct,onPost,onConstruct}={},body) {
  const instances=[],revoked=[],created=[];const fonts=[fixtureFont()],compiled=compile(view(),{fonts});
  const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;
  URL.createObjectURL=blob=>{created.push(blob);return 'blob:https://app.test/'+created.length;};URL.revokeObjectURL=url=>revoked.push(url);
  class Worker {
    constructor(url,options){if(construct)throw new Error(construct);Object.assign(this,{url,options,posts:0,terminated:0});instances.push(this);onConstruct?.(this);queueMicrotask(()=>this.onmessage?.({data:{type:'ready'}}));}
    postMessage(packet){this.posts++;if(onPost)return onPost(this,packet,compiled);queueMicrotask(()=>{this.onmessage?.({data:{type:'result',compiled,stats:{cache:'disabled'}}});this.onmessage?.({data:{type:'stored',stored:false}});});}
    terminate(){this.terminated++;}
  }
  try {return await globals({Worker,__HELION_PREPARE_WORKER_SOURCE__:source,location:{href:'https://app.test/',protocol:'https:'}},()=>body({instances,created,revoked,fonts,compiled}));}
  finally {URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;}
}
test('classic worker lifecycle returns exact scene and releases URL and worker once',async()=>{
  await fakeWorker({},async({instances,created,revoked,fonts,compiled})=>{
    const result=await prepareView(view(),{fonts});assert.equal(result.stats.worker,true);assert.deepEqual(result.compiled,compiled);
    assert.equal(instances[0].options.type,'classic');assert.equal(await created[0].text(),source);
    assert.equal(instances[0].posts,1);assert.equal(instances[0].terminated,1);assert.deepEqual(revoked,['blob:https://app.test/1']);assert.equal(instances[0].onmessage,null);
  });
});
test('duplicate ready/result events do not compile or deliver twice',async()=>{
  await fakeWorker({onPost(w,p,compiled){queueMicrotask(()=>{w.onmessage({data:{type:'ready'}});w.onmessage({data:{type:'result',compiled,stats:{}}});w.onmessage({data:{type:'result',compiled,stats:{}}});w.onmessage({data:{type:'stored'}});});}},async({fonts,instances,revoked})=>{
    assert.equal((await prepareView(view(),{fonts})).stats.worker,true);assert.equal(instances[0].posts,1);assert.equal(instances[0].terminated,1);assert.equal(revoked.length,1);
  });
});
test('CSP worker-creation failure preserves the identical explicit host-compiler fallback',async()=>{
  await fakeWorker({construct:'Blocked by CSP'},async({fonts,compiled,created,revoked})=>{
    const result=await prepareView(view(),{fonts});assert.equal(result.stats.worker,false);assert.match(result.stats.workerFallback,/Blocked by CSP/);assert.deepEqual(result.compiled,compiled);assert.equal(created.length,1);assert.equal(revoked.length,1);
  });
});
test('real font/compiler errors after ready propagate, rather than reporting a successful fallback',async()=>{
  await fakeWorker({onPost(w){queueMicrotask(()=>w.onmessage({data:{type:'error',name:'RangeError',message:'Malformed font'}}));}},async({fonts,instances,revoked})=>{
    await assert.rejects(prepareView(view(),{fonts}),error=>error.name==='RangeError'&&error.message==='Malformed font');assert.equal(instances[0].terminated,1);assert.equal(revoked.length,1);
  });
});
test('already-aborted startup does not construct a worker or a Blob URL',async()=>{
  await fakeWorker({},async({fonts,instances,created})=>{const c=new AbortController();c.abort(new Error('cancelled'));await assert.rejects(prepareView(view(),{fonts,signal:c.signal}),/cancelled/);assert.equal(instances.length,0);assert.equal(created.length,0);});
});
test('abort during constructor is observed before sending scene data',async()=>{
  const c=new AbortController();await fakeWorker({onConstruct(){c.abort(new Error('cancelled in constructor'));}},async({fonts,instances,revoked})=>{
    await assert.rejects(prepareView(view(),{fonts,signal:c.signal}),/cancelled in constructor/);assert.equal(instances[0].posts,0);assert.equal(instances[0].terminated,1);assert.equal(revoked.length,1);
  });
});
test('abort after worker ready terminates once without running fallback preparation',async()=>{
  const c=new AbortController();await fakeWorker({onPost(){c.abort(new Error('cancelled parsing'));}},async({fonts,instances,revoked})=>{
    await assert.rejects(prepareView(view(),{fonts,signal:c.signal}),/cancelled parsing/);assert.equal(instances[0].terminated,1);assert.equal(revoked.length,1);
  });
});
test('worker message-decoding error is settled and cleaned up',async()=>{
  await fakeWorker({onPost(w){queueMicrotask(()=>w.onmessageerror());}},async({fonts,instances})=>{
    await assert.rejects(prepareView(view(),{fonts}),/decode/);assert.equal(instances[0].terminated,1);
  });
});
test('non-cloneable startup packet may fall back before any worker compilation',async()=>{
  await fakeWorker({onPost(){throw new Error('clone rejected');}},async({fonts,compiled,instances})=>{
    const result=await prepareView(view(),{fonts});assert.equal(result.stats.worker,false);assert.deepEqual(result.compiled,compiled);assert.match(result.stats.workerFallback,/clone rejected/);assert.equal(instances[0].terminated,1);
  });
});

function noticeContext(href) {
  const elements=new Map();for(const id of ['boot','boot-detail','boot-title','boot-hint'])elements.set(id,{hidden:true,textContent:'',style:{},classList:{add(){}},setAttribute(){}});
  const url=new URL(href),context=vm.createContext({document:{getElementById:id=>elements.get(id)},location:{href,protocol:url.protocol},URL});
  return{elements,context};
}
for(const filename of ['helion-designer.html','helion-playground.html','helion-standalone.html'])test(`standalone ${filename} file launch reports instructions before importing application code`,()=>{
  const {context,elements}=noticeContext('file:///private/Helion%20UI/'+filename);
  assert.equal(vm.runInContext(`(${launchApplication.toString()})('@helion.bundle/app.js',{version:'${BUILD_VERSION}',standalone:true})`,context),false);
  assert.equal(context.__HELION_LAUNCH_STATUS__,'needs-server');assert.equal(elements.get('boot').hidden,false);assert.match(elements.get('boot-detail').textContent,/python3 -m http.server/);assert.ok(elements.get('boot-detail').textContent.includes('http://127.0.0.1:8080/'+filename));assert.doesNotMatch(elements.get('boot-detail').textContent,/private|Helion%20UI/);
});
test('source-file guard gives npm start and the source route, not an unavailable standalone name',()=>{
  const{context,elements}=noticeContext('file:///project/designer/index.html');vm.runInContext(`(${launchApplication.toString()})('./app.js',{version:'${BUILD_VERSION}',path:'/designer/'})`,context);
  assert.match(elements.get('boot-detail').textContent,/npm start/);assert.match(elements.get('boot-detail').textContent,/8080\/designer\//);
});
test('all four source HTML bootstraps match the canonical inline guard',async()=>{
  for(const page of launchPages){const html=await readFile(new URL('../'+page.file,import.meta.url),'utf8');assert.ok(html.includes(launchScript(page.entry,{path:page.path})),page.file);assert.doesNotMatch(html,/<script type="module" src=/);}
});
test('mount rejects an unsupported file document before adapter, font or worker access',async()=>{
  await globals({location:{protocol:'file:'}},async()=>{await assert.rejects(HelionSurface.mount(null,null),/requires localhost or HTTPS/);});
});
test('bootstrap module status never claims that the GPU itself has initialized',async()=>{
  const source=await readFile(new URL('../src/platform/launch.js',import.meta.url),'utf8');assert.match(source,/'module-loaded'/);assert.doesNotMatch(source,/__HELION_LAUNCH_STATUS__\s*=\s*'ready'/);
});

test('cancellation after scene delivery still stops optional cache work and cleans up once',async()=>{
  const c=new AbortController();await fakeWorker({onPost(w,p,compiled){queueMicrotask(()=>w.onmessage({data:{type:'result',compiled,stats:{}}}));}},async({fonts,instances,revoked})=>{
    const result=await prepareView(view(),{fonts,signal:c.signal});assert.equal(result.stats.worker,true);assert.equal(instances[0].terminated,0);
    c.abort(new Error('Discarded mount'));assert.equal(instances[0].terminated,1);assert.equal(revoked.length,1);
  });
});
test('the Python launcher binds loopback only and refuses paths outside the extracted package',async()=>{
  const source=await readFile(new URL('../serve-helion.py',import.meta.url),'utf8');assert.match(source,/ThreadingHTTPServer\(\('127\.0\.0\.1', args.port\)/);assert.match(source,/resolved.relative_to/);assert.match(source,/'Cache-Control', 'no-store'/);assert.match(source,/\.mjs': 'text\/javascript'/);
});
test('all three platform launchers quote the package directory and keep the same server entry',async()=>{
  for(const name of ['start-helion.command','start-helion.sh','start-helion.cmd']){const source=await readFile(new URL('../'+name,import.meta.url),'utf8');assert.match(source,/serve-helion\.py/);assert.match(source,/--open/);if(name.endsWith('.cmd'))assert.match(source,/cd \/d "%~dp0"/);else assert.match(source,/dirname -- "\$0"/);}
});
test('native host-only gate never requests GPU or downloads real font assets',async()=>{
  const source=await readFile(new URL('./host-startup-suite.js',import.meta.url),'utf8');assert.doesNotMatch(source,/requestAdapter|requestDevice|fetch\(|loadFonts\(/);assert.match(source,/diagnosticFont\(\)/);assert.match(source,/UNVERIFIED/);
});
