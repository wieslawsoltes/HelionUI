import {shaderDeclarations} from './shader-partitions.js';
const parts = ['common','templates','designer', 'curve-coverage', 'unicode','shaping','shaping-bidi','paragraph','typography-ui','text', 'editor', 'models', 'docking', 'controls', 'presenter', 'layout', 'input', 'data-source', 'data', 'flatten', 'emit','designer-render', 'editor-render', 'strips', 'glyph-cache'];
let shaderLoad;
export async function loadShaders() {
  if (globalThis.__HELION_SHADERS__) return globalThis.__HELION_SHADERS__;
  if (shaderLoad) return shaderLoad;
  shaderLoad = (async () => {
  const entries = await Promise.all([...parts, 'present', 'metrics', 'hud-common', 'hud-viewport', 'hud', 'blit'].map(async name => {
    const url = new URL(`../../shaders/${name}.wgsl`, import.meta.url);
    const response = await fetch(url); if (!response.ok) throw new Error(`Shader ${name}: HTTP ${response.status}`);
    return [name, await response.text()];
  }));
  return Object.fromEntries(entries);
  })();
  try { return await shaderLoad; } catch (error) { shaderLoad = null; throw error; }
}
/** Assemble the unchanged WGSL text with source ranges for native diagnostics. */
export function shaderProgram(shaders, constants = {}) {
  const prefix = Object.entries({VIEW_FEATURES:7,...constants}).map(([k, v]) => `const ${k}: u32 = ${v}u;`).join('\n') + '\n';
  let code = prefix, nextLine = prefix.split('\n').length;
  const sections = [{ name: '<generated constants>', startLine: 1, endLine: prefix.split('\n').length - 1 }];
  for (const [index, name] of parts.entries()) {
    const text = shaders[name];
    if (typeof text !== 'string') throw new TypeError(`Missing WGSL source: ${name}`);
    const startLine = nextLine;
    sections.push({ name: `shaders/${name}.wgsl`, startLine, endLine: startLine + text.split('\n').length - 1 });
    code += text + (index + 1 < parts.length ? '\n' : '');
    nextLine += text.split('\n').length;
  }
  return { code, sections };
}
export function shaderSource(shaders, constants = {}) { return shaderProgram(shaders, constants).code; }
/** Static call-graph resource discovery for this controlled WGSL source set. No source evaluation. */
const resourceNames = ['frame', 'nodes', 'state', 'heap', 'draws', 'scratch', 'indirect', 'commands', 'targetImage', 'stage', 'previousDraws', 'glyphCache', 'previewImage', 'relay'];
const resourceBits = new Map(resourceNames.map((name, binding) => [name, 1 << binding]));
const resourcePattern = new RegExp(`\\b(?:${resourceNames.join('|')})\\b`, 'g');
let analyzedSource, analyzedFunctions, analyzedEntries;
export function resourcesForEntry(source, entry) {
  if (source !== analyzedSource) {
    const functions = new Map();
    for (const [name, item] of shaderDeclarations(source).functions) {
      let direct = 0;
      for (const resource of item.body.match(resourcePattern) ?? []) direct |= resourceBits.get(resource);
      functions.set(name, {direct, calls:[...new Set(item.calls)], mask:null});
    }
    analyzedSource = source; analyzedFunctions = functions; analyzedEntries = new Map();
  }
  if (analyzedEntries.has(entry)) return analyzedEntries.get(entry);
  const functions = analyzedFunctions;
  if (!functions.has(entry)) throw new ReferenceError(`Shader entry not found: ${entry}`);
  // Each shared helper is analyzed once, not once per entry and call path.
  // Fourteen ABI bindings fit in a bit mask; no concatenated shader-body copies.
  const active = new Set();
  const walk = name => {
    const f = functions.get(name); if (f.mask !== null) return f.mask;
    if (active.has(name)) throw new SyntaxError(`Recursive WGSL function ${name}`);
    active.add(name); let mask = f.direct;
    for (const call of f.calls) if (functions.has(call)) mask |= walk(call);
    active.delete(name); f.mask = mask; return mask;
  };
  const mask = walk(entry);
  const result = resourceNames.flatMap((name, binding) => mask & (1 << binding) ? [Object.freeze({name, binding})] : []);
  analyzedEntries.set(entry, Object.freeze(result)); return result;
}

export const kernels = ['prepareTextInput','shapeTextRuns','layoutTextRuns',
  'resolveTemplateLayout','resolveTemplateVisuals','rankTemplateTree','synchronizeDesigners','animateDesigners','preparePresenterFrame','layoutLists','emitListParts','analyzeEditors','layoutEditors','emitEditorParts','pullModels','evaluateModels','pushModels', 'clearFrame', 'hitTest', 'input', 'applyCoreKey', 'applyInputActions', 'applyDockInput', 'applyEditorInput', 'applyDesignerInput', 'applyEditorCommands', 'applyDesignerCommands0', 'applyDesignerCommands1', 'applyDesignerCommands2', 'applyDesignerCommands3', 'applyDesignerCommands4', 'applyDesignerCommands5', 'applyDesignerCommands6', 'finishDesignerEdit', 'applyDesignerSurfaceInput', 'applyDesignerTreeInput', 'applyDesignerInspectorInput', 'applyDesignerTimelineInput', 'applyDesignerColorInput', 'schedule', 'resolveStyles', 'measure', 'constraints', 'arrange', 'animate', 'compose', 'initializeData', 'filterScan', 'scanBlocks', 'scatterRows', 'sortBlocks', 'mergeRows', 'resolveSelection', 'flatten', 'emit', 'emitTextBlock','emitButton','emitCheckBox','emitTextBox','emitDrawingNode','emitDockNode', 'emitDesignerSurface', 'emitDesignerTree', 'emitDesignerInspector','emitDesignerResources','emitDesignerStates','emitDesignerTracks', 'emitDesignerTimeline', 'emitDesignerColors', 'emitDesignerAdorner', 'emitGridParts', 'damage', 'collectGlyphRequests', 'prepareGlyphCache', 'finishGlyphRequests', 'rasterGlyphCache', 'prepareDraws', 'buildJobs', 'prepareJobs', 'makeStrips', 'prepareStrips', 'binStrips', 'composite', 'finishWork', 'finishFrame'];

/** Shared diagnostic geometry/font helpers, with original-file error ranges. */
export function diagnosticProgram(shaders, name) {
  if (!['present', 'hud', 'blit'].includes(name)) throw new TypeError(`Unknown diagnostic module: ${name}`);
  let code = '', line = 1; const sections = [];
  for (const part of (name === 'blit' ? ['hud-viewport', name] : ['curve-coverage', 'hud-viewport', 'hud-common', name])) {
    const text = shaders[part];
    if (typeof text !== 'string') throw new TypeError(`Missing diagnostic shader source: ${part}`);
    const count = text.split('\n').length;
    sections.push({name:`shaders/${part}.wgsl`,startLine:line,endLine:line+count-1});
    code += text + (part === name ? '' : '\n'); line += count;
  }
  return {code, sections};
}
