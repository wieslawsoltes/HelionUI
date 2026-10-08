import {normalizeParagraph,PARAGRAPH_WORDS,LINE_WORDS,POSITION_WORDS} from './layout.js';
import {tag,normalizeFeatures,normalizeLanguage,createFeaturePlan,inspectLayout} from './opentype.js';
import {UNICODE_DATA} from './unicode-data.js';
import {RUN_WORDS,GLYPH_WORDS,Run} from './schema.js';
const b=new ArrayBuffer(4),u=new Uint32Array(b),f=new Float32Array(b);const bits=x=>{f[0]=x;return u[0];};
export class TypographyHeap{
 constructor(maxWords=16777216){if(!Number.isSafeInteger(maxWords)||maxWords<4)throw new RangeError('Invalid heap capacity');this.maxWords=maxWords;this.length=4;this.words=new Uint32Array(Math.min(maxWords,65536));}
 alloc(n){const p=this.length,end=p+n;if(!Number.isSafeInteger(n)||n<0||end>this.maxWords)throw new RangeError('Typography heap capacity exceeded');if(end>this.words.length){const a=new Uint32Array(Math.min(this.maxWords,Math.max(end,this.words.length*2)));a.set(this.words);this.words=a;}this.length=end;return p;}
 set(p,a){if(!Number.isSafeInteger(p)||p<0||p+a.length>this.length)throw new RangeError('Typography heap write out of range');this.words.set(a,p);return p;}
 push(a){return this.set(this.alloc(a.length),a);}finish(){return this.words.slice(0,this.length);}
}
const unicodeCache=new WeakMap(),fontCache=new WeakMap(),planCache=new WeakMap();
export function packUnicode(heap){
 if(unicodeCache.has(heap))return unicodeCache.get(heap);const d=UNICODE_DATA,h=heap.alloc(16),dir=[];
 for(let i=0;i<d.decompositions.length;){const cp=d.decompositions[i++],n=d.decompositions[i++],seq=d.decompositions.slice(i,i+n);i+=n;dir.push(cp,heap.push([n,...seq]));}
 heap.set(h,[heap.push(d.ranges),d.ranges.length/4,heap.push(dir),dir.length/2,heap.push(d.compositions),d.compositions.length/3,heap.push(d.mirrors),d.mirrors.length/2,heap.push(d.brackets),d.brackets.length/3,0,0,16,0,0,0]);unicodeCache.set(heap,h);return h;
}
export function packLayoutFont(heap,font){
 let cache=fontCache.get(heap);if(!cache){cache=new WeakMap();fontCache.set(heap,cache);}if(cache.has(font))return cache.get(font);
 const p=heap.alloc(12),d=font.layout;const table=a=>{if(!a?.length)return 0;const q=heap.alloc(a.length+1);heap.set(q,[a.length]);heap.set(q+1,a);return q;};
 const kern=(font.kern??[]).map(x=>[x[0],x[1],bits(x[2])]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 heap.set(p,[table(d?.gsub),table(d?.gpos),table(d?.gdef),bits(1/(font.sourceUnits||1)),font.glyphs.length,kern.length,heap.push(kern.flat()),0,0,0,0,0]);cache.set(font,p);return p;
}
export function normalizeTypography(o={}){
 const features=normalizeFeatures(o.fontFeatures??o.features??{});if(o.kerning===false&&!Object.hasOwn(features,'kern'))features.kern=0;if(o.ligatures===false&&!Object.hasOwn(features,'liga'))features.liga=0;
 const script=o.fontScript??o.script??'auto';if(script!=='auto')tag(script);const language=normalizeLanguage(o.fontLanguage??o.language??'dflt');const direction=o.flowDirection??o.direction??'auto';if(!['auto','ltr','rtl'].includes(direction))throw new TypeError('direction must be auto, ltr or rtl');
 return {features,script,language,direction,normalize:o.normalize!==false,strictScripts:o.strictScripts===true,preserveIgnorables:o.preserveIgnorables===true};
}
export function packPlan(heap,font,options){
 let cache=planCache.get(heap);if(!cache){cache=new WeakMap();planCache.set(heap,cache);}let perFont=cache.get(font);if(!perFont){perFont=new Map();cache.set(font,perFont);}const key=JSON.stringify(options);if(perFont.has(key))return perFont.get(key);
 const d=font.layout??{},empty={scripts:[],features:[],lookups:[]},sub=d.gsubInfo??(d.gsub?.length?inspectLayout(d.gsub,'GSUB'):empty),pos=d.gposInfo??(d.gpos?.length?inspectLayout(d.gpos,'GPOS'):empty);
 const scripts=[...new Set(['DFLT','latn','arab','hebr','grek','cyrl','hang',...sub.scripts.map(s=>s.tag),...pos.scripts.map(s=>s.tag)])],entries=[];
 for(const script of scripts){const s=createFeaturePlan(sub,script,options.language,options.features),p=createFeaturePlan(pos,script,options.language,options.features,true);const pack=(plan,info)=>heap.push([plan.length,...plan.flatMap(x=>[info.lookups[x.lookup].offset,x.mask,x.value,x.stage])]);entries.push(tag(script),pack(s,sub),pack(p,pos));}
 const ptr=heap.push([scripts.length,...entries]);perFont.set(key,ptr);return ptr;
}
export function scalarText(text){const a=typeof text==='string'?Array.from(text,c=>c.codePointAt(0)):Array.from(text??[]);if(a.some(c=>!Number.isInteger(c)||c<0||c>0x10ffff||(c>=0xd800&&c<=0xdfff)))throw new TypeError('Text must contain valid Unicode scalars');return a;}
export function packRun(heap,fonts,facePointers,text='',options={}){
 const config=normalizeTypography(options),codes=scalarText(text),inputCapacity=options.inputCapacity??Math.max(256,codes.length),capacity=options.capacity??Math.max(512,inputCapacity*3),budget=options.operationBudget??4000000;
 if(!Number.isInteger(inputCapacity)||inputCapacity<1||inputCapacity>65536||codes.length>inputCapacity||!Number.isInteger(capacity)||capacity<inputCapacity||capacity>196608)throw new RangeError('Invalid retained shaping capacity');if(!Number.isInteger(budget)||budget<100||budget>100000000)throw new RangeError('Invalid shaping operation budget');
 const p=heap.alloc(RUN_WORDS),input=heap.alloc(inputCapacity),glyphs=heap.alloc(capacity*GLYPH_WORDS),scratch=heap.alloc(capacity*GLYPH_WORDS),copy=heap.alloc(inputCapacity),boundaries=heap.alloc(inputCapacity+1),order=heap.alloc(capacity),carets=heap.alloc((inputCapacity+1)*2),tasks=heap.alloc(256*8),match=heap.alloc(256),join=heap.alloc(capacity);
 const plans=heap.push(fonts.map(font=>packPlan(heap,font,config)));heap.set(input,codes);
 heap.set(p,[0x48545931,capacity,input,codes.length,1,0,glyphs,0,scratch,fonts.length,heap.push(facePointers),plans,packUnicode(heap),0,0,tag(config.language),config.script==='auto'?0:tag(config.script),['auto','ltr','rtl'].indexOf(config.direction),0,0,copy,boundaries,order,0,(config.normalize?1:0)|(config.strictScripts?2:0)|(config.preserveIgnorables?4:0),budget,0,0,1,0,tasks,match,carets,0,0,0,1,0,join,inputCapacity,0xffffffff,0,0,0,0,config.features.kern===0?1:0,0,0,0]);
 const paragraph=normalizeParagraph(options),layout=heap.alloc(PARAGRAPH_WORDS),lineRecords=heap.alloc((capacity+1)*LINE_WORDS),positions=heap.alloc(capacity*POSITION_WORDS),visualOrder=heap.alloc(capacity),paragraphCarets=heap.alloc((inputCapacity+1)*4);
 heap.set(layout,[bits(paragraph.width),bits(paragraph.fontSize),bits(paragraph.lineHeight),bits(paragraph.letterSpacing),['left','center','right','start','end'].indexOf(paragraph.alignment),['none','word','character'].indexOf(paragraph.wrap),1,0,0,lineRecords,positions,visualOrder,paragraphCarets,0,0,0,0,0,paragraph.tabSize]);heap.set(p+50,[layout]);heap.set(layout+19,[heap.words[layout+4]]);
 return {pointer:p,input,inputCapacity,capacity,glyphs,boundaries,carets,order,config,layout,paragraph,lineRecords,positions,visualOrder,paragraphCarets,words:heap.length-p};
}
export function packShapingFace(heap,font){
 if(!font?.glyphs?.length||!(font.cmap instanceof Map))throw new TypeError('Expected a prepared static font');const p=heap.alloc(16),records=heap.alloc(font.glyphs.length*4),dir=heap.alloc(0x1100),pages=new Map();
 for(const[cp,gid]of font.cmap){const n=cp>>>8;if(!pages.has(n)){const q=heap.alloc(256);pages.set(n,q);heap.set(dir+n,[q]);}heap.set(pages.get(n)+(cp&255),[gid+1]);}
 font.glyphs.forEach((g,i)=>heap.set(records+i*4,[0,bits(g.advance),bits(g.bearing||0),0]));
 heap.set(p,[bits(font.ascent),bits(font.descent),bits(font.lineGap),font.glyphs.length,records,dir,0,font.cmap.get(0xfffd)||0,bits(font.underlinePosition),bits(font.underlineThickness),bits(font.strikePosition),bits(font.strikeThickness),1,packLayoutFont(heap,font),packUnicode(heap),0]);return p;
}
export function prepareTypography(fonts,runs,options={}){
 if(!Array.isArray(fonts)||!fonts.length||fonts.length>8)throw new RangeError('Supply 1–8 prepared fonts');if(!Array.isArray(runs)||!runs.length||runs.length>4096)throw new RangeError('Supply 1–4096 runs');
 const heap=new TypographyHeap(options.maxHeapWords),faces=fonts.map(f=>packShapingFace(heap,f)),manifest=runs.map(r=>packRun(heap,fonts,faces,typeof r==='string'?r:r.text??'',typeof r==='string'?{}:r));const directory=heap.push(manifest.map(r=>r.pointer));return {version:1,heap:heap.finish(),directory,runs:manifest,fonts:fonts.map(f=>({family:f.family,glyphs:f.glyphs.length})),unicodeVersion:UNICODE_DATA.version};
}
export {Run};
