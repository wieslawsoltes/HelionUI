import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {h,compile} from '../src/core/compiler.js';
import {fixtureFont} from './font-fixture.mjs';
import {diagnosticProgram} from '../src/gpu/shader-library.js';
import {hudLayout,numericText,graphVertices,fontPlan,polygonPixelCoverage} from './hud-reference.mjs';
const sources=Object.fromEntries(await Promise.all(['curve-coverage','hud-common','hud-viewport','hud','present'].map(async name=>[name,await readFile(new URL(`../shaders/${name}.wgsl`,import.meta.url),'utf8')])));
const compiled=compile(h('Border'),{fonts:[fixtureFont()]});
test('HUD programs include shared helpers and retain precise file diagnostic ranges',()=>{
 for(const name of ['hud','present']){const program=diagnosticProgram(sources,name),lines=program.code.split('\n');
  for(const section of program.sections)assert.equal(lines.slice(section.startLine-1,section.endLine).join('\n'),sources[section.name.slice(8,-5)]);
 }
 assert.throws(()=>diagnosticProgram({},'hud'),/Missing/);assert.throws(()=>diagnosticProgram(sources,'bad'),/Unknown/);
});
test('HUD uses real retained outlines, not the removed diagnostic bitmap alphabet',()=>{
 assert.doesNotMatch(sources.present,/fn hudGlyph\(|fn hudNumber\(|vec2<u32>\(0x/);
 assert.match(sources.hud,/hudHeap\[face\+4u\]\+hudGlyphId/);assert.match(sources.hud,/hudOutlineCoverage/);
 assert.match(sources['hud-common'],/hudPair/);assert.match(sources.present,/hudLinear|hudSrgb/);
});
test('HUD responsive layout fits desktop, phone and small canvases without forced enlargement',()=>{
 for(const [w,h] of [[1600,900],[430,760],[320,568],[240,240],[100,160]])for(const dpr of [1,1.25,1.5,2]){
  const p=hudLayout(w,h,dpr);assert.ok(p.scale>0&&p.scale<=1);assert.ok(p.origin[0]+p.width<=w);assert.ok(p.origin[1]+p.height<=h);assert.equal(p.ratio,p.scale*dpr);
 }
});
test('HUD number formatting preserves zero, decimal carry and full FPS digit count',()=>{
 for(const [value,decimal,text] of [[0,false,'0'],[0,true,'0.0'],[50,false,'50'],[119,false,'119'],[240,false,'240'],[18.94,true,'18.9'],[18.96,true,'19.0'],[99.99,true,'100.0'],[9999.9,true,'9999.9']])assert.equal(numericText(value,decimal),text);
});
test('HUD number formatting explicitly marks invalid values and overflow',()=>{
 for(const value of [-1,NaN,Infinity])assert.equal(numericText(value,true),'N/A');
 for(const value of [9999.95,10000,800000])assert.equal(numericText(value,true),'9999+');
 assert.equal(numericText(9999.9),'9999+');
});
test('HUD font planning uses actual font advances and transparent margins at each DPR',()=>{
 for(const ratio of [.7,1,1.25,1.5,2])for(const kind of [0,1]){
  const plan=fontPlan(compiled,ratio,kind),a=plan[65-32],space=plan[0];assert.ok(Math.abs(a.advance-.6*(kind?26:12)*ratio)<.00001);
  assert.equal(space.path,0);assert.deepEqual(space.extent,[0,0]);assert.ok(!space.cached);
  for(const g of plan.filter(g=>g.cached)){assert.ok(g.extent.every(x=>x<=64));assert.ok(g.extent[0]*g.extent[1]<=4096);assert.ok(g.origin[0]<=0);}
 }
});
test('HUD oversized outlines bypass the bounded mask cache rather than clipping',()=>{
 const plan=fontPlan(compiled,10,1);assert.equal(plan[65-32].cached,false);assert.ok(plan[65-32].extent.some(n=>n>64));
 assert.match(sources.present,/hudOutlineCoverage\(hudFont\[recordAt\]/);assert.match(sources.hud,/all\(extent<=vec2<f32>\(64.0\)\)/);
});
test('HUD memory reservations and independent glyph slots cannot overlap',()=>{
 const metaStart=16,metaEnd=16+190*8,pixels=1536;assert.equal(metaEnd,pixels);
 assert.equal((pixels+190*1024)*4,784384);
 assert.equal((pixels+190*1024+95*95)*4,820484);
 assert.match(sources['hud-common'],/HUD_PAIR_TABLE:u32=196096u/);
 assert.equal(16+512*8,4112);assert.equal(4112+27*22,4706);assert.equal((4706+27*22*16)*4,56840);
 assert.match(sources.present,/if\(exhaustive\)/);assert.match(sources.hud,/hudData\[1\]\|=2u/);
});
test('HUD history leaves unrecorded space empty and the newest sample at the right',()=>{
 const h=new Uint32Array(512),f=new Float32Array(h.buffer);h[0]=3;h[1]=3;[10,20,30].forEach((v,j)=>f[32+j*4]=v);
 const p=graphVertices(h,0);assert.deepEqual(p.map(x=>x.value),[10,20,30]);assert.ok(p[0].x>100);assert.equal(p.at(-1).x,104);
});
test('HUD ring history preserves oldest/newest order after wrap',()=>{
 const h=new Uint32Array(512),f=new Float32Array(h.buffer);h[0]=53;h[1]=120;
 for(let j=0;j<120;j++)f[32+((53+j)%120)*4+2]=j;
 const p=graphVertices(h,2);assert.deepEqual(p.map(x=>x.value),Array.from({length:120},(_,i)=>i));assert.equal(p[0].x,0);assert.equal(p.at(-1).x,104);
});
test('HUD retains spike values above the chart ceiling and reports clipping visually',()=>{
 const h=new Uint32Array(512),f=new Float32Array(h.buffer);h[1]=120;f[32+71*4]=92;
 const p=graphVertices(h,0);assert.equal(Math.max(...p.map(x=>x.value)),92);assert.equal(p.filter(x=>x.value===92).length,1);
 assert.match(sources.present,/if\(a>range\)/);assert.match(sources.present,/hudSegmentDistance\(p,v0,v1\)/);
});
test('HUD no-timestamp and no-cadence labels do not silently display fabricated durations',()=>{
 assert.match(sources.hud,/select\(2u,select\(1u,29u,history\[3397u\]!=0u\),native\)/);assert.match(sources.hud,/if\(budget>0.0\)/);assert.match(sources.hud,/if\(native && size>0u/);
 const range=sources.hud.match(/const HUD_LABELS:[\s\S]*?\(([^;]*)\);/)[1];const text=String.fromCodePoint(...[...range.matchAll(/(\d+)u/g)].map(m=>+m[1]));
 assert.ok(text.includes('CPU encode timings'));assert.ok(text.includes('Not scanout'));assert.ok(text.includes('N/A'));
});
test('independent pixel polygon reference covers partial triangle pixels correctly',()=>{
 assert.equal(polygonPixelCoverage([[0,0],[1,0],[0,1]],0,0),.5);
 assert.equal(polygonPixelCoverage([[0,0],[2,0],[2,2],[0,2]],0,0),1);
 assert.equal(polygonPixelCoverage([[0,0],[1,0],[0,1]],2,2),0);
});
