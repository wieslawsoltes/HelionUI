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
let analyzedSource, analyzedFunctions, analyzedEntries;
export function resourcesForEntry(source, entry) {
  if (source !== analyzedSource) {
  const functions = new Map(); const rx = /\bfn\s+(\w+)\s*\(/g; let match;
  // Ignore comments so resource names in prose do not create accidental storage usages.
  const clean = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  while ((match = rx.exec(clean))) {
    const start = clean.indexOf('{', rx.lastIndex); if (start < 0) throw new SyntaxError('Missing function body');
    let depth = 1, end = start + 1;
    for (; end < clean.length && depth; end++) { if (clean[end] === '{') depth++; else if (clean[end] === '}') depth--; }
    if (depth) throw new SyntaxError('Unbalanced WGSL function'); functions.set(match[1], clean.slice(start, end)); rx.lastIndex = end;
  }
  analyzedSource = source; analyzedFunctions = functions; analyzedEntries = new Map();
  }
  if (analyzedEntries.has(entry)) return analyzedEntries.get(entry);
  const functions = analyzedFunctions;
  if (!functions.has(entry)) throw new ReferenceError(`Shader entry not found: ${entry}`);
  const visited = new Set(); let used = '';
  const walk = name => { if (visited.has(name)) return; visited.add(name); const body = functions.get(name); used += body;
    for (const call of body.matchAll(/\b(\w+)\s*\(/g)) if (functions.has(call[1])) walk(call[1]);
  };
  walk(entry);
  const result = ['frame', 'nodes', 'state', 'heap', 'draws', 'scratch', 'indirect', 'commands', 'targetImage', 'stage', 'previousDraws', 'glyphCache', 'previewImage', 'relay']
    .flatMap((name, binding) => new RegExp(`\\b${name}\\b`).test(used) ? [Object.freeze({ name, binding })] : []);
  analyzedEntries.set(entry, Object.freeze(result)); return result;
}
export const kernels = ['shapeTextRuns','layoutTextRuns',
  'resolveTemplateLayout','resolveTemplateVisuals','rankTemplateTree','synchronizeDesigners','animateDesigners','preparePresenterFrame','layoutLists','emitListParts','analyzeEditors','layoutEditors','emitEditorParts','pullModels','evaluateModels','pushModels', 'clearFrame', 'hitTest', 'input', 'schedule', 'resolveStyles', 'measure', 'constraints', 'arrange', 'animate', 'compose', 'initializeData', 'filterScan', 'scanBlocks', 'scatterRows', 'sortBlocks', 'mergeRows', 'resolveSelection', 'flatten', 'emit', 'emitGridParts', 'damage', 'collectGlyphRequests', 'prepareGlyphCache', 'finishGlyphRequests', 'rasterGlyphCache', 'prepareDraws', 'buildJobs', 'prepareJobs', 'makeStrips', 'prepareStrips', 'binStrips', 'composite', 'finishWork', 'finishFrame'];

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
