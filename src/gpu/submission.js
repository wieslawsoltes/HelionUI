/** Browser task pump for opt-in throughput mode. Never a microtask/busy loop. */
export class SubmissionTasks {
  constructor() { this.channel = null; this.pending = 0; this.serial = 0; this.timer = null; this.callback = null; }
  schedule(callback) {
    if (this.pending) return;
    const token = ++this.serial; this.pending = token; this.callback = callback;
    if (typeof MessageChannel === 'function') {
      if (!this.channel) {
        this.channel = new MessageChannel();
        this.channel.port1.onmessage = event => this.run(event.data);
        this.channel.port1.unref?.(); this.channel.port2.unref?.();
      }
      this.channel.port2.postMessage(token);
    } else this.timer = setTimeout(() => this.run(token), 0);
  }
  run(token) {
    if (token !== this.pending) return; // stale message after stop / mode switch / hide
    const callback = this.callback; this.pending = 0; this.callback = null; this.timer = null;
    callback?.();
  }
  cancel() {
    this.pending = 0; this.callback = null;
    if (this.timer != null) clearTimeout(this.timer); this.timer = null;
  }
  dispose() { this.cancel(); this.channel?.port1.close(); this.channel?.port2.close(); this.channel = null; }
}

export function submissionMode(value = 'vsync') {
  if (value !== 'vsync' && value !== 'asap') throw new TypeError('submissionMode must be "vsync" or "asap"');
  return value;
}
