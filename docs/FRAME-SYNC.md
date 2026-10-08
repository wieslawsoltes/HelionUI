# Frame synchronization, elapsed ranges and parallel rows — 0.6.0-experimental

## Delivery status

This release responds to `Trace-20260924T121100.json.gz` and the two screenshots of 0.5.0. It changes the actual rendering/profiling paths, not just the FPS labels. **331 host tests pass. Native shader execution, final pixels and an end-to-end frame-rate improvement are not verified in this environment.** The current native gate navigation was blocked before loading by `ERR_BLOCKED_BY_ADMINISTRATOR`; the optional native validator dependency could not be obtained. See [VALIDATION.md](VALIDATION.md).

The default remains one submission on every delivered `requestAnimationFrame`, with no completion-based admission cap. This was already the 0.5.0 default; removing that cap again is not presented as a new fix. The opt-in, yielding **As fast as possible** mode remains off on a fresh mount. This release reduces avoidable work within the submitted frame and makes the metrics and their provenance inspectable.

## What the supplied trace actually contains

The analyzed recording window spans **7.442105 seconds** and contains 79,806 trace events. The selected application renderer is PID 1615. The reproducible analysis is in [frame-sync-trace-analysis.json](frame-sync-trace-analysis.json); no screenshot data, URLs, text input or font bytes are copied into that report.

| Trace observation | Result | Scope |
| --- | ---: | --- |
| `FireAnimationFrame` callbacks | 396; 53.211 per recording second | Delivered callbacks, not nominal display refresh |
| Callback CPU duration | median 0.112 ms; p95 0.146 ms | Main-thread callback elapsed time |
| Callback-start interval | median 19.443 ms | Wall interval between recorded callback starts |
| Compositor `BeginFrame` interval | median 8.333 ms | Observed compositor event cadence; some intervals are near-duplicate/burst-like |
| `DroppedFrame` markers | 527 | Trace markers, not an inferred count of skipped application submissions |
| `AnimationFrame::Presentation` interval | median 16.666 ms; p95 25.018 ms | Chrome's presentation association, not a direct scanout sensor |
| Renderer-associated `GPUTask` CPU slices | 834; median 0.0505 ms; p95 0.38135 ms | Slices on the `CrGpuMain` CPU thread |
| `SubmitCompositorFrameToPresentationCompositorFrame` | median 69.963 ms; p95 76.493 ms | 392 unique fully contained compositor intervals |
| `ReceiveCompositorFrameToStartDraw` | median 19.357 ms | 392 unique fully contained intervals |
| `StartDrawToSwapStart` | median 38.560 ms | 393 unique fully contained intervals |

These findings confirm a cadence/presentation problem despite small host tasks. They do **not** establish that all UI shaders finish in 0.2–0.3 ms. Chromium emits `GPUTask` inside `CommandBufferStub::ExecuteDeferredRequest`, around command-processing work on the GPU process's CPU thread [1]. It is not a hardware-duration measurement of every shader in a Helion frame.

The async-stage analyzer pairs begin/end events by process, scope, name and async ID, and removes duplicate exact process/start/end intervals where trace branches share a stage. It uses only complete stages within the recording window. Do not add stage medians together or describe the approximately 70 ms compositor interval as Helion's shader duration or measured input-to-photon latency. The recording does not contain Helion's raw resolved timestamp buffer, so the screenshot's individual GPU values cannot be independently reconstructed from this trace.

## Corrected measurement accounting

**Intervals, CPU encoding, GPU elapsed ranges and presentation are different quantities.** The new HUD uses:

- **Submit FPS / Interval:** number of host near-submit intervals divided by their elapsed time; the interval is not CPU or GPU work cost.
- **rAF Hz / rAF step:** count-over-time cadence of actual browser callbacks. It is no longer a time-weighted smoothing of individual intervals. It never assumes a 120 Hz monitor or calls a 60 Hz delivered stream 120 Hz.
- **GPU end Hz:** cadence between the latest measured end timestamp in consecutive submitted frames. It does not use callback delivery or `1000 / frame cost` and does not measure scanout.
- **GPU span:** earliest measured pass start through latest measured pass end, not an assumption that command-encoding order determines all timestamp ordering.
- **Covered:** the union of the measured GPU timestamp intervals, counting an overlap only once.
- **Overlap:** raw sum of the measured interval lengths minus their union. The raw sum remains available in explicit diagnostics but is no longer presented as frame cost in the HUD.
- **Layout:** reports **Idle** when the layout kernels were not activated. The raw duration of an encoded zero-work layout pass remains separately available. CPU-only mode stays explicitly labelled.

