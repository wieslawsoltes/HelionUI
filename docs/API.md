# 0.13 template API supplement

See [TEMPLATES.md](TEMPLATES.md) and `src/templates/index.d.ts` for the new
ControlTemplate, TemplateBinding, ThemeResource, VisualStateManager,
TemplateController, live themes and Studio workflows. Existing APIs follow.

> **0.10 supplement:** [Dynamic DataGrid sources, fully Helion playground, embedded GPU preview, explicit action bridges and current limits](DYNAMIC-WORKSPACE.md). This supplement supersedes older playground-shell, immutable-source, single-surface transfer and frame-loop descriptions below. Historical sections retain their version-specific scope.

**0.11 text/display update:** see [TEXT-QUALITY.md](TEXT-QUALITY.md) for device-space source-curve glyph integration, native backing-pixel limits, compute HUD/pixel-copy presentation, quality flag bit 14, current validation and explicit cost/typography boundaries. The logical scene ABI remains 3; pre-0.11 allocation descriptions below are superseded where that document specifies a change.


> **0.9 supplement:** [Editor, docking, models, and playground](EDITOR-WORKBENCH.md) defines the new workbench APIs and limits. Historical scope statements below apply to their stated releases.

# Public API and authoring subset

> **0.8 additions:** See [FRAMEWORK.md](FRAMEWORK.md) for the current layout, styling, composition, drawing and playground contracts. Detailed earlier sections below describe the original engine unless superseded there.

Imports are ES modules. The main entry is `src/index.js`; TypeScript declarations are in `src/index.d.ts`. The source works without the showcase and without third-party runtime dependencies.

## Views

`h(type, props, ...children)` returns a declaration. Nested child arrays are flattened; strings become TextBlocks; false/null/undefined children are omitted. Types are Grid, StackPanel, Canvas, Border, TextBlock, Button, CheckBox, Slider, TextBox, ProgressBar, DataGrid, Path and ScrollViewer.

A declaration is data, not a component function or observable object. Host code can generate it however it likes before compilation. Object mutation after mount does not update GPU buffers. Node IDs must be unique strings. Internal indices are stable for a mount.

### Layout properties

`width` and `height` are finite numbers or `'auto'`; omitted/Auto stores -1. Minimum sizes default to 0; maxima default to 1e7. `padding` is a uniform number; `gap` is a number. `margin` is a number, a one-value array, `[horizontal, vertical]`, or `[left, top, right, bottom]` — not CSS's four-value order.

Grid `columns`/`rows` are arrays or space/comma-separated strings such as `'120 Auto * 2*'`. Each axis supports up to 32 tracks. Children use zero-based `column`/`row` and positive `columnSpan`/`rowSpan`. Alignments are `'stretch'`, `'start'`, `'center'`, `'end'`. StackPanel `orientation` is `'vertical'` or `'horizontal'`. Canvas children use `x`/`y`. `wrap:true` enables space/tab/hyphen/zero-width-space wrapping with hard line breaks and bounded long-word cluster fallback. It is not full Unicode line breaking. See [TEXT.md](TEXT.md).

`hidden:true` collapses a declaration. At runtime use `surface.set(id,'visible',0/1)`. `page` is a nonnegative page number or -1 for every page. GPU page actions select which pages are visible. `minViewportWidth` is inclusive and `maxViewportWidth` exclusive, measured in CSS pixels. Default clipping is enabled; `clip:false` avoids adding the node's own bounds to the inherited clip. Rounded corners are visual geometry, not rounded clipping regions.

### Paint and composition

Colors accept `'#RRGGBB'`, `'#RRGGBBAA'`, `'transparent'` or packed little-endian RGBA u32. Supported common paints: background, foreground, borderColor, borderWidth and radius. These are simple solid paints, not brushes/images/gradients.

`translateX`, `translateY`, `scaleX`, `scaleY`, `rotation` (radians) and `opacity` compose through parents. Rotation/scaling are around the arranged center. Scale must be positive; the shader clamps it to at least 0.001. There is no transform-origin property or layout transform. Theme toggling is a demonstration color remapping, not a general theme/resource system.

