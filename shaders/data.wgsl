@compute @workgroup_size(128)
fn initializeData(@builtin(global_invocation_id) id:vec3<u32>) {
 let t=tableMeta(); if(t==0u || heap[t+21u]==0u || id.x>=heap[t]) { return; }
 let i=id.x; let at=heap[t+3u]+i*8u; let dictionary=heap[t+20u];
 let h=(i*1664525u+1013904223u)^(i>>3u);
 heap[at]=heap[dictionary+i%12u]; heap[at+1u]=heap[dictionary+12u+(i/7u)%4u];
 hsetf(at+2u,f32((i/11u)%3u)); hsetf(at+3u,f32(h%2400u)/10.0+0.2);
 hsetf(at+4u,f32(1200u+h%84000u)); hsetf(at+5u,f32(h%1000u)/1000.0);
 hsetf(at+6u,0.0); hsetf(at+7u,0.0);
}
fn lower(ch:u32)->u32 { return select(ch,ch+32u,ch>=65u && ch<=90u); }
fn matches(row:u32,t:u32)->bool {
 if(!sourceAlive(t,row)){return false;}
 let at=heap[t+3u]+row*8u; let activeNode=heap[t+14u];
 if(activeNode!=NONE && sf(cs(activeNode))>0.5) {
  for(var k=0u;k<heap[t+2u];k++) { if(heap[heap[t+9u]+k*8u+2u]==2u && hf(at+k)!=0.0) { return false; } }
 }
 let filterNode=heap[t+13u]; if(filterNode==NONE) { return true; }
 let len=state[cs(filterNode)+4u]; if(len==0u) { return true; } let needle=nodes[filterNode].text.z;
 // Match any text column. All strings and query codepoints remain GPU-resident.
 for(var col=0u;col<heap[t+2u];col++) {
  if(heap[heap[t+9u]+col*8u+2u]!=0u) { continue; }
  let text=heap[at+col]; let length=heap[text]; if(length<len) { continue; }
  for(var start=0u;start<=length-len;start++) {
   var same=true; for(var j=0u;j<len;j++) { if(lower(heap[text+1u+start+j])!=lower(heap[needle+j])) { same=false; break; } }
   if(same) { return true; }
  }
 }
 return false;
}
var<workgroup> prefixWork:array<u32,128>;
@compute @workgroup_size(128)
fn filterScan(@builtin(global_invocation_id) id:vec3<u32>,@builtin(local_invocation_index) lane:u32,@builtin(workgroup_id) group:vec3<u32>) {
 let t=tableMeta(); let i=id.x; let count=heap[t]; let padded=heap[t+1u];
 var keep=0u; if(i<count) { keep=select(0u,1u,matches(heap[heap[t+34u]+i],t)); }
 prefixWork[lane]=keep; workgroupBarrier();
 // Inclusive Hillis–Steele scan; uniform barriers, no cross-workgroup assumptions.
 for(var shift=1u;shift<128u;shift*=2u) {
  var add=0u; if(lane>=shift) { add=prefixWork[lane-shift]; } workgroupBarrier();
  prefixWork[lane]+=add; workgroupBarrier();
 }
 if(i<padded) { heap[heap[t+5u]+i]=keep; heap[heap[t+6u]+i]=prefixWork[lane]-keep; heap[heap[t+4u]+i]=NONE; }
 if(lane==127u) { heap[heap[t+7u]+group.x]=prefixWork[127u]; }
}
@compute @workgroup_size(1)
fn scanBlocks() {
 let t=tableMeta(); let blocks=(heap[t+1u]+127u)/128u; var sum=0u;
 for(var j=0u;j<blocks;j++) { heap[heap[t+8u]+j]=sum; sum+=heap[heap[t+7u]+j]; }
 heap[t+10u]=sum; heap[t+16u]=NONE;
 // Keep identity separate from visible position. Sort/filterNode restoration happens in resolveSelection.
 setf(cs(state[25])+1u,min(sf(cs(state[25])+1u),maxScroll(state[25])));
}
@compute @workgroup_size(128)
fn scatterRows(@builtin(global_invocation_id) id:vec3<u32>) {
 let t=tableMeta(); let i=id.x; if(i>=heap[t+1u] || heap[heap[t+5u]+i]==0u) { return; }
 let at=heap[heap[t+6u]+i]+heap[heap[t+8u]+i/128u]; heap[heap[t+4u]+at]=heap[heap[t+34u]+i];
}
fn lessRow(a:u32,b:u32,t:u32)->bool {
 let aliveA=sourceAlive(t,a);let aliveB=sourceAlive(t,b);if(aliveA!=aliveB){return aliveA;}
 if(a==NONE) { return false; } if(b==NONE) { return true; }
 // Dead slots may reference reclaimed strings; compare identities, never old cells.
 if(!aliveA){return a<b;}
 let col=heap[t+11u]; let kind=heap[heap[t+9u]+col*8u+2u];
 let va=heap[heap[t+3u]+a*8u+col]; let vb=heap[heap[t+3u]+b*8u+col]; var compare=0i;
 if(kind==0u) {
  let la=heap[va]; let lb=heap[vb]; let len=min(la,lb);
  for(var k=0u;k<len;k++) { let ca=lower(heap[va+1u+k]); let cb=lower(heap[vb+1u+k]); if(ca<cb) { compare=-1; break; } if(ca>cb) { compare=1; break; } }
  if(compare==0) { if(la<lb) { compare=-1; } if(la>lb) { compare=1; } }
 } else { let fa=bitcast<f32>(va); let fb=bitcast<f32>(vb); if(fa<fb) { compare=-1; } if(fa>fb) { compare=1; } }
 if(compare==0) { return a<b; }
 // Parentheses disambiguate relational operators from WGSL template lists.
 return select((compare < 0i), (compare > 0i), heap[t+12u] != 0u);
}
// Sort 256 identities in workgroup memory, then merge sorted runs with parallel
// binary-rank placement. At 65,536 rows: one local sort + eight merge dispatches,
// rather than 136 device-wide bitonic stages. Identity is the stable tiebreaker.
var<workgroup> sortWork:array<u32,256>;
@compute @workgroup_size(256)
fn sortBlocks(@builtin(global_invocation_id) id:vec3<u32>, @builtin(local_invocation_index) lane:u32) {
 let t=tableMeta(); let padded=heap[t+1u];
 sortWork[lane]=select(NONE,id.x,id.x<heap[t]); workgroupBarrier();
 for(var k=2u;k<=256u;k*=2u) {
  for(var stride=k/2u;stride>0u;stride/=2u) {
   let peer=lane^stride;
   if(peer>lane) {
    let a=sortWork[lane]; let b=sortWork[peer]; let ascending=(lane&k)==0u;
    var swap=false; if(ascending) { swap=lessRow(b,a,t); } else { swap=lessRow(a,b,t); }
    if(swap) { sortWork[lane]=b; sortWork[peer]=a; }
   }
   workgroupBarrier();
  }
 }
 if(id.x<padded) { heap[heap[t+32u]+id.x]=sortWork[lane]; }
}
@compute @workgroup_size(128)
fn mergeRows(@builtin(global_invocation_id) id:vec3<u32>) {
 let t=tableMeta(); let i=id.x; let padded=heap[t+1u]; if(i>=padded) { return; }
 let width=stage.p.x; let base=(i/(width*2u))*width*2u; let inRight=(i-base)>=width;
 let source=heap[t+32u+stage.p.y]; let dest=heap[t+32u+(1u-stage.p.y)];
 let value=heap[source+i]; let other=base+select(width,0u,inRight);
 var lo=other; var hi=min(other+width,padded);
 // Unique identities form a total order. Padding sentinels are equal: left run
 // wins ties, so each sentinel still has a unique destination (no write races).
 while(lo<hi) {
  let mid=lo+(hi-lo)/2u; let candidate=heap[source+mid];
  var advance=lessRow(candidate,value,t);
  if(inRight && candidate==value) { advance=true; }
  if(advance) { lo=mid+1u; } else { hi=mid; }
 }
 let position=base+(i-base)%width+(lo-other);
 heap[dest+position]=value;
}
@compute @workgroup_size(128)
fn resolveSelection(@builtin(global_invocation_id) id:vec3<u32>) {
 let t=tableMeta(); let i=id.x; if(i>=heap[t+10u]) { return; }
 if(heap[heap[t+4u]+i]==heap[t+17u]) { heap[t+16u]=i; }
}
