import {gunzipSync} from 'node:zlib';
import {checkLogicalGrouping} from './check-wgsl-logic.mjs';
import {BUILD_VERSION} from '../src/version.js';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { posix } from 'node:path';
import { buildWorkerSource, buildAuthoringSource } from './build-worker.mjs';
import {modulePreloadScript,modulePreloadPaths,startupWorkerScript} from './module-preloads.mjs';
const html=await readFile(new URL('../dist/helion-standalone.html',import.meta.url),'utf8');
const imports=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
assert.ok(imports['@helion.bundle/examples/showcase.js']);
for(const [name,uri] of Object.entries(imports)){
 assert.ok(uri.startsWith('data:text/javascript;base64,'),name);
 const code=Buffer.from(uri.split(',')[1],'base64').toString('utf8');
 const file=name.slice('@helion.bundle/'.length);
 let expected=await readFile(new URL(`../${file}`,import.meta.url),'utf8');
 expected=expected.replace(/(\bfrom\s*|\bimport\s*)['"](\.[^'"]+)['"]/g,(_,prefix,relative)=>`${prefix}'@helion.bundle/${posix.normalize(posix.join(posix.dirname(file),relative))}'`);
 expected+=`\n//# sourceURL=helion/${file}\n`;
 assert.equal(code,expected,`${file}: embedded module must exactly match source`);
 assert.ok(code.includes(`//# sourceURL=helion/${name.slice('@helion.bundle/'.length)}`), `${name}: missing readable source label`);
 for(const match of code.matchAll(/(?:\bfrom\s*|\bimport\s*)['"]([^'"]+)['"]/g)) assert.ok(imports[match[1]],`${name}: missing ${match[1]}`);
}
assert.ok(html.includes('globalThis.__HELION_SHADERS__='));
assert.ok(!html.includes('src="./examples/showcase.js"'));
assert.ok(!/<(?:script|link)[^>]+(?:src|href)="https?:/.test(html));
const shaders=JSON.parse(html.match(/globalThis\.__HELION_SHADERS__=([\s\S]*?);<\/script>/)[1]);
const shaderNames=(await readdir(new URL('../shaders/',import.meta.url))).filter(name=>name.endsWith('.wgsl')).map(name=>name.slice(0,-5)).sort();
assert.deepEqual(Object.keys(shaders).sort(),shaderNames,'Every source shader must be embedded, with no stale extras');
for(const module of ['editor','docking','models','designer'])assert.ok(imports[`@helion.bundle/src/${module}/index.js`],`Missing ${module} public API`);
for(const [name,source] of Object.entries(shaders)) {
 assert.equal(source,await readFile(new URL(`../shaders/${name}.wgsl`,import.meta.url),'utf8'));
 assert.deepEqual(checkLogicalGrouping(source,`shaders/${name}.wgsl`),[],`${name}: mixed logical operators in shipped shader`);
}
console.log(`Standalone closure check passed: ${Object.keys(imports).length} embedded modules, ${shaderNames.length} exact shader sources, no external script/style assets.`);

assert.match(shaders.data, /return select\(\(compare < 0i\), \(compare > 0i\), heap\[t\+12u\] != 0u\);/);
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
assert.equal(BUILD_VERSION,version,'Runtime build version must match package.json');
assert.ok(html.includes(`name="helion-version" content="${version}"`), 'Standalone version must match package.json');

const worker=JSON.parse(html.match(/globalThis\.__HELION_PREPARE_WORKER_SOURCE__=([\s\S]*?);<\/script>/)[1]);
assert.equal(worker,await buildWorkerSource(),'Embedded startup worker must match its source graph');
assert.equal(worker,await readFile(new URL('../dist/helion-startup-worker.js',import.meta.url),'utf8'),'Standalone and emitted worker must be identical');
assert.ok(!worker.includes('@helion.bundle/'),'Worker must not rely on document import maps');
console.log('Exact standalone startup-worker embedding and independent module closure verified.');


// The standalone playground must contain the same runtime/shaders plus the exact
// restricted authoring graph. It must not fetch a missing source-side bundle.
const playground=await readFile(new URL('../dist/helion-playground.html',import.meta.url),'utf8');
const playImports=JSON.parse(playground.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
assert.deepEqual(playImports,imports,'Showcase and playground must use identical embedded runtime modules');
const globals=playground.match(/<script>globalThis\.__HELION_SHADERS__=([\s\S]*?);globalThis\.__HELION_PREPARE_WORKER_SOURCE__=([\s\S]*?);globalThis\.__HELION_AUTHORING_SOURCE__=([\s\S]*?);<\/script>/);
assert.ok(globals,'Playground must embed shaders, preparation worker, and authoring worker');
assert.deepEqual(JSON.parse(globals[1]),shaders);
assert.equal(JSON.parse(globals[2]),worker);
const authoring=await buildAuthoringSource();
assert.equal(JSON.parse(globals[3]),authoring);
assert.equal(await readFile(new URL('../playground/authoring.bundle.js',import.meta.url),'utf8'),authoring);
assert.equal(await readFile(new URL('../dist/playground/authoring.bundle.js',import.meta.url),'utf8'),authoring);
assert.ok(!authoring.includes('class HelionSurface')&&!authoring.includes('requestAdapter'),'Authoring graph must not expose the live GPU host');
assert.ok(playground.includes(await readFile(new URL('../playground/playground.css',import.meta.url),'utf8')));
assert.ok(!playground.includes('src="./app.js"'));
assert.ok(playground.includes('href="./helion-standalone.html"'));
assert.ok(html.includes("location.href='./helion-playground.html'"));
assert.ok(!/<(?:script|link)[^>]+(?:src|href)="https?:/.test(playground));
assert.ok(playground.includes(`name="helion-version" content="${version}"`));
assert.ok(!/<textarea\b/i.test(playground),'Playground must not use a visible DOM textarea editor');
console.log(`Exact playground runtime, ${shaderNames.length} shaders, preparation/authoring workers, stylesheet, and reciprocal standalone links verified.`);

// Designer and its data-only standalone-app exporter use exactly this runtime.
const designer=await readFile(new URL('../dist/helion-designer.html',import.meta.url),'utf8');
const designerImports=JSON.parse(designer.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
assert.deepEqual(designerImports,imports);
const readGlobal=(text,name)=>JSON.parse(text.match(new RegExp('globalThis\\.'+name+'=([\\s\\S]*?);<\\/script>'))[1]);
assert.deepEqual(readGlobal(designer,'__HELION_SHADERS__'),shaders);
assert.equal(readGlobal(designer,'__HELION_PREPARE_WORKER_SOURCE__'),worker);
const template=gunzipSync(Buffer.from(readGlobal(designer,'__HELION_DESIGN_EXPORT_GZIP__'),'base64')).toString('utf8');
assert.ok(!designer.includes('globalThis.__HELION_DESIGN_EXPORT_TEMPLATE__='),'Export assets must not be eagerly expanded at boot');
assert.equal(template,await readFile(new URL('../designer/export-template.html',import.meta.url),'utf8'));
assert.equal(template,await readFile(new URL('../dist/designer/export-template.html',import.meta.url),'utf8'));
assert.deepEqual(readGlobal(template,'__HELION_SHADERS__'),shaders);
assert.equal(readGlobal(template,'__HELION_PREPARE_WORKER_SOURCE__'),worker);
assert.deepEqual(JSON.parse(template.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports,imports);
assert.equal(template.split('__HELION_PROJECT_JSON__').length,2,'One data-only project injection point');
assert.ok(template.includes('<script id="helion-project" type="application/json">__HELION_PROJECT_JSON__</script>'));
for(const [name,page]of [['designer',designer],['export template',template]]){
 assert.ok(page.includes(`name="helion-version" content="${version}"`),name+': version');
 assert.ok(!/<(?:script|link)[^>]+(?:src|href)="(?:https?:|\.)/.test(page),name+': no external code/styles');
 assert.ok(!/<(?:button|textarea|select)\b/i.test(page),name+': visible application controls must be Helion');
}
assert.ok(designer.includes(await readFile(new URL('../designer/designer.css',import.meta.url),'utf8')));
assert.ok(html.includes("location.href='./helion-designer.html'"));
const {makeDesignAppHTML}=await import('../src/designer/export.js');
const {designerExamples}=await import('../designer/examples.js');
for(const example of designerExamples){
 const result=makeDesignAppHTML(template,example);
 assert.ok(!result.includes('__HELION_PROJECT_JSON__'));
 const data=JSON.parse(result.match(/<script id="helion-project" type="application\/json">([\s\S]*?)<\/script>/)[1]);
 assert.equal(data.title,example.title);
 assert.ok(!result.includes('src="./runner.js"'));
}
console.log('Designer and app-export template closure, exact source/shader/worker identity, data-only injection and sample exports verified.');

// Every direct app and exported app checks file origin before any import.
const {launchScript,launchPages}=await import('./launch-bootstrap.mjs');
const moduleGraph=new Map(Object.entries(imports).map(([name,uri])=>[
 name.slice('@helion.bundle/'.length),[...Buffer.from(uri.split(',')[1],'base64').toString('utf8').matchAll(/(?:\bfrom\s*|\bimport\s*)['"]@helion.bundle\/([^'"]+)['"]/g)].map(m=>m[1])
]));
for(const page of launchPages){
 const original=await readFile(new URL('../'+page.file,import.meta.url),'utf8');
 assert.ok(original.includes(launchScript(page.entry,{path:page.path})),page.file+': stale source launch guard');
 const published=await readFile(new URL('../dist/'+page.file,import.meta.url),'utf8');
 assert.equal(published,original.replace('<script data-helion-launch>',startupWorkerScript(page.file)+'\n'+modulePreloadScript(moduleGraph,page.bundle,page.file)+'\n<script data-helion-launch>'),page.file+': exact published worker and module preloads');
 for(const path of modulePreloadPaths(moduleGraph,page.bundle,page.file))await readFile(new URL('../dist/'+posix.join(posix.dirname(page.file),path),import.meta.url));
}
for(const embedded of [html,playground,designer,template])assert.ok(!embedded.includes('data-helion-preloads'),'Embedded apps must not preload external source modules');
console.log('Published module preloads match the complete static import graph; standalone pages stay self-contained.');
for(const [page,entry]of [[html,'examples/showcase.js'],[playground,'playground/app.js'],[designer,'designer/app.js'],[template,'designer/runner.js']]){
 assert.ok(page.includes(launchScript('@helion.bundle/'+entry,{standalone:true})),entry+': missing guarded bootstrap');
 assert.ok(!/<script type="module">import /.test(page),entry+': unguarded eager app import');
}
const loader=Buffer.from(imports['@helion.bundle/src/startup/prepare.js'].split(',')[1],'base64').toString('utf8');
const plan=Buffer.from(imports['@helion.bundle/src/startup/worker-source.js'].split(',')[1],'base64').toString('utf8');
const watchdog=Buffer.from(imports['@helion.bundle/src/gpu/progress-watchdog.js'].split(',')[1],'base64').toString('utf8');
assert.match(loader,/type: plan.type/);assert.match(plan,/type: 'classic', source: embeddedSource/);
assert.doesNotMatch(watchdog,/schedule\s*=\s*setTimeout|cancel\s*=\s*clearTimeout/);
assert.doesNotMatch(worker,/^\s*(?:import|export)\s|import\.meta|@helion\.bundle/m,'Classic worker must be self-contained');
for(const name of ['serve-helion.py','start-helion.command','start-helion.sh','start-helion.cmd'])assert.equal(await readFile(new URL('../dist/'+name,import.meta.url),'utf8'),await readFile(new URL('../'+name,import.meta.url),'utf8'));
console.log('Native-receiver timer wrappers, classic embedded worker, guarded launches, and local launchers verified.');

const typography=await readFile(new URL('../dist/helion-typography.html',import.meta.url),'utf8');
assert.deepEqual(JSON.parse(typography.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports,imports);
assert.deepEqual(readGlobal(typography,'__HELION_SHADERS__'),shaders);
assert.equal(readGlobal(typography,'__HELION_PREPARE_WORKER_SOURCE__'),worker);
assert.ok(typography.includes(launchScript('@helion.bundle/typography/app.js',{standalone:true})));
assert.ok(typography.includes(await readFile(new URL('../typography/typography.css',import.meta.url),'utf8')));
assert.ok(typography.includes(`name="helion-version" content="${version}"`));
assert.ok(!/<(?:button|textarea|select)\b/i.test(typography));
console.log('Typography lab exact runtime/shaders/worker/style, version and guarded bootstrap verified.');
