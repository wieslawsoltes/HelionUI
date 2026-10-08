/** Admission control only; no GPU buffer mapping or retained-state polling. */
export class FrameGate {
  constructor(limit = 0) {
    if (!Number.isInteger(limit) || limit < 0 || limit > 32) throw new RangeError('maxFramesInFlight must be an integer from 0 (no vsync gate) through 32');
    this.limit = limit; this.inFlight = 0; this.peak = 0; this.skipped = 0;
  }
  acquire() {
    if (this.limit > 0 && this.inFlight >= this.limit) { this.skipped++; return false; }
    this.inFlight++; this.peak = Math.max(this.peak, this.inFlight); return true;
  }
  release(count = 1) { this.inFlight = Math.max(0, this.inFlight - count); }
}
/** Immutable global sort stages; the 256-row local stage is a single dispatch. */
export function mergePlan(paddedCount) {
  if (!Number.isInteger(paddedCount) || paddedCount < 1 || paddedCount > 65536 || (paddedCount & (paddedCount - 1))) throw new RangeError('Expected a padded power-of-two row count');
  const stages = [];
  for (let width = 256, source = 0; width < paddedCount; width *= 2, source ^= 1) stages.push([width, source, 0, 0]);
  return stages;
}
