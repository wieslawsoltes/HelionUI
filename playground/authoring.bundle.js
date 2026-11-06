// Helion standalone startup worker. No fonts, external scripts or import map.
'use strict';
const __helionModules = Object.create(null);
__helionModules["src/typography/declaration.js"] = (() => {
/** Serializable authoring helper; no dependency on a DOM or the Helion runtime. */
function ShapedText(props={}) {
 if(typeof props==='string')props={text:props};
 if(!props||typeof props!=='object'||Array.isArray(props))throw new TypeError('ShapedText expects text or view properties');
 return {type:'TextBlock',props:{...props,textShaping:'opentype'},children:[]};
}

return { ShapedText };
})();
__helionModules["src/core/colors.js"] = (() => {
/** CSS named/hex/rgb/hsl color authoring. Packed little-endian RGBA, alpha last. */
const named={"aliceblue":"#F0F8FF","antiquewhite":"#FAEBD7","aqua":"#00FFFF","aquamarine":"#7FFFD4","azure":"#F0FFFF","beige":"#F5F5DC","bisque":"#FFE4C4","black":"#000000","blanchedalmond":"#FFEBCD","blue":"#0000FF","blueviolet":"#8A2BE2","brown":"#A52A2A","burlywood":"#DEB887","cadetblue":"#5F9EA0","chartreuse":"#7FFF00","chocolate":"#D2691E","coral":"#FF7F50","cornflowerblue":"#6495ED","cornsilk":"#FFF8DC","crimson":"#DC143C","cyan":"#00FFFF","darkblue":"#00008B","darkcyan":"#008B8B","darkgoldenrod":"#B8860B","darkgray":"#A9A9A9","darkgreen":"#006400","darkgrey":"#A9A9A9","darkkhaki":"#BDB76B","darkmagenta":"#8B008B","darkolivegreen":"#556B2F","darkorange":"#FF8C00","darkorchid":"#9932CC","darkred":"#8B0000","darksalmon":"#E9967A","darkseagreen":"#8FBC8F","darkslateblue":"#483D8B","darkslategray":"#2F4F4F","darkslategrey":"#2F4F4F","darkturquoise":"#00CED1","darkviolet":"#9400D3","deeppink":"#FF1493","deepskyblue":"#00BFFF","dimgray":"#696969","dimgrey":"#696969","dodgerblue":"#1E90FF","firebrick":"#B22222","floralwhite":"#FFFAF0","forestgreen":"#228B22","fuchsia":"#FF00FF","gainsboro":"#DCDCDC","ghostwhite":"#F8F8FF","gold":"#FFD700","goldenrod":"#DAA520","gray":"#808080","green":"#008000","greenyellow":"#ADFF2F","grey":"#808080","honeydew":"#F0FFF0","hotpink":"#FF69B4","indianred":"#CD5C5C","indigo":"#4B0082","ivory":"#FFFFF0","khaki":"#F0E68C","lavender":"#E6E6FA","lavenderblush":"#FFF0F5","lawngreen":"#7CFC00","lemonchiffon":"#FFFACD","lightblue":"#ADD8E6","lightcoral":"#F08080","lightcyan":"#E0FFFF","lightgoldenrodyellow":"#FAFAD2","lightgray":"#D3D3D3","lightgreen":"#90EE90","lightgrey":"#D3D3D3","lightpink":"#FFB6C1","lightsalmon":"#FFA07A","lightseagreen":"#20B2AA","lightskyblue":"#87CEFA","lightslategray":"#778899","lightslategrey":"#778899","lightsteelblue":"#B0C4DE","lightyellow":"#FFFFE0","lime":"#00FF00","limegreen":"#32CD32","linen":"#FAF0E6","magenta":"#FF00FF","maroon":"#800000","mediumaquamarine":"#66CDAA","mediumblue":"#0000CD","mediumorchid":"#BA55D3","mediumpurple":"#9370DB","mediumseagreen":"#3CB371","mediumslateblue":"#7B68EE","mediumspringgreen":"#00FA9A","mediumturquoise":"#48D1CC","mediumvioletred":"#C71585","midnightblue":"#191970","mintcream":"#F5FFFA","mistyrose":"#FFE4E1","moccasin":"#FFE4B5","navajowhite":"#FFDEAD","navy":"#000080","oldlace":"#FDF5E6","olive":"#808000","olivedrab":"#6B8E23","orange":"#FFA500","orangered":"#FF4500","orchid":"#DA70D6","palegoldenrod":"#EEE8AA","palegreen":"#98FB98","paleturquoise":"#AFEEEE","palevioletred":"#DB7093","papayawhip":"#FFEFD5","peachpuff":"#FFDAB9","peru":"#CD853F","pink":"#FFC0CB","plum":"#DDA0DD","powderblue":"#B0E0E6","purple":"#800080","rebeccapurple":"#663399","red":"#FF0000","rosybrown":"#BC8F8F","royalblue":"#4169E1","saddlebrown":"#8B4513","salmon":"#FA8072","sandybrown":"#F4A460","seagreen":"#2E8B57","seashell":"#FFF5EE","sienna":"#A0522D","silver":"#C0C0C0","skyblue":"#87CEEB","slateblue":"#6A5ACD","slategray":"#708090","slategrey":"#708090","snow":"#FFFAFA","springgreen":"#00FF7F","steelblue":"#4682B4","tan":"#D2B48C","teal":"#008080","thistle":"#D8BFD8","tomato":"#FF6347","turquoise":"#40E0D0","violet":"#EE82EE","wheat":"#F5DEB3","white":"#FFFFFF","whitesmoke":"#F5F5F5","yellow":"#FFFF00","yellowgreen":"#9ACD32"};

const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
function byte(v){const n=Number(v);if(!Number.isFinite(n))throw new TypeError('Finite color component required');return Math.round(clamp(n,0,255));}
function ColorFromArgb(a,r,g,b){return (byte(r)|(byte(g)<<8)|(byte(b)<<16)|(byte(a)<<24))>>>0;}
function parseColor(value,fallback=0){
 if(value==null)return fallback>>>0;if(Number.isInteger(value))return value>>>0;
 if(typeof value!=='string')throw new TypeError('Color must be a CSS string or packed RGBA');
 let text=value.trim().toLowerCase();if(text==='transparent')return 0;if(named[text])text=named[text];
 if(/^#[0-9a-f]{3,4}$/i.test(text))text='#'+[...text.slice(1)].map(x=>x+x).join('');
 if(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(text)){const s=text.slice(1);return ColorFromArgb(parseInt(s.slice(6,8)||'ff',16),parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16));}
 const m=text.match(/^(rgba?|hsla?)\(([^()]*)\)$/);if(!m)throw new TypeError(`Unsupported color ${value}`);
 const parts=m[2].trim().split(/\s*[,/]\s*|\s+/).filter(Boolean);if(parts.length<3||parts.length>4)throw new TypeError('Color requires three components and optional alpha');
 const number=s=>{if(!/^[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?(?:%|deg)?$/i.test(s))throw new TypeError('Malformed color component');const n=parseFloat(s);if(!Number.isFinite(n))throw new TypeError('Nonfinite color');return n;};
 if(parts[3]?.endsWith('deg')||(m[1].startsWith('rgb')&&parts.slice(0,3).some(x=>x.endsWith('deg')))||(!m[1].startsWith('rgb')&&parts[0].endsWith('%')))throw new TypeError('Invalid color component units');
 const alpha=parts[3]==null?1:clamp(number(parts[3])/(parts[3].endsWith('%')?100:1),0,1);let rgb;
 if(m[1].startsWith('rgb')){rgb=parts.slice(0,3).map(x=>number(x)*(x.endsWith('%')?255/100:1));}
 else{if(!parts[1].endsWith('%')||!parts[2].endsWith('%'))throw new TypeError('HSL saturation and lightness require percentages');const hue=((number(parts[0])%360)+360)%360/60,s=clamp(number(parts[1])/100,0,1),l=clamp(number(parts[2])/100,0,1),c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs(hue%2-1)),offset=l-c/2;
 rgb=([[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.floor(hue)]).map(v=>(v+offset)*255);}
 return ColorFromArgb(alpha*255,...rgb);
}
const Color=Object.freeze({Parse:parseColor,FromArgb:ColorFromArgb,FromRgb:(r,g,b)=>ColorFromArgb(255,r,g,b)});

return { ColorFromArgb, parseColor, Color };
})();
__helionModules["src/core/schema.js"] = (() => {
const { parseColor } = __helionModules["src/core/colors.js"];

/** Host/GPU ABI. All offsets are 32-bit words; nodes are 288-byte aligned records. */
const VERSION = 3;
const Kind = Object.freeze({ Grid: 1, StackPanel: 2, Canvas: 3, Border: 4, TextBlock: 5, Button: 6, CheckBox: 7, Slider: 8, TextBox: 9, ProgressBar: 10, DataGrid: 11, Path: 12, ScrollViewer: 13, Panel: 14, DockPanel: 15, WrapPanel: 16, UniformGrid: 17, Viewbox: 18, Drawing: 19, ContentControl: 20, ContentPresenter: 21, TextEditor:22, CodeEditor:23, DockWorkspace:24, DockItem:25, SurfacePresenter:26, ListBox:27, TreeView:28,Modal:29, DesignSurface:30, DesignTree:31, PropertyInspector:32, AnimationTimeline:33, ColorPicker:34, DesignAdorner:35, NativeContentPresenter:36 });
const Action = Object.freeze({ none: 0, toggle: 1, increment: 2, set: 3, animations: 4, theme: 5, bounds: 6, clear: 7, page: 8, resetScroll: 9, model:10, editor:11, dock:12, host:13, designer:14, template:15 });
const Opcode = Object.freeze({ Move: 1, Down: 2, Up: 3, Wheel: 4, Key: 5, Text: 6, Set: 7, Cancel: 8, Animation: 9, Editor:10, Dock:11, Model:12, Data:13, Controls:14, Designer:15, Template:16 });
const Property = Object.freeze({ value: 0, width: 1, height: 2, opacity: 3, translateX: 4, translateY: 5, scaleX: 6, scaleY: 7, rotation: 8, visible: 9, scrollY: 10, padding: 11, textClear: 12 });
const Key = Object.freeze({ Backspace: 8, Tab: 9, Enter: 13, Escape: 27, Space: 32, End: 35, Home: 36, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Delete: 46, PageUp: 33, PageDown: 34, A:65, C:67, V:86, X:88, D:68, F:70, G:71, H:72, L:76, P:80, Y:89, Z:90, Insert:45, F3:114, Slash:191, BracketLeft:219, BracketRight:221, Equal:187, Minus:189 });
const Flags = Object.freeze({ interactive: 1, horizontal: 2, wrap: 4, clip: 8, disabled: 16, hidden: 32, editable: 64 });
const Source = Object.freeze({ none: 0, value: 1, matched: 2, selected: 3, nodes: 4, strips: 5, upload: 6, frame: 7, layout: 8, rows: 9, overflow: 10, activePage: 11 });
const AUTO_TARGET = 0xffffffff;
const NODE_WORDS = 72;
const CONTROL_WORDS = 16;
const GLOBAL_WORDS = 64;
const EVENT_WORDS = 8;
const TABLE_WORDS = 40;
const COLUMN_WORDS = 8;
const PATH_WORDS = 12;
const DEFAULT_LIMITS = Object.freeze({ maxHeapWords: 16777216, maxNodes: 512, maxDepth: 24, maxRows: 65536, maxColumns: 8, textCapacity: 256, maxPrimitives: 16384, maxJobs: 131072, maxStrips: 262144, maxAlphaTiles: 196608, maxTileEntries: 256, maxDimension: 8192, maxRenderTiles: 65536, glyphCacheSlots: 2048 });
// Synchronous numeric conversion uses one scratch word per JS realm, not three
// allocations per coordinate. Coerce before writing: user-defined valueOf may reenter.
const bitScratch = new ArrayBuffer(4), bitFloat = new Float32Array(bitScratch), bitUint = new Uint32Array(bitScratch);
const fbits = value => { const n = +value; bitFloat[0] = n; return bitUint[0]; };
const fromBits = bits => { const n = +bits; bitUint[0] = n; return bitFloat[0]; };
const align = (n, a) => Math.ceil(n / a) * a;
const nextPowerOfTwo = n => 2 ** Math.ceil(Math.log2(Math.max(1, n)));
const rgba = parseColor;
function finite(value, fallback, label = 'number') {
  if (value == null) return fallback;
  const n = Number(value); if (!Number.isFinite(n) || !Number.isFinite(Math.fround(n))) throw new TypeError(`Invalid ${label}: ${value}`); return n;
}
function tracks(value = '*') {
  const list = Array.isArray(value) ? value : String(value).trim().split(/[ ,]+/);
  if (!list.length || list.length > 32) throw new RangeError('Grid supports 1–32 tracks per axis');
  return list.map(v => {
    if (String(v).toLowerCase() === 'auto') return [1, 0];
    if (String(v).endsWith('*')) { const n = Number(String(v).slice(0, -1) || 1); if (!(n > 0 && Number.isFinite(n) && Number.isFinite(Math.fround(n)))) throw new RangeError('Star weight must be positive'); return [2, n]; }
    const n = Number(v); if (!(n >= 0 && Number.isFinite(n) && Number.isFinite(Math.fround(n)))) throw new RangeError('Pixel track must be nonnegative'); return [0, n];
  });
}

return { VERSION, Kind, Action, Opcode, Property, Key, Flags, Source, AUTO_TARGET, NODE_WORDS, CONTROL_WORDS, GLOBAL_WORDS, EVENT_WORDS, TABLE_WORDS, COLUMN_WORDS, PATH_WORDS, DEFAULT_LIMITS, fbits, fromBits, align, nextPowerOfTwo, rgba, finite, tracks };
})();
__helionModules["src/templates/preferences.js"] = (() => {
const { rgba } = __helionModules["src/core/schema.js"];

/** Initial configuration/inspection helpers. Live palette selection executes in WGSL. */
function normalizeThemeSettings(options={}) {
 const themeContrast=options.themeContrast??'standard';
 const controlDensity=options.controlDensity??'comfortable';
 if(!['standard','high'].includes(themeContrast))throw new TypeError('themeContrast must be standard or high');
 if(!['comfortable','compact'].includes(controlDensity))throw new TypeError('controlDensity must be comfortable or compact');
 const accentColor=options.accentColor==null?null:rgba(options.accentColor);
 if(accentColor!==null&&(accentColor>>>24)!==255)throw new RangeError('Accent colors must be opaque');
 return {themeContrast,controlDensity,accentColor};
}
function themeAccentColors(color) {
 const packed=rgba(color);if((packed>>>24)!==255)throw new RangeError('Accent colors must be opaque');
 const c=[0,8,16].map(s=>(packed>>>s&255)/255),linear=c.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const lightText=(linear[0]*.2126+linear[1]*.7152+linear[2]*.0722)<.179;
 const toward=lightText?0:1;
 const tint=percent=>[0,8,16].reduce((n,shift)=>{const channel=packed>>>shift&255;return (n|(Math.floor((channel*(100-percent)+toward*255*percent+50)/100)<<shift))>>>0;},0xff000000);
 return {accent:packed,accentText:lightText?0xffffffff:0xff000000,accentHover:tint(10),accentPressed:tint(18),accentStroke:packed};
}
function resolveThemePalette(theme,variant='dark',options={}) {
 if(!theme||!['dark','light'].includes(variant)||!theme[variant])throw new TypeError('Expected a prepared theme and dark/light variant');
 const p=normalizeThemeSettings(options);
 return {...theme[variant],...(p.themeContrast==='high'?(variant==='dark'?theme.contrastDark:theme.contrastLight):{}),...(p.controlDensity==='compact'?theme.compact:{}),...(p.accentColor!==null&&p.themeContrast!=='high'?themeAccentColors(p.accentColor):{})};
}

return { normalizeThemeSettings, themeAccentColors, resolveThemePalette };
})();
__helionModules["src/templates/schema.js"] = (() => {
/** Template wire records. Addresses and offsets are 32-bit words. */
const TEMPLATE_MAGIC=0x48545031;
const TEMPLATE_INFO_WORDS=20;
const TEMPLATE_PLAN_WORDS=24;
const TEMPLATE_RULE_WORDS=16;
const TEMPLATE_VALUE_WORDS=8;
const TemplateCommand=Object.freeze({theme:0,state:1,automatic:2,reducedMotion:3,clearLocalValue:4,accent:5,resetAccent:6,contrast:7,density:8});
// category: 0 packed color; 1 float; 2 boolean; 3 uint; 4 string alias.
const templateProperties=Object.freeze({
 background:[0,20],foreground:[0,21],borderColor:[0,22],radius:[1,23],borderWidth:[1,35],
 width:[1,8],height:[1,9],minWidth:[1,10],minHeight:[1,11],maxWidth:[1,12],maxHeight:[1,13],
 padding:[1,14],gap:[1,15],fontSize:[1,34],x:[1,32],y:[1,33],
 opacity:[1,75],translateX:[1,80],translateY:[1,81],scaleX:[1,82],scaleY:[1,83],rotation:[1,84],value:[1,72],
 disabled:[2,16],hidden:[2,32],wrap:[2,4],horizontalAlignment:[3,24],verticalAlignment:[3,25],
 text:[4,6],actualWidth:[1,54],actualHeight:[1,55]
});
const templateLayoutProperties=new Set(['width','height','minWidth','minHeight','maxWidth','maxHeight','padding','gap','fontSize','x','y','hidden','wrap','horizontalAlignment','verticalAlignment','text']);
const templateReadableStates=Object.freeze({isPointerOver:1,isPressed:2,isFocused:4,isChecked:8,isEnabled:16,isVisible:256});

return { TEMPLATE_MAGIC, TEMPLATE_INFO_WORDS, TEMPLATE_PLAN_WORDS, TEMPLATE_RULE_WORDS, TEMPLATE_VALUE_WORDS, TemplateCommand, templateProperties, templateLayoutProperties, templateReadableStates };
})();
__helionModules["src/layout/properties.js"] = (() => {
/** Declarative compatibility adapters. They normalize authoring syntax only;
 * geometry is measured and arranged by layout.wgsl, not by these helpers. */
const Dock = Object.freeze({ Left:'left', Top:'top', Right:'right', Bottom:'bottom' });
const Orientation = Object.freeze({ Horizontal:'horizontal', Vertical:'vertical' });
const Stretch = Object.freeze({ None:'none', Fill:'fill', Uniform:'uniform', UniformToFill:'uniformToFill' });
function Thickness(left=0,top=left,right=left,bottom=top) {
  const a=[left,top,right,bottom].map(Number); if(!a.every(Number.isFinite)) throw new TypeError('Thickness requires finite values'); return a;
}
function GridLength(value=1,unit='star') {
  unit=String(unit).toLowerCase(); if(unit==='auto') return 'auto';
  value=Number(value); if(!Number.isFinite(value)||value<0||(unit==='star'&&value===0)) throw new RangeError('Invalid GridLength');
  if(!['star','pixel'].includes(unit)) throw new TypeError('GridLength unit must be auto, pixel or star');
  return unit==='star'?`${value}*`:value;
}
function RowDefinition(height='*',min=0,max=1e7) {return {length:height,min,max};}
function ColumnDefinition(width='*',min=0,max=1e7) {return {length:width,min,max};}
const aliases = Object.freeze({
 Name:'id','x:Name':'id',Content:'content',Child:'content',Children:'children',
 RowDefinitions:'rows',ColumnDefinitions:'columns',Spacing:'gap',CornerRadius:'radius',
 BorderBrush:'borderColor',BorderThickness:'borderWidth',IsEnabled:'isEnabled',IsVisible:'isVisible',
 Classes:'classes',Styles:'styles',Resources:'resources',RenderTransform:'renderTransform',RenderTransformOrigin:'renderTransformOrigin',
 'Grid.Row':'row','Grid.Column':'column','Grid.RowSpan':'rowSpan','Grid.ColumnSpan':'columnSpan',
 'Canvas.Left':'x','Canvas.Top':'y','Canvas.Right':'right','Canvas.Bottom':'bottom','DockPanel.Dock':'dock',
 TextWrapping:'wrap',ClipToBounds:'clip',Fill:'foreground',StrokeThickness:'stroke',Data:'path',
 HorizontalSpacing:'columnSpacing',VerticalSpacing:'rowSpacing',Transitions:'transitions'
});
const semanticAliases=Object.freeze({spacing:'gap',cornerRadius:'radius',borderBrush:'borderColor',borderThickness:'borderWidth',clipToBounds:'clip',textWrapping:'wrap',rowDefinitions:'rows',columnDefinitions:'columns',horizontalSpacing:'columnSpacing',verticalSpacing:'rowSpacing',gridRow:'row',gridColumn:'column',gridRowSpan:'rowSpan',gridColumnSpan:'columnSpan'});
function propertyName(name) {const value=aliases[name]||name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()).replace(/^[A-Z]/,c=>c.toLowerCase());return semanticAliases[value]||value;}
function normalizeProperties(input={}) {
 const p={}; for(const [name,value] of Object.entries(input)) {const key=propertyName(name); if(Object.hasOwn(p,key)) throw new TypeError(`Duplicate property ${key}`); p[key]=value;}
 for(const key of ['horizontalAlignment','verticalAlignment']) if(p[key]!=null && !p[key]?.resource && !p[key]?.kind) {
  const a=String(p[key]).toLowerCase(); p[key]=({left:'start',top:'start',right:'end',bottom:'end'})[a]||a;
 }
 for(const key of ['orientation','dock','fontStyle','textAlignment','fillRule','stretchDirection']) if(p[key]!=null && !p[key]?.resource && !p[key]?.kind) p[key]=String(p[key]).toLowerCase();
 if(p.stretch!=null && !p.stretch?.resource && !p.stretch?.kind) {const s=String(p.stretch).toLowerCase();p.stretch=s==='uniformtofill'?'uniformToFill':s;}
 if(p.wrap!=null && typeof p.wrap==='string') p.wrap=['wrap','true'].includes(p.wrap.toLowerCase());
 if(p.isEnabled!=null && !p.isEnabled?.resource && !p.isEnabled?.kind) {if(typeof p.isEnabled==='string')p.isEnabled=p.isEnabled.toLowerCase()==='true';p.disabled=!p.isEnabled;delete p.isEnabled;}
 if(p.isVisible!=null && !p.isVisible?.resource && !p.isVisible?.kind) {if(typeof p.isVisible==='string')p.isVisible=p.isVisible.toLowerCase()==='true';p.hidden=!p.isVisible;delete p.isVisible;}
 if(p.fontWeight!=null && typeof p.fontWeight==='string' && !/^\d+$/.test(p.fontWeight)) {
  const weights={thin:100,light:300,normal:400,regular:400,medium:500,semibold:600,bold:700,black:900};
  if(!(p.fontWeight.toLowerCase() in weights)) throw new TypeError('Unknown font weight'); p.fontWeight=weights[p.fontWeight.toLowerCase()];
 }
 for(const k of ['width','height']) if(typeof p[k]==='string' && p[k].toLowerCase()==='auto') p[k]='auto';
 return p;
}

return { Dock, Orientation, Stretch, Thickness, GridLength, RowDefinition, ColumnDefinition, propertyName, normalizeProperties };
})();
__helionModules["src/templates/definitions.js"] = (() => {
const { propertyName,normalizeProperties } = __helionModules["src/layout/properties.js"];

const { templateProperties,templateReadableStates } = __helionModules["src/templates/schema.js"];

const own=(o,k)=>Object.hasOwn(o,k);
function templateProperty(name){const p=propertyName(String(name));return ({content:'text',isChecked:'value',cornerRadius:'radius',borderBrush:'borderColor',borderThickness:'borderWidth'})[p]??p;}
function TemplateBinding(property,options={}){
 property=templateProperty(property);if(!own(templateProperties,property)&&!own(templateReadableStates,property))throw new TypeError(`Unknown templated-parent property ${property}`);
 const {scale=1,offset=0,min=-1e7,max=1e7,relativeTo=null,relativeOffset=0,mode='oneWay',negate=false}=options;
 if(![scale,offset,min,max,relativeOffset].every(n=>typeof n==='number'&&Number.isFinite(n)&&Number.isFinite(Math.fround(n)))||min>max)throw new RangeError('Invalid TemplateBinding numeric transform');
 if(!['oneWay','twoWay'].includes(mode))throw new TypeError('TemplateBinding mode must be oneWay or twoWay');
 if(relativeTo&&!['actualWidth','actualHeight'].includes(relativeTo))throw new TypeError('relativeTo must be actualWidth or actualHeight');
 if(mode==='twoWay'&&(property!=='value'||relativeTo||relativeOffset!==0||negate||scale!==1||offset!==0||min!==-1e7||max!==1e7))throw new TypeError('Two-way TemplateBinding supports an unconverted value only');
 return {kind:'templateBinding',property,scale,offset,min,max,relativeTo,relativeOffset,mode,negate:!!negate};
}
function ThemeResource(key){if(typeof key!=='string'||!key||key.length>128)throw new TypeError('ThemeResource key required');return {kind:'themeResource',key};}
function VisualState(name,setters={},options={}){return {name,setters,...options};}
function VisualStateGroup(name,states){return {name,states};}
function ControlTemplate(targetType,root,options={}){
 if(typeof targetType==='object'&&targetType){const o=targetType;return ControlTemplate(o.targetType,o.root,{...o});}
 if(!['Button','CheckBox','Slider','TextBox','ProgressBar','ContentControl','ContentPresenter','Panel','Border'].includes(targetType))throw new TypeError(`Unsupported ControlTemplate target ${targetType}`);
 if(!root||typeof root.type!=='string')throw new TypeError('ControlTemplate needs a declarative root');
 const name=options.name??`${targetType}Template`;if(typeof name!=='string'||!name||name.length>128)throw new TypeError('Template name required');
 return {kind:'controlTemplate',name,targetType,root:structuredClone(root),visualStateGroups:structuredClone(options.visualStateGroups??options.states??[]),defaults:normalizeProperties(options.defaults??{})};
}
function validateControlTemplate(value){
 if(!value||value.kind!=='controlTemplate')throw new TypeError('Expected ControlTemplate');
 const t=ControlTemplate(value);const active=new Set(),names=new Set();let count=0,content=0,native=0,maxDepth=0;const nativeNames=new Set();
 const walk=(n,depth)=>{if(!n||typeof n.type!=='string'||!Array.isArray(n.children))throw new TypeError('Template nodes require type, props and children');if(active.has(n))throw new TypeError('Cyclic template');active.add(n);if(++count>64||depth>12)throw new RangeError('Templates support 64 parts and depth 12');maxDepth=Math.max(maxDepth,depth);const p=normalizeProperties(n.props??{});const name=p.id;if(name!=null){if(typeof name!=='string'||!/^[A-Za-z_][\w.-]*$/.test(name)||names.has(name))throw new TypeError(`Invalid or duplicate template part ${name}`);names.add(name);}
  if(n.type==='ContentPresenter')content++;if(n.type==='NativeContentPresenter'){native++;if(name)nativeNames.add(name);if(n.children.length)throw new TypeError('NativeContentPresenter cannot own children');if(p.text!=null&&!(p.text.kind==='templateBinding'&&templateProperty(p.text.property)==='text'))throw new TypeError('NativeContentPresenter text must bind to its parent');}
  if(p.models||p.designDocument||['DesignSurface','DockWorkspace','SurfacePresenter'].includes(n.type))throw new TypeError('Template parts cannot own a designer, dock workspace, embedded surface, or model schema');
  for(const child of n.children)walk(child,depth+1);active.delete(n);
 };walk(t.root,0);if(content>1||native>1)throw new RangeError('A template has at most one content slot and one native content slot');
 if(t.targetType==='TextBox'&&native!==1)throw new TypeError('TextBox templates require one NativeContentPresenter');
 if(native&&t.targetType!=='TextBox')throw new TypeError('NativeContentPresenter currently serves TextBox editing; other controls use declarative parts');
 const groupNames=new Set();if(!Array.isArray(t.visualStateGroups)||t.visualStateGroups.length>8)throw new RangeError('At most eight visual state groups');
 for(const group of t.visualStateGroups){if(typeof group.name!=='string'||!group.name||groupNames.has(group.name))throw new TypeError('Unique visual state group names required');groupNames.add(group.name);if(!Array.isArray(group.states)||!group.states.length||group.states.length>16)throw new RangeError('Groups need 1–16 states');const states=new Set();for(const s of group.states){if(typeof s.name!=='string'||!s.name||states.has(s.name))throw new TypeError('Unique visual state names required');states.add(s.name);if(s.duration!=null&&(!(s.duration>=0)||!Number.isFinite(s.duration)||s.duration>10))throw new RangeError('State duration is 0–10 seconds');if(!s.setters||typeof s.setters!=='object'||Array.isArray(s.setters))throw new TypeError('Visual state setters must map named parts to property dictionaries');for(const [part,props]of Object.entries(s.setters)){if(!names.has(part))throw new ReferenceError(`Unknown visual state part ${part}`);for(const property of Object.keys(props)){const p=templateProperty(property);if(nativeNames.has(part)&&p==='text')throw new TypeError('Visual states cannot replace native editor text');if(!own(templateProperties,p)||p.startsWith('actual'))throw new TypeError(`Unsupported state setter ${property}`);}}}}
 return {...t,partCount:count,maxPartDepth:maxDepth};
}

return { templateProperty, TemplateBinding, ThemeResource, VisualState, VisualStateGroup, ControlTemplate, validateControlTemplate };
})();
__helionModules["src/templates/themes.js"] = (() => {
const { ControlTemplate,TemplateBinding: B,ThemeResource: R } = __helionModules["src/templates/definitions.js"];

const node=(type,props={},...children)=>({type,props,children:children.flat()});
const group=(name,states)=>({name,states});
const state=(name,when,setters={},duration=.12)=>({name,when,setters,duration,easing:'smooth'});
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
// A separate, inset overlay never changes content padding or border measurement.
const ring=(props={})=>node('Border',{id:'FocusRing',margin:2,radius:R('radius'),background:'transparent',borderColor:R('focus'),borderWidth:2,opacity:0,...props});
const focus=()=>group('FocusStates',[state('Unfocused',{},{}),state('Focused',{focus:true,disabled:false},{FocusRing:{opacity:1}},.08)]);
function buttonTemplate(name='Button',tone='standard'){
 const tokens=tone==='accent'?['accent','accentHover','accentPressed','accentText']:tone==='destructive'?['danger','dangerHover','dangerPressed','dangerText']:tone==='subtle'?['subtle','subtleHover','subtlePressed','text']:['control','controlHover','controlPressed','text'];
 return ControlTemplate('Button',node('Grid',{id:'Layout'},
  node('Border',{id:'Chrome',background:B('background'),borderColor:B('borderColor'),borderWidth:B('borderWidth'),radius:B('radius'),padding:B('padding')},
   node('ContentPresenter',{id:'Content',foreground:B('foreground'),fontSize:B('fontSize'),horizontalAlignment:'center',verticalAlignment:'center'})),ring({radius:B('radius')})),{
  name,defaults:{background:R(tokens[0]),foreground:R(tokens[3]),borderColor:R(tone==='standard'?'stroke':tone==='subtle'?'subtle':tone==='destructive'?'danger':'accentStroke'),borderWidth:1,radius:R('radius'),padding:R('controlPadding'),minHeight:R('controlHeight')},
  visualStateGroups:[group('CommonStates',[
   state('Normal',{},{}),state('PointerOver',{pointerover:true,disabled:false},{Chrome:{background:R(tokens[1])}}),
   state('Pressed',{pressed:true,disabled:false},{Chrome:{background:R(tokens[2])}},.08),
   state('Disabled',{disabled:true},{Chrome:{background:R('disabledSurface'),borderColor:R('disabledStroke')},Content:{foreground:R('disabledText')}},.08)
  ]),focus()]
 });
}
const ButtonTemplate=freeze(buttonTemplate());
const AccentButtonTemplate=freeze(buttonTemplate('AccentButton','accent'));
const SubtleButtonTemplate=freeze(buttonTemplate('SubtleButton','subtle'));
const DestructiveButtonTemplate=freeze(buttonTemplate('DestructiveButton','destructive'));
const CheckBoxTemplate=freeze(ControlTemplate('CheckBox',node('Grid',{id:'Layout',columns:'22 *',gap:9},
 node('Border',{id:'Box',width:20,height:20,verticalAlignment:'center',radius:R('checkRadius'),background:R('field'),borderColor:R('stroke'),borderWidth:1}),
 node('Path',{id:'Check',width:14,height:14,margin:3,verticalAlignment:'center',path:'M 1 7 L 5 11 L 13 2',stroke:2,viewBox:[0,0,14,14],foreground:R('accentText'),opacity:0}),
 node('ContentPresenter',{id:'Content',column:1,verticalAlignment:'center',foreground:B('foreground'),fontSize:B('fontSize')}),
 ring({width:22,height:22,margin:0,verticalAlignment:'center',radius:R('checkRadius')})),{
 name:'CheckBox',defaults:{foreground:R('text'),minHeight:R('selectionHeight')},visualStateGroups:[
 group('CheckStates',[state('Unchecked',{},{}),state('Checked',{checked:true},{Box:{background:R('accent'),borderColor:R('accent')},Check:{opacity:1}})]),
 group('CommonStates',[state('Normal',{},{}),state('PointerOver',{pointerover:true,disabled:false},{Box:{borderColor:R('focus')}},.08),state('Pressed',{pressed:true,disabled:false},{Box:{borderColor:R('focus'),borderWidth:2}},.08),state('Disabled',{disabled:true},{Box:{background:R('disabledSurface'),borderColor:R('disabledStroke')},Content:{foreground:R('disabledText')},Check:{foreground:R('disabledText')}},.08)]),focus()]
}));
const SliderTemplate=freeze(ControlTemplate('Slider',node('Grid',{id:'Layout',margin:[8,0]},
 node('Border',{id:'Track',height:4,verticalAlignment:'center',radius:2,background:R('track')}),
 node('Border',{id:'Fill',height:4,verticalAlignment:'center',radius:2,background:R('accent'),scaleX:B('value',{min:0,max:1}),renderTransformOrigin:[0,.5]}),
 node('Border',{id:'Thumb',width:16,height:16,horizontalAlignment:'start',verticalAlignment:'center',margin:[-8,0,0,0],radius:8,background:R('thumb'),borderColor:R('accent'),borderWidth:3,translateX:B('value',{min:0,max:1,relativeTo:'actualWidth',relativeOffset:-16})}),
 ring({width:22,height:22,horizontalAlignment:'start',verticalAlignment:'center',margin:[-11,0,0,0],radius:11,translateX:B('value',{min:0,max:1,relativeTo:'actualWidth',relativeOffset:-16})})),{
 name:'Slider',defaults:{height:32,minWidth:120},visualStateGroups:[group('CommonStates',[state('Normal',{},{}),state('PointerOver',{pointerover:true,disabled:false},{Thumb:{borderWidth:4}},.08),state('Pressed',{pressed:true,disabled:false},{Thumb:{borderWidth:5}},.08),state('Disabled',{disabled:true},{Track:{background:R('disabledStroke')},Fill:{background:R('disabledText')},Thumb:{borderColor:R('disabledStroke'),background:R('disabledSurface')}},.08)]),focus()]
}));
const TextBoxTemplate=freeze(ControlTemplate('TextBox',node('Grid',{id:'Layout'},
 node('Border',{id:'Chrome',background:B('background'),borderColor:B('borderColor'),borderWidth:B('borderWidth'),radius:B('radius')},node('NativeContentPresenter',{id:'PART_ContentHost',foreground:B('foreground'),fontSize:B('fontSize')})),ring({radius:B('radius')})),{
 name:'TextBox',defaults:{background:R('field'),foreground:R('text'),borderColor:R('stroke'),borderWidth:1,radius:R('radius'),minHeight:R('fieldHeight')},visualStateGroups:[group('CommonStates',[state('Normal',{},{}),state('PointerOver',{pointerover:true,disabled:false},{Chrome:{background:R('fieldHover'),borderColor:R('focus')}},.1),state('Disabled',{disabled:true},{Chrome:{background:R('disabledSurface'),borderColor:R('disabledStroke')},PART_ContentHost:{foreground:R('disabledText')}},.08)]),focus()]
}));
const ProgressBarTemplate=freeze(ControlTemplate('ProgressBar',node('Grid',{id:'Layout'},node('Border',{id:'Track',background:R('track'),radius:4}),node('Border',{id:'Indicator',background:B('foreground'),radius:4,scaleX:B('value',{min:0,max:1}),renderTransformOrigin:[0,.5]})),{name:'ProgressBar',defaults:{height:6,minWidth:80,foreground:R('accent')}}));
const ToggleSwitchTemplate=freeze(ControlTemplate('CheckBox',node('Grid',{id:'Layout',columns:'42 *',gap:10},
 node('Border',{id:'Track',width:40,height:22,verticalAlignment:'center',radius:11,background:R('track'),borderColor:R('stroke'),borderWidth:1}),
 node('Border',{id:'Thumb',width:16,height:16,horizontalAlignment:'start',verticalAlignment:'center',margin:[3,0,0,0],background:R('thumb'),radius:8}),
 node('ContentPresenter',{id:'Content',column:1,verticalAlignment:'center',foreground:B('foreground'),fontSize:B('fontSize')}),
 ring({width:42,height:24,margin:0,verticalAlignment:'center',radius:12})),{
 name:'ToggleSwitch',defaults:{foreground:R('text'),minHeight:R('selectionHeight')},visualStateGroups:[group('CheckStates',[state('Off',{},{}),state('On',{checked:true},{Thumb:{translateX:18},Track:{background:R('accent'),borderColor:R('accent')}},.16)]),group('CommonStates',[state('Normal',{},{}),state('PointerOver',{pointerover:true,disabled:false},{Track:{borderColor:R('focus'),borderWidth:2}},.08),state('Disabled',{disabled:true},{Track:{background:R('disabledStroke'),borderColor:R('disabledStroke')},Thumb:{background:R('disabledText')},Content:{foreground:R('disabledText')}},.08)]),focus()]
}));
const ContentControlTemplate=freeze(ControlTemplate('ContentControl',node('Border',{id:'Chrome',background:B('background'),radius:B('radius'),padding:B('padding'),borderColor:B('borderColor'),borderWidth:B('borderWidth')},node('ContentPresenter',{id:'Content',foreground:B('foreground'),fontSize:B('fontSize')})),{name:'ContentControl',defaults:{foreground:R('text'),background:R('surface'),radius:R('panelRadius'),padding:R('panelPadding')}}));
const ToggleButtonTemplate=freeze(ControlTemplate('CheckBox',ButtonTemplate.root,{...ButtonTemplate,name:'ToggleButton',visualStateGroups:[
 group('CheckStates',[state('Unchecked',{},{}),state('Checked',{checked:true,disabled:false},{Chrome:{background:R('accent'),borderColor:R('accent')},Content:{foreground:R('accentText')}}),state('CheckedPointerOver',{checked:true,pointerover:true,disabled:false},{Chrome:{background:R('accentHover'),borderColor:R('accentHover')},Content:{foreground:R('accentText')}}),state('CheckedPressed',{checked:true,pressed:true,disabled:false},{Chrome:{background:R('accentPressed'),borderColor:R('accentPressed')},Content:{foreground:R('accentText')}},.08)]),
 group('CommonStates',[state('Normal',{},{}),state('PointerOver',{pointerover:true,checked:false,disabled:false},{Chrome:{background:R('controlHover')}}),state('Pressed',{pressed:true,checked:false,disabled:false},{Chrome:{background:R('controlPressed')}},.08),state('Disabled',{disabled:true},{Chrome:{background:R('disabledSurface'),borderColor:R('disabledStroke')},Content:{foreground:R('disabledText')}},.08)]),focus()]
}));
const BUILTIN_CONTROL_TEMPLATES=freeze({Button:ButtonTemplate,CheckBox:CheckBoxTemplate,Slider:SliderTemplate,TextBox:TextBoxTemplate,ProgressBar:ProgressBarTemplate,ContentControl:ContentControlTemplate});
const metrics={radius:4,panelRadius:8,checkRadius:4,controlHeight:36,fieldHeight:38,selectionHeight:32,controlPadding:12,panelPadding:14};
const fluentDark={...metrics,canvas:'#202020',surface:'#272727',control:'#333333',controlHover:'#3b3b3b',controlPressed:'#292929',field:'#1d1d1d',fieldHover:'#252525',stroke:'#8a8a8a',text:'#ffffff',muted:'#c0c0c0',accent:'#60cdff',accentHover:'#82d8ff',accentPressed:'#49bce9',accentText:'#003547',accentStroke:'#00000000',track:'#777777',thumb:'#ffffff',focus:'#8bdbff',disabledSurface:'#292929',disabledStroke:'#626262',disabledText:'#a9a9a9',subtle:'#00000000',subtleHover:'#393939',subtlePressed:'#2b2b2b',danger:'#ffb4ab',dangerHover:'#ffc7c0',dangerPressed:'#eea299',dangerText:'#4b0006'};
const fluentLight={...metrics,canvas:'#f3f3f3',surface:'#ffffff',control:'#ffffff',controlHover:'#f5f5f5',controlPressed:'#ebebeb',field:'#ffffff',fieldHover:'#f9f9f9',stroke:'#777777',text:'#1b1b1b',muted:'#5d5d5d',accent:'#0067c0',accentHover:'#005bab',accentPressed:'#004d92',accentText:'#ffffff',accentStroke:'#00000000',track:'#797979',thumb:'#ffffff',focus:'#005a9e',disabledSurface:'#eeeeee',disabledStroke:'#b0b0b0',disabledText:'#666666',subtle:'#00000000',subtleHover:'#e4e4e4',subtlePressed:'#d6d6d6',danger:'#b42318',dangerHover:'#981d14',dangerPressed:'#7b180f',dangerText:'#ffffff'};
const macDark={...fluentDark,radius:11,panelRadius:18,checkRadius:6,controlPadding:14,panelPadding:18,canvas:'#181b23',surface:'#272c37',control:'#3b414e',controlHover:'#485365',controlPressed:'#293546',field:'#20252e',fieldHover:'#29323f',stroke:'#8f9bac',text:'#f6f7fb',muted:'#b9c3d3',accent:'#72b7ff',accentHover:'#91c6ff',accentPressed:'#57a6fa',accentText:'#071c32',focus:'#a3d0ff',track:'#737d8c',subtleHover:'#363e4a',subtlePressed:'#2b333e',disabledSurface:'#252b34',disabledStroke:'#647080',disabledText:'#abb6c6'};
const macLight={...fluentLight,radius:11,panelRadius:18,checkRadius:6,controlPadding:14,panelPadding:18,canvas:'#eff2f7',surface:'#ffffff',control:'#ffffff',controlHover:'#f2f7ff',controlPressed:'#dbe7f7',field:'#ffffff',fieldHover:'#f8faff',stroke:'#738198',text:'#172333',muted:'#53647a',accent:'#0068d8',accentHover:'#0059ba',accentPressed:'#004b9c',accentText:'#ffffff',focus:'#0054b5',track:'#738198',subtleHover:'#dee8f6',subtlePressed:'#cbdcf1',disabledSurface:'#e6ebf2',disabledStroke:'#a1acbc',disabledText:'#59697e'};
const contrastDark={canvas:'#000000',surface:'#000000',control:'#000000',controlHover:'#202020',controlPressed:'#303030',field:'#000000',fieldHover:'#171717',stroke:'#ffffff',text:'#ffffff',muted:'#e0e0e0',accent:'#ffe66a',accentHover:'#fff0a0',accentPressed:'#edda60',accentText:'#000000',accentStroke:'#ffe66a',track:'#a0a0a0',thumb:'#ffffff',focus:'#00ffff',disabledSurface:'#141414',disabledStroke:'#a0a0a0',disabledText:'#d0d0d0',subtle:'#00000000',subtleHover:'#202020',subtlePressed:'#303030',danger:'#ffb4ab',dangerHover:'#ffcdc6',dangerPressed:'#f0a29a',dangerText:'#000000'};
const contrastLight={canvas:'#ffffff',surface:'#ffffff',control:'#ffffff',controlHover:'#f0f0f0',controlPressed:'#e0e0e0',field:'#ffffff',fieldHover:'#f0f0f0',stroke:'#000000',text:'#000000',muted:'#242424',accent:'#003399',accentHover:'#002877',accentPressed:'#001d55',accentText:'#ffffff',accentStroke:'#003399',track:'#555555',thumb:'#ffffff',focus:'#650065',disabledSurface:'#f1f1f1',disabledStroke:'#5b5b5b',disabledText:'#484848',subtle:'#00000000',subtleHover:'#f0f0f0',subtlePressed:'#e0e0e0',danger:'#850000',dangerHover:'#700000',dangerPressed:'#550000',dangerText:'#ffffff'};
const compact={controlHeight:28,fieldHeight:30,selectionHeight:28,controlPadding:8,panelPadding:10};
const WinUIFluentTheme=freeze({kind:'controlTheme',name:'fluent',displayName:'Fluent',dark:fluentDark,light:fluentLight,contrastDark,contrastLight,compact,templates:BUILTIN_CONTROL_TEMPLATES});
const MacOS26Theme=freeze({kind:'controlTheme',name:'macos26',displayName:'macOS 26 inspired',dark:macDark,light:macLight,contrastDark,contrastLight,compact:{...compact,controlPadding:10,panelPadding:12},templates:BUILTIN_CONTROL_TEMPLATES});
const DEFAULT_CONTROL_THEMES=Object.freeze([WinUIFluentTheme,MacOS26Theme]);
function ToggleSwitch(props={}){return node('CheckBox',{template:ToggleSwitchTemplate,...props});}
function ToggleButton(props={}){return node('CheckBox',{template:ToggleButtonTemplate,...props});}
function AccentButton(props={}){return node('Button',{template:AccentButtonTemplate,...props});}
function SubtleButton(props={}){return node('Button',{template:SubtleButtonTemplate,...props});}
function DestructiveButton(props={}){return node('Button',{template:DestructiveButtonTemplate,...props});}

return { ButtonTemplate, AccentButtonTemplate, SubtleButtonTemplate, DestructiveButtonTemplate, CheckBoxTemplate, SliderTemplate, TextBoxTemplate, ProgressBarTemplate, ToggleSwitchTemplate, ContentControlTemplate, ToggleButtonTemplate, BUILTIN_CONTROL_TEMPLATES, WinUIFluentTheme, MacOS26Theme, DEFAULT_CONTROL_THEMES, ToggleSwitch, ToggleButton, AccentButton, SubtleButton, DestructiveButton };
})();
__helionModules["src/templates/index.js"] = (() => {
const { normalizeThemeSettings,resolveThemePalette,themeAccentColors } = __helionModules["src/templates/preferences.js"];


const { rgba,Opcode,Property } = __helionModules["src/core/schema.js"];

const { TemplateCommand } = __helionModules["src/templates/schema.js"];

const { ControlTemplate,TemplateBinding,ThemeResource,VisualState,VisualStateGroup,validateControlTemplate } = __helionModules["src/templates/definitions.js"];


const { WinUIFluentTheme,MacOS26Theme,DEFAULT_CONTROL_THEMES,BUILTIN_CONTROL_TEMPLATES,ButtonTemplate,AccentButtonTemplate,SubtleButtonTemplate,DestructiveButtonTemplate,ToggleButtonTemplate,AccentButton,SubtleButton,DestructiveButton,CheckBoxTemplate,TextBoxTemplate,SliderTemplate,ProgressBarTemplate,ContentControlTemplate,ToggleSwitchTemplate,ToggleSwitch,ToggleButton } = __helionModules["src/templates/themes.js"];


const TemplatedToggleButton=ToggleButton;

function templateAction(target,group,state){return {type:'template',target,group,state};}
function themeAction(theme,variant='dark'){return {type:'template',theme,variant};}
class TemplateController {
 constructor(surface,name){this.surface=surface;this.id=surface.id(name);this.meta=surface.manifest.templates?.find(t=>t.owner===this.id&&t.root!==0xffffffff);if(!this.meta)throw new TypeError('Control has no instantiated template');}
 findName(name){const id=this.meta.names[name];if(id==null)throw new ReferenceError(`Unknown template part ${name}`);return id;}
 get parts(){return {...this.meta.names};}
 goToState(group,state){let g=this.meta.groups.findIndex(g=>g.name===group);if(g<0)throw new ReferenceError(`Unknown state group ${group}`);const s=this.meta.groups[g].states.indexOf(state);if(s<0)throw new ReferenceError(`Unknown visual state ${state}`);this.surface.send(Opcode.Template,{target:this.id,c:TemplateCommand.state,a:g,b:s});return this;}
 automatic(group){const g=this.meta.groups.findIndex(g=>g.name===group);if(g<0)throw new ReferenceError(`Unknown state group ${group}`);this.surface.send(Opcode.Template,{target:this.id,c:TemplateCommand.automatic,a:g});return this;}
 clearPartValue(name,property){if(!(property in Property))throw new TypeError('Unknown scalar property');this.surface.send(Opcode.Template,{target:this.findName(name),c:4,a:Property[property]});return this;}
 setPart(name,property,value){if(!(property in Property))throw new TypeError('Use a supported runtime scalar property');this.surface.set(this.findName(name),property,value);return this;}
}
const VisualStateManager=Object.freeze({GoToState(surface,owner,group,state){surface.template(owner).goToState(group,state);return true;}});

/** A retained GPU button can change a preference without a host action/readback. */
function themePreferenceAction(option,value) {
 if(!['contrast','density','accent','reducedMotion'].includes(option))throw new TypeError('Unknown theme preference');
 if(option==='contrast'&&!['standard','high'].includes(value))throw new TypeError('Expected standard/high');
 if(option==='density'&&!['comfortable','compact'].includes(value))throw new TypeError('Expected comfortable/compact');
 if(option==='accent'&&value!=null&&(rgba(value)>>>24)!==255)throw new RangeError('Accent colors must be opaque');
 if(option==='reducedMotion'&&typeof value!=='boolean')throw new TypeError('Expected a boolean motion preference');
 return {type:'template',option,preferenceValue:value};
}

return { TemplatedToggleButton, templateAction, themeAction, TemplateController, VisualStateManager, themePreferenceAction, normalizeThemeSettings, resolveThemePalette, themeAccentColors, ControlTemplate, TemplateBinding, ThemeResource, VisualState, VisualStateGroup, validateControlTemplate, AccentButtonTemplate, SubtleButtonTemplate, DestructiveButtonTemplate, ToggleButtonTemplate, AccentButton, SubtleButton, DestructiveButton, WinUIFluentTheme, MacOS26Theme, DEFAULT_CONTROL_THEMES, BUILTIN_CONTROL_TEMPLATES, ButtonTemplate, CheckBoxTemplate, TextBoxTemplate, SliderTemplate, ProgressBarTemplate, ContentControlTemplate, ToggleSwitchTemplate, ToggleSwitch, TemplateCommand };
})();
__helionModules["src/data/index.js"] = (() => {
const { Opcode,AUTO_TARGET,fbits } = __helionModules["src/core/schema.js"];

const DataSourceFormat='helion-data-source-1';
function validateFieldPath(path){if(typeof path!=='string'||!path||path.length>512||path.split('.').some(k=>!k||['__proto__','constructor','prototype'].includes(k)))throw new TypeError('Unsafe or invalid field path');return path;}
function setAt(row,path,value){const parts=path.split('.');let at=row;for(const name of parts.slice(0,-1))at=at[name]??=(Object.create(null));at[parts.at(-1)]=value;}
const KINDS = new Set(['text','number','status','progress','boolean']);
const validKey = key => Number.isInteger(key) && key >= 0 && key < 0xffffffff;
function dataSource({rows=[],columns,key='id',capacity=Math.max(256,rows.length),stringCapacity=262144,inboxCapacity=262144}={}) {
  if(!Array.isArray(rows))throw new TypeError('DataSource rows must be an array');
  if(!Number.isInteger(capacity)||capacity<1||capacity>65536||rows.length>capacity)throw new RangeError('DataSource capacity must hold rows and be between 1 and 65536');
  validateFieldPath(key);
  columns = columns ?? Object.keys(rows[0] ?? {}).filter(k=>k!==key).map(field=>({field,title:field,type:typeof rows[0][field]==='number'?'number':typeof rows[0][field]==='boolean'?'boolean':'text'}));
  if(!Array.isArray(columns)||!columns.length||columns.length>8)throw new RangeError('DataSource requires 1–8 columns');
  const fields=new Set();columns=columns.map(c=>{if(!c||typeof c.field!=='string'||!c.field||fields.has(c.field))throw new TypeError('Columns require unique field paths');validateFieldPath(c.field);if(c.field===key||c.field.startsWith(key+'.')||key.startsWith(c.field+'.')||[...fields].some(f=>f.startsWith(c.field+'.')||c.field.startsWith(f+'.')))throw new TypeError('Overlapping field paths are not supported');fields.add(c.field);const type=c.type??'text';if(!KINDS.has(type))throw new TypeError(`Unsupported column type ${type}`);return {...c,type};});
  for(const [name,value] of Object.entries({stringCapacity,inboxCapacity}))if(!Number.isInteger(value)||value<16||value>4194304)throw new RangeError(`${name} must be 16–4194304 words`);
  const seen=new Set();for(const row of rows){const id=valueAt(row,key);if(!validKey(id)||seen.has(id))throw new TypeError('Rows require unique u32 keys (0 through 4294967294)');seen.add(id);validateRow(row,columns);}
  return {format:DataSourceFormat,rows,columns,key,capacity,stringCapacity,inboxCapacity};
}
const createDataSource=dataSource;
function normalizeItemsSource(value,props={}) {
  if(Array.isArray(value))return dataSource({rows:value,columns:props.dataColumns,key:props.rowKey??'id',capacity:props.rowCapacity??Math.max(256,value.length)});
  if(value?.format===DataSourceFormat)return dataSource(value);
  throw new TypeError('ItemsSource must be an object-row array or dataSource descriptor');
}
function valueAt(row,path) {let value=row;for(const key of path.split('.')){if(key==='__proto__'||key==='constructor'||key==='prototype')throw new TypeError('Unsafe field path');value=value?.[key];}return value;}
function validateRow(row,columns,partial=false){if(!row||typeof row!=='object'||Array.isArray(row))throw new TypeError('Expected an object row');for(const c of columns){const value=valueAt(row,c.field);if(partial&&value===undefined)continue;if(c.type==='text'){const chars=Array.from(String(value??''));if(chars.some(x=>{const n=x.codePointAt(0);return n>=0xd800&&n<=0xdfff;}))throw new TypeError('Unpaired surrogate in cell');}else if(c.type==='boolean'){if(value!=null&&typeof value!=='boolean')throw new TypeError(`Boolean required for ${c.field}`);}else if(value!=null&&(!Number.isFinite(value)||!Number.isFinite(Math.fround(value))))throw new TypeError(`Finite number required for ${c.field}`);}}
/** Immutable row patches. No host copy of the GPU's current table is maintained. */
function encodeDataBatch(meta,operations,{expectedRevision=null}={}) {
  if(!Array.isArray(operations)||!operations.length||operations.length>65537)throw new RangeError('Batch requires 1–65537 operations');
  if(expectedRevision!=null&&!validKey(expectedRevision))throw new RangeError('Invalid expected revision');
  const replacement=operations[0]?.type==='clear';if(operations.some((op,i)=>op?.type==='clear'&&i!==0)||replacement&&operations.slice(1).some(op=>op?.type!=='upsert'))throw new TypeError('A clear must start a replacement followed only by upserts');if(replacement){const keys=new Set();for(const op of operations.slice(1)){const k=op.key??valueAt(op.row,meta.key);if(keys.has(k))throw new TypeError('Duplicate replacement key');keys.add(k);}if(keys.size>meta.capacity)throw new RangeError('Replacement exceeds capacity');}
  const words=[1,operations.length,expectedRevision??AUTO_TARGET,0];
  for(const op of operations){const code={upsert:1,remove:2,clear:3,patch:4}[op?.type];if(!code)throw new TypeError('Use upsert, patch, remove or clear');const row=op.row;const key=code===3?0:op.key??valueAt(row,meta.key);if(!validKey(key))throw new TypeError('Expected a u32 row key');
    if(code===1||code===4)validateRow(row,meta.dataColumns,code===4);
    const start=words.length;words.push(code,key,0,0);let mask=0;
    for(let k=0;k<meta.dataColumns.length && (code===1||code===4);k++){const col=meta.dataColumns[k],v=valueAt(row,col.field);if(code===4&&v===undefined)continue;mask|=1<<k;if(col.type==='text'){const chars=Array.from(String(v??''),c=>c.codePointAt(0));if(words.length+1+chars.length>meta.inboxCapacity)throw new RangeError('Batch exceeds reserved upload capacity');words.push(chars.length);for(const ch of chars)words.push(ch);}else words.push(fbits(col.type==='boolean'?(v?1:0):(v??0)));}
    words[start+2]=mask;words[start+3]=words.length-start;
    if(words.length>meta.inboxCapacity)throw new RangeError('Batch exceeds reserved upload capacity; split batches or reserve a larger inbox');
  }
  words[3]=words.length;return Uint32Array.from(words);
}
class DataSourceController {
  constructor(surface,name){this.surface=surface;this.id=surface.id(name);this.meta=surface.manifest.tables.find(t=>t.node===this.id);if(!this.meta?.source)throw new TypeError('DataGrid must be mounted with ItemsSource for live updates');this.meta=this.meta.source;}
  batch(operations,options){const words=encodeDataBatch(this.meta,operations,options);this.surface.commands.pushBulk(Opcode.Data,{target:this.id,c:1,a:words.length},words,this.meta.inbox);if(this.surface.running||this.surface.options.autoStart!==false)this.surface.invalidate();return this;}
  upsert(rows,options){return this.batch((Array.isArray(rows)?rows:[rows]).map(row=>({type:'upsert',row})),options);}
  patch(key,row,options){return this.batch([{type:'patch',key,row}],options);}
  remove(keys,options){return this.batch((Array.isArray(keys)?keys:[keys]).map(key=>({type:'remove',key})),options);}
  clear(options){return this.batch([{type:'clear'}],options);}
  replace(rows,options){if(!Array.isArray(rows)||rows.length>this.meta.capacity)throw new RangeError('Replacement exceeds table capacity');const seen=new Set();for(const r of rows){const id=valueAt(r,this.meta.key);if(seen.has(id))throw new TypeError('Duplicate replacement key');seen.add(id);}return this.batch([{type:'clear'},...rows.map(row=>({type:'upsert',row}))],options);}
  sort(column,direction='ascending'){const index=typeof column==='number'?column:this.meta.dataColumns.findIndex(c=>c.field===column);if(!Number.isInteger(index)||index<0||index>=this.meta.dataColumns.length||!['ascending','descending'].includes(direction))throw new TypeError('Invalid sort');this.surface.send(Opcode.Data,{target:this.id,c:2,a:index,b:direction==='descending'?1:0});return this;}
  select(key){if(!validKey(key))throw new TypeError('Invalid row key');const words=new Uint32Array([key]);this.surface.commands.pushBulk(Opcode.Data,{target:this.id,c:3,a:1},words,this.meta.inbox);if(this.surface.running||this.surface.options.autoStart!==false)this.surface.invalidate();return this;}
  async snapshot(){return this.surface.platformSnapshot(()=>this._snapshot());}
  async _snapshot(){const h=new Uint32Array(await this.surface.readHeapRange(this.meta.pointer,24));const keys=new Uint32Array(await this.surface.readHeapRange(h[4],h[11]));const live=new Uint32Array(await this.surface.readHeapRange(h[5],h[11]));const rows=new Uint32Array(await this.surface.readHeapRange(this.meta.rows,h[11]*8));const strings=new Uint32Array(await this.surface.readHeapRange(h[12],h[14]));const table=new Uint32Array(await this.surface.readHeapRange(this.meta.table,40));const result=[];for(let i=0;i<h[11];i++){if(!live[i])continue;const row={};setAt(row,this.meta.key,keys[i]);for(let k=0;k<this.meta.dataColumns.length;k++){const c=this.meta.dataColumns[k],v=rows[i*8+k];if(c.type==='text'){const at=v-h[12];if(at<0||at>=strings.length||strings[at]>strings.length-at-1)throw new Error('Text outside source arena');let text='';for(let j=0;j<strings[at];j+=1024)text+=String.fromCodePoint(...strings.subarray(at+1+j,at+1+Math.min(strings[at],j+1024)));setAt(row,c.field,text);}else {const n=new Float32Array(new Uint32Array([v]).buffer)[0];setAt(row,c.field,c.type==='boolean'?!!n:n);}}result.push(row);}return {rows:result,revision:h[3],rejectedOperations:h[18],lastResult:h[19],lastSequence:h[17],capacity:h[1],selectedKey:table[17]===AUTO_TARGET?null:keys[table[17]],usedStringWords:h[14],stringCapacity:h[13],stringCompactions:h[21]};}
}

return { DataSourceFormat, validateFieldPath, dataSource, createDataSource, normalizeItemsSource, valueAt, encodeDataBatch, DataSourceController };
})();
__helionModules["src/styling/studio-theme.js"] = (() => {
/** Shared visual tokens for Helion's first-party workspaces. */
const STUDIO=Object.freeze({
 base:'#111114',panel:'#19191f',inset:'#151519',raised:'#202027',line:'#303038',
 text:'#eeeef2',muted:'#a0a0ad',subtle:'#777786',accent:'#b9a7ff',
 primary:'#b9a7ff',onPrimary:'#211936',selected:'#302a42',hover:'#292832'
});
function studioButtons(name){return `
 Button.${name} { Background: ${STUDIO.raised}; Foreground: ${STUDIO.text}; CornerRadius: 6; FontSize: 11; }
 Button.${name}:pointerover { Background: ${STUDIO.hover}; }
 Button.${name}:pressed { Background: #383143; }
 Button.${name}:focus { BorderBrush: ${STUDIO.accent}; BorderThickness: 1; }
 Button.primary { Background: ${STUDIO.primary}; Foreground: ${STUDIO.onPrimary}; }
 Button.primary:pointerover { Background: #c9bcff; }
`;}

return { STUDIO, studioButtons };
})();
__helionModules["src/core/declaration.js"] = (() => {
const { Kind } = __helionModules["src/core/schema.js"];

const { normalizeProperties } = __helionModules["src/layout/properties.js"];

function h(type, props = {}, ...children) {
  if (typeof type === 'function') return type({ ...props, children: children.flat(Infinity) });
  props = normalizeProperties(props);
  if(type==='TextEditor'||type==='CodeEditor'){props={fontSize:14,background:'#101923',kerning:false,ligatures:false,...props};}
  if(type==='WrapPanel' && props.orientation==null)props.orientation='horizontal';
  if (props.children != null) { children.push(props.children); delete props.children; }
  if (props.content?.kind === 'templateBinding') { props.text=props.content; delete props.content; }
  if (props.content != null) { if (['Button','CheckBox'].includes(type) && typeof props.content === 'string') props.text=props.content; else children.push(props.content); delete props.content; }
  if (!Object.hasOwn(Kind, type)) throw new TypeError(`Unknown GPU view: ${type}`);
  const flat = children.flat(Infinity).filter(c => c != null && c !== false).map(c => typeof c === 'string' ? h('TextBlock', { text: c }) : c);
  return { type, props: { ...props }, children: flat };
}

return { h };
})();
__helionModules["src/controls/index.js"] = (() => {
const { STUDIO } = __helionModules["src/styling/studio-theme.js"];

const { h } = __helionModules["src/core/declaration.js"];

const { Opcode,AUTO_TARGET } = __helionModules["src/core/schema.js"];

const ACTION_EVENT_CAPACITY=520;
const ACTION_OUTBOX_BYTES=16+ACTION_EVENT_CAPACITY*24;
function hostAction(name,value=0){if(typeof name!=='string'||!name||name.length>128||!Number.isFinite(value))throw new TypeError('Host action requires a name and finite argument');return {type:'host',name,value};}
const Toolbar=(props,...children)=>h('ScrollViewer',{height:40,scrollHorizontal:true,...props},h('StackPanel',{orientation:'horizontal',gap:6,padding:4},...children));
const StatusBar=(props,...children)=>h('Grid',{height:28,columns:'* auto',...props},...children);
const Menu=(props)=>h('ListBox',{rowHeight:32,...props});
const ToggleButton=(props)=>h('CheckBox',{height:34,...props});
const Separator=(props)=>h('Border',{width:1,background:'#304358',...props});
const Popup=(props,...children)=>h('Border',{zIndex:1000,background:'#172637',borderColor:'#3b5970',borderWidth:1,radius:10,padding:16,...props},...children);
function Dialog(props={},...children){const {width=560,height=420,padding=20,background=STUDIO.panel,responsive=false,...root}=props;return h('Modal',{background:'#00000088',zIndex:1000,padding:responsive?12:0,...root},h('Border',{...(responsive?{maxWidth:width,maxHeight:height}:{width,height}),padding,background,radius:10,borderWidth:1,borderColor:STUDIO.line,horizontalAlignment:'center',verticalAlignment:'center'},...children));}
/** Flatten a tree once at ingestion. Expansion, selection and visible indexing live on-device. */
function normalizeItems(items,{capacity=256,textCapacity=32768}={}){
 if(!Array.isArray(items)||!Number.isInteger(capacity)||capacity<1||capacity>4096||!Number.isInteger(textCapacity)||textCapacity<1||textCapacity>1048576)throw new TypeError('Invalid list capacity or items');
 const result=[],keys=new Set(),explicit=new Set();let chars=0,nextKey=0,scanned=0;
 function scan(item,depth=0){if(++scanned>capacity||depth>31)throw new RangeError('List capacity/tree depth exceeded');if(typeof item==='string')return;if(!item||typeof item!=='object')throw new TypeError('Invalid list item');if(item.key!=null){if(!Number.isInteger(item.key)||item.key<0||item.key>=AUTO_TARGET||explicit.has(item.key))throw new TypeError('List keys must be unique unsigned integers');explicit.add(item.key);}if(item.children!=null){if(!Array.isArray(item.children))throw new TypeError('children must be an array');for(const child of item.children)scan(child,depth+1);}}
 for(const item of items)scan(item);
 const allocateKey=()=>{while(explicit.has(nextKey)||keys.has(nextKey))nextKey++;return nextKey++;};
 function visit(item,parent=AUTO_TARGET,depth=0){if(typeof item==='string')item={label:item};if(!item||depth>31)throw new TypeError('Invalid item/tree depth');const index=result.length,key=item.key??allocateKey();if(!Number.isInteger(key)||key<0||key>=AUTO_TARGET||keys.has(key))throw new TypeError('List keys must be unique unsigned integers');keys.add(key);const text=Array.from(String(item.label??item.text??''),c=>c.codePointAt(0));if(text.some(c=>c>=0xd800&&c<=0xdfff))throw new TypeError('Invalid Unicode scalar');chars+=text.length;if(result.length>=capacity||chars>textCapacity)throw new RangeError('List capacity exceeded');const children=item.children??[];if(!Array.isArray(children))throw new TypeError('children must be an array');result.push({key,text,parent,depth,flags:(children.length?1:0)|(item.expanded===false?0:2)|(item.disabled?4:0)});for(const child of children)visit(child,index,depth+1);}
 for(const item of items)visit(item);return {items:result,chars};
}
function encodeListItems(items,limits){const value=normalizeItems(items,limits),n=value.items.length,words=new Uint32Array(4+n*8+value.chars);words.set([1,n,value.chars,words.length]);let at=4+n*8;value.items.forEach((r,k)=>{words.set([r.key,at,r.text.length,r.parent,r.depth,r.flags,0,0],4+k*8);words.set(r.text,at);at+=r.text.length;});return words;}
class ListController{
 constructor(surface,name){this.surface=surface;this.id=surface.id(name);this.meta=surface.manifest.lists?.find(x=>x.node===this.id);if(!this.meta)throw new TypeError('Expected ListBox/TreeView');}
 replace(items){const data=encodeListItems(items,this.meta);this.surface.commands.pushBulk(Opcode.Controls,{target:this.id,c:2,a:data.length},data,this.meta.inbox);this.wake();return this;}
 select(key){return this.keyCommand(3,key);}
 toggle(key){return this.keyCommand(4,key);}
 keyCommand(code,key){if(!Number.isInteger(key)||key<0||key>=AUTO_TARGET)throw new TypeError('Invalid item key');this.surface.commands.pushBulk(Opcode.Controls,{target:this.id,c:code,a:1},new Uint32Array([key]),this.meta.inbox);this.wake();return this;}
 wake(){if(this.surface.running||this.surface.options.autoStart!==false)this.surface.invalidate();}
 async snapshot(){return this.surface.platformSnapshot(async()=>{const d=new Uint32Array(await this.surface.readHeapRange(this.meta.pointer,24));return {count:d[0],visibleCount:d[7],selectedKey:d[9]===AUTO_TARGET?null:d[9],revision:d[14],rejectedUpdates:d[17]};});}
}
/** Event-driven GPU action readback, never an idle-frame/control-state poll. */
class ActionBridge{
 constructor(surface){this.surface=surface;this.pending=new Set();this.delivery=Promise.resolve();}
 encode(encoder,packet){const s=this.surface;if(!s.options.onAction||!s.manifest.actionOutbox||!packet.actionCandidate)return null;const size=ACTION_OUTBOX_BYTES;const buffer=s.device.createBuffer({label:'Explicit input-action outbox snapshot',size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});encoder.copyBufferToBuffer(s.heapBuffer,s.manifest.actionOutbox*4,buffer,0,size);this.pending.add(buffer);return buffer;}
 submitted(buffer){if(!buffer)return;const s=this.surface;const read=buffer.mapAsync(GPUMapMode.READ).then(()=>{s.stats.actionReadbackBytes=(s.stats.actionReadbackBytes??0)+buffer.size;s.stats.readbackBytes+=buffer.size;return new Uint32Array(buffer.getMappedRange().slice(0));});read.catch(()=>{});
 this.delivery=this.delivery.then(async()=>{const words=await read;if(s.disposed)return;if(words[1])s.options.onDiagnosticsError?.(new Error('GPU action outbox overflow'));for(let k=0;k<Math.min(ACTION_EVENT_CAPACITY,words[0]);k++){const o=4+k*6,name=s.manifest.hostActions[words[o]-1];if(name){try{Promise.resolve(s.options.onAction({name,target:words[o+1],sequence:words[o+2],value:new Float32Array(words.buffer)[o+3],key:words[o+4],frame:words[o+5]})).catch(error=>s.options.onDiagnosticsError?.(error));}catch(error){s.options.onDiagnosticsError?.(error);}}}}).catch(error=>{if(!s.disposed)s.options.onDiagnosticsError?.(error);}).finally(()=>{buffer.destroy();this.pending.delete(buffer);if(!s.disposed&&(s.running||s.commands.length))s.invalidate();});}
 cancel(buffer){if(buffer){buffer.destroy();this.pending.delete(buffer);}}
 dispose(){for(const b of this.pending)b.destroy();this.pending.clear();}
}

return { ACTION_EVENT_CAPACITY, ACTION_OUTBOX_BYTES, hostAction, Toolbar, StatusBar, Menu, ToggleButton, Separator, Popup, Dialog, normalizeItems, encodeListItems, ListController, ActionBridge };
})();
__helionModules["src/editor/declarations.js"] = (() => {
/** Serializable initial asset; live document state is owned by GPU buffers. */
function TextDocument(text='',options={}) { return { ...options, text:String(text) }; }

return { TextDocument };
})();
__helionModules["src/editor/schema.js"] = (() => {
/** Resident document ABI. All offsets below are u32 words, not bytes. */
const ED = Object.freeze({data:0,capacity:1,gapStart:2,gapEnd:3,length:4,revision:5,flags:6,language:7,selections:8,selectionCount:9,history:10,historyCapacity:11,historyCursor:12,historyEnd:13,group:14,blink:15,lines:16,lineCount:17,lineCapacity:18,dirty:19,tokens:20,search:21,searchLength:22,replacement:23,replacementLength:24,matches:25,matchCount:26,currentMatch:27,searchFlags:28,preferredColumn:29,folds:30,visuals:31,visualCount:32,maxColumns:33,wrapColumns:34,dialog:35,tabSize:36,lineHeight:37,gutter:38,rejectedEdits:39,historyResets:40,bracketA:41,bracketB:42,completions:43,completionCount:44,popup:45,popupIndex:46,suggestions:47,suggestionCount:48,prefixStart:49,staging:50,diagnostics:51,diagnosticCount:52,selectionRevision:53,foldCount:54,selectionBefore:55,readOnly:56,whitespace:57,autoPairs:58,activeSelection:59,dragMode:60,dragAnchor:61,dragColumn:62,visualWidth:63,uploadStaging:64,snippetStops:70,snippetCount:71,snippetIndex:72,snippetActive:73,completionLabels:76,changeAction:77,notifiedRevision:78,unicode:79});
const EDITOR_WORDS=80;
const EditorCommand=Object.freeze({focus:0,undo:1,redo:2,selectAll:3,find:4,replace:5,findNext:6,findPrevious:7,replaceNext:8,replaceAll:9,goToLine:10,toggleWrap:11,toggleMinimap:12,toggleWhitespace:13,toggleComment:14,indent:15,outdent:16,duplicateLine:17,deleteLine:18,moveLineUp:19,moveLineDown:20,complete:21,acceptCompletion:22,addNextOccurrence:23,fold:24,unfoldAll:25,select:26,insertStaging:27,loadStaging:28,setSearch:29,cutRevision:30,zoom:31,toggleOverwrite:32,selectLine:33,selectWord:34,clearSelections:35,commandPalette:36,scrollToLine:37,insertInbox:38,insertSnippet:39,setReplacement:40});
const EditorFlags=Object.freeze({readOnly:1,overwrite:2,wrap:4,minimap:8});
const EditorLanguage=Object.freeze({text:0,javascript:1,typescript:1,css:2,json:3,html:4,wgsl:5,markdown:6});
const CompletionWords=Object.freeze({
 text:[],javascript:['const','let','function','return','if','else','for','while','class','new','async','await','try','catch','throw','true','false','null','undefined','console.log','Math','Array','Object','Promise','Helion','h','Grid','StackPanel','DockPanel','WrapPanel','UniformGrid','Viewbox','Border','TextBlock','Button','TextBox','TextEditor','CodeEditor','Slider','ProgressBar','DataGrid','DockWorkspace','DockItem','DrawingContext','Compositor','defineModel','field','computed','expr','app','set'],
 css:['Background','Foreground','BorderBrush','BorderThickness','CornerRadius','Padding','Margin','FontSize','FontFamily','Width','Height','Opacity','transition','pointerover','pressed','focus','disabled','Button','TextBlock','CodeEditor'],
 json:['true','false','null'],html:['html','head','body','div','span','button','input','ui-grid','ui-text-block','ui-code-editor'],wgsl:['fn','var','let','const','struct','return','if','else','for','loop','break','continue','u32','i32','f32','vec2','vec3','vec4','array','select','clamp','workgroupBarrier','storageBarrier','atomicAdd','textureStore'],markdown:['# Heading','**bold**','*italic*','[link](https://example.com)','```js\n\n```']});

return { ED, EDITOR_WORDS, EditorCommand, EditorFlags, EditorLanguage, CompletionWords };
})();
__helionModules["src/docking/validation.js"] = (() => {
/** Validate a saved topology before any GPU write. No mutable CPU layout mirror. */
function validateDockSnapshot(value, paneIds) {
  if(value?.format!=='helion-dock-layout-1'||!Array.isArray(value.nodes)||!Array.isArray(value.panes))throw new TypeError('Invalid docking snapshot');
  const n=value.nodes.length;if(n<1||n>31||!Number.isInteger(value.root)||value.root<0||value.root>=n)throw new RangeError('Invalid docking root/capacity');
  const expected=new Set(paneIds),seenPanes=new Set(),seen=new Set();
  const walk=(index,parent,depth)=>{
    if(!Number.isInteger(index)||index<0||index>=n||seen.has(index)||depth>30)throw new TypeError('Cyclic/duplicate docking topology');
    seen.add(index);const node=value.nodes[index];if(node.parent!==parent||![0,1].includes(node.type))throw new TypeError('Invalid docking parent/type');
    if(node.type===1){if(![0,1].includes(node.axis)||!Number.isFinite(node.ratio)||node.ratio<.1||node.ratio>.9)throw new RangeError('Invalid split ratio/axis');walk(node.first,index,depth+1);walk(node.second,index,depth+1);}
    else if(node.active!=null&&!expected.has(node.active))throw new TypeError('Unknown active pane');
  };
  walk(value.root,0xffffffff,0);if(seen.size!==n)throw new TypeError('Unreachable docking records');
  for(const pane of value.panes){if(!expected.has(pane.id)||seenPanes.has(pane.id))throw new TypeError('Unknown/duplicate pane');seenPanes.add(pane.id);
    if(!Number.isInteger(pane.group)||pane.group<0||pane.group>=n||value.nodes[pane.group].type!==0)throw new TypeError('Pane group must be a leaf');
    if(typeof pane.closed!=='boolean'||typeof pane.floating!=='boolean'||!Array.isArray(pane.bounds)||pane.bounds.length!==4||!pane.bounds.every(v=>Number.isFinite(v)&&v>=0&&v<=1e7)||pane.bounds[2]<160||pane.bounds[3]<100)throw new RangeError('Invalid floating rectangle/flags');
  }
  if(seenPanes.size!==expected.size)throw new TypeError('Snapshot must contain every pane');
  for(let i=0;i<n;i++){const node=value.nodes[i];if(node.type===0&&node.active!=null){const p=value.panes.find(p=>p.id===node.active);if(p.group!==i||p.closed||p.floating)throw new TypeError('Active pane must be open and docked in its leaf');}}
  return structuredClone(value);
}

return { validateDockSnapshot };
})();
__helionModules["src/docking/index.js"] = (() => {
const { validateDockSnapshot } = __helionModules["src/docking/validation.js"];

function DockTabs(panes,active=panes[0]){if(!Array.isArray(panes))throw new TypeError('DockTabs requires pane IDs');return {type:'tabs',panes:[...panes],active};}
function DockSplit(orientation,ratio,first,second){if(!['horizontal','vertical'].includes(orientation)||!(ratio>=.1&&ratio<=.9))throw new RangeError('DockSplit: horizontal/vertical, ratio .1.. .9');return {type:'split',orientation,ratio,first,second};}
const DockCommand=Object.freeze({activate:0,close:1,reopen:2,float:3,dock:4,splitHorizontal:5,splitVertical:6,ratio:7,maximize:8});
class DockController {
 constructor(surface,id){this.surface=surface;this.id=surface.id(id);this.meta=surface.manifest.docks?.find(d=>d.node===this.id);if(!this.meta)throw new TypeError('Expected a DockWorkspace');}
 command(name,pane,group=0){if(!(name in DockCommand))throw new TypeError(`Unknown dock command ${name}`);const node=this.surface.id(pane);if(!this.meta.panes.some(p=>p.node===node))throw new TypeError('Pane does not belong to workspace');this.surface.send(11,{target:this.id,c:DockCommand[name],a:node,b:group});return this;}
 async _snapshot(){const s=this.surface;const bytes=await s.readHeapRange(this.meta.pointer,16);const head=new Uint32Array(bytes);const records=new Uint32Array(await s.readHeapRange(this.meta.tree,31*12));const panes=[];for(const p of this.meta.panes){const words=new Uint32Array(await s.readHeapRange(p.pointer,16));const floats=new Float32Array(words.buffer);panes.push({id:p.id,group:words[1],closed:!!words[2],floating:!!words[3],bounds:Array.from(floats.slice(4,8))});}return {format:'helion-dock-layout-1',revision:head[13],root:head[1],nodes:Array.from({length:head[0]},(_,i)=>{const a=i*12;return {type:records[a],parent:records[a+1],first:records[a+2],second:records[a+3],ratio:new Float32Array(records.buffer)[a+4],axis:records[a+5],active:this.meta.panes.find(p=>p.node===records[a+6])?.id??null};}),panes};}
 async snapshot(){return this.surface.platformSnapshot(()=>this._snapshot());}
 async restore(layout){
  const value=validateDockSnapshot(layout,this.meta.panes.map(p=>p.id));const s=this.surface;
  return s.platformSnapshot(async()=>{
   const tree=new Uint32Array(31*12),tf=new Float32Array(tree.buffer);
   for(let i=0;i<value.nodes.length;i++){const node=value.nodes[i],at=i*12;tree.set([node.type,node.parent,node.first??0,node.second??0,0,node.axis??0,node.active==null?0xffffffff:s.id(node.active)],at);tf[at+4]=node.ratio||0;}
   const writes=[[this.meta.tree,tree],[this.meta.pointer,new Uint32Array([value.nodes.length,value.root])],[this.meta.pointer+5,new Uint32Array([0xffffffff])],[this.meta.pointer+10,new Uint32Array([0xffffffff,0,0])]];
   for(let i=0;i<value.panes.length;i++){const pane=value.panes[i],meta=this.meta.panes.find(p=>p.id===pane.id),a=new Uint32Array(7),f=new Float32Array(a.buffer);a.set([pane.group,Number(pane.closed),Number(pane.floating)]);f.set(pane.bounds,3);writes.push([meta.pointer+1,a],[meta.pointer+11,new Uint32Array([i+1])]);}
   writes.push([this.meta.pointer+14,new Uint32Array([value.panes.length])]);
   for(const [at,data]of writes){s.device.queue.writeBuffer(s.heapBuffer,at*4,data);s.stats.uploadedBytes+=data.byteLength;}
   // An ordered opcode invalidates GPU Measure/Arrange after the uploaded topology.
   s.send(11,{target:this.id,c:9,a:this.meta.panes[0].node});return this;
  });
 }

}

return { DockTabs, DockSplit, DockCommand, DockController };
})();
__helionModules["src/models/index.js"] = (() => {
/** Serializable typed GPU model declarations, not JavaScript objects kept in sync. */
const types=new Set(['f32','u32','i32','bool']);
function field(type='f32',initial=0){if(!types.has(type))throw new TypeError('Field type: f32/u32/i32/bool');return {type,initial};}
function computed(type,value){if(!types.has(type))throw new TypeError('Invalid computed type');return {type,expression:value};}
const ref=name=>({op:'field',name});
const binary=['add','sub','mul','div','min','max','lt','le','gt','ge','eq','and','or'];
const unary=['neg','abs','sin','cos','sqrt','floor','ceil','round','not'];
const expr=Object.freeze({ref,arg:()=>({op:'arg'}),...Object.fromEntries(binary.map(op=>[op,(a,b)=>({op,args:[a,b]})])),...Object.fromEntries(unary.map(op=>[op,a=>({op,args:[a]})])),clamp:(a,lo,hi)=>({op:'clamp',args:[a,lo,hi]}),select:(condition,yes,no)=>({op:'select',args:[condition,yes,no]})});
function defineModel(fields,{count=1,commands={}}={}){return {format:'helion-gpu-model-1',fields,count,commands};}
const defineViewModel=defineModel;
function modelBinding(model,field,options={}){return {model,field,...options};}
class ModelController{
 constructor(surface,name){this.surface=surface;this.meta=surface.manifest.models?.find(m=>m.name===name);if(!this.meta)throw new ReferenceError(`Unknown model ${name}`);}
 set(field,value,row=0){const f=this.meta.fields.find(f=>f.name===field);if(!f||f.computed)throw new TypeError('Set requires a writable field');this.check(row);const v=Number(value);if(!Number.isFinite(v)||!Number.isFinite(Math.fround(v)))throw new RangeError('Non-finite field value');if(f.type==='bool'&&![0,1].includes(v)||f.type==='u32'&&(!Number.isInteger(v)||v<0||v>16777216)||f.type==='i32'&&(!Number.isInteger(v)||Math.abs(v)>16777216))throw new RangeError('Command integer values must be exact f32 integers');this.surface.send(12,{target:0,x:this.meta.index,y:row,a:v,b:f.index,c:0});return this;}
 execute(name,arg=0,row=0){this.check(row);if(!Number.isFinite(Number(arg))||!Number.isFinite(Math.fround(Number(arg))))throw new TypeError('Finite command argument required');const n=this.meta.commands.indexOf(name);if(n<0)throw new ReferenceError(`Unknown model command ${name}`);this.surface.send(12,{target:0,x:this.meta.index,y:row,a:Number(arg),c:n+1});return this;}
 check(row){if(!Number.isInteger(row)||row<0||row>=this.meta.count)throw new RangeError('Model row out of range');}
 async snapshot({start=0,count=this.meta.count-start}={}){this.check(start);if(!Number.isInteger(count)||count<0||count>this.meta.count-start)throw new RangeError('Invalid snapshot range');return this.surface.platformSnapshot(async()=>{const result={};for(const f of this.meta.fields){const bytes=await this.surface.readHeapRange(f.data+start,count);const a=f.type==='f32'?new Float32Array(bytes):f.type==='i32'?new Int32Array(bytes):new Uint32Array(bytes);result[f.name]=f.type==='bool'?Array.from(a,Boolean):Array.from(a);}const header=new Uint32Array(await this.surface.readHeapRange(this.meta.pointer,16));const errors=new Uint32Array(await this.surface.readHeapRange(header[10]+start,count));const revisions=new Uint32Array(await this.surface.readHeapRange(header[9]+start,count));return {name:this.meta.name,start,count,fields:result,errors:Array.from(errors),revisions:Array.from(revisions)};});}
}

return { field, computed, ref, expr, defineModel, defineViewModel, modelBinding, ModelController };
})();
__helionModules["src/styling/styles.js"] = (() => {
const { normalizeProperties, propertyName } = __helionModules["src/layout/properties.js"];

const PseudoClass=Object.freeze({pointerover:1,hover:1,pressed:2,focus:4,checked:8,disabled:16,dark:32,light:64});
function Style(selector,setters) {return {selector,setters};}
function StaticResource(key) {return {resource:key};}
class ResourceDictionary {
 constructor(entries={}) {Object.assign(this,entries);}
}
function parseValue(value) {
 value=value.trim();if(/^(['"]).*\1$/.test(value))return value.slice(1,-1);
 if(/^(true|false)$/i.test(value))return value.toLowerCase()==='true';
 if(/^[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?(?:px)?$/i.test(value))return Number(value.replace(/px$/i,''));
 return value;
}
function parseStyles(css) {
 if(Array.isArray(css))return css.flatMap(r=>typeof r==='string'?parseStyles(r):[{selector:r.selector??r.Selector,setters:normalizeProperties(r.setters??r.Setters??{})}]);
 if(!css)return [];if(typeof css!=='string')throw new TypeError('Styles must be CSS text or Style[]');
 css=css.replace(/\/\*[\s\S]*?\*\//g,'');let cursor=0;const result=[];
 const re=/([^{}]+)\{([^{}]*)\}/g;let m;
 while((m=re.exec(css))) {
  if(css.slice(cursor,m.index).trim())throw new SyntaxError('Unsupported stylesheet nesting or at-rule');cursor=re.lastIndex;
  const setters={};for(const item of m[2].split(';')) {if(!item.trim())continue;const colon=item.indexOf(':');if(colon<1)throw new SyntaxError('Expected property: value');
   const name=propertyName(item.slice(0,colon).trim());let value=parseValue(item.slice(colon+1));
   if(['margin','padding'].includes(name)&&typeof value==='string'){const parts=value.trim().split(/[,\s]+/);if(parts.every(v=>/^[+-]?(?:\d*\.)?\d+(?:px)?$/.test(v)))value=parts.map(v=>Number(v.replace(/px$/,'')));}
   if(name==='transition') {setters.transitions=String(value).split(',').map(v=>{const [property,time,easing='smooth']=v.trim().split(/\s+/);const duration=parseFloat(time)/(String(time).endsWith('ms')?1000:1);return {property:propertyName(property),duration,easing};});}
   else setters[name]=value;
  }
  for(const selector of m[1].split(','))result.push({selector:selector.trim(),setters:normalizeProperties(setters)});
 }
 if(css.slice(cursor).trim())throw new SyntaxError('Malformed stylesheet');return result;
}
function resource(value,resources,seen=new Set()) {
 const key=value?.resource??(typeof value==='string'?value.match(/^var\((--[\w-]+)\)$/)?.[1]:null);
 if(key!=null){if(seen.has(key))throw new Error(`Resource cycle at ${key}`);if(!Object.hasOwn(resources,key))throw new ReferenceError(`Unknown resource ${key}`);return resource(resources[key],resources,new Set([...seen,key]));}
 return value;
}
function parseSimple(text) {
 let required=0,forbidden=0;
 text=text.replace(/:not\(:([\w-]+)\)/g,(_,name)=>{if(!PseudoClass[name])throw new SyntaxError(`Unsupported pseudo-class ${name}`);forbidden|=PseudoClass[name];return '';});
 text=text.replace(/:([\w-]+)/g,(_,name)=>{if(!PseudoClass[name])throw new SyntaxError(`Unsupported pseudo-class ${name}`);required|=PseudoClass[name];return '';});
 const type=text.match(/^(\*|[A-Za-z]\w*)/)?.[0]||'*';let tail=text.replace(/^(\*|[A-Za-z]\w*)/,'');const ids=[],classes=[];
 tail=tail.replace(/([.#])([\w-]+)/g,(_,symbol,name)=>{(symbol==='#'?ids:classes).push(name);return '';});
 if(tail||ids.length>1||(required&forbidden))throw new SyntaxError(`Unsupported selector ${text}`);
 return {type,id:ids[0],classes,required,forbidden,specificity:ids.length*10000+(required||forbidden?1000:0)+classes.length*100+(type!=='*'?1:0)};
}
function parseSelector(selector) {
 if(typeof selector!=='string'||!selector.trim())throw new TypeError('Style selector required');
 const tokens=selector.trim().replace(/\s*>\s*/g,' > ').split(/\s+/);const parts=[];let relation='descendant';
 for(const token of tokens){if(token==='>'){if(!parts.length||relation==='child')throw new SyntaxError('Invalid child selector');relation='child';continue;}const s=parseSimple(token);parts.push({...s,relation});relation='descendant';}
 if(tokens.at(-1)==='>')throw new SyntaxError('Incomplete child selector');
 for(const p of parts.slice(0,-1))if(p.required||p.forbidden)throw new SyntaxError('Dynamic pseudo-classes currently belong on the target, not ancestors');
 return {parts,specificity:parts.reduce((a,p)=>a+p.specificity,0)};
}
function simpleMatch(s,n) {const cls=Array.isArray(n.props.classes)?n.props.classes:String(n.props.classes||'').split(/\s+/);return (s.type==='*'||s.type===n.type)&&(!s.id||s.id===n.props.id)&&s.classes.every(c=>cls.includes(c));}
function matchesSelector(selector,node,ancestors=[]) {
 const s=typeof selector==='string'?parseSelector(selector):selector;let k=s.parts.length-1;if(!simpleMatch(s.parts[k],node))return false;let a=ancestors.length-1;
 while(k>0){const relation=s.parts[k].relation;k--;if(relation==='child'){if(a<0||!simpleMatch(s.parts[k],ancestors[a--]))return false;}
 else {while(a>=0&&!simpleMatch(s.parts[k],ancestors[a]))a--;if(a<0)return false;a--;}}
 return true;
}
/** Resolve structural selectors once. Only target pseudo masks/values stay live on GPU. */
function styleTree(view,options={}) {
 let serial=0,nodes=0;const active=new Set();const maxNodes=options.limits?.maxNodes??512,maxDepth=options.limits?.maxDepth??24;
 const walk=(node,ancestors,scope,resources,depth)=>{
  if(!node||typeof node.type!=='string'||!Array.isArray(node.children))throw new TypeError('Use h() to build a view');
  if(active.has(node))throw new TypeError('Cyclic view tree');if(++nodes>maxNodes||depth>maxDepth)throw new RangeError('Tree exceeds configured node/depth limits');active.add(node);
  const local=normalizeProperties(node.props);if(node.type==='WrapPanel'&&local.orientation==null)local.orientation='horizontal';const mergedResources={...resources,...local.resources};
  const rules=[...scope,...parseStyles(local.styles).map(r=>({...r,parsed:parseSelector(r.selector),depth,order:serial++}))];
  const own={...node,props:local};const matching=rules.filter(r=>matchesSelector(r.parsed,own,ancestors)).sort((a,b)=>a.depth-b.depth||a.parsed.specificity-b.parsed.specificity||a.order-b.order);
  const stat={},dynamic=[];for(const r of matching){const pseudo=r.parsed.parts.at(-1);const values={};for(const [k,v] of Object.entries(r.setters))values[k]=resource(v,mergedResources);
   if(pseudo.required||pseudo.forbidden)dynamic.push({required:pseudo.required,forbidden:pseudo.forbidden,setters:values});else Object.assign(stat,values);
  }
  let p={...stat,...local};delete p.styles;delete p.resources;delete p.classes;
  for(const [k,v] of Object.entries(p))p[k]=resource(v,mergedResources);p=normalizeProperties(p);
  // Local values have higher precedence than style activators. State setters are a bounded subset.
  const states=dynamic.map(r=>({...r,setters:Object.fromEntries(Object.entries(r.setters).filter(([k])=>!Object.hasOwn(local,k)))})).filter(r=>Object.keys(r.setters).length);
  if(states.length)p.stateStyles=states;
  const inherited={};for(const key of ['foreground','useLayoutRounding']){const parent=ancestors.at(-1)?.resolved;if(p[key]===undefined&&parent?.[key]!==undefined)inherited[key]=parent[key];}
  Object.assign(p,inherited);own.resolved=p;
  const result={type:node.type,props:p,children:node.children.map(child=>walk(child,[...ancestors,own],rules,mergedResources,depth+1))};active.delete(node);return result;
 };
 const rules=parseStyles(options.styles).map(r=>({...r,parsed:parseSelector(r.selector),depth:-1,order:serial++}));
 return walk(view,[],rules,options.resources||{},0);
}
const FluentTheme = `
Button { Background: #203746; Foreground: #e3eef7; BorderBrush: #38596e; BorderThickness: 1; CornerRadius: 7; MinHeight: 36; transition: background 140ms smooth, opacity 140ms smooth; }
Button:pointerover { Background: #315568; }
Button:pressed { Background: #167d94; }
Button:disabled { Opacity: 0.45; }
TextBox { Background: #101e2b; Foreground: #e3eef7; BorderBrush: #35586d; BorderThickness: 1; CornerRadius: 6; }
TextBox:focus { BorderBrush: #58d4ed; }
.card { Background: #152938; BorderBrush: #29485b; BorderThickness: 1; CornerRadius: 12; Padding: 16; }
.title { FontSize: 25; Foreground: #eaf8ff; }
.subtitle { FontSize: 13; Foreground: #9bb5c8; }
`;

return { PseudoClass, Style, StaticResource, ResourceDictionary, parseStyles, parseSelector, matchesSelector, styleTree, FluentTheme };
})();
__helionModules["src/composition/animations.js"] = (() => {
/** Serializable retained animation descriptors. Interpolation runs in compute. */
const Easing = Object.freeze({Linear:'linear',Smooth:'smooth',CubicIn:'cubicIn',CubicOut:'cubicOut',CubicInOut:'cubicInOut',SineInOut:'sineInOut',BackOut:'backOut',Spring:'spring',Step:'step'});
function KeyFrame(cue,value,easing='linear') {return {cue,value,easing};}
class ScalarKeyFrameAnimation {
 constructor(options={}) {this.duration=1;this.delay=0;this.iterations=1;this.direction='normal';this.fillMode='forwards';this.keyFrames=[];Object.assign(this,options);}
 insertKeyFrame(cue,value,easing='linear') {this.keyFrames.push(KeyFrame(cue,value,easing));return this;}
 InsertKeyFrame(cue,value,easing='linear') {return this.insertKeyFrame(cue,value,easing);}
 toAnimation(property) {return {property,duration:this.duration,delay:this.delay,iterations:this.iterations,direction:this.direction,fillMode:this.fillMode,keyFrames:this.keyFrames.map(k=>({...k}))};}
}
class Vector2KeyFrameAnimation extends ScalarKeyFrameAnimation {
 toAnimations(property) {
  const pair=({Offset:['translateX','translateY'],Scale:['scaleX','scaleY'],offset:['translateX','translateY'],scale:['scaleX','scaleY']})[property];
  if(!pair) throw new TypeError('Vector2 animation targets Offset or Scale');
  return pair.map((p,i)=>({...super.toAnimation(p),keyFrames:this.keyFrames.map(k=>({...k,value:k.value[i]}))}));
 }
}
class CompositionAnimationGroup {
 constructor(...animations) {this.animations=animations.flat();}
 add(animation) {this.animations.push(animation);return this;}
 toAnimations() {return this.animations.flatMap(a=>a instanceof CompositionAnimationGroup?a.toAnimations():a);}
}
class Compositor {
 createScalarKeyFrameAnimation(options) {return new ScalarKeyFrameAnimation(options);}
 createVector2KeyFrameAnimation(options) {return new Vector2KeyFrameAnimation(options);}
 createAnimationGroup(...animations) {return new CompositionAnimationGroup(...animations);}
 CreateScalarKeyFrameAnimation(options) {return this.createScalarKeyFrameAnimation(options);}
 CreateVector2KeyFrameAnimation(options) {return this.createVector2KeyFrameAnimation(options);}
 CreateAnimationGroup(...animations) {return this.createAnimationGroup(...animations);}
}
function bindExpression(property,source,{scale=1,offset=0,min=-1e7,max=1e7}={}) {
 return {property,expression:{source,scale,offset,min,max}};
}
function transition(property,duration=.18,easing='smooth') {return {property,duration,easing};}

return { Easing, KeyFrame, ScalarKeyFrameAnimation, Vector2KeyFrameAnimation, CompositionAnimationGroup, Compositor, bindExpression, transition };
})();
__helionModules["src/render/paths.js"] = (() => {
/** Declarative path parser: absolute/relative M L H V Q T C S A Z. Curves stay curves until GPU flattening. */
function parsePath(source) {
  if (Array.isArray(source)) {
    if (!source.every(s => Array.isArray(s) && s.length === 9 && [0, 1, 2].includes(s[0]) && s.slice(1).every(x => Number.isFinite(x) && Number.isFinite(Math.fround(x))))) throw new TypeError('Malformed vector segment array');
    return source.map(s => [...s]);
  }
  if (typeof source !== 'string') throw new TypeError('Path data must be a string');
  const tokens = source.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
  const junk = source.replace(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[\s,]/g, '');
  if (junk) throw new SyntaxError(`Invalid path tokens: ${junk}`);
  const out = []; let i = 0, command = '', x = 0, y = 0, sx = 0, sy = 0, last = '', controlX = 0, controlY = 0;
  const number = () => { if (i >= tokens.length || /^[a-z]$/i.test(tokens[i])) throw new SyntaxError('Missing path coordinate'); const v = Number(tokens[i++]); if (!Number.isFinite(v) || !Number.isFinite(Math.fround(v))) throw new TypeError('Non-finite path coordinate'); return v; };
  while (i < tokens.length) {
    if (/^[a-z]$/i.test(tokens[i])) command = tokens[i++];
    if (!command) throw new SyntaxError('Path must begin with a command');
    const relative = command === command.toLowerCase(), c = command.toUpperCase();
    const point = () => [number() + (relative ? x : 0), number() + (relative ? y : 0)];
    if (c === 'Z') { if (x !== sx || y !== sy) out.push([0, x, y, sx, sy, 0, 0, 0, 0]); x = sx; y = sy; last='Z';command = ''; continue; }
    if (c === 'M') { [x, y] = point(); sx = x; sy = y; command = relative ? 'l' : 'L';last='M';continue; }
    if (c === 'L') { const [nx, ny] = point(); out.push([0, x, y, nx, ny, 0, 0, 0, 0]); x = nx; y = ny; }
    else if (c === 'H') { const nx = number() + (relative ? x : 0); out.push([0, x, y, nx, y, 0, 0, 0, 0]); x = nx; }
    else if (c === 'V') { const ny = number() + (relative ? y : 0); out.push([0, x, y, x, ny, 0, 0, 0, 0]); y = ny; }
    else if (c === 'Q') { const p = point(), q = point(); out.push([1, x, y, ...p, ...q, 0, 0]); [controlX,controlY]=p;[x, y] = q; }
    else if (c === 'C') { const p = point(), q = point(), r = point(); out.push([2, x, y, ...p, ...q, ...r]); [controlX,controlY]=q;[x, y] = r; }
    else if (c === 'S') { const p=['C','S'].includes(last)?[2*x-controlX,2*y-controlY]:[x,y],q=point(),r=point();out.push([2,x,y,...p,...q,...r]);[controlX,controlY]=q;[x,y]=r; }
    else if (c === 'T') { const p=['Q','T'].includes(last)?[2*x-controlX,2*y-controlY]:[x,y],q=point();out.push([1,x,y,...p,...q,0,0]);[controlX,controlY]=p;[x,y]=q; }
    else if (c === 'A') { const rx=number(),ry=number(),rotation=number(),large=number(),sweep=number(),end=point();if(![0,1].includes(large)||![0,1].includes(sweep))throw new SyntaxError('Arc flags must be 0 or 1');out.push(...arcToCubics([x,y],end,rx,ry,rotation,large,sweep));[x,y]=end; }
    else throw new SyntaxError(`Unsupported path command ${command}; use M/L/H/V/Q/T/C/S/A/Z`);
    last=c;
  }
  if(out.some(segment=>segment.slice(1).some(x=>!Number.isFinite(x)||!Number.isFinite(Math.fround(x)))))throw new RangeError('Path normalization exceeded f32 range');
  return out;
}
function pathBounds(segments) {
  if (!segments.length) return [0, 0, 0, 0];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of segments) for (let i = 1; i < 5 + s[0] * 2; i += 2) { x0 = Math.min(x0, s[i]); y0 = Math.min(y0, s[i + 1]); x1 = Math.max(x1, s[i]); y1 = Math.max(y1, s[i + 1]); }
  return [x0, y0, x1, y1];
}

/** Endpoint arc normalization, performed once while authoring. Cubic geometry
 * remains retained and its flattening/rasterization still execute in WGSL. */
function arcToCubics(start,end,radiusX,radiusY,rotation,largeArc,sweep) {
 let rx=Math.abs(radiusX),ry=Math.abs(radiusY);const [x0,y0]=start,[x1,y1]=end;
 if(x0===x1&&y0===y1)return [];if(!rx||!ry)return [[0,x0,y0,x1,y1,0,0,0,0]];
 const phi=rotation*Math.PI/180,c=Math.cos(phi),s=Math.sin(phi),dx=(x0-x1)/2,dy=(y0-y1)/2;
 const xp=c*dx+s*dy,yp=-s*dx+c*dy;const radii=xp*xp/(rx*rx)+yp*yp/(ry*ry);if(radii>1){const k=Math.sqrt(radii);rx*=k;ry*=k;}
 const denom=rx*rx*yp*yp+ry*ry*xp*xp;const factor=(largeArc===sweep?-1:1)*Math.sqrt(Math.max(0,(rx*rx*ry*ry-denom)/denom));
 const cxp=factor*rx*yp/ry,cyp=-factor*ry*xp/rx,cx=c*cxp-s*cyp+(x0+x1)/2,cy=s*cxp+c*cyp+(y0+y1)/2;
 const ux=(xp-cxp)/rx,uy=(yp-cyp)/ry,vx=(-xp-cxp)/rx,vy=(-yp-cyp)/ry;
 const begin=Math.atan2(uy,ux);let delta=Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy);if(!sweep&&delta>0)delta-=2*Math.PI;if(sweep&&delta<0)delta+=2*Math.PI;
 const count=Math.max(1,Math.ceil(Math.abs(delta)/(Math.PI/2))),step=delta/count,out=[];let previous=start;
 const point=t=>[cx+rx*c*Math.cos(t)-ry*s*Math.sin(t),cy+rx*s*Math.cos(t)+ry*c*Math.sin(t)];
 const tangent=t=>[-rx*c*Math.sin(t)-ry*s*Math.cos(t),-rx*s*Math.sin(t)+ry*c*Math.cos(t)];
 for(let i=0;i<count;i++){const a=begin+i*step,b=a+step,k=4/3*Math.tan(step/4),p=point(a),q=i+1===count?end:point(b),ta=tangent(a),tb=tangent(b);out.push([2,...previous,p[0]+k*ta[0],p[1]+k*ta[1],q[0]-k*tb[0],q[1]-k*tb[1],...q]);previous=q;}
 return out;
}

return { parsePath, pathBounds, arcToCubics };
})();
__helionModules["src/drawing/geometry.js"] = (() => {
const { parsePath, pathBounds } = __helionModules["src/render/paths.js"];

function Point(x=0,y=0) {return [Number(x),Number(y)];}
function Rect(x=0,y=0,width=0,height=0) {const r=[x,y,width,height].map(Number);if(!r.every(Number.isFinite)||r[2]<0||r[3]<0) throw new RangeError('Invalid Rect');return r;}
function Matrix(m11=1,m12=0,m21=0,m22=1,offsetX=0,offsetY=0) {const a=[m11,m12,m21,m22,offsetX,offsetY].map(Number);if(!a.every(Number.isFinite))throw new RangeError('Invalid Matrix');return a;}
function TranslateTransform(x,y=0) {return Matrix(1,0,0,1,x,y);}
function ScaleTransform(x,y=x) {return Matrix(x,0,0,y);}
function RotateTransform(degrees) {const a=Number(degrees)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return Matrix(c,s,-s,c);}
function SkewTransform(x,y=0) {return Matrix(1,Math.tan(y*Math.PI/180),Math.tan(x*Math.PI/180),1);}
function multiplyMatrices(a,b) {return Matrix(a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]);}
function TransformGroup(...items) {return items.flat(0).reduce(multiplyMatrices,Matrix());}
function PathGeometry(path,fillRule='nonzero') {const segments=parsePath(path);return {kind:'geometry',segments,bounds:pathBounds(segments),fillRule};}
function RectangleGeometry(rect,radiusX=0,radiusY=radiusX) {
 const [x,y,w,h]=Rect(...rect),rx=Math.min(Math.max(0,radiusX),w/2),ry=Math.min(Math.max(0,radiusY),h/2),k=.5522847498307936;
 if(!rx||!ry) return PathGeometry(`M ${x} ${y} L ${x+w} ${y} L ${x+w} ${y+h} L ${x} ${y+h} Z`);
 return PathGeometry(`M ${x+rx} ${y} L ${x+w-rx} ${y} C ${x+w-rx+k*rx} ${y} ${x+w} ${y+ry-k*ry} ${x+w} ${y+ry} L ${x+w} ${y+h-ry} C ${x+w} ${y+h-ry+k*ry} ${x+w-rx+k*rx} ${y+h} ${x+w-rx} ${y+h} L ${x+rx} ${y+h} C ${x+rx-k*rx} ${y+h} ${x} ${y+h-ry+k*ry} ${x} ${y+h-ry} L ${x} ${y+ry} C ${x} ${y+ry-k*ry} ${x+rx-k*rx} ${y} ${x+rx} ${y} Z`);
}
function EllipseGeometry(center,radiusX,radiusY=radiusX) {
 const [x,y]=center,rx=Number(radiusX),ry=Number(radiusY),k=.5522847498307936;
 if(!(rx>0&&ry>0)) throw new RangeError('Ellipse radii must be positive');
 return PathGeometry(`M ${x+rx} ${y} C ${x+rx} ${y+k*ry} ${x+k*rx} ${y+ry} ${x} ${y+ry} C ${x-k*rx} ${y+ry} ${x-rx} ${y+k*ry} ${x-rx} ${y} C ${x-rx} ${y-k*ry} ${x-k*rx} ${y-ry} ${x} ${y-ry} C ${x+k*rx} ${y-ry} ${x+rx} ${y-k*ry} ${x+rx} ${y} Z`);
}
function GeometryGroup(children,fillRule='nonzero') {return PathGeometry(children.flatMap(g=>g.segments),fillRule);}
class StreamGeometry {
 constructor(fillRule='nonzero') {this.fillRule=fillRule;this.commands=[];this.opened=false;}
 open() {if(this.opened)throw new Error('Geometry already opened');this.opened=true;return new StreamGeometryContext(this);}
 Open() {return this.open();}
 toGeometry() {if(this.opened)throw new Error('Close geometry context first');return PathGeometry(this.commands.join(' '),this.fillRule);}
}
class StreamGeometryContext {
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

return { Point, Rect, Matrix, TranslateTransform, ScaleTransform, RotateTransform, SkewTransform, multiplyMatrices, TransformGroup, PathGeometry, RectangleGeometry, EllipseGeometry, GeometryGroup, StreamGeometry, StreamGeometryContext };
})();
__helionModules["src/drawing/context.js"] = (() => {
const { PathGeometry, RectangleGeometry, EllipseGeometry, Matrix, Rect } = __helionModules["src/drawing/geometry.js"];

function SolidColorBrush(color,opacity=1) {return {kind:'solid',color,opacity};}
function GradientStop(color,offset) {return {color,offset};}
function LinearGradientBrush(stops,start=[0,0],end=[1,1],spread='pad') {return {kind:'linear',stops,start,end,spread};}
function RadialGradientBrush(stops,center=[.5,.5],radius=[.5,.5],spread='pad') {return {kind:'radial',stops,center,radius,spread};}
function Pen(brush,thickness=1) {return {brush,thickness};}
function FormattedText(text,options={}) {return {text:String(text),fontSize:14,...options};}
function GlyphRun(glyphIndices,{fontSize=14,baselineOrigin=[0,0],advances=null,offsets=null}={}) {return {glyphIndices:Array.from(glyphIndices),fontSize,baselineOrigin:[...baselineOrigin],advances:advances==null?null:Array.from(advances),offsets:offsets==null?null:offsets.map(p=>[...p])};}
function ImageSource(width,height,pixels) {return {width,height,pixels:Uint8Array.from(pixels)};}
class DrawingContext {
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
class DrawingGroup {
 constructor(options={}) {this.options=options;this.context=null;}
 open() {this.context=new DrawingContext(this.options);return this.context;}
 Open() {return this.open();}
 toDrawing() {if(!this.context)throw new Error('Open and populate the drawing group first');return this.context.close();}
 toView(props={}) {if(!this.context)throw new Error('Empty drawing group');return this.context.toView(props);}
}
function GeometryDrawing(brush,pen,geometry) {const context=new DrawingContext();context.drawGeometry(brush,pen,geometry);return context.close();}
function GlyphRunDrawing(brush,glyphRun) {const context=new DrawingContext();context.drawGlyphRun(brush,glyphRun);return context.close();}

return { SolidColorBrush, GradientStop, LinearGradientBrush, RadialGradientBrush, Pen, FormattedText, GlyphRun, ImageSource, DrawingContext, DrawingGroup, GeometryDrawing, GlyphRunDrawing };
})();
__helionModules["src/playground/authoring.js"] = (() => {
const { ShapedText } = __helionModules["src/typography/declaration.js"];

const { AccentButton,SubtleButton,DestructiveButton,AccentButtonTemplate,SubtleButtonTemplate,DestructiveButtonTemplate,themePreferenceAction,ControlTemplate,TemplateBinding,ThemeResource,VisualState,VisualStateGroup,WinUIFluentTheme,MacOS26Theme,ToggleSwitch,TemplatedToggleButton,ButtonTemplate,CheckBoxTemplate,SliderTemplate,TextBoxTemplate,ProgressBarTemplate,ContentControlTemplate,templateAction,themeAction } = __helionModules["src/templates/index.js"];

const { dataSource,createDataSource } = __helionModules["src/data/index.js"];

const { hostAction,Toolbar,StatusBar,Menu,ToggleButton,Separator,Popup,Dialog } = __helionModules["src/controls/index.js"];

const { TextDocument } = __helionModules["src/editor/declarations.js"];

const { EditorCommand } = __helionModules["src/editor/schema.js"];

const { DockTabs,DockSplit,DockCommand } = __helionModules["src/docking/index.js"];

const { defineModel,defineViewModel,field,computed,ref,expr,modelBinding } = __helionModules["src/models/index.js"];

const { Color, ColorFromArgb, parseColor } = __helionModules["src/core/colors.js"];

const { h } = __helionModules["src/core/declaration.js"];

const { Dock, Orientation, Stretch, Thickness, GridLength, RowDefinition, ColumnDefinition } = __helionModules["src/layout/properties.js"];

const { Style, StaticResource, ResourceDictionary, FluentTheme, parseStyles } = __helionModules["src/styling/styles.js"];

const { Compositor, ScalarKeyFrameAnimation, Vector2KeyFrameAnimation, CompositionAnimationGroup, Easing, KeyFrame, bindExpression, transition } = __helionModules["src/composition/animations.js"];

const { DrawingContext, SolidColorBrush, LinearGradientBrush, RadialGradientBrush, GradientStop, Pen, FormattedText, ImageSource, GlyphRun, DrawingGroup, GeometryDrawing, GlyphRunDrawing } = __helionModules["src/drawing/context.js"];

const { Point, Rect, Matrix, TranslateTransform, ScaleTransform, RotateTransform, SkewTransform, TransformGroup, PathGeometry, RectangleGeometry, EllipseGeometry, GeometryGroup, StreamGeometry } = __helionModules["src/drawing/geometry.js"];

const authoringAPI=Object.freeze({ShapedText,AccentButton,SubtleButton,DestructiveButton,AccentButtonTemplate,SubtleButtonTemplate,DestructiveButtonTemplate,themePreferenceAction,ControlTemplate,TemplateBinding,ThemeResource,VisualState,VisualStateGroup,WinUIFluentTheme,MacOS26Theme,ToggleSwitch,TemplatedToggleButton,ButtonTemplate,CheckBoxTemplate,SliderTemplate,TextBoxTemplate,ProgressBarTemplate,ContentControlTemplate,templateAction,themeAction,dataSource,createDataSource,hostAction,Toolbar,StatusBar,Menu,ToggleButton,Separator,Popup,Dialog,TextDocument,EditorCommand,DockTabs,DockSplit,DockCommand,defineModel,defineViewModel,field,computed,ref,expr,modelBinding,Color,ColorFromArgb,parseColor,h,Dock,Orientation,Stretch,Thickness,GridLength,RowDefinition,ColumnDefinition,Style,StaticResource,ResourceDictionary,FluentTheme,parseStyles,Compositor,ScalarKeyFrameAnimation,Vector2KeyFrameAnimation,CompositionAnimationGroup,Easing,KeyFrame,bindExpression,transition,DrawingContext,SolidColorBrush,LinearGradientBrush,RadialGradientBrush,GradientStop,Pen,FormattedText,ImageSource,GlyphRun,DrawingGroup,GeometryDrawing,GlyphRunDrawing,Point,Rect,Matrix,TranslateTransform,ScaleTransform,RotateTransform,SkewTransform,TransformGroup,PathGeometry,RectangleGeometry,EllipseGeometry,GeometryGroup,StreamGeometry});

return { authoringAPI };
})();
//# sourceURL=helion/startup-worker.bundle.js

globalThis.__HELION_AUTHORING__ = __helionModules['src/playground/authoring.js'].authoringAPI;
