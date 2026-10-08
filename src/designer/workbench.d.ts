import type {View,FontSource} from '../index.js';
import type {DesignProject} from './index.js';
export const DESIGNER_FONT_SOURCES:ReadonlyArray<FontSource>;
export const DESIGNER_PANES:ReadonlyArray<string>;
export const DESIGNER_THEME:string;
export const DESIGNER_GUIDE:string;
export function createDesignerWorkbench(project?:DesignProject,options?:{examples?:DesignProject[]}):View;
