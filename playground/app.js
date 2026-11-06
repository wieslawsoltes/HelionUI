import {BUILD_VERSION} from '../src/version.js';
import {HelionSurface,loadFonts,FluentTheme} from '../src/index.js';
import {AppSandbox,validatePlaygroundView} from '../src/playground/sandbox.js';
import {AppCommandBudget,dispatchAppCommand} from '../src/playground/commands.js';
import {createGPUShell,DOCUMENT_IDS,PANE_IDS,INITIAL_ROWS} from '../src/playground/gpu-shell.js';
import {EDITOR_FONT_SOURCES} from '../src/playground/workbench.js';
import {encodeDataBatch} from '../src/data/index.js';
import {validateDockSnapshot} from '../src/docking/validation.js';
import {examples} from './examples.js';

// The DOM is only a canvas, a pre-GPU/error notice, hidden OS pickers/input and
// the execution sandbox. All visible workbench controls are retained Helion UI.
const $=id=>document.getElementById(id);
const limits={maxHeapWords:16777216,maxNodes:512,maxDepth:24,maxRows:65536};
let workbench=null,preview=null,sandbox=null,epoch=0,bootEpoch=0,bootController=null,autoRun=false;
let fontPromise=null,localFonts=null,bundlePromise=null,autoTimer=null,logTimer=null;
let logs=[],nextRow=100,patchSerial=0,appOperations=Promise.resolve(),pendingOperations=0;
const defaultBootData=Object.freeze({code:examples[0].code,css:examples[0].css});
let hud=false,design=[0,0],lastBootData=defaultBootData;
const text=(value,max=500)=>Array.from(String(value)).slice(0,max).join('');
function bootNotice(value){$('boot').hidden=false;$('boot-detail').textContent=value;}
function status(value){if(workbench&&!workbench.disposed)workbench.setText('runtime-status',text(value));}
function log(level,value){logs.push(`[${level}] ${text(value,3500)}`);while(logs.length>120||logs.join('\n').length>52000)logs.shift();if(!logTimer)logTimer=setTimeout(flushLogs,45);}
function flushLogs(){logTimer=null;if(!workbench||workbench.disposed)return;try{const value=logs.join('\n\n');workbench.editor('console-editor').replaceDocument(value).command('scrollToLine',value.split('\n').length);}catch(error){console.warn(error);}}
function fonts(){return fontPromise??=loadFonts(localFonts||EDITOR_FONT_SOURCES).catch(error=>{fontPromise=null;throw error;});}
function scheduleAutoRun(){clearTimeout(autoTimer);if(autoRun&&workbench)autoTimer=setTimeout(()=>run(),900);}
function showPane(id){if(!workbench)return;workbench.docking('workspace-dock').command('reopen',id).command('activate',id);}
function keyboard(event){const ctrl=event.ctrlKey||event.metaKey;const key=event.key.toLowerCase();
 if(ctrl&&event.altKey&&key==='f'){event.preventDefault();$('font-files').click();return true;}
 if(ctrl&&key==='o'){event.preventDefault();$('open-file').click();return true;}
 if(ctrl&&key==='s'){event.preventDefault();save();return true;}
 if(ctrl&&event.key==='Enter'){event.preventDefault();run();return true;}
 if(event.key==='F1'){event.preventDefault();showPane('help-pane');return true;}
 return false;
}
async function boot(data=lastBootData){
 bootController?.abort();const controller=new AbortController();bootController=controller;
 const token=++bootEpoch;lastBootData=data;bootNotice('Loading the real font and preparing compute pipelines…');
 let next;
 try{
  next=await HelionSurface.mount($('workbench'),createGPUShell({...data,examples}),{fontSources:localFonts||EDITOR_FONT_SOURCES,signal:controller.signal,startupCache:!localFonts&&data===defaultBootData?'playground-public-example-v1':false,limits,autoStart:false,startupWorker:true,maxFramesInFlight:2,submissionMode:'vsync',performanceHUD:false,profiling:true,gpuTiming:true,timingDetail:'off',onAction:action,onKey:keyboard,editorChangeEvents:false,onStartup:e=>{if(token===bootEpoch)bootNotice(e.detail);},onError:error=>{bootNotice(error.message);log('error',error.message);},onDiagnosticsError:error=>log('warning',error.message)});
  if(token!==bootEpoch){next.dispose();return;}
  workbench=next;globalThis.helionWorkbench=workbench;
  if(data.dataset)workbench.dataSource('dataset').replace(data.dataset);
  workbench.render(performance.now());await workbench.whenSubmittedWorkDone();
  if(token!==bootEpoch)return;if(workbench.faulted)throw new Error(workbench.errors.join('\n'));
  if(data.layout)await workbench.docking('workspace-dock').restore(data.layout);
  workbench.start();$('boot').hidden=true;status('Ready · all visible controls use Helion · Ctrl/Cmd+Enter runs');
  log('info','One canvas, one frame producer. Preview input and compositing stay on the GPU.');
 }catch(error){next?.dispose();if(token===bootEpoch){workbench=null;bootNotice(`${error.message}\n\nBuild: ${BUILD_VERSION}.\nUse Ctrl/Cmd+Alt+F to select local static fonts, or reload to retry. WebGPU is required.`);console.error(error);}}
}
async function readSource(){const owner=workbench;if(!owner)throw new Error('Workbench is not ready');return owner.platformSnapshot(async()=>{const code=await owner.editor(DOCUMENT_IDS.code)._snapshot();const css=await owner.editor(DOCUMENT_IDS.css)._snapshot();return {code:code.text,css:css.text,revisions:{code:code.revision,css:css.revision}};});}
async function readWorkspace(){
 const owner=workbench;if(!owner)throw new Error('Workbench is not ready');
 return owner.platformSnapshot(async()=>{const result={format:'helion-gpu-workspace-2',version:BUILD_VERSION,revisions:{}};
  for(const[key,id]of Object.entries(DOCUMENT_IDS)){const snapshot=await owner.editor(id)._snapshot();result[key]=snapshot.text;result.revisions[key]=snapshot.revision;}
  result.layout=await owner.docking('workspace-dock')._snapshot();result.dataset=(await owner.dataSource('dataset')._snapshot()).rows;return result;
 });
}
function stop({silent=false}={}){epoch++;clearTimeout(autoTimer);sandbox?.dispose();sandbox=null;preview=null;workbench?.detachSurface();appOperations=Promise.resolve();pendingOperations=0;status('Stopped · editor documents and history retained');if(!silent)log('info','Preview stopped; workspace state was not remounted.');}
async function authoringBundle(){return globalThis.__HELION_AUTHORING_SOURCE__||(await(bundlePromise??=fetch(new URL('./authoring.bundle.js',import.meta.url)).then(response=>{if(!response.ok)throw new Error(`Authoring bundle HTTP ${response.status}`);return response.text();}).catch(error=>{bundlePromise=null;throw error;})));}
async function run(){
 if(!workbench)return;stop({silent:true});const current=epoch;const budget=new AppCommandBudget();status('Reading source snapshot…');
 try{
  const data=await readSource();if(current!==epoch)return;const bundle=await authoringBundle();if(current!==epoch)return;
  log('info',`Run · source revision ${data.revisions.code}, styles ${data.revisions.css}`);showPane('preview-pane');
  sandbox=new AppSandbox({bundle,onMessage(type,message){
   if(current!==epoch)return;
   if(type==='log'){log(message.level||'log',message.text);return;}
   if(type==='error'){log('error',message.message);stop({silent:true});status('App error · see Console');showPane('console-pane');return;}
   if(type==='executed'){if(!preview&&pendingOperations===0)status('Waiting for app(view)');return;}
   if(type==='started')return;
   try{budget.accept(message);if(pendingOperations>=64)throw new RangeError('App exceeded 64 pending operations');pendingOperations++;}
   catch(error){log('error',error.message);stop({silent:true});return;}
   const apply=async()=>{try{
    if(current!==epoch)return;
    if(type==='view'){
     status('Attaching GPU preview…');const view=validatePlaygroundView(message.view);const faces=await fonts();if(current!==epoch)return;
     const next=await workbench.attachSurface('preview',view,{fonts:faces,styles:FluentTheme+'\n'+data.css,startupWorker:true,onAction:event=>{if(current===epoch)sandbox?.dispatchAction(event);},onError:error=>{if(current===epoch){log('error',error.message);status('Preview GPU error');}},onDiagnosticsError:error=>log('warning',error.message)});
     if(current!==epoch||!next)return;preview=next;workbench.setPresenterSize(...design);status('Running · shared device / queue · GPU-routed input');
     log('info',`Attached ${preview.manifest.nodeCount} views. Editor history and workspace remain resident.`);
    }else dispatchAppCommand(preview,type,message);
   }catch(error){if(current===epoch){log('error',error.stack||error.message);stop({silent:true});status('App operation rejected · see Console');showPane('console-pane');}}
   finally{if(current===epoch)pendingOperations--;}};
   appOperations=appOperations.then(apply,apply);
  }});sandbox.run(data.code);
 }catch(error){if(current===epoch){log('error',error.message);status('Run failed · see Console');showPane('console-pane');}}
}
function download(name,value,mime='application/json'){const url=URL.createObjectURL(new Blob([value],{type:mime}));const anchor=document.createElement('a');anchor.download=name;anchor.href=url;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
async function save(){try{download('helion-workspace.json',JSON.stringify(await readWorkspace(),null,2));status('Saved a consistent GPU workspace snapshot');}catch(error){log('error',error.message);}}
async function loadDocuments(data){
 if(!workbench)throw new Error('Workbench is not ready');if(!data||typeof data!=='object')throw new TypeError('Expected workspace object');
 const changes=Object.entries(DOCUMENT_IDS).filter(([key])=>data[key]!=null);
 for(const[key,id]of changes){if(typeof data[key]!=='string'||Array.from(data[key]).length>workbench.editor(id).meta.capacity||/[\ud800-\udfff]/u.test(data[key]))throw new RangeError(`${key} is invalid or exceeds 65,536 scalars`);}
 // Validate source and docking transactions before queuing document replacements.
 if(data.dataset){const controller=workbench.dataSource('dataset');if(!Array.isArray(data.dataset))throw new TypeError('Expected data rows');encodeDataBatch(controller.meta,[{type:'clear'},...data.dataset.map(row=>({type:'upsert',row}))]);}
 if(data.layout)validateDockSnapshot(data.layout,workbench.docking('workspace-dock').meta.panes.map(p=>p.id));
 clearTimeout(autoTimer);
 for(const[key,id]of changes)workbench.editor(id).replaceDocument(data[key]);
 if(data.dataset)workbench.dataSource('dataset').replace(data.dataset);
 if(data.layout)await workbench.docking('workspace-dock').restore(data.layout);
 showPane('source-pane');status('Loaded · source does not execute until Run');
}
async function action(event){
 if(!workbench)return;
 try{switch(event.name){
  case 'run':return run();case 'stop':stop();return;case 'save':return save();
  case 'open':$('open-file').click();return;case 'fonts':$('font-files').click();return;
  case 'export-js':download('app.js',(await readSource()).code,'text/javascript');return;
  case 'reopen':for(const pane of PANE_IDS)workbench.docking('workspace-dock').command('reopen',pane);return;
  case 'save-layout':download('helion-layout.json',JSON.stringify(await workbench.docking('workspace-dock').snapshot(),null,2));return;
  case 'load-layout':$('layout-file').click();return;
  case 'help':showPane('help-pane');return;
  case 'typography':location.href=globalThis.__HELION_AUTHORING_SOURCE__?'./helion-typography.html':'../typography/';return;
  case 'designer':location.href=globalThis.__HELION_AUTHORING_SOURCE__?'./helion-designer.html':'../designer/';return;
  case 'example':{const example=examples[event.key];if(!example)return;stop({silent:true});await loadDocuments({code:example.code,css:example.css});log('info','Loaded '+example.name+'. Press Run.');return;}
  case 'document':{const ids=['source-pane','style-pane','notes-pane','data-editor-pane','data-pane','model-pane','console-pane','help-pane','preview-pane'];if(ids[event.key])showPane(ids[event.key]);return;}
  case 'clear-log':logs=[];flushLogs();return;
  case 'inspect-model':log('snapshot',JSON.stringify(await workbench.model('workbench').snapshot()));return;
  case 'inspect-frames':log('host-only',JSON.stringify(workbench.inspectFrameSync()));return;
  case 'source-changed':scheduleAutoRun();return;
  case 'auto-run':autoRun=event.value>.5;workbench.options.editorChangeEvents=autoRun;if(!autoRun)clearTimeout(autoTimer);else scheduleAutoRun();status(autoRun?'Auto-run enabled':'Auto-run disabled');return;
  case 'hud':hud=event.value>.5;workbench.setPerformanceHUD(hud);return;
  case 'hud-toggle':hud=!hud;workbench.set('hud-option','value',hud?1:0);workbench.setPerformanceHUD(hud);return;
  case 'paced':workbench.setMaxFramesInFlight(event.value>.5?2:0);return;
  case 'asap':workbench.setSubmissionMode(event.value>.5?'asap':'vsync');return;
  case 'text-quality':workbench.setTextQuality(event.value?'reference':'sharp');status(event.value?'Reference: flattened curves / filtered HUD':'Sharp: device-space curves / pixel-exact HUD');return;
  case 'resolution':{workbench.setResolutionMode(event.value?'balanced':'native');status(event.value?'Balanced: capped backing pixels':'Native: device pixels within configured capacity');return;}
  case 'timing':workbench.setTimingDetail(['off','frame','stages'][event.value]||'off');return;
  case 'viewport':design=[[0,0],[960,640],[768,1024],[390,844]][event.value]||[0,0];if(preview)workbench.setPresenterSize(...design);status(design[0]?`Preview design size: ${design[0]} × ${design[1]}`:'Preview Fit · GPU-derived viewport / native scale');return;
  case 'apply-data':{const snapshot=await workbench.editor('data-editor').snapshot();const rows=JSON.parse(snapshot.text);workbench.dataSource('dataset').replace(rows);const result=await workbench.dataSource('dataset').snapshot();if(result.lastResult)throw new Error(`GPU rejected data operation (${result.lastResult})`);status(`Applied ${result.rows.length} keyed rows · revision ${result.revision}`);showPane('data-pane');return;}
  case 'snapshot-data':{const result=await workbench.dataSource('dataset').snapshot();workbench.editor('data-editor').replaceDocument(JSON.stringify(result.rows,null,2));showPane('data-editor-pane');log('snapshot',`Dataset revision ${result.revision}; rejected operations ${result.rejectedOperations}`);return;}
  case 'patch-data':workbench.dataSource('dataset').patch(1,{name:'GPU source patch '+(++patchSerial),value:patchSerial});return;
  case 'add-data':workbench.dataSource('dataset').upsert({id:nextRow,name:'Live item '+nextRow,value:nextRow,enabled:true});nextRow++;return;
  case 'remove-data':if(nextRow>100)workbench.dataSource('dataset').remove(--nextRow);return;
  case 'clear-data':workbench.dataSource('dataset').clear();return;
 }}catch(error){log('error',error.message);status('Operation rejected · see Console');showPane('console-pane');}
}
$('open-file').addEventListener('change',async()=>{try{const file=$('open-file').files[0];if(!file)return;if(file.size>4*1024*1024)throw new RangeError('Import limit is 4 MiB; documents remain capacity bounded');const value=(await file.text()).replace(/^\ufeff/,'');stop({silent:true});await loadDocuments(file.name.endsWith('.json')?JSON.parse(value):{code:value,css:''});}catch(error){log('error',error.message);}finally{$('open-file').value='';}});
$('layout-file').addEventListener('change',async()=>{try{const file=$('layout-file').files[0];if(file&&workbench){if(file.size>65536)throw new RangeError('Layout file exceeds 64 KiB');await workbench.docking('workspace-dock').restore(JSON.parse(await file.text()));}}catch(error){log('error',error.message);}finally{$('layout-file').value='';}});
$('font-files').addEventListener('change',async()=>{try{const files=[...$('font-files').files];if(!files.length)return;if(files.length>8)throw new RangeError('Choose 1–8 static faces');const data=workbench?await readWorkspace():lastBootData;stop({silent:true});workbench?.dispose();workbench=null;localFonts=files.map(source=>({source,family:'Noto Sans Mono'}));fontPromise=null;autoRun=false;hud=false;await boot(data);log('info','Font remount retained the snapshot; undo history was reset.');}catch(error){bootNotice(error.message);console.error(error);}finally{$('font-files').value='';}});
document.addEventListener('keydown',event=>{if(!event.defaultPrevented)keyboard(event);});
addEventListener('pagehide',()=>{bootEpoch++;bootController?.abort();stop({silent:true});clearTimeout(logTimer);workbench?.dispose();});
boot();
