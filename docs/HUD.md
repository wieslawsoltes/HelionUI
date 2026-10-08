# High-fidelity performance HUD — 0.4.1-experimental

> Historical release record. Current profiling, parallel DataGrid emission and frame diagnostics are defined in [FRAME-SYNC.md](FRAME-SYNC.md).

> Historical release detail. The rendering/font features below are retained, but 0.5.0 supersedes submission defaults, timing definitions, HUD dimensions and timestamp/history layouts. See [SUBMISSION-TIMING.md](SUBMISSION-TIMING.md) and [current validation](VALIDATION.md). Historical test counts and measurements are not new results.

## Scope

This replaces the independent 5×7 pixel-letter presentation HUD with real-font typography and antialiased diagnostic charts. The main UI/font compiler, normal UI text renderer, DataGrid, logical Measure/Arrange, composition, input protocol, startup worker/cache and rAF credit scheduler are not changed. It does not claim to fix or improve the underlying frame rate merely by redrawing the counter.

## Typography

The primary loaded face, already retained at `state[32]`, supplies the HUD glyph outlines, advance widths, baseline-relative bearings and the supported horizontal pair-positioning plans. The default showcase therefore uses its loaded Noto Sans Regular; it does not fetch an extra HUD font. There is no hidden Canvas 2D font atlas, DOM text mirror or system-font lookup. No font bytes or extracted third-party outlines are redistributed.

Labels use 12 CSS-pixel ems; primary counters use 26. The panel has a 420×274 logical design size and uniformly fits smaller viewports. Glyph dimensions are computed at the actual effective output DPR and panel scale. Diagnostic counters center each digit in the widest real digit-advance cell, so a proportional font can provide stable numeric alignment. Decimal points retain their real advance. Labels use the existing supported PairPos plans; all diagnostic strings use a bounded ASCII vocabulary.

Two compute entries implement the isolated HUD path:

1. `rasterHudFont`: once on first visible use or changed effective pixel scale, 190 independent workgroups build printable-ASCII masks at the two displayed sizes. It reads the existing on-device flattened font outlines and integrates signed pixel area. Stroke coverage remains available for explicitly diagnostic/test fonts. No host glyph rasterization or font readback occurs.
2. `buildHudText`: once per visible admitted frame, formats the current GPU-resident metrics, positions labels/digits, and builds bounded glyph and spatial-bin lists. This is not a CPU number-to-string/upload loop.

Coverage is eight-bit grayscale. Native-resolution masks are linearly reconstructed for fractional, unsnapped glyph positions and composited in linear-light RGB. This removes the old binary/pixel-alphabet appearance. It is not LCD/subpixel rendering, platform hinting or a promise of CoreText/ClearType pixel equality. Fractional mask reconstruction is not identical to fresh per-position outline integration; this HUD-specific choice does not change the main UI's exact-key glyph cache or text pixels.

The mask cache is separate from application glyphs and does not evict them. An unusually large glyph that exceeds a 64×64 mask cell uses direct analytical coverage rather than clipping, substituting a font, or reducing its size. Missing ASCII glyphs use the loaded face's established replacement glyph. Full OpenType shaping, fallback/script behavior and typography boundaries of the main experimental library are unchanged; the HUD itself is not a general text-control API.

## Charts

Three line-and-area charts retain the existing Frame, Layout and Render series. The newest admitted sample is at the right; unrecorded history is left blank. Initial/nonpositive Frame-interval samples are gaps rather than purported zero-cost frames. Real zero Layout/Render timings remain visible zero values.

Each chart uses the same 0–50 ms vertical range and 120-sample capacity. Antialiased segments connect the original sample vertices without temporal averaging, curve smoothing or invented intermediate measurements. A faint area fill aids reading. Low-resolution fragments inspect all neighboring segments intersecting their footprint, rather than averaging away isolated peaks.

Subtle grid lines, rounded cards, a latest-sample point and a dashed observed-rAF-budget line replace the solid jagged bars. Above-budget segments use an amber accent. Values above the chart ceiling retain their numerical values (up to the explicitly displayed 9999+ numeric bound) and receive a top-edge clipping marker. The current duration and common plot range remain visible.

## Measurement semantics are unchanged

