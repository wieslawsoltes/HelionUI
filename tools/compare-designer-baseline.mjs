/** Reproducible host/data preservation and reservation audit; never a GPU benchmark. */
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('..',import.meta.url));
const arg=prefix=>process.argv.find(v=>v.startsWith(prefix+'='))?.slice(prefix.length+1);
const baseline=arg('--baseline'),output=arg('--output'),fonts=process.argv.filter(v=>v.startsWith('--font=')).map(v=>v.slice(7));
if(!baseline||!output||!fonts.length)throw new Error('Use --baseline=/path/to/0.11/helion-ui --font=/your/static.ttf [--font=...] --output=report.json');
const hash=x=>createHash('sha256').update(x).digest('hex');
const data=[];
for(const dir of [baseline,root]){
 const load=f=>import(pathToFileURL(resolve(dir,f)).href);
 const [{compile},{loadFont},{createShowcase}]=await Promise.all([load('src/core/compiler.js'),load('src/text/opentype.js'),load('examples/showcase.js')]);
 const faces=await Promise.all(fonts.map(async p=>loadFont(await readFile(p))));
 const scene=createShowcase(),compiled=compile(scene,{fonts:faces});
 data.push({scene,compiled,faces});
}
const arrays=Object.fromEntries(['nodes','state','heap'].map(key=>{const bytes=data.map(d=>Buffer.from(d.compiled[key].buffer,d.compiled[key].byteOffset,d.compiled[key].byteLength));return[key,{equal:bytes[0].equals(bytes[1]),bytes:bytes[1].length,sha256:hash(bytes[1])}];}));
const protectedFiles=[...(await readdir(resolve(root,'src/text'))).filter(n=>n.endsWith('.js')).map(n=>'src/text/'+n),
 ...['cadence','frame-gate','frame-sync','performance','queue-progress','submission','viewport','arena-layout'].map(n=>'src/gpu/'+n+'.js'),
 ...['curve-coverage','unicode','shaping','shaping-bidi','paragraph','typography-ui','text','glyph-cache','data','data-source','flatten','strips','present','metrics','hud','hud-common','hud-viewport','blit'].map(n=>'shaders/'+n+'.wgsl')];
const unchanged=[];for(const file of protectedFiles){const [a,b]=await Promise.all([readFile(resolve(baseline,file)),readFile(resolve(root,file))]);unchanged.push({file,equal:a.equals(b),sha256:hash(b)});}
const [{compile},{createDesignerWorkbench},{designerExamples}]=await Promise.all([import('../src/core/compiler.js'),import('../src/designer/workbench.js'),import('../designer/examples.js')]);
const designers=designerExamples.map(project=>{const c=compile(createDesignerWorkbench(project,{examples:designerExamples}),{fonts:data[1].faces.slice(0,1)});const d=c.designers[0];return{title:project.title,nativeNodes:c.nodeCount,authoringSlots:d.capacity,fontTestFaces:data[1].faces.slice(0,1).map(f=>f.family),dockingPanes:c.docks[0].panes.length,editors:c.editors.length,nodeBytes:c.nodes.byteLength,stateBytes:c.state.byteLength,heapBytes:c.heap.byteLength,documentBlockBytes:d.offsets.words*4,historyBlocks:d.history,scope:'Initial packed buffers; scratch, glyph/HUD caches, output textures and native driver allocations are additional.'};});
const report={version:'0.12.0-experimental',baseline:'0.11.0-experimental',scope:'Exact CPU source/initial-data comparison and memory reservation accounting; NOT GPU pixels, startup latency, FPS, or native correctness.',fontAssetsIncluded:false,fonts:data[1].faces.map(f=>({family:f.family,weight:f.weight,style:f.style,glyphs:f.glyphs.length})),showcase:{declarationEqual:hash(JSON.stringify(data[0].scene))===hash(JSON.stringify(data[1].scene)),views:data[1].compiled.nodeCount,rows:data[1].compiled.tables[0].rowCount,animations:data[1].compiled.animations,arrays},protectedFiles:unchanged,designers};
report.status=report.showcase.declarationEqual&&Object.values(arrays).every(x=>x.equal)&&unchanged.every(x=>x.equal)?'PASS':'FAIL';
await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=1;
