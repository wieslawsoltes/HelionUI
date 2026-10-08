# Performance and instrumentation — 0.2.0 change record

> Historical release record. Current profiling, parallel DataGrid emission and frame diagnostics are defined in [FRAME-SYNC.md](FRAME-SYNC.md).

> Historical release detail. The rendering/font features below are retained, but 0.5.0 supersedes submission defaults, timing definitions, HUD dimensions and timestamp/history layouts. See [SUBMISSION-TIMING.md](SUBMISSION-TIMING.md) and [current validation](VALIDATION.md). Historical test counts and measurements are not new results.

> Historical 0.2/0.3 design record. Release 0.4 changes startup preparation, the default unfinished-frame limit to 2, completion-independent rAF scheduling and the HUD reference to observed cadence. Those current contracts and the scoped CPU benchmark are in [STARTUP-VSYNC.md](STARTUP-VSYNC.md). Typography, query and raster algorithms described below are retained.

**Historical baseline:** the scheduling/query/damage changes below remain in 0.3.0. Font loading, typography, exact glyph caching, scene counts and the current benchmark are updated in [TEXT.md](TEXT.md) and [VALIDATION.md](VALIDATION.md). Statements below about missing glyph caching describe 0.2.0, not the current release.

## Delivery status

This release addresses avoidable work in the shared input/query/render pipeline and adds a GPU-rendered performance HUD. The user reported delayed typing, sorting and UI updates and supplied a DataGrid scrolling trace. The trace motivates investigating the shared frame pipeline; it does not by itself prove the relative CPU/GPU costs or an input-to-photon latency value.

