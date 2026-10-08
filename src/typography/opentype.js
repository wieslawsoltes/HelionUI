/** Layout-table preparation only. No glyph string is shaped on the CPU. */
export function tag(s){if(typeof s!=='string'||!/^[\x20-\x7e]{4}$/.test(s))throw new TypeError(`Expected four-byte OpenType tag: ${s}`);return (s.charCodeAt(0)*16777216+(s.charCodeAt(1)<<16)+(s.charCodeAt(2)<<8)+s.charCodeAt(3))>>>0;}
export const tagString=n=>String.fromCharCode(n>>>24,(n>>>16)&255,(n>>>8)&255,n&255);
export class LayoutReader{
 constructor(bytes,label='layout'){this.bytes=bytes;this.label=label;this.v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);}
 check(p,n){if(!Number.isSafeInteger(p)||p<0||!Number.isSafeInteger(n)||n<0||p+n>this.bytes.length)throw new RangeError(`Truncated ${this.label}: ${p}+${n}`);}
 u16(p){this.check(p,2);return this.v.getUint16(p);}u32(p){this.check(p,4);return this.v.getUint32(p);}tag(p){return tagString(this.u32(p));}
}
export function inspectLayout(bytes,label='GSUB'){
 if(!bytes?.length)return {scripts:[],features:[],lookups:[],warnings:[]};
 const r=new LayoutReader(bytes,label);if(r.u16(0)!==1||r.u16(2)>1)throw new RangeError(`Unsupported ${label} version`);
 const sp=r.u16(4),fp=r.u16(6),lp=r.u16(8),scripts=[],features=[],lookups=[],warnings=[];
 const fc=r.u16(fp);r.check(fp+2,fc*6);
 for(let i=0;i<fc;i++){const a=fp+2+i*6,p=fp+r.u16(a+4),n=r.u16(p+2);r.check(p+4,n*2);features.push({tag:r.tag(a),lookups:Array.from({length:n},(_,j)=>r.u16(p+4+j*2))});}
 const lc=r.u16(lp);if(lc>4096)throw new RangeError('Layout lookup capacity exceeded');r.check(lp+2,lc*2);
 for(let i=0;i<lc;i++){const p=lp+r.u16(lp+2+i*2),type=r.u16(p),flags=r.u16(p+2),n=r.u16(p+4);if(n>4096||type<1||type>(label==='GSUB'?8:9))throw new RangeError(`Invalid ${label} lookup`);r.check(p+6,n*2);lookups.push({offset:p,type,flags,filteringSet:flags&16?r.u16(p+6+n*2):0,subtables:Array.from({length:n},(_,j)=>{const q=p+r.u16(p+6+j*2);r.check(q,2);return q;})});}
 for(const f of features)if(f.lookups.some(x=>x>=lc))throw new RangeError('Missing feature lookup');
 const lang=p=>{const required=r.u16(p+2),n=r.u16(p+4);r.check(p+6,n*2);const ids=Array.from({length:n},(_,j)=>r.u16(p+6+j*2));if(required!==65535)ids.unshift(required);if(ids.some(x=>x>=fc))throw new RangeError('Missing language feature');return {required:required===65535?null:required,features:ids};};
 const sc=r.u16(sp);r.check(sp+2,sc*6);
 for(let i=0;i<sc;i++){const a=sp+2+i*6,p=sp+r.u16(a+4),def=r.u16(p),n=r.u16(p+2),languages={};r.check(p+4,n*6);if(def)languages.dflt=lang(p+def);for(let j=0;j<n;j++){const q=p+4+j*6;languages[r.tag(q)]=lang(p+r.u16(q+4));}scripts.push({tag:r.tag(a),languages});}
 if(r.u16(2)===1&&r.u32(10))warnings.push(`${label} FeatureVariations are not applied`);
 return {scripts,features,lookups,warnings};
}
const LANG={en:'ENG ',pl:'PLK ',tr:'TRK ',az:'AZE ',ru:'RUS ',sr:'SRB ',ar:'ARA ',fa:'FAR ',ur:'URD ',he:'IWR ',de:'DEU ',fr:'FRA ',el:'ELL ',ja:'JAN ',ko:'KOR ',zh:'ZHS ',vi:'VIT ',uk:'UKR ',bg:'BGR ',es:'ESP ',hi:'HIN ',th:'THA '};
export function normalizeLanguage(s='dflt'){if(typeof s==='string'&&/^[\x20-\x7e]{4}$/.test(s))return s;const v=LANG[String(s).toLowerCase().split('-')[0]];if(!v)throw new TypeError(`Use a four-byte language tag for ${s}`);return v;}
export function normalizeFeatures(value={}){
 if(typeof value==='string'){const result={};for(const t of value.split(',').map(x=>x.trim()).filter(Boolean)){const m=/^['"]?([A-Za-z0-9 ]{4})['"]?(?:\s*(?:=|\s)\s*(on|off|\d+))?$/.exec(t);if(!m)throw new TypeError(`Invalid feature: ${t}`);result[m[1]]=m[2]==='off'?0:m[2]==='on'||m[2]==null?1:Number(m[2]);}value=result;}
 if(!value||Array.isArray(value)||typeof value!=='object')throw new TypeError('Features must be an object or string');
 const out={};for(const[k,n]of Object.entries(value)){tag(k);const v=typeof n==='boolean'?Number(n):n;if(!Number.isInteger(v)||v<0||v>65535)throw new RangeError(`Invalid ${k} feature value`);out[k]=v;}return out;
}
const EARLY=['ccmp','locl'],JOIN=['isol','fina','fin2','fin3','medi','med2','init'];
const DEFAULTS={ccmp:1,locl:1,rlig:1,rclt:1,calt:1,liga:1,clig:1,kern:1,mark:1,mkmk:1,curs:1};
export function createFeaturePlan(layout,script='latn',language='dflt',features={},positioning=false){
 const s=layout.scripts.find(s=>s.tag===script)??layout.scripts.find(s=>s.tag==='DFLT'),lang=s?.languages[language]??s?.languages.dflt;if(!lang)return [];
 const settings={...DEFAULTS,...features};if(script==='arab')for(const k of JOIN)settings[k]=1;
 const selected=new Map();
 for(const id of lang.features){const f=layout.features[id],value=id===lang.required?Math.max(1,settings[f.tag]??1):settings[f.tag]??0;if(!value)continue;
  const stage=positioning?0:EARLY.includes(f.tag)?EARLY.indexOf(f.tag):JOIN.includes(f.tag)?2+JOIN.indexOf(f.tag):f.tag==='rlig'?9:10;
  for(const index of f.lookups){const key=`${stage}:${index}`,prior=selected.get(key),mask=JOIN.includes(f.tag)?1<<JOIN.indexOf(f.tag):0;if(prior){prior.mask=prior.mask===0||mask===0?0:prior.mask|mask;}else selected.set(key,{lookup:index,stage,mask,value,feature:f.tag});}
 }
 return [...selected.values()].sort((a,b)=>a.stage-b.stage||a.lookup-b.lookup);
}
export function captureLayoutTables(tables,glyphCount,units){
 const d={version:1,glyphCount,units,gsub:tables.get('GSUB')?.bytes.slice()??new Uint8Array(),gpos:tables.get('GPOS')?.bytes.slice()??new Uint8Array(),gdef:tables.get('GDEF')?.bytes.slice()??new Uint8Array()};
 d.gsubInfo=inspectLayout(d.gsub,'GSUB');d.gposInfo=inspectLayout(d.gpos,'GPOS');if(d.gdef.length){const r=new LayoutReader(d.gdef,'GDEF');if(r.u16(0)!==1||r.u16(2)>3)throw new RangeError('Unsupported GDEF');r.check(0,12);}return d;
}
