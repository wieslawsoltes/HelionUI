// Two logical phases: constraint-aware Measure, then Arrange. Depth dispatches form global barriers.
fn trackCount(n:Node, axis:u32)->u32 { return select(n.tracks.y,n.tracks.w,axis==1u); }
fn trackBase(n:Node, axis:u32)->u32 { return select(n.tracks.x,n.tracks.z,axis==1u); }
fn intrinsicTracks(n:Node, axis:u32)->f32 {
 let count=trackCount(n,axis); let base=trackBase(n,axis); var sum=0.0;
 for(var k=0u;k<count;k++) {
  let at=base+k*4u; var size=0.0;
  if(heap[at]==0u) { size=hf(at+1u); }
  else {
   for(var j=0u;j<n.info.w;j++) {
    let ci=child(n,j); if(!visible(ci)) { continue; } let c=nodes[ci];
    let start=select(c.placement.z,c.placement.w,axis==1u); let span=u32(select(c.config.x,c.config.y,axis==1u));
    if(k>=start && k<start+span) { size=max(size,c.available[axis+2u]/f32(span)); }
   }
  }
  let bounds=trackLimits(n,axis,k);size=clamp(size,bounds.x,bounds.y);hsetf(at+2u,size); sum+=size;
 }
 return sum+max(0.0,f32(count)-1.0)*axisSpacing(n,axis);
}
fn resolveTrack(n:Node, axis:u32, k:u32, available:f32)->f32 {
 let count=trackCount(n,axis);let base=trackBase(n,axis);let at=base+k*4u;let bounds=trackLimits(n,axis,k);
 if(heap[at]==0u){return clamp(hf(at+1u),bounds.x,bounds.y);}if(heap[at]==1u||available>=INF*.5){return clamp(hf(at+2u),bounds.x,bounds.y);}
 var remaining=max(0.0,available-max(0.0,f32(count)-1.0)*axisSpacing(n,axis));var weights=0.0;var minimumWeight=INF;
 for(var j=0u;j<count;j++){let r=base+j*4u;let lim=trackLimits(n,axis,j);if(heap[r]==2u){weights+=hf(r+1u);minimumWeight=min(minimumWeight,hf(r+1u));}else{remaining-=clamp(select(hf(r+2u),hf(r+1u),heap[r]==0u),lim.x,lim.y);}}
 let e=extension(n);if(e==0u||heap[e+32u+axis]==0u){return max(0.0,remaining)*hf(at+1u)/max(weights,.000001);}
 // Monotone water filling handles simultaneous min/max saturation without freezing
 // a minimum that should grow after a different track reaches its maximum.
 var low=0.0;var high=max(0.0,remaining)/max(.000001,minimumWeight);
 for(var iteration=0u;iteration<26u;iteration++){let unit=(low+high)*.5;var total=0.0;for(var j=0u;j<count;j++){let r=base+j*4u;if(heap[r]!=2u){continue;}let lim=trackLimits(n,axis,j);total+=clamp(unit*hf(r+1u),lim.x,lim.y);}if(total<remaining){low=unit;}else{high=unit;}}
 return clamp((low+high)*.5*hf(at+1u),bounds.x,bounds.y);
}
fn trackSpan(n:Node,axis:u32,start:u32,span:u32,available:f32)->vec2<f32> {
 var pos=0.0; var size=0.0; let count=trackCount(n,axis);
 for(var k=0u;k<count;k++) {
  let value=resolveTrack(n,axis,k,available);
  if(k<start) { pos+=value+axisSpacing(n,axis); }
  else if(k<start+span) { size+=value; if(k+1u<start+span) { size+=axisSpacing(n,axis); } }
 }
 return vec2<f32>(pos,size);
}
fn naturalText(i:u32,available:f32)->vec2<f32> {
 let shaped=uiTextRun(i,nodes[i].text.z,textLength(i));
 if(shaped!=0u){let node=nodes[i];let width=select(0.0,min(1e7,max(0.001,available)),(node.text.y&4u)!=0u);uiParagraph(shaped,node.misc.z,width,(node.text.y&4u)!=0u,0u);let p=pgData(shaped);if(heap[p+17u]!=0u){return vec2<f32>(hf(p+14u)+select(0.0,node.misc.z*5.5,node.bind.y!=0u),hf(p+15u));}}
 let n=nodes[i]; let len=textLength(i); let size=n.misc.z; let lineHeight=fontLineHeight(i,size);
 let width=select(0.0,max(0.001,available),(n.text.y&4u)!=0u);
 var start=0u; var maxWidth=0.0; var lines=0u;
 loop {
  let line=nextTextLine(i,n.text.z,len,start,size,width); maxWidth=max(maxWidth,line.width); lines++;
  if(line.next>=len) { if(line.next>line.end) { lines++; } break; }
  if(line.next<=start) { break; } start=line.next;
 }
 if(n.bind.y!=0u) { maxWidth+=size*5.5; }
 return vec2<f32>(maxWidth,lineHeight*f32(lines));
}
@compute @workgroup_size(64)
fn measure(@builtin(global_invocation_id) tid:vec3<u32>) {
 let i=tid.x; if(i>=frame.counts.x || nodes[i].text.x!=stage.p.x) { return; }
 if(!visible(i)) { nodes[i].available.z=0.0; nodes[i].available.w=0.0; return; }
 let n=nodes[i]; let intrinsic=stage.p.y==1u;let pad=layoutPadding(n);
 var av=select(n.available.xy,vec2<f32>(INF),intrinsic); av=max(vec2<f32>(0.0),av-pad.xy-pad.zw);
 if(n.size.x>=0.0) { av.x=min(av.x,n.size.x-pad.x-pad.z); }
 if(n.size.y>=0.0) { av.y=min(av.y,n.size.y-pad.y-pad.w); }
 var desired=vec2<f32>(0.0);
 switch n.info.x {
  case 1u: { desired=vec2<f32>(intrinsicTracks(n,0u),intrinsicTracks(n,1u)); }
  case 2u: {
   let axis=select(1u,0u,(n.text.y&2u)!=0u); var count=0u;
   for(var j=0u;j<n.info.w;j++) { let c=child(n,j); if(!visible(c)) { continue; }
    let size=nodes[c].available.zw; desired[axis]+=size[axis]; desired[1u-axis]=max(desired[1u-axis],size[1u-axis]); count++;
   }
   desired[axis]+=max(0.0,f32(count)-1.0)*axisSpacing(n,axis);
  }
  case 3u: {
   for(var j=0u;j<n.info.w;j++) { let ci=child(n,j); if(!visible(ci)) { continue; } let c=nodes[ci]; desired=max(desired,c.misc.xy+c.available.zw); }
  }
  case 4u,13u,14u,20u,21u,24u,25u,29u: { for(var j=0u;j<n.info.w;j++) { desired=max(desired,nodes[child(n,j)].available.zw); } }
  case 15u: { desired=dockDesired(n); }
  case 16u: { desired=wrapLayout(n,av,NONE).zw; }
  case 17u: { let shape=uniformShape(n);var cell=vec2<f32>(0.0);for(var j=0u;j<n.info.w;j++){let c=child(n,j);if(visible(c)){cell=max(cell,nodes[c].available.zw);}}desired=cell*vec2<f32>(shape)+max(vec2<f32>(0.0),vec2<f32>(shape)-vec2<f32>(1.0))*vec2<f32>(axisSpacing(n,0u),axisSpacing(n,1u)); }
  case 18u: { if(n.info.w>0u){let size=nodes[child(n,0u)].available.zw;desired=size*viewboxScale(n,size,av);} }
  case 19u: { desired=vec2<f32>(hf(n.aux.x+2u),hf(n.aux.x+3u)); }
  case 5u,6u,7u: {} // Shared text measurement below.
  case 8u: { desired=vec2<f32>(160.0,32.0); }
  case 9u: { desired=vec2<f32>(200.0,max(38.0,fontLineHeight(i,n.misc.z)+14.0)); }
  case 10u: { desired=vec2<f32>(140.0,12.0); }
  case 22u,23u: {desired=vec2<f32>(420.0,320.0);}
  case 26u,27u,28u,30u,31u,32u,33u,34u,35u: {desired=vec2<f32>(300.0,240.0);}
  case 11u: { desired=vec2<f32>(500.0,320.0); }
  case 12u: { let p=n.aux.x; desired=vec2<f32>(hf(p+8u)-hf(p+6u),hf(p+9u)-hf(p+7u)); }
  default: {}
 }
 // Compile the paragraph/legacy measurement interpreter once for all text controls.
 let emptyPresenter=n.info.x==21u&&n.info.w==0u;
 if(n.info.x==5u||n.info.x==6u||n.info.x==7u||emptyPresenter){
  let bounded=n.info.x==5u||emptyPresenter;
  desired=naturalText(i,select(INF,max(0.0,av.x),bounded));
  if(n.info.x==6u){desired+=vec2<f32>(28.0,14.0);}if(n.info.x==7u){desired+=vec2<f32>(38.0,8.0);}
 }
 if(templateHasVisual(i)&&!emptyPresenter){desired=vec2<f32>(0.0);for(var j=0u;j<n.info.w;j++){desired=max(desired,nodes[child(n,j)].available.zw);}}
 if(n.info.x==36u){desired=vec2<f32>(200.0,max(38.0,fontLineHeight(i,n.misc.z)+14.0));}
 desired+=pad.xy+pad.zw;
 if(n.size.x>=0.0) { desired.x=n.size.x; }
 if(n.size.y>=0.0) { desired.y=n.size.y; }
 desired=clamp(desired,n.size.zw,n.limits.xy);
 nodes[i].available=vec4<f32>(n.available.xy,desired+n.margin.xy+n.margin.zw);
}
@compute @workgroup_size(64)
fn constraints(@builtin(global_invocation_id) tid:vec3<u32>) {
 let i=tid.x; if(i>=frame.counts.x || nodes[i].text.x!=stage.p.x) { return; }
 let n=nodes[i]; var available=frame.viewport.xy;
 if(n.info.y!=NONE) {
  let p=nodes[n.info.y];let pad=layoutPadding(p); available=max(vec2<f32>(0.0),p.available.xy-pad.xy-pad.zw);
  if(p.size.x>=0.0) { available.x=max(0.0,p.size.x-pad.x-pad.z); }
  if(p.size.y>=0.0) { available.y=max(0.0,p.size.y-pad.y-pad.w); }
  if(p.info.x==2u) { available[select(1u,0u,(p.text.y&2u)!=0u)]=INF; }
  if(p.info.x==13u) { available.y=INF; }
  if(p.info.x==15u) {available=dockSlot(p,i,vec4<f32>(0.0,0.0,available),true).zw;}
  if(p.info.x==16u) {let e=extension(p);if(hf(e+20u)>=0.0){available.x=hf(e+20u);}if(hf(e+21u)>=0.0){available.y=hf(e+21u);}}
  if(p.info.x==17u) {let shape=vec2<f32>(uniformShape(p));available=max(vec2<f32>(0.0),available-(shape-vec2<f32>(1.0))*vec2<f32>(axisSpacing(p,0u),axisSpacing(p,1u)))/shape;}
  if(p.info.x==18u) {available=vec2<f32>(INF);}
  if(p.info.x==30u && dsSlot(p.aux.x,i)!=NONE){available=vec2<f32>(hf(dsData(p.aux.x)),hf(dsData(p.aux.x)+1u));}
  if(p.info.x==1u) {
   available=vec2<f32>(trackSpan(p,0u,n.placement.z,u32(n.config.x),available.x).y,trackSpan(p,1u,n.placement.w,u32(n.config.y),available.y).y);
   // Auto tracks measure intrinsically, with the opposite-axis constraint retained.
   if(heap[p.tracks.x+n.placement.z*4u]==1u) { available.x=INF; }
   if(heap[p.tracks.z+n.placement.w*4u]==1u) { available.y=INF; }
  }
 }
 available=max(vec2<f32>(0.0),available-n.margin.xy-n.margin.zw);
 nodes[i].available=vec4<f32>(min(available,n.limits.xy),n.available.zw);
}
@compute @workgroup_size(64)
fn arrange(@builtin(global_invocation_id) tid:vec3<u32>) {
 let i=tid.x; if(i>=frame.counts.x || nodes[i].text.x!=stage.p.x) { return; }
 let n=nodes[i]; if(!visible(i)) { nodes[i].rect=vec4<f32>(0.0); return; }
 var slot=vec4<f32>(0.0,0.0,frame.viewport.x,frame.viewport.y);
 if(n.info.y!=NONE) {
  let p=nodes[n.info.y]; slot=contentRect(p);
  if(n.info.x==25u){slot=dockItemRect(i);}
  if(p.info.x==30u && dsSlot(p.aux.x,i)!=NONE){slot=vec4<f32>(0.0,0.0,hf(dsData(p.aux.x)),hf(dsData(p.aux.x)+1u));}
  if(p.info.x==1u) {
   let tx=trackSpan(p,0u,n.placement.z,u32(n.config.x),slot.z); let ty=trackSpan(p,1u,n.placement.w,u32(n.config.y),slot.w);
   slot=vec4<f32>(slot.xy+vec2<f32>(tx.x,ty.x),tx.y,ty.y);
  }
  if(p.info.x==2u) {
   let axis=select(1u,0u,(p.text.y&2u)!=0u); var cursor=0.0;
   for(var j=0u;j<p.info.w;j++) { let c=child(p,j); if(c==i) { break; } if(visible(c)) { cursor+=nodes[c].available[axis+2u]+axisSpacing(p,axis); } }
   slot[axis]+=cursor; slot[axis+2u]=n.available[axis+2u];
  }
  if(p.info.x==3u) { var origin=slot.xy+n.misc.xy;let e=extension(n);if(e!=0u){if(hf(e+30u)>-INF*.5&&(heap[e+1u]&16u)==0u){origin.x=slot.x+slot.z-n.available.z-hf(e+30u);}if(hf(e+31u)>-INF*.5&&(heap[e+1u]&32u)==0u){origin.y=slot.y+slot.w-n.available.w-hf(e+31u);}}slot=vec4<f32>(origin,n.available.zw); }
  if(p.info.x==15u) {slot=dockSlot(p,i,slot,false);}
  if(p.info.x==16u) {let wrap=wrapLayout(p,slot.zw,i);slot=vec4<f32>(slot.xy+wrap.xy,wrap.zw);}
  if(p.info.x==17u) {let shape=uniformShape(p);let gaps=vec2<f32>(axisSpacing(p,0u),axisSpacing(p,1u));let size=max(vec2<f32>(0.0),slot.zw-(vec2<f32>(shape)-vec2<f32>(1.0))*gaps)/vec2<f32>(shape);var index=uniformFirstColumn(p,shape.x);for(var j=0u;j<p.info.w;j++){let c=child(p,j);if(c==i){break;}if(visible(c)){index++;}}slot=vec4<f32>(slot.xy+vec2<f32>(f32(index%shape.x),f32(index/shape.x))*(size+gaps),size);}
  if(p.info.x==18u) {slot=vec4<f32>(slot.xy,n.available.zw);}
  if(p.info.x==13u) { slot.w=max(slot.w,n.available.w); }
 }
 slot=vec4<f32>(slot.xy+n.margin.xy,max(vec2<f32>(0.0),slot.zw-n.margin.xy-n.margin.zw));
 var desired=max(vec2<f32>(0.0),n.available.zw-n.margin.xy-n.margin.zw);
 var size=slot.zw;
 for(var a=0u;a<2u;a++) {
  if(n.placement[a]!=0u || n.size[a]>=0.0) { size[a]=min(slot[a+2u],desired[a]); }
  size[a]=min(max(size[a],n.size[a+2u]),n.limits[a]);
  let extra=max(0.0,slot[a+2u]-size[a]); if(n.placement[a]==2u) { slot[a]+=extra*0.5; } else if(n.placement[a]==3u) { slot[a]+=extra; }
 }
 let e=extension(n);if(e!=0u&&(heap[e+1u]&64u)!=0u){let position=round(slot.xy*frame.viewport.z)/frame.viewport.z;let end=round((slot.xy+size)*frame.viewport.z)/frame.viewport.z;nodes[i].rect=vec4<f32>(position,max(vec2<f32>(0.0),end-position));}else{nodes[i].rect=vec4<f32>(slot.xy,size);}
}
@compute @workgroup_size(64)
fn animate(@builtin(global_invocation_id) tid:vec3<u32>) {
 let k=tid.x; if(k>=state[36]) { return; } let at=state[35]+k*12u;
 let i=heap[at]; let property=heap[at+1u];if(runExtendedAnimation(at,i,cs(i)+property)){return;} var speed=1.0;
 if(heap[at+9u]!=NONE) { speed=0.15+max(0.0,sf(cs(heap[at+9u])))*2.85; }
 let time=max(0.0,sf(46u)*speed-hf(at+5u)); let duration=max(0.001,hf(at+4u));
 var t=min(time/duration,1.0);
 if(heap[at+6u]!=0u) { t=fract(time/duration); }
 if(heap[at+7u]!=0u && heap[at+6u]!=0u && u32(floor(time/duration))%2u==1u) { t=1.0-t; }
 if(heap[at+8u]==1u) { t=t*t*(3.0-2.0*t); }
 if(heap[at+8u]==2u) { t=1.0-exp(-6.0*t)*cos(t*9.0); }
 if(heap[at+8u]>2u){t=eased(t,heap[at+8u]);}
 setf(cs(i)+property,mix(hf(at+2u),hf(at+3u),t));
}
@compute @workgroup_size(64)
fn compose(@builtin(global_invocation_id) tid:vec3<u32>) {
 let i=tid.x; if(i>=frame.counts.x || nodes[i].text.x!=stage.p.x) { return; }
 if(nodes[i].info.x==30u&&nodes[i].aux.x!=0u&&heap[nodes[i].aux.x+117u]!=0u){dsFit(nodes[i].aux.x);heap[nodes[i].aux.x+117u]=0u;}
 let n=nodes[i]; let s=cs(i); var pm=vec4<f32>(1.0,0.0,0.0,1.0); var pt=vec2<f32>(0.0); var opacity=1.0;
 var clip=vec4<f32>(0.0,0.0,frame.viewport.x,frame.viewport.y);
 var parentScroll=vec2<f32>(0.0);
 if(n.info.y!=NONE) { let p=nodes[n.info.y]; pm=p.matrix; pt=p.translation.xy; opacity=p.translation.z; clip=p.clip;
  if(p.info.x==30u && dsSlot(p.aux.x,i)!=NONE){let d=p.aux.x;pt=transform(pm,pt,dsViewportOrigin(d));pm*=hf(d+13u);}
  if(p.info.x==18u){let content=contentRect(p);let size=n.available.zw;let fit=viewboxScale(p,size,content.zw);let origin=content.xy+(content.zw-size*fit)*.5;let shift=origin-content.xy*fit;pt=transform(pm,pt,shift);pm=vec4<f32>(pm.xy*fit.x,pm.zw*fit.y);}
  if(p.info.x==13u) { parentScroll=vec2<f32>(-sf(cs(n.info.y)+2u),-sf(cs(n.info.y)+1u)); }
 }
 let angle=sf(s+12u); let scale=vec2<f32>(max(0.001,sf(s+10u)),max(0.001,sf(s+11u)));
 let a=cos(angle); let b=sin(angle); var local=vec4<f32>(a*scale.x,b*scale.x,-b*scale.y,a*scale.y);
 let e=extension(n);var origin=vec2<f32>(.5);var shift=vec2<f32>(0.0);if(e!=0u){origin=vec2<f32>(hf(e+18u),hf(e+19u));if((heap[e+1u]&2u)!=0u){let m=vec4<f32>(hf(e+12u),hf(e+13u),hf(e+14u),hf(e+15u));shift=vec2<f32>(hf(e+16u),hf(e+17u));local=vec4<f32>(local.x*m.x+local.z*m.y,local.y*m.x+local.w*m.y,local.x*m.z+local.z*m.w,local.y*m.z+local.w*m.w);}}
 let center=n.rect.xy+n.rect.zw*origin;
 let lt=center-transform(local,vec2<f32>(0.0),center)+vec2<f32>(sf(s+8u),sf(s+9u))+parentScroll+shift;
 let m=vec4<f32>(pm.x*local.x+pm.z*local.y,pm.y*local.x+pm.w*local.y,pm.x*local.z+pm.z*local.w,pm.y*local.z+pm.w*local.w);
 let t=transform(pm,pt,lt);
 if((n.text.y&8u)!=0u) { clip=intersection(clip,transformedBounds(m,t,boundsOf(n.rect))); }
 nodes[i].matrix=m; nodes[i].translation=vec4<f32>(t,opacity*clamp(sf(s+3u),0.0,1.0)*select(0.0,1.0,visible(i)),0.0); nodes[i].clip=clip;
}

