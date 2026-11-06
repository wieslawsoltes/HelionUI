var<private> drawingActive:bool;
var<private> drawingLocal:vec4<f32>;
var<private> drawingOffset:vec2<f32>;
var<private> drawingAlpha:f32;
var<private> drawingBrush:u32;
var<private> drawingClip:u32;
// Every invocation owns exactly one list head; no cross-lane publication races.
var<private> emissionHead:u32;
var<private> emissionRemaining:u32;
fn addPrimitive(i:u32,kind:u32,rect:vec4<f32>,color:vec4<f32>,params:vec4<f32>,pathResource:u32,clip:vec4<f32>,order:ptr<function,u32>) {
 let n=nodes[i]; let alpha=color.a*n.translation.z*select(1.0,drawingAlpha,drawingActive); if(alpha<=0.0001) { return; }
 let dpr=frame.viewport.z; var m=n.matrix*dpr; var translation=n.translation.xy*dpr;
 if(drawingActive){m=drawingMatrix(n.matrix,drawingLocal)*dpr;translation=transform(n.matrix,n.translation.xy,contentRect(n).xy+drawingOffset)*dpr;}
 var local=boundsOf(rect);
 if(kind==2u || kind==4u) {
  let b=vec4<f32>(hf(pathResource+6u),hf(pathResource+7u),hf(pathResource+8u),hf(pathResource+9u)); let stroke=hf(pathResource+5u)*0.6+select(0.1,0.0,kind==4u);
  local=vec4<f32>(rect.xy+(b.xy-vec2<f32>(stroke))*rect.zw,rect.xy+(b.zw+vec2<f32>(stroke))*rect.zw);
 }
 if(kind==3u) { local=vec4<f32>(min(rect.xy,rect.zw)-vec2<f32>(params.y),max(rect.xy,rect.zw)+vec2<f32>(params.y)); }
 let deviceClip=clip*dpr;
 let bounds=intersection(transformedBounds(m,translation,local)+vec4<f32>(-1.0,-1.0,1.0,1.0),deviceClip);
 if(any(bounds.zw<=bounds.xy)) { return; }
 // A pathological static string must report overflow, never collide with another section’s painter keys.
 if(emissionRemaining==0u) { atomicOr(&draws.overflow,1u); return; } emissionRemaining--;
 let index=atomicAdd(&draws.count,1u); let paintOrder=*order; *order+=1u;
 if(index>=MAX_PRIMITIVES) { atomicOr(&draws.overflow,1u); return; }
 draws.items[index]=Primitive(bounds,deviceClip,vec4<f32>(color.rgb,alpha),vec4<u32>(kind,pathResource,draws.heads[emissionHead],paintOrder),rect,params,m,vec4<f32>(translation,select(0.0,f32(drawingClip),drawingActive),select(0.0,f32(drawingBrush),drawingActive)));
 draws.heads[emissionHead]=index;
}
fn box(i:u32,rect:vec4<f32>,color:vec4<f32>,radius:f32,stroke:f32,clip:vec4<f32>,order:ptr<function,u32>) {
 if(rect.z<=0.0 || rect.w<=0.0) { return; }
 addPrimitive(i,0u,rect,color,vec4<f32>(radius,stroke,0.0,0.0),0u,clip,order);
}
fn line(i:u32,a:vec2<f32>,b:vec2<f32>,color:vec4<f32>,width:f32,clip:vec4<f32>,order:ptr<function,u32>) {
 addPrimitive(i,3u,vec4<f32>(a,b),color,vec4<f32>(0.0,width,0.0,0.0),0u,clip,order);
}
fn disc(i:u32,center:vec2<f32>,radius:f32,color:vec4<f32>,clip:vec4<f32>,order:ptr<function,u32>) {
 addPrimitive(i,1u,vec4<f32>(center-vec2<f32>(radius),vec2<f32>(radius*2.0)),color,vec4<f32>(0.0),0u,clip,order);
}
fn emitGlyph(i:u32,g:TextGlyph,baseline:vec2<f32>,size:f32,color:vec4<f32>,clip:vec4<f32>,order:ptr<function,u32>) {
 let glyphPathInfo=glyphResource(g); if(glyphPathInfo==0u || heap[glyphPathInfo+4u]==0u) { return; }
 let kind=select(2u,4u,heap[g.face+12u]!=0u);
 addPrimitive(i,kind,vec4<f32>(baseline,vec2<f32>(size)),color,vec4<f32>(0.0),glyphPathInfo,clip,order);
}
fn glyph(i:u32,code:u32,p:vec2<f32>,size:f32,color:vec4<f32>,clip:vec4<f32>,order:ptr<function,u32>) {
 emitGlyph(i,mapGlyph(i,code),p+vec2<f32>(0.0,textBaseline(i,size)),size,color,clip,order);
}
// Shapes are laid out before emission. Drawing only reads glyph/line buffers;
// cache keys, source curves and exact fractional positions remain unchanged.
fn drawShapedText(i:u32,r:u32,p:vec2<f32>,color:vec4<f32>,clip:vec4<f32>,order:ptr<function,u32>)->vec2<f32>{
 let paragraph=pgData(r);if(heap[paragraph+17u]==0u){return p;}let size=hf(paragraph+1u);let positions=heap[paragraph+10u];
 for(var k=0u;k<heap[r+7u];k++){let q=positions+k*4u;let g=shGlyph(r,k);if(heap[q+3u]==NONE||(heap[g+19u]&1u)!=0u||heap[g+3u]==9u){continue;}
  let face=shFace(r,heap[g+4u]);emitGlyph(i,TextGlyph(face,heap[g],1u,0u,heap[g+3u]),p+vec2<f32>(hf(q),hf(q+1u)),size,color,clip,order);
 }
 let face=primaryFont(i);let decoration=heap[textStyle(i)+6u];var cursor=p;
 for(var j=0u;j<heap[paragraph+13u];j++){let ln=pgLine(paragraph,j);let x=p.x+hf(ln+5u);let width=hf(ln+6u);let baseline=p.y+hf(ln+8u);
  if((decoration&1u)!=0u&&width>0.0){box(i,vec4<f32>(x,baseline+hf(face+8u)*size,width,max(0.5,hf(face+9u)*size)),color,0.0,0.0,clip,order);}
  if((decoration&2u)!=0u&&width>0.0){box(i,vec4<f32>(x,baseline+hf(face+10u)*size,width,max(0.5,hf(face+11u)*size)),color,0.0,0.0,clip,order);}
  cursor=vec2<f32>(x+width,p.y+hf(ln+7u));
 }return cursor;
}
fn drawShapedSelection(i:u32,r:u32,lo:u32,hi:u32,start:vec2<f32>,color:vec4<f32>,clip:vec4<f32>,order:ptr<function,u32>){
 let p=pgData(r);let size=hf(p+1u);let carets=heap[p+12u];
 // Walk visual caret intervals. Partial ligature selections use retained GDEF
 // positions; disconnected RTL/LTR selections produce separate rectangles.
 for(var c=lo;c<hi;){var next=c+1u;while(next<hi&&heap[heap[r+21u]+next]==0u){next++;}
  let a=carets+c*4u;let b=carets+next*4u+2u;let x0=hf(a);let x1=hf(b);
  box(i,vec4<f32>(start.x+min(x0,x1),start.y,abs(x1-x0),fontLineHeight(i,size)),color,0.0,0.0,clip,order);c=next;
 }
}
fn drawText(i:u32,offset:u32,len:u32,p:vec2<f32>,size:f32,color:vec4<f32>,clip:vec4<f32>,wrapWidth:f32,order:ptr<function,u32>)->vec2<f32> {
 let shaped=uiTextRun(i,offset,len);if(shaped!=0u){return drawShapedText(i,shaped,p,color,clip,order);}
 var start=0u; var top=p.y; var finalCursor=p;
 loop {
  let mode=select(0u,heap[textStyle(i)+5u],nodes[i].info.x==5u);
  var textLine=TextLine(len,len,0.0);
  if(wrapWidth>0.0 || mode!=0u) { textLine=nextTextLine(i,offset,len,start,size,wrapWidth); }
  else {
   // Hot path: avoid a shaping/measurement pass for unwrapped, left-aligned cell text.
   for(var k=start;k<len;k++) { let cp=heap[offset+k]; if(cp==10u || cp==13u) {
    var next=k+1u; if(cp==13u && next<len && heap[offset+next]==10u) { next++; } textLine=TextLine(k,next,0.0); break;
   } }
  }
  var align=0.0; let alignmentWidth=select(contentRect(nodes[i]).z,wrapWidth,wrapWidth>0.0);
  if(mode==1u) { align=max(0.0,alignmentWidth-textLine.width)*0.5; } if(mode==2u) { align=max(0.0,alignmentWidth-textLine.width); }
  let origin=vec2<f32>(p.x+align,top+textBaseline(i,size)); var x=0.0; var j=start;
  var base=TextGlyph(0u,0u,0u,0u,0u); var lastMark=base; var basePosition=origin; var markPosition=origin;
  var g=textGlyph(i,offset,textLine.end,j);
  while(j<textLine.end) {
   let next=textGlyph(i,offset,textLine.end,j+g.count); var position=origin+vec2<f32>(x,0.0);
   if(isCombining(g.code) && base.face!=0u) {
    var anchor=markAttachment(lastMark,g,true); if(anchor.x>0.0) { position=markPosition+anchor.yz*size; }
    else { anchor=markAttachment(base,g,false); position=basePosition; if(anchor.x>0.0) { position+=anchor.yz*size; } }
    lastMark=g; markPosition=position;
   } else { base=g; basePosition=position; lastMark=TextGlyph(0u,0u,0u,0u,0u); }
   if(g.code!=9u && g.code!=0x200bu && g.code!=0x200du && g.code!=0xfeffu) { emitGlyph(i,g,position,size,color,clip,order); }
   x+=textAdvance(i,g,next,size,x); j+=g.count; g=next;
  }
  let face=primaryFont(i); let decoration=heap[textStyle(i)+6u];
  if((decoration&1u)!=0u && x>0.0) { box(i,vec4<f32>(origin.x,origin.y+hf(face+8u)*size,x,max(0.5,hf(face+9u)*size)),color,0.0,0.0,clip,order); }
  if((decoration&2u)!=0u && x>0.0) { box(i,vec4<f32>(origin.x,origin.y+hf(face+10u)*size,x,max(0.5,hf(face+11u)*size)),color,0.0,0.0,clip,order); }
  finalCursor=vec2<f32>(p.x+align+x,top);
  if(textLine.next>=len || textLine.next<=start) { break; } start=textLine.next; top+=fontLineHeight(i,size);
 }
 return finalCursor;
}
fn number(i:u32,value:f32,decimal:u32,p:vec2<f32>,size:f32,color:vec4<f32>,clip:vec4<f32>,order:ptr<function,u32>)->f32 {
 var v=u32(round(min(abs(value),99999999.0)*select(1.0,10.0,decimal==1u)));
 var digits:array<u32,16>; var len=0u;
 loop { digits[len]=48u+v%10u; len++; v/=10u; if(v==0u && len>decimal) { break; } if(len==14u) { break; } }
 // Format into a bounded local run, then compile/execute glyph emission once.
 // Sign, decimal point and digits retain the same painter order and advances.
 var codes:array<u32,16>;var count=0u;
 if(value<0.0){codes[count]=45u;count++;}
 for(var j=0u;j<len;j++) {
  if(decimal==1u&&j==len-1u){codes[count]=46u;count++;}
  codes[count]=digits[len-1u-j];count++;
 }
 var x=p.x;let baseline=p.y+textBaseline(i,size);
 for(var j=0u;j<count;j++){
  let g=mapGlyph(i,codes[j]);emitGlyph(i,g,vec2<f32>(x,baseline),size,color,clip,order);x+=glyphWidth(g)*size;
 }
 return x;
}
fn label(i:u32,index:u32,p:vec2<f32>,size:f32,color:vec4<f32>,clip:vec4<f32>,order:ptr<function,u32>)->vec2<f32> {
 let at=heap[state[48]+index]; return drawText(i,at+1u,heap[at],p,size,color,clip,0.0,order);
}
// One header, up to 128 visible rows, and one footer/focus layer. This is the
// same geometry and text code used by serialGrid reference mode, not a lower-detail LOD.
fn emitGridHeader(i:u32,order:ptr<function,u32>) {
 let n=nodes[i]; let r=contentRect(n); let t=n.action.w; let s=cs(i); let clip=n.clip;
 let foreground=decodeColor(n.paint.y); let muted=decodeColor(0xff949090u); let accent=decodeColor(0xffffa7b9u);
 let cellSize=n.misc.z; let headerSize=max(1.0,cellSize-0.5);
 let rowHeight=hf(t+15u); let count=heap[t+10u]; let sy=sf(s+1u); let sx=sf(s+2u);
 let bodyClip=intersection(clip,vec4<f32>(r.x,r.y+42.0,r.x+r.z-11.0,r.y+r.w-26.0));
 box(i,vec4<f32>(r.xy,r.z,42.0),decodeColor(0xff2a2626u),0.0,0.0,clip,order);
 var x=r.x-sx;
 for(var c=0u;c<heap[t+2u];c++) {
  let at=heap[t+9u]+c*8u; let width=hf(at+4u); let cellClip=intersection(clip,vec4<f32>(max(r.x,x),r.y,x+width-2.0,r.y+42.0));
  let headerRun=uiGridRun(i,c,NONE);
  if(headerRun!=0u){_=drawShapedText(i,headerRun,vec2<f32>(x+12.0,r.y+(42.0-hf(pgData(headerRun)+15u))*.5),muted,cellClip,order);}else{
  _=drawText(i,heap[at],heap[at+1u],vec2<f32>(x+12.0,r.y+(42.0-fontLineHeight(i,headerSize))*0.5),headerSize,muted,cellClip,0.0,order);
  }
  if(heap[t+11u]==c) {
   let a=vec2<f32>(x+width-18.0,r.y+20.0); let dy=select(3.0,-3.0,heap[t+12u]==0u);
   line(i,a+vec2<f32>(-3.0,-dy),a+vec2<f32>(0.0,dy),accent,1.1,cellClip,order); line(i,a+vec2<f32>(0.0,dy),a+vec2<f32>(3.0,-dy),accent,1.1,cellClip,order);
  }
  line(i,vec2<f32>(x+width,r.y+12.0),vec2<f32>(x+width,r.y+30.0),decodeColor(0xff3e3a3au),1.0,clip,order); x+=width;
 }
}
fn emitGridRow(i:u32,vr:u32,order:ptr<function,u32>) {
 let n=nodes[i]; let r=contentRect(n); let t=n.action.w; let s=cs(i); let clip=n.clip;
 let foreground=decodeColor(n.paint.y); let muted=decodeColor(0xff949090u); let accent=decodeColor(0xffffa7b9u);
 let cellSize=n.misc.z; let headerSize=max(1.0,cellSize-0.5);
 let rowHeight=hf(t+15u); let count=heap[t+10u]; let sy=sf(s+1u); let sx=sf(s+2u);
 let bodyClip=intersection(clip,vec4<f32>(r.x,r.y+42.0,r.x+r.z-11.0,r.y+r.w-26.0));
  let row=heap[heap[t+4u]+vr]; if(row==NONE) { return; }
  let y=r.y+42.0+f32(vr)*rowHeight-sy;
  var background=decodeColor(select(0xff1c1818u,0xff201c1cu,vr%2u==1u));
  if(row==heap[t+17u]) { background=decodeColor(0xff3a3636u); }
  box(i,vec4<f32>(r.x,y,r.z,rowHeight),background,0.0,0.0,bodyClip,order);
  if(row==heap[t+17u]) { box(i,vec4<f32>(r.x,y,2.0,rowHeight),accent,0.0,0.0,bodyClip,order); }
  var x=r.x-sx;
  for(var c=0u;c<heap[t+2u];c++) {
   let col=heap[t+9u]+c*8u; let width=hf(col+4u); let cellKind=heap[col+2u]; let value=heap[heap[t+3u]+row*8u+c];
   let cellClip=intersection(bodyClip,vec4<f32>(x+5.0,y,x+width-7.0,y+rowHeight)); let p=vec2<f32>(x+12.0,y+(rowHeight-fontLineHeight(i,cellSize))*0.5);
   if(cellKind==0u) {
    let cellRun=uiGridRun(i,c,vr);var end=p;
    if(cellRun!=0u){end=drawShapedText(i,cellRun,vec2<f32>(p.x,y+(rowHeight-hf(pgData(cellRun)+15u))*.5),foreground,cellClip,order);}else{end=drawText(i,value+1u,heap[value],p,cellSize,foreground,cellClip,0.0,order);}
    if(c==0u && heap[t+21u]!=0u) { _=number(i,f32(row+1u),0u,vec2<f32>(max(p.x+91.0,end.x+8.0),p.y),11.0,muted,cellClip,order); }
   } else if(cellKind==4u) {
    let checked=bitcast<f32>(value)>.5;let b=vec4<f32>(x+12.0,y+(rowHeight-16.0)*.5,16.0,16.0);box(i,b,select(muted,accent,checked),3.0,select(1.0,0.0,checked),cellClip,order);
    if(checked){line(i,b.xy+vec2<f32>(3.0,8.0),b.xy+vec2<f32>(6.5,11.5),decodeColor(0xff1b1717u),1.7,cellClip,order);line(i,b.xy+vec2<f32>(6.5,11.5),b.xy+vec2<f32>(13.0,4.0),decodeColor(0xff1b1717u),1.7,cellClip,order);}
   } else if(cellKind==2u) {
    let status=min(2u,u32(max(0.0,bitcast<f32>(value)))); var color=decodeColor(0xffb9d469u); if(status==1u) { color=decodeColor(0xff62bfecu); } if(status==2u) { color=decodeColor(0xffba91c5u); }
    box(i,vec4<f32>(x+10.0,y+(rowHeight-23.0)*0.5,min(width-20.0,78.0),23.0),vec4<f32>(color.rgb,0.10),6.0,0.0,cellClip,order);
    disc(i,vec2<f32>(x+20.0,y+rowHeight*0.5),2.2,color,cellClip,order); _=label(i,status,vec2<f32>(x+28.0,p.y+1.0),11.0,color,cellClip,order);
   } else if(cellKind==3u) {
    let v=clamp(bitcast<f32>(value),0.0,1.0); let w=max(8.0,width-64.0);
    box(i,vec4<f32>(x+12.0,y+rowHeight*0.5-3.0,w,6.0),decodeColor(0xff343030u),3.0,0.0,cellClip,order);
    box(i,vec4<f32>(x+12.0,y+rowHeight*0.5-3.0,w*v,6.0),accent,3.0,0.0,cellClip,order);
    _=number(i,v*100.0,0u,vec2<f32>(x+width-40.0,p.y+1.0),11.0,muted,cellClip,order);
   } else { _=number(i,bitcast<f32>(value),select(0u,1u,c==3u),p,cellSize,foreground,cellClip,order); }
   if(heap[t+18u]!=0u && row==heap[t+17u] && c==heap[t+19u]) {
    box(i,vec4<f32>(x+3.0,y+3.0,width-6.0,rowHeight-6.0),decodeColor(0xff231f1fu),3.0,0.0,cellClip,order);
    box(i,vec4<f32>(x+3.0,y+3.0,width-6.0,rowHeight-6.0),accent,3.0,1.0,cellClip,order);
    _=drawText(i,heap[t+24u],heap[t+25u],p,cellSize,foreground,cellClip,0.0,order);
    let caret=p.x+textCaretX(i,heap[t+24u],heap[t+25u],heap[t+26u],cellSize); line(i,vec2<f32>(caret,p.y),vec2<f32>(caret,p.y+fontLineHeight(i,cellSize)),accent,1.0,cellClip,order);
   }
   x+=width;
  }
}
fn emitGridFooter(i:u32,order:ptr<function,u32>) {
 let n=nodes[i]; let r=contentRect(n); let t=n.action.w; let s=cs(i); let clip=n.clip;
 let foreground=decodeColor(n.paint.y); let muted=decodeColor(0xff949090u); let accent=decodeColor(0xffffa7b9u);
 let cellSize=n.misc.z; let headerSize=max(1.0,cellSize-0.5);
 let rowHeight=hf(t+15u); let count=heap[t+10u]; let sy=sf(s+1u); let sx=sf(s+2u);
 let bodyClip=intersection(clip,vec4<f32>(r.x,r.y+42.0,r.x+r.z-11.0,r.y+r.w-26.0));
 if(count==0u) { _=label(i,6u,vec2<f32>(r.x+26.0,r.y+80.0),15.0,muted,bodyClip,order); }
 let view=max(1.0,r.w-68.0); let full=f32(count)*rowHeight;
 if(full>view) {
  let thumb=max(24.0,view*view/full); let top=r.y+42.0+sy/max(1.0,full-view)*(view-thumb);
  box(i,vec4<f32>(r.x+r.z-8.0,top,4.0,thumb),decodeColor(0xff605c5cu),2.0,0.0,clip,order);
 }
 let footer=vec4<f32>(r.x,r.y+r.w-26.0,r.z,26.0); box(i,footer,decodeColor(0xff262222u),0.0,0.0,clip,order);
 let end=number(i,f32(count),0u,footer.xy+vec2<f32>(12.0,6.0),11.0,foreground,clip,order);
 _=label(i,3u,vec2<f32>(end+7.0,footer.y+6.0),11.0,muted,clip,order);
 if(r.z>470.0) { _=label(i,5u,vec2<f32>(r.x+r.z-300.0,footer.y+6.0),10.0,muted,clip,order); }
 if(state[0]==i) { box(i,r,vec4<f32>(accent.rgb,0.5),2.0,1.0,clip,order); }
 if(state[7]!=0u) { box(i,n.rect,vec4<f32>(accent.rgb,0.35),0.0,0.5,clip,order); }
}
fn emitGridSection(i:u32,section:u32) {
 // Nine high node bits and 23 local-order bits cover the complete node domain.
 // A section reserves 32768 primitive order values. There are 130 sections;
 // Oversize static strings explicitly flag overflow instead of colliding with a neighbor.
 emissionHead=512u+section; emissionRemaining=32768u;
 var order=paintNode(i)*8388608u+(section+1u)*32768u;
 if(section==0u) { emitGridHeader(i,&order); return; }
 if(section==129u) { emitGridFooter(i,&order); return; }
 let n=nodes[i]; let r=contentRect(n); let t=n.action.w;
 let rowHeight=hf(t+15u); let first=u32(max(0.0,floor(sf(cs(i)+1u)/rowHeight)));
 let last=min(heap[t+10u],first+min(128u,u32(ceil(max(0.0,r.w-68.0)/rowHeight))+1u));
 let vr=first+section-1u; if(vr<last) { emitGridRow(i,vr,&order); }
}
@compute @workgroup_size(32)
fn emitGridParts(@builtin(global_invocation_id) id:vec3<u32>) {
 let i=state[25]; if(i==NONE || i>=frame.counts.x || id.x>=130u) { return; }
 let n=nodes[i]; if(n.translation.z<=0.001 || n.rect.z<=0.0 || n.rect.w<=0.0) { return; }
 let serial=(frame.flags.y&1024u)!=0u;if(serial&&id.x!=0u){return;}
 // The diagnostic serial path and normal parallel path share one interpreter.
 for(var section=id.x;section<select(id.x+1u,130u,serial);section++){emitGridSection(i,section);}
}
@compute @workgroup_size(64)
fn emit(@builtin(global_invocation_id) id:vec3<u32>) {
 let i=id.x; if(i>=frame.counts.x) { return; } let n=nodes[i]; if(n.translation.z<=0.001 || n.rect.z<=0.0 || n.rect.w<=0.0) { return; }
 if(templateHasVisual(i)||(n.info.x>=30u&&n.info.x<=35u)){return;}
 let control=templateContentOwner(i);let nativeContent=n.info.x==36u;let renderKind=select(n.info.x,nodes[control].info.x,nativeContent);
 if(renderKind==5u||renderKind==6u||renderKind==7u||renderKind==9u||renderKind==19u||renderKind==21u||renderKind==24u||renderKind==25u){return;}
 emissionHead=i; emissionRemaining=32768u; var order=paintNode(i)*8388608u; let s=cs(control); let r=contentRect(n); let clip=n.clip;
 let foreground=decodeColor(n.paint.y); let accent=decodeColor(0xffffa7b9u); var background=decodeColor(n.paint.x);
 if(state[1]==i && n.info.x==6u && (extension(n)==0u || heap[extension(n)+25u]==0u)) { background=vec4<f32>(min(vec3<f32>(1.0),background.rgb+vec3<f32>(0.025)),background.a); }
 if(n.action.x==8u && u32(bitcast<f32>(n.action.z))==state[8]) { background=decodeColor(0xff422a30u); }
 if(!nativeContent){box(i,n.rect,background,bitcast<f32>(n.paint.w),0.0,clip,&order);}
 dsDrawRootGrid(i,&order);
 if(n.misc.w>0.0 && !nativeContent) { box(i,n.rect,decodeColor(n.paint.z),bitcast<f32>(n.paint.w),n.misc.w,clip,&order); }
 switch renderKind {
case 27u,28u:{emitListChrome(i,&order);}
case 26u:{if(sf(s)>0.5){
   let rect=presenterRect(n); let pixels=vec2<f32>(hf(n.aux.x+2u),hf(n.aux.x+3u));
   let exact=(frame.flags.y&16384u)==0u && hf(n.aux.x)==0.0 && all(n.matrix==vec4<f32>(1.0,0.0,0.0,1.0)) && all(pixels==round(rect.zw*frame.viewport.z));
   addPrimitive(i,5u,rect,vec4<f32>(1.0),vec4<f32>(pixels,f32(frame.counts.z),select(0.0,1.0,exact)),0u,clip,&order);
  }else{_=drawText(i,n.text.z,n.text.w,r.xy+vec2<f32>(24.0),n.misc.z,foreground,clip,r.z-48.0,&order);}}
case 8u: {
   let value=clamp(sf(s),0.0,1.0); let y=r.y+r.w*0.5;
   box(i,vec4<f32>(r.x+8.0,y-2.0,r.z-16.0,4.0),decodeColor(0xff433f3fu),2.0,0.0,clip,&order);
   box(i,vec4<f32>(r.x+8.0,y-2.0,(r.z-16.0)*value,4.0),accent,2.0,0.0,clip,&order);
   disc(i,vec2<f32>(r.x+8.0+(r.z-16.0)*value,y),7.0,foreground,clip,&order);
  }
case 10u: {
   box(i,r,decodeColor(0xff353131u),r.w*0.5,0.0,clip,&order);
   box(i,vec4<f32>(r.xy,r.z*clamp(boundValue(i),0.0,1.0),r.w),foreground,r.w*0.5,0.0,clip,&order);
  }
case 11u: {}
case 12u: {
   let info=n.aux.x; let b=vec4<f32>(hf(info+6u),hf(info+7u),hf(info+8u),hf(info+9u));
   let size=max(vec2<f32>(1.0),b.zw-b.xy); let scale=min(r.z/size.x,r.w/size.y);
   let origin=r.xy+(r.zw-size*scale)*0.5-b.xy*scale;
   addPrimitive(i,2u,vec4<f32>(origin,vec2<f32>(scale)),foreground,vec4<f32>(0.0),info,clip,&order);
  }
default: {}
}
 if(state[7]!=0u && n.info.x!=11u) { box(i,n.rect,vec4<f32>(accent.rgb,0.35),0.0,0.5,clip,&order); }
}

