import type {ControlTemplateDefinition} from '../templates/index.js';
import type {DesignProject,DesignSnapshot} from './index.js';
export interface TemplateEditSession {project:DesignProject;definition:ControlTemplateDefinition;originalParts:string[];baseline?:DesignSnapshot;}
export function templateToDesignProject(template:ControlTemplateDefinition,options?:{theme?:string;themeVariant?:'light'|'dark';themeContrast?:'standard'|'high';controlDensity?:'comfortable'|'compact';accentColor?:import('../index.js').Color|null}):TemplateEditSession;
export function designProjectToTemplate(session:TemplateEditSession,editedSnapshot:DesignSnapshot):ControlTemplateDefinition;
