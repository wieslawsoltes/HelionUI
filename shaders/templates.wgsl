// Retained template property plans and namescopes. No host-state polling.
fn templateSystem()->u32 {if((VIEW_FEATURES&128u)==0u){return 0u;}let e=extension(nodes[0]);if(e==0u){return 0u;}return heap[e+37u];}
fn templateInfo(i:u32)->u32 {if((VIEW_FEATURES&128u)==0u||i==NONE||i>=frame.counts.x){return 0u;}let e=extension(nodes[i]);if(e==0u){return 0u;}return heap[e+38u];}
fn templateLink(i:u32)->u32 {if((VIEW_FEATURES&128u)==0u||i==NONE||i>=frame.counts.x){return 0u;}let e=extension(nodes[i]);if(e==0u){return 0u;}return heap[e+36u];}
fn templateOwner(i:u32)->u32 {let p=templateLink(i);if(p==0u){return i;}return heap[p];}
fn templateHasVisual(i:u32)->bool {let p=templateInfo(i);return p!=0u&&heap[p+8u]!=0u&&heap[p+6u]==nodes[i].info.x;}
fn templateHasNodeVisual(n:Node)->bool {let e=extension(n);if((VIEW_FEATURES&128u)==0u||e==0u){return false;}let p=heap[e+38u];return p!=0u&&heap[p+8u]!=0u&&heap[p+6u]==n.info.x;}
fn layoutPadding(n:Node)->vec4<f32>{if(templateHasNodeVisual(n)){return vec4<f32>(0.0);}return nodePadding(n);}
fn templateContentOwner(i:u32)->u32 {if(nodes[i].info.x==36u){return templateOwner(i);}return i;}
fn controlRect(i:u32)->vec4<f32>{let p=templateInfo(i);if(p!=0u&&heap[p+9u]!=NONE&&templateHasVisual(i)){return contentRect(nodes[heap[p+9u]]);}return contentRect(nodes[i]);}
fn templateLight()->bool {let p=templateSystem();if(p!=0u){return heap[p+2u]!=0u;}return state[6]!=0u;}
fn templateRead(i:u32,code:u32)->u32 {
 if(code>=1048576u){let mask=code-1048576u;if(mask==256u){return bitcast<u32>(select(0.0,1.0,visible(i)));}let value=(templatePseudoState(i)&mask)!=0u;return bitcast<u32>(select(0.0,1.0,select(value,!value,mask==16u)));}
 let category=code>>16u;let at=code&65535u;
 if(category==2u){return select(0u,1u,(nodes[i].text.y&at)!=0u);}
 if(at>=72u){if(at==72u){return bitcast<u32>(boundValue(i));}return state[cs(i)+at-72u];}
 switch(at){
case 8u:{return bitcast<u32>(nodes[i].size.x);}
case 9u:{return bitcast<u32>(nodes[i].size.y);}
case 10u:{return bitcast<u32>(nodes[i].size.z);}
case 11u:{return bitcast<u32>(nodes[i].size.w);}
case 12u:{return bitcast<u32>(nodes[i].limits.x);}
case 13u:{return bitcast<u32>(nodes[i].limits.y);}
case 14u:{return bitcast<u32>(nodes[i].limits.z);}
case 15u:{return bitcast<u32>(nodes[i].limits.w);}
case 20u:{return nodes[i].paint.x;}
case 21u:{return nodes[i].paint.y;}
case 22u:{return nodes[i].paint.z;}
case 23u:{return nodes[i].paint.w;}
case 24u:{return nodes[i].placement.x;}
case 25u:{return nodes[i].placement.y;}
case 32u:{return bitcast<u32>(nodes[i].misc.x);}
case 33u:{return bitcast<u32>(nodes[i].misc.y);}
case 34u:{return bitcast<u32>(nodes[i].misc.z);}
case 35u:{return bitcast<u32>(nodes[i].misc.w);}
case 54u:{return bitcast<u32>(nodes[i].rect.z);}
case 55u:{return bitcast<u32>(nodes[i].rect.w);}
 default:{return 0u;}}
}
fn templateWrite(i:u32,category:u32,at:u32,value:u32){
 if(category==2u){nodes[i].text.y=(nodes[i].text.y&~at)|select(0u,at,value!=0u);return;}
 if(at>=72u){state[cs(i)+at-72u]=value;return;}
 switch(at){
case 8u:{nodes[i].size.x=bitcast<f32>(value);}
case 9u:{nodes[i].size.y=bitcast<f32>(value);}
case 10u:{nodes[i].size.z=bitcast<f32>(value);}
case 11u:{nodes[i].size.w=bitcast<f32>(value);}
case 12u:{nodes[i].limits.x=bitcast<f32>(value);}
case 13u:{nodes[i].limits.y=bitcast<f32>(value);}
case 14u:{nodes[i].limits.z=bitcast<f32>(value);}
case 15u:{nodes[i].limits.w=bitcast<f32>(value);}
case 20u:{nodes[i].paint.x=value;}
case 21u:{nodes[i].paint.y=value;}
case 22u:{nodes[i].paint.z=value;}
case 23u:{nodes[i].paint.w=value;}
case 24u:{nodes[i].placement.x=value;}
case 25u:{nodes[i].placement.y=value;}
case 32u:{nodes[i].misc.x=bitcast<f32>(value);}
case 33u:{nodes[i].misc.y=bitcast<f32>(value);}
case 34u:{nodes[i].misc.z=bitcast<f32>(value);}
case 35u:{nodes[i].misc.w=bitcast<f32>(value);}
 default:{}}
}
fn templateValue(owner:u32,at:u32,category:u32)->u32 {
 let kind=heap[at];var value=heap[at+1u];
 if(kind==2u){let t=templateSystem();var index=heap[t+1u]*2u+heap[t+2u];
  if(heap[t+11u]==8u){index=heap[t+1u]*8u+heap[t+2u]*4u+heap[t+12u]*2u+heap[t+13u];let role=heap[at+6u];if(category==0u&&role>=1u&&role<=4u&&heap[t+14u]!=0u&&heap[t+12u]==0u){return heap[t+14u+role];}}
  value=heap[value+index];if(category==2u&&heap[at+7u]!=0u){value=select(0u,1u,value==0u);}return value;}
 if(kind==1u){let source=value;value=templateRead(owner,source);if(category==1u){var number=bitcast<f32>(value);if((source>>16u)==3u){number=f32(value);}number=clamp(number,hf(at+4u),hf(at+5u));if(heap[at+6u]!=0u){number*=select(nodes[owner].rect.z,nodes[owner].rect.w,heap[at+6u]==2u)+hf(at+7u);}number=number*hf(at+2u)+hf(at+3u);return bitcast<u32>(clamp(number,-INF,INF));}if(category==2u&&((source>>16u)==1u||source>=1048576u)){value=select(0u,1u,bitcast<f32>(value)!=0.0);}}
 if(category==2u&&heap[at+7u]!=0u){value=select(0u,1u,value==0u);}return value;
}
fn templateState(p:u32,group:u32,mask:u32)->u32 {let g=heap[p+4u]+group*4u;let manual=heap[g+2u];if(manual<heap[g]){return manual;}var chosen=NONE;for(var j=0u;j<heap[g];j++){let s=heap[g+1u]+j*4u;if(heap[s+2u]!=0u&&(mask&heap[s])==heap[s]&&(mask&heap[s+1u])==0u){chosen=j;}}return chosen;}
fn templateApplyPlan(owner:u32,p:u32,at:u32,mask:u32){
 if(heap[at+22u]!=0u){return;}let recipient=heap[at];let category=heap[at+1u];let property=heap[at+2u];
 if(recipient==owner&&heap[p+15u]!=0u){let field=designerTemplateDefaultBit(category,property);let d=heap[p+15u];if(field==0u||(heap[dsRec(d,heap[p+16u])+95u]&field)==0u){return;}}
 if(heap[at+20u]!=0u&&heap[at+18u]!=0u){let current=state[cs(recipient)];if(current!=heap[at+17u]){state[cs(owner)]=current;atomicOr(&scratch[8u],2u);}}
 var source=at+3u;var duration=hf(at+13u);var easing=heap[at+21u];
 for(var j=0u;j<heap[at+12u];j++){let r=heap[at+11u]+j*16u;if(heap[heap[p+4u]+heap[r]*4u+3u]==heap[r+1u]){source=r+2u;duration=hf(r+10u);easing=heap[r+11u];}}
 if(category==4u){var pointer=nodes[owner].text.z;var length=textLength(owner);if(heap[source]!=1u){let string=templateValue(owner,source,category);pointer=string+1u;length=heap[string];}if(nodes[recipient].text.z!=pointer||nodes[recipient].text.w!=length){nodes[recipient].text.z=pointer;nodes[recipient].text.w=length;if(nodes[recipient].info.x!=36u){atomicOr(&scratch[8u],1u);}}return;}
 if(property==14u&&(heap[source]==3u||(heap[source]==1u&&(heap[source+1u]&65535u)==14u))){var padding=nodePadding(nodes[owner]);if(heap[source]==3u){let q=heap[source+1u];padding=vec4<f32>(hf(q),hf(q+1u),hf(q+2u),hf(q+3u));}let e=extension(nodes[recipient]);if(any(padding!=nodePadding(nodes[recipient]))){heap[e+1u]|=1u;for(var k=0u;k<4u;k++){hsetf(e+8u+k,padding[k]);}atomicOr(&scratch[8u],1u);}return;}
 let value=templateValue(owner,source,category);var output=value;
 if(heap[at+18u]==0u){heap[at+14u]=value;heap[at+15u]=value;heap[at+17u]=value;heap[at+18u]=1u;hsetf(at+13u,duration);heap[at+21u]=easing;hsetf(at+16u,frame.viewport.w);}
 if(value!=heap[at+14u]){heap[at+15u]=heap[at+17u];heap[at+14u]=value;hsetf(at+16u,frame.viewport.w);hsetf(at+13u,duration);heap[at+21u]=easing;}
 duration=hf(at+13u);easing=heap[at+21u];
 let system=templateSystem();if(heap[system+3u]!=0u){duration=0.0;heap[at+15u]=value;}
 if(duration>0.0&&(category==0u||category==1u)){let phase=eased(clamp((frame.viewport.w-hf(at+16u))/duration,0.0,1.0),easing);if(category==0u){output=pack4x8unorm(mix(unpack4x8unorm(heap[at+15u]),unpack4x8unorm(value),phase));}else{output=bitcast<u32>(mix(hf(at+15u),bitcast<f32>(value),phase));}}
 let before=templateRead(recipient,category*65536u+property);if(before!=output){templateWrite(recipient,category,property,output);if(heap[at+19u]==0u){atomicOr(&scratch[8u],1u);}}
 if(property==14u){let e=extension(nodes[recipient]);if(e!=0u&&(heap[e+1u]&1u)!=0u){heap[e+1u]&=~1u;atomicOr(&scratch[8u],1u);}}
 heap[at+17u]=output;
}
fn resolveTemplateStage(i:u32,which:u32){let p=templateInfo(i);if(p==0u||heap[p]!=i||heap[p+10u]!=stage.p.x||!visible(i)){return;}var mask=templatePseudoState(i);if(heap[p+17u]!=0u){mask=(mask&96u)|(heap[p+17u]-1u);}for(var g=0u;g<heap[p+5u];g++){heap[heap[p+4u]+g*4u+3u]=templateState(p,g,mask);}for(var j=0u;j<heap[p+3u];j++){let at=heap[p+2u]+j*24u;if(heap[at+19u]==which){templateApplyPlan(i,p,at,mask);}}}
@compute @workgroup_size(64)
fn resolveTemplateLayout(@builtin(global_invocation_id) id:vec3<u32>){if(id.x<frame.counts.x){resolveTemplateStage(id.x,0u);}}
@compute @workgroup_size(64)
fn resolveTemplateVisuals(@builtin(global_invocation_id) id:vec3<u32>){if(id.x<frame.counts.x){resolveTemplateStage(id.x,1u);}}
// A stable physical painter order including template parts and dynamic docking.
// This work is bounded by the retained node capacity, not by glyph/pixel count.
@compute @workgroup_size(1)
fn rankTemplateTree(){let s=templateSystem();if(s==0u||heap[s+7u]==0u){return;}if(state[3u]==0u&&heap[s+10u]!=0u){return;}heap[s+10u]=1u;synchronizeDesignerTemplates();let ranks=heap[s+5u];let reverse=heap[s+6u];for(var i=0u;i<frame.counts.x;i++){heap[ranks+i]=NONE;}var stack:array<vec2<u32>,512>;var top=1u;stack[0]=vec2<u32>(0u);var rank=0u;
 loop{if(top==0u||rank>=frame.counts.x){break;}top--;let item=stack[top];let i=item.x;if(i>=frame.counts.x||heap[ranks+i]!=NONE){continue;}heap[ranks+i]=rank;heap[reverse+rank]=i;nodes[i].text.x=item.y;rank++;
  let n=nodes[i];var children:array<u32,512>;var count=0u;for(var j=0u;j<n.info.w&&j<512u;j++){let c=child(n,j);if(c>=frame.counts.x){continue;}var at=count;
   if(n.info.x==24u){let z=dockPaintNode(c);while(at>0u&&dockPaintNode(children[at-1u])>z){children[at]=children[at-1u];at--;}}
   children[at]=c;count++;}
  for(var j=count;j>0u;j--){if(top<512u){stack[top]=vec2<u32>(children[j-1u],item.y+1u);top++;}}
 }
 for(var i=0u;i<frame.counts.x;i++){if(heap[ranks+i]==NONE){heap[ranks+i]=rank;heap[reverse+rank]=i;rank++;}}
}
// Accent derivation runs on a settings command, never once per pixel/part/frame.
fn templateSetAccent(s:u32,color:u32){
 var light=0.0;
 for(var j=0u;j<3u;j++){let v=f32((color>>(j*8u))&255u)/255.0;var linear=v/12.92;if(v>0.04045){linear=pow((v+0.055)/1.055,2.4);}var weight=0.2126;if(j==1u){weight=0.7152;}if(j==2u){weight=0.0722;}light+=linear*weight;}
 let whiteText=light<0.179;let toward=select(255u,0u,whiteText);var hover=4278190080u;var pressed=4278190080u;
 for(var j=0u;j<3u;j++){let v=(color>>(j*8u))&255u;hover|=((v*90u+toward*10u+50u)/100u)<<(j*8u);pressed|=((v*82u+toward*18u+50u)/100u)<<(j*8u);}
 heap[s+14u]=1u;heap[s+15u]=color;heap[s+16u]=select(4278190080u,4294967295u,whiteText);heap[s+17u]=hover;heap[s+18u]=pressed;
}
fn templateCommand(i:u32,command:u32,a:u32,b:u32){let s=templateSystem();if(s==0u){state[43]++;return;}
 if(command==0u){if(a>=heap[s+8u]||b>1u){state[43]++;return;}heap[s+1u]=a;heap[s+2u]=b;heap[s+9u]++;state[3]=1u;return;}
 if(command==3u){heap[s+3u]=min(1u,a);return;}
 if(command>=5u&&command<=8u){if(heap[s+11u]!=8u){state[43]++;return;}
  if(command==5u){if(a>65535u||b>65535u||(b>>8u)!=255u){state[43]++;return;}templateSetAccent(s,a|(b<<16u));}
  if(command==6u){heap[s+14u]=0u;}
  if(command==7u||command==8u){if(a>1u){state[43]++;return;}heap[s+12u+select(0u,1u,command==8u)]=a;if(command==8u){state[3u]=1u;}}
  heap[s+9u]++;return;
 }
 if(command==4u){templateLocalValue(i,a,false);state[3]=1u;return;}
 let p=templateInfo(i);if(p==0u||a>=heap[p+5u]){state[43]++;return;}let g=heap[p+4u]+a*4u;
 if(command==2u){heap[g+2u]=NONE;}else if(command==1u&&b<heap[g]){heap[g+2u]=b;}else{state[43]++;}
}

