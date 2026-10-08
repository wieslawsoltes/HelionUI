# Current typography qualification — 0.15

[TYPOGRAPHY.md](TYPOGRAPHY.md) supersedes earlier statements that no raw OpenType
shaping, Arabic joining or bidi paragraph path exists. These are now implemented
for the documented bounded scope and integrated into selected UI text paths.
**Full complex-script, full UAX #14, variable/CFF/color fonts, editor bidi and
shaped proportional paragraph editing, IME/accessibility and native GPU/performance
qualification remain incomplete.** Static ASCII, generated counters and specialized
list/tree/editor chrome can retain the established lightweight/fixed-cell paths.
No universal text-path or native-platform parity is claimed. Shaper buffers, CPU
startup/font preparation, explicit file/clipboard snapshots and memory costs are
specified in that guide. Historical sections below retain their release scope.

# Current template qualification (0.13)

Templates are now implemented for the bounded owner/part/state contract in
[TEMPLATES.md](TEMPLATES.md). Earlier statements below that templates were absent
are historical release boundaries, not the current supported subset. Complete
WPF/WinUI dependency properties, item/data templates, routed events, dynamic
allocation, OS backdrop materials and native GPU qualification remain absent.
Catalog-definition edits remount and reset Studio main-project history; ordinary
template/theme assignment and undo run on the GPU. Native pixels/performance
remain unverified.

> **0.10 supplement:** [Dynamic DataGrid sources, fully Helion playground, embedded GPU preview, explicit action bridges and current limits](DYNAMIC-WORKSPACE.md). This supplement supersedes older playground-shell, immutable-source, single-surface transfer and frame-loop descriptions below. Historical sections retain their version-specific scope.

**0.11 text/display update:** see [TEXT-QUALITY.md](TEXT-QUALITY.md) for device-space source-curve glyph integration, native backing-pixel limits, compute HUD/pixel-copy presentation, quality flag bit 14, current validation and explicit cost/typography boundaries. The logical scene ABI remains 3; pre-0.11 allocation descriptions below are superseded where that document specifies a change.


> **0.9 supplement:** [Editor, docking, models, and playground](EDITOR-WORKBENCH.md) defines the new workbench APIs and limits. Historical scope statements below apply to their stated releases.

# Limitations and non-claims — 0.8.0-experimental

This release is an experimental implementation with executable source and a native validation harness, not a qualified production UI framework. The host tests passing does not make the WGSL kernels correct on a GPU. Native compilation, runtime validation, visual comparison, device compatibility and performance still need execution on permitted hardware/browser configurations.

## Not fulfilled as full equivalence

**Vello:** no upstream Vello implementation is linked or ported. The implementation uses independent simplified sparse-strip concepts and analytical/distance coverage routines. It does not provide Vello fidelity, its complete scan-conversion architecture, image/paint/filter coverage, text stack, scheduling optimizations or regression corpus.

**WPF/Avalonia:** the layout contract is inspired by two-phase measure/arrange, but the solver and API are a subset. DockPanel, WrapPanel, UniformGrid, Viewbox, constrained Grid definitions, opt-in layout rounding, scoped styles/resources and cosmetic GPU transitions now have bounded implementations; see [FRAMEWORK.md](FRAMEWORK.md). No complete dependency-property system, full binding engine, dynamic templates/resources, complex Grid convergence, shared-size groups, custom layout callbacks, layout transforms, popup roots, native docking or routed events are present. A two-phase logical contract is implemented using multiple depth dispatches; a literal two-dispatch complete solver is not claimed.

**Browser/HTML:** HTML is an inert declaration syntax. Arbitrary DOM, CSS, script execution, event handlers and browser APIs do not move onto the GPU. OS events, committed text, canvas sizing, time, command submission and final presentation still require the browser host. No compute kernel runs indefinitely after the CPU stops submitting work.

## Rendering and typography

