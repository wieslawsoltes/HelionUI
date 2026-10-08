// Independent CPU reference routines used ONLY by tests, never imported into the runtime.
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export function edgeArea([ax, ay, bx, by], [px, py]) {
  ax -= px; bx -= px; ay -= py; by -= py;
  const dy = by - ay, lo = Math.max(0, Math.min(ay, by)), hi = Math.min(1, Math.max(ay, by));
  if (Math.abs(dy) < 1e-7 || hi <= lo) return 0;
  const x0 = ax + (lo - ay) * (bx - ax) / dy, x1 = ax + (hi - ay) * (bx - ax) / dy;
  const primitive = x => x <= 0 ? x : x >= 1 ? .5 : x - x * x / 2;
  const average = Math.abs(x1 - x0) > 1e-6 ? (primitive(x1) - primitive(x0)) / (x1 - x0) : clamp(1 - x0, 0, 1);
  return (hi - lo) * average * (dy > 0 ? 1 : -1);
}
export function polygonCoverage(points, pixel, evenOdd = false) {
  let area = 0;
  for (let i = 0; i < points.length; i++) area += edgeArea([...points[i], ...points[(i + 1) % points.length]], pixel);
  return evenOdd ? clamp(1 - Math.abs(1 - Math.abs(area) % 2), 0, 1) : clamp(Math.abs(area), 0, 1);
}
export function scanCompact(mask, blockSize = 128) {
  const local = new Uint32Array(mask.length), sums = [], offsets = []; let sum = 0;
  for (let start = 0; start < mask.length; start += blockSize) {
    let block = 0; for (let i = start; i < Math.min(mask.length, start + blockSize); i++) { local[i] = block; block += mask[i] ? 1 : 0; }
    sums.push(block); offsets.push(sum); sum += block;
  }
  const result = new Uint32Array(sum);
  for (let i = 0; i < mask.length; i++) if (mask[i]) result[local[i] + offsets[Math.floor(i / blockSize)]] = i;
  return { result, local, sums, offsets };
}
export function bitonic(values, less = (a, b) => a < b) {
  const n = 2 ** Math.ceil(Math.log2(Math.max(1, values.length))), list = Array.from({ length: n }, (_, i) => i < values.length ? values[i] : null);
  const lt = (a, b) => a === null ? false : b === null ? true : less(a, b);
  for (let k = 2; k <= n; k *= 2) for (let j = k / 2; j > 0; j /= 2) for (let i = 0; i < n; i++) {
    const other = i ^ j; if (other <= i) continue;
    if ((i & k) === 0 ? lt(list[other], list[i]) : lt(list[i], list[other])) [list[i], list[other]] = [list[other], list[i]];
  }
  return list.filter(v => v !== null);
}
export function stripEncode(tiles) {
  const strips = []; let run = -1;
  for (let x = 0; x < tiles.length; x++) {
    const tile = tiles[x];
    if (tile.every(v => v === 255)) { if (run < 0) run = x; continue; }
    if (run >= 0) { strips.push({ start: run, end: x, alpha: null }); run = -1; }
    if (tile.some(v => v !== 0)) strips.push({ start: x, end: x + 1, alpha: [...tile] });
  }
  if (run >= 0) strips.push({ start: run, end: tiles.length, alpha: null });
  return strips;
}
export function stripDecode(strips, tileCount) {
  const result = Array.from({ length: tileCount }, () => Array(16).fill(0));
  for (const strip of strips) for (let i = strip.start; i < strip.end; i++) result[i] = strip.alpha || Array(16).fill(255);
  return result;
}
export function seeded(seed = 123456789) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
