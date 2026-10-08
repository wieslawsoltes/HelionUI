# Template protocol extension — 0.13

Opcode 16 uses the existing 32-byte record for theme selection, manual/automatic
visual states, reduced motion and release of local part overrides. See
`src/templates/schema.js` and `shaders/templates.wgsl`; no uniform-size increase.
Node extension words 36/37/38 address template-part, system and instance records.
Designer record words 94/95 hold catalog assignment/default masks; commands 47/48/49
change template, theme or inherited defaults within GPU authoring transactions.
Runtime/shader/compiler versions must match. Initial-scene cache revision advances.
Ordinary template rendering has no new readback; explicit catalog/export workflows
retain host snapshot and bulk upload boundaries. Full contract: [TEMPLATES.md](TEMPLATES.md).

> **0.10 supplement:** [Dynamic DataGrid sources, fully Helion playground, embedded GPU preview, explicit action bridges and current limits](DYNAMIC-WORKSPACE.md). This supplement supersedes older playground-shell, immutable-source, single-surface transfer and frame-loop descriptions below. Historical sections retain their version-specific scope.

**0.11 text/display update:** see [TEXT-QUALITY.md](TEXT-QUALITY.md) for device-space source-curve glyph integration, native backing-pixel limits, compute HUD/pixel-copy presentation, quality flag bit 14, current validation and explicit cost/typography boundaries. The logical scene ABI remains 3; pre-0.11 allocation descriptions below are superseded where that document specifies a change.


### 0.10 additions

- Opcode 13: DataGrid source batches (command 1), sort (2), keyed selection (3).
- Opcode 14: mutable labels (1), list replacement (2), keyed list selection (3), expansion toggle (4).
- Bulk records stay immutable FIFO payloads and packets stop before a second bulk payload.
- Source descriptor: 24 words, keyed slots, active/spare string pools, upload inbox, revisions/results.
- Action outbox: 4-word header + 520 × 6-word events; only input-triggered host bridges map it.
- Presenter relay: 4-word header + 256 × 8-word commands + 65,536 scalar words + 16 frame words.
- The preview gets a second 64-byte CPU frame template. Its Fit viewport is filled and copied on-device.
- Binding 12 is the embedded sampled texture; binding 13 is relay storage. No normal rectangle readback.
- Producer, shader and decoder must be from the same 0.10 build; see the current supplement for bounds.

> **0.9 supplement:** [Editor, docking, models, and playground](EDITOR-WORKBENCH.md) defines the new workbench APIs and limits. Historical scope statements below apply to their stated releases.

# Command protocol v1 / compiled ABI 3

All offsets below are bytes unless marked as words. JS typed-array packing targets the little-endian platforms supported by the browser runtime. Integer payloads are u32 and floating-point payloads are f32; non-finite or nonrepresentable float values are rejected by the host queue. The protocol is in-process, not authenticated, encrypted or suitable as a network authorization boundary.

## Command record: 32 bytes

| Byte offset | Type | Meaning |
| --- | --- | --- |
| 0 | u32 | Opcode |
| 4 | u32 | Recipient node index, or `0xffffffff` for GPU hit testing/focus routing |
| 8 | f32 | X, in canvas-local CSS pixels |
| 12 | f32 | Y, in canvas-local CSS pixels |
| 16 | f32 | Data A |
| 20 | f32 | Data B |
| 24 | u32 | Code |
| 28 | u32 | Monotonic modulo-2³² sequence |

| Opcode | Name | Payload |
| --- | --- | --- |
| 1 | Move | x/y; pointer type in Code, pressure in A |
| 2 | Down | x/y; pressure in A; click count hint in B; Code 1=mouse/pen, 2=touch |
| 3 | Up | Same pointer coordinates; GPU capture handles activation |
| 4 | Wheel | x/y; A=horizontal CSS-pixel delta, B=vertical delta |
| 5 | Key | Code=key enum; A=modifier bits: Shift 1, Ctrl 2, Meta 4 |
| 6 | Text | Code=one committed codepoint; routed to GPU focus |
| 7 | Set | Recipient=node; Code=property enum; A=value |
| 8 | Cancel | Clear pointer capture and drag state |

