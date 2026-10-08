/** Host tests only. Runtime coverage is WGSL; this module is not a renderer fallback. */
export const clamp01 = v => Math.max(0, Math.min(1, v));
export function lineArea(a,b) {
 const dy=b[1]-a[1]; if(Math.abs(dy)<1e-8)return 0;
 const lo=Math.max(0,Math.min(a[1],b[1])),hi=Math.min(1,Math.max(a[1],b[1]));if(hi<=lo)return 0;
 const x0=a[0]+(lo-a[1])*(b[0]-a[0])/dy,x1=a[0]+(hi-a[1])*(b[0]-a[0])/dy;
 const xmin=Math.min(x0,x1),xmax=Math.max(x0,x1);let average=clamp01(1-(x0+x1)*.5);
 if(xmax-xmin>1e-6){const left=Math.max(0,Math.min(xmax,0)-xmin),start=clamp01(xmin),end=clamp01(xmax);average=(left+(end-start)*(1-(start+end)*.5))/(xmax-xmin);}
 return (hi-lo)*average*(dy>0?1:-1);
}
function roots(a,b,c){
 if(Math.abs(a)<1e-8)return Math.abs(b)<1e-8?[-1,-1]:[-c/b,-1];
 const d=b*b-4*a*c;if(d<0)return [-1,-1];const q=-.5*(b+(b>=0?Math.sqrt(d):-Math.sqrt(d)));
 return Math.abs(q)<1e-20?[-b/(2*a),-1]:[q/a,c/q];
}
export function quadraticArea(p0,p1,p2){
 const lo=[0,1].map(j=>Math.min(p0[j],p1[j],p2[j])),hi=[0,1].map(j=>Math.max(p0[j],p1[j],p2[j]));
 if(lo[1]>=1||hi[1]<=0||lo[0]>=1)return 0;
 if(hi[0]<=0)return clamp01(p2[1])-clamp01(p0[1]);
 const a=[0,1].map(j=>p0[j]-2*p1[j]+p2[j]),b=[0,1].map(j=>2*(p1[j]-p0[j])),c=p0;
 const cuts=[0,1];for(let axis=0;axis<2;axis++)for(let edge=0;edge<2;edge++)for(const t of roots(a[axis],b[axis],c[axis]-edge))if(t>0&&t<1)cuts.push(t);
 cuts.sort((a,b)=>a-b);let result=0;
 for(let j=1;j<cuts.length;j++){
  const half=(cuts[j]-cuts[j-1])*.5,mid=(cuts[j]+cuts[j-1])*.5;if(half<=0)continue;
  const point=[0,1].map(k=>(a[k]*mid+b[k])*mid+c[k]);if(point[1]<=0||point[1]>=1||point[0]>=1)continue;
  if(point[0]<=0){result+=2*half*(2*a[1]*mid+b[1]);continue;}
  const ta=mid-half/Math.sqrt(3),tb=mid+half/Math.sqrt(3);
  result+=half*((1-(a[0]*ta+b[0])*ta-c[0])*(2*a[1]*ta+b[1])+(1-(a[0]*tb+b[0])*tb-c[0])*(2*a[1]*tb+b[1]));
 }return result;
}
export function cubicArea(...p){
 const lo=[0,1].map(j=>Math.min(...p.map(p=>p[j]))),hi=[0,1].map(j=>Math.max(...p.map(p=>p[j])));
 if(lo[1]>=1||hi[1]<=0||lo[0]>=1)return 0;if(hi[0]<=0)return clamp01(p[3][1])-clamp01(p[0][1]);
 const bend=Math.max(Math.hypot(...[0,1].map(k=>p[0][k]-2*p[1][k]+p[2][k])),Math.hypot(...[0,1].map(k=>p[1][k]-2*p[2][k]+p[3][k])));
 const n=Math.max(1,Math.min(256,Math.ceil(Math.sqrt(48*bend))));let sum=0,last=p[0];
 for(let j=1;j<=n;j++){const t=j/n,u=1-t,point=[0,1].map(k=>u*u*u*p[0][k]+3*u*u*t*p[1][k]+3*u*t*t*p[2][k]+t*t*t*p[3][k]);sum+=lineArea(last,point);last=point;}return sum;
}
export function quadraticPoints(p0,p1,p2,count=4096){return Array.from({length:count+1},(_,j)=>{const t=j/count,u=1-t;return [0,1].map(k=>u*u*p0[k]+2*u*t*p1[k]+t*t*p2[k]);});}
export function shapeCoverage(segments,pixel=[0,0],matrix=[1,0,0,1],origin=[0,0]){
 const tr=p=>[matrix[0]*p[0]+matrix[2]*p[1]+origin[0]-pixel[0],matrix[1]*p[0]+matrix[3]*p[1]+origin[1]-pixel[1]];
 let area=0;for(const segment of segments){const pts=[];for(let j=1;j<segment.length;j+=2)pts.push(tr([segment[j],segment[j+1]]));area+=segment[0]===0?lineArea(...pts.slice(0,2)):segment[0]===1?quadraticArea(...pts.slice(0,3)):cubicArea(...pts.slice(0,4));}return clamp01(Math.abs(area));
}