- **Submit FPS:** existing smoothed admitted-application-frame cadence, not scanout or completed/presented FPS.
- **rAF Hz / rAF budget:** observed browser callback cadence and its interval; unknown cadence is N/A and has no invented budget line.
- **Frame / ms:** interval between admitted frames.
- **Layout / Render / Data:** existing compute-pass GPU durations when native timestamps were requested and provided. Otherwise the panel says **CPU encode timings**, and Data is N/A. CPU command-encoding time is not GPU execution time.

History collection, timestamp resolution and its eight-query set are unchanged. The HUD preparation and final presentation are outside the existing UI Render timing bracket, just as old final diagnostic presentation was excluded. **The HUD has a rendering cost; it is not measured by that Render value.** No new throughput, latency, display-rate or overhead benchmark is claimed.

## Residency, memory and lifecycle

Normal explicit uploads remain **64 bytes per admitted frame + 32 bytes per queued command**. The HUD adds no font/history polling, `mapAsync`, `inspect()` call or dynamic text upload. There are no new per-frame uniform fields or timestamp-query reads on the CPU. The final fragment shader reads GPU history, bins and glyph coverage directly.

Additional fixed storage is **784,384 bytes** for two-size glyph metadata/coverage and **49,496 bytes** for up to 512 glyph instances and 486 spatial bins, totaling **833,880 bytes (~0.80 MiB)**. No new render target or raster texture is allocated. Each bin reserves 16 glyph references. A full bin falls back to the complete bounded glyph list rather than dropping text; a full global instance arena reports an amber top-edge diagnostic. The normal built-in labels fit within both bounds.

Warm visible frames add one bounded text-format/bin dispatch. First display or a changed effective DPR/scale adds one font-raster dispatch. Moving the panel or resizing without changing that scale reuses the existing masks. Hidden HUDs do not format or rasterize; showing again reuses valid coverage. A resize while hidden defers any required rebuild until the next show.

No layout-node/font-heap ABI change is introduced. Existing ABI-3 compiled scenes and the 0.4 initial-scene startup cache remain valid. The declaration compiler, font preparation worker, cached-scene revision and all core shaders are unchanged. The extra diagnostic pipeline preparation, first-use mask rasterization and warmer text/graph compositing have not been profiled on hardware.

## Validation

`npm test` passes 279 host tests; `npm run check`, the strict TypeScript API check, build and exact module/13-shader/worker-embedding checks pass. New tests cover shader source-range assembly, glyph metadata/metrics, bounds, numeric carries, invalid/overflow values, ring ordering, sparse-history placement, spike retention, memory layout, zero extra frame uploads, warm cache reuse and hidden/DPR lifecycle behavior. Fake-device scheduling tests do not compile or execute WGSL.

A private CPU layout reference using a real font was visually inspected for spacing. It is not a screenshot of this GPU shader and is not presented as native pixel verification. Private real-font packing/metadata checks and unchanged-core hashes are recorded in [hud-validation.json](hud-validation.json); no font assets are included.

Native browser navigation to the gate failed before page load with `ERR_BLOCKED_BY_ADMINISTRATOR`. The optional Dawn validator could not be installed because npm registry name resolution failed. **Native shader/pipeline creation, execution, final GPU pixels and frame-rate/overhead effects remain unverified in this environment.** See [VALIDATION.md](VALIDATION.md).

## Reproduce native validation

```sh
npm start
# Open http://127.0.0.1:8080/tests/hud.html
```

**Run native checks** uses an original triangle/rectangle fixture font to compare the actual GPU mask against an independent clipped-polygon/pixel-area oracle, checks antialias coverage, font-mask reuse, GPU-generated text/bin output, presentation tone levels, hide/show, DPR invalidation and the unchanged normal upload protocol. These tests perform explicit diagnostic readbacks.

**Preview real fonts** uses the already-supported external font source or a selected local font. It injects visibly disclosed synthetic history to inspect typography, reference lines and a >50 ms spike; those displayed numbers are not a benchmark. The normal showcase has no synthetic-HUD history injection and always uses its live measurements.

Optional native WGSL/pipeline validation without hardware execution:

```sh
npm install --no-save --package-lock=false webgpu@0.6.1
npm run check:native
```

The checker includes both new HUD compute entries and the assembled presentation module. Its null backend is compiler/interface validation only, not GPU execution. Existing UI/text gates and the continuous-rAF benchmark remain available. Primary API references: W3C WebGPU, https://www.w3.org/TR/webgpu/ ; WGSL, https://www.w3.org/TR/WGSL/ . These references explain the APIs, not Helion's hardware performance or conformance.
