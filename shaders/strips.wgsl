// Exact retained display-list damage tracking. All previous/current geometry and
// all tile invalidation remain on the GPU. Dirty tiles re-render every contributor,
// so translucent overlap, moved/removed text and old animation bounds are restored.
fn damageBounds(bounds:vec4<f32>) {
 let lo=vec2<u32>(max(vec2<f32>(0.0),floor(bounds.xy/16.0)));
 let hi=min(frame.screen.zw,vec2<u32>(max(vec2<f32>(0.0),ceil(bounds.zw/16.0))));
 if(any(lo>=hi)) { return; }
 atomicMin(&scratch[50u],lo.x);atomicMin(&scratch[51u],lo.y);
 atomicMax(&scratch[52u],hi.x);atomicMax(&scratch[53u],hi.y);
 for(var y=lo.y;y<hi.y;y++) { for(var x=lo.x;x<hi.x;x++) { atomicStore(&scratch[DAMAGE+y*frame.screen.z+x],1u); } }
}
fn samePrimitive(a:Primitive,b:Primitive)->bool {
 return all(a.bounds==b.bounds) && all(a.clip==b.clip) && all(a.color==b.color)
  && a.info.x==b.info.x && a.info.y==b.info.y && a.info.w==b.info.w
  && all(a.rect==b.rect) && (a.info.x==4u || all(a.params==b.params))
  && all(a.matrix==b.matrix) && all(a.translation==b.translation);
}
@compute @workgroup_size(64)
fn damage(@builtin(global_invocation_id) id:vec3<u32>) {
 let i=id.x; if(i>=DRAW_HEADS || (frame.flags.x&1u)!=0u || (frame.flags.y&16u)!=0u) { return; }
 if(atomicLoad(&draws.overflow)!=0u || previousDraws.overflow!=0u || previousDraws.pad.x!=state[6]) {
  if(i==0u) { damageBounds(vec4<f32>(0.0,0.0,vec2<f32>(frame.screen.xy))); } return;
 }
 var a=draws.heads[i]; var b=previousDraws.heads[i];
 for(var step=0u;step<MAX_PRIMITIVES && (a!=NONE || b!=NONE);step++) {
  if(a!=NONE && b!=NONE) {
   let current=draws.items[a]; let previous=previousDraws.items[b];
   if(!samePrimitive(current,previous)) { damageBounds(current.bounds); damageBounds(previous.bounds); }
   a=current.info.z; b=previous.info.z;
  } else if(a!=NONE) { let current=draws.items[a]; damageBounds(current.bounds); a=current.info.z; }
  else { let previous=previousDraws.items[b]; damageBounds(previous.bounds); b=previous.info.z; }
 }
}
fn dirtyAt(x:u32,y:u32)->bool {
 return atomicLoad(&scratch[DAMAGE+(y/16u)*frame.screen.z+x/16u])!=0u;
}
fn dirtyRow(bounds:vec4<f32>,y:u32)->bool {
 let first=max(atomicLoad(&scratch[50u]),u32(max(0.0,floor(bounds.x/16.0))));
 let last=min(atomicLoad(&scratch[52u]),u32(max(0.0,ceil(bounds.z/16.0))));
 for(var x=first;x<last;x++) { if(atomicLoad(&scratch[DAMAGE+(y/16u)*frame.screen.z+x])!=0u) { return true; } }
 return false;
}
// Independent all-compute Sparse Strips experiment. Boundary tiles retain 4x4 alpha;
// contiguous solid tiles become one horizontal run. No full-image mask per path.
fn lineDistance(p:vec2<f32>,a:vec2<f32>,b:vec2<f32>)->f32 {
 let ab=b-a; let t=clamp(dot(p-a,ab)/max(0.0000001,dot(ab,ab)),0.0,1.0); return length(p-(a+t*ab));
}
fn roundedDistance(p:vec2<f32>,rect:vec4<f32>,radius:f32)->f32 {
 let halfSize=rect.zw*0.5; let r=clamp(radius,0.0,min(halfSize.x,halfSize.y));
 let q=abs(p-(rect.xy+halfSize))-halfSize+vec2<f32>(r);
 return length(max(q,vec2<f32>(0.0)))+min(max(q.x,q.y),0.0)-r;
}
fn shapeDistance(p:Primitive,point:vec2<f32>)->f32 {
 let local=inverse(p.matrix,p.translation.xy,point);
 let scale=min(length(p.matrix.xy),length(p.matrix.zw));
 if(p.info.x==3u) { return (lineDistance(local,p.rect.xy,p.rect.zw)-p.params.y*0.5)*scale; }
 var distance=roundedDistance(local,p.rect,p.params.x);
 if(p.info.x==1u) { distance=length(local-(p.rect.xy+p.rect.zw*0.5))-p.rect.z*0.5; }
 if(p.params.y>0.0) { distance=abs(distance)-p.params.y*0.5; }
 return distance*scale;
}
fn pathPoint(p:Primitive,point:vec2<f32>)->vec2<f32> { return transform(p.matrix,p.translation.xy,p.rect.xy+point*p.rect.zw); }
fn pathLine(p:Primitive,at:u32)->vec4<f32> {
 return vec4<f32>(pathPoint(p,vec2<f32>(hf(at),hf(at+1u))),pathPoint(p,vec2<f32>(hf(at+2u),hf(at+3u))));
}
// Exact integral of clamp(1-x,0,1), used for line/pixel analytical signed-area coverage.
fn areaPrimitive(x:f32)->f32 {
 if(x<=0.0) { return x; } if(x>=1.0) { return 0.5; } return x-x*x*0.5;
}
fn edgeArea(edge:vec4<f32>,pixel:vec2<f32>)->f32 {
 let a=edge.xy-pixel; let b=edge.zw-pixel; let dy=b.y-a.y;
 if(abs(dy)<0.0000001) { return 0.0; }
 let lo=max(0.0,min(a.y,b.y)); let hi=min(1.0,max(a.y,b.y)); if(hi<=lo) { return 0.0; }
 let x0=a.x+(lo-a.y)*(b.x-a.x)/dy; let x1=a.x+(hi-a.y)*(b.x-a.x)/dy;
 var average=clamp(1.0-x0,0.0,1.0);
 if(abs(x1-x0)>0.000001) { average=(areaPrimitive(x1)-areaPrimitive(x0))/(x1-x0); }
 return (hi-lo)*average*select(-1.0,1.0,dy>0.0);
}
fn pathSample(p:Primitive,point:vec2<f32>,tile:vec4<f32>)->vec3<f32> {
 let info=p.info.y; let base=heap[info+2u]; let count=heap[info+4u]; var winding=0i; var distance=INF; var boundary=false;
 for(var j=0u;j<count;j++) {
  let edge=pathLine(p,base+j*4u); let a=edge.xy; let b=edge.zw;
  distance=min(distance,lineDistance(point,a,b));
  if(all(max(a,b)>=tile.xy) && all(min(a,b)<=tile.zw)) { boundary=true; }
  if((a.y<=point.y && b.y>point.y) || (b.y<=point.y && a.y>point.y)) {
   let x=a.x+(point.y-a.y)*(b.x-a.x)/(b.y-a.y);
   if(x>point.x) { winding+=select(-1,1,b.y>a.y); }
  }
 }
 return vec3<f32>(f32(winding),distance,select(0.0,1.0,boundary));
}
fn strokePixels(p:Primitive)->f32 { return hf(p.info.y+5u)*min(length(p.matrix.xy)*p.rect.z,length(p.matrix.zw)*p.rect.w); }
// 0 empty, 1 full, 2 boundary. Conservative boundary classification is intentional.
fn classify(p:Primitive,tile:vec4<f32>)->u32 {
 if(any(tile.zw<=p.clip.xy) || any(tile.xy>=p.clip.zw) || any(tile.zw<=p.bounds.xy) || any(tile.xy>=p.bounds.zw)) { return 0u; }
 if(p.info.x==4u || p.translation.z>0.0) { return 2u; }
 let center=(tile.xy+tile.zw)*0.5; let safelyClipped=all(tile.xy>=p.clip.xy) && all(tile.zw<=p.clip.zw);
 if(p.info.x!=2u) {
  let d=shapeDistance(p,center);
  if(d>3.4) { return 0u; } if(d < -3.4 && safelyClipped) { return 1u; } return 2u;
 }
 let sample=pathSample(p,center,tile+vec4<f32>(-0.75,-0.75,0.75,0.75)); let stroke=strokePixels(p);
 if(stroke>0.0) { let d=sample.y-stroke*0.5; if(d>3.4) { return 0u; } if(d < -3.4 && safelyClipped) { return 1u; } return 2u; }
 if(sample.z>0.5 || !safelyClipped) { return 2u; }
 let inside=select(sample.x!=0.0,abs(i32(sample.x))%2==1,heap[p.info.y+10u]!=0u);
 return select(0u,1u,inside);
}
fn unclippedCoverage(p:Primitive,pixel:vec2<f32>)->f32 {
 let point=pixel+vec2<f32>(0.5);
 if(p.info.x==4u && (frame.flags.y&16384u)==0u) {
  let first=max(pixel,p.clip.xy); let last=min(pixel+vec2<f32>(1.0),p.clip.zw);
  if(any(last<=first)) { return 0.0; }
  // Integrate the actual clipped part of a glyph at a fractional viewport edge.
  // Interior pixels keep the exact-phase coverage-cache path, without filtering.
  if(any(first!=pixel) || any(last!=pixel+vec2<f32>(1.0))) { return glyphRegionCoverage(p,first,last-first); }
  if(p.params.w>0.0) { return cachedGlyphCoverage(p,pixel); } return glyphCoverage(p,pixel);
 }
 if(!contains(p.clip,point)) { return 0.0; }
 if(p.info.x==4u) { if(p.params.w>0.0) { return cachedGlyphCoverage(p,pixel); } return glyphCoverage(p,pixel); }
 if(p.info.x!=2u) { return clamp(0.5-shapeDistance(p,point),0.0,1.0); }
 let info=p.info.y; let base=heap[info+2u]; let count=heap[info+4u]; let stroke=strokePixels(p); var area=0.0; var distance=INF;
 for(var j=0u;j<count;j++) {
  let edge=pathLine(p,base+j*4u);
  if(stroke>0.0) { distance=min(distance,lineDistance(point,edge.xy,edge.zw)); }
  else { area+=edgeArea(edge,pixel); }
 }
 if(stroke>0.0) { return clamp(stroke*0.5+0.5-distance,0.0,1.0); }
 if(heap[info+10u]!=0u) { return clamp(1.0-abs(1.0-(abs(area)%2.0)),0.0,1.0); }
 return clamp(abs(area),0.0,1.0);
}
@compute @workgroup_size(1)
fn prepareDraws() {
 // Damage reduction and dispatch stay resident. A clean frame must not scan
 // every primitive's screen-sized bounds just to discover there are no jobs.
 let dirty=atomicLoad(&scratch[50u])<atomicLoad(&scratch[52u]) && atomicLoad(&scratch[51u])<atomicLoad(&scratch[53u]);
 indirect[6]=select(0u,(min(MAX_PRIMITIVES,atomicLoad(&draws.count))+63u)/64u,dirty); indirect[7]=1u; indirect[8]=1u;
}
@compute @workgroup_size(64)
fn buildJobs(@builtin(global_invocation_id) id:vec3<u32>) {
 let i=id.x; if(i>=min(MAX_PRIMITIVES,atomicLoad(&draws.count))) { return; } let p=draws.items[i];
 if(any(p.bounds.zw<=p.bounds.xy)) { return; }
 let start=max(atomicLoad(&scratch[51u])*16u,u32(max(0.0,floor(p.bounds.y/4.0)))*4u);
 let end=min(atomicLoad(&scratch[53u])*16u,u32(min(f32(frame.screen.y),ceil(p.bounds.w/4.0)*4.0)));
 for(var y=start;y<end;y+=4u) {
  if(!dirtyRow(p.bounds,y)) { continue; }
  let job=atomicAdd(&scratch[0u],1u); if(job<MAX_JOBS) { atomicStore(&scratch[JOBS+job*2u],i); atomicStore(&scratch[JOBS+job*2u+1u],y); } else { overflow(2u); }
 }
}
@compute @workgroup_size(1)
fn prepareJobs() {
 indirect[9]=(min(MAX_JOBS,atomicLoad(&scratch[0u]))+31u)/32u; indirect[10]=1u; indirect[11]=1u;
}
fn appendStrip(primitive:u32,x0:u32,x1:u32,y:u32,alpha:u32) {
 if(x1<=x0) { return; } let index=atomicAdd(&scratch[1u],1u);
 if(index>=MAX_STRIPS) { overflow(4u); return; } let at=STRIPS+index*8u;
 atomicStore(&scratch[at],primitive); atomicStore(&scratch[at+1u],x0); atomicStore(&scratch[at+2u],y); atomicStore(&scratch[at+3u],x1);
 atomicStore(&scratch[at+4u],alpha); atomicStore(&scratch[at+5u],draws.items[primitive].info.w);
}
@compute @workgroup_size(32)
fn makeStrips(@builtin(global_invocation_id) id:vec3<u32>) {
 let job=id.x; if(job>=min(MAX_JOBS,atomicLoad(&scratch[0u]))) { return; }
 let primitive=atomicLoad(&scratch[JOBS+job*2u]); let y=atomicLoad(&scratch[JOBS+job*2u+1u]); let p=draws.items[primitive];
 let start=u32(max(0.0,floor(p.bounds.x/4.0)))*4u; let end=u32(min(f32(frame.screen.x),ceil(p.bounds.z/4.0)*4.0));
 var run=NONE;
 for(var x=start;x<end;x+=4u) {
  if(!dirtyAt(x,y)) { if(run!=NONE) { appendStrip(primitive,run,x,y,NONE); run=NONE; } continue; }
  let tile=vec4<f32>(f32(x),f32(y),f32(x+4u),f32(y+4u)); let kind=classify(p,tile);
  if(kind==1u) { if(run==NONE) { run=x; } continue; }
  if(run!=NONE) { appendStrip(primitive,run,x,y,NONE); run=NONE; }
  if(kind==0u) { continue; }
  var mask:array<u32,4>; var anyAlpha=0u; var allAlpha=0xffffffffu;
  for(var row=0u;row<4u;row++) {
   var packed=0u;
   for(var col=0u;col<4u;col++) { let a=u32(round(coverage(p,vec2<f32>(f32(x+col),f32(y+row)))*255.0)); packed|=a<<(col*8u); }
   mask[row]=packed; anyAlpha|=packed; allAlpha&=packed;
  }
  if(anyAlpha==0u) { continue; }
  if(allAlpha==0xffffffffu) { run=x; continue; }
  let alpha=atomicAdd(&scratch[2u],1u); if(alpha>=MAX_ALPHA) { overflow(32u); continue; }
  for(var row=0u;row<4u;row++) { atomicStore(&scratch[ALPHA+alpha*4u+row],mask[row]); }
  appendStrip(primitive,x,x+4u,y,alpha);
 }
 if(run!=NONE) { appendStrip(primitive,run,end,y,NONE); }
}
@compute @workgroup_size(1)
fn prepareStrips() { indirect[12]=(min(MAX_STRIPS,atomicLoad(&scratch[1u]))+63u)/64u; indirect[13]=1u; indirect[14]=1u; }
@compute @workgroup_size(64)
fn binStrips(@builtin(global_invocation_id) id:vec3<u32>) {
 let i=id.x; if(i>=min(MAX_STRIPS,atomicLoad(&scratch[1u]))) { return; } let at=STRIPS+i*8u;
 let first=atomicLoad(&scratch[at+1u])/16u; let last=(atomicLoad(&scratch[at+3u])-1u)/16u; let y=atomicLoad(&scratch[at+2u])/16u;
 if(y>=frame.screen.w) { return; }
 for(var x=first;x<=min(last,frame.screen.z-1u);x++) {
  let tile=y*frame.screen.z+x; if(atomicLoad(&scratch[DAMAGE+tile])==0u) { continue; } let slot=atomicAdd(&scratch[TILE_COUNTS+tile],1u);
  if(slot<TILE_CAPACITY) { atomicStore(&scratch[TILE_LIST+tile*TILE_CAPACITY+slot],i); } else { overflow(64u); }
 }
}
var<workgroup> tileSorted:array<vec2<u32>,256>;
var<workgroup> tileCountShared:u32;
var<workgroup> tileDirtyShared:u32;
@compute @workgroup_size(64)
fn composite(@builtin(workgroup_id) group:vec3<u32>,@builtin(local_invocation_index) lane:u32) {
 // CPU dispatch covers the allocation; GPU Fit may use a smaller active extent.
 if(group.x>=frame.screen.z||group.y>=frame.screen.w){return;}
 let tile=group.y*frame.screen.z+group.x;
 if(lane==0u) {
  tileCountShared=min(TILE_CAPACITY,atomicLoad(&scratch[TILE_COUNTS+tile]));
  tileDirtyShared=atomicLoad(&scratch[DAMAGE+tile]);
 }
 let isDirty=workgroupUniformLoad(&tileDirtyShared);
 if(isDirty==0u) { return; }
 let count=workgroupUniformLoad(&tileCountShared);
 var sortCount=1u; while(sortCount<count) { sortCount*=2u; }
 for(var j=lane;j<sortCount;j+=64u) {
  var pair=vec2<u32>(NONE,NONE);
  if(j<count) { let id=atomicLoad(&scratch[TILE_LIST+tile*TILE_CAPACITY+j]); pair=vec2<u32>(atomicLoad(&scratch[STRIPS+id*8u+5u]),id); }
  tileSorted[j]=pair;
 }
 workgroupBarrier();
 for(var k=2u;k<=sortCount;k*=2u) {
  for(var stride=k/2u;stride>0u;stride/=2u) {
   for(var j=lane;j<sortCount;j+=64u) {
    let peer=j^stride;
    if(peer>j) {
     let a=tileSorted[j]; let b=tileSorted[peer]; let greater=a.x>b.x || (a.x==b.x && a.y>b.y); let ascending=(j&k)==0u;
     if(greater==ascending) { tileSorted[j]=b; tileSorted[peer]=a; }
    }
   }
   workgroupBarrier();
  }
 }
 for(var pixel=lane;pixel<256u;pixel+=64u) {
  let pos=vec2<u32>(group.x*16u+pixel%16u,group.y*16u+pixel/16u);
  if(pos.x>=frame.screen.x || pos.y>=frame.screen.y) { continue; }
  var color=vec3<f32>(0.0); var transmittance=1.0;
  // Front-to-back evaluation is algebraically equivalent to painter-over. Stop
  // exactly at opaque coverage; never approximate away translucent contributions.
  for(var j=count;j>0u;j--) {
   let at=STRIPS+tileSorted[j-1u].y*8u; let x0=atomicLoad(&scratch[at+1u]); let y0=atomicLoad(&scratch[at+2u]); let x1=atomicLoad(&scratch[at+3u]);
   if(pos.x<x0 || pos.x>=x1 || pos.y<y0 || pos.y>=y0+4u) { continue; }
   let mask=atomicLoad(&scratch[at+4u]); var alpha=1.0;
   if(mask!=NONE) { let packed=atomicLoad(&scratch[ALPHA+mask*4u+pos.y-y0]); alpha=f32((packed>>((pos.x-x0)*8u))&255u)/255.0; }
   let p=draws.items[atomicLoad(&scratch[at])]; let paint=primitivePaint(p,vec2<f32>(pos)+vec2<f32>(.5));alpha*=paint.a; color+=paint.rgb*(alpha*transmittance);
   transmittance*=1.0-alpha; if(transmittance==0.0) { break; }
  }
  color+=decodeColor(0xff20170eu).rgb*transmittance;
  // Explicit sRGB encoding after linear-light compositing. Opaque presentation surface.
  let encoded=select(color*12.92,1.055*pow(max(color,vec3<f32>(0.0)),vec3<f32>(1.0/2.4))-vec3<f32>(0.055),color>vec3<f32>(0.0031308));
  var result=vec4<f32>(encoded,1.0); if((atomicLoad(&scratch[3u])|atomicLoad(&draws.overflow))!=0u && pos.y<4u) { result=vec4<f32>(1.0,0.15,0.12,1.0); }
  textureStore(targetImage,vec2<i32>(pos),result);
 }
}

