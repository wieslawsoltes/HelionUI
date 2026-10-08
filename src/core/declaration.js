import { Kind } from './schema.js';
import { normalizeProperties } from '../layout/properties.js';
export function h(type, props = {}, ...children) {
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
