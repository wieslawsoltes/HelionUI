// Resident gap-buffer editor. A document has a single ordered mutation owner;
// immutable row drawing is dispatched separately, with no inter-workgroup locks.
fn isEditor(i:u32)->bool {if((VIEW_FEATURES&1u)==0u){return false;}return i!=NONE && i<frame.counts.x && (nodes[i].info.x==22u||nodes[i].info.x==23u);}
fn ed(i:u32)->u32{return nodes[i].aux.x;}
fn edChar(d:u32,p:u32)->u32 {if(p>=heap[d+4u]){return 0u;}return heap[heap[d]+p+select(0u,heap[d+3u]-heap[d+2u],p>=heap[d+2u])];}
fn edSel(d:u32,k:u32)->u32{return heap[d+8u]+k*2u;}
fn edCaret(d:u32)->u32{return heap[edSel(d,0u)];}
fn edWord(c:u32)->bool{return (c>=48u&&c<=57u)||(c>=65u&&c<=90u)||(c>=97u&&c<=122u)||c==95u||c==36u||c>127u;}
fn edLower(c:u32)->u32{return select(c,c+32u,c>=65u&&c<=90u);}
fn edLineStart(d:u32,p:u32)->u32{var x=min(p,heap[d+4u]);while(x>0u&&edChar(d,x-1u)!=10u){x--;}return x;}
fn edLineEnd(d:u32,p:u32)->u32{var x=min(p,heap[d+4u]);while(x<heap[d+4u]&&edChar(d,x)!=10u){x++;}return x;}
fn edColumn(d:u32,start:u32,end:u32)->u32{var col=0u;for(var p=start;p<min(end,heap[d+4u]);p++){if(edChar(d,p)==9u){col+=heap[d+36u]-col%heap[d+36u];}else if(!isCombining(edChar(d,p))){col++;}}return col;}
fn edAtColumn(d:u32,start:u32,end:u32,column:u32)->u32{var col=0u;var p=start;while(p<end){let c=edChar(d,p);let step=select(select(1u,0u,isCombining(c)),heap[d+36u]-col%heap[d+36u],c==9u);if(col+step>column){break;}col+=step;p++;}return p;}
fn edPrev(d:u32,p:u32,word:bool)->u32{var x=min(p,heap[d+4u]);if(word){while(x>0u&&!edWord(edChar(d,x-1u))){x--;}while(x>0u&&edWord(edChar(d,x-1u))){x--;}}else if(heap[d+79u]!=0u){return ucPrevious(heap[d+79u],heap[d],heap[d+4u],x,heap[d+2u],heap[d+3u]);}else if(x>0u){x--;while(x>0u&&isCombining(edChar(d,x))){x--;}}return x;}
fn edNext(d:u32,p:u32,word:bool)->u32{var x=min(p,heap[d+4u]);if(word){while(x<heap[d+4u]&&edWord(edChar(d,x))){x++;}while(x<heap[d+4u]&&!edWord(edChar(d,x))){x++;}}else if(heap[d+79u]!=0u){return ucNext(heap[d+79u],heap[d],heap[d+4u],x,heap[d+2u],heap[d+3u]);}else if(x<heap[d+4u]){x++;while(x<heap[d+4u]&&isCombining(edChar(d,x))){x++;}}return x;}
fn edMoveGap(d:u32,p:u32){let data=heap[d];var a=heap[d+2u];var b=heap[d+3u];while(a>p){a--;b--;heap[data+b]=heap[data+a];}while(a<p){heap[data+a]=heap[data+b];a++;b++;}heap[d+2u]=a;heap[d+3u]=b;}
fn edMapPosition(p:u32,lo:u32,hi:u32,n:u32)->u32{if(p<lo){return p;}if(p<=hi){return lo+n;}return p-(hi-lo)+n;}
fn edMapSnippet(d:u32,lo:u32,hi:u32,count:u32){if(heap[d+73u]==0u){return;}for(var k=0u;k<heap[d+71u];k++){let a=heap[d+70u]+k*3u;let start=heap[a+1u];heap[a+1u]=select(edMapPosition(start,lo,hi,count),start,start<=lo);heap[a+2u]=edMapPosition(heap[a+2u],lo,hi,count);}}
fn edBegin(d:u32){heap[d+66u]=0u;heap[d+14u]++;hsetf(d+15u,frame.viewport.w);}
fn edReserveHistory(d:u32,words:u32){
 if(words>heap[d+11u]){heap[d+12u]=0u;heap[d+13u]=0u;heap[d+40u]++;heap[d+66u]=1u;return;}
 if(heap[d+12u]+words>heap[d+11u]){heap[d+12u]=0u;heap[d+13u]=0u;heap[d+40u]++;}
}
fn edSplice(d:u32,loIn:u32,hiIn:u32,src:u32,count:u32,journal:bool)->bool {
 let lo=min(loIn,heap[d+4u]);let hi=clamp(hiIn,lo,heap[d+4u]);let removed=hi-lo;let length=heap[d+4u];
 if(removed==0u&&count==0u){return true;}
 if(count>heap[d+1u]-(length-removed)){heap[d+39u]++;return false;}
 var record=0u;var recordSize=72u+removed+count;
 if(journal&&heap[d+66u]==0u){
  if(heap[d+12u]+recordSize>heap[d+11u]){heap[d+12u]=0u;heap[d+13u]=0u;heap[d+40u]++;}
  if(recordSize<=heap[d+11u]){record=heap[d+10u]+heap[d+12u];heap[record]=recordSize;heap[record+1u]=lo;heap[record+2u]=removed;heap[record+3u]=count;heap[record+4u]=heap[d+14u];heap[record+5u]=heap[d+9u];
   for(var k=0u;k<32u;k++){heap[record+7u+k]=heap[heap[d+8u]+k];}
   for(var k=0u;k<removed;k++){heap[record+71u+k]=edChar(d,lo+k);}
   for(var k=0u;k<count;k++){heap[record+71u+removed+k]=heap[src+k];}
  }
 }
 edMapSnippet(d,lo,hi,count);edMoveGap(d,lo);heap[d+3u]+=removed;
 for(var k=0u;k<count;k++){heap[heap[d]+lo+k]=heap[src+k];}heap[d+2u]+=count;heap[d+4u]=length-removed+count;
 for(var k=0u;k<heap[d+9u]*2u;k++){let s=heap[d+8u]+k;heap[s]=edMapPosition(heap[s],lo,hi,count);}
 // Fold endpoints are document positions, not unstable line-number identities.
 for(var k=0u;k<heap[d+54u];k++){let f=heap[d+30u]+k*2u;heap[f]=edMapPosition(heap[f],lo,hi,count);heap[f+1u]=edMapPosition(heap[f+1u],lo,hi,count);}
 if(record!=0u){heap[record+6u]=heap[d+9u];for(var k=0u;k<32u;k++){heap[record+39u+k]=heap[heap[d+8u]+k];}heap[record+recordSize-1u]=recordSize;heap[d+12u]+=recordSize;heap[d+13u]=heap[d+12u];}
 heap[d+29u]=NONE;heap[d+5u]++;heap[d+19u]=7u;heap[d+53u]++;heap[d+45u]=0u;hsetf(d+15u,frame.viewport.w);return true;
}
fn edNormalize(d:u32){
 let p=heap[d+8u];let count=heap[d+9u];
 for(var a=1u;a<count;a++){var j=a;while(j>0u&&min(heap[p+j*2u],heap[p+j*2u+1u])<min(heap[p+(j-1u)*2u],heap[p+(j-1u)*2u+1u])){let x=heap[p+j*2u];let y=heap[p+j*2u+1u];heap[p+j*2u]=heap[p+(j-1u)*2u];heap[p+j*2u+1u]=heap[p+(j-1u)*2u+1u];heap[p+(j-1u)*2u]=x;heap[p+(j-1u)*2u+1u]=y;j--;}}
 var out=0u;for(var k=0u;k<count;k++){let lo=min(heap[p+2u*k],heap[p+2u*k+1u]);let hi=max(heap[p+2u*k],heap[p+2u*k+1u]);if(out>0u&&lo<=heap[p+2u*(out-1u)]){heap[p+2u*(out-1u)]=max(hi,heap[p+2u*(out-1u)]);}else{heap[p+2u*out]=hi;heap[p+2u*out+1u]=lo;out++;}}heap[d+9u]=max(1u,out);
}
fn edReplaceSelections(d:u32,src:u32,count:u32){
 if((heap[d+6u]&1u)!=0u){heap[d+39u]++;return;}for(var k=0u;k<32u;k++){heap[heap[d+55u]+k]=heap[heap[d+8u]+k];}heap[d+65u]=heap[d+9u];edNormalize(d);var removed=0u;
 for(var k=0u;k<heap[d+9u];k++){let s=edSel(d,k);removed+=max(heap[s],heap[s+1u])-min(heap[s],heap[s+1u]);}
 if(count*heap[d+9u]>heap[d+1u]-(heap[d+4u]-removed)){heap[d+39u]++;heap[d+9u]=heap[d+65u];for(var k=0u;k<32u;k++){heap[heap[d+8u]+k]=heap[heap[d+55u]+k];}return;}
 edReserveHistory(d,72u*heap[d+9u]+removed+count*heap[d+9u]);let historyStart=heap[d+12u];
 var k=heap[d+9u];while(k>0u){k--;let s=edSel(d,k);_=edSplice(d,min(heap[s],heap[s+1u]),max(heap[s],heap[s+1u]),src,count,true);}
 if(heap[d+12u]>historyStart&&heap[d+66u]==0u){let record=heap[d+10u]+historyStart;heap[record+5u]=heap[d+65u];for(var q=0u;q<32u;q++){heap[record+7u+q]=heap[heap[d+55u]+q];}}
}
fn edHistory(d:u32,redo:bool){
 if((heap[d+6u]&1u)!=0u){return;}heap[d+73u]=0u;var group=NONE;
 loop{
  let cursor=heap[d+12u];var r=0u;var size=0u;
  if(redo){if(cursor>=heap[d+13u]){break;}r=heap[d+10u]+cursor;size=heap[r];}else{if(cursor==0u){break;}size=heap[heap[d+10u]+cursor-1u];if(size>cursor||size<72u){heap[d+39u]++;break;}r=heap[d+10u]+cursor-size;}
  if(group==NONE){group=heap[r+4u];}if(group!=heap[r+4u]){break;}
  let lo=heap[r+1u];let old=heap[r+2u];let added=heap[r+3u];
  if(redo){_=edSplice(d,lo,lo+old,r+71u+old,added,false);heap[d+12u]=cursor+size;heap[d+9u]=heap[r+6u];for(var k=0u;k<32u;k++){heap[heap[d+8u]+k]=heap[r+39u+k];}}
  else{_=edSplice(d,lo,lo+added,r+71u,old,false);heap[d+12u]=cursor-size;heap[d+9u]=heap[r+5u];for(var k=0u;k<32u;k++){heap[heap[d+8u]+k]=heap[r+7u+k];}}
 }
}
fn edLineHeight(i:u32)->f32{let h=hf(ed(i)+37u);return select(max(16.0,fontLineHeight(i,nodes[i].misc.z)),h,h>0.0);}
fn edCell(i:u32)->f32{return max(1.0,glyphAdvance(i,77u,nodes[i].misc.z));}
fn edTop(i:u32)->f32{return contentRect(nodes[i]).y+select(6.0,44.0,heap[ed(i)+35u]!=0u);}
fn edTextWidth(i:u32)->f32{let d=ed(i);return max(1.0,contentRect(nodes[i]).z-hf(d+38u)-16.0-select(0.0,58.0,(heap[d+6u]&8u)!=0u));}
fn edVisibleHeight(i:u32)->f32{return max(1.0,contentRect(nodes[i]).w-select(30.0,68.0,heap[ed(i)+35u]!=0u));}
fn edReveal(i:u32){let d=ed(i);let caret=edCaret(d);let count=heap[d+32u];let v=heap[d+31u];var row=0u;for(var k=0u;k<count;k++){if(caret>=heap[v+k*2u]&&caret<=heap[v+k*2u+1u]){row=k;break;}}let h=edLineHeight(i);let s=cs(i);let y=f32(row)*h;setf(s+1u,clamp(sf(s+1u),max(0.0,y-edVisibleHeight(i)+h),y));let x=f32(edColumn(d,heap[v+row*2u],caret))*edCell(i);setf(s+2u,clamp(sf(s+2u),max(0.0,x-edTextWidth(i)+edCell(i)),x));}
fn edMatches(d:u32,pos:u32)->bool {let len=heap[d+22u];if(len==0u||pos+len>heap[d+4u]){return false;}let sensitive=(heap[d+28u]&1u)!=0u;for(var k=0u;k<len;k++){var a=edChar(d,pos+k);var b=heap[heap[d+21u]+k];if(!sensitive){a=edLower(a);b=edLower(b);}if(a!=b){return false;}}if((heap[d+28u]&2u)!=0u){if((pos>0u&&edWord(edChar(d,pos-1u)))||edWord(edChar(d,pos+len))){return false;}}return true;}
fn edFind(d:u32,backwards:bool)->bool{
 let len=heap[d+4u];let s=edSel(d,0u);var start=max(heap[s],heap[s+1u]);if(backwards){start=min(heap[s],heap[s+1u]);}
 for(var k=0u;k<=len;k++){let at=select((start+k)%(len+1u),(start+len-k)%(len+1u),backwards);if(edMatches(d,at)){heap[d+9u]=1u;heap[s]=at+heap[d+22u];heap[s+1u]=at;heap[d+53u]++;return true;}}return false;
}
fn edComplete(i:u32){let d=ed(i);let p=edCaret(d);var start=p;while(start>0u&&edWord(edChar(d,start-1u))){start--;}heap[d+49u]=start;let prefix=p-start;var count=0u;let list=heap[d+43u];for(var k=0u;k<heap[d+44u];k++){let at=heap[list+k*2u];let len=heap[list+k*2u+1u];if(len<prefix){continue;}var prefixMatches=true;for(var j=0u;j<prefix;j++){if(edLower(heap[at+j])!=edLower(edChar(d,start+j))){prefixMatches=false;break;}}if(prefixMatches){heap[heap[d+47u]+count]=k;count++;}}heap[d+48u]=count;heap[d+45u]=select(0u,1u,count>0u);heap[d+46u]=0u;}
fn edSnippetSelect(d:u32,index:u32){let stops=heap[d+70u];let key=heap[stops+index*3u];var count=0u;for(var k=0u;k<heap[d+71u];k++){let a=stops+k*3u;if(heap[a]==key&&count<16u){let sel=edSel(d,count);heap[sel]=heap[a+2u];heap[sel+1u]=heap[a+1u];count++;}}heap[d+9u]=max(1u,count);heap[d+72u]=index;heap[d+73u]=select(1u,0u,key==999u);heap[d+53u]++;heap[d+19u]|=8u;}
fn edSnippetStep(d:u32,backwards:bool){let count=heap[d+71u];let stops=heap[d+70u];var k=heap[d+72u];let key=heap[stops+k*3u];if(backwards){while(k>0u){k--;if(heap[stops+k*3u]!=key){edSnippetSelect(d,k);return;}}}else{while(k+1u<count){k++;if(heap[stops+k*3u]!=key){edSnippetSelect(d,k);return;}}heap[d+73u]=0u;}}
fn edInsertSnippet(d:u32,src:u32,len:u32){
 if(heap[d+9u]!=1u||(heap[d+6u]&1u)!=0u){heap[d+39u]++;return;}
 let temp=heap[d+50u];let stops=heap[d+70u];var parsed:array<u32,48>;var count=0u;var n=0u;var p=0u;
 // Parse completely into scratch before the transaction. References reuse a prior
 // default, and a repeated explicit default uses the same value as its first stop.
 while(p<len){let c=heap[src+p];if(c==36u&&p+1u<len){var q=p+1u;let braces=heap[src+q]==123u;if(braces){q++;}var number=0u;var digits=0u;
  while(q<len&&heap[src+q]>=48u&&heap[src+q]<=57u&&digits<3u){number=number*10u+heap[src+q]-48u;q++;digits++;}
  if(digits>0u&&(!braces||(q<len&&(heap[src+q]==58u||heap[src+q]==125u)))){
   if(count>=16u){heap[d+39u]++;return;}let key=select(number,999u,number==0u);let begin=n;var previous=NONE;
   for(var k=0u;k<count;k++){if(parsed[k*3u]==key){previous=k;break;}}
   var first=q;var last=q;if(braces&&heap[src+q]==58u){first=q+1u;q++;while(q<len&&heap[src+q]!=125u){q++;}if(q>=len){heap[d+39u]++;return;}last=q;}
   if(previous!=NONE){first=parsed[previous*3u+1u];last=parsed[previous*3u+2u];}
   if(last-first>heap[d+1u]-n){heap[d+39u]++;return;}
   for(var k=first;k<last;k++){heap[temp+n]=select(heap[src+k],heap[temp+k],previous!=NONE);n++;}
   if(braces){q++;}parsed[count*3u]=key;parsed[count*3u+1u]=begin;parsed[count*3u+2u]=n;count++;p=q;continue;
  }
 }if(n>=heap[d+1u]){heap[d+39u]++;return;}heap[temp+n]=c;n++;p++;}
 let sel=edSel(d,0u);let at=min(heap[sel],heap[sel+1u]);let revision=heap[d+5u];let wasActive=heap[d+73u];heap[d+73u]=0u;edReplaceSelections(d,temp,n);if(heap[d+5u]==revision){heap[d+73u]=wasActive;return;}
 for(var k=0u;k<count*3u;k++){heap[stops+k]=parsed[k];}
 for(var k=0u;k<count;k++){heap[stops+k*3u+1u]+=at;heap[stops+k*3u+2u]+=at;}
 for(var k=1u;k<count;k++){var j=k;while(j>0u&&heap[stops+j*3u]<heap[stops+(j-1u)*3u]){for(var z=0u;z<3u;z++){let value=heap[stops+j*3u+z];heap[stops+j*3u+z]=heap[stops+(j-1u)*3u+z];heap[stops+(j-1u)*3u+z]=value;}j--;}}
 heap[d+71u]=count;if(count>0u){edSnippetSelect(d,0u);}let end=heap[d+12u];if(end>0u&&heap[d+66u]==0u){let rec=heap[d+10u]+end-heap[heap[d+10u]+end-1u];heap[rec+6u]=heap[d+9u];for(var k=0u;k<32u;k++){heap[rec+39u+k]=heap[heap[d+8u]+k];}}
}
fn edAccept(d:u32){if(heap[d+45u]==0u||heap[d+48u]==0u){return;}let k=heap[heap[d+47u]+heap[d+46u]];let list=heap[d+43u]+k*2u;let s=edSel(d,0u);heap[d+9u]=1u;heap[s+1u]=heap[d+49u];edInsertSnippet(d,heap[list],heap[list+1u]);heap[d+45u]=0u;}
fn edSelectLine(d:u32){let s=edSel(d,0u);heap[d+9u]=1u;let a=edLineStart(d,heap[s]);let b=edLineEnd(d,heap[s]);heap[s+1u]=a;heap[s]=min(heap[d+4u],b+1u);}
fn edSelectWord(d:u32,p:u32){let s=edSel(d,0u);var a=min(p,heap[d+4u]);var b=a;while(a>0u&&edWord(edChar(d,a-1u))){a--;}while(b<heap[d+4u]&&edWord(edChar(d,b))){b++;}heap[s+1u]=a;heap[s]=b;}
fn edLinesCommand(d:u32,op:u32){
 if((heap[d+6u]&1u)!=0u){return;}let s=edSel(d,0u);let lo=edLineStart(d,min(heap[s],heap[s+1u]));let selectedEnd=max(heap[s],heap[s+1u]);let hi=edLineEnd(d,select(selectedEnd,selectedEnd-1u,selectedEnd>lo&&edChar(d,selectedEnd-1u)==10u));let temp=heap[d+50u];
 if(op==17u){let end=min(heap[d+4u],hi+1u);var n=end-lo;for(var k=0u;k<n;k++){heap[temp+k]=edChar(d,lo+k);}if(end==heap[d+4u]&&edChar(d,end-1u)!=10u){if(n+1u>heap[d+1u]){heap[d+39u]++;return;}for(var k=n;k>0u;k--){heap[temp+k]=heap[temp+k-1u];}heap[temp]=10u;n++;}edReserveHistory(d,72u+n);_=edSplice(d,end,end,temp,n,true);return;}
 if(op==18u){edReserveHistory(d,72u+min(heap[d+4u],hi+1u)-lo);_=edSplice(d,lo,min(heap[d+4u],hi+1u),temp,0u,true);return;}
 if(op==19u||op==20u){var a=lo;var b=min(heap[d+4u],hi+1u);var middle=lo;if(op==19u){if(lo==0u){return;}a=edLineStart(d,lo-1u);middle=lo;}else{if(hi>=heap[d+4u]){return;}middle=hi+1u;b=min(heap[d+4u],edLineEnd(d,middle)+1u);}
  // Rotate complete lines with an explicit separator even at final unterminated line.
  var n=0u;let hasEnd=edChar(d,b-1u)==10u;let rightEnd=select(b,b-1u,hasEnd);for(var k=middle;k<rightEnd;k++){heap[temp+n]=edChar(d,k);n++;}heap[temp+n]=10u;n++;for(var k=a;k<middle-1u;k++){heap[temp+n]=edChar(d,k);n++;}if(hasEnd){heap[temp+n]=10u;n++;}edReserveHistory(d,72u+b-a+n);_=edSplice(d,a,b,temp,n,true);return;
 }
 var starts:array<u32,512>;var count=0u;var x=lo;loop{if(count==512u){heap[d+39u]++;return;}starts[count]=x;count++;if(x>=hi){break;}x=edLineEnd(d,x)+1u;if(x>hi){break;}}
 var needed=0u;if(op==15u){needed=count*heap[d+36u];}if(op==14u){needed=count*2u;}
 var allComment=true;for(var k=0u;k<count;k++){var at=starts[k];while(edChar(d,at)==32u||edChar(d,at)==9u){at++;}if(edChar(d,at)!=47u||edChar(d,at+1u)!=47u){allComment=false;}}
 if(op==14u&&allComment){needed=0u;}if(needed>heap[d+1u]-heap[d+4u]){heap[d+39u]++;return;}edReserveHistory(d,count*(72u+max(2u,heap[d+36u])));
 var k=count;while(k>0u){k--;var at=starts[k];if(op==15u){for(var q=0u;q<heap[d+36u];q++){heap[temp+q]=32u;}_=edSplice(d,at,at,temp,heap[d+36u],true);}else if(op==16u){var n=0u;if(edChar(d,at)==9u){n=1u;}else{while(n<heap[d+36u]&&edChar(d,at+n)==32u){n++;}}_=edSplice(d,at,at+n,temp,0u,true);}else if(op==14u){while(edChar(d,at)==32u||edChar(d,at)==9u){at++;}if(allComment){_=edSplice(d,at,at+2u,temp,0u,true);}else{heap[temp]=47u;heap[temp+1u]=47u;_=edSplice(d,at,at,temp,2u,true);}}}
}
fn edFold(d:u32,pos:u32){let start=edLineStart(d,pos);let f=heap[d+30u];for(var k=0u;k<heap[d+54u];k++){if(edLineStart(d,heap[f+2u*k])==start){for(var j=k+1u;j<heap[d+54u];j++){heap[f+(j-1u)*2u]=heap[f+j*2u];heap[f+(j-1u)*2u+1u]=heap[f+j*2u+1u];}heap[d+54u]--;heap[d+19u]|=4u;return;}}
 var open=start;let end=edLineEnd(d,start);while(open<end&&edChar(d,open)!=123u&&edChar(d,open)!=91u){open++;}if(open==end||heap[d+54u]>=32u){return;}let closing=select(125u,93u,edChar(d,open)==91u);let opening=edChar(d,open);var depth=1u;var close=open+1u;while(close<heap[d+4u]){if(heap[heap[d+20u]+close]!=3u&&heap[heap[d+20u]+close]!=4u){if(edChar(d,close)==opening){depth++;}if(edChar(d,close)==closing){depth--;if(depth==0u){break;}}}close++;}if(depth==0u&&edLineStart(d,close)>start){heap[f+heap[d+54u]*2u]=end+1u;heap[f+heap[d+54u]*2u+1u]=edLineEnd(d,close);heap[d+54u]++;heap[d+19u]|=4u;}}
