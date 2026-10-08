/** Observed rAF rate = interval count / elapsed time, NOT nominal monitor Hz.
 * Every callback participates, including ones refused by an explicit submission cap.
 * Bounded 120-entry / approximately 500ms window; no time-weighted reciprocal bias.
 */
export class FrameCadence {
  constructor() { this.intervals = new Float64Array(120); this.ticks = 0; this.reset(); }
  reset() { this.previous = null; this.intervalMs = 0; this.lastIntervalMs = 0; this.head = 0; this.count = 0; this.elapsed = 0; }
  tick(now) {
    if (!Number.isFinite(now)) { this.reset(); return; }
    this.ticks++;
    const delta = this.previous == null ? 0 : now - this.previous;
    this.previous = now;
    if (delta <= 0 || delta >= 250) { this.reset(); this.previous = now; return; }
    this.lastIntervalMs = delta;
    if (this.count === 120) { this.elapsed -= this.intervals[this.head]; this.head = (this.head + 1) % 120; this.count--; }
    this.intervals[(this.head + this.count) % 120] = delta; this.elapsed += delta; this.count++;
    while (this.count > 1 && this.elapsed - this.intervals[this.head] >= 500) {
      this.elapsed -= this.intervals[this.head]; this.head = (this.head + 1) % 120; this.count--;
    }
    this.intervalMs = this.elapsed / this.count;
  }
  get hz() { return this.intervalMs > 0 ? 1000 / this.intervalMs : 0; }
  get packed() { return Math.min(65535, Math.max(0, Math.round(this.intervalMs * 256))) << 16; }
}
