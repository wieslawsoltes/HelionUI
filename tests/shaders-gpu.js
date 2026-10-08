import {boundedWait} from '../src/startup/lifecycle.js';
import {BUILD_VERSION} from '../src/version.js';
import {loadShaders} from '../src/gpu/shader-library.js';
import {arenaLayout} from '../src/gpu/arena-layout.js';
import {validatedLimits} from '../src/core/compiler.js';
import {validateShaderPipelines} from './shader-compile-suite.js';
const run=document.querySelector('#run'),save=document.querySelector('#save'),output=document.querySelector('#result');
let result=null;
export async function runShaderCheck(){
 run.disabled=true;save.disabled=true;
 result={status:'RUNNING',version:BUILD_VERSION,started:new Date().toISOString(),progress:[],gpuExecutionVerified:false};
 globalThis.__HELION_SHADER_CHECK__=result;
 const display=()=>{output.textContent=JSON.stringify(result,null,2);};display();let device;
 try{
  if(!navigator.gpu)throw new Error('WebGPU is required. Serve this page on localhost or HTTPS.');
  const [adapter,shaders]=await Promise.all([boundedWait(navigator.gpu.requestAdapter(),{timeoutMs:15000,stage:'adapter'}),loadShaders()]);
  if(!adapter)throw new Error('No WebGPU adapter was provided');
  result.adapter=adapter.info?.description||adapter.info?.device||'Undisclosed';
  device=await boundedWait(adapter.requestDevice(),{timeoutMs:15000,stage:'device',onLate:d=>d.destroy()});
  const {constants}=arenaLayout(validatedLimits({}));
  const checked=await boundedWait(validateShaderPipelines(device,shaders,constants,stage=>{result.progress.push(stage);display();},{compilation:new URLSearchParams(location.search).has('monolithic')?'monolithic':'partitioned'}),{timeoutMs:120000,stage:'native compilation suite'});
  Object.assign(result,checked);
 }catch(error){result.status='FAIL';result.error=error.stack||String(error);}
 finally{device?.destroy();result.finished=new Date().toISOString();display();run.disabled=false;save.disabled=false;}
 return result;
}
run.onclick=runShaderCheck;
save.onclick=()=>{if(!result)return;const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='helion-shader-compilation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
if(new URLSearchParams(location.search).has('autorun'))runShaderCheck();
