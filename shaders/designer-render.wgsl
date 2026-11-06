// Helion design tools use the same retained primitive emitter and compute text
// coverage as the application. These functions never read back geometry.
fn dsLocalClip(i:u32,rect:vec4<f32>)->vec4<f32> {
 let n=nodes[i]; return intersection(n.clip,transformedBounds(n.matrix,n.translation.xy,boundsOf(rect)));
}
fn dsCaption(i:u32,at:u32,p:vec2<f32>,size:f32,color:vec4<f32>,clip:vec4<f32>,order:ptr<function,u32>)->vec2<f32> {
 if(at==0u){return p;}return drawText(i,at+1u,heap[at],p,size,color,clip,0.0,order);
}
fn dsUI(i:u32,d:u32,index:u32,p:vec2<f32>,size:f32,color:vec4<f32>,clip:vec4<f32>,order:ptr<function,u32>)->vec2<f32> {
 return dsCaption(i,heap[heap[d+111u]+index],p,size,color,clip,order);
}
// Prepare a bounded run, then emit through one glyph call site. This preserves
// glyph order/positions but avoids cloning the font pipeline into every branch.
fn dsDecimal(i:u32,value:f32,decimalPlaces:u32,p:vec2<f32>,size:f32,color:vec4<f32>,clip:vec4<f32>,order:ptr<function,u32>)->f32 {
 var scale=1u;for(var j=0u;j<min(3u,decimalPlaces);j++){scale*=10u;}
 let absolute=min(abs(value),9999999.0);var whole=u32(floor(absolute));var fraction=u32(round(fract(absolute)*f32(scale)));
 if(fraction>=scale){whole++;fraction=0u;}
 var reversed:array<u32,16>;var digits:array<u32,16>;var count=0u;var v=whole;
 for(var j=0u;j<10u;j++){reversed[count]=48u+v%10u;count++;v/=10u;if(v==0u){break;}}
 var length=0u;if(value<0.0&&(whole!=0u||fraction!=0u)){digits[length]=45u;length++;}
 for(var j=0u;j<count;j++){digits[length]=reversed[count-1u-j];length++;}
 if(fraction>0u&&decimalPlaces>0u){digits[length]=46u;length++;var divisor=scale/10u;
  for(var j=0u;j<3u&&divisor>0u;j++){digits[length]=48u+fraction/divisor;length++;fraction%=divisor;if(fraction==0u||divisor==1u){break;}divisor/=10u;}
 }
 var x=p.x;for(var j=0u;j<length;j++){let cp=digits[j];glyph(i,cp,vec2<f32>(x,p.y),size,color,clip,order);x+=glyphAdvance(i,cp,size);}return x;
}
fn dsHexText(i:u32,value:u32,p:vec2<f32>,size:f32,color:vec4<f32>,clip:vec4<f32>,order:ptr<function,u32>){
 var x=p.x;for(var k=0u;k<9u;k++){var cp=35u;if(k>0u){let j=k-1u;let byte=(value>>(8u*(j/2u)))&255u;let digit=select(byte&15u,byte>>4u,j%2u==0u);cp=select(48u+digit,55u+digit,digit>9u);}glyph(i,cp,vec2<f32>(x,p.y),size,color,clip,order);x+=glyphAdvance(i,cp,size);}
}

