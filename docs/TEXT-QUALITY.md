# Helion 0.11 — sharp, compute-rendered text

## Status

This release changes the actual text and presentation paths of the 0.10 source package. It does not apply a screenshot sharpen filter, replace the fonts, lower a dataset size, or move text rasterization into Canvas 2D/DOM. Source packages and both standalone applications are built from the same source tree.

Host tests, numerical experiments, static/type checks and package reproduction are reported separately from native verification. **Native shader compilation/execution, final GPU pixels, device performance and visual improvement on a particular display remain unverified in this environment.** The current native page is served successfully, but Chromium rejects navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. The optional Dawn package is unavailable. See `sharp-validation.json` and `sharp-native.json`.

## What changed

### 1. Native backing pixels, not a stretched 2048-pixel canvas

The old runtime clamped the canvas to DPR 2 and 2048 physical pixels per axis. That could force a lower-resolution image to be enlarged on wide or high-DPI displays. The new default `resolutionMode:'native'` uses the actual device-pixel content box from ResizeObserver when available; otherwise it rounds CSS dimensions times DPR. It detects a changed display DPR even when the CSS canvas size is unchanged.

The allocation remains bounded. Default limits are **8192 pixels per axis and 65,536 16×16 output tiles**, at most 16,777,216 output pixels. The rectangular tile budget supports a 5120×2880 target without reserving an 8192×8192 tile grid. Device texture limits and explicit caller limits still apply. If a target exceeds capacity, the allocator reports the downscale through `surface.resolution`; it does not claim native pixels after silently lowering resolution.

`resolutionMode:'balanced'` retains the legacy 2048-axis/DPR-2 cap policy. It is a same-version comparison/explicit cost choice, not a bit-for-bit old-browser output guarantee. A smaller tile budget can be set at mount to reduce reserved memory. Changing resolution mode does not remount documents or discard edits. External CSS transforms on the canvas, OS scaling and browser zoom/presentation can still affect the final image; this is not control over physical scanout.

### 2. Device-space quadratic coverage

Main UI text, TextBox, DataGrid text, editors, docking labels and DrawingContext glyphs use their retained real font outlines. The previous glyph cache miss path integrated a pre-flattened polyline whose segment count was chosen in normalized font space. Its fixed approximation error grew with display size/scale.

Sharp mode evaluates the original source segments at the final glyph transform and fractional pixel phase. For a quadratic Bézier, it finds roots at the four pixel boundaries, sorts the resulting intervals and integrates the clamped signed-area contribution on each interval. Two-point Gaussian quadrature is mathematically exact for the resulting cubic polynomial; **WGSL uses f32, not exact real arithmetic**. Line integration also works in a local pixel coordinate system to reduce cancellation. No uniform full-frame supersampling or distance-field font is introduced.

Supported static TrueType fonts use lines and quadratic curves. Authored cubic fixtures use a device-space subdivision bound targeting 1/64 pixel chord error, with an explicit 256-step ceiling. That ceiling does not promise the same error for arbitrarily large transforms. General vector/drawing paths retain their existing flattening implementation; this is a glyph-quality update, not a replacement of every vector algorithm.

The existing signed-area fill model and grayscale compositing remain. Complex overlapping or self-intersecting outlines are not thereby upgraded to a complete winding-aware production rasterizer.

### 3. Fractional clipping without a hard center test

Sharp glyphs intersect each physical pixel with the inherited rectangular text viewport. Interior pixels retain the fast cached coverage lookup. A fractional clip-edge pixel integrates only the covered subrectangle, preserving partial area rather than dropping/keeping the whole pixel based on its center.

This improves the bounded text clipping path while leaving the DrawingContext's more general transformed clip-chain approximation unchanged. It is not full isolated clip-mask or arbitrary geometry-clip support.

### 4. Exact cache phase and quality-mode isolation

The main glyph cache still keys the source outline, all four exact f32 transform components and both exact fractional-origin components. It does not quantize positions, bucket font sizes, change letter advances or snap the main editor text. Its coverage masks remain eight-bit grayscale with one integer texel lookup on reuse.

One previously reserved metadata word identifies sharp/reference mode. A live mode change cannot reuse a mask created by the other algorithm. Changing quality forces retained pixel damage and rebuilds the diagnostic mask bank, but does not rebuild font assets, change document state or require a glyph-miss readback.

