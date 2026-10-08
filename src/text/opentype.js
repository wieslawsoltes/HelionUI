import { captureLayoutTables } from '../typography/opentype.js';
/** Static TrueType/OpenType loader. Decoding is initialization work, never a frame-loop service.
 * Coordinates are normalized to em units with a Y-down baseline. No font binaries are bundled.
 * References: Microsoft OpenType `glyf`, `cmap`, `hmtx`, GSUB and GPOS specifications.
 */
export class FontFormatError extends Error { constructor(message) { super(message); this.name = 'FontFormatError'; } }
const fail = message => { throw new FontFormatError(message); };
const bytesOf = data => data instanceof ArrayBuffer ? new Uint8Array(data) : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : fail('Expected font bytes (ArrayBuffer or typed array)');
class Reader {
  constructor(bytes, label = 'font') { this.bytes = bytes; this.v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); this.label = label; }
  check(at, n) { if (!Number.isSafeInteger(at) || !Number.isSafeInteger(n) || at < 0 || n < 0 || at + n > this.bytes.length) fail(`Truncated ${this.label} at byte ${at}, length ${n}`); }
  u8(at) { this.check(at, 1); return this.v.getUint8(at); }
  i8(at) { this.check(at, 1); return this.v.getInt8(at); }
  u16(at) { this.check(at, 2); return this.v.getUint16(at); }
  i16(at) { this.check(at, 2); return this.v.getInt16(at); }
  u32(at) { this.check(at, 4); return this.v.getUint32(at); }
  tag(at) { this.check(at, 4); return String.fromCharCode(...this.bytes.subarray(at, at + 4)); }
  slice(at, n, label) { this.check(at, n); return new Reader(this.bytes.subarray(at, at + n), label); }
}
const scalar = cp => cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff);
function parseCmap(r, glyphCount) {
  const result = new Map(), choices = []; r.check(4, r.u16(2) * 8);
  for (let i = 0; i < r.u16(2); i++) {
    const at = 4 + i * 8, platform = r.u16(at), encoding = r.u16(at + 2), off = r.u32(at + 4), format = r.u16(off);
    if (platform === 0 || platform === 3 && [1, 10].includes(encoding)) {
      if ([0, 4, 6, 12, 13].includes(format)) choices.push({ off, format, score: (format >= 12 ? 100 : 0) + (platform === 3 ? 10 : 0) });
    }
  }
  choices.sort((a, b) => a.score - b.score);
  const put = (cp, gid) => { if (gid >= glyphCount) fail(`cmap references missing glyph ${gid}`); if (gid && scalar(cp)) result.set(cp, gid); };
  for (const { off, format } of choices) {
    const length = format >= 12 ? r.u32(off + 4) : r.u16(off + 2), s = r.slice(off, length, `cmap format ${format}`);
    if (format === 0) { s.check(6, 256); for (let cp = 0; cp < 256; cp++) put(cp, s.u8(6 + cp)); }
    if (format === 6) { const first = s.u16(6), count = s.u16(8); s.check(10, count * 2); for (let i = 0; i < count; i++) put(first + i, s.u16(10 + 2 * i)); }
    if (format === 4) {
      const n = s.u16(6) / 2; if (!Number.isInteger(n) || n < 1) fail('Invalid cmap segment count');
      s.check(14, n * 8 + 2); const starts = 16 + n * 2, deltas = starts + n * 2, ranges = deltas + n * 2;
      let previous = -1;
      for (let i = 0; i < n; i++) {
        const end = s.u16(14 + i * 2), start = s.u16(starts + i * 2), delta = s.i16(deltas + i * 2), range = s.u16(ranges + i * 2);
        if (end < start || start <= previous) fail('Invalid or overlapping cmap segments'); previous = end;
        for (let cp = start; cp <= end && cp < 65535; cp++) { let gid = range ? s.u16(ranges + i * 2 + range + (cp - start) * 2) : cp; if (!range || gid) gid = (gid + delta) & 65535; put(cp, gid); }
      }
    }
    if (format === 12 || format === 13) {
      const n = s.u32(12); s.check(16, n * 12); let previous = -1;
      for (let i = 0; i < n; i++) { const at = 16 + 12 * i, start = s.u32(at), end = s.u32(at + 4), first = s.u32(at + 8);
        if (end < start || end > 0x10ffff || start <= previous) fail('Invalid cmap group'); previous = end;
        for (let cp = start; cp <= end; cp++) put(cp, first + (format === 12 ? cp - start : 0));
      }
    }
  }
  if (!choices.length || !result.size) fail('No supported Unicode cmap (formats 0, 4, 6, 12, 13)');
  return result;
}
function coverage(r, at, glyphCount) {
  const format = r.u16(at), n = r.u16(at + 2), out = [];
  if (format === 1) { r.check(at + 4, n * 2); for (let i = 0; i < n; i++) out.push(r.u16(at + 4 + i * 2)); }
  else if (format === 2) { r.check(at + 4, n * 6); for (let i = 0; i < n; i++) { const p = at + 4 + i * 6, start = r.u16(p), end = r.u16(p + 2); if (start > end || r.u16(p + 4) !== out.length) fail('Invalid Coverage range'); for (let gid = start; gid <= end; gid++) out.push(gid); } }
  else fail(`Unsupported Coverage format ${format}`);
  if (out.some((g, i) => g >= glyphCount || i > 0 && g <= out[i - 1])) fail('Invalid Coverage glyph order');
  return out;
}
function classes(r, at, glyphCount) {
  const out = new Uint16Array(glyphCount), format = r.u16(at);
  if (format === 1) { const start = r.u16(at + 2), n = r.u16(at + 4); if (start + n > glyphCount) fail('ClassDef exceeds glyph count'); r.check(at + 6, n * 2); for (let i = 0; i < n; i++) out[start + i] = r.u16(at + 6 + 2 * i); }
  else if (format === 2) { const n = r.u16(at + 2); r.check(at + 4, n * 6); let previous = -1; for (let i = 0; i < n; i++) { const p = at + 4 + i * 6, start = r.u16(p), end = r.u16(p + 2), value = r.u16(p + 4); if (start > end || end >= glyphCount || start <= previous) fail('Invalid ClassDef range'); out.fill(value, start, end + 1); previous = end; } }
  else fail(`Unsupported ClassDef format ${format}`);
  return out;
}
function layoutFeatures(r) {
  if (r.u16(0) !== 1) fail(`Unsupported ${r.label} version`);
  const f = r.u16(6), l = r.u16(8), n = r.u16(f); r.check(f + 2, n * 6);
  const features = [], scripts = new Map();
  for (let i = 0; i < n; i++) { const p = f + 2 + i * 6, at = f + r.u16(p + 4), count = r.u16(at + 2); r.check(at + 4, count * 2); features.push({ tag: r.tag(p), lookups: Array.from({ length: count }, (_, j) => r.u16(at + 4 + j * 2)) }); }
  const scriptList = r.u16(4), scriptCount = r.u16(scriptList); r.check(scriptList + 2, scriptCount * 6);
  const language = at => { const required = r.u16(at + 2), count = r.u16(at + 4); r.check(at + 6, count * 2); const ids = Array.from({ length: count }, (_, j) => r.u16(at + 6 + j * 2)); if (required !== 65535) ids.unshift(required); if (ids.some(id => id >= n)) fail('Invalid feature reference'); return ids; };
  for (let i = 0; i < scriptCount; i++) { const p = scriptList + 2 + i * 6, script = scriptList + r.u16(p + 4), def = r.u16(script), langs = new Map(); if (def) langs.set('dflt', language(script + def)); const count = r.u16(script + 2); r.check(script + 4, count * 6); for (let j = 0; j < count; j++) { const q = script + 4 + j * 6; langs.set(r.tag(q), language(script + r.u16(q + 4))); } scripts.set(r.tag(p), langs); }
  const lookupCount = r.u16(l); r.check(l + 2, lookupCount * 2);
  const lookup = index => { if (index >= lookupCount) fail('Invalid layout lookup index'); const at = l + r.u16(l + 2 + index * 2), type = r.u16(at), flags = r.u16(at + 2), count = r.u16(at + 4); r.check(at + 6, count * 2); return { type, flags, subtables: Array.from({ length: count }, (_, j) => at + r.u16(at + 6 + j * 2)) }; };
  return { features, scripts, lookup };
}
function planLookups(layout, script, language, tags) {
  const languages = layout.scripts.get(script) || layout.scripts.get('DFLT');
  const ids = languages?.get(language) || languages?.get('dflt') || [];
  const selected = new Map();
  for (const id of ids) { const f = layout.features[id]; if (tags.includes(f.tag)) for (const index of f.lookups) selected.set(index, f.tag); }
  return [...selected].sort((a, b) => a[0] - b[0]);
}
function valueRecord(r, at, format, unit) {
  if (format & 0xff00) fail('Invalid GPOS ValueFormat');
  const value = [0, 0, 0, 0]; let cursor = at;
  for (let bit = 0; bit < 8; bit++) if (format & 1 << bit) { const v = r.i16(cursor); if (bit < 4) value[bit] = v * unit * (bit === 1 || bit === 3 ? -1 : 1); cursor += 2; }
  return { value, next: cursor, device: Boolean(format & 0xf0) };
}
function parsePositioning(r, count, unit, warnings) {
  if (!r) return new Map(); const layout = layoutFeatures(r), plans = new Map();
  for (const script of ['DFLT', 'latn', 'grek', 'cyrl']) {
    const pairs = [], attachments = [];
    for (const [index, tag] of planLookups(layout, script, 'dflt', ['kern', 'mark', 'mkmk'])) {
      const lookup = layout.lookup(index), pairGroup = [], markGroup = [];
      if (lookup.flags & ~8) { warnings.add(`${r.label}: lookup flags 0x${lookup.flags.toString(16)} are not applied`); continue; }
      for (let at of lookup.subtables) {
        let type = lookup.type; if (type === 9) { if (r.u16(at) !== 1) fail('Invalid GPOS extension'); type = r.u16(at + 2); at += r.u32(at + 4); }
        const format = r.u16(at);
        if (type === 2 && tag === 'kern') {
          const cov = coverage(r, at + r.u16(at + 2), count), f1 = r.u16(at + 4), f2 = r.u16(at + 6);
          if (f2 !== 0 || f1 !== 4) { warnings.add('GPOS: only horizontal advance pair adjustments (ValueFormat 4/0) are supported'); continue; }
          if (format === 1) { const n = r.u16(at + 8); if (n !== cov.length) fail('PairSet / Coverage count mismatch'); r.check(at + 10, n * 2); const values = [];
            for (let k = 0; k < n; k++) { const set = at + r.u16(at + 10 + k * 2), num = r.u16(set); let p = set + 2, previous = -1; for (let j = 0; j < num; j++) { const right = r.u16(p); if (right >= count || right <= previous) fail('Invalid PairSet order'); previous = right; const v = valueRecord(r, p + 2, f1, unit); values.push([cov[k], right, v.value[2]]); p = v.next; } }
            pairGroup.push({ kind: 1, values });
          } else if (format === 2) { const c1 = classes(r, at + r.u16(at + 8), count), c2 = classes(r, at + r.u16(at + 10), count), n1 = r.u16(at + 12), n2 = r.u16(at + 14); if (!n1 || !n2 || n1 * n2 > 4194304 || c1.some(x => x >= n1) || c2.some(x => x >= n2)) fail('Invalid PairPos class dimensions'); r.check(at + 16, n1 * n2 * 2); const values = new Float32Array(n1 * n2); for (let j = 0; j < values.length; j++) values[j] = r.i16(at + 16 + j * 2) * unit; pairGroup.push({ kind: 2, coverage: cov, class1: c1, class2: c2, n2, values }); }
          else fail(`Invalid PairPos format ${format}`);
        } else if ((type === 4 || type === 6) && format === 1) {
          const marks = coverage(r, at + r.u16(at + 2), count), bases = coverage(r, at + r.u16(at + 4), count), classCount = r.u16(at + 6), m = at + r.u16(at + 8), b = at + r.u16(at + 10);
          if (!classCount || classCount > 1024 || r.u16(m) !== marks.length || r.u16(b) !== bases.length) fail('Invalid mark attachment counts');
          const anchor = p => { const f = r.u16(p); if (f < 1 || f > 3) fail('Invalid GPOS anchor'); if (f > 1) warnings.add('GPOS anchor hint/device adjustments are ignored'); return [r.i16(p + 2) * unit, -r.i16(p + 4) * unit]; };
          r.check(m + 2, marks.length * 4); r.check(b + 2, bases.length * classCount * 2);
          const markValues = marks.map((gid, j) => { const p = m + 2 + j * 4, cls = r.u16(p), off = r.u16(p + 2); if (cls >= classCount || !off) fail('Invalid mark anchor'); return [gid, cls, ...anchor(m + off)]; });
          const baseValues = bases.map((gid, j) => [gid, ...Array.from({ length: classCount }, (_, k) => { const off = r.u16(b + 2 + (j * classCount + k) * 2); return off ? anchor(b + off) : null; })]);
          markGroup.push({ kind: type, classCount, marks: markValues, bases: baseValues });
        } else warnings.add(`GPOS ${tag}: lookup ${type}/${format} not applied`);
      }
      if (pairGroup.length) pairs.push(pairGroup); if (markGroup.length) attachments.push(markGroup);
    }
    plans.set(script, { pairs, attachments });
  }
  return plans;
}
function parseLigatures(r, count, warnings) {
  if (!r) return new Map(); const layout = layoutFeatures(r), result = new Map();
  for (const script of ['DFLT', 'latn', 'grek', 'cyrl']) {
    const ligatures = [];
    for (const [index, tag] of planLookups(layout, script, 'dflt', ['liga', 'rlig'])) {
      const lookup = layout.lookup(index);
      if (lookup.flags) { warnings.add('GSUB: flagged/mark-skipping ligature lookups are not applied'); continue; }
      for (let at of lookup.subtables) { let type = lookup.type; if (type === 7) { if (r.u16(at) !== 1) fail('Invalid GSUB extension'); type = r.u16(at + 2); at += r.u32(at + 4); }
        if (type !== 4 || r.u16(at) !== 1) { warnings.add(`GSUB ${tag}: lookup ${type} not applied`); continue; }
        const cov = coverage(r, at + r.u16(at + 2), count), n = r.u16(at + 4); if (n !== cov.length) fail('LigatureSet count mismatch'); r.check(at + 6, n * 2);
        for (let j = 0; j < n; j++) { const set = at + r.u16(at + 6 + j * 2), num = r.u16(set); r.check(set + 2, num * 2); for (let k = 0; k < num; k++) { const l = set + r.u16(set + 2 + k * 2), target = r.u16(l), components = r.u16(l + 2); if (components < 2 || components > 32 || target >= count) fail('Invalid ligature glyph/components'); r.check(l + 4, (components - 1) * 2); const input = [cov[j], ...Array.from({ length: components - 1 }, (_, v) => r.u16(l + 4 + v * 2))]; if (input.some(g => g >= count)) fail('Invalid ligature input'); if (components <= 8) ligatures.push({ input, target, lookup: index }); else warnings.add('GSUB ligatures longer than 8 codepoints not applied'); } }
      }
    }
    result.set(script, ligatures);
  }
  return result;
}
function parseKern(r, count, unit) {
  const values = []; if (!r || r.u16(0) !== 0) return values; let at = 4;
  for (let i = 0; i < r.u16(2); i++) { const length = r.u16(at + 2), cov = r.u16(at + 4); if (length < 6) fail('Invalid kern subtable length'); const s = r.slice(at, length, 'kern subtable');
    if ((cov >> 8) === 0 && (cov & 7) === 1) { const n = s.u16(6); s.check(14, n * 6); for (let j = 0; j < n; j++) { const p = 14 + 6 * j, l = s.u16(p), rr = s.u16(p + 2); if (l >= count || rr >= count) fail('Invalid kern glyph'); values.push([l, rr, s.i16(p + 4) * unit, Boolean(cov & 8)]); } } at += length;
  }
  const merged = new Map(); for (const [l, r2, v, override] of values) { const key = l * 65536 + r2; merged.set(key, override ? v : (merged.get(key) || 0) + v); }
  return [...merged].sort((a, b) => a[0] - b[0]).map(([key, value]) => [Math.floor(key / 65536), key % 65536, value]);
}
function nameTable(r) {
  const names = new Map(); if (!r) return names; const n = r.u16(2), strings = r.u16(4); r.check(6, n * 12);
  for (let i = 0; i < n; i++) { const p = 6 + i * 12, platform = r.u16(p), language = r.u16(p + 4), id = r.u16(p + 6), length = r.u16(p + 8), offset = strings + r.u16(p + 10); r.check(offset, length);
    if (![1, 2, 6, 16, 17].includes(id) || names.has(id) && language !== 0x409) continue;
    let text = ''; if (platform === 0 || platform === 3) { if (length % 2) fail('Invalid UTF-16 name'); for (let j = 0; j < length; j += 2) text += String.fromCharCode(r.u16(offset + j)); }
    else if (platform === 1) text = new TextDecoder('macintosh').decode(r.bytes.subarray(offset, offset + length));
    if (text) names.set(id, text);
  }
  return names;
}
export function contoursToSegments(contours, units = 1) {
  const out = [], unit = 1 / units;
  const line = (a, b) => { if (a.x !== b.x || a.y !== b.y) out.push([0, a.x * unit, -a.y * unit, b.x * unit, -b.y * unit, 0, 0, 0, 0]); };
  const quad = (a, b, c) => out.push([1, a.x * unit, -a.y * unit, b.x * unit, -b.y * unit, c.x * unit, -c.y * unit, 0, 0]);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true });
  for (const points of contours) {
    if (!points.length) continue; const first = points[0], last = points.at(-1);
    const start = first.on ? first : last.on ? last : mid(last, first); let previous = start, control = null;
    const begin = first.on ? 1 : 0, end = last.on && !first.on ? points.length - 1 : points.length;
    for (let i = begin; i < end; i++) { const point = points[i]; if (point.on) { if (control) quad(previous, control, point); else line(previous, point); previous = point; control = null; } else { if (control) { const next = mid(control, point); quad(previous, control, next); previous = next; } control = point; } }
    if (control) quad(previous, control, start); else line(previous, start);
  }
  return out;
}
export function parseOpenType(data, options = {}) {
  const bytes = bytesOf(data); if (bytes.length > (options.maxBytes ?? 32 * 1024 * 1024)) fail('Font exceeds the configured byte limit');
  const root = new Reader(bytes); let directory = 0;
  if (root.tag(0) === 'ttcf') { const count = root.u32(8), index = options.collectionIndex ?? 0; root.check(12, count * 4); if (!Number.isInteger(index) || index < 0 || index >= count) fail('Invalid collection index'); directory = root.u32(12 + 4 * index); }
  const signature = root.u32(directory);
  if (![0x00010000, 0x74727565, 0x4f54544f].includes(signature)) fail('Expected TTF/OTF/TTC. Use loadFont() for WOFF1; WOFF2 is not supported.');
  const count = root.u16(directory + 4); if (count < 1 || count > 128) fail('Invalid font table count'); root.check(directory + 12, count * 16);
  const tables = new Map();
  for (let i = 0; i < count; i++) { const at = directory + 12 + 16 * i, tag = root.tag(at); if (tables.has(tag)) fail(`Duplicate ${tag} table`); tables.set(tag, root.slice(root.u32(at + 8), root.u32(at + 12), tag)); }
  const required = tag => tables.get(tag) || fail(`Missing ${tag} table; only static TrueType outlines are supported`);
  if (tables.has('CFF ') || tables.has('CFF2')) fail('CFF/CFF2 outlines are not supported. Supply a TrueType-outline font.');
  if (tables.has('fvar')) fail('Variable fonts require instancing before import. Supply a static TTF face.');
  const head = required('head'), hhea = required('hhea'), hmtx = required('hmtx'), loca = required('loca'), glyf = required('glyf'), maxp = required('maxp');
  if (head.u32(12) !== 0x5f0f3cf5) fail('Invalid head magic');
  const units = head.u16(18), glyphCount = maxp.u16(4), metricsCount = hhea.u16(34), locFormat = head.i16(50);
  if (units < 16 || units > 16384 || glyphCount < 1 || metricsCount < 1 || metricsCount > glyphCount || ![0, 1].includes(locFormat)) fail('Invalid font dimensions');
  hmtx.check(0, metricsCount * 4 + (glyphCount - metricsCount) * 2); loca.check(0, (glyphCount + 1) * (locFormat ? 4 : 2));
  const locations = Array.from({ length: glyphCount + 1 }, (_, i) => locFormat ? loca.u32(i * 4) : loca.u16(i * 2) * 2);
  if (locations.some((v, i) => v > glyf.bytes.length || i && v < locations[i - 1])) fail('Invalid loca offsets');
  const advances = Array.from({ length: glyphCount }, (_, i) => hmtx.u16(Math.min(i, metricsCount - 1) * 4));
  const bearings = Array.from({ length: glyphCount }, (_, i) => hmtx.i16(i < metricsCount ? i * 4 + 2 : metricsCount * 4 + (i - metricsCount) * 2));
  const warnings = new Set(), decoded = new Map(), visiting = new Set(); let pointBudget = 0;
  const outline = (id, depth = 0) => {
    if (id >= glyphCount) fail(`Missing composite glyph ${id}`); if (decoded.has(id)) return decoded.get(id);
    if (depth > 24 || visiting.has(id)) fail('Cyclic or excessively nested composite glyph'); visiting.add(id);
    const size = locations[id + 1] - locations[id]; let contours = [], aw = advances[id], lsb = bearings[id], xMin = 0;
    if (size) {
      const r = glyf.slice(locations[id], size, `glyph ${id}`), n = r.i16(0); r.check(0, 10); xMin = r.i16(2);
      if (n === 0 && size === 10) {
        // A zero-contour glyph may consist of only its 10-byte header (OpenType glyf).
      } else if (n >= 0) {
        r.check(10, n * 2 + 2); const ends = Array.from({ length: n }, (_, i) => r.u16(10 + i * 2));
        if (ends.some((v, i) => i && v <= ends[i - 1])) fail('Invalid contour endpoints'); const num = n ? ends.at(-1) + 1 : 0;
        if (num > 32768) fail('Glyph point limit exceeded'); const flags = []; let cursor = 12 + n * 2 + r.u16(10 + n * 2); r.check(cursor, 0);
        while (flags.length < num) { const flag = r.u8(cursor++); flags.push(flag); if (flag & 8) { const repeat = r.u8(cursor++); if (flags.length + repeat > num) fail('Repeated glyph flags exceed point count'); for (let j = 0; j < repeat; j++) flags.push(flag); } }
        const points = Array.from({ length: num }, () => ({ x: 0, y: 0, on: false })); let x = 0, y = 0;
        for (let i = 0; i < num; i++) { const f = flags[i]; if (f & 2) x += r.u8(cursor++) * (f & 16 ? 1 : -1); else if (!(f & 16)) { x += r.i16(cursor); cursor += 2; } points[i].x = x; points[i].on = Boolean(f & 1); }
        for (let i = 0; i < num; i++) { const f = flags[i]; if (f & 4) y += r.u8(cursor++) * (f & 32 ? 1 : -1); else if (!(f & 32)) { y += r.i16(cursor); cursor += 2; } points[i].y = y; }
        let start = 0; contours = ends.map(end => { const pointsInContour = points.slice(start, end + 1); start = end + 1; return pointsInContour; });
      } else {
        let cursor = 10, flags = 32, components = 0, instructions = false; const accumulated = [];
        while (flags & 32) {
          if (++components > 512) fail('Composite component limit exceeded'); flags = r.u16(cursor); const childId = r.u16(cursor + 2); cursor += 4; instructions ||= Boolean(flags & 256);
          const words = Boolean(flags & 1), xy = Boolean(flags & 2), readArg = xy ? words ? 'i16' : 'i8' : words ? 'u16' : 'u8';
          let a = r[readArg](cursor), b = r[readArg](cursor + (words ? 2 : 1)); cursor += words ? 4 : 2;
          let xx = 1, yy = 1, yx = 0, xyScale = 0; const f2 = () => { const v = r.i16(cursor) / 16384; cursor += 2; return v; };
          if ((flags & 0x1800) === 0x1800) fail('Conflicting composite offset scaling flags');
          if ([8, 64, 128].filter(bit => flags & bit).length > 1) fail('Conflicting composite transforms');
          if (flags & 8) xx = yy = f2(); else if (flags & 64) { xx = f2(); yy = f2(); } else if (flags & 128) { xx = f2(); yx = f2(); xyScale = f2(); yy = f2(); }
          const child = outline(childId, depth + 1), transform = p => ({ x: p.x * xx + p.y * xyScale, y: p.x * yx + p.y * yy, on: p.on });
          const moved = child.contours.map(c => c.map(transform));
          if (xy) { if ((flags & 0x1800) === 0x0800) { const x = a * xx + b * xyScale; b = a * yx + b * yy; a = x; } }
          else {
            const childPoints = moved.flat(), parentPoints = [...accumulated, { x: xMin - lsb, y: 0 }, { x: xMin - lsb + aw, y: 0 }];
            childPoints.push(transform({ x: child.xMin - child.lsb, y: 0 }), transform({ x: child.xMin - child.lsb + child.advance, y: 0 }));
            if (!parentPoints[a] || !childPoints[b]) fail('Unsupported or invalid composite point attachment'); const p = parentPoints[a], q = childPoints[b]; a = p.x - q.x; b = p.y - q.y;
          }
          for (const c of moved) for (const p of c) { p.x += a; p.y += b; accumulated.push(p); }
          contours.push(...moved); if (flags & 512) { aw = child.advance; lsb = child.lsb; }
        }
        if (instructions) { const n = r.u16(cursor); r.check(cursor + 2, n); }
      }
    }
    const num = contours.reduce((s, c) => s + c.length, 0); pointBudget += num; if (num > 32768 || pointBudget > (options.maxPoints ?? 2000000)) fail('Font outline point budget exceeded');
    visiting.delete(id); const result = { contours, advance: aw, lsb, xMin }; decoded.set(id, result); return result;
  };
  const cmap = parseCmap(required('cmap'), glyphCount), unit = 1 / units, names = nameTable(tables.get('name'));
  let ascender = hhea.i16(4), descender = hhea.i16(6), gap = hhea.i16(8); const os2 = tables.get('OS/2');
  if (os2 && os2.bytes.length >= 78 && os2.u16(62) & 0x80) { ascender = os2.i16(68); descender = os2.i16(70); gap = os2.i16(72); }
  if (!(ascender > descender)) fail('Invalid vertical font metrics');
  const post = tables.get('post'), positions = parsePositioning(tables.get('GPOS'), glyphCount, unit, warnings), ligatures = parseLigatures(tables.get('GSUB'), glyphCount, warnings), kern = parseKern(tables.get('kern'), glyphCount, unit);
  const glyphs = [];
  for (let id = 0; id < glyphCount; id++) {
    const raw = outline(id), segments = contoursToSegments(raw.contours, units), points = raw.contours.flat();
    let bounds = [0, 0, 0, 0]; if (points.length) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of points) { x0 = Math.min(x0, p.x * unit); x1 = Math.max(x1, p.x * unit); y0 = Math.min(y0, -p.y * unit); y1 = Math.max(y1, -p.y * unit); } bounds = [x0, y0, x1, y1]; }
    glyphs.push({ id, segments, bounds, advance: raw.advance * unit, bearing: raw.lsb * unit, stroke: 0 });
  }
  return { format: 'helion-opentype-1', family: options.family || names.get(16) || names.get(1) || 'Imported font', weight: options.weight ?? (os2 && os2.bytes.length >= 8 ? os2.u16(4) : 400), style: options.style || (post && post.bytes.length >= 8 && post.u32(4) ? 'italic' : 'normal'), units: 1, sourceUnits: units,
    ascent: ascender * unit, descent: -descender * unit, lineGap: Math.max(0, gap * unit), underlinePosition: post && post.bytes.length >= 12 ? -post.i16(8) * unit : .1, underlineThickness: post && post.bytes.length >= 12 ? Math.max(unit, post.i16(10) * unit) : .05,
    strikePosition: os2 && os2.bytes.length >= 30 ? -os2.i16(28) * unit : -.3, strikeThickness: os2 && os2.bytes.length >= 28 ? Math.max(unit, os2.i16(26) * unit) : .05,
    cmap, glyphs, positions, ligatures, kern, layout: captureLayoutTables(tables, glyphCount, units), warnings: [...warnings], sourceBytes: bytes.length };
}

