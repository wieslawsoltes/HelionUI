// Helion ABI v3. Constants for bounded arenas are prepended by the host.
struct Frame { viewport: vec4<f32>, counts: vec4<u32>, flags: vec4<u32>, screen: vec4<u32> }
struct Stage { p: vec4<u32> }
struct Node {
 info: vec4<u32>, text: vec4<u32>, size: vec4<f32>, limits: vec4<f32>, margin: vec4<f32>, paint: vec4<u32>,
 placement: vec4<u32>, tracks: vec4<u32>, misc: vec4<f32>, action: vec4<u32>, bind: vec4<u32>, config: vec4<f32>,
 available: vec4<f32>, rect: vec4<f32>, clip: vec4<f32>, matrix: vec4<f32>, translation: vec4<f32>, aux: vec4<u32>
}
struct Primitive {
 bounds: vec4<f32>, clip: vec4<f32>, color: vec4<f32>, info: vec4<u32>,
 rect: vec4<f32>, params: vec4<f32>, matrix: vec4<f32>, translation: vec4<f32>
}
// Nodes and independent DataGrid sections link primitives backwards through info.z.
// Section-private heads permit parallel emission and exact retained comparison.
struct DrawBuffer { count: atomic<u32>, overflow: atomic<u32>, pad: vec2<u32>, heads:array<u32,DRAW_HEADS>, items: array<Primitive> }
struct PreviousDrawBuffer { count:u32, overflow:u32, pad:vec2<u32>, heads:array<u32,DRAW_HEADS>, items:array<Primitive> }
struct Command { kind: u32, recipient: u32, position: vec2<f32>, data: vec2<f32>, code: u32, sequence: u32 }
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var<storage, read_write> nodes: array<Node>;
@group(0) @binding(2) var<storage, read_write> state: array<u32>;
@group(0) @binding(3) var<storage, read_write> heap: array<u32>;
@group(0) @binding(4) var<storage, read_write> draws: DrawBuffer;
@group(0) @binding(5) var<storage, read_write> scratch: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> indirect: array<u32>;
@group(0) @binding(7) var<storage, read> commands: array<Command>;
@group(0) @binding(8) var targetImage: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(9) var<uniform> stage: Stage;
@group(0) @binding(10) var<storage,read> previousDraws:PreviousDrawBuffer;
@group(0) @binding(11) var<storage,read_write> glyphCache:array<u32>;
const NONE: u32 = 0xffffffffu;
const INF: f32 = 10000000.0;
fn cs(i: u32) -> u32 { return 64u + i * 16u; }
fn hf(i: u32) -> f32 { return bitcast<f32>(heap[i]); }
fn sf(i: u32) -> f32 { return bitcast<f32>(state[i]); }
fn setf(i: u32, v: f32) { state[i] = bitcast<u32>(v); }
fn hsetf(i: u32, v: f32) { heap[i] = bitcast<u32>(v); }
fn child(n: Node, j: u32) -> u32 { return heap[n.info.z + j]; }
fn visible(i: u32) -> bool {
 var at = i;
 for (var k = 0u; k < 32u && at != NONE; k++) {
  let n = nodes[at];
  if((VIEW_FEATURES&2u)!=0u&&n.info.x==25u && !dockItemVisible(n)){return false;}
  if ((n.text.y & 32u) != 0u || frame.viewport.x<bitcast<f32>(n.aux.y) || frame.viewport.x>=bitcast<f32>(n.aux.z) || (n.config.z >= 0.0 && u32(n.config.z) != state[8])) { return false; }
  at = n.info.y;
 }
 return true;
}
fn enabled(i:u32)->bool {
 var at=i;
 for(var k=0u;k<32u && at!=NONE;k++) { if((nodes[at].text.y&16u)!=0u) { return false; } at=nodes[at].info.y; }
 return true;
}
fn intersection(a: vec4<f32>, b: vec4<f32>) -> vec4<f32> {
 let lo = max(a.xy, b.xy); return vec4<f32>(lo, max(lo, min(a.zw, b.zw)));
}
fn contains(r: vec4<f32>, p: vec2<f32>) -> bool { return all(p >= r.xy) && all(p < r.zw); }
fn boundsOf(r: vec4<f32>) -> vec4<f32> { return vec4<f32>(r.xy, r.xy + r.zw); }
fn transform(m: vec4<f32>, t: vec2<f32>, p: vec2<f32>) -> vec2<f32> { return vec2<f32>(m.x*p.x + m.z*p.y, m.y*p.x + m.w*p.y) + t; }
fn inverse(m: vec4<f32>, t: vec2<f32>, p: vec2<f32>) -> vec2<f32> {
 let det = m.x*m.w-m.y*m.z; let d = p-t;
 return vec2<f32>(m.w*d.x-m.z*d.y, -m.y*d.x+m.x*d.y) / select(0.000001, det, abs(det) > 0.000001);
}
fn transformedBounds(m: vec4<f32>, t: vec2<f32>, b: vec4<f32>) -> vec4<f32> {
 let p0 = transform(m,t,b.xy); let p1 = transform(m,t,vec2<f32>(b.z,b.y));
 let p2 = transform(m,t,b.zw); let p3 = transform(m,t,vec2<f32>(b.x,b.w));
 return vec4<f32>(min(min(p0,p1),min(p2,p3)), max(max(p0,p1),max(p2,p3)));
}
fn textLength(i: u32) -> u32 { let owner=templateContentOwner(i);return select(nodes[i].text.w, state[cs(owner)+4u], nodes[owner].info.x == 9u); }
fn contentRect(n: Node) -> vec4<f32> { var p=layoutPadding(n);if((VIEW_FEATURES&2u)!=0u&&n.info.x==25u&&heap[n.aux.x+3u]!=0u){p.y+=28.0;}return vec4<f32>(n.rect.xy+p.xy,max(vec2<f32>(0.0),n.rect.zw-p.xy-p.zw)); }
fn tableMeta() -> u32 { if (state[25] == NONE) { return 0u; } return nodes[state[25]].action.w; }
fn metric(n: Node) -> f32 {
 var value = 0.0; let t = tableMeta();
 switch n.bind.y {
  case 1u: { if (n.bind.x != NONE) { value = sf(cs(n.bind.x)); } }
  case 2u: { if (t != 0u) { value = f32(heap[t+10u]); } }
  case 3u: { if (t != 0u && heap[t+17u] != NONE) { value = f32(heap[t+17u]+1u); } }
  case 4u: { value = f32(frame.counts.x); }
  case 5u: { value = f32(state[45]); }
  case 6u: { value = f32(frame.counts.w); }
  case 7u: { value = f32(frame.counts.z); }
  case 8u: { value = f32(state[11]); }
  case 9u: { if (t != 0u) { value = f32(heap[t]);if(heap[t+35u]!=0u){value=f32(heap[heap[t+35u]+2u]);} } }
  case 10u: { value = f32(state[15]); }
  case 11u: { value = f32(state[8]); }
  case 12u: {let b=n.bind.x;value=modelRead(heap[b],heap[b+1u],heap[b+2u]);}
  default: {}
 }
 return value*bitcast<f32>(n.bind.z)+bitcast<f32>(n.bind.w);
}
fn boundValue(i: u32) -> f32 { let n=nodes[i]; if(n.bind.y!=0u) { return metric(n); } return sf(cs(i)); }
fn decodeColor(packed: u32) -> vec4<f32> {
 var rgb=vec3<f32>(f32(packed&255u),f32((packed>>8u)&255u),f32((packed>>16u)&255u))/255.0;
 if(state[6]!=0u && templateSystem()==0u) {
  let chroma=max(rgb.x,max(rgb.y,rgb.z))-min(rgb.x,min(rgb.y,rgb.z));
  if(chroma<0.26) { rgb=vec3<f32>(0.98)-rgb*0.9; } else { rgb*=0.76; }
 }
 let linear=select(rgb/12.92,pow((rgb+vec3<f32>(0.055))/1.055,vec3<f32>(2.4)),rgb>vec3<f32>(0.04045));
 return vec4<f32>(linear,f32(packed>>24u)/255.0);
}
fn overflow(code: u32) { atomicOr(&scratch[3u],code); }

