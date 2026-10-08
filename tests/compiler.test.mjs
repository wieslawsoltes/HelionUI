import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, h, fromHTML, HeapBuilder } from '../src/core/compiler.js';
import { Kind, Flags, NODE_WORDS, AUTO_TARGET, fromBits, tracks, rgba } from '../src/core/schema.js';
import { parsePath, pathBounds } from '../src/render/paths.js';
import { vectorAlphabet } from '../src/render/vector-alphabet.js';
import { createShowcase } from '../examples/showcase.js';

const empty = () => h('Grid', {});
const u32 = c => new Uint32Array(c.nodes.buffer), f32 = c => new Float32Array(c.nodes.buffer);

test('declarative tree packs a preorder, 288-byte node ABI and forward references', () => {
  const c = compile(h('Grid', { columns: '* *' }, h('Button', { id: 'go', action: { type: 'toggle', target: 'later' } }), h('CheckBox', { id: 'later', column: 1, value: 1 })));
  assert.equal(c.nodes.byteLength, 3 * 288); assert.equal(c.ids.get('later'), 2); assert.equal(u32(c)[NODE_WORDS + 37], 2);
  assert.equal(u32(c)[1], AUTO_TARGET); assert.equal(u32(c)[NODE_WORDS + 1], 0);
  assert.deepEqual([...c.heap.slice(u32(c)[2], u32(c)[2] + 2)], [1, 2]);
});
test('size, margin, flags and responsive bounds pack correctly', () => {
  const c = compile(h('Border', { width: 123, padding: 7, margin: [2, 3], wrap: true, hidden: true, minViewportWidth: 900 }));
  assert.equal(f32(c)[8], 123); assert.equal(f32(c)[14], 7); assert.deepEqual([...f32(c).slice(16, 20)], [2, 3, 2, 3]);
  assert.ok(u32(c)[5] & Flags.wrap); assert.ok(u32(c)[5] & Flags.hidden); assert.equal(fromBits(u32(c)[69]), 900);
});
test('grid accepts pixel, Auto and weighted star tracks', () => {
  assert.deepEqual(tracks('100 auto * 2*'), [[0, 100], [1, 0], [2, 1], [2, 2]]);
  const c = compile(h('Grid', { columns: '100 auto * 2*' })); const at = u32(c)[28];
  assert.equal(c.heap[at + 12], 2); assert.equal(fromBits(c.heap[at + 13]), 2);
});
test('text buffers encode code points, not UTF-16 surrogate halves', () => {
  const c = compile(h('TextBox', { text: 'A😀é' })); const at = u32(c)[6];
  assert.deepEqual([...c.heap.slice(at, at + 3)], [65, 0x1f600, 233]); assert.equal(c.state[68], 3);
});
test('TextBox storage is mutable and never interned with another editor', () => {
  const c = compile(h('StackPanel', {}, h('TextBox', { text: 'same' }), h('TextBox', { text: 'same' })));
  assert.notEqual(u32(c)[72 + 6], u32(c)[144 + 6]);
});
test('immutable strings are interned', () => { const heap = new HeapBuilder(); assert.equal(heap.string('hello')[0], heap.string('hello')[0]); });
test('heap capacity refuses overflow before allocation', () => { const heap = new HeapBuilder(8); heap.alloc(4); assert.throws(() => heap.alloc(1), RangeError); });
test('path curves are retained unflattened at the CPU boundary', () => {
  const c = compile(h('Path', { path: 'M0 0 Q5 10 10 0 C10 2 20 5 20 0', stroke: 1 }));
  const at = u32(c)[68]; assert.equal(c.heap[at + 1], 2); assert.equal(c.heap[at + 3], 64); assert.equal(c.heap[at + 4], 0);
  assert.equal(c.heap[c.heap[at]], 1); assert.equal(c.heap[c.heap[at] + 12], 2);
});
test('relative path coordinates and closure', () => {
  assert.deepEqual(parsePath('M 2 3 l 4 0 v 5 h -4 z'), [[0, 2, 3, 6, 3, 0, 0, 0, 0], [0, 6, 3, 6, 8, 0, 0, 0, 0], [0, 6, 8, 2, 8, 0, 0, 0, 0], [0, 2, 8, 2, 3, 0, 0, 0, 0]]);
});
test('implicit line segments and scientific notation', () => { const s = parsePath('M1e1 0 20 10 30 0'); assert.equal(s.length, 2); assert.equal(s[0][1], 10); });
test('path bounds contain all source control points', () => { assert.deepEqual(pathBounds(parsePath('M0 0 Q10 30 20 0')), [0, 0, 20, 30]); });
test('original vector alphabet has finite geometry and retained curves', () => {
  const font = vectorAlphabet(); assert.equal(font.glyphs.length, 95);
  for (const glyph of font.glyphs) { assert.ok(glyph.advance > 0); parsePath(glyph.segments); }
  assert.ok(font.glyphs.some(g => g.segments.some(s => s[0] === 1)));
});
test('animation targets pack as composition slots and retain speed binding', () => {
  const c = compile(h('Grid', {}, h('Slider', { id: 'rate' }), h('Border', { animations: [{ property: 'rotation', from: 0, to: 3, duration: 2, speed: 'rate' }] })));
  const at = c.state[35]; assert.equal(c.heap[at], 2); assert.equal(c.heap[at + 1], 12); assert.equal(c.heap[at + 9], 1); assert.equal(c.animations, 1);
});
test('DataGrid allocates padded resident rows and stable identity indexes', () => {
  const c = compile(h('DataGrid', { rowCount: 129 })), t = c.tables[0].offset;
  assert.equal(c.heap[t], 129); assert.equal(c.heap[t + 1], 256); assert.equal(c.heap[t + 16], AUTO_TARGET); assert.equal(c.heap[t + 17], AUTO_TARGET);
  assert.equal(c.heap[t + 28], AUTO_TARGET); assert.equal(c.heap[t + 30], AUTO_TARGET);
  assert.equal(c.heap[t + 21], 1); assert.equal(c.heap[c.heap[t + 3]], 0); // GPU will generate, not CPU.
});
test('custom row data packs text and numeric cells once', () => {
  const c = compile(h('DataGrid', { data: [{ name: 'A', value: 4.25 }], dataColumns: [{ title: 'Name', field: 'name' }, { title: 'Value', field: 'value', type: 'number', editable: true }] }));
  const t = c.tables[0].offset, row = c.heap[t + 3], name = c.heap[row]; assert.equal(c.heap[name], 1); assert.equal(c.heap[name + 1], 65); assert.equal(fromBits(c.heap[row + 1]), 4.25); assert.equal(c.heap[t + 21], 0);
});
test('complete showcase fits capacity, has five pages and one GPU table', () => {
  const c = compile(createShowcase()); assert.equal(c.nodeCount, 202); assert.equal(c.tables[0].rowCount, 65536); assert.equal(c.animations, 8);
  assert.ok(c.heap.byteLength < 5 * 1024 * 1024); assert.equal(c.maxDepth, 8); assert.ok(c.state[48] > 0);
});
test('HTML adapter produces equivalent declarations without a DOM renderer', () => {
  const el = (tagName, props, children = [], value = '') => ({ tagName, attributes: Object.entries(props).map(([name, value]) => ({ name, value })), children, childNodes: [{ nodeType: 3, textContent: value }] });
  const root = el('UI-GRID', { rows: 'auto *' }, [el('UI-TEXT', { 'font-size': '20' }, [], 'Hello'), el('UI-BUTTON', { row: '1', action: 'bounds' }, [], 'Bounds')]);
  const c = compile(fromHTML({ content: { firstElementChild: root } })); assert.equal(c.nodeCount, 3); assert.equal(u32(c)[72], Kind.TextBlock); assert.equal(f32(c)[72 + 34], 20);
});
test('colors pack as little-endian RGBA', () => { assert.equal(rgba('#12345678'), 0x78563412); assert.equal(rgba('transparent'), 0); assert.equal(rgba('blue'),0xffff0000); assert.throws(() => rgba('not-a-color'));  });