The browser bridge normalizes wheel delta modes, maps special keys and forwards committed text. It sends one codepoint per Text command. This is not a UTF-8 byte stream. Multi-codepoint input spanning packets is not atomic with respect to intermediate query/layout frames.

Key codes are Backspace 8, Tab 9, Enter 13, Escape 27, Space 32, PageUp 33, PageDown 34, End 35, Home 36, Left 37, Up 38, Right 39, Down 40, Delete 46 and A 65 (for Ctrl/Meta+A). Other ordinary text uses Text packets. Modifier values are numeric bits encoded in the f32 A field.

Set properties: value 0, width 1, height 2, opacity 3, translateX 4, translateY 5, scaleX 6, scaleY 7, rotation 8, visible 9, scrollY 10, padding 11, textClear 12. Width/height `-1` means Auto. `visible=0` sets the hidden flag; nonzero positive values clear it. `textClear` ignores its value. Rotation is radians. Scale is clamped to at least 0.001; mirroring by negative scale is unsupported.

## Queue semantics

`CommandStream` begins with 256 slots and can grow to 8192 queued commands. Growth allocates host memory, not GPU memory. Consecutive Move commands with the same recipient coalesce. Consecutive Wheel commands also coalesce when recipient, position, code and direction per axis match and the accumulated f32 deltas stay finite. Changed positions, direction reversals and intervening discrete commands remain ordering boundaries. Sequence numbers may skip after coalescing.

A flush writes at most 256 commands, at most 8192 payload bytes, through one `queue.writeBuffer`. The unsent tail stays in FIFO order. Empty packets do not write the event buffer. Queue overflow throws an explicit RangeError; it does not silently discard discrete input. The browser bridge currently surfaces that failure rather than implementing an asynchronous backpressure protocol, so oversized paste/import events need application-side handling.

GPU sequence acceptance uses modular subtraction: accept differences strictly between 0 and 2³¹. This accepts wraparound and rejects duplicates/stale events, assuming no gap of 2³¹ or more. The host sequence counter is a JS number and packed to u32; remount long before exceeding JS safe-integer precision. This is ordering protection, not replay security.

`discrete` retains its meaning of any command other than Move/Wheel. Additional host-only `layout`, `query` and `hitTest` packet metadata choose conservative graph encoding without reading control state. Text generally permits query work but not layout; Space/Enter and activations remain potential layout actions. Scroll-only packets skip layout/query. Explicit-target commands need no hit discovery. Actual invalidation remains GPU state.

Default `submissionMode:'vsync', maxFramesInFlight:2` bounds unacknowledged frames and checks admission before flushing, resizing, encoding or acquiring the canvas texture. Independent completion snapshots return each submitted prefix without a chained registration wait. Zero explicitly selects the unbounded reference. ASAP uses its separate `asapFramesInFlight` limit (8 default), with yielding tasks. Vsync completion callbacks do not render or request catch-up work. [Submission contract](PACING.md).

## Frame record: 64 bytes

| Offset | Type | Meaning |
| --- | --- | --- |
| 0 | vec4<f32> | CSS width, CSS height, effective DPR, elapsed seconds |
| 16 | vec4<u32> | Node count, command count, frame number, cumulative runtime payload bytes |
| 32 | vec4<u32> | Packed invalidation/direct-submit interval; diagnostic mask; CPU layout-encode f32 bits; CPU total-encode f32 bits |
| 48 | vec4<u32> | Physical output width, height, 16px tile columns, tile rows |

At byte 32, bit 0 of the first word is full invalidation. Bits 1–31 hold the direct near-submit interval in units of 1/1024 ms. Zero means unknown/reset or an unrepresentable gap; it is not zero GPU work. The host subtracts double-precision monotonic timestamps before quantization; the shader does not subtract f32 uptime. All core invalidation consumers mask only bit 0.

The diagnostic mask's upper 16 bits encode observed rAF interval in units of 1/256 ms; zero means unknown/manual. Low values: 1=HUD visible, 2=native timestamp mode, 4=layout encoded, 8=data encoded, 16=full raster reference, 32=direct glyph reference, 64=ASAP, 128=measurement epoch reset, 256=glyph phase encoded. 512=detailed stage profiling, 1024=serial DataGrid reference, 2048=explicit no-timestamp mode. Bits 12–15 are reserved. The glyph flag describes cache work availability, not a separately timed pass in compact mode.

