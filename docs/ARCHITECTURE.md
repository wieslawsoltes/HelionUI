> **0.10 supplement:** [Dynamic DataGrid sources, fully Helion playground, embedded GPU preview, explicit action bridges and current limits](DYNAMIC-WORKSPACE.md). This supplement supersedes older playground-shell, immutable-source, single-surface transfer and frame-loop descriptions below. Historical sections retain their version-specific scope.

**0.11 text/display update:** see [TEXT-QUALITY.md](TEXT-QUALITY.md) for device-space source-curve glyph integration, native backing-pixel limits, compute HUD/pixel-copy presentation, quality flag bit 14, current validation and explicit cost/typography boundaries. The logical scene ABI remains 3; pre-0.11 allocation descriptions below are superseded where that document specifies a change.


> **0.9 supplement:** [Editor, docking, models, and playground](EDITOR-WORKBENCH.md) defines the new workbench APIs and limits. Historical scope statements below apply to their stated releases.

# Architecture — retained data, compute execution (0.4.0)

> **0.8 additions:** See [FRAMEWORK.md](FRAMEWORK.md) for the current layout, styling, composition, drawing and playground contracts. Detailed earlier sections below describe the original engine unless superseded there.

## 1. Ownership, not magic migration

JavaScript and HTML declarations compile once into an ABI, rather than moving a JavaScript interpreter, DOM engine or arbitrary event handler onto the GPU. The host retains identifier and resource metadata; mutable control values, caret positions, selection, scroll offsets, row indexes and animation clocks are authoritative in GPU storage buffers. A caller may retain the original declarations or compiled allocations, but they are not a live CPU mirror.

The browser still delivers pointer/keyboard/IME events, provides the canvas viewport and device-pixel ratio, schedules animation-frame callbacks, submits WebGPU command buffers and displays the final texture. A hidden textarea bridges committed OS text. This is necessary platform integration, not a second visual control tree. The small startup/error overlay and explicit diagnostic/keyboard buttons are host UI, not claimed to be GPU-rendered.

The normal path has no buffer mapping, property polling, CPU hit-testing, CPU layout, CPU tessellation, CPU glyph rasterization or CPU sorting. Diagnostic `inspect()` and the explicit benchmark/golden-test readbacks are deliberately exceptions. Optional timestamp results resolve directly into a GPU-resident history/HUD; frame completion uses a host acknowledgement without mapping or inspecting scene data.

## 2. Compile and retain

`h()` builds plain objects. `fromHTML()` consumes an inert template into the same objects. `compile()` validates IDs, sizes, tracks, references, action enums, resource limits and fixed layouts, then emits preorder records and a flat heap.

Nodes are 288-byte records. Control state is 16 words per node after 64 global words. The heap contains child links, Grid tracks, codepoint strings, mutable text reservations, curve resources, font metrics, row cells, indexes, query scratch and animation descriptions. A retained curve has line/quadratic/cubic source segments plus GPU output reservation. Real static TrueType-outline fonts are loaded and parsed on the host once, then packed into normalized glyph curves, Unicode directories, metric records and supported layout plans. No font files are embedded in the distribution. The old original alphabet remains an explicit diagnostic/test option, not the normal mounted UI. Node word 71 points to an inherited typography style. See [TEXT.md](TEXT.md).

Structural edits and font/style replacement require recompilation/remount. There is no heap allocator, garbage collector or insert/remove-node protocol running on the GPU in this version. Allocations are bounded before startup.

## 2a. Startup concurrency and lossless preparation

A typed CPU heap and bulk Unicode classification preserve the previous compiled bytes. The one-shot worker fetches/parses full font faces and packs the scene while the main realm acquires the GPU and builds the unchanged pipeline set in bounded parallel batches. A standalone worker bundle is embedded without a document-import-map dependency. Worker load restrictions use the same host compiler. The opt-in one-record IndexedDB cache contains initial scene data only, with revision/source/declaration/limit/user-agent keys and full-buffer/manifest integrity checks. It never receives mutable GPU state. Local/private font data is not persisted. [Startup contract, privacy and measurements](STARTUP-VSYNC.md).

