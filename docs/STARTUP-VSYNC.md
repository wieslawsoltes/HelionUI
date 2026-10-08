# Startup and refresh pacing — 0.4.0-experimental

> Historical release detail. The rendering/font features below are retained, but 0.5.0 supersedes submission defaults, timing definitions, HUD dimensions and timestamp/history layouts. See [SUBMISSION-TIMING.md](SUBMISSION-TIMING.md) and [current validation](VALIDATION.md). Historical test counts and measurements are not new results.

## What changed, and what was measured

This release removes avoidable startup allocation/serialization and decouples the animation clock from GPU completion acknowledgements. It retains the existing real-font geometry, GPU glyph-coverage cache, dirty-tile renderer, input/query behavior, 65,536-row showcase, 202 views, eight animations and rendering-resolution policy. No quality or dataset reduction is used to make startup or frame numbers look better.

The collected performance result is **CPU preparation in Node**, not complete browser startup or device FPS. Five fresh processes per version, interleaved baseline/optimized, used the same three locally available Noto Sans faces and the same scene. No downloaded/system font bytes or extracted third-party outlines are included in this distribution.

| Local CPU measurement, median of five | 0.3.0 baseline | 0.4.0 | Change |
| --- | ---: | ---: | ---: |
| Scene compilation/packing | 1,267.98 ms | 258.92 ms | 4.90× faster; 79.6% less time |
| Font read/parse + scene + shader-resource analysis | 1,505.39 ms | 504.85 ms | 2.98× faster; 66.5% less time |
| Process peak RSS | 357.69 MiB | 239.75 MiB | 33.0% lower |

All ten runs produced identical SHA-256 values for the complete compiled node, initial state and heap arrays. The heap is 32,344,544 bytes with 9,868 retained paths. The three faces contain 9,961 glyphs. This is evidence of unchanged initial binary geometry/metrics/state for these inputs, not a rendered-pixel comparison or a complete typography qualification.

[Full CPU report](startup-host-benchmark.json). The scope excludes JS module import time, HTTP, browser worker/IndexedDB overhead, native shader compilation, GPU upload/execution, driver caches and display presentation. Medians vary by machine and load; do not present the CPU speedup as an end-to-end startup or FPS multiplier. The font parser itself is unchanged.

## Cold startup: fewer allocations and independent work

**Typed scene heap.** The old compiler grew a JavaScript number array, spread temporary per-segment arrays, and allocated an ArrayBuffer plus two views for each float-bit conversion. The new heap grows a Uint32Array geometrically, uses a shared Float32Array overlay for glyph coordinates, and reuses one scratch word for occasional scalar conversions. Float rounding, reserved zeros, limits and offsets are preserved. A growth-sensitive custom-table string write was adjusted to reacquire the new backing storage after allocation.

**Unicode mark classification.** The old path performed approximately 1.1 million separate JavaScript regex tests. The new path scans 4,096-scalar strings with the browser's native Unicode regex engine: 272 chunks covering the same complete scalar range, merging ranges across chunk boundaries. It still uses the executing browser's Unicode categories, not a reduced or pinned substitute. An exhaustive host test compares all 1,114,112 codepoints against the old predicate. This computation overlaps pending font requests in the startup worker.

**Parallel preparation.** Font I/O, parsing and scene packing are independent of adapter selection, shader loading, shader-module validation and pipeline creation. Mount starts both paths together. Pipeline creation uses a bounded asynchronous batch of four by default, instead of awaiting each pipeline before starting the next. All 30 core compute entries, the metrics pipeline and presentation remain present. Shader code and compiler optimization quality are not weakened. `pipelineConcurrency` accepts 1–32; the browser/driver decides how much native parallelism is actually available.

**One resource-graph analysis.** The controlled shader function/resource graph is cached by exact source instead of rebuilt for every entry. Checked shader modules pop their device error scopes before yielding, so concurrent checks cannot mismatch scope stacks; detailed original-file diagnostics remain available. Failed pipeline batches settle before device cleanup.

## Startup worker and repeat-start cache

`startupWorker:true` is the default. A one-shot module worker handles font parsing and complete scene packing, transferring the three compiled ArrayBuffers back rather than cloning them at return. It is terminated after preparation and any bounded cache write; it does not host the live UI or a CPU control-state mirror. On the ordinary site it loads the source module; standalone HTML embeds a self-contained worker source and creates a Blob URL. That worker has no document-import-map dependency.

