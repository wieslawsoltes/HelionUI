import {HelionSurface} from '../src/index.js';
import {BUILD_VERSION} from '../src/version.js';
import {createHub,HUB_FONT_SOURCES,HUB_ROUTES} from '../src/hub/view.js';
import {routes,tests} from '../src/hub/catalog.js';
import {createWorkspaceHost} from './workspaces.js';
const $=id=>document.getElementById(id),entries=new Map();
let current='home',surface;
function navigate(route){
 if(!HUB_ROUTES.includes(route))return false;
 if(location.hash!=='#'+route)location.hash=route;
 return true;
}
const host=createWorkspaceHost({entries,active:()=>current,visible:()=>!document.hidden,navigate});
Object.defineProperty(window,'__HELION_WORKSPACE_HOST__',{value:host});
function showRoute(){
 const requested=location.hash.slice(1);current=HUB_ROUTES.includes(requested)?requested:'home';
 const workspace=Object.hasOwn(routes,current);
 document.body.dataset.workspace=String(workspace);$('workspaces').hidden=!workspace;
 if(workspace&&!entries.has(current)){
  const frame=document.createElement('iframe');frame.className='workspace-frame';frame.title='Helion '+routes[current].title;frame.src=routes[current].url;
  entries.set(current,{frame});$('workspaces').append(frame);
 }
 for(const[id,{frame}]of entries){frame.hidden=id!==current;frame.inert=id!==current;frame.setAttribute('aria-hidden',String(id!==current));}
 host.sync();
 if(surface){surface.model('navigation').set('route',HUB_ROUTES.indexOf(current));surface.resizePending=true;surface.invalidate();}
 document.title=(workspace?routes[current].title:current==='tests'?'Tests & diagnostics':'Overview')+' — Helion';
}
function openLink(url){window.open(url,'_blank','noopener');}
function action(event){
 if(event.name==='navigate')navigate(HUB_ROUTES[event.value]);
 if(event.name==='test'&&tests[event.value])openLink(new URL(`../tests/${tests[event.value][0]}.html`,import.meta.url).href);
 if(event.name==='link'){
  const links=['https://github.com/wieslawsoltes/HelionUI','https://github.com/wieslawsoltes/HelionUI#readme',new URL('../docs/VALIDATION.md',import.meta.url).href,'https://github.com/wieslawsoltes/HelionUI/actions'];
  if(links[event.value])openLink(links[event.value]);
 }
}
function fail(error){$('boot').hidden=false;$('boot-detail').textContent=`${error.message}\n\nBuild: ${BUILD_VERSION}.\nUse a WebGPU-enabled browser on localhost or HTTPS. No CPU-rendered fallback is used.`;console.error(error);}
addEventListener('hashchange',showRoute);
document.addEventListener('visibilitychange',()=>{host.sync();if(!document.hidden)surface?.invalidate();});
// The navigation surface is event-driven, with no idle rAF producer. Tools own
// their frame clocks; selecting a route never reads their GPU documents back.
try{
 surface=await HelionSurface.mount($('hub-canvas'),createHub(),{fontSources:HUB_FONT_SOURCES,textShaping:'opentype',startupWorker:true,startupCache:'helion-hub-v1',autoStart:false,performanceHUD:false,profiling:false,timingDetail:'off',onAction:action,onError:fail,onStartup:e=>{$('boot-detail').textContent=e.detail;}});
 globalThis.helionHub=surface;showRoute();
 surface.render(performance.now());await surface.whenSubmittedWorkDone();if(surface.faulted)throw new Error(surface.errors.join('\n'));
 $('boot').hidden=true;new ResizeObserver(()=>surface.invalidate()).observe($('hub-canvas'));
}catch(error){fail(error);}
