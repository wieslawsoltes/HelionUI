import {Opcode,AUTO_TARGET} from '../core/schema.js';
import {ED,EDITOR_WORDS,EditorCommand} from './schema.js';
export {EditorCommand,EditorLanguage,EditorFlags} from './schema.js';
export {TextDocument} from './declarations.js';
export function decodeDocumentSnapshot(bytes,meta){
 const words=new Uint32Array(bytes);if(words.length<EDITOR_WORDS+meta.capacity+32)throw new RangeError('Truncated document snapshot');
 const offset=meta.pointer,read=key=>words[ED[key]],length=read('length'),a=read('gapStart'),b=read('gapEnd'),data=read('data')-offset;
 if(a>b||b>meta.capacity||length!==meta.capacity-b+a)throw new Error('Invalid GPU gap-buffer state');
 const chars=new Uint32Array(length);chars.set(words.subarray(data,data+a));chars.set(words.subarray(data+b,data+meta.capacity),a);
 const parts=[];for(let i=0;i<chars.length;i+=2048)parts.push(String.fromCodePoint(...chars.subarray(i,i+2048)));
 const sel=read('selections')-offset;const selections=Array.from({length:Math.min(16,read('selectionCount'))},(_,k)=>({caret:words[sel+k*2],anchor:words[sel+k*2+1]}));
 return {text:parts.join(''),codepoints:chars,length,revision:read('revision'),selectionRevision:read('selectionRevision'),selections,lineCount:read('lineCount'),visualLineCount:read('visualCount'),matches:read('matchCount'),matchesTruncated:!!(read('flags')&256),diagnosticCount:read('diagnosticCount'),rejectedEdits:read('rejectedEdits'),historyResets:read('historyResets'),undoWords:read('historyCursor'),capacity:meta.capacity,language:meta.language,offsetUnit:'unicode-scalar',lineEnding:'LF'};
}
export class EditorController {
 constructor(surface,name){this.surface=surface;this.id=surface.id(name);this.meta=surface.manifest.editors?.find(e=>e.node===this.id);if(!this.meta)throw new TypeError('Expected a TextEditor or CodeEditor');}
 command(name,a=0,b=0,flags=0){if(!(name in EditorCommand))throw new TypeError(`Unknown editor command ${name}`);this.surface.send(Opcode.Editor,{target:this.id,c:EditorCommand[name],a,b,x:flags});return this;}
 focus(){this.command('focus');this.surface.focusTextInput();return this;}
 select(caret,anchor=caret,add=false){for(const value of [caret,anchor])if(!Number.isInteger(value)||value<0||value>this.meta.capacity)throw new RangeError('Selection offsets are bounded Unicode scalars');return this.command('select',caret,anchor,add?1:0);}
 insert(text){return this.bulk(text,'insertStaging');}
 setReplacement(text){return this.bulk(text,'setReplacement');}
 insertSnippet(template){return this.bulk(template,'insertSnippet');}
 replaceDocument(text){return this.bulk(text,'loadStaging');}
 search(text,{caseSensitive=false,wholeWord=false}={}){return this.bulk(text,'setSearch',(caseSensitive?1:0)|(wholeWord?2:0));}
 bulk(text,command,flags=0){const data=Uint32Array.from(String(text).replace(/\r\n?/g,'\n'),c=>c.codePointAt(0));if(data.some(c=>c>=0xd800&&c<=0xdfff))throw new TypeError('Document contains an unpaired surrogate');if(data.length>this.meta.capacity||['setSearch','setReplacement'].includes(command)&&data.length>256)throw new RangeError('Input exceeds reserved editor capacity');this.surface.commands.pushBulk(Opcode.Editor,{target:this.id,c:EditorCommand[command],a:data.length,b:flags},data,this.meta.staging);if(this.surface.options.autoStart!==false||this.surface.running)this.surface.invalidate();return this;}
 async _snapshot(){return decodeDocumentSnapshot(await this.surface.readHeapRange(this.meta.pointer,EDITOR_WORDS+this.meta.capacity+64),this.meta);}
 async snapshot(){return this.surface.platformSnapshot(()=>this._snapshot());}
 async selectedText(){const snapshot=await this.snapshot();return snapshot.selections.map(({caret,anchor})=>{const chars=snapshot.codepoints.subarray(Math.min(caret,anchor),Math.max(caret,anchor));const parts=[];for(let i=0;i<chars.length;i+=2048)parts.push(String.fromCodePoint(...chars.subarray(i,i+2048)));return parts.join('');}).join('\n');}
 async copy({cut=false}={}){if(!navigator.clipboard?.writeText)throw new Error('Clipboard writing requires a supported secure-context browser');const snapshot=await this.snapshot();const selection=snapshot.selections.map(({caret,anchor})=>Array.from(snapshot.codepoints.subarray(Math.min(caret,anchor),Math.max(caret,anchor))).map(c=>String.fromCodePoint(c)).join('')).join('\n');await navigator.clipboard.writeText(selection);if(cut)this.command('cutRevision',snapshot.revision,snapshot.selectionRevision);return selection;}
}
/** GPU focus is read only for the explicit OS clipboard command, never polled. */
export async function clipboardFromSurface(surface,cut=false){
 const staging=surface.device.createBuffer({size:4,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
 try{const focus=await surface.platformSnapshot(async()=>{const e=surface.device.createCommandEncoder();e.copyBufferToBuffer(surface.stateBuffer,0,staging,0,4);surface.device.queue.submit([e.finish()]);await staging.mapAsync(GPUMapMode.READ);surface.stats.readbackBytes+=4;return new Uint32Array(staging.getMappedRange())[0];});if(surface.embedded&&focus===surface.embedded.node)return await clipboardFromSurface(surface.embedded.surface,cut);if(focus!==AUTO_TARGET&&surface.manifest.designers?.length){const declaration=surface.manifest.declarations?.[focus];if(['DesignSurface','DesignTree','PropertyInspector','AnimationTimeline','ColorPicker'].includes(declaration?.type)){const designer=surface.designer(surface.manifest.designers[0].node);designer.command('copy');if(cut)designer.command('delete');return;}}if(focus!==AUTO_TARGET&&surface.manifest.editors.some(e=>e.node===focus))return await surface.editor(focus).copy({cut});}
 finally{staging.destroy();}
}
