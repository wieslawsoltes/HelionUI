# Helion UI 0.15 — retained OpenType shaping and GPU paragraph layout

## Delivery scope

This release continues the saved typography development source on top of Helion
0.14. It connects retained shaping to UI measurement and rendering rather than
shipping only an unrelated shader experiment. The designer, playground, original
showcase, and new Typography Lab are built from the same source. A separate
`@helion/typography` package contains no UI runtime or frame scheduler.

This is an **experimental, bounded implementation**, not complete HarfBuzz,
Unicode, WPF/WinUI, or mature-editor parity. It does not establish state-of-the-art
throughput or unchanged FPS. Native shader acceptance, rendered pixels, complete
browser interaction and hardware performance have not been established in this
execution environment. `typography-validation.json` separates checks actually run
from supplied native gates. Historical reports retain their original release scope.

## Compute and host boundaries

Startup reads a font and prepares immutable cmap, metrics, GSUB, GPOS, GDEF,
feature/script/language plans and Unicode data. This CPU asset preparation is not
shaping individual live strings. The runtime performs normalization, cluster and
font selection, substitution, positioning, bidi resolution and paragraph layout
in WGSL. Results are retained glyph IDs, scalar cluster spans, advances, offsets,
levels, line records, visual ordering and dual-affinity caret positions.

UI rendering consumes those records through the existing sharp grayscale glyph
coverage, exact-phase cache, sparse-strip and compute-compositing pipeline. Final
presentation only copies pixels. No DOM text measurement, Canvas text atlas,
HarfBuzz/WASM runtime, CPU shaper fallback or per-frame glyph notification loop is
introduced. Browser events, IME committed text, font/file acquisition, command
encoding/submission and explicit snapshots remain host services.

## Framework authoring

```js
import {h, ShapedText, HelionSurface} from './src/index.js';
const view = h('StackPanel', {padding:24, gap:12},
  ShapedText({text:'office AVATAR', fontFeatures:{liga:1,kern:1}, fontSize:24}),
  ShapedText({text:'مرحبا بالعالم', flowDirection:'rtl', textAlignment:'start', wrap:true}),
  h('TextBox', {id:'entry', text:'A\u030a café', fontSize:22})
);
const surface = await HelionSurface.mount(canvas, view, {fontSources});
```

`textShaping` accepts `auto` (default), `opentype`, and `simple`. `ShapedText` creates
an ordinary TextBlock with the explicit OpenType path. Font properties are inherited:
`fontFeatures`, `fontScript` (four-character OpenType tag or auto), `fontLanguage`,
`flowDirection` (auto/ltr/rtl), font size, letter spacing, line height and text
alignment. PascalCase property aliases are accepted. `kerning:false` and
`ligatures:false` feed the plan unless an explicit feature override takes precedence.

Auto selects retained shaping for TextBox/native-content hosts, mutable labels,
template text bindings, non-ASCII authored text and explicit shaping options.
Immutable ASCII labels without those options preserve the older low-allocation
path. The old path is not a universal complex-script fallback. `simple` deliberately
opts out. The main editor, generated counters, many list/tree/chrome strings and
numerically formatted grid cells continue to have specialized existing paths;
this release does not claim every glyph-producing widget is a paragraph editor.

UI runs are limited to 4,096 input scalars each. `shapingCapacity` reserves future
content; mutable label/text capacities are respected. Over-capacity live text sets
the UI typography overflow bit (128) and invalidates the result instead of silently
truncating. Restoring valid text recovers. Normal exact comparisons catch equal-
length replacements. Repeated frames reuse the shape result; changed width, font
size and alignment reflow without repeating GSUB/GPOS. Font-family/style aliases
select already-prepared face plans and invalidate the affected run.

### Paragraphs and input

The same retained advances and positioned glyphs drive TextBlock measure/draw,
DrawingContext text and the supported single-line TextBox caret/selection path.
Paragraph records contain line extent, baseline, participating-font metrics, visual
order and per-glyph pixel positions. Tab stops, hard breaks including CRLF/trailing
empty lines, start/end alignment, and a documented word/character wrapping policy
are included. Logical clusters are not split arbitrarily during wrapping.

Bidi resolution operates before line layout; line processing resets trailing
whitespace levels and reorders each line. Carets have leading/trailing affinity.
TextBox visual left/right movement and hit tests use these coordinates. Selection
can produce separate visual rectangles for one logical range. GDEF ligature carets
are used where supported; otherwise proportional cluster caret positions are used.

The word-break classifier is **not complete UAX #14**, dictionary breaking,
hyphenation or justification. It covers common spaces, hard breaks, hyphens and
basic CJK boundaries/punctuation. Shaping is not rerun at a forced break inside a
connected word; scripts requiring changed joining/substitution at that new line
boundary need more work. Normalization/shape/line code is bounded and still needs
full conformance and complex-font fuzzing. User-authored line-height overrides can
be smaller than glyph extents; such overlap is not silently corrected.

