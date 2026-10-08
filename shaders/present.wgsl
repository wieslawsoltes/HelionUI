// Compute-only diagnostic overlay. The final render pass is a texel-exact copy.
// hud-common.wgsl precedes this source. No 5x7 alphabet and no CPU text rasterizer.
@group(0) @binding(0) var image:texture_2d<f32>;
@group(0) @binding(1) var<storage,read> history:array<u32>;
@group(0) @binding(2) var<uniform> hudFrame:HudFrame;
@group(0) @binding(3) var<storage,read> surfaceState:array<u32>;
@group(0) @binding(4) var<storage,read> hudFont:array<u32>;
@group(0) @binding(5) var<storage,read> hudData:array<u32>;
@group(0) @binding(6) var<storage,read> hudHeap:array<u32>;
@group(0) @binding(7) var hudOutput:texture_storage_2d<rgba8unorm,write>;

fn hudMaskAt(index:u32,p:vec2<i32>)->f32 {
 let recordAt=hudFontRecord(index);
 if(any(p<vec2<i32>(0)) || p.x>=i32(hudFont[recordAt+5u]) || p.y>=i32(hudFont[recordAt+6u])) { return 0.0; }
 let packed=hudFont[HUD_FONT_PIXELS+index*1024u+u32(p.y)*16u+u32(p.x)/4u];
 return f32((packed>>((u32(p.x)%4u)*8u))&255u)/255.0;
}
fn hudGlyphAlpha(index:u32,point:vec2<f32>)->f32 {
 let recordAt=hudFontRecord(index);
 if(hudFont[recordAt+7u]==0u) {
  // Unusual large glyphs retain their geometry. No silent 64px clipping or font substitution.
  return hudOutlineCoverage(hudFont[recordAt],hudFontFloat(recordAt+1u),point-vec2<f32>(0.5)+vec2<f32>(hudFontFloat(recordAt+3u),hudFontFloat(recordAt+4u)));
 }
 // Diagnostic display mode stores integer device origins: one texel, no second filter.
 if((hudFrame.flags.y&16384u)==0u) { return hudMaskAt(index,vec2<i32>(floor(point))); }
 // Explicit reference mode retains the historical bilinear reconstruction.
 let uv=point-vec2<f32>(0.5); let p=vec2<i32>(floor(uv)); let t=fract(uv);
 return mix(mix(hudMaskAt(index,p),hudMaskAt(index,p+vec2<i32>(1,0)),t.x),
            mix(hudMaskAt(index,p+vec2<i32>(0,1)),hudMaskAt(index,p+vec2<i32>(1,1)),t.x),t.y);
}
fn hudTextColor(q:vec2<f32>,base:vec3<f32>)->vec3<f32> {
 let bin=vec2<u32>(clamp(floor(q/16.0),vec2<f32>(0.0),vec2<f32>(26.0,21.0)));
 let at=bin.y*HUD_BIN_COLS+bin.x; let exhaustive=(hudData[1]&2u)!=0u;
 var count=min(hudData[HUD_BIN_COUNTS+at],HUD_BIN_CAPACITY);
 if(exhaustive) { count=min(hudData[0],HUD_MAX_ITEMS); }
 var color=base;
 for(var k=0u;k<count;k++) {
  var index=hudData[HUD_BIN_LIST+at*HUD_BIN_CAPACITY+k]; if(exhaustive) { index=k; }
  let item=HUD_ITEMS+index*8u; let origin=vec2<f32>(hudItemFloat(item),hudItemFloat(item+1u));
  let size=vec2<f32>(hudItemFloat(item+2u),hudItemFloat(item+3u));
  let local=q-origin; if(any(local<vec2<f32>(0.0)) || any(local>=size)) { continue; }
  let alpha=hudGlyphAlpha(hudData[item+4u],local*hudRatio());
  color=mix(color,hudPalette(hudData[item+5u]),alpha);
 }
 return color;
}
fn graphSample(series:u32,position:u32)->f32 {
 let size=min(history[1],120u); let oldest=(history[0]+120u-size)%120u;
 return bitcast<f32>(history[32u+((oldest+position)%120u)*4u+series]);
}
fn hudRoundDistance(p:vec2<f32>,rect:vec4<f32>,radius:f32)->f32 {
 let halfSize=rect.zw*0.5; let q=abs(p-rect.xy-halfSize)-halfSize+vec2<f32>(radius);
 return length(max(q,vec2<f32>(0.0)))+min(max(q.x,q.y),0.0)-radius;
}
fn hudCover(distance:f32)->f32 { return clamp(0.5-distance*hudRatio(),0.0,1.0); }
fn hudGraph(p:vec2<f32>,series:u32,base:vec3<f32>)->vec3<f32> {
 // Three 104 x 40 CSS-pixel plots. Every sample remains a vertex: no temporal smoothing.
 let width=104.0; let height=40.0; let range=50.0; let aa=1.0/hudRatio();
 let size=min(history[1],120u); let budget=bitcast<f32>(history[11]); let accent=hudPalette(series+2u);
 var color=base; let grid=hudLinear(vec3<f32>(0.20,0.26,0.31));
 let gridDistance=min(min(abs(p.y),abs(p.y-height*0.5)),abs(p.y-height));
 color=mix(color,grid,0.55*hudCover(gridDistance-0.35));
 let vertical=abs((p.x+width/8.0)%(width/4.0)-width/8.0);
 color=mix(color,grid,0.25*hudCover(vertical-0.3));
 // Reserve the left of the graph for genuinely unrecorded history, not artificial zeros.
 let first=120u-size; let logical=clamp(p.x/width*119.0,0.0,119.0);
 if(size>0u && logical>=f32(first)) {
  let pos=min(u32(floor(logical))-first,size-1u); let next=min(pos+1u,size-1u);
  let a=graphSample(series,pos); let b=graphSample(series,next);
  let y=height*(1.0-clamp(mix(a,b,fract(logical))/range,0.0,1.0));
  let fill=clamp((p.y-y)*hudRatio()+0.5,0.0,1.0);
  if(a>=0.0 && b>=0.0 && (series!=0u || (a>0.0 && b>0.0))) { color=mix(color,accent,fill*mix(0.19,0.035,clamp(p.y/height,0.0,1.0))); }
 }
 if(budget>0.0 && budget<=range) {
  let y=height*(1.0-budget/range); let dash=select(0.0,1.0,p.x%7.0<4.0);
  color=mix(color,hudLinear(vec3<f32>(0.52,0.59,0.65)),dash*0.7*hudCover(abs(p.y-y)-0.45));
 }
 if(size>1u) {
  // Inspect all segments touched by this physical pixel (plus a rounded-join margin).
  // At small viewport scales this preserves spikes instead of averaging them away.
  let span=(aa+1.5)*119.0/width;
  let begin=u32(max(f32(first),floor(logical-span)-1.0)); let end=u32(min(118.0,ceil(logical+span)));
  var distance=1e10; var over=1e10; var clipped=1e10;
  for(var j=begin;j<=end;j++) {
   let a=graphSample(series,j-first); let b=graphSample(series,j+1u-first);
   if(a<0.0 || b<0.0 || (series==0u && (a<=0.0 || b<=0.0))) { continue; } // Initial/invalid frame intervals are gaps, not zero-cost frames.
   let v0=vec2<f32>(f32(j)/119.0*width,height*(1.0-clamp(a/range,0.0,1.0)));
   let v1=vec2<f32>(f32(j+1u)/119.0*width,height*(1.0-clamp(b/range,0.0,1.0)));
   let d=hudSegmentDistance(p,v0,v1); distance=min(distance,d);
   if(budget>0.0 && mix(a,b,clamp((p.x-v0.x)/max(v1.x-v0.x,0.0001),0.0,1.0))>budget) { over=min(over,d); }
   if(a>range) { clipped=min(clipped,length(p-vec2<f32>(v0.x,1.0))); }
   if(b>range) { clipped=min(clipped,length(p-vec2<f32>(v1.x,1.0))); }
  }
  color=mix(color,accent,hudCover(distance-0.70));
  color=mix(color,hudPalette(5u),hudCover(over-0.70));
  color=mix(color,hudPalette(5u),hudCover(clipped-1.8));
 }
 if(size>0u) {
  let value=graphSample(series,size-1u); let latest=vec2<f32>(width,height*(1.0-clamp(value/range,0.0,1.0)));
  if(value>=0.0 && (series!=0u || value>0.0)) { color=mix(color,select(accent,hudPalette(5u),budget>0.0 && value>budget),hudCover(length(p-latest)-1.8)); }
 }
 return color;
}
fn hudPixel(position:vec4<f32>)->vec4<f32> {
 let pixel=vec2<i32>(position.xy); let base=textureLoad(image,pixel,0).rgb;
 // Keep the engine overflow sentinel independent of cached tiles and HUD visibility.
 if(surfaceState[15]!=0u && pixel.y<4) { return vec4<f32>(0.9,0.07,0.10,1.0); }
 if((hudFrame.flags.y&1u)==0u) { return vec4<f32>(base,1.0); }
 let q=(position.xy/hudFrame.viewport.z-hudOrigin())/hudScale();
 let distance=hudRoundDistance(q,vec4<f32>(0.0,0.0,HUD_WIDTH,HUD_HEIGHT),12.0);
 if(distance>10.0) { return vec4<f32>(base,1.0); }
 var beneath=hudLinear(base);
 let shadow=0.25*(1.0-smoothstep(0.0,10.0,max(0.0,distance)));
 beneath*=1.0-shadow;
 var color=mix(hudLinear(vec3<f32>(0.070,0.104,0.139)),hudLinear(vec3<f32>(0.052,0.078,0.108)),clamp(q.y/HUD_HEIGHT,0.0,1.0));
 color=mix(color,hudLinear(vec3<f32>(0.22,0.31,0.38)),hudCover(abs(distance+0.55)-0.40));
 color=mix(color,hudLinear(vec3<f32>(0.18,0.24,0.29)),0.65*hudCover(abs(q.y-35.0)-0.35));
 if(q.y>104.0 && q.y<221.0) {
  for(var series=0u;series<3u;series++) {
   let x=16.0+f32(series)*132.0; let card=hudRoundDistance(q,vec4<f32>(x,106.0,124.0,114.0),7.0);
   if(card<1.0) { color=mix(color,hudLinear(vec3<f32>(0.038,0.063,0.088)),hudCover(card)); }
   let p=q-vec2<f32>(x+10.0,171.0);
   if(all(p>=vec2<f32>(-2.0)) && all(p<=vec2<f32>(106.0,42.0))) { color=hudGraph(p,series,color); }
  }
 }
 if(all(q>=vec2<f32>(0.0)) && all(q<vec2<f32>(HUD_WIDTH,HUD_HEIGHT))) { color=hudTextColor(q,color); }
 // A diagnostic allocation overflow is conspicuous, never silently called valid output.
 if((hudData[1]&1u)!=0u && q.y<3.0) { color=hudPalette(5u); }
 return vec4<f32>(hudSrgb(mix(beneath,color,hudCover(distance))),1.0);
}

// All glyph coverage (including oversize fallback), text composition and graphs
// execute here, not in a fragment shader. The cached UI image stays unmodified.
@compute @workgroup_size(8,8)
fn compositeHud(@builtin(global_invocation_id) id:vec3<u32>) {
 let rect=hudPanelRect();
 if(any(id.xy>=rect.zw) || any(id.xy>=textureDimensions(hudOutput))) { return; }
 let position=vec4<f32>(vec2<f32>(id.xy+rect.xy)+vec2<f32>(.5),0.0,1.0);
 textureStore(hudOutput,vec2<i32>(id.xy),hudPixel(position));
}
