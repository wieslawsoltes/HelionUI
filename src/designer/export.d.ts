import type {DesignProject} from './index.js';
export const DESIGN_PROJECT_MARKER:'__HELION_PROJECT_JSON__';
/** Embeds project JSON as data, not executable source; fonts remain runtime assets. */
export function makeDesignAppHTML(template:string,project:DesignProject):string;
