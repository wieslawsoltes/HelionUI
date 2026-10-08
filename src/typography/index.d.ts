/** Glyph shaping uses normalized font units. Paragraph positions use pixels.
 * Scalar offsets are Unicode codepoint indexes, not JavaScript UTF-16 indexes. */
export interface TypographyOptions {
 features?:Record<string,number|boolean>|string;script?:string;language?:string;direction?:'auto'|'ltr'|'rtl';
 fontFeatures?:Record<string,number|boolean>|string;fontScript?:string;fontLanguage?:string;flowDirection?:'auto'|'ltr'|'rtl';
 kerning?:boolean;ligatures?:boolean;normalize?:boolean;strictScripts?:boolean;preserveIgnorables?:boolean;
 inputCapacity?:number;capacity?:number;operationBudget?:number;
}
export interface ParagraphOptions {width?:number;fontSize?:number;lineHeight?:number;letterSpacing?:number;alignment?:'left'|'center'|'right'|'start'|'end';textAlignment?:'left'|'center'|'right'|'start'|'end';wrap?:boolean|'none'|'word'|'character';tabSize?:number;}
export interface ParagraphSettings {width:number;fontSize:number;lineHeight:number;letterSpacing:number;alignment:'left'|'center'|'right'|'start'|'end';wrap:'none'|'word'|'character';tabSize:number;}
export interface TypographyRun extends TypographyOptions,ParagraphOptions {text:string|Uint32Array;}
export interface PreparedRun {
 pointer:number;input:number;inputCapacity:number;capacity:number;glyphs:number;boundaries:number;carets:number;order:number;
 config:TypographyOptions;layout:number;paragraph:ParagraphSettings;lineRecords:number;positions:number;visualOrder:number;paragraphCarets:number;words:number;
}
export interface PreparedTypography {version:1;heap:Uint32Array;directory:number;runs:PreparedRun[];fonts:{family:string;glyphs:number}[];unicodeVersion:string;}
export interface ShapedGlyph {id:number;cluster:number;clusterEnd:number;codepoint:number;face:number;level:number;advanceX:number;advanceY:number;offsetX:number;offsetY:number;x:number;y:number;hidden:boolean;logicalIndex:number;}
export interface ParagraphLine {glyphStart:number;glyphEnd:number;start:number;end:number;level:number;x:number;width:number;top:number;baseline:number;height:number;ascent:number;descent:number;}
export interface ParagraphSnapshot {valid:boolean;width:number;height:number;fontSize:number;lineCount:number;lines:ParagraphLine[];positions:{x:number;y:number;advance:number;line:number}[];visualOrder:number[];carets:{leading:[number,number];trailing:[number,number]}[];}
export interface TypographySnapshot {valid:boolean;errors:number;warnings:number;revision:number;processedRevision:number;shapeCount:number;operations:number;advance:number;ascent:number;descent:number;lineCount:number;paragraphLevel:number;glyphs:ShapedGlyph[];boundaries:number[];carets:{leading:number;trailing:number}[];paragraph:ParagraphSnapshot|null;}
export function prepareTypography(fonts:readonly unknown[],runs:readonly (string|TypographyRun)[],options?:{maxHeapWords?:number}):PreparedTypography;
export function scalarText(text:string|ArrayLike<number>):number[];
export function normalizeTypography(options?:TypographyOptions):TypographyOptions;
export function normalizeParagraph(options?:ParagraphOptions):ParagraphSettings;
export function normalizeFeatures(value?:TypographyOptions['features']):Record<string,number>;
export function normalizeLanguage(value?:string):string;
export function tag(value:string):number;
export function tagString(value:number):string;
export function typographyShaderSource():Promise<string>;
export function decodeTypography(heap:Uint32Array,run:PreparedRun):TypographySnapshot;
export function typographyReadbackPlan(run:PreparedRun):{bytes:number;ranges:{name:string;source:number;destination:number;length:number}[]};
/** Portable declarations; runtime intentionally accepts a caller's WebGPU device. */
export class GpuTypography {
 static create(device:any,prepared:PreparedTypography,options?:{source?:string}):Promise<GpuTypography>;
 updateText(index:number,text:string|Uint32Array):this;
 updateLayout(index:number,options:ParagraphOptions):this;
 setDirection(index:number,direction:'auto'|'ltr'|'rtl'):this;
 encode(encoder:any,options?:{layout?:boolean}):this;
 readonly output:{buffer:any;directory:number;count:number;glyphStrideBytes:number;runStrideBytes:number;lineStrideBytes:number;positionStrideBytes:number;runs:ReadonlyArray<PreparedRun>};
 readonly readbackBytes:number;
 snapshot(index?:number):Promise<TypographySnapshot>;
 dispose():void;
}
/** Serializable declaration only. Importing this helper does not import a renderer. */
export function ShapedText<const T extends object>(properties:T):{type:'TextBlock';props:T&{textShaping:'opentype'};children:[]};
export function ShapedText(text?:string):{type:'TextBlock';props:{text:string;textShaping:'opentype'};children:[]};
export const SHAPING_ABI:number;
export const LINE_WORDS:number;
export const POSITION_WORDS:number;
export const Paragraph:Readonly<Record<string,number>>;
export const Run:Readonly<Record<string,number>>;
export const Glyph:Readonly<Record<string,number>>;
export const ShapingError:Readonly<Record<string,number>>;
