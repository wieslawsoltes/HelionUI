/** Compare CPU startup preparation, not GPU or browser FPS.
 * node tools/benchmark-startup-host.mjs --baseline=/path/to/0.3.0/helion-ui \
 *   --font=/path/to/Regular.ttf --font=/path/to/SemiBold.ttf --font=/path/to/Italic.ttf \
 *   --samples=5 --output=host-startup.json
 * No font file is copied into a result or the distribution.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const args=process.argv.slice(2), values=name=>args.filter(a=>a.startsWith(`--${name}=`)).map(a=>a.slice(name.length+3));
const arg=(name,fallback)=>values(name)[0]??fallback;
const root=resolve(arg('root',fileURLToPath(new URL('..',import.meta.url)))), fontPaths=values('font').map(p=>resolve(p));
if(!fontPaths.length)throw new Error('Supply --font=/path/to/font.ttf (1–8 faces). No font assets are bundled.');
const digest=b=>createHash('sha256').update(b).digest('hex');
if(args.includes('--child')){
 const load=p=>import(pathToFileURL(resolve(root,p)));
 const {parseOpenType}=await load('src/text/opentype.js'),{compile}=await load('src/core/compiler.js'),{createShowcase}=await load('examples/showcase.js');
 const {shaderSource,resourcesForEntry,kernels}=await load('src/gpu/shader-library.js'),{arenaLayout}=await load('src/gpu/arena-layout.js');
 const fonts=[];let begin=performance.now();
 for(const path of fontPaths)fonts.push(parseOpenType(await readFile(path)));
 const fontParseMs=performance.now()-begin;begin=performance.now();const compiled=compile(createShowcase(),{fonts});const compileMs=performance.now()-begin;
 const names=['common','curve-coverage','text','editor','editor-render','models','docking','controls','presenter','data-source','layout','input','data','flatten','emit','strips','glyph-cache'];const shaders=Object.fromEntries(await Promise.all(names.map(async n=>[n,await readFile(resolve(root,`shaders/${n}.wgsl`),'utf8')])));
 const source=shaderSource(shaders,arenaLayout(compiled.limits).constants);begin=performance.now();for(const entry of kernels)resourcesForEntry(source,entry);const shaderResourceAnalysisMs=performance.now()-begin;
 console.log(JSON.stringify({fontParseMs,compileMs,shaderResourceAnalysisMs,hostPreparationMs:fontParseMs+compileMs+shaderResourceAnalysisMs,peakRSSMiB:process.resourceUsage().maxRSS/1024,
  nodeCount:compiled.nodeCount,rowCount:compiled.tables[0].rowCount,paths:compiled.paths,heapBytes:compiled.heap.byteLength,
  nodesSHA256:digest(compiled.nodes),stateSHA256:digest(compiled.state),heapSHA256:digest(compiled.heap),fonts:fonts.map(f=>({family:f.family,weight:f.weight,style:f.style,glyphs:f.glyphs.length,sourceBytes:f.sourceBytes}))}));
}else{
 const baseline=arg('baseline');if(!baseline)throw new Error('Supply --baseline=/path/to/0.3.0/helion-ui for a measured comparison');
 const samples=Number(arg('samples',5));if(!Number.isInteger(samples)||samples<1||samples>20)throw new Error('samples must be 1–20');
 const result={scope:'Fresh-process Node CPU preparation only; local font reads/parse, scene packing and shader resource analysis. Excludes module-import time, network, workers/IndexedDB, native compilation, GPU execution and display FPS.',runtime:process.version,unicode:process.versions.unicode,platform:process.platform,arch:process.arch,fonts:await Promise.all(fontPaths.map(async p=>({file:basename(p),sha256:digest(await readFile(p))}))),samplesPerVersion:samples,baseline:[],optimized:[]};
 const paths={baseline:resolve(baseline),optimized:root};
 for(let i=0;i<samples;i++)for(const key of i%2?['optimized','baseline']:['baseline','optimized']){
  const output=execFileSync(process.execPath,[fileURLToPath(import.meta.url),'--child',`--root=${paths[key]}`,...fontPaths.map(p=>`--font=${p}`)],{encoding:'utf8',timeout:30000});result[key].push(JSON.parse(output));
 }
 const summary=rows=>Object.fromEntries(['fontParseMs','compileMs','shaderResourceAnalysisMs','hostPreparationMs','peakRSSMiB'].map(k=>{const list=rows.map(r=>r[k]).sort((a,b)=>a-b);return[k,{median:list[Math.floor(list.length/2)],min:list[0],max:list.at(-1)}];}));
 result.summary={baseline:summary(result.baseline),optimized:summary(result.optimized)};
 result.exactCompiledBytes=result.baseline.every(a=>result.optimized.every(b=>['nodesSHA256','stateSHA256','heapSHA256'].every(k=>a[k]===b[k])));
 if(!result.exactCompiledBytes)throw new Error('Compiled bytes differ; investigate before claiming preserved output');
 result.compileSpeedup=result.summary.baseline.compileMs.median/result.summary.optimized.compileMs.median;
 result.hostPreparationSpeedup=result.summary.baseline.hostPreparationMs.median/result.summary.optimized.hostPreparationMs.median;
 await writeFile(resolve(arg('output','host-startup.json')),JSON.stringify(result,null,2));console.log(JSON.stringify({summary:result.summary,exactCompiledBytes:result.exactCompiledBytes,compileSpeedup:result.compileSpeedup,hostPreparationSpeedup:result.hostPreparationSpeedup},null,2));
}
