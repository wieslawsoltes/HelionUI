/** Independent host reference for diagnostic geometry/numbers/history.
 * Tests only: never imported by the GPU runtime and never a font raster fallback. */
export function hudLayout(width, height, dpr) {
  const scale=Math.max(.01,Math.min(1,(width-16)/420,(height-16)/338));
  return {scale,ratio:dpr*scale,width:420*scale,height:338*scale,
    origin:[Math.max(8,width-420*scale-12),Math.max(8,height-338*scale-74)]};
}
export function numericText(value, decimal=false) {
  if(!(value>=0)||value>1e9)return 'N/A';
  if(value>9999.9)return '9999+';
  const scaled=Math.round(Math.fround(Math.fround(value)*(decimal?10:1))),integer=Math.floor(scaled/(decimal?10:1));
  if(integer>9999)return '9999+';
  return String(integer)+(decimal?'.'+scaled%10:'');
}
export function graphVertices(history,series) {
  const count=Math.min(history[1],120),oldest=(history[0]+120-count)%120;
  const f=new Float32Array(history.buffer,history.byteOffset,history.length);
  return Array.from({length:count},(_,j)=>({x:(120-count+j)/119*104,value:f[32+((oldest+j)%120)*4+series]}));
}
export function fontPlan(compiled, ratio, kind=0) {
 const heap=compiled.heap,f=new Float32Array(heap.buffer,heap.byteOffset,heap.length),face=compiled.state[32];
 const em=(kind?26:12)*ratio;
 return Array.from({length:95},(_,i)=>{const code=i+32,page=heap[heap[face+5]+(code>>>8)],gid=page&&heap[page+(code&255)]?heap[page+(code&255)]-1:heap[face+7];
  const record=heap[face+4]+gid*4,path=heap[record];let origin=[0,0],extent=[0,0];
  if(path){const margin=1+f[path+5]*em*.5;origin=[Math.floor(f[path+6]*em-margin),Math.floor(f[path+7]*em-margin)];extent=[Math.ceil(f[path+8]*em+margin)-origin[0],Math.ceil(f[path+9]*em+margin)-origin[1]];}
  return {code,gid,path,em,advance:f[record+1]*em,origin,extent,cached:!!path&&extent.every(n=>n>0&&n<=64)};
 });
}
/** Polygon clipped to a single pixel. Independent reference for filled fixture outlines. */
export function polygonPixelCoverage(points,x,y) {
 let poly=points;
 for(const [axis,bound,sign] of [[0,x,1],[0,x+1,-1],[1,y,1],[1,y+1,-1]]){
  const next=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],insideA=sign*(a[axis]-bound)>=0,insideB=sign*(b[axis]-bound)>=0;
   if(insideA)next.push(a);
   if(insideA!==insideB){const t=(bound-a[axis])/(b[axis]-a[axis]);next.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
  }poly=next;if(!poly.length)return 0;
 }
 let area=0;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length];area+=a[0]*b[1]-a[1]*b[0];}
 return Math.min(1,Math.abs(area)/2);
}
