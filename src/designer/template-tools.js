import {validateControlTemplate} from '../templates/definitions.js';
import {expandTemplates} from '../templates/expand.js';
import {DesignDocument} from './document.js';
import {DESIGN_TYPE_NAMES} from './schema.js';
import {normalizeProperties} from '../layout/properties.js';

const equivalent=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const view=n=>({type:n.type,props:structuredClone(n.props??{}),children:(n.children??[]).map(view)});
const flat=root=>{const out=[];const walk=n=>{out.push(n);for(const c of n.children??[])walk(c);};walk(root);return out;};
const editable=new Set(['id','text','width','height','minWidth','minHeight','maxWidth','maxHeight','x','y','margin','padding','gap','background','foreground','borderColor','radius','borderWidth','fontSize','horizontalAlignment','verticalAlignment','row','column','rowSpan','columnSpan','rows','columns','orientation','wrap','dock','lastChildFill','itemWidth','itemHeight','uniformRows','uniformColumns','firstColumn','stretch','stretchDirection','value','opacity','translateX','translateY','scaleX','scaleY','rotation','hidden','disabled','clip','path','stroke','viewBox','fillRule']);
/** Explicit editor-entry boundary. This does not run during pointer manipulation. */
export function templateToDesignProject(template,{theme='fluent',themeVariant='dark',themeContrast='standard',controlDensity='comfortable',accentColor=null}={}){
 const definition=validateControlTemplate(template);
 const owner={type:definition.targetType,props:{id:'template-preview',template:definition,text:'Sample content',width:240,height:64,fontSize:16,value:.6},children:[]};
 const expanded=expandTemplates({type:'Canvas',props:{theme,themeVariant,themeContrast,controlDensity,accentColor},children:[owner]});
 const material=expanded.children[0].children[0];const byName=new Map();let index=0;
 const convert=(n,original)=>{const props=normalizeProperties(n.props);const name=original.props?.id??original.props?.Name??`part${++index}`;byName.set(name,original);
  const p={id:name};for(const [k,v]of Object.entries(props))if(editable.has(k)&&k!=='id')p[k]=structuredClone(v);
  // The part editor's top-level root is given the preview's final slot. Generated
  // content/native editors are authored as text stand-ins; their role is restored.
  let type=n.type;if(type==='ContentPresenter'||type==='NativeContentPresenter')type='TextBlock';
  if(!DESIGN_TYPE_NAMES.includes(type))throw new TypeError(`The visual part editor cannot edit ${type}; use template JSON`);
  return {type,props:p,children:n.children.map((c,i)=>convert(c,original.children[i]))};
 };
 const root=convert(material,definition.root);root.props.width=240;root.props.height=64;root.props.x=48;root.props.y=48;
 const project=DesignDocument({title:`Template · ${definition.name}`,width:440,height:260,capacity:16,history:16,templates:[],root:{type:'Canvas',props:{id:'template-artboard',background:themeVariant==='dark'?'#172331':'#e6eaf0'},children:[root]}});
 const {flat:unused,...data}=project;
 return {project:data,definition,originalParts:[...byName.keys()]};
}
/** Merge only visibly changed fields. Untouched bindings, states, and metadata survive. */
export function designProjectToTemplate(session,editedSnapshot){
 if(!session?.definition||!session?.baseline?.slotNames)throw new TypeError('A template editing session requires its initial GPU snapshot');
 const baseline=session.baseline,edited=editedSnapshot;
 const original=flat(session.definition.root);const originalNames=session.originalParts;
 const baseByName=new Map(flat(baseline.project.root).map(n=>[n.props.id,n]));
 const slotByName=new Map(edited.slotNames.map((name,index)=>[name,index]));
 const originalBySlot=new Map();baseline.slotNames.forEach((name,slot)=>{const i=originalNames.indexOf(name);if(i>=0)originalBySlot.set(slot,original[i]);});
 const renamed=new Map();
 const merge=n=>{const slot=slotByName.get(n.props.id),old=originalBySlot.get(slot);const base=baseByName.get(baseline.slotNames[slot]);let type=n.type,props={};
  if(old){props=normalizeProperties(structuredClone(old.props??{}));if(type===base.type)type=old.type;const oldName=props.id??originalNames[original.indexOf(old)];renamed.set(oldName,n.props.id);
   for(const key of editable){if(!equivalent(n.props[key],base.props[key])){if(n.props[key]===undefined)delete props[key];else props[key]=structuredClone(n.props[key]);}}
   props.id=n.props.id;
  }else{for(const [key,value]of Object.entries(n.props))if(editable.has(key))props[key]=structuredClone(value);}
  return{type,props,children:(n.children??[]).map(merge)};
 };
 if(edited.project.root.children?.length!==1)throw new TypeError('Keep exactly one template root inside the part artboard');
 const root=merge(edited.project.root.children[0]);const rewrite=n=>{for(const [holder,key]of [[n.props.bind,'source'],[n.props.action,'target']])if(holder&&renamed.has(holder[key]))holder[key]=renamed.get(holder[key]);for(const child of n.children)rewrite(child);};rewrite(root);const groups=structuredClone(session.definition.visualStateGroups);
 for(const group of groups)for(const state of group.states){const setters={};for(const [name,p]of Object.entries(state.setters)){if(!renamed.has(name))throw new TypeError(`State ${state.name} references removed part ${name}; edit the state in template JSON before removing it`);setters[renamed.get(name)]=p;}state.setters=setters;}
 return validateControlTemplate({...session.definition,root,visualStateGroups:groups});
}