## 3. Frame graph

```text
Browser events ──> bounded FIFO ──> 32-byte commands
Browser clock / size ─────────────> 64-byte Frame uniform

clearFrame
  -> hitTest [parallel over nodes and packet events]
  -> input [ordered single invocation]
  -> schedule [GPU writes indirect dispatch arguments]
  -> Measure: intrinsic bottom-up / constraints top-down / constrained bottom-up
  -> Arrange: top-down final rectangles
  -> sortBlocks / mergeRows* [sort dirty only]
  -> filterScan / scanBlocks / scatterRows / resolveSelection
  -> finishWork
  -> animate
  -> compose [top-down depth dispatches]
  -> emit [GPU display list]
  -> damage [exact current/previous primitive comparison]
  -> prepareGlyphCache / rasterGlyphCache [real fonts, damaged glyphs; optional]
  -> prepareDraws / buildJobs
  -> prepareJobs / makeStrips
  -> prepareStrips / binStrips
  -> composite / finishFrame
  -> optional HUD font preparation / formatting [previous metrics]
  -> fullscreen presentation + GPU diagnostic overlay
  -> optional resolve 16 timestamps / recordMetrics [no readback]
```

The CPU encodes the known graph and immutable stage offsets. Host-only packet classifications distinguish potential layout, query and hit-test work without inspecting control state. GPU flags choose zero/nonzero work and keep sort invalidation separate from filter invalidation. TextBox edits do not change its intrinsic size and no longer invalidate layout; filtering scans/compacts the cached full sorted order. Scroll-only packets omit layout/query encoding. Geometry and page changes still invalidate the whole layout tree. Pure composition properties and scrolling do not invalidate layout.

Default vsync arms one next rAF before encoding and admits at most two unacknowledged frames. A full pipeline preserves input and defers before all upload/canvas side effects. Each admitted bounded frame registers its own queue completion snapshot immediately; notifications return capacity, never submit a vsync frame. Explicit zero restores the unbounded reference; ASAP independently defaults to eight. Callback delivery is not a GPU-duration or presentation measurement. [Current scheduler](PACING.md).

Each depth dispatch is a device-wide dependency boundary for that stage. No workgroup busy-waits for other workgroups. Input is serialized deliberately to preserve packet order; hit discovery and bulk work are parallel. This is a correctness-first bounded graph, not a persistent megakernel.

The indirect argument buffer is not simultaneously bound as writable storage to a kernel consuming it indirectly. Per-entry bind groups are derived from the controlled source call graph and tested. Shader source edits must preserve this rule.

## 4. Two logical layout phases

The conceptual contract follows Measure (desired size under constraints) and Arrange (final parent-assigned slot), as described by Microsoft's WPF layout documentation [1]. It is **not literally two GPU dispatches**, and it is not WPF's exact layout algorithm.

The Measure phase uses an intrinsic bottom-up pass to estimate Auto-track content, a top-down constraint propagation pass, and a constrained bottom-up pass for wrapping and desired dimensions. Arrange visits parents before children using the resulting desired sizes and resolved tracks. Thus a depth-D tree has four groups of D+1 depth dispatches when dirty.

Grid supports pixel, Auto and positive weighted-star tracks, with 1–32 tracks per axis, gaps and spans. Spanning desired sizes are apportioned evenly to participating nonpixel tracks. The solver does not iterate to a full fixed point when width-dependent height and height-dependent width interact. Shared-size groups, WPF layout rounding, Grid min/max definitions, layout transforms and all framework remeasure rules are absent.

