/** Test-only, CPU oracle for the documented resident typography subset. Not shipped
 * in the runtime import graph. This does not execute WGSL or constitute Unicode conformance. */
import { fromBits } from '../src/core/schema.js';
export function textReference(compiled, node = 0) {
  const h = compiled.heap, u = new Uint32Array(compiled.nodes.buffer,compiled.nodes.byteOffset,compiled.nodes.byteLength/4), style = u[node*72+71], f = at => fromBits(h[at]);
  const fonts = Array.from(h.slice(h[style+1],h[style+1]+h[style])), primary = fonts[0];
  const glyphId = (face,cp) => {const page=h[h[face+5]+(cp>>>8)];return page ? h[page+(cp&255)] : 0;};
  const script = cp => cp>=0x370&&cp<=0x3ff||cp>=0x1f00&&cp<=0x1fff ? 2 : cp>=0x400&&cp<=0x52f||cp>=0x2de0&&cp<=0x2dff||cp>=0xa640&&cp<=0xa69f ? 3 : 1;
  const map = cp => {for(const face of fonts){const id=glyphId(face,cp);if(id)return {face,id:id-1,count:1,code:cp,script:script(cp)};}return {face:primary,id:h[primary+7],count:1,code:cp,script:script(cp)};};
  const mark = cp => {let lo=0,hi=compiled.state[57];while(lo<hi){const mid=(lo+hi)>>>1,at=compiled.state[56]+2*mid;if(cp<h[at])hi=mid;else if(cp>h[at+1])lo=mid+1;else return true;}return false;};
  const compose = (a,b) => {let lo=0,hi=compiled.state[55];while(lo<hi){const mid=(lo+hi)>>>1,at=compiled.state[54]+mid*3;if(h[at]<a||h[at]===a&&h[at+1]<b)lo=mid+1;else hi=mid;}const at=compiled.state[54]+lo*3;return lo<compiled.state[55]&&h[at]===a&&h[at+1]===b?h[at+2]:0;};
  const glyph = (codes,start,end=codes.length) => {
    if(start>=end)return null;let g=map(codes[start]);
    for(let k=1;k<8&&start+k<end;k++){if(!mark(codes[start+k]))break;const cp=compose(g.code,codes[start+k]);if(!cp)break;const next=map(cp);if(!glyphId(next.face,cp))break;g={...next,count:k+1};}
    if(g.count!==1||mark(g.code)||!(h[style+2]&2))return g;
    const index=h[h[g.face+6]+g.script*4+1]+g.id*2;
    for(let k=0;k<h[index+1];k++){const at=h[index]+k*12,n=h[at+1];if(start+n>end)continue;let match=true;for(let j=1;j<n;j++){const next=map(codes[start+j]);if(next.face!==g.face||next.id!==h[at+2+j])match=false;}if(match)return {...g,id:h[at],count:n};}
    return g;
  };
  const kern = (left,right) => {
    if(!left||!right||left.face!==right.face||!(h[style+2]&1))return 0;
    const groups=h[h[left.face+6]+left.script*4];let sum=0;
    for(let i=0;i<h[groups];i++){const group=h[groups+1+i];for(let j=0;j<h[group];j++){
      const d=h[group+1+j];
      if(h[d]===2){const c1=h[h[d+1]+left.id];if(c1){sum+=f(h[d+4]+(c1-1)*h[d+3]+h[h[d+2]+right.id]);break;}}
      else {const index=h[d+1]+left.id*2;let found=false;for(let k=0;k<h[index+1];k++){const at=h[index]+k*2;if(h[at]===right.id){sum+=f(at+1);found=true;break;}}if(found)break;}
    }}return sum;
  };
  const advance = (g,next,size,x) => {
    if(g.code===9){const stop=Math.max(1,f(h[map(32).face+4]+map(32).id*4+1)*size*4);return (Math.floor(x/stop)+1)*stop-x;}
    if(mark(g.code)||[0x200b,0x200d,0xfeff].includes(g.code))return 0;
    return Math.max(0,(f(h[g.face+4]+g.id*4+1)+kern(g,next))*size+f(style+3));
  };
  const toCodes = text => typeof text==='string'?Array.from(text,c=>c.codePointAt(0)):text;
  const width = (text,size=14) => {const cps=toCodes(text);let x=0;for(let i=0;i<cps.length;){const g=glyph(cps,i);if([10,13].includes(g.code))break;x+=advance(g,glyph(cps,i+g.count),size,x);i+=g.count;}return x;};
  const lineHeight = size => f(style+4)>0?f(style+4):(f(primary)+f(primary+1)+f(primary+2))*size;
  const lines = (text,size=14,maxWidth=0) => {
    const cps=toCodes(text),result=[];let start=0;
    do {let j=start,x=0,lastBreak=start,breakEnd=start,entry;
      while(j<cps.length){const g=glyph(cps,j);if([10,13].includes(g.code)){const next=j+1+(g.code===13&&cps[j+1]===10?1:0);entry={start,end:j,next,width:width(cps.slice(start,j),size)};break;}
        const a=advance(g,glyph(cps,j+g.count),size,x);
        if(maxWidth>0&&x>0&&x+a>maxWidth){const end=lastBreak>start?breakEnd:j,next=lastBreak>start?lastBreak:j;entry={start,end,next,width:width(cps.slice(start,end),size)};break;}
        const before=j;x+=a;j+=g.count;
        if([32,9,0x200b].includes(g.code)){if(lastBreak!==before)breakEnd=before;lastBreak=j;}
        if(g.code===45){lastBreak=j;breakEnd=j;}
      }
      entry??={start,end:j,next:j,width:x};result.push(entry);
      if(entry.next>=cps.length||entry.next<=start)break;start=entry.next;
    }while(start<cps.length);
    if(cps.length&&[10,13].includes(cps.at(-1)))result.push({start:cps.length,end:cps.length,next:cps.length,width:0});return result;
  };
  const caret = (text,position,size=14) => {const cps=toCodes(text);let x=0;for(let i=0;i<cps.length&&i<position;){const g=glyph(cps,i),a=advance(g,glyph(cps,i+g.count),size,x);if(position<i+g.count){if(g.count>1&&mark(cps[i+1]))return x;let sum=0,before=0;for(let k=0;k<g.count;k++){const mapped=map(cps[i+k]),w=f(h[mapped.face+4]+mapped.id*4+1);sum+=w;if(i+k<position)before+=w;}return x+(sum?a*before/sum:0);}x+=a;i+=g.count;}return x;};
  const attachment = (base,accent,toMark=false) => {
    if(!base||!accent||base.face!==accent.face)return null;const plan=h[h[base.face+6]+base.script*4+2];
    for(let i=0;i<h[plan];i++){const d=h[plan+1+i];if(h[d]!== (toMark?6:4))continue;const at=h[d+1]+accent.id*3,cls=h[at],b=h[h[d+2]+base.id];if(!cls||!b)continue;const anchor=h[d+3]+b-1+(cls-1)*3;if(h[anchor])return [f(anchor+1)-f(at+1),f(anchor+2)-f(at+2)];}return null;
  };
  return {style,primary,map,glyph,kern,width,lines,lineHeight,caret,attachment,mark,
    shape(text){const cps=toCodes(text),out=[];for(let i=0;i<cps.length;){const g=glyph(cps,i);out.push(g);i+=g.count;}return out;},
    measure(text,size=14,maxWidth=0){const result=lines(text,size,maxWidth);return [Math.max(...result.map(l=>l.width)),result.length*lineHeight(size)];}
  };
}
