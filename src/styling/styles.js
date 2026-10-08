import { normalizeProperties, propertyName } from '../layout/properties.js';
export const PseudoClass=Object.freeze({pointerover:1,hover:1,pressed:2,focus:4,checked:8,disabled:16,dark:32,light:64});
export function Style(selector,setters) {return {selector,setters};}
export function StaticResource(key) {return {resource:key};}
export class ResourceDictionary {
 constructor(entries={}) {Object.assign(this,entries);}
}
function parseValue(value) {
 value=value.trim();if(/^(['"]).*\1$/.test(value))return value.slice(1,-1);
 if(/^(true|false)$/i.test(value))return value.toLowerCase()==='true';
 if(/^[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?(?:px)?$/i.test(value))return Number(value.replace(/px$/i,''));
 return value;
}
export function parseStyles(css) {
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
export function parseSelector(selector) {
 if(typeof selector!=='string'||!selector.trim())throw new TypeError('Style selector required');
 const tokens=selector.trim().replace(/\s*>\s*/g,' > ').split(/\s+/);const parts=[];let relation='descendant';
 for(const token of tokens){if(token==='>'){if(!parts.length||relation==='child')throw new SyntaxError('Invalid child selector');relation='child';continue;}const s=parseSimple(token);parts.push({...s,relation});relation='descendant';}
 if(tokens.at(-1)==='>')throw new SyntaxError('Incomplete child selector');
 for(const p of parts.slice(0,-1))if(p.required||p.forbidden)throw new SyntaxError('Dynamic pseudo-classes currently belong on the target, not ancestors');
 return {parts,specificity:parts.reduce((a,p)=>a+p.specificity,0)};
}
function simpleMatch(s,n) {const cls=Array.isArray(n.props.classes)?n.props.classes:String(n.props.classes||'').split(/\s+/);return (s.type==='*'||s.type===n.type)&&(!s.id||s.id===n.props.id)&&s.classes.every(c=>cls.includes(c));}
export function matchesSelector(selector,node,ancestors=[]) {
 const s=typeof selector==='string'?parseSelector(selector):selector;let k=s.parts.length-1;if(!simpleMatch(s.parts[k],node))return false;let a=ancestors.length-1;
 while(k>0){const relation=s.parts[k].relation;k--;if(relation==='child'){if(a<0||!simpleMatch(s.parts[k],ancestors[a--]))return false;}
 else {while(a>=0&&!simpleMatch(s.parts[k],ancestors[a]))a--;if(a<0)return false;a--;}}
 return true;
}
/** Resolve structural selectors once. Only target pseudo masks/values stay live on GPU. */
export function styleTree(view,options={}) {
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
export const FluentTheme = `
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