### DataGrid

Explicit `textShaping:'opentype'` allocates a rolling 128-row cache **per text
column**, plus header runs, not one run per 65,536-row table. The default per-cell
reservation is 96 scalars; `shapingCapacity` changes it. Post-query synchronization
reads the current sorted/filtered row and compaction/string pointers on the GPU.
Unchanged text reuses its run. Integer and floating-point cells retain the existing
formatter. Font shaping does not upgrade ASCII case-insensitive queries to Unicode
collation. More columns or larger capacities can exceed the explicit heap budget.

### Designer, templates and code editors

Studio reserves shape storage for its mutable authored control slots before those
slots become text controls. Pooled template variants refer to exclusive per-slot
run directories rather than sharing mutable prototype shaping state. Inherited
font changes use the prepared catalog. Closing/undoing/reusing a slot does not
require a CPU text renderer. The current Studio app allows a 96 MiB heap budget
(previously 64 MiB) for the added storage. This is a cap, not an eagerly allocated
96 MiB array; actual required bytes are reported. Extension-address precision
checks remain enabled, and large font/catalog configurations can still reject.

The code/text editor now uses the pinned Unicode grapheme table for non-word
navigation and deletion across its gap buffer. Emoji ZWJ sequences, flags,
combining clusters, Hangul and tested Indic conjunct sequences are preserved by
those operations. **TextEditor/CodeEditor still use fixed code cells and their
existing lexer/wrap renderer. Full editor bidi, proportional shaped wrapping,
visual-order selection, IME preedit/candidate anchoring and accessibility are not
completed.** No semantic language service or production editor-parity claim is made.

## Supported shaping engine and limits

The bounded raw-layout interpreter handles GSUB lookup families 1–8 and GPOS
families 1–9, including contextual/extension processing, GDEF classifications and
mark filtering. Feature and script/language plans are prepared once. Pair values,
mark/base/ligature/mark attachment, cursive connections and supported ligature
carets use the retained tables. Legacy kern is available where GPOS is absent.
Device/variation adjustments and unsupported anchor details are reported rather
than represented as complete support. Configuration and runtime diagnostics matter.

The implementation includes canonical decomposition/reordering/composition,
cluster fallback selection, Arabic joining and Hangul normalization. Unicode
properties are pinned to **16.0 / ICU 76**, not claimed to be the latest Unicode
release. Dedicated Indic/Southeast-Asian/Universal-Shaping-Engine reordering is not
complete. `strictScripts:true` rejects unsupported script processing in the
standalone API; otherwise warnings expose best-effort processing. This is not
HarfBuzz equivalence across all scripts/fonts or every lookup-flag edge case.

Accepted font containers remain static TrueType-outline SFNT, TTC face selection
and WOFF1. **WOFF2, variable axes, CFF/CFF2, color/bitmap/SVG emoji fonts, hinting,
vertical typography and platform ClearType/CoreText rasterizer parity are not
implemented.** Missing glyphs need a supplied fallback font; the engine does not
discover/download platform fonts automatically. Coverage remains unhinted grayscale.

## Standalone reusable module

```js
import {loadFont, prepareTypography, GpuTypography} from './index.js';
const face = await loadFont('/assets/MyStaticFont.ttf');
const prepared = prepareTypography([face], [{
  text:'office AVATAR', features:{liga:1,kern:1},
  inputCapacity:1024, capacity:3072, width:360, fontSize:24, wrap:'word'
}]);
const text = await GpuTypography.create(device, prepared);
text.updateText(0, 'A new retained paragraph.');
text.updateLayout(0, {width:240});
const encoder = device.createCommandEncoder();
text.encode(encoder); // no submit, fence, mapping or readback
// Encode a GPU consumer using text.output.buffer and its documented metadata.
device.queue.submit([encoder.finish()]);
// Explicit diagnostics/export only, not a normal frame loop:
const result = await text.snapshot(0);
text.dispose(); // does not destroy the caller's device
```

The API owns one heap and one small dispatch-uniform buffer, not a canvas, renderer,
queue scheduler or browser input system. It uses two compute stages (shape then
layout); `encode(encoder,{layout:false})` is a shape-only consumer path. No runtime
npm dependency is required. `npm run build:typography` builds the independent module
under `dist/typography-module` after the main build. ESM imports, adjacent WGSL files and TypeScript
declarations are included. Embedders may inject the exact assembled shader source
or provide `__HELION_SHADERS__` entries when external module-relative files are not
available. Preserve all required sources; do not mix ABI versions.

