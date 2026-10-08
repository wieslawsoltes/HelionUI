/** Resident metrics schema 3. Inspection/oracles are explicit, never the live UI path. */
export const METRICS_BYTES = 16384;
export const METRICS_SCHEMA = 3;
export const TIMESTAMP_COUNT = 16;
export const TIMING_PHASES = Object.freeze(['input', 'layout', 'data', 'scene', 'glyph', 'sparse', 'hud', 'present']);
export const HISTORY_OFFSET = 32;
export const DETAIL_OFFSET = 512;
export const DETAIL_STRIDE = 24;
export const HISTORY_SAMPLES = 120;
export const EXTRA_OFFSET = DETAIL_OFFSET + HISTORY_SAMPLES * DETAIL_STRIDE; // 3392
export const RAW_OFFSET = EXTRA_OFFSET + 32;
export function timingDetail(value = 'frame') {
  if (value !== 'off' && value !== 'frame' && value !== 'stages') throw new RangeError('timingDetail must be "off", "frame" or "stages"');
  return value;
}
export function timingMask(flags) {
  if (!(flags & 2)) return 0;
  if (flags & 512) return 1 | 8 | 32 | 128 | (flags & 4 ? 2 : 0) | (flags & 8 ? 4 : 0) | (flags & 256 ? 16 : 0) | (flags & 1 ? 64 : 0);
  return 1 | 128 | (flags & 4 ? 2 : 0) | (flags & 8 ? 4 : 0) | (flags & (4 | 8) ? 8 : 0);
}
/** Direct near-submit delta; bit zero remains the full-invalidation bit. */
export function packFrameInterval(intervalMs, invalidate = false) {
  const units = Number.isFinite(intervalMs) && intervalMs > 0 ? Math.round(intervalMs * 1024) : 0;
  return (((units > 0 && units <= 0x7fffffff ? units : 0) * 2) + (invalidate ? 1 : 0)) >>> 0;
}
const u64 = pair => (BigInt(pair[1] >>> 0) << 32n) | BigInt(pair[0] >>> 0);
export function timestampMilliseconds(a, b) {
  const start = u64(a), end = u64(b);
  if (end < start || end - start > 60000000000n) return -1;
  return Number(end - start) / 1e6;
}
/** Independent integer interval-union oracle. Overlap is legal, not a clock error.
 * No sum of overlapping pass lifetimes is described as wall duration or GPU busy time.
 */
export function timestampRanges(words, mask) {
  if (!(words instanceof Uint32Array) || words.length < 32) throw new TypeError('Expected sixteen u64 timestamps');
  const ranges = [];
  for (let i = 0; i < 8; i++) if (mask & (1 << i)) {
    const start = u64(words.subarray(i * 4, i * 4 + 2)), end = u64(words.subarray(i * 4 + 2, i * 4 + 4));
    if (end < start || end - start > 60000000000n) return { valid: false, spanMs: -1, coveredMs: -1, overlapMs: -1, gapMs: -1, sumMs: -1 };
    ranges.push({ phase: i, start, end });
  }
  if (!ranges.length) return { valid: false, spanMs: -1, coveredMs: -1, overlapMs: -1, gapMs: -1, sumMs: -1 };
  ranges.sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : a.phase - b.phase);
  const first = ranges[0].start; let last = first, covered = 0n, sum = 0n;
  for (const r of ranges) { sum += r.end - r.start; const start = r.start > last ? r.start : last; if (r.end > start) covered += r.end - start; if (r.end > last) last = r.end; }
  if (last - first > 60000000000n) return { valid: false, spanMs: -1, coveredMs: -1, overlapMs: -1, gapMs: -1, sumMs: -1 };
  const ms = n => Number(n) / 1e6;
  return { valid: true, first, last, spanMs: ms(last - first), coveredMs: ms(covered), overlapMs: ms(sum - covered), gapMs: ms(last - first - covered), sumMs: ms(sum) };
}
export function decodePerformance(words) {
  if (!(words instanceof Uint32Array) || words.byteLength < METRICS_BYTES || words[31] !== METRICS_SCHEMA) throw new TypeError('Expected a complete Helion metrics schema-3 buffer');
  const floats = new Float32Array(words.buffer, words.byteOffset, words.length);
  const count = Math.min(HISTORY_SAMPLES, words[1]), oldest = (words[0] + HISTORY_SAMPLES - count) % HISTORY_SAMPLES;
  const history = Array.from({ length: count }, (_, i) => {
    const slot = (oldest + i) % HISTORY_SAMPLES, at = HISTORY_OFFSET + slot * 4, detail = DETAIL_OFFSET + slot * DETAIL_STRIDE;
    const mask = words[detail + 15], detailed = !!(words[detail + 16] & 512);
    const phasesMs = Object.fromEntries(TIMING_PHASES.map((key, j) => [key, floats[detail + j]]));
    return { frame: words[detail + 11], submitIntervalMs: floats[at], layoutMs: floats[at + 1], totalMs: floats[at + 2], gpuSpanMs: words[2] ? floats[at + 2] : null, dataMs: floats[at + 3],
      phasesMs, phaseMeaning: detailed ? 'individual pass elapsed ranges, potentially overlapping' : 'input=combined compute when layout/data absent; scene=remaining compute when split; merged phases unavailable',
      timingDetail: words[detail + 16] & 2048 ? 'off' : detailed ? 'stages' : 'frame', measuredPhaseMask: mask, layoutExecuted: !!words[detail + 17],
      cpuEncodeMs: floats[detail + 8], uiRenderMs: floats[detail + 9], gpuCompletionIntervalMs: floats[detail + 10],
      coveredMs: floats[detail + 12], overlapMs: floats[detail + 13], gapMs: floats[detail + 14], computeCoveredMs: floats[detail + 18], passSumMs: floats[detail + 19] };
  });
  const mask = words[EXTRA_OFFSET + 6];
  const rawTimestamps = Array.from({ length: 8 }, (_, i) => ({ phase: TIMING_PHASES[i], meaning: words[EXTRA_OFFSET+5] ? TIMING_PHASES[i] : i === 0 && !(words[30]&12) ? 'combined compute' : i === 3 ? 'remaining compute' : TIMING_PHASES[i], measured: !!(mask & (1 << i)),
    startNs: u64(words.subarray(RAW_OFFSET + i * 4, RAW_OFFSET + i * 4 + 2)).toString(), endNs: u64(words.subarray(RAW_OFFSET + i * 4 + 2, RAW_OFFSET + i * 4 + 4)).toString() }));
  return { schema: METRICS_SCHEMA, source: words[2] ? 'gpu-elapsed-ranges' : 'cpu-encoding-only', submissionMode: words[18] ? 'asap' : 'vsync',
    vsyncPacing: words[30] & 4096 ? 'bounded' : 'unbounded',
    timingDetail: words[30] & 2048 ? 'off' : words[EXTRA_OFFSET + 5] ? 'stages' : 'frame', sampleFrame: words[13], rawTimestampFrame: words[13], rawTimestamps,
    displayedSampleLag: 'previous submitted sample; neither busy-time nor presentation timestamps',
    submitFPS: floats[3], gpuCompletionFPS: words[2] && floats[9] > 0 ? floats[9] : null, rafHz: floats[12], rafBudgetMs: floats[11], timestampErrors: words[19],
    current: history.at(-1) ?? null, history };
}
