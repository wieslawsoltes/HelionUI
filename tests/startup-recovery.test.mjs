import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {boundedWait,startupScope,StartupTimeoutError,timeoutOption} from '../src/startup/lifecycle.js';
import {ProgressWatchdog} from '../src/gpu/progress-watchdog.js';
import {parallelTasks} from '../src/gpu/pipeline-library.js';
import {analyzeShaderDeclarations,partitionShaderProgram,shaderPartition} from '../src/gpu/shader-partitions.js';
import {shaderProgram,kernels,resourcesForEntry} from '../src/gpu/shader-library.js';
import {shaderLocation} from '../src/gpu/shader-diagnostics.js';
import {viewFeatures,entryEnabled} from '../src/gpu/view-features.js';
import {decodeExportTemplate} from '../src/designer/export-template.js';
import {createDesignerWorkbench} from '../src/designer/workbench.js';
import {designerExamples} from '../designer/examples.js';
import {checkFunctionCalls,checkFunctionGraph} from '../tools/check-wgsl-graph.mjs';
const shaders=Object.fromEntries(await Promise.all((await readdir(new URL('../shaders/',import.meta.url))).filter(n=>n.endsWith('.wgsl')).map(async n=>[n.slice(0,-5),await readFile(new URL('../shaders/'+n,import.meta.url),'utf8')])));
const program=shaderProgram(shaders,{VIEW_FEATURES:511}),groups=partitionShaderProgram(program,kernels);
const original=analyzeShaderDeclarations(program.code);
test('all core entry closures retain exact function tokens, dependencies and resource bindings',()=>{
 let checked=0;
 for(const group of groups.values()){
  assert.deepEqual(checkFunctionCalls(group.code),[]);assert.deepEqual(checkFunctionGraph(group.code),[]);
  const parsed=analyzeShaderDeclarations(group.code);
  for(const [name,item] of parsed.functions){const prior=original.functions.get(name);assert.ok(prior,name);assert.equal(group.code.slice(item.start,item.end).trim(),program.code.slice(prior.start,prior.end).trim(),name);}
  for(const entry of group.entries){assert.deepEqual(resourcesForEntry(group.code,entry),resourcesForEntry(program.code,entry),entry);checked++;}
 }
 assert.equal(checked,kernels.length);assert.equal(groups.size,54);
});
test('layout, raster and asset programs exclude unrelated designer/edit interpreters',()=>{
 for(const groupName of ['layout','raster','flatten'])assert.doesNotMatch(groups.get(groupName).code,/fn (?:dsCommand|editorCommand)\(/);
 assert.ok(groups.get('flatten').code.length<10000);assert.ok(groups.get('input').code.length<program.code.length*.60);
});
test('input and emission roots cannot re-inline the large shaping and designer interpreters',()=>{
 assert.doesNotMatch(groups.get('input').code,/fn (?:shapeRun|executeEditorCommand|executeDsCommand\d*)\(/);
 assert.match(groups.get('typography').code,/fn shapeRun\(/);
 assert.doesNotMatch(groups.get('emit').code,/fn dsDraw(?:Inspector|Timeline|Surface)\(/);
 for(let family=0;family<7;family++){
  const code=groups.get(`applyDesignerCommands${family}`).code;
  for(let other=0;other<7;other++)assert.equal(code.includes(`fn executeDsCommand${other}(`),family===other);
 }
});
test('text measurement and control emission bound expensive interpreter call sites',()=>{
 const body=name=>{const f=original.functions.get(name);return program.code.slice(f.start,f.end);};
 assert.equal((body('measure').match(/naturalText\(/g)||[]).length,1);
 assert.equal((body('emitGridParts').match(/emitGridSection\(/g)||[]).length,1);
 assert.doesNotMatch(groups.get('input').code,/fn handleKey\(/);
 assert.match(groups.get('applyCoreKey').code,/fn handleKey\(/);
 for(const name of ['emit','emitButton','emitCheckBox','emitDrawingNode'])assert.doesNotMatch(groups.get(name).code,/fn emitTextBox\(/);
 for(const family of [0,2,3,4,5,6])assert.doesNotMatch(groups.get(`applyDesignerCommands${family}`).code,/fn dsFinishEdit\(/);
 assert.match(groups.get('finishDesignerEdit').code,/fn dsFinishEdit\(/);
});
test('partitioned diagnostics map every retained function definition to its original file and line',()=>{
 for(const group of groups.values())for(const [name,item] of analyzeShaderDeclarations(group.code).functions){
  const local=group.code.indexOf('fn '+name+'(',item.start);const global=program.code.indexOf('fn '+name+'(',original.functions.get(name).start);
  assert.ok(local>=0&&global>=0,name);
  const a=shaderLocation(group,group.code.slice(0,local).split('\n').length,1),b=shaderLocation(program,program.code.slice(0,global).split('\n').length,1);
  assert.equal(a.file,b.file,name);assert.equal(a.line,b.line,name);
 }
});
test('partitioner handles attributes, braces in nested comments, structs and directives',()=>{
 const code='enable f16;\n/* fn misleading() { /* } */ } */\nstruct Item { value:u32 }\n@compute @workgroup_size(1)\nfn main(){ helper(); }\nfn helper(){}\nfn unused(){}\n';
 const result=partitionShaderProgram({code,sections:[{name:'test.wgsl',startLine:1,endLine:9}]},['main']).get('main');
 assert.match(result.code,/@compute @workgroup_size\(1\)/);assert.match(result.code,/fn helper/);assert.doesNotMatch(result.code,/fn unused/);assert.match(result.code,/enable f16/);assert.match(result.code,/struct Item/);
});
for(const [name,code,message] of [
 ['direct recursion','fn main(){main();}',/Recursive/],['indirect recursion','fn main(){a();}fn a(){main();}',/Recursive/],
 ['duplicate functions','fn main(){}fn main(){}',/Duplicate/],['unbalanced body','fn main(){',/Unbalanced/],
 ['unterminated comment','/* fn main(){}',/Unterminated/],['unterminated declaration','var value:u32',/Unterminated/]
])test(`partitioner rejects ${name}`,()=>assert.throws(()=>partitionShaderProgram({code,sections:[]},['main']),message));
test('data pipelines are omitted from Studio, but retained by presenters for dynamic children',()=>{
 const flags=viewFeatures(createDesignerWorkbench(designerExamples[0],{examples:designerExamples}));
 assert.ok(flags&32);assert.equal(flags&64,0);
 for(const n of ['initializeData','sortBlocks','mergeRows','emitGridParts'])assert.equal(entryEnabled(n,flags),false);
 const presenter=viewFeatures({type:'SurfacePresenter',props:{},children:[]});assert.ok(presenter&64);assert.equal(entryEnabled('sortBlocks',presenter),true);
 assert.equal(shaderPartition('measure'),'layout');
});
test('Studio starts with source descriptors, worker compilation and built-in-only cache opt-in',async()=>{
 const app=await readFile(new URL('../designer/app.js',import.meta.url),'utf8');
 assert.doesNotMatch(app,/await fonts\(|loadFonts/);assert.match(app,/fontSources:fontSources\|\|DESIGNER_FONT_SOURCES/);assert.match(app,/designerExamples\.some\(example=>example===project\)/);
 assert.match(app,/signal:controller.signal/);assert.match(app,/boundedWait\(surface.whenSubmittedWorkDone/);
});
test('bounded wait returns completed work without converting success into timeout',async()=>assert.equal(await boundedWait(Promise.resolve(42),{timeoutMs:50,stage:'test'}),42));
test('cancelled wait rejects promptly and destroys a late device exactly once',async()=>{
 const c=new AbortController();let resolve,destroyed=0;const p=new Promise(r=>resolve=r);
 const wait=boundedWait(p,{signal:c.signal,onLate:d=>d.destroy()});c.abort(new Error('cancelled startup'));
 await assert.rejects(wait,/cancelled startup/);resolve({destroy(){destroyed++;}});await Promise.resolve();assert.equal(destroyed,1);
});
test('already cancelled wait observes subsequent rejection without an unhandled promise',async()=>{
 const c=new AbortController();c.abort(new Error('stop'));await assert.rejects(boundedWait(Promise.reject(new Error('late native error')),{signal:c.signal}),/stop/);
});
test('pipeline deadline reports exact stage, but does not claim to cancel driver execution',async()=>{
 const keepAlive=setTimeout(()=>{},50);try{await assert.rejects(boundedWait(new Promise(()=>{}),{timeoutMs:5,stage:'shader input'}),e=>e instanceof StartupTimeoutError&&e.stage==='shader input'&&e.timeoutMs===5);}finally{clearTimeout(keepAlive);}
});
test('startup scope propagates abort and releases parent signal listener after successful preparation',()=>{
 const a=new AbortController(),s=startupScope({signal:a.signal,startupTimeoutMs:0});a.abort(new Error('parent'));assert.equal(s.signal.reason.message,'parent');s.dispose();
 const b=new AbortController(),t=startupScope({signal:b.signal,startupTimeoutMs:0});t.dispose();b.abort();assert.equal(t.signal.aborted,false);
});
test('startup deadline reports the last phase and cannot keep a process alive on its own',async()=>{
 const s=startupScope({startupTimeoutMs:5});s.stage('scene upload');const keepAlive=setTimeout(()=>{},50);
 try{await assert.rejects(boundedWait(new Promise(()=>{}),{signal:s.signal}),/scene upload/);}finally{s.dispose();clearTimeout(keepAlive);}
});
test('deadline settings reject nonfinite or unreasonable values and support explicit disable',()=>{
 for(const bad of [-1,NaN,Infinity,600001])assert.throws(()=>timeoutOption(bad,100,'test'),RangeError);
 assert.equal(timeoutOption(undefined,100,'test'),100);assert.equal(timeoutOption(0,100,'test'),0);
});
test('fail-fast compilation stops starting additional tasks after the first failure',async()=>{
 const started=[];const tasks=Array.from({length:20},(_,i)=>async()=>{started.push(i);if(i===0)throw new Error('bad pipeline');});
 await assert.rejects(parallelTasks(tasks,2,()=>{},{failFast:true}),/bad pipeline/);assert.ok(started.length<=2);
});
test('cancelled compilation does not start queued tasks',async()=>{
 const c=new AbortController();c.abort(new Error('cancelled'));let count=0;
 await assert.rejects(parallelTasks([async()=>count++],1,()=>{},{failFast:true,signal:c.signal}),/cancelled/);assert.equal(count,0);
});
function watchdog(){let now=0,id=0;const jobs=new Map(),events=[];const w=new ProgressWatchdog({timeoutMs:10,now:()=>now,onStall:e=>events.push(e),schedule:fn=>{jobs.set(++id,fn);return id;},cancel:id=>jobs.delete(id)});return{w,events,jobs,tick(){now+=10;for(const [id,fn]of [...jobs]){jobs.delete(id);fn();}}};}
test('watchdog stops at one notification stall without inventing completion credit',()=>{const {w,events,tick,jobs}=watchdog();w.submitted(1);w.submitted(2);assert.equal(jobs.size,1);tick();assert.equal(events.length,1);assert.equal(w.acknowledged,0);assert.equal(events[0].submitted,2);w.submitted(3);tick();assert.equal(events.length,1);w.dispose();});
test('progress re-arms a pending tail and old acknowledgements never postpone a stall',()=>{const{w,events,tick,jobs}=watchdog();w.submitted(3);w.completed(2);assert.equal(jobs.size,1);w.completed(1);tick();assert.equal(events[0].acknowledged,2);w.dispose();});
test('completed work cancels watchdog and stop/dispose do not resurrect callbacks',()=>{const{w,events,tick,jobs}=watchdog();w.submitted(1);w.completed(1);assert.equal(jobs.size,0);w.submitted(2);w.dispose();tick();w.submitted(3);assert.equal(events.length,0);assert.equal(jobs.size,0);});
test('hidden-page suspension is not falsely reported as a GPU hang',()=>{const{w,events,tick}=watchdog();w.submitted(1);w.suspend();tick();assert.equal(events.length,0);w.suspend(false);tick();assert.equal(events.length,1);w.dispose();});
test('optional export payload decompresses losslessly, including non-ASCII text',async()=>{const text='<html>App × 日本語 é</html>';assert.equal(await decodeExportTemplate(gzipSync(text).toString('base64')),text);});
test('invalid compressed export data fails explicitly rather than producing an empty app',async()=>{await assert.rejects(decodeExportTemplate('not gzip'));await assert.rejects(decodeExportTemplate(null),RangeError);});
