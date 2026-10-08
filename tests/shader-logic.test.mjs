import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {checkLogicalGrouping,formatLogicalGroupingError} from '../tools/check-wgsl-logic.mjs';
import {scalarFunctions,translateScalarBody} from '../tools/editor-kernel-host.mjs';
import {scalarDesigner} from '../tools/designer-kernel-host.mjs';
import {BUILD_VERSION} from '../src/index.js';

const reportedAllowed='fn dsAllowed(kind:u32)->bool{return kind>=1u&&kind<=18u&&kind!=11u||kind==20u;}';
const reportedRanges='if(field==22u&&(v<=0.0||v>1024.0)||field==25u&&(v<0.0||v>1.0)||(field==27u||field==28u)&&(v<.001||v>64.0)){return false;}';

for(const [name,code] of [['allowed kinds',reportedAllowed],['numeric ranges',reportedRanges]]){
 test(`logical syntax guard rejects the exact reported designer ${name} expression`,()=>{
  const errors=checkLogicalGrouping(code,'shaders/designer.wgsl');
  assert.equal(errors.length,1);assert.equal(code.slice(errors[0].offset,errors[0].offset+2),'||');
  assert.match(formatLogicalGroupingError(errors[0]),/^shaders\/designer\.wgsl:1:\d+: mixing '&&' and '\|\|'/);
 });
 test(`scalar adapter must not silently accept invalid WGSL as JavaScript: ${name}`,()=>{
  assert.throws(()=>translateScalarBody(code),/mixing/);
  assert.throws(()=>scalarFunctions(code),/mixing/);
 });
}
for(const [name,code] of [
 ['and before or','fn f(a:bool,b:bool,c:bool)->bool{return a&&b||c;}'],
 ['or before and','fn f(a:bool,b:bool,c:bool)->bool{return a||b&&c;}'],
 ['parenthesized whole expression','if (a && b || c) {}'],
 ['multiline condition','if a &&\n b || c {}'],
 ['nested function argument','let x=select(false,true,a && (b) || c);'],
 ['indexed expression','let x=items[u32(a || b && c)];'],
 ['for condition','for(var i=0u;a||b&&c;i++){ }'],
 ['while condition','while a||b&&c {break;}'],
 ['return condition','return (a || b && c);']
])test(`logical syntax guard rejects ${name}`,()=>assert.equal(checkLogicalGrouping(code).length,1));

for(const [name,code] of [
 ['grouped conjunction','return (a && b) || c;'],
 ['grouped disjunction','return a && (b || c);'],
 ['separate arguments','return select(a && b,c || d,flag);'],
 ['separate statements','let a=x&&y; let b=x||y;'],
 ['separate conditions','if a && b {} else if c || d {}'],
 ['separate scopes','if a && b {return c||d;}'],
 ['nested parentheses','return ((a || b) && (c || d)) || e;'],
 ['nested and line comments','/* a && b /* c || d */ || e */ return (a&&b)||c; // x&&y||z'],
 ['individual bit operators','let mask=(x&3u)|4u;return a&&b;'],
 ['template argument separator','let x=foo(a&&b, vec2<bool>(c||d, e&&f));']
])test(`logical syntax guard accepts ${name}`,()=>assert.deepEqual(checkLogicalGrouping(code),[]));

test('logical syntax diagnostic preserves line and column after nested comments',()=>{
 const source='/* x\n /* y */ z */\nreturn a && b || c;';
 const [e]=checkLogicalGrouping(source,'fixture.wgsl');
 assert.equal(e.line,3);assert.equal(e.column,15);assert.equal(e.offset,source.indexOf('||'));
});
test('logical syntax diagnostics report separate bad expressions once each',()=>{
 assert.equal(checkLogicalGrouping('let x=a&&b||c&&d;let y=x||y&&z;').length,2);
 assert.throws(()=>checkLogicalGrouping(null),TypeError);
});
test('every shipped shader has explicit mixed-logical grouping',async()=>{
 for(const file of (await readdir(new URL('../shaders/',import.meta.url))).filter(f=>f.endsWith('.wgsl'))){
  const code=await readFile(new URL('../shaders/'+file,import.meta.url),'utf8');
  assert.deepEqual(checkLogicalGrouping(code,file),[],file);
 }
});
test('reintroducing either reported expression is caught in the assembled-source audit',async()=>{
 const s=await readFile(new URL('../shaders/designer.wgsl',import.meta.url),'utf8');
 const mutant=s.replace(/fn dsAllowed[\s\S]*?\n}/,reportedAllowed);
 assert.notEqual(mutant,s);assert.equal(checkLogicalGrouping(mutant).length,1);
 assert.equal(checkLogicalGrouping(s+'\nfn regression(field:u32,v:f32)->bool{'+reportedRanges+'return true;}').length,1);
});
test('kind grouping preserves the exact allowed palette including Ellipse and excluding DataGrid',()=>{
 const d=scalarDesigner();
 for(let kind=0;kind<256;kind++)assert.equal(d.kernel.dsAllowed(kind),(kind>=1&&kind<=18&&kind!==11)||kind===20,`kind ${kind}`);
});
test('grouped font-size, opacity, and scale validation preserves boundary behavior',()=>{
 const d=scalarDesigner().select(0).command('insert',5);
 for(const field of [22,25,27,28])for(const v of [-1,0,.0005,.001,.5,1,1.5,64,65,1024,1025]){
  const expected=field===22?v>0&&v<=1024:field===25?v>=0&&v<=1:v>=.001&&v<=64;
  const before=d.raw(1,field);
  assert.equal(d.kernel.dsSetNumber(d.d,1,field,v),expected,`${field}: ${v}`);
  if(!expected)assert.equal(d.raw(1,field),before,'Rejected property must remain unchanged');
 }
});
test('rendering and release versions are not confused with the retained ABI',async()=>{
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(BUILD_VERSION,pkg.version);
 for(const file of ['index.html','playground/index.html','designer/index.html','designer/runner.html']){
  const text=await readFile(new URL('../'+file,import.meta.url),'utf8');
  assert.ok(text.includes(`name="helion-version" content="${BUILD_VERSION}"`),file);
 }
 for(const file of ['examples/showcase.js','playground/app.js','designer/app.js','designer/runner.js']){
  const text=await readFile(new URL('../'+file,import.meta.url),'utf8');
  assert.match(text,/import \{BUILD_VERSION\}/,file);
  assert.ok(text.includes('Build: ${BUILD_VERSION}'),file);
  assert.doesNotMatch(text,/Build: 0\.7\.0|engine:'0\.7\.0|version:'0\.11\.0/);
 }
});