Large glyphs or cache-pressure misses use direct compute coverage at the same requested geometry. They are not blurred, omitted or silently rasterized at a lower size. Cold/miss work can cost more; warm hits avoid curve integration.

### 5. HUD text and charts now composite in compute

Previously the diagnostic fragment shader composed text/charts and could integrate oversized glyph outlines. This release moves that entire path into `compositeHud`, an 8×8 compute kernel writing a small panel texture. The cached main UI texture stays untouched, avoiding trails in retained damage mode. Final canvas shaders only load completed UI/panel texels.

Sharp HUD masks are generated from the same loaded primary font using the new source-curve integration. Diagnostic mask origins are aligned to integer physical pixels, then sampled once. This removes the extra bilinear mask reconstruction. The diagnostic text's advances and kerning are not rounded; only each displayed mask origin is rounded, at most half a physical pixel. **Main UI/editor glyph positions remain fractional and unsnapped.** The explicit reference mode retains the older filtered diagnostic placement for comparison.

The panel, graphs, values, linear-light blending and history remain GPU-resident. There is no CPU text formatting/upload loop or new font download. A GPU-positioned six-vertex panel quad copies the computed image; `hudScissor:false` selects a fullscreen copy reference using the same computed texels. There is no text rasterization in either copy shader, including oversized-glyph fallback.

### 6. Pixel-exact Fit preview

An untransformed, unit-scale Fit SurfacePresenter rounds its physical rectangle endpoints and uses a single integer texel load when the child active extent matches those pixels. Input routing uses the same rounded rectangle. This avoids reconstructing already-rasterized child text through a second filter. Fixed design-size previews and scaled/rotated/sheared content retain bilinear reconstruction rather than being snapped or falsely called one-to-one.

## API and playground controls

```js
const surface = await HelionSurface.mount(canvas, view, {
  textQuality: 'sharp',       // default: source curves in device space
  resolutionMode: 'native', // default: real backing pixels within capacity
  limits: {
    maxDimension: 8192,
    maxRenderTiles: 65536
  }
});

// Live same-version comparisons; no remount/document reset.
surface.setTextQuality('reference');
surface.setTextQuality('sharp');
surface.setResolutionMode('balanced');
surface.setResolutionMode('native');

// Host viewport metadata only; no GPU readback.
console.log(surface.resolution);
// w/h, requestedW/requestedH, dpr, nativeResolution,
// devicePixelBox, limitedBy, tileCols/tileRows and maxTiles.
```

Playground **Settings → Text / Display** exposes Sharp curves / Reference and Native pixels / Balanced 2048 as Helion controls. The settings body scrolls. The owning workspace propagates quality/resolution policy to its existing or subsequently attached preview.

A smaller explicit allocation, retaining the previous cap policy, is:

```js
const surface = await HelionSurface.mount(canvas, view, {
  textQuality: 'sharp',
  resolutionMode: 'balanced',
  limits: {maxDimension: 2048, maxRenderTiles: 16384}
});
```

This keeps the improved curve/HUD path but intentionally sacrifices native output pixels on larger targets. It is not the new default.

## Performance and memory costs

No unchanged-FPS, zero-cost, startup-speedup or native rasterizer superiority claim is made.

- Main UI curves share the existing cache-miss/direct rendering graph; no extra main text dispatch is added. Quadratic source integration does different arithmetic than polyline integration. Cache keys stay exact, so fractional movement can still cause misses.
- The larger default tile reservation increases the scratch arena from **30,282,048 to 81,006,912 bytes**, an increase of **48.375 MiB per retained surface**. Root and embedded child have separate arenas. Choosing Balanced live changes active resolution but does not shrink these mount-time reservations; explicit smaller limits do.
- Native high-DPI output performs more pixel work and uses a larger output texture. 5120×2880 RGBA8 alone is 56.25 MiB. This is the cost of not stretching a smaller image.
- The HUD adds one bounded compute compositor dispatch when visible, one optional compute pipeline and one additional reference-copy render pipeline. It does not add a render pass. Hidden HUDs omit its format/raster/composite work. The separate panel texture is about 0.65 MiB at DPR 1 or 2.55 MiB at DPR 2 on a large enough surface; exact allocation is recorded in `sharp-memory.json`. HUD font and main glyph-cache storage sizes are unchanged.
- Compact timings include the HUD compositor in their combined compute span. Detailed timings include it in the existing HUD bracket. The final canvas bracket now measures copying, not the previous text/chart fragment work. Timing units/arithmetic and the paced-vsync scheduler are unchanged.