fn executeEditorCommand(i:u32,op:u32,a:f32,b:f32,code:u32){
 if(!isEditor(i)){return;}let d=ed(i);let s=edSel(d,0u);edBegin(d);
 switch op{
 case 0u:{state[0]=i;state[24u]=i;}
 case 1u:{edHistory(d,false);}case 2u:{edHistory(d,true);}case 3u:{heap[d+9u]=1u;heap[s]=heap[d+4u];heap[s+1u]=0u;}
 case 4u:{heap[d+35u]=1u;heap[d+19u]|=4u;state[0]=i;}
 case 5u:{heap[d+35u]=2u;heap[d+19u]|=4u;state[0]=i;}
 case 6u:{_=edFind(d,false);}case 7u:{_=edFind(d,true);}
 case 8u:{if(edMatches(d,min(heap[s],heap[s+1u]))&&abs(i32(heap[s])-i32(heap[s+1u]))==i32(heap[d+22u])){edReplaceSelections(d,heap[d+23u],heap[d+24u]);}_=edFind(d,false);}
 case 9u:{if((heap[d+6u]&1u)!=0u){break;}var matches=0u;let len=heap[d+22u];if(len==0u){break;}var p=0u;while(p+len<=heap[d+4u]){if(edMatches(d,p)){matches++;p+=len;}else{p++;}}if(heap[d+24u]>len&&matches*(heap[d+24u]-len)>heap[d+1u]-heap[d+4u]){heap[d+39u]++;break;}edReserveHistory(d,matches*(72u+len+heap[d+24u]));p=0u;while(p+len<=heap[d+4u]){if(edMatches(d,p)){_=edSplice(d,p,p+len,heap[d+23u],heap[d+24u],true);p+=heap[d+24u];}else{p++;}}}
 case 10u:{var row=1u;var at=0u;while(row<u32(max(1.0,a))&&at<heap[d+4u]){at=edLineEnd(d,at);if(at<heap[d+4u]){at++;row++;}}heap[d+9u]=1u;heap[s]=at;heap[s+1u]=at;heap[d+35u]=0u;}
 case 11u:{heap[d+6u]^=4u;heap[d+19u]|=4u;setf(cs(i)+2u,0.0);}case 12u:{heap[d+6u]^=8u;heap[d+19u]|=4u;}case 13u:{heap[d+57u]^=1u;}
 case 14u,15u,16u,17u,18u,19u,20u:{edLinesCommand(d,op);}
 case 21u:{edComplete(i);}case 22u:{edAccept(d);}
 case 23u:{let lo=min(heap[s],heap[s+1u]);let hi=max(heap[s],heap[s+1u]);if(lo==hi){edSelectWord(d,lo);break;}let len=min(256u,hi-lo);for(var k=0u;k<len;k++){heap[heap[d+21u]+k]=edChar(d,lo+k);}heap[d+22u]=len;heap[d+19u]|=2u;if(heap[d+9u]>=16u){break;}let end=heap[d+4u];for(var k=hi;k<=end+hi;k++){let at=k%(end+1u);if(!edMatches(d,at)){continue;}var duplicate=false;for(var j=0u;j<heap[d+9u];j++){let sel=edSel(d,j);if(min(heap[sel],heap[sel+1u])==at){duplicate=true;}}if(!duplicate){let sel=edSel(d,heap[d+9u]);heap[sel]=at+len;heap[sel+1u]=at;heap[d+9u]++;break;}}}
 case 24u:{edFold(d,edCaret(d));}case 25u:{heap[d+54u]=0u;heap[d+19u]|=4u;}
 case 26u:{let count=select(0u,heap[d+9u],code!=0u);if(count<16u){heap[d+9u]=count+1u;let sel=edSel(d,count);heap[sel]=min(heap[d+4u],u32(max(0.0,a)));heap[sel+1u]=min(heap[d+4u],u32(max(0.0,b)));}}
 case 27u:{edReplaceSelections(d,heap[d+64u],min(heap[d+1u],u32(max(0.0,a))));}
 case 28u:{let flags=heap[d+6u];heap[d+6u]&=~1u;heap[d+73u]=0u;heap[d+9u]=1u;heap[s]=heap[d+4u];heap[s+1u]=0u;edReplaceSelections(d,heap[d+64u],min(heap[d+1u],u32(max(0.0,a))));heap[d+12u]=0u;heap[d+13u]=0u;heap[s]=0u;heap[s+1u]=0u;heap[d+54u]=0u;heap[d+6u]=flags;}
 case 29u:{heap[d+22u]=min(256u,u32(max(0.0,a)));heap[d+28u]=u32(max(0.0,b));for(var k=0u;k<heap[d+22u];k++){heap[heap[d+21u]+k]=heap[heap[d+64u]+k];}heap[d+19u]|=2u;}
 case 30u:{if(heap[d+5u]==u32(a)&&heap[d+53u]==u32(b)){edReplaceSelections(d,heap[d+50u],0u);}else{heap[d+39u]++;}}
 case 31u:{nodes[i].misc.z=clamp(nodes[i].misc.z+a,8.0,40.0);heap[d+19u]|=4u;}
 case 32u:{heap[d+6u]^=2u;}case 33u:{edSelectLine(d);}case 34u:{edSelectWord(d,edCaret(d));}case 35u:{heap[d+9u]=1u;heap[s+1u]=heap[s];}
 case 36u:{heap[d+35u]=4u;heap[d+22u]=0u;heap[d+19u]|=4u;}
 case 37u:{setf(cs(i)+1u,max(0.0,a-1.0)*edLineHeight(i));return;}
 case 40u:{heap[d+24u]=min(256u,u32(max(0.0,a)));for(var k=0u;k<heap[d+24u];k++){heap[heap[d+23u]+k]=heap[heap[d+64u]+k];}}
 case 39u:{edInsertSnippet(d,heap[d+64u],min(heap[d+1u],u32(max(0.0,a))));}
 case 38u:{let count=min(state[40u],u32(max(0.0,a)));let mode=heap[d+35u];if(mode!=0u){let at=select(heap[d+21u],heap[d+23u],mode==3u);let field=select(d+22u,d+24u,mode==3u);for(var k=0u;k<count&&heap[field]<256u;k++){let ch=heap[state[23u]+k];if(ch>=32u){heap[at+heap[field]]=ch;heap[field]++;}}heap[d+19u]|=2u;}else{edReplaceSelections(d,state[23u],count);}}
 default:{}
 }
 heap[d+53u]++;heap[d+19u]|=8u;
}
fn executeEditorText(i:u32,ch:u32){
 let d=ed(i);if(ch==13u){editorKey(i,13u,0u);return;}if(ch==0u||ch>0x10ffffu||(ch>=0xd800u&&ch<=0xdfffu)){return;}
 if(heap[d+35u]!=0u){let isReplace=heap[d+35u]==3u;let at=select(heap[d+21u],heap[d+23u],isReplace);let field=select(d+22u,d+24u,isReplace);if(heap[field]<256u&&ch>=32u){heap[at+heap[field]]=ch;heap[field]++;heap[d+19u]|=2u;}return;}
 edBegin(d);let temp=heap[d+50u];heap[temp]=ch;var count=1u;
 if(heap[d+58u]!=0u&&heap[d+7u]!=0u){var closing=0u;switch ch{case 40u:{closing=41u;}case 91u:{closing=93u;}case 123u:{closing=125u;}case 34u,39u,96u:{closing=ch;}default:{}}
  if(heap[d+9u]==1u&&edChar(d,edCaret(d))==ch&&(ch==41u||ch==93u||ch==125u||ch==34u||ch==39u||ch==96u)){let s=edSel(d,0u);if(heap[s]==heap[s+1u]){heap[s]++;heap[s+1u]++;heap[d+53u]++;return;}}
  if(closing!=0u&&heap[d+9u]==1u){let s=edSel(d,0u);if(heap[s]==heap[s+1u]){heap[temp+1u]=closing;count=2u;}}
 }
 if((heap[d+6u]&2u)!=0u){for(var k=0u;k<heap[d+9u];k++){let s=edSel(d,k);if(heap[s]==heap[s+1u]&&edChar(d,heap[s])!=10u){heap[s+1u]=edNext(d,heap[s],false);}}}
 let revision=heap[d+5u];edReplaceSelections(d,temp,count);if(count==2u&&heap[d+5u]!=revision){let s=edSel(d,0u);heap[s]--;heap[s+1u]--;let end=heap[d+12u];if(end>0u){let r=heap[d+10u]+end-heap[heap[d+10u]+end-1u];heap[r+39u]=heap[s];heap[r+40u]=heap[s+1u];}}
 heap[d+19u]|=8u;
}
// Decode first, execute once. Repeating the large transaction interpreter at
// every shortcut branch creates many redundant native compiler call sites.
fn executeEditorKey(i:u32,key:u32,mods:u32){
 let request=editorKeyRequest(i,key,mods);
 if(request.x>=0.0){editorCommand(i,u32(request.x),request.y,0.0,0u);}
}
fn editorKeyRequest(i:u32,key:u32,mods:u32)->vec2<f32>{
 let d=ed(i);let shift=(mods&1u)!=0u;let ctrl=(mods&6u)!=0u;let alt=(mods&8u)!=0u;let s=edSel(d,0u);
 if(ctrl&&key==9u){dockNextPane(i,shift);return vec2<f32>(-1.0,0.0);}
 if(ctrl){var op=NONE;switch key{case 65u:{op=3u;}case 90u:{op=select(1u,2u,shift);}case 89u:{op=2u;}case 70u:{op=4u;}case 72u:{op=5u;}case 68u:{op=23u;}case 32u:{op=21u;}case 191u:{op=14u;}case 76u:{op=33u;}case 80u:{if(shift){op=36u;}}case 219u:{op=24u;}case 221u:{op=25u;}default:{}}if(op!=NONE){return vec2<f32>(f32(op),0.0);}if(key==71u){heap[d+35u]=5u;heap[d+22u]=0u;return vec2<f32>(-1.0,0.0);}if(key==187u||key==189u){return vec2<f32>(f32(31u),select(-1.0,1.0,key==187u));}}
 if(key==114u){return vec2<f32>(f32(select(6u,7u,shift)),0.0);}
 if(alt&&(key==38u||key==40u)){return vec2<f32>(f32(select(select(19u,20u,key==40u),17u,shift)),0.0);}
 if(key==27u){heap[d+73u]=0u;heap[d+35u]=0u;heap[d+45u]=0u;heap[d+9u]=1u;heap[d+19u]|=4u;return vec2<f32>(-1.0,0.0);}
 if(heap[d+35u]!=0u){let mode=heap[d+35u];if(key==8u){let at=select(d+22u,d+24u,mode==3u);heap[at]-=min(1u,heap[at]);heap[d+19u]|=2u;}else if(key==9u&&mode>=2u&&mode<=3u){heap[d+35u]=5u-mode;}else if(key==13u){if(mode==5u){var n=0u;for(var k=0u;k<heap[d+22u];k++){let c=heap[heap[d+21u]+k];if(c>=48u&&c<=57u){n=min(1000000u,n*10u+c-48u);}}return vec2<f32>(f32(10u),f32(n));}else if(mode==4u){let n=heap[d+22u];let c=select(0u,edLower(heap[heap[d+21u]]),n>0u);var op=NONE;switch c{case 117u:{op=1u;}case 114u:{op=2u;}case 119u:{op=11u;}case 109u:{op=12u;}case 102u:{op=24u;}case 100u:{op=17u;}case 99u:{op=14u;}default:{}}heap[d+35u]=0u;if(op!=NONE){return vec2<f32>(f32(op),0.0);}}else{return vec2<f32>(f32(select(select(6u,7u,shift),8u,mode==3u)),0.0);}}return vec2<f32>(-1.0,0.0);}
 if(heap[d+45u]!=0u){if(key==38u||key==40u){heap[d+46u]=(heap[d+46u]+select(heap[d+48u]-1u,1u,key==40u))%heap[d+48u];return vec2<f32>(-1.0,0.0);}if(key==9u||key==13u){return vec2<f32>(f32(22u),0.0);}}
 if(key==9u&&heap[d+73u]!=0u){edSnippetStep(d,shift);return vec2<f32>(-1.0,0.0);}
 if(key==45u){return vec2<f32>(f32(32u),0.0);}if(key==9u){if(!shift&&heap[d+9u]==1u&&heap[s]==heap[s+1u]){edBegin(d);let count=heap[d+36u]-edColumn(d,edLineStart(d,heap[s]),heap[s])%heap[d+36u];let temp=heap[d+50u];for(var k=0u;k<count;k++){heap[temp+k]=32u;}edReplaceSelections(d,temp,count);heap[d+19u]|=8u;}else{return vec2<f32>(f32(select(15u,16u,shift)),0.0);}return vec2<f32>(-1.0,0.0);}
 edBegin(d);if(key==13u||key==32u){let temp=heap[d+50u];heap[temp]=select(32u,10u,key==13u);var count=1u;
  if(key==13u){let start=edLineStart(d,edCaret(d));var k=start;while(k<edCaret(d)&&(edChar(d,k)==32u||edChar(d,k)==9u)&&count<256u){heap[temp+count]=edChar(d,k);count++;k++;}if(edCaret(d)>0u&&edChar(d,edCaret(d)-1u)==123u){for(var j=0u;j<heap[d+36u]&&count<heap[d+1u];j++){heap[temp+count]=32u;count++;}}}
  edReplaceSelections(d,temp,count);heap[d+19u]|=8u;return vec2<f32>(-1.0,0.0);
 }
 if(key==8u||key==46u){if((heap[d+6u]&1u)!=0u){return vec2<f32>(-1.0,0.0);}for(var k=0u;k<heap[d+9u];k++){let sel=edSel(d,k);if(heap[sel]==heap[sel+1u]){heap[sel+1u]=select(edNext(d,heap[sel],ctrl),edPrev(d,heap[sel],ctrl),key==8u);}}edReplaceSelections(d,heap[d+50u],0u);heap[d+19u]|=8u;return vec2<f32>(-1.0,0.0);}
 for(var k=0u;k<heap[d+9u];k++){let sel=edSel(d,k);let old=heap[sel];var caret=old;
  if(key==37u){caret=edPrev(d,old,ctrl);if(!shift&&heap[sel]!=heap[sel+1u]){caret=min(heap[sel],heap[sel+1u]);}}
  if(key==39u){caret=edNext(d,old,ctrl);if(!shift&&heap[sel]!=heap[sel+1u]){caret=max(heap[sel],heap[sel+1u]);}}
  if(key==36u){caret=select(edLineStart(d,old),0u,ctrl);}if(key==35u){caret=select(edLineEnd(d,old),heap[d+4u],ctrl);}
  if(key==38u||key==40u||key==33u||key==34u){let start=edLineStart(d,old);var col=edColumn(d,start,old);if((heap[d+19u]&5u)==0u){let visuals=heap[d+31u];for(var q=0u;q<heap[d+32u];q++){if(old>=heap[visuals+q*2u]&&old<=heap[visuals+q*2u+1u]){col=edColumn(d,heap[visuals+q*2u],old);break;}}}if(heap[d+9u]==1u){if(heap[d+29u]!=NONE){col=heap[d+29u];}heap[d+29u]=col;}var row=start;let count=select(1u,u32(max(1.0,floor(edVisibleHeight(i)/edLineHeight(i)))),key==33u||key==34u);for(var j=0u;j<count;j++){if(key==38u||key==33u){if(row==0u){break;}row=edLineStart(d,row-1u);}else{row=min(heap[d+4u],edLineEnd(d,row)+1u);}}caret=edAtColumn(d,row,edLineEnd(d,row),col);if((heap[d+19u]&5u)==0u&&heap[d+32u]>0u){let visuals=heap[d+31u];var current=0u;for(var q=0u;q<heap[d+32u];q++){if(old>=heap[visuals+q*2u]&&old<=heap[visuals+q*2u+1u]){current=q;break;}}if(heap[d+29u]==NONE){col=edColumn(d,heap[visuals+current*2u],old);}let recipientNode=u32(clamp(i32(current)+select(i32(count),-i32(count),key==38u||key==33u),0i,i32(heap[d+32u])-1i));caret=edAtColumn(d,heap[visuals+recipientNode*2u],heap[visuals+recipientNode*2u+1u],col);}}
  heap[sel]=caret;if(!shift){heap[sel+1u]=caret;}
 }
 if(key!=38u&&key!=40u&&key!=33u&&key!=34u){heap[d+29u]=NONE;}heap[d+53u]++;heap[d+19u]|=8u;heap[d+45u]=0u;
 return vec2<f32>(-1.0,0.0);
}
fn executeEditorPointer(i:u32,p:vec2<f32>,kind:u32,mods:u32,clicks:f32){
 let d=ed(i);let r=contentRect(nodes[i]);let height=edLineHeight(i);let v=heap[d+31u];let count=max(1u,heap[d+32u]);let row=u32(clamp(floor((p.y-edTop(i)+sf(cs(i)+1u))/height),0.0,f32(count-1u)));
 if(kind==2u){heap[d+60u]=0u;heap[d+73u]=0u;if(p.x>=r.x+r.z-14.0||((heap[d+6u]&8u)!=0u&&p.x>=r.x+r.z-72.0)){heap[d+60u]=2u;}}
 if(heap[d+60u]==2u){setf(cs(i)+1u,clamp((p.y-r.y)/max(1.0,r.w),0.0,1.0)*max(0.0,f32(count)*height-edVisibleHeight(i)));return;}
 if(kind==2u&&p.y<edTop(i)){if(heap[d+35u]>=2u&&heap[d+35u]<=3u){heap[d+35u]=select(2u,3u,p.x>r.x+r.z*.5);}return;}
 let start=heap[v+row*2u];let end=heap[v+row*2u+1u];let col=u32(max(0.0,round((p.x-r.x-hf(d+38u)+sf(cs(i)+2u))/edCell(i))));let pos=edAtColumn(d,start,end,col);let sel=edSel(d,0u);
 if(kind==2u){heap[d+60u]=1u;heap[d+61u]=row;heap[d+62u]=col;heap[d+59u]=0u;heap[d+29u]=NONE;
  if(p.x<r.x+hf(d+38u)-18.0){heap[sel]=start;heap[sel+1u]=start;if(clicks>=2.0){edSelectLine(d);}else{edFold(d,start);}heap[d+53u]++;return;}
  if(clicks>=3.0){heap[sel]=pos;edSelectLine(d);}else if(clicks>=2.0){edSelectWord(d,pos);}else if((mods&9u)==9u){heap[d+9u]=1u;heap[sel]=pos;heap[sel+1u]=pos;heap[d+60u]=4u;}else if((mods&8u)!=0u&&heap[d+9u]<16u){let index=heap[d+9u];let s=edSel(d,index);heap[d+9u]++;heap[s]=pos;heap[s+1u]=pos;heap[d+59u]=index;heap[d+60u]=3u;}else{if((mods&1u)==0u){heap[d+9u]=1u;heap[sel+1u]=pos;}heap[sel]=pos;}
 }else if(kind==1u){if(heap[d+60u]==4u){let first=min(row,heap[d+61u]);let last=min(max(row,heap[d+61u]),first+15u);heap[d+9u]=last-first+1u;for(var q=first;q<=last;q++){let s=edSel(d,q-first);let a=heap[v+q*2u];let b=heap[v+q*2u+1u];heap[s]=edAtColumn(d,a,b,col);heap[s+1u]=edAtColumn(d,a,b,heap[d+62u]);}}else{heap[edSel(d,heap[d+59u])]=pos;}if(p.y<edTop(i)){setf(cs(i)+1u,max(0.0,sf(cs(i)+1u)-height));}if(p.y>edTop(i)+edVisibleHeight(i)){setf(cs(i)+1u,sf(cs(i)+1u)+height);}}
 heap[d+53u]++;hsetf(d+15u,frame.viewport.w);
}
// Navigation-only bracket matching avoids a complete lexical scan on caret motion.
fn edBracket(d:u32){let caret=edCaret(d);heap[d+41u]=NONE;heap[d+42u]=NONE;var p=caret;var c=edChar(d,p);if(c!=40u&&c!=41u&&c!=91u&&c!=93u&&c!=123u&&c!=125u){if(p==0u){return;}p--;c=edChar(d,p);}let token=heap[heap[d+20u]+p];if(token==3u||token==4u){return;}var other=0u;var direction=1i;switch c{case 40u:{other=41u;}case 91u:{other=93u;}case 123u:{other=125u;}case 41u:{other=40u;direction=-1i;}case 93u:{other=91u;direction=-1i;}case 125u:{other=123u;direction=-1i;}default:{return;}}
 var depth=1u;var at=i32(p)+direction;while(at>=0i&&at<i32(heap[d+4u])){let t=heap[heap[d+20u]+u32(at)];if(t!=3u&&t!=4u){let ch=edChar(d,u32(at));if(ch==c){depth++;}if(ch==other){depth--;if(depth==0u){heap[d+41u]=p;heap[d+42u]=u32(at);return;}}}at+=direction;}
}
// Revision-gated whole-document scan: no reindex/tokenization on clean scrolling.
@compute @workgroup_size(1)
fn analyzeEditors(@builtin(global_invocation_id) tid:vec3<u32>){
 if(tid.x>=state[61u]){return;}let i=heap[state[60u]+tid.x];let d=ed(i);let dirty=heap[d+19u];let len=heap[d+4u];if((dirty&1u)!=0u){
  let lines=heap[d+16u];let tokens=heap[d+20u];heap[lines]=0u;var lc=1u;var mode=0u;var escaped=false;var col=0u;var maxCol=0u;
  var stack:array<u32,256>;var depth=0u;var diagnostics=0u;heap[d+41u]=NONE;heap[d+42u]=NONE;
  var p=0u;while(p<len){let c=edChar(d,p);let next=edChar(d,p+1u);var token=0u;
   if(c==10u){if(lc<heap[d+18u]){heap[lines+lc]=p+1u;lc++;}maxCol=max(maxCol,col);col=0u;if(mode==1u){mode=0u;}else if(mode==3u||mode==4u){mode=0u;}}else if(c==9u){col+=heap[d+36u]-col%heap[d+36u];}else if(!isCombining(c)){col++;}
   if(heap[d+7u]!=0u){
    if(mode==1u){token=4u;}
    else if(mode==2u){token=4u;if(c==42u&&next==47u){heap[tokens+p]=4u;p++;col++;token=4u;mode=0u;}}
    else if(mode>=3u){token=3u;let quote=select(select(39u,34u,mode==4u),96u,mode==5u);if(!escaped&&c==quote){mode=0u;}if(c==92u&&!escaped){escaped=true;}else{escaped=false;}}
    else if(c==47u&&next==47u&&heap[d+7u]!=3u){mode=1u;token=4u;}
    else if(c==47u&&next==42u&&heap[d+7u]!=3u){mode=2u;token=4u;heap[tokens+p]=token;p++;col++;}
    else if(c==34u||c==39u||c==96u){mode=select(select(3u,4u,c==34u),5u,c==96u);token=3u;escaped=false;}
    else if(c>=48u&&c<=57u){token=2u;}
    else if(edWord(c)){let start=p;var hash=2166136261u;while(p<len&&edWord(edChar(d,p))){hash=(hash^edChar(d,p))*16777619u;p++;}let amount=p-start;col+=amount-1u;token=select(0u,1u,edKeyword(hash));for(var k=start;k<p;k++){heap[tokens+k]=token;}continue;}
    else if(c==123u||c==91u||c==40u){token=5u;if(depth<256u){stack[depth]=p;depth++;}}
    else if(c==125u||c==93u||c==41u){token=5u;let expected=select(select(123u,91u,c==93u),40u,c==41u);if(depth>0u&&edChar(d,stack[depth-1u])==expected){depth--;let open=stack[depth];let caret=edCaret(d);if(caret==open||caret==open+1u||caret==p||caret==p+1u){heap[d+41u]=open;heap[d+42u]=p;}}else if(diagnostics<256u){heap[heap[d+51u]+diagnostics*2u]=p;heap[heap[d+51u]+diagnostics*2u+1u]=1u;diagnostics++;}}
   }
   heap[tokens+p]=token;p++;
  }
  for(var k=0u;k<depth&&diagnostics<256u;k++){heap[heap[d+51u]+diagnostics*2u]=stack[k];heap[heap[d+51u]+diagnostics*2u+1u]=2u;diagnostics++;}
  heap[d+52u]=diagnostics;heap[d+17u]=lc;heap[d+33u]=max(maxCol,col);
 }
 if((dirty&3u)!=0u){var count=0u;heap[d+6u]&=~256u;if(heap[d+22u]>0u){for(var p=0u;p<len;p++){if(edMatches(d,p)){if(count<1024u){heap[heap[d+25u]+count]=p;count++;}else{heap[d+6u]|=256u;break;}}}}heap[d+26u]=count;}
 heap[d+19u]&=~3u;
}
fn edKeyword(hash:u32)->bool{
 switch hash{case 30055014u,99841201u,184981848u,231090382u,288002260u,439074547u,638531843u,681154065u,722419938u,739197557u,959999494u,1094220446u,1116268876u,1219850847u,1303515621u,1349190650u,1663232469u,1716507092u,1740784714u,1765031016u,1821831854u,1996966820u,2054714927u,2218221252u,2246981567u,2317739966u,2321067302u,2462236192u,2470140894u,2480955249u,2513272949u,2593171616u,2602907825u,2606869827u,2642794062u,2664841801u,2717370895u,2872970239u,2887626766u,2901640080u,2977070660u,3183434736u,3190202204u,3300482109u,3365180733u,3378807160u,3400004773u,3470762949u,3532702267u,3660305025u,3691757453u,3728169555u,4152230356u,4211608755u:{return true;} default:{return false;}}
}
@compute @workgroup_size(1)
fn layoutEditors(@builtin(global_invocation_id) tid:vec3<u32>){
 if(tid.x>=state[61u]){return;}let i=heap[state[60u]+tid.x];
 // Closed/inactive dock panes have no useful viewport. Preserve their wrap
 // cache and scroll/caret reveal intent instead of reflowing at one column.
 if(!visible(i)||nodes[i].rect.z<=0.0||nodes[i].rect.w<=0.0){return;}
 let d=ed(i);let caret=edCaret(d);if(heap[d+69u]!=caret||(heap[d+19u]&8u)!=0u){edBracket(d);heap[d+69u]=caret;}if((heap[d+19u]&8u)!=0u){var f=0u;while(f<heap[d+54u]){let folds=heap[d+30u];let at=folds+f*2u;if(caret>=heap[at]&&caret<heap[at+1u]){for(var j=f+1u;j<heap[d+54u];j++){heap[folds+(j-1u)*2u]=heap[folds+j*2u];heap[folds+(j-1u)*2u+1u]=heap[folds+j*2u+1u];}heap[d+54u]--;heap[d+19u]|=4u;}else{f++;}}}let width=u32(max(1.0,floor(edTextWidth(i)/edCell(i))));let columns=select(0u,width,(heap[d+6u]&4u)!=0u);
 if((heap[d+19u]&4u)!=0u||heap[d+34u]!=columns){heap[d+34u]=columns;let lines=heap[d+16u];let out=heap[d+31u];var vc=0u;
  for(var row=0u;row<heap[d+17u];row++){let start=heap[lines+row];let end=edLineEnd(d,start);var hidden=false;for(var f=0u;f<heap[d+54u];f++){let at=heap[d+30u]+f*2u;if(start>=heap[at]&&start<heap[at+1u]){hidden=true;}}if(hidden){continue;}
   var a=start;loop{var b=end;if(columns>0u){b=edAtColumn(d,a,end,columns);if(b==a&&a<end){b=a+1u;}}if(vc>=heap[d+18u]){heap[d+39u]++;break;}heap[out+vc*2u]=a;heap[out+vc*2u+1u]=b;vc++;if(b>=end){break;}a=b;}
  }heap[d+32u]=max(1u,vc);heap[d+19u]&=~4u;
 }
 if((heap[d+19u]&8u)!=0u){edReveal(i);heap[d+19u]&=~8u;}
 setf(cs(i)+1u,clamp(sf(cs(i)+1u),0.0,max(0.0,f32(heap[d+32u])*edLineHeight(i)-edVisibleHeight(i))));
 setf(cs(i)+2u,clamp(sf(cs(i)+2u),0.0,max(0.0,f32(heap[d+33u])*edCell(i)-edTextWidth(i)+16.0)));
}
var<private> editorRequest:vec4<u32>;
var<private> editorArguments:vec2<f32>;
fn editorCommand(i:u32,op:u32,a:f32,b:f32,code:u32){editorRequest=vec4<u32>(1u,i,op,code);editorArguments=vec2<f32>(a,b);}

