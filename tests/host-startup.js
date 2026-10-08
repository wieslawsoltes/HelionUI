import {ProgressWatchdog} from '../src/gpu/progress-watchdog.js';
import {prepareView} from '../src/startup/prepare.js';
import {compile,h} from '../src/core/compiler.js';
import {diagnosticFont} from '../src/text/fonts.js';
import {AppSandbox} from '../src/playground/sandbox.js';
import {runHostStartupSuite} from './host-startup-suite.js';
const output=document.getElementById('result'),button=document.getElementById('run');
async function run(){
 button.disabled=true;output.textContent='Checking native browser timers and workers (no GPU device is requested)…';
 try{
  const text=async path=>{const r=await fetch(new URL(path,import.meta.url));if(!r.ok)throw new Error('Build first and open /dist/tests/host-startup.html, or serve the prebuilt static site. Missing '+path);return r.text();};
  const workerSource=await text('../helion-startup-worker.js'),authoringSource=await text('../playground/authoring.bundle.js');
  globalThis.__HELION_HOST_STARTUP_RESULT__=await runHostStartupSuite({ProgressWatchdog,prepareView,compile,h,diagnosticFont,AppSandbox,workerSource,authoringSource});
 }catch(error){globalThis.__HELION_HOST_STARTUP_RESULT__={status:'FAIL',scope:'Browser host-only gate',error:String(error.stack||error)};}
 finally{output.textContent=JSON.stringify(globalThis.__HELION_HOST_STARTUP_RESULT__,null,2);button.disabled=false;}
}
button.addEventListener('click',run);if(new URLSearchParams(location.search).has('autorun'))run();