const rejects = [
 ['unknown view type', () => h('Fake')], ['prototype view name', () => h('toString')], ['unknown property', () => compile(h('Grid', { bogus: 1 }))],
 ['duplicate id', () => compile(h('Grid', {}, h('TextBlock', { id: 'x' }), h('TextBlock', { id: 'x' })))],
 ['missing action target', () => compile(h('Button', { action: { type: 'toggle', target: 'missing' } }))],
 ['invalid alignment', () => compile(h('Border', { horizontalAlignment: 'around' }))],
 ['invalid min max', () => compile(h('Border', { minWidth: 10, maxWidth: 2 }))],
 ['non-finite size', () => compile(h('Border', { width: Infinity }))], ['unrepresentable f32', () => compile(h('Border', { width: 1e200 }))],
 ['out-of-range grid span', () => compile(h('Grid', {}, h('Border', { columnSpan: 2 })))], ['zero star weight', () => tracks('0*')],
 ['too many tracks', () => tracks(Array(33).fill('*'))], ['too many rows', () => compile(h('DataGrid', { rowCount: 65537 }))],
 ['fractional row count', () => compile(h('DataGrid', { rowCount: 1.5 }))], ['tiny row height', () => compile(h('DataGrid', { rowHeight: 0 }))],
 ['custom generator schema', () => compile(h('DataGrid', { dataColumns: [{ field: 'x' }] }))],
 ['multiple tables', () => compile(h('Grid', {}, h('DataGrid'), h('DataGrid')))],
 ['wrong filter control', () => compile(h('Grid', {}, h('Slider', { id: 's' }), h('DataGrid', { filter: 's' })))],
 ['text overflow', () => compile(h('TextBox', { text: 'x'.repeat(257) }))],
 ['conflicting animations', () => compile(h('Border', { animations: [{ property: 'opacity', duration: 1 }, { property: 'opacity', duration: 2 }] }))],
 ['layout animation', () => compile(h('Border', { animations: [{ property: 'width', duration: 1 }] }))],
 ['zero duration', () => compile(h('Border', { animations: [{ property: 'opacity', duration: 0 }] }))],
 ['invalid arc flags', () => parsePath('M0 0 A5 5 0 2 0 10 10')], ['missing coordinate', () => parsePath('M0 0 Q1 2 3')],
 ['invalid segment array', () => parsePath([[4, 0, 0]])], ['unknown limit', () => compile(empty(), { limits: { foo: 12 } })],
 ['node limit', () => compile(h('Grid', {}, h('Button')), { limits: { maxNodes: 1 } })],
 ['negative stroke', () => compile(h('Path', { path: 'M0 0 L1 1', stroke: -1 }))],
];
for (const [name, operation] of rejects) test(`rejects ${name}`, () => assert.throws(operation));
for (const [name, props] of [['prototype alignment',{horizontalAlignment:'constructor'}],['prototype animation',{animations:[{property:'constructor',duration:1}]}],['invalid orientation',{orientation:'sideways'}],['invalid fill rule',{fillRule:'other'}],['invalid easing',{animations:[{property:'opacity',duration:1,easing:'other'}]}],['unrepresentable animation duration',{animations:[{property:'opacity',duration:1e100}]}]]) test(`rejects ${name}`,()=>assert.throws(()=>compile(h('Border',props))));
test('HTML supports custom table JSON and explicit path bounds',()=>{
 const el=(tagName,props)=>({tagName,attributes:Object.entries(props).map(([name,value])=>({name,value})),children:[],childNodes:[]});
 const table=compile(fromHTML(el('UI-DATA-GRID',{'data-columns':'[{"field":"name","type":"text"}]',data:'[{"name":"Alpha"}]'})));assert.equal(table.tables[0].rowCount,1);
 const view=fromHTML(el('UI-PATH',{path:'M 0 0 L 10 10','view-box':'0 0 10 10'}));assert.deepEqual(view.props.viewBox,[0,0,10,10]);assert.equal(compile(view).nodeCount,1);
});