The third/fourth words contain f32 bits for CPU layout and complete command encoding through `encoder.finish()`. These are CPU time, never GPU duration. The fourth excludes the final frame-uniform write and queue submission. `stats.cpuSubmitMs` separately measures those host calls. All three timing clocks—animation time, near-submit interval and GPU timestamps—remain separate. Native timestamp results and the 120-frame histories stay on-device.

The host writes this entire record once for every admitted/submitted frame. The GPU integrates a pauseable animation clock, clamps long deltas after suspension and computes animation values. This avoids one host property update per animated object.

Uniform stage parameters are immutable 16-byte records placed at 256-byte-aligned offsets. These are uploaded once. Frame counters in GPU u32 state eventually wrap; JS transfer statistics use numbers.

## Invalidation and snapshots

Width/height/padding/visibility invalidate Measure/Arrange. TextBox content edits do not: its intrinsic control size is already content-independent. Edits to the linked filter and the linked Ready-only checkbox invalidate queries; unrelated value changes do not. Sort order is invalidated separately by initial data, column/direction changes and edits to the active sort column. Pure composition transforms and opacity do not invalidate layout. Scroll offsets and column widths update rendering without Measure/Arrange. The current invalidation granularity is the whole tree/table, not a minimal affected subtree.

`inspect({includeNodes=true, includeHeap=false})` explicitly copies state and optional nodes/heap to MAP_READ staging buffers. It stalls that diagnostic consumer while waiting for data. It is not used internally to process input or produce frames. There is no host callback stream, two-way application state mirror, clipboard-copy readback or durable persistence protocol.

## ABI inspection

Node stride is 72 words (288 bytes). Important word offsets: info 0; text 4; size 8; limits 12; margins 16; paint 20; placement 24; tracks 28; misc 32; action 36; binding 40; spans/page 44; available/desired 48; arranged rectangle 52; clip 56; composed matrix 60; translation/opacity 64; path/breakpoints 68; typography style pointer 71.

Global state occupies 64 words. Per-node control state begins at `64 + nodeIndex*16`. Offsets: value 0; scrollY 1; scrollX 2; opacity 3; text length 4; caret 5; anchor 6; translateX 8; translateY 9; scaleX 10; scaleY 11; rotation 12.

Useful global words: focus 0; hover 1; capture 2; layoutDirty 3; queryDirty 4; animationsEnabled 5; theme 6; debugBounds 7; activePage 8; frame 10; layoutRuns 11; queryRuns 12; processedEvents 13; overflowBits 15; gridNode 25; lastSequence 31; cumulativePayloadBytes 38; invalidInputCount 43; previousStripCount 45; sortDirty 49; sortRuns 50; last-frame glyphCacheHits 51, glyphCacheMisses 52, glyphCacheBypasses 53; compositionTable 54/count 55; combiningRanges 56/count 57; actualLayoutThisFrame 58 (reset to zero by clearFrame, set after active layout).

Table metadata now has 40 words. Words 32/33 point to the two cached full-sort identity arrays; word 34 selects the immutable final merge-parity array. The separate filtered visible index remains at table word 4. Runtime display-list headers contain four header words plus 644 heads: 512 per-node lists, 130 DataGrid section lists and two reserved words, total 648 words. Previous/current lists are separate GPU buffers. Initial compiled node/state/heap ABI 3 is unchanged; runtime display-list and metrics allocations must match the shaders. The command record is unchanged.

Float fields are stored as bit patterns in u32 arrays; reinterpret them, do not convert the integer value numerically. `fromBits()` in `schema.js` is an example for diagnostics. All heap offsets are words. The WGSL struct definitions and compiler are the authoritative binary contracts.

## Font resources and cache ABI 3

Prepared fonts are initial host assets, never a per-frame font stream. Source downloads and initial heap/curve uploads are separate from `64 + 32×N` frame payload accounting. The Text opcode now accepts valid Unicode scalar values through U+10FFFF (excluding surrogates); this does not imply complete shaping or collation. The browser still sends committed codepoints, not pre-shaped CPU glyphs.

