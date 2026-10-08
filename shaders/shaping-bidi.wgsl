// UAX #9 paragraph processing: explicit levels and isolates, isolating-run
// sequences, weak/neutral/bracket resolution, implicit levels and L1 resets.
// Reordering is performed after OpenType substitution, using inherited levels.
fn shBidiOriginal(r:u32,i:u32)->u32{return (heap[shGlyph(r,i)+5u]>>16u)&31u;}
fn shBidiType(r:u32,seq:u32,i:u32)->u32{return heap[shGlyph(r,heap[seq+i])+18u];}
fn shBidiSet(r:u32,seq:u32,i:u32,t:u32){heap[shGlyph(r,heap[seq+i])+18u]=t;}
fn shBidiStrong(t:u32)->u32{if(t==0u){return 0u;}if(t==1u||t==2u||t==5u||t==13u){return 1u;}return 2u;}
fn shBidiNeutral(t:u32)->bool{return t==7u||t==8u||t==9u||t==10u||(t>=19u&&t<=22u);}
fn shBidiBase(r:u32,start:u32,end:u32,defaultLevel:u32)->u32{var isolate=0u;for(var i=start;i<end;i++){let t=shBidiOriginal(r,i);if(t>=19u&&t<=21u){isolate++;}else if(t==22u){if(isolate==0u){break;}isolate--;}else if(isolate==0u){if(t==0u){return 0u;}if(t==1u||t==13u){return 1u;}}}return defaultLevel;}
fn shBidiSequence(r:u32,seq:u32,n:u32,sos:u32,eos:u32,level:u32,pairs:u32){
 var previous=sos;
 for(var i=0u;i<n;i++){var t=shBidiType(r,seq,i);if(t==17u){t=previous;shBidiSet(r,seq,i,t);}previous=t;if(t>=19u&&t<=22u){previous=10u;}}
 var strong=sos;for(var i=0u;i<n;i++){let t=shBidiType(r,seq,i);if(t==0u||t==1u||t==13u){strong=t;}else if(t==2u&&strong==13u){shBidiSet(r,seq,i,5u);}}
 for(var i=0u;i<n;i++){if(shBidiType(r,seq,i)==13u){shBidiSet(r,seq,i,1u);}}
 for(var i=1u;i+1u<n;i++){let t=shBidiType(r,seq,i);let a=shBidiType(r,seq,i-1u);let b=shBidiType(r,seq,i+1u);if((t==3u&&a==2u&&b==2u)||(t==6u&&a==b&&(a==2u||a==5u))){shBidiSet(r,seq,i,a);}}
 var at=0u;while(at<n){if(shBidiType(r,seq,at)!=4u){at++;continue;}let start=at;while(at<n&&shBidiType(r,seq,at)==4u){at++;}var before=sos;var after=eos;if(start>0u){before=shBidiType(r,seq,start-1u);}if(at<n){after=shBidiType(r,seq,at);}if(before==2u||after==2u){for(var i=start;i<at;i++){shBidiSet(r,seq,i,2u);}}}
 for(var i=0u;i<n;i++){let t=shBidiType(r,seq,i);if(t==3u||t==4u||t==6u){shBidiSet(r,seq,i,10u);}}
 strong=sos;for(var i=0u;i<n;i++){let t=shBidiType(r,seq,i);if(t==0u||t==1u){strong=t;}else if(t==2u&&strong==0u){shBidiSet(r,seq,i,0u);}}
 // Paired-bracket stack is bounded by the UAX #9 maximum of 63 open brackets.
 let stack=heap[r+31u];var top=0u;var pairCount=0u;
 for(var i=0u;i<n;i++){if(shBidiType(r,seq,i)!=10u){continue;}let g=shGlyph(r,heap[seq+i]);let cp=heap[g+3u];let u=heap[r+12u];let b=ucMap(heap[u+8u],heap[u+9u],cp,3u);if(b==0u){continue;}
  if(heap[b+2u]==1u){if(top==63u){break;}heap[stack+top*2u]=i;var other=heap[b+1u];if(other==0x232au){other=0x3009u;}heap[stack+top*2u+1u]=other;top++;}
  else{var close=cp;if(close==0x232au){close=0x3009u;}var j=top;while(j>0u){j--;if(heap[stack+j*2u+1u]==close){heap[pairs+pairCount*2u]=heap[stack+j*2u];heap[pairs+pairCount*2u+1u]=i;pairCount++;top=j;break;}}}
 }
 for(var i=1u;i<pairCount;i++){let a=heap[pairs+i*2u];let b=heap[pairs+i*2u+1u];var j=i;while(j>0u&&heap[pairs+(j-1u)*2u]>a){heap[pairs+j*2u]=heap[pairs+(j-1u)*2u];heap[pairs+j*2u+1u]=heap[pairs+(j-1u)*2u+1u];j--;}heap[pairs+j*2u]=a;heap[pairs+j*2u+1u]=b;}
 let embedding=level&1u;
 for(var k=0u;k<pairCount;k++){let a=heap[pairs+k*2u];let b=heap[pairs+k*2u+1u];var found=false;var opposite=false;for(var i=a+1u;i<b;i++){let t=shBidiStrong(shBidiType(r,seq,i));if(t==embedding){found=true;break;}if(t<2u){opposite=true;}}
  var resolved=embedding;if(!found&&opposite){var before=sos;var j=a;while(j>0u){j--;let t=shBidiStrong(shBidiType(r,seq,j));if(t<2u){before=t;break;}}resolved=select(embedding,1u-embedding,before!=embedding);}
  if(found||opposite){shBidiSet(r,seq,a,resolved);shBidiSet(r,seq,b,resolved);for(var side=0u;side<2u;side++){var j=select(a,b,side==1u)+1u;while(j<n&&shBidiOriginal(r,heap[seq+j])==17u){shBidiSet(r,seq,j,resolved);j++;}}}
 }
 at=0u;while(at<n){if(!shBidiNeutral(shBidiType(r,seq,at))){at++;continue;}let start=at;while(at<n&&shBidiNeutral(shBidiType(r,seq,at))){at++;}var before=sos;var after=eos;if(start>0u){before=shBidiStrong(shBidiType(r,seq,start-1u));}if(at<n){after=shBidiStrong(shBidiType(r,seq,at));}let resolved=select(embedding,before,before==after&&before<2u);for(var i=start;i<at;i++){shBidiSet(r,seq,i,resolved);}}
 for(var i=0u;i<n;i++){let g=shGlyph(r,heap[seq+i]);let t=heap[g+18u];var l=heap[g+6u];if((l&1u)==0u){if(t==1u){l++;}else if(t==2u||t==5u){l+=2u;}}else if(t==0u||t==2u||t==5u){l++;}heap[g+6u]=l;}
}
fn shBidiReset(t:u32)->bool{return t==9u||t==18u||t==11u||t==12u||t==14u||t==15u||t==16u||(t>=19u&&t<=22u);}
fn shBidiParagraph(r:u32,start:u32,end:u32,base:u32){
 let stack=heap[r+30u];heap[stack]=base;heap[stack+1u]=2u;heap[stack+2u]=0u;heap[stack+3u]=0xffffffffu;var top=0u;var overflowIsolate=0u;var overflowEmbedding=0u;var validIsolates=0u;
 for(var i=start;i<end;i++){if(!shStep(r)){return;}let g=shGlyph(r,i);let original=shBidiOriginal(r,i);var t=original;let level=heap[stack+top*4u];let overrideState=heap[stack+top*4u+1u];heap[g+6u]=level;heap[g+14u]=0xffffffffu;
  if(t==11u||t==12u||t==14u||t==15u){let rtl=t==14u||t==15u;let next=select((level+2u)&0xfffffffeu,(level+1u)|1u,rtl);if(overflowIsolate==0u&&overflowEmbedding==0u&&next<=125u){top++;heap[stack+top*4u]=next;heap[stack+top*4u+1u]=select(2u,select(0u,1u,rtl),t==12u||t==15u);heap[stack+top*4u+2u]=0u;}else if(overflowIsolate==0u){overflowEmbedding++;}heap[g+18u]=18u;heap[g+19u]|=1u;continue;}
  if(t>=19u&&t<=21u){var rtl=t==21u;if(t==19u){rtl=shBidiBase(r,i+1u,end,0u)==1u;}heap[g+18u]=select(t,overrideState,overrideState<2u);let next=select((level+2u)&0xfffffffeu,(level+1u)|1u,rtl);if(overflowIsolate==0u&&overflowEmbedding==0u&&next<=125u){top++;heap[stack+top*4u]=next;heap[stack+top*4u+1u]=2u;heap[stack+top*4u+2u]=1u;heap[stack+top*4u+3u]=i;validIsolates++;}else{overflowIsolate++;}heap[g+19u]|=1u;continue;}
  if(t==22u){if(overflowIsolate>0u){overflowIsolate--;}else if(validIsolates>0u){overflowEmbedding=0u;while(top>0u&&heap[stack+top*4u+2u]==0u){top--;}let opening=heap[stack+top*4u+3u];if(opening!=0xffffffffu){heap[shGlyph(r,opening)+14u]=i;}if(top>0u){top--;}validIsolates--;}heap[g+6u]=heap[stack+top*4u];let over=heap[stack+top*4u+1u];heap[g+18u]=select(t,over,over<2u);heap[g+19u]|=1u;continue;}
  if(t==16u){if(overflowIsolate==0u){if(overflowEmbedding>0u){overflowEmbedding--;}else if(top>0u&&heap[stack+top*4u+2u]==0u){top--;}}heap[g+18u]=18u;heap[g+19u]|=1u;continue;}
  if(t==18u){heap[g+19u]|=1u;}else if(overrideState<2u){t=overrideState;}heap[g+18u]=t;
 }
 let runs=heap[r+8u];let seq=runs+heap[r+1u]*5u;let pairs=seq+heap[r+1u];var count=0u;var last=0xffffffffu;
 for(var i=start;i<end;i++){let g=shGlyph(r,i);if(heap[g+18u]==18u){continue;}let level=heap[g+6u];if(last==0xffffffffu||heap[shGlyph(r,last)+6u]!=level){let p=runs+count*5u;heap[p]=i;heap[p+1u]=i+1u;heap[p+2u]=0xffffffffu;heap[p+3u]=0u;heap[p+4u]=level;count++;}heap[runs+(count-1u)*5u+1u]=i+1u;heap[g+7u]=count-1u;last=i;}
 for(var j=0u;j<count;j++){let p=runs+j*5u;let lastGlyph=heap[p+1u]-1u;let original=shBidiOriginal(r,lastGlyph);let close=heap[shGlyph(r,lastGlyph)+14u];if(original>=19u&&original<=21u&&close!=0xffffffffu){let next=heap[shGlyph(r,close)+7u];if(next!=j&&next<count){heap[p+2u]=next;heap[runs+next*5u+3u]=1u;}}}
 for(var j=0u;j<count;j++){let p=runs+j*5u;if(heap[p+3u]!=0u){continue;}var n=0u;var next=j;var guard=0u;while(next!=0xffffffffu&&guard<count){let q=runs+next*5u;for(var i=heap[q];i<heap[q+1u];i++){if(heap[shGlyph(r,i)+18u]!=18u){heap[seq+n]=i;n++;}}next=heap[q+2u];guard++;}
  if(n==0u){continue;}let first=heap[seq];let lastGlyph=heap[seq+n-1u];let level=heap[p+4u];var before=base;var at=first;while(at>start){at--;if(heap[shGlyph(r,at)+18u]!=18u){before=heap[shGlyph(r,at)+6u];break;}}var after=base;at=lastGlyph+1u;let lastType=shBidiOriginal(r,lastGlyph);if(!(lastType>=19u&&lastType<=21u)){while(at<end){if(heap[shGlyph(r,at)+18u]!=18u){after=heap[shGlyph(r,at)+6u];break;}at++;}}
  shBidiSequence(r,seq,n,max(level,before)&1u,max(level,after)&1u,level,pairs);
 }
 for(var i=start;i<end;i++){let t=shBidiOriginal(r,i);if(t==7u||t==8u){heap[shGlyph(r,i)+6u]=base;var p=i;while(p>start&&shBidiReset(shBidiOriginal(r,p-1u))){p--;heap[shGlyph(r,p)+6u]=base;}}}
 var p=end;while(p>start&&shBidiReset(shBidiOriginal(r,p-1u))){p--;heap[shGlyph(r,p)+6u]=base;}
 // X9 characters have no visual glyph. Assign adjacent levels for retained mapping.
 var prior=base;for(var i=start;i<end;i++){let g=shGlyph(r,i);if(heap[g+18u]==18u){heap[g+6u]=prior;}else{prior=heap[g+6u];}}
}
fn shBidi(r:u32){var start=0u;let n=heap[r+7u];while(start<n){var end=start;while(end<n&&shBidiOriginal(r,end)!=7u){end++;}var base=select(0u,1u,heap[r+17u]==2u);if(heap[r+17u]==0u){base=shBidiBase(r,start,end,0u);}if(start==0u){heap[r+43u]=base;}shBidiParagraph(r,start,end,base);if(end<n){let g=shGlyph(r,end);heap[g+6u]=base;heap[g+18u]=7u;heap[g+19u]|=1u;}start=end+1u;}}