Ordinary explicit uploads remain **64 bytes per owning frame, another 64-byte child template when attached, and 32 bytes per command**, plus explicit bulk data. The quality bit reuses frame flag bit 14; no extra normal uniform upload or timing/control/font readback is introduced. Host-service actions still use the existing event-driven outbox; Run/export/clipboard remain explicit readback boundaries.

Compiled node/state/heap **ABI 3 is unchanged**. Old precompiled views keep their own old allocation limits; recompile declarations to receive the new defaults. The initial-scene cache revision is advanced so a warm old record cannot silently restore the obsolete 2048 default. The first start after this revision is a cold scene preparation; future valid cache hits remain available. Geometry/font data are not expanded or subsetted by the quality change.

## Validation and reproduction

```sh
npm test
npm run check
tsc --strict --noEmit --target es2022 --module nodenext \
  --moduleResolution nodenext --lib es2023,dom tests/api-types.ts
node tools/check-text-quality.mjs --output=quality-math.json
npm run build
npm run check:build
npm start
```

`/tests/quality.html` provides the current native gate and real-font specimen. The gate compares quadratic WGSL output with a high-precision oracle; checks cached/direct pixels at DPR 1, 1.25 and 2; tests live quality cache isolation; checks clipping, editor/DataGrid text and the compute-HUD quad/fullscreen copy. Its original geometric font is deliberately a fixture, not a UI typeface. Real-font preview uses the existing configured font URL or a selected local font. The page is provided, **not recorded as passing here**.

Host tests cover analytic/degenerate/tangent/reversed quadratics, independent clipped-polygon comparisons, cubic bounds, clipping subrectangles, native and fractional-DPR allocation, 1000 randomized tile budgets, shader resource/call graphs, frame payloads, live quality switches, mask lifecycle and resolution changes. Non-executing WebGPU fakes are not native GPU tests.

A separate reproducible numerical experiment samples **1280 original synthetic quadratic contours** at eight device scales from 9 to 512. The maximum sharp double-precision mirror error against independent 4096-segment polygon clipping is **0.000006683 pixel-area units**. This verifies the mathematics within that finite oracle's accuracy; it does not measure GPU f32 results or font screenshots. `sharp-numerical.json` reports both old flattening and new integration errors, not an FPS multiplier.

The three-face Noto Sans comparison preserves the entire original showcase's initial node/state/heap buffers byte-for-byte: **202 nodes, 65,536 rows, eight animations, 9,961 font glyphs**. Font parsing, shaping/advances, logical layout, data sorting and timing/scheduling components listed in `sharp-preservation.json` are unchanged. Changed coverage/presentation shaders are deliberately not called pixel-identical to the old release.

## Remaining typography and platform boundaries

This remains **unhinted grayscale** rendering, not TrueType bytecode hinting, ClearType/LCD subpixel rendering, CoreText/FreeType pixel parity, automatic stem darkening or a complete Unicode/OpenType text engine. Full bidi, Arabic/Indic shaping, complete grapheme/IME/accessibility support, variable/CFF/color fonts and the other existing limits remain. Native pixels and better curve integration do not implement those missing systems.

No downloaded/system font file, repackaged third-party outlines or font data URL is included. All application text coverage is computed from fonts obtained by the user's browser at runtime or selected locally. Initial font parsing and scene compilation remain host asset preparation; they are not falsely labelled GPU computation.

## Primary references

- WebGPU Fundamentals (Gregg Tavares), canvas CSS/backing pixels and device-pixel ResizeObserver: https://webgpufundamentals.org/webgpu/lessons/webgpu-resizing-the-canvas.html
- W3C WebGPU specification, textures, compute passes and device limits: https://www.w3.org/TR/webgpu/
- FreeType project, text rendering, gamma and hinting distinctions: https://freetype.org/freetype2/docs/hinting/text-rendering-general.html

These references explain platform/text concepts. The source, scoped tests and explicit native limitation determine the claims for this release.
