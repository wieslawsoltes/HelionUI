export interface ThemeSettings {themeContrast?:'standard'|'high';controlDensity?:'comfortable'|'compact';accentColor?:Color|null;}
import type {View,ViewProps,HelionSurface,MutableProperty,GPUAction,Color} from '../index.js';
export type TemplateTarget='Button'|'CheckBox'|'Slider'|'TextBox'|'ProgressBar'|'ContentControl'|'ContentPresenter'|'Panel'|'Border';
export type TemplateProperty='background'|'foreground'|'borderColor'|'radius'|'borderWidth'|'width'|'height'|'minWidth'|'minHeight'|'maxWidth'|'maxHeight'|'padding'|'gap'|'fontSize'|'x'|'y'|'opacity'|'translateX'|'translateY'|'scaleX'|'scaleY'|'rotation'|'value'|'disabled'|'hidden'|'wrap'|'horizontalAlignment'|'verticalAlignment'|'text'|'actualWidth'|'actualHeight'|'isPointerOver'|'isPressed'|'isFocused'|'isChecked'|'isEnabled'|'isVisible';
export interface TemplateBindingOptions {scale?:number;offset?:number;min?:number;max?:number;relativeTo?:'actualWidth'|'actualHeight'|null;relativeOffset?:number;mode?:'oneWay'|'twoWay';negate?:boolean;}
export interface TemplateBindingValue extends TemplateBindingOptions {kind:'templateBinding';property:string;}
export interface ThemeResourceValue {kind:'themeResource';key:string;}
export interface VisualStateDefinition {name:string;when?:Partial<Record<'pointerover'|'hover'|'pressed'|'focus'|'checked'|'disabled'|'dark'|'light',boolean>>;setters:Record<string,ViewProps>;duration?:number;easing?:string;}
export interface VisualStateGroupDefinition {name:string;states:VisualStateDefinition[];}
export interface ControlTemplateDefinition {kind:'controlTemplate';name:string;targetType:TemplateTarget;root:View;defaults:ViewProps;visualStateGroups:VisualStateGroupDefinition[];}
export interface ControlTemplateOptions {name?:string;defaults?:ViewProps;states?:VisualStateGroupDefinition[];visualStateGroups?:VisualStateGroupDefinition[];}
export interface ControlTheme {readonly kind?:'controlTheme';readonly name:string;readonly displayName?:string;readonly dark:Record<string,Color>;readonly light:Record<string,Color>;readonly contrastDark?:Record<string,Color>;readonly contrastLight?:Record<string,Color>;readonly compact?:Record<string,number>;readonly templates?:Partial<Record<TemplateTarget,ControlTemplateDefinition>>;}
export function TemplateBinding(property:TemplateProperty|Capitalize<TemplateProperty>|'Content'|'IsChecked'|'CornerRadius'|'BorderBrush'|'BorderThickness',options?:TemplateBindingOptions):TemplateBindingValue;
export function ThemeResource(key:string):ThemeResourceValue;
export function VisualState(name:string,setters?:Record<string,ViewProps>,options?:Omit<VisualStateDefinition,'name'|'setters'>):VisualStateDefinition;
export function VisualStateGroup(name:string,states:VisualStateDefinition[]):VisualStateGroupDefinition;
export function ControlTemplate(targetType:TemplateTarget,root:View,options?:ControlTemplateOptions):ControlTemplateDefinition;
export function ControlTemplate(definition:ControlTemplateDefinition):ControlTemplateDefinition;
export function validateControlTemplate(value:ControlTemplateDefinition):ControlTemplateDefinition&{partCount:number;maxPartDepth:number};
export const ButtonTemplate:ControlTemplateDefinition,CheckBoxTemplate:ControlTemplateDefinition,TextBoxTemplate:ControlTemplateDefinition,SliderTemplate:ControlTemplateDefinition,ProgressBarTemplate:ControlTemplateDefinition,ContentControlTemplate:ControlTemplateDefinition,ToggleSwitchTemplate:ControlTemplateDefinition;
export const WinUIFluentTheme:ControlTheme,MacOS26Theme:ControlTheme;
export const DEFAULT_CONTROL_THEMES:readonly ControlTheme[];
export const BUILTIN_CONTROL_TEMPLATES:Readonly<Partial<Record<TemplateTarget,ControlTemplateDefinition>>>;
export const TemplateCommand:Readonly<Record<'theme'|'state'|'automatic'|'reducedMotion'|'clearLocalValue'|'accent'|'resetAccent'|'contrast'|'density',number>>;
export const AccentButtonTemplate:ControlTemplateDefinition,SubtleButtonTemplate:ControlTemplateDefinition,DestructiveButtonTemplate:ControlTemplateDefinition,ToggleButtonTemplate:ControlTemplateDefinition;
export function AccentButton(props?:ViewProps):View;
export function SubtleButton(props?:ViewProps):View;
export function DestructiveButton(props?:ViewProps):View;
export function ToggleSwitch(props?:ViewProps):View;
export function TemplatedToggleButton(props?:ViewProps):View;
export function templateAction(target:string,group:string,state:string):GPUAction;
export function themeAction(theme:string,variant?:'dark'|'light'):GPUAction;
export interface TemplateManifest {owner:number;pointer:number;name:string;root:number;parts:number[];names:Record<string,number>;groups:{name:string;states:string[]}[];nesting:number;targetType:string;native:number;content:number;planPointer:number;planCount:number;}
export interface TemplateSystemManifest {pointer:number;resourceStride?:8;resourceCount?:number;themeContrast?:'standard'|'high';controlDensity?:'comfortable'|'compact';accentColor?:number|null;themes:{name:string;displayName:string}[];theme:number;variant:number;rankPointer:number;reversePointer:number;}
export class TemplateController {
 constructor(surface:HelionSurface,name:string|number);readonly surface:HelionSurface;readonly id:number;readonly meta:TemplateManifest;
 readonly parts:Record<string,number>;findName(name:string):number;
 goToState(group:string,state:string):this;automatic(group:string):this;
 setPart(name:string,property:MutableProperty,value:number):this;clearPartValue(name:string,property:MutableProperty):this;
}
export const VisualStateManager:Readonly<{GoToState(surface:HelionSurface,owner:string|number,group:string,state:string):boolean}>;

export function themePreferenceAction(option:'contrast',value:'standard'|'high'):GPUAction;
export function themePreferenceAction(option:'density',value:'comfortable'|'compact'):GPUAction;
export function themePreferenceAction(option:'accent',value:Color|null):GPUAction;
export function themePreferenceAction(option:'reducedMotion',value:boolean):GPUAction;
export function normalizeThemeSettings(options?:ThemeSettings):Required<ThemeSettings>;
export function resolveThemePalette(theme:ControlTheme,variant?:'dark'|'light',options?:ThemeSettings):Record<string,Color>;
export function themeAccentColors(color:Color):Record<'accent'|'accentText'|'accentHover'|'accentPressed'|'accentStroke',number>;
