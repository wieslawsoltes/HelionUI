# Helion 0.12.2 — startup and designer stall repair

## What is established

This release changes the actual 0.12.1 application and shader-preparation paths. It does not lower display resolution, disable sharp text, remove controls, replace GPU authoring with a CPU editor, or change the paced-vsync policy.

**805 host tests pass; native compilation, GPU execution, final pixels, native startup time and resolution of the reported Chrome hang remain unverified.** The current served shader/designer pages return HTTP 200, but the managed browser rejects navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. The optional Dawn Node binding is absent. No native result is represented as a success. See [validation](startup-repair-validation.json) and [native attempt](startup-repair-native.json).

No new recording of the current hang was supplied. The findings below come from source inspection and reproducible source/host tests, not a hardware profile. Historical trace reports elsewhere in this package are not measurements of this release.

## Identified startup work and changes

### Fonts no longer precede GPU preparation in Studio

Previously `designer/app.js` awaited `loadFonts()` before calling `HelionSurface.mount`. Consequently font requests and parsing delayed the start of adapter/pipeline setup. It also supplied fully parsed face objects to the startup worker.

Studio now passes its unchanged Regular and SemiBold source descriptors to mount. The one-shot worker loads/parses/packs those fonts while the host prepares the GPU. There is no glyph subset or placeholder typeface. A blocked worker still has the existing identical host preparation fallback; full browser Worker/CSP integration remains unqualified here.

The default public starter enables the existing lossless initial-scene cache. A valid hit skips font parsing and scene packing, not GPU allocation or native pipeline creation. The key covers the existing compiler/cache revision, full view, sources and limits. This release enables persistence only for the original built-in starter object with default font sources. Imported projects, restored/remounted user snapshots and local font files do not silently opt into persistence. GPU edits are never automatically read back into it. This is an initial asset optimization, **not autosave or device-loss recovery**.

### Relevant shader modules, not one unrelated whole-library input everywhere

The previous core module contained the complete editor, designer, controls, layout, data, glyph and raster function set. The new controlled-source partitioner creates related entry groups and copies only their reachable functions. All retained function tokens, constants, types, resource declarations and stage annotations are copied exactly; original filename/line diagnostics survive. Types, uniformity and interface validity still require a native compiler.

For the default designer, eight unused DataGrid entries are no longer prepared. Studio has **36 core pipelines instead of 44**; its initial canvas-copy and metrics pipelines are additional in both builds. Later optional HUD preparation is separate. A SurfacePresenter still prepares the table family for a dynamically attached DataGrid application. All 45 framework entries remain available and covered by the compile harness.

The default designer uses 15 core module groups. Its old complete module was 278,584 UTF-8 bytes. Representative new inputs are 144,853 bytes for input, 31,502 for layout, 27,408 for raster, and 6,071 for flattening. These are source-size measurements, not generated machine-code sizes or compilation-time measurements. Total frontend bytes across the groups can increase because shared declarations/helpers are repeated. Four concurrent preparation requests remain the default; native parallelism is up to the browser/driver.

`shaderCompilation:'monolithic'` retains the complete-source path as an explicit same-version comparison. It does not restore every old defect. Missing functions, recursion, malformed declaration boundaries and inconsistent resource reachability reject in the build/test tooling; that tooling is not a general WGSL parser or native compiler.

### One call site into large interpreters

Mutually exclusive shortcut branches repeatedly called large generic command handlers. The routing functions now return a request and invoke the relevant interpreter once:

| Static call sites | Before | After |
|---|---:|---:|
| editorKey → editorCommand | 10 | 1 |
| dsKey → dsCommand | 3 | 1 |
| handleKey → activate | 2 | 1 |
| dsDecimal → glyph | 4 | 1 |
| dsHexText → glyph | 2 | 1 |

This avoids duplicating those call sites in backends that inline function calls. **It is not evidence that a particular backend inlined all of them or that this alone caused the user's hang.** TextBox-only insertion no longer passes through the entire code-editor/activation router. Command opcodes, arguments, digit order and unsnapped glyph advances are preserved by regression tests. A baseline/current comparison executes 2,000 editing/shortcut operations through the test-only scalar adapters and compares complete heaps, states and snapshots after every operation.

### Hidden panes no longer reflow at a zero-sized viewport

`layoutEditors` skips hidden or zero-sized editors while retaining pending visual-layout dirtiness and scroll/reveal state. Reopening a pane performs the pending visual-line layout using its actual viewport. This avoids repeatedly reflowing inactive docked source/project/help editors. Content analysis remains revision-driven and is not silently discarded for hidden documents.

Three ruler/timeline tick-growth loops also have explicit 32-iteration limits. Valid zoom/duration behavior is preserved. These are defensive bounds; normal valid project state was not demonstrated to make the original loops infinite.

### The export runtime is no longer eagerly parsed as a second HTML string

The standalone designer previously embedded the complete standalone-app export template as an uncompressed JavaScript string. The release now embeds lossless gzip data and expands it only when Export HTML is requested. The expanded bytes are checked against the ordinary generated template. `DecompressionStream('gzip')` is required for that standalone export path; absence raises an explicit error. Source/site export still reads the generated HTML template normally.

