import {packUnicode} from '../typography/pack.js';
import {ED,EDITOR_WORDS,EditorFlags,EditorLanguage,CompletionWords} from './schema.js';
import {fbits} from '../core/schema.js';
const bounded=(x,fallback,lo,hi,name)=>{x=x??fallback;if(!Number.isInteger(x)||x<lo||x>hi)throw new RangeError(`${name} must be ${lo}..${hi}`);return x;};
/** Asset packing only. No live CPU document or text-control mirror is retained. */
export function packEditor(heap,p,type) {
 const text=Array.from(String(p.text??'').replace(/\r\n?/g,'\n'),c=>c.codePointAt(0));
 const capacity=bounded(p.documentCapacity,65536,256,1048576,'documentCapacity');
 if(text.length>capacity)throw new RangeError('Initial document exceeds documentCapacity');
 if(text.some(c=>c>=0xd800&&c<=0xdfff))throw new TypeError('Document contains an unpaired surrogate');
 const lineHeight=Number(p.editorLineHeight??0);if(!Number.isFinite(lineHeight)||lineHeight<0||lineHeight>256)throw new RangeError('editorLineHeight must be 0..256');
 const lineCapacity=capacity+1;
 const d=heap.alloc(EDITOR_WORDS),data=heap.alloc(capacity),selections=heap.alloc(16*2),before=heap.alloc(16*2);
 const historyCapacity=bounded(p.historyCapacity,262144,256,4194304,'historyCapacity');
 const lang=p.language??(type==='CodeEditor'?'javascript':'text');if(!(lang in EditorLanguage))throw new TypeError(`Unsupported lexical language ${lang}`);
 const entries=p.completions??CompletionWords[lang==='typescript'?'javascript':lang];
 if(!Array.isArray(entries)||entries.length>256)throw new RangeError('At most 256 completions');
 const labels=[];const completions=entries.map(value=>{if(typeof value!=='string'&&(!value||typeof value.label!=='string'||typeof value.insertText!=='string'))throw new TypeError('Completion requires text or {label,insertText}');const [label]=heap.string(typeof value==='string'?value:value.label,0,true);labels.push(label);const [at,len]=heap.string(typeof value==='string'?value:value.insertText);if(!len||len>256)throw new RangeError('Completion length must be 1..256 scalars');return [at,len];});
 const f=(p.readOnly?EditorFlags.readOnly:0)|(p.wordWrap?EditorFlags.wrap:0)|(p.minimap?EditorFlags.minimap:0);
 heap.set(d,[data,capacity,text.length,capacity,text.length,0,f,EditorLanguage[lang],selections,1,heap.alloc(historyCapacity),historyCapacity,0,0,0,0,heap.alloc(lineCapacity),1,lineCapacity,7,heap.alloc(capacity),heap.alloc(256),0,heap.alloc(256),0,heap.alloc(1024),0,0xffffffff,0,0xffffffff,heap.alloc(32*2),heap.alloc(lineCapacity*2),1,0,0,0,bounded(p.tabSize,2,1,16,'tabSize'),fbits(lineHeight),fbits(p.lineNumbers===false?12:58),0,0,0xffffffff,0xffffffff,heap.push(completions.flat()),completions.length,0,0,heap.alloc(256),0,0,heap.alloc(capacity),heap.alloc(512),0,0,0,before,p.readOnly?1:0,p.renderWhitespace?1:0,p.autoClosingBrackets===false?0:1,0,0,0,0,0]);
 const upload=heap.alloc(capacity);heap.words[d+64]=upload;const stops=heap.alloc(48);heap.words[d+70]=stops;const labelTable=heap.push(labels);heap.words[d+76]=labelTable;heap.words[d+69]=0xffffffff;
 heap.words[d+79]=packUnicode(heap);
 heap.set(data,text); heap.set(selections,[0,0]);
 return {pointer:d,capacity,lineCapacity,language:lang,staging:heap.words[d+ED.uploadStaging],data,selectionPointer:selections};
}
