import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { shaderProgram, shaderSource } from '../src/gpu/shader-library.js';
import { shaderLocation, formatShaderMessages, createCheckedShaderModule, ShaderCompilationError } from '../src/gpu/shader-diagnostics.js';

const parts = ['common','templates','designer','curve-coverage','unicode','shaping','shaping-bidi','paragraph','typography-ui','text','editor','models','docking','controls','presenter','layout','input','data-source','data','flatten','emit','designer-render','editor-render','strips','glyph-cache'];
const shaders = Object.fromEntries(await Promise.all(parts.map(async name => [name, await readFile(new URL(`../shaders/${name}.wgsl`, import.meta.url), 'utf8')])));
const constants = { MAX_PRIMITIVES: 16384, TILE_CAPACITY: 256 };
const program = shaderProgram(shaders, constants);

test('source mapping preserves the exact native WGSL text and section boundaries', () => {
  const oldAssembly = Object.entries({VIEW_FEATURES:7,...constants}).map(([k,v]) => `const ${k}: u32 = ${v}u;`).join('\n') + '\n' + parts.map(p => shaders[p]).join('\n');
  assert.equal(program.code, oldAssembly);
  assert.equal(shaderSource(shaders, constants), program.code);
  for (const section of program.sections.slice(1)) {
    assert.deepEqual(shaderLocation(program, section.startLine, 5), { file: section.name, line: 1, column: 5, generatedLine: section.startLine });
    const text = shaders[section.name.slice(8, -5)];
    assert.equal(program.code.split('\n').slice(section.startLine - 1, section.endLine).join('\n'), text);
  }
});

test('source mapping includes constants and rejects missing shader parts', () => {
  assert.equal(shaderLocation(program, 1, 1).file, '<generated constants>');
  assert.throws(() => shaderProgram({ ...shaders, data: undefined }), /Missing WGSL source: data/);
});

test('DataGrid comparator explicitly groups relational select arguments (reported line-642 regression)', () => {
  assert.match(shaders.data, /return select\(\(compare < 0i\), \(compare > 0i\), heap\[t\+12u\] != 0u\);/);
  assert.doesNotMatch(shaders.data, /select\(\s*compare\s*<\s*0i?\s*,\s*compare\s*>/);
});

test('native error diagnostics identify the original comparator source and caret', () => {
  const line = program.code.split('\n').findIndex(s => s.includes('return select((compare')) + 1;
  const location = shaderLocation(program, line, 16);
  const localLine = shaders.data.split('\n').findIndex(s => s.includes('return select((compare')) + 1;
  assert.equal(location.file, 'shaders/data.wgsl');
  assert.equal(location.line, localLine);
  const formatted = formatShaderMessages(program, [{ type: 'error', lineNum: line, linePos: 16, message: 'test compiler diagnostic' }]);
  assert.ok(formatted.startsWith(`shaders/data.wgsl:${localLine}:16:`));
  assert.match(formatted, /return select\(\(compare/);
  assert.ok(formatted.endsWith(' '.repeat(15) + '^'));
});

test('diagnostics without a source position retain their native message', () => {
  assert.equal(formatShaderMessages(program, [{ message: 'No position supplied' }]), '<generated WGSL>:0:0: No position supplied');
});

test('presentation shader diagnostics retain their own file and line', () => {
  const p = { code: 'first\nsecond\n', sections: [{ name: 'shaders/present.wgsl', startLine: 1, endLine: 3 }] };
  assert.match(formatShaderMessages(p, [{ lineNum: 2, linePos: 1, message: 'invalid' }]), /^shaders\/present.wgsl:2:1: invalid\nsecond\n\^$/);
});

function fakeDevice({ messages = [], validationError = null, createFailure, infoFailure } = {}) {
  const calls = [];
  const module = { async getCompilationInfo() { calls.push('info'); if (infoFailure) throw infoFailure; return { messages }; } };
  return {
    calls, module,
    pushErrorScope(type) { calls.push(`push:${type}`); },
    createShaderModule(descriptor) { calls.push('create'); assert.equal(descriptor.code, program.code); if (createFailure) throw createFailure; return module; },
    async popErrorScope() { calls.push('pop'); return validationError; }
  };
}

test('checked-module success returns the native module, allowing warnings', async () => {
  const device = fakeDevice({ messages: [{ type: 'warning', message: 'warning' }] });
  assert.equal(await createCheckedShaderModule(device, program, 'test shader'), device.module);
  assert.deepEqual(device.calls, ['push:validation', 'create', 'info', 'pop']);
});

test('checked-module failure prioritizes detailed compilation info over generic validation text', async () => {
  const section = program.sections.find(s => s.name === 'shaders/data.wgsl');
  const device = fakeDevice({ messages: [{ type: 'error', message: 'parser rejected source', lineNum: section.startLine, linePos: 1 }], validationError: { message: 'generic GPUValidationError' } });
  await assert.rejects(() => createCheckedShaderModule(device, program, 'test shader'), error => {
    assert.ok(error instanceof ShaderCompilationError);
    assert.match(error.message, /shaders\/data.wgsl:1:1: parser rejected source/);
    assert.doesNotMatch(error.message, /generic GPUValidationError/);
    assert.equal(error.diagnostics[0].file, 'shaders/data.wgsl');
    return true;
  });
  assert.equal(device.calls.at(-1), 'pop');
});

test('a captured native validation error is never treated as successful compilation', async () => {
  const device = fakeDevice({ validationError: { message: 'validation rejected the module' } });
  await assert.rejects(() => createCheckedShaderModule(device, program, 'test shader'), /validation rejected the module/);
});

test('empty captured validation messages still produce an actionable error', async () => {
  const device = fakeDevice({ validationError: { message: '' } });
  await assert.rejects(() => createCheckedShaderModule(device, program, 'test shader'), /implementation rejected this shader module/);
});

test('native module creation exceptions cannot leak the error scope', async () => {
  const failure = new Error('module API failure');
  const device = fakeDevice({ createFailure: failure });
  await assert.rejects(() => createCheckedShaderModule(device, program, 'test shader'), error => error === failure);
  assert.deepEqual(device.calls, ['push:validation', 'create', 'pop']);
});

test('native compilation-info rejections cannot leak the error scope', async () => {
  const failure = new Error('compilation info failure');
  const device = fakeDevice({ infoFailure: failure });
  await assert.rejects(() => createCheckedShaderModule(device, program, 'test shader'), error => error === failure);
  assert.deepEqual(device.calls, ['push:validation', 'create', 'info', 'pop']);
});