@compute @workgroup_size(64)
fn emitTextBlock(@builtin(global_invocation_id) id:vec3<u32>) {
 let i=id.x; if(i>=frame.counts.x) { return; } let n=nodes[i]; if(n.translation.z<=0.001 || n.rect.z<=0.0 || n.rect.w<=0.0) { return; }
 if(templateHasVisual(i)||(n.info.x>=30u&&n.info.x<=35u)){return;}
 let control=templateContentOwner(i);let nativeContent=n.info.x==36u;let renderKind=select(n.info.x,nodes[control].info.x,nativeContent);
 if(!(renderKind==5u||renderKind==21u)){return;}
 emissionHead=i; emissionRemaining=32768u; var order=paintNode(i)*8388608u; let s=cs(control); let r=contentRect(n); let clip=n.clip;
 let foreground=decodeColor(n.paint.y); let accent=decodeColor(0xffffa7b9u); var background=decodeColor(n.paint.x);
 if(state[1]==i && n.info.x==6u && (extension(n)==0u || heap[extension(n)+25u]==0u)) { background=vec4<f32>(min(vec3<f32>(1.0),background.rgb+vec3<f32>(0.025)),background.a); }
 if(n.action.x==8u && u32(bitcast<f32>(n.action.z))==state[8]) { background=decodeColor(0xff422a30u); }
 if(!nativeContent){box(i,n.rect,background,bitcast<f32>(n.paint.w),0.0,clip,&order);}
 dsDrawRootGrid(i,&order);
 if(n.misc.w>0.0 && !nativeContent) { box(i,n.rect,decodeColor(n.paint.z),bitcast<f32>(n.paint.w),n.misc.w,clip,&order); }
 switch renderKind {
case 5u,21u: {
   let end=drawText(i,n.text.z,textLength(i),r.xy,n.misc.z,foreground,clip,select(0.0,r.z,(n.text.y&4u)!=0u),&order);
   if(n.bind.y!=0u) { _=number(i,metric(n),0u,end,n.misc.z,foreground,clip,&order); }
  }
 default:{}
}
 if(state[7]!=0u && n.info.x!=11u) { box(i,n.rect,vec4<f32>(accent.rgb,0.35),0.0,0.5,clip,&order); }
}

