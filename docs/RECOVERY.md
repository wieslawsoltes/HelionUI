# Performance regression follow-up — 0.6.1-experimental

## Status

This is a targeted implementation change following the reported regression in 0.6.0, not a verified hardware-performance fix. The current Chromium test navigation fails before page load with `ERR_BLOCKED_BY_ADMINISTRATOR`; the optional native validator dependency is unavailable. Native WGSL compilation, execution, final pixels, warm FPS and end-to-end browser startup are **not verified** here. Host checks and preservation results are recorded separately in [recovery-validation.json](recovery-validation.json).

No dataset, font repertoire, output resolution, fractional-position precision or antialiasing setting was reduced. The full application UI still waits for its actual fonts, retained scene and required pipelines. The optional performance overlay now has a distinct readiness point.

## What the latest trace establishes

The supplied `Trace-20260924T131248.json.gz` has 94,408 events. Within its 8.970329-second selected window, the application receives 575 animation-frame callbacks (64.100 per recording second). Callback CPU duration is 0.096 ms median and 0.1413 ms p95, while intervals between callbacks reach 41.2607 ms at p95. Compositor presentation associations have 41.6777 ms p95 intervals. This is substantial cadence jitter despite short host callbacks; changing labels does not repair it.

The recording does not include font-request or native shader/pipeline-compilation events that could attribute startup time. It also does not contain the application's resolved GPU timestamp buffer. It cannot by itself identify a single responsible kernel, prove that profiling caused the delay, or measure this new build. [Sanitized source-trace analysis](recovery-trace-analysis.json).

The selected capture contains 1,130 DroppedFrame markers and a 46.101 ms median / 95.8055 ms p95 compositor-submission-to-presentation interval. These are trace event observations, not an independent scanout sensor or kernel busy-time measurement. Absolute marker counts from different recording lengths/viewports are not a controlled version comparison. Stage medians must not be added together.

## 1. Parallel exact glyph-cache planning

The 0.6.0 DataGrid improvement parallelized row emission but left `prepareGlyphCache` as one GPU invocation walking the entire emitted glyph list. This release removes that single-owner bottleneck without changing the glyph coverage functions.

The new pipeline is:

```
GPU display-list emission and damage
  -> collectGlyphRequests: independent candidate-glyph invocations
  -> prepareGlyphCache: independent owners of disjoint cache partitions
  -> finishGlyphRequests: publish counters and raster dispatch arguments
  -> rasterGlyphCache: independent cache-miss workgroups
  -> sparse strips and compositing
```

At the default 2,048-slot capacity, 64 invocations each own 32 slots. They are 64 independent owners, not 64 workgroups and not a measured 64x speedup. Candidate discovery runs in 64-lane workgroups. Only glyphs intersecting damage produce requests. Exact keys preserve the outline resource, all four f32 transform words, and both exact fractional-origin words.

Discovery uses atomic linked-list publication in scratch storage. Owners do not traverse requests until the next dispatch, so complete request records are visible before consumption. Each owner is the only writer to its cache partition; equal keys route to the same owner. There are no cross-workgroup locks, spinning, CPU miss notifications, per-frame font uploads or cache readbacks. Slots already referenced by the current frame cannot be evicted. The final small dispatch publishes miss counts and the existing indirect raster arguments.

**Tradeoff:** partition ownership changes collision/replacement behavior. A partition can become full while another still has space. Such requests use the existing direct analytical coverage path; they are not dropped, snapped, blurred, rasterized at a smaller size or assigned another font. Adversarial concentrations can increase bypass work. Work distribution, collisions and actual GPU occupancy still require native measurement.

The cache's existing metadata/mask/job allocation stays unchanged. Default additional scratch is 786,752 bytes. Two dispatches are added relative to the old planner/raster pair. The intended gain is removing serial traversal, not reducing total dispatch count. `glyphCache:false` remains a direct-outline reference mode.

## 2. Cache diagnostic kerning once, not every frame

The HUD's previous single-invocation formatter repeatedly performed OpenType PairPos lookup for label pairs on every frame. Its 95x95 printable-ASCII pair table is now generated on the GPU alongside initial HUD mask preparation. Warm label formatting reads the exact cached f32 adjustment.

This adds 36,100 bytes; the HUD font buffer is now 820,484 bytes. Pair-table preparation is one-time work per HUD mask/scale initialization, not free work. The glyph mask generation, advances, display sizes, linear-light compositing, chart samples and antialiasing are retained. The application's text-shaping path is not replaced with an ASCII table; this optimization only serves the bounded diagnostic vocabulary.

The formatter no longer statically uses the font heap or surface-state resources. Its auto-layout bind group has exactly bindings 0, 3, 4 and 5. A controlled-source reachability regression test checks this to avoid passing extra bindings to the native pipeline layout.

The two default storage increases total 822,852 bytes (approximately 0.785 MiB). Native driver/pipeline allocations are additional and unmeasured.

## 3. First usable UI no longer waits for diagnostic shader compilation

`deferHUD:true` is the new default. Startup creates a minimal independent fullscreen-copy shader, the required UI pipelines, and the metrics recorder. It does not first await the rich HUD presentation/font/layout pipelines. The first rendered application frame still contains the complete actual-font UI with the same scene and resolution.

