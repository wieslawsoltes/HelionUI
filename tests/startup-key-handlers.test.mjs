import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import{scalarEditor,scalarFunctions,translateScalarBody}from'../tools/editor-kernel-host.mjs';
import{analyzeShaderDeclarations}from'../src/gpu/shader-partitions.js';
const editor=await readFile(new URL('../shaders/editor.wgsl',import.meta.url),'utf8');
const designer=await readFile(new URL('../shaders/designer.wgsl',import.meta.url),'utf8');
const input=await readFile(new URL('../shaders/input.wgsl',import.meta.url),'utf8');
for(const [name,source,wrapper,callee] of [['editor shortcuts',editor,'executeEditorKey','editorCommand'],['designer shortcuts',designer,'dsKey','dsCommand'],['control activation',input,'handleKey','activate']])test(`${name} reaches its large interpreter through one call site`,()=>{
 const f=analyzeShaderDeclarations(source).functions;assert.equal(f.get(wrapper).calls.filter(n=>n===callee).length,1);assert.equal(f.get(wrapper.replace('executeEditor','editor')+'Request').calls.filter(n=>n===callee).length,0);
});
test('TextBox spaces no longer include the entire code-editor/activation interpreter',()=>{
 const f=analyzeShaderDeclarations(input).functions;assert.ok(f.get('handleKeyRequest').calls.includes('insertTextBoxCharacter'));assert.ok(!f.get('handleKeyRequest').calls.includes('insertCharacter'));assert.ok(!f.get('insertTextBoxCharacter').calls.includes('editorText'));
});
test('shortcut decoder retains argument-bearing go-to-line and zoom commands',()=>{
 const e=scalarEditor('a\nb\nc\n');e.key(71,2).type('3').key(13);assert.equal(e.snapshot().selections[0].caret,4);
 const initial=e.nodes[0].misc.z;e.key(187,2);assert.equal(e.nodes[0].misc.z,initial+1);e.key(189,2);assert.equal(e.nodes[0].misc.z,initial);
});
test('command palette, undo, redo, completion and indent remain actual transactions',()=>{
 const e=scalarEditor('abc');e.command('select',3,3).type('d').key(90,2);assert.equal(e.snapshot().text,'abc');e.key(90,3);assert.equal(e.snapshot().text,'abcd');
 e.key(80,3).type('undo').key(13);assert.equal(e.snapshot().text,'abc');
 e.command('select',0,3).key(9);assert.match(e.snapshot().text,/^ +abc/);
});
test('inactive editor panes retain visual layout dirtiness until actually visible',()=>{
 const options={visible:false,wordWrap:true};const e=scalarEditor('a long line for wrapping\nanother line',options),d=e.meta.pointer;
 e.analyze();assert.ok(e.heap[d+19]&4);options.visible=true;e.analyze();assert.equal(e.heap[d+19]&4,0);
 const count=e.heap[d+32];options.visible=false;e.command('toggleWrap');e.analyze();assert.equal(e.heap[d+32],count);assert.ok(e.heap[d+19]&4);
});
const render=await readFile(new URL('../shaders/designer-render.wgsl',import.meta.url),'utf8');
const formatFunction=scalarFunctions(render).find(f=>f.name==='dsDecimal');
function actualDecimal(value,places){
 const calls=[];const code=translateScalarBody(formatFunction.code).replace(/\bv\s*\/=\s*10/g,'v=u32(v/10)').replace(/fraction\/divisor/g,'u32(fraction/divisor)').replace(/\bdivisor\s*\/=\s*10/g,'divisor=u32(divisor/10)');
 const names=['glyph','glyphAdvance','vec2f','min','abs','floor','round','fract','u32','f32'];
 const values=[(_i,c,p)=>calls.push({c,x:p.x,y:p.y}),(_i,c)=>1+(c%3)*.25,(x,y)=>({x,y}),Math.min,Math.abs,Math.floor,Math.round,x=>x-Math.floor(x),x=>Math.trunc(x)>>>0,Math.fround];
 const fn=new Function(...names,`${code};return dsDecimal;`)(...values);const x=fn(0,value,places,{x:3,y:9},12,{}, {},{});return{calls,x};
}
function expectedDecimal(value,places){const scale=10**Math.min(3,places),v=Math.min(Math.abs(value),9999999);let whole=Math.floor(v),fraction=Math.round((v-whole)*scale);if(fraction>=scale){whole++;fraction=0;}return(value<0&&(whole||fraction)?'-':'')+whole+(fraction&&places?'.'+String(fraction).padStart(Math.min(3,places),'0').replace(/0+$/,''):'');}
test('bounded diagnostic-number emission preserves formatting and unsnapped glyph advances',()=>{
 const cases=[0,-0,.0005,-.125,.9999,9.9999,99.9999,9999999,-99999999];let seed=31;for(let i=0;i<100;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;cases.push(Math.fround((seed/2**32-.5)*1e5));}
 for(const v of cases)for(let places=0;places<5;places++){const actual=actualDecimal(v,places);assert.equal(String.fromCodePoint(...actual.calls.map(c=>c.c)),expectedDecimal(v,places),`${v}/${places}`);let x=3;for(const glyph of actual.calls){assert.equal(glyph.x,x);assert.equal(glyph.y,9);x+=1+(glyph.c%3)*.25;}assert.equal(actual.x,x);}
});
test('all three designer ruler growth loops have explicit iteration bounds',()=>{
 assert.equal((render.match(/growth<32u/g)||[]).length,3);assert.doesNotMatch(render,/while\((?:tick\*z|width\*step\/duration|step\*scale)/);
 for(const scale of [.01,.1,.25,1,2,8,64])for(const start of [.1,1,10,100]){let old=start,n=0;while(old*scale<48){old*=2;if(++n>32)throw Error('reference exceeded bound');}let bounded=start;for(let i=0;i<32&&bounded*scale<48;i++)bounded*=2;assert.equal(old,bounded);}
});
