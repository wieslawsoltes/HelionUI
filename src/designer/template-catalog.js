import {validateControlTemplate} from '../templates/definitions.js';
import {ButtonTemplate,CheckBoxTemplate,TextBoxTemplate,SliderTemplate,ProgressBarTemplate,ToggleSwitchTemplate,ContentControlTemplate} from '../templates/themes.js';
export const DESIGN_TEMPLATE_PARTS=8;
export const DESIGN_TEMPLATE_DEFAULT_FIELDS=Object.freeze(['background','foreground','borderColor','radius','borderWidth','padding']);
export const DESIGN_TEMPLATE_LIBRARY=Object.freeze([ButtonTemplate,CheckBoxTemplate,TextBoxTemplate,SliderTemplate,ProgressBarTemplate,ToggleSwitchTemplate,ContentControlTemplate]);
const kinds=new Set(['Grid','StackPanel','Canvas','Border','Panel','TextBlock','Button','CheckBox','Slider','ProgressBar','Path','ScrollViewer','DockPanel','WrapPanel','UniformGrid','Viewbox','ContentControl','ContentPresenter','NativeContentPresenter']);
/** Bounded catalog preparation, not a live CPU mirror. Native storage is pooled on device. */
export function designTemplateCatalog(templates=[],poolCapacity=8){
 if(!Array.isArray(templates)||templates.length>8)throw new RangeError('Designer template catalog supports at most eight templates');
 if(!Number.isInteger(poolCapacity)||poolCapacity<1||poolCapacity>16)throw new RangeError('Designer template capacity must be 1–16');
 const names=new Set();return templates.map(value=>{const t=validateControlTemplate(value);if(names.has(t.name))throw new TypeError('Duplicate designer template name');names.add(t.name);
  if(!['Button','CheckBox','Slider','TextBox','ProgressBar','ContentControl','Border'].includes(t.targetType))throw new TypeError('Designer templates target supported leaf controls');
  let count=0;const walk=(n,depth=0)=>{if(++count>DESIGN_TEMPLATE_PARTS||depth>5)throw new RangeError('Designer templates support eight parts and depth five');if(!kinds.has(n.type)||n.props?.template||n.props?.Template||n.props?.models||n.props?.drawing||n.props?.data||n.props?.items)throw new TypeError('Unsupported designer template part; nested templates and item documents require the runtime authoring API');n.children.forEach(c=>walk(c,depth+1));};walk(t.root);return t;
 });
}
export function templateDefaultsMask(value){
 if(value===true)return 63;if(value==null||value===false)return 0;
 if(!Array.isArray(value)||value.some(k=>!DESIGN_TEMPLATE_DEFAULT_FIELDS.includes(k)))throw new TypeError('templateDefaults is true or a list of supported appearance properties');
 return value.reduce((m,k)=>m|(1<<DESIGN_TEMPLATE_DEFAULT_FIELDS.indexOf(k)),0);
}
