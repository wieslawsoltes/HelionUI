// Pure, device-space signed pixel-area integration shared by UI and HUD compute.
// A quadratic is partitioned at pixel-boundary roots. Two-point Gauss integration
// is exact for (1-x(t))*y'(t), a cubic polynomial, on each unclamped interval.
// No uniform font-space tessellation, coverage gamma, SDF or CPU rasterization.
fn curveLineArea(a:vec2<f32>,b:vec2<f32>)->f32 {
 let dy=b.y-a.y;
 if(abs(dy)<1e-8) { return 0.0; }
 let lo=max(0.0,min(a.y,b.y)); let hi=min(1.0,max(a.y,b.y));
 if(hi<=lo) { return 0.0; }
 let x0=a.x+(lo-a.y)*(b.x-a.x)/dy; let x1=a.x+(hi-a.y)*(b.x-a.x)/dy;
 // Work in the clipped x interval, avoiding subtraction of two large negative areas.
 let xmin=min(x0,x1); let xmax=max(x0,x1); var coverage=clamp(1.0-(x0+x1)*.5,0.0,1.0);
 if(xmax-xmin>1e-6) {
  let left=max(0.0,min(xmax,0.0)-xmin);
  let start=clamp(xmin,0.0,1.0); let end=clamp(xmax,0.0,1.0);
  coverage=(left+(end-start)*(1.0-(start+end)*.5))/(xmax-xmin);
 }
 return (hi-lo)*coverage*select(-1.0,1.0,dy>0.0);
}
fn curveRoots(a:f32,b:f32,c:f32)->vec2<f32> {
 // The q formulation avoids cancellation in the small root; -1 means no root.
 if(abs(a)<1e-8) { if(abs(b)<1e-8) { return vec2<f32>(-1.0); } return vec2<f32>(-c/b,-1.0); }
 let disc=b*b-4.0*a*c;
 if(disc<0.0) { return vec2<f32>(-1.0); }
 let q=-.5*(b+select(-sqrt(disc),sqrt(disc),b>=0.0));
 if(abs(q)<1e-20) { return vec2<f32>(-b/(2.0*a),-1.0); }
 return vec2<f32>(q/a,c/q);
}
fn curveQuadraticArea(p0:vec2<f32>,p1:vec2<f32>,p2:vec2<f32>)->f32 {
 let lo=min(p0,min(p1,p2)); let hi=max(p0,max(p1,p2));
 if(lo.y>=1.0 || hi.y<=0.0 || lo.x>=1.0) { return 0.0; }
 if(hi.x<=0.0) { return clamp(p2.y,0.0,1.0)-clamp(p0.y,0.0,1.0); }
 let a=p0-2.0*p1+p2; let b=2.0*(p1-p0); let c=p0;
 var cuts:array<f32,10>; cuts[0]=0.0; cuts[1]=1.0; var count=2u;
 for(var axis=0u;axis<2u;axis++) { for(var edge=0u;edge<2u;edge++) {
  let roots=curveRoots(a[axis],b[axis],c[axis]-f32(edge));
  for(var k=0u;k<2u;k++) { let t=roots[k]; if(t>0.0 && t<1.0) { cuts[count]=t; count++; } }
 } }
 for(var j=1u;j<count;j++) { let value=cuts[j]; var k=j; while(k>0u && cuts[k-1u]>value) { cuts[k]=cuts[k-1u]; k--; } cuts[k]=value; }
 var result=0.0;
 for(var j=1u;j<count;j++) {
  let half=(cuts[j]-cuts[j-1u])*.5; if(half<=0.0) { continue; }
  let mid=(cuts[j]+cuts[j-1u])*.5; let p=(a*mid+b)*mid+c;
  if(p.y<=0.0 || p.y>=1.0 || p.x>=1.0) { continue; }
  if(p.x<=0.0) { result+=2.0*half*(2.0*a.y*mid+b.y); continue; }
  let ta=mid-half*0.5773502691896258; let tb=mid+half*0.5773502691896258;
  let xa=(a.x*ta+b.x)*ta+c.x; let xb=(a.x*tb+b.x)*tb+c.x;
  result+=half*((1.0-xa)*(2.0*a.y*ta+b.y)+(1.0-xb)*(2.0*a.y*tb+b.y));
 }
 return result;
}
fn curveCubicArea(p0:vec2<f32>,p1:vec2<f32>,p2:vec2<f32>,p3:vec2<f32>)->f32 {
 let lo=min(min(p0,p1),min(p2,p3)); let hi=max(max(p0,p1),max(p2,p3));
 if(lo.y>=1.0 || hi.y<=0.0 || lo.x>=1.0) { return 0.0; }
 if(hi.x<=0.0) { return clamp(p3.y,0.0,1.0)-clamp(p0.y,0.0,1.0); }
 // Source TrueType outlines are quadratics. Authored cubic fixtures/paths use a
 // screen-space chord bound of 1/64 px; the explicit 256-step ceiling is retained.
 let bend=max(length(p0-2.0*p1+p2),length(p1-2.0*p2+p3));
 let steps=u32(clamp(ceil(sqrt(48.0*bend)),1.0,256.0));
 var previous=p0; var result=0.0;
 for(var k=1u;k<=steps;k++) {
  let t=f32(k)/f32(steps); let u=1.0-t;
  let point=u*u*u*p0+3.0*u*u*t*p1+3.0*u*t*t*p2+t*t*t*p3;
  result+=curveLineArea(previous,point); previous=point;
 }
 return result;
}