fn dsEditVisual(i:u32,d:u32,r:vec4<f32>,order:ptr<function,u32>){
 let clip=dsLocalClip(i,r);let color=decodeColor(0xfff6ebdfu);let accent=decodeColor(0xffe6d467u);let at=heap[d+46u];let size=12.0;
 box(i,r,decodeColor(0xff382718u),3.0,0.0,clip,order);box(i,r,accent,3.0,1.0,clip,order);
 var caret=0.0;var anchor=0.0;for(var j=0u;j<heap[d+47u];j++){let advance=glyphAdvance(i,heap[at+j],size);if(j<heap[d+48u]){caret+=advance;}if(j<heap[d+99u]){anchor+=advance;}}
 let sx=max(0.0,caret-r.z+16.0);let origin=r.xy+vec2<f32>(5.0-sx,4.0);
 if(caret!=anchor){box(i,vec4<f32>(origin.x+min(caret,anchor),r.y+3.0,abs(caret-anchor),r.w-6.0),decodeColor(0xff79522bu),1.0,0.0,clip,order);}
 _=drawText(i,at,heap[d+47u],origin,size,color,clip,0.0,order);
 if(fract(frame.viewport.w)<.65){line(i,vec2<f32>(origin.x+caret,r.y+4.0),vec2<f32>(origin.x+caret,r.y+r.w-4.0),accent,.7,clip,order);}
}
fn dsDrawSurface(i:u32,d:u32,order:ptr<function,u32>){
 let n=nodes[i];let r=contentRect(n);let clip=n.clip;let z=hf(d+13u);let origin=dsViewportOrigin(d);let doc=vec2<f32>(hf(dsData(d)),hf(dsData(d)+1u));
 let art=vec4<f32>(origin,doc*z);let flags=heap[d+17u];let muted=decodeColor(0xffa39179u);let accent=decodeColor(0xffe6d467u);
 box(i,vec4<f32>(art.xy+vec2<f32>(5.0,7.0),art.zw),decodeColor(0x60000000u),2.0,0.0,clip,order);
 box(i,art,decodeColor(0xff261c15u),0.0,0.0,clip,order);
 box(i,vec4<f32>(art.xy-vec2<f32>(1.0),art.zw+vec2<f32>(2.0)),decodeColor(0xff62513bu),0.0,1.0,clip,order);
 if((flags&8u)!=0u){let ruler=decodeColor(0xff201912u);box(i,vec4<f32>(r.xy,r.z,20.0),ruler,0.0,0.0,clip,order);box(i,vec4<f32>(r.xy,20.0,r.w),ruler,0.0,0.0,clip,order);
  var tick=10.0;for(var growth=0u;growth<32u&&tick*z<36.0;growth++){tick*=2.0;}let x0=floor((r.x-origin.x)/(tick*z));let y0=floor((r.y-origin.y)/(tick*z));
  for(var k=0u;k<256u;k++){let v=(x0+f32(k))*tick;let x=origin.x+v*z;if(x>r.x+r.z){break;}if(x>r.x+23.0){line(i,vec2<f32>(x,r.y+14.0),vec2<f32>(x,r.y+20.0),muted,.5,clip,order);_=dsDecimal(i,v,0u,vec2<f32>(x+3.0,r.y+2.0),9.0,muted,clip,order);}}
  for(var k=0u;k<256u;k++){let v=(y0+f32(k))*tick;let y=origin.y+v*z;if(y>r.y+r.w){break;}if(y>r.y+23.0){line(i,vec2<f32>(r.x+14.0,y),vec2<f32>(r.x+20.0,y),muted,.5,clip,order);}}
 }
 var x=r.x+28.0;let y=r.y+r.w-22.0;box(i,vec4<f32>(r.x,y-3.0,r.z,25.0),decodeColor(0xee211911u),0.0,0.0,clip,order);
 x=dsUI(i,d,select(select(1u,2u,heap[d+12u]==1u),4u,(flags&16u)!=0u),vec2<f32>(x,y),11.0,accent,clip,order).x+12.0;
 x=dsDecimal(i,z*100.0,0u,vec2<f32>(x,y),11.0,muted,clip,order);glyph(i,37u,vec2<f32>(x+1.0,y),11.0,muted,clip,order);
 x+=28.0;x=dsDecimal(i,doc.x,0u,vec2<f32>(x,y),11.0,muted,clip,order);glyph(i,215u,vec2<f32>(x+6.0,y),11.0,muted,clip,order);_=dsDecimal(i,doc.y,0u,vec2<f32>(x+24.0,y),11.0,muted,clip,order);
 if(heap[d+54u]!=0u){_=dsUI(i,d,21u,vec2<f32>(max(r.x+28.0,r.x+r.z-180.0),y),11.0,decodeColor(0xff899df3u),clip,order);_=dsDecimal(i,f32(heap[d+54u]),0u,vec2<f32>(r.x+r.z-26.0,y),11.0,decodeColor(0xff899df3u),clip,order);}
}
fn dsOverlayPoint(i:u32,point:vec2<f32>)->vec2<f32>{return inverse(nodes[i].matrix,nodes[i].translation.xy,point);}
fn dsOverlayLine(i:u32,a:vec2<f32>,b:vec2<f32>,color:vec4<f32>,width:f32,order:ptr<function,u32>){line(i,dsOverlayPoint(i,a),dsOverlayPoint(i,b),color,width,nodes[i].clip,order);}
fn dsDrawAdorner(i:u32,d:u32,order:ptr<function,u32>){
 if((heap[d+17u]&16u)!=0u){return;}let accent=decodeColor(0xffe6d467u);let soft=decodeColor(0x994debad);let clip=nodes[i].clip;
 for(var k=0u;k<heap[d+1u];k++){if(!dsSelected(d,k)){continue;}let n=nodes[dsNode(d,k)];if(!visible(dsNode(d,k))){continue;}
  let a=transform(n.matrix,n.translation.xy,n.rect.xy);let b=transform(n.matrix,n.translation.xy,n.rect.xy+vec2<f32>(n.rect.z,0.0));let c=transform(n.matrix,n.translation.xy,n.rect.xy+n.rect.zw);let e=transform(n.matrix,n.translation.xy,n.rect.xy+vec2<f32>(0.0,n.rect.w));
  dsOverlayLine(i,a,b,soft,.65,order);dsOverlayLine(i,b,c,soft,.65,order);dsOverlayLine(i,c,e,soft,.65,order);dsOverlayLine(i,e,a,soft,.65,order);
 }
 if(heap[d+10u]>0u){let b=dsSelectionBounds(d);let a=dsOverlayPoint(i,b.xy);let z=dsOverlayPoint(i,b.zw);box(i,vec4<f32>(a,max(vec2<f32>(0.1),z-a)),accent,0.0,.7,clip,order);
  for(var h=0u;h<9u;h++){if(heap[d+10u]>1u&&h<8u){continue;}let p=dsOverlayPoint(i,dsHandlePosition(b,h));if(h==8u){let q=dsOverlayPoint(i,dsHandlePosition(b,1u));line(i,p,q,accent,.7,clip,order);disc(i,p,4.5,accent,clip,order);}else{box(i,vec4<f32>(p-vec2<f32>(3.5),vec2<f32>(7.0)),decodeColor(0xff201912u),1.0,0.0,clip,order);box(i,vec4<f32>(p-vec2<f32>(3.5),vec2<f32>(7.0)),accent,1.0,1.0,clip,order);}}
  if(b.w-b.y>16.0){let p=dsOverlayPoint(i,vec2<f32>(b.x,b.w+6.0));let primary=heap[d+9u];_=drawText(i,dsName(d,primary),heap[dsRec(d,primary)+5u],p,10.0,accent,clip,0.0,order);}
 }
 if(heap[d+18u]==2u){let start=dsOverlayPoint(i,vec2<f32>(hf(d+19u),hf(d+20u)));let end=dsOverlayPoint(i,vec2<f32>(hf(d+76u),hf(d+77u)));let r=vec4<f32>(min(start,end),abs(start-end));box(i,r,decodeColor(0x2859dcf5u),0.0,0.0,clip,order);box(i,r,accent,0.0,.7,clip,order);}
 if((heap[d+17u]&256u)!=0u&&heap[d+9u]!=NONE){let primary=heap[d+9u];let parent=heap[dsRec(d,primary)+2u];if(parent!=NONE){let pn=nodes[dsNode(d,parent)];let r=contentRect(pn);let guide=decodeColor(0xffea86e2u);
  if(heap[d+86u]!=0u){let x=r.x+hf(d+84u);dsOverlayLine(i,transform(pn.matrix,pn.translation.xy,vec2<f32>(x,r.y)),transform(pn.matrix,pn.translation.xy,vec2<f32>(x,r.y+r.w)),guide,.65,order);}
  if(heap[d+87u]!=0u){let y=r.y+hf(d+85u);dsOverlayLine(i,transform(pn.matrix,pn.translation.xy,vec2<f32>(r.x,y)),transform(pn.matrix,pn.translation.xy,vec2<f32>(r.x+r.z,y)),guide,.65,order);}
 }}
}
fn dsDrawTree(i:u32,d:u32,order:ptr<function,u32>){
 let n=nodes[i];let r=contentRect(n);let sy=sf(cs(i)+1u);let clip=n.clip;let fg=decodeColor(n.paint.y);let muted=decodeColor(0xffa39179u);let accent=decodeColor(0xffe6d467u);var row=0u;
 for(var rank=0u;rank<heap[d+58u];rank++){let k=heap[heap[d+56u]+rank];var parent=heap[dsRec(d,k)+2u];var collapsed=false;for(var dep=0u;dep<18u&&parent!=NONE;dep++){if((heap[dsRec(d,parent)+4u]&4u)!=0u){collapsed=true;break;}parent=heap[dsRec(d,parent)+2u];}if(collapsed){continue;}
  let y=r.y+f32(row)*27.0-sy;row++;if(y+27.0<r.y||y>r.y+r.w){continue;}let slot=dsRec(d,k);let depth=nodes[dsNode(d,k)].text.x-nodes[heap[d+2u]].text.x;let x=r.x+f32(depth)*14.0;
  if(dsSelected(d,k)){box(i,vec4<f32>(r.x,y,r.z,27.0),decodeColor(0xff4f3724u),3.0,0.0,clip,order);box(i,vec4<f32>(r.x,y,2.0,27.0),accent,0.0,0.0,clip,order);}
  if(nodes[dsNode(d,k)].info.w>0u){let p=vec2<f32>(x+10.0,y+13.0);if((heap[slot+4u]&4u)!=0u){line(i,p+vec2<f32>(-2.0,-4.0),p+vec2<f32>(2.0,0.0),muted,.8,clip,order);line(i,p+vec2<f32>(2.0,0.0),p+vec2<f32>(-2.0,4.0),muted,.8,clip,order);}else{line(i,p+vec2<f32>(-4.0,-2.0),p+vec2<f32>(0.0,2.0),muted,.8,clip,order);line(i,p+vec2<f32>(0.0,2.0),p+vec2<f32>(4.0,-2.0),muted,.8,clip,order);}}
  let rowClip=dsLocalClip(i,vec4<f32>(x+19.0,y,max(1.0,r.x+r.z-53.0-x-19.0),27.0));let tint=select(fg,muted,(heap[slot+4u]&1u)!=0u);
  _=drawText(i,dsName(d,k),heap[slot+5u],vec2<f32>(x+20.0,y+6.0),12.0,tint,rowClip,0.0,order);
  let eye=vec2<f32>(r.x+r.z-38.0,y+14.0);disc(i,eye,2.3,select(accent,muted,(heap[slot+4u]&1u)!=0u),clip,order);if((heap[slot+4u]&1u)!=0u){line(i,eye-vec2<f32>(4.0,-4.0),eye+vec2<f32>(4.0,-4.0),muted,.7,clip,order);}
  let locked=(heap[slot+4u]&2u)!=0u;let l=vec2<f32>(r.x+r.z-13.0,y+13.0);box(i,vec4<f32>(l-vec2<f32>(3.0,1.0),6.0,6.0),select(muted,accent,locked),1.0,select(.7,0.0,locked),clip,order);if(locked){box(i,vec4<f32>(l-vec2<f32>(2.0,5.0),4.0,5.0),accent,1.0,.7,clip,order);}
  if(heap[d+75u]==k){line(i,vec2<f32>(x+15.0,y+26.0),vec2<f32>(r.x+r.z-8.0,y+26.0),accent,1.2,clip,order);}
 }
 if(f32(row)*27.0>r.w){let extent=f32(row)*27.0;let height=max(16.0,r.w*r.w/extent);box(i,vec4<f32>(r.x+r.z-3.0,r.y+sy/extent*r.w,3.0,height),muted,2.0,0.0,clip,order);}
}
fn dsInspectValue(i:u32,d:u32,k:u32,field:u32,kind:u32,r:vec4<f32>,order:ptr<function,u32>){
 let clip=dsLocalClip(i,r);let fg=decodeColor(nodes[i].paint.y);let muted=decodeColor(0xffa39179u);
 if(heap[d+45u]==field&&heap[d+50u]==k){dsEditVisual(i,d,r,order);return;}
 if(kind==1u){let color=dsRead(d,k,field);box(i,vec4<f32>(r.x+4.0,r.y+6.0,12.0,12.0),decodeColor(color),2.0,0.0,clip,order);dsHexText(i,color,r.xy+vec2<f32>(22.0,5.0),10.0,fg,clip,order);return;}
 var offset=0u;var count=0u;var size=11.0;var color=fg;var caption=0u;
 if(kind==3u||kind==4u){offset=select(dsName(d,k),dsText(d,k),kind==4u);count=heap[dsRec(d,k)+field];size=12.0;}
 else if(kind==2u){
  if(field==86u||field==88u){let destination=dsRead(d,k,field);if(destination!=NONE&&dsAlive(d,destination)){offset=dsName(d,destination);count=heap[dsRec(d,destination)+5u];}else{caption=heap[heap[d+110u]+85u*8u];color=muted;}}
  else{caption=heap[heap[d+110u]+field*8u+min(7u,dsRead(d,k,field))];}
 }else{
  var value=dsNumber(d,k,field);if(dsIntegerField(field)){value=f32(dsRead(d,k,field));}if(field==26u){value=degrees(value);}if((field==86u||field==88u)&&dsRead(d,k,field)==NONE){value=-1.0;}
  if((field==10u||field==11u)&&value<0.0){caption=heap[heap[d+59u]+16u];color=muted;}else{_=dsDecimal(i,value,3u,r.xy+vec2<f32>(5.0,4.0),12.0,fg,clip,order);return;}
 }
 if(caption!=0u){offset=caption+1u;count=heap[caption];}
 if(count!=0u){_=drawText(i,offset,count,r.xy+vec2<f32>(5.0,4.0),size,color,clip,0.0,order);}
 if(kind==2u){glyph(i,8250u,vec2<f32>(r.x+r.z-10.0,r.y+3.0),12.0,muted,clip,order);}
}
fn dsDrawInspector(i:u32,d:u32,order:ptr<function,u32>){
 switch nodes[i].action.w{case 1u:{dsDrawInspectorRole1(i,d,order);}case 2u:{dsDrawInspectorRole2(i,d,order);}case 3u:{dsDrawInspectorRole3(i,d,order);}default:{dsDrawInspectorRole0(i,d,order);}}
}