@compute @workgroup_size(64)
fn emitButton(@builtin(global_invocation_id) id:vec3<u32>) {
 let i=id.x; if(i>=frame.counts.x) { return; } let n=nodes[i]; if(n.translation.z<=0.001 || n.rect.z<=0.0 || n.rect.w<=0.0) { return; }
 if(templateHasVisual(i)||(n.info.x>=30u&&n.info.x<=35u)){return;}
 let control=templateContentOwner(i);let nativeContent=n.info.x==36u;let renderKind=select(n.info.x,nodes[control].info.x,nativeContent);
 if(!(renderKind==6u)){return;}
 emissionHead=i; emissionRemaining=32768u; var order=paintNode(i)*8388608u; let s=cs(control); let r=contentRect(n); let clip=n.clip;
 let foreground=decodeColor(n.paint.y); let accent=decodeColor(0xffffa7b9u); var background=decodeColor(n.paint.x);
 if(state[1]==i && n.info.x==6u && (extension(n)==0u || heap[extension(n)+25u]==0u)) { background=vec4<f32>(min(vec3<f32>(1.0),background.rgb+vec3<f32>(0.025)),background.a); }
 if(n.action.x==8u && u32(bitcast<f32>(n.action.z))==state[8]) { background=decodeColor(0xff422a30u); }
 if(!nativeContent){box(i,n.rect,background,bitcast<f32>(n.paint.w),0.0,clip,&order);}
 dsDrawRootGrid(i,&order);
 if(n.misc.w>0.0 && !nativeContent) { box(i,n.rect,decodeColor(n.paint.z),bitcast<f32>(n.paint.w),n.misc.w,clip,&order); }
 switch renderKind {
case 6u: {
   let w=textWidth(i,n.text.z,n.text.w,n.misc.z); _=drawText(i,n.text.z,n.text.w,r.xy+vec2<f32>((r.z-w)*0.5,(r.w-fontLineHeight(i,n.misc.z))*0.5),n.misc.z,foreground,clip,0.0,&order);
   if(state[0]==i) { box(i,n.rect,vec4<f32>(accent.rgb,0.8),max(3.0,bitcast<f32>(n.paint.w)),1.0,clip,&order); }
  }
 default:{}
}
 if(state[7]!=0u && n.info.x!=11u) { box(i,n.rect,vec4<f32>(accent.rgb,0.35),0.0,0.5,clip,&order); }
}

