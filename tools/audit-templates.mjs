/** CPU/source preservation and allocation counts. NOT a GPU or timing benchmark.
 * node tools/audit-templates.mjs --baseline=/path/to/0.12.3/helion-ui --output=report.json [--font=/private/font.ttf]
 */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const option=n=>process.argv.find(a=>a.startsWith(n+'='))?.slice(n.length+1);
if(!option('--baseline')||!option('--output'))throw Error('Supply --baseline and --output');
const baseline=resolve(option('--baseline')),current=fileURLToPath(new URL('..',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const protectedPaths=[
 'src/text/fonts.js','src/text/opentype.js','shaders/curve-coverage.wgsl',
 'shaders/glyph-cache.wgsl','shaders/text.wgsl','shaders/flatten.wgsl',
 'shaders/strips.wgsl','shaders/metrics.wgsl','shaders/hud.wgsl','shaders/hud-common.wgsl',
 'src/gpu/arena-layout.js','src/gpu/viewport.js','src/gpu/frame-gate.js',
 'src/gpu/queue-progress.js','src/gpu/cadence.js','src/gpu/submission.js',
 'src/gpu/progress-watchdog.js','src/gpu/performance.js',
 'src/startup/prepare-worker.js','src/startup/worker-source.js','src/startup/lifecycle.js',
 'src/platform/launch.js','src/playground/sandbox.js'
];
const versions=[],samples=[];
for(const root of [baseline,current]){
 const mod=file=>import(pathToFileURL(resolve(root,file)).href);
 const [{compile},{createShowcase},{createDesignerWorkbench},{designerExamples}]=await Promise.all([
  mod('src/core/compiler.js'),mod('examples/showcase.js'),mod('src/designer/workbench.js'),mod('designer/examples.js')]);
 let fonts;
 if(option('--font')){const {loadFont}=await mod('src/text/opentype.js');fonts=[await loadFont(await readFile(option('--font')))];}
 const c=compile(createShowcase(),{fonts});
 const d=compile(createDesignerWorkbench(designerExamples[0],{examples:designerExamples}),{fonts});
 versions.push(JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version);
 samples.push({showcase:c,designer:d,fonts:fonts?.map(f=>({family:f.family,weight:f.weight,style:f.style,glyphs:f.glyphs.length}))??'Original diagnostic geometry'});
}
const compiledArrays=Object.fromEntries(['nodes','state','heap'].map(k=>[k,{
 equal:bytes(samples[0].showcase[k]).equals(bytes(samples[1].showcase[k])),
 bytes:samples[1].showcase[k].byteLength,sha256:hash(bytes(samples[1].showcase[k]))
}]));
const protectedFiles=[];
for(const file of protectedPaths){const [a,b]=await Promise.all([readFile(resolve(baseline,file)),readFile(resolve(current,file))]);protectedFiles.push({file,equal:a.equals(b),sha256:hash(b)});}
const summarize=c=>({nodes:c.nodeCount,nodeBytes:c.nodes.byteLength,stateBytes:c.state.byteLength,heapBytes:c.heap.byteLength,
 templateInstances:c.templates?.length??0,templatePlans:c.templates?.reduce((n,t)=>n+(t.planCount??0),0)??0,
 templateNestingLevels:c.templateLevels??0,templateLayout:c.templateLayout??false,designers:c.designers?.length??0,
 editors:c.editors?.length??0,dockWorkspaces:c.dockspaces?.length??c.docks?.length??0});
const report={version:versions[1],baselineVersion:versions[0],scope:'Exact CPU initial-buffer/source audit and allocation sizes only. No native WGSL, rendered pixels, GPU performance or startup timing measurement.',
 fontAssetsIncluded:false,fontTestSet:samples[1].fonts,
 originalShowcase:{views:samples[1].showcase.nodeCount,rows:samples[1].showcase.tables[0]?.rowCount,animations:samples[1].showcase.animations,compiledArrays},
 protectedFiles,studio:{before:summarize(samples[0].designer),after:summarize(samples[1].designer),note:'Studio changes are intentional; no initial-buffer or pixel equivalence claimed for the expanded workspace.'}};
report.status=Object.values(compiledArrays).every(x=>x.equal)&&protectedFiles.every(x=>x.equal)?'PASS':'FAIL';
await writeFile(option('--output'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,versions,showcase:report.originalShowcase,studio:report.studio,protectedFiles:protectedFiles.length,changedProtected:protectedFiles.filter(x=>!x.equal)},null,2));
if(report.status!=='PASS')process.exitCode=1;