fn dsDrawColors(i:u32,d:u32,order:ptr<function,u32>){
 let n=nodes[i];let r=contentRect(n);let clip=n.clip;let primary=heap[d+9u];let resourceIndex=heap[d+100u];let fg=decodeColor(n.paint.y);let muted=decodeColor(0xffa39179u);let accent=decodeColor(0xffe6d467u);
 if(primary==NONE&&resourceIndex==0u){_=dsUI(i,d,7u,r.xy+vec2<f32>(8.0,16.0),12.0,muted,clip,order);return;}
 var color=0u;let field=clamp(heap[d+98u],31u,33u);if(resourceIndex>0u){color=heap[dsData(d)+64u+(resourceIndex-1u)*68u];}else{color=dsRead(d,primary,field);}
 for(var x=0u;x<32u;x++){if(f32(x)*8.0>=r.z-16.0){break;}for(var y=0u;y<5u;y++){box(i,vec4<f32>(r.x+8.0+f32(x)*8.0,r.y+8.0+f32(y)*8.0,8.0,8.0),decodeColor(select(0xff4b4037u,0xff6c5c4du,(x+y)%2u==0u)),0.0,0.0,clip,order);}}
 box(i,vec4<f32>(r.x+8.0,r.y+8.0,r.z-16.0,40.0),decodeColor(color),3.0,0.0,clip,order);dsHexText(i,color,vec2<f32>(r.x+15.0,r.y+21.0),11.0,select(decodeColor(0xff17130fu),decodeColor(0xfff7f1eau),f32(color&255u)+f32((color>>8u)&255u)+f32((color>>16u)&255u)<370.0),clip,order);
 for(var channel=0u;channel<4u;channel++){let y=r.y+62.0+f32(channel)*32.0;let value=f32((color>>(8u*channel))&255u);let begin=r.x+26.0;let width=max(1.0,r.z-65.0);glyph(i,select(select(select(82u,71u,channel==1u),66u,channel==2u),65u,channel==3u),vec2<f32>(r.x+8.0,y+6.0),11.0,muted,clip,order);box(i,vec4<f32>(begin,y+11.0,width,6.0),decodeColor(0xff4b3828u),3.0,0.0,clip,order);box(i,vec4<f32>(begin,y+11.0,width*value/255.0,6.0),accent,3.0,0.0,clip,order);disc(i,vec2<f32>(begin+width*value/255.0,y+14.0),4.0,fg,clip,order);_=dsDecimal(i,value,0u,vec2<f32>(r.x+r.z-33.0,y+6.0),10.0,fg,clip,order);}
 _=dsUI(i,d,select(29u,30u,resourceIndex>0u),vec2<f32>(r.x+8.0,r.y+198.0),10.0,muted,clip,order);
}
fn dsDiamond(i:u32,p:vec2<f32>,size:f32,color:vec4<f32>,clip:vec4<f32>,order:ptr<function,u32>){
 line(i,p+vec2<f32>(0.0,-size),p+vec2<f32>(size,0.0),color,1.3,clip,order);line(i,p+vec2<f32>(size,0.0),p+vec2<f32>(0.0,size),color,1.3,clip,order);line(i,p+vec2<f32>(0.0,size),p+vec2<f32>(-size,0.0),color,1.3,clip,order);line(i,p+vec2<f32>(-size,0.0),p+vec2<f32>(0.0,-size),color,1.3,clip,order);
}
fn dsDrawTimeline(i:u32,d:u32,order:ptr<function,u32>){
 let n=nodes[i];let r=contentRect(n);let clip=n.clip;let primary=heap[d+9u];let duration=hf(dsData(d)+2u);let width=max(1.0,r.z-146.0);let origin=r.x+130.0;let fg=decodeColor(n.paint.y);let muted=decodeColor(0xffa39179u);let accent=decodeColor(0xffe6d467u);let red=decodeColor(0xff9391eeu);
 box(i,vec4<f32>(r.xy,r.z,30.0),decodeColor(0xff2a2017u),0.0,0.0,clip,order);_=dsUI(i,d,32u,r.xy+vec2<f32>(8.0,7.0),10.0,muted,clip,order);_=dsDecimal(i,hf(d+35u),2u,r.xy+vec2<f32>(45.0,6.0),12.0,accent,clip,order);
 var step=.1;for(var growth=0u;growth<32u&&width*step/duration<48.0;growth++){step*=2.0;}
 for(var tick=0u;tick<256u;tick++){let time=f32(tick)*step;if(time>duration){break;}let x=origin+time/duration*width;line(i,vec2<f32>(x,r.y+22.0),vec2<f32>(x,min(r.y+r.w,r.y+222.0)),decodeColor(0xff392b20u),.5,clip,order);_=dsDecimal(i,time,1u,vec2<f32>(x+4.0,r.y+6.0),10.0,muted,clip,order);}
 for(var t=0u;t<6u;t++){let y=r.y+30.0+f32(t)*32.0;if(y>r.y+r.w){break;}if(t==heap[d+38u]){box(i,vec4<f32>(r.x,y,r.z,32.0),decodeColor(0x663b2c21u),0.0,0.0,clip,order);}line(i,vec2<f32>(r.x,y+31.0),vec2<f32>(r.x+r.z,y+31.0),decodeColor(0xff32271du),.45,clip,order);_=dsCaption(i,heap[heap[d+112u]+t],vec2<f32>(r.x+8.0,y+9.0),11.0,select(muted,fg,t==heap[d+38u]),clip,order);
  if(primary==NONE){continue;}let at=dsTrack(d,primary,t);for(var key=0u;key<heap[at];key++){let p=vec2<f32>(origin+hf(at+4u+key*4u)/duration*width,y+16.0);let selected=t==heap[d+38u]&&key==heap[d+73u];dsDiamond(i,p,select(4.0,6.0,selected),select(accent,red,selected),clip,order);}
 }
 let play=origin+hf(d+35u)/duration*width;line(i,vec2<f32>(play,r.y+22.0),vec2<f32>(play,min(r.y+r.w,r.y+222.0)),red,1.0,clip,order);box(i,vec4<f32>(play-4.0,r.y+21.0,8.0,5.0),red,1.0,0.0,clip,order);
 if(r.w>246.0){let y=r.y+230.0;if((heap[d+17u]&32u)!=0u){disc(i,vec2<f32>(r.x+12.0,y+7.0),3.5,red,clip,order);_=dsUI(i,d,34u,vec2<f32>(r.x+23.0,y),11.0,red,clip,order);}else{_=dsUI(i,d,35u,vec2<f32>(r.x+8.0,y),11.0,muted,clip,order);}
  if(primary!=NONE){let at=dsTrack(d,primary,min(5u,heap[d+38u]));let key=heap[d+73u];if(key<heap[at]){_=dsUI(i,d,46u,vec2<f32>(origin,y),10.0,muted,clip,order);_=dsCaption(i,heap[heap[d+113u]+min(8u,heap[at+6u+key*4u])],vec2<f32>(origin+48.0,y),11.0,accent,clip,order);_=dsDecimal(i,hf(at+5u+key*4u),3u,vec2<f32>(origin+158.0,y),11.0,fg,clip,order);}}
 }
}
fn emitDesignerControl(i:u32,order:ptr<function,u32>){
 if((VIEW_FEATURES&32u)==0u){return;}let d=nodes[i].aux.x;if(d==0u){return;}
 switch nodes[i].info.x{case 30u:{dsDrawSurface(i,d,order);}case 31u:{dsDrawTree(i,d,order);}case 32u:{dsDrawInspector(i,d,order);}case 33u:{dsDrawTimeline(i,d,order);}case 34u:{dsDrawColors(i,d,order);}case 35u:{dsDrawAdorner(i,d,order);}default:{}}
}