The standalone designer is **1,713,323 bytes instead of 2,359,684 bytes — 27.39% smaller**. The playground/showcase gain about 22 KB each from the new shared code; they are not represented as smaller. Font files are not part of any embedded or compressed template. Smaller HTML and deferred decompression are not an end-to-end startup-time measurement.

## Explicit deadlines and cancellation

```js
const surface = await HelionSurface.mount(canvas, view, {
  shaderCompilation: 'partitioned', // default; 'monolithic' is a diagnostic comparison
  pipelineConcurrency: 8,          // current bounded default
  startupTimeoutMs: 60000,         // overall preparation/upload wait
  pipelineTimeoutMs: 30000,        // adapter/module/pipeline wait
  gpuWatchdogMs: 10000,            // outstanding-frame acknowledgement progress
  onStartup(event) { console.log(event.stage, event.detail); },
  onError(error) { console.error(error); }
});
```

Timeouts accept finite 0–600,000 ms; zero disables the corresponding deadline. Studio additionally bounds its first complete frame wait to 15 seconds; the 10-second outstanding-frame watchdog can fire first. No timer is an FPS cap or a frame clock.

A failed/cancelled startup rejects promptly, aborts sibling preparation, terminates the waiting startup worker, and disposes its device/resources. A device arriving after request cancellation is destroyed. Underlying rejected promises remain observed. Superseded Studio startup and page closure cancel the prior boot. A missing native completion no longer has to keep the application's initial wait pending forever.

The runtime watchdog checks **host acknowledgement progress**, not GPU timestamps or scanout. It never invents completion, releases unproven frame credit, performs readback or submits catch-up frames. Genuine higher completion serials return progress; stale callbacks cannot extend the deadline. Hiding the page suspends the watchdog, and resumption grants a fresh deadline. A fired runtime watchdog stops further frame production and reports the pending serials. It does not silently remount or erase the live document. Initial mount/first-frame failure does dispose the failed surface.

**JavaScript timers cannot preempt a synchronously blocked browser/native driver or cancel already executing GPU commands.** They run only when the browser's event loop runs. An unexpectedly slow legitimate operation/debugger pause can also cross a configured deadline. These controls contain further application submissions and expose a stage/notification stall; they are not a guarantee against every Chrome/driver hang.

`surface.startup` includes the compilation mode, module source sizes, per-pipeline promise durations, current stage/detail and the existing preparation/cache status. Promise lifetimes are host-observed wait durations, not shader execution timings. Studio's existing Diagnostics → Frame sync action exposes these records without GPU buffer mapping.

## Preserved contract and costs

The default remains paced rAF with two independent completion acknowledgements. ASAP remains off. Sharp curve coverage, native backing pixels, exact glyph-cache keys, typefaces, editor/docking/designer capacities, DataGrid data and the normal command wire format are unchanged. There is no new GPU arena, texture, rendering pipeline or per-frame dispatch for these repairs. The watchdog adds host timer/bookkeeping work; the startup module slicer and gzip decoder have explicit one-time host costs.

Five complete initial compiled scenes (showcase, playground, three designer samples) match 0.12.1 byte-for-byte in node/state/heap arrays using the original diagnostic glyph fixture. Twenty-three protected compiler/font/coverage/memory/pacing/metrics files match exactly. This is source/initial-data evidence, **not final-pixel equivalence** of the changed input/editor/designer code.

Normal control editing remains GPU-owned. No new normal-frame buffer mapping, font/cache notification, state polling or text upload loop is introduced. Existing explicit file/clipboard/snapshot/action outbox boundaries retain their costs. The runtime progress watchdog does not protect unsaved GPU-only content from device loss; save important projects explicitly.

## Reproduce

```sh
npm test
npm run check
tsc --strict --noEmit --target es2022 --module nodenext \
  --moduleResolution nodenext --lib es2023,dom tests/api-types.ts tests/designer-api.ts
node tools/audit-startup-repair.mjs --baseline=/path/to/0.12.1/helion-ui \
  --output=source-audit.json
npm run build
npm run check:build
npm start
```

Open `/designer/`. `/tests/shaders.html?autorun` is the no-font native compilation gate for the actual partitioned programs and all framework pipelines. `?monolithic` selects its explicit full-module comparison. `/tests/designer.html?autorun` is the separate native interaction/state/pixel gate. A successful compile-only run would not establish rendered correctness or speed. Native test waits now have deadlines as well.

[Source audit](startup-repair-audit.json), [keyboard differential](startup-repair-keyboard-differential.json), [validation](startup-repair-validation.json), and logs document the performed work. The delivered archive manifest separately records a fresh extraction/retest/rebuild and exact standalone hashes. Historical release reports are not current GPU verification.

## Primary platform references

GPUWeb's generated API reference documents asynchronous pipeline creation and its promise semantics, device destruction and queue work completion: https://gpuweb.github.io/types/interfaces/GPUDevice.html and https://gpuweb.github.io/types/interfaces/GPUQueue.html . These establish API behavior, not a native performance result for Helion.