// Visual states include the instantiated control's interactive descendants.
fn templateWithin(candidate:u32,owner:u32)->bool {
 var at=candidate;for(var k=0u;k<32u&&at!=NONE&&at<frame.counts.x;k++){if(at==owner){return true;}at=nodes[at].info.y;}return false;
}
fn templatePseudoState(i:u32)->u32 {var mask=pseudoState(i);if(templateWithin(state[1],i)){mask|=1u;}if(templateWithin(state[2],i)){mask|=2u;}if(templateWithin(state[0],i)){mask|=4u;}return mask;}
fn templateLocalValue(i:u32,property:u32,locked:bool){
 let parent=templateOwner(i);var offset=NONE;var category=1u;
 switch(property){case 0u:{offset=72u;}case 1u:{offset=8u;}case 2u:{offset=9u;}case 3u:{offset=75u;}
 case 4u:{offset=80u;}case 5u:{offset=81u;}case 6u:{offset=82u;}case 7u:{offset=83u;}case 8u:{offset=84u;}
 case 9u:{offset=32u;category=2u;}case 11u:{offset=14u;}default:{return;}}
 for(var k=0u;k<2u;k++){let owner=select(parent,i,k==1u);let p=templateInfo(owner);if(p==0u){continue;}for(var j=0u;j<heap[p+3u];j++){let at=heap[p+2u]+j*24u;if(heap[at]==i&&heap[at+1u]==category&&heap[at+2u]==offset){heap[at+22u]=select(0u,1u,locked);if(!locked){heap[at+18u]=0u;}}}}
}