Host regression tests, independent algorithm tests and build checks pass. Native WGSL compilation, GPU execution, visual comparison and a before/after speedup have **not been verified in the authoring environment**. Its managed browser rejects the test-page navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`; the optional native validation binding is unavailable. The native checks and benchmark below are included as executable gates, not represented as passing results. No FPS or millisecond improvement is fabricated.

## Changes to the hot paths

### Bound the frame queue before consuming input

The default allows one submitted, unfinished frame. A saturated queue rejects a frame before flushing the event FIFO, uploading uniforms or rebuilding resized targets. Input continues to collect in order; an asynchronous `queue.onSubmittedWorkDone()` completion acknowledgement re-arms frame scheduling. This prevents the host from creating an arbitrarily long backlog of obsolete frames when the GPU falls behind. It does not make an individually expensive frame faster, preempt an already submitted frame, or bound the browser/driver's internal presentation queue.

`maxFramesInFlight` accepts 1, 2 or 3. One prioritizes latency and bounded buffering; two or three may overlap host work better on some devices but increase the possible delay. The completion acknowledgement transfers no control-state payload and maps no GPU buffer. The host never waits synchronously in the frame callback. Acknowledgement delivery and requestAnimationFrame scheduling can themselves limit throughput; measure the setting on the target device.

### Retain a complete sorted row order

The full sorted identity order lives separately from the filtered visible index. Text and Ready-only filtering scan and compact that retained order; they do not invalidate its sort. Sorting runs only on initial data, a sort-column/direction change, or an edit to the active sort column. Selection remains identity-based. An unrelated Slider or CheckBox does not invalidate the table query.

A 256-lane workgroup sorts each 256-row block in workgroup memory. Global binary-rank merge stages combine those runs using two resident ping-pong arrays. For 65,536 padded records, this is **one local sorting dispatch plus eight merge dispatches**, instead of **136 device-wide bitonic dispatches** in the previous implementation. Filtering still has its own scan, block-prefix and scatter work. Clean sort stages use zero indirect work.

These are algorithmic dispatch counts, not measured time or a 15x speedup. Local bitonic sorting still performs many comparisons, and binary-rank merging can still require O(N log²N) comparisons across the whole sort. Long string comparisons remain expensive. The CPU test mirror validates ranks, padding, identity ties, both directions, fractions and case-insensitive strings, but is not evidence of native shader execution.

### Avoid text-induced layout and unnecessary graph encoding

The existing TextBox contract already measures to a fixed intrinsic control size rather than the content string. Editing its text now invalidates the linked query and rendered primitives, not Measure/Arrange. TextBlock wrapping and geometry-dependent layout remain separate. Width, height, visibility and padding still invalidate layout. Pointer activation and Enter/Space remain conservatively eligible for layout because they can switch pages or activate a layout-changing action.

The host packet summary distinguishes potential layout, query and hit-test work without inspecting GPU state. Scroll-only packets omit layout/query graphs. Explicit-target application commands skip pointer discovery. Actual invalidation decisions remain on the GPU. The two logical layout phases still use depth-ordered dependency dispatches; this release does not implement a new fixed-point Grid solver.

Adjacent wheel events combine only with the same recipient, position, code and direction per axis, and only when the accumulated f32 values are finite. Direction reversals, position changes and discrete events stay ordered. Adjacent moves retain their existing coalescing behavior. No key, committed character or activation is dropped to achieve a lower queue depth. The existing 8,192-command FIFO bound still applies.

### Retain pixels and rasterize damaged output tiles

Two GPU-generated display lists retain current and previous primitives. Per-node links make comparison independent of parallel allocation order. Exact primitive-field comparisons, not probabilistic hashes, mark old and new bounds into a GPU 16x16 output-tile damage map. The initial frame, resized output, theme-dependent background change, debug/primitive differences and arena overflow are accounted for. Hiding/removing emitted content damages its former bounds.

The display list is still emitted and compared each admitted frame. Raster jobs skip clean rows/tiles; clean output tiles retain their existing pixels. A moving object redraws both its old and new area, including intersecting background/foreground primitives in those tiles. This is whole-tile damage tracking, not persistent GPU scene execution, per-glyph atlas caching or upstream Vello's implementation. Scrolling a large DataGrid legitimately damages most of its viewport; it is not reduced to a tiny cursor-sized update.

Tile painter sorting pads to the next power of two of the actual bin length, not always 256 entries. Front-to-back premultiplied compositing skips layers behind exactly opaque accumulated coverage. A separate final-presentation red strip reports overflow even when cached UI tiles are retained. Fixed arena limits and overflow behavior remain explicit.

Set `damageTracking:false` to run the full-frame reference mode without forcing layout or changing input/query behavior. This provides an image and cost comparison against the **new** engine with caching disabled, not against the older released engine.

## FPS and small graphs

The showcase starts with the HUD enabled; use **FPS / graphs** to toggle it. The panel is generated by the final WebGPU presentation shader. Its diagnostic pixel glyphs and graph bars do not use DOM controls, Canvas 2D or a CPU raster atlas. This final-stage diagnostic rendering is an exception to the core UI's compute-only path/glyph rasterization.

The panel displays:

- **SUBMIT FPS**: smoothed cadence of admitted application frames, derived from their clock deltas. It is not monitor refresh rate, completed-frame rate or a measurement of actual scanout/presentation. Long suspension/stall intervals reset the estimate rather than reporting a fictitious 60 FPS.
- **FRAME**: interval between admitted frames, in milliseconds.
- **LAYOUT**: timed Measure/Arrange compute pass when native timestamps are enabled. A skipped phase contributes zero; an encoded zero-work phase may still have dispatch/pass overhead.
- **RENDER**: composition, primitive emission/comparison, sparse raster and composite compute pass. It excludes final presentation, the timing-history kernel and browser compositor work.
- **DATA**: separate sorting/filter/selection compute-pass time. This prevents query spikes being mislabeled as layout cost.

Each graph keeps 120 admitted frames, uses a fixed 0–50 ms vertical range and marks the 16.7 ms reference. Values above 50 ms clip graph height but remain visible in the numeric value. These histories are in GPU storage.

When `timestamp-query` is advertised and requested at mount, eight timestamp values bracket input, layout, data and render phases. The 64-byte query resolve is consumed by a compute shader on-device, then retained in a 2 KiB timing/history buffer. The two u32 halves of each 64-bit timestamp are subtracted before float conversion. The normal HUD path performs **no CPU readback, mapping, state polling or test-only inspect() call**.

Without the feature, the panel explicitly says **CPU ENCODE MS**: Layout and Render then show host command-encoding durations, not GPU execution. Data time is N/A in that mode. The Frame interval remains an admitted-frame clock measurement in both modes. Timestamp resolution/quantization and instrumentation overhead are device/browser-dependent; the HUD is not an independent benchmark certificate.

```js
const surface = await HelionSurface.mount(canvas, view, {
  performanceHUD: true,       // showcase default; library default is false
  maxFramesInFlight: 1,      // latency-oriented default, valid range 1–3
  gpuTiming: true,           // use optional timestamps when advertised
  damageTracking: true      // disable only for full-render A/B checks
});
surface.setPerformanceHUD(false);
```

`profiling:true` keeps collection enabled with the HUD hidden. Otherwise hiding it omits query writes/resolution/history updates. A mount without profiling does not request timestamp support; enabling the HUD later uses the labeled CPU-encoding mode. Remount with profiling/HUD enabled to request native timestamps. Core shader/buffer capacity is still allocated at initialization.

## Transfers and memory

The normal explicit payload remains **64 bytes per admitted frame plus 32 bytes per queued command**. Timing fallback values and flags reuse previously reserved frame words. Saturated attempts send zero bytes and leave commands queued. Initial compilation/upload increases to hold cached indexes and immutable merge-stage records; the showcase still contains 65,536 rows, 170 retained views, 101 vector resources and eight animations.

At the maximum 65,536 rows, two extra u32 full-sort arrays consume 512 KiB. Double display lists add roughly 2 MiB plus the 512-head linked-list header per list. The default damage map adds 64 KiB. Profiling uses a 2 KiB history, a 64-byte resolved timestamp buffer and optional query-set allocation. The renderer keeps the previous maximum dimensions and DPR policy; no lower row count or automatic quality reduction is used to disguise performance.

The 32-byte command layout is unchanged. The internal compiled ABI is now **2**, with 40-word table records and revised display-list/scratch layouts. Recompile declarations; ABI-1 compiled objects are rejected explicitly. Driver command traffic, internal copies, queue-completion signalling, GPU memory bandwidth and explicit diagnostics are not included in the payload counter.

## Validation and reproduction

Run host checks:

```sh
npm test
npm run check
npm run build
npm run check:build
```

The tests cover the algorithm mirror, command coalescing and classification, bounded frame admission, resident timestamp wiring, per-entry resource graphs and source/build consistency. Tests with a fake WebGPU device are explicitly non-executing host scheduling tests. See [VALIDATION.md](VALIDATION.md) for observed results and native-test limitations.

Serve the source with `npm start` and open `/tests/gpu.html`. The native gate includes control state/layout/query checks, a clean-frame raster check and exact changed-pixel equality between retained-damage and full-frame rendering. Test-only explicit readbacks are isolated from the normal app.

Open `/tests/performance.html` and choose **Run comparison** for target-device measurements. It runs the same 65,536-row sample with retained damage disabled and enabled, records idle, scroll, text-filter and numeric-sort phases, and exports JSON with median/p95/max, adapter/browser information and timing-mode disclosure. Each phase has four warmups and 40 samples. The benchmark explicitly reads the 2 KiB history once per phase. Completion latency includes CPU encoding, submitted GPU work and callback delivery; it is not input-to-photon. Both arms use the new query/sort engine. No benchmark output has been collected in the authoring environment.

Compare to an older release only under identical browser, adapter, viewport, DPR, input and animation settings. CPU encoding duration is not interchangeable with GPU timestamps or frame interval. Do not treat a successful run as exhaustive browser, text, rendering or production validation.

## Remaining performance work

Display-list emission and exact comparison, composition, input processing and final presentation still run each admitted frame. Animated live counters can dirty their own tiles every frame. Dirty regions with many glyphs or paths still need repeated sparse coverage generation; no glyph/coverage atlas is introduced. The string comparator and filter remain direct storage loops. A full-window animation or scroll can invalidate most tiles. Fixed bins can overflow under dense content. Native profiling and real-device latency/visual checks are required before deciding which of these dominates or claiming the reported lag is resolved on a particular machine.

Primary API reference: W3C WebGPU specification, timestamp queries, query resolution, queue completion and optional features: https://www.w3.org/TR/webgpu/ . Independent algorithm/code changes in this document describe this release, not a browser-wide throughput guarantee.