Coverage and painter compositing run in compute; the final full-screen copy uses a vertex/fragment pipeline. The full display list is emitted/compared every admitted frame; sparse raster/composite work is limited by an exact GPU tile-damage map. Boundary alpha storage is sparse, but scrolling/full-window animation can dirty most tiles and cost still grows with path complexity. Real-font glyphs can reuse exact GPU coverage; the cache/planner limits and cold-miss costs are described below. The diagnostic HUD itself is drawn in the presentation fragment shader. Fixed bounds do not magically guarantee throughput.

Curve flattening uses at most 32 lines per source curve in asset space. It does not reflatten for zoom and is not formally bounded in screen-space error. Stroke handling lacks the full cap/join/dash/miter semantics of SVG and Vello. General self-intersections, overlapping winding contributions and evenodd coverage can differ from a production rasterizer. Rotation/scaling of clip bounds produces conservative axis-aligned clipping; specialized TextBox/DataGrid subclips are not correct for all composition transforms. DrawingContext rectangular clips use transformed edge coverage; products of primitive/nested clip coverage are not exact correlated-mask intersections. General rounded/geometry clipping remains absent.

DrawingContext now supports raw RGBA images, relative linear/radial gradients and transformed rectangular clip coverage. It does not add full image codecs, focal gradients, patterns, arbitrary geometry/opacity masks, blend modes beyond over, group isolation, backdrop effects, shadows/blur, HDR, wide gamut, external paint textures or full antialiased clip-path intersection. Drawing PushOpacity modulates each primitive rather than an isolated layer. Colors use a basic linear-light/sRGB path, not color-managed print/display qualification.

The normal UI uses actual static TrueType outlines/metrics, loaded from configured public sources or local user files. No font binaries or third-party font outlines are embedded. GPU text includes a bounded Latin/Greek/Cyrillic default-plan subset of pair kerning, direct standard ligatures, canonical pair composition, mark-to-base/mark-to-mark attachment and combining-sequence navigation. This is not complete Unicode/OpenType shaping: bidi, Arabic/Indic shaping, full normalization/line breaking/UAX #29 clusters, complex contextual lookups, all lookup flags, GDEF ligature caret data, emoji sequences and color glyphs remain unsupported. Query collation stays ASCII-case-insensitive. Variable fvar, CFF/CFF2 and WOFF2 are explicitly rejected. WOFF1/TTC/static glyf-based SFNT are supported within bounds. Font line metrics come from the primary face, not the maximum fallback metrics. Cross-font marks are not attached. Rendering is unhinted grayscale, not ClearType/CoreText/FreeType parity. The diagnostic original alphabet remains only for explicit legacy/host-test compilation; it is never chosen silently after a real font failure. See [TEXT.md](TEXT.md).

## Controls and application integration

No accessibility/control semantic tree is mirrored to the browser. A canvas label and hidden text-input bridge are not an accessible substitute for native controls. Keyboard/IME/mobile behavior is unqualified across browsers. IME forwarding covers committed text only; there is no GPU preedit underline/candidate anchor. Pointer text-selection dragging, undo/redo, clipboard copy/cut, drag-and-drop, autocomplete and spellcheck are absent.

A single primary pointer is supported. DataGrid touch dragging scrolls vertically; general multitouch gestures, inertia, pinch zoom and touch scrolling for every ScrollViewer are not implemented. Hit testing uses previous-frame rectangles and clip bounds; all events in a packet use that geometry. Explicit-target protocol commands are trusted application input, not permission-checked user actions.

Only the built-in action and numeric metric vocabulary executes on the GPU. There is no JS callback graph or application event outbox. Application storage, OAuth, network/database connections and persistence are outside the package. Structural edits and bulk data replacement require remount. GPU-only cell edits are lost on device loss or disposal unless the application explicitly extracts them. There is no CPU mirror or automatic state recovery.

