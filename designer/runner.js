import {BUILD_VERSION} from '../src/version.js';
import {h,HelionSurface,loadFonts} from '../src/index.js';
import {DesignDocument,projectToView} from '../src/designer/document.js';
import {DESIGNER_FONT_SOURCES} from '../src/designer/workbench.js';
const data=document.getElementById('helion-project');
let surface=null,fonts=null,epoch=0;
async function start(){const token=++epoch;const notice=document.getElementById('boot');notice.hidden=false;
 try{const p=DesignDocument(JSON.parse(data.textContent));const faces=await loadFonts(fonts||DESIGNER_FONT_SOURCES);if(token!==epoch)return;surface?.dispose();surface=await HelionSurface.mount(document.getElementById('app'),h('Viewbox',{stretch:'uniform',background:p.root.props.background||'#142331'},projectToView(p)),{autoStart:false,fonts:faces,textQuality:'sharp',resolutionMode:'native',onError:e=>{notice.hidden=false;notice.textContent=e.message;}});surface.render(performance.now());await surface.whenSubmittedWorkDone();if(token!==epoch)return;if(surface.faulted)throw new Error(surface.errors.join('\n'));surface.start();notice.hidden=true;globalThis.helionApp=surface;}
 catch(e){notice.textContent=`${e.message}\n\nBuild: ${BUILD_VERSION}.\nOpen on localhost/HTTPS in a WebGPU browser. Ctrl/Cmd+Alt+F selects local static fonts.`;console.error(e);}}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.altKey&&e.key.toLowerCase()==='f'){e.preventDefault();document.getElementById('font-files').click();}});
document.getElementById('font-files').addEventListener('change',()=>{fonts=[...document.getElementById('font-files').files].slice(0,8).map(source=>({source,family:'Noto Sans'}));start();});
addEventListener('pagehide',()=>{epoch++;surface?.dispose();});start();
