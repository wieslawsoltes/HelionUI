import {normalizeThemeSettings} from '../templates/preferences.js';
import {designTemplateCatalog,templateDefaultsMask,DESIGN_TEMPLATE_PARTS,DESIGN_TEMPLATE_DEFAULT_FIELDS} from './template-catalog.js';
import {h} from '../core/declaration.js';
import {Kind,rgba,fbits,fromBits,tracks,Flags} from '../core/schema.js';
import {normalizeProperties} from '../layout/properties.js';
import {parsePath} from '../render/paths.js';
import {DESIGN_TYPE_NAMES,DESIGN_KEYS,DESIGN_ANIMATED_NAMES,DesignField,DESIGN_COLOR_FIELDS,DESIGN_INTEGER_FIELDS,DESIGN_RECORD,DESIGN_NAME,DESIGN_TEXT,DESIGN_TRACK,DESIGN_TRACKS,DESIGN_STATE_RECORD,DESIGN_RESOURCE_RECORD,designOffsets,DESIGN_VERSION} from './schema.js';
export const DESIGN_SHAPES = Object.freeze([
 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
 'M 100 50 C 100 77.614 77.614 100 50 100 C 22.386 100 0 77.614 0 50 C 0 22.386 22.386 0 50 0 C 77.614 0 100 22.386 100 50 Z',
 'M 50 2 L 64 34 L 99 38 L 72 61 L 80 96 L 50 78 L 20 96 L 28 61 L 1 38 L 36 34 Z',
 'M 0 50 L 100 50'
]);
const plain=o=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype;
function scalarText(value,max,label){if(typeof value!=='string')throw new TypeError(`${label} must be text`);const cps=Array.from(value);if(cps.length>max||cps.some(c=>{const n=c.codePointAt(0);return n>=0xd800&&n<=0xdfff;}))throw new RangeError(`${label} exceeds ${max} Unicode scalars or contains an unpaired surrogate`);return value;}
const number=(x,fallback,label,min=-1e6,max=1e7)=>{if(x==null){if(fallback==null)throw new RangeError(`Missing ${label}`);return fallback;}if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)throw new RangeError(`Invalid ${label}`);return Math.fround(x);};
const allowed = new Set([...Object.keys(DesignField).filter(k=>!['marginLeft','marginTop','marginRight','marginBottom','uniformRows','uniformColumns','columnsCount','rowsCount','actionKind','actionTarget','actionValue','bindingSource','bindingScale','bindingOffset'].includes(k)),'id','template','templateDefaults','text','margin','columns','rows','animations','path','stroke','viewBox','fillRule','shape','hidden','locked','disabled','clip','action','bind','backgroundResource','foregroundResource','fontFamily','fontWeight','fontStyle','kerning','ligatures','letterSpacing','lineHeight','textAlignment','textDecoration']);
const ease=['linear','smooth','spring','cubicIn','cubicOut','cubicInOut','sineInOut','backOut','step'];
/** Normalize a data-only project. Never eval imported project/source text. */
export function DesignDocument(project={}) {
 if(!plain(project))throw new TypeError('DesignDocument requires a plain object');
 const capacity=project.capacity??64;if(!Number.isInteger(capacity)||capacity<8||capacity>128)throw new RangeError('Design capacity is 8–128');
 const history=project.history??16;if(!Number.isInteger(history)||history<2||history>32)throw new RangeError('Design history is 2–32 complete transactions');
 const themeSettings=normalizeThemeSettings(project);const templates=designTemplateCatalog(project.templates??[],project.templateCapacity??8);const templateCapacity=templates.length?(project.templateCapacity??8):0;const theme=project.theme??'fluent',themeVariant=project.themeVariant??'dark';if(!['fluent','macos26'].includes(theme)||!['light','dark'].includes(themeVariant))throw new TypeError('Unknown designer theme');
 const width=number(project.width,960,'artboard width',32,8192),height=number(project.height,640,'artboard height',32,8192),duration=number(project.duration,4,'duration',.1,3600);
 if(project.version!=null&&project.version!==DESIGN_VERSION)throw new TypeError('Unsupported design project version');
 const root=project.root??{type:'Canvas',props:{id:'artboard',background:'#f6f7fb'},children:[]};
 const ids=new Map(),flat=[];
 function visit(node,parent=-1,depth=0){if(!plain(node)||!DESIGN_TYPE_NAMES.includes(node.type))throw new TypeError(`Unsupported design control ${node?.type}`);if(depth>16)throw new RangeError('Design tree depth exceeds 16');if(flat.length>=capacity)throw new RangeError('Design node capacity exceeded');if(node.children!=null&&!Array.isArray(node.children))throw new TypeError('children must be an array');
  if(node.props!=null&&!plain(node.props))throw new TypeError('Design props must be a plain object');const props=normalizeProperties(node.props??{});for(const key of Object.keys(props))if(!allowed.has(key))throw new TypeError(`Unsupported design property ${key}`);
  const inherited=parent<0?{}:flat[parent].props;for(const key of ['fontFamily','fontWeight','fontStyle','fontSize','kerning','ligatures','letterSpacing','lineHeight','textAlignment','textDecoration'])if(props[key]==null&&inherited[key]!=null)props[key]=inherited[key];
  const index=flat.length,id=scalarText(props.id??`element${index}`,DESIGN_NAME,'Name');if(!id||ids.has(id))throw new TypeError(`Duplicate or empty design name ${id}`);ids.set(id,index);props.id=id;props.text=scalarText(props.text??'',DESIGN_TEXT,'Text');
  if(node.type==='Path'){if(props.shape!=null&&(!Number.isInteger(props.shape)||props.shape<0||props.shape>=DESIGN_SHAPES.length))throw new RangeError('Unknown shape');parsePath(props.path??DESIGN_SHAPES[props.shape??1]);if(props.fillRule!=null&&!['nonzero','evenodd'].includes(props.fillRule))throw new TypeError('Unknown fill rule');}
  if((node.children?.length??0)>0&&!['Canvas','Grid','StackPanel','DockPanel','WrapPanel','UniformGrid','Border','Panel','Viewbox','ScrollViewer','ContentControl'].includes(node.type))throw new TypeError(`${node.type} cannot own design children`);
  if(['Border','Viewbox','ScrollViewer','ContentControl'].includes(node.type)&&node.children?.length>1)throw new RangeError(`${node.type} requires at most one child`);
  const item={type:node.type,props,parent,depth,index,children:[]};flat.push(item);(node.children??[]).forEach(c=>item.children.push(visit(c,index,depth+1)));return index;
 }
 visit(root);if(!['Canvas','Grid','StackPanel','DockPanel','WrapPanel','UniformGrid','Panel'].includes(root.type))throw new TypeError('Artboard root must be a layout panel');
 const resources=(project.resources??[]).map((r,i)=>{if(!plain(r)||i>=16)throw new RangeError('Up to sixteen named solid brush resources');return{name:scalarText(r.name??`Brush${i}`,63,'Resource name'),color:rgba(r.color)};});if(resources.some(r=>!r.name)||new Set(resources.map(r=>r.name)).size!==resources.length)throw new TypeError('Duplicate resource name');
 const states=(project.states??[]).map((s,i)=>{if(!plain(s)||i>=3)throw new RangeError('Up to three named visual states plus Base');const name=scalarText(s.name??`State ${i+1}`,15,'State name'),overrides=Object.create(null);for(const [id,values]of Object.entries(s.overrides??{})){if(!ids.has(id)||!plain(values))throw new TypeError('Unknown visual-state target');const v={};for(const [key,val]of Object.entries(values)){if(![...DESIGN_ANIMATED_NAMES,'background','foreground','borderColor'].includes(key))throw new TypeError(`Unsupported state property ${key}`);v[key]=['background','foreground','borderColor'].includes(key)?rgba(val):number(val,null,key,key==='opacity'?0:key.startsWith('scale')?.001:-1e6,key==='opacity'?1:key.startsWith('scale')?64:1e7);}overrides[id]=v;}return{name,overrides};});
 if(states.some(s=>!s.name)||new Set(states.map(s=>s.name)).size!==states.length)throw new TypeError('Duplicate or empty state name');
 if(flat.filter(n=>n.props.template).length>templateCapacity)throw new RangeError('Designer template capacity exceeded');
 for(const n of flat){const p=n.props;if(p.template!=null){const t=templates.find(t=>t.name===p.template);if(!t||t.targetType!==n.type||n.children.length)throw new TypeError('Unknown, incompatible or non-leaf designer template');}templateDefaultsMask(p.templateDefaults);for(const name of ['bind','action'])if(p[name]!=null&&!plain(p[name]))throw new TypeError(`Invalid ${name}`);
  if(p.bind){if(!ids.has(p.bind.source))throw new ReferenceError('Unknown binding source');number(p.bind.scale,1,'binding scale');number(p.bind.offset,0,'binding offset');}
  if(p.action){if(!['none','toggle','increment','set'].includes(p.action.type))throw new TypeError('Designer supports numeric none/toggle/increment/set actions');if(p.action.target!=null&&!ids.has(p.action.target))throw new ReferenceError('Unknown action target');number(p.action.value,1,'action value');}
  for(const key of ['backgroundResource','foregroundResource'])if(p[key]!=null&&!resources.some(r=>r.name===p[key]))throw new ReferenceError(`Unknown resource ${p[key]}`);
  const seen=new Set();for(const a of p.animations??[]){if(!plain(a)||!DESIGN_ANIMATED_NAMES.includes(a.property)||seen.has(a.property))throw new TypeError('Invalid or duplicate designer animation track');seen.add(a.property);if(!Array.isArray(a.keyframes)||a.keyframes.length<1||a.keyframes.length>DESIGN_KEYS)throw new RangeError(`Track requires 1–${DESIGN_KEYS} keys`);let previous=-1;for(const k of a.keyframes){number(k.time,null,'key time',0,duration);number(k.value,null,'key value',a.property==='opacity'?0:a.property.startsWith('scale')?.001:-1e6,a.property==='opacity'?1:a.property.startsWith('scale')?64:1e7);if(k.time<=previous||!ease.includes(k.easing??'smooth'))throw new RangeError('Keys must have strictly increasing times and supported easing');previous=k.time;}}
 }
 const normalized=k=>({type:flat[k].type,props:structuredClone(flat[k].props),children:flat[k].children.map(normalized)});
 return {version:DESIGN_VERSION,title:scalarText(project.title??'Untitled design',128,'Project title'),width,height,duration,capacity,history,root:normalized(0),resources,states,flat,...(templates.length?{templates,templateCapacity,theme,themeVariant,...themeSettings,reducedMotion:!!project.reducedMotion}:{})};
}
export function expandDesigners(view,active=new Set(),depth=0){
 if(!view||typeof view!=='object')return view;if(active.has(view))throw new TypeError('Cyclic view declaration');if(depth>30)throw new RangeError('Tree exceeds 30 levels');active.add(view);
 if(view.type==='DesignSurface'){
  if(view.children?.length)throw new TypeError('DesignSurface children are generated from DesignDocument');
  const p=DesignDocument(view.props.designDocument??{});const id=view.props.id??'design';
  const children=Array.from({length:p.capacity},(_,slot)=>{const n=p.flat[slot];const props={...(n?.props??{}),id:`${id}::${slot}`,hidden:!n,designSlot:slot,designTarget:id,designSource:n??null};
   // Designer supplies dynamic native node records; hierarchy is wired after allocation.
   for(const key of ['template','templateDefaults','locked','shape','backgroundResource','foregroundResource','action','bind','animations','path','stroke','viewBox','fillRule'])delete props[key];
   if(n?.type==='Path'){props.path=n.props.path??DESIGN_SHAPES[n.props.shape??1];props.stroke=n.props.stroke??((n.props.shape??1)===3?2:0);props.viewBox=n.props.viewBox??[0,0,100,100];}
   return h(n?.type??'Canvas',props);
  });
  children.push(h('DesignAdorner',{id:`${id}::adorner`,designTarget:id,clip:true}));
  if(p.templates?.length){
   children.push(h('Panel',{id:`${id}::template-catalog`,hidden:true},...p.templates.map((t,k)=>h(t.targetType,{id:`${id}::prototype-${k}`,template:t}))));
   for(let pool=0;pool<p.templateCapacity;pool++)for(let part=0;part<DESIGN_TEMPLATE_PARTS;part++)children.push(h('Panel',{id:`${id}::template-pool-${pool}-${part}`,hidden:true,renderTransformOrigin:[.5,.5]}));
  }
  active.delete(view);return h('DesignSurface',{...view.props,designDocument:p},...children);
 }
 const result={...view,children:(view.children??[]).map(child=>expandDesigners(child,active,depth+1))};active.delete(view);return result;
}
export function hexColor(value){return'#'+[value&255,(value>>>8)&255,(value>>>16)&255,value>>>24].map(n=>n.toString(16).padStart(2,'0')).join('');}
/** Decode only an explicit authoring snapshot. No live document mirror. */
export function decodeDesignSnapshot(words,manifest){
 const {capacity,offsets:o,assets=[]}=manifest;const data=words instanceof Uint32Array?words:new Uint32Array(words);if(data.length!==o.words)throw new RangeError('Invalid design snapshot length');const f=new Float32Array(data.buffer,data.byteOffset,data.length);
 const getText=(at,len,max)=>{if(len>max)throw new RangeError('Invalid retained text length');let result='';for(let k=0;k<len;k++){const cp=data[at+k];if(cp>0x10ffff||(cp>=0xd800&&cp<=0xdfff))throw new RangeError('Invalid retained scalar');result+=String.fromCodePoint(cp);}return result;};
 if(data[3]>16||data[4]<1||data[4]>4)throw new RangeError('Invalid retained resource/state count');
 const resources=Array.from({length:data[3]},(_,j)=>{const a=64+j*DESIGN_RESOURCE_RECORD;return{name:getText(a+4,data[a+1],63),color:hexColor(data[a])};});
 const nodes=new Map();for(let k=0;k<capacity;k++){const a=o.records+k*DESIGN_RECORD;if(!data[a])continue;const type=Object.keys(Kind).find(x=>Kind[x]===data[a+1]);if(!DESIGN_TYPE_NAMES.includes(type))throw new TypeError('Unsupported retained design kind');const props={id:getText(o.names+k*DESIGN_NAME,data[a+5],DESIGN_NAME),text:getText(o.text+k*DESIGN_TEXT,data[a+6],DESIGN_TEXT)};
  for(const[key,field]of Object.entries(DesignField)){
   if(field>=48||['rotation'].includes(key))continue;props[key]=DESIGN_COLOR_FIELDS.has(field)?hexColor(data[a+field]):DESIGN_INTEGER_FIELDS.has(field)?data[a+field]:f[a+field];
  }
  if(data[a+94]){const t=manifest.templates?.[data[a+94]-1];if(!t)throw new ReferenceError('Unknown retained control template');props.template=t.name;}if(data[a+95])props.templateDefaults=DESIGN_TEMPLATE_DEFAULT_FIELDS.filter((_,i)=>data[a+95]&(1<<i));
  props.rotation=f[a+26];props.margin=[18,19,20,21].map(w=>f[a+w]);for(const key of ['marginLeft','marginTop','marginRight','marginBottom'])delete props[key];
  props.horizontalAlignment=['stretch','start','center','end'][data[a+34]];props.verticalAlignment=['stretch','start','center','end'][data[a+35]];props.orientation=data[a+40]?'horizontal':'vertical';props.wrap=!!data[a+41];props.dock=['left','top','right','bottom'][data[a+42]];props.lastChildFill=!!data[a+43];props.stretch=['none','fill','uniform','uniformToFill'][data[a+46]];
  delete props.uniformRows;delete props.uniformColumns;if(type==='UniformGrid'){props.rows=data[a+44];props.columns=data[a+45];}
  if(type==='Grid'){const getTracks=(start,count)=>Array.from({length:Math.max(1,Math.min(8,count))},(_,j)=>data[a+start+j*2]===0?f[a+start+j*2+1]:data[a+start+j*2]===1?'auto':`${f[a+start+j*2+1]}*`);props.columns=getTracks(50,data[a+48]);props.rows=getTracks(66,data[a+49]);}
  props.hidden=(data[a+4]&1)!==0;props.locked=(data[a+4]&2)!==0;props.disabled=(data[a+4]&8)!==0;props.clip=(data[a+4]&16)===0;Object.assign(props,manifest.typography?.[data[a+93]]??{});props.value=f[a+82];
  if(type==='Path'){const asset=assets[data[a+84]];if(!asset)throw new ReferenceError('Unknown retained path');props.path=structuredClone(asset.path);props.stroke=asset.stroke;props.viewBox=asset.viewBox;props.fillRule=asset.fillRule??'nonzero';}
  for(const[key,w]of [['backgroundResource',91],['foregroundResource',92]])if(data[a+w]&&resources[data[a+w]-1])props[key]=resources[data[a+w]-1].name;
  const animations=[];for(let t=0;t<DESIGN_TRACKS;t++){const p=o.tracks+(k*DESIGN_TRACKS+t)*DESIGN_TRACK;const count=data[p];if(count>DESIGN_KEYS)throw new RangeError('Invalid retained key count');if(count)animations.push({property:DESIGN_ANIMATED_NAMES[t],keyframes:Array.from({length:count},(_,j)=>({time:f[p+4+j*4],value:f[p+5+j*4],easing:ease[data[p+6+j*4]]??'linear'}))});}if(animations.length)props.animations=animations;
  nodes.set(k,{type,props,children:[],slot:k,parent:data[a+2],order:data[a+3]});
 }
 if(!nodes.has(0))throw new TypeError('Missing artboard');
 for(const n of nodes.values()){if(n.slot===0)continue;const parent=nodes.get(n.parent);if(!parent)throw new ReferenceError('Missing design parent');let p=n.parent,seen=new Set([n.slot]);while(p!==0xffffffff){if(seen.has(p))throw new TypeError('Design cycle');seen.add(p);p=nodes.get(p)?.parent??0xffffffff;}parent.children.push(n);}
 for(const[k,n]of nodes){const a=o.records+k*DESIGN_RECORD;if(data[a+88]!==0xffffffff&&nodes.has(data[a+88]))n.props.bind={source:nodes.get(data[a+88]).props.id,scale:f[a+89],offset:f[a+90]};if(data[a+85])n.props.action={type:['none','toggle','increment','set'][data[a+85]],target:nodes.get(data[a+86])?.props.id??n.props.id,value:f[a+87]};n.children.sort((a,b)=>a.order-b.order||a.slot-b.slot);}
 const stateFields=[25,29,30,27,28,26,32,31,33];const stateNames=['opacity','translateX','translateY','scaleX','scaleY','rotation','background','foreground','borderColor'];
 const states=[];for(let s=1;s<Math.min(4,data[4]);s++){const name=getText(9+(s-1)*16,data[8+(s-1)*16],15);const overrides=Object.create(null);for(const[k,n]of nodes){const at=o.states+(s*capacity+k)*DESIGN_STATE_RECORD,mask=data[at];if(mask>511)throw new RangeError('Invalid retained state mask');if(!mask)continue;const v={};for(let field=0;field<9;field++)if(mask&(1<<field))v[stateNames[field]]=field>=6?hexColor(data[at+1+field]):f[at+1+field];overrides[n.props.id]=v;}states.push({name:name||`State ${s}`,overrides});}
 function clean(n){return{type:n.type,props:n.props,children:n.children.map(clean)};}
 const project={version:1,title:manifest.title,width:f[0],height:f[1],duration:f[2],capacity,history:manifest.history,resources,states,root:clean(nodes.get(0)),...(manifest.templates?.length?{templates:structuredClone(manifest.templates),templateCapacity:manifest.templateCapacity,theme:data[5]?'macos26':'fluent',themeVariant:data[6]?'light':'dark',reducedMotion:!!data[7],themeContrast:(data[56]&1)?'high':'standard',controlDensity:(data[56]&2)?'compact':'comfortable',accentColor:(data[56]&4)?data[57]:null}:{})};
 // Revalidate the external graph before exporting, including finite geometry.
 DesignDocument(project);return project;
}
export function projectToView(project,{state=0,animate=true}={}){
 const p=DesignDocument(project);const resource=Object.fromEntries(p.resources.map(r=>[r.name,hexColor(r.color)]));const overrides=state?p.states[state-1]?.overrides??{}:{};
 const build=n=>{const props=normalizeProperties(n.props??{});delete props.locked;const inherit=templateDefaultsMask(props.templateDefaults);delete props.templateDefaults;DESIGN_TEMPLATE_DEFAULT_FIELDS.forEach((key,i)=>{if(inherit&(1<<i))delete props[key];});for(const color of ['background','foreground']){const key=color+'Resource';if(props[key])props[color]=resource[props[key]];delete props[key];}
  Object.assign(props,overrides[props.id]??{});if(n.type==='Path'){props.path??=DESIGN_SHAPES[props.shape??1];props.viewBox??=[0,0,100,100];props.stroke??=props.shape===3?2:0;}delete props.shape;
  if(props.animations){props.animations=animate?props.animations.map(a=>({property:a.property,duration:p.duration,iterations:'infinite',direction:'normal',fillMode:'both',keyFrames:(a.keyframes[0].time>0?[{time:0,value:props[a.property]??(a.property.startsWith('scale')||a.property==='opacity'?1:0)},...a.keyframes]:a.keyframes).concat(a.keyframes.at(-1).time<p.duration?[{time:p.duration,value:a.keyframes.at(-1).value}]:[]).map(k=>({cue:k.time/p.duration,value:k.value,easing:k.easing??'smooth'}))})):[];}
  return h(n.type,props,...(n.children??[]).map(build));};const view=build(p.root);view.props.width=p.width;view.props.height=p.height;if(p.templates?.length){view.props.templates=Object.fromEntries(p.templates.map(t=>[t.name,t]));view.props.theme=p.theme;view.props.themeVariant=p.themeVariant;view.props.reducedMotion=p.reducedMotion;view.props.themeContrast=p.themeContrast;view.props.controlDensity=p.controlDensity;view.props.accentColor=p.accentColor;}return view;
}
export function generateDesignSource(project){const view=projectToView(project);function source(v,depth=0){const indent='  '.repeat(depth),props=JSON.stringify(v.props,null,2).replace(/\n/g,'\n'+indent);return`h(${JSON.stringify(v.type)}, ${props}${v.children.length?',\n'+v.children.map(c=>indent+'  '+source(c,depth+1)).join(',\n'):''})`;}
 return`// Generated from a Helion design project. Runtime styles and drawing stay on the GPU.\nimport { h, HelionSurface } from ${JSON.stringify('@helion/ui')};\n\nexport const view = ${source(view)};\n\nexport function mount(canvas, options = {}) {\n  return HelionSurface.mount(canvas, view, options);\n}\n`;}