@compute @workgroup_size(64)
fn emitCheckBox(@builtin(global_invocation_id) id:vec3<u32>) {
 let i=id.x; if(i>=frame.counts.x) { return; } let n=nodes[i]; if(n.translation.z<=0.001 || n.rect.z<=0.0 || n.rect.w<=0.0) { return; }
 if(templateHasVisual(i)||(n.info.x>=30u&&n.info.x<=35u)){return;}
 let control=templateContentOwner(i);let nativeContent=n.info.x==36u;let renderKind=select(n.info.x,nodes[control].info.x,nativeContent);
 if(!(renderKind==7u)){return;}
 emissionHead=i; emissionRemaining=32768u; var order=paintNode(i)*8388608u; let s=cs(control); let r=contentRect(n); let clip=n.clip;
 let foreground=decodeColor(n.paint.y); let accent=decodeColor(0xffffa7b9u); var background=decodeColor(n.paint.x);
 if(state[1]==i && n.info.x==6u && (extension(n)==0u || heap[extension(n)+25u]==0u)) { background=vec4<f32>(min(vec3<f32>(1.0),background.rgb+vec3<f32>(0.025)),background.a); }
 if(n.action.x==8u && u32(bitcast<f32>(n.action.z))==state[8]) { background=decodeColor(0xff422a30u); }
 if(!nativeContent){box(i,n.rect,background,bitcast<f32>(n.paint.w),0.0,clip,&order);}
 dsDrawRootGrid(i,&order);
 if(n.misc.w>0.0 && !nativeContent) { box(i,n.rect,decodeColor(n.paint.z),bitcast<f32>(n.paint.w),n.misc.w,clip,&order); }
 switch renderKind {
case 7u: {
   let checked=sf(s)>0.5; let b=vec4<f32>(r.x,r.y+(r.w-18.0)*0.5,18.0,18.0);
   box(i,b,select(decodeColor(0xff393535u),accent,checked),4.0,0.0,clip,&order);
   if(checked) { let ink=decodeColor(0xff221e1eu); line(i,b.xy+vec2<f32>(4.0,9.0),b.xy+vec2<f32>(8.0,13.0),ink,1.6,clip,&order); line(i,b.xy+vec2<f32>(8.0,13.0),b.xy+vec2<f32>(14.0,5.0),ink,1.6,clip,&order); }
   _=drawText(i,n.text.z,n.text.w,vec2<f32>(r.x+29.0,r.y+(r.w-fontLineHeight(i,n.misc.z))*0.5),n.misc.z,foreground,clip,0.0,&order);
  }
 default:{}
}
 if(state[7]!=0u && n.info.x!=11u) { box(i,n.rect,vec4<f32>(accent.rgb,0.35),0.0,0.5,clip,&order); }
}

