import {checkLogicalGrouping,formatLogicalGroupingError} from './check-wgsl-logic.mjs';
/** Test-only scalar execution adapter. Executes the mutation function bodies from
 * editor.wgsl as JavaScript, with fixed-width heap writes. It is NOT a WGSL parser,
 * type validator, a GPU emulator, or a runtime fallback. Geometry is stubbed; use
 * tests/editor.html for real compiler, resource, raster and scheduling validation. */
import {readFile} from 'node:fs/promises';
import {HeapBuilder} from '../src/core/compiler.js';
import {packEditor} from '../src/editor/pack.js';
import {decodeDocumentSnapshot} from '../src/editor/index.js';
import {EDITOR_WORDS,EditorCommand} from '../src/editor/schema.js';
const source=(await readFile(new URL('../shaders/unicode.wgsl',import.meta.url),'utf8'))+'\n'+(await readFile(new URL('../shaders/editor.wgsl',import.meta.url),'utf8'));
export function scalarFunctions(code){
 const errors=checkLogicalGrouping(code);
 if(errors.length)throw new SyntaxError(errors.map(formatLogicalGroupingError).join('\n'));
 const out=[];const re=/\bfn\s+(\w+)\s*\(/g;let m;while((m=re.exec(code))){let a=m.index,start=code.indexOf('{',re.lastIndex),depth=1,k=start+1;while(depth&&k<code.length){if(code[k]==='{')depth++;else if(code[k]==='}')depth--;k++;}out.push({name:m[1],code:code.slice(a,k)});re.lastIndex=k;}return out;}
export function translateScalarBody(code){
 const errors=checkLogicalGrouping(code);
 if(errors.length)throw new SyntaxError(errors.map(formatLogicalGroupingError).join('\n'));
 return code.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g,'').replace(/@builtin\([^)]*\)\s*/g,'')
  .replace(/\bfn\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*\w+(?:<[^>]+>)?)?\s*\{/g,(_,name,args)=>`function ${name}(${args.replace(/:\s*\w+(?:<[^>]+>)?/g,'')}){`)
  .replace(/\bvar\s+(\w+)\s*:\s*array<(\w+),\s*(\d+)>\s*;/g,(_,name,type,size)=>`let ${name}=new ${type==='f32'?'Float32Array':'Uint32Array'}(${size});`)
  .replace(/\b(var|let)\s+(\w+)\s*:\s*\w+\s*=/g,'$1 $2 =')
  .replace(/\bvar\b/g,'let').replace(/\bloop\s*\{/g,'while(true){')
  .replace(/\bswitch\s+([^{}]+?)\s*\{/g,'switch($1){')
  .replace(/case\s+((?:\d+[ui]?\s*,\s*)+\d+[ui]?)\s*:/g,(_,items)=>items.split(',').map(x=>`case ${x.trim()}:`).join(''))
  .replace(/\b(0x[0-9a-f]+|\d+(?:\.\d*)?)[ui]\b/gi,'$1')
  .replace(/\bvec2<f32>\(/g,'vec2f(').replace(/\bbitcast<u32>\(/g,'toBits(').replace(/\bbitcast<f32>\(/g,'fromBits(').replace(/\bbitcast<i32>\(/g,'i32(')
  .replace(/hash=\(hash\^edChar\(d,p\)\)\*16777619/g,'hash=Math.imul(hash^edChar(d,p),16777619)>>>0');
}
const skipped=new Set(['isEditor','ed','edLineHeight','edCell','edTop','edTextWidth','edVisibleHeight','edReveal','editorPointer']);
const deferredEditor=new Set(['editorCommand','editorKey','editorText','editorPointer','applyEditorInput','applyEditorCommands']);
const bodies=scalarFunctions(source).filter(f=>!skipped.has(f.name)&&!deferredEditor.has(f.name)).map(f=>f.name.startsWith('executeEditor')?{...f,name:f.name.replace('executeEditor','editor'),code:f.code.replace(f.name,f.name.replace('executeEditor','editor'))}:f);
// WGSL switch cases never fall through. JS needs explicit breaks at case blocks.
export function noFallthrough(s){return s.replace(/}\s*(?=case\s|default\s*:)/g,'break;}');}
const code=bodies.map(f=>noFallthrough(translateScalarBody(f.code))).join('\n');
export function scalarEditor(text='',options={}){
 const hb=new HeapBuilder(16777216),meta=packEditor(hb,{text,documentCapacity:1024,historyCapacity:8192,...options},'CodeEditor');
 const directory=hb.alloc(1);const heap=hb.finish(),hf32=new Float32Array(heap.buffer),state=new Uint32Array(256),sf32=new Float32Array(state.buffer),nodes=[{aux:{x:meta.pointer},info:{x:23},misc:{z:14},rect:{z:640,w:480}}];
 const scratch=new ArrayBuffer(4),u=new Uint32Array(scratch),f=new Float32Array(scratch);
 const toBits=x=>{f[0]=x;return u[0];},fromBits=x=>{u[0]=x;return f[0];};
 const api={vec2f:(x,y)=>({x:Math.fround(x),y:Math.fround(y??x)}),heap,state,nodes,frame:{viewport:{w:1},counts:{x:1}},NONE:0xffffffff,VIEW_FEATURES:7,ed:()=>meta.pointer,isEditor:i=>i===0,visible:()=>options.visible!==false,edVisibleHeight:()=>240,edLineHeight:()=>20,edTextWidth:()=>600,edCell:()=>8,edReveal:()=>{},dockNextPane:()=>{},edTop:()=>0,cs:()=>64,sf:i=>sf32[i],setf:(i,x)=>sf32[i]=x,hf:i=>hf32[i],hsetf:(i,x)=>hf32[i]=x,isCombining:c=>/\p{M}/u.test(String.fromCodePoint(c)),select:(a,b,c)=>c?b:a,min:Math.min,max:Math.max,abs:Math.abs,floor:Math.floor,round:Math.round,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),u32:x=>x>>>0,i32:x=>x|0,f32:Math.fround,toBits,fromBits};
 const factory=new Function(...Object.keys(api),`let _;${code}\nreturn {${bodies.map(f=>f.name).join(',')}};`);
 const kernel=factory(...Object.values(api));const d=meta.pointer;state[60]=directory;state[61]=1;heap[directory]=0;
 return {meta,heap,state,nodes,kernel,analyze(){kernel.analyzeEditors({x:0});kernel.layoutEditors({x:0});return this;},command(name,a=0,b=0,flags=0){kernel.editorCommand(0,EditorCommand[name],a,b,flags);return this;},key(key,modifiers=0){kernel.editorKey(0,key,modifiers);return this;},type(text){for(const c of text)kernel.editorText(0,c.codePointAt(0));return this;},bulk(text,command='insertStaging',flags=0){const data=Uint32Array.from(text,c=>c.codePointAt(0));heap.set(data,meta.staging);this.command(command,data.length,flags);return this;},snapshot(){return decodeDocumentSnapshot(heap.slice(d,d+EDITOR_WORDS+meta.capacity+64).buffer,meta);}};
}
