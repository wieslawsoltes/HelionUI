import {typographyShaderSource} from '../src/typography/gpu.js';
import {partitionShaderProgram} from '../src/gpu/shader-partitions.js';
import {shaderProgram} from '../src/gpu/shader-library.js';
import {checkLogicalGrouping,formatLogicalGroupingError} from './check-wgsl-logic.mjs';
import {checkFunctionGraph,checkFunctionCalls} from './check-wgsl-graph.mjs';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { kernels, resourcesForEntry, shaderSource, diagnosticProgram } from '../src/gpu/shader-library.js';
import { compile } from '../src/core/compiler.js';
import { createShowcase } from '../examples/showcase.js';
const root = fileURLToPath(new URL('..', import.meta.url));
const walk = async dir => (await Promise.all((await readdir(resolve(root, dir), { withFileTypes: true })).filter(e => !['dist', 'node_modules', '.git'].includes(e.name)).map(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]))).flat();
const all = await walk('.'), jsFiles = all.filter(f => /\.(m?js)$/.test(f));
let failures = [];
for (const file of jsFiles) {
  try { execFileSync(process.execPath, ['--check', resolve(root, file)], { stdio: 'pipe' }); }
  catch (error) { failures.push(`${file}: ${error.stderr}`); }
  const text = await readFile(resolve(root, file), 'utf8');
  for (const m of text.matchAll(/(?:\bfrom\s*|\bimport\s*)['"](\.[^'"]+)['"]/g)) {
    try { await readFile(resolve(root, dirname(file), m[1])); } catch { failures.push(`${file}: missing import ${m[1]}`); }
  }
}
const reserved = new Set(JSON.parse(await readFile(resolve(root, 'tests/reserved-words.json'), 'utf8')));
const shaders = {};
for (const file of all.filter(f => f.endsWith('.wgsl'))) {
  const name = file.split('/').pop().replace('.wgsl', ''); const code = await readFile(resolve(root, file), 'utf8'); shaders[name] = code;
  failures.push(...checkLogicalGrouping(code,file).map(formatLogicalGroupingError));
  const clean = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  for (const token of clean.match(/\b[A-Za-z_]\w*\b/g) || []) if (reserved.has(token)) failures.push(`${file}: reserved WGSL word ${token}`);
  if (/\.[xyzwrgba]{2,4}\s*[+*/-]?=(?!=)/.test(clean)) failures.push(`${file}: non-baseline swizzle assignment`);
  for (const m of clean.matchAll(/\b(?:let|var)\s+\w+\s*=([^;]*);/g)) {
    let depth = 0;
    for (const ch of m[1].replace(/^(\w+)<[^()]*>\s*\(/, '$1(')) { if (ch === '(' || ch === '[') depth++; if (ch === ')' || ch === ']') depth--; if (ch === ',' && !depth) failures.push(`${file}: comma declaration`); }
  }
  const pairs = { ')': '(', ']': '[', '}': '{' }, stack = [];
  for (const ch of clean) { if ('([{'.includes(ch)) stack.push(ch); else if (pairs[ch] && stack.pop() !== pairs[ch]) failures.push(`${file}: unbalanced ${ch}`); }
  if (stack.length) failures.push(`${file}: unmatched delimiters`);
}
const source = shaderSource(shaders, {});
failures.push(...checkFunctionGraph(source),...checkFunctionCalls(source));
for(const name of ['hud','present','blit']){const code=diagnosticProgram(shaders,name).code;failures.push(...checkFunctionGraph(code),...checkFunctionCalls(code));}
for (const entry of kernels) {
  const used = resourcesForEntry(source, entry), storage = used.filter(v => [1, 2, 3, 4, 5, 6, 7, 10, 11, 13].includes(v.binding));
  if (storage.length > 8) failures.push(`${entry}: exceeds baseline storage binding count`);
  if (['measure', 'constraints', 'arrange', 'filterScan', 'scanBlocks', 'scatterRows', 'sortBlocks', 'mergeRows', 'resolveSelection', 'buildJobs', 'makeStrips', 'binStrips', 'rasterGlyphCache'].includes(entry) && used.some(x => x.binding === 6)) failures.push(`${entry}: indirect argument/storage alias hazard`);
}
for(const part of partitionShaderProgram(shaderProgram(shaders,{}),kernels).values()){
 failures.push(...checkFunctionGraph(part.code),...checkFunctionCalls(part.code),...checkLogicalGrouping(part.code,part.name).map(formatLogicalGroupingError));
 for(const entry of part.entries)if(JSON.stringify(resourcesForEntry(part.code,entry))!==JSON.stringify(resourcesForEntry(source,entry)))failures.push(`${entry}: partition resource mismatch`);
}
globalThis.__HELION_SHADERS__=shaders;const typography=await typographyShaderSource();delete globalThis.__HELION_SHADERS__;failures.push(...checkFunctionGraph(typography),...checkFunctionCalls(typography),...checkLogicalGrouping(typography,'standalone typography').map(formatLogicalGroupingError));
const demo = compile(createShowcase());
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`Static checks passed: ${jsFiles.length} JS modules, ${Object.keys(shaders).length} WGSL sources, ${kernels.length} compute entries, ${demo.nodeCount} showcase nodes.\nThese checks are NOT native shader compilation or GPU execution. Run tests/gpu.html for those gates.`);
