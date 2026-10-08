export { h, compile, fromHTML, CommandStream, Kind, Action, Opcode, Property, Key, Source, DEFAULT_LIMITS, AUTO_TARGET } from '../index.js';
export type { View, ViewKind, ViewProps, Child, CompileOptions, CompiledView, Limits, CommandPayload } from '../index.js';

export const VERSION: number;
export const NODE_WORDS:number, CONTROL_WORDS:number, GLOBAL_WORDS:number, EVENT_WORDS:number, TABLE_WORDS:number, COLUMN_WORDS:number, PATH_WORDS:number;
export const Flags:Readonly<Record<'interactive'|'horizontal'|'wrap'|'clip'|'disabled'|'hidden'|'editable',number>>;
export function fbits(value:number):number;
export function fromBits(bits:number):number;
export function align(n:number,a:number):number;
export function nextPowerOfTwo(n:number):number;
export function rgba(value?:string|number|null,fallback?:number):number;
export function finite(value:unknown,fallback:number,label?:string):number;
export function tracks(value?:string|(string|number)[]):[number,number][];
export class HeapBuilder {
 constructor(maxWords?:number);
 words:number[];
 alloc(length:number):number;
 set(at:number,values:number[]):number;
 push(values:number[]):number;
 string(text:unknown,capacity?:number,prefixed?:boolean):[number,number];
}
