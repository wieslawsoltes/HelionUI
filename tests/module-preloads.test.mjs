import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {modulePreloadPaths,modulePreloadScript} from '../tools/module-preloads.mjs';

const graph=new Map([
  ['designer/app.js',['src/index.js','designer/examples.js']],
  ['src/index.js',['src/gpu/runtime.js','src/core/schema.js']],
  ['src/gpu/runtime.js',['src/core/schema.js','src/index.js']],
  ['src/core/schema.js',[]],['designer/examples.js',[]],['unrelated.js',[]]
]);
test('preloads deduplicate cycles and shared dependencies while retaining application-relative paths',()=>{
  assert.deepEqual(modulePreloadPaths(graph,'designer/app.js','designer/index.html'),[
    './app.js','../src/index.js','../src/gpu/runtime.js','../src/core/schema.js','./examples.js'
  ]);
  assert.ok(modulePreloadPaths(graph,'designer/app.js','index.html').every(path=>path.startsWith('./')));
  assert.throws(()=>modulePreloadPaths(new Map([['app.js',['missing.js']]]),'app.js','index.html'),/Missing preload module/);
});
for(const protocol of ['http:','https:','file:','data:'])test(`preload bootstrap respects ${protocol} document boundary`,()=>{
  const links=[],html=modulePreloadScript(graph,'designer/app.js','designer/index.html');
  const code=html.slice(html.indexOf('>')+1,html.lastIndexOf('</script>'));
  const allowed=protocol==='http:'||protocol==='https:';
  vm.runInNewContext(code,{location:{protocol},document:{createElement(tag){assert.ok(allowed,'file/data must not access module-loading DOM');assert.equal(tag,'link');return{};},head:{append:link=>links.push(link)}}});
  assert.deepEqual(links.map(link=>link.href),allowed?modulePreloadPaths(graph,'designer/app.js','designer/index.html'):[]);
  assert.ok(links.every(link=>link.rel==='modulepreload'));
});