### Actions and bindings

Actions are strings or `{type, target?, value?}`. `target` is an ID; omitted means the originating control. Available types: none, toggle, increment, set, animations, theme, bounds, clear, page and resetScroll. `set` changes the target's numeric value. `clear` empties a target TextBox. `page` changes the global page to `value`. The checkbox's inherent toggle happens in addition to an explicitly supplied action; do not assign a self-toggle action unless a double toggle is intended.

Bindings are `{source?, metric?, scale?, offset?}`. A source without a metric means the source node's value. Metrics: value, matched, selected (identity plus one), nodes, strips, upload, frame, layout, rows, overflow, activePage. A binding is a read-only GPU numeric expression `metric*scale+offset`, not general reactive JavaScript or a full dependency graph. TextBlock appends a formatted number; ProgressBar reads a normalized value. Sliders and checkboxes own their direct state.

## Composition animations

```js
h('Border', {
  id: 'orbiting', width: 80, height: 80, background: '#67d4e6',
  animations: [
    { property: 'rotation', from: 0, to: Math.PI*2, duration: 4,
      easing: 'linear', alternate: false, repeat: true },
    { property: 'opacity', from: 0.4, to: 1, duration: 2,
      easing: 'smooth', alternate: true, repeat: true }
  ]
})
```

Duration/delay are seconds. Properties are limited to composition properties. Duplicate animations for the same property on one node are rejected. Easing choices are linear, smooth (smoothstep), and spring (a fixed damped oscillation expression). Repeat and alternate default true. `speed:'sliderId'` maps that node's value through `0.15 + max(0,value)*2.85` and scales timeline time; changing it can jump phase. The global animations action pauses advancement; animation values are still evaluated from the frozen GPU time. A Set to an animated property is overwritten by that timeline on the next evaluation.

## Paths and text

`path` accepts an SVG-like string with M/L/H/V/Q/C/Z, absolute or relative, or nine-number segment arrays `[kind,x0,y0,x1,y1,x2,y2,x3,y3]`, kind 0=line, 1=quadratic, 2=cubic. Unused points in a segment are still present. Unsupported commands, including A/S/T, are rejected. Filled shapes need explicit Z closure. `stroke:0` fills; positive stroke draws a stroked path. Use duplicate Path declarations for both fill and stroke. `fillRule` is nonzero or evenodd, subject to the renderer qualification limits.

The optional `viewBox` is an asset bounds tuple **[minX,minY,maxX,maxY]**, not SVG's x/y/width/height tuple. Paths fit uniformly in their arranged content rectangle. Source control-point bounds are used when the tuple is omitted. Flattened resources are retained across frames and are not regenerated under zoom.

The normal mounted UI loads static TrueType-outline fonts using `loadFont`/`loadFonts`. `fontFamily`, `fontWeight`, `fontStyle`, `fontSize`, `kerning`, `ligatures`, `letterSpacing`, `lineHeight`, `textAlignment` and `textDecoration` inherit through declarations. Font files are parsed/prepared at mount, uploaded once, then the supported text layout and glyph coverage operate in compute. The GPU repertoire supports scalar maps, real metrics, fallback faces and the bounded GSUB/GPOS subset in [TEXT.md](TEXT.md), not complete Unicode shaping. Exact glyph coverage is cached on-device without CPU miss notifications.

The synchronous `compile(view)` with no font uses the explicitly diagnostic original alphabet. For proper-font precompilation, pass `compile(view, {fonts: await loadFonts(...)})`. A bare `mount(canvas, declaration)` instead loads the default real Regular face. The showcase explicitly loads three faces. Real font load failures never silently choose the diagnostic alphabet. No font binaries/third-party outlines are embedded in the distribution; configured public URLs are fetched by the user's browser, or user-selected File objects are read locally.

