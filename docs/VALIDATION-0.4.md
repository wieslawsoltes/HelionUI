# Validation — 0.4.0-experimental

## Observed current results

**260 host tests pass, zero failures, zero skipped.** Existing parser/typography/layout/query/input tests remain. New coverage includes exact typed-heap growth and float conversion, all-codepoint Unicode mark equivalence, one-pass resource analysis, bounded asynchronous pipeline creation/cleanup, concurrent shader error scopes, worker/CSP fallback and actual isolated Node worker execution, exact startup cache restore/corruption/revision misses, abort propagation, URL resolution and high-refresh host scheduling.

The frame-loop tests use a deliberately **non-executing GPU fake**. Simulations at 60, 90, 120, 144, 165 and 240 Hz exercise delayed callbacks and overload; they are not measured device FPS. Startup cache integration uses a fake database, not a passing browser IndexedDB test. The standalone startup worker was executed in a real isolated Node worker thread with byte-exact array/manifest comparison; this is distinct from unverified browser Worker/CSP integration.

Static checks pass for 48 JavaScript modules, 11 WGSL sources, 30 core compute entries and 202 showcase views. The timing-history kernel and presentation bring mount to 32 native pipeline creations. Strict TypeScript API checking passes. Source/site/standalone builds and exact eleven-shader plus entire startup-worker embedding comparisons pass. Static lexical/resource checks do not parse or execute native WGSL.

```sh
npm test
npm run check
tsc --noEmit --strict --target ES2022 --lib ES2022,DOM \
  --module NodeNext --moduleResolution NodeNext tests/api-types.ts
npm run build
npm run check:build
```

[Machine-readable current record](startup-vsync-validation.json) · [CPU benchmark](startup-host-benchmark.json) · [host test log](startup-logs/host-tests.log).

## Collected CPU performance, not GPU/display performance

Five alternating fresh Node v22.16.0 processes per version used the same full scene and three locally available real Noto Sans faces. Median scene compilation was **1,267.98 → 258.92 ms**; total measured host preparation was **1,505.39 → 504.85 ms**. Median peak process RSS was **357.69 → 239.75 MiB**. The complete compiled nodes/state/heap hashes matched on every run. No fonts or extracted outline data are distributed.

The benchmark excludes module import time, network, browser Worker/IndexedDB, native shader compilation, GPU upload/execution, browser presentation and display FPS. It supports a 4.90× CPU compiler and 2.98× measured host-preparation improvement for these inputs/environment, not a full-startup or native-frame-rate multiplier. [Method, reproducible command and quality boundaries](STARTUP-VSYNC.md).

## Native results: NOT VERIFIED

A real Chromium navigation attempt failed before page loading with `ERR_BLOCKED_BY_ADMINISTRATOR`. Browser policies were not modified or bypassed. The optional Dawn Node native validator binding was unavailable, so native validation did not run. These are failed/unavailable attempts, not passing native tests. No GPU screenshot, native startup timing or physical display-rate result is claimed.

[Browser attempt](startup-browser-attempt.json) · [native checker attempt](startup-logs/native-check.log).

**Native shader/pipeline creation, GPU execution, cached/direct pixel equality, new HUD visuals, actual browser worker/cache behavior, sustained responsiveness and display cadence remain unverified here.** CPU output equality does not prove native text quality. The existing font/rendering/framework limitations remain.

## Native gates and benchmarks included

With `npm start`, open `/tests/gpu.html` for retained UI/layout/input/query/edit/damage checks and `/tests/text.html` for synthetic real-font typography/cache/editing/pixel checks. Test-only readbacks are explicit. Missing GPU/errors fail; they are not successful skips.

Open **`/tests/startup.html`** for two complete startups, cache/worker/phase timings and continuous idle/fractional-scroll cadence measurements at the normal rendering resolution. During measured phases it does not wait for per-frame GPU acknowledgements or read buffers. It records actual rAF/submit/skipped counts, then stops/drains and performs explicit timing/state reads. It rejects observed overflow and hidden-page phases. Compare credit limits 1 and 2 under matched conditions, reverse run order and repeat. These are same-version scheduling tests; HTTP/driver cache warmup is not erased. No native benchmark report has been collected here.

The existing `/tests/performance.html` is a serialized stage-cost comparison with its fixed DPR/one-frame settings. It compares glyph caching or dirty tiles within the new renderer, not vsync throughput. Its behavior is intentionally different from the continuous-rAF benchmark.

## Historical typography validation (not rerun as a GPU test)

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


[Complete historical 0.3.0 validation record](VALIDATION-0.3.md). Startup changes do not expand the supported font formats/shaping subset or remove previously documented qualification gaps.
