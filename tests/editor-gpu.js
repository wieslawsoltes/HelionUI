/** Native gate. Never imported by the application or used for normal-frame polling. */
import {h,HelionSurface,DockTabs,defineModel,field,computed,expr,modelBinding,Opcode} from '../src/index.js';
import {fixtureFont} from './font-fixture.mjs';
import {ED} from '../src/editor/schema.js';
const canvas=document.querySelector('#canvas'),output=document.querySelector('#log'),button=document.querySelector('#run');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};
async function pixels(s){const {w,h}=s.viewport,stride=Math.ceil(w*4/256)*256,b=s.device.createBuffer({size:stride*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{const encoder=s.device.createCommandEncoder();encoder.copyTextureToBuffer({texture:s.output},{buffer:b,bytesPerRow:stride},[w,h]);s.device.queue.submit([encoder.finish()]);await b.mapAsync(GPUMapMode.READ);const data=new Uint8Array(b.getMappedRange()),result=new Uint8Array(w*h*4);for(let y=0;y<h;y++)result.set(data.subarray(y*stride,y*stride+w*4),y*w*4);return result;}finally{b.destroy();}}
export async function runEditorGate(){
 button.disabled=true;const result={status:'RUNNING',scope:'Native WebGPU editor/model/docking correctness; not performance or complete IDE qualification',checks:[],started:new Date().toISOString()};globalThis.__HELION_EDITOR_RESULT__=result;let surface;
 const pass=name=>{result.checks.push(name);output.textContent=JSON.stringify(result,null,2);};
 try{
  const model=defineModel({count:field('i32',2),twice:computed('i32',expr.mul(expr.ref('count'),2)),allowed:computed('bool',expr.lt(expr.ref('count'),10))},{commands:{increment:{canExecute:expr.ref('allowed'),assign:{count:expr.add(expr.ref('count'),expr.arg())}}}});
  const editorOptions={documentCapacity:4096,historyCapacity:32768,editorLineHeight:20,fontSize:14,autoClosingBrackets:false};
  const view=h('Grid',{rows:'36 *',models:{vm:model},background:'#101923'},
   h('TextBlock',{text:'Twice ',bind:modelBinding('vm','twice')}),
   h('DockWorkspace',{id:'dock',row:1,dockBreakpoint:600,dockPrimary:'a-pane',dockLayout:DockTabs(['a-pane','b-pane'])},
    h('DockItem',{id:'a-pane',title:'app.js'},h('CodeEditor',{id:'a',text:'const value = 2;\nvalue += 1;\n',...editorOptions})),
    h('DockItem',{id:'b-pane',title:'notes.txt'},h('TextEditor',{id:'b',text:'Notes\n',...editorOptions}))));
  surface=await HelionSurface.mount(canvas,view,{fonts:[fixtureFont()],startupWorker:false,autoStart:false,input:false,performanceHUD:false,gpuTiming:false,pixelRatio:1});result.adapter=surface.adapterInfo;
  let now=surface.startTime;const step=async(dt=16)=>{const before=surface.stats.readbackBytes;assert(surface.render(now+=dt),'Frame not admitted');await surface.whenSubmittedWorkDone();assert(before===surface.stats.readbackBytes,'Unexpected ordinary-frame readback');assert(!surface.faulted,surface.errors.join('\n'));};
  await step();const a=surface.editor('a'),b=surface.editor('b'),dock=surface.docking('dock');
  let snapshot=await a.snapshot();assert(snapshot.text==='const value = 2;\nvalue += 1;\n'&&snapshot.lineCount===3&&snapshot.visualLineCount===3,'Initial text or visual line indexing');pass('Native initial editor document and visible-line indexing');
  a.replaceDocument('abcdef');await step();a.select(1).select(5,5,true).insert('!');await step();assert((await a.snapshot()).text==='a!bcde!f','Multicaret insertion');a.command('undo');await step();assert((await a.snapshot()).text==='abcdef','Transaction undo');a.command('redo');await step();assert((await a.snapshot()).text==='a!bcde!f','Transaction redo');pass('Multicaret edit, grouped undo, redo, and no normal-frame readback');
  a.replaceDocument('cat cat cat');await step();a.search('cat').setReplacement('dog');await step();await step();a.command('replaceAll');await step();assert((await a.snapshot()).text==='dog dog dog','Replace-all');a.command('undo');await step();assert((await a.snapshot()).text==='cat cat cat','Replace-all undo');pass('Resident literal search, replacement, and history');
  a.replaceDocument('');await step();a.insertSnippet('${1:item} + $1 = $0');await step();snapshot=await a.snapshot();assert(snapshot.text==='item + item = '&&snapshot.selections.length===2,'Linked snippet stops');surface.send(Opcode.Text,{target:surface.id('a'),c:88});await step();assert((await a.snapshot()).text==='X + X = ','Linked snippet edit');pass('Snippet expansion and linked multicaret editing');
  surface.model('vm').set('count',5).execute('increment',2);await step();let vm=await surface.model('vm').snapshot();assert(vm.fields.count[0]===7&&vm.fields.twice[0]===14,'Derived field update');surface.model('vm').set('count',10).execute('increment',1);await step();vm=await surface.model('vm').snapshot();assert(vm.fields.count[0]===10&&vm.fields.twice[0]===20,'Command used stale computed guard');assert(vm.errors.every(v=>v===0),'Model evaluation error');pass('Typed model storage, derived expressions, and fresh CanExecute guard');
  const layout=await dock.snapshot(),savedA=(await a.snapshot()).text;dock.command('activate','b-pane');await step();b.select(5).insert(' edited');await step();dock.command('float','a-pane');await step();dock.command('splitHorizontal','b-pane',0);await step();dock.command('close','a-pane');await step();dock.command('reopen','a-pane');await step();await dock.restore(layout);await step();assert((await a.snapshot()).text===savedA,'Docking lost first document');assert((await b.snapshot()).text==='Notes edited\n','Docking lost second document');pass('Tab, float, split, close/reopen, and layout restoration preserve documents');
  const desktopBefore=await dock.snapshot();canvas.style.width='390px';surface.resizePending=true;await step();await step();
  let compact=await surface.inspect();let rects=new Float32Array(compact.nodes.buffer);const aNode=surface.id('a-pane'),bNode=surface.id('b-pane');
  assert(Math.abs(rects[aNode*72+54]-surface.viewport.width)<1,`Compact pane width ${rects[aNode*72+54]}, other ${rects[bNode*72+54]}, viewport ${JSON.stringify(surface.viewport)}`);
  assert(rects[bNode*72+54]===0,'Inactive compact pane remains visible');
  surface.send(Opcode.Down,{x:30,y:50});await step();surface.send(Opcode.Up,{x:30,y:50});await step();
  const responsive=surface.manifest.docks[0];const header=new Uint32Array(await surface.readHeapRange(responsive.pointer,16));
  let config=new Uint32Array(await surface.readHeapRange(header[15],4));assert(config[2]===1,'Compact view picker did not open');
  surface.send(Opcode.Down,{x:30,y:118});await step();surface.send(Opcode.Up,{x:30,y:118});await step();
  config=new Uint32Array(await surface.readHeapRange(header[15],4));assert(config[1]===bNode&&config[2]===0,'Compact view picker did not select the second pane');
  compact=await surface.inspect();rects=new Float32Array(compact.nodes.buffer);assert(Math.abs(rects[bNode*72+54]-surface.viewport.width)<1,'Selected compact pane is not full width');
  assert((await a.snapshot()).text===savedA&&(await b.snapshot()).text==='Notes edited\n','Responsive layout changed document contents');
  canvas.style.width='640px';surface.resizePending=true;await step();await step();
  const desktopAfter=await dock.snapshot();assert(JSON.stringify(desktopBefore.nodes.map(n=>({...n,active:null})))===JSON.stringify(desktopAfter.nodes.map(n=>({...n,active:null}))),'Responsive layout modified desktop split topology');
  pass('GPU compact view picker, full-width panes, desktop topology and resident documents survive viewport changes');
  // Fixed animation time and unfocused editors remove caret blink as a comparison variable.
  surface.send(Opcode.Cancel);await step();const before=await pixels(surface);surface.options.damageTracking=false;await step(0);const full=await pixels(surface);assert(before.length===full.length&&before.every((value,index)=>value===full[index]),'Retained-damage and full rendering differ');assert(new Set(before).size>12,'Unexpectedly blank/unshaded output');pass('Native editor/docking cached-damage pixels equal the full-render reference');
  const state=await surface.inspect({includeNodes:false});assert(state.state[15]===0,`GPU arena overflow ${state.state[15]}`);const words=new Uint32Array(await surface.readHeapRange(a.meta.pointer,80));assert(words[ED.rejectedEdits]===0,'Unexpected rejected edit');result.status='PASS';
 }catch(error){result.status='FAIL';result.error=error.stack||String(error);}finally{surface?.dispose();button.disabled=false;result.finished=new Date().toISOString();output.textContent=JSON.stringify(result,null,2);}return result;
}
button.onclick=runEditorGate;
document.querySelector('#save').onclick=()=>{const result=globalThis.__HELION_EDITOR_RESULT__;if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='helion-editor-native-results.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
if(new URLSearchParams(location.search).has('autorun'))runEditorGate();
