// Retained paragraph layout shared by the standalone module and Helion controls.
// Offsets, line records, visual order and dual-affinity caret coordinates remain on-device.
// Word opportunities are intentionally a documented subset of UAX #14; grapheme
// boundaries and resolved bidi levels come from the preceding shaping pass.
fn pgData(r:u32)->u32{return heap[r+50u];}
fn pgLine(p:u32,i:u32)->u32{return heap[p+9u]+i*12u;}
fn pgPosition(p:u32,i:u32)->u32{return heap[p+10u]+i*4u;}
fn pgHard(cp:u32)->bool{return cp==10u||cp==13u||cp==0x2028u||cp==0x2029u;}
fn pgSpace(cp:u32)->bool{return cp==32u||cp==9u||cp==0x200bu;}
fn pgCJK(cp:u32)->bool{return (cp>=0x2e80u&&cp<=0x9fffu)||(cp>=0xac00u&&cp<=0xd7afu)||(cp>=0x20000u&&cp<=0x323afu);}
fn pgBreakAfter(cp:u32,next:u32)->bool{
 if(cp==0xa0u||next==0xa0u||cp==0x202fu||next==0x202fu||cp==0x2060u||next==0x2060u){return false;}
 if(pgSpace(cp)||cp==45u||cp==0x2010u){return true;}
 // Do not put common CJK closing punctuation at the beginning of a line.
 if(next==0x3001u||next==0x3002u||next==0xff0cu||next==0xff0eu||next==0x3009u||next==0x300bu||next==0x300du||next==0x300fu||next==0x3011u){return false;}
 if(cp==0x3008u||cp==0x300au||cp==0x300cu||cp==0x300eu||cp==0x3010u){return false;}
 return pgCJK(cp)&&pgCJK(next);
}
fn pgClusterEnd(r:u32,start:u32)->u32{
 let n=heap[r+7u];if(start>=n){return n;}let g=shGlyph(r,start);var end=start+1u;
 while(end<n){let h=shGlyph(r,end);if(heap[h+1u]!=heap[g+1u]||heap[h+2u]!=heap[g+2u]){break;}end++;}return end;
}
fn pgTabSized(r:u32,p:u32,g:u32,pen:f32,size:f32)->f32{
 let face=shFace(r,heap[g+4u]);let space=shMap(face,32u);var em=0.5;
 if(space>0u){em=hf(heap[face+4u]+(space-1u)*4u+1u);}let stop=max(0.001,em*size*f32(heap[p+18u]));
 return (floor(pen/stop)+1.0)*stop-pen;
}
fn pgTab(r:u32,p:u32,g:u32,pen:f32)->f32{return pgTabSized(r,p,g,pen,hf(p+1u));}
fn pgClusterWidthSized(r:u32,p:u32,start:u32,end:u32,pen:f32,size:f32)->f32{
 var width=0.0;var ink=false;
 for(var k=start;k<end;k++){let g=shGlyph(r,k);if(heap[g+3u]==9u){width+=pgTabSized(r,p,g,pen+width,size);ink=true;}else{width+=hf(g+8u)*size;if((heap[g+19u]&1u)==0u){ink=true;}}}
 if(ink){width+=hf(p+3u);}return max(0.0,width);
}
fn pgClusterWidth(r:u32,p:u32,start:u32,end:u32,pen:f32)->f32{return pgClusterWidthSized(r,p,start,end,pen,hf(p+1u));}
// end, next: glyph indexes. A hard-break cluster is consumed but not drawn.
fn pgEnd(r:u32,p:u32,start:u32)->vec2<u32>{
 let n=heap[r+7u];let width=hf(p);var pen=0.0;var at=start;var lastBreak=start;
 while(at<n){let end=pgClusterEnd(r,at);let g=shGlyph(r,at);if(pgHard(heap[g+3u])){return vec2<u32>(at,end);}
  let advance=pgClusterWidth(r,p,at,end,pen);
  if(heap[p+5u]!=0u&&width>0.0&&at>start&&pen+advance>width){if(heap[p+5u]==1u&&lastBreak>start){return vec2<u32>(lastBreak,lastBreak);}return vec2<u32>(at,at);}
  pen+=advance;var next=0u;if(end<n){next=heap[shGlyph(r,end)+3u];}if(pgBreakAfter(heap[shGlyph(r,end-1u)+3u],next)){lastBreak=end;}at=end;
 }return vec2<u32>(n,n);
}
fn pgBase(r:u32,start:u32)->u32{
 if(heap[r+17u]!=0u){return heap[r+17u]-1u;}var a=start;while(a>0u&&!pgHard(heap[shGlyph(r,a-1u)+3u])){a--;}
 var b=start;while(b<heap[r+7u]&&!pgHard(heap[shGlyph(r,b)+3u])){b++;}return shBidiBase(r,a,b,0u);
}
fn pgLevel(r:u32,i:u32,trim:u32,base:u32)->u32{if(i>=trim){return base;}return heap[shGlyph(r,i)+6u];}
fn pgArrangeLine(r:u32,p:u32,start:u32,end:u32,lineIndex:u32,top:f32)->f32{
 let order=heap[p+11u];let line=pgLine(p,lineIndex);let base=pgBase(r,start);
 var trim=end;while(trim>start){let cp=heap[shGlyph(r,trim-1u)+3u];let bt=shBidiOriginal(r,trim-1u);if(!pgSpace(cp)&&!shBidiReset(bt)){break;}trim--;}
 var maxLevel=base;var minOdd=126u;var ascent=0.0;var descent=0.0;var gap=0.0;
 for(var j=start;j<end;j++){heap[order+j]=j;let level=pgLevel(r,j,trim,base);maxLevel=max(maxLevel,level);if((level&1u)!=0u){minOdd=min(minOdd,level);}let face=shFace(r,heap[shGlyph(r,j)+4u]);ascent=max(ascent,hf(face));descent=max(descent,hf(face+1u));gap=max(gap,hf(face+2u));}
 if(start==end){let face=shFace(r,0u);ascent=hf(face);descent=hf(face+1u);gap=hf(face+2u);}
 let size=hf(p+1u);let natural=(ascent+descent+gap)*size;var height=hf(p+2u);if(height<=0.0){height=max(0.001,natural);}let baseline=top+(height-(ascent+descent)*size)*0.5+ascent*size;
 var level=maxLevel;while(level>=minOdd&&level>0u){var j=start;while(j<end){if(pgLevel(r,heap[order+j],trim,base)<level){j++;continue;}let a=j;while(j<end&&pgLevel(r,heap[order+j],trim,base)>=level){j++;}var x=a;var y=j;while(x<y){y--;if(x>=y){break;}let swap=heap[order+x];heap[order+x]=heap[order+y];heap[order+y]=swap;x++;}}level--;}
 var pen=0.0;var cursor=start;
 // Place a complete visual cluster before adding letter spacing. Signed mark
 // advances remain intact; clamping each glyph independently corrupts GPOS.
 while(cursor<end){let first=shGlyph(r,heap[order+cursor]);var stop=cursor+1u;
  while(stop<end){let other=shGlyph(r,heap[order+stop]);if(heap[other+1u]!=heap[first+1u]||heap[other+2u]!=heap[first+2u]){break;}stop++;}
  let origin=pen;var ink=false;
  for(var j=cursor;j<stop;j++){let logical=heap[order+j];let g=shGlyph(r,logical);let q=pgPosition(p,logical);var advance=hf(g+8u)*size;
   if(heap[g+3u]==9u){advance=pgTab(r,p,g,pen);ink=true;}else if((heap[g+19u]&1u)==0u){ink=true;}
   hsetf(q,pen+hf(g+10u)*size);hsetf(q+1u,baseline+hf(g+11u)*size);hsetf(q+2u,advance);heap[q+3u]=lineIndex;pen+=advance;
  }
  let raw=pen-origin;let total=max(0.0,raw+select(0.0,hf(p+3u),ink));let last=pgPosition(p,heap[order+stop-1u]);hsetf(last+2u,hf(last+2u)+total-raw);pen=origin+total;cursor=stop;
 }
 var alignment=heap[p+4u];if(alignment==3u){alignment=select(0u,2u,base==1u);}if(alignment==4u){alignment=select(2u,0u,base==1u);}
 let spare=max(0.0,hf(p)-pen);var shift=0.0;if(alignment==1u){shift=spare*0.5;}if(alignment==2u){shift=spare;}
 for(var j=start;j<end;j++){let q=pgPosition(p,j);hsetf(q,hf(q)+shift);}
 heap[line]=start;heap[line+1u]=end;heap[line+2u]=heap[r+3u];heap[line+3u]=heap[r+3u];if(start<heap[r+7u]){heap[line+2u]=heap[shGlyph(r,start)+1u];heap[line+3u]=heap[line+2u];}if(end>start){heap[line+3u]=heap[shGlyph(r,end-1u)+2u];}
 heap[line+4u]=base;hsetf(line+5u,shift);hsetf(line+6u,pen);hsetf(line+7u,top);hsetf(line+8u,baseline);hsetf(line+9u,height);hsetf(line+10u,ascent*size);hsetf(line+11u,descent*size);
 hsetf(p+14u,max(hf(p+14u),pen));return height;
}
fn pgSetCaret(p:u32,scalar:u32,affinity:u32,x:f32,y:f32){let at=heap[p+12u]+scalar*4u+affinity*2u;hsetf(at,x);hsetf(at+1u,y);}
fn pgCarets(r:u32,p:u32){
 let n=heap[r+7u];let size=hf(p+1u);var at=0u;
 while(at<n){let end=pgClusterEnd(r,at);let first=shGlyph(r,at);let lo=heap[first+1u];let hi=heap[first+2u];let pos=pgPosition(p,at);let lineIndex=heap[pos+3u];
  if(lineIndex==0xffffffffu){at=end;continue;}let line=pgLine(p,lineIndex);var x0=hf(pos)-hf(first+10u)*size;var x1=x0+hf(pos+2u);
  for(var j=at+1u;j<end;j++){let g=shGlyph(r,j);let q=pgPosition(p,j);let x=hf(q)-hf(g+10u)*size;x0=min(x0,x);x1=max(x1,x+hf(q+2u));}
  let rtl=(heap[first+6u]&1u)!=0u;var parts=0u;for(var c=lo;c<hi;c++){parts+=heap[heap[r+21u]+c];}parts=max(1u,parts);var k=0u;
  for(var c=lo;c<=hi;c++){if(heap[heap[r+21u]+c]==0u){continue;}var delta=shCaretCoordinate(r,first,k,parts,max(0.0,x1-x0)/size)*size;if(c==lo){delta=0.0;}if(c==hi){delta=x1-x0;}let x=select(x0+delta,x1-delta,rtl);
   if(c<hi){pgSetCaret(p,c,0u,x,hf(line+7u));}if(c>lo){pgSetCaret(p,c,1u,x,hf(line+7u));}k++;
  }at=end;
 }
 // Empty lines and newline clusters retain valid caret positions too.
 for(var j=0u;j<heap[p+13u];j++){let line=pgLine(p,j);let start=heap[line+2u];let end=heap[line+3u];let shift=hf(line+5u);let width=hf(line+6u);let top=hf(line+7u);let rtl=heap[line+4u]==1u;
  let leading=select(shift,shift+width,rtl);let trailing=select(shift+width,shift,rtl);
  if(heap[heap[p+12u]+start*4u]==0x7fc00000u){pgSetCaret(p,start,0u,leading,top);}if(heap[heap[p+12u]+end*4u+2u]==0x7fc00000u){pgSetCaret(p,end,1u,trailing,top);}
 }
 var lastX=0.0;var lastY=0.0;
 for(var c=0u;c<=heap[r+3u];c++){let q=heap[p+12u]+c*4u;if(heap[q]==0x7fc00000u&&heap[q+2u]!=0x7fc00000u){heap[q]=heap[q+2u];heap[q+1u]=heap[q+3u];}if(heap[q+2u]==0x7fc00000u&&heap[q]!=0x7fc00000u){heap[q+2u]=heap[q];heap[q+3u]=heap[q+1u];}
  if(heap[q]==0x7fc00000u){hsetf(q,lastX);hsetf(q+1u,lastY);hsetf(q+2u,lastX);hsetf(q+3u,lastY);}else{lastX=hf(q);lastY=hf(q+1u);}
 }
}
fn layoutRun(r:u32){
 let p=pgData(r);if(p==0u){return;}if(heap[p+6u]==heap[p+7u]&&heap[p+8u]==heap[r+19u]&&heap[p+17u]==heap[r+47u]){return;}
 heap[p+17u]=0u;heap[p+13u]=0u;hsetf(p+14u,0.0);hsetf(p+15u,0.0);heap[p+7u]=heap[p+6u];heap[p+8u]=heap[r+19u];if(heap[r+47u]==0u){return;}
 let count=heap[r+3u];let n=heap[r+7u];for(var c=0u;c<=(count*4u+3u);c++){heap[heap[p+12u]+c]=0x7fc00000u;}
 for(var j=0u;j<n;j++){let q=pgPosition(p,j);hsetf(q,0.0);hsetf(q+1u,0.0);hsetf(q+2u,0.0);heap[q+3u]=0xffffffffu;}
 var at=0u;var lines=0u;var top=0.0;
 loop{let range=pgEnd(r,p,at);let height=pgArrangeLine(r,p,at,range.x,lines,top);lines++;top+=height;
  if(range.y>=n){if(range.y>range.x){top+=pgArrangeLine(r,p,n,n,lines,top);lines++;}break;}
  if(range.y<=at){break;}at=range.y;
 }
 heap[p+13u]=lines;hsetf(p+15u,top);heap[p+16u]=n;pgCarets(r,p);heap[p+17u]=1u;
}
// Pixel coordinates relative to the paragraph's top-left. Returns scalar, affinity.
fn paragraphHit(r:u32,x:f32,y:f32)->vec2<u32>{
 let p=pgData(r);if(p==0u||heap[p+17u]==0u){return vec2<u32>(0u);}var best=vec2<u32>(0u);var distance=1e30;
 // Hit the containing line, not whichever baseline/top is nearest. A click in
 // the lower half of a line must not move the caret to the following line.
 var lineIndex=0u;while(lineIndex+1u<heap[p+13u]){let ln=pgLine(p,lineIndex);if(y<hf(ln+7u)+hf(ln+9u)){break;}lineIndex++;}
 let lineTop=hf(pgLine(p,lineIndex)+7u);
 for(var c=0u;c<=heap[r+3u];c++){if(heap[heap[r+21u]+c]==0u){continue;}for(var affinity=0u;affinity<2u;affinity++){let q=heap[p+12u]+c*4u+affinity*2u;let dx=abs(hf(q)-x);let dy=abs(hf(q+1u)-lineTop);let d=dy*100000.0+dx;if(d<distance){distance=d;best=vec2<u32>(c,affinity);}}}return best;
}
