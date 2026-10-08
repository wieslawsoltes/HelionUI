/** Serializable authoring helper; no dependency on a DOM or the Helion runtime. */
export function ShapedText(props={}) {
 if(typeof props==='string')props={text:props};
 if(!props||typeof props!=='object'||Array.isArray(props))throw new TypeError('ShapedText expects text or view properties');
 return {type:'TextBlock',props:{...props,textShaping:'opentype'},children:[]};
}
