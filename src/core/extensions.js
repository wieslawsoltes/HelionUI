import { fbits, finite, rgba } from './schema.js';
import { parsePath, pathBounds } from '../render/paths.js';
import { propertyName } from '../layout/properties.js';
export const EASINGS=Object.freeze({linear:0,smooth:1,spring:2,cubicIn:3,cubicOut:4,cubicInOut:5,sineInOut:6,backOut:7,step:8});
export function easingCode(name='linear') {if(!(name in EASINGS))throw new TypeError(`Unknown easing ${name}`);return EASINGS[name];}
const dynamicProperties=Object.freeze({background:[0,20],foreground:[0,21],borderColor:[0,22],radius:[1,23],borderWidth:[1,35],opacity:[2,3],translateX:[2,8],translateY:[2,9],scaleX:[2,10],scaleY:[2,11],rotation:[2,12]});
export function packNodeExtension(heap,p,type,nodeWords,state,nodeIndex,limitsByAxis=[]) {
 const needs=['Panel','DockPanel','WrapPanel','UniformGrid','Viewbox','ContentControl','ContentPresenter'].includes(type)||['scrollHorizontal','dock','lastChildFill','renderTransform','renderTransformOrigin','rowSpacing','columnSpacing','right','bottom','stateStyles','useLayoutRounding','templatePart','templateInstance','templateExpressions','templateSystem','textShaping'].some(k=>p[k]!=null)||Array.isArray(p.padding)||limitsByAxis.some(Boolean);
 if(!needs)return 0;
 const e=heap.alloc(40);if(e>=16777216)throw new RangeError('Extension pointer exceeds exact f32 address range'); const put=(at,value)=>heap.words[e+at]=value;
 put(0,0x48455831);put(2,['left','top','right','bottom'].indexOf(p.dock||'left'));if(heap.words[e+2]>3)throw new TypeError('Invalid DockPanel.Dock');put(3,p.lastChildFill!==false?1:0);
 const unsigned=(v,fallback=0)=>{v=Number(v??fallback);if(!Number.isInteger(v)||v<0||v>512)throw new RangeError('Panel row/column values must be 0..512');return v;};
 if(type==='UniformGrid'){put(4,unsigned(p.rows));put(5,unsigned(p.columns));put(6,unsigned(p.firstColumn));}
 const stretch=['none','fill','uniform','uniformToFill'].indexOf(p.stretch||'uniform');if(stretch<0)throw new TypeError('Invalid Stretch');put(7,stretch);
 const padding=Array.isArray(p.padding)?p.padding:[p.padding??0];if(![1,2,4].includes(padding.length))throw new RangeError('Padding requires 1, 2 or 4 values');
 const pd=padding.length===1?Array(4).fill(padding[0]):padding.length===2?[...padding,...padding]:padding;
 for(let j=0;j<4;j++){const x=finite(pd[j],0);if(x<0)throw new RangeError('Padding must be nonnegative');put(8+j,fbits(x));}
 let flags=Array.isArray(p.padding)?1:0;
 if(p.renderTransform!=null){if(!Array.isArray(p.renderTransform)||p.renderTransform.length!==6)throw new TypeError('RenderTransform requires a six-number Matrix');p.renderTransform.forEach((v,j)=>put(12+j,fbits(finite(v,0))));if(Math.abs(p.renderTransform[0]*p.renderTransform[3]-p.renderTransform[1]*p.renderTransform[2])<1e-8)throw new RangeError('RenderTransform must be invertible');flags|=2;}
 const origin=p.renderTransformOrigin||[.5,.5];if(!Array.isArray(origin)||origin.length!==2)throw new TypeError('RenderTransformOrigin requires a relative [x,y]');origin.forEach((v,j)=>put(18+j,fbits(finite(v,.5))));
 if(p.renderTransformOrigin)flags|=4;if(p.x!=null)flags|=16;if(p.y!=null)flags|=32;if(p.useLayoutRounding)flags|=64;if(p.scrollHorizontal===true)flags|=128;put(1,flags);
 for(const [k,at] of [['itemWidth',20],['itemHeight',21]]){const x=finite(p[k],-1);if(x<0&&x!==-1)throw new RangeError(`Invalid ${k}`);put(at,fbits(x));}
 if(type==='UniformGrid'&&p.minColumnWidth!=null){const value=finite(p.minColumnWidth,0);if(value<=0||value>16384)throw new RangeError('minColumnWidth must be positive and at most 16384');put(22,fbits(value));}
 const direction=['both','uponly','downonly'].indexOf(p.stretchDirection||'both');if(direction<0)throw new TypeError('Invalid StretchDirection');put(23,direction);
 for(const [k,at] of [['rowSpacing',28],['columnSpacing',29]]){const x=finite(p[k],p.gap??0);if(x<0)throw new RangeError('Spacing must be nonnegative');put(at,fbits(x));}
 put(30,fbits(finite(p.right,-1e7)));put(31,fbits(finite(p.bottom,-1e7)));
 limitsByAxis.forEach((lim,j)=>{if(lim)put(32+j,heap.push(lim.flatMap(x=>x.map(fbits))));});
 const groups=new Map();
 for(const rule of p.stateStyles||[]){for(const [key,value] of Object.entries(rule.setters)){
  if(!dynamicProperties[key])throw new TypeError(`Dynamic style property ${key} is not supported (use a static style for layout/font properties)`);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push([rule.required,rule.forbidden,dynamicProperties[key][0]===0?rgba(value):fbits(finite(value,0)),0]);
 }}
 const records=[];for(const [key,rules]of groups){const [category,offset]=dynamicProperties[key];const base=category===2?state[64+nodeIndex*16+offset]:nodeWords[nodeIndex*72+offset];
 const transition=(p.transitions||[]).find(t=>propertyName(t.property)===key);const duration=finite(transition?.duration,0);if(duration<0)throw new RangeError('Transition duration must be nonnegative');
 records.push([category,offset,base,rules.length,heap.push(rules.flat()),fbits(duration),easingCode(transition?.easing||'smooth'),base,base,0,base,0,0,0,0,0]);}
 if(records.length){put(24,heap.push(records.flat()));put(25,records.length);}return e;
}
export function packAnimation(heap,a,resolve,baseValue) {
 if(a.expression){const x=a.expression;if(finite(x.min,-1e7)>finite(x.max,1e7))throw new RangeError('Expression minimum exceeds maximum');return {mode:2,pointer:heap.push([0,0,0,0,0,0,0,0,baseValue,fbits(1),resolve(x.source),fbits(finite(x.scale,1)),fbits(finite(x.offset,0)),fbits(finite(x.min,-1e7)),fbits(finite(x.max,1e7)),0])};}
 const keys=a.keyFrames||a.keyframes;if(!keys && a.iterations==null && !a.direction && !a.fillMode && !a.id)return {mode:0,pointer:0};
 const values=(keys||[{cue:0,value:a.from??0},{cue:1,value:a.to??1}]).map(k=>({cue:finite(k.cue??k.offset,NaN),value:finite(k.value,NaN),easing:easingCode(k.easing||a.easing||'linear')})).sort((a,b)=>a.cue-b.cue);
 if(values.length<2||values.length>64||values[0].cue!==0||values.at(-1).cue!==1||values.some((k,j)=>!Number.isFinite(k.value)||!Number.isFinite(k.cue)||k.cue<0||k.cue>1||(j&&k.cue===values[j-1].cue)))throw new RangeError('Keyframes require 2–64 unique cues, including 0 and 1');
 let count=a.iterations??(a.repeat===true?'infinite':1);if(count==='infinite'||count===Infinity)count=0;else if(!Number.isInteger(count)||count<1||count>1000000)throw new RangeError('Invalid iteration count');
 const direction=['normal','reverse','alternate','alternateReverse'].indexOf(a.direction||'normal');const fill=['none','backwards','forwards','both'].indexOf(a.fillMode||'forwards');if(direction<0||fill<0)throw new TypeError('Invalid animation direction/fill');
 return {mode:1,pointer:heap.push([values.length,heap.push(values.flatMap(k=>[fbits(k.cue),fbits(k.value),k.easing,0])),count,direction,fill,0,0,0,baseValue,fbits(1),0,0,0,0,0,0])};
}
export function packBrush(heap,brush,bounds) {
 if(brush==null)return 0;if(typeof brush==='string'||typeof brush==='number')brush={kind:'solid',color:brush};
 const at=heap.alloc(16);if(at>=16777216)throw new RangeError('Brush pointer exceeds exact f32 address range');const size=[bounds[2]-bounds[0],bounds[3]-bounds[1]];heap.set(at+4,[...bounds.slice(0,2),...size].map(fbits));
 const kind={solid:0,linear:1,radial:2,image:3}[brush.kind];if(kind==null)throw new TypeError('Unsupported drawing brush');heap.words[at]=kind;
 if(kind===0){const opacity=finite(brush.opacity,1);if(opacity<0||opacity>1)throw new RangeError('Brush opacity must be 0..1');heap.words[at+1]=rgba(brush.color);heap.words[at+2]=fbits(opacity);return at;}
 if(kind===3){const image=brush.image;const width=Number(image?.width),height=Number(image?.height);if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>4194304||image?.pixels?.length!==width*height*4)throw new RangeError('ImageSource must be RGBA8, at most 4M pixels');
 if(!(image.pixels instanceof Uint8Array)&&!Array.from(image.pixels).every(v=>Number.isInteger(v)&&v>=0&&v<=255))throw new RangeError('Image pixels must be unsigned bytes');
 const pixels=heap.alloc(width*height);for(let j=0;j<width*height;j++){const b=j*4,p=image.pixels;heap.words[pixels+j]=(p[b]|(p[b+1]<<8)|(p[b+2]<<16)|(p[b+3]<<24))>>>0;}
 heap.set(at+1,[pixels,width,height]);return at;}
 const stops=(brush.stops||[]).map(s=>({offset:finite(s.offset,NaN),color:rgba(s.color)})).sort((a,b)=>a.offset-b.offset);
 if(stops.length<2||stops.length>32||stops.some(s=>!Number.isFinite(s.offset)||s.offset<0||s.offset>1))throw new RangeError('Gradient needs 2–32 stops in 0..1');heap.set(at+1,[heap.push(stops.flatMap(s=>[fbits(s.offset),s.color])),stops.length]);
 const spread=['pad','repeat','reflect'].indexOf(brush.spread||'pad');if(spread<0)throw new TypeError('Invalid gradient spread');heap.words[at+3]=spread;
 const first=kind===1?brush.start:brush.center,second=kind===1?brush.end:brush.radius;if(!Array.isArray(first)||!Array.isArray(second)||first.length!==2||second.length!==2)throw new TypeError('Brush points must be 2D');
 const points=[...first,...second].map(v=>finite(v,NaN));if(!points.every(Number.isFinite)||(kind===2&&(points[2]<=0||points[3]<=0)))throw new RangeError('Invalid brush geometry');heap.set(at+8,points.map(fbits));return at;
}
export function packDrawing(heap,drawing,addPath,font) {
 if(drawing?.kind!=='drawing'||!Array.isArray(drawing.commands)||drawing.commands.length>4096)throw new TypeError('Expected bounded retained DrawingContext content');
 const width=finite(drawing.width,NaN),height=finite(drawing.height,NaN);if(!(width>=0&&height>=0))throw new RangeError('Drawing dimensions must be finite and nonnegative');
 const records=[];let depth=0;for(const c of drawing.commands){let r=Array(24).fill(0);const append=()=>records.push(r);
 if(c.op==='geometry'){const g=c.geometry,segs=parsePath(g.segments);const b=g.bounds||pathBounds(segs);if(!['nonzero','evenodd'].includes(g.fillRule))throw new TypeError('Invalid fill rule');
 if(c.brush!=null){r[0]=1;r[1]=addPath(segs,0,b,g.fillRule==='evenodd'?1:0);r[2]=packBrush(heap,c.brush,b);append();r=Array(24).fill(0);}
 if(c.pen!=null){const thickness=finite(c.pen.thickness,1);if(thickness<0)throw new RangeError('Negative pen thickness');if(thickness>0){r[0]=1;r[1]=addPath(segs,thickness,b,g.fillRule==='evenodd'?1:0);r[2]=packBrush(heap,c.pen.brush,b);append();}}
 }else if(c.op==='text'){for(const k of Object.keys(c.text))if(!['text','fontSize'].includes(k))throw new TypeError(`Drawing text ${k} is not implemented; inherit typography on the Drawing node`);
 r[0]=2;const [at,len]=heap.string(c.text.text);r[5]=at;r[6]=len;r[7]=fbits(finite(c.text.fontSize,14));if(!(c.text.fontSize>0))throw new RangeError('Drawing font size must be positive');r[8]=fbits(finite(c.origin[0],0));r[9]=fbits(finite(c.origin[1],0));r[2]=packBrush(heap,c.brush,[c.origin[0],c.origin[1],c.origin[0]+drawing.width,c.origin[1]+drawing.height]);append();
 }else if(c.op==='glyphrun'){const g=c.glyphRun;const ids=g?.glyphIndices;if(!Array.isArray(ids)||ids.length<1||ids.length>1024||ids.some(id=>!Number.isInteger(id)||id<0||id>=font.glyphs.length))throw new RangeError('GlyphRun indices must refer to the Drawing primary font, at most 1024 glyphs');
 const size=finite(g.fontSize,14);if(!(size>0&&size<=1024))throw new RangeError('Invalid GlyphRun font size');const baseline=g.baselineOrigin;if(!Array.isArray(baseline)||baseline.length!==2||!baseline.every(Number.isFinite))throw new TypeError('Invalid baseline origin');
 if(g.advances!=null&&(!Array.isArray(g.advances)||g.advances.length!==ids.length||!g.advances.every(Number.isFinite)))throw new RangeError('Glyph advances must match glyph count');
 if(g.offsets!=null&&(!Array.isArray(g.offsets)||g.offsets.length!==ids.length||!g.offsets.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))))throw new RangeError('Glyph offsets must match glyph count');
 r[0]=7;r[5]=heap.push(ids.flatMap((id,j)=>[id,fbits(g.advances?.[j]??font.glyphs[id].advance*size),fbits(g.offsets?.[j]?.[0]??0),fbits(g.offsets?.[j]?.[1]??0)]));r[6]=ids.length;r[7]=fbits(size);r[8]=fbits(baseline[0]);r[9]=fbits(baseline[1]);r[2]=packBrush(heap,c.brush,[0,0,drawing.width,drawing.height]);append();
 }else if(c.op==='image'){r[0]=1;const [x,y,w,h]=c.rect;const segs=parsePath(`M ${x} ${y} L ${x+w} ${y} L ${x+w} ${y+h} L ${x} ${y+h} Z`);r[1]=addPath(segs,0,[x,y,x+w,y+h]);r[2]=packBrush(heap,{kind:'image',image:c.image},[x,y,x+w,y+h]);append();
 }else if(['transform','clip','opacity'].includes(c.op)){if(++depth>32)throw new RangeError('Drawing stack exceeds 32');r[0]={transform:3,clip:4,opacity:5}[c.op];if(c.op==='clip'){r[1]=heap.alloc(12);if(r[1]>=16777216)throw new RangeError('Clip pointer exceeds exact f32 address range');}const values=Array.isArray(c.value)?c.value:[c.value];if(c.op==='transform'&&values.length!==6||c.op==='clip'&&values.length!==4)throw new TypeError('Malformed drawing state');values.forEach((v,j)=>{const x=finite(v,NaN);if(!Number.isFinite(x))throw new RangeError('Nonfinite drawing state');r[8+j]=fbits(x);});if(c.op==='transform'&&Math.abs(values[0]*values[3]-values[1]*values[2])<1e-8)throw new RangeError('Drawing transform must be invertible');if(c.op==='opacity'&&(values[0]<0||values[0]>1))throw new RangeError('Opacity must be 0..1');if(c.op==='clip'&&(values[2]<0||values[3]<0))throw new RangeError('Invalid clip rectangle');append();
 }else if(c.op==='pop'){if(--depth<0)throw new Error('Unbalanced drawing pop');r[0]=6;append();}else throw new TypeError(`Unknown drawing command ${c.op}`);
 }
 if(depth)throw new Error('Unbalanced drawing scopes');return heap.push([heap.push(records.flat()),records.length,fbits(finite(drawing.width,0)),fbits(finite(drawing.height,0))]);
}
