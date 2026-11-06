// GPU-only input mailboxes in the reserved scratch header (HITS begins at 64):
// 9 cursor; 10 prepared caret index+1; 11 effects pending; 12..13 activation;
// 14..19 editor command; 20..26 designer command; 27 delayed capture release;
// 28..34 editor input; 36..38 designer route; 39..43 dock pointer;
// 44..45 designer pointer destination/kind; 46..49 core key job;
// 50..53 dirty tile rectangle (min x/y, exclusive max x/y).
// Flags are consumed by their stage.
// An input event cannot advance past its effects; all stages share one queue.
@compute @workgroup_size(128)
fn clearFrame(@builtin(global_invocation_id) id:vec3<u32>) {
 let i=id.x;
 if(i<frame.screen.z*frame.screen.w) {
  atomicStore(&scratch[TILE_COUNTS+i],0u);
  atomicStore(&scratch[DAMAGE+i],select(0u,1u,(frame.flags.x&1u)!=0u || (frame.flags.y&16u)!=0u || state[15]!=0u));
 }
 if(i<DRAW_HEADS) { draws.heads[i]=NONE; }
 if(i<GLYPH_SHARDS) { atomicStore(&scratch[GLYPH_BUCKETS+i],NONE); }
 if(i<4u) { atomicStore(&scratch[GLYPH_STATS+i],0u); }
 if(i<512u) { atomicStore(&scratch[HITS+i],0u); }
 if(i<8u) { atomicStore(&scratch[i],0u); }
 if(i==0u) {
  let fullDamage=(frame.flags.x&1u)!=0u || (frame.flags.y&16u)!=0u || state[15]!=0u;
  atomicStore(&scratch[50u],select(NONE,0u,fullDamage));atomicStore(&scratch[51u],select(NONE,0u,fullDamage));
  atomicStore(&scratch[52u],select(0u,frame.screen.z,fullDamage));atomicStore(&scratch[53u],select(0u,frame.screen.w,fullDamage));
  atomicStore(&scratch[8u],0u);
  atomicStore(&scratch[9u],0u); // Input FIFO cursor, shared across dispatches.
  atomicStore(&scratch[45u],0u);atomicStore(&scratch[46u],0u);
  atomicStore(&scratch[39u],0u);
  atomicStore(&scratch[27u],0u);
  atomicStore(&scratch[28u],0u);atomicStore(&scratch[36u],0u);
  atomicStore(&scratch[11u],0u); // Pending action interpreter.
  atomicStore(&scratch[10u],0u); // Prepared caret command (index + 1).
  updateModal();
  if(!externalInput()){relay[0u]=0u;relay[2u]=0u;}
  atomicStore(&draws.count,0u); atomicStore(&draws.overflow,0u);
  state[51]=0u; state[52]=0u; state[53]=0u;
  state[58]=0u;if(state[9u]!=0u){heap[state[9u]]=0u;heap[state[9u]+1u]=0u;} // Actual-layout marker; words 54..57 are retained font directories.
  state[10]=frame.counts.z; state[38]=frame.counts.w;
  if((frame.flags.x&1u)!=0u) { state[3]=1u; }
  let elapsed=clamp(frame.viewport.w-sf(22u),0.0,0.1);
  if(state[5]!=0u) { setf(46u,sf(46u)+elapsed); }
  setf(22u,frame.viewport.w); setf(20u,frame.viewport.x); setf(21u,frame.viewport.y);
 }
}
@compute @workgroup_size(64)
fn hitTest(@builtin(global_invocation_id) id:vec3<u32>) {
 let i=id.x; if(i>=frame.counts.x) { return; } let n=nodes[i];
 if(!dsCanHit(i) || (n.text.y&1u)==0u || !enabled(i) || !modalOwns(i) || n.translation.z<=0.001) { return; }
 for(var e=0u;e<inputCount();e++) {
  let c=inputCommand(e); if(c.kind>4u || c.recipient!=NONE || !contains(n.clip,c.position)) { continue; }
  let p=inverse(n.matrix,n.translation.xy,c.position);
  if(contains(boundsOf(n.rect),p)&&dockHitCandidate(i,c.position)) { atomicMax(&scratch[HITS+e],paintNode(i)+1u); }
 }
}
fn invalidateText(i:u32) {
 // TextBox measures to a fixed 200x38 intrinsic size. Text editing is paint-only.
 if(i==state[26]) { state[4]=1u; }
 for(var k=0u;k<state[44u];k++){let d=nodes[heap[state[14u]+k]].aux.x;if(heap[d+8u]==i){heap[d+13u]=1u;}}
 setf(41u,frame.viewport.w);
}
fn invalidateValue(i:u32) { if(i==state[27]) { state[4]=1u; } }
fn applyProperty(i:u32,property:u32,value:f32) {
 if(i>=frame.counts.x) { state[43]+=1u; return; } let s=cs(i);
 templateLocalValue(i,property,true);
 if(property>=3u&&property<=8u){styleLocalValue(i,select(property+4u,3u,property==3u));}
 switch property {
  case 0u: { setf(s,value); invalidateValue(i); }
  case 1u: { nodes[i].size.x=max(-1.0,value); state[3]=1u; }
  case 2u: { nodes[i].size.y=max(-1.0,value); state[3]=1u; }
  case 3u: { setf(s+3u,clamp(value,0.0,1.0)); }
  case 4u: { setf(s+8u,value); }
  case 5u: { setf(s+9u,value); }
  case 6u: { setf(s+10u,max(0.001,value)); }
  case 7u: { setf(s+11u,max(0.001,value)); }
  case 8u: { setf(s+12u,value); }
  case 9u: { nodes[i].text.y=(nodes[i].text.y&~32u)|select(32u,0u,value>0.0); state[3]=1u; }
  case 10u: { setf(s+1u,max(0.0,value)); }
  case 11u: { nodes[i].limits.z=max(0.0,value);let e=extension(nodes[i]);if(e!=0u){heap[e+1u]&=~1u;}state[3]=1u; }
  case 12u: { if(nodes[i].info.x==9u) { state[s+4u]=0u; state[s+5u]=0u; state[s+6u]=0u; invalidateText(i); } }
  default: { state[43]+=1u; }
 }
}
// Decode activation at every input route, but compile the large action
// interpreter only once. Bulk spaces retain one activation per character.
var<private> activationTarget:u32;
var<private> activationCount:u32;
var<private> releaseCapture:bool;
fn activate(i:u32) { activationTarget=i;activationCount++; }
fn applyActivation(i:u32) {
 let n=nodes[i]; let s=cs(i);
 if(n.info.x==7u) { setf(s,1.0-clamp(sf(s),0.0,1.0)); invalidateValue(i); }
 let recipient=select(n.action.y,i,n.action.y==NONE); let targetState=cs(recipient);
 switch n.action.x {
  case 15u: {templateCommand(n.action.y,n.action.z,heap[n.action.w],heap[n.action.w+1u]);}
  case 14u:{dsCommand(dsOwner(n.action.y),n.action.z,hf(n.action.w),hf(n.action.w+1u),0.0,0.0);}
  case 13u:{actionEvent(i,select(bitcast<f32>(n.action.z),sf(cs(i)),n.info.x==7u),NONE);}
  case 1u: { setf(targetState,1.0-clamp(sf(targetState),0.0,1.0)); invalidateValue(recipient); }
  case 2u: { setf(targetState,sf(targetState)+bitcast<f32>(n.action.z)); invalidateValue(recipient); }
  case 3u: { setf(targetState,bitcast<f32>(n.action.z)); invalidateValue(recipient); }
  case 4u: { state[5]=1u-state[5]; }
  case 5u: { let tp=templateSystem();if(tp!=0u){heap[tp+2u]=1u-heap[tp+2u];state[3]=1u;}else{state[6]=1u-state[6];} }
  case 6u: { state[7]=1u-state[7]; }
  case 7u: { applyProperty(recipient,12u,0.0); }
  case 8u: { state[8]=u32(max(0.0,bitcast<f32>(n.action.z))); state[0]=NONE; state[3]=1u; }
  case 10u:{modelCommand(n.action.y,n.action.w,n.action.z,0.0,0u);}
  case 11u:{let recipientNode=select(n.action.y,state[24u],n.action.y==NONE);if(isEditor(recipientNode)&&visible(recipientNode)){state[0]=recipientNode;editorCommand(recipientNode,n.action.z,0.0,0.0,0u);}}
  case 12u:{if(nodes[recipient].info.x==25u){dockCommand(heap[nodes[recipient].aux.x],n.action.z,recipient,0.0);}}
  case 9u: { setf(targetState+1u,0.0); setf(targetState+2u,0.0); }
  default: {}
 }
}
fn maxScroll(i:u32)->f32 {
 let n=nodes[i]; let r=contentRect(n);
 if(isList(i)){let d=n.aux.x;return max(0.0,f32(heap[d+7u])*hf(d+6u)-r.w);}
 if(isEditor(i)){return max(0.0,f32(heap[ed(i)+32u])*edLineHeight(i)-edVisibleHeight(i));}
 if(n.info.x==11u) { return max(0.0,f32(heap[n.action.w+10u])*hf(n.action.w+15u)-max(0.0,r.w-42.0-26.0)); }
 var bottom=0.0; for(var j=0u;j<n.info.w;j++) { bottom=max(bottom,nodes[child(n,j)].available.w); }
 return max(0.0,bottom-r.w);
}
fn maxScrollX(i:u32)->f32 {
 let n=nodes[i]; if(isList(i)){return 0.0;}
 if(n.info.x==13u){if(!horizontalScroll(n)){return 0.0;}var right=0.0;for(var j=0u;j<n.info.w;j++){right=max(right,nodes[child(n,j)].available.z);}return max(0.0,right-contentRect(n).z);}
 if(isEditor(i)){return max(0.0,f32(heap[ed(i)+33u])*edCell(i)-edTextWidth(i));} if(n.info.x!=11u) { return 0.0; } let t=n.action.w; var width=0.0;
 for(var c=0u;c<heap[t+2u];c++) { width+=hf(heap[t+9u]+c*8u+4u); }
 return max(0.0,width-contentRect(n).z+12.0);
}
fn scrollToSelection(i:u32) {
 let n=nodes[i]; let t=n.action.w; let row=heap[t+16u]; if(row==NONE) { return; }
 let height=hf(t+15u); let visibleHeight=max(0.0,contentRect(n).w-68.0); var scroll=sf(cs(i)+1u);
 if(f32(row)*height<scroll) { scroll=f32(row)*height; }
 if(f32(row+1u)*height>scroll+visibleHeight) { scroll=f32(row+1u)*height-visibleHeight; }
 setf(cs(i)+1u,clamp(scroll,0.0,maxScroll(i)));
}
fn deleteSelection(i:u32) {
 state[cs(i)+7u]=0u;
 let s=cs(i); let lo=min(state[s+5u],state[s+6u]); let hi=max(state[s+5u],state[s+6u]);
 if(lo==hi) { return; } let at=nodes[i].text.z; let len=state[s+4u];
 for(var j=hi;j<len;j++) { heap[at+j-hi+lo]=heap[at+j]; }
 state[s+4u]=len-(hi-lo); state[s+5u]=lo; state[s+6u]=lo;
}
fn insertTextBoxCharacter(i:u32,code:u32){
 let n=nodes[i];let s=cs(i);
  deleteSelection(i); let len=state[s+4u]; let caret=state[s+5u];
  if(len>=state[39]) { state[43]+=1u; return; }
  for(var j=len;j>caret;j--) { heap[n.text.z+j]=heap[n.text.z+j-1u]; }
  heap[n.text.z+caret]=code; state[s+4u]=len+1u; state[s+5u]=caret+1u; state[s+6u]=caret+1u; invalidateText(i);
 
}
fn insertCharacter(i:u32,code:u32) {
 if(isEditor(i)){editorText(i,code);return;}
 if(code<32u || code>0x10ffffu || (code>=0xd800u && code<=0xdfffu)) { return; }
 let n=nodes[i]; let s=cs(i);
 if((n.info.x==6u || n.info.x==7u) && code==32u) { activate(i); return; }
 if(n.info.x==9u){insertTextBoxCharacter(i,code);return;}
 if(n.info.x==11u) {
  let t=n.action.w; if(heap[t+18u]==0u) { return; }
  if((code<48u || code>57u) && code!=46u && code!=45u) { return; }
  deleteCellSelection(t); if(heap[t+25u]>=state[39]) { state[43]+=1u; return; } heap[t+31u]=1u;
  let len=heap[t+25u]; let caret=heap[t+26u]; let at=heap[t+24u];
  for(var j=len;j>caret;j--) { heap[at+j]=heap[at+j-1u]; }
  heap[at+caret]=code; heap[t+25u]=len+1u; heap[t+26u]=caret+1u; heap[t+27u]=caret+1u;
 }
}
fn deleteCellSelection(t:u32) {
 let lo=min(heap[t+26u],heap[t+27u]); let hi=max(heap[t+26u],heap[t+27u]);
 if(lo==hi) { return; } heap[t+31u]=1u; let at=heap[t+24u];
 for(var j=hi;j<heap[t+25u];j++) { heap[at+j-hi+lo]=heap[at+j]; }
 heap[t+25u]-=hi-lo; heap[t+26u]=lo; heap[t+27u]=lo;
}
fn beginEdit(i:u32,col:u32) {
 if(state[39]<32u) { state[43]+=1u; return; }
 let t=nodes[i].action.w; if(heap[t+17u]==NONE || col>=heap[t+2u]) { return; }
 let c=heap[t+9u]+col*8u; if(heap[c+7u]==0u || heap[c+2u]==0u) { return; }
 if(heap[c+2u]==4u){let address=heap[t+3u]+heap[t+17u]*8u+col;hsetf(address,select(1.0,0.0,hf(address)>.5));if(heap[t+35u]!=0u){heap[heap[t+35u]+3u]++;}heap[t+18u]=0u;state[4u]=1u;if(col==heap[t+11u]){state[49u]=1u;}return;}
 heap[t+18u]=1u; heap[t+19u]=col; heap[t+31u]=0u; let at=heap[t+24u];
 let original=clamp(hf(heap[t+3u]+heap[t+17u]*8u+col),-99999999.0,99999999.0);
 var whole=u32(floor(abs(original))); var fraction=u32(round((abs(original)-f32(whole))*1000000.0));
 if(fraction>=1000000u) { whole++; fraction=0u; }
 var digits:array<u32,16>; var len=0u;
 loop { digits[len]=48u+whole%10u; len++; whole/=10u; if(whole==0u || len==14u) { break; } }
 var cursor=0u; if(original<0.0) { heap[at]=45u; cursor=1u; }
 for(var j=0u;j<len;j++) { heap[at+cursor]=digits[len-1u-j]; cursor++; }
 if(fraction>0u) {
  heap[at+cursor]=46u; cursor++; var divisor=100000u;
  loop { heap[at+cursor]=48u+fraction/divisor; cursor++; fraction%=divisor; if(fraction==0u || divisor==1u) { break; } divisor/=10u; }
 }
 heap[t+25u]=cursor; heap[t+26u]=cursor; heap[t+27u]=0u;
}
fn commitEdit(i:u32) {
 let t=nodes[i].action.w; if(heap[t+18u]==0u) { return; }
 if(heap[t+31u]==0u) { heap[t+18u]=0u; return; }
 let len=heap[t+25u]; let at=heap[t+24u]; var value=0.0; var factor=1.0; var decimal=false; var negative=false; var valid=true; var digits=0u;
 for(var j=0u;j<len;j++) {
  let ch=heap[at+j];
  if(ch==45u && j==0u) { negative=true; }
  else if(ch==46u && !decimal) { decimal=true; }
  else if(ch>=48u && ch<=57u) { digits++; if(decimal) { factor*=0.1; value+=f32(ch-48u)*factor; } else { value=value*10.0+f32(ch-48u); } }
  else { valid=false; }
 }
 if(!valid || digits==0u || value>1e8) { state[43]+=1u; return; }
 value*=select(1.0,-1.0,negative);
 hsetf(heap[t+3u]+heap[t+17u]*8u+heap[t+19u],value);if(heap[t+35u]!=0u){heap[heap[t+35u]+3u]++;} heap[t+18u]=0u; state[4]=1u; if(heap[t+19u]==heap[t+11u]) { state[49]=1u; }
}
// Route once, then invoke the shared activation interpreter once.
fn handleKey(i:u32,key:u32,modifiers:u32){
 let activationNode=handleKeyRequest(i,key,modifiers);
 if(activationNode!=NONE){activate(activationNode);}
}
fn handleKeyRequest(i:u32,key:u32,modifiers:u32)->u32 {
 if(key==27u&&activeModal()!=NONE){return activeModal();}if(i!=NONE&&!modalOwns(i)){return NONE;}
 if(isEditor(i)){editorKey(i,key,modifiers);return NONE;}
 if(isList(i)&&key!=9u){listKey(i,key);return NONE;}
 if(key==9u) {
  let backwards=(modifiers&1u)!=0u; var at=select(i,0u,i==NONE);
  for(var j=0u;j<frame.counts.x;j++) {
   at=select((at+1u)%frame.counts.x,(at+frame.counts.x-1u)%frame.counts.x,backwards);
   if(visible(at) && modalOwns(at) && (nodes[at].text.y&1u)!=0u && enabled(at)) { state[0]=at; break; }
  }
  return NONE;
 }
 if(i==NONE || i>=frame.counts.x) { return NONE; } let n=nodes[i]; let s=cs(i);
 if(n.info.x==6u || n.info.x==7u) { if(key==13u || key==32u) { return i; } return NONE; }
 if(n.info.x==8u) { if(key==37u || key==40u) { setf(s,clamp(sf(s)-0.02,0.0,1.0)); } if(key==38u || key==39u) { setf(s,clamp(sf(s)+0.02,0.0,1.0)); } return NONE; }
 if(n.info.x==9u) {
  let shift=(modifiers&1u)!=0u; let ctrl=(modifiers&6u)!=0u; let len=state[s+4u];
  if(key==32u) { insertTextBoxCharacter(i,32u); return NONE; }
  if(key==65u && ctrl) { state[s+5u]=len; state[s+6u]=0u; }
  else if(key==37u || key==39u) { if(ctrl){state[s+5u]=select(0u,len,key==39u);state[s+7u]=select(0u,1u,key==39u);}else{state[s+5u]=uiSelectMove(i,state[s+5u],key==39u);} }
  else if(key==36u) { state[s+5u]=0u; state[s+7u]=0u; }
  else if(key==35u) { state[s+5u]=len; state[s+7u]=1u; }
  else if(key==8u || key==46u) {
   if(state[s+5u]==state[s+6u]) {
    if(key==8u && state[s+5u]>0u) { state[s+6u]=previousTextCluster(n.text.z,len,state[s+5u]); }
    if(key==46u && state[s+5u]<len) { state[s+6u]=nextTextCluster(n.text.z,len,state[s+5u]); }
   }
   deleteSelection(i); invalidateText(i);
  }
  if(!shift && !(ctrl && key==65u)) { state[s+6u]=state[s+5u]; }
  setf(41u,frame.viewport.w);
 }
 if(n.info.x==11u) {
  let t=n.action.w; let count=heap[t+10u];
  if(heap[t+18u]!=0u) {
   if(key==13u) { commitEdit(i); }
   else if(key==27u) { heap[t+18u]=0u; }
   else if(key==65u && (modifiers&6u)!=0u) { heap[t+26u]=heap[t+25u]; heap[t+27u]=0u; }
   else if(key==8u || key==46u) {
    if(heap[t+26u]==heap[t+27u]) {
     if(key==8u && heap[t+26u]>0u) { heap[t+27u]--; }
     if(key==46u && heap[t+26u]<heap[t+25u]) { heap[t+27u]++; }
    } deleteCellSelection(t);
   }
   else {
    if(key==37u) { heap[t+26u]-=min(heap[t+26u],1u); }
    if(key==39u) { heap[t+26u]=min(heap[t+25u],heap[t+26u]+1u); }
    if(key==36u) { heap[t+26u]=0u; } if(key==35u) { heap[t+26u]=heap[t+25u]; }
    if((modifiers&1u)==0u) { heap[t+27u]=heap[t+26u]; }
   }
   return NONE;
  }
  if(count==0u) { return NONE; } var selected=heap[t+16u]; if(selected==NONE) { selected=0u; }
  if(key==38u) { selected-=min(selected,1u); }
  if(key==40u) { selected=min(count-1u,selected+1u); }
  if(key==36u) { selected=0u; }
  if(key==35u) { selected=count-1u; }
  let page=u32(max(1.0,(contentRect(n).w-68.0)/hf(t+15u)));
  if(key==33u) { selected-=min(selected,page); }
  if(key==34u) { selected=min(count-1u,selected+page); }
  heap[t+16u]=selected; heap[t+17u]=heap[heap[t+4u]+selected];
  if(key==37u){heap[t+19u]-=min(heap[t+19u],1u);}if(key==39u){heap[t+19u]=min(heap[t+2u]-1u,heap[t+19u]+1u);}
  if(key==13u||(key==32u&&heap[heap[t+9u]+heap[t+19u]*8u+2u]==4u)) { beginEdit(i,heap[t+19u]); }
  scrollToSelection(i);
 }
 return NONE;
}
fn inputNeedsCaret(c:Command)->bool {
 return c.kind==2u||(c.kind==5u&&(c.code==37u||c.code==39u)&&(u32(c.data.x)&6u)==0u);
}
@compute @workgroup_size(1)
fn input() {
 if(atomicLoad(&scratch[27u])!=0u){state[2]=NONE;state[30]=0u;atomicStore(&scratch[27u],0u);}
 for(var e=atomicLoad(&scratch[9u]);e<inputCount();e++) {
  var c=inputCommand(e);
  // Yield before a caret query. A separate compute pipeline prepares the run,
  // then this interpreter resumes at the same command with no host readback.
  if((VIEW_FEATURES&256u)!=0u&&inputNeedsCaret(c)&&atomicLoad(&scratch[10u])!=e+1u){atomicStore(&scratch[9u],e);return;}
  atomicStore(&scratch[9u],e+1u);activationCount=0u;releaseCapture=false;editorRequest.x=0u;designerRequest.x=0u;
  processInputCommand(c,e);
  if(activationCount!=0u||editorRequest.x!=0u||designerRequest.x!=0u||releaseCapture||atomicLoad(&scratch[28u])!=0u||atomicLoad(&scratch[36u])!=0u||atomicLoad(&scratch[39u])!=0u||atomicLoad(&scratch[46u])!=0u){
   atomicStore(&scratch[11u],1u);atomicStore(&scratch[12u],activationCount);atomicStore(&scratch[13u],activationTarget);
   for(var j=0u;j<4u;j++){atomicStore(&scratch[14u+j],editorRequest[j]);atomicStore(&scratch[23u+j],bitcast<u32>(designerArguments[j]));}
   for(var j=0u;j<2u;j++){atomicStore(&scratch[18u+j],bitcast<u32>(editorArguments[j]));}
   for(var j=0u;j<3u;j++){atomicStore(&scratch[20u+j],designerRequest[j]);}
   atomicStore(&scratch[27u],select(0u,1u,releaseCapture));return;
  }
 }
 notifyEditorChanges();
}
fn processInputCommand(command:Command,e:u32){
 var c=command;
 if(externalInput()){c.sequence=state[31u]+1u;}if(e>=frame.counts.y){if(c.kind==10u&&c.code==38u&&u32(max(0.0,c.data.x))>state[40u]){state[43u]++;return;}prepareExternalText(c);} let sequenceDelta=c.sequence-state[31]; if(sequenceDelta==0u || sequenceDelta>=0x80000000u) { return; } state[31]=c.sequence; state[13]+=1u;
  var hit=c.recipient;
  if(hit==NONE&&c.kind<=4u) {let raw=atomicLoad(&scratch[HITS+e]);if(raw!=0u){hit=hitNode(raw-1u);}}
  if(hit!=NONE && hit>=frame.counts.x) { state[43]+=1u; return; }
  if(dsRoute(c,hit)){return;}
  if(routePresenter(c,hit)){return;}
  if(c.kind==10u){let recipientNode=select(c.recipient,state[0],c.recipient==NONE);if(c.code==38u&&!isEditor(recipientNode)){if(recipientNode!=NONE){for(var k=0u;k<min(state[40u],u32(max(0.0,c.data.x)));k++){insertCharacter(recipientNode,heap[state[23u]+k]);}}}else{editorCommand(recipientNode,c.code,c.data.x,c.data.y,u32(c.position.x));}return;}
  if(c.kind==11u){dockCommand(c.recipient,c.code,u32(c.data.x),c.data.y);return;}
  if(c.kind==14u){controlsCommand(c.recipient,c.code,u32(max(0.0,c.data.x)));return;}
  if(c.kind==13u){applyDataSource(c.recipient,c.code,u32(max(0.0,c.data.x)),c.data.y,c.sequence);return;}
  if(c.kind==12u){modelCommand(u32(c.position.x),u32(c.position.y),c.code,c.data.x,u32(c.data.y));return;}
  if(c.kind==16u){templateCommand(c.recipient,c.code,u32(c.data.x),u32(c.data.y));return;}
  if(c.kind==9u) { animationControl(c.recipient,c.code,c.data.x);return; }
  if(c.kind==7u) { applyProperty(c.recipient,c.code,c.data.x); return; }
  if(c.kind==8u) {if(c.code==1u){state[0u]=NONE;}if(state[2]!=NONE){let captured=state[2];if(isEditor(captured)){heap[ed(captured)+60u]=0u;}else if(nodes[captured].info.x==24u||nodes[captured].info.x==25u){let host=select(captured,heap[nodes[captured].aux.x],nodes[captured].info.x==25u);let d=nodes[host].aux.x;heap[d+5u]=NONE;heap[d+10u]=NONE;heap[d+12u]=0u;}}state[2]=NONE; state[30]=0u; return; }
  if(c.kind==5u) { atomicStore(&scratch[46u],1u);atomicStore(&scratch[47u],select(c.recipient,state[0],c.recipient==NONE));atomicStore(&scratch[48u],c.code);atomicStore(&scratch[49u],u32(c.data.x));return; }
  if(c.kind==6u) { let recipientNode=select(c.recipient,state[0],c.recipient==NONE); if(recipientNode!=NONE){insertCharacter(recipientNode,c.code);} return; }
  if(c.kind==1u) {
   if((state[30u]==7u||state[30u]==8u)&&state[2u]!=NONE){let scroll=state[29u];let n=nodes[scroll];let p=inverse(n.matrix,n.translation.xy,c.position);let delta=p-vec2<f32>(sf(18u),sf(19u));if(state[30u]==8u||length(delta)>6.0){state[30u]=8u;state[2u]=scroll;setf(cs(scroll)+1u,clamp(sf(cs(scroll)+1u)-delta.y,0.0,maxScroll(scroll)));setf(cs(scroll)+2u,clamp(sf(cs(scroll)+2u)-delta.x,0.0,maxScrollX(scroll)));setf(18u,p.x);setf(19u,p.y);setf(16u,c.position.x);setf(17u,c.position.y);return;}}
   state[1]=hit;
   if(state[2]!=NONE) {
    let i=state[2]; let n=nodes[i]; let p=inverse(n.matrix,n.translation.xy,c.position); let r=controlRect(i); let s=cs(i);
    if(isEditor(i)){editorPointer(i,p,1u,c.code>>8u,c.data.y);}
    if(isList(i)&&state[30u]==6u){listDrag(i,p);}
    if(n.info.x==24u||n.info.x==25u){dockPointer(i,p,1u);}
    if(n.info.x==8u) { setf(s,clamp((p.x-r.x-8.0)/max(1.0,r.z-16.0),0.0,1.0)); }
    if(n.info.x==11u) {
     let t=n.action.w;
     if(state[30]==1u) { let view=max(1.0,r.w-68.0); let full=f32(heap[t+10u])*hf(t+15u); let thumb=max(24.0,view*view/max(view,full)); setf(s+1u,clamp((p.y-r.y-42.0-sf(28u))/max(1.0,view-thumb)*maxScroll(i),0.0,maxScroll(i))); }
     if(state[30]==2u) { let a=heap[t+9u]+state[29]*8u; hsetf(a+4u,clamp(sf(47u)+p.x-sf(18u),hf(a+5u),hf(a+6u))); }
     if(state[30]==3u) { setf(s+1u,clamp(sf(s+1u)-(p.y-sf(19u)),0.0,maxScroll(i)));setf(s+2u,clamp(sf(s+2u)-(p.x-sf(18u)),0.0,maxScrollX(i)));setf(18u,p.x); setf(19u,p.y); }
    }
   }
  }
  if(c.kind==4u) {
   var at=hit;
   for(var k=0u;k<32u && at!=NONE;k++) {
    if(isEditor(at)||isList(at)||nodes[at].info.x==11u || nodes[at].info.x==13u) { setf(cs(at)+1u,clamp(sf(cs(at)+1u)+c.data.y,0.0,maxScroll(at))); setf(cs(at)+2u,clamp(sf(cs(at)+2u)+c.data.x,0.0,maxScrollX(at))); break; }
    at=nodes[at].info.y;
   }
  }
  if(c.kind==2u) {
   let table=tableMeta(); if(table!=0u) { heap[table+18u]=0u; }
   state[0]=hit; state[2]=hit; state[30]=0u; state[1]=hit;
   if(hit!=NONE) {
    let n=nodes[hit]; let s=cs(hit); let p=inverse(n.matrix,n.translation.xy,c.position); let r=controlRect(hit);
    setf(18u,p.x); setf(19u,p.y);
    if(isList(hit)){listPointer(hit,p,false);}
    if(isEditor(hit)){state[24u]=hit;editorPointer(hit,p,2u,c.code>>8u,c.data.y);}
    if(n.info.x==24u||n.info.x==25u){dockPointer(hit,p,2u);}
    if(n.info.x==8u) { setf(s,clamp((p.x-r.x-8.0)/max(1.0,r.z-16.0),0.0,1.0)); }
    if(n.info.x==9u) {
     let x=p.x-r.x-12.0+sf(s+2u); let caret=textHit(hit,n.text.z,state[s+4u],n.misc.z,x);
     state[s+5u]=caret; state[s+6u]=caret;
    }
    if(n.info.x==11u) {
     let t=n.action.w; var x=r.x-sf(s+2u); var column=0u; var edge=false;
     for(var col=0u;col<heap[t+2u];col++) { let w=hf(heap[t+9u]+col*8u+4u); if(p.x>=x && p.x<x+w) { column=col; } if(abs(p.x-(x+w))<5.0 && p.y<r.y+42.0) { state[30]=2u; state[29]=col; setf(47u,w); edge=true; break; } x+=w; }
     if(p.y<r.y+42.0) { if(!edge) { heap[t+12u]=select(0u,1u-heap[t+12u],heap[t+11u]==column); heap[t+11u]=column; state[4]=1u; state[49]=1u; } }
     else if(p.x>r.x+r.z-12.0) {
      state[30]=1u; let view=max(1.0,r.w-68.0); let full=f32(heap[t+10u])*hf(t+15u); let thumb=max(24.0,view*view/max(view,full)); let top=r.y+42.0+sf(s+1u)/max(1.0,maxScroll(hit))*(view-thumb);
      setf(28u,select(thumb*0.5,p.y-top,p.y>=top && p.y<top+thumb));
     }
     else if(p.y<r.y+r.w-26.0) {
      let row=u32(max(0.0,p.y-r.y-42.0+sf(s+1u))/hf(t+15u));
      if(row<heap[t+10u]) { heap[t+16u]=row; heap[t+17u]=heap[heap[t+4u]+row]; heap[t+19u]=column; }
      let doubleClick=heap[t+28u]==row && heap[t+30u]==column && frame.viewport.w-hf(t+29u)<0.4;
      if(c.data.y>=2.0 || doubleClick) { beginEdit(hit,column); }
      heap[t+28u]=row; hsetf(t+29u,frame.viewport.w); heap[t+30u]=column;
      if((c.code&255u)==2u) { state[30]=3u; }
     }
    }
   }
  }
  if(c.kind==2u&&(c.code&255u)==2u&&hit!=NONE&&!isEditor(hit)&&!isList(hit)&&nodes[hit].info.x!=8u&&nodes[hit].info.x!=9u&&nodes[hit].info.x!=11u&&nodes[hit].info.x!=24u&&nodes[hit].info.x!=25u){var at=hit;for(var k=0u;k<32u&&at!=NONE;k++){if(nodes[at].info.x==13u&&(maxScroll(at)>0.0||maxScrollX(at)>0.0)){let p=inverse(nodes[at].matrix,nodes[at].translation.xy,c.position);state[30u]=7u;state[29u]=at;setf(18u,p.x);setf(19u,p.y);break;}at=nodes[at].info.y;}}
  if(c.kind==3u) {
   if(state[30u]==8u){state[30u]=0u;releaseCapture=true;return;}
   if(state[30u]==7u){state[30u]=0u;}
   if(hit!=NONE&&hit==state[2u]&&isList(hit)){listPointer(hit,inverse(nodes[hit].matrix,nodes[hit].translation.xy,c.position),true);}
   if(state[2]!=NONE){let captured=state[2];if(nodes[captured].info.x==24u||nodes[captured].info.x==25u){dockPointer(captured,inverse(nodes[captured].matrix,nodes[captured].translation.xy,c.position),3u);}if(isEditor(captured)){heap[ed(captured)+60u]=0u;}}
   if(state[2]!=NONE && hit==state[2] && (nodes[hit].info.x==6u || nodes[hit].info.x==7u)) { activate(hit); }
   releaseCapture=true;
  }
  setf(16u,c.position.x); setf(17u,c.position.y);
}
@compute @workgroup_size(1)
fn schedule() {
 let td=atomicLoad(&scratch[8u]);if((td&1u)!=0u){state[3]=1u;}if((td&2u)!=0u){state[4]=1u;}
 let groups=(frame.counts.x+63u)/64u;
 indirect[0]=select(0u,groups,state[3]!=0u); indirect[1]=1u; indirect[2]=1u;
 let t=tableMeta(); var queryGroups=0u; if(t!=0u && state[4]!=0u) { queryGroups=(heap[t+1u]+127u)/128u; }
 indirect[3]=queryGroups; indirect[4]=1u; indirect[5]=1u;
 indirect[24]=select(0u,1u,queryGroups>0u); indirect[25]=1u; indirect[26]=1u;
 var sortGroups=0u;
 if(t!=0u && state[49]!=0u) { sortGroups=(heap[t+1u]+255u)/256u; }
 indirect[15]=sortGroups; indirect[16]=1u; indirect[17]=1u;
 indirect[18]=select(0u,sortGroups*2u,sortGroups>0u); indirect[19]=1u; indirect[20]=1u;
}
@compute @workgroup_size(1)
fn finishWork() {
 if(state[3]!=0u) { state[11]+=1u; state[58]=1u; } if(state[4]!=0u) { state[12]+=1u; }
 if(state[49]!=0u) { state[50]+=1u; }
 state[3]=0u; state[4]=0u; state[49]=0u;
}
@compute @workgroup_size(1)
fn finishFrame() { draws.pad=vec2<u32>(state[6],state[7]); state[15]=atomicLoad(&scratch[3u])|atomicLoad(&draws.overflow); state[45]=min(MAX_STRIPS,atomicLoad(&scratch[1u])); }

