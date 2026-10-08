import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandStream } from '../src/core/protocol.js';
import { Opcode, AUTO_TARGET } from '../src/core/schema.js';
const capture = () => { const packets = []; return { packets, queue: { writeBuffer(buffer, offset, bytes, start, size) { packets.push(new Uint32Array(bytes.slice(start, start + size))); } } }; };
test('32-byte ABI preserves integer and float lanes', () => {
 const s = new CommandStream(); s.push(Opcode.Down, { x: 12.5, y: -2.25, a: 1, b: 2, c: 2 });
 const { queue, packets } = capture(); assert.deepEqual(s.flush(queue, {}), { count: 1, discrete: true, bytes: 32, layout: true, query: true, hitTest: true, actionCandidate: false, lastSequence: 1, payloadBytes: 0 });
 const u = packets[0], f = new Float32Array(u.buffer); assert.equal(u.length, 8); assert.equal(u[0], 2); assert.equal(u[1], AUTO_TARGET); assert.deepEqual([...f.slice(2, 6)], [12.5, -2.25, 1, 2]); assert.equal(u[6], 2); assert.equal(u[7], 1);
});
test('only consecutive moves to the same target coalesce', () => {
 const s = new CommandStream(2); s.push(1, { x: 1 }).push(1, { x: 2 }).push(2).push(1, { x: 3 }).push(1, { target: 7, x: 4 }).push(3);
 assert.equal(s.length, 5); assert.equal(s.coalesced, 1); const { queue, packets } = capture(); s.flush(queue, {});
 assert.deepEqual([...packets[0]].filter((_, i) => i % 8 === 0), [1, 2, 1, 1, 3]); assert.deepEqual([...packets[0]].filter((_, i) => i % 8 === 7), [2, 3, 4, 5, 6]);
});
test('bounded packets retain FIFO ordering over queue growth', () => {
 const s = new CommandStream(1, 8192); for (let i = 0; i < 4097; i++) s.push(Opcode.Text, { c: 32 + i });
 const { queue, packets } = capture(); while (s.length) s.flush(queue, {});
 const result = packets.flatMap(p => [...p].filter((_, i) => i % 8 === 6)); assert.deepEqual(result, Array.from({ length: 4097 }, (_, i) => 32 + i)); assert.equal(s.sentBytes, 4097 * 32); assert.ok(packets.every(p => p.length <= 2048));
});
test('backpressure throws without silently dropping discrete events', () => {
 const s = new CommandStream(2, 3); s.push(2).push(3).push(5); assert.throws(() => s.push(6), /backpressure/); assert.equal(s.length, 3); assert.equal(s.sequence, 3);
});
test('32-bit sequence wraps in transmitted representation', () => {
 const s = new CommandStream(); s.sequence = 0xfffffffe; s.push(2).push(3).push(5); const { queue, packets } = capture(); s.flush(queue, {}); assert.deepEqual([packets[0][7], packets[0][15], packets[0][23]], [0xffffffff, 0, 1]);
 const accepts = (last, next) => { const d = (next - last) >>> 0; return d > 0 && d < 0x80000000; }; assert.ok(accepts(0xffffffff, 0)); assert.ok(!accepts(0, 0)); assert.ok(!accepts(7, 6));
});
test('empty packets do not transfer; motion/wheel do not request layout/query encoding', () => {
 const s = new CommandStream(); const { queue, packets } = capture(); assert.equal(s.flush(queue, {}).bytes, 0); assert.equal(packets.length, 0);
 s.push(1).push(4); assert.equal(s.flush(queue, {}).discrete, false); s.push(7); assert.equal(s.flush(queue, {}).discrete, true);
});
for (const payload of [{ x: NaN }, { a: Infinity }, { b: 1e100 }, { target: -1 }, { target: 1.1 }, { c: 2 ** 32 }]) test(`reject invalid packet ${JSON.stringify(payload)}`, () => assert.throws(() => new CommandStream().push(1, payload)));
test('reject unsupported opcodes and packet capacities', () => { assert.throws(() => new CommandStream().push(99)); assert.throws(() => new CommandStream(0)); assert.throws(() => new CommandStream(4, 2)); const s = new CommandStream(); for (const n of [0, -1, 257, 1.5, NaN]) assert.throws(() => s.flush({}, {}, n)); });
