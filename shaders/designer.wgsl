// GPU authoring subsystem. One mutable document owner per retained surface.
// Core Node layout/text/rendering is reused; this is not a screenshot renderer.
const DS_RECORD:u32=96u;
const DS_NAME:u32=64u;
const DS_TEXT:u32=512u;
const DS_TRACK:u32=52u;
const DS_KEYS:u32=12u;
const DS_STATE:u32=12u;
fn dsOwner(i:u32)->u32 {
 if((VIEW_FEATURES&32u)==0u||i==NONE||i>=frame.counts.x){return 0u;}
 let n=nodes[i];if(n.info.x>=30u&&n.info.x<=35u){return n.aux.x;}
 let e=extension(n);if(e!=0u){return heap[e+34u];}return 0u;
}
fn dsSlot(d:u32,i:u32)->u32 {if(d==0u||i<heap[d+2u]||i>=heap[d+2u]+heap[d+1u]){return NONE;}return i-heap[d+2u];}
fn dsNode(d:u32,k:u32)->u32{return heap[d+2u]+k;}
fn dsData(d:u32)->u32{return heap[d+5u];}
fn dsRec(d:u32,k:u32)->u32{return dsData(d)+heap[d+64u]+k*DS_RECORD;}
fn dsBefore(d:u32,k:u32)->u32{return heap[d+30u]+heap[d+64u]+k*DS_RECORD;}
fn dsName(d:u32,k:u32)->u32{return dsData(d)+heap[d+65u]+k*DS_NAME;}
fn dsText(d:u32,k:u32)->u32{return dsData(d)+heap[d+66u]+k*DS_TEXT;}
fn dsTrack(d:u32,k:u32,t:u32)->u32{return dsData(d)+heap[d+67u]+(k*6u+t)*DS_TRACK;}
fn dsSelected(d:u32,k:u32)->bool{return k<heap[d+1u]&&heap[heap[d+11u]+k]!=0u&&heap[dsRec(d,k)]!=0u;}
fn dsAlive(d:u32,k:u32)->bool{return k<heap[d+1u]&&heap[dsRec(d,k)]!=0u;}
fn dsSingleChild(kind:u32)->bool{return kind==4u||kind==13u||kind==18u||kind==20u;}
fn dsCanParent(d:u32,parent:u32,moving:u32)->bool{if(!dsAlive(d,parent)||!dsContainer(heap[dsRec(d,parent)+1u])){return false;}if(dsSingleChild(heap[dsRec(d,parent)+1u])){for(var k=1u;k<heap[d+1u];k++){if(k!=moving&&dsAlive(d,k)&&heap[dsRec(d,k)+2u]==parent){return false;}}}return true;}
fn dsLocked(d:u32,k:u32)->bool{var parent=k;for(var depth=0u;depth<18u&&parent!=NONE;depth++){if((heap[dsRec(d,parent)+4u]&2u)!=0u){return true;}parent=heap[dsRec(d,parent)+2u];}return false;}
fn dsContainer(kind:u32)->bool{return kind==1u||kind==2u||kind==3u||kind==4u||kind==13u||kind==14u||kind==15u||kind==16u||kind==17u||kind==18u||kind==20u;}
fn dsAllowed(kind:u32)->bool {
 // WGSL does not give && implicit precedence over ||.
 return (kind >= 1u && kind <= 18u && kind != 11u) || kind == 20u;
}
fn dsStateBit(field:u32)->u32 {switch field{case 25u:{return 0u;}case 29u:{return 1u;}case 30u:{return 2u;}case 27u:{return 3u;}case 28u:{return 4u;}case 26u:{return 5u;}case 32u:{return 6u;}case 31u:{return 7u;}case 33u:{return 8u;}default:{return NONE;}}}
fn dsTrackField(track:u32)->u32 {switch track{case 0u:{return 25u;}case 1u:{return 29u;}case 2u:{return 30u;}case 3u:{return 27u;}case 4u:{return 28u;}default:{return 26u;}}}
fn dsCurrentValue(d:u32,k:u32,t:u32)->f32{let offset=select(select(t+7u,3u,t==0u),12u,t==5u);return sf(cs(dsNode(d,k))+offset);}
fn dsStateAt(d:u32,k:u32,s:u32)->u32{return dsData(d)+heap[d+68u]+(s*heap[d+1u]+k)*DS_STATE;}
fn dsRead(d:u32,k:u32,field:u32)->u32 {if(k==0u&&(field==10u||field==11u)){return heap[dsData(d)+field-10u];}let bit=dsStateBit(field);if(bit!=NONE&&heap[d+70u]!=0u){let at=dsStateAt(d,k,heap[d+70u]);if((heap[at]&(1u<<bit))!=0u){return heap[at+1u+bit];}}return heap[dsRec(d,k)+field];}
fn dsIntegerField(field:u32)->bool {return (field>=34u&&field<=49u)||field==85u||field==86u||field==88u||field==91u||field==92u;}
fn dsNumber(d:u32,k:u32,field:u32)->f32{return bitcast<f32>(dsRead(d,k,field));}
fn dsReject(d:u32,code:u32){heap[d+54u]=code;heap[d+55u]++;}
fn dsSelect(d:u32,k:u32,add:bool){if(k!=NONE&&!dsAlive(d,k)){return;}if(!add){for(var j=0u;j<heap[d+1u];j++){heap[heap[d+11u]+j]=0u;}}
 if(k!=NONE){let at=heap[d+11u]+k;heap[at]=select(1u,1u-heap[at],add);heap[d+9u]=k;}
 var count=0u;var last=NONE;for(var j=0u;j<heap[d+1u];j++){if(dsSelected(d,j)){count++;last=j;}}heap[d+10u]=count;if(count==0u||!dsSelected(d,heap[d+9u])){heap[d+9u]=last;}
}
fn dsTopSelected(d:u32,k:u32)->bool{if(!dsSelected(d,k)||k==0u){return false;}var p=heap[dsRec(d,k)+2u];for(var depth=0u;depth<17u&&p!=NONE;depth++){if(dsSelected(d,p)){return false;}p=heap[dsRec(d,p)+2u];}return true;}
fn dsDescendant(d:u32,k:u32,parent:u32)->bool{var p=k;for(var depth=0u;depth<18u&&p!=NONE;depth++){if(p==parent){return true;}p=heap[dsRec(d,p)+2u];}return false;}
fn dsBegin(d:u32){if(heap[d+32u]!=0u){return;}for(var j=0u;j<heap[d+29u];j++){heap[heap[d+30u]+j]=heap[dsData(d)+j];}heap[d+32u]=1u;heap[d+24u]=0u;heap[d+54u]=0u;}
fn dsPutKey(d:u32,k:u32,t:u32,time:f32,value:f32,easing:u32)->bool{
 if(!dsAlive(d,k)||t>=6u||!(abs(time)<=3600.0&&abs(value)<=10000000.0)||(t==0u&&(value<0.0||value>1.0))||((t==3u||t==4u)&&(value<.001||value>64.0))){dsReject(d,2u);return false;}let at=dsTrack(d,k,t);var count=heap[at];let clock=clamp(time,0.0,hf(dsData(d)+2u));var position=0u;
 while(position<count&&hf(at+4u+position*4u)<clock-.0001){position++;}
 if(position<count&&abs(hf(at+4u+position*4u)-clock)<.0001){hsetf(at+5u+position*4u,value);heap[at+6u+position*4u]=min(8u,easing);return true;}
 if(count>=DS_KEYS){dsReject(d,4u);return false;}for(var j=count;j>position;j--){for(var w=0u;w<4u;w++){heap[at+4u+j*4u+w]=heap[at+(j-1u)*4u+4u+w];}}
 hsetf(at+4u+position*4u,clock);hsetf(at+5u+position*4u,value);heap[at+6u+position*4u]=min(8u,easing);heap[at+7u+position*4u]=0u;heap[at]=count+1u;return true;
}
fn executeDsCommit(d:u32){if(heap[d+32u]==0u){return;}var changed=false;for(var j=0u;j<heap[d+29u];j++){if(heap[heap[d+30u]+j]!=heap[dsData(d)+j]){changed=true;break;}}
 if(changed&&(heap[d+17u]&32u)!=0u&&heap[d+70u]==0u){for(var k=0u;k<heap[d+1u];k++){if(!dsAlive(d,k)){continue;}for(var t=0u;t<6u;t++){let field=dsTrackField(t);if(heap[dsBefore(d,k)+field]!=heap[dsRec(d,k)+field]){if(heap[dsTrack(d,k,t)]==0u&&hf(d+35u)>.0001){if(!dsPutKey(d,k,t,0.0,hf(dsBefore(d,k)+field),1u)){dsCancel(d);return;}}if(!dsPutKey(d,k,t,hf(d+35u),hf(dsRec(d,k)+field),1u)){dsCancel(d);return;}}}}}
 if(changed&&!dsValidateBlock(d,dsData(d))){dsCancel(d);dsSelect(d,NONE,true);dsReject(d,7u);return;}
 if(changed){var count=heap[d+26u]+1u;let slots=heap[d+27u]+1u;if(count>=slots){heap[d+95u]=(heap[d+95u]+1u)%slots;count--;}
  let destination=heap[d+28u]+((heap[d+95u]+count)%slots)*heap[d+29u];for(var j=0u;j<heap[d+29u];j++){heap[destination+j]=heap[dsData(d)+j];}heap[d+26u]=count;heap[d+25u]=count+1u;heap[d+8u]++;
 }
 heap[d+32u]=0u;heap[d+24u]=0u;
}
fn dsCancel(d:u32){if(heap[d+32u]!=0u){for(var j=0u;j<heap[d+29u];j++){heap[dsData(d)+j]=heap[heap[d+30u]+j];}heap[d+53u]=3u;state[3u]=1u;}heap[d+32u]=0u;heap[d+18u]=0u;heap[d+45u]=NONE;heap[d+75u]=NONE;}
fn dsUndo(d:u32,redo:bool){dsCancel(d);let cursor=heap[d+26u];if((!redo&&cursor==0u)||(redo&&cursor+1u>=heap[d+25u])){return;}let next=select(cursor-1u,cursor+1u,redo);let source=heap[d+28u]+((heap[d+95u]+next)%(heap[d+27u]+1u))*heap[d+29u];for(var j=0u;j<heap[d+29u];j++){heap[dsData(d)+j]=heap[source+j];}heap[d+26u]=next;heap[d+53u]=3u;heap[d+8u]++;heap[d+17u]&=~64u;state[3u]=1u;dsSelect(d,NONE,true);}
fn dsWrite(d:u32,k:u32,field:u32,value:u32){if(heap[d+70u]==0u){var bit=0u;switch(field){case 32u:{bit=1u;}case 31u:{bit=2u;}case 33u:{bit=4u;}case 23u:{bit=8u;}case 24u:{bit=16u;}case 16u:{bit=32u;}default:{}}heap[dsRec(d,k)+95u]&=~bit;}let bit=dsStateBit(field);if(bit!=NONE&&heap[d+70u]!=0u){let at=dsStateAt(d,k,heap[d+70u]);heap[at]|=1u<<bit;heap[at+1u+bit]=value;}else{heap[dsRec(d,k)+field]=value;}heap[d+53u]|=1u;heap[d+24u]=1u;if((field>=8u&&field<=24u)||(field>=34u&&field<=49u)){state[3u]=1u;}}
fn dsSetNumber(d:u32,k:u32,field:u32,value:f32)->bool {
 if(!dsAlive(d,k)||field<8u||field>=93u||field==31u||field==32u||field==33u||field==47u||(field>=50u&&field<=81u)||field==83u||field==84u){return false;}
 if(!(abs(value)<=10000000.0)){return false;}var v=value;
 if((field==10u||field==11u)&&v<0.0&&v!= -1.0){return false;}
 if((field==12u||field==13u||field==16u||field==17u||field==23u||field==24u)&&v<0.0){return false;}
 if ((field == 22u && (v <= 0.0 || v > 1024.0)) ||
     (field == 25u && (v < 0.0 || v > 1.0)) ||
     ((field == 27u || field == 28u) && (v < .001 || v > 64.0))) {
  return false;
 }
 if((field==12u&&v>hf(dsRec(d,k)+14u))||(field==13u&&v>hf(dsRec(d,k)+15u))||(field==14u&&v<hf(dsRec(d,k)+12u))||(field==15u&&v<hf(dsRec(d,k)+13u))){return false;}
 if((field>=34u&&field<=49u)||field==85u||field==86u||field==88u||field==91u||field==92u){
  if((field==86u||field==88u)&&v<0.0){dsWrite(d,k,field,NONE);return true;}if(v<0.0||v!=floor(v)){return false;}
  var limit=8.0;if(field==34u||field==35u||field==42u||field==46u||field==85u){limit=3.0;}if(field==40u||field==41u||field==43u){limit=1.0;}if(field==44u||field==45u){limit=128.0;}if(field==86u||field==88u){limit=f32(heap[d+1u]-1u);if(!dsAlive(d,u32(v))){return false;}}if(field==91u||field==92u){limit=f32(heap[dsData(d)+3u]);}if(v>limit||((field==38u||field==39u||field==48u||field==49u)&&v<1.0)){return false;}
  let parent=heap[dsRec(d,k)+2u];if(parent!=NONE&&heap[dsRec(d,parent)+1u]==1u){let r=dsRec(d,k);let p=dsRec(d,parent);if((field==36u&&u32(v)+heap[r+38u]>heap[p+49u])||
     (field==37u&&u32(v)+heap[r+39u]>heap[p+48u])||
     (field==38u&&heap[r+36u]+u32(v)>heap[p+49u])||
     (field==39u&&heap[r+37u]+u32(v)>heap[p+48u])){return false;}}
  dsWrite(d,k,field,u32(v));return true;
 }
 if(k==0u&&(field==10u||field==11u)){if(v<32.0||v>8192.0){return false;}hsetf(dsData(d)+field-10u,v);}
 dsWrite(d,k,field,bitcast<u32>(v));return true;
}
fn dsSetSelected(d:u32,field:u32,value:f32){dsBegin(d);var ok=true;for(var k=0u;k<heap[d+1u];k++){if(dsSelected(d,k)&&!dsSetNumber(d,k,field,value)){ok=false;break;}}if(!ok){dsCancel(d);dsReject(d,2u);}else{dsCommit(d);}}
fn dsPaintSelected(d:u32,field:u32,color:u32){if(field<31u||field>33u){return;}for(var k=0u;k<heap[d+1u];k++){if(dsSelected(d,k)){dsWrite(d,k,field,color);if(field==31u){heap[dsRec(d,k)+92u]=0u;}if(field==32u){heap[dsRec(d,k)+91u]=0u;}}}heap[d+98u]=field;}
fn dsAvailableSlot(d:u32)->u32 {for(var k=1u;k<heap[d+1u];k++){if(!dsAlive(d,k)){return k;}}return NONE;}
fn dsDefaultName(d:u32,k:u32){
 let name=dsName(d,k);let labelAt=heap[heap[d+41u]+heap[dsRec(d,k)+1u]];let len=min(48u,heap[labelAt]);
 for(var attempt=0u;attempt<=heap[d+1u];attempt++){
  for(var j=0u;j<len;j++){heap[name+j]=heap[labelAt+1u+j];}heap[name+len]=95u;
  var digits:array<u32,8>;var count=0u;var v=k+attempt*heap[d+1u];
  loop{digits[count]=48u+v%10u;count++;v/=10u;if(v==0u){break;}}
  for(var j=0u;j<count;j++){heap[name+len+1u+j]=digits[count-1u-j];}heap[dsRec(d,k)+5u]=len+1u+count;
  var unique=true;for(var other=0u;other<heap[d+1u];other++){
   if(other==k||!dsAlive(d,other)||heap[dsRec(d,other)+5u]!=len+1u+count){continue;}
   var same=true;for(var j=0u;j<len+1u+count;j++){if(heap[dsName(d,other)+j]!=heap[name+j]){same=false;break;}}
   if(same){unique=false;break;}
  }if(unique){return;}
 }
}
fn dsNew(d:u32,kind:u32,parent:u32,shape:u32)->u32 {
 if(!dsAllowed(kind)||!dsCanParent(d,parent,NONE)){dsReject(d,3u);return NONE;}var depth=0u;var ancestor=parent;while(ancestor!=NONE&&depth<18u){depth++;ancestor=heap[dsRec(d,ancestor)+2u];}if(depth>16u){dsReject(d,3u);return NONE;}let k=dsAvailableSlot(d);if(k==NONE){dsReject(d,1u);return NONE;}let r=dsRec(d,k);for(var j=0u;j<DS_RECORD;j++){heap[r+j]=0u;}
 heap[r]=1u;heap[r+1u]=kind;heap[r+2u]=parent;heap[r+93u]=heap[dsRec(d,parent)+93u];var order=0u;for(var j=0u;j<heap[d+1u];j++){if(dsAlive(d,j)&&j!=k&&heap[dsRec(d,j)+2u]==parent){order=max(order,heap[dsRec(d,j)+3u]+1u);}}heap[r+3u]=order;
 hsetf(r+8u,40.0);hsetf(r+9u,40.0);hsetf(r+10u,160.0);hsetf(r+11u,select(44.0,110.0,dsContainer(kind)||kind==12u));hsetf(r+14u,INF);hsetf(r+15u,INF);hsetf(r+22u,16.0);hsetf(r+23u,6.0);hsetf(r+25u,1.0);hsetf(r+27u,1.0);hsetf(r+28u,1.0);heap[r+31u]=0xfff6ebdfu;heap[r+32u]=select(0xff604227u,0u,kind==5u||kind==12u||kind==7u||kind==8u||kind==10u);heap[r+33u]=0xff967853u;heap[r+38u]=1u;heap[r+39u]=1u;heap[r+43u]=1u;heap[r+46u]=2u;heap[r+48u]=1u;heap[r+49u]=1u;heap[r+50u]=2u;heap[r+66u]=2u;hsetf(r+51u,1.0);hsetf(r+67u,1.0);hsetf(r+82u,.4);heap[r+84u]=min(shape,heap[d+43u]-1u);heap[r+86u]=NONE;heap[r+88u]=NONE;hsetf(r+87u,1.0);hsetf(r+89u,1.0);
 for(var t=0u;t<6u;t++){let track=dsTrack(d,k,t);for(var j=0u;j<DS_TRACK;j++){heap[track+j]=0u;}}for(var s=0u;s<4u;s++){let st=dsStateAt(d,k,s);for(var j=0u;j<DS_STATE;j++){heap[st+j]=0u;}}
 dsDefaultName(d,k);let labelAt=heap[heap[d+41u]+kind];let len=min(DS_TEXT,heap[labelAt]);for(var j=0u;j<len;j++){heap[dsText(d,k)+j]=heap[labelAt+1u+j];}heap[r+6u]=select(0u,len,kind==5u||kind==6u||kind==7u||kind==9u);heap[d+53u]=3u;state[3u]=1u;return k;
}
fn dsCopySlot(d:u32,source:u32,dest:u32,base:u32){let r=base+heap[d+64u]+source*DS_RECORD;let destination=dsRec(d,dest);for(var j=0u;j<DS_RECORD;j++){heap[destination+j]=heap[r+j];}for(var j=0u;j<DS_NAME;j++){heap[dsName(d,dest)+j]=heap[base+heap[d+65u]+source*DS_NAME+j];}for(var j=0u;j<DS_TEXT;j++){heap[dsText(d,dest)+j]=heap[base+heap[d+66u]+source*DS_TEXT+j];}for(var j=0u;j<6u*DS_TRACK;j++){heap[dsTrack(d,dest,0u)+j]=heap[base+heap[d+67u]+source*6u*DS_TRACK+j];}for(var s=0u;s<4u;s++){for(var j=0u;j<DS_STATE;j++){heap[dsStateAt(d,dest,s)+j]=heap[base+heap[d+68u]+(s*heap[d+1u]+source)*DS_STATE+j];}}}
fn dsDuplicate(d:u32){var map:array<u32,128>;var copy:array<u32,128>;var count=0u;var free=0u;for(var k=0u;k<heap[d+1u];k++){map[k]=NONE;copy[k]=0u;if(!dsAlive(d,k)){free++;}if(k==0u||!dsAlive(d,k)){continue;}var p=k;for(var depth=0u;depth<18u&&p!=NONE;depth++){if(dsSelected(d,p)){copy[k]=1u;count++;break;}p=heap[dsRec(d,p)+2u];}}
 if(count==0u){return;}if(count>free){dsReject(d,1u);return;}dsBegin(d);var next=1u;for(var k=0u;k<heap[d+1u];k++){if(copy[k]==0u){continue;}while(next<heap[d+1u]&&(dsAlive(d,next)||map[next]!=NONE)){next++;}map[k]=next;dsCopySlot(d,k,next,heap[d+30u]);heap[dsRec(d,next)]=1u;next++;}
 for(var k=0u;k<heap[d+1u];k++){if(copy[k]==0u){continue;}let dest=map[k];let r=dsRec(d,dest);let parent=heap[r+2u];if(parent!=NONE&&map[parent]!=NONE){heap[r+2u]=map[parent];}else{hsetf(r+8u,hf(r+8u)+16.0);hsetf(r+9u,hf(r+9u)+16.0);heap[r+3u]+=heap[d+1u];}if(heap[r+86u]!=NONE&&map[heap[r+86u]]!=NONE){heap[r+86u]=map[heap[r+86u]];}if(heap[r+88u]!=NONE&&map[heap[r+88u]]!=NONE){heap[r+88u]=map[heap[r+88u]];}dsDefaultName(d,dest);}
 var primary=NONE;var tops:array<u32,128>;for(var k=0u;k<heap[d+1u];k++){tops[k]=select(0u,1u,dsTopSelected(d,k));}for(var k=0u;k<heap[d+1u];k++){heap[heap[d+11u]+k]=0u;if(tops[k]!=0u&&map[k]!=NONE){copy[map[k]]=2u;primary=map[k];}}
 for(var k=0u;k<heap[d+1u];k++){heap[heap[d+11u]+k]=select(0u,1u,copy[k]==2u);}heap[d+9u]=primary;dsSelect(d,NONE,true);heap[d+53u]=3u;state[3u]=1u;dsCommit(d);
}
fn dsDelete(d:u32){dsBegin(d);var remove:array<u32,128>;for(var k=0u;k<heap[d+1u];k++){remove[k]=0u;if(k==0u||!dsAlive(d,k)){continue;}var p=k;for(var depth=0u;depth<18u&&p!=NONE;depth++){if(dsSelected(d,p)){remove[k]=1u;break;}p=heap[dsRec(d,p)+2u];}}
 for(var k=0u;k<heap[d+1u];k++){let r=dsRec(d,k);if(remove[k]!=0u){heap[r]=0u;heap[heap[d+11u]+k]=0u;}if(heap[r+86u]!=NONE&&remove[heap[r+86u]]!=0u){heap[r+86u]=NONE;heap[r+85u]=0u;}if(heap[r+88u]!=NONE&&remove[heap[r+88u]]!=0u){heap[r+88u]=NONE;}}
 heap[d+53u]=3u;state[3u]=1u;dsSelect(d,NONE,true);dsCommit(d);
}
fn dsSelectionBounds(d:u32)->vec4<f32>{var lo=vec2<f32>(INF);var hi=vec2<f32>(-INF);for(var k=0u;k<heap[d+1u];k++){if(!dsSelected(d,k)){continue;}let n=nodes[dsNode(d,k)];let bounds=transformedBounds(n.matrix,n.translation.xy,boundsOf(n.rect));lo=min(lo,bounds.xy);hi=max(hi,bounds.zw);}if(heap[d+10u]==0u){return vec4<f32>(0.0);}return vec4<f32>(lo,hi);}
fn dsReparent(d:u32,k:u32,parent:u32,order:u32)->bool {if(k==0u||!dsAlive(d,k)||!dsCanParent(d,parent,k)||dsDescendant(d,parent,k)){dsReject(d,3u);return false;}
 var depth=0u;var p=parent;while(p!=NONE&&depth<18u){depth++;p=heap[dsRec(d,p)+2u];}var subtree=0u;for(var c=0u;c<heap[d+1u];c++){if(!dsAlive(d,c)){continue;}var cp=c;var cd=0u;while(cp!=NONE&&cd<18u){if(cp==k){subtree=max(subtree,cd);break;}cp=heap[dsRec(d,cp)+2u];cd++;}}if(depth+subtree>16u){dsReject(d,3u);return false;}
 let pn=nodes[dsNode(d,parent)];let n=nodes[dsNode(d,k)];let point=inverse(pn.matrix,pn.translation.xy,transform(n.matrix,n.translation.xy,n.rect.xy));let r=dsRec(d,k);
 if(heap[dsRec(d,parent)+1u]==3u){hsetf(r+8u,point.x-contentRect(pn).x);hsetf(r+9u,point.y-contentRect(pn).y);hsetf(r+29u,0.0);hsetf(r+30u,0.0);}else{heap[r+36u]=0u;heap[r+37u]=0u;heap[r+38u]=1u;heap[r+39u]=1u;}
 for(var c=1u;c<heap[d+1u];c++){let a=dsRec(d,c);if(dsAlive(d,c)&&c!=k&&heap[a+2u]==parent&&heap[a+3u]>=order){heap[a+3u]++;}}heap[r+2u]=parent;heap[r+3u]=order;heap[d+53u]=3u;state[3u]=1u;return true;
}
fn dsGroup(d:u32,ungroup:bool){let primary=heap[d+9u];if(primary==NONE||primary==0u){return;}let r=dsRec(d,primary);let parent=heap[r+2u];if(parent==NONE||heap[dsRec(d,parent)+1u]!=3u){dsReject(d,5u);return;}dsBegin(d);
 if(ungroup){if(heap[r+1u]!=3u||abs(hf(r+26u))>.0001||abs(hf(r+27u)-1.0)>.0001||abs(hf(r+28u)-1.0)>.0001||abs(hf(r+25u)-1.0)>.0001||(heap[r+32u]>>24u)!=0u||hf(r+24u)!=0.0||heap[r+85u]!=0u||heap[r+88u]!=NONE){dsCancel(d);dsReject(d,5u);return;}for(var c=1u;c<heap[d+1u];c++){let a=dsRec(d,c);if(dsAlive(d,c)&&heap[a+2u]==primary){heap[a+2u]=parent;hsetf(a+8u,hf(a+8u)+hf(r+8u)+hf(r+16u)+hf(r+18u)+hf(r+29u));hsetf(a+9u,hf(a+9u)+hf(r+9u)+hf(r+16u)+hf(r+19u)+hf(r+30u));heap[a+3u]+=heap[r+3u];}}heap[r]=0u;dsSelect(d,NONE,false);}
 else{var lo=vec2<f32>(INF);var hi=vec2<f32>(-INF);for(var c=1u;c<heap[d+1u];c++){if(!dsTopSelected(d,c)){continue;}let a=dsRec(d,c);if(heap[a+2u]!=parent){dsCancel(d);dsReject(d,5u);return;}let n=nodes[dsNode(d,c)];let xy=vec2<f32>(hf(a+8u),hf(a+9u));lo=min(lo,xy);hi=max(hi,xy+n.rect.zw);}let group=dsNew(d,3u,parent,0u);if(group==NONE){dsCancel(d);return;}let g=dsRec(d,group);hsetf(g+8u,lo.x);hsetf(g+9u,lo.y);hsetf(g+10u,hi.x-lo.x);hsetf(g+11u,hi.y-lo.y);heap[g+32u]=0u;heap[g+4u]|=16u;for(var c=1u;c<heap[d+1u];c++){if(c==group||!dsTopSelected(d,c)){continue;}let a=dsRec(d,c);heap[a+2u]=group;hsetf(a+8u,hf(a+8u)-lo.x);hsetf(a+9u,hf(a+9u)-lo.y);}dsSelect(d,group,false);}
 heap[d+53u]=3u;state[3u]=1u;dsCommit(d);
}
fn dsAlign(d:u32,mode:u32,distribute:bool){if(heap[d+10u]<2u){return;}var chosen:array<u32,128>;var count=0u;var parent=NONE;var lo=vec2<f32>(INF);var hi=vec2<f32>(-INF);var sum=0.0;let axis=select(mode/3u,mode,distribute);
 for(var k=1u;k<heap[d+1u];k++){if(!dsTopSelected(d,k)){continue;}let r=dsRec(d,k);if(parent==NONE){parent=heap[r+2u];}if(heap[r+2u]!=parent||heap[dsRec(d,parent)+1u]!=3u){dsReject(d,5u);return;}let point=vec2<f32>(hf(r+8u),hf(r+9u));let size=nodes[dsNode(d,k)].rect.zw;lo=min(lo,point);hi=max(hi,point+size);sum+=size[min(1u,axis)];chosen[count]=k;count++;}if(count<2u){return;}dsBegin(d);
 if(distribute){for(var j=1u;j<count;j++){let item=chosen[j];var at=j;while(at>0u&&hf(dsRec(d,chosen[at-1u])+8u+axis)>hf(dsRec(d,item)+8u+axis)){chosen[at]=chosen[at-1u];at--;}chosen[at]=item;}let gap=(hi[axis]-lo[axis]-sum)/f32(count-1u);var cursor=lo[axis];for(var j=0u;j<count;j++){hsetf(dsRec(d,chosen[j])+8u+axis,cursor);cursor+=nodes[dsNode(d,chosen[j])].rect[axis+2u]+gap;}}
 else{let side=mode%3u;for(var j=0u;j<count;j++){let k=chosen[j];let size=nodes[dsNode(d,k)].rect[axis+2u];var value=lo[axis];if(side==1u){value=(lo[axis]+hi[axis]-size)*.5;}if(side==2u){value=hi[axis]-size;}hsetf(dsRec(d,k)+8u+axis,value);}}
 heap[d+53u]=1u;state[3u]=1u;dsCommit(d);
}
fn dsTopology(d:u32){let count=heap[d+1u];let first=heap[d+2u];let host=heap[d+3u];for(var k=0u;k<count;k++){let r=dsRec(d,k);let i=first+k;nodes[i].info.z=heap[heap[d+60u]+k*8u];nodes[i].info.y=host;nodes[i].info.w=0u;nodes[i].text.x=nodes[host].text.x+1u;let parent=heap[r+2u];if(k>0u&&heap[r]!=0u&&parent<count&&dsAlive(d,parent)){nodes[i].info.y=first+parent;var depth=1u;var p=parent;for(var j=0u;j<17u&&p!=NONE;j++){depth++;p=heap[dsRec(d,p)+2u];}nodes[i].text.x=nodes[host].text.x+depth;}}
 for(var p=0u;p<count;p++){if(!dsAlive(d,p)){continue;}var children:array<u32,128>;var length=0u;for(var k=1u;k<count;k++){if(!dsAlive(d,k)||heap[dsRec(d,k)+2u]!=p){continue;}var at=length;while(at>0u&&heap[dsRec(d,children[at-1u])+3u]>heap[dsRec(d,k)+3u]){children[at]=children[at-1u];at--;}children[at]=k;length++;}for(var j=0u;j<length;j++){heap[nodes[first+p].info.z+j]=first+children[j];heap[dsRec(d,children[j])+3u]=j;}nodes[first+p].info.w=length;}
 var stack:array<u32,128>;var top=1u;stack[0]=0u;var rank=0u;loop{if(top==0u||rank>=count){break;}top--;let k=stack[top];heap[heap[d+56u]+rank]=k;heap[heap[d+57u]+k]=rank;rank++;let n=nodes[first+k];for(var j=n.info.w;j>0u;j--){if(top<count){stack[top]=child(n,j-1u)-first;top++;}}}heap[d+58u]=rank;for(var k=0u;k<count;k++){if(!dsAlive(d,k)){heap[heap[d+57u]+k]=rank;heap[heap[d+56u]+rank]=k;rank++;}}
}
fn dsNative(d:u32,k:u32){let i=dsNode(d,k);let r=dsRec(d,k);let n=heap[d+60u]+k*8u;let e=heap[n+3u];let kind=heap[r+1u];var flags=8u;if(kind==6u||kind==7u||kind==8u||kind==9u||kind==13u){flags|=1u;}if(heap[r+40u]!=0u){flags|=2u;}if(heap[r+41u]!=0u){flags|=4u;}if((heap[r+4u]&1u)!=0u||heap[r]==0u){flags|=32u;}if((heap[r+4u]&8u)!=0u){flags|=16u;}if((heap[r+4u]&16u)!=0u){flags&=~8u;}
 nodes[i].info.x=select(kind,3u,heap[r]==0u);nodes[i].text.y=flags;nodes[i].text.z=dsText(d,k);if(kind==9u&&(heap[d+17u]&16u)!=0u){let inputText=heap[n+6u];for(var j=0u;j<heap[r+6u];j++){heap[inputText+j]=heap[dsText(d,k)+j];}nodes[i].text.z=inputText;}nodes[i].text.w=heap[r+6u];nodes[i].size=vec4<f32>(hf(r+10u),hf(r+11u),hf(r+12u),hf(r+13u));if(k==0u){nodes[i].size=vec4<f32>(hf(dsData(d)),hf(dsData(d)+1u),0.0,0.0);}
 nodes[i].limits=vec4<f32>(hf(r+14u),hf(r+15u),hf(r+16u),hf(r+17u));nodes[i].margin=vec4<f32>(hf(r+18u),hf(r+19u),hf(r+20u),hf(r+21u));nodes[i].paint=vec4<u32>(dsRead(d,k,32u),dsRead(d,k,31u),dsRead(d,k,33u),heap[r+23u]);nodes[i].placement=vec4<u32>(heap[r+34u],heap[r+35u],heap[r+37u],heap[r+36u]);nodes[i].misc=vec4<f32>(hf(r+8u),hf(r+9u),hf(r+22u),hf(r+24u));nodes[i].config=vec4<f32>(f32(heap[r+39u]),f32(heap[r+38u]),-1.0,f32(e));nodes[i].aux.w=heap[heap[d+60u]+min(heap[r+93u],heap[d+1u]-1u)*8u+4u];nodes[i].aux.x=select(DS_TEXT,heap[heap[d+42u]+min(heap[r+84u],heap[d+43u]-1u)],kind==12u);
 nodes[i].tracks=vec4<u32>(heap[n+1u],max(1u,heap[r+48u]),heap[n+2u],max(1u,heap[r+49u]));for(var axis=0u;axis<2u;axis++){let source=r+50u+axis*16u;let dest=heap[n+1u+axis];for(var t=0u;t<8u;t++){heap[dest+t*4u]=heap[source+t*2u];heap[dest+t*4u+1u]=heap[source+t*2u+1u];}}
 heap[e+1u]&=~1u;heap[e+2u]=heap[r+42u];heap[e+3u]=heap[r+43u];heap[e+4u]=heap[r+44u];heap[e+5u]=heap[r+45u];heap[e+7u]=heap[r+46u];heap[e+28u]=heap[r+17u];heap[e+29u]=heap[r+17u];
 let s=cs(i);state[s]=heap[r+82u];state[s+3u]=dsRead(d,k,25u);state[s+8u]=dsRead(d,k,29u);state[s+9u]=dsRead(d,k,30u);state[s+10u]=dsRead(d,k,27u);state[s+11u]=dsRead(d,k,28u);state[s+12u]=dsRead(d,k,26u);state[s+4u]=heap[r+6u];state[s+5u]=min(state[s+5u],heap[r+6u]);state[s+6u]=min(state[s+6u],heap[r+6u]);
 let source=heap[r+88u];nodes[i].bind=vec4<u32>(NONE,0u,bitcast<u32>(1.0),0u);if(source!=NONE&&dsAlive(d,source)){nodes[i].bind=vec4<u32>(dsNode(d,source),1u,heap[r+89u],heap[r+90u]);}let destination=heap[r+86u];nodes[i].action=vec4<u32>(heap[r+85u],select(i,dsNode(d,destination),destination!=NONE&&dsAlive(d,destination)),heap[r+87u],0u);
}
@compute @workgroup_size(64)
fn synchronizeDesigners(@builtin(global_invocation_id) id:vec3<u32>){let i=id.x;if(i>=frame.counts.x||nodes[i].info.x!=30u){return;}let d=nodes[i].aux.x;if(d==0u){return;}
 let now=frame.viewport.w;if(heap[d+72u]!=0u&&now-hf(d+71u)>=.18){heap[d+72u]=0u;}let step=clamp(now-hf(d+37u),0.0,.1);hsetf(d+37u,now);if((heap[d+17u]&64u)!=0u){let duration=hf(dsData(d)+2u);var clock=hf(d+35u)+step;if(clock>duration){if((heap[d+17u]&128u)!=0u){clock=clock-floor(clock/duration)*duration;}else{clock=duration;heap[d+17u]&=~64u;}}hsetf(d+35u,clock);}
 if(heap[d+53u]!=0u){if((heap[d+53u]&2u)!=0u){dsTopology(d);}for(var k=0u;k<heap[d+1u];k++){dsNative(d,k);}heap[d+53u]=0u;}
}
fn dsMixColor(a:u32,b:u32,t:f32)->u32{var value=0u;for(var channel=0u;channel<4u;channel++){let x=f32((a>>(8u*channel))&255u);let y=f32((b>>(8u*channel))&255u);value|=u32(round(mix(x,y,t)))<<(8u*channel);}return value;}
fn dsSample(d:u32,k:u32,t:u32,time:f32,fallback:f32)->f32{let at=dsTrack(d,k,t);let count=heap[at];if(count==0u){return fallback;}if(time<=hf(at+4u)){return hf(at+5u);}for(var j=1u;j<count;j++){let right=at+4u+j*4u;let left=right-4u;if(time<=hf(right)){let phase=clamp((time-hf(left))/max(.00001,hf(right)-hf(left)),0.0,1.0);return mix(hf(left+1u),hf(right+1u),eased(phase,heap[right+2u]));}}return hf(at+5u+(count-1u)*4u);}
@compute @workgroup_size(64)
fn animateDesigners(@builtin(global_invocation_id) id:vec3<u32>){let i=id.x;if(i>=frame.counts.x){return;}let d=dsOwner(i);let k=dsSlot(d,i);if(k==NONE||!dsAlive(d,k)){return;}let r=dsRec(d,k);let s=cs(i);
 for(var t=0u;t<6u;t++){let field=dsTrackField(t);let offset=select(select(t+7u,3u,t==0u),12u,t==5u);var value=dsNumber(d,k,field);if(heap[d+70u]==0u&&heap[d+18u]==0u&&heap[d+32u]==0u){value=dsSample(d,k,t,hf(d+35u),value);}if(heap[d+72u]!=0u){let phase=clamp((frame.viewport.w-hf(d+71u))/.18,0.0,1.0);value=mix(hf(heap[d+96u]+k*12u+t),value,phase*phase*(3.0-2.0*phase));}setf(s+offset,value);}
 var bg=dsRead(d,k,32u);var fg=dsRead(d,k,31u);let br=dsRead(d,k,33u);let resourceCount=heap[dsData(d)+3u];let b=heap[r+91u];let f=heap[r+92u];if(b>0u&&b<=resourceCount&&(heap[d+70u]==0u||(heap[dsStateAt(d,k,heap[d+70u])]&64u)==0u)){bg=heap[dsData(d)+64u+(b-1u)*68u];}if(f>0u&&f<=resourceCount&&(heap[d+70u]==0u||(heap[dsStateAt(d,k,heap[d+70u])]&128u)==0u)){fg=heap[dsData(d)+64u+(f-1u)*68u];}var border=br;if(heap[d+72u]!=0u){let phase=clamp((frame.viewport.w-hf(d+71u))/.18,0.0,1.0);let a=heap[d+96u]+k*12u;bg=dsMixColor(heap[a+6u],bg,phase);fg=dsMixColor(heap[a+7u],fg,phase);border=dsMixColor(heap[a+8u],border,phase);}nodes[i].paint.x=bg;nodes[i].paint.y=fg;nodes[i].paint.z=border;
}
// Design coordinates live in the real node tree. Only the artboard-root parent
// transform maps design units into the editor viewport; all descendants inherit it.
fn dsViewportOrigin(d:u32)->vec2<f32>{let n=nodes[heap[d+3u]];return contentRect(n).xy+vec2<f32>(hf(d+14u),hf(d+15u));}
fn dsWorld(d:u32,screen:vec2<f32>)->vec2<f32>{let n=nodes[heap[d+3u]];return(inverse(n.matrix,n.translation.xy,screen)-dsViewportOrigin(d))/hf(d+13u);}
fn dsHit(d:u32,point:vec2<f32>,cycle:u32)->u32{var hits:array<u32,128>;var count=0u;for(var rank=heap[d+58u];rank>0u;rank--){let k=heap[heap[d+56u]+rank-1u];if(k==0u){continue;}let n=nodes[dsNode(d,k)];if(!visible(dsNode(d,k))||n.translation.z<=.001||dsLocked(d,k)){continue;}let local=inverse(n.matrix,n.translation.xy,point);if(contains(n.clip,point)&&contains(boundsOf(n.rect),local)){hits[count]=k;count++;}}
 if(count==0u){return NONE;}return hits[cycle%count];}
