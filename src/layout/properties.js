/** Declarative compatibility adapters. They normalize authoring syntax only;
 * geometry is measured and arranged by layout.wgsl, not by these helpers. */
export const Dock = Object.freeze({ Left:'left', Top:'top', Right:'right', Bottom:'bottom' });
export const Orientation = Object.freeze({ Horizontal:'horizontal', Vertical:'vertical' });
export const Stretch = Object.freeze({ None:'none', Fill:'fill', Uniform:'uniform', UniformToFill:'uniformToFill' });
export function Thickness(left=0,top=left,right=left,bottom=top) {
  const a=[left,top,right,bottom].map(Number); if(!a.every(Number.isFinite)) throw new TypeError('Thickness requires finite values'); return a;
}
export function GridLength(value=1,unit='star') {
  unit=String(unit).toLowerCase(); if(unit==='auto') return 'auto';
  value=Number(value); if(!Number.isFinite(value)||value<0||(unit==='star'&&value===0)) throw new RangeError('Invalid GridLength');
  if(!['star','pixel'].includes(unit)) throw new TypeError('GridLength unit must be auto, pixel or star');
  return unit==='star'?`${value}*`:value;
}
export function RowDefinition(height='*',min=0,max=1e7) {return {length:height,min,max};}
export function ColumnDefinition(width='*',min=0,max=1e7) {return {length:width,min,max};}
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
export function propertyName(name) {const value=aliases[name]||name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase()).replace(/^[A-Z]/,c=>c.toLowerCase());return semanticAliases[value]||value;}
export function normalizeProperties(input={}) {
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
