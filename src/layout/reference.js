/** Independent CPU reference utilities for conformance tests/tooling, never
 * imported by the live GPU renderer or used as a layout fallback. */
export function allocateTracks(tracks,available,gap=0) {
 const fixed=tracks.map(t=>t.kind==='star'?0:Math.max(t.min??0,Math.min(t.max??1e7,t.value||0)));
 const space=available-Math.max(0,tracks.length-1)*gap-fixed.reduce((a,b)=>a+b,0);let low=0,high=Math.max(0,space)/Math.min(...tracks.filter(t=>t.kind==='star').map(t=>t.value));
 for(let i=0;i<80;i++){const unit=(low+high)/2,total=tracks.reduce((a,t)=>a+(t.kind==='star'?Math.max(t.min??0,Math.min(t.max??1e7,unit*t.value)):0),0);if(total<space)low=unit;else high=unit;}
 return tracks.map((t,i)=>t.kind==='star'?Math.max(t.min??0,Math.min(t.max??1e7,(low+high)/2*t.value)):fixed[i]);
}
export function dockLayout(children,rect,{gap=0,lastChildFill=true}={}) {
 const slots=[],r=[...rect];for(let i=0;i<children.length;i++){const c=children[i],s=[...r];if(!(lastChildFill&&i===children.length-1)){
 if(c.dock==='left'||c.dock==='right'){s[2]=Math.min(r[2],c.width);if(c.dock==='right')s[0]+=r[2]-s[2];}else{s[3]=Math.min(r[3],c.height);if(c.dock==='bottom')s[1]+=r[3]-s[3];}}
 slots.push(s);if(c.dock==='left'||c.dock==='right'){const used=Math.min(r[2],s[2]+gap);if(c.dock==='left')r[0]+=used;r[2]-=used;}else{const used=Math.min(r[3],s[3]+gap);if(c.dock!=='bottom')r[1]+=used;r[3]-=used;}}
 return slots;
}
export function wrapLayout(sizes,width,{gap=0,lineGap=gap}={}) {
 let x=0,y=0,high=0,first=0,lineItems=0;const slots=[];const finish=()=>{for(let j=first;j<slots.length;j++)slots[j][3]=high;first=slots.length;};
 for(const [w,h]of sizes){if(lineItems&&x+gap+w>width){finish();y+=high+lineGap;x=0;high=0;lineItems=0;}if(lineItems)x+=gap;lineItems++;slots.push([x,y,w,h]);x+=w;high=Math.max(high,h);}finish();return slots;
}
