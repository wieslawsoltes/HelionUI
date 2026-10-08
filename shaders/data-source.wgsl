// Mutable keyed data. Rows stay in stable slots; sorted/filter indexes contain slots.
// Payload ingestion and commits are ordered; lookup is open-addressed, not a row scan.
fn sourceHash(key:u32)->u32 { return (key^(key>>16u))*0x45d9f3bu; }
fn sourceFind(d:u32,key:u32)->vec2<u32> {
 let mask=heap[d+8u];let keys=heap[d+6u];let slots=heap[d+7u];var bucket=sourceHash(key)&mask;var hole=NONE;
 for(var j=0u;j<=mask;j++){let slot=heap[slots+bucket];if(slot==NONE){return vec2<u32>(NONE,select(hole,bucket,hole==NONE));}if(slot==0xfffffffeu){if(hole==NONE){hole=bucket;}}else if(heap[keys+bucket]==key){return vec2<u32>(slot,bucket);}bucket=(bucket+1u)&mask;}
 return vec2<u32>(NONE,hole);
}
fn sourceAlive(t:u32,row:u32)->bool {if(row==NONE||row>=heap[t]){return false;}let d=heap[t+35u];return d==0u||heap[heap[d+5u]+row]!=0u;}
fn sourceReject(d:u32,reason:u32){heap[d+18u]+=1u;heap[d+19u]=reason;}
fn sourceDirty(){state[4u]=1u;state[49u]=1u;}
fn sourcePackedWords(t:u32,d:u32,skipSlot:u32,skipMask:u32)->u32{var words=0u;for(var row=0u;row<heap[d+11u];row++){if(heap[heap[d+5u]+row]==0u){continue;}for(var col=0u;col<heap[t+2u];col++){if(heap[heap[t+9u]+col*8u+2u]==0u&&!(row==skipSlot&&(skipMask&(1u<<col))!=0u)){words+=heap[heap[heap[t+3u]+row*8u+col]]+1u;}}}return words;}
fn compactSourceStrings(t:u32,d:u32,skipSlot:u32,skipMask:u32){let spare=heap[d+20u];var used=0u;for(var row=0u;row<heap[d+11u];row++){if(heap[heap[d+5u]+row]==0u){continue;}for(var col=0u;col<heap[t+2u];col++){if(heap[heap[t+9u]+col*8u+2u]!=0u||(row==skipSlot&&(skipMask&(1u<<col))!=0u)){continue;}let cell=heap[t+3u]+row*8u+col;let src=heap[cell];let size=heap[src]+1u;for(var k=0u;k<size;k++){heap[spare+used+k]=heap[src+k];}heap[cell]=spare+used;used+=size;}}heap[d+20u]=heap[d+12u];heap[d+12u]=spare;heap[d+14u]=used;heap[d+21u]++;}
fn sourceClear(t:u32,d:u32){for(var j=0u;j<=heap[d+8u];j++){heap[heap[d+7u]+j]=NONE;}for(var j=0u;j<heap[d+11u];j++){heap[heap[d+5u]+j]=0u;}heap[d+2u]=0u;heap[d+10u]=0u;heap[d+11u]=0u;heap[d+14u]=0u;heap[d+3u]+=1u;heap[t]=0u;heap[t+17u]=NONE;heap[t+16u]=NONE;heap[t+18u]=0u;sourceDirty();}
fn applyDataSource(i:u32,command:u32,length:u32,parameter:f32,sequence:u32) {
 if(i>=frame.counts.x||nodes[i].info.x!=11u){state[43u]+=1u;return;}let t=nodes[i].action.w;let d=heap[t+35u];if(d==0u){state[43u]+=1u;return;}
 heap[d+17u]=sequence;heap[d+19u]=0u;
 if(command==2u){if(length<heap[t+2u]){heap[t+11u]=length;heap[t+12u]=select(0u,1u,parameter>0.0);sourceDirty();}return;}
 let base=heap[d+15u];if(command==3u){let slot=sourceFind(d,heap[base]).x;if(slot!=NONE){heap[t+17u]=slot;heap[t+18u]=0u;state[4u]=1u;}return;}
 if(command!=1u||length<4u||length>heap[d+16u]||heap[base]!=1u||heap[base+3u]!=length){sourceReject(d,1u);return;}
 if(heap[base+2u]!=NONE&&heap[base+2u]!=heap[d+3u]){sourceReject(d,2u);return;}
 let end=base+length;var at=base+4u;
 // Replacement transactions are capacity-checked in full before clearing old data.
 if(at+4u<=end&&heap[at]==3u){var cursor=at;var newRows=0u;var strings=0u;for(var op=0u;op<heap[base+1u];op++){if(cursor+4u>end){sourceReject(d,1u);return;}let mode=heap[cursor];let stop=cursor+heap[cursor+3u];if(stop>end||stop<cursor+4u||((op==0u&&mode!=3u)||(op>0u&&mode!=1u))){sourceReject(d,1u);return;}var p=cursor+4u;if(mode==1u){newRows++;for(var col=0u;col<heap[t+2u];col++){if((heap[cursor+2u]&(1u<<col))==0u){sourceReject(d,1u);return;}if(p>=stop){sourceReject(d,1u);return;}if(heap[heap[t+9u]+col*8u+2u]==0u){let size=heap[p]+1u;if(size>stop-p){sourceReject(d,1u);return;}strings+=size;p+=size;}else{p++;}}}if(p!=stop){sourceReject(d,1u);return;}cursor=stop;}
  if(cursor!=end||newRows>heap[d+1u]||strings>heap[d+13u]){sourceReject(d,3u);return;}
 }
 for(var op=0u;op<heap[base+1u];op++) {
  if(at+4u>end){sourceReject(d,1u);break;}let mode=heap[at];let key=heap[at+1u];let mask=heap[at+2u];let size=heap[at+3u];if(size<4u||size>end-at){sourceReject(d,1u);break;}let stop=at+size;
  if(mode==3u){if(op!=0u||size!=4u){sourceReject(d,1u);break;}sourceClear(t,d);at=stop;continue;}
  if(key==NONE||mode<1u||mode>4u){sourceReject(d,1u);at=stop;continue;}
  let found=sourceFind(d,key);var slot=found.x;
  if(mode==2u){if(slot!=NONE){heap[heap[d+5u]+slot]=0u;heap[heap[d+7u]+found.y]=0xfffffffeu;heap[heap[d+9u]+heap[d+10u]]=slot;heap[d+10u]++;heap[d+2u]--;heap[d+3u]++;if(heap[t+17u]==slot){heap[t+17u]=NONE;heap[t+18u]=0u;}sourceDirty();}at=stop;continue;}
  if(mode==4u&&slot==NONE){sourceReject(d,4u);at=stop;continue;}
  var offsets:array<u32,8>;var p=at+4u;var stringWords=0u;var growingMask=0u;var valid=true;
  for(var col=0u;col<heap[t+2u];col++){offsets[col]=0u;if((mask&(1u<<col))==0u){if(mode==1u){valid=false;}continue;}if(p>=stop){valid=false;break;}offsets[col]=p;if(heap[heap[t+9u]+col*8u+2u]==0u){let len=heap[p];if(len>stop-p-1u){valid=false;break;}if(slot==NONE||len>heap[heap[heap[t+3u]+slot*8u+col]]){stringWords+=len+1u;growingMask|=1u<<col;}p+=len+1u;}else{p++;}}
  if(!valid||p!=stop){sourceReject(d,1u);at=stop;continue;}
  if(stringWords>heap[d+13u]-heap[d+14u]){let packed=sourcePackedWords(t,d,slot,growingMask);if(packed>heap[d+13u]||stringWords>heap[d+13u]-packed){sourceReject(d,3u);at=stop;continue;}compactSourceStrings(t,d,slot,growingMask);}
  if(stringWords>heap[d+13u]-heap[d+14u]||(slot==NONE&&(found.y==NONE||heap[d+2u]>=heap[d+1u]))){sourceReject(d,3u);at=stop;continue;}
  let inserted=slot==NONE;
  if(slot==NONE){if(heap[d+10u]>0u){heap[d+10u]--;slot=heap[heap[d+9u]+heap[d+10u]];}else{slot=heap[d+11u];heap[d+11u]++;heap[t]=heap[d+11u];}heap[heap[d+6u]+found.y]=key;heap[heap[d+7u]+found.y]=slot;heap[heap[d+4u]+slot]=key;heap[heap[d+5u]+slot]=1u;heap[d+2u]++;}
  for(var col=0u;col<heap[t+2u];col++){let inputAt=offsets[col];if(inputAt==0u){continue;}let dest=heap[t+3u]+slot*8u+col;if(heap[heap[t+9u]+col*8u+2u]==0u){let n=heap[inputAt]+1u;var output=heap[dest];let allocate=inserted||n>heap[output]+1u;if(allocate){output=heap[d+12u]+heap[d+14u];heap[d+14u]+=n;}for(var j=0u;j<n;j++){heap[output+j]=heap[inputAt+j];}heap[dest]=output;}else{heap[dest]=heap[inputAt];}}
  if(heap[t+17u]==slot){heap[t+18u]=0u;}heap[d+3u]++;state[4u]=1u;if(inserted||(mask&(1u<<heap[t+11u]))!=0u){state[49u]=1u;}at=stop;
 }
}