TextBox provides focus, insertion, combining-sequence-aware caret movement, Home/End, Shift selection, Ctrl/Meta+A, Backspace/Delete, plaintext paste and committed IME text forwarding. It is a basic single-line editor. Pointer drag selection, word navigation, rich text, undo, clipboard copy/cut and IME preedit rendering are absent. Text capacity defaults to 256 codepoints and is fixed for the mount.

## DataGrid declarations

```js
h('DataGrid', {
  id: 'table',
  dataColumns: [
    { title: 'Name', field: 'name', type: 'text', width: 200 },
    { title: 'Load', field: 'load', type: 'number', width: 130, editable: true }
  ],
  data: [ {name:'Alpha', load:12}, {name:'Beta', load:29} ],
  filter: 'query', rowHeight: 38
})
```

Columns support text, number, status and progress. Text cells are strings; other values must be finite f32-representable numbers. Status displays 0=Ready, 1=Queued, 2=Paused. Progress displays a clamped 0–1 bar. Column widths are bounded by minWidth/maxWidth, default 56/600. Without custom data, the built-in six-column generator creates `rowCount` synthetic rows. Custom columns require explicit data and cannot use the fixed-schema generator.

One table is supported per surface. Row count cannot change after mount. Rows remain in resident storage; virtualization applies to display emission, not allocation. Sorting uses one column, ASCII-case-insensitive text and numeric comparison with identity tiebreaks. Filtering searches text columns. Ready-only can point to a CheckBox and excludes rows with nonzero status columns.

A numeric cell becomes editable when its column's editable flag is set. Select then press Enter, or double-click. Enter commits; Escape or another pointer-down cancels. Enter without edits leaves the original f32 unchanged. The editor displays up to six fractional digits; general table formatting is deliberately limited. Numeric editing requires textCapacity of at least 32. There are no arbitrary per-cell templates, validation callbacks, row insertion, frozen columns, grouping, hierarchical rows, remote paging, undo or multi-column sort.

## Surface lifecycle and diagnostics

`await HelionSurface.mount(canvas, declarationOrCompiledOrTemplate, options)` compiles, acquires a device, allocates buffers, validates native shader compilation and creates pipelines. Failures reject the promise. Options include `limits`, prepared `fonts`, `fontSources`, legacy diagnostic `font`, `pixelRatio`, `powerPreference`, `input:false`, `autoStart:false` and `onError`. Performance options are `submissionMode` (`'vsync'` by default, or `'asap'`), `maxFramesInFlight` (0–32; default 2 bounds vsync; explicit 0 selects unbounded reference), `asapFramesInFlight` (1–32; default 8, independent ASAP limit), `performanceHUD` (default false), `profiling` (collect even with HUD hidden), `gpuTiming` (request timestamps when profiling and advertised; false forces labeled CPU-encoding timing), `damageTracking` (false forces full-frame raster reference), `glyphCache` (false forces direct analytical glyph coverage with identical fonts/coordinates), `timingDetail` (`frame` default, `off` disables timestamp writes/resolution, `stages` adds attribution), `deferHUD` (true by default; diagnostics compile after the first UI frame), `onDiagnosticsError`, `parallelGrid` (false selects serial section reference), and `hudScissor` (false uses the fullscreen diagnostic reference). `limits.glyphCacheSlots` configures a power-of-two capacity from 1 to 8192, default 2048. Fonts are separate initial assets; no per-frame text upload/rasterization API is introduced. See [PACING.md](PACING.md) for current submission semantics and [FRAME-SYNC.md](FRAME-SYNC.md) for timing ranges; [PERFORMANCE.md](PERFORMANCE.md) records earlier rendering optimizations.

`set(id, property, value)` queues one Set command and returns the surface. `send(opcode, payload)` queues a protocol command. `id(name)` resolves an index. `start()` begins continuous frames; `stop()` cancels that continuous loop, but later input/property changes may schedule work. For fully manual driving use `autoStart:false, input:false` and call `render(timestamp)` with timestamps in the performance-clock domain. `render()` returns true when admitted/submitted and false when the in-flight limit, disposal or fault prevents submission. A rejected attempt preserves queued commands; manual callers must try a subsequent frame. `dispose()` terminates listeners, resources and the device.

