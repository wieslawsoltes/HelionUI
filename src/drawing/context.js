import { PathGeometry, RectangleGeometry, EllipseGeometry, Matrix, Rect } from './geometry.js';
export function SolidColorBrush(color,opacity=1) {return {kind:'solid',color,opacity};}
export function GradientStop(color,offset) {return {color,offset};}
export function LinearGradientBrush(stops,start=[0,0],end=[1,1],spread='pad') {return {kind:'linear',stops,start,end,spread};}
export function RadialGradientBrush(stops,center=[.5,.5],radius=[.5,.5],spread='pad') {return {kind:'radial',stops,center,radius,spread};}
export function Pen(brush,thickness=1) {return {brush,thickness};}
export function FormattedText(text,options={}) {return {text:String(text),fontSize:14,...options};}
export function GlyphRun(glyphIndices,{fontSize=14,baselineOrigin=[0,0],advances=null,offsets=null}={}) {return {glyphIndices:Array.from(glyphIndices),fontSize,baselineOrigin:[...baselineOrigin],advances:advances==null?null:Array.from(advances),offsets:offsets==null?null:offsets.map(p=>[...p])};}
export function ImageSource(width,height,pixels) {return {width,height,pixels:Uint8Array.from(pixels)};}
export class DrawingContext {
 constructor({width=640,height=360,maxCommands=4096}={}) {Rect(0,0,width,height);if(!Number.isInteger(maxCommands)||maxCommands<1||maxCommands>4096)throw new RangeError('maxCommands must be 1..4096');this.width=width;this.height=height;this.maxCommands=maxCommands;this.commands=[];this.stack=[];this.closed=false;}
 add(command) {if(this.closed)throw new Error('DrawingContext is closed');if(this.commands.length>=this.maxCommands)throw new RangeError('Drawing command capacity exceeded');this.commands.push(command);return this;}
 drawGeometry(brush,pen,geometry) {geometry=typeof geometry==='string'?PathGeometry(geometry):geometry?.toGeometry?.()||geometry;if(geometry?.kind!=='geometry')throw new TypeError('Expected geometry');return this.add({op:'geometry',brush,pen,geometry});}
 drawRectangle(brush,pen,rect) {return this.drawGeometry(brush,pen,RectangleGeometry(rect));}
 drawRoundedRectangle(brush,pen,rect,radiusX,radiusY=radiusX) {return this.drawGeometry(brush,pen,RectangleGeometry(rect,radiusX,radiusY));}
 drawEllipse(brush,pen,center,radiusX,radiusY=radiusX) {return this.drawGeometry(brush,pen,EllipseGeometry(center,radiusX,radiusY));}
 drawLine(pen,a,b) {return this.drawGeometry(null,pen,PathGeometry(`M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`));}
 drawText(text,origin,brush='#ffffff') {if(typeof text==='string')text=FormattedText(text);return this.add({op:'text',text:{...text},origin:[...origin],brush});}
 drawGlyphRun(brush,glyphRun) {return this.add({op:'glyphrun',brush,glyphRun:structuredClone(glyphRun)});}
 drawImage(image,rect) {return this.add({op:'image',image,rect:Rect(...rect)});}
 drawDrawing(drawing) {const data=drawing?.toDrawing?.()||(drawing instanceof DrawingContext?drawing.close():drawing);if(data?.kind!=='drawing')throw new TypeError('Expected retained drawing');for(const c of data.commands)this.add(structuredClone(c));return this;}
 push(op,value) {if(this.closed||this.commands.length>=this.maxCommands)throw new Error('DrawingContext is closed or full');if(this.stack.length>=32)throw new RangeError('Drawing stack exceeds 32');const token={depth:this.stack.length+1};this.stack.push(token);this.add({op,value});return {dispose:()=>{if(this.stack.at(-1)!==token)throw new Error('Drawing scopes must be disposed in LIFO order');this.pop();}};}
 pushTransform(matrix) {return this.push('transform',Matrix(...matrix));}
 pushClip(rect) {if(!Array.isArray(rect))throw new TypeError('PushClip currently accepts Rect; geometry clips are not implemented');return this.push('clip',Rect(...rect));}
 pushOpacity(opacity) {if(!Number.isFinite(opacity)||opacity<0||opacity>1)throw new RangeError('Opacity must be 0..1');return this.push('opacity',opacity);}
 pop() {if(this.closed||this.commands.length>=this.maxCommands)throw new Error('DrawingContext is closed or full');if(!this.stack.length)throw new Error('Unbalanced DrawingContext.Pop');this.stack.pop();return this.add({op:'pop'});}
 close() {if(this.stack.length)throw new Error('Unbalanced drawing push/pop scopes');this.closed=true;return {kind:'drawing',width:this.width,height:this.height,commands:structuredClone(this.commands)};}
 toView(props={}) {return {type:'Drawing',props:{width:this.width,height:this.height,...props,drawing:this.close()},children:[]};}
 DrawGeometry(a,b,c) {return this.drawGeometry(a,b,c);}
 DrawRectangle(a,b,c) {return this.drawRectangle(a,b,c);}
 DrawRoundedRectangle(a,b,c,d,e) {return this.drawRoundedRectangle(a,b,c,d,e);}
 DrawEllipse(a,b,c,d,e) {return this.drawEllipse(a,b,c,d,e);}
 DrawLine(a,b,c) {return this.drawLine(a,b,c);}
 DrawText(a,b,c) {return this.drawText(a,b,c);}
 DrawGlyphRun(a,b) {return this.drawGlyphRun(a,b);}
 DrawImage(a,b) {return this.drawImage(a,b);}
 DrawDrawing(a) {return this.drawDrawing(a);}
 PushTransform(a) {return this.pushTransform(a);}
 PushClip(a) {return this.pushClip(a);}
 PushOpacity(a) {return this.pushOpacity(a);}
 Pop() {return this.pop();}
 Close() {return this.close();}
}

/** Reusable retained drawing group. Opacity scopes modulate primitives; they do not allocate isolation layers. */
export class DrawingGroup {
 constructor(options={}) {this.options=options;this.context=null;}
 open() {this.context=new DrawingContext(this.options);return this.context;}
 Open() {return this.open();}
 toDrawing() {if(!this.context)throw new Error('Open and populate the drawing group first');return this.context.close();}
 toView(props={}) {if(!this.context)throw new Error('Empty drawing group');return this.context.toView(props);}
}
export function GeometryDrawing(brush,pen,geometry) {const context=new DrawingContext();context.drawGeometry(brush,pen,geometry);return context.close();}
export function GlyphRunDrawing(brush,glyphRun) {const context=new DrawingContext();context.drawGlyphRun(brush,glyphRun);return context.close();}
