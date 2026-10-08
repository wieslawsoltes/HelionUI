/** Reproducible source/binary audit. NOT a native compiler or GPU benchmark.
 * node tools/audit-startup-repair.mjs --baseline=/path/to/0.12.1/helion-ui --output=report.json
 */
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {partitionShaderProgram,analyzeShaderDeclarations} from '../src/gpu/shader-partitions.js';
const option=n=>process.argv.find(a=>a.startsWith(n+'='))?.slice(n.length+1);
if(!option('--baseline')||!option('--output'))throw Error('Supply --baseline=/path/to/old/helion-ui --output=report.json');
const baseline=resolve(option('--baseline')), current=fileURLToPath(new URL('..',import.meta.url));
const digest=x=>createHash('sha256').update(x).digest('hex');
async function sources(root){const files=(await readdir(resolve(root,'shaders'))).filter(f=>f.endsWith('.wgsl'));return Object.fromEntries(await Promise.all(files.map(async f=>[f.slice(0,-5),await readFile(resolve(root,'shaders',f),'utf8')])));}
async function inspect(root){
 const mod=f=>import(pathToFileURL(resolve(root,f)).href);
 const [{compile},{createShowcase},{createGPUShell},{createDesignerWorkbench},{designerExamples},{viewFeatures,entryEnabled},{shaderProgram,kernels},{arenaLayout}]=await Promise.all(['src/core/compiler.js','examples/showcase.js','src/playground/gpu-shell.js','src/designer/workbench.js','designer/examples.js','src/gpu/view-features.js','src/gpu/shader-library.js','src/gpu/arena-layout.js'].map(mod));
 const scenes=[['showcase',createShowcase()],['playground',createGPUShell()],...designerExamples.map((p,i)=>['designer-'+i,createDesignerWorkbench(p,{examples:designerExamples})])];
 const packed=scenes.map(([name,view])=>{const c=compile(view);return{name,view,c,buffers:Object.fromEntries(['nodes','state','heap'].map(k=>[k,{bytes:c[k].byteLength,sha256:digest(Buffer.from(c[k].buffer,c[k].byteOffset,c[k].byteLength))}]))};});
 const design=packed.find(p=>p.name==='designer-0'),flags=viewFeatures(design.view),enabled=kernels.filter(e=>entryEnabled(e,flags));
 const program=shaderProgram(await sources(root),{...arenaLayout(design.c.limits).constants,VIEW_FEATURES:flags});
 return{version:JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version,packed,enabled,program,flags};
}
const [before,after]=await Promise.all([inspect(baseline),inspect(current)]);
const scenes=after.packed.map((p,i)=>({name:p.name,views:p.c.nodeCount,rows:p.c.tables[0]?.rowCount??0,animations:p.c.animations,arrays:Object.fromEntries(Object.entries(p.buffers).map(([k,v])=>[k,{...v,equal:JSON.stringify(v)===JSON.stringify(before.packed[i].buffers[k])}]))}));
const groups=partitionShaderProgram(after.program,after.enabled);
const oldFunctions=analyzeShaderDeclarations(before.program.code).functions,newFunctions=analyzeShaderDeclarations(after.program.code).functions;
const callSites=[['editorKey','editorCommand'],['dsKey','dsCommand'],['handleKey','activate'],['dsDecimal','glyph'],['dsHexText','glyph']].map(([caller,callee])=>({caller,callee,before:oldFunctions.get(caller).calls.filter(x=>x===callee).length,after:newFunctions.get(caller).calls.filter(x=>x===callee).length}));
const unchanged=['src/core/compiler.js','src/core/schema.js','src/designer/pack.js','src/designer/workbench.js','src/gpu/arena-layout.js','src/gpu/viewport.js','src/gpu/frame-gate.js','src/gpu/queue-progress.js','src/gpu/cadence.js','src/gpu/submission.js','src/gpu/performance.js','src/text/opentype.js','src/text/fonts.js','shaders/curve-coverage.wgsl','shaders/glyph-cache.wgsl','shaders/text.wgsl','shaders/flatten.wgsl','shaders/strips.wgsl','shaders/hud.wgsl','shaders/hud-common.wgsl','shaders/present.wgsl','shaders/metrics.wgsl','shaders/data.wgsl'];
const protectedFiles=[];for(const file of unchanged){const [a,b]=await Promise.all([readFile(resolve(baseline,file)),readFile(resolve(current,file))]);protectedFiles.push({file,equal:a.equals(b),sha256:digest(b)});}
const report={baselineVersion:before.version,currentVersion:after.version,scope:'Exact CPU source and compiled initial-buffer audit using original diagnostic glyph fixtures. No font files. No native shader compilation, GPU pixels, browser startup milliseconds or FPS measurements.',scenes,protectedFiles,compilerInput:{beforeFullProgramBytes:Buffer.byteLength(before.program.code),afterFullProgramBytes:Buffer.byteLength(after.program.code),beforeEnabledCorePipelines:before.enabled.length,afterEnabledCorePipelines:after.enabled.length,omittedUnusedPipelines:before.enabled.filter(e=>!after.enabled.includes(e)),afterGroups:[...groups].map(([name,p])=>({name,bytes:Buffer.byteLength(p.code),functions:p.functionNames.length,entries:p.entries})),caveat:'Each partition preserves its reachable original function tokens and all non-function declarations. Total frontend bytes across modules can increase; source size is not native compiler time or generated ISA size.'},callSites};
report.status=scenes.every(p=>Object.values(p.arrays).every(a=>a.equal))&&protectedFiles.every(p=>p.equal)?'PASS':'FAIL';
await writeFile(option('--output'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,scenes:scenes.length,protectedFiles:protectedFiles.length,corePipelines:[before.enabled.length,after.enabled.length],programBytes:report.compilerInput.beforeFullProgramBytes,groups:report.compilerInput.afterGroups.map(g=>[g.name,g.bytes]),callSites},null,2));
if(report.status!=='PASS')process.exitCode=1;
