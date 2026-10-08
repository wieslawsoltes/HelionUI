/** Completion metadata only: never maps buffers and never schedules a vsync frame.
 * A bounded producer registers EACH submitted tail immediately. Waiting for an
 * older notification before registering a newer tail adds artificial latency.
 */
export class QueueProgress {
  constructor(queue, { now = () => performance.now(), onComplete = () => {}, onError = () => {} } = {}) {
    this.queue = queue; this.now = now; this.onComplete = onComplete; this.onError = onError;
    this.acknowledged = 0; this.lastRequested = 0; this.requests = 0;
    this.pending = new Map(); this.disposed = false;
  }
  request(serial, { independent = false, force = false } = {}) {
    if (!Number.isSafeInteger(serial) || serial < 0) throw new RangeError('Expected a nonnegative submission serial');
    if (this.disposed || serial <= this.acknowledged) return Promise.resolve();
    const same = this.pending.get(serial); if (same) return same.promise;
    // Only the explicitly unbounded reference mode uses sparse checkpoints.
    if (!independent && !force && this.pending.size) return [...this.pending.values()].at(-1).promise;
    const token = { serial, requestedAt: this.now(), promise: null };
    let completion;
    try { completion = this.queue.onSubmittedWorkDone(); } catch (error) { completion = Promise.reject(error); }
    this.requests++; this.lastRequested = Math.max(this.lastRequested, serial);
    token.promise = Promise.resolve(completion).then(() => {
      this.pending.delete(serial); if (this.disposed) return;
      // A later tail acknowledges its entire prefix. Out-of-order JS delivery
      // must neither return the same credit twice nor move the high-water back.
      const released = Math.max(0, serial - this.acknowledged);
      this.acknowledged = Math.max(this.acknowledged, serial);
      for (const earlier of this.pending.keys()) if (earlier <= this.acknowledged) this.pending.delete(earlier);
      const completedAt = this.now();
      this.onComplete({ serial, acknowledged: this.acknowledged, released,
        requestedAt: token.requestedAt, completedAt, notificationMs: completedAt - token.requestedAt });
    }, error => {
      this.pending.delete(serial); if (!this.disposed) this.onError(error); throw error;
    });
    this.pending.set(serial, token);
    // Automatic progress listeners must not produce unhandled rejections. The
    // original rejecting promise remains available to explicit waiters.
    token.promise.catch(() => {});
    return token.promise;
  }
  dispose() { this.disposed = true; this.pending.clear(); }
}