`focusTextInput()` focuses the hidden browser textarea; it does not select a GPU TextBox. The GPU control must already have focus. OS keyboard policy may require a user gesture.

`inspect({includeNodes,includeHeap})` returns explicitly read-back u32 arrays and statistics. This is the only supported data-extraction route in this prototype and is intentionally coarse. Float fields need reinterpretation. The normal frame loop does not call it. Use the protocol document for offsets; do not treat this experimental ABI as stable across versions.


`setPerformanceHUD(visible=true)` toggles the GPU-rendered FPS/graph overlay and returns the surface. `hudVisible` and `gpuTiming` expose host configuration, not read-back GPU state. The device's timestamp capability is requested at initialization; `timingDetail:'off'` temporarily disables its use. Enabling the HUD after an unprofiled mount uses the explicitly labeled CPU-encoding mode. The sample enables the HUD at mount.

Host statistics retained from earlier releases: `completedFrames`, `skippedSubmissions`, `peakFramesInFlight`, `lastCompletionLatencyMs`, `cpuLayoutEncodeMs` and `cpuRenderEncodeMs`. Completion latency runs from the checkpoint request to its promise callback; it is not a native GPU timestamp duration. SUBMIT FPS measures admitted-frame cadence, not physical presentation. Native timestamps and graphs remain on-device; `inspect()` still provides no implicit timing-history polling.

Compiled objects use version 3. Passing version-1/version-2 compiled data fails with a recompile message. The command wire record remains 32 bytes. Internal heap/node/render metadata is experimental, not a version-independent public serialization format.


## Startup and refresh pacing (0.4.0)

`mount()` prepares the full scene and GPU pipelines concurrently. Startup options: `startupWorker` (default true; identical host fallback for worker load/CSP failure), `pipelineConcurrency` (integer 1–32, default 8), `startupCache` (default false; opt-in application revision string), `signal` and `onStartup({stage,detail,elapsedMs,done?,total?})`. The bundled public examples opt in to one-record initial-scene persistence; local/prepared fonts, imported workspaces and live GPU edits are not persisted. Version font URLs/cache keys when remote assets change. [Detailed cache/privacy contract](STARTUP-VSYNC.md).

`await prepare(view, options)` prepares a full ABI-3 view asynchronously without mounting a GPU surface. `await clearStartupCache()` clears the single cache record, returning false when browser storage is unavailable. `surface.startup` reports phase timings, cache/worker path, mount/first-submit/first-completion timing. These host timings never imply physical presentation. `surface.stats.animationFrameCallbacks` counts observed rAF callbacks and `surface.stats.rafHz` is their count-over-time cadence in 0.6.0, zero while unknown.

The normal loop requests every browser animation frame independently of completion callbacks. Since 0.7.0 default vsync has a two-frame bound with independent per-frame acknowledgements; a saturated bound preserves unsent commands and sends no bytes while saturated. `stop()` cannot be restarted by a late completion callback. Manual `render()` does not report a fictitious rAF rate. The HUD separates submitted FPS and observed rAF Hz, with an observed-interval reference line. [Native reproduction](../tests/startup.html).

## 0.4.1 performance HUD visuals

The existing `performanceHUD` / `setPerformanceHUD()` API now selects a real-font, antialiased responsive panel (420×338 in 0.5.0). No additional public option or command field is required. It uses the first loaded font face (the primary retained face), native effective pixel scale and isolated GPU coverage storage. Existing ABI-3 scenes and startup caches remain usable. Hiding omits HUD formatting/raster work; showing reuses masks unless scale changed. The rendering technique is retained; measurement definitions are superseded by the current section below. [Original rendering design](HUD.md).

## Live submission mode and timing snapshots (0.7.0)

