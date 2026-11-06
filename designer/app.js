import {startWorkspace,navigateWorkspace} from '../src/platform/workspace.js';
import {decodeExportTemplate} from '../src/designer/export-template.js';
import {boundedWait} from '../src/startup/lifecycle.js';
import {BUILD_VERSION} from '../src/version.js';
import {HelionSurface} from '../src/index.js';
import {DesignDocument,generateDesignSource} from '../src/designer/index.js';
import {createDesignerWorkbench,DESIGNER_FONT_SOURCES,DESIGNER_PANES} from '../src/designer/workbench.js';
import {makeDesignAppHTML} from '../src/designer/export.js';
import {designerExamples,blankDesign} from './examples.js';
import {designTemplateCatalog,DESIGN_TEMPLATE_LIBRARY} from '../src/designer/template-catalog.js';
import {templateToDesignProject,designProjectToTemplate} from '../src/designer/template-tools.js';

// Visible controls are Helion nodes. DOM is restricted to the canvas, startup
// failure notice, and operating-system file/font input bridges.
const $=id=>document.getElementById(id);
let surface=null,epoch=0,bootAbort=null,fontSources=null,lastProject=designerExamples[0];
let partSession=null,selectedTemplate=0;
let pendingProject=null,logs=[],logTimer=null,templatePromise=null,operation=Promise.resolve();
const clipped=(v,n=500)=>Array.from(String(v)).slice(0,n).join('');
function notice(message){$('boot').hidden=false;$('boot-detail').textContent=message;}
function status(message){if(surface&&!surface.disposed)surface.setText('designer-status',clipped(message));}
function log(message){logs.push(clipped(message,2000));while(logs.length>80||logs.join('\n').length>48000)logs.shift();if(!logTimer)logTimer=setTimeout(()=>{logTimer=null;try{surface?.editor('designer-log').replaceDocument(logs.join('\n\n'));}catch(error){console.warn(error);}},40);}
function pane(id){if(surface)surface.docking('designer-dock').command('reopen',id).command('activate',id);}
function keyboard(e){const control=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();
 if(control&&e.altKey&&key==='f'){e.preventDefault();$('font-files').click();return true;}
 if(control&&key==='o'){e.preventDefault();$('open-file').click();return true;}
 if(control&&key==='s'){e.preventDefault();enqueue(()=>save());return true;}
 if(control&&e.key==='Enter'){e.preventDefault();surface?.designer('design').command('preview');return true;}
 if(e.key==='F1'){e.preventDefault();pane('help-pane');return true;}return false;
}
function enqueue(task){operation=operation.then(task,task).catch(error=>{log(error.stack||error.message);status('Operation rejected · see Diagnostics');pane('log-pane');console.error(error);});return operation;}
async function boot(project=lastProject){
 const normalized=DesignDocument({...project,templates:project.templates??DESIGN_TEMPLATE_LIBRARY,templateCapacity:project.templateCapacity??8});const {flat,...data}=normalized;lastProject=data;const token=++epoch;bootAbort?.abort(new Error('Superseded designer startup'));const controller=new AbortController();bootAbort=controller;let next;
 notice('Loading real font outlines and preparing the compute designer…');
 try{
  next=await HelionSurface.mount($('designer-canvas'),createDesignerWorkbench(data,{examples:designerExamples}),{
   // Keep static Latin labels in retained GPU runs too, instead of remapping
   // glyphs and applying kerning during every display-list emission.
   textShaping:'opentype',fontSources:fontSources||DESIGNER_FONT_SOURCES,limits:{maxHeapWords:25165824,maxNodes:512,maxDepth:24},startupWorker:true,
   // Persist only public built-in starter documents, never imported user work.
   startupCache:!fontSources&&designerExamples.some(example=>example===project)?'designer-public-examples-v1':false,
   signal:controller.signal,startupTimeoutMs:60000,pipelineTimeoutMs:30000,gpuWatchdogMs:10000,
   autoStart:false,submissionMode:'vsync',maxFramesInFlight:2,performanceHUD:false,
   profiling:true,gpuTiming:true,timingDetail:'off',textQuality:'sharp',resolutionMode:'native',
   onAction:event=>enqueue(()=>action(event)),onKey:keyboard,
   onStartup:event=>{if(token===epoch){if(event.stage==='ready')$('boot').hidden=true;else notice(event.detail||event.stage);}},
   onError:error=>{if(token===epoch){notice(error.message);log(error.message);}},onDiagnosticsError:error=>log(error.message)
  });if(token!==epoch){next.dispose();return;}
  surface=next;globalThis.helionDesigner=surface;surface.render(performance.now());await boundedWait(surface.whenSubmittedWorkDone(),{signal:controller.signal,timeoutMs:15000,stage:'first designer frame'});
  if(token!==epoch)return;if(surface.faulted)throw new Error(surface.errors.join('\n'));
  startWorkspace(surface);$('boot').hidden=true;status('Ready · GPU design document · click Assets to create · Ctrl/Cmd+S saves');
  if(data.templates?.length&&data.templates[selectedTemplate])surface.editor('template-json').replaceDocument(JSON.stringify(data.templates[selectedTemplate],null,2));
  log(`Opened ${data.title}. Pointer manipulation, history, keyframes, properties and rendering remain device-owned.`);
  if(partSession&&!partSession.baseline){partSession.baseline=await snapshot();pane('templates-pane');status('Template part editor · Save parts commits to the original project; Back cancels');}
 }catch(error){next?.dispose();if(token===epoch){surface=null;notice(`${error.message}\n\nBuild: ${BUILD_VERSION}.\nWebGPU is required. Ctrl/Cmd+Alt+F selects local static fonts. No CPU-rendered substitute is used.`);console.error(error);}}
}
async function snapshot(){if(!surface)throw new Error('Designer is not ready');return surface.designer('design').snapshot();}
function download(filename,contents,mime){const url=URL.createObjectURL(new Blob([contents],{type:mime}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
const baseName=project=>String(project.title||'helion-design').replace(/[^a-z0-9_-]+/gi,'-').slice(0,90);
async function save(){const s=await snapshot();download(baseName(s.project)+'.helion.json',JSON.stringify(s.project,null,2),'application/json');status(`Saved GPU project revision ${s.revision} · ${s.rejectedOperations} rejected operations`);}
async function template(){
 if(globalThis.__HELION_DESIGN_EXPORT_TEMPLATE__)return globalThis.__HELION_DESIGN_EXPORT_TEMPLATE__;
 return templatePromise??=(globalThis.__HELION_DESIGN_EXPORT_GZIP__?
  decodeExportTemplate(globalThis.__HELION_DESIGN_EXPORT_GZIP__):fetch('./export-template.html').then(r=>{if(!r.ok)throw new Error(`Export template HTTP ${r.status}. Run npm run build, or use the standalone designer.`);return r.text();}))
  .catch(error=>{templatePromise=null;throw error;});
}

function requestReplace(project){if(partSession)throw new Error('Save template parts or Back / cancel before replacing the project');const {flat,...p}=DesignDocument(project);pendingProject=p;if(!surface)return boot(p);surface.model('shell').execute('confirm');}
async function replace(project){surface?.dispose();surface=null;pendingProject=null;await boot(project);}
async function readTemplate(index){const saved=await snapshot();const catalog=saved.project.templates??[];if(!catalog[index])throw new RangeError('Select a template from the prepared catalog');selectedTemplate=index;surface.editor('template-json').replaceDocument(JSON.stringify(catalog[index],null,2));pane('templates-pane');return saved;}
async function applyTemplateJSON(){if(partSession)throw new Error('Save parts or Back first; JSON applies to the main catalog');const editor=await surface.editor('template-json').snapshot();const saved=await snapshot();const catalog=[...(saved.project.templates??[])];const item=JSON.parse(editor.text);if(selectedTemplate>=catalog.length)throw new RangeError('Choose a catalog template first');const oldName=catalog[selectedTemplate].name;catalog[selectedTemplate]=item;designTemplateCatalog(catalog,saved.project.templateCapacity);if(item.name!==oldName){const rename=n=>{if(n.props?.template===oldName)n.props.template=item.name;for(const c of n.children??[])rename(c);};rename(saved.project.root);}await replace({...saved.project,templates:catalog});pane('templates-pane');status('Validated template catalog applied · project and templates saved together; history restarted');}
async function copyTemplate(){if(partSession)throw new Error('Save or cancel parts first');const saved=await snapshot(),catalog=[...(saved.project.templates??[])];if(catalog.length>=8)throw new RangeError('Catalog capacity is eight templates');const item=structuredClone(catalog[selectedTemplate]??DESIGN_TEMPLATE_LIBRARY[0]);let i=1;const base=item.name;while(catalog.some(t=>t.name===base+'Copy'+i))i++;item.name=base+'Copy'+i;catalog.push(item);selectedTemplate=catalog.length-1;await replace({...saved.project,templates:catalog,templateCapacity:saved.project.templateCapacity??8});await readTemplate(selectedTemplate);}
async function removeTemplate(){if(partSession)throw new Error('Save or cancel parts first');const saved=await snapshot(),catalog=[...(saved.project.templates??[])],item=catalog[selectedTemplate];if(!item)throw new Error('Choose a catalog item');const uses=n=>n.props?.template===item.name||(n.children??[]).some(uses);if(uses(saved.project.root))throw new Error('Remove this template from its authored instances before removing the catalog item');catalog.splice(selectedTemplate,1);selectedTemplate=Math.max(0,selectedTemplate-1);await replace({...saved.project,templates:catalog});pane('templates-pane');}
async function editTemplateParts(index){if(partSession)throw new Error('Save or cancel the current part edit first');const saved=await readTemplate(index);const entry=templateToDesignProject(saved.project.templates[index],{theme:saved.project.theme,themeVariant:saved.project.themeVariant,themeContrast:saved.project.themeContrast,controlDensity:saved.project.controlDensity,accentColor:saved.project.accentColor});partSession={...entry,original:saved.project,index,baseline:null};await replace(entry.project);}
async function finishTemplateParts(commit){if(!partSession)throw new Error('No visual template edit is active');const session=partSession;let project=session.original;
 if(commit){const edited=await snapshot();const template=designProjectToTemplate(session,edited);const catalog=[...project.templates];catalog[session.index]=template;designTemplateCatalog(catalog,project.templateCapacity);project={...project,templates:catalog};}
 partSession=null;await replace(project);pane('templates-pane');status(commit?'Visual template parts committed · original project restored; history restarted':'Template edit cancelled · original project restored');}
async function action(event){if(!surface)return;
 switch(event.name){
  case 'typography':navigateWorkspace('typography',globalThis.__HELION_SHADERS__?'./helion-typography.html':'../typography/');return;
  case 'template-copy':return copyTemplate();
  case 'template-remove':return removeTemplate();
  case 'template-json':if(partSession)throw new Error('Save or cancel parts before editing catalog JSON');return readTemplate(event.value);
  case 'template-apply-json':return applyTemplateJSON();
  case 'template-parts':return editTemplateParts(event.value);
  case 'template-save-parts':return finishTemplateParts(true);
  case 'template-back':return finishTemplateParts(false);
  case 'new':return requestReplace(blankDesign());
  case 'example':if(designerExamples[event.key])return requestReplace(designerExamples[event.key]);return;
  case 'confirm-replace':if(pendingProject)return replace(pendingProject);return;
  case 'open':$('open-file').click();return;
  case 'save':return save();
  case 'source':{const s=await snapshot();surface.editor('generated-source').replaceDocument(generateDesignSource(s.project));pane('source-pane');status(`Generated from revision ${s.revision}`);return;}
  case 'snapshot-json':{const s=await snapshot();surface.editor('project-json').replaceDocument(JSON.stringify(s.project,null,2));pane('project-pane');status(`JSON snapshot of revision ${s.revision}`);return;}
  case 'apply-json':{const s=await surface.editor('project-json').snapshot();const p=JSON.parse(s.text);await surface.designer('design').restore(p);const result=await snapshot();if(result.lastError)throw new Error(`GPU rejected project (${result.lastError})`);status('Applied validated project · design history restarted');pane('artboard-pane');return;}
  case 'export-js':{const s=await snapshot();download(baseName(s.project)+'.js',generateDesignSource(s.project),'text/javascript');status('Exported native Helion ES module');return;}
  case 'export-html':{const s=await snapshot();download(baseName(s.project)+'.html',makeDesignAppHTML(await template(),s.project),'text/html');status('Exported standalone app · fonts load at runtime or through local selection');return;}
  case 'reopen':for(const id of DESIGNER_PANES)surface.docking('designer-dock').command('reopen',id);return;
  case 'help':pane('help-pane');return;
  case 'playground':navigateWorkspace('playground',(globalThis.__HELION_DESIGN_EXPORT_TEMPLATE__||globalThis.__HELION_DESIGN_EXPORT_GZIP__)?'./helion-playground.html':'../playground/');return;
  case 'fonts':$('font-files').click();return;
  case 'hud':surface.setPerformanceHUD(event.value>.5);return;
  case 'asap':surface.setSubmissionMode(event.value>.5?'asap':'vsync');return;
  case 'resolution':surface.setResolutionMode(event.value?'balanced':'native');return;
  case 'quality':surface.setTextQuality(event.value?'reference':'sharp');return;
  case 'timing':surface.setTimingDetail(['off','frame','stages'][event.value]||'off');return;
  case 'sync':log(JSON.stringify({startup:surface.startup,frames:surface.inspectFrameSync(),resolution:surface.resolution},null,2));pane('log-pane');return;
  case 'counters':{const s=await snapshot();const perf=await surface.inspectPerformance();log(JSON.stringify({design:{revision:s.revision,rejections:s.rejectedOperations,lastError:s.lastError},performance:perf},null,2));pane('log-pane');return;}
 }
}
$('open-file').addEventListener('change',()=>enqueue(async()=>{try{const file=$('open-file').files[0];if(!file)return;if(file.size>4*1024*1024)throw new RangeError('Project import is limited to 4 MiB');await requestReplace(JSON.parse((await file.text()).replace(/^\ufeff/,'')));}finally{$('open-file').value='';}}));
$('font-files').addEventListener('change',()=>enqueue(async()=>{try{const selected=[...$('font-files').files];if(!selected.length)return;if(selected.length>8)throw new RangeError('Select 1–8 static font faces');const project=surface?(await snapshot()).project:lastProject;fontSources=selected.map(source=>({source,family:'Noto Sans'}));await replace(project);}finally{$('font-files').value='';}}));
document.addEventListener('keydown',e=>{if(!e.defaultPrevented)keyboard(e);});
addEventListener('pagehide',()=>{epoch++;bootAbort?.abort(new Error('Designer page closed'));clearTimeout(logTimer);surface?.dispose();});
boot();