fn dsCanHit(i:u32)->bool{let d=dsOwner(i);let k=dsSlot(d,i);return (k==NONE&&templateLink(i)==0u)||d==0u||(heap[d+17u]&16u)!=0u;}
fn dsRank(i:u32)->u32{let d=dsOwner(i);let k=dsSlot(d,i);if(k==NONE){return i;}return heap[d+2u]+heap[heap[d+57u]+k];}
fn dsZoom(d:u32,next:f32,point:vec2<f32>){let z=clamp(next,.1,8.0);let n=nodes[heap[d+3u]];let local=inverse(n.matrix,n.translation.xy,point)-contentRect(n).xy;let old=hf(d+13u);let pan=vec2<f32>(hf(d+14u),hf(d+15u));let adjusted=local-(local-pan)*(z/old);hsetf(d+14u,adjusted.x);hsetf(d+15u,adjusted.y);hsetf(d+13u,z);}
fn dsFit(d:u32){let r=contentRect(nodes[heap[d+3u]]);let size=vec2<f32>(hf(dsData(d)),hf(dsData(d)+1u));let z=clamp(min(max(1.0,r.z-80.0)/size.x,max(1.0,r.w-80.0)/size.y),.1,8.0);hsetf(d+13u,z);hsetf(d+14u,(r.z-size.x*z)*.5);hsetf(d+15u,(r.w-size.y*z)*.5);}
fn dsFormat(d:u32,value:f32){let at=heap[d+46u];var n=0u;var v=abs(value);if(value<0.0){heap[at+n]=45u;n++;}var integer=u32(min(99999999.0,floor(v)));let roundedFraction=u32(round(fract(v)*10000.0));if(roundedFraction==10000u){integer++;}var digits:array<u32,12>;var count=0u;var q=integer;loop{digits[count]=48u+q%10u;count++;q/=10u;if(q==0u){break;}}for(var j=0u;j<count;j++){heap[at+n]=digits[count-j-1u];n++;}var fraction=roundedFraction%10000u;if(fraction>0u&&fraction<10000u){heap[at+n]=46u;n++;var divisor=1000u;for(var j=0u;j<4u;j++){heap[at+n]=48u+(fraction/divisor)%10u;n++;divisor/=10u;}while(n>0u&&heap[at+n-1u]==48u){n--;}}heap[d+47u]=n;}
fn dsFormatColor(d:u32,value:u32){let at=heap[d+46u];heap[at]=35u;for(var j=0u;j<8u;j++){let byte=(value>>(8u*(j/2u)))&255u;let digit=select(byte&15u,byte>>4u,j%2u==0u);heap[at+1u+j]=select(48u+digit,87u+digit,digit>9u);}heap[d+47u]=9u;}
fn dsParseNumber(d:u32)->vec2<f32>{let at=heap[d+46u];let len=heap[d+47u];if(len==0u){return vec2<f32>(0.0);}if(len==4u&&heap[at]==97u&&heap[at+1u]==117u&&heap[at+2u]==116u&&heap[at+3u]==111u){return vec2<f32>(1.0,-1.0);}var sign=1.0;var pos=0u;if(heap[at]==45u){sign=-1.0;pos++;}else if(heap[at]==43u){pos++;}var value=0.0;var factor=1.0;var dot=false;var digits=0u;for(var j=pos;j<len;j++){let cp=heap[at+j];if(cp==46u&&!dot){dot=true;continue;}if(cp<48u||cp>57u){return vec2<f32>(0.0);}digits++;if(dot){factor*=.1;value+=f32(cp-48u)*factor;}else{value=value*10.0+f32(cp-48u);}if(value>10000000.0){return vec2<f32>(0.0);}}if(digits==0u){return vec2<f32>(0.0);}return vec2<f32>(1.0,value*sign);}
fn dsHexDigit(cp:u32)->u32{if(cp>=48u&&cp<=57u){return cp-48u;}if(cp>=65u&&cp<=70u){return cp-55u;}if(cp>=97u&&cp<=102u){return cp-87u;}return NONE;}
fn dsParseColor(d:u32)->vec2<u32>{let at=heap[d+46u];let len=heap[d+47u];if(heap[at]!=35u||(len!=4u&&len!=5u&&len!=7u&&len!=9u)){return vec2<u32>(0u);}var packed=0xff000000u;let channels=select(select(3u,4u,len==9u),select(3u,4u,len==5u),len<=5u);for(var j=0u;j<channels;j++){var byte=0u;if(len<=5u){let digit=dsHexDigit(heap[at+j+1u]);if(digit==NONE){return vec2<u32>(0u);}byte=digit*17u;}else{let a=dsHexDigit(heap[at+1u+j*2u]);let b=dsHexDigit(heap[at+2u+j*2u]);if(a==NONE||b==NONE){return vec2<u32>(0u);}byte=a*16u+b;}packed=(packed&~(255u<<(8u*j)))|(byte<<(8u*j));}return vec2<u32>(1u,packed);}
fn dsNameTaken(d:u32,k:u32)->bool{for(var j=0u;j<heap[d+1u];j++){if(j==k||!dsAlive(d,j)||heap[dsRec(d,j)+5u]!=heap[d+47u]){continue;}var same=true;for(var c=0u;c<heap[d+47u];c++){if(heap[dsName(d,j)+c]!=heap[heap[d+46u]+c]){same=false;break;}}if(same){return true;}}return false;}
fn dsStartEdit(d:u32,k:u32,field:u32){if(k==NONE||!dsAlive(d,k)){return;}dsBegin(d);heap[d+45u]=field;heap[d+50u]=k;let r=dsRec(d,k);let at=heap[d+46u];
 if(field==5u||field==6u){let src=select(dsName(d,k),dsText(d,k),field==6u);let len=heap[r+field];for(var j=0u;j<len;j++){heap[at+j]=heap[src+j];}heap[d+47u]=len;}
 else if(field>=2000u&&field<2016u){dsFormatColor(d,heap[dsData(d)+64u+(field-2000u)*68u]);}
 else if(field>=1000u&&field<1016u){let index=field-1000u;dsFormat(d,hf(r+51u+(index/8u)*16u+(index%8u)*2u));}
 else if(field==31u||field==32u||field==33u){dsFormatColor(d,dsRead(d,k,field));heap[d+98u]=field;}
 else{var value=dsNumber(d,k,field);if(dsIntegerField(field)){value=f32(dsRead(d,k,field));}if(field==26u){value=degrees(value);}if(field==86u||field==88u){value=select(f32(dsRead(d,k,field)),-1.0,dsRead(d,k,field)==NONE);}dsFormat(d,value);}
 heap[d+48u]=heap[d+47u];heap[d+99u]=0u;
}
fn dsFinishEdit(d:u32)->bool{let field=heap[d+45u];if(field==NONE){return true;}let k=heap[d+50u];if(!dsAlive(d,k)){dsCancel(d);return false;}let len=heap[d+47u];var valid=true;
 if(field==5u||field==6u){if(field==5u&&(len==0u||len>DS_NAME||dsNameTaken(d,k))){valid=false;}else{for(var j=0u;j<heap[d+1u];j++){if((field==5u&&j!=k)||(field==6u&&!dsSelected(d,j))){continue;}let destination=select(dsName(d,j),dsText(d,j),field==6u);for(var c=0u;c<len;c++){heap[destination+c]=heap[heap[d+46u]+c];}heap[dsRec(d,j)+field]=len;}heap[d+53u]|=1u;state[3u]=1u;}}
 else if(field==31u||field==32u||field==33u||field>=2000u){let parsed=dsParseColor(d);valid=parsed.x==1u;if(valid){if(field>=2000u){heap[dsData(d)+64u+(field-2000u)*68u]=parsed.y;}else{dsPaintSelected(d,field,parsed.y);}}}
 else{let parsed=dsParseNumber(d);valid=parsed.x>0.0;if(valid){if(field>=1000u){let index=field-1000u;let at=dsRec(d,k)+50u+(index/8u)*16u+(index%8u)*2u;valid=parsed.y>=0.0&&(heap[at]!=2u||parsed.y>0.0);if(valid){hsetf(at+1u,parsed.y);heap[d+53u]=1u;state[3u]=1u;}}else{var value=parsed.y;if(field==26u){value=radians(value);}for(var j=0u;j<heap[d+1u];j++){if(dsSelected(d,j)&&!dsSetNumber(d,j,field,value)){valid=false;break;}}}}}
 if(!valid){dsCancel(d);dsReject(d,2u);return false;}heap[d+45u]=NONE;dsCommit(d);return true;
}
fn dsEditDelete(d:u32){let lo=min(heap[d+48u],heap[d+99u]);let hi=max(heap[d+48u],heap[d+99u]);if(lo==hi){return;}let at=heap[d+46u];let len=heap[d+47u];for(var j=hi;j<len;j++){heap[at+j-hi+lo]=heap[at+j];}heap[d+47u]=len-hi+lo;heap[d+48u]=lo;heap[d+99u]=lo;}
fn dsEditText(d:u32,code:u32){if(heap[d+45u]==NONE||code>0x10ffffu||(code>=0xd800u&&code<=0xdfffu)){return;}if(code<32u&&code!=10u){return;}if(heap[d+45u]!=6u&&code==10u){return;}dsEditDelete(d);let len=heap[d+47u];if(len>=DS_TEXT){dsReject(d,2u);return;}let caret=heap[d+48u];let at=heap[d+46u];for(var j=len;j>caret;j--){heap[at+j]=heap[at+j-1u];}heap[at+caret]=code;heap[d+47u]=len+1u;heap[d+48u]=caret+1u;heap[d+99u]=caret+1u;}
fn dsEditKey(d:u32,key:u32,mods:u32)->bool{if(heap[d+45u]==NONE){return false;}if(key==13u){if((mods&1u)!=0u&&heap[d+45u]==6u){dsEditText(d,10u);}else{_=dsFinishEdit(d);}return true;}if(key==27u){dsCancel(d);return true;}if(key==65u&&(mods&6u)!=0u){heap[d+99u]=0u;heap[d+48u]=heap[d+47u];return true;}
 if(key==8u||key==46u){if(heap[d+48u]==heap[d+99u]){if(key==8u){heap[d+99u]-=min(1u,heap[d+99u]);}else{heap[d+99u]=min(heap[d+47u],heap[d+99u]+1u);}}dsEditDelete(d);return true;}
 var pos=heap[d+48u];if(key==37u){pos-=min(1u,pos);}else if(key==39u){pos=min(heap[d+47u],pos+1u);}else if(key==36u){pos=0u;}else if(key==35u){pos=heap[d+47u];}else{return true;}heap[d+48u]=pos;if((mods&1u)==0u){heap[d+99u]=pos;}return true;
}
fn dsChangeState(d:u32,s:u32){if(s>=heap[dsData(d)+4u]){return;}for(var k=0u;k<heap[d+1u];k++){let at=heap[d+96u]+k*12u;let n=nodes[dsNode(d,k)];let c=cs(dsNode(d,k));heap[at]=state[c+3u];heap[at+1u]=state[c+8u];heap[at+2u]=state[c+9u];heap[at+3u]=state[c+10u];heap[at+4u]=state[c+11u];heap[at+5u]=state[c+12u];heap[at+6u]=n.paint.x;heap[at+7u]=n.paint.y;heap[at+8u]=n.paint.z;}heap[d+70u]=s;heap[d+72u]=1u;hsetf(d+71u,frame.viewport.w);heap[d+53u]|=1u;}
fn dsCaptureState(d:u32,s:u32){if(s==0u||s>3u){return;}dsBegin(d);for(var k=0u;k<heap[d+1u];k++){if(!dsAlive(d,k)){continue;}let at=dsStateAt(d,k,s);heap[at]=511u;for(var t=0u;t<6u;t++){let offset=select(select(t+7u,3u,t==0u),12u,t==5u);heap[at+1u+t]=state[cs(dsNode(d,k))+offset];}heap[at+7u]=nodes[dsNode(d,k)].paint.x;heap[at+8u]=nodes[dsNode(d,k)].paint.y;heap[at+9u]=nodes[dsNode(d,k)].paint.z;}
 let data=dsData(d);heap[data+4u]=max(heap[data+4u],s+1u);
 for(var st=1u;st<heap[data+4u];st++){let at=data+8u+(st-1u)*16u;if(heap[at]!=0u){continue;}
  heap[at]=7u;heap[at+1u]=83u;heap[at+2u]=116u;heap[at+3u]=97u;heap[at+4u]=116u;heap[at+5u]=101u;heap[at+6u]=32u;heap[at+7u]=48u+st;
  for(var attempt=0u;attempt<4u;attempt++){if(attempt>0u){heap[at]=8u;heap[at+8u]=96u+attempt;}var duplicate=false;for(var other=1u;other<heap[data+4u];other++){if(other==st){continue;}let p=data+8u+(other-1u)*16u;if(heap[p]!=heap[at]){continue;}var same=true;for(var j=0u;j<heap[at];j++){if(heap[p+1u+j]!=heap[at+1u+j]){same=false;break;}}duplicate=duplicate||same;}if(!duplicate){break;}}
 }
 dsCommit(d);dsCaptureTransition(d,s);
}
fn dsHandlePosition(bounds:vec4<f32>,h:u32)->vec2<f32>{let center=(bounds.xy+bounds.zw)*.5;switch h{case 0u:{return bounds.xy;}case 1u:{return vec2<f32>(center.x,bounds.y);}case 2u:{return vec2<f32>(bounds.z,bounds.y);}case 3u:{return vec2<f32>(bounds.z,center.y);}case 4u:{return bounds.zw;}case 5u:{return vec2<f32>(center.x,bounds.w);}case 6u:{return vec2<f32>(bounds.x,bounds.w);}case 7u:{return vec2<f32>(bounds.x,center.y);}default:{return vec2<f32>(center.x,bounds.y-26.0);}}}
fn dsBeginDrag(d:u32,point:vec2<f32>,mode:u32,handle:u32){dsBegin(d);heap[d+72u]=0u;for(var k=0u;k<heap[d+1u];k++){for(var t=0u;t<6u;t++){let offset=select(select(t+7u,3u,t==0u),12u,t==5u);heap[heap[d+96u]+k*12u+t]=state[cs(dsNode(d,k))+offset];}}heap[d+18u]=mode;heap[d+23u]=handle;hsetf(d+19u,point.x);hsetf(d+20u,point.y);let bounds=dsSelectionBounds(d);hsetf(d+80u,bounds.x);hsetf(d+81u,bounds.y);hsetf(d+82u,bounds.z);hsetf(d+83u,bounds.w);let primary=heap[d+9u];if(primary!=NONE){let n=nodes[dsNode(d,primary)];hsetf(d+104u,n.matrix.x);hsetf(d+105u,n.matrix.y);hsetf(d+106u,n.matrix.z);hsetf(d+107u,n.matrix.w);hsetf(d+108u,n.rect.z);hsetf(d+109u,n.rect.w);}heap[d+17u]&=~64u;}
fn dsSnap(d:u32,k:u32,axis:u32,value:f32)->f32{var v=value;let flags=heap[d+17u];let step=max(1.0,hf(d+16u));if((flags&1u)!=0u){v=round(v/step)*step;}if((flags&2u)==0u){return v;}let r=dsRec(d,k);let parent=heap[r+2u];let size=nodes[dsNode(d,k)].rect[axis+2u];var best=6.0/max(.1,hf(d+13u));var corrected=v;for(var j=1u;j<heap[d+1u];j++){if(!dsAlive(d,j)||dsSelected(d,j)||heap[dsRec(d,j)+2u]!=parent||(heap[dsRec(d,j)+4u]&1u)!=0u){continue;}let other=dsRec(d,j);let start=hf(other+8u+axis);let end=start+nodes[dsNode(d,j)].rect[axis+2u];for(var edge=0u;edge<3u;edge++){let destination=select(select(start,end,edge==2u),(start+end)*.5,edge==1u);for(var own=0u;own<3u;own++){let offset=f32(own)*size*.5;let delta=abs(destination-(value+offset));if(delta<best){best=delta;corrected=destination-offset;hsetf(d+84u+axis,destination);heap[d+86u+axis]=1u;}}}}return corrected;}
fn dsDrag(d:u32,point:vec2<f32>,mods:u32){let mode=heap[d+18u];if(mode==3u){let n=nodes[heap[d+3u]];let delta=inverse(n.matrix,vec2<f32>(0.0),point-vec2<f32>(hf(d+19u),hf(d+20u)));hsetf(d+14u,hf(d+21u)+delta.x);hsetf(d+15u,hf(d+22u)+delta.y);return;}
 if(mode==2u){hsetf(d+76u,point.x);hsetf(d+77u,point.y);return;}if(mode!=1u&&mode!=4u&&mode!=5u&&mode!=6u){return;}let delta=point-vec2<f32>(hf(d+19u),hf(d+20u));heap[d+86u]=0u;heap[d+87u]=0u;
 for(var k=1u;k<heap[d+1u];k++){if(!dsTopSelected(d,k)){continue;}let r=dsRec(d,k);let old=dsBefore(d,k);let parent=heap[r+2u];let pn=nodes[dsNode(d,parent)];let local=inverse(pn.matrix,vec2<f32>(0.0),delta);let canvas=heap[dsRec(d,parent)+1u]==3u;let record=(heap[d+17u]&32u)!=0u;let gesture=heap[d+96u]+k*12u;
  if(mode==1u){let field=select(29u,8u,canvas&&!record);var origin=vec2<f32>(hf(old+field),hf(old+field+1u));if(field==29u){origin=vec2<f32>(hf(gesture+1u),hf(gesture+2u));}var pos=origin+local;if((mods&1u)!=0u){if(abs(local.x)>abs(local.y)){pos.y=origin.y;}else{pos.x=origin.x;}}if((mods&8u)==0u&&canvas&&!record){pos.x=dsSnap(d,k,0u,pos.x);pos.y=dsSnap(d,k,1u,pos.y);}dsWrite(d,k,field,bitcast<u32>(pos.x));dsWrite(d,k,field+1u,bitcast<u32>(pos.y));}
  else if(mode==6u){let start=inverse(pn.matrix,pn.translation.xy,vec2<f32>(hf(d+19u),hf(d+20u)));let end=inverse(pn.matrix,pn.translation.xy,point);let parentOrigin=contentRect(pn).xy;let lo=min(start,end)-parentOrigin;let size=max(vec2<f32>(1.0),abs(end-start));hsetf(r+8u,lo.x);hsetf(r+9u,lo.y);hsetf(r+10u,size.x);hsetf(r+11u,size.y);heap[d+53u]=1u;state[3u]=1u;}
  else if(mode==5u){let center=(vec2<f32>(hf(d+80u),hf(d+81u))+vec2<f32>(hf(d+82u),hf(d+83u)))*.5;let start=vec2<f32>(hf(d+19u),hf(d+20u))-center;let now=point-center;var angle=hf(gesture+5u)+atan2(now.y,now.x)-atan2(start.y,start.x);if((mods&1u)!=0u){angle=round(angle/.2617993878)*.2617993878;}dsWrite(d,k,26u,bitcast<u32>(angle));}
  else{let handle=heap[d+23u];let oldWidth=select(hf(old+10u),hf(d+108u),hf(old+10u)<0.0);let oldHeight=select(hf(old+11u),hf(d+109u),hf(old+11u)<0.0);let m=vec4<f32>(hf(d+104u),hf(d+105u),hf(d+106u),hf(d+107u));let localDelta=inverse(m,vec2<f32>(0.0),delta);let left=handle==0u||handle==6u||handle==7u;let top=handle<=2u;let right=handle>=2u&&handle<=4u;let bottom=handle>=4u&&handle<=6u;
   var w=oldWidth+select(0.0,localDelta.x,right)-select(0.0,localDelta.x,left);var h=oldHeight+select(0.0,localDelta.y,bottom)-select(0.0,localDelta.y,top);if((mods&1u)!=0u){h=w*oldHeight/max(1.0,oldWidth);}w=clamp(w,max(1.0,hf(old+12u)),max(1.0,hf(old+14u)));h=clamp(h,max(1.0,hf(old+13u)),max(1.0,hf(old+15u)));
   let sizeDelta=vec2<f32>(oldWidth-w,oldHeight-h);let opposite=vec2<f32>(select(select(.5,0.0,right),1.0,left),select(select(.5,0.0,bottom),1.0,top));let anchorDelta=inverse(pn.matrix,vec2<f32>(0.0),transform(m,vec2<f32>(0.0),(opposite-vec2<f32>(.5))*sizeDelta));
   if(record){dsWrite(d,k,27u,bitcast<u32>(clamp(hf(gesture+3u)*w/max(1.0,oldWidth),.001,64.0)));dsWrite(d,k,28u,bitcast<u32>(clamp(hf(gesture+4u)*h/max(1.0,oldHeight),.001,64.0)));dsWrite(d,k,29u,bitcast<u32>(hf(gesture+1u)+anchorDelta.x));dsWrite(d,k,30u,bitcast<u32>(hf(gesture+2u)+anchorDelta.y));}
   else{dsWrite(d,k,10u,bitcast<u32>(w));dsWrite(d,k,11u,bitcast<u32>(h));if(canvas){let offset=sizeDelta*.5+anchorDelta;hsetf(r+8u,hf(old+8u)+offset.x);hsetf(r+9u,hf(old+9u)+offset.y);}}
  }
 }
}
fn dsSurfacePointer(i:u32,c:Command){let d=nodes[i].aux.x;let p=c.position;let mods=c.code>>8u;if(c.kind==4u){if((mods&6u)!=0u){dsZoom(d,hf(d+13u)*exp(-c.data.y*.0015),p);}else{hsetf(d+14u,hf(d+14u)-c.data.x);hsetf(d+15u,hf(d+15u)-c.data.y);}return;}
 if(c.kind==2u){state[0u]=i;state[2u]=i;hsetf(d+19u,p.x);hsetf(d+20u,p.y);hsetf(d+76u,p.x);hsetf(d+77u,p.y);heap[d+86u]=0u;heap[d+87u]=0u;
  if(heap[d+12u]==1u||((mods&8u)!=0u&&c.data.y<2.0)){heap[d+18u]=3u;hsetf(d+21u,hf(d+14u));hsetf(d+22u,hf(d+15u));return;}
  if((heap[d+17u]&16u)!=0u){return;}if(heap[d+10u]>0u&&heap[d+12u]==0u){let bounds=dsSelectionBounds(d);for(var handle=0u;handle<9u;handle++){if(length(p-dsHandlePosition(bounds,handle))<=8.0){if(heap[d+10u]>1u&&handle<8u){dsReject(d,6u);return;}dsBeginDrag(d,p,select(4u,5u,handle==8u),handle);return;}}}
  if(heap[d+12u]>=2u){dsBegin(d);var kind=heap[d+12u]-100u;var shape=heap[d+97u];if(heap[d+12u]<100u){kind=select(select(select(4u,5u,heap[d+12u]==3u),12u,heap[d+12u]==4u),6u,heap[d+12u]==5u);shape=select(shape,1u,heap[d+12u]==4u);}var parent=heap[d+9u];if(parent==NONE||!dsContainer(heap[dsRec(d,parent)+1u])){parent=0u;}let k=dsNew(d,kind,parent,shape);if(k==NONE){dsCancel(d);return;}let r=dsRec(d,k);let pn=nodes[dsNode(d,parent)];let world=inverse(pn.matrix,pn.translation.xy,p);hsetf(r+8u,world.x-contentRect(pn).x);hsetf(r+9u,world.y-contentRect(pn).y);hsetf(r+10u,1.0);hsetf(r+11u,1.0);dsSelect(d,k,false);heap[d+18u]=6u;return;}
  let cycle=select(0u,u32(max(0.0,c.data.y-1.0)),c.data.y>=2.0);let hit=dsHit(d,p,cycle);if(hit!=NONE){if(!dsSelected(d,hit)||(mods&1u)!=0u){dsSelect(d,hit,(mods&1u)!=0u);}if(dsSelected(d,hit)){dsBeginDrag(d,p,1u,0u);}}else{if((mods&1u)==0u){dsSelect(d,NONE,false);}heap[d+18u]=2u;}
 }else if(c.kind==1u){dsDrag(d,p,mods);}else if(c.kind==3u){if(heap[d+18u]==2u){let a=vec2<f32>(hf(d+19u),hf(d+20u));let b=p;let marquee=vec4<f32>(min(a,b),max(a,b));for(var k=1u;k<heap[d+1u];k++){if(!dsAlive(d,k)||dsLocked(d,k)||(heap[dsRec(d,k)+4u]&1u)!=0u){continue;}let n=nodes[dsNode(d,k)];if(!visible(dsNode(d,k))){continue;}let bounds=transformedBounds(n.matrix,n.translation.xy,boundsOf(n.rect));if(all(bounds.zw>=marquee.xy)&&all(bounds.xy<=marquee.zw)){heap[heap[d+11u]+k]=1u;heap[d+9u]=k;}}dsSelect(d,NONE,true);}
  if(heap[d+18u]==6u){let k=heap[d+9u];if(k!=NONE){let r=dsRec(d,k);if(hf(r+10u)<4.0&&hf(r+11u)<4.0){hsetf(r+10u,160.0);hsetf(r+11u,select(48.0,28.0,heap[r+1u]==5u));}}heap[d+12u]=0u;}
  heap[d+18u]=0u;dsCommit(d);state[2u]=NONE;
 }
}
fn dsTreeRow(i:u32,point:vec2<f32>)->u32{let d=nodes[i].aux.x;let r=contentRect(nodes[i]);let row=u32(max(0.0,point.y-r.y+sf(cs(i)+1u))/27.0);var index=0u;for(var rank=0u;rank<heap[d+58u];rank++){let k=heap[heap[d+56u]+rank];var p=heap[dsRec(d,k)+2u];var show=true;for(var j=0u;j<17u&&p!=NONE;j++){if((heap[dsRec(d,p)+4u]&4u)!=0u){show=false;break;}p=heap[dsRec(d,p)+2u];}if(show){if(index==row){return k;}index++;}}return NONE;}
fn dsTreePointer(i:u32,c:Command){let d=nodes[i].aux.x;let r=contentRect(nodes[i]);let point=inverse(nodes[i].matrix,nodes[i].translation.xy,c.position);if(c.kind==4u){setf(cs(i)+1u,clamp(sf(cs(i)+1u)+c.data.y,0.0,max(0.0,f32(heap[d+58u])*27.0-r.w)));return;}let slot=dsTreeRow(i,point);
 if(c.kind==2u){state[0u]=i;state[2u]=i;if(slot==NONE){return;}let rec=dsRec(d,slot);let depth=nodes[dsNode(d,slot)].text.x-nodes[heap[d+2u]].text.x;if(point.x>r.x+r.z-26.0){dsBegin(d);heap[rec+4u]^=2u;dsCommit(d);return;}if(point.x>r.x+r.z-50.0){dsBegin(d);heap[rec+4u]^=1u;heap[d+53u]=1u;state[3u]=1u;dsCommit(d);return;}if(point.x<r.x+f32(depth)*14.0+19.0&&nodes[dsNode(d,slot)].info.w>0u){heap[rec+4u]^=4u;return;}dsSelect(d,slot,(c.code&256u)!=0u);heap[d+74u]=slot;heap[d+75u]=NONE;hsetf(d+19u,point.x);hsetf(d+20u,point.y);}
 if(c.kind==1u&&heap[d+74u]!=NONE&&length(point-vec2<f32>(hf(d+19u),hf(d+20u)))>5.0){heap[d+75u]=slot;}
 if(c.kind==3u){let source=heap[d+74u];let destination=heap[d+75u];if(source!=NONE&&destination!=NONE&&source!=destination){let tr=dsRec(d,destination);let child=(c.code&512u)!=0u||point.x>r.x+f32(nodes[dsNode(d,destination)].text.x-nodes[heap[d+2u]].text.x)*14.0+50.0;let parent=select(heap[tr+2u],destination,child&&dsContainer(heap[tr+1u]));if(parent!=NONE){dsBegin(d);if(dsReparent(d,source,parent,select(heap[tr+3u],heap[d+1u],parent==destination))){dsCommit(d);}else{dsCancel(d);}}}heap[d+74u]=NONE;heap[d+75u]=NONE;state[2u]=NONE;}
}
fn dsInspectorPick(i:u32,c:Command)->vec3<u32>{let d=nodes[i].aux.x;let n=nodes[i];let r=contentRect(n);let p=inverse(n.matrix,n.translation.xy,c.position);let role=n.action.w;let primary=heap[d+9u];let height=28.0;let rows=select(select(heap[d+103u],18u,role==1u||role==3u),5u,role==2u);
 if(c.kind==4u){setf(cs(i)+1u,clamp(sf(cs(i)+1u)+c.data.y,0.0,max(0.0,f32(rows)*height-r.w)));return vec3<u32>(0u);}if(c.kind!=2u){if(c.kind==3u){state[2u]=NONE;}return vec3<u32>(0u);}state[0u]=i;state[2u]=i;let row=u32(max(0.0,p.y-r.y+sf(cs(i)+1u))/height);
 if(role==2u){if(row<4u){if(p.x>r.x+r.z-78.0&&row>0u){dsCaptureState(d,row);}else{dsChangeState(d,row);}}return vec3<u32>(0u);}
 if(role==1u){let count=heap[dsData(d)+3u];if(row<count){heap[d+100u]=row+1u;heap[d+98u]=32u;if(c.data.y>=2.0){return vec3<u32>(1u,select(primary,0u,primary==NONE),2000u+row);}}else if(row==count&&count<16u){dsBegin(d);let at=dsData(d)+64u+count*68u;heap[at]=0xffdcc064u;heap[at+1u]=7u;heap[at+4u]=66u;heap[at+5u]=114u;heap[at+6u]=117u;heap[at+7u]=115u;heap[at+8u]=104u;heap[at+9u]=48u+count/10u;heap[at+10u]=48u+count%10u;heap[dsData(d)+3u]=count+1u;heap[d+100u]=count+1u;dsCommit(d);}return vec3<u32>(0u);}
 if(primary==NONE){return vec3<u32>(0u);}if(role==3u){if(heap[dsRec(d,primary)+1u]!=1u){return vec3<u32>(0u);}let axis=row/9u;let index=row%9u;if(axis>1u){return vec3<u32>(0u);}let rec=dsRec(d,primary);let count=heap[rec+48u+axis];if(index==8u){if(count<8u){dsBegin(d);heap[rec+48u+axis]++;let at=rec+50u+axis*16u+count*2u;heap[at]=2u;hsetf(at+1u,1.0);heap[d+53u]=1u;state[3u]=1u;dsCommit(d);}return vec3<u32>(0u);}if(index>=count){return vec3<u32>(0u);}if(p.x<r.x+112.0){dsBegin(d);let at=rec+50u+axis*16u+index*2u;heap[at]=(heap[at]+1u)%3u;if(hf(at+1u)<=0.0){hsetf(at+1u,1.0);}heap[d+53u]=1u;state[3u]=1u;dsCommit(d);}else{return vec3<u32>(1u,primary,1000u+axis*8u+index);}return vec3<u32>(0u);}
 if(row>=heap[d+103u]){return vec3<u32>(0u);}let at=heap[d+40u]+row*4u;let field=heap[at+2u];let fieldKind=heap[at+3u];if(fieldKind==5u){return vec3<u32>(0u);}heap[d+100u]=0u;if(fieldKind==2u){if(field==86u||field==88u){if(c.data.y>=2.0){return vec3<u32>(1u,primary,field);}var next=dsRead(d,primary,field);for(var j=0u;j<=heap[d+1u];j++){next=select(next+1u,0u,next==NONE);if(next>=heap[d+1u]){return vec3<u32>(2u,field,bitcast<u32>(-1.0));}if(dsAlive(d,next)){return vec3<u32>(2u,field,bitcast<u32>(f32(next)));}}return vec3<u32>(0u);}var limit=4u;if(field==40u||field==41u||field==43u){limit=2u;}return vec3<u32>(2u,field,bitcast<u32>(f32((dsRead(d,primary,field)+1u)%limit)));}else{return vec3<u32>(1u,primary,field);}
 return vec3<u32>(0u);
}
// Decode first so native compilation contains one copy of each property editor.
fn dsInspectorPointer(i:u32,c:Command){
 let request=dsInspectorPick(i,c);let d=nodes[i].aux.x;
 if(request.x==1u){dsStartEdit(d,request.y,request.z);}
 if(request.x==2u){dsSetSelected(d,request.y,bitcast<f32>(request.z));}
}
fn dsColorPointer(i:u32,c:Command){let n=nodes[i];let d=n.aux.x;let r=contentRect(n);let p=inverse(n.matrix,n.translation.xy,c.position);let primary=heap[d+9u];let resourceIndex=heap[d+100u];if(primary==NONE&&resourceIndex==0u){return;}var field=heap[d+98u];if(field<31u||field>33u){field=32u;heap[d+98u]=field;}
 if(c.kind==2u){state[0u]=i;state[2u]=i;let channel=u32(max(0.0,p.y-r.y-62.0)/32.0);if(channel>3u||p.y<r.y+62.0){return;}dsBegin(d);heap[d+102u]=channel;heap[d+18u]=12u;}
 if((c.kind==1u||c.kind==2u)&&heap[d+18u]==12u){let value=u32(round(clamp((p.x-r.x-26.0)/max(1.0,r.z-65.0),0.0,1.0)*255.0));let channel=heap[d+102u];var color=0u;let at=dsData(d)+64u+(resourceIndex-1u)*68u;if(resourceIndex>0u){color=heap[at];}else{color=dsRead(d,primary,field);}color=(color&~(255u<<(channel*8u)))|(value<<(channel*8u));if(resourceIndex>0u){heap[at]=color;}else{dsPaintSelected(d,field,color);}}
 if(c.kind==3u){heap[d+18u]=0u;dsCommit(d);state[2u]=NONE;}
}
fn dsTimelinePointer(i:u32,c:Command){let n=nodes[i];let d=n.aux.x;let r=contentRect(n);let p=inverse(n.matrix,n.translation.xy,c.position);let primary=heap[d+9u];let duration=hf(dsData(d)+2u);let time=clamp((p.x-r.x-130.0)/max(1.0,r.z-146.0),0.0,1.0)*duration;
 if(c.kind==2u){state[0u]=i;state[2u]=i;heap[d+17u]&=~64u;if(p.y<r.y+30.0||primary==NONE){hsetf(d+35u,time);heap[d+18u]=8u;return;}let t=min(5u,u32((p.y-r.y-30.0)/32.0));heap[d+38u]=t;heap[d+73u]=NONE;if(p.x<r.x+130.0){return;}let at=dsTrack(d,primary,t);for(var key=0u;key<heap[at];key++){let x=r.x+130.0+hf(at+4u+key*4u)/duration*(r.z-146.0);if(abs(p.x-x)<8.0){heap[d+73u]=key;dsBegin(d);heap[d+18u]=9u;hsetf(d+51u,hf(at+5u+key*4u));hsetf(d+20u,p.y);break;}}
  if(heap[d+73u]==NONE){hsetf(d+35u,time);heap[d+18u]=8u;if(c.data.y>=2.0){dsBegin(d);_=dsPutKey(d,primary,t,time,dsCurrentValue(d,primary,t),1u);dsCommit(d);}}
 }else if(c.kind==1u){if(heap[d+18u]==8u){hsetf(d+35u,time);}if(heap[d+18u]==9u&&primary!=NONE){let at=dsTrack(d,primary,heap[d+38u]);let key=heap[d+73u];var minTime=0.0;var maxTime=duration;if(key>0u){minTime=hf(at+4u+(key-1u)*4u)+.001;}if(key+1u<heap[at]){maxTime=hf(at+4u+(key+1u)*4u)-.001;}var clock=time;if((c.code&256u)!=0u){clock=round(clock*10.0)/10.0;}hsetf(at+4u+key*4u,clamp(clock,minTime,maxTime));hsetf(d+35u,clock);if((c.code&2048u)!=0u){hsetf(at+5u+key*4u,hf(d+51u)+(hf(d+20u)-p.y)*select(.01,1.0,heap[d+38u]==1u||heap[d+38u]==2u));}}}
 else if(c.kind==3u){heap[d+18u]=0u;dsCommit(d);state[2u]=NONE;}
}
fn dsCopy(d:u32){for(var j=0u;j<heap[d+29u];j++){heap[heap[d+94u]+j]=heap[dsData(d)+j];}var count=0u;for(var k=0u;k<heap[d+1u];k++){var include=false;if(k>0u&&dsAlive(d,k)){var p=k;for(var depth=0u;depth<18u&&p!=NONE;depth++){if(dsSelected(d,p)){include=true;break;}p=heap[dsRec(d,p)+2u];}}heap[heap[d+88u]+k]=select(0u,1u,include);count+=select(0u,1u,include);}heap[d+89u]=count;heap[d+90u]=0u;}
fn dsPaste(d:u32){let count=heap[d+89u];if(count==0u){return;}var free=0u;for(var k=1u;k<heap[d+1u];k++){if(!dsAlive(d,k)){free++;}}if(count>free){dsReject(d,1u);return;}dsBegin(d);var mapping:array<u32,128>;for(var k=0u;k<heap[d+1u];k++){mapping[k]=NONE;}let clipboard=heap[d+94u];for(var k=1u;k<heap[d+1u];k++){if(heap[heap[d+88u]+k]==0u){continue;}let dest=dsAvailableSlot(d);mapping[k]=dest;dsCopySlot(d,k,dest,clipboard);}
 dsSelect(d,NONE,false);heap[d+90u]++;for(var k=1u;k<heap[d+1u];k++){if(mapping[k]==NONE){continue;}let dest=mapping[k];let r=dsRec(d,dest);let parent=heap[r+2u];if(parent!=NONE&&mapping[parent]!=NONE){heap[r+2u]=mapping[parent];}else{if(parent==NONE||heap[heap[d+30u]+heap[d+64u]+parent*DS_RECORD]==0u){heap[r+2u]=0u;}hsetf(r+8u,hf(r+8u)+16.0*f32(heap[d+90u]));hsetf(r+9u,hf(r+9u)+16.0*f32(heap[d+90u]));heap[r+3u]+=heap[d+1u];heap[heap[d+11u]+dest]=1u;heap[d+9u]=dest;}if(heap[r+86u]!=NONE){if(mapping[heap[r+86u]]!=NONE){heap[r+86u]=mapping[heap[r+86u]];}else if(!dsAlive(d,heap[r+86u])){heap[r+86u]=NONE;heap[r+85u]=0u;}}if(heap[r+88u]!=NONE){if(mapping[heap[r+88u]]!=NONE){heap[r+88u]=mapping[heap[r+88u]];}else if(!dsAlive(d,heap[r+88u])){heap[r+88u]=NONE;}}dsDefaultName(d,dest);}
 dsSelect(d,NONE,true);heap[d+53u]=3u;state[3u]=1u;dsCommit(d);
}
fn dsValidateBlock(d:u32,base:u32)->bool{
 if(!dsTemplatesValid(d,base)){return false;}
 let count=heap[d+1u];let records=base+heap[d+64u];
 if(!(hf(base)>=32.0&&hf(base)<=8192.0&&hf(base+1u)>=32.0&&hf(base+1u)<=8192.0&&hf(base+2u)>=.1&&hf(base+2u)<=3600.0)||heap[base+3u]>16u||heap[base+4u]<1u||heap[base+4u]>4u){return false;}
 for(var k=0u;k<count;k++){
  let r=records+k*DS_RECORD;if(heap[r]==0u){if(k==0u){return false;}continue;}
  let kind=heap[r+1u];if(!dsAllowed(kind)||heap[r+5u]==0u||heap[r+5u]>DS_NAME||heap[r+6u]>DS_TEXT||heap[r+48u]<1u||heap[r+48u]>8u||heap[r+49u]<1u||heap[r+49u]>8u||heap[r+84u]>=heap[d+43u]||heap[r+93u]>=count){return false;}
  let parent=heap[r+2u];if(k==0u){if(parent!=NONE||!(kind==1u||kind==2u||kind==3u||kind==14u||kind==15u||kind==16u||kind==17u)){return false;}}
  else if(parent>=count||heap[records+parent*DS_RECORD]==0u||!dsContainer(heap[records+parent*DS_RECORD+1u])){return false;}
  var ancestor=parent;var depth=0u;while(ancestor!=NONE&&depth<17u){if(ancestor==k||ancestor>=count){return false;}ancestor=heap[records+ancestor*DS_RECORD+2u];depth++;}if(ancestor!=NONE||depth>16u){return false;}
  var children=0u;for(var other=0u;other<count;other++){let p=records+other*DS_RECORD;if(heap[p]==0u||other==k){continue;}if(heap[p+2u]==k){children++;}if(heap[p+5u]==heap[r+5u]){var same=true;for(var j=0u;j<heap[r+5u];j++){if(heap[base+heap[d+65u]+other*DS_NAME+j]!=heap[base+heap[d+65u]+k*DS_NAME+j]){same=false;break;}}if(same){return false;}}}
  if((children>0u&&!dsContainer(kind))||(children>1u&&dsSingleChild(kind))){return false;}
  for(var which=0u;which<2u;which++){let start=select(base+heap[d+65u]+k*DS_NAME,base+heap[d+66u]+k*DS_TEXT,which==1u);let length=heap[r+5u+which];for(var j=0u;j<length;j++){let cp=heap[start+j];if(cp>0x10ffffu||(cp>=0xd800u&&cp<=0xdfffu)){return false;}}}
  for(var field=8u;field<=30u;field++){if(!(abs(hf(r+field))<=INF)){return false;}}
  if((hf(r+10u)<0.0&&hf(r+10u)!= -1.0)||(hf(r+11u)<0.0&&hf(r+11u)!= -1.0)||hf(r+12u)<0.0||hf(r+13u)<0.0||hf(r+14u)<hf(r+12u)||hf(r+15u)<hf(r+13u)||hf(r+16u)<0.0||hf(r+17u)<0.0||hf(r+22u)<=0.0||hf(r+22u)>1024.0||hf(r+23u)<0.0||hf(r+24u)<0.0||hf(r+25u)<0.0||hf(r+25u)>1.0||hf(r+27u)<.001||hf(r+28u)<.001||hf(r+27u)>64.0||hf(r+28u)>64.0){return false;}
  if(heap[r+34u]>3u||heap[r+35u]>3u||heap[r+36u]>7u||heap[r+37u]>7u||heap[r+38u]<1u||heap[r+38u]>8u||heap[r+39u]<1u||heap[r+39u]>8u||heap[r+40u]>1u||heap[r+41u]>1u||heap[r+42u]>3u||heap[r+43u]>1u||heap[r+44u]>128u||heap[r+45u]>128u||heap[r+46u]>3u||heap[r+85u]>3u||heap[r+91u]>heap[base+3u]||heap[r+92u]>heap[base+3u]){return false;}
  if(parent!=NONE&&heap[records+parent*DS_RECORD+1u]==1u){let p=records+parent*DS_RECORD;if(heap[r+36u]+heap[r+38u]>heap[p+49u]||heap[r+37u]+heap[r+39u]>heap[p+48u]){return false;}}
  for(var axis=0u;axis<2u;axis++){for(var j=0u;j<heap[r+48u+axis];j++){let at=r+50u+axis*16u+j*2u;if(heap[at]>2u||!(hf(at+1u)>=0.0&&hf(at+1u)<=INF)||(heap[at]==2u&&hf(at+1u)<=0.0)){return false;}}}
  for(var j=0u;j<2u;j++){let other=heap[r+86u+j*2u];if(other!=NONE&&(other>=count||heap[records+other*DS_RECORD]==0u)){return false;}}
  if(!(abs(hf(r+82u))<=INF&&abs(hf(r+87u))<=INF&&abs(hf(r+89u))<=INF&&abs(hf(r+90u))<=INF)){return false;}
  for(var t=0u;t<6u;t++){let at=base+heap[d+67u]+(k*6u+t)*DS_TRACK;if(heap[at]>DS_KEYS){return false;}var previous= -1.0;for(var j=0u;j<heap[at];j++){let key=at+4u+j*4u;let time=hf(key);let value=hf(key+1u);if(!(time>previous&&time>=0.0&&time<=hf(base+2u))||!(abs(value)<=INF)||heap[key+2u]>8u||(t==0u&&(value<0.0||value>1.0))||((t==3u||t==4u)&&(value<.001||value>64.0))){return false;}previous=time;}}
  for(var st=1u;st<heap[base+4u];st++){let at=base+heap[d+68u]+(st*count+k)*DS_STATE;let mask=heap[at];if(mask>511u){return false;}for(var t=0u;t<6u;t++){if((mask&(1u<<t))==0u){continue;}let value=hf(at+1u+t);if(!(abs(value)<=INF)||(t==0u&&(value<0.0||value>1.0))||((t==3u||t==4u)&&(value<.001||value>64.0))){return false;}}}
 }
 for(var st=1u;st<heap[base+4u];st++){let at=base+8u+(st-1u)*16u;let len=heap[at];if(len==0u||len>15u){return false;}for(var c=0u;c<len;c++){let cp=heap[at+1u+c];if(cp>0x10ffffu||(cp>=0xd800u&&cp<=0xdfffu)){return false;}}for(var other=1u;other<st;other++){let prev=base+8u+(other-1u)*16u;if(heap[prev]!=len){continue;}var same=true;for(var c=0u;c<len;c++){if(heap[prev+1u+c]!=heap[at+1u+c]){same=false;break;}}if(same){return false;}}}
 for(var j=0u;j<heap[base+3u];j++){let at=base+64u+j*68u;let len=heap[at+1u];if(len==0u||len>63u){return false;}for(var c=0u;c<len;c++){let cp=heap[at+4u+c];if(cp>0x10ffffu||(cp>=0xd800u&&cp<=0xdfffu)){return false;}}for(var other=0u;other<j;other++){let prev=base+64u+other*68u;if(heap[prev+1u]!=len){continue;}var same=true;for(var c=0u;c<len;c++){if(heap[prev+4u+c]!=heap[at+4u+c]){same=false;break;}}if(same){return false;}}}
 return true;
}
// Bounded command families keep native compiler graphs small. Each operation
// retains its validation, early returns and common completion behavior.
// The immediate wrapper is used by scalar replay. Native command/gesture roots
// follow finishDesignerEdit in the FIFO graph, so they must not inline that large
// preflight again at each command family or pointer route.
fn executeDsCommand(d:u32,command:u32,a:f32,b:f32,x:f32,y:f32){
 if(d==0u){return;}if(command!=38u&&heap[d+45u]!=NONE){if(!dsFinishEdit(d)){return;}}
 switch min(command/8u,6u){
 case 0u:{executeDsCommand0(d,command,a,b,x,y);}
 case 1u:{executeDsCommand1(d,command,a,b,x,y);}
 case 2u:{executeDsCommand2(d,command,a,b,x,y);}
 case 3u:{executeDsCommand3(d,command,a,b,x,y);}
 case 4u:{executeDsCommand4(d,command,a,b,x,y);}
 case 5u:{executeDsCommand5(d,command,a,b,x,y);}
 case 6u:{executeDsCommand6(d,command,a,b,x,y);}
 default:{}
 }
}
fn executeDsCommand0(d:u32,command:u32,a:f32,b:f32,x:f32,y:f32){if(d==0u){return;}let primary=heap[d+9u];
 switch command{
 case 0u:{if(a<0.0){dsSelect(d,NONE,false);}else{dsSelect(d,u32(a),b>0.0);}state[0u]=heap[d+3u];}
 case 1u:{heap[d+12u]=u32(max(0.0,a));heap[d+97u]=u32(max(0.0,b));heap[d+17u]&=~16u;}
 case 2u:{dsBegin(d);var parent=primary;if(parent==NONE||!dsContainer(heap[dsRec(d,parent)+1u])){parent=0u;}let k=dsNew(d,u32(a),parent,u32(max(0.0,b)));if(k==NONE){dsCancel(d);}else{dsSelect(d,k,false);dsCommit(d);}}
 case 3u:{dsDelete(d);}
 case 4u:{dsDuplicate(d);}
 case 5u:{dsUndo(d,false);}
 case 6u:{dsUndo(d,true);}
 case 7u:{let field=u32(a);if(x>0.0){let len=u32(max(0.0,b));if(len>DS_TEXT){dsReject(d,2u);return;}for(var j=0u;j<len;j++){heap[heap[d+46u]+j]=heap[heap[d+61u]+j];}heap[d+47u]=len;let color=dsParseColor(d);if(color.x!=0u){dsBegin(d);dsPaintSelected(d,field,color.y);dsCommit(d);}else{dsReject(d,2u);}}else{dsSetSelected(d,field,b);}}
 default:{dsReject(d,8u);}}
 if(state[0u]!=NONE&&state[0u]<frame.counts.x&&(nodes[state[0u]].info.x==6u||nodes[state[0u]].info.x==7u)&&(heap[d+17u]&16u)==0u){state[0u]=heap[d+3u];}
}
fn executeDsCommand1(d:u32,command:u32,a:f32,b:f32,x:f32,y:f32){if(d==0u){return;}let primary=heap[d+9u];
 switch command{
 case 8u,9u:{if(primary==NONE){return;}dsStartEdit(d,primary,select(6u,5u,command==9u));let len=u32(max(0.0,b));if(len>DS_TEXT){dsCancel(d);dsReject(d,2u);return;}for(var j=0u;j<len;j++){heap[heap[d+46u]+j]=heap[heap[d+61u]+j];}heap[d+47u]=len;_=dsFinishEdit(d);}
 case 10u:{if(primary!=NONE){dsBegin(d);if(dsReparent(d,primary,u32(a),u32(max(0.0,b)))){dsCommit(d);}else{dsCancel(d);}}}
 case 11u:{if(primary==NONE||primary==0u){return;}dsBegin(d);let r=dsRec(d,primary);let parent=heap[r+2u];let ordinal=heap[r+3u];if(a==0.0){heap[r+3u]=heap[d+1u]*2u;}else if(a==1.0){for(var k=1u;k<heap[d+1u];k++){let c=dsRec(d,k);if(dsAlive(d,k)&&heap[c+2u]==parent){heap[c+3u]++;}}heap[r+3u]=0u;}else{for(var k=1u;k<heap[d+1u];k++){let c=dsRec(d,k);if(k!=primary&&dsAlive(d,k)&&heap[c+2u]==parent&&heap[c+3u]==select(ordinal+1u,ordinal-1u,a==3.0)){heap[r+3u]=heap[c+3u];heap[c+3u]=ordinal;break;}}}heap[d+53u]=3u;dsCommit(d);}
 case 12u:{dsGroup(d,false);}
 case 13u:{dsGroup(d,true);}
 case 14u:{dsAlign(d,min(5u,u32(max(0.0,a))),false);}
 case 15u:{dsAlign(d,min(1u,u32(max(0.0,a))),true);}
 default:{dsReject(d,8u);}}
 if(state[0u]!=NONE&&state[0u]<frame.counts.x&&(nodes[state[0u]].info.x==6u||nodes[state[0u]].info.x==7u)&&(heap[d+17u]&16u)==0u){state[0u]=heap[d+3u];}
}
fn executeDsCommand2(d:u32,command:u32,a:f32,b:f32,x:f32,y:f32){if(d==0u){return;}let primary=heap[d+9u];
 switch command{
 case 16u,17u:{dsBegin(d);for(var k=0u;k<heap[d+1u];k++){if(dsSelected(d,k)){heap[dsRec(d,k)+4u]^=select(2u,1u,command==17u);}}heap[d+53u]=1u;state[3u]=1u;dsCommit(d);}
 case 18u:{let n=nodes[heap[d+3u]];let r=contentRect(n);dsZoom(d,select(a,hf(d+13u)*a,b>0.0),transform(n.matrix,n.translation.xy,r.xy+r.zw*.5));}
 case 19u:{dsFit(d);}
 case 20u:{heap[d+17u]^=3u;}
 case 21u:{heap[d+17u]^=4u;}
 case 22u:{dsCancel(d);heap[d+17u]^=16u;heap[d+53u]=1u;heap[d+12u]=0u;}
 case 23u:{heap[d+17u]^=64u;hsetf(d+37u,frame.viewport.w);}
 default:{dsReject(d,8u);}}
 if(state[0u]!=NONE&&state[0u]<frame.counts.x&&(nodes[state[0u]].info.x==6u||nodes[state[0u]].info.x==7u)&&(heap[d+17u]&16u)==0u){state[0u]=heap[d+3u];}
}
fn executeDsCommand3(d:u32,command:u32,a:f32,b:f32,x:f32,y:f32){if(d==0u){return;}let primary=heap[d+9u];
 switch command{
 case 24u:{heap[d+17u]&=~64u;hsetf(d+35u,0.0);}
 case 25u:{heap[d+17u]&=~64u;hsetf(d+35u,clamp(a,0.0,hf(dsData(d)+2u)));}
 case 26u:{heap[d+17u]^=32u;}
 case 27u:{if(primary!=NONE){dsBegin(d);let t=min(5u,heap[d+38u]);_=dsPutKey(d,primary,t,hf(d+35u),dsCurrentValue(d,primary,t),1u);dsCommit(d);}}
 case 28u:{if(primary!=NONE){let t=dsTrack(d,primary,min(5u,heap[d+38u]));let key=heap[d+73u];if(key<heap[t]){dsBegin(d);for(var k=key+1u;k<heap[t];k++){for(var w=0u;w<4u;w++){heap[t+4u+(k-1u)*4u+w]=heap[t+4u+k*4u+w];}}heap[t]--;heap[d+73u]=NONE;dsCommit(d);}}}
 case 29u:{if(primary!=NONE){let t=dsTrack(d,primary,min(5u,heap[d+38u]));if(heap[d+73u]<heap[t]){dsBegin(d);heap[t+6u+heap[d+73u]*4u]=u32(clamp(a,0.0,8.0));dsCommit(d);}}}
 case 30u:{dsSelect(d,NONE,false);for(var k=1u;k<heap[d+1u];k++){if(dsAlive(d,k)){heap[heap[d+11u]+k]=1u;heap[d+9u]=k;}}dsSelect(d,NONE,true);}
 case 31u:{dsChangeState(d,u32(max(0.0,a)));}
 default:{dsReject(d,8u);}}
 if(state[0u]!=NONE&&state[0u]<frame.counts.x&&(nodes[state[0u]].info.x==6u||nodes[state[0u]].info.x==7u)&&(heap[d+17u]&16u)==0u){state[0u]=heap[d+3u];}
}
fn executeDsCommand4(d:u32,command:u32,a:f32,b:f32,x:f32,y:f32){if(d==0u){return;}let primary=heap[d+9u];
 switch command{
 case 32u:{dsCaptureState(d,u32(clamp(a,1.0,3.0)));}
 case 33u:{let st=heap[d+70u];if(st==0u){return;}dsBegin(d);for(var k=0u;k<heap[d+1u];k++){heap[dsStateAt(d,k,st)]=0u;}dsCommit(d);heap[d+53u]=1u;}
 case 34u:{heap[d+100u]=u32(clamp(a,0.0,f32(heap[dsData(d)+3u])));}
 case 35u:{dsBegin(d);let field=select(91u,92u,a==31.0);let resourceIndex=heap[d+100u];for(var k=0u;k<heap[d+1u];k++){if(dsSelected(d,k)){heap[dsRec(d,k)+field]=resourceIndex;}}dsCommit(d);}
 case 36u:{dsCopy(d);}
 case 37u:{dsPaste(d);}
 case 38u:{dsCancel(d);}
 case 39u:{if(primary!=NONE&&heap[dsRec(d,primary)+1u]==1u){let axis=u32(clamp(a,0.0,1.0));let r=dsRec(d,primary);let index=select(u32(clamp(x,0.0,7.0)),heap[r+48u+axis]-1u,b<0.0&&y==0.0);if(b<0.0){if(heap[r+48u+axis]<=1u){return;}dsBegin(d);heap[r+48u+axis]--;for(var t=index;t<7u;t++){heap[r+50u+axis*16u+t*2u]=heap[r+52u+axis*16u+t*2u];heap[r+51u+axis*16u+t*2u]=heap[r+53u+axis*16u+t*2u];}for(var k=1u;k<heap[d+1u];k++){let c=dsRec(d,k);if(dsAlive(d,k)&&heap[c+2u]==primary){let count=heap[r+48u+axis];heap[c+37u-axis]=min(heap[c+37u-axis],count-1u);heap[c+39u-axis]=min(heap[c+39u-axis],count-heap[c+37u-axis]);}}}else{if(y<0.0||(b==2.0&&y<=0.0)){return;}dsBegin(d);heap[r+48u+axis]=max(heap[r+48u+axis],index+1u);heap[r+50u+axis*16u+index*2u]=u32(clamp(b,0.0,2.0));hsetf(r+51u+axis*16u+index*2u,y);}heap[d+53u]=1u;state[3u]=1u;dsCommit(d);}}
 default:{dsReject(d,8u);}}
 if(state[0u]!=NONE&&state[0u]<frame.counts.x&&(nodes[state[0u]].info.x==6u||nodes[state[0u]].info.x==7u)&&(heap[d+17u]&16u)==0u){state[0u]=heap[d+3u];}
}
fn executeDsCommand5(d:u32,command:u32,a:f32,b:f32,x:f32,y:f32){if(d==0u){return;}let primary=heap[d+9u];
 switch command{
 case 40u:{if(a<32.0||a>8192.0||b<32.0||b>8192.0){dsReject(d,2u);return;}dsBegin(d);hsetf(dsData(d),a);hsetf(dsData(d)+1u,b);heap[d+53u]=1u;state[3u]=1u;dsCommit(d);}
 case 41u:{if(a<.1||a>3600.0){return;}dsBegin(d);let ratio=a/hf(dsData(d)+2u);for(var k=0u;k<heap[d+1u];k++){for(var t=0u;t<6u;t++){let at=dsTrack(d,k,t);for(var j=0u;j<heap[at];j++){hsetf(at+4u+j*4u,hf(at+4u+j*4u)*ratio);}}}hsetf(dsData(d)+2u,a);hsetf(d+35u,min(hf(d+35u),a));dsCommit(d);}
 case 42u:{let source=heap[d+61u];if(!dsValidateBlock(d,source)){dsReject(d,7u);return;}dsCancel(d);for(var j=0u;j<heap[d+29u];j++){heap[dsData(d)+j]=heap[source+j];heap[heap[d+28u]+j]=heap[source+j];}heap[d+25u]=1u;heap[d+26u]=0u;heap[d+95u]=0u;heap[d+70u]=0u;heap[d+72u]=0u;heap[d+17u]&=~(16u|64u);heap[d+53u]=3u;heap[d+8u]++;hsetf(d+35u,0.0);dsSelect(d,NONE,false);state[3u]=1u;}
 case 43u:{hsetf(d+13u,1.0);hsetf(d+14u,40.0);hsetf(d+15u,40.0);}
 case 44u:{heap[d+17u]^=256u;}
 case 45u:{dsSetSelected(d,88u,a);}
 case 46u:{if(primary!=NONE){dsBegin(d);heap[dsRec(d,primary)+85u]=u32(clamp(a,0.0,3.0));let destination=select(primary,u32(max(0.0,b)),b>=0.0);if(!dsAlive(d,destination)){dsCancel(d);dsReject(d,3u);return;}heap[dsRec(d,primary)+86u]=destination;heap[d+53u]=1u;dsCommit(d);}}
 case 47u:{if(a<0.0||a!=floor(a)){dsReject(d,2u);return;}dsBegin(d);for(var k=1u;k<heap[d+1u];k++){if(dsSelected(d,k)){heap[dsRec(d,k)+94u]=u32(a);if(b>0.0){heap[dsRec(d,k)+95u]=63u;}}}heap[d+53u]=3u;state[3u]=1u;dsCommit(d);}
 default:{dsReject(d,8u);}}
 if(state[0u]!=NONE&&state[0u]<frame.counts.x&&(nodes[state[0u]].info.x==6u||nodes[state[0u]].info.x==7u)&&(heap[d+17u]&16u)==0u){state[0u]=heap[d+3u];}
}
fn executeDsCommand6(d:u32,command:u32,a:f32,b:f32,x:f32,y:f32){if(d==0u){return;}let primary=heap[d+9u];
 switch command{
 case 48u:{if(a<0.0||a>1.0||b<0.0||b>1.0||a!=floor(a)||b!=floor(b)||heap[d+118u]==0u){dsReject(d,2u);return;}dsBegin(d);heap[dsData(d)+5u]=u32(a);heap[dsData(d)+6u]=u32(b);state[3u]=1u;dsCommit(d);}
 case 49u:{dsBegin(d);for(var k=1u;k<heap[d+1u];k++){if(dsSelected(d,k)){heap[dsRec(d,k)+95u]=select(0u,63u,a>0.0);}}heap[d+53u]=1u;state[3u]=1u;dsCommit(d);}
 case 50u:{if(heap[d+118u]==0u||a<0.0||a>3.0||a!=floor(a)||b<0.0||b>1.0||b!=floor(b)){dsReject(d,2u);return;}dsBegin(d);let base=dsData(d);if(a<2.0){let mask=1u<<u32(a);heap[base+56u]=(heap[base+56u]&~mask)|select(0u,mask,b>0.0);}else if(a==2.0){heap[base+7u]=u32(b);}else{heap[base+56u]&=~4u;heap[base+57u]=0u;}state[3u]=1u;dsCommit(d);}
 case 51u:{if(heap[d+118u]==0u||a<0.0||a>65535.0||b<65280.0||b>65535.0||a!=floor(a)||b!=floor(b)){dsReject(d,2u);return;}dsBegin(d);let base=dsData(d);heap[base+56u]|=4u;heap[base+57u]=u32(a)|(u32(b)<<16u);state[3u]=1u;dsCommit(d);}
 case 52u:{if(a<0.0||a>127.0||a!=floor(a)||heap[d+118u]==0u){dsReject(d,2u);return;}var count=0u;for(var k=1u;k<heap[d+1u];k++){if(dsSelected(d,k)){let e=extension(nodes[dsNode(d,k)]);if(e!=0u){let info=heap[e+38u];if(info!=0u){heap[info+17u]=u32(a);for(var g=0u;g<heap[info+5u];g++){heap[heap[info+4u]+g*4u+2u]=NONE;}count++;}}}}if(count==0u){dsReject(d,2u);}}
 default:{dsReject(d,8u);}}
 if(state[0u]!=NONE&&state[0u]<frame.counts.x&&(nodes[state[0u]].info.x==6u||nodes[state[0u]].info.x==7u)&&(heap[d+17u]&16u)==0u){state[0u]=heap[d+3u];}
}
// Select a command before entering the large transactional interpreter.
fn dsKey(i:u32,key:u32,mods:u32){
 let request=dsKeyRequest(i,key,mods);
 if(request.x>=0.0){dsCommand(dsOwner(i),u32(request.x),request.y,request.z,0.0,0.0);}
}
fn dsKeyRequest(i:u32,key:u32,mods:u32)->vec3<f32>{let d=dsOwner(i);if(d==0u){return vec3<f32>(-1.0,0.0,0.0);}if(dsEditKey(d,key,mods)){return vec3<f32>(-1.0,0.0,0.0);}let control=(mods&6u)!=0u;let shift=(mods&1u)!=0u;
 if(control&&key==90u){dsUndo(d,shift);return vec3<f32>(-1.0,0.0,0.0);}if(control&&key==89u){dsUndo(d,true);return vec3<f32>(-1.0,0.0,0.0);}if(control&&key==68u){dsDuplicate(d);return vec3<f32>(-1.0,0.0,0.0);}if(control&&key==65u){return vec3<f32>(f32(30u),0.0,0.0);}
 if(control&&key==67u){dsCopy(d);return vec3<f32>(-1.0,0.0,0.0);}if(control&&key==86u){dsPaste(d);return vec3<f32>(-1.0,0.0,0.0);}if(control&&key==88u){dsCopy(d);dsDelete(d);return vec3<f32>(-1.0,0.0,0.0);}
 if(control&&key==71u){dsGroup(d,shift);return vec3<f32>(-1.0,0.0,0.0);}if(key==27u){dsCancel(d);heap[d+12u]=0u;return vec3<f32>(-1.0,0.0,0.0);}if(key==46u||key==8u){if(nodes[i].info.x==33u){return vec3<f32>(f32(28u),0.0,0.0);}else{dsDelete(d);}return vec3<f32>(-1.0,0.0,0.0);}
 if(key==32u&&nodes[i].info.x==33u){heap[d+17u]^=64u;return vec3<f32>(-1.0,0.0,0.0);}if(control&&(key==187u||key==189u)){return vec3<f32>(f32(18u),select(1.25,.8,key==189u),1.0);}
 if(key>=37u&&key<=40u){let delta=select(1.0,10.0,shift)*select(-1.0,1.0,key==39u||key==40u);let axis=select(0u,1u,key==38u||key==40u);dsBegin(d);for(var k=1u;k<heap[d+1u];k++){if(dsTopSelected(d,k)){let r=dsRec(d,k);let parent=heap[r+2u];let field=select(29u+axis,8u+axis,heap[dsRec(d,parent)+1u]==3u&&(heap[d+17u]&32u)==0u);dsWrite(d,k,field,bitcast<u32>(dsNumber(d,k,field)+delta));}}dsCommit(d);}
 return vec3<f32>(-1.0,0.0,0.0);
}
fn executeDsRoute(c:Command,hit:u32)->bool{if((VIEW_FEATURES&32u)==0u){return false;}if(c.kind==15u){dsCommand(dsOwner(c.recipient),c.code,c.data.x,c.data.y,c.position.x,c.position.y);return true;}
 var destination=hit;if(c.kind==1u||c.kind==3u||c.kind==8u){if(state[2u]!=NONE&&dsOwner(state[2u])!=0u&&nodes[state[2u]].info.x>=30u){destination=state[2u];}}
 if(c.kind==5u||c.kind==6u||c.kind==10u){destination=select(c.recipient,state[0u],c.recipient==NONE);}
 if(destination==NONE||destination>=frame.counts.x||nodes[destination].info.x<30u||nodes[destination].info.x>34u){return false;}let d=nodes[destination].aux.x;
 if(c.kind==8u){dsCancel(d);state[2u]=NONE;return true;}if(c.kind==5u){dsKey(destination,c.code,u32(c.data.x));return true;}if(c.kind==6u){dsEditText(d,c.code);return true;}
 if(c.kind==10u&&c.code==38u){for(var j=0u;j<min(state[40u],u32(max(0.0,c.data.x)));j++){dsEditText(d,heap[state[23u]+j]);}return true;}
 if(c.kind<=4u){if(c.kind==1u){state[1u]=hit;}atomicStore(&scratch[44u],destination);atomicStore(&scratch[45u],nodes[destination].info.x);return true;}return false;
}
var<private> designerRequest:vec3<u32>;
var<private> designerArguments:vec4<f32>;
fn dsCommand(d:u32,command:u32,a:f32,b:f32,x:f32,y:f32){designerRequest=vec3<u32>(1u,d,command);designerArguments=vec4<f32>(a,b,x,y);}

