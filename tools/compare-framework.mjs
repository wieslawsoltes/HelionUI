/** Compare the unchanged legacy showcase and selected hot-path modules.
 * Caller supplies its own fonts. This script never copies font files. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const here=fileURLToPath(new URL('..',import.meta.url));
const arg=name=>process.argv.find(v=>v.startsWith(name+'='))?.slice(name.length+1);
const baseline=arg('--baseline'),output=arg('--output'),fonts=process.argv.filter(x=>x.startsWith('--font=')).map(x=>x.slice(7));
if(!baseline||!output||!fonts.length)throw new Error('Use --baseline=/path/helion-ui --font=/your/font.ttf [--font=...] --output=result.json');
const hash=x=>createHash('sha256').update(x).digest('hex');
const compiled=[];
for(const root of [resolve(baseline),here]){
 const mod=p=>import(pathToFileURL(resolve(root,p)).href);
 const[{compile},{loadFont},{createShowcase}]=await Promise.all([mod('src/core/compiler.js'),mod('src/text/opentype.js'),mod('examples/showcase.js')]);
 const prepared=await Promise.all(fonts.map(async p=>loadFont(await readFile(p))));const view=createShowcase();const result=compile(view,{fonts:prepared});
 compiled.push({view,result,faces:prepared.map(f=>({family:f.family,weight:f.weight,style:f.style,glyphs:f.glyphs.length}))});
}
const buffers={};for(const key of ['nodes','state','heap']){const get=c=>Buffer.from(c.result[key].buffer,c.result[key].byteOffset,c.result[key].byteLength);const a=get(compiled[0]),b=get(compiled[1]);buffers[key]={equal:a.equals(b),baselineBytes:a.length,currentBytes:b.length,baselineSHA256:hash(a),currentSHA256:hash(b)};}
const protectedFiles=['src/gpu/cadence.js','src/gpu/frame-gate.js','src/gpu/queue-progress.js','src/gpu/submission.js','src/gpu/performance.js','shaders/metrics.wgsl','shaders/glyph-cache.wgsl','shaders/text.wgsl','shaders/data.wgsl','shaders/flatten.wgsl','shaders/hud.wgsl','shaders/hud-common.wgsl','shaders/present.wgsl','shaders/blit.wgsl'];
const files=[];for(const file of protectedFiles){const[a,b]=await Promise.all([readFile(resolve(baseline,file)),readFile(resolve(here,file))]);files.push({file,equal:a.equals(b),sha256:hash(b)});}
const report={scope:'CPU binary/source preservation for the original showcase, NOT native execution, pixel equality or FPS.',fontsIncluded:false,faces:compiled[1].faces,versions:await Promise.all([baseline,here].map(async p=>JSON.parse(await readFile(resolve(p,'package.json'))).version)),sceneDeclarationEqual:JSON.stringify(compiled[0].view)===JSON.stringify(compiled[1].view),compiledBuffers:buffers,protectedFiles:files,showcase:{nodes:compiled[1].result.nodeCount,rows:compiled[1].result.tables[0].rowCount,animations:compiled[1].result.animations},newFeaturesRequireNativeQualification:true};
report.status=report.sceneDeclarationEqual&&Object.values(buffers).every(x=>x.equal)&&files.every(x=>x.equal)?'PASS':'DIFFERENCE';await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=1;
