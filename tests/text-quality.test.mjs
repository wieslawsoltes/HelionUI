import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {lineArea,quadraticArea,quadraticPoints,cubicArea,shapeCoverage} from './curve-reference.mjs';
import {polygonPixelCoverage} from './hud-reference.mjs';
import {seeded} from './reference.mjs';
import {resolveViewport,pixelObservation,resolutionMode,textQuality} from '../src/gpu/viewport.js';
import {DEFAULT_LIMITS} from '../src/core/schema.js';
import {validatedLimits} from '../src/core/compiler.js';
import {arenaLayout} from '../src/gpu/arena-layout.js';
import {shaderProgram,diagnosticProgram,resourcesForEntry} from '../src/gpu/shader-library.js';
import {checkFunctionGraph,checkFunctionCalls} from '../tools/check-wgsl-graph.mjs';
const near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b} (tolerance ${e})`);
const names=['common','templates','designer','curve-coverage','unicode','shaping','shaping-bidi','paragraph','typography-ui','text','editor','models','docking','controls','presenter','layout','input','data-source','data','flatten','emit','designer-render','editor-render','strips','glyph-cache','hud-viewport','hud-common','hud','present','blit'];
const shaders=Object.fromEntries(await Promise.all(names.map(async name=>[name,await readFile(new URL(`../shaders/${name}.wgsl`,import.meta.url),'utf8')])));

test('exact quadratic pixel area: known integral and reversed winding',()=>{
 near(quadraticArea([0,0],[1,0],[1,1]),1/6);near(quadraticArea([0,0],[.5,0],[1,1]),1/3);
 near(quadraticArea([1,1],[1,0],[0,0]),-1/6);
 near(quadraticArea([.5,-1],[.5,.5],[.5,2]),.5);
 near(quadraticArea([2,0],[2,1],[2,2]),0);
});
test('quadratic partitioning handles degeneracy, tangency and all four pixel boundaries',()=>{
 const cases=[[[.2,-2],[.5,.2],[.8,2]],[[0,0],[.5,2],[1,0]],[[-2,.1],[3,.5],[-2,.9]],[[0,0],[0,0],[0,1]],[[1,1],[1,0],[1,1]],[[-1,.5],[2,-.5],[-1,.5]],[[.2,0],[.2,1e-9],[.2,2e-9]],[[.1,.1],[.5,.5],[.9,.9]]];
 for(const p of cases){const actual=Math.abs(quadraticArea(...p)+lineArea(p[2],p[0]));const expected=polygonPixelCoverage(quadraticPoints(...p),0,0);near(Math.min(1,actual),expected,2e-6);}
});
test('quadratic coverage agrees with independent polygon clipping for 1200 seeded curves',()=>{
 const rng=seeded(0x812e);let maxError=0;
 for(let j=0;j<1200;j++){
  const p=Array.from({length:3},()=>[(rng()-.5)*8,(rng()-.5)*8]);
  const actual=Math.min(1,Math.abs(quadraticArea(...p)+lineArea(p[2],p[0])));
  const expected=polygonPixelCoverage(quadraticPoints(...p,1024),0,0);
  maxError=Math.max(maxError,Math.abs(actual-expected));
  near(quadraticArea(...p),-quadraticArea(...p.toReversed()),1e-10);
 }assert.ok(maxError<.000025,`maximum error ${maxError}`);
});
test('curve area remains bounded and stable under reflection, shear, scale and thin counters',()=>{
 const contour=[[1,0,0,.5,-.8,1,0],[0,1,0,0,0]];
 for(const size of [.01,1,12,40,128,512])for(const phase of [0,.125,.5,.875])for(const m of [[size,0,0,size],[-size,0,0,size],[size,.2*size,.4*size,size]]) {
  for(const pixel of [[0,0],[1,0],[4,2],[-1,-1]]) {const v=shapeCoverage(contour,pixel,m,[phase,phase]);assert.ok(Number.isFinite(v)&&v>=0&&v<=1);}
 }
 const outer=[[0,0,0,1,0],[0,1,0,1,1],[0,1,1,0,1],[0,0,1,0,0]],inner=[[0,.1,.1,.1,.9],[0,.1,.9,.9,.9],[0,.9,.9,.9,.1],[0,.9,.1,.1,.1]];
 near(shapeCoverage([...outer,...inner]),.36);
});
test('device-space cubic subdivision follows physical size and preserves straight/remote edges',()=>{
 near(cubicArea([.25,0],[.25,1/3],[.25,2/3],[.25,1]),.75);
 near(cubicArea([-100,-1],[-2,5],[-4,-3],[-8,2]),1);
 near(cubicArea([2,0],[3,1],[4,2],[2,3]),0);
 const forward=cubicArea([0,0],[1,0],[0,1],[1,1]);const reverse=cubicArea([1,1],[0,1],[1,0],[0,0]);near(forward,-reverse,1e-9);
});
test('native backing resolution supports 4K, Retina 5K and DPR 3 without the old 2048/2 clamp',()=>{
 for(const [width,height,dpr] of [[3840,2160,1],[2560,1440,2],[1920,1080,2],[430,900,3],[1280,720,1.25]]){
  const v=resolveViewport({width,height},DEFAULT_LIMITS,{devicePixelRatio:dpr});assert.equal(v.w,Math.round(width*dpr));assert.equal(v.h,Math.round(height*dpr));assert.ok(v.nativeResolution);assert.equal(v.limitedBy,null);
 }
});
test('exact ResizeObserver device pixel dimensions beat ambiguous CSS multiplication',()=>{
 const obs=pixelObservation({devicePixelContentBoxSize:[{inlineSize:200,blockSize:160}],contentRect:{width:99.66,height:80}});
 const v=resolveViewport({width:99.66,height:80},DEFAULT_LIMITS,{devicePixelRatio:2,observation:obs});assert.equal(v.w,200);assert.equal(v.h,160);assert.equal(v.dpr,2);assert.ok(v.devicePixelBox);
 const manual=resolveViewport({width:99.66,height:80},DEFAULT_LIMITS,{pixelRatio:1,devicePixelRatio:2,observation:obs});assert.equal(manual.w,100);assert.equal(manual.devicePixelBox,false);
 assert.equal(pixelObservation({devicePixelContentBoxSize:{inlineSize:Infinity,blockSize:1},contentRect:{width:1,height:1}}),null);assert.equal(pixelObservation({}),null);assert.equal(pixelObservation({devicePixelContentBoxSize:[],contentRect:{}}),null);
});
test('backing resolution enforces rectangular tile limits and reports every downscale',()=>{
 const rng=seeded(45);
 for(let j=0;j<1000;j++){
  const limits={...DEFAULT_LIMITS,maxRenderTiles:256+Math.floor(rng()*65000)},rect={width:16+rng()*16000,height:16+rng()*10000};
  const v=resolveViewport(rect,limits,{devicePixelRatio:.5+rng()*4});
  assert.ok(v.tileCols*v.tileRows<=limits.maxRenderTiles);assert.ok(v.w<=8192&&v.h<=8192);assert.ok(v.w>0&&v.h>0);
  assert.equal(v.nativeResolution,v.w===v.requestedW&&v.h===v.requestedH);if(!v.nativeResolution)assert.equal(v.limitedBy,'configured-capacity');
 }
 const v=resolveViewport({width:8192,height:1024},DEFAULT_LIMITS);assert.equal(v.w,8192);assert.equal(v.h,1024);assert.ok(v.nativeResolution);
});
test('balanced reference policy and explicit texture/device limits cannot silently exceed capacity',()=>{
 const v=resolveViewport({width:1920,height:1080},DEFAULT_LIMITS,{devicePixelRatio:2,resolutionMode:'balanced'});
 assert.equal(v.w,2048);assert.equal(v.limitedBy,'balanced-policy');
 const low=resolveViewport({width:1200,height:800},DEFAULT_LIMITS,{devicePixelRatio:2,maxTextureDimension2D:1024});assert.ok(low.w<=1024&&low.h<=1024);assert.equal(low.limitedBy,'configured-capacity');
 for(const ratio of [0,-1,NaN,Infinity])assert.throws(()=>resolveViewport({width:4,height:4},DEFAULT_LIMITS,{pixelRatio:ratio}),/pixelRatio/);
 assert.throws(()=>resolutionMode('supersample'));assert.throws(()=>textQuality('pixelated'));
});
test('rectangular arenas support wide targets without reserving an 8192-square tile grid',()=>{
 const a=arenaLayout(DEFAULT_LIMITS);assert.equal(a.maxTiles,65536);assert.ok(a.scratchBytes<128*1024**2);
 assert.equal(arenaLayout({...DEFAULT_LIMITS,maxDimension:768}).maxTiles,48**2);
 assert.throws(()=>validatedLimits({maxRenderTiles:262145}),/Limits/);
 assert.equal(validatedLimits({maxDimension:8192}).maxDimension,8192);
});
test('all UI, HUD and presentation programs have complete acyclic call graphs',()=>{
 const programs=[shaderProgram(shaders).code,...['hud','present','blit'].map(n=>diagnosticProgram(shaders,n).code)];
 for(const code of programs){assert.deepEqual(checkFunctionGraph(code),[]);assert.deepEqual(checkFunctionCalls(code),[]);}
});
test('all glyph rasterization stays in compute; final presentation only copies finished texels',()=>{
 assert.doesNotMatch(shaders.present,/@fragment|@vertex/);assert.match(shaders.present,/@compute @workgroup_size\(8,8\)/);
 assert.doesNotMatch(shaders.blit,/curveQuadraticArea|hudGlyphAlpha|hudOutlineCoverage|textureSample/);
 assert.match(shaders.blit,/hudBlitFragment/);assert.match(shaders.present,/textureStore\(hudOutput/);
 assert.match(shaders.present,/return hudMaskAt\(index,vec2<i32>\(floor\(point\)\)\)/);
 assert.match(shaders.hud,/origin=\(round\(panel\+origin\*ratio\)-panel\)\/ratio/);
});
test('exact glyph cache keys preserve fractional phase and segregate quality modes',()=>{
 const code=shaders['glyph-cache'];assert.match(code,/glyphCache\[entryAt\+14u\]==\(frame.flags.y&16384u\)/);
 assert.match(code,/glyphCache\[entryAt\+14u\]=frame.flags.y&16384u/);
 assert.match(code,/key\[5\]=bitcast<u32>\(fraction.x\)/);assert.match(code,/curveQuadraticArea\(a,b,c\)/);
 const main=shaderProgram(shaders).code;
 assert.ok(!resourcesForEntry(main,'rasterGlyphCache').some(r=>r.binding===6));
 assert.match(shaders.presenter,/round\(\(r.xy\+n.translation.xy\)\*dpr\)/);
});

test('fractional text clipping integrates a clipped rectangle instead of testing only its center',()=>{
 const square=[[0,0,0,1,0],[0,1,0,1,1],[0,1,1,0,1],[0,0,1,0,0]];
 for(const [x,y,w,h] of [[0,0,.25,1],[.6,.7,.4,.3],[.1,.1,.8,.8]]) {
  near(shapeCoverage(square,[0,0],[1/w,0,0,1/h],[-x/w,-y/h])*w*h,w*h);
 }
 assert.match(shaders.strips,/glyphRegionCoverage\(p,first,last-first\)/);
 assert.match(shaders['glyph-cache'],/extent.x\*extent.y/);
});
test('untransformed Fit uses one-to-one compute texel loads; transformed previews keep reconstruction',()=>{
 assert.match(shaders.emit,/all\(pixels==round\(rect.zw\*frame.viewport.z\)\)/);
 assert.match(shaders.strips,/previewTexel\(vec2<i32>\(floor\(point-origin\)\)/);
 assert.match(shaders.strips,/previewColor\(\(local-p.rect.xy\)/);
 for(const origin of [0,1,249,-140])for(let i=0;i<100;i++)assert.equal(Math.floor(origin+i+.5-Math.round(origin)),i);
});
