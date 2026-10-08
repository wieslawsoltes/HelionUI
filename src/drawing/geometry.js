import { parsePath, pathBounds } from '../render/paths.js';
export function Point(x=0,y=0) {return [Number(x),Number(y)];}
export function Rect(x=0,y=0,width=0,height=0) {const r=[x,y,width,height].map(Number);if(!r.every(Number.isFinite)||r[2]<0||r[3]<0) throw new RangeError('Invalid Rect');return r;}
export function Matrix(m11=1,m12=0,m21=0,m22=1,offsetX=0,offsetY=0) {const a=[m11,m12,m21,m22,offsetX,offsetY].map(Number);if(!a.every(Number.isFinite))throw new RangeError('Invalid Matrix');return a;}
export function TranslateTransform(x,y=0) {return Matrix(1,0,0,1,x,y);}
export function ScaleTransform(x,y=x) {return Matrix(x,0,0,y);}
export function RotateTransform(degrees) {const a=Number(degrees)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return Matrix(c,s,-s,c);}
export function SkewTransform(x,y=0) {return Matrix(1,Math.tan(y*Math.PI/180),Math.tan(x*Math.PI/180),1);}
export function multiplyMatrices(a,b) {return Matrix(a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]);}
export function TransformGroup(...items) {return items.flat(0).reduce(multiplyMatrices,Matrix());}
export function PathGeometry(path,fillRule='nonzero') {const segments=parsePath(path);return {kind:'geometry',segments,bounds:pathBounds(segments),fillRule};}
export function RectangleGeometry(rect,radiusX=0,radiusY=radiusX) {
 const [x,y,w,h]=Rect(...rect),rx=Math.min(Math.max(0,radiusX),w/2),ry=Math.min(Math.max(0,radiusY),h/2),k=.5522847498307936;
 if(!rx||!ry) return PathGeometry(`M ${x} ${y} L ${x+w} ${y} L ${x+w} ${y+h} L ${x} ${y+h} Z`);
 return PathGeometry(`M ${x+rx} ${y} L ${x+w-rx} ${y} C ${x+w-rx+k*rx} ${y} ${x+w} ${y+ry-k*ry} ${x+w} ${y+ry} L ${x+w} ${y+h-ry} C ${x+w} ${y+h-ry+k*ry} ${x+w-rx+k*rx} ${y+h} ${x+w-rx} ${y+h} L ${x+rx} ${y+h} C ${x+rx-k*rx} ${y+h} ${x} ${y+h-ry+k*ry} ${x} ${y+h-ry} L ${x} ${y+ry} C ${x} ${y+ry-k*ry} ${x+rx-k*rx} ${y} ${x+rx} ${y} Z`);
}
export function EllipseGeometry(center,radiusX,radiusY=radiusX) {
 const [x,y]=center,rx=Number(radiusX),ry=Number(radiusY),k=.5522847498307936;
 if(!(rx>0&&ry>0)) throw new RangeError('Ellipse radii must be positive');
 return PathGeometry(`M ${x+rx} ${y} C ${x+rx} ${y+k*ry} ${x+k*rx} ${y+ry} ${x} ${y+ry} C ${x-k*rx} ${y+ry} ${x-rx} ${y+k*ry} ${x-rx} ${y} C ${x-rx} ${y-k*ry} ${x-k*rx} ${y-ry} ${x} ${y-ry} C ${x+k*rx} ${y-ry} ${x+rx} ${y-k*ry} ${x+rx} ${y} Z`);
}
export function GeometryGroup(children,fillRule='nonzero') {return PathGeometry(children.flatMap(g=>g.segments),fillRule);}
export class StreamGeometry {
 constructor(fillRule='nonzero') {this.fillRule=fillRule;this.commands=[];this.opened=false;}
 open() {if(this.opened)throw new Error('Geometry already opened');this.opened=true;return new StreamGeometryContext(this);}
 Open() {return this.open();}
 toGeometry() {if(this.opened)throw new Error('Close geometry context first');return PathGeometry(this.commands.join(' '),this.fillRule);}
}
export class StreamGeometryContext {
 constructor(owner) {this.owner=owner;this.active=false;this.closed=false;}
 check() {if(this.closed)throw new Error('Geometry context is closed');}
 beginFigure(start,isFilled=true) {this.check();if(!isFilled)throw new TypeError('Use a separate stroke-only geometry; mixed filled figures are unsupported');if(this.active)this.endFigure(false);this.owner.commands.push(`M ${start[0]} ${start[1]}`);this.active=true;return this;}
 lineTo(p) {this.check();if(!this.active)throw new Error('BeginFigure required');this.owner.commands.push(`L ${p[0]} ${p[1]}`);return this;}
 quadraticBezierTo(c,p) {this.check();if(!this.active)throw new Error('BeginFigure required');this.owner.commands.push(`Q ${c[0]} ${c[1]} ${p[0]} ${p[1]}`);return this;}
 cubicBezierTo(a,b,p) {this.check();if(!this.active)throw new Error('BeginFigure required');this.owner.commands.push(`C ${a[0]} ${a[1]} ${b[0]} ${b[1]} ${p[0]} ${p[1]}`);return this;}
 arcTo(point,radii,rotation=0,largeArc=false,sweep='clockwise') {this.check();if(!this.active)throw new Error('BeginFigure required');this.owner.commands.push(`A ${radii[0]} ${radii[1]} ${rotation} ${largeArc?1:0} ${sweep==='clockwise'?1:0} ${point[0]} ${point[1]}`);return this;}
 endFigure(closed=false) {this.check();if(closed)this.owner.commands.push('Z');this.active=false;return this;}
 dispose() {if(this.closed)return;this.closed=true;this.owner.opened=false;}
 BeginFigure(p,filled=true) {return this.beginFigure(p,filled);}
 LineTo(p) {return this.lineTo(p);}
 QuadraticBezierTo(a,b) {return this.quadraticBezierTo(a,b);}
 CubicBezierTo(a,b,c) {return this.cubicBezierTo(a,b,c);}
 BezierTo(a,b,c) {return this.cubicBezierTo(a,b,c);}
 ArcTo(a,b,c=0,d=false,e='clockwise') {return this.arcTo(a,b,c,d,e);}
 EndFigure(c=false) {return this.endFigure(c);}
 Dispose() {this.dispose();}
}