fn dsRoute(c:Command,hit:u32)->bool{
 if((VIEW_FEATURES&32u)==0u){return false;}
 var destination=hit;if(c.kind==1u||c.kind==3u||c.kind==8u){if(state[2u]!=NONE&&dsOwner(state[2u])!=0u&&nodes[state[2u]].info.x>=30u){destination=state[2u];}}
 if(c.kind==5u||c.kind==6u||c.kind==10u){destination=select(c.recipient,state[0u],c.recipient==NONE);}
 if(c.kind!=15u){if(destination==NONE||destination>=frame.counts.x||nodes[destination].info.x<30u||nodes[destination].info.x>34u){return false;}if(c.kind>6u&&c.kind!=8u&&!(c.kind==10u&&c.code==38u)){return false;}}
 atomicStore(&scratch[36u],1u);atomicStore(&scratch[37u],atomicLoad(&scratch[9u])-1u);atomicStore(&scratch[38u],hit);return true;
}
@compute @workgroup_size(1)
fn applyDesignerInput(){
 if(atomicLoad(&scratch[36u])==0u){return;}atomicStore(&scratch[36u],0u);
 _=executeDsRoute(inputCommand(atomicLoad(&scratch[37u])),atomicLoad(&scratch[38u]));
 finishDesignerCommit();
 if(designerRequest.x!=0u){for(var j=0u;j<3u;j++){atomicStore(&scratch[20u+j],designerRequest[j]);}for(var j=0u;j<4u;j++){atomicStore(&scratch[23u+j],bitcast<u32>(designerArguments[j]));}}
}

