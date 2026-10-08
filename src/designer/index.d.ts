import type {ControlTemplateDefinition} from '../templates/index.js';
import type {View,ViewProps,HelionSurface,Color,EasingName,FontSource,CanonicalViewProps} from '../index.js';
export type DesignControlKind='Canvas'|'Grid'|'StackPanel'|'DockPanel'|'WrapPanel'|'UniformGrid'|'Border'|'TextBlock'|'Button'|'CheckBox'|'Slider'|'TextBox'|'ProgressBar'|'Path'|'Panel'|'Viewbox'|'ScrollViewer'|'ContentControl';
export type DesignAnimatedProperty='opacity'|'translateX'|'translateY'|'scaleX'|'scaleY'|'rotation';
export interface DesignKeyframe {time:number;value:number;easing?:EasingName;}
export interface DesignAnimation {property:DesignAnimatedProperty;keyframes:DesignKeyframe[];}
/** Data-only authoring properties. Imported unsupported properties are rejected. */
export type DesignProps=Omit<CanonicalViewProps,'animations'|'action'|'bind'|'template'|'templates'|'themes'|'theme'|'themeVariant'|'controlThemes'|'reducedMotion'> & {
 template?:string;templateDefaults?:boolean|('background'|'foreground'|'borderColor'|'radius'|'borderWidth'|'padding')[];locked?:boolean;shape?:0|1|2|3;backgroundResource?:string;foregroundResource?:string;
 animations?:DesignAnimation[];action?:{type:'none'|'toggle'|'increment'|'set';target?:string;value?:number};
 bind?:{source:string;scale?:number;offset?:number};
};
export interface DesignNode {type:DesignControlKind;props?:DesignProps;children?:DesignNode[];}
export type DesignStateValues=Partial<Record<DesignAnimatedProperty,number>>&{background?:Color;foreground?:Color;borderColor?:Color};
export interface DesignProject {templates?:readonly ControlTemplateDefinition[];templateCapacity?:number;theme?:'fluent'|'macos26';themeVariant?:'light'|'dark';themeContrast?:'standard'|'high';controlDensity?:'comfortable'|'compact';accentColor?:Color|null;reducedMotion?:boolean;version?:1;title?:string;width?:number;height?:number;duration?:number;capacity?:number;history?:number;root?:DesignNode;resources?:{name:string;color:Color}[];states?:{name:string;overrides?:Record<string,DesignStateValues>}[];}
export interface NormalizedDesignProject extends DesignProject {version:1;title:string;width:number;height:number;duration:number;capacity:number;history:number;root:DesignNode;resources:{name:string;color:number}[];states:{name:string;overrides:Record<string,DesignStateValues>}[];flat:{type:DesignControlKind;props:DesignProps;parent:number;depth:number;index:number;children:number[]}[];}
export type DesignCommandName='select'|'tool'|'insert'|'delete'|'duplicate'|'undo'|'redo'|'property'|'text'|'name'|'reparent'|'reorder'|'group'|'ungroup'|'align'|'distribute'|'lock'|'visibility'|'zoom'|'fit'|'snap'|'grid'|'preview'|'play'|'stop'|'seek'|'record'|'keyframe'|'removeKey'|'easing'|'selectAll'|'state'|'captureState'|'resetState'|'resource'|'bindResource'|'copy'|'paste'|'cancel'|'gridTrack'|'documentSize'|'duration'|'restore'|'resetView'|'toggleGuides'|'bind'|'action'|'template'|'controlTheme'|'templateDefaults'|'themePreference'|'themeAccent'|'templatePreview';
export type DesignFieldName='x'|'y'|'width'|'height'|'minWidth'|'minHeight'|'maxWidth'|'maxHeight'|'padding'|'gap'|'marginLeft'|'marginTop'|'marginRight'|'marginBottom'|'fontSize'|'radius'|'borderWidth'|'opacity'|'rotation'|'scaleX'|'scaleY'|'translateX'|'translateY'|'foreground'|'background'|'borderColor'|'horizontalAlignment'|'verticalAlignment'|'row'|'column'|'rowSpan'|'columnSpan'|'orientation'|'wrap'|'dock'|'lastChildFill'|'uniformRows'|'uniformColumns'|'stretch'|'columnsCount'|'rowsCount'|'value'|'actionKind'|'actionTarget'|'actionValue'|'bindingSource'|'bindingScale'|'bindingOffset'|'backgroundResource'|'foregroundResource';
export interface DesignManifest {templates?:ControlTemplateDefinition[];templateCapacity?:number;node:number;pointer:number;data:number;capacity:number;history:number;inbox:number;inboxCapacity:number;slots:number[];overlay:number;title:string;maxDepth:number;offsets:{records:number;names:number;text:number;tracks:number;states:number;words:number};assets:{path:string|number[][];stroke:number;viewBox:number[];fillRule?:'nonzero'|'evenodd'}[];typography:Partial<DesignProps>[];}
export interface DesignSnapshot {slotNames:(string|null)[];project:DesignProject;revision:number;selectedSlot:number;rejectedOperations:number;lastError:number;historyCount:number;historyCursor:number;}
export const DesignCommand:Readonly<Record<DesignCommandName,number>>;
export const DesignTool:Readonly<Record<'select'|'hand'|'rectangle'|'text'|'ellipse'|'button',number>>;
export const DesignFlags:Readonly<Record<'snapGrid'|'snapObjects'|'showGrid'|'rulers'|'preview'|'record'|'playing'|'loop'|'guides',number>>;
export const DesignField:Readonly<Record<DesignFieldName,number>>;
export const DESIGN_PALETTE:ReadonlyArray<{name:string;type?:DesignControlKind;shape?:number;tool?:number}>;
export function DesignDocument(project?:DesignProject):NormalizedDesignProject;
export function projectToView(project:DesignProject,options?:{state?:number;animate?:boolean}):View;
export function generateDesignSource(project:DesignProject):string;
export function designerAction(target:string,command:DesignCommandName,value?:number,extra?:number):{type:'designer';target:string;command:DesignCommandName;value:number;extra:number};
export class DesignerController {
 constructor(surface:HelionSurface,name:string|number);readonly surface:HelionSurface;readonly id:number;readonly meta:DesignManifest;
 command(name:DesignCommandName,a?:number,b?:number,x?:number,y?:number):this;
 select(slot:number,options?:{add?:boolean}):this;
 set(property:Exclude<DesignFieldName,'foreground'|'background'|'borderColor'>,value:number):this;
 /** Accepts #RGB, #RGBA, #RRGGBB or #RRGGBBAA; alpha is last. */
 setColor(property:'foreground'|'background'|'borderColor',color:string):this;
 text(value:string):this;name(value:string):this;
 setThemeContrast(value:'standard'|'high'):this;setControlDensity(value:'comfortable'|'compact'):this;setAccentColor(value:Color|null):this;setReducedMotion(value:boolean):this;previewTemplateState(name:'automatic'|'normal'|'pointerover'|'pressed'|'focused'|'checked'|'disabled'):this;
 applyTemplate(name:string|null,options?:{defaults?:boolean}):this;
 insert(type:DesignControlKind,options?:{shape?:number}):this;
 snapshot():Promise<DesignSnapshot>;source():Promise<string>;restore(project:DesignProject):Promise<this>;
}

export {templateToDesignProject,designProjectToTemplate} from './template-tools.js';
export type {TemplateEditSession} from './template-tools.js';
export const DESIGN_TEMPLATE_LIBRARY:readonly ControlTemplateDefinition[];
export function designTemplateCatalog(templates?:readonly ControlTemplateDefinition[],poolCapacity?:number):ControlTemplateDefinition[];
