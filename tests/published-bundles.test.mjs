import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {publishedBundles,publishedHTML} from '../tools/published-bundles.mjs';
import {launchPages,launchScript} from '../tools/launch-bootstrap.mjs';
import {modulePreloadPaths} from '../tools/module-preloads.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
test('published bundles close their import graph and preserve asset paths beneath repository subpaths',async()=>{
 const bundle=await publishedBundles(root,resolve(root,'dist'));
 assert.equal(bundle.routes.size,launchPages.length);
 for(const page of launchPages){
  const entry=bundle.routes.get(page.bundle),paths=modulePreloadPaths(bundle.graph,entry,page.file);
  assert.ok(paths.length<=4,'Published app should load at most four JavaScript modules');
  for(const path of paths)assert.ok(new URL(path,'https://example.test/HelionUI/'+page.file).pathname.startsWith('/HelionUI/assets/'));
  const html=publishedHTML(launchScript(page.entry,{path:page.path}),page,bundle);
  assert.match(html,/data-helion-bundle/);assert.match(html,/__HELION_PREPARE_WORKER_URL__/);
 }
 const code=bundle.files.filter(f=>f.path.endsWith('.js')).map(f=>f.text).join('\n');
 for(const module of ['src/gpu/shader-library.js','src/startup/prepare.js','playground/app.js'])assert.ok(code.includes('../'+module),module+': original import.meta URL');
});
test('minified Playground bootstrap is self-contained when serialized into its isolated iframe',async()=>{
 const {outputFiles}=await build({absWorkingDir:root,entryPoints:['src/playground/sandbox.js'],bundle:true,minify:true,format:'esm',target:'es2022',write:false});
 const api=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
 const script=api.sandboxDocument().match(/<script>([\s\S]*)<\/script>/)[1];
 let listener,parts,started=false;const parent={postMessage(){}};
 vm.runInNewContext(script,{parent,addEventListener(type,fn){listener=fn;},Blob:class{constructor(p){parts=p;}},URL:{createObjectURL(){return'blob:test';},revokeObjectURL(){}},Worker:class{constructor(){started=true;}terminate(){}postMessage(){}}});
 listener({source:parent,data:{type:'start',channel:'test',run:1,bundle:'// bundled authoring API',code:'return "minified app";'}});
 assert.ok(started);assert.equal(parts[0],'// bundled authoring API');assert.match(parts[1],/__HELION_AUTHORING__/);assert.match(parts[1],/minified app/);
});