@compute @workgroup_size(1)
fn applyDesignerCommands0(){
 if(atomicLoad(&scratch[20u])==0u){return;}
 let d=atomicLoad(&scratch[21u]);let op=atomicLoad(&scratch[22u]);if(min(op/8u,6u)!=0u){return;}atomicStore(&scratch[20u],0u);var args:vec4<f32>;for(var j=0u;j<4u;j++){args[j]=bitcast<f32>(atomicLoad(&scratch[23u+j]));}
 for(var k=0u;k<max(1u,atomicLoad(&scratch[12u]));k++){designerCommitOwner=0u;executeDsCommand0(d,op,args.x,args.y,args.z,args.w);finishDesignerCommit();}
}
@compute @workgroup_size(1)
fn applyDesignerCommands1(){
 if(atomicLoad(&scratch[20u])==0u){return;}
 let d=atomicLoad(&scratch[21u]);let op=atomicLoad(&scratch[22u]);if(min(op/8u,6u)!=1u){return;}atomicStore(&scratch[20u],0u);var args:vec4<f32>;for(var j=0u;j<4u;j++){args[j]=bitcast<f32>(atomicLoad(&scratch[23u+j]));}
 for(var k=0u;k<max(1u,atomicLoad(&scratch[12u]));k++){designerCommitOwner=0u;executeDsCommand1(d,op,args.x,args.y,args.z,args.w);finishDesignerCommit();}
}
@compute @workgroup_size(1)
fn applyDesignerCommands2(){
 if(atomicLoad(&scratch[20u])==0u){return;}
 let d=atomicLoad(&scratch[21u]);let op=atomicLoad(&scratch[22u]);if(min(op/8u,6u)!=2u){return;}atomicStore(&scratch[20u],0u);var args:vec4<f32>;for(var j=0u;j<4u;j++){args[j]=bitcast<f32>(atomicLoad(&scratch[23u+j]));}
 for(var k=0u;k<max(1u,atomicLoad(&scratch[12u]));k++){designerCommitOwner=0u;executeDsCommand2(d,op,args.x,args.y,args.z,args.w);finishDesignerCommit();}
}
@compute @workgroup_size(1)
fn applyDesignerCommands3(){
 if(atomicLoad(&scratch[20u])==0u){return;}
 let d=atomicLoad(&scratch[21u]);let op=atomicLoad(&scratch[22u]);if(min(op/8u,6u)!=3u){return;}atomicStore(&scratch[20u],0u);var args:vec4<f32>;for(var j=0u;j<4u;j++){args[j]=bitcast<f32>(atomicLoad(&scratch[23u+j]));}
 for(var k=0u;k<max(1u,atomicLoad(&scratch[12u]));k++){designerCommitOwner=0u;executeDsCommand3(d,op,args.x,args.y,args.z,args.w);finishDesignerCommit();}
}
@compute @workgroup_size(1)
fn applyDesignerCommands4(){
 if(atomicLoad(&scratch[20u])==0u){return;}
 let d=atomicLoad(&scratch[21u]);let op=atomicLoad(&scratch[22u]);if(min(op/8u,6u)!=4u){return;}atomicStore(&scratch[20u],0u);var args:vec4<f32>;for(var j=0u;j<4u;j++){args[j]=bitcast<f32>(atomicLoad(&scratch[23u+j]));}
 for(var k=0u;k<max(1u,atomicLoad(&scratch[12u]));k++){designerCommitOwner=0u;executeDsCommand4(d,op,args.x,args.y,args.z,args.w);finishDesignerCommit();}
}
@compute @workgroup_size(1)
fn applyDesignerCommands5(){
 if(atomicLoad(&scratch[20u])==0u){return;}
 let d=atomicLoad(&scratch[21u]);let op=atomicLoad(&scratch[22u]);if(min(op/8u,6u)!=5u){return;}atomicStore(&scratch[20u],0u);var args:vec4<f32>;for(var j=0u;j<4u;j++){args[j]=bitcast<f32>(atomicLoad(&scratch[23u+j]));}
 for(var k=0u;k<max(1u,atomicLoad(&scratch[12u]));k++){designerCommitOwner=0u;executeDsCommand5(d,op,args.x,args.y,args.z,args.w);finishDesignerCommit();}
}
@compute @workgroup_size(1)
fn applyDesignerCommands6(){
 if(atomicLoad(&scratch[20u])==0u){return;}
 let d=atomicLoad(&scratch[21u]);let op=atomicLoad(&scratch[22u]);if(min(op/8u,6u)!=6u){return;}atomicStore(&scratch[20u],0u);var args:vec4<f32>;for(var j=0u;j<4u;j++){args[j]=bitcast<f32>(atomicLoad(&scratch[23u+j]));}
 for(var k=0u;k<max(1u,atomicLoad(&scratch[12u]));k++){designerCommitOwner=0u;executeDsCommand6(d,op,args.x,args.y,args.z,args.w);finishDesignerCommit();}
}