A worker creation/load/CSP failure runs the identical compiler on the host and reports that fallback. Real font/parse/compile errors after worker startup are errors, never a silent switch to placeholder text. Relative font URLs resolve against the document, not the worker. Startup cancellation is available through `signal`; per-font AbortSignals retain the host path. A blocked-worker handshake is bounded to three seconds. Cold preparation has a 120-second worker deadline in addition to individual font-request limits.

Persistent caching is **off by default in the library**. The showcase opts in with `startupCache:'showcase-full-quality-v1'`. It stores only one initial compiled scene per origin, up to 72 MiB, in IndexedDB. A valid hit avoids font downloads, font parsing, Unicode scanning and scene repacking. GPU buffers and native pipelines are still recreated. There is no font substitution, glyph subsetting, lowered raster quality or CPU-rasterized font atlas.

The key covers engine/cache revision, browser user agent (to invalidate changing Unicode engines), application revision, declarations, font descriptors and limits. The integrity digest covers arrays and manifest. Corrupt, stale, evicted, denied or unavailable storage becomes a normal compile. Database open/read deadlines are 250 ms each; writes/clear are bounded to 1.5 seconds. The optional write does not wait for transaction completion before returning the prepared scene, although digest creation and `put()` serialization are startup costs. The cache is an optimization, not a correctness dependency or a network revalidation mechanism.

**Privacy/lifetime:** cached initial declarations may contain application data. Opt in only for appropriate same-origin data. This is not a secrets store or encrypted persistence. GPU-owned edits, selection and scroll state are never read back into it. Local files, ArrayBuffers and caller-prepared font faces are not persisted. Version the font URL or application cache key when remote contents change at the same URL. Clear it with **Fonts → Clear startup cache** or `await clearStartupCache()`. Cache data is created by the user's running browser; no third-party font data is shipped inside this release.

## Frame pacing: rAF is the clock, completion returns credit

The earlier one-frame gate could stop requesting rAF until `onSubmittedWorkDone()` delivered its acknowledgement. A completed GPU frame whose callback arrived late could therefore prevent the next browser rendering opportunity from even being requested. This is a scheduling dependency found in the code, not a measured attribution of every slowdown in the user's trace.

The new loop requests the next rAF independently of completion. Every observed callback updates cadence, then attempts admission. The default allows **two unfinished application submissions** so one late acknowledgement need not stop the next update. A full gate still defers before input consumption, resize or upload; unsent discrete input remains ordered. Completion callbacks only release credit and record completion/startup timing. They never submit, request or recursively generate frames. Stop/dispose/hidden-page handling cancels the loop, and resume resets cadence rather than carrying a stale refresh estimate.

The 1–3 setting remains explicit. One prioritizes a smaller backlog but can sacrifice cadence; two permits overlap without an unbounded queue; three may add latency. None makes slow GPU work faster, preempts a running frame, or controls browser/driver presentation buffering. RequestAnimationFrame follows browser rendering opportunities, which the HTML standard does not equate to a guaranteed physical display rate [1]. Queue work completion is not scanout [2]. There is no busy loop, fixed 60 Hz timer or unlimited-submit mode.

Host scheduling tests simulate 60, 90, 120, 144, 165 and 240 Hz with delayed acknowledgements, overload and stop conditions. These prove the tested host scheduling rules with a **non-executing GPU fake**, not hardware frame rates.

## Honest FPS and frame graphs

The HUD now shows **SUBMIT FPS** (admitted-frame cadence) and **RAF HZ** (observed browser callbacks) separately. It never relabels a refresh estimate as completed/presented frames. The 120-sample Frame/Layout/Render graphs retain their 0–50 ms scale, but the reference line follows measured rAF interval instead of assuming 16.7 ms. A visible LINE MS value states that reference. Manual rendering or an unknown cadence shows N/A and no invented refresh line.

The host samples every rAF, including callbacks rejected by a full gate; a time-based 180 ms smoothing constant adapts consistently across refresh rates. A duplicate/invalid timestamp or a gap of at least 250 ms resets the rAF estimate. It is packed at 1/256 ms into previously reserved upper flag bits in the existing frame record. GPU timing/history/presentation consume it on device.

