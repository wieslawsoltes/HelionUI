import {h,compile,HelionSurface,TemplateBinding,ThemeResource,ControlTemplate,ButtonTemplate,VisualStateGroup,VisualState,WinUIFluentTheme,MacOS26Theme,themeAction,ToggleSwitch,TemplatedToggleButton,VisualStateManager} from '../src/index.js';
import {DesignerController,DesignDocument,designerAction} from '../src/designer/index.js';
const template=ControlTemplate('Button',h('Border',{Name:'Chrome',Background:TemplateBinding('Background'),CornerRadius:ThemeResource('radius'),IsEnabled:TemplateBinding('isEnabled')},h('ContentPresenter',{Name:'Content',Content:TemplateBinding('Content')})),{name:'Primary',visualStateGroups:[VisualStateGroup('Common',[VisualState('Normal',{'Chrome':{Opacity:1}},{when:{pressed:false}}),VisualState('Pressed',{'Chrome':{Opacity:.8}},{when:{pressed:true}})])]});
const view=h('StackPanel',{themes:[WinUIFluentTheme,MacOS26Theme],theme:'macos26',themeVariant:'light'},h('Button',{Name:'button',Template:template,Content:'Hello'}),ToggleSwitch({text:'Toggle'}),TemplatedToggleButton({text:'Pinned'}),h('Button',{action:themeAction('fluent','light')}));
const prepared=compile(view,{theme:'fluent',reducedMotion:false});
declare const surface:HelionSurface;
surface.template('button').goToState('Common','Pressed').automatic('Common').setPart('Chrome','opacity',.5).clearPartValue('Chrome','opacity');
const id:number=surface.template('button').findName('Chrome');
surface.setTheme('macos26','dark').setReducedMotion(true);VisualStateManager.GoToState(surface,'button','Common','Normal');
const project=DesignDocument({templates:[ButtonTemplate],templateCapacity:8,theme:'macos26',themeVariant:'dark',root:{type:'Canvas',props:{id:'root'},children:[{type:'Button',props:{id:'hello',text:'Hello',template:'Button',templateDefaults:true}}]}});
const designer=new DesignerController(surface,'design');designer.applyTemplate('Button',{defaults:true}).command('controlTheme',1,1);designerAction('design','template',1,1);
void id;void project;void prepared;

import {AccentButton,SubtleButton,DestructiveButton,themePreferenceAction,resolveThemePalette} from '../src/index.js';
const settingsDemo=h('Grid',{theme:'fluent',themeContrast:'high',controlDensity:'compact',accentColor:'#69d5a0'},AccentButton({text:'Apply'}),SubtleButton({text:'Skip'}),DestructiveButton({text:'Remove'}),h('Button',{template:false,action:themePreferenceAction('density','compact')}));
surface.setThemeContrast('high').setControlDensity('compact').setAccentColor('#8f80ff').setAccentColor(null);
designer.setThemeContrast('standard').setControlDensity('comfortable').setAccentColor('#3985e0').setReducedMotion(true).previewTemplateState('pressed');
const refinedProject=DesignDocument({templates:[ButtonTemplate],themeContrast:'high',controlDensity:'compact',accentColor:'#3985e0'});
void settingsDemo;void refinedProject;void resolveThemePalette(MacOS26Theme,'light',{themeContrast:'high'});