DataGrid has one instance per surface, one active sort column, fixed row height, fixed initial schema/data, simple text/status filtering, single selected identity and numeric editing. General cell controls/templates, frozen columns, grouping, row mutation, rich validation, spreadsheet formulas and locale formatting are absent. Numeric editor display uses at most six fractional digits. No-edit commit preserves original f32 bits; edited decimals round to f32. Click-away cancels rather than implicitly committing. Some numeric display slots use integer or one-decimal formatting.

## Bounded implementation

Default maximums: 512 nodes, depth 24, 65,536 rows, 8 columns, 256 text codepoints, 16,384 primitives, 131,072 row jobs, 262,144 strips, 196,608 boundary masks and 256 strip references per output tile. Renderer dimensions cap at 2048 physical pixels per axis. Different supported limits can be supplied at mount, but hard kernel limits apply; each path has at most 1024 source segments. Numeric editing needs text capacity ≥32.

Arenas are allocated once. Overflow flags: 1=primitives, 2=row jobs, 4=strips, 16=flattened lines, 32=alpha tiles, 64=per-output-tile strip references. Runtime output shows a red top stripe and counters on frame overflow. Missing overflowed work is not recovered automatically. One-time flattening reservations are precomputed to fit its step bound. Resource exhaustion may fail device creation or buffer creation; no lower-quality CPU fallback is attempted.

The command FIFO holds at most 8192 events and uploads at most 256 per frame. Oversized pastes can hit backpressure and currently throw rather than asynchronously pacing the input source. Text edits are capacity-bounded. Event sequences and GPU counters are u32; counter rollover and f32 precision must be considered for very long sessions. Render resolution can be reduced to meet limits rather than matching native DPR exactly.

## Performance status

There are no collected native FPS, latency, throughput, power-use, GPU-memory or cross-browser benchmark results. The new HUD and benchmark measure the target device when run; their presence is not a recorded result. Avoid describing this as faster than DOM, WPF, Avalonia or Vello. GPU-resident ownership does not establish that the workload is GPU-bound. Input is serialized on-device; the host still encodes a multi-dispatch graph; string comparison is direct; binary-rank merging still can require O(N log²N) comparisons; display-list emission/comparison and large dirty regions remain costs. The default two-frame admission bound can sacrifice throughput when notifications arrive late; independent per-frame snapshots remove chained waiting but cannot eliminate notification latency. Explicit unbounded mode can accumulate stale GPU work under overload.

Priorities after native correctness: collect target-device timing/latency data using the included tools; compare against reference images and verify retained-damage/cached-glyph equality; profile cache planning, fractional-key churn and dense scrolling; implement bounded GPU allocation growth; improve Grid convergence, text shaping/selection and accessibility; add identity-stable data mutation and an explicit event outbox. The current internal ABI is version 3 and rejects version-1/version-2 compiled objects. These are unresolved work items, not promises of background implementation.

## Typography cache and performance limits

A fixed GPU cache now reuses exact analytical glyph coverage. This removes repeated edge integration only when glyphs fit and exact keys are reusable. Default capacity is 2048 slots at 64×64 bytes each, with about 8.14 MiB total cache allocation including metadata/jobs. Font heap/curve allocations are additional. Large, highly transformed or uncacheable glyphs use direct analytical coverage without size snapping. Cache-disabled/reference mode still reserves the same arena. There is no runtime cache arena growth, MSDF fallback or quality reduction to maintain a claimed FPS. The planner uses independent exact-key partition owners in 0.6.1 plus a parallel miss-raster dispatch. Concentrated hash partitions can bypass while other partitions have capacity; bypass retains analytical quality but may increase work. Native performance remains unmeasured.

Real outlines, initial table preparation and a larger loaded repertoire add startup work and storage relative to the old diagnostic alphabet. Fine fractional scrolling may churn exact subpixel keys. Existing all-frame emission/comparison remains. The normal 64-byte frame + 32-byte-command payload is unchanged and no CPU cache miss/readback path is added, but these properties alone do not prove equal or better frame rate. No native benchmark or visual result was collected. The new native text gate and real-font A/B benchmark must run on target hardware.