// Transaction validation/history is compiled once per dispatch, not inlined at
// every mutation branch. Input preparation finishes an existing edit first.
var<private> designerCommitOwner:u32;
fn dsCommit(d:u32){designerCommitOwner=d;}
var<private> designerCapturedState:vec2<u32>;
fn dsCaptureTransition(d:u32,s:u32){designerCapturedState=vec2<u32>(d,s);}
fn finishDesignerCommit(){
 if(designerCommitOwner!=0u){executeDsCommit(designerCommitOwner);designerCommitOwner=0u;}
 // Capture changes state only after validation/rollback, as in the immediate
 // interpreter. A failed capture cannot select a state removed by rollback.
 if(designerCapturedState.x!=0u){dsChangeState(designerCapturedState.x,designerCapturedState.y);designerCapturedState.x=0u;}
}
@compute @workgroup_size(1)
fn finishDesignerEdit(){
 var d=0u;var route=false;
 if(atomicLoad(&scratch[36u])!=0u){
  let c=inputCommand(atomicLoad(&scratch[37u]));
  if(c.kind==2u){d=dsOwner(atomicLoad(&scratch[38u]));route=true;}
 }
 if(d==0u&&atomicLoad(&scratch[20u])!=0u&&atomicLoad(&scratch[22u])!=38u){d=atomicLoad(&scratch[21u]);}
 if(d==0u||heap[d+45u]==NONE){return;}
 let valid=dsFinishEdit(d);
 finishDesignerCommit();
 if(!valid){if(route){atomicStore(&scratch[36u],0u);}else{atomicStore(&scratch[20u],0u);}}
}

