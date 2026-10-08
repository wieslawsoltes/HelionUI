import {ControlTemplate,TemplateBinding as B,ThemeResource as R} from './definitions.js';
const node=(type,props={},...children)=>({type,props,children:children.flat()});
const group=(name,states)=>({name,states});
const state=(name,when,setters={},duration=.12)=>({name,when,setters,duration,easing:'smooth'});
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
// A separate, inset overlay never changes content padding or border measurement.
const ring=(props={})=>node('Border',{id:'FocusRing',margin:2,radius:R('radius'),background:'transparent',borderColor:R('focus'),borderWidth:2,opacity:0,...props});
const focus=()=>group('FocusStates',[state('Unfocused',{},{}),state('Focused',{focus:true,disabled:false},{FocusRing:{opacity:1}},.08)]);
function buttonTemplate(name='Button',tone='standard'){
 const tokens=tone==='accent'?['accent','accentHover','accentPressed','accentText']:tone==='destructive'?['danger','dangerHover','dangerPressed','dangerText']:tone==='subtle'?['subtle','subtleHover','subtlePressed','text']:['control','controlHover','controlPressed','text'];
 return ControlTemplate('Button',node('Grid',{id:'Layout'},
  node('Border',{id:'Chrome',background:B('background'),borderColor:B('borderColor'),borderWidth:B('borderWidth'),radius:B('radius'),padding:B('padding')},
   node('ContentPresenter',{id:'Content',foreground:B('foreground'),fontSize:B('fontSize'),horizontalAlignment:'center',verticalAlignment:'center'})),ring({radius:B('radius')})),{
  name,defaults:{background:R(tokens[0]),foreground:R(tokens[3]),borderColor:R(tone==='standard'?'stroke':tone==='subtle'?'subtle':tone==='destructive'?'danger':'accentStroke'),borderWidth:1,radius:R('radius'),padding:R('controlPadding'),minHeight:R('controlHeight')},
  visualStateGroups:[group('CommonStates',[
   state('Normal',{},{}),state('PointerOver',{pointerover:true,disabled:false},{Chrome:{background:R(tokens[1])}}),
   state('Pressed',{pressed:true,disabled:false},{Chrome:{background:R(tokens[2])}},.08),
   state('Disabled',{disabled:true},{Chrome:{background:R('disabledSurface'),borderColor:R('disabledStroke')},Content:{foreground:R('disabledText')}},.08)
  ]),focus()]
 });
}
export const ButtonTemplate=freeze(buttonTemplate());
export const AccentButtonTemplate=freeze(buttonTemplate('AccentButton','accent'));
export const SubtleButtonTemplate=freeze(buttonTemplate('SubtleButton','subtle'));
export const DestructiveButtonTemplate=freeze(buttonTemplate('DestructiveButton','destructive'));
export const CheckBoxTemplate=freeze(ControlTemplate('CheckBox',node('Grid',{id:'Layout',columns:'22 *',gap:9},
 node('Border',{id:'Box',width:20,height:20,verticalAlignment:'center',radius:R('checkRadius'),background:R('field'),borderColor:R('stroke'),borderWidth:1}),
 node('Path',{id:'Check',width:14,height:14,margin:3,verticalAlignment:'center',path:'M 1 7 L 5 11 L 13 2',stroke:2,viewBox:[0,0,14,14],foreground:R('accentText'),opacity:0}),
 node('ContentPresenter',{id:'Content',column:1,verticalAlignment:'center',foreground:B('foreground'),fontSize:B('fontSize')}),
 ring({width:22,height:22,margin:0,verticalAlignment:'center',radius:R('checkRadius')})),{
 name:'CheckBox',defaults:{foreground:R('text'),minHeight:R('selectionHeight')},visualStateGroups:[
 group('CheckStates',[state('Unchecked',{},{}),state('Checked',{checked:true},{Box:{background:R('accent'),borderColor:R('accent')},Check:{opacity:1}})]),
 group('CommonStates',[state('Normal',{},{}),state('PointerOver',{pointerover:true,disabled:false},{Box:{borderColor:R('focus')}},.08),state('Pressed',{pressed:true,disabled:false},{Box:{borderColor:R('focus'),borderWidth:2}},.08),state('Disabled',{disabled:true},{Box:{background:R('disabledSurface'),borderColor:R('disabledStroke')},Content:{foreground:R('disabledText')},Check:{foreground:R('disabledText')}},.08)]),focus()]
}));
export const SliderTemplate=freeze(ControlTemplate('Slider',node('Grid',{id:'Layout',margin:[8,0]},
 node('Border',{id:'Track',height:4,verticalAlignment:'center',radius:2,background:R('track')}),
 node('Border',{id:'Fill',height:4,verticalAlignment:'center',radius:2,background:R('accent'),scaleX:B('value',{min:0,max:1}),renderTransformOrigin:[0,.5]}),
 node('Border',{id:'Thumb',width:16,height:16,horizontalAlignment:'start',verticalAlignment:'center',margin:[-8,0,0,0],radius:8,background:R('thumb'),borderColor:R('accent'),borderWidth:3,translateX:B('value',{min:0,max:1,relativeTo:'actualWidth',relativeOffset:-16})}),
 ring({width:22,height:22,horizontalAlignment:'start',verticalAlignment:'center',margin:[-11,0,0,0],radius:11,translateX:B('value',{min:0,max:1,relativeTo:'actualWidth',relativeOffset:-16})})),{
 name:'Slider',defaults:{height:32,minWidth:120},visualStateGroups:[group('CommonStates',[state('Normal',{},{}),state('PointerOver',{pointerover:true,disabled:false},{Thumb:{borderWidth:4}},.08),state('Pressed',{pressed:true,disabled:false},{Thumb:{borderWidth:5}},.08),state('Disabled',{disabled:true},{Track:{background:R('disabledStroke')},Fill:{background:R('disabledText')},Thumb:{borderColor:R('disabledStroke'),background:R('disabledSurface')}},.08)]),focus()]
}));
export const TextBoxTemplate=freeze(ControlTemplate('TextBox',node('Grid',{id:'Layout'},
 node('Border',{id:'Chrome',background:B('background'),borderColor:B('borderColor'),borderWidth:B('borderWidth'),radius:B('radius')},node('NativeContentPresenter',{id:'PART_ContentHost',foreground:B('foreground'),fontSize:B('fontSize')})),ring({radius:B('radius')})),{
 name:'TextBox',defaults:{background:R('field'),foreground:R('text'),borderColor:R('stroke'),borderWidth:1,radius:R('radius'),minHeight:R('fieldHeight')},visualStateGroups:[group('CommonStates',[state('Normal',{},{}),state('PointerOver',{pointerover:true,disabled:false},{Chrome:{background:R('fieldHover'),borderColor:R('focus')}},.1),state('Disabled',{disabled:true},{Chrome:{background:R('disabledSurface'),borderColor:R('disabledStroke')},PART_ContentHost:{foreground:R('disabledText')}},.08)]),focus()]
}));
export const ProgressBarTemplate=freeze(ControlTemplate('ProgressBar',node('Grid',{id:'Layout'},node('Border',{id:'Track',background:R('track'),radius:4}),node('Border',{id:'Indicator',background:B('foreground'),radius:4,scaleX:B('value',{min:0,max:1}),renderTransformOrigin:[0,.5]})),{name:'ProgressBar',defaults:{height:6,minWidth:80,foreground:R('accent')}}));
export const ToggleSwitchTemplate=freeze(ControlTemplate('CheckBox',node('Grid',{id:'Layout',columns:'42 *',gap:10},
 node('Border',{id:'Track',width:40,height:22,verticalAlignment:'center',radius:11,background:R('track'),borderColor:R('stroke'),borderWidth:1}),
 node('Border',{id:'Thumb',width:16,height:16,horizontalAlignment:'start',verticalAlignment:'center',margin:[3,0,0,0],background:R('thumb'),radius:8}),
 node('ContentPresenter',{id:'Content',column:1,verticalAlignment:'center',foreground:B('foreground'),fontSize:B('fontSize')}),
 ring({width:42,height:24,margin:0,verticalAlignment:'center',radius:12})),{
 name:'ToggleSwitch',defaults:{foreground:R('text'),minHeight:R('selectionHeight')},visualStateGroups:[group('CheckStates',[state('Off',{},{}),state('On',{checked:true},{Thumb:{translateX:18},Track:{background:R('accent'),borderColor:R('accent')}},.16)]),group('CommonStates',[state('Normal',{},{}),state('PointerOver',{pointerover:true,disabled:false},{Track:{borderColor:R('focus'),borderWidth:2}},.08),state('Disabled',{disabled:true},{Track:{background:R('disabledStroke'),borderColor:R('disabledStroke')},Thumb:{background:R('disabledText')},Content:{foreground:R('disabledText')}},.08)]),focus()]
}));
export const ContentControlTemplate=freeze(ControlTemplate('ContentControl',node('Border',{id:'Chrome',background:B('background'),radius:B('radius'),padding:B('padding'),borderColor:B('borderColor'),borderWidth:B('borderWidth')},node('ContentPresenter',{id:'Content',foreground:B('foreground'),fontSize:B('fontSize')})),{name:'ContentControl',defaults:{foreground:R('text'),background:R('surface'),radius:R('panelRadius'),padding:R('panelPadding')}}));
export const ToggleButtonTemplate=freeze(ControlTemplate('CheckBox',ButtonTemplate.root,{...ButtonTemplate,name:'ToggleButton',visualStateGroups:[
 group('CheckStates',[state('Unchecked',{},{}),state('Checked',{checked:true,disabled:false},{Chrome:{background:R('accent'),borderColor:R('accent')},Content:{foreground:R('accentText')}}),state('CheckedPointerOver',{checked:true,pointerover:true,disabled:false},{Chrome:{background:R('accentHover'),borderColor:R('accentHover')},Content:{foreground:R('accentText')}}),state('CheckedPressed',{checked:true,pressed:true,disabled:false},{Chrome:{background:R('accentPressed'),borderColor:R('accentPressed')},Content:{foreground:R('accentText')}},.08)]),
 group('CommonStates',[state('Normal',{},{}),state('PointerOver',{pointerover:true,checked:false,disabled:false},{Chrome:{background:R('controlHover')}}),state('Pressed',{pressed:true,checked:false,disabled:false},{Chrome:{background:R('controlPressed')}},.08),state('Disabled',{disabled:true},{Chrome:{background:R('disabledSurface'),borderColor:R('disabledStroke')},Content:{foreground:R('disabledText')}},.08)]),focus()]
}));
export const BUILTIN_CONTROL_TEMPLATES=freeze({Button:ButtonTemplate,CheckBox:CheckBoxTemplate,Slider:SliderTemplate,TextBox:TextBoxTemplate,ProgressBar:ProgressBarTemplate,ContentControl:ContentControlTemplate});
const metrics={radius:4,panelRadius:8,checkRadius:4,controlHeight:36,fieldHeight:38,selectionHeight:32,controlPadding:12,panelPadding:14};
const fluentDark={...metrics,canvas:'#202020',surface:'#272727',control:'#333333',controlHover:'#3b3b3b',controlPressed:'#292929',field:'#1d1d1d',fieldHover:'#252525',stroke:'#8a8a8a',text:'#ffffff',muted:'#c0c0c0',accent:'#60cdff',accentHover:'#82d8ff',accentPressed:'#49bce9',accentText:'#003547',accentStroke:'#00000000',track:'#777777',thumb:'#ffffff',focus:'#8bdbff',disabledSurface:'#292929',disabledStroke:'#626262',disabledText:'#a9a9a9',subtle:'#00000000',subtleHover:'#393939',subtlePressed:'#2b2b2b',danger:'#ffb4ab',dangerHover:'#ffc7c0',dangerPressed:'#eea299',dangerText:'#4b0006'};
const fluentLight={...metrics,canvas:'#f3f3f3',surface:'#ffffff',control:'#ffffff',controlHover:'#f5f5f5',controlPressed:'#ebebeb',field:'#ffffff',fieldHover:'#f9f9f9',stroke:'#777777',text:'#1b1b1b',muted:'#5d5d5d',accent:'#0067c0',accentHover:'#005bab',accentPressed:'#004d92',accentText:'#ffffff',accentStroke:'#00000000',track:'#797979',thumb:'#ffffff',focus:'#005a9e',disabledSurface:'#eeeeee',disabledStroke:'#b0b0b0',disabledText:'#666666',subtle:'#00000000',subtleHover:'#e4e4e4',subtlePressed:'#d6d6d6',danger:'#b42318',dangerHover:'#981d14',dangerPressed:'#7b180f',dangerText:'#ffffff'};
const macDark={...fluentDark,radius:11,panelRadius:18,checkRadius:6,controlPadding:14,panelPadding:18,canvas:'#181b23',surface:'#272c37',control:'#3b414e',controlHover:'#485365',controlPressed:'#293546',field:'#20252e',fieldHover:'#29323f',stroke:'#8f9bac',text:'#f6f7fb',muted:'#b9c3d3',accent:'#72b7ff',accentHover:'#91c6ff',accentPressed:'#57a6fa',accentText:'#071c32',focus:'#a3d0ff',track:'#737d8c',subtleHover:'#363e4a',subtlePressed:'#2b333e',disabledSurface:'#252b34',disabledStroke:'#647080',disabledText:'#abb6c6'};
const macLight={...fluentLight,radius:11,panelRadius:18,checkRadius:6,controlPadding:14,panelPadding:18,canvas:'#eff2f7',surface:'#ffffff',control:'#ffffff',controlHover:'#f2f7ff',controlPressed:'#dbe7f7',field:'#ffffff',fieldHover:'#f8faff',stroke:'#738198',text:'#172333',muted:'#53647a',accent:'#0068d8',accentHover:'#0059ba',accentPressed:'#004b9c',accentText:'#ffffff',focus:'#0054b5',track:'#738198',subtleHover:'#dee8f6',subtlePressed:'#cbdcf1',disabledSurface:'#e6ebf2',disabledStroke:'#a1acbc',disabledText:'#59697e'};
const contrastDark={canvas:'#000000',surface:'#000000',control:'#000000',controlHover:'#202020',controlPressed:'#303030',field:'#000000',fieldHover:'#171717',stroke:'#ffffff',text:'#ffffff',muted:'#e0e0e0',accent:'#ffe66a',accentHover:'#fff0a0',accentPressed:'#edda60',accentText:'#000000',accentStroke:'#ffe66a',track:'#a0a0a0',thumb:'#ffffff',focus:'#00ffff',disabledSurface:'#141414',disabledStroke:'#a0a0a0',disabledText:'#d0d0d0',subtle:'#00000000',subtleHover:'#202020',subtlePressed:'#303030',danger:'#ffb4ab',dangerHover:'#ffcdc6',dangerPressed:'#f0a29a',dangerText:'#000000'};
const contrastLight={canvas:'#ffffff',surface:'#ffffff',control:'#ffffff',controlHover:'#f0f0f0',controlPressed:'#e0e0e0',field:'#ffffff',fieldHover:'#f0f0f0',stroke:'#000000',text:'#000000',muted:'#242424',accent:'#003399',accentHover:'#002877',accentPressed:'#001d55',accentText:'#ffffff',accentStroke:'#003399',track:'#555555',thumb:'#ffffff',focus:'#650065',disabledSurface:'#f1f1f1',disabledStroke:'#5b5b5b',disabledText:'#484848',subtle:'#00000000',subtleHover:'#f0f0f0',subtlePressed:'#e0e0e0',danger:'#850000',dangerHover:'#700000',dangerPressed:'#550000',dangerText:'#ffffff'};
const compact={controlHeight:28,fieldHeight:30,selectionHeight:28,controlPadding:8,panelPadding:10};
export const WinUIFluentTheme=freeze({kind:'controlTheme',name:'fluent',displayName:'Fluent',dark:fluentDark,light:fluentLight,contrastDark,contrastLight,compact,templates:BUILTIN_CONTROL_TEMPLATES});
export const MacOS26Theme=freeze({kind:'controlTheme',name:'macos26',displayName:'macOS 26 inspired',dark:macDark,light:macLight,contrastDark,contrastLight,compact:{...compact,controlPadding:10,panelPadding:12},templates:BUILTIN_CONTROL_TEMPLATES});
export const DEFAULT_CONTROL_THEMES=Object.freeze([WinUIFluentTheme,MacOS26Theme]);
export function ToggleSwitch(props={}){return node('CheckBox',{template:ToggleSwitchTemplate,...props});}
export function ToggleButton(props={}){return node('CheckBox',{template:ToggleButtonTemplate,...props});}
export function AccentButton(props={}){return node('Button',{template:AccentButtonTemplate,...props});}
export function SubtleButton(props={}){return node('Button',{template:SubtleButtonTemplate,...props});}
export function DestructiveButton(props={}){return node('Button',{template:DestructiveButtonTemplate,...props});}