fn dsDrawRootGrid(i:u32,order:ptr<function,u32>){
 if((VIEW_FEATURES&32u)==0u){return;}let d=dsOwner(i);if(d==0u||dsSlot(d,i)!=0u||(heap[d+17u]&20u)!=4u){return;}
 let n=nodes[i];let r=n.rect;let scale=max(.01,length(n.matrix.xy));var step=max(1.0,hf(d+16u));for(var growth=0u;growth<32u&&step*scale<12.0;growth++){step*=2.0;}
 let color=decodeColor(select(0x16000000u,0x16ffffffu,f32(n.paint.x&255u)+f32((n.paint.x>>8u)&255u)+f32((n.paint.x>>16u)&255u)<380.0));
 for(var col=1u;col<1024u;col++){let x=r.x+f32(col)*step;if(x>=r.x+r.z){break;}line(i,vec2<f32>(x,r.y),vec2<f32>(x,r.y+r.w),color,.35/scale,n.clip,order);}
 for(var row=1u;row<1024u;row++){let y=r.y+f32(row)*step;if(y>=r.y+r.w){break;}line(i,vec2<f32>(r.x,y),vec2<f32>(r.x+r.z,y),color,.35/scale,n.clip,order);}
}

// These dispatches own disjoint node list heads. Preserve the same painter keys
// and full-quality drawing helpers without one giant native emission program.
fn beginDesignerEmission(i:u32,order:ptr<function,u32>)->bool{
 let n=nodes[i];if(n.translation.z<=0.001||n.rect.z<=0.0||n.rect.w<=0.0||templateHasVisual(i)){return false;}
 emissionHead=i;emissionRemaining=32768u;*order=paintNode(i)*8388608u;
 var background=decodeColor(n.paint.x);if(n.action.x==8u&&u32(bitcast<f32>(n.action.z))==state[8]){background=decodeColor(0xff493821u);}
 box(i,n.rect,background,bitcast<f32>(n.paint.w),0.0,n.clip,order);dsDrawRootGrid(i,order);
 if(n.misc.w>0.0){box(i,n.rect,decodeColor(n.paint.z),bitcast<f32>(n.paint.w),n.misc.w,n.clip,order);}return true;
}
fn finishDesignerEmission(i:u32,order:ptr<function,u32>){if(state[7]!=0u){box(i,nodes[i].rect,vec4<f32>(decodeColor(0xffe6d467u).rgb,0.35),0.0,0.5,nodes[i].clip,order);}}