The startup parser is bounds-checked, not independently security-certified. Faces with excessive data, unsupported containers or unsupported outline complexity can be rejected. Standard font hint instructions are ignored, overlap/self-intersection raster semantics remain limited, and fixed per-curve flattening caps do not give unlimited zoom precision. Changing loaded fonts remounts the app and resets GPU-owned edits.


## Startup and cadence qualification (0.4.0)

The local CPU startup benchmark is measured, with exact compiled-buffer comparisons; native end-to-end startup and display FPS are not measured. Worker creation/load/CSP denial uses the identical main-thread compiler, which can still occupy the host thread. Full fonts and all pipelines still need cold preparation. Four concurrent pipeline requests do not guarantee four hardware/compiler execution threads. Browser worker, IndexedDB, HTTP and driver-cache behavior must be checked on the target browser. Runtime font requests remain external unless local files are selected.

The opt-in persistent cache stores one complete INITIAL scene per origin. Initial app data can be persisted; it is not a secrets store. Live edits are never saved into it. Local files/byte sources/prepared faces are excluded. URL content changes require a new versioned URL or cache revision key. Integrity hashes detect accidental corruption, not hostile same-origin code. Storage denial/eviction/timeouts fall back to regular preparation.

In 0.5.0, completion-independent rAF without an application cap removes admission skips, not native workload cost or browser throttling. The GPU can still miss a refresh deadline, and browser rAF does not certify the monitor's physical refresh rate. SUBMIT FPS, RAF HZ, GPU timing and first-completion latency are different measurements. The upper frame-flag interval is quantized at 1/256 ms only for HUD telemetry; glyph coordinates and animation clocks are not quantized by this change.

## 0.4.1 HUD-specific limits

The diagnostic HUD uses the primary loaded face and a bounded printable-ASCII label/numeric vocabulary, not a new full shaping/control system. Native-resolution grayscale masks are linearly reconstructed for fractional placement; unlike the unchanged main UI exact-key cache, that reconstruction is not an exact fresh per-position raster. Large glyphs use direct coverage, and glyph-bin saturation uses a bounded full-list fallback. The additional isolated 0.80 MiB storage, first-use/DPR rasterization, per-visible-frame formatting pass and final diagnostic compositing have unmeasured GPU cost. In 0.5.0 those costs are included in the overall GPU span and separately attributed to HUD and final blit; they remain outside the UI-only subspan. Native pixel/fidelity/performance validation was blocked in this environment. [HUD.md](HUD.md).

## Submission and timing limits (0.5.0)

`vsync` means refresh-aligned application submission, not guaranteed physical presentation at a monitor's nominal Hz. The 0.7 default `maxFramesInFlight:2` bounds unacknowledged application frames; delayed notifications can still reduce admitted cadence. A per-frame queue signal is not a scanout acknowledgement. A live limit of 0 restores an explicitly unbounded reference, which can accumulate latency under overload. No scheduler can guarantee new completed images at every display opportunity when actual GPU work exceeds capacity.

ASAP is opt-in and bounded to eight unacknowledged submissions by default. MessageChannel yields between frames; callback delivery and browser scheduling can limit throughput. Multiple ASAP renders can update the same browser presentation opportunity; high Submit FPS or GPU done Hz does not imply equally many displayed frames. More frequent work can consume more energy. The app does not disable OS/browser display synchronization.

The HUD now displays the previous submitted GPU sample to measure its own rendering. GPU span is elapsed GPU-timeline time, not pure shader busy time, and excludes the history dispatch itself, queue idle before the first measured pass, browser composition and scanout. GPU end Hz is measured between the latest measured end timestamps of consecutive frames, not from host callback arrivals. Submission FPS and GPU done Hz use roughly 500 ms windows capped at 120 samples; charts remain unsmoothed per-sample timings. Zero can reflect timestamp quantization. More printed decimal places do not improve the browser's clock resolution.

