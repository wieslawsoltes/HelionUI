import {resolveThemePalette,themeAccentColors} from './preferences.js';
import {fbits,rgba,Kind,NODE_WORDS,GLOBAL_WORDS,CONTROL_WORDS} from '../core/schema.js';
import {packNodeExtension,easingCode} from '../core/extensions.js';
import {PseudoClass} from '../styling/styles.js';
import {templateProperty,TemplateBinding} from './definitions.js';
import {TEMPLATE_MAGIC,TEMPLATE_INFO_WORDS,TEMPLATE_PLAN_WORDS,TEMPLATE_RULE_WORDS,templateProperties,templateLayoutProperties,templateReadableStates} from './schema.js';
const own=(o,k)=>Object.hasOwn(o,k);
export function packTemplates(heap,list,u,state,resolve){
 const root=list[0].props.templateSystem;const owners=list.filter(n=>n.props.templateInstance||n.props.templateExpressions&&!n.props.templatePart);
 if(!root&&!owners.length)return {templates:[],templateSystem:null,templateLevels:0,templateLayout:false};
 const f=new Float32Array(u.buffer),ext=n=>{let e=f[n.index*72+47];if(!e){e=packNodeExtension(heap,{...n.props,renderTransformOrigin:n.props.renderTransformOrigin??[.5,.5]},n.type,u,state,n.index,[]);f[n.index*72+47]=e;}return e;};
 const system=heap.alloc(32),ranks=heap.alloc(list.length),reverse=heap.alloc(list.length);heap.set(system,[TEMPLATE_MAGIC,root?.themeIndex??0,root?.variant??0,root?.reducedMotion?1:0,list.length,ranks,reverse,owners.length,root?.themes.length??0,0,0,0]);
 heap.words[system+11]=8;heap.words[system+12]=root?.themeContrast==='high'?1:0;heap.words[system+13]=root?.controlDensity==='compact'?1:0;
 if(root?.accentColor!=null){const a=themeAccentColors(root.accentColor);heap.set(system+14,[1,a.accent,a.accentText,a.accentHover,a.accentPressed]);}
 list.forEach(n=>{heap.words[ranks+n.index]=n.index;heap.words[reverse+n.index]=n.index;});heap.words[ext(list[0])+37]=system;
 const themes=root?.themes??[];const resourceCache=new Map();
 const resource=(name,category)=>{const key=`${category}:${name}`;if(resourceCache.has(key))return resourceCache.get(key);const values=themes.flatMap(t=>['dark','light'].flatMap(v=>['standard','high'].flatMap(themeContrast=>['comfortable','compact'].map(controlDensity=>{const palette=resolveThemePalette(t,v,{themeContrast,controlDensity});if(!own(palette,name))throw new ReferenceError(`Theme ${t.name}/${v} lacks ${name}`);return literalBits(palette[name],category,name);}))));if(!values.length)throw new ReferenceError('ThemeResource requires a theme bank');const p=heap.push(values);resourceCache.set(key,p);return p;};
 const literalBits=(value,category,property='')=>{if(category===0)return rgba(value);if(category===4){return heap.string(String(value??''),0,true)[0];}if(category===2)return Number(!!value);if(category===3){const v=typeof value==='string'?['stretch','start','center','end'].indexOf(value):Number(value);if(!Number.isInteger(v)||v<0||v>3)throw new RangeError(`Invalid template ${property}`);return v;}if(value==='auto'&&(property==='width'||property==='height'))return fbits(-1);const n=Number(value);if(!Number.isFinite(n)||!Number.isFinite(Math.fround(n)))throw new TypeError(`Nonfinite template ${property}`);if(property==='fontSize'&&(!(n>0)||n>1024))throw new RangeError('Font size must be 0–1024');return fbits(n);};
 const expression=(value,category,property)=>{
  if(value?.kind==='templateBinding'){
   const b=TemplateBinding(value.property,value);const source=templateProperties[b.property];const pseudo=templateReadableStates[b.property];if(category===4&&b.property!=='text'||category!==4&&b.property==='text')throw new TypeError('String TemplateBinding requires a text target');
   if(source&&source[0]!==category&&!(category===1&&source[0]===3)&&!(category===2&&source[0]===1))throw new TypeError(`Incompatible TemplateBinding ${b.property} → ${property}`);
   if(b.negate&&category!==2)throw new TypeError('Negation requires a boolean binding target');
   if(b.relativeTo&&category!==1)throw new TypeError('Relative bindings require a numeric target');
   if((b.relativeTo||b.property.startsWith('actual'))&&templateLayoutProperties.has(property))throw new TypeError('Actual-size bindings target composition properties only; layout feedback is rejected');
   if(category!==1&&(b.scale!==1||b.offset!==0||b.relativeTo))throw new TypeError('Only numeric bindings support arithmetic');
   if(b.mode==='twoWay'&&property!=='value')throw new TypeError('Two-way binding target must be value');
   return [1,source?source[0]*65536+source[1]:0x100000+ (pseudo??0),fbits(b.scale),fbits(b.offset),fbits(b.min),fbits(b.max),b.relativeTo==='actualWidth'?1:b.relativeTo==='actualHeight'?2:0,category===2?(b.negate?1:0):fbits(b.relativeOffset)];
  }
  if(value?.kind==='themeResource')return[2,resource(value.key,category),fbits(1),0,fbits(-1e7),fbits(1e7),({accent:1,accentStroke:1,accentText:2,accentHover:3,accentPressed:4})[value.key]??0,value.negate?1:0];
  if(property==='padding'&&Array.isArray(value)){let v=value.length===1?Array(4).fill(value[0]):value.length===2?[...value,...value]:value;if(v.length!==4||v.some(x=>!Number.isFinite(x)||x<0))throw new TypeError('Invalid template padding');return [3,heap.push(v.map(fbits)),fbits(1),0,fbits(-1e7),fbits(1e7),0,0];}
  return[0,literalBits(value,category,property),fbits(1),0,fbits(-1e7),fbits(1e7),0,0];
 };
 const metadata=new Map(),templates=[];let maxLevel=0,hasLayout=false;
 for(const n of owners){const p=n.props.templateInstance;const pointer=heap.alloc(TEMPLATE_INFO_WORDS);const groupNames=[],groups=[];
  for(const group of p?.groups??[]){groupNames.push({name:group.name,states:group.states.map(s=>s.name)});const states=group.states.flatMap(s=>{let required=0,forbidden=0;for(const[k,v]of Object.entries(s.when??{})){if(!own(PseudoClass,k)||typeof v!=='boolean')throw new TypeError(`Invalid visual-state condition ${k}`);if(v)required|=PseudoClass[k];else forbidden|=PseudoClass[k];}return[required,forbidden,s.when==null?0:1,0];});groups.push([group.states.length,heap.push(states),0xffffffff,0]);}
  const groupPointer=groups.length?heap.push(groups.flat()):0;
  const record={owner:n.index,pointer,name:p?.name??'ThemeResources',root:p?resolve(p.root):0xffffffff,parts:(p?.parts??[]).map(resolve),names:p?Object.fromEntries(Object.entries(p.names).map(([k,v])=>[k,resolve(v)])):{},groups:groupNames,nesting:p?.nesting??0,targetType:p?.targetType??n.type,native:p?.native?resolve(p.native):0xffffffff,content:p?.content?resolve(p.content):0xffffffff};
  maxLevel=Math.max(maxLevel,record.nesting);metadata.set(n.index,record);templates.push(record);heap.words[ext(n)+38]=pointer;
  heap.set(pointer,[n.index,record.root,0,0,groupPointer,groups.length,Kind[record.targetType],0,p?1:0,record.native,record.nesting,0,record.content,heap.push(record.parts.length?record.parts:[0]),record.parts.length,0,0,0,0,0]);
 }
 // Per-part links do not replace an inner control's own instance record.
 for(const n of list){const p=n.props.templatePart;if(!p)continue;const owner=resolve(p.owner),link=heap.push([owner,p.role,p.ordinal,p.depth]);heap.words[ext(n)+36]=link;}
 for(const item of templates){const owner=list[item.owner],p=owner.props.templateInstance;const planMap=new Map();
  const planFor=(n,property)=>{property=templateProperty(property);const spec=templateProperties[property];if(!spec||property.startsWith('actual'))throw new TypeError(`Unsupported template property ${property}`);const key=`${n.index}:${property}`;if(!planMap.has(key)){const value=n.props.templateExpressions?.[property]??n.props[property]??(property==='opacity'||property.startsWith('scale')?1:property==='width'||property==='height'?-1:property==='text'?'':0);planMap.set(key,{node:n,property,category:spec[0],offset:spec[1],base:value,rules:[]});}return planMap.get(key);};
  for(const n of list){if(n.props.templatePart?.owner===owner.id||n===owner&&!n.props.templatePart){for(const property of Object.keys(n.props.templateExpressions??{}))planFor(n,property);}}
  for(const [gi,g]of(p?.groups??[]).entries())for(const[si,s]of g.states.entries())for(const[name,props]of Object.entries(s.setters)){const n=list[item.names[name]];if(!n)throw new ReferenceError(`Unknown template part ${name}`);for(const[property,value]of Object.entries(props))planFor(n,property).rules.push({group:gi,state:si,value,duration:s.duration??0,easing:easingCode(s.easing??'smooth')});}
  const plans=[];let twoWay=0;
  for(const x of planMap.values()){
   if(x.base?.mode==='twoWay'&&++twoWay>1)throw new TypeError('Only one two-way value writer per templated parent');
   const stage=templateLayoutProperties.has(x.property)?0:1;if(stage===0)hasLayout=true;
   if(x.base?.kind==='templateBinding'&&x.node===owner&&!owner.props.templatePart)throw new TypeError('TemplateBinding requires a templated-parent namescope');const base=expression(x.base,x.category,x.property);const rules=x.rules.map(r=>[r.group,r.state,...expression(r.value,x.category,x.property),fbits(r.duration),r.easing,0,0,0,0]);
   const array=[x.node.index,x.category,x.offset,...base,rules.length?heap.push(rules.flat()):0,rules.length,0,0,0,0,0,0,stage,x.base?.mode==='twoWay'?1:0,0,0,0];if(array.length!==TEMPLATE_PLAN_WORDS)throw new Error('Internal template plan stride mismatch');plans.push(array);
  }
  const ptr=plans.length?heap.push(plans.flat()):0;heap.words[item.pointer+2]=ptr;heap.words[item.pointer+3]=plans.length;item.planPointer=ptr;item.planCount=plans.length;
 }
 for(const n of list){const action=n.props.action;if(action?.type!=='template')continue;const at=n.index*72;
  if(action.option!=null){let command=0,a=0,b=0;
   if(action.option==='contrast'){if(!['standard','high'].includes(action.preferenceValue))throw new TypeError('Expected standard/high');command=7;a=Number(action.preferenceValue==='high');}
   else if(action.option==='density'){if(!['comfortable','compact'].includes(action.preferenceValue))throw new TypeError('Expected comfortable/compact');command=8;a=Number(action.preferenceValue==='compact');}
   else if(action.option==='reducedMotion'){if(typeof action.preferenceValue!=='boolean')throw new TypeError('Expected a boolean motion preference');command=3;a=Number(action.preferenceValue);}
   else if(action.option==='accent'){command=6;if(action.preferenceValue!=null){const color=rgba(action.preferenceValue);if((color>>>24)!==255)throw new RangeError('Accent colors must be opaque');command=5;a=color&65535;b=color>>>16;}}
   else throw new TypeError('Unknown theme preference');u[at+37]=0;u[at+38]=command;u[at+39]=heap.push([a,b]);
  }
  else if(action.theme!=null){const index=themes.findIndex(t=>t.name===action.theme);if(index<0||!['light','dark'].includes(action.variant??'dark'))throw new TypeError('Unknown theme action');u[at+37]=0;u[at+38]=0;u[at+39]=heap.push([index,action.variant==='light'?1:0]);}
  else {const recipient=resolve(action.target);const t=metadata.get(recipient);const g=t?.groups.findIndex(g=>g.name===action.group)??-1;const stateIndex=g>=0?t.groups[g].states.indexOf(action.state):-1;if(g<0||stateIndex<0)throw new ReferenceError('Unknown template action state');u[at+37]=recipient;u[at+38]=1;u[at+39]=heap.push([g,stateIndex]);}
 }
 return{templates,templateSystem:{pointer:system,themes:themes.map(t=>({name:t.name,displayName:t.displayName??t.name})),theme:root?.themeIndex??0,variant:root?.variant??0,resourceStride:8,resourceCount:resourceCache.size,themeContrast:root?.themeContrast??'standard',controlDensity:root?.controlDensity??'comfortable',accentColor:root?.accentColor??null,rankPointer:ranks,reversePointer:reverse},templateLevels:templates.length?maxLevel+1:0,templateLayout:hasLayout};
}
