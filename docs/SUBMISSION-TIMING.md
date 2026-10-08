# Submission and timing audit — 0.5.0-experimental

> Historical release record. Current profiling, parallel DataGrid emission and frame diagnostics are defined in [FRAME-SYNC.md](FRAME-SYNC.md).

## Changes, not a hardware-speedup claim

This release responds to reported dropped updates and disagreement between small work timings and observed frame rates. It removes the default completion-acknowledgement admission limit, adds opt-in yielding throughput mode, separates CPU submission from GPU completion cadence, and measures the HUD/final canvas pass instead of treating an incomplete UI bracket as the entire frame.

**310 host tests pass. Native shader execution, GPU pixels and actual device-rate gains remain unverified.** The browser test was blocked before loading by `ERR_BLOCKED_BY_ADMINISTRATOR`; the optional native validator could not be installed because npm registry resolution failed. Tests, code review and exact asset comparisons support the implementation changes, not a fabricated 120 FPS, 0.3 ms GPU frame or input-to-photon improvement. See [VALIDATION.md](VALIDATION.md).

## Audit findings

1. **A real admission bottleneck remained.** Version 0.4.1 requested rAF continuously but refused to submit when two completion acknowledgements were outstanding. A completed GPU frame with a late host callback could therefore cause a submission skip. This condition was checked before inputs were consumed; input preservation was correct, but default throughput depended on acknowledgement delivery.
2. **The previous Render value was partial.** It bracketed UI composition/emission/damage, glyph and sparse rendering, but excluded the diagnostic HUD and final canvas render pass. It was not a measurement of all application GPU work. Previous documentation disclosed that exclusion; this release changes the implementation, not just the label.
3. **Previous GPU values did not come from callback latency.** The old shader already converted resolved nanoseconds with unsigned low/high subtraction. There is no source evidence justifying division by an arbitrary factor to turn the screenshot's approximately 20 ms into 0.3 ms. A small CPU encode time, a small individual GPU pass, and a complete GPU span are different measurements.
4. **Frame interval precision could deteriorate.** The old history shader subtracted two f32 elapsed-seconds values. The new host sends a direct, small delta computed with the monotonic performance clock, separately from animation time.
5. **More submissions are not proof of more completed frames.** A new independent GPU end-to-end completion counter makes that distinction visible. The application does not count queue callbacks as GPU FPS or label rAF as physical scanout.

These are source/test findings. The screenshot alone does not identify which kernel, driver behavior or compositor stage caused the reported visual drops.

## Default: every available browser animation frame

Library defaults and showcase defaults now agree:

```js
const surface = await HelionSurface.mount(canvas, view, {
  submissionMode: 'vsync',
  maxFramesInFlight: 0,
  asapFramesInFlight: 8,
  performanceHUD: true
});
```

`vsync` is the name of the browser-rAF submission policy. The callback schedules its successor before encoding, then submits one complete ordered graph. Default `maxFramesInFlight:0` means **no application completion-based admission gate**. There is no fixed 60 Hz timer, fractional-refresh limiter, render-cost predictor or wait for a queue fence in this path.

Progress checkpoints run after the first frame and roughly every 16 submissions, with at most one pending automatic checkpoint. They acknowledge earlier submitted serials and report first full-frame completion; they are not prerequisites for another vsync submission. Explicit diagnostics may request an additional latest-tail checkpoint. All callbacks only update host progress metadata; they do not map control, history or framebuffer buffers.

**Tradeoff:** under sustained GPU overload, unconditional application admission can accumulate queued work, increasing latency and memory pressure. The browser/driver still applies its own backpressure. A positive `maxFramesInFlight` from 1 through 32 restores an explicit acknowledgement-based cap, accepting that delayed callbacks can again skip submission opportunities. Neither mode forces the browser to deliver the monitor's nominal frequency. RequestAnimationFrame follows browser rendering opportunities [1]; queue submission schedules work, rather than proving presentation [2].

## “As fast as possible” — off by default

The showcase toolbar exposes **As fast as possible: off/on**. A fresh mount always starts off; switching mode does not recompile, remount, replace fonts, clear input or discard GPU-owned edits.

```js
surface.setSubmissionMode('asap');
surface.setSubmissionMode('vsync');
```

ASAP uses a lazily created MessageChannel to post one render task at a time, yielding to browser work between frames. A timer is only the compatibility fallback when MessageChannel is unavailable. It is not a tight loop or recursively chained submit microtask. rAF continues as a cadence observer, not a second submission producer.

By default at most eight application submissions await acknowledgement in ASAP. `asapFramesInFlight` accepts 1–32; a positive explicit `maxFramesInFlight` takes precedence. When the cap is full, input remains queued and no new frame payload is sent. Queue progress posts a new task when credit is available, never renders directly inside the completion callback. A callback delayed by the browser can still limit this mode; the cap avoids an unbounded throughput loop.

