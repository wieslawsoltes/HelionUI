import {propertyName,normalizeProperties} from '../layout/properties.js';
import {templateProperties,templateReadableStates} from './schema.js';
const own=(o,k)=>Object.hasOwn(o,k);
export function templateProperty(name){const p=propertyName(String(name));return ({content:'text',isChecked:'value',cornerRadius:'radius',borderBrush:'borderColor',borderThickness:'borderWidth'})[p]??p;}
export function TemplateBinding(property,options={}){
 property=templateProperty(property);if(!own(templateProperties,property)&&!own(templateReadableStates,property))throw new TypeError(`Unknown templated-parent property ${property}`);
 const {scale=1,offset=0,min=-1e7,max=1e7,relativeTo=null,relativeOffset=0,mode='oneWay',negate=false}=options;
 if(![scale,offset,min,max,relativeOffset].every(n=>typeof n==='number'&&Number.isFinite(n)&&Number.isFinite(Math.fround(n)))||min>max)throw new RangeError('Invalid TemplateBinding numeric transform');
 if(!['oneWay','twoWay'].includes(mode))throw new TypeError('TemplateBinding mode must be oneWay or twoWay');
 if(relativeTo&&!['actualWidth','actualHeight'].includes(relativeTo))throw new TypeError('relativeTo must be actualWidth or actualHeight');
 if(mode==='twoWay'&&(property!=='value'||relativeTo||relativeOffset!==0||negate||scale!==1||offset!==0||min!==-1e7||max!==1e7))throw new TypeError('Two-way TemplateBinding supports an unconverted value only');
 return {kind:'templateBinding',property,scale,offset,min,max,relativeTo,relativeOffset,mode,negate:!!negate};
}
export function ThemeResource(key){if(typeof key!=='string'||!key||key.length>128)throw new TypeError('ThemeResource key required');return {kind:'themeResource',key};}
export function VisualState(name,setters={},options={}){return {name,setters,...options};}
export function VisualStateGroup(name,states){return {name,states};}
export function ControlTemplate(targetType,root,options={}){
 if(typeof targetType==='object'&&targetType){const o=targetType;return ControlTemplate(o.targetType,o.root,{...o});}
 if(!['Button','CheckBox','Slider','TextBox','ProgressBar','ContentControl','ContentPresenter','Panel','Border'].includes(targetType))throw new TypeError(`Unsupported ControlTemplate target ${targetType}`);
 if(!root||typeof root.type!=='string')throw new TypeError('ControlTemplate needs a declarative root');
 const name=options.name??`${targetType}Template`;if(typeof name!=='string'||!name||name.length>128)throw new TypeError('Template name required');
 return {kind:'controlTemplate',name,targetType,root:structuredClone(root),visualStateGroups:structuredClone(options.visualStateGroups??options.states??[]),defaults:normalizeProperties(options.defaults??{})};
}
export function validateControlTemplate(value){
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
