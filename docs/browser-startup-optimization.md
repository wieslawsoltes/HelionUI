# Startup optimization and the 200 ms target — 2026-11-06

This records the first optimization round. The subsequent committed changes and
current validation are in the [startup follow-up](startup-followup.md).

**The 200 ms navigation-to-usable-frame target is not met.** All application
correctness checks pass, but every sample in the new 200 ms budget run fails the
latency threshold. A loading screen, cached screenshot, queue submission or
mount-promise resolution does not count as a completed application frame.

This follows the [initial browser repair](browser-pipeline-repair.md). Its
7–19 second measurements were mount-to-completion observations with uncontrolled
driver caches, not qualified first-visit timings. The new runner also records
navigation-to-completion, including document/module loading before mount.

## Implemented reductions

- Layout measurement now calls the paragraph measurement engine once for all
  text-control cases. The compiler previously inlined it four times.
- Text baseline calculation resolves the retained run and font metrics once.
- TextBlock, Button, CheckBox, TextBox, Drawing and Dock emission have separate
  compute entries with disjoint draw heads. Designer inspector roles have four
  separate entries; caption formatting shares its text-emission call site.
- DataGrid's serial diagnostic and parallel paths share their section emitter.
- Core keyboard handling has its own GPU stage. Absent control families are
  guarded by immutable view feature flags.
- Designer command and pointer families rely on the existing GPU edit-finalization
  prepass, eliminating repeated commit/validation interpreters. The immediate
  scalar test adapter retains its own preflight.

The result has 85 compute entries in 54 source partitions. More small kernels
bound native compiler expansion. Input ordering, transaction history, layout,
shaping, damage and raster state remain on the GPU; no CPU renderer or normal-frame
state readback was introduced. WebGPU host submission and startup asset preparation
still require CPU work.

## Compilation stress comparison

Chrome 156.0.8078.80, macOS, Apple metal-3, headed and sandboxed. Runs were sequential
on localhost. The baseline is the repaired implementation before these additional
startup changes, not the original broken publication.

Fresh browser profiles do not clear the OS shader cache. Both comparison runs
therefore disabled Chromium's shader disk cache and injected a unique, uniform,
out-of-range workgroup guard into compute entry bodies. This changes native code
without changing legal Helion dispatch behavior and discourages OS cache reuse.
**These are instrumented stress probes, not production cold-start timings.**
They are single samples, not a statistical latency guarantee.

| App | Baseline mount to completed frame | Optimized | Reduction |
| --- | ---: | ---: | ---: |
| Showcase | 19.85 s | 7.99 s | 60% |
| Studio | Input pipeline exceeded 30 s | 17.49 s | Baseline failed |
| Playground | 31.51 s | 11.61 s | 63% |
| Typography | 20.25 s | 9.50 s | 53% |

Showcase measurement-pipeline preparation fell from 16.38 s to 1.17 s, and input
from 12.68 s to 1.58 s in these probes. Remaining costs include shaping, editor/grid
emission and Studio input. Native pipeline completion time includes browser/driver
queueing and compilation, rather than measuring compiler CPU time alone.

## Unmodified pages and repeat visits

All source and standalone pages booted, kept completing GPU frames and added zero
idle readback bytes. DOM typing and Playground's Run shortcut passed. Source
screenshots were inspected. The ordinary source run measured 582–781 ms from
navigation to completion, with already-warm native shader caches. Standalone
observations were 698–1,494 ms, including pre-mount work and external font fetches.

A separate two-visit run reused each app's browser context and HTTP/IndexedDB
storage. Native shader caches were already warm. The second visit measured:

| App | Navigation to completed frame | Mount to completed frame | Scene cache |
| --- | ---: | ---: | --- |
| Showcase | 478 ms | 352 ms | Hit |
| Studio | 647 ms | 562 ms | Hit |
| Playground | 657 ms | 510 ms | Disabled |
| Typography | 523 ms | 430 ms | Disabled |

These samples illustrate variability, not a lower bound. Even with cached scene
preparation, pipeline creation alone took 203 ms for Showcase and 418 ms for Studio
in this run. All eight visits passed correctness checks and failed the 200 ms
navigation budget. The [machine-readable record](browser-startup-results.json)
keeps correctness and budget outcomes separate.

## What a credible 200 ms implementation still needs

This optimization does not implement staged startup. Reaching that budget requires
a smaller initial pipeline graph and further packaging/preparation work:

1. Define an actually interactive initial view and prepare only its required GPU
   pipelines. Defer editor, designer and offscreen features with explicit readiness
   and preserved FIFO ordering. A visible shell alone is a different milestone.
2. Ship versioned, prepacked initial font/scene assets where app policy permits,
   and reduce module-fetch/parse work. Keep arbitrary imported fonts and documents
   on the existing validated preparation path.
3. Further split large shaping/paragraph and emission interpreters into bounded
   GPU passes. Deferring input compilation alone cannot remove expensive rendering
   prerequisites or make the full app immediately interactive.
4. Measure navigation, first completed frame, interaction readiness and full
   feature readiness independently across hardware and cache states. Retain the
   200 ms acceptance gate rather than substituting a loading placeholder.

The [WebGPU specification](https://www.w3.org/TR/webgpu/#shader-compilation)
describes browser and driver compilation/caches. The app cannot assume a native
shader-cache hit on first visit. Sub-200 ms full cold startup for these four apps
is not established by these changes, and is not a portable guarantee.

## Validation and reproduction

1,020 host tests, static checks and exact standalone embedding checks pass.
All eleven native GPU gates pass, including designer edit/command undo boundaries,
typography, templates, rendering quality and frame synchronization. The application
pipeline timeout remains 30 seconds. The published site has not been redeployed.

```sh
npm test
npm run check
npm run build
npm run check:build
npm start
# Optional Playwright installation and WebGPU-capable Chrome required:
npm run check:browser -- --suite apps --visits 2 --startup-budget-ms 200 --output startup-budget.json
# Expected to exit nonzero until the budget is met, even when correctness passes.
npm run check:browser -- --suite apps --disable-shader-cache --compile-probe --output compile-probe.json
npm run check:browser -- --suite gates --output native-results.json
```

The compile probe is source-app-only and explicitly labels its instrumentation.
Repeated visits share application storage within each app; separate applications
start with isolated storage. Neither option purges the OS's shader cache.