@compute @workgroup_size(64)
fn emitTextBox(@builtin(global_invocation_id) id:vec3<u32>) {
 let i=id.x; if(i>=frame.counts.x) { return; } let n=nodes[i]; if(n.translation.z<=0.001 || n.rect.z<=0.0 || n.rect.w<=0.0) { return; }
 if(templateHasVisual(i)||(n.info.x>=30u&&n.info.x<=35u)){return;}
 let control=templateContentOwner(i);let nativeContent=n.info.x==36u;let renderKind=select(n.info.x,nodes[control].info.x,nativeContent);
 if(!(renderKind==9u)){return;}
 emissionHead=i; emissionRemaining=32768u; var order=paintNode(i)*8388608u; let s=cs(control); let r=contentRect(n); let clip=n.clip;
 let foreground=decodeColor(n.paint.y); let accent=decodeColor(0xffffa7b9u); var background=decodeColor(n.paint.x);
 if(state[1]==i && n.info.x==6u && (extension(n)==0u || heap[extension(n)+25u]==0u)) { background=vec4<f32>(min(vec3<f32>(1.0),background.rgb+vec3<f32>(0.025)),background.a); }
 if(n.action.x==8u && u32(bitcast<f32>(n.action.z))==state[8]) { background=decodeColor(0xff422a30u); }
 if(!nativeContent){box(i,n.rect,background,bitcast<f32>(n.paint.w),0.0,clip,&order);}
 dsDrawRootGrid(i,&order);
 if(n.misc.w>0.0 && !nativeContent) { box(i,n.rect,decodeColor(n.paint.z),bitcast<f32>(n.paint.w),n.misc.w,clip,&order); }
 switch renderKind {
case 9u: {
   let inner=intersection(clip,vec4<f32>(r.x+11.0,r.y+3.0,r.x+r.z-11.0,r.y+r.w-3.0)); let size=n.misc.z; let len=state[s+4u];
   let caretWidth=textCaretX(i,n.text.z,len,state[s+5u],size); var scroll=sf(s+2u);
   if(caretWidth-scroll>r.z-28.0) { scroll=caretWidth-r.z+28.0; } if(caretWidth-scroll<0.0) { scroll=caretWidth; } setf(s+2u,max(0.0,scroll));
   let start=vec2<f32>(r.x+12.0-scroll,r.y+(r.w-fontLineHeight(i,size))*0.5);
   if(state[s+4u]==0u && state[0]!=control) { _=label(i,7u,start,size,decodeColor(0xff7f7b7bu),inner,&order); }
   if(state[0]==control) {
    let lo=min(state[s+5u],state[s+6u]); let hi=max(state[s+5u],state[s+6u]);
    if(lo<hi) {
     let shaped=uiTextRun(i,n.text.z,len);
     if(shaped!=0u&&heap[pgData(shaped)+17u]!=0u){drawShapedSelection(i,shaped,lo,hi,start,vec4<f32>(accent.rgb,0.2),inner,&order);}else{
     var x0=caretWidth; var x1=caretWidth;
     if(lo!=state[s+5u]) { x0=textCaretX(i,n.text.z,len,lo,size); }
     if(hi!=state[s+5u]) { x1=textCaretX(i,n.text.z,len,hi,size); }
     box(i,vec4<f32>(start.x+x0,start.y,x1-x0,fontLineHeight(i,size)),vec4<f32>(accent.rgb,0.2),0.0,0.0,inner,&order);}
    }
   }
   _=drawText(i,n.text.z,state[s+4u],start,size,foreground,inner,0.0,&order);
   if(state[0]==control && fract((frame.viewport.w-sf(41u))*0.9)<0.6) { line(i,vec2<f32>(start.x+caretWidth,start.y),vec2<f32>(start.x+caretWidth,start.y+fontLineHeight(i,size)),accent,1.0,inner,&order); }
   if(state[0]==control && !nativeContent) { box(i,n.rect,accent,max(3.0,bitcast<f32>(n.paint.w)),1.0,clip,&order); }
  }
 default:{}
}
 if(state[7]!=0u && n.info.x!=11u) { box(i,n.rect,vec4<f32>(accent.rgb,0.35),0.0,0.5,clip,&order); }
}