**Normal explicit transfer remains 64 bytes per admitted frame + 32 bytes per command.** No timing or control buffer is mapped for the HUD. Native optional timestamps still provide Layout/Render/Data GPU durations; without them the label remains CPU ENCODE MS. The graphs include samples only for admitted frames, not for physical display scans. Browser throttling, workload, refresh policy, callback delivery and the OS can still produce fewer updates than the monitor's nominal Hz.

## Public API and diagnostics

```js
import { HelionSurface, DEFAULT_FONT_SOURCES } from './src/index.js';
const surface = await HelionSurface.mount(canvas, view, {
  fontSources: DEFAULT_FONT_SOURCES,
  startupWorker: true,                 // default
  startupCache: 'my-app-assets-v1',     // opt in; omit for sensitive initial data
  pipelineConcurrency: 4,              // default
  maxFramesInFlight: 2,                // new default
  performanceHUD: true,
  onStartup(event) { console.log(event.stage, event.elapsedMs); }
});
```

`prepare(view, options)` also exposes asynchronous startup compilation and returns a normal ABI-3 compiled view. `compile()` remains synchronous. Old ABI-3 compiled objects remain compatible; the command record and geometry layout did not change. ABI 1/2 still require recompilation.

The **Startup** button shows `surface.startup` phase durations/cache/worker status plus host cadence/counters without GPU readback. `mountMs` means initialization returned, `firstSubmitMs` means the first complete frame was submitted, and `firstCompletedMs` means its queue-completion callback arrived. None is input-to-photon or proof of scanout. The boot overlay closes after that first full-quality completion, not when empty pipelines are merely ready.

## Reproduction and remaining verification

Run `npm test`, `npm run check`, the TypeScript API check, `npm run build` and `npm run check:build`. The standalone check compares all eleven exact shader sources and the entire embedded worker against the source graph. The worker is additionally executed in an isolated Node worker thread in tests. Fake IndexedDB tests check cold/hit/corruption/revision behavior; actual browser Worker+CSP/IndexedDB integration remains unverified here.

Run the included CPU tool with a separately extracted 0.3.0 source tree and your own fonts:

```sh
node tools/benchmark-startup-host.mjs --baseline=/path/to/0.3.0/helion-ui \
  --font=/path/to/NotoSans-Regular.ttf --font=/path/to/NotoSans-SemiBold.ttf \
  --font=/path/to/NotoSans-Italic.ttf --samples=5 --output=cpu-results.json
```

For actual device qualification, `npm start` then open **`/tests/startup.html`**. It records two startup attempts and continuous idle/fractional-scroll phases with the normal rAF loop, no per-frame GPU fence waits, and explicit readbacks only after stopping/draining each phase. It records worker/cache mode, first full-frame completion, observed rAF intervals, submitted FPS, skipped admissions, viewport/fonts and GPU-or-CPU timing labels. Change the credit limit to 1 and repeat for a same-version scheduling comparison. Browser shader/HTTP caches are not cleared; report order and repeat runs. Local-font runs deliberately cannot hit the persistent scene cache. Arena overflow or hiding the page invalidates the measured phase.

`/tests/gpu.html` and `/tests/text.html` retain the native UI and cached/direct pixel gates. `/tests/performance.html` retains the earlier serialized fixed-DPR stage-cost A/B; it is not a vsync benchmark. All real-font and display measurements require the target device.

**Native shader compilation, GPU execution, visual correctness, browser worker/cache behavior, end-to-end startup improvement and sustained device-vsync performance have not been verified in this environment.** The real browser navigation was blocked before load by `ERR_BLOCKED_BY_ADMINISTRATOR`, and the optional native validator binding was unavailable. These limits are not transformed into passing native results. Existing typography, renderer and framework-parity limitations remain in [LIMITATIONS.md](LIMITATIONS.md).

## Primary API references

[1] WHATWG HTML, rendering opportunities and event-loop processing: https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model

[2] W3C WebGPU, asynchronous pipeline creation, queue completion, resource timelines and query resolution: https://www.w3.org/TR/webgpu/

These references explain browser semantics, not evidence that Helion achieved a measured native frame rate. Local implementation/tests and the scoped CPU report support the release-specific claims.