After that frame's completion acknowledgement, optional HUD compilation begins asynchronously. Frames and ordered input continue without a HUD compilation admission gate. Until it is ready, the toolbar says `FPS / graphs: preparing`; no placeholder alphabet is displayed. Once ready, the HUD uses the already-resident primary font, prepares its GPU masks/table and appears without remounting or losing edits.

**This moves optional work off the first-UI critical path; it does not remove that work or prove a shorter total startup.** Browser/native compilation can still consume resources while it runs. Font loading, full scene packing/upload and core shader compilation remain. There are 35 startup-critical pipelines in this build, compared with 36 in 0.6.0: the two new cache entries offset most of the count reduction from deferring three HUD pipelines. The relevant change is which shader programs are required before first UI, not a misleading large pipeline-count claim.

`deferHUD:false` retains eager preparation for callers/tests requiring all pipelines before mounting returns. Hiding a not-yet-requested HUD avoids starting its compilation. A late completion after disposal cannot resurrect the surface. A diagnostic preparation error is recorded in `hudError`/`startup.hudError` and reported through optional `onDiagnosticsError`; no CPU-rendered visual replacement is used.

`surface.startup` now records per-pipeline promise timing (`pipelineEntries`: name, startMs, elapsedMs), `hudPipelineMs` and `hudReadyMs`. These are host-observed preparation lifetimes, not GPU shader execution durations. `firstCompletedMs` is the first application-frame acknowledgement, not first HUD display or physical presentation. The native startup benchmark separately records `firstHUDCompletedMs` and waits for diagnostic preparation before measuring warm frame phases.

## 4. A real no-timestamp comparison

The toolbar cycles `Timing: frame` -> `Timing: off` -> `Timing: stages` -> `Timing: frame`. Default remains **frame**. In off mode there are no timestamp writes or query resolutions, while the same font-rendered HUD, submission cadence and GPU history path remain. The panel explicitly switches to **CPU encode timings**; GPU-only fields become N/A. CPU times are not relabelled as GPU measurements.

Changing modes does not remount, alter controls, reduce resolution or clear edits. Timing history resets so incompatible windows are not mixed. The device can retain its requested timestamp capability while off, allowing a live switch back. `gpuTiming:false` remains the mount-time option that does not request that feature.

This is an isolation control for measuring instrumentation overhead; its presence does not prove that timestamps caused the user's regression. No GPU number is scaled down, clipped into a desired result, or replaced with the short trace CPU slices.

## Submission, residency and quality contract

Default submission is unchanged: one complete frame per delivered browser rAF, no completion-acknowledgement admission cap, ASAP off. The optional ASAP loop stays bounded and yielding. This release does not invent missing refresh callbacks or promise a physical presentation rate. Uncapped application admission can still queue stale work under sustained overload.

Normal explicit transfers remain **64 bytes per submitted frame + 32 bytes per command**. No normal `mapAsync`, diagnostic readback, CPU glyph rasterization, CPU cache manager or control-state mirror is introduced. Explicit inspection/test readbacks remain exceptions.

The same 65,536 rows, 202 views and eight animations remain. Complete initial node/state/heap arrays match 0.6.0 byte-for-byte with the three-face private DejaVu test set. Four glyph matrix/origin/coverage helper bodies also match exactly. [Preservation report](recovery-preservation.json). This proves initial binary/source preservation for those inputs, not runtime pixels or a native speedup. All font files remain external runtime/local assets; none are included in the distribution.

Compiled ABI 3 and initial-scene cache compatibility remain. The 32-byte command wire record and 64-byte uniform size remain. Internal scratch/HUD reservations and the diagnostic mask change, so runtime, shaders and decoder must come from the same build.

## API

```js
const surface = await HelionSurface.mount(canvas, view, {
  performanceHUD: true,
  deferHUD: true,           // first UI independent of optional HUD compilation
  timingDetail: 'frame',    // 'off' performs no timestamp writes/resolution
  submissionMode: 'vsync',
  maxFramesInFlight: 0,
  onDiagnosticsError(error) { console.error(error); }
});
surface.setTimingDetail('off');    // same UI/HUD, CPU-labeled timings
surface.setTimingDetail('frame');  // restore compact native timestamp ranges
console.log(surface.hudReady, surface.startup.pipelineEntries);
```

Do not poll `inspect()` or await GPU completion in the normal rendering loop. Host startup status and `inspectFrameSync()` need no GPU readback.

## Validation and reproducibility

Host tests cover independent exact-key ownership under repetition/collision/150 randomized frames, current-frame eviction protection, capacity boundaries, request publication and aliasing, HUD resource reachability, startup deferral/lifecycle, no-timestamp mode and unchanged transfers. They do not execute shaders. The native gates remain provided, not passed here.

```
npm test
npm run check
npm run build
npm run check:build
npm start
```

`/tests/startup.html` measures initial UI and HUD readiness separately, then continuous idle/fractional-scroll phases. Select off/frame/stages to compare profiler overhead under the same viewport, fonts and mode. `/tests/performance.html` compares cache-on/direct-outline or damage-on/full-frame rendering using the same fonts. `/tests/text.html`, `/tests/frame-sync.html` and `/tests/hud.html` exercise native coverage/pixel/control equivalence. The serialized per-frame benchmark is not a vsync measurement.

Do not reuse the historical 0.3->0.4 Node packing speedup as a result for this release. No current hardware FPS, latency or end-to-end startup improvement is asserted.