Pass elapsed ranges may overlap. In particular, Dawn's Metal implementation can attach render-pass beginning and end samples to vertex-start and fragment-end stages [2]. Those measurements are not additive busy-time counters. A raw sum of 31 ms with a 16 ms envelope can describe overlapping ranges rather than 31 ms of serial work. The new interval-union accounting exposes this distinction. **Covered time is still elapsed timestamp coverage, not a hardware utilization/busy counter:** a measured range can include waits, scheduling effects and backend-specific stage timing. No arbitrary scale factor or subtraction of CPU times is used to force GPU results toward 0.3 ms.

All comparisons/subtractions use unsigned low/high timestamp words before conversion to small floating-point durations. Unmeasured, merged, reversed or invalid values are distinguished from legitimate zero. Complete range gaps and errors remain visible in exported diagnostics. The schema preserves the exact raw u64 nanosecond values as decimal strings, the measured-slot mask and the submitted-frame serial. The HUD still displays the **previous submitted sample**, so it can include its own GPU work without circular timing.

## Reduce profiling-induced pass boundaries by default

New `timingDetail:'frame'` is the default. A warm scrolling/clean frame with the HUD uses **one combined compute pass and one final canvas render pass**, with four timestamp writes when supported. The prior 0.5.0 real-font/glyph-cache/HUD path used six timed passes and twelve writes for such a frame. The metrics-recording compute pass still runs after resolution and is outside the measured envelope.

Layout and query invalidations retain separate Measure/Arrange and data boundaries when needed. Compact mode does not pretend to measure an individual glyph, sparse or HUD phase that was merged into a compute pass: those fields are N/A. The toolbar's **Timing: frame / stages** toggle restores detailed stage attribution without remounting. `setTimingDetail()` resets the measurement epoch; it does not discard device-owned control edits.

Reducing pass boundaries is an implementation/dispatch-count change, **not a measured 3× speedup**. Native backend overhead and total workload costs still need target-device measurements. Timestamp support remains optional; without it the UI clearly reports CPU encoding rather than GPU timings.

## Remove serial DataGrid emission and fullscreen diagnostic shading

**Parallel row emission.** Previously one invocation emitted the entire visible DataGrid: headers, cells, glyphs, selected row and editor. A dedicated dispatch now gives the header, each of up to 128 visible rows, and the footer/focus layer independent work. Five 32-lane workgroups cover the 130 sections. It does not process all 65,536 rows each frame.

Each invocation owns a separate display-list head. Painter keys reserve distinct section ranges within the parent node, so atomic allocation order does not determine visual stacking. Header, rows, editor, footer, focus and debug layers retain their order. Damage comparison visits all section heads and accounts for both old and new bounds. Unsigned 32-bit keys cover the full 512-node domain. A pathological section exceeding 32,768 emitted primitives explicitly reports overflow instead of colliding with adjacent section keys; the default global arena limit is already smaller at 16,384 primitives.

`parallelGrid:false` selects a serial execution of these same new section routines for an exact-pixel/reference comparison. This is a same-version A/B mode, not a benchmark against the old release. Row data, sort/filter algorithms, real glyph geometry, advances, fractional coordinates, clipping logic and sampling are not reduced.

**Scissored HUD.** A tiny fullscreen shader now copies the already-composited UI. The existing real-font/antialiased-graph fragment shader runs only in the physical panel-and-shadow rectangle, in the same canvas render pass. With the HUD hidden, only the tiny copy shader is used. There is no extra offscreen texture, extra font fetch, lower-DPR panel or reduction of curve/text quality. The reference option `hudScissor:false` uses the fullscreen diagnostic shader for native pixel and cost comparisons.

## Frame synchronization and diagnostics

The rAF callback is stable/reused, schedules its successor before encoding, and submits on every delivered callback under the default cap of zero. No timer tries to fill an inferred missing physical refresh. Browser rendering opportunities are browser-controlled [3]. A positive explicit cap still preserves queued input when saturated. ASAP remains a yielding task loop with a default cap of eight unacknowledged frames. Completion checkpoints remain progress bookkeeping, not a vsync clock or a measurement of GPU execution.

The default uncapped policy can accumulate latency under sustained overload. This tradeoff is not concealed by showing a high submission rate. The new bounded, host-only **Frame sync** log records frame serial, rAF timestamp, callback arrival, command-encoding boundaries and near-submit boundaries. Capturing this log performs no GPU mapping or queue fence. Its callback-offset field is literal arrival minus rAF timestamp, not an invented missed-deadline measure or hardware queue depth. Logs retain the newest 240 submitted frames.

Use **Read GPU counters** only for an explicit GPU/metrics snapshot, then **Save JSON** to export that captured data. The host frame serial and GPU `sampleFrame`/`rawTimestampFrame` allow correlation even when a read finishes after more frames have been submitted. The export includes the source/mode, raw timestamp pairs and actual-layout marker. Do not call either inspection method in a per-frame polling loop.

