fn edLabel(i:u32,k:u32,p:vec2<f32>,size:f32,color:vec4<f32>,clip:vec4<f32>,order:ptr<function,u32>)->vec2<f32>{let a=heap[nodes[i].text.z+k];return drawText(i,a+1u,heap[a],p,size,color,clip,0.0,order);}
fn edColor(kind:u32)->vec4<f32>{switch kind{case 1u:{return decodeColor(0xffe6a4c8u);}case 2u:{return decodeColor(0xffb5ce9eu);}case 3u:{return decodeColor(0xffa3c9dbu);}case 4u:{return decodeColor(0xff899774u);}case 5u:{return decodeColor(0xff77d6e8u);}default:{return decodeColor(0xffeee4d8u);}}}
fn edRow(i:u32,row:u32,order:ptr<function,u32>){
 let n=nodes[i];let d=ed(i);let r=contentRect(n);let h=edLineHeight(i);let cw=edCell(i);let sy=sf(cs(i)+1u);let sx=sf(cs(i)+2u);let y=edTop(i)+f32(row)*h-sy;let top=edTop(i);
 let clip=intersection(n.clip,vec4<f32>(r.x,top,r.x+r.z-12.0,top+edVisibleHeight(i)));let textClip=intersection(clip,vec4<f32>(r.x+hf(d+38u),top,r.x+hf(d+38u)+edTextWidth(i),top+edVisibleHeight(i)));
 let a=heap[heap[d+31u]+row*2u];let b=heap[heap[d+31u]+row*2u+1u];let x=r.x+hf(d+38u)-sx;let size=n.misc.z;let textY=y+(h-fontLineHeight(i,size))*.5;let caret=edCaret(d);
 if(caret>=a&&caret<=b){box(i,vec4<f32>(r.x,y,r.z,h),decodeColor(0xff30281fu),0.0,0.0,clip,order);}
 if(hf(d+38u)>20.0&&a==edLineStart(d,a)){var lo=0u;var hi=heap[d+17u];let lines=heap[d+16u];while(lo<hi){let mid=(lo+hi)/2u;if(heap[lines+mid]<a){lo=mid+1u;}else{hi=mid;}}
  _=number(i,f32(lo+1u),0u,vec2<f32>(r.x+8.0,textY),max(9.0,size-2.0),decodeColor(select(0xff827768u,0xffc2b29bu,caret>=a&&caret<=b)),clip,order);
  var foldable=false;for(var p=a;p<b;p++){if(edChar(d,p)==123u||edChar(d,p)==91u){foldable=true;break;}}if(foldable){line(i,vec2<f32>(r.x+hf(d+38u)-14.0,y+h*.4),vec2<f32>(r.x+hf(d+38u)-10.0,y+h*.6),decodeColor(0xffa3927eu),.8,clip,order);}
 }
 for(var k=0u;k<heap[d+9u];k++){let s=edSel(d,k);let lo=min(heap[s],heap[s+1u]);let hi=max(heap[s],heap[s+1u]);if(hi>a&&lo<=b){let x0=x+f32(edColumn(d,a,max(a,lo)))*cw;let x1=x+f32(edColumn(d,a,min(b,hi)))*cw+select(0.0,cw*.5,hi>b);box(i,vec4<f32>(x0,y,max(0.0,x1-x0),h),decodeColor(0xff634327u),0.0,0.0,textClip,order);}}
 // Matches are sorted, so binary-search directly to this virtual row.
 var ml=0u;var mh=heap[d+26u];let matches=heap[d+25u];while(ml<mh){let mid=(ml+mh)/2u;if(heap[matches+mid]+heap[d+22u]<=a){ml=mid+1u;}else{mh=mid;}}
 for(var k=ml;k<heap[d+26u];k++){let p=heap[matches+k];if(p>b){break;}let x0=x+f32(edColumn(d,a,max(a,p)))*cw;let x1=x+f32(edColumn(d,a,min(b,p+heap[d+22u])))*cw;box(i,vec4<f32>(x0,y,max(1.0,x1-x0),h),vec4<f32>(.42,.30,.03,.45),2.0,0.0,textClip,order);}
 var col=0u;for(var p=a;p<b;p++) {let c=edChar(d,p);let mark=isCombining(c);let px=x+f32(select(col,col-min(1u,col),mark))*cw;
  if(px>textClip.z+cw){break;}if(px+cw>=textClip.x){
   if(c==9u||c==32u){if(heap[d+57u]!=0u){disc(i,vec2<f32>(px+cw*.5,y+h*.55),.6,decodeColor(0xff685c4cu),textClip,order);}}
   else{emitGlyph(i,mapGlyph(i,c),vec2<f32>(px,textY+textBaseline(i,size)),size,edColor(heap[heap[d+20u]+p]),textClip,order);}
   if(p==heap[d+41u]||p==heap[d+42u]){box(i,vec4<f32>(px,y,cw,h),decodeColor(0xffdec079u),1.0,.65,textClip,order);}
  }
  if(c==9u){col+=heap[d+36u]-col%heap[d+36u];}else if(!mark){col++;}
 }
 for(var k=0u;k<heap[d+52u];k++){let p=heap[heap[d+51u]+k*2u];if(p<a||p>=b){continue;}let dx=x+f32(edColumn(d,a,p))*cw;for(var q=0u;q<4u;q++){line(i,vec2<f32>(dx+f32(q)*cw/4.0,y+h-2.0),vec2<f32>(dx+f32(q+1u)*cw/4.0,y+h-select(1.0,3.0,q%2u==0u)),decodeColor(0xff8e86f4u),.7,textClip,order);}}
 if(state[0]==i&&fract((frame.viewport.w-hf(d+15u))*1.0)<.65&&heap[d+35u]==0u){for(var k=0u;k<heap[d+9u];k++){let p=heap[edSel(d,k)];if(p>=a&&p<=b){let px=x+f32(edColumn(d,a,p))*cw;box(i,vec4<f32>(px,y+1.0,select(1.4,cw,(heap[d+6u]&2u)!=0u),h-2.0),vec4<f32>(.35,.82,.85,select(1.0,.4,(heap[d+6u]&2u)!=0u)),0.0,0.0,textClip,order);}}}
}
fn edChrome(i:u32,order:ptr<function,u32>){
 let n=nodes[i];let d=ed(i);let r=contentRect(n);let clip=n.clip;let muted=decodeColor(0xffb3a38eu);let accent=decodeColor(0xffe6d467u);let height=edLineHeight(i);
 let maxScroll=max(0.0,f32(heap[d+32u])*height-edVisibleHeight(i));let thumb=max(22.0,edVisibleHeight(i)*edVisibleHeight(i)/max(edVisibleHeight(i),f32(heap[d+32u])*height));let ty=edTop(i)+sf(cs(i)+1u)/max(1.0,maxScroll)*(edVisibleHeight(i)-thumb);
 box(i,vec4<f32>(r.x+r.z-10.0,edTop(i),8.0,edVisibleHeight(i)),decodeColor(0xff241c14u),4.0,0.0,clip,order);box(i,vec4<f32>(r.x+r.z-9.0,ty,6.0,thumb),decodeColor(0xff635343u),3.0,0.0,clip,order);
 if((heap[d+6u]&8u)!=0u){let mx=r.x+r.z-68.0;let mh=edVisibleHeight(i);box(i,vec4<f32>(mx,edTop(i),54.0,mh),decodeColor(0xff221b14u),0.0,0.0,clip,order);let samples=min(160u,heap[d+17u]);let lines=heap[d+16u];for(var j=0u;j<samples;j++){let row=j*heap[d+17u]/max(1u,samples);let start=heap[lines+row];let count=edLineEnd(d,start)-start;box(i,vec4<f32>(mx+3.0,edTop(i)+f32(j)/f32(max(1u,samples))*mh,min(46.0,f32(count)*.55),1.0),vec4<f32>(.32,.45,.48,.55),0.0,0.0,clip,order);}box(i,vec4<f32>(mx,edTop(i)+sf(cs(i)+1u)/max(1.0,f32(heap[d+32u])*height)*mh,54.0,max(4.0,mh*mh/max(mh,f32(heap[d+32u])*height))),vec4<f32>(.23,.45,.55,.15),1.0,1.0,clip,order);}
 let y=r.y+r.w-23.0;box(i,vec4<f32>(r.x,y,r.z,23.0),decodeColor(0xff30251au),0.0,0.0,clip,order);
 var lineNo=1u;let caret=edCaret(d);let lines=heap[d+16u];var lo=0u;var hi=heap[d+17u];while(lo<hi){let mid=(lo+hi)/2u;if(heap[lines+mid]<=caret){lo=mid+1u;}else{hi=mid;}}lineNo=max(1u,lo);
 var p=edLabel(i,0u,vec2<f32>(r.x+10.0,y+4.0),11.0,muted,clip,order);let x=number(i,f32(lineNo),0u,p,11.0,accent,clip,order);p=edLabel(i,1u,vec2<f32>(x+10.0,y+4.0),11.0,muted,clip,order);_=number(i,f32(edColumn(d,edLineStart(d,caret),caret)+1u),0u,p,11.0,accent,clip,order);
 p=edLabel(i,2u,vec2<f32>(r.x+r.z*.47,y+4.0),10.0,muted,clip,order);_=number(i,f32(heap[d+9u]),0u,p,10.0,accent,clip,order);
 _=edLabel(i,select(3u,4u,(heap[d+6u]&1u)!=0u),vec2<f32>(r.x+r.z-100.0,y+4.0),10.0,muted,clip,order);
 if(heap[d+39u]>0u){box(i,vec4<f32>(r.x,r.y,r.z,2.0),decodeColor(0xff80b8f0u),0.0,0.0,clip,order);}
 let mode=heap[d+35u];if(mode!=0u){box(i,vec4<f32>(r.x,r.y,r.z,39.0),decodeColor(0xff3b2c1du),0.0,0.0,clip,order);var k=5u;if(mode==5u){k=8u;}if(mode==4u){k=9u;}p=edLabel(i,k,vec2<f32>(r.x+10.0,r.y+10.0),11.0,muted,clip,order);_=drawText(i,heap[d+21u],heap[d+22u],p+vec2<f32>(6.0,0.0),12.0,accent,intersection(clip,vec4<f32>(r.x,r.y,r.x+r.z*.5,r.y+39.0)),0.0,order);
 if(mode==2u||mode==3u){p=edLabel(i,6u,vec2<f32>(r.x+r.z*.5,r.y+10.0),11.0,muted,clip,order);_=drawText(i,heap[d+23u],heap[d+24u],p+vec2<f32>(6.0,0.0),12.0,accent,clip,0.0,order);}else if(mode==1u){_=number(i,f32(heap[d+26u]),0u,vec2<f32>(r.x+r.z-55.0,r.y+10.0),11.0,muted,clip,order);}}
 if(heap[d+45u]!=0u){let count=min(8u,heap[d+48u]);let x=r.x+hf(d+38u)+12.0;let py=min(r.y+r.w-230.0,edTop(i)+24.0);let start=(heap[d+46u]/8u)*8u;box(i,vec4<f32>(x,max(edTop(i),py),min(300.0,r.z-hf(d+38u)-24.0),f32(count)*23.0+8.0),decodeColor(0xff453223u),5.0,0.0,clip,order);for(var k=0u;k<count&&start+k<heap[d+48u];k++){let y=max(edTop(i),py)+4.0+f32(k)*23.0;if(start+k==heap[d+46u]){box(i,vec4<f32>(x+3.0,y,270.0,23.0),decodeColor(0xff6c4830u),2.0,0.0,clip,order);}let entry=heap[heap[d+47u]+start+k];let label=heap[heap[d+76u]+entry];_=drawText(i,label+1u,heap[label],vec2<f32>(x+10.0,y+3.0),12.0,accent,clip,0.0,order);}}
}
@compute @workgroup_size(32)
fn emitEditorParts(@builtin(global_invocation_id) tid:vec3<u32>){
 if(tid.y>=state[61u]||tid.x>=130u){return;}let i=heap[state[60u]+tid.y];let n=nodes[i];if(n.translation.z<=.001||n.rect.z<=0.0||n.rect.w<=0.0){return;}
 emissionHead=644u+tid.y*130u+tid.x;emissionRemaining=32768u;var order=paintNode(i)*8388608u+(tid.x+1u)*32768u;
 if(tid.x==129u){edChrome(i,&order);if(edVisibleHeight(i)>128.0*edLineHeight(i)){atomicOr(&draws.overflow,128u);}return;}let d=ed(i);let first=u32(floor(max(0.0,sf(cs(i)+1u))/edLineHeight(i)));let row=first+tid.x;
 if(row<heap[d+32u]&&f32(tid.x)*edLineHeight(i)<edVisibleHeight(i)+edLineHeight(i)){edRow(i,row,&order);}
}