@compute @workgroup_size(1)
fn applyInputActions(){
 if(atomicLoad(&scratch[11u])==0u){return;}atomicStore(&scratch[11u],0u);
 activationCount=atomicLoad(&scratch[12u]);activationTarget=atomicLoad(&scratch[13u]);
 for(var j=0u;j<4u;j++){editorRequest[j]=atomicLoad(&scratch[14u+j]);designerArguments[j]=bitcast<f32>(atomicLoad(&scratch[23u+j]));}
 for(var j=0u;j<2u;j++){editorArguments[j]=bitcast<f32>(atomicLoad(&scratch[18u+j]));}
 for(var j=0u;j<3u;j++){designerRequest[j]=atomicLoad(&scratch[20u+j]);}
 for(var activation=0u;activation<activationCount;activation++){applyActivation(activationTarget);}
 for(var j=0u;j<4u;j++){atomicStore(&scratch[14u+j],editorRequest[j]);atomicStore(&scratch[23u+j],bitcast<u32>(designerArguments[j]));}
 for(var j=0u;j<2u;j++){atomicStore(&scratch[18u+j],bitcast<u32>(editorArguments[j]));}
 for(var j=0u;j<3u;j++){atomicStore(&scratch[20u+j],designerRequest[j]);}
}

// Keyboard interpretation is isolated from pointer/data routing. Any resulting
// editor job or activation is consumed before this FIFO event can advance.
@compute @workgroup_size(1)
fn applyCoreKey(){
 if(atomicLoad(&scratch[46u])==0u){return;}atomicStore(&scratch[46u],0u);
 handleKey(atomicLoad(&scratch[47u]),atomicLoad(&scratch[48u]),atomicLoad(&scratch[49u]));
 atomicStore(&scratch[12u],activationCount);atomicStore(&scratch[13u],activationTarget);
}