StackPanel offers horizontal/vertical stacking with unconstrained measurement along the stacking axis. Canvas uses explicit offsets. Border and ScrollViewer measure contained content. Arrange applies margins, min/max constraints, alignment and padding. Visibility may be conditional on GPU page selection or viewport-width breakpoints.

## 5. Input and control state

`hitTest` transforms input positions into each interactive node's coordinate system and resolves the highest preorder/painter index with an atomic maximum. Its bounds and clip are from the last composed frame. Then one invocation consumes commands in sequence order, handles focus, capture, key routing, editor mutation and predefined actions.

All hits within a packet use the same previous-frame geometry. A page or geometry change within that packet does not cause an interleaved new hit-test pass. This is an explicit latency/semantics tradeoff, not full routed-input equivalence. Rectangular bounds, not exact vector fill geometry, define hits. Disabled ancestors suppress hit candidates.

Controls include Button, CheckBox, Slider, TextBox, ProgressBar and DataGrid. Actions are a bounded opcode vocabulary: toggle, increment, set, page, clear, animation pause, theme, bounds and scroll reset. Bindings read numeric node values or built-in metrics. There are no arbitrary host callbacks in the GPU path.

## 6. DataGrid

The table stores up to 65,536 logical records in a power-of-two-padded allocation. Each record has eight 32-bit cells. Text cells point to length-prefixed codepoint strings; other cells are f32 values. Column definitions, widths, filter links, stable identity, visible position, edit buffer and scroll state reside in the heap/control state.

Sorting retains a complete identity order separately from the filtered visible index. A 256-lane local workgroup sort and binary-rank ping-pong merges produce the full cached order, using row identity as a stable tiebreaker. At 65,536 records the sort has one local dispatch and eight global merges, replacing the old 136 global bitonic dispatches. Query work then uses 128-lane workgroups to filter/scan this order; a single invocation scans at most 512 block totals; scatter compacts matching identities. Selection is restored by identity. Padding sentinels sort after real records, with explicit stable rank handling to avoid colliding writes.

Filter edits do not sort again; only initial data, sort-column/direction changes and edits to the current sort column dirty the full order. Binary-rank merging still can require O(N log²N) comparisons overall, despite fewer device-wide dispatches. Strings are compared directly in resident storage, ASCII-case-insensitively. The filter checks text columns; Ready-only excludes nonzero status values. This is not a locale-aware database engine. Dispatch counts are not a measured speedup.

The draw emitter visits visible rows only, capped at 128 emitted rows. Row-height values are fixed per table. Selection, resizing, vertical and horizontal scrolling and numeric editing stay on device. Editing accepts signed decimals bounded to absolute value 1e8; editor display uses at most six fractional digits, while Enter without edits preserves the original f32 cell exactly. Click-away cancels the uncommitted edit. The demonstration schema is generated entirely on-device; custom data is packed and uploaded at mount.

## 7. Sparse-strip renderer

### Relationship to Vello

The Vello architecture document [2] explicitly separates the Sparse Strips renderer family, whose shared preprocessing is CPU-side, from its compute-centric research renderer. We therefore do **not** silently replace the requested GPU-only processing with Vello's hybrid preprocessing, and do not claim that Helion contains Vello.

Helion independently implements a restricted sparse horizontal-strip representation inspired by that design. It does not reproduce Vello's complete algorithms, text stack, paint system, snapshots or production optimization. No Vello implementation is copied into this package.

### Implemented stages