// Six theme-default fields can be inherited without replacing authored local values.
fn designerTemplateDefaultBit(category:u32,property:u32)->u32{
 if(category==0u){if(property==20u){return 1u;}if(property==21u){return 2u;}if(property==22u){return 4u;}}
 if(property==23u){return 8u;}if(property==35u){return 16u;}if(property==14u){return 32u;}return 0u;
}
fn dsTemplatesValid(d:u32,base:u32)->bool{
 let directory=heap[d+118u];var used=0u;let records=base+heap[d+64u];
 if(heap[base+5u]>1u||heap[base+6u]>1u||heap[base+7u]>1u||heap[base+56u]>7u){return false;}if((heap[base+56u]&4u)!=0u&&(heap[base+57u]>>24u)!=255u){return false;}
 for(var k=0u;k<heap[d+1u];k++){let r=records+k*96u;if(heap[r]==0u){continue;}let choice=heap[r+94u];if(heap[r+95u]>63u){return false;}if(choice==0u){continue;}
  if(directory==0u||choice>heap[directory]){return false;}used++;if(used>heap[directory+1u]){return false;}
  if(heap[heap[directory+2u]+(choice-1u)*4u]!=heap[r+1u]){return false;}
  for(var j=0u;j<heap[d+1u];j++){let childRecord=records+j*96u;if(heap[childRecord]!=0u&&heap[childRecord+2u]==k){return false;}}
 }
 return true;
}
fn clearDesignerTemplatePool(d:u32,entry:u32){
 let owner=heap[entry];if(owner!=NONE){let e=extension(nodes[owner]);if(e!=0u){heap[e+38u]=0u;}let slot=owner-heap[d+2u];nodes[owner].info.z=heap[heap[d+60u]+slot*8u];nodes[owner].info.w=0u;}
 for(var j=0u;j<8u;j++){let part=heap[heap[entry+2u]+j];nodes[part].text.y|=32u;nodes[part].info.y=heap[d+3u];}
 heap[entry]=NONE;heap[entry+1u]=0u;
}
fn templateNativeWords(at:u32)->vec4<u32>{return vec4<u32>(heap[at],heap[at+1u],heap[at+2u],heap[at+3u]);}
fn loadDesignerTemplatePart(i:u32,source:u32,owner:u32){
 nodes[i].info=templateNativeWords(source);if(nodes[i].info.y==NONE){nodes[i].info.y=owner;}
 nodes[i].text=templateNativeWords(source+4u);
 nodes[i].size=bitcast<vec4<f32>>(templateNativeWords(source+8u));nodes[i].limits=bitcast<vec4<f32>>(templateNativeWords(source+12u));
 nodes[i].margin=bitcast<vec4<f32>>(templateNativeWords(source+16u));nodes[i].paint=templateNativeWords(source+20u);
 nodes[i].placement=templateNativeWords(source+24u);nodes[i].tracks=templateNativeWords(source+28u);
 nodes[i].misc=bitcast<vec4<f32>>(templateNativeWords(source+32u));nodes[i].action=templateNativeWords(source+36u);nodes[i].bind=templateNativeWords(source+40u);
 nodes[i].config=bitcast<vec4<f32>>(templateNativeWords(source+44u));nodes[i].available=bitcast<vec4<f32>>(templateNativeWords(source+48u));
 nodes[i].rect=bitcast<vec4<f32>>(templateNativeWords(source+52u));nodes[i].clip=bitcast<vec4<f32>>(templateNativeWords(source+56u));
 nodes[i].matrix=bitcast<vec4<f32>>(templateNativeWords(source+60u));nodes[i].translation=bitcast<vec4<f32>>(templateNativeWords(source+64u));nodes[i].aux=templateNativeWords(source+68u);
 let link=templateLink(i);heap[link]=owner;
}
fn synchronizeDesignerTemplates(){
 if((VIEW_FEATURES&32u)==0u){return;}
 for(var node=0u;node<frame.counts.x;node++){if(nodes[node].info.x!=30u){continue;}let d=nodes[node].aux.x;let directory=heap[d+118u];if(directory==0u){continue;}let pools=heap[directory+3u];let capacity=heap[directory+1u];
  let system=templateSystem();if(heap[system+11u]==8u){let settings=heap[dsData(d)+56u];heap[system+12u]=settings&1u;heap[system+13u]=(settings>>1u)&1u;if((settings&4u)==0u){heap[system+14u]=0u;}else if(heap[system+14u]==0u||heap[system+15u]!=heap[dsData(d)+57u]){templateSetAccent(system,heap[dsData(d)+57u]);}}heap[system+1u]=heap[dsData(d)+5u];heap[system+2u]=heap[dsData(d)+6u];heap[system+3u]=heap[dsData(d)+7u];
  // Release obsolete instances before assigning replacements. Hidden controls keep theirs.
  for(var pool=0u;pool<capacity;pool++){let entry=pools+pool*8u;let owner=heap[entry];if(owner==NONE){continue;}let k=owner-heap[d+2u];let r=dsRec(d,k);if(!dsAlive(d,k)||heap[r+94u]!=heap[entry+1u]){clearDesignerTemplatePool(d,entry);}}
  for(var k=0u;k<heap[d+1u];k++){if(!dsAlive(d,k)){continue;}let choice=heap[dsRec(d,k)+94u];if(choice==0u){continue;}let owner=dsNode(d,k);var selected=NONE;var free=NONE;
   for(var pool=0u;pool<capacity;pool++){let entry=pools+pool*8u;if(heap[entry]==owner){selected=entry;break;}if(heap[entry]==NONE&&free==NONE){free=entry;}}
   if(selected==NONE){selected=free;if(selected==NONE){dsReject(d,4u);continue;}}
   let variant=heap[heap[selected+3u]+choice-1u];let info=heap[variant+2u];
   if(heap[selected]==NONE){
    for(var j=0u;j<heap[variant+1u];j++){let part=heap[heap[selected+2u]+j];loadDesignerTemplatePart(part,heap[variant]+j*72u,owner);for(var w=0u;w<16u;w++){state[cs(part)+w]=heap[heap[variant+3u]+j*16u+w];}let e=extension(nodes[part]);heap[e+35u]=k;}
    heap[info]=owner;heap[info+16u]=k;heap[info+17u]=0u;
    for(var j=0u;j<heap[info+3u];j++){let p=heap[info+2u]+j*24u;if(heap[p+23u]!=0u){heap[p]=owner;}heap[p+18u]=0u;heap[p+22u]=0u;}
    for(var j=0u;j<heap[info+5u];j++){heap[heap[info+4u]+j*4u+2u]=NONE;}
    heap[selected]=owner;heap[selected+1u]=choice;state[3u]=1u;
   }
   for(var j=0u;j<heap[variant+1u];j++){if((heap[variant+4u]&(1u<<j))!=0u){nodes[heap[heap[selected+2u]+j]].aux.w=nodes[owner].aux.w;}}
   heap[extension(nodes[owner])+38u]=info;nodes[owner].info.z=heap[variant+5u];nodes[owner].info.w=1u;
  }
 }
}
