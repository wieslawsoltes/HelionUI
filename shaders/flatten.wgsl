// Retained curve resources are flattened once on-device. No CPU tessellator or rasterized glyph atlas.
@compute @workgroup_size(64)
fn flatten(@builtin(global_invocation_id) id:vec3<u32>) {
 let i=id.x; if(i>=state[33]) { return; }
 let info=heap[state[34]+i]; let input=heap[info]; let segmentCount=heap[info+1u]; let output=heap[info+2u]; let capacity=heap[info+3u]; var count=0u;
 for(var s=0u;s<segmentCount;s++) {
  let at=input+s*12u; let kind=heap[at];
  let p0=vec2<f32>(hf(at+1u),hf(at+2u)); let p1=vec2<f32>(hf(at+3u),hf(at+4u));
  let p2=vec2<f32>(hf(at+5u),hf(at+6u)); let p3=vec2<f32>(hf(at+7u),hf(at+8u));
  var steps=1u;
  if(kind==1u) { steps=u32(clamp(ceil(sqrt(length(p0-2.0*p1+p2)/select(0.025,0.003,heap[info+11u]!=0u))),1.0,32.0)); }
  if(kind==2u) { steps=u32(clamp(ceil(sqrt(max(length(p0-2.0*p1+p2),length(p1-2.0*p2+p3))/select(0.0125,0.0015,heap[info+11u]!=0u))),1.0,32.0)); }
  var prev=p0;
  for(var j=1u;j<=steps;j++) {
   let t=f32(j)/f32(steps); let u=1.0-t; var p=mix(p0,p1,t);
   if(kind==1u) { p=u*u*p0+2.0*u*t*p1+t*t*p2; }
   if(kind==2u) { p=u*u*u*p0+3.0*u*u*t*p1+3.0*u*t*t*p2+t*t*t*p3; }
   if(count<capacity) { let dest=output+count*4u; hsetf(dest,prev.x); hsetf(dest+1u,prev.y); hsetf(dest+2u,p.x); hsetf(dest+3u,p.y); count++; }
   else { overflow(16u); }
   prev=p;
  }
 }
 heap[info+4u]=count;
}
