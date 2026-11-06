// Cross-surface input and composition use one GPU queue/command encoder. No bounds readback.
@group(0) @binding(12) var previewImage:texture_2d<f32>;
@group(0) @binding(13) var<storage,read_write> relay:array<u32>;
const RELAY_TEXT:u32=2052u;
const RELAY_FRAME:u32=67588u;
fn externalInput()->bool{return (frame.flags.y&8192u)!=0u;}
fn inputCount()->u32 {return frame.counts.y+select(0u,min(256u,relay[0u]),externalInput());}
fn inputCommand(index:u32)->Command {
 if(index<frame.counts.y){return commands[index];}
 let at=4u+(index-frame.counts.y)*8u;
 return Command(relay[at],relay[at+1u],vec2<f32>(bitcast<f32>(relay[at+2u]),bitcast<f32>(relay[at+3u])),vec2<f32>(bitcast<f32>(relay[at+4u]),bitcast<f32>(relay[at+5u])),relay[at+6u],relay[at+7u]);
}
fn presenterSize(n:Node)->vec2<f32>{if(hf(n.aux.x)==0.0){return max(vec2<f32>(1.0),presenterRect(n).zw);}return vec2<f32>(hf(n.aux.x),hf(n.aux.x+1u));}
fn presenterRect(n:Node)->vec4<f32>{let r=contentRect(n);if(hf(n.aux.x)==0.0){
 // Fit at unit scale gets integer physical bounds, avoiding a second glyph
 // reconstruction in previewColor. Pointer routing uses this same rectangle.
 if((frame.flags.y&16384u)==0u && all(n.matrix==vec4<f32>(1.0,0.0,0.0,1.0))) {
  let dpr=frame.viewport.z; let first=round((r.xy+n.translation.xy)*dpr)/dpr-n.translation.xy;
  let last=round((r.xy+r.zw+n.translation.xy)*dpr)/dpr-n.translation.xy;
  return vec4<f32>(first,max(vec2<f32>(0.0),last-first));
 }
 return r;
}let size=vec2<f32>(hf(n.aux.x),hf(n.aux.x+1u));let scale=min(r.z/max(1.0,size.x),r.w/max(1.0,size.y));let extent=size*max(0.0,scale);return vec4<f32>(r.xy+(r.zw-extent)*.5,extent);}
fn isPresenter(i:u32)->bool{return i!=NONE&&i<frame.counts.x&&nodes[i].info.x==26u&&sf(cs(i))>0.5&&visible(i);}
fn forwardCommand(c:Command,i:u32){if(relay[0u]>=256u){state[43u]++;return;}let n=nodes[i];let r=presenterRect(n);let size=presenterSize(n);let pos=(inverse(n.matrix,n.translation.xy,c.position)-r.xy)*size/max(vec2<f32>(.001),r.zw);var data=c.data;if(c.kind==4u){data*=size/max(vec2<f32>(.001),r.zw);}
 let at=4u+relay[0u]*8u;relay[at]=c.kind;relay[at+1u]=NONE;relay[at+2u]=bitcast<u32>(pos.x);relay[at+3u]=bitcast<u32>(pos.y);relay[at+4u]=bitcast<u32>(data.x);relay[at+5u]=bitcast<u32>(data.y);relay[at+6u]=c.code;relay[at+7u]=c.sequence;relay[0u]++;
 if(c.kind==10u&&c.code==38u){let count=min(65536u,min(state[40u],u32(max(0.0,c.data.x))));relay[2u]=count;for(var k=0u;k<count;k++){relay[RELAY_TEXT+k]=heap[state[23u]+k];}}
}
fn routePresenter(c:Command,hit:u32)->bool {
 if((VIEW_FEATURES&16u)==0u||externalInput()){return false;}
 let isText=c.kind==5u||c.kind==6u||(c.kind==10u&&c.code==38u);var recipient=NONE;
 if(isText&&c.recipient==NONE){if(isPresenter(state[0u])){recipient=state[0u];}}
 else if(c.kind<=4u||c.kind==8u){if(isPresenter(state[2u])){recipient=state[2u];}else if(isPresenter(hit)){recipient=hit;}else if(c.kind==1u&&isPresenter(state[1u])){recipient=state[1u];}}
 if(recipient==NONE){if(c.kind==2u&&isPresenter(state[0u])){var cancel=c;cancel.kind=8u;cancel.code=1u;forwardCommand(cancel,state[0u]);}return false;}
 if(c.kind==1u&&state[2u]!=recipient&&hit!=recipient){var leave=c;leave.position=transform(nodes[recipient].matrix,nodes[recipient].translation.xy,vec2<f32>(-100000.0));forwardCommand(leave,recipient);state[1u]=hit;return false;}
 if(c.kind==2u){state[0u]=recipient;state[2u]=recipient;}if(c.kind==1u){state[1u]=hit;}if(c.kind==3u||c.kind==8u){state[2u]=NONE;}
 forwardCommand(c,recipient);return true;
}
fn prepareExternalText(c:Command){if(externalInput()&&c.kind==10u&&c.code==38u){let count=min(state[40u],relay[2u]);for(var k=0u;k<count;k++){heap[state[23u]+k]=relay[RELAY_TEXT+k];}}}
// Pixel-aligned Fit is a one-to-one copy, not a reconstruction filter.
fn previewTexel(pixel:vec2<i32>,extent:vec2<f32>)->vec4<f32> {
 let size=clamp(vec2<i32>(extent),vec2<i32>(1),vec2<i32>(textureDimensions(previewImage)));
 let texel=textureLoad(previewImage,clamp(pixel,vec2<i32>(0),size-vec2<i32>(1)),0);
 let linear=select(texel.rgb/12.92,pow((texel.rgb+vec3<f32>(.055))/1.055,vec3<f32>(2.4)),texel.rgb>vec3<f32>(.04045));
 return vec4<f32>(linear,texel.a);
}
fn previewColor(uv:vec2<f32>,extent:vec2<f32>)->vec4<f32>{let size=clamp(vec2<i32>(extent),vec2<i32>(1),vec2<i32>(textureDimensions(previewImage)));let p=clamp(uv,vec2<f32>(0.0),vec2<f32>(1.0))*vec2<f32>(size)-vec2<f32>(.5);let lo=vec2<i32>(floor(p));let f=fract(p);var colors:array<vec4<f32>,4>;for(var k=0u;k<4u;k++){let texel=textureLoad(previewImage,clamp(lo+vec2<i32>(i32(k%2u),i32(k/2u)),vec2<i32>(0),size-vec2<i32>(1)),0);let linear=select(texel.rgb/12.92,pow((texel.rgb+vec3<f32>(.055))/1.055,vec3<f32>(2.4)),texel.rgb>vec3<f32>(.04045));colors[k]=vec4<f32>(linear,texel.a);}return mix(mix(colors[0],colors[1],f.x),mix(colors[2],colors[3],f.x),f.y);}