1. At initialization a compute kernel flattens line/quadratic/cubic resources into retained line segments. Curves have bounded adaptive parameter stepping, at most 32 lines per source curve. The flatness tolerance is in asset space, not recomputed for device scale.
2. Per-frame compute emission turns laid-out controls and text into a bounded primitive list. Each primitive retains shape information, transform, bounds, clip, paint and painter order. Text glyphs reference retained paths, not CPU-generated pixels.
3. Exact GPU glyph-cache planning/rasterization reuses analytical 8-bit coverage under matching outline/transform/subpixel keys. Oversize or uncacheable glyphs use direct coverage without a CPU round-trip. GPU jobs cover the 4-pixel-high rows intersecting primitive bounds. Each job classifies 4×4 tiles as empty, full or boundary. Analytic line/pixel signed-area integration supplies simple fill coverage; distance coverage supplies strokes and rounded shapes.
4. Empty tiles emit nothing. Consecutive full tiles form horizontal strips with implicit alpha 1. Boundary tiles retain 16 bytes of 8-bit coverage. Jobs, strips and alpha reservations use bounded atomic counters.
5. Strips are binned into damaged 16×16 output tiles. Each output workgroup sorts up to 256 strip references with a shared-memory network sized to the next power of two of the actual bin length, rather than always 256.
6. Compute performs front-to-back premultiplied compositing in linear-light RGB, with exact opaque early exit, then explicit sRGB encoding to an opaque `rgba8unorm` storage texture. Clean tiles retain their pixels. A fullscreen vertex/fragment triangle presents that completed image. Core UI path/glyph rasterization remains compute-side; the optional diagnostic HUD uses GPU-built real-font coverage masks and glyph bins, then blends text and antialiased graphs in the presentation fragment shader. The isolated path is specified in [HUD.md](HUD.md).

### Known renderer differences

This is a per-primitive/job classification pipeline, not Vello's complete active-edge scan and scheduling implementation. Simple filled polygons have an analytical area reference test; complex self-overlaps, winding cancellations and transformed clipping are not fully qualified. Nonzero/evenodd fill selection exists but is not claimed to exactly handle every complex path. Strokes are distance-to-segment unions with round-like ends, not full SVG join/cap/dash semantics. Clip regions are axis-aligned bounds; transformed specialized DataGrid/TextBox subclips need more work. There is no image/filter/gradient/texture paint engine.

Display-list generation still runs every admitted frame. Two retained GPU lists are compared exactly through per-node links, independent of parallel allocation order. Changes mark both old/new bounds; initial/resize/theme/overflow cases invalidate the required output. Sparse jobs and compositing skip clean tiles; real-font coverage has a fixed exact-key GPU cache, but there is no solid-band hierarchy or runtime arena growth. Large scrolling/animation regions still cause large raster work. Dense overdraw can overflow fixed bins; the final presentation always reports a red top stripe and counter. Cached-versus-full exact image checks are included in the native gate but have not been run here.

## 8. Memory and transfer accounting

Default output dimensions remain capped at 2048×2048 physical pixels, with DPR capped at 2. The runtime lowers effective DPR for larger CSS surfaces as before. View records remain 288 bytes/node; state is 256 global bytes plus 64 bytes/node. Two approximately 2 MiB display lists each retain 644 heads (512 nodes plus 130 DataGrid sections and alignment). The sparse arena adds a 64 KiB default tile-damage map; full-sort ping-pong indexes add 512 KiB at 65,536 records. Optional timing uses a 16 KiB history, a 128-byte resolve buffer and a 16-query set. The HUD mask buffer is 784,384 bytes and its text/bin buffer 56,840 bytes. Actual driver allocation and memory bandwidth are not profiled.

The showcase now has 202 views, 65,536 records and eight timelines. Glyph/path counts depend on the fonts loaded. ABI 3 adds font/style/Unicode/layout-plan metadata and a glyph-cache binding, while preserving the 40-word table records and retained full-sort indexes. The default exact coverage cache adds 8,536,128 bytes; font heap and curve memory are additional and scale with repertoire. The normal mounted surface does not retain its own copy of the prepared font objects. Initial font acquisition/parsing costs are separate from frame work. Immutable stage records continue to describe global merge widths instead of every global bitonic compare step. Runtime explicit payload accounting remains 64 bytes/frame plus 32 bytes/command. Timestamp history stays on-device, with no new normal-frame readback. Driver traffic, queue acknowledgements, internal copies and explicit diagnostics are separate.