@compute @workgroup_size(64)
fn emitDesignerSurface(@builtin(global_invocation_id) id:vec3<u32>){
 let i=id.x;if(i>=frame.counts.x||nodes[i].info.x!=30u){return;}var order=0u;if(!beginDesignerEmission(i,&order)){return;}
 let d=nodes[i].aux.x;if(d!=0u){dsDrawSurface(i,d,&order);}finishDesignerEmission(i,&order);
}

@compute @workgroup_size(64)
fn emitDesignerTree(@builtin(global_invocation_id) id:vec3<u32>){
 let i=id.x;if(i>=frame.counts.x||nodes[i].info.x!=31u){return;}var order=0u;if(!beginDesignerEmission(i,&order)){return;}
 let d=nodes[i].aux.x;if(d!=0u){dsDrawTree(i,d,&order);}finishDesignerEmission(i,&order);
}

@compute @workgroup_size(64)
fn emitDesignerInspector(@builtin(global_invocation_id) id:vec3<u32>){
 let i=id.x;if(i>=frame.counts.x||nodes[i].info.x!=32u||nodes[i].action.w!=0u){return;}var order=0u;if(!beginDesignerEmission(i,&order)){return;}
 let d=nodes[i].aux.x;if(d!=0u){dsDrawInspectorRole0(i,d,&order);}finishDesignerEmission(i,&order);
}

