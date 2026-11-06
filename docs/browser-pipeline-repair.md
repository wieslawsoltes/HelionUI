# Browser pipeline repair — 2026-11-06

This records the initial repair. See the subsequent
[startup optimization and 200 ms measurements](browser-startup-optimization.md)
for the current implementation and validation; the measurements below are historical.

The published GitHub Pages showcase was reproduced failing with
`Helion pipeline input exceeded 30 seconds`. Fonts and declaration preparation
completed; native shader compilation blocked the first frame. An intermediate
unsplit Studio input shader also exceeded a diagnostic 180-second timeout.
The application timeout remains 30 seconds per pipeline. No timeout increase or
CPU renderer is used to conceal the failure.

## Pipeline findings and changes

| Stage | Finding and resulting behavior |
| --- | --- |
| Delivery/build | Source modules, WGSL, workers and four embedded HTML apps share the same sources. `check:build` checks exact embedded content. Fonts remain external runtime assets. |
| Font/declaration preparation | One-time CPU/worker preparation and upload remain necessary. Measured font preparation was 61–508 ms and declaration compilation 48–138 ms in the source-app run, much smaller than native pipeline preparation. |
| Native compilation | Caret routing previously reached the full shaper several times. Shaping now has single GSUB/GPOS and traversal interpreter call sites. A separate GPU stage prepares caret geometry. |
| Input/actions | A GPU scratch cursor resumes the FIFO after editor, docking, designer or action work. Separate kernels avoid repeatedly inlining the large interpreters. Focus, hit results, mutations, shaping and queue progress stay on the device. |
| Browser text input | Uppercase letters such as A/C/V were incorrectly treated as shortcut key codes even without Ctrl/Meta, suppressing their text input. Printable letters now reach the text path; command shortcuts retain their behavior. The actual browser typing test verifies the GPU TextBox contains `Aurora`. |
| Designer transactions | Validation/history runs once at the command or pointer-handler boundary. Seven command families and five pointer handlers bound compiler graphs. Existing edits finish before new transactions; undo and rollback stay on the GPU. Inspector decoding calls each property editor once. |
| Layout/emission | Existing GPU layout, retained shaping, visibility and damage behavior remain. Six designer emission stages own disjoint node draw heads and preserve painter ordering. |
| Raster/composition | Existing compute glyph coverage, dirty strips and compositing remain. Native gates compare retained-damage output against full rendering. |
| Canvas/presentation | A device-pixel ResizeObserver measurement can disagree with reported DPR. Allocation and shader coordinate scale now use the same effective ratio; the observed Retina quarter-canvas defect is fixed. |
| Scheduling/readback | Idle frames add no input-stage dispatches. Stage names are filtered once at mount. The CPU encodes a bounded number of stages from incoming event kinds/counts; it does not map GPU state to choose routes. Idle application checks require progressing GPU completions and zero additional readback bytes. |

The reserved scratch header is documented in `shaders/input.wgsl`. Each event
can yield once before a caret query and once after requesting effects. The host
budgets those boundaries from input intent, including the parent's bound for a
child presenter. Dispatch order supplies inter-stage visibility. No additional
normal-frame payload or readback is required. The existing 64-byte clock/viewport
upload and event delivery remain; WebGPU still requires host command submission.

## Browser evidence

Chrome **156.0.8078.80**, macOS, adapter vendor **apple**, architecture **metal-3**;
headed browser with Chromium sandbox enabled, no GPU-enabling flags. These are
actual WebGPU execution checks, not the Dawn null backend or translated scalar
shader tests. Driver/browser cache state was not controlled. Results do not
establish cold-cache latency, cross-browser support or universal frame rates.

Source applications reached a completed frame with no application errors:

| Application | First completed frame | Pipeline preparation |
| --- | ---: | ---: |
| Showcase | 7.43 s | 7.34 s |
| Studio | 16.58 s | 16.37 s |
| Playground | 19.03 s | 18.93 s |
| Typography Lab | 9.37 s | 9.20 s |

All four screenshots were visually inspected at 1280 × 900 CSS pixels. Input
and inspector emission compilation remain the largest startup costs; startup is
working but is not yet instantaneous. GPU timestamps are not a substitute for
completed-frame measurements, and these correctness runs are not FPS benchmarks.

The subsequent standalone-app run reused compiled shaders in the driver cache:
showcase 589 ms, Studio 626 ms, Playground 228 ms and Typography Lab 422 ms.
These are warm shader-cache observations, not first-visit promises. Source and
embedded builds preserve the same shader semantics.

Native regression coverage includes multiple caret/edit boundaries in one
submission, separate inspector-edit/command undo transactions, editor history,
designer selection/dragging, layout, data queries, template state and pixel
equivalence. Explicit diagnostic snapshots in tests are expected readbacks;
normal application rendering has no implicit state mirror or polling.

The [machine-readable evidence](browser-pipeline-results.json) records the app
measurements and eleven passing native gates. All 1,016 host tests, static checks,
strict API type checks and standalone embedding checks also pass. Browser tests
exercise the GPU FIFO; the scalar test adapters intentionally continue testing
the immediate algorithm bodies and do not emulate GPU dispatch ordering.
The browser runner also types through the DOM input bridge and runs Playground's
starter through its sandbox worker into a shared-device GPU preview. These
explicit user actions and diagnostic assertions may read source/state snapshots;
their readbacks are separate from the zero-readback idle rendering checks.

## Reproduce

```sh
npm test
npm run check
npm run build
npm run check:build
npm start
# In another terminal; optional test dependency, not an application dependency:
npm install --no-save --package-lock=false playwright
npm run check:browser -- --channel chrome --output gpu-results.json
npm run check:browser -- --base http://127.0.0.1:8080/dist/ --standalone --suite apps --output standalone-results.json
```

The runner fails on missing WebGPU, startup timeout, application errors, stopped
frame completions, idle readbacks or failed native assertions. It records timings,
adapter details and screenshots. `--executable` selects an existing Chromium
binary; `--headless` is available but requires WebGPU support in that environment.
The published site is unchanged until these source changes are deployed.