Mode switches, stop, disposal, faults and hidden-page transitions invalidate queued task tokens. A stopped loop is not resurrected by late acknowledgements. Visibility resumption restarts the selected policy and resets the measurement epoch. These lifecycle paths have host regression tests.

ASAP controls **application submission**, not OS/browser presentation mode. Several renders may occur during one display opportunity; they need not all be shown. A higher number may consume more power without a corresponding increase in displayed frames. No physical uncapped/tearing mode is claimed.

## What each measurement means

| HUD / diagnostic | Measurement |
| --- | --- |
| **Submit FPS** | Count of host near-submit intervals divided by their total elapsed time. Approximately the newest 500 ms, bounded by 120 recorded intervals; not an average of instantaneous reciprocal rates. |
| **rAF Hz / budget** | Browser callback cadence, observed even when an explicit admission limit rejects a frame, or when ASAP is active. Unknown/manual cadence is N/A. |
| **GPU done Hz** | Rate from consecutive **end-of-final-render-pass GPU timestamps**. Includes intervening work and queue idle on the GPU timeline; not host callback delivery or physical scanout. Available only with native timestamp queries. |
| **Submit / ms** | Direct interval between host timestamps taken immediately before frame-uniform write and queue submit. Not rendering cost. |
| **Layout / ms** | GPU Measure/Arrange pass duration, or clearly labelled CPU layout encoding when native timestamps are unavailable. A skipped layout pass contributes a real zero. |
| **GPU span / ms** | First input-pass start to final canvas-pass end on the GPU timeline. Includes intervening gaps and the HUD/canvas work; not pure shader busy time. |
| **Host / ms** | CPU-only replacement for the GPU-span chart when native timestamps are unavailable. Complete command encoding through `encoder.finish()`, not GPU execution. |
| **CPU** | Same CPU encoding duration alongside GPU measurements. The final uniform write and queue.submit calls are separately available as host `stats.cpuSubmitMs`. |
| **Pass sum** | Sum of the eight measured GPU pass durations. This can differ from the larger cross-pass span. It is not a hardware utilization counter and must not be called pure shader busy time. |
| **UI** | Scene-pass start through sparse-composite-pass end. Preserves a UI-only subspan for comparison; excludes HUD preparation and canvas blit. |
| **HUD / Blit** | HUD font/format/bin compute, and final canvas copy plus diagnostic fragment rendering, respectively. |
| **Data / Input** | Query/sort/filter pass and input/scheduling pass, separately attributed. |

All duration values are milliseconds. Large card values show two decimals, small phase values three; formatting does not increase browser timestamp precision. Chrome documents both nanosecond units and privacy quantization/counter resets [3]. Equal quantized timestamps legitimately produce zero; invalid/reversed pairs become N/A/gaps and increment a diagnostic instead of being quietly clamped to zero.

GPU done Hz is not computed as `1000 / GPU span`: it measures actual end-to-end GPU cadence, including idle between submitted frames. Thus a synthetic 120 Hz submission stream with 50 Hz GPU end timestamps reports **120 Submit FPS and 50 GPU done Hz**. That is a test fixture, not an observed result for the user's device.

## Complete timing graph, without normal readback

Sixteen timestamp slots bracket eight stages:

```text
Input / scheduling          0..1
Measure / Arrange           2..3  (optional)
Data / query                4..5  (optional)
Scene / emission / damage   6..7
Glyph planning / coverage   8..9  (optional)
Sparse raster / composite 10..11
HUD preparation           12..13 (optional)
Canvas blit + overlay     14..15
  -> resolve timestamp slots to a 128-byte GPU buffer
  -> record metrics and histories on-device
```

The HUD reads the **previous submitted GPU sample**, so the next sample can include its own preparation and final presentation without a circular dependency. This is one submitted-sample lag, not a promise of one physical refresh of delay when queued work is backed up. The first display is a labelled warm-up. Histories reset on mode/visibility/collection epoch changes rather than mixing incompatible sample windows.

The metrics-recording dispatch itself, query resolution after the measured final pass, later browser composition and scanout are outside the current GPU span. The next end-to-end GPU interval includes the intervening history work. GPU span also excludes idle before its first timestamp. Normal completion callback latency is retained only as explicitly labelled host progress data, never substituted for a timestamp.

When native profiling is enabled, the UI stage is split into scene/glyph/sparse passes to attribute cost; that adds two pass boundaries and has potential overhead. Without profiling or native timestamps, the original combined UI pass is retained. Hiding the HUD without `profiling:true` omits history collection and HUD work. Profiling/HUD overhead is not claimed to be zero.

## Precision, history and protocol

The frame payload is still **64 bytes + 32 bytes per command**, with up to 256 commands in an upload. Input is still ordered, coalescing only compatible adjacent events. There is no normal CPU glyph rasterization, font/cache notification, state mirror, timing mapping or text upload loop.

