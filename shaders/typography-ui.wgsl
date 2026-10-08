// Per-control retained runs: source data is GPU-owned; no host shape/cache loop.
fn uiTextDirectory(i:u32)->u32{let e=extension(nodes[i]);if(e==0u){return 0u;}return heap[e+39u];}
fn uiTextRun(i:u32,offset:u32,len:u32)->u32{
 let d=uiTextDirectory(i);if(d==0u||nodes[i].info.x==11u){return 0u;}
 for(var j=0u;j<heap[d];j++){let r=heap[d+1u+j];let s=heap[r+63u];var source=heap[s+2u];var count=heap[s+3u];if(heap[s+1u]==0u){source=nodes[i].text.z;count=textLength(i);}if(source==offset&&count==len){return r;}}
 return 0u;
}
fn uiGridRun(i:u32,column:u32,row:u32)->u32{let d=uiTextDirectory(i);if(d==0u){return 0u;}let map=heap[d+heap[d]+1u];if(map==0u){return 0u;}var index=column;if(row!=NONE){index+=((row&127u)+1u)*8u;}return heap[map+index];}
fn uiGridSource(r:u32)->bool{
 let s=heap[r+63u];let i=heap[s];let n=nodes[i];let t=n.action.w;let first=u32(max(0.0,floor(sf(cs(i)+1u)/hf(t+15u))));
 let last=min(heap[t+10u],first+min(128u,u32(ceil(max(0.0,contentRect(n).w-68.0)/hf(t+15u)))+1u));
 let vr=first+((heap[s+6u]+128u-(first&127u))&127u);if(vr>=last||!visible(i)){return false;}
 let row=heap[heap[t+4u]+vr];if(row==NONE){return false;}let value=heap[heap[t+3u]+row*8u+heap[s+5u]];heap[s+2u]=value+1u;heap[s+3u]=heap[value];return true;
}
// Font styles may be aliased by templates or selected in Studio. Per-run face
// arrays are exclusive; immutable raw font/feature catalog records are shared.
fn uiSyncFont(r:u32,i:u32){
 let style=nodes[i].aux.w;if(style==heap[r+54u]){return;}heap[r+54u]=style;
 let catalog=heap[r+52u];let count=min(heap[style],heap[r+53u]);let chain=heap[style+1u];let flags=heap[style+2u]&3u;
 heap[r+9u]=count;heap[r+45u]=(heap[r+45u]&0xfffffffeu)|select(0u,1u,heap[r+56u]==1u||(heap[r+56u]==0u&&(flags&1u)==0u));
 for(var j=0u;j<count;j++){let face=heap[chain+j];for(var k=0u;k<heap[catalog];k++){let entry=catalog+1u+k*5u;if(heap[entry]==face){heap[heap[r+10u]+j]=face;heap[heap[r+11u]+j]=heap[entry+1u+flags];break;}}}
 let p=pgData(r);heap[p+3u]=heap[style+3u];heap[p+2u]=heap[style+4u];heap[p+6u]++;heap[r+36u]++;
}
fn uiSyncText(r:u32){
 let src=heap[r+63u];if(heap[src+1u]==2u&&!uiGridSource(r)){return;}let i=heap[src];let kind=nodes[i].info.x;
 if(heap[src+1u]==0u&&kind!=5u&&kind!=6u&&kind!=7u&&kind!=9u&&kind!=21u&&kind!=36u){return;}
 uiSyncFont(r,i);var offset=heap[src+2u];var count=heap[src+3u];
 if(heap[src+1u]==0u){offset=nodes[i].text.z;count=textLength(i);}
 if(count>heap[r+39u]){heap[r+18u]=1u;heap[r+47u]=0u;heap[r+5u]=0xffffffffu;overflow(128u);return;}
 var changed=count!=heap[r+3u]||heap[r+5u]==0xffffffffu;
 // Exact compare, no probabilistic hash. TextBox overwrites of equal length and
 // template aliases cannot evade invalidation. Immutable scalar data stays on GPU.
 for(var j=0u;j<count;j++){let value=heap[offset+j];if(heap[heap[r+2u]+j]!=value){changed=true;}heap[heap[r+2u]+j]=value;}
 if(changed){heap[r+3u]=count;heap[r+4u]++;}
 let revision=heap[r+19u];let oldWidth=hf(r+23u);let oldAscent=hf(r+34u);let oldDescent=hf(r+35u);shapeRun(r);if(heap[r+18u]!=0u){overflow(128u);}
 if(heap[r+19u]!=revision&&nodes[templateContentOwner(i)].info.x!=9u&&nodes[i].info.x!=11u&&(oldWidth!=hf(r+23u)||oldAscent!=hf(r+34u)||oldDescent!=hf(r+35u))){atomicStore(&scratch[8],1u);}
}
fn uiParagraph(r:u32,size:f32,width:f32,wrapping:bool,alignment:u32){
 let p=pgData(r);var changed=false;
 let params=array<u32,2>(bitcast<u32>(max(0.0,width)),bitcast<u32>(size));
 for(var j=0u;j<2u;j++){if(heap[p+j]!=params[j]){heap[p+j]=params[j];changed=true;}}
 let wrap=select(0u,1u,wrapping);if(heap[p+5u]!=wrap){heap[p+5u]=wrap;changed=true;}
 if(heap[p+4u]!=alignment){heap[p+4u]=alignment;changed=true;}if(changed){heap[p+6u]++;}layoutRun(r);
}
@compute @workgroup_size(32)
fn shapeTextRuns(@builtin(global_invocation_id) id:vec3<u32>){if(heap[3]!=0x48545931u||id.x>=heap[1]){return;}let r=heap[heap[0]+id.x];if(heap[heap[r+63u]+1u]!=2u&&visible(heap[heap[r+63u]])){uiSyncText(r);}}
@compute @workgroup_size(32)
fn layoutTextRuns(@builtin(global_invocation_id) id:vec3<u32>){
 if(heap[3]!=0x48545931u||id.x>=heap[1]){return;}let r=heap[heap[0]+id.x];let src=heap[r+63u];let i=heap[src];let n=nodes[i];if(!visible(i)){return;}
 if(heap[src+1u]==2u){if(!uiGridSource(r)){return;}uiSyncText(r);}
 let p=pgData(r);var size=n.misc.z;var width=0.0;var wrapping=false;var alignment=heap[p+19u];
 if(heap[src+1u]==1u){size=hf(src+4u);alignment=0u;}else if(heap[src+1u]>=2u){size=select(n.misc.z,max(1.0,n.misc.z-.5),heap[src+1u]==3u);alignment=0u;}else if(n.info.x==5u||n.info.x==21u){width=contentRect(n).z;wrapping=(n.text.y&4u)!=0u;}else{alignment=0u;}
 // Parent font-size TemplateBindings are live; fixed drawing commands use their
 // authored size. Resizing/reflow does not execute GSUB/GPOS again.
 uiParagraph(r,size,width,wrapping,alignment);
}
fn uiTextWidth(r:u32,size:f32)->f32{
 let p=pgData(r);var width=0.0;var maximum=0.0;
 for(var j=0u;j<heap[r+7u];){let end=pgClusterEnd(r,j);if(pgHard(heap[shGlyph(r,j)+3u])){maximum=max(maximum,width);width=0.0;}else{width+=pgClusterWidthSized(r,p,j,end,width,size);}j=end;}
 return max(maximum,width);
}
fn uiCaretAffinity(r:u32,scalar:u32,size:f32,affinity:u32)->f32{
 let p=pgData(r);let at=heap[p+12u]+min(scalar,heap[r+3u])*4u+min(affinity,1u)*2u;return hf(at)*size/max(0.001,hf(p+1u));
}
fn uiCaret(r:u32,scalar:u32,size:f32)->f32{return uiCaretAffinity(r,scalar,size,0u);}
fn uiSelectMove(i:u32,caret:u32,forward:bool)->u32{
 let offset=nodes[i].text.z;let count=textLength(i);let r=uiTextRun(i,offset,count);
 if(r==0u){return select(previousTextCluster(offset,count,caret),nextTextCluster(offset,count,caret),forward);}
 uiSyncText(r);uiParagraph(r,nodes[i].misc.z,0.0,false,0u);let p=pgData(r);if(heap[p+17u]==0u){return caret;}
 let owner=templateContentOwner(i);let slot=cs(owner)+7u;let current=uiCaretAffinity(r,caret,nodes[i].misc.z,state[slot]);var best=caret;var distance=1e30;
 var chosen=state[slot];
 for(var c=0u;c<=count;c++){if(heap[heap[r+21u]+c]==0u){continue;}for(var affinity=0u;affinity<2u;affinity++){
  let x=uiCaretAffinity(r,c,nodes[i].misc.z,affinity);let delta=select(current-x,x-current,forward);if(delta>0.001&&delta<distance){distance=delta;best=c;chosen=affinity;}
 }}state[slot]=chosen;return best;
}
