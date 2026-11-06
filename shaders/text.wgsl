// GPU-resident static OpenType plans. Glyph coordinates and advances are normalized to ems.
// This is the explicitly bounded Latin/Greek/Cyrillic shaping path, not a HarfBuzz port.
struct TextGlyph { face:u32, gid:u32, count:u32, script:u32, code:u32 }
struct TextLine { end:u32, next:u32, width:f32 }
fn textStyle(i:u32)->u32 { return nodes[i].aux.w; }
fn primaryFont(i:u32)->u32 { return heap[heap[textStyle(i)+1u]]; }
fn fontAscent(i:u32,size:f32)->f32 { let r=uiTextRun(i,nodes[i].text.z,textLength(i));if(r!=0u&&heap[r+47u]!=0u){return hf(r+34u)*size;}return hf(primaryFont(i))*size; }
fn fontDescent(i:u32,size:f32)->f32 { let r=uiTextRun(i,nodes[i].text.z,textLength(i));if(r!=0u&&heap[r+47u]!=0u){return hf(r+35u)*size;}return hf(primaryFont(i)+1u)*size; }
fn fontLineHeight(i:u32,size:f32)->f32 {
 let customHeight=hf(textStyle(i)+4u); if(customHeight>0.0) { return customHeight; }
 let r=uiTextRun(i,nodes[i].text.z,textLength(i));if(r!=0u&&heap[r+47u]!=0u){return (hf(r+34u)+hf(r+35u)+hf(r+51u))*size;}
 let face=primaryFont(i); return (hf(face)+hf(face+1u)+hf(face+2u))*size;
}
fn textBaseline(i:u32,size:f32)->f32 {
 // Resolve the retained run once. Calling the three metric helpers here clones
 // the directory walk four times at every native glyph-emission call site.
 let face=primaryFont(i);var ascent=hf(face)*size;var descent=hf(face+1u)*size;
 var height=(hf(face)+hf(face+1u)+hf(face+2u))*size;
 let r=uiTextRun(i,nodes[i].text.z,textLength(i));
 if(r!=0u&&heap[r+47u]!=0u){ascent=hf(r+34u)*size;descent=hf(r+35u)*size;height=(hf(r+34u)+hf(r+35u)+hf(r+51u))*size;}
 let customHeight=hf(textStyle(i)+4u);if(customHeight>0.0){height=customHeight;}
 return (height-ascent-descent)*0.5+ascent;
}
fn fontMap(face:u32,code:u32)->u32 {
 if(code>0x10ffffu || (code>=0xd800u && code<=0xdfffu)) { return 0u; }
 let page=heap[heap[face+5u]+(code>>8u)]; if(page==0u) { return 0u; } return heap[page+(code&255u)];
}
fn scriptIndex(code:u32)->u32 {
 if((code>=0x370u && code<=0x3ffu) || (code>=0x1f00u && code<=0x1fffu)) { return 2u; }
 if((code>=0x400u && code<=0x52fu) || (code>=0x2de0u && code<=0x2dffu) || (code>=0xa640u && code<=0xa69fu)) { return 3u; }
 return 1u;
}
fn mapGlyph(i:u32,code:u32)->TextGlyph {
 let style=textStyle(i); let count=heap[style]; let faces=heap[style+1u];
 for(var f=0u;f<count;f++) { let face=heap[faces+f]; let gid=fontMap(face,code); if(gid!=0u) { return TextGlyph(face,gid-1u,1u,scriptIndex(code),code); } }
 let face=primaryFont(i); return TextGlyph(face,heap[face+7u],1u,scriptIndex(code),code);
}
fn glyphResource(g:TextGlyph)->u32 { return heap[heap[g.face+4u]+g.gid*4u]; }
fn glyphWidth(g:TextGlyph)->f32 { return hf(heap[g.face+4u]+g.gid*4u+1u); }
fn isCombining(code:u32)->bool {
 if(code<0x300u) { return false; }
 var lo=0u; var hi=state[57];
 while(lo<hi) { let mid=(lo+hi)/2u; let at=state[56]+mid*2u; if(code<heap[at]) { hi=mid; } else if(code>heap[at+1u]) { lo=mid+1u; } else { return true; } }
 return false;
}
fn composeCode(base:u32,mark:u32)->u32 {
 var lo=0u; var hi=state[55];
 while(lo<hi) { let mid=(lo+hi)/2u; let at=state[54]+mid*3u; let a=heap[at]; let b=heap[at+1u];
  if(a<base || (a==base && b<mark)) { lo=mid+1u; } else { hi=mid; }
 }
 if(lo<state[55]) { let at=state[54]+lo*3u; if(heap[at]==base && heap[at+1u]==mark) { return heap[at+2u]; } } return 0u;
}
fn textGlyph(i:u32,offset:u32,count:u32,start:u32)->TextGlyph {
 if(start>=count) { return TextGlyph(0u,0u,0u,0u,0u); }
 var code=heap[offset+start]; var n=1u; var mapped=mapGlyph(i,code);
 // Canonical compositions present in the loaded repertoire consume their complete source cluster.
 for(var k=1u;k<8u && start+k<count;k++) {
  let mark=heap[offset+start+k]; if(!isCombining(mark)) { break; } let composed=composeCode(code,mark); if(composed==0u) { break; }
  let c=mapGlyph(i,composed); if(fontMap(c.face,composed)==0u) { break; } mapped=c; code=composed; n=k+1u;
 }
 mapped.count=n;
 if(n!=1u || isCombining(code) || (heap[textStyle(i)+2u]&2u)==0u) { return mapped; }
 let plan=heap[mapped.face+6u]+mapped.script*4u; let index=heap[plan+1u]+mapped.gid*2u; let records=heap[index]; let num=heap[index+1u];
 for(var k=0u;k<num;k++) { let at=records+k*12u; let length=heap[at+1u]; if(start+length>count) { continue; }
  var matches=true; for(var j=1u;j<length;j++) { let other=mapGlyph(i,heap[offset+start+j]); if(other.face!=mapped.face || other.gid!=heap[at+2u+j]) { matches=false; break; } }
  if(matches) { mapped.gid=heap[at]; mapped.count=length; return mapped; }
 }
 return mapped;
}
fn pairValue(descriptor:u32,left:u32,right:u32)->vec2<f32> {
 if(heap[descriptor]==2u) {
  let c1=heap[heap[descriptor+1u]+left]; if(c1==0u) { return vec2<f32>(0.0); }
  let c2=heap[heap[descriptor+2u]+right]; return vec2<f32>(1.0,hf(heap[descriptor+4u]+(c1-1u)*heap[descriptor+3u]+c2));
 }
 let index=heap[descriptor+1u]+left*2u; let base=heap[index]; let count=heap[index+1u]; var lo=0u; var hi=count;
 while(lo<hi) { let mid=(lo+hi)/2u; if(heap[base+mid*2u]<right) { lo=mid+1u; } else { hi=mid; } }
 if(lo<count && heap[base+lo*2u]==right) { return vec2<f32>(1.0,hf(base+lo*2u+1u)); } return vec2<f32>(0.0);
}
fn kerning(i:u32,left:TextGlyph,right:TextGlyph)->f32 {
 if(left.face==0u || right.face!=left.face || (heap[textStyle(i)+2u]&1u)==0u) { return 0.0; }
 let plan=heap[left.face+6u]+left.script*4u; let groups=heap[plan]; var adjustment=0.0;
 for(var k=0u;k<heap[groups];k++) { let group=heap[groups+1u+k]; for(var j=0u;j<heap[group];j++) { let value=pairValue(heap[group+1u+j],left.gid,right.gid); if(value.x>0.0) { adjustment+=value.y; break; } } }
 return adjustment;
}
fn glyphAdvance(i:u32,code:u32,size:f32)->f32 { return glyphWidth(mapGlyph(i,code))*size; }
fn textAdvance(i:u32,g:TextGlyph,next:TextGlyph,size:f32,x:f32)->f32 {
 if(g.code==9u) { let stop=max(1.0,glyphAdvance(i,32u,size)*4.0); return (floor(x/stop)+1.0)*stop-x; }
 if(isCombining(g.code) || g.code==0x200bu || g.code==0x200du || g.code==0xfeffu) { return 0.0; }
 return max(0.0,(glyphWidth(g)+kerning(i,g,next))*size+hf(textStyle(i)+3u));
}
fn textWidth(i:u32,offset:u32,count:u32,size:f32)->f32 {
 let shaped=uiTextRun(i,offset,count);if(shaped!=0u&&heap[shaped+47u]!=0u){return uiTextWidth(shaped,size);}
 var x=0.0; var j=0u; var g=textGlyph(i,offset,count,0u);
 while(j<count) { if(g.code==10u || g.code==13u) { break; } let next=textGlyph(i,offset,count,j+g.count); x+=textAdvance(i,g,next,size,x); j+=g.count; g=next; }
 return x;
}
// Prefixes retain full-string context, including kerning and a ligature crossing the caret.
fn textCaretX(i:u32,offset:u32,count:u32,caret:u32,size:f32)->f32 {
 let shaped=uiTextRun(i,offset,count);if(shaped!=0u&&heap[pgData(shaped)+17u]!=0u){return uiCaretAffinity(shaped,caret,size,state[cs(templateContentOwner(i))+7u]);}
 var x=0.0; var j=0u;
 while(j<count && j<caret) { let g=textGlyph(i,offset,count,j); let next=textGlyph(i,offset,count,j+g.count); let advance=textAdvance(i,g,next,size,x);
  if(caret<j+g.count) {
   if(g.count>1u && isCombining(heap[offset+j+1u])) { return x; }
   var sum=0.0; var before=0.0; for(var k=0u;k<g.count;k++) { let a=glyphAdvance(i,heap[offset+j+k],size); sum+=a; if(j+k<caret) { before+=a; } }
   return x+advance*select(0.0,before/max(sum,0.00001),sum>0.0);
  }
  x+=advance; j+=g.count;
 }
 return x;
}
fn previousTextCluster(offset:u32,count:u32,caret:u32)->u32 {
 if(heap[2]!=0u){return ucPrevious(heap[2],offset,count,caret,count,count);}
 var p=min(caret,count); if(p==0u) { return 0u; } p--;
 while(p>0u && isCombining(heap[offset+p])) { p--; } return p;
}
fn nextTextCluster(offset:u32,count:u32,caret:u32)->u32 {
 if(heap[2]!=0u){return ucNext(heap[2],offset,count,caret,count,count);}
 var p=min(count,caret+1u); while(p<count && isCombining(heap[offset+p])) { p++; } return p;
}
fn textHit(i:u32,offset:u32,count:u32,size:f32,x:f32)->u32 {
 let shaped=uiTextRun(i,offset,count);if(shaped!=0u){if(heap[pgData(shaped)+17u]!=0u){let hit=paragraphHit(shaped,x,0.0);state[cs(templateContentOwner(i))+7u]=hit.y;return hit.x;}}
 var previous=0u; var prevX=0.0; var p=nextTextCluster(offset,count,0u);
 while(previous<count) { let nextX=textCaretX(i,offset,count,p,size); if(x<(prevX+nextX)*0.5) { return previous; } previous=p; prevX=nextX; p=nextTextCluster(offset,count,p); }
 return count;
}
fn nextTextLine(i:u32,offset:u32,count:u32,start:u32,size:f32,width:f32)->TextLine {
 var x=0.0; var j=start; var lastBreak=start; var breakEnd=start; var g=textGlyph(i,offset,count,start);
 while(j<count) {
  if(g.code==10u || g.code==13u) { var next=j+1u; if(g.code==13u && next<count && heap[offset+next]==10u) { next++; } return TextLine(j,next,textWidth(i,offset+start,j-start,size)); }
  let next=textGlyph(i,offset,count,j+g.count); let advance=textAdvance(i,g,next,size,x);
  if(width>0.0 && x>0.0 && x+advance>width) {
   if(lastBreak>start) { return TextLine(breakEnd,lastBreak,textWidth(i,offset+start,breakEnd-start,size)); }
   return TextLine(j,j,textWidth(i,offset+start,j-start,size));
  }
  let before=j; x+=advance; j+=g.count;
  if(g.code==32u || g.code==9u || g.code==0x200bu) { if(lastBreak!=before) { breakEnd=before; } lastBreak=j; }
  if(g.code==45u) { lastBreak=j; breakEnd=j; }
  g=next;
 }
 return TextLine(j,j,x);
}
// (found, x, y) attachment offsets in ems, relative to the base/mark origin.
fn markAttachment(base:TextGlyph,mark:TextGlyph,toMark:bool)->vec3<f32> {
 if(base.face==0u || base.face!=mark.face) { return vec3<f32>(0.0); }
 let descriptor=heap[heap[base.face+6u]+base.script*4u+2u]; let kind=select(4u,6u,toMark);
 for(var j=0u;j<heap[descriptor];j++) {
  let d=heap[descriptor+1u+j]; if(heap[d]!=kind) { continue; } let m=heap[d+1u]+mark.gid*3u; let cls=heap[m]; let b=heap[heap[d+2u]+base.gid];
  if(cls==0u || b==0u) { continue; } let anchor=heap[d+3u]+b-1u+(cls-1u)*3u; if(heap[anchor]==0u) { continue; }
  return vec3<f32>(1.0,hf(anchor+1u)-hf(m+1u),hf(anchor+2u)-hf(m+2u));
 }
 return vec3<f32>(0.0);
}