@compute @workgroup_size(1)
fn applyDesignerSurfaceInput(){
 if(atomicLoad(&scratch[45u])!=30u){return;}atomicStore(&scratch[45u],0u);
 dsSurfacePointer(atomicLoad(&scratch[44u]),inputCommand(atomicLoad(&scratch[37u])));
 finishDesignerCommit();
}

@compute @workgroup_size(1)
fn applyDesignerTreeInput(){
 if(atomicLoad(&scratch[45u])!=31u){return;}atomicStore(&scratch[45u],0u);
 dsTreePointer(atomicLoad(&scratch[44u]),inputCommand(atomicLoad(&scratch[37u])));
 finishDesignerCommit();
}

@compute @workgroup_size(1)
fn applyDesignerInspectorInput(){
 if(atomicLoad(&scratch[45u])!=32u){return;}atomicStore(&scratch[45u],0u);
 dsInspectorPointer(atomicLoad(&scratch[44u]),inputCommand(atomicLoad(&scratch[37u])));
 finishDesignerCommit();
}

@compute @workgroup_size(1)
fn applyDesignerTimelineInput(){
 if(atomicLoad(&scratch[45u])!=33u){return;}atomicStore(&scratch[45u],0u);
 dsTimelinePointer(atomicLoad(&scratch[44u]),inputCommand(atomicLoad(&scratch[37u])));
 finishDesignerCommit();
}

@compute @workgroup_size(1)
fn applyDesignerColorInput(){
 if(atomicLoad(&scratch[45u])!=34u){return;}atomicStore(&scratch[45u],0u);
 dsColorPointer(atomicLoad(&scratch[44u]),inputCommand(atomicLoad(&scratch[37u])));
 finishDesignerCommit();
}
