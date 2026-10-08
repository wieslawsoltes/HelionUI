const HUD_CHARACTERS:u32=95u;
const HUD_GLYPHS:u32=190u;
const HUD_FONT_META:u32=16u;
const HUD_FONT_PIXELS:u32=1536u; // 16 + 190 * 8 words
const HUD_PAIR_TABLE:u32=196096u; // After the two native-resolution coverage banks.
const HUD_ITEMS:u32=16u;
const HUD_MAX_ITEMS:u32=512u;
const HUD_BIN_COUNTS:u32=4112u; // 16 + 512 * 8
const HUD_BIN_LIST:u32=4706u; // + 27 * 22
const HUD_BIN_CAPACITY:u32=16u;
const HUD_BIN_COLS:u32=27u;
const HUD_BIN_ROWS:u32=22u;

fn hudFloat(at:u32)->f32 { return bitcast<f32>(hudHeap[at]); }
fn hudFontFloat(at:u32)->f32 { return bitcast<f32>(hudFont[at]); }
fn hudItemFloat(at:u32)->f32 { return bitcast<f32>(hudData[at]); }
fn hudSize(kind:u32)->f32 { return select(12.0,26.0,kind!=0u); }
fn hudFontIndex(code:u32,kind:u32)->u32 { return kind*HUD_CHARACTERS+clamp(code,32u,126u)-32u; }
fn hudFontRecord(index:u32)->u32 { return HUD_FONT_META+index*8u; }
fn hudGlyphId(code:u32)->u32 {
 let face=surfaceState[32]; let page=hudHeap[hudHeap[face+5u]+(code>>8u)];
 if(page!=0u) { let mapped=hudHeap[page+(code&255u)]; if(mapped!=0u) { return mapped-1u; } }
 return hudHeap[face+7u];
}
fn hudAdvance(code:u32,kind:u32)->f32 {
 return hudFontFloat(hudFontRecord(hudFontIndex(code,kind))+2u)/hudRatio();
}
fn hudPairFromFont(left:u32,right:u32)->f32 {
 // Horizontal PairPos plans, as used by the main text renderer, for these ASCII labels.
 let face=surfaceState[32]; let plan=hudHeap[face+6u]+4u; let groups=hudHeap[plan];
 let l=hudGlyphId(left); let r=hudGlyphId(right); var adjustment=0.0;
 for(var k=0u;k<hudHeap[groups];k++) {
  let group=hudHeap[groups+1u+k];
  for(var j=0u;j<hudHeap[group];j++) {
   let d=hudHeap[group+1u+j];
   if(hudHeap[d]==2u) {
    let c1=hudHeap[hudHeap[d+1u]+l];
    if(c1!=0u) { let c2=hudHeap[hudHeap[d+2u]+r]; adjustment+=hudFloat(hudHeap[d+4u]+(c1-1u)*hudHeap[d+3u]+c2); break; }
   } else {
    let at=hudHeap[d+1u]+l*2u; let base=hudHeap[at]; let count=hudHeap[at+1u]; var lo=0u; var hi=count;
    while(lo<hi) { let mid=(lo+hi)/2u; if(hudHeap[base+mid*2u]<r) { lo=mid+1u; } else { hi=mid; } }
    if(lo<count && hudHeap[base+lo*2u]==r) { adjustment+=hudFloat(base+lo*2u+1u); break; }
   }
  }
 }
 return adjustment;
}
// Exact f32 PairPos results cached once per font/scale preparation. No GPOS
// traversal or character mapping in the per-frame diagnostic label formatter.
fn hudPair(left:u32,right:u32)->f32 {
 return hudFontFloat(HUD_PAIR_TABLE+(clamp(left,32u,126u)-32u)*HUD_CHARACTERS+clamp(right,32u,126u)-32u);
}
fn hudAreaPrimitive(x:f32)->f32 {
 if(x<=0.0) { return x; } if(x>=1.0) { return 0.5; } return x-x*x*0.5;
}
fn hudEdgeArea(edge:vec4<f32>,pixel:vec2<f32>)->f32 {
 let a=edge.xy-pixel; let b=edge.zw-pixel; let dy=b.y-a.y;
 if(abs(dy)<0.0000001) { return 0.0; }
 let lo=max(0.0,min(a.y,b.y)); let hi=min(1.0,max(a.y,b.y)); if(hi<=lo) { return 0.0; }
 let x0=a.x+(lo-a.y)*(b.x-a.x)/dy; let x1=a.x+(hi-a.y)*(b.x-a.x)/dy;
 var average=clamp(1.0-x0,0.0,1.0);
 if(abs(x1-x0)>0.000001) { average=(hudAreaPrimitive(x1)-hudAreaPrimitive(x0))/(x1-x0); }
 return (hi-lo)*average*select(-1.0,1.0,dy>0.0);
}
fn hudSegmentDistance(p:vec2<f32>,a:vec2<f32>,b:vec2<f32>)->f32 {
 let ab=b-a; let t=clamp(dot(p-a,ab)/max(0.0000001,dot(ab,ab)),0.0,1.0);
 return length(p-a-t*ab);
}
fn hudFlattenedCoverage(path:u32,em:f32,pixel:vec2<f32>)->f32 {
 if(path==0u) { return 0.0; }
 let base=hudHeap[path+2u]; let count=hudHeap[path+4u]; let stroke=hudFloat(path+5u)*em;
 var area=0.0; var distance=1e10;
 for(var j=0u;j<count;j++) {
  let at=base+j*4u; let a=vec2<f32>(hudFloat(at),hudFloat(at+1u))*em; let b=vec2<f32>(hudFloat(at+2u),hudFloat(at+3u))*em;
  if(stroke>0.0) { distance=min(distance,hudSegmentDistance(pixel+vec2<f32>(0.5),a,b)); }
  else { area+=hudEdgeArea(vec4<f32>(a,b),pixel); }
 }
 if(stroke>0.0) { return clamp(stroke*0.5+0.5-distance,0.0,1.0); }
 return clamp(abs(area),0.0,1.0);
}
fn hudLinear(srgb:vec3<f32>)->vec3<f32> {
 return select(srgb/12.92,pow((srgb+vec3<f32>(0.055))/1.055,vec3<f32>(2.4)),srgb>vec3<f32>(0.04045));
}
fn hudSrgb(linear:vec3<f32>)->vec3<f32> {
 return select(linear*12.92,1.055*pow(max(linear,vec3<f32>(0.0)),vec3<f32>(1.0/2.4))-vec3<f32>(0.055),linear>vec3<f32>(0.0031308));
}
fn hudPalette(index:u32)->vec3<f32> {
 switch index {
  case 1u: { return hudLinear(vec3<f32>(0.58,0.68,0.75)); }
  case 2u: { return hudLinear(vec3<f32>(0.40,0.83,0.92)); }
  case 3u: { return hudLinear(vec3<f32>(0.72,0.65,0.96)); }
  case 4u: { return hudLinear(vec3<f32>(0.47,0.83,0.67)); }
  case 5u: { return hudLinear(vec3<f32>(1.0,0.68,0.37)); }
  default: { return hudLinear(vec3<f32>(0.89,0.94,0.98)); }
 }
}

fn hudOutlineCoverage(path:u32,em:f32,pixel:vec2<f32>)->f32 {
 if(path==0u) { return 0.0; }
 if(hudHeap[path+11u]==0u || (hudFrame.flags.y&16384u)!=0u) { return hudFlattenedCoverage(path,em,pixel); }
 let base=hudHeap[path]; let count=hudHeap[path+1u]; var area=0.0;
 for(var j=0u;j<count;j++) {
  let at=base+j*12u; let kind=hudHeap[at];
  let a=vec2<f32>(hudFloat(at+1u),hudFloat(at+2u))*em-pixel;
  let b=vec2<f32>(hudFloat(at+3u),hudFloat(at+4u))*em-pixel;
  if(kind==0u) { area+=curveLineArea(a,b); }
  else {
   let c=vec2<f32>(hudFloat(at+5u),hudFloat(at+6u))*em-pixel;
   if(kind==1u) { area+=curveQuadraticArea(a,b,c); }
   else { let d=vec2<f32>(hudFloat(at+7u),hudFloat(at+8u))*em-pixel; area+=curveCubicArea(a,b,c,d); }
  }
 }
 return clamp(abs(area),0.0,1.0);
}