Each node's word 71 points to an eight-word typography style: face count, face-chain pointer, feature bits (1=kerning, 2=ligatures), letter-spacing f32, line-height f32 (0=font default), alignment (0=left,1=center,2=right), decoration bits (1=underline,2=strike), reserved. Font tables include a sparse scalar-to-glyph directory, glyph path/advance records and bounded layout plans. Globals 54–57 reference the startup-compiled composition and combining tables. These are implementation data, not a public font-file format.

Binding 11 is the GPU-only glyph cache. It has a 16-word header, 16 metadata words and two job words per slot, then 1024 packed-coverage words per slot (64×64 bytes). Keys are the path pointer, four exact transform f32 bit patterns and two fractional-origin f32 patterns. Cache hit/miss/bypass counters reset each admitted frame. Indirect bytes 84–95 encode the cache raster job count. The consuming kernel does not bind the indirect buffer as writable storage. No buffer mapping or command notification is required on cache miss.

Glyph draw kind 4 uses its params words for transient cache placement; these words are deliberately excluded from visual damage equality. The primitive's font/shape/paint/transform/clip still participate. Cache-disabled mode reserves the same buffer but omits cache planning/raster dispatches. Ordinary paths/diagnostic vector glyphs retain kind 2.

See [TEXT.md](TEXT.md) for source formats, real-font defaults, exact caching and the intentionally bounded shaping contract.


## Resident timing schema 3 (0.6.0)

The metrics buffer is 16,384 bytes. Header words 0–31 describe the ring, source, rates, current range measurements, mode, errors and schema. Word 31 must equal 3. Old schema 2 buffers must not be decoded as schema 3. Compiled node/state/heap ABI 3 remains unchanged.

Primary history starts at `32 + slot*4`, with 120 records of [submission interval, actual layout duration/idle, GPU envelope or labelled CPU encoding, data]. Detail history begins at `512 + slot*24`. Fields 0–7 are eight phase durations; 8 CPU encoding; 9 detailed UI envelope (N/A when merged); 10 GPU end-to-end interval; 11 submitted-frame serial; 12 covered; 13 overlap; 14 gaps; 15 measured-phase mask; 16 flags; 17 actual-layout marker; 18 compute-covered; 19 raw nonadditive pass sum; 20–23 reserved.

Extra current-summary fields start at word 3392. Raw timestamp storage begins at 3424 and preserves sixteen u64 values as low/high u32 pairs. The raw mask and serial identify the source frame; absent slots are zeroed and marked unmeasured. The explicit decoder exports u64 values as decimal strings to avoid JavaScript number precision loss. The normal GPU path does not map these buffers.

Compact `timingDetail:'frame'` is default: a warm frame uses timestamp slots 0/1 for combined compute and 14/15 for the canvas pass. Frames with layout/query work keep corresponding boundaries at 2/3 and 4/5, and remaining compute at 6/7. With detailed stage profiling, the eight indices correspond to input, layout, data, scene, glyph, sparse, HUD and present. Merged stage values are -1/N/A, not fake zero. An encoded but inactive layout pass can have a raw measured lifetime while the actual-layout graph says Idle.

The GPU computes the min-start/max-end envelope and exact-order interval union; overlap is sum minus union, gaps are envelope minus union. None is a hardware busy-time or scanout counter. Consecutive latest measured ends give GPU end Hz. Direct host near-submit intervals give Submit FPS, while observed browser callbacks give rAF Hz. Histories reset on measurement epochs and preserve submitted serials. Query resolution and the metrics dispatch occur after the final canvas pass; the HUD reads the previous sample. See [FRAME-SYNC.md](FRAME-SYNC.md).


## Cache requests / optional diagnostics (0.6.1)

After the tile-damage map, scratch reserves partition heads, 12 words per candidate primitive (next, 7 exact key words, 2 first-pixel f32 words, width, height), and 16 counter/padding words. `GLYPH_SHARDS=max(1,GLYPH_SLOTS/32)`. Discovery, owner planning and counter publication are separate dispatches. Only the counter-publication kernel writes indirect raster dimensions; consumers do not bind that buffer as writable storage.