@compute @workgroup_size(64)
fn emitDesignerResources(@builtin(global_invocation_id) id:vec3<u32>){
 let i=id.x;if(i>=frame.counts.x||nodes[i].info.x!=32u||nodes[i].action.w!=1u){return;}var order=0u;if(!beginDesignerEmission(i,&order)){return;}
 let d=nodes[i].aux.x;if(d!=0u){dsDrawInspectorRole1(i,d,&order);}finishDesignerEmission(i,&order);
}

@compute @workgroup_size(64)
fn emitDesignerStates(@builtin(global_invocation_id) id:vec3<u32>){
 let i=id.x;if(i>=frame.counts.x||nodes[i].info.x!=32u||nodes[i].action.w!=2u){return;}var order=0u;if(!beginDesignerEmission(i,&order)){return;}
 let d=nodes[i].aux.x;if(d!=0u){dsDrawInspectorRole2(i,d,&order);}finishDesignerEmission(i,&order);
}

@compute @workgroup_size(64)
fn emitDesignerTracks(@builtin(global_invocation_id) id:vec3<u32>){
 let i=id.x;if(i>=frame.counts.x||nodes[i].info.x!=32u||nodes[i].action.w!=3u){return;}var order=0u;if(!beginDesignerEmission(i,&order)){return;}
 let d=nodes[i].aux.x;if(d!=0u){dsDrawInspectorRole3(i,d,&order);}finishDesignerEmission(i,&order);
}


