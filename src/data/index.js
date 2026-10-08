import {Opcode,AUTO_TARGET,fbits} from '../core/schema.js';

export const DataSourceFormat='helion-data-source-1';
export function validateFieldPath(path){if(typeof path!=='string'||!path||path.length>512||path.split('.').some(k=>!k||['__proto__','constructor','prototype'].includes(k)))throw new TypeError('Unsafe or invalid field path');return path;}
function setAt(row,path,value){const parts=path.split('.');let at=row;for(const name of parts.slice(0,-1))at=at[name]??=(Object.create(null));at[parts.at(-1)]=value;}
const KINDS = new Set(['text','number','status','progress','boolean']);
const validKey = key => Number.isInteger(key) && key >= 0 && key < 0xffffffff;
export function dataSource({rows=[],columns,key='id',capacity=Math.max(256,rows.length),stringCapacity=262144,inboxCapacity=262144}={}) {
  if(!Array.isArray(rows))throw new TypeError('DataSource rows must be an array');
  if(!Number.isInteger(capacity)||capacity<1||capacity>65536||rows.length>capacity)throw new RangeError('DataSource capacity must hold rows and be between 1 and 65536');
  validateFieldPath(key);
  columns = columns ?? Object.keys(rows[0] ?? {}).filter(k=>k!==key).map(field=>({field,title:field,type:typeof rows[0][field]==='number'?'number':typeof rows[0][field]==='boolean'?'boolean':'text'}));
  if(!Array.isArray(columns)||!columns.length||columns.length>8)throw new RangeError('DataSource requires 1–8 columns');
  const fields=new Set();columns=columns.map(c=>{if(!c||typeof c.field!=='string'||!c.field||fields.has(c.field))throw new TypeError('Columns require unique field paths');validateFieldPath(c.field);if(c.field===key||c.field.startsWith(key+'.')||key.startsWith(c.field+'.')||[...fields].some(f=>f.startsWith(c.field+'.')||c.field.startsWith(f+'.')))throw new TypeError('Overlapping field paths are not supported');fields.add(c.field);const type=c.type??'text';if(!KINDS.has(type))throw new TypeError(`Unsupported column type ${type}`);return {...c,type};});
  for(const [name,value] of Object.entries({stringCapacity,inboxCapacity}))if(!Number.isInteger(value)||value<16||value>4194304)throw new RangeError(`${name} must be 16–4194304 words`);
  const seen=new Set();for(const row of rows){const id=valueAt(row,key);if(!validKey(id)||seen.has(id))throw new TypeError('Rows require unique u32 keys (0 through 4294967294)');seen.add(id);validateRow(row,columns);}
  return {format:DataSourceFormat,rows,columns,key,capacity,stringCapacity,inboxCapacity};
}
export const createDataSource=dataSource;
export function normalizeItemsSource(value,props={}) {
  if(Array.isArray(value))return dataSource({rows:value,columns:props.dataColumns,key:props.rowKey??'id',capacity:props.rowCapacity??Math.max(256,value.length)});
  if(value?.format===DataSourceFormat)return dataSource(value);
  throw new TypeError('ItemsSource must be an object-row array or dataSource descriptor');
}
export function valueAt(row,path) {let value=row;for(const key of path.split('.')){if(key==='__proto__'||key==='constructor'||key==='prototype')throw new TypeError('Unsafe field path');value=value?.[key];}return value;}
function validateRow(row,columns,partial=false){if(!row||typeof row!=='object'||Array.isArray(row))throw new TypeError('Expected an object row');for(const c of columns){const value=valueAt(row,c.field);if(partial&&value===undefined)continue;if(c.type==='text'){const chars=Array.from(String(value??''));if(chars.some(x=>{const n=x.codePointAt(0);return n>=0xd800&&n<=0xdfff;}))throw new TypeError('Unpaired surrogate in cell');}else if(c.type==='boolean'){if(value!=null&&typeof value!=='boolean')throw new TypeError(`Boolean required for ${c.field}`);}else if(value!=null&&(!Number.isFinite(value)||!Number.isFinite(Math.fround(value))))throw new TypeError(`Finite number required for ${c.field}`);}}
/** Immutable row patches. No host copy of the GPU's current table is maintained. */
export function encodeDataBatch(meta,operations,{expectedRevision=null}={}) {
  if(!Array.isArray(operations)||!operations.length||operations.length>65537)throw new RangeError('Batch requires 1–65537 operations');
  if(expectedRevision!=null&&!validKey(expectedRevision))throw new RangeError('Invalid expected revision');
  const replacement=operations[0]?.type==='clear';if(operations.some((op,i)=>op?.type==='clear'&&i!==0)||replacement&&operations.slice(1).some(op=>op?.type!=='upsert'))throw new TypeError('A clear must start a replacement followed only by upserts');if(replacement){const keys=new Set();for(const op of operations.slice(1)){const k=op.key??valueAt(op.row,meta.key);if(keys.has(k))throw new TypeError('Duplicate replacement key');keys.add(k);}if(keys.size>meta.capacity)throw new RangeError('Replacement exceeds capacity');}
  const words=[1,operations.length,expectedRevision??AUTO_TARGET,0];
  for(const op of operations){const code={upsert:1,remove:2,clear:3,patch:4}[op?.type];if(!code)throw new TypeError('Use upsert, patch, remove or clear');const row=op.row;const key=code===3?0:op.key??valueAt(row,meta.key);if(!validKey(key))throw new TypeError('Expected a u32 row key');
    if(code===1||code===4)validateRow(row,meta.dataColumns,code===4);
    const start=words.length;words.push(code,key,0,0);let mask=0;
    for(let k=0;k<meta.dataColumns.length && (code===1||code===4);k++){const col=meta.dataColumns[k],v=valueAt(row,col.field);if(code===4&&v===undefined)continue;mask|=1<<k;if(col.type==='text'){const chars=Array.from(String(v??''),c=>c.codePointAt(0));if(words.length+1+chars.length>meta.inboxCapacity)throw new RangeError('Batch exceeds reserved upload capacity');words.push(chars.length);for(const ch of chars)words.push(ch);}else words.push(fbits(col.type==='boolean'?(v?1:0):(v??0)));}
    words[start+2]=mask;words[start+3]=words.length-start;
    if(words.length>meta.inboxCapacity)throw new RangeError('Batch exceeds reserved upload capacity; split batches or reserve a larger inbox');
  }
  words[3]=words.length;return Uint32Array.from(words);
}
export class DataSourceController {
  constructor(surface,name){this.surface=surface;this.id=surface.id(name);this.meta=surface.manifest.tables.find(t=>t.node===this.id);if(!this.meta?.source)throw new TypeError('DataGrid must be mounted with ItemsSource for live updates');this.meta=this.meta.source;}
  batch(operations,options){const words=encodeDataBatch(this.meta,operations,options);this.surface.commands.pushBulk(Opcode.Data,{target:this.id,c:1,a:words.length},words,this.meta.inbox);if(this.surface.running||this.surface.options.autoStart!==false)this.surface.invalidate();return this;}
  upsert(rows,options){return this.batch((Array.isArray(rows)?rows:[rows]).map(row=>({type:'upsert',row})),options);}
  patch(key,row,options){return this.batch([{type:'patch',key,row}],options);}
  remove(keys,options){return this.batch((Array.isArray(keys)?keys:[keys]).map(key=>({type:'remove',key})),options);}
  clear(options){return this.batch([{type:'clear'}],options);}
  replace(rows,options){if(!Array.isArray(rows)||rows.length>this.meta.capacity)throw new RangeError('Replacement exceeds table capacity');const seen=new Set();for(const r of rows){const id=valueAt(r,this.meta.key);if(seen.has(id))throw new TypeError('Duplicate replacement key');seen.add(id);}return this.batch([{type:'clear'},...rows.map(row=>({type:'upsert',row}))],options);}
  sort(column,direction='ascending'){const index=typeof column==='number'?column:this.meta.dataColumns.findIndex(c=>c.field===column);if(!Number.isInteger(index)||index<0||index>=this.meta.dataColumns.length||!['ascending','descending'].includes(direction))throw new TypeError('Invalid sort');this.surface.send(Opcode.Data,{target:this.id,c:2,a:index,b:direction==='descending'?1:0});return this;}
  select(key){if(!validKey(key))throw new TypeError('Invalid row key');const words=new Uint32Array([key]);this.surface.commands.pushBulk(Opcode.Data,{target:this.id,c:3,a:1},words,this.meta.inbox);if(this.surface.running||this.surface.options.autoStart!==false)this.surface.invalidate();return this;}
  async snapshot(){return this.surface.platformSnapshot(()=>this._snapshot());}
  async _snapshot(){const h=new Uint32Array(await this.surface.readHeapRange(this.meta.pointer,24));const keys=new Uint32Array(await this.surface.readHeapRange(h[4],h[11]));const live=new Uint32Array(await this.surface.readHeapRange(h[5],h[11]));const rows=new Uint32Array(await this.surface.readHeapRange(this.meta.rows,h[11]*8));const strings=new Uint32Array(await this.surface.readHeapRange(h[12],h[14]));const table=new Uint32Array(await this.surface.readHeapRange(this.meta.table,40));const result=[];for(let i=0;i<h[11];i++){if(!live[i])continue;const row={};setAt(row,this.meta.key,keys[i]);for(let k=0;k<this.meta.dataColumns.length;k++){const c=this.meta.dataColumns[k],v=rows[i*8+k];if(c.type==='text'){const at=v-h[12];if(at<0||at>=strings.length||strings[at]>strings.length-at-1)throw new Error('Text outside source arena');let text='';for(let j=0;j<strings[at];j+=1024)text+=String.fromCodePoint(...strings.subarray(at+1+j,at+1+Math.min(strings[at],j+1024)));setAt(row,c.field,text);}else {const n=new Float32Array(new Uint32Array([v]).buffer)[0];setAt(row,c.field,c.type==='boolean'?!!n:n);}}result.push(row);}return {rows:result,revision:h[3],rejectedOperations:h[18],lastResult:h[19],lastSequence:h[17],capacity:h[1],selectedKey:table[17]===AUTO_TARGET?null:keys[table[17]],usedStringWords:h[14],stringCapacity:h[13],stringCompactions:h[21]};}
}