The HUD font buffer adds 95x95 f32 kerning values at word 196096, giving 820484 bytes. Warm text formatting uses bindings 0/3/4/5 and no font-heap/state binding. Application node/state/heap ABI 3 and metrics schema 3 remain; producer/shaders/decoder must nevertheless come from the same release.

Frame diagnostic bit 0 is **effective** HUD visibility (requested and pipelines ready), not a guarantee that a requested deferred overlay has already appeared. Bit 11 is explicit timing-off; bit 1 is zero in that mode. Histories retain submission/CPU timing while native GPU measurements are unavailable, with no timestamp writes or resolves. These changes require no additional per-frame upload.

## 0.7 scheduling provenance

Bit 12 (`0x1000`) in frame word 9 is set for bounded vsync. The metrics recorder already retains that word, allowing the GPU HUD to label the previous sample's pacing policy. No other timing/command field changes; the payload remains 64 bytes plus 32 per command, with zero bytes on a deferred attempt. No new GPU buffer or mapping is introduced.


## Framework extension — 0.8.0

The wire packet remains 32 bytes, with the same 64-byte frame uniform and ordering/backpressure rules. Opcode **9 (Animation)** uses recipient=node ID, code=0 start / 1 pause / 2 resume / 3 stop / 4 seek, data.x=elapsed seconds for seek. It operates on extended keyframe/expression records attached to the target, not arbitrary host callbacks or old legacy from/to tracks. The runtime validates command arguments. No new per-frame geometry/style upload or state readback is introduced.

Node ABI remains 72 words. Word 47 (`config.w`) now holds zero or an exact numeric-f32 extension heap address; it is not a bitcast pointer. The 40-word optional extension records contain panel metadata, four-side padding, matrix/origin, axis gaps, anchors, optional track limits and style records. Global state word 59 counts dynamically styled nodes; font words 54–57 and layout marker 58 are preserved. New kinds 14–21 cover Panel, DockPanel, WrapPanel, UniformGrid, Viewbox, Drawing, ContentControl and ContentPresenter.

Drawing node word 68 points to a four-word descriptor: commands address, expanded command count, width bits, height bits. Each command has 24 words. Kinds: 1 geometry/paint, 2 text, 3 push transform, 4 push rectangular clip, 5 push opacity, 6 pop, 7 glyph run. Brushes use 16-word records plus optional gradient/image data; each clip reserves 12 words. Primitive translation.z/w hold exact numeric-f32 clip/brush addresses, with zero retaining legacy behavior. Retained drawings are immutable authored streams; transform/clip working records are GPU-owned during emission.

Dynamic style property records use 16 words and four words per condition; local composition Set wins over activators. Extended animation descriptors are addressed by words 10/11 of the existing 12-word animation records. New metadata requires the 0.8 compiler/runtime/shaders together. Old ABI-3 scenes with no extensions remain accepted, but old runtimes must not consume new extension-bearing scenes. Initial-scene persistent cache revision advances for this compiler. See [FRAMEWORK.md](FRAMEWORK.md) for supported bounds and non-parity.

## Designer extension — 0.12.0

Opcode **15 (Designer)** carries recipient=DesignSurface node, code=DesignCommand,
`data.x/y` and `position.x/y` as command-specific scalars. It uses the same 32-byte
record and existing ordered bulk staging for text/project restore. Geometry edits
may invalidate layout; pure pan/zoom/selection and timeline playback remain resident
composition/editor work. Explicit source export reads the fixed document/header
through the existing platform-snapshot boundary, not the ordinary frame loop.

Kinds 30–35 are DesignSurface, DesignTree, PropertyInspector, AnimationTimeline,
ColorPicker and internal DesignAdorner. Feature bit 32 enables their optional graph.
The compiled ABI remains 3; node extension words 34/35 point to the resident designer
and authoring slot. Header 128 words, object records 96 words, fixed name/text banks,
6×52-word keyframe banks/object, 4×12-word state banks/object and sixteen named
solid-brush records are described by `src/designer/schema.js`. All reserved native
objects are allocated once; no CPU hit-test mirror is introduced.

`DESIGNER.md` documents command semantics, validation, capacities, snapshot costs
and non-parity. Producer, compiler and shader code must come from the same build.