// The parent has arranged its docking tree before this dispatch. Only this kernel
// knows the Fit viewport: its dimensions never round-trip through JavaScript.
@compute @workgroup_size(1)
fn preparePresenterFrame(){
 let i=relay[1u];let n=nodes[i];let d=n.aux.x;let size=presenterSize(n);
 let allocation=vec2<f32>(f32(relay[RELAY_FRAME+12u]),f32(relay[RELAY_FRAME+13u]));
 let dpr=max(.000001,min(frame.viewport.z,min(allocation.x/size.x,allocation.y/size.y)));
 let pixels=min(vec2<u32>(allocation),max(vec2<u32>(1u),vec2<u32>(round(size*dpr))));
 if(hf(d+4u)!=size.x||hf(d+5u)!=size.y||hf(d+6u)!=dpr){relay[RELAY_FRAME+8u]|=1u;}
 relay[RELAY_FRAME]=bitcast<u32>(size.x);relay[RELAY_FRAME+1u]=bitcast<u32>(size.y);relay[RELAY_FRAME+2u]=bitcast<u32>(dpr);
 relay[RELAY_FRAME+12u]=pixels.x;relay[RELAY_FRAME+13u]=pixels.y;
 relay[RELAY_FRAME+14u]=(pixels.x+15u)/16u;relay[RELAY_FRAME+15u]=(pixels.y+15u)/16u;
 hsetf(d+2u,f32(pixels.x));hsetf(d+3u,f32(pixels.y));hsetf(d+4u,size.x);hsetf(d+5u,size.y);hsetf(d+6u,dpr);
}
