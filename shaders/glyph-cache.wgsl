// Exact (not SDF / not size-bucketed) grayscale glyph coverage cache.
// Key: retained outline, four transform bits, two subpixel-origin bits. Integer
// translations and colors/clips do not affect the key. No frame readback or uploads.
// Request discovery and disjoint shard owners plan in parallel. Separate dispatches
// publish complete keys before consumers execute, without spinlocks or readback.
fn glyphMatrix(p:Primitive)->vec4<f32> { return vec4<f32>(p.matrix.xy*p.rect.z,p.matrix.zw*p.rect.w); }
fn glyphOrigin(p:Primitive)->vec2<f32> { return transform(p.matrix,p.translation.xy,p.rect.xy); }
fn flattenedGlyphCoverage(p:Primitive,pixel:vec2<f32>)->f32 {
 let info=p.info.y; let base=heap[info+2u]; let count=heap[info+4u]; let matrix=glyphMatrix(p);
 let origin=glyphOrigin(p); let subpixel=origin-floor(origin); let relative=pixel-floor(origin); var area=0.0;
 for(var j=0u;j<count;j++) {
  let at=base+j*4u;
  let a=transform(matrix,subpixel,vec2<f32>(hf(at),hf(at+1u)));
  let b=transform(matrix,subpixel,vec2<f32>(hf(at+2u),hf(at+3u)));
  area+=edgeArea(vec4<f32>(a,b),relative);
 }
 return clamp(abs(area),0.0,1.0);
}
// Rasterize the resident source curves at the exact device transform and phase.
// Both cache misses and analytic bypass call this function, including enlarged text.
fn glyphRegionCoverage(p:Primitive,pixel:vec2<f32>,extent:vec2<f32>)->f32 {
 let info=p.info.y; let base=heap[info]; let count=heap[info+1u];
 let matrix=glyphMatrix(p); let origin=glyphOrigin(p);
 let offset=(origin-floor(origin))-(pixel-floor(origin)); var area=0.0;
 for(var j=0u;j<count;j++) {
  let at=base+j*12u; let kind=heap[at];
  let a=transform(matrix,offset,vec2<f32>(hf(at+1u),hf(at+2u)))/extent;
  let b=transform(matrix,offset,vec2<f32>(hf(at+3u),hf(at+4u)))/extent;
  if(kind==0u) { area+=curveLineArea(a,b); }
  else {
   let c=transform(matrix,offset,vec2<f32>(hf(at+5u),hf(at+6u)))/extent;
   if(kind==1u) { area+=curveQuadraticArea(a,b,c); }
   else { let d=transform(matrix,offset,vec2<f32>(hf(at+7u),hf(at+8u)))/extent; area+=curveCubicArea(a,b,c,d); }
  }
 }
 return clamp(abs(area),0.0,1.0)*extent.x*extent.y;
}
fn glyphCoverage(p:Primitive,pixel:vec2<f32>)->f32 {
 if((frame.flags.y&16384u)!=0u) { return flattenedGlyphCoverage(p,pixel); }
 return glyphRegionCoverage(p,pixel,vec2<f32>(1.0));
}