Native profiling adds two UI compute-pass boundaries to isolate costs; query writes/resolution and HUD formatting are not free. When profiling is disabled, the combined UI compute pass is retained. No complete native shader, visual, GPU-throughput, power, latency or cross-browser qualification was possible in this authoring environment. Included native gates and benchmarks must run on the target configuration.


## Frame-sync release (0.6.0)

Parallel DataGrid emission, scissored HUD shading and compact profiling are implemented, but native GPU execution, exact rendered-pixel equivalence and sustained FPS/latency effects are **unverified** in this environment. Host tests and exact initial compiled buffers do not establish those results. The source trace's short `GPUTask` slices are GPU-process CPU tasks, not shader busy time. The GPU interval union handles overlapping pass ranges but still is not a hardware utilization counter; ranges can include waits and backend stage effects. Separate 0.6 native gates are provided, not claimed to have passed.

The default continues uncapped admission on delivered browser animation frames. It cannot force the browser/OS to provide the monitor's nominal cadence or prevent accumulated latency during overload. ASAP remains opt-in and may increase power/queued work without increasing displayed frames. The bounded host frame log is not a device queue-depth/scanout oracle. `timingDetail:'stages'` adds profiling boundaries; compare its overhead with default frame mode on the target device.

A single DataGrid per surface remains the ABI limit. Each of its 130 emission sections has a 32,768-painter-key capacity; default global primitive capacity is 16,384. Overflow is explicit, not silently rendered with incorrect order. Font, geometry, accessibility, recovery, input and framework-parity limits elsewhere in this document remain. See [FRAME-SYNC.md](FRAME-SYNC.md).


## Regression follow-up (0.6.1)

The user's 0.6.0 report is not resolved by host tests or relabeling timers. Current native compilation, execution, pixels and speedup remain unverified. Cache request/ownership parallelism adds scratch and two dispatches; collision patterns may trade serial work for more direct raster work. HUD pair-table caching adds one-time GPU work. These are workload changes, not a benchmark result.

Default deferred HUD moves diagnostic compilation after the first full-quality application frame. It does not remove total compilation, make network requests free, or guarantee lower end-to-end startup. The overlay is initially absent; first UI and first HUD readiness must be reported separately. Browser/native compiler resource use may still interfere while it runs. The default timing mode remains frame; a live off mode disables timestamp writes/resolution for an explicitly CPU-labeled comparison. It does not hide the HUD or lower the font/display quality. [Current implementation record](RECOVERY.md).


## Framework and playground additions (0.8)

The current compatibility map is [FRAMEWORK.md](FRAMEWORK.md). Static selectors/resources and recording run during host preparation, not in WGSL. Runtime panel layout, pseudoclass transitions, keyframes, expression evaluation and drawing/paint coverage are implemented in compute. The public drawing/composition facade is not every WPF/Avalonia/WinUI/Win2D overload. No complete pen dash/join/miter model, isolated layers/effects, general geometry masks, 3D composition, natural-motion solver, arbitrary expression interpreter or full FormattedText engine is supplied. Original framework/text/accessibility limits still apply.

The playground editor is HTML/CSS. Its app source runs in an isolated worker and the app preview uses the actual GPU framework. Run remounts and resets the preview; retained GPU edits are not silently read back. Imported code does not run until Run. Browser opaque-origin/CSP isolation and native preview behavior are unverified; worker memory/GPU workload exhaustion is not solved. Use intended local code, not untrusted multi-tenant workloads.

The feature update retains pacing, timing and original scene bytes but changes common/layout/input/emission/paint shader source. Added pipeline preparation, style dispatches, drawing interpretation, paint/clip sampling and heap reservations may affect native performance; no equal-FPS or startup improvement is asserted.
