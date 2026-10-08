/** Exact initial-scene/preserved-render-components comparison, not a pixel or FPS test.
 * Font paths are caller-supplied; their bytes are never copied into the report. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
const here=fileURLToPath(new URL('..',import.meta.url)),arg=k=>process.argv.find(a=>a.startsWith(k+'='))?.slice(k.length+1),baseline=arg('--baseline'),output=arg('--output'),fonts=process.argv.filter(a=>a.startsWith('--font=')).map(a=>a.slice(7));
if(!baseline||!output||!fonts.length)throw new Error('Use --baseline=/old/helion-ui --font=/private/static.ttf [--font=...] --output=report.json');
const hash=b=>createHash('sha256').update(b).digest('hex'),cases=[];
for(const dir of [resolve(baseline),here]){
 const mod=p=>import(pathToFileURL(resolve(dir,p)).href),[{compile},{loadFont},{createShowcase}]=await Promise.all([mod('src/core/compiler.js'),mod('src/text/opentype.js'),mod('examples/showcase.js')]);
 const faces=await Promise.all(fonts.map(async p=>loadFont(await readFile(p)))),view=createShowcase(),c=compile(view,{fonts:faces});
 cases.push({c,scene:hash(JSON.stringify(view)),fonts:faces.map(f=>({family:f.family,weight:f.weight,style:f.style,glyphs:f.glyphs.length})),version:JSON.parse(await readFile(resolve(dir,'package.json'))).version});
}
const fields=['nodes','state','heap'],buffers=Object.fromEntries(fields.map(field=>{const b=cases.map(x=>Buffer.from(x.c[field].buffer,x.c[field].byteOffset,x.c[field].byteLength));return [field,{equal:b[0].equals(b[1]),bytes:b[1].length,sha256:hash(b[1])}];}));
const protectedPaths=['src/text/opentype.js','src/text/fonts.js','shaders/text.wgsl','shaders/flatten.wgsl','shaders/glyph-cache.wgsl','src/gpu/cadence.js','src/gpu/frame-gate.js','src/gpu/queue-progress.js','src/gpu/submission.js','src/gpu/performance.js','shaders/metrics.wgsl'];
const components=[];for(const path of protectedPaths){const [a,b]=await Promise.all([readFile(resolve(baseline,path)),readFile(resolve(here,path))]);components.push({path,equal:a.equals(b),sha256:hash(b)});}
const report={scope:'Exact initial scene and listed unchanged components. NOT shader execution, rendered pixels, latency or performance.',baselineVersion:cases[0].version,currentVersion:cases[1].version,fontFilesIncluded:false,fontSet:cases[1].fonts,sceneDeclarationEqual:cases[0].scene===cases[1].scene,buffers,components,views:cases[1].c.nodeCount,rows:cases[1].c.tables[0].rowCount,animations:cases[1].c.animations,note:'Input/layout/emission/strips/runtime/compiler were deliberately extended. They are NOT claimed byte-identical.'};
report.status=report.sceneDeclarationEqual&&Object.values(buffers).every(b=>b.equal)&&components.every(c=>c.equal)?'PASS_EXPLICIT_PRESERVATION_SCOPE':'FAIL';
await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.status==='FAIL')process.exitCode=1;