@compute @workgroup_size(64)
fn emitDesignerTimeline(@builtin(global_invocation_id) id:vec3<u32>){
 let i=id.x;if(i>=frame.counts.x||nodes[i].info.x!=33u){return;}var order=0u;if(!beginDesignerEmission(i,&order)){return;}
 let d=nodes[i].aux.x;if(d!=0u){dsDrawTimeline(i,d,&order);}finishDesignerEmission(i,&order);
}

@compute @workgroup_size(64)
fn emitDesignerColors(@builtin(global_invocation_id) id:vec3<u32>){
 let i=id.x;if(i>=frame.counts.x||nodes[i].info.x!=34u){return;}var order=0u;if(!beginDesignerEmission(i,&order)){return;}
 let d=nodes[i].aux.x;if(d!=0u){dsDrawColors(i,d,&order);}finishDesignerEmission(i,&order);
}

@compute @workgroup_size(64)
fn emitDesignerAdorner(@builtin(global_invocation_id) id:vec3<u32>){
 let i=id.x;if(i>=frame.counts.x||nodes[i].info.x!=35u){return;}var order=0u;if(!beginDesignerEmission(i,&order)){return;}
 let d=nodes[i].aux.x;if(d!=0u){dsDrawAdorner(i,d,&order);}finishDesignerEmission(i,&order);
}

// Each inspector role has a bounded native compiler graph.
fn dsDrawInspectorRole0(i:u32,d:u32,order:ptr<function,u32>){
 let n=nodes[i];let r=contentRect(n);let sy=sf(cs(i)+1u);let clip=n.clip;let fg=decodeColor(n.paint.y);let muted=decodeColor(0xffa39179u);let accent=decodeColor(0xffe6d467u);let primary=heap[d+9u];let role=n.action.w;

 if(primary==NONE){_=dsUI(i,d,8u,r.xy+vec2<f32>(8.0,14.0),12.0,muted,clip,order);return;}

 for(var row=0u;row<heap[d+103u];row++){let y=r.y+f32(row)*28.0-sy;if(y+28.0<r.y||y>r.y+r.w){continue;}let at=heap[d+40u]+row*4u;let field=heap[at+2u];let kind=heap[at+3u];
  if(kind==5u){box(i,vec4<f32>(r.x,y,r.z,28.0),decodeColor(0xff241d16u),0.0,0.0,clip,order);_=drawText(i,heap[at],heap[at+1u],vec2<f32>(r.x+8.0,y+7.0),11.0,accent,clip,0.0,order);continue;}
  let width=min(118.0,r.z*.47);_=drawText(i,heap[at],heap[at+1u],vec2<f32>(r.x+8.0,y+6.0),11.0,muted,dsLocalClip(i,vec4<f32>(r.x,y,width,28.0)),0.0,order);
  let cell=vec4<f32>(r.x+width,y+2.0,max(1.0,r.z-width-6.0),24.0);box(i,cell,decodeColor(0xff211911u),3.0,0.0,clip,order);dsInspectValue(i,d,primary,field,kind,cell,order);
 }
 let extent=f32(heap[d+103u])*28.0;if(extent>r.w){box(i,vec4<f32>(r.x+r.z-3.0,r.y+sy/extent*r.w,3.0,max(16.0,r.w*r.w/extent)),muted,2.0,0.0,clip,order);}
}
fn dsDrawInspectorRole1(i:u32,d:u32,order:ptr<function,u32>){
 let n=nodes[i];let r=contentRect(n);let sy=sf(cs(i)+1u);let clip=n.clip;let fg=decodeColor(n.paint.y);let muted=decodeColor(0xffa39179u);let accent=decodeColor(0xffe6d467u);let primary=heap[d+9u];let role=n.action.w;
 let count=heap[dsData(d)+3u];for(var row=0u;row<=count&&row<17u;row++){let y=r.y+f32(row)*28.0-sy;if(y+28.0<r.y||y>r.y+r.w){continue;}if(row==count){_=dsUI(i,d,12u,vec2<f32>(r.x+8.0,y+6.0),12.0,accent,clip,order);continue;}let at=dsData(d)+64u+row*68u;if(heap[d+100u]==row+1u){box(i,vec4<f32>(r.x,y,r.z,28.0),decodeColor(0xff4d3624u),3.0,0.0,clip,order);}box(i,vec4<f32>(r.x+7.0,y+6.0,16.0,16.0),decodeColor(heap[at]),3.0,0.0,clip,order);_=drawText(i,at+4u,heap[at+1u],vec2<f32>(r.x+30.0,y+6.0),12.0,fg,dsLocalClip(i,vec4<f32>(r.x+28.0,y,r.z-132.0,28.0)),0.0,order);
   if(heap[d+45u]==2000u+row){dsEditVisual(i,d,vec4<f32>(r.x+r.z-107.0,y+2.0,103.0,24.0),order);}else{dsHexText(i,heap[at],vec2<f32>(r.x+r.z-106.0,y+7.0),9.0,muted,clip,order);}}
  return;}