```js
const surface = await HelionSurface.mount(canvas, view, {
  submissionMode: 'vsync',  // default: refresh-aligned producer
  maxFramesInFlight: 2,    // default: independent, bounded frame pipeline
  asapFramesInFlight: 8,   // opt-in throughput mode's default credit limit
  performanceHUD: true
});
surface.setSubmissionMode('asap');  // yielding throughput, no remount
surface.setSubmissionMode('vsync'); // restore rAF submissions

// Explicit diagnostics only, not a normal frame loop:
surface.stop();
await surface.whenSubmittedWorkDone();
const timings = await surface.inspectPerformance();
```

`setSubmissionMode()` returns the surface. A fresh mount defaults to vsync; no last-used-mode persistence is implicit. `maxFramesInFlight` controls vsync and `asapFramesInFlight` controls ASAP independently. Zero is an explicit unbounded vsync reference. `setMaxFramesInFlight(limit=2)` changes the vsync capacity without remounting or discarding edits. The browser still controls display presentation. Uncapped application admission can accumulate GPU work under overload; the mode is not a throughput or latency guarantee.

`whenSubmittedWorkDone()` and the compatibility getter `lastSubmissionCompletion` create an explicit snapshot fence for all application work submitted up to the call. Neither is awaited by the normal loop. Bounded modes register each submitted tail independently. Only the explicit unbounded reference retains sparse checkpoints. Completions return capacity but do not schedule vsync draws. `stats.completedFrames` means acknowledged submitted serials, not measured completed/presented FPS. `pendingAcknowledgements` and `peakFramesInFlight` include callback delay and batching, so they are not driver queue-depth measurements.

`inspectPerformance()` explicitly copies/maps 16,384 bytes and decodes metrics schema 3. Call after a profiled frame; uninitialized/old buffers are rejected. `source` is `gpu-elapsed-ranges` or `cpu-encoding-only`; GPU-only unavailable values are -1/null. `sampleFrame`, `rawTimestampFrame`, `rawTimestamps` and `current.measuredPhaseMask` expose provenance and exact u64 decimal strings. Current/history entries include interval, envelope, union-covered ranges, overlap, gaps, compute coverage, raw nonadditive pass sum, actual-layout marker and individual durations only where measured. `phaseMeaning` distinguishes compact/merged ranges. This is an explicit diagnostic readback, never needed by input/rendering/HUD.

`setTimingDetail('off'|'frame'|'stages')` changes native profiling pass boundaries and resets measurement history without remounting. Default frame mode reduces pass boundaries; merged phase fields are N/A. Stage ranges can overlap and must not be summed as busy time. `inspectFrameSync()` returns the newest 240 submitted frames of bounded host-only callback/encode/submit timing, plus host stats, viewport and mode; it does not read GPU buffers or wait for completion. The callback offset is arrival minus the browser timestamp, not a nominal monitor deadline. [Complete contract](FRAME-SYNC.md).

## Deferred diagnostics (0.6.1)

With default `deferHUD:true`, `mount()` waits for required UI pipelines, not the optional rich HUD. `hudVisible` is requested visibility; readonly `hudReady` indicates diagnostic pipelines are ready. Until then the same full-quality application UI renders through an independent minimal blit. `hudError` and optional `onDiagnosticsError(error)` report diagnostic preparation failures. Setting `deferHUD:false` eagerly prepares the HUD, useful for manual/native test callers. No font substitution or remount occurs.

`startup.pipelineEntries` stores per-entry promise start/duration; `hudPipelineMs` and `hudReadyMs` separate deferred diagnostics. `firstCompletedMs` describes first application-frame acknowledgement, not first HUD or scanout. See [RECOVERY.md](RECOVERY.md) for the current contract and validation scope.

## Per-opportunity scheduling inspection (0.7.0)

`inspectFrameSync().opportunities` records the newest 240 delivered callbacks, including `deferred-capacity` outcomes, separately from the submission log. `pacing` exposes the configured bounds and acknowledgement strategy. `stats.rafCapacityDeferrals` is not a compositor-dropped-frame counter. `PerformanceSnapshot.vsyncPacing` reports the previous GPU sample's bounded/unbounded policy. All host scheduling logs are read without GPU access. See [PACING.md](PACING.md).
