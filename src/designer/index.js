import {rgba,Opcode,Kind} from '../core/schema.js';
import {DesignCommand,DesignField,DESIGN_COLOR_FIELDS,DESIGN_TYPE_NAMES,DESIGN_NAME,DESIGN_RECORD} from './schema.js';
import {decodeDesignSnapshot,generateDesignSource,DesignDocument,projectToView} from './document.js';
import {encodeDesignData} from './pack.js';
export {DesignDocument,projectToView,generateDesignSource} from './document.js';
export {DesignCommand,DesignTool,DesignFlags,DesignField,DESIGN_PALETTE} from './schema.js';
export function designerAction(target,command,value=0,extra=0){if(!(command in DesignCommand))throw new TypeError(`Unknown design command ${command}`);return{type:'designer',target,command,value,extra};}
export class DesignerController {
 constructor(surface,name){this.surface=surface;this.id=surface.id(name);this.meta=surface.manifest.designers?.find(d=>d.node===this.id);if(!this.meta)throw new TypeError('Expected a DesignSurface');}
 command(name,a=0,b=0,x=0,y=0){if(!(name in DesignCommand))throw new TypeError(`Unknown designer command ${name}`);this.surface.send(Opcode.Designer,{target:this.id,c:DesignCommand[name],a,b,x,y});return this;}
 select(slot,{add=false}={}){if(!Number.isInteger(slot)||slot<0||slot>=this.meta.capacity)throw new RangeError('Unknown design slot');return this.command('select',slot,Number(add));}
 set(property,value){if(!(property in DesignField)||DESIGN_COLOR_FIELDS.has(DesignField[property]))throw new TypeError('Use setColor for colors; property must be declared');return this.command('property',DesignField[property],Number(value));}
 setColor(property,color){if(!['background','foreground','borderColor'].includes(property))throw new TypeError('Expected a paint property');return this.bulk(String(color),'property',DesignField[property]);}
 text(value){return this.bulk(value,'text');} name(value){return this.bulk(value,'name');}
 bulk(value,command,field=0){if(typeof value!=='string')throw new TypeError('Expected text');const data=Uint32Array.from(value,c=>c.codePointAt(0));if(data.length>512||data.some(c=>c>=0xd800&&c<=0xdfff))throw new RangeError('Designer text requires at most 512 Unicode scalars');this.surface.commands.pushBulk(Opcode.Designer,{target:this.id,c:DesignCommand[command],a:field,b:data.length,x:1},data,this.meta.inbox);this.surface.invalidate();return this;}
 applyTemplate(name,{defaults=false}={}){const index=name==null?0:(this.meta.templates??[]).findIndex(t=>t.name===name)+1;if(name!=null&&index===0)throw new ReferenceError('Unknown prepared designer template');return this.command('template',index,Number(defaults));}
 setThemeContrast(value){if(!['standard','high'].includes(value))throw new TypeError('Expected standard/high');return this.command('themePreference',0,Number(value==='high'));}
 setControlDensity(value){if(!['comfortable','compact'].includes(value))throw new TypeError('Expected comfortable/compact');return this.command('themePreference',1,Number(value==='compact'));}
 setReducedMotion(value){if(typeof value!=='boolean')throw new TypeError('Expected boolean');return this.command('themePreference',2,Number(value));}
 setAccentColor(value){if(value==null)return this.command('themePreference',3);const color=rgba(value);if((color>>>24)!==255)throw new RangeError('Accent colors must be opaque');return this.command('themeAccent',color&65535,color>>>16);}
 previewTemplateState(name){const masks={automatic:0,normal:1,pointerover:2,pressed:4,focused:5,checked:9,disabled:17};if(!Object.hasOwn(masks,name))throw new TypeError('Unknown template preview state');return this.command('templatePreview',masks[name]);}
 insert(type,{shape=0}={}){if(!DESIGN_TYPE_NAMES.includes(type))throw new TypeError('Unsupported designer control type');return this.command('insert',Kind[type],shape);}
 async _snapshot(){const bytes=await this.surface.readHeapRange(this.meta.data,this.meta.offsets.words);const project=decodeDesignSnapshot(bytes,this.meta);const data=new Uint32Array(bytes);const slotNames=Array.from({length:this.meta.capacity},(_,k)=>{const r=this.meta.offsets.records+k*DESIGN_RECORD;if(!data[r])return null;return String.fromCodePoint(...data.slice(this.meta.offsets.names+k*DESIGN_NAME,this.meta.offsets.names+k*DESIGN_NAME+data[r+5]));});const header=new Uint32Array(await this.surface.readHeapRange(this.meta.pointer,128));return{project,slotNames,revision:header[8],selectedSlot:header[9],rejectedOperations:header[55],lastError:header[54],historyCount:header[25],historyCursor:header[26]};}
 snapshot(){return this.surface.platformSnapshot(()=>this._snapshot());}
 async source(){return generateDesignSource((await this.snapshot()).project);}
 async restore(project){const data=encodeDesignData(project,this.meta);this.surface.commands.pushBulk(Opcode.Designer,{target:this.id,c:DesignCommand.restore,a:data.length},data,this.meta.inbox);this.surface.invalidate();return this;}
}

import {templateToDesignProject,designProjectToTemplate} from './template-tools.js';
export {templateToDesignProject,designProjectToTemplate};
import {designTemplateCatalog,DESIGN_TEMPLATE_LIBRARY} from './template-catalog.js';
export {designTemplateCatalog,DESIGN_TEMPLATE_LIBRARY};