// Optional layout-extension records retain the original 72-word node ABI.
fn extension(n:Node)->u32 { return u32(n.config.w); }
fn nodePadding(n:Node)->vec4<f32> {
 let e=extension(n); if(e!=0u && (heap[e+1u]&1u)!=0u) {return vec4<f32>(hf(e+8u),hf(e+9u),hf(e+10u),hf(e+11u));}
 return vec4<f32>(n.limits.z);
}
fn horizontalScroll(n:Node)->bool {let e=extension(n);return e!=0u&&(heap[e+1u]&128u)!=0u;}
fn axisSpacing(n:Node,axis:u32)->f32 {let e=extension(n);if(e==0u){return n.limits.w;}return hf(e+29u-axis);}
fn dockEdge(n:Node)->u32 {let e=extension(n);if(e==0u){return 0u;}return heap[e+2u];}
fn trackLimits(n:Node,axis:u32,index:u32)->vec2<f32> {let e=extension(n);if(e==0u){return vec2<f32>(0.0,INF);}let p=heap[e+32u+axis];if(p==0u){return vec2<f32>(0.0,INF);}return vec2<f32>(hf(p+index*2u),hf(p+index*2u+1u));}
fn uniformFirstColumn(n:Node,columns:u32)->u32 {let first=heap[extension(n)+6u];return select(first,0u,columns!=0u&&first>=columns);}
fn uniformShape(n:Node)->vec2<u32> {
 let e=extension(n);var rows=heap[e+4u];var cols=heap[e+5u];var count=0u;
 for(var j=0u;j<n.info.w;j++){if(visible(child(n,j))){count++;}}
 let first=uniformFirstColumn(n,cols);let needed=max(1u,count+first);
 if(rows==0u&&cols==0u&&hf(e+22u)>0.0){let pad=layoutPadding(n);let width=max(0.0,min(n.available.x,select(INF,n.size.x,n.size.x>=0.0))-pad.x-pad.z);let gap=axisSpacing(n,0u);cols=max(1u,min(needed,u32(min(f32(needed),floor((width+gap)/max(1.0,hf(e+22u)+gap))))));rows=(needed+cols-1u)/cols;}
 else if(rows==0u&&cols==0u){cols=u32(ceil(sqrt(f32(needed))));rows=(needed+cols-1u)/cols;}
 else if(rows==0u){rows=(needed+cols-1u)/cols;}else if(cols==0u){cols=(needed+rows-1u)/rows;}
 return vec2<u32>(max(1u,cols),max(1u,rows));
}
fn wrapItem(n:Node,item:Node)->vec2<f32> {let e=extension(n);return vec2<f32>(select(item.available.z,hf(e+20u),hf(e+20u)>=0.0),select(item.available.w,hf(e+21u),hf(e+21u)>=0.0));}
// Returns a child's final wrap slot, or total desired bounds when recipient=NONE.
fn wrapLayout(n:Node,available:vec2<f32>,recipient:u32)->vec4<f32> {
 let vertical=(n.text.y&2u)==0u;let primary=select(available.x,available.y,vertical);
 let gap=select(axisSpacing(n,0u),axisSpacing(n,1u),vertical);let crossGap=select(axisSpacing(n,1u),axisSpacing(n,0u),vertical);
 var x=0.0;var y=0.0;var lineCross=0.0;var maxPrimary=0.0;var found=false;var lineItems=0u;var answer=vec4<f32>(0.0);
 for(var j=0u;j<n.info.w;j++) {let id=child(n,j);if(!visible(id)){continue;}let size=wrapItem(n,nodes[id]);let a=select(size.x,size.y,vertical);let b=select(size.y,size.x,vertical);
  if(lineItems>0u && x+gap+a>primary+0.0001){if(found){answer.w=lineCross;break;}maxPrimary=max(maxPrimary,x);y+=lineCross+crossGap;x=0.0;lineCross=0.0;lineItems=0u;}
  if(lineItems>0u){x+=gap;}lineItems++;if(id==recipient){answer=vec4<f32>(x,y,a,b);found=true;}x+=a;lineCross=max(lineCross,b);
 }
 if(recipient==NONE){answer=vec4<f32>(0.0,0.0,max(maxPrimary,x),y+lineCross);}else if(found){answer.w=lineCross;}
 if(vertical){return vec4<f32>(answer.y,answer.x,answer.w,answer.z);}return answer;
}
fn dockSlot(n:Node,recipient:u32,r:vec4<f32>,measuring:bool)->vec4<f32> {
 var remaining=r;let e=extension(n);let fill=heap[e+3u]!=0u;var last=NONE;
 for(var j=0u;j<n.info.w;j++){let c=child(n,j);if(visible(c)){last=c;}}
 for(var j=0u;j<n.info.w;j++) {let c=child(n,j);if(!visible(c)){continue;}let v=nodes[c];let edge=dockEdge(v);var slot=remaining;if(c==recipient&&measuring){return remaining;}
  if(!(fill&&c==last)){
   if(edge==0u||edge==2u){slot.z=min(remaining.z,v.available.z);if(edge==2u){slot.x+=remaining.z-slot.z;}}
   else{slot.w=min(remaining.w,v.available.w);if(edge==3u){slot.y+=remaining.w-slot.w;}}
  }
  if(c==recipient){return slot;}
  if(edge==0u||edge==2u){let consumed=min(remaining.z,slot.z+axisSpacing(n,0u));if(edge==0u){remaining.x+=consumed;}remaining.z-=consumed;}
  else{let consumed=min(remaining.w,slot.w+axisSpacing(n,1u));if(edge==1u){remaining.y+=consumed;}remaining.w-=consumed;}
 }
 return remaining;
}
fn dockDesired(n:Node)->vec2<f32> {
 var consumed=vec2<f32>(0.0);var wanted=vec2<f32>(0.0);let e=extension(n);var last=NONE;
 for(var j=0u;j<n.info.w;j++){let c=child(n,j);if(visible(c)){last=c;}}
 for(var j=0u;j<n.info.w;j++){let c=child(n,j);if(!visible(c)){continue;}let size=nodes[c].available.zw;let edge=dockEdge(nodes[c]);
  wanted=max(wanted,consumed+size);if(heap[e+3u]!=0u&&c==last){break;}
  if(edge==0u||edge==2u){consumed.x+=size.x+select(0.0,axisSpacing(n,0u),c!=last);}else{consumed.y+=size.y+select(0.0,axisSpacing(n,1u),c!=last);}
 }
 return max(wanted,consumed);
}
fn viewboxScale(n:Node,size:vec2<f32>,available:vec2<f32>)->vec2<f32> {
 let e=extension(n);let mode=heap[e+7u];var scale=vec2<f32>(1.0);let desired=max(size,vec2<f32>(0.00001));
 if(mode!=0u){scale=available/desired;if(available.x>=INF*.5){scale.x=scale.y;}if(available.y>=INF*.5){scale.y=scale.x;}
 if(all(available>=vec2<f32>(INF*.5))){scale=vec2<f32>(1.0);}
 if(mode==2u){scale=vec2<f32>(min(scale.x,scale.y));}if(mode==3u){scale=vec2<f32>(max(scale.x,scale.y));}}
 if(heap[e+23u]==1u){scale=max(scale,vec2<f32>(1.0));}if(heap[e+23u]==2u){scale=min(scale,vec2<f32>(1.0));}return max(scale,vec2<f32>(0.00001));
}
