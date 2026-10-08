import {BUILD_VERSION,HelionSurface} from '../src/index.js';
import {createTypographyLab,TYPOGRAPHY_FONT_SOURCES} from './view.js';
let surface=null,epoch=0,hud=false;const $=id=>document.getElementById(id);
function fail(error){$('boot').hidden=false;$('boot-title').textContent='Typography could not start';$('boot-detail').textContent=error.message+'\nBuild: '+BUILD_VERSION;console.error(error);}
function key(event){if((event.ctrlKey||event.metaKey)&&event.altKey&&event.key.toLowerCase()==='f'){event.preventDefault();$('font-files').click();return true;}return false;}
async function boot(fontSources=TYPOGRAPHY_FONT_SOURCES){const token=++epoch;surface?.dispose();surface=null;$('boot').hidden=false;
 try{const next=await HelionSurface.mount($('surface'),createTypographyLab(),{fontSources,startupWorker:true,autoStart:false,performanceHUD:false,profiling:true,timingDetail:'off',onKey:key,onError:fail,onAction:event=>{if(event.name==='fonts')$('font-files').click();if(event.name==='hud'){hud=!hud;surface.setPerformanceHUD(hud);}if(event.name==='playground'){location.href=globalThis.__HELION_SHADERS__?'./helion-playground.html':'../playground/';}},onStartup:e=>{$('boot-detail').textContent=e.detail;}});
 if(token!==epoch){next.dispose();return;}surface=next;globalThis.helionTypography=surface;surface.render(performance.now());await surface.whenSubmittedWorkDone();if(surface.faulted)throw new Error(surface.errors.join('\n'));surface.start();$('boot').hidden=true;
 }catch(error){surface?.dispose();if(token===epoch)fail(error);}
}
$('font-files').addEventListener('change',event=>{const files=Array.from(event.target.files||[]);if(files.length)boot(files.map(source=>({source})));});
document.addEventListener('keydown',event=>{if(!surface)key(event);});window.addEventListener('pagehide',()=>{epoch++;surface?.dispose();});boot();
