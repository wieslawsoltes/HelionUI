import { loadFont } from './opentype.js';
import { fbits } from '../core/schema.js';
import { vectorAlphabet } from '../render/vector-alphabet.js';

// Version-pinned public assets are fetched by the user's browser, not redistributed in this package.
const noto = 'https://raw.githubusercontent.com/notofonts/noto-fonts/v20201206-phase3/hinted/ttf/NotoSans/';
export const DEFAULT_FONT_SOURCES = Object.freeze([
  Object.freeze({ family: 'Noto Sans', weight: 400, style: 'normal', source: `${noto}NotoSans-Regular.ttf` }),
  Object.freeze({ family: 'Noto Sans', weight: 600, style: 'normal', source: `${noto}NotoSans-SemiBold.ttf` }),
  Object.freeze({ family: 'Noto Sans', weight: 400, style: 'italic', source: `${noto}NotoSans-Italic.ttf` })
]);
export async function loadFonts(descriptors = [DEFAULT_FONT_SOURCES[0]]) {
  if (!Array.isArray(descriptors) || !descriptors.length || descriptors.length > 8) throw new TypeError('Supply 1–8 font faces');
  return Promise.all(descriptors.map(d => d?.format === 'helion-opentype-1' ? d : loadFont(d.source, d)));
}
/** Convert the original diagnostic alphabet into the same font ABI. Not a real-font fallback. */
export function diagnosticFont(alphabet = vectorAlphabet()) {
  if (!(alphabet.units > 0 && Number.isFinite(alphabet.units)) || !Array.isArray(alphabet.glyphs)) throw new TypeError('Invalid vector font asset');
  const scale = 1 / alphabet.units, cmap = new Map(), glyphs = [{ id: 0, segments: [], bounds: [0,0,0,0], stroke: 0, advance: .5 }];
  for (const glyph of alphabet.glyphs) {
    if (!Number.isInteger(glyph.code) || glyph.code < 0 || glyph.code > 0x10ffff || cmap.has(glyph.code)) throw new TypeError('Invalid or duplicate vector glyph code');
    if (!(glyph.advance >= 0 && Number.isFinite(glyph.advance) && glyph.stroke >= 0 && Number.isFinite(glyph.stroke))) throw new TypeError('Invalid vector glyph metrics');
    cmap.set(glyph.code, glyphs.length);
    // Diagnostic glyphs use a top origin. Move them to the normalized baseline contract.
    glyphs.push({ id: glyphs.length, advance: glyph.advance * scale, stroke: glyph.stroke * scale,
      bounds: glyph.bounds.map((x, k) => x * scale - (k % 2 ? 1 : 0)),
      segments: glyph.segments.map(s => s.map((x, k) => k === 0 ? x : x * scale - (k % 2 === 0 && k <= 4 + 2 * s[0] ? 1 : 0))) });
  }
  const fallback = cmap.get(alphabet.fallback || 63) || 0; glyphs[0] = { ...glyphs[fallback], id: 0 };
  return { format: 'helion-opentype-1', diagnostic: true, family: 'Helion Diagnostic', weight: 400, style: 'normal', units: 1,
    ascent: 1, descent: .2, lineGap: .15, underlinePosition: .1, underlineThickness: .05, strikePosition: -.3, strikeThickness: .05,
    glyphs, cmap, kern: [], ligatures: new Map(), positions: new Map(), warnings: ['Original diagnostic alphabet, not production typography'], sourceBytes: 0 };
}
export function selectFace(fonts, family, weight = 400, style = 'normal') {
  const families = String(family || fonts[0].family).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
  let candidates = fonts; for (const name of families) { const matching = fonts.filter(f => f.family.toLowerCase() === name); if (matching.length) { candidates = matching; break; } }
  return candidates.reduce((best, font) => Math.abs(font.weight - weight) + (font.style === style ? 0 : 10000) < Math.abs(best.weight - weight) + (best.style === style ? 0 : 10000) ? font : best);
}
export const SCRIPT_TAGS = ['DFLT', 'latn', 'grek', 'cyrl'];
function packPairs(heap, groups, glyphCount) {
  return heap.push([groups.length, ...groups.map(group => heap.push([group.length, ...group.map(sub => {
    if (sub.kind === 1) {
      const byLeft = new Map(); for (const [left, right, value] of sub.values) { if (!byLeft.has(left)) byLeft.set(left, []); byLeft.get(left).push([right, fbits(value)]); }
      const index = heap.alloc(glyphCount * 2);
      for (const [gid, pairs] of byLeft) { pairs.sort((a,b) => a[0] - b[0]); heap.set(index + gid * 2, [heap.push(pairs.flat()), pairs.length]); }
      return heap.push([1, index, 0, 0, 0]);
    }
    const covered = new Set(sub.coverage), left = heap.push(Array.from(sub.class1, (v, id) => covered.has(id) ? v + 1 : 0)), right = heap.push([...sub.class2]);
    return heap.push([2, left, right, sub.n2, heap.push(Array.from(sub.values, fbits))]);
  })]))]);
}
function packLigatures(heap, items, glyphCount) {
  const byLeft = new Map(), index = heap.alloc(glyphCount * 2);
  for (const l of items) { if (!byLeft.has(l.input[0])) byLeft.set(l.input[0], []); byLeft.get(l.input[0]).push(l); }
  for (const [first, values] of byLeft) heap.set(index + first * 2, [heap.push(values.flatMap(l => [l.target, l.input.length, ...l.input, ...Array(10 - l.input.length).fill(0)])), values.length]);
  return index;
}
function packMarks(heap, groups, glyphCount) {
  const descriptors = [];
  for (const group of groups) for (const sub of group) {
    const marks = heap.alloc(glyphCount * 3), bases = heap.alloc(glyphCount), anchors = [];
    for (const [gid, cls, x, y] of sub.marks) heap.set(marks + gid * 3, [cls + 1, fbits(x), fbits(y)]);
    for (const [gid, ...values] of sub.bases) { heap.set(bases + gid, [anchors.length + 1]); for (const anchor of values) anchors.push(...(anchor ? [1, ...anchor.map(fbits)] : [0, 0, 0])); }
    descriptors.push(heap.push([sub.kind, marks, bases, heap.push(anchors), sub.classCount]));
  }
  return heap.push([descriptors.length, ...descriptors]);
}
export function packFonts(heap, fonts, addPath) {
  const pointers = new Map(), manifests = [];
  for (const font of fonts) {
    if (font.format !== 'helion-opentype-1' || font.units !== 1 || !(font.cmap instanceof Map) || !Array.isArray(font.glyphs) || !font.glyphs.length) throw new TypeError('Expected a prepared font from loadFont()/parseOpenType()');
    const descriptor = heap.alloc(16), records = heap.alloc(font.glyphs.length * 4), directory = heap.alloc(0x1100), pages = new Map();
    for (const [cp, gid] of font.cmap) {
      if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff || cp >= 0xd800 && cp <= 0xdfff || !Number.isInteger(gid) || gid < 0 || gid >= font.glyphs.length) throw new TypeError('Invalid prepared font cmap');
      const page = cp >>> 8; if (!pages.has(page)) { const at = heap.alloc(256); pages.set(page, at); heap.set(directory + page, [at]); } heap.set(pages.get(page) + (cp & 255), [gid + 1]);
    }
    font.glyphs.forEach((glyph, gid) => {
      if (!(glyph.advance >= 0 && Number.isFinite(Math.fround(glyph.advance)))) throw new TypeError('Invalid glyph advance');
      const path = glyph.segments.length ? addPath(glyph.segments, glyph.stroke || 0, glyph.bounds, 0, !font.diagnostic) : 0;
      heap.set(records + gid * 4, [path, fbits(glyph.advance), fbits(glyph.bearing || 0), 0]);
    });
    const plans = heap.alloc(4 * 4), planMemo = new Map();
    for (const [scriptIndex, script] of SCRIPT_TAGS.entries()) {
      const pos = font.positions.get(script), lig = font.ligatures.get(script) || [];
      const pairGroups = pos?.pairs?.length ? pos.pairs : font.kern.length ? [[{ kind: 1, values: font.kern }]] : [];
      // Identical script plans share storage. Typed arrays serialize by value once at mount.
      const signature = JSON.stringify([pairGroups, lig, pos?.attachments || []]);
      let data = planMemo.get(signature);
      if (!data) { data = [packPairs(heap, pairGroups, font.glyphs.length), packLigatures(heap, lig, font.glyphs.length), packMarks(heap, pos?.attachments || [], font.glyphs.length), 0]; planMemo.set(signature, data); }
      heap.set(plans + scriptIndex * 4, data);
    }
    heap.set(descriptor, [fbits(font.ascent), fbits(font.descent), fbits(font.lineGap), font.glyphs.length, records, directory, plans, font.cmap.get(0xfffd) || 0,
      fbits(font.underlinePosition), fbits(font.underlineThickness), fbits(font.strikePosition), fbits(font.strikeThickness), font.diagnostic ? 0 : 1, 0, 0, 0]);
    pointers.set(font, descriptor); manifests.push({ family: font.family, weight: font.weight, style: font.style, glyphCount: font.glyphs.length, mappedScalars: font.cmap.size, sourceBytes: font.sourceBytes, warnings: [...font.warnings], diagnostic: !!font.diagnostic });
  }
  const compositions = new Map();
  for (const font of fonts) for (const cp of font.cmap.keys()) {
    const sequence = Array.from(String.fromCodePoint(cp).normalize('NFD'));
    if (sequence.length < 2 || sequence.length > 8) continue; let base = sequence[0];
    for (let i = 1; i < sequence.length; i++) { const joined = (base + sequence[i]).normalize('NFC'); if (Array.from(joined).length !== 1) break;
      const a = base.codePointAt(0), b = sequence[i].codePointAt(0), c = joined.codePointAt(0); compositions.set(a * 0x110000 + b, [a, b, c]); base = joined;
    }
  }
  const compose = [...compositions.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { pointers, manifests, composition: heap.push(compose.flat()), compositionCount: compose.length };
}
/** Unicode category ranges for combining-sequence editing. Built once; no Unicode work in the host frame loop. */
let markRanges;
/** Bulk native matching replaces a million individual JS regexp calls. Keep the
 * running engine's Unicode semantics (including newer marks), not a pinned subset.
 * Chunks never cross the BMP boundary, so UTF-16 match offsets convert exactly.
 */
export function combiningRanges() {
  if (markRanges) return markRanges;
  const ranges = [], chunk = new Uint32Array(4096);
  const mark = /[\p{M}\uFE00-\uFE0F\u{E0100}-\u{E01EF}]+/gu;
  for (let base = 0; base < 0x110000; base += 4096) {
    for (let i = 0; i < 4096; i++) chunk[i] = base + i;
    const block = String.fromCodePoint(...chunk), units = base < 0x10000 ? 1 : 2;
    for (const match of block.matchAll(mark)) {
      const first = base + match.index / units, last = first + match[0].length / units - 1;
      if (ranges.length && ranges[ranges.length - 1] + 1 === first) ranges[ranges.length - 1] = last;
      else ranges.push(first, last);
    }
  }
  markRanges = Object.freeze(ranges); return markRanges;
}
