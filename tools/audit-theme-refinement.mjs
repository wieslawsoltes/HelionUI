/** Theme math and source/count audit, NOT GPU pixels or a performance benchmark.
 * node tools/audit-theme-refinement.mjs --baseline=/path/to/0.13/helion-ui --output=report.json
 */
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {compile,h} from '../src/core/compiler.js';
import {rgba} from '../src/core/schema.js';
import {WinUIFluentTheme,MacOS26Theme,ButtonTemplate,AccentButtonTemplate,ToggleButtonTemplate,resolveThemePalette,themeAccentColors} from '../src/templates/index.js';
import {scalarTemplate} from './template-kernel-host.mjs';
const option=name=>process.argv.find(a=>a.startsWith(name+'='))?.slice(name.length+1);
if(!option('--baseline')||!option('--output'))throw Error('Supply --baseline and --output');
const root=fileURLToPath(new URL('..',import.meta.url)),baseline=resolve(option('--baseline'));
const hash=b=>createHash('sha256').update(b).digest('hex');
const luminance=value=>{const n=rgba(value);return [0,8,16].map(s=>(n>>>s&255)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);};
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const palettes=[];
for(const theme of [WinUIFluentTheme,MacOS26Theme])for(const variant of ['dark','light'])for(const themeContrast of ['standard','high']){
 const p=resolveThemePalette(theme,variant,{themeContrast});
 const pairs=[...['control','controlHover','controlPressed','field','fieldHover','canvas','surface'].map(bg=>['text',bg]),...['accent','accentHover','accentPressed'].map(bg=>['accentText',bg]),...['danger','dangerHover','dangerPressed'].map(bg=>['dangerText',bg])];
 palettes.push({theme:theme.name,variant,themeContrast,textPairs:pairs.map(([fg,bg])=>({fg,bg,ratio:contrast(p[fg],p[bg])})),focusPairs:['control','field'].map(bg=>({fg:'focus',bg,ratio:contrast(p.focus,p[bg])}))});
}
let seed=0x584d1234,worst={ratio:Infinity};const samples=4096;
const scalar=scalarTemplate(h('Button',{id:'accent',template:AccentButtonTemplate})).step(),pointer=scalar.kernel.templateSystem();
for(let i=0;i<samples;i++){
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;const color=(seed|0xff000000)>>>0,derived=themeAccentColors(color);
 scalar.kernel.templateCommand(0,5,color&65535,color>>>16);
 for(const [offset,key]of ['accent','accentText','accentHover','accentPressed'].entries())if(scalar.heap[pointer+15+offset]!==derived[key])throw Error('Scalar/initial accent mismatch');
 for(const role of ['accent','accentHover','accentPressed']){const ratio=contrast(derived.accentText,derived[role]);if(ratio<worst.ratio)worst={ratio,color,role,foreground:derived.accentText};}
}
const stateProbes=[ButtonTemplate,ToggleButtonTemplate].map(template=>{
 const model=scalarTemplate(h(template.targetType,{template})).step();const t=model.compiled.templates[0];
 let propertyRuleLookups=0;for(let i=0;i<t.planCount;i++)propertyRuleLookups+=model.heap[t.planPointer+i*24+12];
 return {template:template.name,groups:t.groups.length,propertyPlans:t.planCount,oldStrategyStateSearchesForThesePlans:propertyRuleLookups,actualCachedSearchesAcrossTwoStages:model.stateScans,note:'Same current template graph; counts only, not a version-to-version GPU-time comparison.'};
});
const shaders=[];
for(const name of (await readdir(resolve(root,'shaders'))).filter(x=>x.endsWith('.wgsl')).sort()){
 const a=await readFile(resolve(baseline,'shaders',name)),b=await readFile(resolve(root,'shaders',name));shaders.push({file:'shaders/'+name,equal:a.equals(b),bytes:b.length,sha256:hash(b)});
}
const c=compile(h('Grid',{controlThemes:true},h('Button',{text:'Button'})));
const result={version:JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version,scope:'Host palette math, test-only translated scalar WGSL and source/count audit; no native shader execution, screenshots, accessibility conformance or hardware benchmark.',palettes,customAccent:{sampleCount:samples,worst,scalarComparison:'PASS; f64 host/scalar math is not proof of native f32 luminance decisions'},stateProbes,shaders,resourceBank:{variantsPerTheme:c.templateSystem.resourceStride,themes:c.templateSystem.themes.length,referencedKeys:c.templateSystem.resourceCount,bytesPerNumericKey:c.templateSystem.resourceStride*c.templateSystem.themes.length*4,note:'Only referenced keys are packed. Existing reserved headers/group words reused. String values can have additional heap records.'}};
result.status=palettes.every(x=>x.textPairs.every(y=>y.ratio>=4.5)&&x.focusPairs.every(y=>y.ratio>=3))&&worst.ratio>=4.5?'PASS':'FAIL';
await writeFile(option('--output'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,customAccent:result.customAccent,stateProbes,changedShaders:shaders.filter(x=>!x.equal).map(x=>x.file),resourceBank:result.resourceBank},null,2));if(result.status!=='PASS')process.exitCode=1;
