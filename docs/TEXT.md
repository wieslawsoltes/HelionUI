# Real fonts and retained glyph coverage — 0.3.0-experimental

> Historical release detail. The rendering/font features below are retained, but 0.5.0 supersedes submission defaults, timing definitions, HUD dimensions and timestamp/history layouts. See [SUBMISSION-TIMING.md](SUBMISSION-TIMING.md) and [current validation](VALIDATION.md). Historical test counts and measurements are not new results.

> Historical 0.2/0.3 design record. Release 0.4 changes startup preparation, the default unfinished-frame limit to 2, completion-independent rAF scheduling and the HUD reference to observed cadence. Those current contracts and the scoped CPU benchmark are in [STARTUP-VSYNC.md](STARTUP-VSYNC.md). Typography, query and raster algorithms described below are retained.

## Status and supported contract

The mounted UI uses real static TrueType-outline font faces, with font-derived geometry, advances, baseline, ascent/descent and line spacing. This release adds a bounded GPU text-layout/shaping subset and exact GPU coverage reuse. It **does not implement a complete Unicode/OpenType text stack**, and native GPU correctness/performance have not been verified in the authoring environment. Read [VALIDATION.md](VALIDATION.md) before interpreting the word "implemented" as hardware qualification.

The normal showcase loads Noto Sans Regular (400), SemiBold (600) and Italic (400), pinned to the `notofonts/noto-fonts` `v20201206-phase3` tag. These are **runtime browser requests**. No downloaded/system font file, repackaged third-party outline data or font data URL is included in this source/site/HTML distribution. The Fonts panel accepts 1–8 local static faces as an alternative. They are read in-page and are not posted to an application server. Applying them remounts the scene and discards its current device-owned edits.

Library default `mount(canvas, declaration)` fetches only the Regular face. Explicitly supply all needed weights/styles. Selection uses the closest actual loaded face; it does not synthesize weight or italic. A nonexistent requested family falls back to the remaining loaded families, then the primary face's replacement/.notdef glyph. This is an application asset chain, not system-font enumeration.

## Loading and authoring

```js
import { h, compile, loadFont, loadFonts, HelionSurface,
  DEFAULT_FONT_SOURCES } from './src/index.js';

const fonts = await loadFonts(DEFAULT_FONT_SOURCES);
// Or: const fonts = await loadFonts([{source: fileInput.files[0]}]);
// Or: const regular = await loadFont('/assets/MyStaticFont.ttf', {family:'App Sans'});

const view = h('StackPanel', {
  fontFamily: 'Noto Sans', fontSize: 16, gap: 12,
  kerning: true, ligatures: true, lineHeight: 24
},
  h('TextBlock', {text:'AVATAR · office · Zażółć gęślą jaźń', wrap:true}),
  h('TextBlock', {text:'Actual italic face', fontStyle:'italic'}),
  h('TextBlock', {text:'Underline and strike', textDecoration:'underline line-through'}),
  h('TextBox', {id:'editor', text:'A\u030A and Å'})
);
const prepared = compile(view, {fonts});
const surface = await HelionSurface.mount(canvas, prepared, {
  glyphCache:true, performanceHUD:true, maxFramesInFlight:1
});
```

The synchronous `compile(view)` with no font uses the explicitly diagnostic original vector alphabet for portable tests/backward authoring compatibility. Use prepared `fonts` for proper-font compilation. `mount` automatically loads a real default font only for uncompiled declarations without font options. No failed font load silently falls back to the diagnostic alphabet.

`loadFont(source, options)` accepts a URL/string, Blob/File, ArrayBuffer or typed-array view. Options include family/weight/style metadata overrides, `collectionIndex`, maximum bytes/points, timeout and AbortSignal. Metadata overrides do not transform outlines. Fetches omit credentials and check status/byte limits. Prepared font objects can be reused across mounts by the caller; the mounted surface retains only their manifest, not a CPU mirror of live text.

Inherited declarations: `fontFamily`, `fontWeight`, `fontStyle`, `fontSize`, `kerning`, `ligatures`, `letterSpacing`, `lineHeight`, `textAlignment`, `textDecoration`. CSS-unit values apply to size/spacing/line height. `lineHeight:0` means font-derived default. Decoration values are `none`, `underline`, `line-through`, or `underline line-through`. TextAlignment is left/center/right for TextBlock; Button centering and single-line TextBox placement remain their own control semantics. DataGrid body/header text derives from its fontSize; compact status/footer numbers retain their own smaller sizes.

No mutable font/style opcode is added. A new font collection or structural/style change requires recompilation/remounting. The application can still animate retained composition transforms without changing the font declarations.

## Font parsing: initial host asset preparation