@compute @workgroup_size(64)
fn emitDrawingNode(@builtin(global_invocation_id) id:vec3<u32>) {
 let i=id.x; if(i>=frame.counts.x) { return; } let n=nodes[i]; if(n.translation.z<=0.001 || n.rect.z<=0.0 || n.rect.w<=0.0) { return; }
 if(templateHasVisual(i)||(n.info.x>=30u&&n.info.x<=35u)){return;}
 let control=templateContentOwner(i);let nativeContent=n.info.x==36u;let renderKind=select(n.info.x,nodes[control].info.x,nativeContent);
 if(!(renderKind==19u)){return;}
 emissionHead=i; emissionRemaining=32768u; var order=paintNode(i)*8388608u; let s=cs(control); let r=contentRect(n); let clip=n.clip;
 let foreground=decodeColor(n.paint.y); let accent=decodeColor(0xffffa7b9u); var background=decodeColor(n.paint.x);
 if(state[1]==i && n.info.x==6u && (extension(n)==0u || heap[extension(n)+25u]==0u)) { background=vec4<f32>(min(vec3<f32>(1.0),background.rgb+vec3<f32>(0.025)),background.a); }
 if(n.action.x==8u && u32(bitcast<f32>(n.action.z))==state[8]) { background=decodeColor(0xff422a30u); }
 if(!nativeContent){box(i,n.rect,background,bitcast<f32>(n.paint.w),0.0,clip,&order);}
 dsDrawRootGrid(i,&order);
 if(n.misc.w>0.0 && !nativeContent) { box(i,n.rect,decodeColor(n.paint.z),bitcast<f32>(n.paint.w),n.misc.w,clip,&order); }
 switch renderKind {
case 19u: {emitDrawing(i,&order);}
 default:{}
}
 if(state[7]!=0u && n.info.x!=11u) { box(i,n.rect,vec4<f32>(accent.rgb,0.35),0.0,0.5,clip,&order); }
}

