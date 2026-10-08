import {DesignDocument} from './document.js';
export const DESIGN_PROJECT_MARKER='__HELION_PROJECT_JSON__';
/** Fill the data-only export template; project text never enters executable JavaScript. */
export function makeDesignAppHTML(template,project){
 if(typeof template!=='string'||!template.includes(DESIGN_PROJECT_MARKER))throw new TypeError('Missing compiled Helion export template');
 const normalized=DesignDocument(project);const {flat,...data}=normalized;
 const json=JSON.stringify(data).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 // Resource normalization uses packed colors internally; the encoder accepts these as well.
 return template.replace(DESIGN_PROJECT_MARKER,()=>json);
}
