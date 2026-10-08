import {normalizeThemeSettings,resolveThemePalette} from './preferences.js';
import {normalizeProperties} from '../layout/properties.js';
import {TemplateBinding,templateProperty,validateControlTemplate} from './definitions.js';
import {DEFAULT_CONTROL_THEMES,BUILTIN_CONTROL_TEMPLATES} from './themes.js';
const isValue=v=>v?.kind==='templateBinding'||v?.kind==='themeResource';
const copy=v=>structuredClone(v);
/** One-time expansion only. Mutable values/bindings/states subsequently execute in WGSL. */
export function expandTemplates(view,options={}){
 let serial=0;const usedIDs=new Set(),stack=[];let needed=false;
 const rootProps=normalizeProperties(view.props??{});const themes=copy(rootProps.themes??options.themes??DEFAULT_CONTROL_THEMES);
 if(!Array.isArray(themes)||!themes.length||themes.length>8||new Set(themes.map(t=>t.name)).size!==themes.length)throw new TypeError('Use 1–8 uniquely named control themes');
 for(const t of themes){if(!t||typeof t.name!=='string'||!t.dark||!t.light)throw new TypeError('Theme requires name, dark, and light resources');}
 let designTheme;const findDesign=n=>{if(n.type==='DesignSurface'&&n.props?.designDocument?.templates?.length)designTheme=n.props.designDocument;for(const c of n.children??[])findDesign(c);};findDesign(view);if(designTheme&&(themes[0]?.name!=='fluent'||themes[1]?.name!=='macos26'))throw new TypeError('Studio requires fluent and macos26 as the first two prepared themes');
 const selected=rootProps.theme??options.theme??designTheme?.theme??'fluent';const themeIndex=themes.findIndex(t=>t.name===(typeof selected==='string'?selected:selected.name));if(themeIndex<0)throw new ReferenceError(`Unknown theme ${selected?.name??selected}`);
 const variant=rootProps.themeVariant??options.themeVariant??designTheme?.themeVariant??'dark';if(!['light','dark'].includes(variant))throw new TypeError('themeVariant must be light or dark');
 const settings=normalizeThemeSettings(Object.fromEntries(['themeContrast','controlDensity','accentColor'].map(k=>[k,rootProps[k]??options[k]??designTheme?.[k]])));
 const palette=resolveThemePalette(themes[themeIndex],variant,settings);const registry=rootProps.templates??options.templates??{};
 const initial=(value,parent={})=>{
  if(value?.kind==='themeResource'){if(!Object.hasOwn(palette,value.key))throw new ReferenceError(`Unknown theme resource ${value.key}`);return palette[value.key];}
  if(value?.kind==='templateBinding'){
   const p=templateProperty(value.property);if(p==='text')return String(parent.text??'');if(p==='actualWidth'||p==='actualHeight')return 0;
   const defaults={background:0,foreground:'#dbe8f4',borderColor:0,radius:0,borderWidth:0,padding:0,gap:0,fontSize:14,width:-1,height:-1,opacity:1,scaleX:1,scaleY:1,value:0,horizontalAlignment:'stretch',verticalAlignment:'stretch',minWidth:0,minHeight:0,maxWidth:1e7,maxHeight:1e7};
   let x=initial(parent[p]??defaults[p]??0);if(typeof x!=='number')return x;
   return Math.min(value.max??1e7,Math.max(value.min??-1e7,x))*(value.scale??1)+(value.offset??0);
  }
  return value;
 };
 const materialize=(p,parent)=>{const expressions={...p.templateExpressions};if(p.action?.type==='template')needed=true;for(const [key,destination]of [['isEnabled','disabled'],['isVisible','hidden']])if(isValue(p[key])){p[destination]={...p[key],negate:!p[key].negate};delete p[key];}for(const [key,value]of Object.entries(p)){if(isValue(value)){if(value.kind==='templateBinding'&&((templateProperty(key)==='text')!==(templateProperty(value.property)==='text')))throw new TypeError('String TemplateBinding requires a text target');expressions[templateProperty(key)]=copy(value);p[key]=initial(value,parent);if(value.negate)p[key]=!p[key];}}
  if(Object.keys(expressions).length){p.templateExpressions=expressions;needed=true;}return p;
 };
 const walk=(v,context=null,level=0)=>{
  if(!v||typeof v.type!=='string'||!Array.isArray(v.children))throw new TypeError('Malformed retained template view');if(level>30)throw new RangeError('Expanded template depth exceeds 30');
  let p=normalizeProperties(copy(v.props??{}));let definition=p.template;if(p.controlThemes!=null&&typeof p.controlThemes!=='boolean')throw new TypeError('controlThemes must be boolean');const implicit=p.controlThemes??context?.implicit??false;
  if(definition==='default'||(definition==null&&implicit&&BUILTIN_CONTROL_TEMPLATES[v.type]))definition=themes[themeIndex].templates?.[v.type]??BUILTIN_CONTROL_TEMPLATES[v.type];
  if(typeof definition==='string'){definition=registry[definition];if(!definition)throw new ReferenceError(`Unknown template ${p.template}`);}
  delete p.template;delete p.controlThemes;delete p.templates;delete p.themes;delete p.theme;delete p.themeVariant;delete p.themeContrast;delete p.controlDensity;delete p.accentColor;
  // A theme resource outside a template is also a retained expression owner.
  if(!definition){p=materialize(p,context?.parent??{});const result={type:v.type,props:p,children:v.children.map(c=>walk(c,{...context,implicit},level+1))};return result;}
  const tpl=validateControlTemplate(definition);if(tpl.targetType!==v.type)throw new TypeError(`Template ${tpl.name} targets ${tpl.targetType}, not ${v.type}`);
  if(stack.includes(definition)||stack.length>=8)throw new TypeError('Recursive control template or nesting exceeds eight');stack.push(definition);needed=true;
  const owner=p.id??`$template-${serial++}`;if(usedIDs.has(owner))throw new TypeError(`Duplicate template owner ${owner}`);usedIDs.add(owner);p.id=owner;
  p={...copy(tpl.defaults),...p};p=materialize(p,context?.parent??{});
  const names=Object.create(null),parts=[];let contentID=null,nativeID=null;
  const clonePart=(part,depth)=>{
   const pp=normalizeProperties(copy(part.props??{}));const name=pp.id??`$part-${parts.length}`;const id=`${owner}::${name}`;if(Object.hasOwn(names,name))throw new TypeError(`Duplicate part ${name}`);names[name]=id;pp.id=id;
   const role=part.type==='NativeContentPresenter'?3:part.type==='ContentPresenter'?2:1;
   const meta={owner,name,ordinal:parts.length,role,depth};pp.templatePart=meta;parts.push(id);
   let children=part.children;
   if(role===2){contentID=id;if(v.children.length){if(children.length)throw new TypeError('ContentPresenter cannot have both template content and control content');children=v.children.map(copy);}else{pp.text??=TemplateBinding('text');}pp.foreground??=TemplateBinding('foreground');pp.fontSize??=TemplateBinding('fontSize');}
   if(role===3){nativeID=id;pp.text=TemplateBinding('text');pp.foreground??=TemplateBinding('foreground');pp.fontSize??=TemplateBinding('fontSize');}
   materialize(pp,p);
   const cloned={type:part.type,props:pp,children:children.map(c=>role===2&&v.children.length?walk(c,{implicit},level+depth+2):clonePart(c,depth+1))};
   return cloned;
  };
  let root=clonePart(tpl.root,0);
  if(v.children.length&&!contentID)throw new TypeError('A control with content requires a ContentPresenter in its template');
  const remap=n=>{const q=n.props;if(q.templatePart?.owner!==owner)return;for(const ref of ['filter','activeOnly'])if(q[ref]&&names[q[ref]])q[ref]=names[q[ref]];if(q.bind?.source&&names[q.bind.source])q.bind={...q.bind,source:names[q.bind.source]};if(q.action?.target&&names[q.action.target])q.action={...q.action,target:names[q.action.target]};for(const c of n.children)remap(c);};remap(root);
  p.templateInstance={name:tpl.name,targetType:tpl.targetType,root:root.props.id,parts,names,content:contentID,native:nativeID,groups:tpl.visualStateGroups,nesting:context?.nesting??0};
  // Nested explicit templates are expanded after this instance has its namescope.
  const nested=n=>n.props.template?walk(n,{parent:p,nesting:(context?.nesting??0)+1},level+1):({...n,children:n.children.map(nested)});
  root=nested(root);stack.pop();return{type:v.type,props:p,children:[root]};
 };
 const result=walk(view);if(needed||rootProps.theme||options.theme){result.props.templateSystem={...settings,themes:themes.map(({templates,...t})=>t),themeIndex,variant:variant==='light'?1:0,reducedMotion:!!(rootProps.reducedMotion??options.reducedMotion??designTheme?.reducedMotion)};}
 return result;
}
