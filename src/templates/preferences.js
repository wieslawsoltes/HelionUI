import {rgba} from '../core/schema.js';
/** Initial configuration/inspection helpers. Live palette selection executes in WGSL. */
export function normalizeThemeSettings(options={}) {
 const themeContrast=options.themeContrast??'standard';
 const controlDensity=options.controlDensity??'comfortable';
 if(!['standard','high'].includes(themeContrast))throw new TypeError('themeContrast must be standard or high');
 if(!['comfortable','compact'].includes(controlDensity))throw new TypeError('controlDensity must be comfortable or compact');
 const accentColor=options.accentColor==null?null:rgba(options.accentColor);
 if(accentColor!==null&&(accentColor>>>24)!==255)throw new RangeError('Accent colors must be opaque');
 return {themeContrast,controlDensity,accentColor};
}
export function themeAccentColors(color) {
 const packed=rgba(color);if((packed>>>24)!==255)throw new RangeError('Accent colors must be opaque');
 const c=[0,8,16].map(s=>(packed>>>s&255)/255),linear=c.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const lightText=(linear[0]*.2126+linear[1]*.7152+linear[2]*.0722)<.179;
 const toward=lightText?0:1;
 const tint=percent=>[0,8,16].reduce((n,shift)=>{const channel=packed>>>shift&255;return (n|(Math.floor((channel*(100-percent)+toward*255*percent+50)/100)<<shift))>>>0;},0xff000000);
 return {accent:packed,accentText:lightText?0xffffffff:0xff000000,accentHover:tint(10),accentPressed:tint(18),accentStroke:packed};
}
export function resolveThemePalette(theme,variant='dark',options={}) {
 if(!theme||!['dark','light'].includes(variant)||!theme[variant])throw new TypeError('Expected a prepared theme and dark/light variant');
 const p=normalizeThemeSettings(options);
 return {...theme[variant],...(p.themeContrast==='high'?(variant==='dark'?theme.contrastDark:theme.contrastLight):{}),...(p.controlDensity==='compact'?theme.compact:{}),...(p.accentColor!==null&&p.themeContrast!=='high'?themeAccentColors(p.accentColor):{})};
}