Frame word 8 packs full invalidation in bit 0 and the direct near-submit interval in bits 1–31 at 1/1024 ms. Core input/damage shaders now explicitly mask bit 0 so timing data cannot dirty the whole frame. The previously used animation clock is unchanged. Frame word 9 includes the submission mode, measurement reset and optional-pass flags, while retaining the observed rAF interval in its upper bits. Words 10/11 carry CPU layout and complete encoding durations. See [PROTOCOL.md](PROTOCOL.md).

Metrics schema 2 occupies 8192 bytes. It stores 120 primary samples and parallel 12-word detail records, each tied to the same submitted-frame serial. `decodePerformance` rejects the old 2048-byte format rather than misinterpreting old Render data. Compiled node/state/heap **ABI 3 and initial-scene cache remain compatible**; the frame-uniform producer and shader consumers must come from the same release.

Additional fixed storage over 0.4.1 is **13,552 bytes**: 6144 history bytes, 64 additional resolved-timestamp bytes and 7344 expanded HUD-bin bytes. Native query allocation is implementation-dependent and not included. HUD font masks and main glyph cache are unchanged. No third-party font file or extracted font data is distributed.

## Explicit diagnostics and reproduction

```js
// Never do this per frame in the interactive loop.
surface.stop();
await surface.whenSubmittedWorkDone();
const sample = await surface.inspectPerformance();
console.log(sample.source, sample.submitFPS, sample.gpuCompletionFPS);
console.log(sample.current.phasesMs, sample.current.passSumMs);
```

`lastSubmissionCompletion` is a compatibility getter for the same explicit latest-tail fence. Repeatedly awaiting it in application code reintroduces serialization by the caller. `inspectPerformance()` copies/maps 8192 bytes explicitly; it is never used to schedule frames or populate the HUD. The **Read GPU counters** button includes this snapshot. **Startup** reports host-only status without GPU readback.

`stats.completedFrames` is an acknowledged serial high-water mark. `pendingAcknowledgements`, checkpoint latency and the lifetime `peakFramesInFlight` include notification delay/batching and do not measure actual driver queue depth. The separate GPU done Hz counter exists precisely to avoid that conflation.

Run `npm start`, then use:

- `/tests/metrics.html`: font-independent native WGSL arithmetic and timestamp/interface gate; compares GPU calculations with an independent BigInt/double oracle, tests 260 queued samples, and separates synthetic host/GPU rates. An optional tiny native pass probe is not the application benchmark.
- `/tests/startup.html`: full real-font 65,536-row showcase in continuous vsync or ASAP mode, no per-frame fence awaits. Compare default credit limit 0 with explicit 2 under identical conditions. Records mode, observed callbacks, submissions, phase histories and GPU done Hz; only reads after stopping/draining each phase. A queued overload may make draining take time.
- `/tests/gpu.html`, `/tests/text.html`, `/tests/hud.html`: existing UI, typography/cache and HUD native correctness gates. `/tests/performance.html` remains a deliberately serialized same-version rendering A/B, not a vsync benchmark.

No native benchmark output is supplied as a successful run in this release. Use the target browser, adapter, viewport/DPR, fonts, workload and power configuration; keep those fixed for comparisons. A high Submit FPS alone is not a successful performance result.

## Preservation and observed validation

The full showcase retains **65,536 rows, 202 nodes and eight animations**. With the same three privately loaded Noto Sans faces, baseline/current node (58,176 bytes), initial-state (13,184 bytes), and heap (32,344,544 bytes) arrays compare byte-for-byte. All 14 files in the core, text and startup directories are unchanged. Main glyph quality, font repertoire, curve flattening, rendering resolution, query algorithms and startup preparation are not reduced. The only core WGSL edits are three invalidation-bit masks; the other shader changes are diagnostic rendering/timing. [Exact comparison](submission-core-comparison.json).

Host tests cover simulated refresh rates from 60 to 240 Hz with delayed acknowledgements, every-callback submission, explicit caps/FIFO preservation, real Node MessageChannel task yielding, mode/hidden/stop lifecycle, full pass boundaries, timestamp borrow/reversal/quantization, CPU versus GPU separation, long uptime, per-frame serial correspondence and unchanged normal upload size. They do not execute native WGSL. [Observed validation](VALIDATION.md).

## Primary API references

[1] WHATWG HTML, rendering opportunities and event loops: https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model

[2] GPUWeb generated API, GPUQueue submit and onSubmittedWorkDone: https://gpuweb.github.io/types/interfaces/GPUQueue.html

[3] Chrome Developers, timestamp query units, pass boundaries, quantization and counter resets: https://developer.chrome.com/blog/new-in-webgpu-121#timestamp-queries-in-compute-and-render-passes

These references support API semantics, not Helion hardware throughput or conformance. Current source, tests and the explicit native-validation limitations define this release's claims.
