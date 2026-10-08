import test from 'node:test';
import assert from 'node:assert/strict';
import { polygonCoverage, edgeArea, scanCompact, bitonic, stripEncode, stripDecode, seeded } from './reference.mjs';
const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);
test('analytic line integrals reproduce fractional rectangle coverage', () => {
 for (const [x0,y0,x1,y1] of [[0,0,1,1],[.25,.25,.75,.75],[-1,.2,.4,3],[.2,-1,1.7,.1],[2,2,4,4]]) {
  const expected = Math.max(0, Math.min(x1,1)-Math.max(x0,0))*Math.max(0,Math.min(y1,1)-Math.max(y0,0));
  const points = [[x0,y0],[x1,y0],[x1,y1],[x0,y1]]; near(polygonCoverage(points,[0,0]),expected); near(polygonCoverage([...points].reverse(),[0,0]),expected);
 }
});
test('triangle analytical coverage and translation invariance', () => { near(polygonCoverage([[0,0],[1,0],[0,1]],[0,0]),.5); near(polygonCoverage([[12,7],[13,7],[12,8]],[12,7]),.5); near(edgeArea([0,1,2,1],[0,0]),0); });
test('random axis-aligned rectangles agree with exact overlap', () => { const r=seeded(); for(let i=0;i<1000;i++){const x=r()*4-2,y=r()*4-2,w=r()*3,h=r()*3;near(polygonCoverage([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],[0,0]),Math.max(0,Math.min(1,x+w)-Math.max(0,x))*Math.max(0,Math.min(1,y+h)-Math.max(0,y)));} });
test('block-prefix compaction crosses 128-lane and maximum-table boundaries', () => { const r=seeded(); for(const n of [0,1,2,127,128,129,255,256,257,65536]) {const mask=Array.from({length:n},()=>r()>.48?1:0);assert.deepEqual([...scanCompact(mask).result],mask.flatMap((v,i)=>v?[i]:[]));} });
test('stable bitonic row-key comparison matches sorted reference', () => { const r=seeded(); for(const n of [0,1,2,3,31,128,257,1024]) for(const descending of [false,true]) {const rows=Array.from({length:n},(_,id)=>({id,value:Math.floor(r()*9)}));const cmp=(a,b)=>(descending?b.value-a.value:a.value-b.value)||a.id-b.id;assert.deepEqual(bitonic(rows,(a,b)=>cmp(a,b)<0),rows.toSorted(cmp));} });
test('sparse strips collapse solid runs, omit empty tiles, retain boundary alpha', () => { const full=Array(16).fill(255),empty=Array(16).fill(0),partial=Array.from({length:16},(_,i)=>i*16);const tiles=[empty,full,full,full,partial,empty,full];const strips=stripEncode(tiles);assert.equal(strips.length,3);assert.deepEqual(strips[0],{start:1,end:4,alpha:null});assert.deepEqual(stripDecode(strips,tiles.length),tiles); });
test('random sparse-strip round trips are lossless for 8-bit coverage', () => { const r=seeded(); for(let k=0;k<100;k++){const tiles=Array.from({length:100},()=>{const mode=r();return Array.from({length:16},()=>mode<.3?0:mode<.6?255:Math.floor(r()*256));});assert.deepEqual(stripDecode(stripEncode(tiles),tiles.length),tiles);} });
