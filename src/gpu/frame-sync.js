/** A bounded log of host scheduling metadata, NOT a GPU/UI-state mirror.
 * Recording is O(1); percentile calculations happen only on explicit inspection.
 */
export class FrameSyncLog {
  constructor(capacity = 240) {
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > 4096) throw new RangeError('Frame log capacity must be 2–4096');
    this.capacity = capacity; this.data = new Float64Array(capacity * 8); this.next = 0; this.count = 0;
  }
  record(serial, callbackStamp, callbackArrival, encodeStart, encodeEnd, submitStart, submitEnd, source) {
    const at = this.next * 8, d = this.data;
    d[at] = serial; d[at+1] = callbackStamp; d[at+2] = callbackArrival; d[at+3] = encodeStart;
    d[at+4] = encodeEnd; d[at+5] = submitStart; d[at+6] = submitEnd; d[at+7] = source;
    this.next = (this.next + 1) % this.capacity; this.count = Math.min(this.capacity, this.count + 1);
  }
  inspect() {
    const rows = Array.from({ length: this.count }, (_, i) => {
      const at = ((this.next + this.capacity - this.count + i) % this.capacity) * 8, d = this.data;
      return { frame:d[at], source:['manual','raf','asap'][d[at+7]], callbackStampMs:d[at+1], callbackArrivalMs:d[at+2],
        encodeStartMs:d[at+3], encodeEndMs:d[at+4], submitStartMs:d[at+5], submitEndMs:d[at+6],
        callbackOffsetMs:d[at+7]===1?d[at+2]-d[at+1]:null, cpuEncodeMs:d[at+4]-d[at+3], cpuSubmitMs:d[at+6]-d[at+5] };
    });
    const summary = values => {
      values = values.filter(Number.isFinite).sort((a,b)=>a-b);
      const quantile = p => values[Math.min(values.length-1,Math.floor((values.length-1)*p))] ?? null;
      return {count:values.length,min:quantile(0),median:quantile(.5),p95:quantile(.95),max:quantile(1)};
    };
    const intervals = rows.slice(1).map((r,i)=>r.submitStartMs-rows[i].submitStartMs);
    return {source:'host-monotonic-clock', scope:'Submission cadence and API durations, not GPU work, queue depth, or scanout',
      samples:rows, submitIntervalMs:summary(intervals), cpuEncodeMs:summary(rows.map(r=>r.cpuEncodeMs)), cpuSubmitMs:summary(rows.map(r=>r.cpuSubmitMs)),
      callbackOffsetMs:summary(rows.flatMap(r=>r.callbackOffsetMs==null?[]:[r.callbackOffsetMs]))};
  }
}
/** Conservative physical scissor for the existing antialiased HUD and 10px shadow.
 * It changes shader coverage outside the panel, never glyph resolution or positions.
 */
export function hudScissor(v) {
  const scale = Math.max(.01,Math.min(1,(v.width-16)/420,(v.height-16)/338));
  const originX=Math.max(8,v.width-420*scale-12),originY=Math.max(8,v.height-338*scale-74);
  const margin=12*scale*v.dpr+2;
  const x=Math.max(0,Math.floor(originX*v.dpr-margin)),y=Math.max(0,Math.floor(originY*v.dpr-margin));
  const right=Math.min(v.w,Math.ceil((originX+420*scale)*v.dpr+margin)),bottom=Math.min(v.h,Math.ceil((originY+338*scale)*v.dpr+margin));
  return [x,y,Math.max(0,right-x),Math.max(0,bottom-y)];
}

const OPPORTUNITY_OUTCOMES = ['submitted', 'deferred-capacity', 'asap-observer', 'duplicate-callback', 'error'];
/** Every delivered rAF, including capacity deferrals. Not a dropped-display-frame counter. */
export class FrameOpportunityLog {
  constructor(capacity = 240) {
    if (!Number.isInteger(capacity) || capacity < 2 || capacity > 4096) throw new RangeError('Frame log capacity must be 2–4096');
    this.capacity = capacity; this.data = new Float64Array(capacity * 6); this.next = 0; this.count = 0;
  }
  record(stamp, arrival, outcome, serial, pending, limit) {
    const at = this.next * 6, d = this.data;
    d[at] = stamp; d[at + 1] = arrival; d[at + 2] = outcome;
    d[at + 3] = serial; d[at + 4] = pending; d[at + 5] = limit;
    this.next = (this.next + 1) % this.capacity; this.count = Math.min(this.capacity, this.count + 1);
  }
  inspect() {
    const counts = Object.fromEntries(OPPORTUNITY_OUTCOMES.map(name => [name, 0]));
    const samples = Array.from({ length: this.count }, (_, i) => {
      const at = ((this.next + this.capacity - this.count + i) % this.capacity) * 6, d = this.data;
      const outcome = OPPORTUNITY_OUTCOMES[d[at + 2]]; counts[outcome]++;
      return { callbackStampMs: d[at], callbackArrivalMs: d[at + 1], outcome,
        submittedFrame: outcome === 'submitted' ? d[at + 3] : null,
        unacknowledgedBefore: d[at + 4], admissionLimit: d[at + 5] };
    });
    const summarize = values => {
      const v = values.filter(Number.isFinite).sort((a, b) => a - b);
      const q = p => v[Math.floor((v.length - 1) * p)] ?? null;
      return { count: v.length, min: q(0), median: q(.5), p95: q(.95), max: q(1) };
    };
    return { scope: 'Delivered browser callbacks, NOT hardware vsync or compositor dropped frames', counts, samples,
      callbackIntervalMs: summarize(samples.slice(1).map((s, i) => s.callbackStampMs - samples[i].callbackStampMs)),
      callbackArrivalIntervalMs: summarize(samples.slice(1).map((s, i) => s.callbackArrivalMs - samples[i].callbackArrivalMs)) };
  }
}
