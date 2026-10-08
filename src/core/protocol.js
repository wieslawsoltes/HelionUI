import { AUTO_TARGET, EVENT_WORDS, Opcode } from './schema.js';
/** 32-byte commands, little endian. FIFO ordering; adjacent moves and same-direction, same-position wheel commands coalesce. */
export class CommandStream {
  constructor(capacity = 256, maxQueued = 8192) {
    if (!Number.isInteger(capacity) || capacity < 1 || !Number.isInteger(maxQueued) || maxQueued < capacity) throw new RangeError('Invalid queue capacity');
    this.capacity = capacity; this.maxQueued = maxQueued; this.bytes = new ArrayBuffer(capacity * 32);
    this.u32 = new Uint32Array(this.bytes); this.f32 = new Float32Array(this.bytes);
    this.bulkUploads=new Map(); this.length = 0; this.sequence = 0; this.sentBytes = 0; this.coalesced = 0;
  }
  push(kind, { target = AUTO_TARGET, x = 0, y = 0, a = 0, b = 0, c = 0 } = {}) {
    if (![x, y, a, b].every(n => Number.isFinite(n) && Number.isFinite(Math.fround(n)))) throw new TypeError('Non-finite command');
    if (!Object.values(Opcode).includes(kind)) throw new TypeError('Unknown command opcode');
    if (![target, c].every(n => Number.isInteger(n) && n >= 0 && n <= 0xffffffff)) throw new TypeError('Invalid command integer');
    let index = this.length;
    const prior = (index - 1) * EVENT_WORDS;
    const sameTarget = index && this.u32[prior + 1] === (target >>> 0);
    const wheel = kind === Opcode.Wheel && sameTarget && this.u32[prior] === kind &&
      this.f32[prior + 2] === Math.fround(x) && this.f32[prior + 3] === Math.fround(y) &&
      this.u32[prior + 6] === c && this.f32[prior + 4] * a >= 0 && this.f32[prior + 5] * b >= 0 &&
      Number.isFinite(Math.fround(this.f32[prior + 4] + a)) && Number.isFinite(Math.fround(this.f32[prior + 5] + b));
    if (wheel) { a += this.f32[prior + 4]; b += this.f32[prior + 5]; }
    if (wheel || (kind === Opcode.Move && index && this.u32[(index - 1) * EVENT_WORDS] === kind && this.u32[(index - 1) * EVENT_WORDS + 1] === (target >>> 0))) { index--; this.coalesced++; }
    else {
      if (index >= this.maxQueued) throw new RangeError('Command queue full: apply backpressure instead of dropping discrete input');
      if (index === this.capacity) {
        this.capacity = Math.min(this.maxQueued, this.capacity * 2);
        const next = new ArrayBuffer(this.capacity * 32); new Uint8Array(next).set(new Uint8Array(this.bytes));
        this.bytes = next; this.u32 = new Uint32Array(next); this.f32 = new Float32Array(next);
      }
      this.length++;
    }
    const o = index * EVENT_WORDS;
    this.u32[o] = kind; this.u32[o + 1] = target; this.f32[o + 2] = x; this.f32[o + 3] = y;
    this.f32[o + 4] = a; this.f32[o + 5] = b; this.u32[o + 6] = c; this.u32[o + 7] = ++this.sequence;
    return this;
  }
  /** One immutable input payload, copied once into a reserved GPU upload region.
   * Packets stop before a second bulk command, so that region cannot be overwritten
   * before its first command executes. Ordinary character editing uses other scratch. */
  pushBulk(kind,payload,data,destination){
    if(!(data instanceof Uint32Array)||!Number.isSafeInteger(destination)||destination<0)throw new TypeError('Invalid bulk payload');
    this.push(kind,payload);this.bulkUploads.set(this.sequence>>>0,{data:data.slice(),destination});return this;
  }
  /** Upload one bounded packet. Returns count and whether a query/layout graph might be needed. */
  flush(queue, buffer, maxEvents = 256, heapBuffer = null) {
    if (!Number.isInteger(maxEvents) || maxEvents < 1 || maxEvents > 256) throw new RangeError('Packet must contain 1–256 events');
    let count = Math.min(this.length, maxEvents),bulk=null;
    for(let i=0;i<count;i++){const upload=this.bulkUploads.get(this.u32[i*8+7]);if(upload){if(bulk){count=i;break;}bulk=upload;}}
    if(bulk&&!heapBuffer)throw new Error('Bulk input requires its resident heap buffer');
    const lastSequence=count?this.u32[(count-1)*8+7]:0; let discrete = false, layout = false, query = false, hitTest = false, actionCandidate = false;
    for (let i = 0; i < count; i++) {
      const o = i * 8, k = this.u32[o], code = this.u32[o + 6];
      if (k !== Opcode.Move && k !== Opcode.Wheel) discrete = true;
      if (k <= Opcode.Wheel && this.u32[o + 1] === AUTO_TARGET) hitTest = true;
      if (k === Opcode.Down || k === Opcode.Up) { layout = true; query = true; }
      if (k === Opcode.Text) { query = true; if (code === 32) layout = true; }
      if (k === Opcode.Key) { query = true; if (code === 13 || code === 32) layout = true; }
      if(k===Opcode.Dock||k===Opcode.Model||k===Opcode.Designer||k===Opcode.Template)layout=true;
      if(k===Opcode.Data)query=true;
      if(k===Opcode.Controls){layout=true;query=true;}
      if(k===Opcode.Up||(k===Opcode.Key&&[13,27,32].includes(code)))actionCandidate=true;
      if(k===Opcode.Editor&&code===38)query=true;
      if (k === Opcode.Set) {
        if ([1, 2, 9, 11].includes(code)) layout = true;
        if (code === 0 || code === 12) query = true;
      }
    }
    if (count) {
      if(bulk&&bulk.data.byteLength)queue.writeBuffer(heapBuffer,bulk.destination*4,bulk.data);
      for(let i=0;i<count;i++)this.bulkUploads.delete(this.u32[i*8+7]);
      queue.writeBuffer(buffer, 0, this.bytes, 0, count * 32);
      this.u32.copyWithin(0, count * 8, this.length * 8); this.length -= count; this.sentBytes += count * 32;
    }
    return { count, discrete, bytes: count * 32+(bulk?.data.byteLength??0), layout, query, hitTest, actionCandidate, lastSequence, payloadBytes:bulk?.data.byteLength??0 };
  }
}