@compute @workgroup_size(64)
fn emitDockNode(@builtin(global_invocation_id) id:vec3<u32>) {
 let i=id.x; if(i>=frame.counts.x) { return; } let n=nodes[i]; if(n.translation.z<=0.001 || n.rect.z<=0.0 || n.rect.w<=0.0) { return; }
 if(templateHasVisual(i)||(n.info.x>=30u&&n.info.x<=35u)){return;}
 let control=templateContentOwner(i);let nativeContent=n.info.x==36u;let renderKind=select(n.info.x,nodes[control].info.x,nativeContent);
 if(!(renderKind==24u||renderKind==25u)){return;}
 emissionHead=i; emissionRemaining=32768u; var order=paintNode(i)*8388608u; let s=cs(control); let r=contentRect(n); let clip=n.clip;
 let foreground=decodeColor(n.paint.y); let accent=decodeColor(0xffffa7b9u); var background=decodeColor(n.paint.x);
 if(state[1]==i && n.info.x==6u && (extension(n)==0u || heap[extension(n)+25u]==0u)) { background=vec4<f32>(min(vec3<f32>(1.0),background.rgb+vec3<f32>(0.025)),background.a); }
 if(n.action.x==8u && u32(bitcast<f32>(n.action.z))==state[8]) { background=decodeColor(0xff422a30u); }
 if(!nativeContent){box(i,n.rect,background,bitcast<f32>(n.paint.w),0.0,clip,&order);}
 dsDrawRootGrid(i,&order);
 if(n.misc.w>0.0 && !nativeContent) { box(i,n.rect,decodeColor(n.paint.z),bitcast<f32>(n.paint.w),n.misc.w,clip,&order); }
 switch renderKind {
case 24u:{emitDockWorkspace(i,&order);}
case 25u:{emitDockItem(i,&order);}
 default:{}
}
 if(state[7]!=0u && n.info.x!=11u) { box(i,n.rect,vec4<f32>(accent.rgb,0.35),0.0,0.5,clip,&order); }
}