| Area | Implemented subset |
| --- | --- |
| Containers | Static TrueType-outline SFNT (`.ttf` or TrueType `.otf`), TTC face selection, WOFF1 with stored or deflated tables |
| Character map | Formats 0, 4, 6, 12 and 13, Unicode scalars including supplementary planes |
| Metrics | head/hhea/hmtx; OS/2 typographic metrics when requested by the face; post underline and OS/2 strike metrics; family/weight/style names |
| Outlines | glyf/loca, short/long offsets, simple and nested composite glyphs, repeated flags, signed deltas, implied quadratic points, component transforms and point anchors |
| Kerning plans | GPOS PairPos explicit/class tables for horizontal xAdvance, extension lookup; legacy kern format 0 fallback |
| Substitution plans | Direct standard GSUB ligature records, 2–8 components, extension lookup |
| Marks | GPOS mark-to-base and mark-to-mark anchors for the supported plans |

WOFF1 deflate uses `DecompressionStream`; absence reports an error. WOFF2, CFF/CFF2 outlines and fonts with variable `fvar` data are **explicitly rejected**, not approximated as a static face. Static instances of variable fonts must be produced externally. Not every OpenType font is accepted simply because it has `.otf` in its name.

Parsing validates table extents, duplicate directory entries, glyph references, point runs, composite cycles/depth, incompatible flags, scalar ranges and bounded allocations. The default input cap is 32 MiB per font, 128 tables, 32,768 points per outline, two million aggregate decoded points, nesting depth 24 and 512 components. Heap compilation independently enforces its bounds (default 64 MiB). Each retained glyph path has a 1,024-source-segment bound. Rejection is explicit. This is not a security-certified general font sanitizer; malformed/adversarial font qualification remains necessary.

GSUB/GPOS data outside the implemented subset produce manifest warnings when encountered. Supported plans use default language systems for DFLT/Latin/Greek/Cyrillic. They are not a general lookup interpreter with full contextual/chained substitution, lookup-flag semantics, script itemization, language selection, feature variations or positioning rules. Some font tables contain partially supported lookups: the warnings matter.

## Runtime text algorithms on the GPU

A sparse 4,352-page Unicode directory maps scalars to glyph IDs; present pages contain 256 entries. Glyph records point to retained curves and metrics. Per-node style records name a selected face/fallback chain, feature flags, spacing, alignment and decorations. There is no 255-codepoint clamp.

The shared GPU `TextGlyph` path performs loaded-repertoire canonical pair composition, direct ligature substitution and supported pair adjustments. Consecutive combining marks use retained mark-to-base/mark-to-mark anchors when available. The startup compiler constructs the finite composition/combining tables once; it does not normalize or shape each frame on the CPU. Canonical pair composition is **not complete Unicode normalization/reordering**, and missing mark anchors do not become invented typographic knowledge.

Measure, draw, text hit testing, selection widths and caret positions use the same advances and kerning context. Carets inside a ligature use proportional source advances rather than a font GDEF ligature-caret table. Arrow navigation and deletion preserve base-plus-combining sequences, but this is **not full UAX #29 grapheme segmentation**. ZWJ emoji sequences, regional-indicator pairs, many Indic clusters, and visual-order bidi navigation require more work. Unsupported scalars use replacement/.notdef geometry.

Wrapping recognizes spaces, tabs, hyphens, zero-width spaces and hard line breaks (including CRLF); oversized words break at the bounded glyph/cluster boundaries. Trailing line breaks contribute height. This is not full Unicode line breaking or dictionary hyphenation. Tabs advance to four-space stops. TextBlock left/center/right alignment and decorations share font metrics. Line metrics are primary-face metrics, not a maximum of every fallback used in a line. Cross-face mark attachment is not performed.

TextBox has content-independent intrinsic geometry. Editing reshapes its rendered text but **does not re-run Measure/Arrange**, reupload font assets, or sort the DataGrid merely because its linked filter changed. Horizontal auto-scroll, click-to-caret, selection, Home/End, Shift selection and combining-aware Backspace/Delete use device-owned strings. Browser IME forwarding still sends committed text only; preedit, complex candidate positioning, clipboard copy/cut and accessibility remain separate limitations.

Table filtering and sorting remain ASCII-case-insensitive direct scalar comparisons, not Unicode collation/normalization. Proper glyph display does not imply locale-correct queries. This release intentionally does not replace the retained query optimizations with a host text/database service.

## Exact glyph coverage caching

This is a **grayscale coverage cache**, not SDF/MSDF, bitmap font substitution, CPU raster atlas, subpixel LCD text or an upstream Vello cache port.

1. Retained real glyph curves are flattened on the GPU during initialization, with a finer font-specific normalized tolerance and a bounded 32-step per-curve ceiling.
2. The UI emits real-font glyph primitives referencing those outlines and an exact composed transform.
3. Existing GPU display-list comparison determines dirty 16×16 output tiles. Only glyphs intersecting damaged tiles need cache planning.
4. A bounded planner keys coverage by outline resource, the four exact f32 transform components and the two exact fractional-origin components. Integer translation, color and clipping are excluded because they do not change intrinsic pixel coverage.
5. Miss jobs rasterize to disjoint cache slots in a separate compute dispatch. Matching uses all key words, not hash equality alone. A limited-probe replacement policy avoids evicting any slot referenced in the current frame. There are no cross-workgroup spinlocks or speculative use before rasterization.
6. Sparse-strip generation reads cached 8-bit coverage, then follows the same painter sorting, clipping and compositing pipeline. Large glyphs, full probe windows or bounded-cache pressure use direct analytical coverage. They are not omitted or rendered at a coarser size.