fn cachedGlyphCoverage(p:Primitive,pixel:vec2<f32>)->f32 {
 let slot=u32(p.params.w)-1u; let entryAt=GLYPH_META+slot*16u;
 let x=i32(pixel.x)-i32(p.params.x); let y=i32(pixel.y)-i32(p.params.y);
 if(x<0 || y<0 || u32(x)>=glyphCache[entryAt+12u] || u32(y)>=glyphCache[entryAt+13u]) { return 0.0; }
 let packed=glyphCache[GLYPH_PIXELS+slot*1024u+u32(y)*16u+u32(x)/4u]; return f32((packed>>((u32(x)%4u)*8u))&255u)/255.0;
}
fn glyphHasDamage(bounds:vec4<f32>)->bool {
 let lo=vec2<u32>(max(vec2<f32>(0.0),floor(bounds.xy/16.0)));
 let hi=min(frame.screen.zw,vec2<u32>(max(vec2<f32>(0.0),ceil(bounds.zw/16.0))));
 for(var y=lo.y;y<hi.y;y++) { for(var x=lo.x;x<hi.x;x++) { if(atomicLoad(&scratch[DAMAGE+y*frame.screen.z+x])!=0u) { return true; } } } return false;
}
// Discovery is parallel; a dispatch boundary completes every linked request
// before an owner follows the lists. No inter-workgroup spinlock or polling.
@compute @workgroup_size(64)
fn collectGlyphRequests(@builtin(global_invocation_id) id:vec3<u32>) {
 let index=id.x; if(index>=min(MAX_PRIMITIVES,atomicLoad(&draws.count))) { return; }
 let p=draws.items[index]; if(p.info.x!=4u || !glyphHasDamage(p.bounds)) { return; }
 let matrix=glyphMatrix(p); let origin=glyphOrigin(p); let fraction=origin-floor(origin);
 let info=p.info.y; let bounds=transformedBounds(matrix,fraction,vec4<f32>(hf(info+6u),hf(info+7u),hf(info+8u),hf(info+9u)));
 let first=floor(bounds.xy)-vec2<f32>(1.0); let extent=ceil(bounds.zw)+vec2<f32>(1.0)-first;
 if(any(extent>vec2<f32>(64.0)) || any(extent<=vec2<f32>(0.0))) { atomicAdd(&scratch[GLYPH_STATS+2u],1u); return; }
 var key:array<u32,7>; key[0]=info;
 for(var k=0u;k<4u;k++) { key[k+1u]=bitcast<u32>(matrix[k]); }
 key[5]=bitcast<u32>(fraction.x); key[6]=bitcast<u32>(fraction.y);
 var hash=2166136261u; for(var k=0u;k<7u;k++) { hash=(hash^key[k])*16777619u; }
 hash=(hash^(hash>>16u))*0x85ebca6bu; hash^=hash>>13u;
 let request=GLYPH_REQUESTS+index*12u;
 for(var k=0u;k<7u;k++) { atomicStore(&scratch[request+1u+k],key[k]); }
 atomicStore(&scratch[request+8u],bitcast<u32>(first.x)); atomicStore(&scratch[request+9u],bitcast<u32>(first.y));
 atomicStore(&scratch[request+10u],u32(extent.x)); atomicStore(&scratch[request+11u],u32(extent.y));
 let previous=atomicExchange(&scratch[GLYPH_BUCKETS+(hash&(GLYPH_SHARDS-1u))],index);
 atomicStore(&scratch[request],previous);
}
// Each invocation exclusively owns a shard's metadata/slots. Equal exact keys
// always route to that same owner; geometry, transforms and subpixels are unchanged.
// Default: 64 independent owners of 32 slots instead of one loop over all glyphs.
@compute @workgroup_size(64)
fn prepareGlyphCache(@builtin(global_invocation_id) id:vec3<u32>) {
 let shard=id.x; if(shard>=GLYPH_SHARDS) { return; }
 let slots=GLYPH_SLOTS/GLYPH_SHARDS; let base=shard*slots;
 var index=atomicLoad(&scratch[GLYPH_BUCKETS+shard]);
 for(var visited=0u;visited<MAX_PRIMITIVES && index!=NONE;visited++) {
  let request=GLYPH_REQUESTS+index*12u; var key:array<u32,7>;
  for(var k=0u;k<7u;k++) { key[k]=atomicLoad(&scratch[request+1u+k]); }
  var slot=NONE; var replacement=NONE; var oldest=0xffffffffu;
  for(var probe=0u;probe<slots;probe++) {
   let candidate=base+probe; let entryAt=GLYPH_META+candidate*16u;
   if(glyphCache[entryAt]==0u) { replacement=candidate; break; }
   var matches=glyphCache[entryAt+14u]==(frame.flags.y&16384u); for(var k=0u;k<7u;k++) { if(glyphCache[entryAt+1u+k]!=key[k]) { matches=false; break; } }
   if(matches) { slot=candidate; break; }
   let last=glyphCache[entryAt+8u]; if(last!=frame.counts.z && (replacement==NONE || last<oldest)) { replacement=candidate; oldest=last; }
  }
  if(slot==NONE) {
   slot=replacement;
   if(slot==NONE) { atomicAdd(&scratch[GLYPH_STATS+2u],1u); index=atomicLoad(&scratch[request]); continue; }
   let entryAt=GLYPH_META+slot*16u; glyphCache[entryAt]=1u; glyphCache[entryAt+14u]=frame.flags.y&16384u;
   for(var k=0u;k<7u;k++) { glyphCache[entryAt+1u+k]=key[k]; }
   let first=vec2<f32>(bitcast<f32>(atomicLoad(&scratch[request+8u])),bitcast<f32>(atomicLoad(&scratch[request+9u])));
   glyphCache[entryAt+10u]=bitcast<u32>(i32(first.x)); glyphCache[entryAt+11u]=bitcast<u32>(i32(first.y));
   glyphCache[entryAt+12u]=atomicLoad(&scratch[request+10u]); glyphCache[entryAt+13u]=atomicLoad(&scratch[request+11u]);
   let job=atomicAdd(&scratch[GLYPH_STATS+1u],1u);
   // At most GLYPH_SLOTS distinct misses: a slot cannot be evicted again this frame.
   glyphCache[GLYPH_JOBS+job*2u]=slot; glyphCache[GLYPH_JOBS+job*2u+1u]=index;
  } else { atomicAdd(&scratch[GLYPH_STATS],1u); }
  let entryAt=GLYPH_META+slot*16u; glyphCache[entryAt+8u]=frame.counts.z;
  let first=vec2<f32>(f32(bitcast<i32>(glyphCache[entryAt+10u])),f32(bitcast<i32>(glyphCache[entryAt+11u])));
  draws.items[index].params=vec4<f32>(floor(glyphOrigin(draws.items[index]))+first,0.0,f32(slot+1u));
  index=atomicLoad(&scratch[request]);
 }
}
@compute @workgroup_size(1)
fn finishGlyphRequests() {
 state[51]=atomicLoad(&scratch[GLYPH_STATS]); state[52]=atomicLoad(&scratch[GLYPH_STATS+1u]); state[53]=atomicLoad(&scratch[GLYPH_STATS+2u]);
 glyphCache[0]=state[52]; indirect[21]=state[52]; indirect[22]=1u; indirect[23]=1u;
}
@compute @workgroup_size(64)
fn rasterGlyphCache(@builtin(workgroup_id) group:vec3<u32>,@builtin(local_invocation_index) lane:u32) {
 let job=group.x; if(job>=glyphCache[0]) { return; }
 let slot=glyphCache[GLYPH_JOBS+job*2u]; let p=draws.items[glyphCache[GLYPH_JOBS+job*2u+1u]];
 let entryAt=GLYPH_META+slot*16u; let width=glyphCache[entryAt+12u]; let height=glyphCache[entryAt+13u]; let words=(width+3u)/4u;
 for(var cell=lane;cell<words*height;cell+=64u) {
  let y=cell/words; let x=(cell%words)*4u; var packed=0u;
  for(var k=0u;k<4u;k++) { if(x+k<width) {
   let pixel=p.params.xy+vec2<f32>(f32(x+k),f32(y));
   packed|=u32(round(glyphCoverage(p,pixel)*255.0))<<(k*8u);
  } }
  glyphCache[GLYPH_PIXELS+slot*1024u+y*16u+x/4u]=packed;
 }
}
