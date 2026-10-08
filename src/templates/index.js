import {normalizeThemeSettings,resolveThemePalette,themeAccentColors} from './preferences.js';
export {normalizeThemeSettings,resolveThemePalette,themeAccentColors};
import {rgba,Opcode,Property} from '../core/schema.js';
import {TemplateCommand} from './schema.js';
import {ControlTemplate,TemplateBinding,ThemeResource,VisualState,VisualStateGroup,validateControlTemplate} from './definitions.js';
export {ControlTemplate,TemplateBinding,ThemeResource,VisualState,VisualStateGroup,validateControlTemplate};
import {WinUIFluentTheme,MacOS26Theme,DEFAULT_CONTROL_THEMES,BUILTIN_CONTROL_TEMPLATES,ButtonTemplate,AccentButtonTemplate,SubtleButtonTemplate,DestructiveButtonTemplate,ToggleButtonTemplate,AccentButton,SubtleButton,DestructiveButton,CheckBoxTemplate,TextBoxTemplate,SliderTemplate,ProgressBarTemplate,ContentControlTemplate,ToggleSwitchTemplate,ToggleSwitch,ToggleButton} from './themes.js';
export {AccentButtonTemplate,SubtleButtonTemplate,DestructiveButtonTemplate,ToggleButtonTemplate,AccentButton,SubtleButton,DestructiveButton,WinUIFluentTheme,MacOS26Theme,DEFAULT_CONTROL_THEMES,BUILTIN_CONTROL_TEMPLATES,ButtonTemplate,CheckBoxTemplate,TextBoxTemplate,SliderTemplate,ProgressBarTemplate,ContentControlTemplate,ToggleSwitchTemplate,ToggleSwitch};
export const TemplatedToggleButton=ToggleButton;
export {TemplateCommand};
export function templateAction(target,group,state){return {type:'template',target,group,state};}
export function themeAction(theme,variant='dark'){return {type:'template',theme,variant};}
export class TemplateController {
 constructor(surface,name){this.surface=surface;this.id=surface.id(name);this.meta=surface.manifest.templates?.find(t=>t.owner===this.id&&t.root!==0xffffffff);if(!this.meta)throw new TypeError('Control has no instantiated template');}
 findName(name){const id=this.meta.names[name];if(id==null)throw new ReferenceError(`Unknown template part ${name}`);return id;}
 get parts(){return {...this.meta.names};}
 goToState(group,state){let g=this.meta.groups.findIndex(g=>g.name===group);if(g<0)throw new ReferenceError(`Unknown state group ${group}`);const s=this.meta.groups[g].states.indexOf(state);if(s<0)throw new ReferenceError(`Unknown visual state ${state}`);this.surface.send(Opcode.Template,{target:this.id,c:TemplateCommand.state,a:g,b:s});return this;}
 automatic(group){const g=this.meta.groups.findIndex(g=>g.name===group);if(g<0)throw new ReferenceError(`Unknown state group ${group}`);this.surface.send(Opcode.Template,{target:this.id,c:TemplateCommand.automatic,a:g});return this;}
 clearPartValue(name,property){if(!(property in Property))throw new TypeError('Unknown scalar property');this.surface.send(Opcode.Template,{target:this.findName(name),c:4,a:Property[property]});return this;}
 setPart(name,property,value){if(!(property in Property))throw new TypeError('Use a supported runtime scalar property');this.surface.set(this.findName(name),property,value);return this;}
}
export const VisualStateManager=Object.freeze({GoToState(surface,owner,group,state){surface.template(owner).goToState(group,state);return true;}});

/** A retained GPU button can change a preference without a host action/readback. */
export function themePreferenceAction(option,value) {
 if(!['contrast','density','accent','reducedMotion'].includes(option))throw new TypeError('Unknown theme preference');
 if(option==='contrast'&&!['standard','high'].includes(value))throw new TypeError('Expected standard/high');
 if(option==='density'&&!['comfortable','compact'].includes(value))throw new TypeError('Expected comfortable/compact');
 if(option==='accent'&&value!=null&&(rgba(value)>>>24)!==255)throw new RangeError('Accent colors must be opaque');
 if(option==='reducedMotion'&&typeof value!=='boolean')throw new TypeError('Expected a boolean motion preference');
 return {type:'template',option,preferenceValue:value};
}