Default allocation: **2,048 slots**, 64×64 one-byte coverage per slot, 64-byte metadata and eight-byte job reservation per slot, plus a 64-byte header: **8,536,128 bytes** total (about 8.14 MiB). `limits.glyphCacheSlots` accepts powers of two up to 8,192. Font heap/curve memory is additional. Allocation is fixed at mount; even cache-disabled A/B mode reserves the same arena for like-for-like setup.

The exact-key design preserves fractional positions instead of snapping them to a small grid. It can therefore miss more often during fractional scrolling or arbitrary scale/rotation. The 64×64 maximum covers many UI-size glyphs, not all large/transformed text. New fonts also have more geometry than the diagnostic alphabet. The planner adds bounded serial GPU work and the graph adds two cache-related dispatches. **No measured "same FPS" or guaranteed speedup is claimed.** Cold first-frame costs must be separated from warm scrolling/typing costs.

`glyphCache:false` selects the direct analytical reference path with the same font, coordinates, antialiasing and viewport. It does not revert to the old alphabet. The native typography gate compares exact output bytes across cached/direct modes for baseline, integer/fractional translation, rotation and scale. That gate is provided but not recorded as passing here.

Rendering remains unhinted analytical grayscale coverage in the existing linear-light compositing path. It will not match ClearType/CoreText/FreeType hinting/subpixel pixels. Bounded curve flattening and the existing simplified handling of overlapping/self-intersecting outlines remain quality limits, particularly at extreme zoom. Cached/direct equality, even when verified, would prove equality of these two paths—not production font-rasterizer fidelity.

## Residency, protocol and diagnostics

No normal-frame font download, CPU glyph rasterization, Canvas text, DOM text shaping, glyph-cache readback or font upload occurs. Cache misses are detected/resolved on device. Startup parsing and asset upload are CPU work, not falsely labeled GPU work. User code may retain original font data, but it is not a mutable control-state mirror.

The command ABI remains 32 bytes; each admitted frame uploads **64 + 32×N bytes**. The glyph cache needs no miss notification round-trip. Existing layout/query invalidation, one-frame default admission, dirty tiles, virtualized 65,536 rows and FPS graphs remain. Font downloads/initial upload/driver-internal transfers are not part of that frame payload count.

Global state counters 51/52/53 report last-frame cache hits/misses/analytic bypasses. They are available through the existing **explicit** diagnostic button or `inspect()`, not polled by normal rendering. Existing GPU Layout/Render/Data timings include their respective new text work. The compact diagnostic HUD retains its tiny independent presentation-shader alphabet.

Internal **ABI 3** puts a style pointer in node word 71, retains font directories/plans in the heap, adds global composition/combining table references and a glyph-cache storage binding. Old compiled objects must be recompiled. The command wire record is unchanged. See [PROTOCOL.md](PROTOCOL.md).

## Tests and measurement

`npm test` includes parser/malformed-input/font-plan tests, independent host width/layout references, a synthetic original TTF builder, declaration/HTML/type checks and explicitly non-executing GPU-host scheduling tests. The original TTF fixture is generated from simple authored triangles/rectangles in the test; no external font binary is shipped.

`/tests/text.html` is a native GPU gate using that deterministic fixture. It tests layout, glyph emission, mark positions, warm-cache hits, analytic bypass, exact cached/direct pixels and combining-aware input. `/tests/gpu.html` retains the prior UI/query/damage checks. `/tests/performance.html` measures either glyph-cache or dirty-tile A/B on real fonts, supports local faces and reversed arm order, and records startup/cold frame separately from idle, integer/fractional scroll, filtering and sorting. It rejects observed overflow. Benchmark-only readbacks happen after measured phases.

No benchmark output or native screenshot was collected here. Passing host tests and outline aggregate comparisons is not evidence of GPU shader validity, typographic visual quality or sustained native performance. [Observed record](VALIDATION.md).

## Primary specifications and background

The implementation consults these specifications but does not claim complete conformance:

- Microsoft OpenType: [glyf](https://learn.microsoft.com/en-us/typography/opentype/spec/glyf), [hmtx](https://learn.microsoft.com/en-us/typography/opentype/spec/hmtx), [cmap](https://learn.microsoft.com/en-us/typography/opentype/spec/cmap), [GPOS](https://learn.microsoft.com/en-us/typography/opentype/spec/gpos), [GSUB](https://learn.microsoft.com/en-us/typography/opentype/spec/gsub).
- HarfBuzz: [shaping concepts](https://harfbuzz.github.io/shaping-concepts.html), useful for distinguishing glyph lookup from a complete shaping engine. HarfBuzz is not linked or ported here.
- [Noto font source release](https://github.com/notofonts/noto-fonts/tree/v20201206-phase3) and its accompanying notices/license govern fonts fetched by the application. The application distribution contains source URLs, not font assets.