fn eased(t:f32,code:u32)->f32 {
 switch(code){case 1u:{return t*t*(3.0-2.0*t);}case 2u:{if(t>=1.0){return 1.0;}return 1.0-exp(-7.0*t)*cos(t*9.0);}
 case 3u:{return t*t*t;}case 4u:{return 1.0-pow(1.0-t,3.0);}case 5u:{if(t<.5){return 4.0*t*t*t;}return 1.0-pow(-2.0*t+2.0,3.0)*.5;}
 case 6u:{return (1.0-cos(3.141592653589793*t))*.5;}case 7u:{let q=t-1.0;return 1.0+2.70158*q*q*q+1.70158*q*q;}case 8u:{return select(0.0,1.0,t>=1.0);}default:{return t;}}
}
fn pseudoState(i:u32)->u32 {var bits=0u;if(state[1]==i){bits|=1u;}if(state[2]==i){bits|=2u;}if(state[0]==i){bits|=4u;}if(sf(cs(i))>.5){bits|=8u;}if(!enabled(i)){bits|=16u;}bits|=select(32u,64u,templateLight());return bits;}
fn styleWrite(i:u32,category:u32,offset:u32,value:u32) {
 if(category==2u){state[cs(i)+offset]=value;return;}
 switch(offset){case 20u:{nodes[i].paint.x=value;}case 21u:{nodes[i].paint.y=value;}case 22u:{nodes[i].paint.z=value;}case 23u:{nodes[i].paint.w=value;}case 35u:{nodes[i].misc.w=bitcast<f32>(value);}default:{}}
}
@compute @workgroup_size(64)
fn resolveStyles(@builtin(global_invocation_id) id:vec3<u32>) {
 let i=id.x;if(i>=frame.counts.x){return;}let e=extension(nodes[i]);if(e==0u){return;}let count=heap[e+25u];if(count==0u){return;}let mask=pseudoState(i);let now=frame.viewport.w;
 for(var j=0u;j<count;j++){let at=heap[e+24u]+j*16u;if(heap[at+12u]!=0u){continue;}var value=heap[at+2u];
  for(var k=0u;k<heap[at+3u];k++){let r=heap[at+4u]+k*4u;if((mask&heap[r])==heap[r]&&(mask&heap[r+1u])==0u){value=heap[r+2u];}}
  if(heap[at+11u]==0u){heap[at+7u]=value;heap[at+8u]=value;heap[at+10u]=value;heap[at+11u]=1u;}
  if(value!=heap[at+7u]){heap[at+8u]=heap[at+10u];heap[at+7u]=value;hsetf(at+9u,now);}
  let duration=hf(at+5u);let t=eased(clamp((now-hf(at+9u))/max(.00001,duration),0.0,1.0),heap[at+6u]);var current=value;
  if(duration>0.0&&t<1.0){if(heap[at]==0u){current=pack4x8unorm(mix(unpack4x8unorm(heap[at+8u]),unpack4x8unorm(value),t));}else{current=bitcast<u32>(mix(hf(at+8u),bitcast<f32>(value),t));}}
  heap[at+10u]=current;styleWrite(i,heap[at],heap[at+1u],current);
 }
}
fn runExtendedAnimation(a:u32,i:u32,recipient:u32)->bool {
 let e=heap[a+10u];if(e==0u){return false;}let status=heap[e+5u];if(status==2u){return true;}
 if(heap[a+11u]==2u){if(status==1u){state[recipient]=heap[e+15u];return true;}let source=heap[e+10u];if(source!=NONE){setf(recipient,clamp(sf(cs(source))*hf(e+11u)+hf(e+12u),hf(e+13u),hf(e+14u)));}return true;}
 var elapsed=sf(46u)-hf(e+6u);if(status==1u){elapsed=hf(e+7u);}let time=elapsed*hf(e+9u)-hf(a+5u);let duration=hf(a+4u);let count=heap[e+2u];let direction=heap[e+3u];let fill=heap[e+4u];
 var cycle=max(0.0,floor(time/duration));var t=fract(max(0.0,time)/duration);
 if(time<0.0){if((fill&1u)==0u){state[recipient]=heap[e+8u];return true;}t=0.0;cycle=0.0;}
 if(count>0u&&time>=f32(count)*duration){if((fill&2u)==0u){state[recipient]=heap[e+8u];return true;}cycle=f32(count-1u);t=1.0;}
 let reverse=direction==1u||(direction>=2u&&(u32(cycle)%2u==select(1u,0u,direction==3u)));if(reverse){t=1.0-t;}
 let keys=heap[e+1u];var left=keys;var right=keys+4u;
 for(var j=1u;j<heap[e];j++){right=keys+j*4u;if(t<=hf(right)){break;}left=right;}
 let ratio=clamp((t-hf(left))/max(.000001,hf(right)-hf(left)),0.0,1.0);setf(recipient,mix(hf(left+1u),hf(right+1u),eased(ratio,heap[right+2u])));return true;
}
fn animationControl(node:u32,command:u32,value:f32) {
 for(var j=0u;j<state[36];j++){let a=state[35]+j*12u;if(heap[a]!=node){continue;}let e=heap[a+10u];if(e==0u){continue;}
  switch(command){case 0u:{heap[e+5u]=0u;hsetf(e+6u,sf(46u));}case 1u:{if(heap[e+5u]==0u){hsetf(e+7u,sf(46u)-hf(e+6u));heap[e+15u]=state[cs(node)+heap[a+1u]];heap[e+5u]=1u;}}
  case 2u:{if(heap[e+5u]==1u){hsetf(e+6u,sf(46u)-hf(e+7u));heap[e+5u]=0u;}}
  case 3u:{heap[e+5u]=2u;state[cs(node)+heap[a+1u]]=heap[e+8u];}
  case 4u:{let elapsed=max(0.0,value);hsetf(e+6u,sf(46u)-elapsed);hsetf(e+7u,elapsed);}default:{}}
 }
}

// An imperative composition Set has local-value precedence over style activators.
fn styleLocalValue(i:u32,offset:u32) {
 let e=extension(nodes[i]);if(e==0u){return;}
 for(var j=0u;j<heap[e+25u];j++){let at=heap[e+24u]+j*16u;if(heap[at]==2u&&heap[at+1u]==offset){heap[at+12u]=1u;}}
}
