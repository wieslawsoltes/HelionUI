/** CPU-only preservation check; caller supplies private font files, never redistributed. */
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const current=fileURLToPath(new URL('..',import.meta.url));
const option=prefix=>process.argv.find(v=>v.startsWith(prefix+'='))?.slice(prefix.length+1);
const baseline=resolve(option('--baseline')||''),output=option('--output');
const fonts=process.argv.filter(v=>v.startsWith('--font=')).map(v=>v.slice(7));
if(!option('--baseline')||!fonts.length||!output)throw new Error('Usage: node tools/compare-release.mjs --baseline=/path/to/old/helion-ui --font=/your/font.ttf [--font=...] --output=report.json');
const hash=b=>createHash('sha256').update(b).digest('hex');
const arrays=[];
for(const root of [baseline,current]){
 const mod=file=>import(pathToFileURL(resolve(root,file)).href);
 const [{compile},{loadFont},{createShowcase}]=await Promise.all([mod('src/core/compiler.js'),mod('src/text/opentype.js'),mod('examples/showcase.js')]);
 const prepared=await Promise.all(fonts.map(async file=>loadFont(await readFile(file))));
 const view=createShowcase(),compiled=compile(view,{fonts:prepared});
 const buffers=Object.fromEntries(['nodes','state','heap'].map(k=>[k,Buffer.from(compiled[k].buffer,compiled[k].byteOffset,compiled[k].byteLength)]));
 arrays.push({root,compiled,buffers,sceneHash:hash(JSON.stringify(view)),fontNames:prepared.map(f=>({family:f.family,weight:f.weight,style:f.style,glyphs:f.glyphs.length}))});
}
const protectedDirs=['src/core','src/text','src/startup'];
const walk=async dir=>(await Promise.all((await readdir(resolve(current,dir),{withFileTypes:true})).map(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]))).flat();
const paths=(await Promise.all(protectedDirs.map(walk))).flat().concat(['shaders/text.wgsl','shaders/layout.wgsl','shaders/data.wgsl','shaders/flatten.wgsl']);
const files=[];for(const file of paths){const[a,b]=await Promise.all([readFile(resolve(baseline,file)),readFile(resolve(current,file))]);files.push({file,equal:a.equals(b),sha256:hash(b)});}
const compiledBuffers=Object.fromEntries(['nodes','state','heap'].map(k=>[k,{equal:arrays[0].buffers[k].equals(arrays[1].buffers[k]),bytes:arrays[1].buffers[k].length,sha256:hash(arrays[1].buffers[k])}]));
const coverageFunctions=[];
function body(source,name){let start=source.indexOf('fn '+name+'(');if(start<0)throw new Error('Missing coverage function '+name);let at=source.indexOf('{',start),depth=1,end=at+1;while(depth&&end<source.length){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;end++;}return source.slice(start,end);}
const [oldCache,newCache]=await Promise.all([readFile(resolve(baseline,'shaders/glyph-cache.wgsl'),'utf8'),readFile(resolve(current,'shaders/glyph-cache.wgsl'),'utf8')]);
for(const name of ['glyphMatrix','glyphOrigin','glyphCoverage','cachedGlyphCoverage'])coverageFunctions.push({name,equal:body(oldCache,name)===body(newCache,name),sha256:hash(body(newCache,name))});
const report={coverageFunctions,scope:'CPU preparation and exact binary/source preservation. NOT a native pixel or FPS comparison.',fontFilesIncluded:false,fontTestSet:arrays[1].fontNames,
 baselineVersion:JSON.parse(await readFile(resolve(baseline,'package.json'))).version,currentVersion:JSON.parse(await readFile(resolve(current,'package.json'))).version,
 sceneDeclarationEqual:arrays[0].sceneHash===arrays[1].sceneHash,compiledBuffers,protectedFiles:files,
 views:arrays[1].compiled.nodeCount,rows:arrays[1].compiled.tables[0]?.rowCount,animations:arrays[1].compiled.animations};
report.status=report.sceneDeclarationEqual&&Object.values(compiledBuffers).every(x=>x.equal)&&files.every(x=>x.equal)&&coverageFunctions.every(x=>x.equal)?'PASS':'FAIL';
await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.status!=='PASS')process.exitCode=1;