// One GPU job per input event; the input interpreter resumes after this pass.
fn editorKey(i:u32,key:u32,mods:u32){atomicStore(&scratch[28u],1u);atomicStore(&scratch[29u],i);atomicStore(&scratch[30u],key);atomicStore(&scratch[31u],mods);}
fn editorText(i:u32,ch:u32){atomicStore(&scratch[28u],2u);atomicStore(&scratch[29u],i);atomicStore(&scratch[30u],ch);}
fn editorPointer(i:u32,p:vec2<f32>,kind:u32,mods:u32,clicks:f32){atomicStore(&scratch[28u],3u);atomicStore(&scratch[29u],i);atomicStore(&scratch[30u],kind);atomicStore(&scratch[31u],mods);atomicStore(&scratch[32u],bitcast<u32>(p.x));atomicStore(&scratch[33u],bitcast<u32>(p.y));atomicStore(&scratch[34u],bitcast<u32>(clicks));}
@compute @workgroup_size(1)
fn applyEditorInput(){
 let kind=atomicLoad(&scratch[28u]);if(kind==0u){return;}atomicStore(&scratch[28u],0u);let i=atomicLoad(&scratch[29u]);let code=atomicLoad(&scratch[30u]);let mods=atomicLoad(&scratch[31u]);
 if(kind==1u){executeEditorKey(i,code,mods);}else if(kind==2u){executeEditorText(i,code);}else{executeEditorPointer(i,vec2<f32>(bitcast<f32>(atomicLoad(&scratch[32u])),bitcast<f32>(atomicLoad(&scratch[33u]))),code,mods,bitcast<f32>(atomicLoad(&scratch[34u])));}
 if(editorRequest.x!=0u){for(var j=0u;j<4u;j++){atomicStore(&scratch[14u+j],editorRequest[j]);}for(var j=0u;j<2u;j++){atomicStore(&scratch[18u+j],bitcast<u32>(editorArguments[j]));}}
}

@compute @workgroup_size(1)
fn applyEditorCommands(){
 if(atomicLoad(&scratch[14u])==0u){return;}atomicStore(&scratch[14u],0u);
 let i=atomicLoad(&scratch[15u]);let op=atomicLoad(&scratch[16u]);let code=atomicLoad(&scratch[17u]);let a=bitcast<f32>(atomicLoad(&scratch[18u]));let b=bitcast<f32>(atomicLoad(&scratch[19u]));
 for(var k=0u;k<max(1u,atomicLoad(&scratch[12u]));k++){executeEditorCommand(i,op,a,b,code);}
 if(op==28u&&isEditor(i)){heap[ed(i)+78u]=heap[ed(i)+5u];}
}
