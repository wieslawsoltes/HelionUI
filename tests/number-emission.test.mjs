import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {scalarFunctions,translateScalarBody} from '../tools/editor-kernel-host.mjs';

// Execute the actual WGSL formatting body with instrumented font operations.
// Native gates separately validate f32 execution and raster output.
const source=await readFile(new URL('../shaders/emit.wgsl',import.meta.url),'utf8');
const body=translateScalarBody(scalarFunctions(source).find(f=>f.name==='number').code).replace(/\bv\s*\/=\s*10/g,'v=u32(v/10)');
function emit(value,decimal){
  const calls=[];let baselines=0,lookups=0;
  const api={min:Math.min,abs:Math.abs,round:Math.round,select:(a,b,c)=>c?b:a,u32:x=>Math.trunc(x)>>>0,
    textBaseline:()=>{baselines++;return 7.25;},mapGlyph:(_i,code)=>{lookups++;return{code,width:.25+(code%3)*.125};},
    glyphWidth:g=>g.width,vec2f:(x,y)=>({x,y}),emitGlyph:(_i,g,p,size,color,clip,order)=>calls.push({code:g.code,...p,size,color,clip,order})};
  const fn=new Function(...Object.keys(api),`${body};return number;`)(...Object.values(api));
  const color={},clip={},order={},end=fn(1,value,decimal,{x:3.125,y:9.5},12,color,clip,order);
  return{calls,baselines,lookups,end,color,clip,order};
}
function expected(value,decimal){
  const scaled=Math.round(Math.min(Math.abs(value),99999999)*(decimal===1?10:1));
  const digits=String(scaled).padStart(Math.min(14,decimal+1),'0');
  return(value<0?'-':'')+(decimal===1?digits.slice(0,-1)+'.'+digits.slice(-1):digits);
}
test('number glyphs preserve signs, decimal padding, saturation, painter order and fractional advances',()=>{
  const values=[0,-0,.001,-.001,.05,-.05,.999,9.999,99999999,-99999999,1e20,-1e20];
  let seed=47;for(let j=0;j<100;j++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;values.push(Math.fround((seed/2**32-.5)*1e6));}
  for(const value of values)for(const decimal of [0,1,2,13,14]){
    const out=emit(value,decimal);
    assert.equal(String.fromCodePoint(...out.calls.map(g=>g.code)),expected(value,decimal),`${value}/${decimal}`);
    let x=3.125;
    for(const g of out.calls){assert.equal(g.x,x);assert.equal(g.y,16.75);assert.equal(g.size,12);assert.equal(g.color,out.color);assert.equal(g.clip,out.clip);assert.equal(g.order,out.order);x+=(.25+(g.code%3)*.125)*12;}
    assert.equal(out.end,x);assert.equal(out.baselines,1);assert.equal(out.lookups,out.calls.length);assert.ok(out.calls.length<=16);
  }
});