fn dsDrawInspectorRole2(i:u32,d:u32,order:ptr<function,u32>){
 let n=nodes[i];let r=contentRect(n);let sy=sf(cs(i)+1u);let clip=n.clip;let fg=decodeColor(n.paint.y);let muted=decodeColor(0xffa39179u);let accent=decodeColor(0xffe6d467u);let primary=heap[d+9u];let role=n.action.w;
 for(var row=0u;row<4u;row++){let y=r.y+f32(row)*28.0-sy;if(y+28.0<r.y||y>r.y+r.w){continue;}if(heap[d+70u]==row){box(i,vec4<f32>(r.x,y,r.z,28.0),decodeColor(0xff513826u),3.0,0.0,clip,order);}if(row==0u){_=dsUI(i,d,14u,vec2<f32>(r.x+8.0,y+6.0),12.0,fg,clip,order);}else{let at=dsData(d)+8u+(row-1u)*16u;if(heap[at]>0u){_=dsCaption(i,at,vec2<f32>(r.x+8.0,y+6.0),12.0,fg,clip,order);}else{_=dsCaption(i,heap[heap[d+59u]+row],vec2<f32>(r.x+8.0,y+6.0),12.0,muted,clip,order);}_=dsUI(i,d,13u,vec2<f32>(r.x+r.z-73.0,y+6.0),11.0,accent,clip,order);}}
  _=dsUI(i,d,15u,vec2<f32>(r.x+8.0,r.y+126.0),10.0,muted,clip,order);return;}
fn dsDrawInspectorRole3(i:u32,d:u32,order:ptr<function,u32>){
 let n=nodes[i];let r=contentRect(n);let sy=sf(cs(i)+1u);let clip=n.clip;let fg=decodeColor(n.paint.y);let muted=decodeColor(0xffa39179u);let accent=decodeColor(0xffe6d467u);let primary=heap[d+9u];let role=n.action.w;

 if(primary==NONE){_=dsUI(i,d,8u,r.xy+vec2<f32>(8.0,14.0),12.0,muted,clip,order);return;}
 let rec=dsRec(d,primary);if(heap[rec+1u]!=1u){_=dsUI(i,d,9u,r.xy+vec2<f32>(8.0,14.0),11.0,muted,clip,order);return;}
  for(var axis=0u;axis<2u;axis++){let count=heap[rec+48u+axis];for(var j=0u;j<9u;j++){let y=r.y+f32(axis*9u+j)*28.0-sy;if(y+28.0<r.y||y>r.y+r.w){continue;}if(j==8u){_=dsUI(i,d,10u+axis,vec2<f32>(r.x+8.0,y+6.0),11.0,accent,clip,order);continue;}if(j>=count){continue;}let at=rec+50u+axis*16u+j*2u;_=dsUI(i,d,40u+axis,vec2<f32>(r.x+7.0,y+6.0),10.0,muted,clip,order);_=dsDecimal(i,f32(j),0u,vec2<f32>(r.x+55.0,y+6.0),11.0,fg,clip,order);_=dsCaption(i,heap[heap[d+59u]+select(select(17u,16u,heap[at]==1u),18u,heap[at]==2u)],vec2<f32>(r.x+72.0,y+6.0),10.0,accent,clip,order);if(heap[d+45u]==1000u+axis*8u+j){dsEditVisual(i,d,vec4<f32>(r.x+115.0,y+2.0,max(1.0,r.z-120.0),24.0),order);}else{_=dsDecimal(i,hf(at+1u),2u,vec2<f32>(r.x+120.0,y+6.0),12.0,fg,clip,order);}}}return;}