fn sampleImageBrush(at:u32,uv:vec2<f32>)->vec4<f32> {
 let width=heap[at+2u];let height=heap[at+3u];let pixel=clamp(uv,vec2<f32>(0.0),vec2<f32>(1.0))*vec2<f32>(f32(width),f32(height))-vec2<f32>(.5);
 let lo=vec2<i32>(floor(pixel));let weight=fract(pixel);var colors:array<vec4<f32>,4>;
 for(var k=0u;k<4u;k++){let pos=vec2<u32>(clamp(lo+vec2<i32>(i32(k%2u),i32(k/2u)),vec2<i32>(0),vec2<i32>(i32(width)-1,i32(height)-1)));let color=decodeColor(heap[heap[at+1u]+pos.y*width+pos.x]);colors[k]=vec4<f32>(color.rgb*color.a,color.a);}
 let c=mix(mix(colors[0],colors[1],weight.x),mix(colors[2],colors[3],weight.x),weight.y);return vec4<f32>(c.rgb/max(.000001,c.a),c.a);
}
fn primitivePaint(p:Primitive,point:vec2<f32>)->vec4<f32> {
 if(p.info.x==5u){
  if(p.params.w>0.5){let origin=round(transform(p.matrix,p.translation.xy,p.rect.xy));let c=previewTexel(vec2<i32>(floor(point-origin)),p.params.xy);return vec4<f32>(c.rgb,c.a*p.color.a);}
  let local=inverse(p.matrix,p.translation.xy,point);let c=previewColor((local-p.rect.xy)/max(vec2<f32>(.001),p.rect.zw),p.params.xy);return vec4<f32>(c.rgb,c.a*p.color.a);
 }
 let at=u32(p.translation.w);if(at==0u){return p.color;}let kind=heap[at];
 if(kind==0u){let color=decodeColor(heap[at+1u]);return vec4<f32>(color.rgb,color.a*hf(at+2u)*p.color.a);}
 let local=inverse(p.matrix,p.translation.xy,point);let origin=vec2<f32>(hf(at+4u),hf(at+5u));let size=max(vec2<f32>(.00001),vec2<f32>(hf(at+6u),hf(at+7u)));let uv=(local-origin)/size;
 if(kind==3u){let c=sampleImageBrush(at,uv);return vec4<f32>(c.rgb,c.a*p.color.a);}
 let first=vec2<f32>(hf(at+8u),hf(at+9u));let second=vec2<f32>(hf(at+10u),hf(at+11u));var t=0.0;
 if(kind==1u){let delta=second-first;t=dot(uv-first,delta)/max(.000001,dot(delta,delta));}else{t=length((uv-first)/second);}
 let spread=heap[at+3u];if(spread==1u){t=fract(t);}else if(spread==2u){t=1.0-abs(1.0-(t-floor(t*.5)*2.0));}else{t=clamp(t,0.0,1.0);}
 let base=heap[at+1u];let count=heap[at+2u];var left=base;var right=base;
 for(var j=1u;j<count;j++){right=base+j*2u;if(t<=hf(right)){break;}left=right;}
 let factor=clamp((t-hf(left))/max(.000001,hf(right)-hf(left)),0.0,1.0);let a=decodeColor(heap[left+1u]);let b=decodeColor(heap[right+1u]);
 let alpha=mix(a.a,b.a,factor);let rgb=mix(a.rgb*a.a,b.rgb*b.a,factor)/max(.000001,alpha);return vec4<f32>(rgb,alpha*p.color.a);
}

fn coverage(p:Primitive,pixel:vec2<f32>)->f32 {
 var result=unclippedCoverage(p,pixel);var at=u32(p.translation.z);
 for(var depth=0u;depth<32u&&at!=0u;depth++){
  let r=vec4<f32>(hf(at+1u),hf(at+2u),hf(at+3u),hf(at+4u));let m=vec4<f32>(hf(at+5u),hf(at+6u),hf(at+7u),hf(at+8u));let t=vec2<f32>(hf(at+9u),hf(at+10u));
  let a=transform(m,t,r.xy);let b=transform(m,t,r.xy+vec2<f32>(r.z,0.0));let c=transform(m,t,r.xy+r.zw);let d=transform(m,t,r.xy+vec2<f32>(0.0,r.w));
  result*=clamp(abs(edgeArea(vec4<f32>(a,b),pixel)+edgeArea(vec4<f32>(b,c),pixel)+edgeArea(vec4<f32>(c,d),pixel)+edgeArea(vec4<f32>(d,a),pixel)),0.0,1.0);at=heap[at];
 }return result;
}
