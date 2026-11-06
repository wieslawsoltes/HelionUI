# Validation — 0.15.0-experimental

The current implementation and limits are in [TYPOGRAPHY.md](TYPOGRAPHY.md).
The latest browser record is [frame-pacing-results.json](frame-pacing-results.json),
with context in the [frame-pacing and startup follow-up](frame-pacing-optimization.md). Correctness
passes; the 200 ms startup budget fails. The initial repair is recorded in the
[pipeline audit](browser-pipeline-repair.md).
The earlier typography record is [typography-validation.json](typography-validation.json).
Historical release reports, including [VALIDATION-0.14.md](VALIDATION-0.14.md),
retain their original scope; they are not current GPU qualification.

## Checks actually performed

**1,029 host tests pass**, with zero failures or skips. Static/source checks,
strict TypeScript API checks, builds and standalone source-embedding checks pass.
Host tests include initial data packing, CPU-executed WGSL bodies, paragraph
line/caret/layout math, native-buffer metadata, retained cache invalidation,
TextBox input, DataGrid visible-row reservations, template/designer run ownership,
and mocked command encoding. A mock device or translated scalar body does not
compile or execute native WGSL.

[The differential sample](typography-differential.json) passes 104 shaping cases
against HarfBuzz 10.2.0, 1,200 bidi cases and 1,200 grapheme cases against ICU 76.
It uses one DejaVu Sans face, a limited corpus and actual shader bodies translated
into JavaScript. It is not a complete Unicode/OpenType conformance result, rendered
pixel comparison, GPU f32 result or speed benchmark.

[Actual Chromium worker checks](typography-browser.json) pass two classic Blob
startup-worker scenarios, with complete initial buffers and template/shaping
manifests matching host preparation. These are browser/CPU serialization checks,
not WebGPU execution. Chromium was launched headless with the container's
`--no-sandbox` argument; neither application origin/CSP restrictions nor managed
navigation policies were bypassed.

[Preservation and allocation checks](typography-preservation.json) verify protected
font-coverage, timer, scheduler and metrics source bytes and an unchanged parsed
real-font geometry/metrics digest. Initial heaps are deliberately different because
the new typography engine retains lookup/run/paragraph data. Larger allocations
are reported rather than described as free or unchanged-performance.

## Native verification

The earlier environment blocked native pages before navigation. The current
repair was tested in Chrome 156.0.8078.80 on the Apple metal-3 adapter with the
browser sandbox enabled. All four source applications and four standalone HTML
applications booted and continued completing frames with zero idle readback.
The native GPU, editor, designer, typography, template, framework, dynamic
workspace, quality, shader-compilation, metrics and frame-sync gates passed.
The compilation gate enables all 511 feature bits, including typography.

The native pages are included. The typography gate provides actual shape/cache,
paragraph, TextBox/template/data-source and cached/direct pixel assertions, with
explicit diagnostic readbacks. Its serialized correctness steps are not a
continuous-frame performance benchmark. Run the gate on the target browser/device.
These results do not qualify every browser/driver, complete Unicode behavior or
universal frame rates. Startup measurements include uncontrolled driver caches.

## Reproduce

```sh
npm test
npm run check
tsc --strict --noEmit --target es2022 --module nodenext --moduleResolution nodenext \
  --lib es2023,dom tests/api-types.ts tests/designer-api.ts \
  tests/templates-api.ts tests/typography-api.ts
npm run build
npm run check:build
npm start
```

The full source, static site, four standalone applications, and standalone reusable
module are distributed separately. The external package manifest records fresh
source extraction/retest/rebuild checks and exact hashes of the delivered HTML.
No font binary or extracted third-party outline data is distributed.