// DrawingContext is a retained, bounded command stream, not a CPU raster callback.
fn drawingMatrix(a:vec4<f32>,b:vec4<f32>)->vec4<f32> {return vec4<f32>(a.x*b.x+a.z*b.y,a.y*b.x+a.w*b.y,a.x*b.z+a.z*b.w,a.y*b.z+a.w*b.w);}
fn emitDrawing(i:u32,order:ptr<function,u32>) {
 let n=nodes[i];let d=n.aux.x;let count=heap[d+1u];let base=heap[d];let origin=contentRect(n).xy;
 var matrices:array<vec4<f32>,32>;var translations:array<vec2<f32>,32>;var clips:array<vec4<f32>,32>;var opacities:array<f32,32>;
 var clipLinks:array<u32,32>;
 var depth=0u;drawingActive=true;drawingClip=0u;drawingLocal=vec4<f32>(1.0,0.0,0.0,1.0);drawingOffset=vec2<f32>(0.0);drawingAlpha=1.0;var clip=n.clip;
 for(var j=0u;j<count;j++){let at=base+j*24u;let op=heap[at];
  if(op==1u||op==2u||op==7u){drawingBrush=heap[at+2u];if(drawingBrush==0u){continue;}
   if(op==1u){addPrimitive(i,2u,vec4<f32>(0.0,0.0,1.0,1.0),vec4<f32>(1.0),vec4<f32>(0.0),heap[at+1u],clip,order);}
   else if(op==7u){let face=primaryFont(i);var cursor=vec2<f32>(hf(at+8u),hf(at+9u));for(var k=0u;k<heap[at+6u];k++){let g=heap[at+5u]+k*4u;emitGlyph(i,TextGlyph(face,heap[g],1u,1u,0u),cursor+vec2<f32>(hf(g+2u),hf(g+3u)),hf(at+7u),vec4<f32>(1.0),clip,order);cursor.x+=hf(g+1u);}}
   else{_=drawText(i,heap[at+5u],heap[at+6u],vec2<f32>(hf(at+8u),hf(at+9u)),hf(at+7u),vec4<f32>(1.0),clip,0.0,order);}
  }else if(op>=3u&&op<=5u){if(depth>=32u){overflow(128u);break;}matrices[depth]=drawingLocal;translations[depth]=drawingOffset;clips[depth]=clip;opacities[depth]=drawingAlpha;clipLinks[depth]=drawingClip;depth++;
   if(op==3u){let m=vec4<f32>(hf(at+8u),hf(at+9u),hf(at+10u),hf(at+11u));drawingOffset=transform(drawingLocal,drawingOffset,vec2<f32>(hf(at+12u),hf(at+13u)));drawingLocal=drawingMatrix(drawingLocal,m);}
   if(op==4u){let m=drawingMatrix(n.matrix,drawingLocal);let t=transform(n.matrix,n.translation.xy,origin+drawingOffset);let rect=vec4<f32>(hf(at+8u),hf(at+9u),hf(at+10u),hf(at+11u));clip=intersection(clip,transformedBounds(m,t,boundsOf(rect)));let link=heap[at+1u];heap[link]=drawingClip;
 for(var k=0u;k<4u;k++){hsetf(link+1u+k,rect[k]);hsetf(link+5u+k,m[k]*frame.viewport.z);}hsetf(link+9u,t.x*frame.viewport.z);hsetf(link+10u,t.y*frame.viewport.z);drawingClip=link;}
   if(op==5u){drawingAlpha*=hf(at+8u);}
  }else if(op==6u){if(depth==0u){overflow(128u);break;}depth--;drawingLocal=matrices[depth];drawingOffset=translations[depth];clip=clips[depth];drawingAlpha=opacities[depth];drawingClip=clipLinks[depth];}
 }
 drawingActive=false;drawingClip=0u;drawingBrush=0u;drawingAlpha=1.0;
}