Run and glyph records are 256 and 80 bytes respectively; line/position records are
48 and 16 bytes. Glyph advances/offsets are normalized em values; paragraph
coordinates are pixels. Scalar indexes are Unicode codepoint offsets, **not UTF-16**.
Output metadata is a defensive copy; the authoritative live values stay in storage.
`snapshot(index)` copies only that run's bounded output reservations (including
unused capacity), not immutable font/Unicode data or the entire multi-run heap.

Text writes upload four bytes per scalar plus 12 bytes of revision/length metadata.
A layout update uploads 32 bytes. These explicit updates are not zero-transfer
operations. `encode` itself writes/uploads no text. Callers must order their own
writes, encodes, submission and destruction; overlapping external writers must
follow the ABI/revision and queue ordering contract.

A run accepts 1–65,536 input scalars and up to 196,608 glyph slots, with explicit
heap limits, operation budget and lookup/task depth. Defaults favor small retained
runs. One invocation owns an ordered run; independent runs execute across 32-lane
workgroups. This is **not parallel-within-one-run shaping**, a rope, or proven
million-character throughput. No automatic GPU allocation growth is supplied.

## Performance and memory

There are two optional UI entries, `shapeTextRuns` and `layoutTextRuns`, sharing
existing buffers and submission. Glyph results are cached by exact source and
options revision. Paragraph reflow is independently cached. No routine timing,
shape, font or glyph-cache readback is added. Existing explicit host-action outbox,
Run/save/clipboard snapshots and bulk-payload uploads keep their documented costs.
The paced scheduler, sharp coverage, native backing policy and timing arithmetic
are not rescaled or replaced.

Raw lookup tables, Unicode ranges, per-run glyph/scratch/line/caret data and larger
shader modules have real startup/storage costs. Ordinary UI source comparisons
still inspect resident strings. Long shaping operations, cold runs, many glyphs,
DataGrid scrolling and cache misses can add GPU work. Native-resolution raster
arenas remain unchanged. See `typography-preservation.json` for actual scene
allocations, not a speed claim. No sustained GPU benchmark or unchanged-FPS result
has been collected here.

## Applications and validation

Four applications are included: `/designer/`, `/playground/`, `/`, and `/typography/`.
The new lab is a GPU-authored control tree with feature/mark/bidi paragraphs,
editable TextBoxes, template content, DrawingContext text and a multilingual data
source. It fetches Noto Sans/Arabic/Hebrew at runtime or accepts local static faces.
The playground has a thirteenth editable typography example and navigation to the
lab. Studio Settings also opens the lab. Its ordinary application chrome remains
Helion-rendered, not DOM replacements.

Run `npm test`, `npm run check`, the strict TypeScript checks and `npm run build`
then `npm run check:build`. `/tests/typography.html?autorun` executes a native
fixture-based shape/cache/reflow/UI/text-edit/grid/pixel gate. `/tests/shaders.html`
checks actual partitioned UI programs; the standalone module has its own two-entry
program covered by the typography gate. Test readbacks and serialized steps are
not the interactive performance path.

`tools/check-typography.mjs` compares actual WGSL bodies translated into scalar
JavaScript with native HarfBuzz 10.2.0 and ICU 76. The sampled report contains 104
shape cases (26 strings × four feature settings), 1,200 bidi cases and 1,200 grapheme
cases. All sampled cases passed in this environment. Bidi comparison ignores levels
of formatting characters whose levels are not relevant to displayed output. This
is not the official Unicode conformance corpus, not a test of every language, and
not native WGSL execution. JS intermediates and WGSL f32 can differ. The initial
eight join-control/cluster mismatches were fixed; the report includes exact scope.

## Remaining work, explicitly not claimed

Full editor paragraph integration, all complex-script shapers, full Unicode line
breaking, re-shaping at forced joining boundaries, variable/CFF/color fonts,
platform hinting, vertical/justified paragraphs, robust hostile-font qualification,
accessibility/IME parity, device-loss recovery and native GPU/browser/performance
qualification remain. The runnable experimental packages are not labelled as a
complete state-of-the-art text engine merely because their host tests pass.

## Primary references and notices

Microsoft OpenType GSUB / GPOS / GDEF specifications:
https://learn.microsoft.com/en-us/typography/opentype/spec/gsub
https://learn.microsoft.com/en-us/typography/opentype/spec/gpos
https://learn.microsoft.com/en-us/typography/opentype/spec/gdef
Unicode UAX #9, #14 and #29: https://www.unicode.org/reports/
HarfBuzz reference behavior: https://github.com/harfbuzz/harfbuzz/tree/10.2.0
WGSL: https://www.w3.org/TR/WGSL/

These references define underlying concepts, not proof of Helion conformance.
Unicode license is included. The distribution contains **no font files, font data
URLs or extracted third-party glyph outlines**. Obtain fonts independently under
their own terms. HarfBuzz and ICU are development oracles, not runtime dependencies.