```js
const surface = await HelionSurface.mount(canvas, view, {
  submissionMode: 'vsync',        // Every delivered rAF; ASAP remains opt-in
  maxFramesInFlight: 0,           // No completion-admission gate in default vsync
  asapFramesInFlight: 8,
  performanceHUD: true,
  timingDetail: 'frame',          // Low-boundary frame profiling
  parallelGrid: true,
  hudScissor: true
});
surface.setTimingDetail('stages'); // Detailed pass ranges for investigation
console.log(surface.inspectFrameSync()); // Bounded host log; no readback
// Explicit diagnostic operation, not normal rendering:
const gpuSnapshot = await surface.inspectPerformance();
```

## Residency, compatibility and preserved quality

Normal explicit uploads remain **64 bytes per submitted frame plus 32 bytes per command**. No font notifications, cache-miss readback, control-state polling, CPU glyph rasterization or per-frame text upload is added. GPU metrics, interval union and the visible HUD remain device-resident.

Initial compiled node/state/heap **ABI 3 is unchanged**. Global word **58**, previously reserved and zero, is the actual-layout flag reset in `clearFrame` and set in `finishWork`. Font composition and combining-directory words 54–57 are preserved. An explicit regression test guards this separation.

Internal display-list headers are now 648 words: the four-word header plus 644 list heads (512 nodes and 130 grid sections, rounded to four). Both retained display-list allocations grow by 528 bytes. Metrics **schema 3** is 16,384 bytes, not the old 8,192-byte schema 2. The extra GPU storage is **9,248 bytes** in total; pipeline allocations are implementation-dependent. The host frame log uses 15,360 bytes of numeric storage; cadence uses a 120-double interval ring. Old compiled scenes remain accepted, but runtime/shaders/metric decoder must come from this same release.

The full showcase still has **65,536 rows, 202 nodes and eight animations**. Default font sources, repertoire, glyph cache, flattening tolerance, resolution/DPR policy, startup worker and initial-scene cache remain. A private three-face DejaVu Sans comparison (17,804 glyphs) produced byte-identical complete node, initial-state and heap buffers against 0.5.0. The declaration tree and 19 protected compiler/font/startup/layout/data/text/cache source files matched. See [frame-sync-preservation.json](frame-sync-preservation.json). This is CPU binary/source evidence, **not a GPU-pixel or FPS claim**. No font file or extracted third-party outline data is distributed.

## Reproduction and outstanding native qualification

```sh
npm test
npm run check
npm run build
npm run check:build
npm start
```

- `/tests/frame-sync.html`: actual GPU serial/parallel DataGrid pixels, filtering, selection, transformed rows, hidden/showing state, damage/full raster, compact/stage profiling equality and fullscreen/scissored HUD pixel comparisons at three DPRs. Uses the original synthetic fixture font, not third-party font assets. **Provided, not recorded as passing here.**
- `/tests/metrics.html`: WGSL output against an independent BigInt/endpoint-sweep oracle, overlapping and reordered ranges, a queued history test and a real compute/render query probe. Test operations explicitly read back buffers. **Provided, not recorded as passing here.**
- `/tests/startup.html`: real-font continuous vsync/ASAP comparison with frame/stages profiling and serial/parallel/fullscreen-reference controls. Reads occur after measured phases stop and drain. This is where native throughput changes must be measured; no FPS result is fabricated.
- `/tests/gpu.html`, `/tests/text.html`, `/tests/hud.html`: retained native UI/text/HUD gates. Existing typography, geometry and framework-parity limitations still apply.

The source includes `tools/analyze-trace.py` to reproduce the source-trace results, and `tools/compare-release.mjs` to repeat the exact scene/source comparison using the caller's own fonts. A failed extra Clear Sans trial was rejected by the unchanged baseline font parser; it is not counted as a passing font comparison.

## Primary sources and interpretation boundaries

[1] Chromium, `gpu/ipc/service/command_buffer_stub.cc`, `ExecuteDeferredRequest` / `GPUTask`: https://raw.githubusercontent.com/chromium/chromium/main/gpu/ipc/service/command_buffer_stub.cc

[2] Dawn, `src/dawn/native/metal/CommandBufferMTL.mm`, render/compute timestamp attachments: https://raw.githubusercontent.com/google/dawn/main/src/dawn/native/metal/CommandBufferMTL.mm

[3] WHATWG HTML, rendering opportunities/event-loop processing: https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model

Sources were consulted on 2026-09-24. They establish API/backend/trace semantics, not which specific backend or kernel caused the user's entire delay. The attached trace, source audit, regression tests and explicit native-test failure define the evidence available for this release.