/** Decode WOFF1 losslessly with the browser/Node standard deflate stream. WOFF2/CFF fail explicitly. */
export async function decodeWOFF(data) {
  const bytes = bytesOf(data), r = new Reader(bytes, 'WOFF'); if (r.tag(0) !== 'wOFF') return bytes;
  const length = r.u32(8), count = r.u16(12), total = r.u32(16); if (length !== bytes.length || count > 128 || !count || r.u16(14) !== 0 || total < 12 + count * 16 || total > 32 * 1024 * 1024 || total % 4 !== 0) fail('Invalid WOFF dimensions'); r.check(44, count * 20);
  const output = new Uint8Array(total), v = new DataView(output.buffer); let position = 12 + count * 16; v.setUint32(0, r.u32(4)); v.setUint16(4, count);
  const power = 2 ** Math.floor(Math.log2(count)); v.setUint16(6, power * 16); v.setUint16(8, Math.log2(power)); v.setUint16(10, count * 16 - power * 16);
  for (let i = 0; i < count; i++) { const at = 44 + i * 20, off = r.u32(at + 4), compressed = r.u32(at + 8), original = r.u32(at + 12); r.check(off, compressed); if (compressed > original || position + original > total) fail('Invalid WOFF table size'); let table = bytes.subarray(off, off + compressed);
    if (compressed !== original) {
      if (typeof DecompressionStream !== 'function') fail('This environment has no standard WOFF1 decompressor');
      const reader = new Blob([table]).stream().pipeThrough(new DecompressionStream('deflate')).getReader(); const decoded = new Uint8Array(original); let written = 0;
      try { for (;;) { const { value, done } = await reader.read(); if (done) break; if (written + value.length > original) { await reader.cancel(); fail('WOFF expansion exceeds its declared length'); } decoded.set(value, written); written += value.length; } } finally { reader.releaseLock(); }
      if (written !== original) fail('WOFF table length mismatch'); table = decoded;
    }
    const dest = 12 + i * 16; v.setUint32(dest, r.u32(at)); v.setUint32(dest + 4, r.u32(at + 16)); v.setUint32(dest + 8, position); v.setUint32(dest + 12, original); output.set(table, position); position = (position + original + 3) & ~3;
  }
  if (position !== total) fail('WOFF totalSfntSize mismatch'); return output;
}
export async function loadFont(source, options = {}) {
  let bytes;
  if (typeof source === 'string' || source instanceof URL) {
    const controller = new AbortController(), abort = () => controller.abort(options.signal?.reason), timeout = setTimeout(() => controller.abort(new Error('Font request timed out')), options.timeoutMs ?? 20000);
    options.signal?.addEventListener('abort', abort, { once: true }); if (options.signal?.aborted) abort();
    try {
      const response = await fetch(source, { signal: controller.signal, credentials: 'omit' }); if (!response.ok) throw new Error(`Font request failed: HTTP ${response.status}`);
      const max = options.maxBytes ?? 32 * 1024 * 1024; if (Number(response.headers.get('Content-Length')) > max) fail('Font response exceeds byte limit');
      if (response.body) { const reader = response.body.getReader(), chunks = []; let length = 0; try { for (;;) { const { value, done } = await reader.read(); if (done) break; length += value.byteLength; if (length > max) { await reader.cancel(); fail('Font response exceeds byte limit'); } chunks.push(value); } } finally { reader.releaseLock(); } bytes = new Uint8Array(length); let p = 0; for (const c of chunks) { bytes.set(c, p); p += c.length; } }
      else bytes = new Uint8Array(await response.arrayBuffer());
    } finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', abort); }
  } else if (typeof Blob !== 'undefined' && source instanceof Blob) { if (source.size > (options.maxBytes ?? 32 * 1024 * 1024)) fail('Font file exceeds byte limit'); bytes = new Uint8Array(await source.arrayBuffer()); }
  else bytes = bytesOf(source);
  return parseOpenType(await decodeWOFF(bytes), options);
}
