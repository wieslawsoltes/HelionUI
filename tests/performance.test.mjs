import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FrameGate, mergePlan } from '../src/gpu/frame-gate.js';
import { arenaLayout } from '../src/gpu/arena-layout.js';
import { CommandStream } from '../src/core/protocol.js';
import { compile, h } from '../src/core/compiler.js';
import { Opcode, Key, DEFAULT_LIMITS, AUTO_TARGET, VERSION } from '../src/core/schema.js';

const NONE = 0xffffffff;
const random = (seed = 12345) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const rng = random();
/** CPU mirror of the exact local-network + binary-rank merge algorithm; not a GPU benchmark. */
function sortMirror(values, descending = false) {
  const n = values.length, padded = 2 ** Math.ceil(Math.log2(Math.max(1, n)));
  const less = (a, b) => {
    if (a === NONE) return false; if (b === NONE) return true;
    const av = typeof values[a] === 'string' ? values[a].replace(/[A-Z]/g, c => c.toLowerCase()) : values[a];
    const bv = typeof values[b] === 'string' ? values[b].replace(/[A-Z]/g, c => c.toLowerCase()) : values[b];
    if (av === bv) return a < b; return descending ? av > bv : av < bv;
  };
  let source = new Uint32Array(padded), dest = new Uint32Array(padded);
  for (let base = 0; base < padded; base += 256) {
    const local = Uint32Array.from({ length: 256 }, (_, lane) => base + lane < n ? base + lane : NONE);
    for (let k = 2; k <= 256; k *= 2) for (let stride = k / 2; stride; stride /= 2) for (let lane = 0; lane < 256; lane++) {
      const peer = lane ^ stride; if (peer <= lane) continue;
      const swap = !(lane & k) ? less(local[peer], local[lane]) : less(local[lane], local[peer]);
      if (swap) [local[lane], local[peer]] = [local[peer], local[lane]];
    }
    source.set(local.subarray(0, Math.min(256, padded - base)), base);
  }
  for (const [width] of mergePlan(padded)) {
    const written = new Uint8Array(padded);
    for (let i = 0; i < padded; i++) {
      const base = Math.floor(i / (width * 2)) * width * 2, right = i - base >= width;
      const other = base + (right ? 0 : width), value = source[i];
      let lo = other, hi = Math.min(other + width, padded);
      while (lo < hi) {
        const mid = lo + ((hi - lo) >> 1), candidate = source[mid];
        if (less(candidate, value) || (right && candidate === value)) lo = mid + 1; else hi = mid;
      }
      const position = base + (i - base) % width + lo - other;
      assert.ok(position < padded, 'rank stays in allocation'); assert.equal(written[position], 0, 'each destination has exactly one writer');
      dest[position] = value; written[position] = 1;
    }
    assert.ok(written.every(v => v === 1)); [source, dest] = [dest, source];
  }
  const expected = Array.from({ length: n }, (_, i) => i).sort((a, b) => less(a, b) ? -1 : less(b, a) ? 1 : 0);
  assert.deepEqual([...source.subarray(0, n)], expected);
  assert.ok(source.subarray(n).every(v => v === NONE));
  return [...source.subarray(0, n)];
}
for (const n of [0, 1, 2, 127, 128, 129, 255, 256, 257, 511, 512, 513, 1023, 4097, 65535, 65536]) {
  test(`merge mirror: ${n} finite numeric rows, both directions, stable duplicates and padding`, () => {
    const data = Array.from({ length: n }, () => Math.fround((Math.floor(rng() * 81) - 40) / 4));
    sortMirror(data); sortMirror(data, true);
  });
}
for (const n of [5, 257, 1025]) test(`merge mirror: ${n} case-insensitive strings retain identity ties`, () => {
  const words = ['ALPHA', 'alpha', 'Beta', '', 'BETA', 'be', 'zeta'];
  const data = Array.from({ length: n }, () => words[Math.floor(rng() * words.length)]);
  const order = sortMirror(data); sortMirror(data, true);
  assert.deepEqual(order.filter(i => data[i].toLowerCase().includes('be')), order.filter(i => /be/i.test(data[i])));
});
test('65,536-row sort has nine dispatches; cached filtering needs no sort execution', () => {
  assert.equal(1 + mergePlan(65536).length, 9); assert.equal(16 * 17 / 2, 136);
  assert.deepEqual(mergePlan(256), []); assert.deepEqual(mergePlan(1024), [[256, 0, 0, 0], [512, 1, 0, 0]]);
  for (const bad of [0, 3, 100, 131072, NaN]) assert.throws(() => mergePlan(bad));
});
test('compiler allocates independent retained order, merge scratch and visible indexes', () => {
  for (const rowCount of [0, 1, 256, 257, 512, 1024, 65536]) {
    const view = compile(h('DataGrid', { rowCount })); const t = view.tables[0].offset, heap = view.heap;
    assert.equal(view.version, VERSION); assert.equal(VERSION, 3);
    assert.equal(new Set([heap[t + 4], heap[t + 32], heap[t + 33]]).size, 3);
    assert.equal(heap[t + 34], heap[t + 32 + (mergePlan(view.tables[0].paddedCount).length % 2)]);
    assert.equal(view.state[49], 1);
  }
});
for (const limit of [1, 2, 3]) test(`frame gate admits at most ${limit} incomplete frames`, () => {
  const gate = new FrameGate(limit);
  for (let i = 0; i < limit; i++) assert.equal(gate.acquire(), true);
  for (let i = 0; i < 100; i++) assert.equal(gate.acquire(), false);
  assert.equal(gate.peak, limit); assert.equal(gate.inFlight, limit);
  gate.release(); assert.equal(gate.acquire(), true);
  for (let i = 0; i < limit + 2; i++) gate.release(); assert.equal(gate.inFlight, 0);
});
test('invalid queue-depth configurations fail explicitly', () => {
  for (const limit of [-1, 1.5, 33, Infinity, NaN]) assert.throws(() => new FrameGate(limit));
});
function packet(stream) {
  let data;
  const summary = stream.flush({ writeBuffer: (_, _offset, bytes, _start, count) => { data = bytes.slice(0, count); } }, {});
  return { ...summary, data, floats: data ? new Float32Array(data) : [] };
}
test('wheel bursts coalesce without losing accumulated distance', () => {
  const stream = new CommandStream();
  for (let i = 0; i < 200; i++) stream.push(Opcode.Wheel, { x: 100, y: 200, b: 1.25 });
  assert.equal(stream.length, 1); const result = packet(stream);
  assert.equal(result.bytes, 32); assert.equal(result.floats[5], 250); assert.equal(result.layout, false); assert.equal(result.query, false);
});
test('wheel reversals, different positions and discrete barriers retain FIFO', () => {
  const stream = new CommandStream();
  stream.push(4, { b: 100 }).push(4, { b: -20 }).push(4, { x: 1, b: -20 }).push(5, { c: 13 }).push(4, { x: 1, b: -20 });
  assert.equal(stream.length, 5);
  const u = new Uint32Array(packet(stream).data); assert.deepEqual([u[0], u[8], u[16], u[24], u[32]], [4, 4, 4, 5, 4]);
});
test('text packets do not encode layout or pointer hit tests', () => {
  const stream = new CommandStream(); stream.push(Opcode.Text, { c: 97 }); const p = packet(stream);
  assert.equal(p.layout, false); assert.equal(p.hitTest, false); assert.equal(p.query, true);
  stream.push(Opcode.Key, { c: Key.Backspace }); assert.equal(packet(stream).layout, false);
  stream.push(Opcode.Set, { target: 3, c: 1, a: 200 }); assert.equal(packet(stream).layout, true);
});
test('explicit-target pointer commands skip GPU hit discovery', () => {
  const stream = new CommandStream(); stream.push(Opcode.Down, { target: 2 }); assert.equal(packet(stream).hitTest, false);
  stream.push(Opcode.Down, { target: AUTO_TARGET }); assert.equal(packet(stream).hitTest, true);
});
test('damage storage is separate from bins; both display lists include node-head headers', () => {
  const { constants: c, scratchBytes, drawBytes, maxTiles } = arenaLayout(DEFAULT_LIMITS);
  assert.ok(c.DAMAGE >= c.TILE_LIST + maxTiles * c.TILE_CAPACITY);
  assert.ok(scratchBytes >= (c.DAMAGE + maxTiles) * 4);
  assert.equal(drawBytes, 10848 + 128 * DEFAULT_LIMITS.maxPrimitives);
});
test('reverse compositor equals painter-over with opaque early exits', () => {
  for (let sample = 0; sample < 100; sample++) {
    const background = [rng(), rng(), rng()];
    const layers = Array.from({ length: 20 }, (_, i) => ({ rgb: [rng(), rng(), rng()], a: i % 5 ? rng() : 1 }));
    let reference = [...background];
    for (const p of layers) reference = reference.map((v, i) => p.rgb[i] * p.a + v * (1 - p.a));
    const out = [0, 0, 0]; let transmission = 1, visits = 0;
    for (const p of [...layers].reverse()) { visits++; for (let i = 0; i < 3; i++) out[i] += p.rgb[i] * p.a * transmission; transmission *= 1 - p.a; if (transmission === 0) break; }
    for (let i = 0; i < 3; i++) { out[i] += background[i] * transmission; assert.ok(Math.abs(out[i] - reference[i]) < 1e-12); }
    assert.ok(visits < layers.length);
  }
});
test('timestamp low-word rollover is subtracted before floating-point conversion', () => {
  const elapsed = (start, end) => {
    const a = [Number(start & 0xffffffffn), Number(start >> 32n)], b = [Number(end & 0xffffffffn), Number(end >> 32n)];
    const low = (b[0] - a[0]) >>> 0, high = (b[1] - a[1] - (b[0] < a[0] ? 1 : 0)) >>> 0;
    return (low + high * 4294967296) / 1e6;
  };
  assert.equal(elapsed(0xfffffff0n, 0x100018690n), .1);
  assert.equal(elapsed(100000000000000n, 100000016667000n), 16.667);
});
test('new shader paths retain uniform barriers and exact primitive comparison', async () => {
  const source = await readFile(new URL('../shaders/strips.wgsl', import.meta.url), 'utf8');
  assert.match(source, /workgroupUniformLoad\(&tileDirtyShared\)/); assert.match(source, /workgroupUniformLoad\(&tileCountShared\)/);
  assert.match(source, /k<=sortCount/); assert.match(source, /samePrimitive\(current,previous\)/); assert.match(source, /damageBounds\(previous.bounds\)/);
  assert.match(source, /if\(!dirtyRow\(p.bounds,y\)\)/); assert.match(source, /transmittance==0.0/);
});
test('performance histories use GPU storage, not CPU readback or Canvas 2D', async () => {
  const metrics = await readFile(new URL('../shaders/metrics.wgsl', import.meta.url), 'utf8');
  const present = await readFile(new URL('../shaders/present.wgsl', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../src/gpu/runtime.js', import.meta.url), 'utf8');
  assert.match(metrics, /var<storage,read_write> metrics/); assert.match(present, /var<storage,read> history/);
  assert.match(runtime, /resolveQuerySet\(this.querySet, 0, TIMESTAMP_COUNT, this.timingBuffer, 0\)/);
  assert.doesNotMatch(runtime.slice(runtime.indexOf('  render('), runtime.indexOf('  invalidate()')), /mapAsync|inspect\(/);
});