## 9. Typography execution boundaries

The common text module supplies metric-based measurement, supported kerning/ligature/mark plans, loaded-repertoire composition, line breaking, glyph emission and caret/selection widths. TextBox intrinsic geometry is content-independent; typing remains layout-clean. Scalar mapping/fallback, UTF-32 editing, cache keys and miss rasterization stay on device. Initial font file parsing and composition/combining-table construction happen on the host, not in per-frame callbacks.

The cache uses exact keys, 32 probes, current-frame pinning and an LRU-like replacement choice. One bounded planner publishes multiword keys safely; a later dispatch writes disjoint coverage slots before strips consume them. Changing cache placement is not a visual scene change, so transient glyph params are ignored by damage comparison. The cache does not use quantized font-size buckets or subpixel rounding; exact fractional-key churn and planner cost are explicit tradeoffs. Two new core kernels make 30 core compute pipelines; the timing-history pipeline is separate.

This text engine is not a GPU port of HarfBuzz or a fully conformant OpenType layout implementation. TrueType hinting, all language/lookup behavior, bidi, full grapheme/line-break rules, variable/color/CFF fonts and typography rasterizer parity are absent. Native cache/reference byte equality and FPS remain unverified here. [TEXT.md](TEXT.md) defines the implemented subset and tests.

## 10. Primary references

[1] Microsoft, **Layout — WPF**, two-pass layout, desired size, constraints and arrange slots: https://learn.microsoft.com/en-us/dotnet/desktop/wpf/advanced/layout

[2] Linebender, **Vello Architecture**, Sparse Strips versus compute-centric research renderer, retrieved 2026-09-23 (file content SHA `6f58b9c797dc59d267c7ccbc6cd81115208b3941`): https://github.com/linebender/vello/blob/main/ARCHITECTURE.md

[3] W3C, **WebGPU Shading Language**, storage memory, workgroup synchronization, shader types and reserved words: https://www.w3.org/TR/WGSL/

[4] W3C, **WebGPU**, command submission, device timelines, buffers, mapping, textures and indirect dispatch: https://www.w3.org/TR/webgpu/

[5] Google, **WebGPU overview**, browser-facing API and platform context: https://developer.chrome.com/docs/web-platform/webgpu/overview

These references explain underlying concepts, not evidence that Helion's native pipelines passed validation. The code, test record and explicit limitations define the implementation claim.

## Historical diagnostic timing change (0.5.0; superseded by 0.6 below)

The source font heap, compiled ABI and UI rendering algorithms are unchanged in 0.5.0, apart from masking the new packed diagnostic interval out of the invalidation flag. When native profiling is enabled, the render graph is split into scene, glyph and sparse passes for attribution. With profiling disabled or native timestamps unavailable, it retains one combined UI pass. HUD preparation reads previous metrics, presentation follows, and only then are current timestamps resolved and recorded. This includes the HUD and canvas pass in the GPU span without a circular self-measurement dependency. The history-recording dispatch itself, later browser compositor work and scanout are outside that span. GPU end-to-end cadence includes the intervening work/idle between consecutive final-pass end timestamps. [Measurement contract](SUBMISSION-TIMING.md).


## Current frame path (0.6.0)

The DataGrid now emits its header, up to 128 visible rows and footer/focus in independent invocations of `emitGridParts`. Each owns a separate list head and painter-key range; exact damage visits all node/section heads. Default compact profiling keeps a clean/scroll frame in one compute pass plus one canvas pass. Layout/query work and opt-in detailed attribution introduce their necessary/diagnostic boundaries. Final output uses a tiny fullscreen blit plus scissored unchanged real-font HUD shader in the same render pass. The GPU reports timestamp interval envelope, union and overlap, not an additive busy-time fiction. The exact command graphs, scope and native-test limitations are in [FRAME-SYNC.md](FRAME-SYNC.md).
