// Retained OpenType run ABI 1. Independent runs have disjoint mutation storage.
// No cross-workgroup spinlocks, CPU shaping, or miss-notification round trips.
fn shGlyph(r:u32,i:u32)->u32{return heap[r+6u]+i*20u;}
fn shFace(r:u32,f:u32)->u32{return heap[heap[r+10u]+f];}
fn shFont(r:u32,f:u32)->u32{return heap[shFace(r,f)+13u];}
fn shFail(r:u32,error:u32){heap[r+18u]|=error;}
fn shStep(r:u32)->bool{heap[r+26u]++;if(heap[r+26u]>heap[r+25u]){shFail(r,2u);return false;}return true;}
fn ot16(t:u32,p:u32)->u32{if(t==0u||heap[t]<2u||p>heap[t]-2u){return 0u;}return heap[t+1u+p]*256u+heap[t+2u+p];}
fn ot32(t:u32,p:u32)->u32{if(t==0u||heap[t]<4u||p>heap[t]-4u){return 0u;}return (ot16(t,p)<<16u)|ot16(t,p+2u);}
fn otSigned(t:u32,p:u32)->i32{let n=ot16(t,p);return select(i32(n),i32(n)-65536,n>=32768u);}
fn otRange(r:u32,t:u32,p:u32,n:u32)->bool{if(t==0u||n>heap[t]||p>heap[t]-n){shFail(r,4u);return false;}return true;}
fn otCoverage(r:u32,t:u32,p:u32,g:u32)->u32{
 if(!otRange(r,t,p,4u)){return 0xffffffffu;}let fmt=ot16(t,p);let n=ot16(t,p+2u);var lo=0u;var hi=n;
 if(fmt==1u){if(!otRange(r,t,p+4u,n*2u)){return 0xffffffffu;}while(lo<hi){let m=u32((lo+hi)/2u);if(ot16(t,p+4u+m*2u)<g){lo=m+1u;}else{hi=m;}}if(lo<n&&ot16(t,p+4u+lo*2u)==g){return lo;}}
 else if(fmt==2u){if(!otRange(r,t,p+4u,n*6u)){return 0xffffffffu;}while(lo<hi){let m=u32((lo+hi)/2u);let q=p+4u+m*6u;if(g<ot16(t,q)){hi=m;}else if(g>ot16(t,q+2u)){lo=m+1u;}else{return ot16(t,q+4u)+g-ot16(t,q);}}}else{shFail(r,4u);}return 0xffffffffu;
}
fn otClass(r:u32,t:u32,p:u32,g:u32)->u32{
 if(p==0u||t==0u){return 0u;}if(!otRange(r,t,p,4u)){return 0u;}let fmt=ot16(t,p);
 if(fmt==1u){let first=ot16(t,p+2u);let n=ot16(t,p+4u);if(!otRange(r,t,p+6u,n*2u)){return 0u;}if(g>=first&&g-first<n){return ot16(t,p+6u+(g-first)*2u);}}
 else if(fmt==2u){let n=ot16(t,p+2u);if(!otRange(r,t,p+4u,n*6u)){return 0u;}var lo=0u;var hi=n;while(lo<hi){let m=u32((lo+hi)/2u);let q=p+4u+m*6u;if(g<ot16(t,q)){hi=m;}else if(g>ot16(t,q+2u)){lo=m+1u;}else{return ot16(t,q+4u);}}}else{shFail(r,4u);}return 0u;
}
fn shMap(face:u32,cp:u32)->u32{if(cp>0x10ffffu){return 0u;}let p=heap[heap[face+5u]+(cp>>8u)];if(p==0u){return 0u;}return heap[p+(cp&255u)];}
fn shMapFace(r:u32,cp:u32,preferred:u32)->u32{if(preferred<heap[r+9u]&&shMap(shFace(r,preferred),cp)!=0u){return preferred;}for(var f=0u;f<heap[r+9u];f++){if(shMap(shFace(r,f),cp)!=0u){return f;}}return 0u;}
fn shClass(r:u32,i:u32)->u32{let g=shGlyph(r,i);let t=heap[shFont(r,heap[g+4u])+2u];if(t==0u){return select(1u,3u,(heap[g+5u]&31u)==3u||(heap[g+5u]&31u)==10u);}return otClass(r,t,ot16(t,4u),heap[g]);}
fn shIgnored(r:u32,i:u32,flags:u32,sh_set:u32)->bool{
 let g=shGlyph(r,i);let cls=shClass(r,i);if((cls==1u&&(flags&2u)!=0u)||(cls==2u&&(flags&4u)!=0u)||(cls==3u&&(flags&8u)!=0u)){return true;}
 if(cls==3u){let t=heap[shFont(r,heap[g+4u])+2u];if((flags&16u)!=0u){if(t==0u||ot16(t,2u)<2u){return true;}let p=ot16(t,12u);if(p==0u||ot16(t,p)!=1u||sh_set>=ot16(t,p+2u)){return true;}return otCoverage(r,t,p+ot32(t,p+4u+sh_set*4u),heap[g])==0xffffffffu;}if((flags>>8u)!=0u){return otClass(r,t,ot16(t,10u),heap[g])!=(flags>>8u);}}
 return (heap[g+19u]&1u)!=0u;
}
fn shNeighbor(r:u32,start:u32,step:i32,flags:u32,sh_set:u32,reference:u32)->u32{let root=shGlyph(r,reference);var i=i32(start)+step;while(i>=0&&i<i32(heap[r+7u])){if(!shStep(r)){return 0xffffffffu;}let a=shGlyph(r,u32(i));if(heap[a+4u]!=heap[root+4u]||heap[a+6u]!=heap[root+6u]||heap[a+17u]!=heap[root+17u]){return 0xffffffffu;}if(!shIgnored(r,u32(i),flags,sh_set)){return u32(i);}i+=step;}return 0xffffffffu;}
fn shCopy(to:u32,sh_from:u32){for(var k=0u;k<20u;k++){heap[to+k]=heap[sh_from+k];}}
fn shDelete(r:u32,i:u32){let n=heap[r+7u];for(var j=i+1u;j<n;j++){shCopy(shGlyph(r,j-1u),shGlyph(r,j));}heap[r+7u]=n-1u;}
fn shSetGlyph(r:u32,i:u32,gid:u32)->bool{let g=shGlyph(r,i);if(gid>=heap[shFace(r,heap[g+4u])+3u]){shFail(r,64u);return false;}heap[g]=gid;return true;}
fn shUid(r:u32,i:u32)->u32{if(i>=heap[r+7u]){return 0xffffffffu;}return heap[shGlyph(r,i)+16u];}
fn shFindUid(r:u32,id:u32)->u32{for(var i=0u;i<heap[r+7u];i++){if(shUid(r,i)==id){return i;}}return heap[r+7u];}
fn shNextUid(r:u32,next:u32,depth:u32){if(depth==0u){heap[r+49u]=shUid(r,next);}}
fn shEnqueue(r:u32,lookup:u32,i:u32,face:u32,positioning:u32,value:u32,depth:u32){if(depth>16u||heap[r+29u]>=256u){shFail(r,8u);return;}let p=heap[r+30u]+heap[r+29u]*8u;heap[p]=lookup;heap[p+1u]=shUid(r,i);heap[p+2u]=face;heap[p+3u]=positioning;heap[p+4u]=value;heap[p+5u]=depth;heap[p+6u]=i;heap[r+29u]++;}
fn otPredicate(r:u32,t:u32,base:u32,p:u32,mode:u32,classes:u32,gid:u32)->bool{
 let value=ot16(t,p);if(mode==0u){return gid==value;}if(mode==1u){return otClass(r,t,classes,gid)==value;}return otCoverage(r,t,base+value,gid)!=0xffffffffu;
}
fn otSequence(r:u32,t:u32,base:u32,p:u32,count:u32,mode:u32,classes:u32,start:u32,step:i32,flags:u32,sh_set:u32,reference:u32,first:bool,store:bool)->u32{
 if(count>64u||!otRange(r,t,p,count*2u)){shFail(r,4u);return 0xffffffffu;}var at=start;
 for(var k=0u;k<count;k++){if(!first||k>0u){at=shNeighbor(r,at,step,flags,sh_set,reference);}if(at==0xffffffffu){return at;}if(!otPredicate(r,t,base,p+k*2u,mode,classes,heap[shGlyph(r,at)])){return 0xffffffffu;}if(store){heap[heap[r+31u]+k]=at;}}
 return at;
}
fn otContextRecords(r:u32,t:u32,p:u32,count:u32,inputCount:u32,face:u32,positioning:u32,value:u32,depth:u32,last:u32)->bool{
 if(count>64u||!otRange(r,t,p,count*4u)){shFail(r,4u);return false;}let list=ot16(t,8u);let n=ot16(t,list);
 for(var k=count;k>0u;k--){let q=p+(k-1u)*4u;let seq=ot16(t,q);let lookup=ot16(t,q+2u);if(seq>=inputCount||lookup>=n){shFail(r,4u);return false;}shEnqueue(r,list+ot16(t,list+2u+lookup*2u),heap[heap[r+31u]+seq],face,positioning,value,depth+1u);}
 shNextUid(r,last+1u,depth);return true;
}
fn otContext(r:u32,t:u32,p:u32,i:u32,flags:u32,sh_set:u32,face:u32,positioning:u32,value:u32,depth:u32,chained:bool)->bool{
 let fmt=ot16(t,p);if(fmt<1u||fmt>3u){shFail(r,4u);return false;}
 let gid=heap[shGlyph(r,i)];var ci=0u;if(fmt!=3u){ci=otCoverage(r,t,p+ot16(t,p+2u),gid);if(ci==0xffffffffu){return false;}}
 var mode=0u;var backClass=0u;var inputClass=0u;var afterClass=0u;var sets=0u;var nsets=0u;var chosen=ci;
 if(fmt==1u){nsets=ot16(t,p+4u);sets=p+6u;}
 if(fmt==2u){mode=1u;if(chained){backClass=p+ot16(t,p+4u);inputClass=p+ot16(t,p+6u);afterClass=p+ot16(t,p+8u);nsets=ot16(t,p+10u);sets=p+12u;}else{inputClass=p+ot16(t,p+4u);nsets=ot16(t,p+6u);sets=p+8u;}chosen=otClass(r,t,inputClass,gid);}
 var rules=1u;var setp=0u;if(fmt!=3u){if(chosen>=nsets||!otRange(r,t,sets,nsets*2u)){return false;}let off=ot16(t,sets+chosen*2u);if(off==0u){return false;}setp=p+off;rules=ot16(t,setp);if(!otRange(r,t,setp+2u,rules*2u)){return false;}}else{mode=2u;}
 for(var rule=0u;rule<rules;rule++){
  if(!shStep(r)){return false;}var q=p+2u;if(fmt!=3u){q=setp+ot16(t,setp+2u+rule*2u);}
  if(chained){let nb=ot16(t,q);q+=2u;let b=otSequence(r,t,p,q,nb,mode,backClass,i,-1,flags,sh_set,i,false,false);q+=nb*2u;if(b==0xffffffffu){continue;}}
  let ni=ot16(t,q);q+=2u;if(ni==0u||ni>64u){shFail(r,4u);continue;}var count=0u;if(!chained&&fmt!=3u){count=ot16(t,q);q+=2u;}else if(!chained&&fmt==3u){count=ot16(t,q);q+=2u;}
  heap[heap[r+31u]]=i;var last=i;
  if(fmt==3u){last=otSequence(r,t,p,q,ni,mode,inputClass,i,1,flags,sh_set,i,true,true);q+=ni*2u;}
  else{last=otSequence(r,t,p,q,ni-1u,mode,inputClass,i,1,flags,sh_set,i,false,false);if(last!=0xffffffffu){var at=i;for(var k=1u;k<ni;k++){at=shNeighbor(r,at,1,flags,sh_set,i);heap[heap[r+31u]+k]=at;}}q+=(ni-1u)*2u;}
  if(last==0xffffffffu){continue;}
  if(chained){let na=ot16(t,q);q+=2u;let a=otSequence(r,t,p,q,na,mode,afterClass,last,1,flags,sh_set,i,false,false);q+=na*2u;if(a==0xffffffffu){continue;}count=ot16(t,q);q+=2u;}
  return otContextRecords(r,t,q,count,ni,face,positioning,value,depth,last);
 }
 return false;
}
fn otSubstitute(r:u32,t:u32,p:u32,kind:u32,i:u32,flags:u32,sh_set:u32,face:u32,value:u32,depth:u32)->bool{
 if(kind==5u||kind==6u){return otContext(r,t,p,i,flags,sh_set,face,0u,value,depth,kind==6u);}
 let fmt=ot16(t,p);let g=shGlyph(r,i);let ci=otCoverage(r,t,p+ot16(t,p+2u),heap[g]);if(ci==0xffffffffu){return false;}
 if(kind==1u){if(fmt==1u){return shSetGlyph(r,i,u32(i32(heap[g])+otSigned(t,p+4u))&65535u);}if(fmt==2u){let n=ot16(t,p+4u);if(ci>=n||!otRange(r,t,p+6u,n*2u)){return false;}return shSetGlyph(r,i,ot16(t,p+6u+ci*2u));}}
 if((kind==2u||kind==3u)&&fmt==1u){let n=ot16(t,p+4u);if(ci>=n||!otRange(r,t,p+6u,n*2u)){return false;}let seq=p+ot16(t,p+6u+ci*2u);let count=ot16(t,seq);if(!otRange(r,t,seq+2u,count*2u)){return false;}
  if(kind==3u){if(value==0u||value>count){return false;}return shSetGlyph(r,i,ot16(t,seq+value*2u));}
  if(count==0u){shDelete(r,i);return true;}if(heap[r+7u]+count-1u>heap[r+1u]){shFail(r,1u);return false;}
  for(var k=0u;k<count;k++){if(ot16(t,seq+2u+k*2u)>=heap[shFace(r,face)+3u]){shFail(r,64u);return false;}}
  let temp=heap[r+8u];shCopy(temp,g);for(var j=heap[r+7u];j>i+1u;j--){shCopy(shGlyph(r,j+count-2u),shGlyph(r,j-1u));}heap[r+7u]+=count-1u;
  for(var k=0u;k<count;k++){let at=shGlyph(r,i+k);shCopy(at,temp);heap[at]=ot16(t,seq+2u+k*2u);if(k>0u){heap[at+16u]=heap[r+28u];heap[r+28u]++;}}return true;
 }
 if(kind==4u&&fmt==1u){let n=ot16(t,p+4u);if(ci>=n||!otRange(r,t,p+6u,n*2u)){return false;}let list=p+ot16(t,p+6u+ci*2u);let num=ot16(t,list);if(!otRange(r,t,list+2u,num*2u)){return false;}
  for(var j=0u;j<num;j++){if(!shStep(r)){return false;}let q=list+ot16(t,list+2u+j*2u);let sh_target=ot16(t,q);let count=ot16(t,q+2u);if(count<2u||count>64u||!otRange(r,t,q+4u,(count-1u)*2u)){shFail(r,4u);return false;}
   var at=i;var yes=true;heap[heap[r+31u]]=i;for(var k=1u;k<count;k++){at=shNeighbor(r,at,1,flags,sh_set,i);if(at==0xffffffffu||heap[shGlyph(r,at)]!=ot16(t,q+2u+k*2u)){yes=false;break;}heap[heap[r+31u]+k]=at;}
   if(!yes){continue;}if(sh_target>=heap[shFace(r,face)+3u]){shFail(r,64u);return false;}shNextUid(r,at+1u,depth);let lo=heap[g+1u];let hi=heap[shGlyph(r,at)+2u];let uid=heap[g+16u];
   for(var k=0u;k+1u<count;k++){let a=heap[heap[r+31u]+k];let b=heap[heap[r+31u]+k+1u];for(var m=a+1u;m<b;m++){let mark=shGlyph(r,m);heap[mark+1u]=min(heap[mark+1u],lo);heap[mark+2u]=max(heap[mark+2u],hi);heap[mark+14u]=uid;heap[mark+15u]=k;heap[mark+19u]|=2u;}}
   heap[g]=sh_target;heap[g+2u]=hi;heap[g+15u]=count;for(var k=count;k>1u;k--){shDelete(r,heap[heap[r+31u]+k-1u]);}return true;
  }return false;
 }
 if(kind==8u&&fmt==1u){var q=p+4u;let nb=ot16(t,q);q+=2u;if(otSequence(r,t,p,q,nb,2u,0u,i,-1,flags,sh_set,i,false,false)==0xffffffffu){return false;}q+=nb*2u;let na=ot16(t,q);q+=2u;if(otSequence(r,t,p,q,na,2u,0u,i,1,flags,sh_set,i,false,false)==0xffffffffu){return false;}q+=na*2u;let n=ot16(t,q);q+=2u;if(ci>=n||!otRange(r,t,q,n*2u)){return false;}return shSetGlyph(r,i,ot16(t,q+ci*2u));}
 shFail(r,32u);return false;
}
fn otValueSize(format:u32)->u32{var count=0u;for(var b=0u;b<8u;b++){if((format&(1u<<b))!=0u){count++;}}return count*2u;}
fn otValue(r:u32,t:u32,p:u32,format:u32,g:u32,unit:f32){
 if((format&0xff00u)!=0u||!otRange(r,t,p,otValueSize(format))){shFail(r,4u);return;}var q=p;
 for(var b=0u;b<8u;b++){if((format&(1u<<b))==0u){continue;}if(b<4u){let at=g+select(10u+b,6u+b,b>=2u);hsetf(at,hf(at)+f32(otSigned(t,q))*unit*select(1.0,-1.0,b==1u||b==3u));}else if(ot16(t,q)!=0u){heap[r+45u]|=2u;}q+=2u;}
}
fn otAnchor(r:u32,t:u32,p:u32,axis:u32,unit:f32)->f32{let format=ot16(t,p);if(format<1u||format>3u||!otRange(r,t,p,6u)){shFail(r,4u);return 0.0;}if(format!=1u){heap[r+45u]|=4u;}return f32(otSigned(t,p+2u+axis*2u))*unit*select(1.0,-1.0,axis==1u);}
fn otPosition(r:u32,t:u32,p:u32,kind:u32,i:u32,flags:u32,sh_set:u32,face:u32,value:u32,depth:u32)->bool{
 if(kind==7u||kind==8u){return otContext(r,t,p,i,flags,sh_set,face,1u,value,depth,kind==8u);}
 let fmt=ot16(t,p);let g=shGlyph(r,i);let ci=otCoverage(r,t,p+ot16(t,p+2u),heap[g]);if(ci==0xffffffffu){return false;}let unit=hf(shFont(r,face)+3u);
 if(kind==1u){let format=ot16(t,p+4u);let size=otValueSize(format);if(fmt==1u){otValue(r,t,p+6u,format,g,unit);return true;}if(fmt==2u){let n=ot16(t,p+6u);if(ci>=n||!otRange(r,t,p+8u,n*size)){return false;}otValue(r,t,p+8u+ci*size,format,g,unit);return true;}}
 if(kind==2u){let next=shNeighbor(r,i,1,flags,sh_set,i);if(next==0xffffffffu){return false;}let other=shGlyph(r,next);let a=ot16(t,p+4u);let b=ot16(t,p+6u);let sizeA=otValueSize(a);let sizeB=otValueSize(b);var q=0u;
  if(fmt==1u){let n=ot16(t,p+8u);if(ci>=n||!otRange(r,t,p+10u,n*2u)){return false;}let list=p+ot16(t,p+10u+ci*2u);let count=ot16(t,list);let stride=2u+sizeA+sizeB;if(!otRange(r,t,list+2u,count*stride)){return false;}var lo=0u;var hi=count;while(lo<hi){let m=u32((lo+hi)/2u);if(ot16(t,list+2u+m*stride)<heap[other]){lo=m+1u;}else{hi=m;}}if(lo>=count||ot16(t,list+2u+lo*stride)!=heap[other]){return false;}q=list+4u+lo*stride;}
  else if(fmt==2u){let c1=otClass(r,t,p+ot16(t,p+8u),heap[g]);let c2=otClass(r,t,p+ot16(t,p+10u),heap[other]);let n1=ot16(t,p+12u);let n2=ot16(t,p+14u);if(c1>=n1||c2>=n2){shFail(r,4u);return false;}q=p+16u+(c1*n2+c2)*(sizeA+sizeB);}else{shFail(r,4u);return false;}
  otValue(r,t,q,a,g,unit);otValue(r,t,q+sizeA,b,other,unit);if(b!=0u){shNextUid(r,next+1u,depth);}return true;
 }
 if(kind==3u&&fmt==1u){let n=ot16(t,p+4u);if(ci>=n||!otRange(r,t,p+6u,n*4u)){return false;}let exit=ot16(t,p+8u+ci*4u);if(exit==0u){return false;}let next=shNeighbor(r,i,1,flags,sh_set,i);if(next==0xffffffffu){return false;}let other=shGlyph(r,next);let c2=otCoverage(r,t,p+ot16(t,p+2u),heap[other]);if(c2==0xffffffffu||c2>=n){return false;}let entry=ot16(t,p+6u+c2*4u);if(entry==0u){return false;}
  let dx=otAnchor(r,t,p+exit,0u,unit)-otAnchor(r,t,p+entry,0u,unit);let dy=otAnchor(r,t,p+exit,1u,unit)-otAnchor(r,t,p+entry,1u,unit);
  hsetf(g+8u,dx);heap[other+14u]=i;hsetf(other+11u,dy);heap[other+19u]|=8u;return true;
 }
 if((kind==4u||kind==5u||kind==6u)&&fmt==1u){let classes=ot16(t,p+6u);let m=p+ot16(t,p+8u);let bases=p+ot16(t,p+10u);if(classes==0u||classes>1024u||ci>=ot16(t,m)||!otRange(r,t,m+2u,ot16(t,m)*4u)){shFail(r,4u);return false;}let cls=ot16(t,m+2u+ci*4u);let moff=ot16(t,m+4u+ci*4u);if(cls>=classes||moff==0u){return false;}
  var prev=i;loop{prev=shNeighbor(r,prev,-1,select(flags|8u,flags&0xfffffff7u,kind==6u),sh_set,i);if(prev==0xffffffffu){return false;}let c=shClass(r,prev);if(kind==6u){if(c!=3u){return false;}break;}if(c!=3u){break;}}
  let parent=shGlyph(r,prev);let bi=otCoverage(r,t,p+ot16(t,p+4u),heap[parent]);if(bi==0xffffffffu||bi>=ot16(t,bases)){return false;}var anchorBase=bases;var off=0u;
  if(kind==5u){if(!otRange(r,t,bases+2u,ot16(t,bases)*2u)){return false;}anchorBase=bases+ot16(t,bases+2u+bi*2u);let components=ot16(t,anchorBase);if(components==0u||components>64u){shFail(r,4u);return false;}var component=components-1u;if((heap[g+19u]&2u)!=0u&&heap[g+14u]==heap[parent+16u]){component=min(component,heap[g+15u]);}off=ot16(t,anchorBase+2u+(component*classes+cls)*2u);}
  else{off=ot16(t,bases+2u+(bi*classes+cls)*2u);}if(off==0u){return false;}
  let dx=otAnchor(r,t,anchorBase+off,0u,unit)-otAnchor(r,t,m+moff,0u,unit);let dy=otAnchor(r,t,anchorBase+off,1u,unit)-otAnchor(r,t,m+moff,1u,unit);heap[g+14u]=prev;hsetf(g+10u,dx);hsetf(g+11u,dy);heap[g+19u]=(heap[g+19u]&0xfffffff5u)|4u;heap[r+41u]++;return true;
 }
 shFail(r,32u);return false;
}
fn otApply(r:u32,lookup:u32,i:u32,face:u32,positioning:u32,value:u32){
 heap[r+29u]=0u;heap[r+49u]=shUid(r,i+1u);shEnqueue(r,lookup,i,face,positioning,value,0u);
 while(heap[r+29u]>0u){if(!shStep(r)){return;}heap[r+29u]--;let task=heap[r+30u]+heap[r+29u]*8u;let l=heap[task];var at=heap[task+6u];if(at>=heap[r+7u]||shUid(r,at)!=heap[task+1u]){at=shFindUid(r,heap[task+1u]);}let f=heap[task+2u];let pos=heap[task+3u];let v=heap[task+4u];let depth=heap[task+5u];let t=heap[shFont(r,f)+pos];if(at>=heap[r+7u]||!otRange(r,t,l,6u)){continue;}
  let flags=ot16(t,l+2u);let count=ot16(t,l+4u);if(count>4096u||!otRange(r,t,l+6u,count*2u)){continue;}let sh_filter=select(0u,ot16(t,l+6u+count*2u),(flags&16u)!=0u);if(shIgnored(r,at,flags,sh_filter)){continue;}
  for(var sub=0u;sub<count;sub++){if(!shStep(r)){return;}var kind=ot16(t,l);var p=l+ot16(t,l+6u+sub*2u);var ext=0u;
   while(kind==select(7u,9u,pos==1u)){if(ext>=8u||ot16(t,p)!=1u||!otRange(r,t,p,8u)){shFail(r,4u);break;}kind=ot16(t,p+2u);p+=ot32(t,p+4u);ext++;}
   var matched=false;if(pos==0u){matched=otSubstitute(r,t,p,kind,at,flags,sh_filter,f,v,depth);}else{matched=otPosition(r,t,p,kind,at,flags,sh_filter,f,v,depth);}if(matched){break;}
  }
 }
}
fn shAppend(r:u32,cp:u32,start:u32,end:u32)->bool{
 let n=heap[r+7u];if(n>=heap[r+1u]){shFail(r,1u);return false;}let g=shGlyph(r,n);for(var k=0u;k<20u;k++){heap[g+k]=0u;}heap[g+1u]=start;heap[g+2u]=end;heap[g+3u]=cp;heap[g+5u]=ucProps(heap[r+12u],cp);heap[g+14u]=0xffffffffu;heap[g+16u]=heap[r+28u];heap[r+28u]++;heap[g+17u]=ucScript(heap[r+12u],cp);heap[g+18u]=(heap[g+5u]>>16u)&31u;heap[r+7u]=n+1u;return true;
}
fn shNormalize(r:u32){
 let u=heap[r+12u];let data=heap[r+2u];let count=heap[r+3u];let boundaries=heap[r+21u];for(var i=0u;i<=count;i++){heap[boundaries+i]=select(0u,1u,ucBoundary(u,data,count,i,0xffffffffu,0xffffffffu));}
 heap[r+7u]=0u;heap[r+28u]=1u;var cluster=0u;
 while(cluster<count){var end=cluster+1u;while(end<count&&heap[boundaries+end]==0u){end++;}
  for(var i=cluster;i<end;i++){var pending:array<u32,32>;var n=1u;pending[0]=heap[data+i];
   while(n>0u){if(!shStep(r)){return;}n--;let cp=pending[n];if((heap[r+24u]&1u)!=0u){
     if(cp>=0xac00u&&cp<0xd7a4u){let s=cp-0xac00u;let t=s%28u;if(n+3u>32u){shFail(r,8u);return;}if(t>0u){pending[n]=0x11a7u+t;n++;}pending[n]=0x1161u+u32(s%588u/28u);n++;pending[n]=0x1100u+u32(s/588u);n++;continue;}
     let d=ucDecomp(u,cp);if(d!=0u){let len=heap[d];if(n+len>32u){shFail(r,8u);return;}for(var k=len;k>0u;k--){pending[n]=heap[d+k];n++;}continue;}
    }
    let separate=(ucProps(u,cp)&(1u<<24u))!=0u&&cp!=0x200du;
    if(!shAppend(r,cp,select(cluster,i,separate),select(end,i+1u,separate))){return;}
   }
  }cluster=end;
 }
 if((heap[r+24u]&1u)==0u){return;}
 let temp=heap[r+8u];for(var i=1u;i<heap[r+7u];i++){let g=shGlyph(r,i);let c=(heap[g+5u]>>8u)&255u;if(c==0u){continue;}var j=i;shCopy(temp,g);while(j>0u){let p=shGlyph(r,j-1u);let prev=(heap[p+5u]>>8u)&255u;if(prev==0u||prev<=c){break;}shCopy(shGlyph(r,j),p);j--;}shCopy(shGlyph(r,j),temp);}
 var starter=0xffffffffu;var lastClass=0u;var at=0u;
 while(at<heap[r+7u]){let g=shGlyph(r,at);let c=(heap[g+5u]>>8u)&255u;var composed=0u;if(starter!=0xffffffffu&&(lastClass==0u||lastClass<c)){composed=ucCompose(u,heap[shGlyph(r,starter)+3u],heap[g+3u]);}
  var exists=false;if(composed!=0u){for(var face=0u;face<heap[r+9u];face++){if(shMap(shFace(r,face),composed)!=0u){exists=true;break;}}}
  if(exists){let s=shGlyph(r,starter);heap[s+3u]=composed;heap[s+5u]=ucProps(u,composed);heap[s+17u]=ucScript(u,composed);heap[s+18u]=(heap[s+5u]>>16u)&31u;heap[s+1u]=min(heap[s+1u],heap[g+1u]);heap[s+2u]=max(heap[s+2u],heap[g+2u]);shDelete(r,at);continue;}
  if(c==0u){starter=at;}lastClass=c;at++;
 }
}
fn shSupportedScript(script:u32)->bool{return script==0x44464c54u||script==0x6c61746eu||script==0x6772656bu||script==0x6379726cu||script==0x61726162u||script==0x68656272u||script==0x68616e67u||script==0x68616e69u||script==0x6b616e61u;}
fn shMapAndJoin(r:u32){
 let n=heap[r+7u];var previousScript=0x6c61746eu;
 for(var i=0u;i<n;i++){let g=shGlyph(r,i);var script=heap[r+16u];if(script==0u){script=heap[g+17u];if(script==0x44464c54u){script=previousScript;if(i==0u||shBidiOriginal(r,i-1u)==7u){for(var j=i+1u;j<n;j++){let s=heap[shGlyph(r,j)+17u];if(s!=0x44464c54u){script=s;break;}}}}}heap[g+17u]=script;previousScript=script;
  if(!shSupportedScript(script)){heap[r+44u]=heap[g+3u];heap[r+45u]|=8u;if((heap[r+24u]&2u)!=0u){shFail(r,16u);}}
 }
 // Prefer one face for an entire grapheme; fall back per scalar only when no
 // prepared face covers that cluster. No CPU fallback-font or cache notification.
 var start=0u;while(start<n){let first=shGlyph(r,start);var end=start+1u;while(end<n&&heap[shGlyph(r,end)+1u]==heap[first+1u]&&heap[shGlyph(r,end)+2u]==heap[first+2u]){end++;}var chosen=0xffffffffu;
  for(var f=0u;f<heap[r+9u];f++){var all=true;for(var j=start;j<end;j++){let g=shGlyph(r,j);if((heap[g+5u]&(1u<<24u))!=0u){continue;}var cp=heap[g+3u];if((heap[g+6u]&1u)!=0u){cp=ucMirror(heap[r+12u],cp);}if(shMap(shFace(r,f),cp)==0u){all=false;break;}}if(all){chosen=f;break;}}
  for(var j=start;j<end;j++){let g=shGlyph(r,j);var cp=heap[g+3u];if((heap[g+6u]&1u)!=0u){cp=ucMirror(heap[r+12u],cp);}let f=shMapFace(r,cp,chosen);heap[g+4u]=f;let gid=shMap(shFace(r,f),cp);heap[g]=select(heap[shFace(r,f)+7u],gid-1u,gid!=0u);
   if((heap[g+5u]&(1u<<24u))!=0u&&(heap[r+24u]&4u)==0u){heap[g+19u]|=1u;}if(cp==9u||cp==10u||cp==13u){heap[g+19u]|=1u;}
   heap[g+14u]=0xffffffffu;heap[g+7u]=1u;
  }start=end;
 }
 // Unicode Joining_Type; Arabic feature application is masked by logical joins.
 for(var i=0u;i<n;i++){let g=shGlyph(r,i);let joining=(heap[g+5u]>>21u)&7u;if(joining==5u){heap[g+7u]=0u;continue;}var prev=0xffffffffu;var next=0xffffffffu;var p=i;
  while(p>0u){p--;let other=shGlyph(r,p);let sh_type=(heap[other+5u]>>21u)&7u;if(sh_type!=5u){prev=p;break;}}
  p=i+1u;while(p<n){let sh_type=(heap[shGlyph(r,p)+5u]>>21u)&7u;if(sh_type!=5u){next=p;break;}p++;}
  var left=false;var right=false;
  if(prev!=0xffffffffu){let other=shGlyph(r,prev);let sh_type=(heap[other+5u]>>21u)&7u;left=(joining==1u||joining==2u||joining==4u)&&(sh_type==1u||sh_type==2u||sh_type==3u)&&heap[other+6u]==heap[g+6u]&&heap[other+4u]==heap[g+4u];}
  if(next!=0xffffffffu){let other=shGlyph(r,next);let sh_type=(heap[other+5u]>>21u)&7u;right=(joining==1u||joining==2u||joining==3u)&&(sh_type==1u||sh_type==2u||sh_type==4u)&&heap[other+6u]==heap[g+6u]&&heap[other+4u]==heap[g+4u];}
  var mask=1u;if(left&&right){mask=16u;}else if(left){mask=2u;}else if(right){mask=64u;}heap[g+7u]=mask;
 }
}
fn shLookupReverse(t:u32,p:u32)->bool{let kind=ot16(t,p);if(kind==8u){return true;}if(kind==7u&&ot16(t,p+4u)>0u){let sub=p+ot16(t,p+6u);return ot16(t,sub)==1u&&ot16(t,sub+2u)==8u;}return false;}
fn shApplyPlans(r:u32,positioning:u32){
 for(var face=0u;face<heap[r+9u];face++){let plans=heap[heap[r+11u]+face];let scriptCount=heap[plans];let t=heap[shFont(r,face)+positioning];if(t==0u){continue;}
  for(var s=0u;s<scriptCount;s++){let entry=plans+1u+s*3u;let script=heap[entry];var present=false;for(var i=0u;i<heap[r+7u];i++){let g=shGlyph(r,i);if(heap[g+4u]==face&&heap[g+17u]==script){present=true;break;}}if(!present){continue;}let plan=heap[entry+1u+positioning];let count=heap[plan];
   for(var l=0u;l<count;l++){let p=plan+1u+l*4u;let lookup=heap[p];let mask=heap[p+1u];let value=heap[p+2u];let reverse=positioning==0u&&shLookupReverse(t,lookup);
    // One lookup interpreter call site for both traversal directions. Native
    // shader compilers inline this large graph; duplicating it is costly.
    var cursor=select(0u,heap[r+7u],reverse);
    loop{
     var i=cursor;
     if(reverse){if(cursor==0u){break;}cursor--;i=cursor;}
     else{if(i>=heap[r+7u]){break;}if(!shStep(r)){return;}cursor=i+1u;}
     let g=shGlyph(r,i);if(heap[g+4u]!=face||heap[g+17u]!=script||(mask!=0u&&(heap[g+7u]&mask)==0u)){continue;}
     otApply(r,lookup,i,face,positioning,value);if(heap[r+18u]!=0u){return;}
     if(!reverse){let next=heap[r+49u];if(next==0xffffffffu){break;}var found=i;while(found<heap[r+7u]&&shUid(r,found)!=next){if(!shStep(r)){return;}found++;}cursor=found;}
    }
   }
  }
 }
}
fn shInitializeAdvances(r:u32){hsetf(r+34u,0.0);hsetf(r+35u,0.0);hsetf(r+51u,0.0);for(var i=0u;i<heap[r+7u];i++){let g=shGlyph(r,i);let face=shFace(r,heap[g+4u]);var width=hf(heap[face+4u]+heap[g]*4u+1u);if(shClass(r,i)==3u||(heap[g+19u]&1u)!=0u){width=0.0;}hsetf(g+8u,width);hsetf(g+9u,0.0);hsetf(g+10u,0.0);hsetf(g+11u,0.0);hsetf(r+34u,max(hf(r+34u),hf(face)));hsetf(r+35u,max(hf(r+35u),hf(face+1u)));hsetf(r+51u,max(hf(r+51u),hf(face+2u)));}if(heap[r+7u]==0u){let face=shFace(r,0u);hsetf(r+34u,hf(face));hsetf(r+35u,hf(face+1u));hsetf(r+51u,hf(face+2u));}}
fn shLegacyKern(r:u32){if((heap[r+45u]&1u)!=0u){return;}for(var i=0u;i+1u<heap[r+7u];i++){let g=shGlyph(r,i);let f=shFont(r,heap[g+4u]);if(heap[f+1u]!=0u){continue;}let next=shNeighbor(r,i,1,8u,0u,i);if(next==0xffffffffu){continue;}let gid=heap[shGlyph(r,next)];let base=heap[f+6u];let n=heap[f+5u];var lo=0u;var hi=n;while(lo<hi){let m=u32((lo+hi)/2u);let p=base+m*3u;if(heap[p]<heap[g]||(heap[p]==heap[g]&&heap[p+1u]<gid)){lo=m+1u;}else{hi=m;}}if(lo<n){let p=base+lo*3u;if(heap[p]==heap[g]&&heap[p+1u]==gid){hsetf(g+8u,hf(g+8u)+hf(p+2u));}}}}
fn shFinalCoordinate(r:u32,i:u32,axis:u32)->f32{
 var at=i;var delta=0.0;var count=0u;
 loop{if(count>heap[r+7u]||!shStep(r)){shFail(r,8u);return 0.0;}let g=shGlyph(r,at);let flags=heap[g+19u];let parent=heap[g+14u];delta+=hf(g+10u+axis);if(parent<heap[r+7u]&&((flags&4u)!=0u||(axis==1u&&(flags&8u)!=0u))){at=parent;count++;continue;}return hf(g+12u+axis)+delta;}
}
fn shCaretCoordinate(r:u32,g:u32,inner:u32,parts:u32,width:f32)->f32{
 let face=shFace(r,heap[g+4u]);let font=shFont(r,heap[g+4u]);let t=heap[font+2u];if(t!=0u){let list=ot16(t,8u);if(list!=0u){let index=otCoverage(r,t,list+ot16(t,list),heap[g]);if(index!=0xffffffffu&&index<ot16(t,list+2u)){let lig=list+ot16(t,list+4u+index*2u);let n=ot16(t,lig);if(inner>0u&&inner<=n&&n+1u==parts){let caret=lig+ot16(t,lig+2u+(inner-1u)*2u);let format=ot16(t,caret);if(format==1u||format==3u){return clamp(f32(otSigned(t,caret+2u))*hf(font+3u),0.0,width);}}}}}
 return width*f32(inner)/f32(max(1u,parts));
}
fn shPositionOutput(r:u32){
 let n=heap[r+7u];let order=heap[r+22u];for(var i=0u;i<n;i++){heap[order+i]=i;}var start=0u;var lines=0u;var maxWidth=0.0;let lineHeight=max(0.001,hf(r+34u)+hf(r+35u));
 while(start<n){var end=start;var maxLevel=0u;var minOdd=126u;while(end<n&&shBidiOriginal(r,end)!=7u){let level=heap[shGlyph(r,end)+6u];maxLevel=max(maxLevel,level);if((level&1u)!=0u){minOdd=min(minOdd,level);}end++;}
  var l=maxLevel;while(l>=minOdd&&l>0u){var p=start;while(p<end){if(heap[shGlyph(r,heap[order+p])+6u]<l){p++;continue;}let a=p;while(p<end&&heap[shGlyph(r,heap[order+p])+6u]>=l){p++;}var x=a;var y=p;while(x<y){y--;if(x>=y){break;}let tmp=heap[order+x];heap[order+x]=heap[order+y];heap[order+y]=tmp;x++;}}l--;}
  var pen=0.0;for(var j=start;j<end;j++){let g=shGlyph(r,heap[order+j]);if(heap[g+3u]==9u){let face=shFace(r,heap[g+4u]);let sp=shMap(face,32u);var tab=1.0;if(sp>0u){tab=max(0.001,hf(heap[face+4u]+(sp-1u)*4u+1u)*4.0);}hsetf(g+8u,(floor(pen/tab)+1.0)*tab-pen);}hsetf(g+12u,pen);hsetf(g+13u,f32(lines)*lineHeight);pen+=hf(g+8u);}
  maxWidth=max(maxWidth,pen);if(end<n){let g=shGlyph(r,end);hsetf(g+12u,pen);hsetf(g+13u,f32(lines)*lineHeight);}lines++;start=end+1u;
 }
 if(n==0u){lines=1u;}else if(shBidiOriginal(r,n-1u)==7u){lines++;}heap[r+33u]=lines;hsetf(r+23u,maxWidth);
 let temp=heap[r+8u];for(var i=0u;i<n;i++){hsetf(temp+i*2u,shFinalCoordinate(r,i,0u));hsetf(temp+i*2u+1u,shFinalCoordinate(r,i,1u));}
 for(var i=0u;i<n;i++){let g=shGlyph(r,i);let x=hf(temp+i*2u);let y=hf(temp+i*2u+1u);hsetf(g+10u,x-hf(g+12u));hsetf(g+11u,y-hf(g+13u));hsetf(g+12u,x);hsetf(g+13u,y);}
 let carets=heap[r+32u];for(var i=0u;i<=heap[r+3u];i++){heap[carets+i*2u]=0x7fc00000u;heap[carets+i*2u+1u]=0x7fc00000u;}
 var at=0u;while(at<n){let first=shGlyph(r,at);let lo=heap[first+1u];let hi=heap[first+2u];var end=at+1u;var x0=hf(first+12u)-hf(first+10u);var x1=x0+hf(first+8u);while(end<n&&heap[shGlyph(r,end)+1u]==lo&&heap[shGlyph(r,end)+2u]==hi){let g=shGlyph(r,end);let pen=hf(g+12u)-hf(g+10u);x0=min(x0,pen);x1=max(x1,pen+hf(g+8u));end++;}
  var parts=0u;for(var c=lo;c<hi;c++){parts+=heap[heap[r+21u]+c];}parts=max(1u,parts);var index=0u;let rtl=(heap[first+6u]&1u)!=0u;
  for(var c=lo;c<=hi;c++){if(heap[heap[r+21u]+c]==0u){continue;}var delta=shCaretCoordinate(r,first,index,parts,max(0.0,x1-x0));if(c==lo){delta=0.0;}if(c==hi){delta=x1-x0;}let x=select(x0+delta,x1-delta,rtl);if(c<hi){hsetf(carets+c*2u,x);}if(c>lo){hsetf(carets+c*2u+1u,x);}index++;}at=end;
 }
 for(var i=0u;i<=heap[r+3u];i++){let p=carets+i*2u;if(heap[p]==0x7fc00000u){heap[p]=heap[p+1u];}if(heap[p+1u]==0x7fc00000u){heap[p+1u]=heap[p];}}if(n==0u){hsetf(carets,0.0);hsetf(carets+1u,0.0);}
}
fn shHideIgnorables(r:u32){
 if((heap[r+24u]&4u)!=0u){return;}
 for(var i=0u;i<heap[r+7u];i++){let g=shGlyph(r,i);if((heap[g+5u]&(1u<<24u))!=0u){let space=shMap(shFace(r,heap[g+4u]),32u);if(space>0u){heap[g]=space-1u;}hsetf(g+8u,0.0);hsetf(g+9u,0.0);hsetf(g+10u,0.0);hsetf(g+11u,0.0);heap[g+19u]|=1u;}}
}
fn shapeRun(r:u32){
 if(heap[r+4u]==heap[r+5u]&&heap[r+36u]==heap[r+37u]){return;}
 heap[r+5u]=heap[r+4u];heap[r+37u]=heap[r+36u];heap[r+18u]=0u;heap[r+26u]=0u;heap[r+41u]=0u;heap[r+42u]=0u;heap[r+44u]=0u;heap[r+45u]&=1u;heap[r+47u]=0u;
 if(heap[r+3u]>heap[r+39u]){shFail(r,1u);return;}shNormalize(r);if(heap[r+18u]!=0u){return;}shBidi(r);shMapAndJoin(r);if(heap[r+18u]!=0u){return;}
 // Preserve GSUB -> advances -> GPOS ordering with one interpreter call site.
 for(var positioning=0u;positioning<2u;positioning++){
  if(positioning==1u){shInitializeAdvances(r);}
  shApplyPlans(r,positioning);if(heap[r+18u]!=0u){return;}
 }
 shLegacyKern(r);shHideIgnorables(r);shPositionOutput(r);if(heap[r+18u]!=0u){return;}
 heap[r+5u]=heap[r+4u];heap[r+37u]=heap[r+36u];heap[r+19u]++;heap[r+47u]=1u;heap[r+27u]=heap[r+3u];for(var i=0u;i<heap[r+3u];i++){heap[heap[r+20u]+i]=heap[heap[r+2u]+i];}
}
