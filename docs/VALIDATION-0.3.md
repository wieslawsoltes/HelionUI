# Validation — 0.3.0-experimental

## Observed results

**220 host tests pass, zero failures, zero skipped.** The suite preserves the previous 150 tests and adds 68 font/typography/parser regressions plus two non-executing runtime graph tests. The fake WebGPU device does not parse or run shaders. CPU reference tests and source checks are not native GPU results.

Host coverage includes static TrueType metrics/outlines/composites, Unicode maps, TTC, WOFF1, GPOS pair/class/extension kerning, GSUB ligatures, mark attachment, canonical composition, fallback and style inheritance, wrapping, caret/combining rules, malformed table bounds and explicit unsupported-format rejection. Runtime host tests check cache dispatch ordering and reference-mode omission while preserving 64-byte frame uploads and zero implicit mapping. The small font fixture is generated from original test geometry, not downloaded font bytes.

Static checks pass for **38 JavaScript modules**, **11 WGSL sources** and **30 core compute entry points**, with 202 showcase nodes. The separate timing-history kernel makes 31 compute pipelines at mount, plus presentation. The TypeScript API check, static build and exact standalone shader/module embedding checks also pass. Static WGSL checks are lexical/resource-graph checks—not a native WGSL parser or validator.

```sh
npm test
npm run check
npx --no-install tsc --noEmit --strict --lib es2023,dom \
  --module nodenext --moduleResolution nodenext tests/api-types.ts
npm run build
npm run check:build
```

[Machine-readable record](validation-results.json) · [current logs](text-logs/host-tests.log)

## Independent real-font checks

Two real fonts were used privately for comparison against FontTools. Only aggregate results are included; neither font files nor their outline data are distributed.

| Private input face | Glyphs | Mapped scalars | Tested glyph area/advance mismatches | Bidirectional cmap mismatches | Maximum signed-area delta |
| --- | ---: | ---: | ---: | ---: | ---: |
| Go Regular | 666 | 663 | 0 | 0 | 0 em² |
| DejaVu Sans | 6,253 | 5,918 | 0 | 0 | 1.6653345369377348e-16 em² |

Across **6,919 glyphs**, horizontal advances matched exactly. An independent polynomial signed-area integration compared the parsed curves with FontTools-decomposed outlines. The tolerance for reporting area/advance mismatches was 1e-8 in normalized units. Character maps were compared in both directions.

**Scope:** an area aggregate can agree for different shapes. This check does not prove identical contour coordinates, raster pixels, glyph hinting, kerning/shaping equivalence or GPU behavior. It also does not qualify every font, and the default externally fetched Noto faces were not executed on a GPU here.

[Aggregate comparison report](font-comparison.json). Reproduce with separately installed FontTools, Node and font files you supply:

```sh
python tools/compare-fonts.py /path/to/StaticFace.ttf --output font-report.json
```

This tool writes aggregate diagnostics only, not copied fonts or extracted outline files. Synthetic fixtures separately exercise composite transforms, point anchors and layout table variants.

## Native GPU results: not verified

The current browser attempt at `/tests/text.html?autorun` failed **before page loading** with `ERR_BLOCKED_BY_ADMINISTRATOR`. No browser policy or validation bypass was attempted. `npm run check:native` also could not run because the optional Dawn validation binding was unavailable. These failures are recorded, not converted into passing or skipped-native results.

[Browser attempt](text-browser-attempt.json) · [native validator attempt](text-logs/native-check.log)

**Native shader compilation, GPU execution, visual correctness, cached-versus-direct pixel equality, typography input behavior and performance remain unverified.** No GPU screenshot, FPS number or speedup is claimed. Passing source/host tests does not prove that the new WGSL creates pipelines or renders correctly on a real adapter.

## Native correctness gates included

Serve with `npm start` in a permitted environment, then run:

- `/tests/gpu.html`: retained UI/layout/input/query/sort/selection/edit/damage checks.
- `/tests/text.html`: deterministic original synthetic-font GPU checks for Measure/Arrange metrics, kerning, ligatures, composed accents, emitted glyph count/mark origins, warm cache hits, oversized glyph bypass, exact cached/direct texture bytes under several transforms, and combining-aware editing without layout or implicit readback.

The text gate does not require an external font download. Native harnesses deliberately perform test-only staging readbacks. Failures/missing GPU support are failures, not successful skips.

```sh
python tools/gpu-test.py --url http://127.0.0.1:8080/tests/text.html \
  --kind text --headed --output native-text-results.json
```

The optional native shader checker uses Dawn's null backend. A successful future run would validate pipeline/shader interfaces, **not execute rendering or measure hardware throughput**. No remote GitHub CI execution is claimed.

## Native performance harness included, not run

`/tests/performance.html` uses the real-font 65,536-row scene. Choose **Glyph cache** for exact cache versus direct analytical glyph rendering, or **Dirty tiles** for retained damage versus full-frame rendering. Both arms use the same current engine, fonts, viewport, DPR and one-frame admission. Reverse arm order and repeat to check order/warmup effects. Local user-selected faces are supported for offline testing.

The report separates font preparation, mount, cold first frame and warm idle/integer-scroll/fractional-scroll/text-filter/numeric-sort phases. Each warm phase has four warmups and 40 samples. Optional GPU timestamps, host encode time and completion latency are distinct. After each phase the harness explicitly reads 2 KiB of timing history and 256 state bytes, including last-frame cache hits/misses/bypasses; observed overflow fails the run. The normal app never performs these reads.

There are **no collected benchmark results**. This is not a comparison to version 0.2.0's diagnostic alphabet, and cannot establish “same performance” across releases without actual matched-device measurements. Cold font preparation/misses, larger curves, exact-key churn, the serial cache planner and native scheduling may affect latency. SUBMIT FPS is admitted-frame cadence, not display scanout; CPU ENCODE MS is not GPU time.

## Additional qualification required

Run sustained typing/scrolling with the actual chosen font faces, both sort directions, filtering, large/small sizes, DPR/viewport changes, composition, clipping, overlapping glyphs, cache pressure, local/default font errors and mobile IME. Compare pixels against a suitable font renderer with clearly matched hinting/antialiasing assumptions. Complete Unicode/font-format/accessibility/security conformance is not claimed. [TEXT.md](TEXT.md) and [LIMITATIONS.md](LIMITATIONS.md) state the remaining boundaries.
