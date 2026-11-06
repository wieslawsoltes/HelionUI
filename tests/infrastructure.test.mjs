import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStaticServer } from '../tools/serve.mjs';
import { resourcesForEntry, kernels, shaderSource } from '../src/gpu/shader-library.js';
import { HelionSurface } from '../src/gpu/runtime.js';
const shaders=Object.fromEntries(await Promise.all(['common','templates','designer','curve-coverage','unicode','shaping','shaping-bidi','paragraph','typography-ui','text','editor','editor-render','models','docking','controls','presenter','data-source','layout','input','data','flatten','emit','designer-render','strips','glyph-cache'].map(async n=>[n,await readFile(new URL(`../shaders/${n}.wgsl`,import.meta.url),'utf8')])));
const source=shaderSource(shaders,{});
test('every native entry is discoverable and within eight storage-buffer bindings',()=>{assert.equal(kernels.length,85);for(const k of kernels){const used=resourcesForEntry(source,k);assert.ok(used.length);assert.ok(used.filter(x=>![0,8,9,12].includes(x.binding)).length<=8);}});
test('indirect consumers never simultaneously bind arguments as writable storage',()=>{for(const k of ['measure','constraints','arrange','filterScan','scanBlocks','scatterRows','sortBlocks','mergeRows','resolveSelection','buildJobs','makeStrips','binStrips','rasterGlyphCache']) assert.ok(!resourcesForEntry(source,k).some(x=>x.binding===6),k);});
test('entry call graph ignores comments and recursively discovers resources',()=>{const s='fn helper() { state[0]=nodes[0].info.x; } fn entry() { helper(); /* indirect */ }';assert.deepEqual(resourcesForEntry(s,'entry').map(x=>x.binding),[1,2]);assert.throws(()=>resourcesForEntry(s,'absent'));});
test('runtime render method contains no mapping or CPU layout implementation',()=>{const code=HelionSurface.prototype.render.toString();assert.ok(!/mapAsync|inspect\(|layoutReference|readPixels/.test(code));assert.match(code,/writeBuffer\(this.frameBuffer/);});
test('development server serves modules, WGSL, HEAD and explicit errors',async()=>{
 const server=createStaticServer(fileURLToPath(new URL('..',import.meta.url)));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 try { const response=await fetch(base+'/');assert.equal(response.status,200);assert.match(await response.text(),/HELION/i);const js=await fetch(base+'/src/index.js');assert.match(js.headers.get('content-type'),/javascript/);assert.match(await js.text(),/HelionSurface/);const head=await fetch(base+'/shaders/common.wgsl',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal((await fetch(base+'/missing')).status,404);assert.equal((await fetch(base+'/%zz')).status,400);assert.equal((await fetch(base+'/',{method:'POST'})).status,405);assert.equal((await fetch(base+'/..%2f..%2fetc%2fpasswd')).status,403); }
 finally {await new Promise(r=>server.close(r));}
});
test('resource discovery memoizes shared callees without leaking bindings across entries or sources',()=>{
 const source='fn leaf() { heap[0]=relay[0]; } fn left() { leaf(); nodes[0]; } fn right() { leaf(); glyphCache[0]; } fn root() { left(); right(); } fn other() { commands[0]; }';
 assert.deepEqual(resourcesForEntry(source,'root').map(x=>x.binding),[1,3,11,13]);
 assert.deepEqual(resourcesForEntry(source,'other').map(x=>x.binding),[7]);
 assert.deepEqual(resourcesForEntry(source,'left').map(x=>x.binding),[1,3,13]);
 assert.deepEqual(resourcesForEntry('fn leaf() { state[0]; }','leaf').map(x=>x.binding),[2]);
 assert.deepEqual(resourcesForEntry(source,'leaf').map(x=>x.binding),[3,13]);
 assert.throws(()=>resourcesForEntry('fn a(){ b(); } fn b(){ a(); }','a'),/Recursive/);
});
