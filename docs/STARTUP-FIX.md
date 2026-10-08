# Helion UI 0.1.1 — WGSL startup repair

Historical record of the preceding release. Current responsiveness changes, test counts and timing semantics are documented in [PERFORMANCE.md](PERFORMANCE.md) and [VALIDATION.md](VALIDATION.md).

Recorded 2026-09-23. This is a repair of the delivered 0.1.0-experimental source and standalone HTML, not a new implementation of the UI library.

## Reported failure

The supplied browser log reported `Error while parsing WGSL: :642:16 error: parsed as template list` during creation of `Helion all-compute UI kernels`. It showed this DataGrid comparator expression:

```wgsl
return select(compare<0,compare>0,heap[t+12u]!=0u);
```

The affected source is `shaders/data.wgsl`, in `lessRow`. WGSL template-list disambiguation can consume the `<` and `>` across these arguments. The repair explicitly groups the two comparisons:

```wgsl
return select((compare < 0i), (compare > 0i), heap[t+12u] != 0u);
```

The signed integer literals match the existing `i32` comparison accumulator. The change preserves sort direction, equality handling, stable row-index tie breaks, and the GPU-only comparator. No CPU sort, layout, rendering, or implicit state readback was introduced.

Specification reference: [WGSL template lists](https://www.w3.org/TR/WGSL/#template-lists).

## Additional repair changes

The compute shader assembly now retains source-section ranges, without changing the assembled shader text. Native compiler messages map generated lines back to `shaders/data.wgsl` (or the relevant original source), with a source line and caret. Presentation-shader compilation is checked as well.

Shader-module creation is paired with a validation error scope, so a compiler failure is reported by the awaited initialization path instead of first appearing as a generic uncaptured `GPUValidationError`. The scope is popped even if creation or compilation-info retrieval fails. This adds no GPU buffer readback and does not alter the frame loop.

The startup panel distinguishes shader-source failure from adapter/environment failure, retains the compiler diagnostic, and identifies build `0.1.1-experimental`. Embedded JavaScript modules have readable `sourceURL` labels instead of only base64 module names in stack traces. Source, static site, and standalone HTML are rebuilt together; the bundle gate checks all eight embedded WGSL strings for exact source equality and verifies the repaired comparator and version.

## Executed checks

- 108 host tests passed, zero failures (96 existing tests plus 12 repair regression/diagnostic tests).
- The original faulty comparator was temporarily restored in the working source; the new source-regression test failed as intended. The repaired source was then restored and the complete suite passed again. This is a host source guard, not a native parser test.
- JavaScript syntax/import checks and WGSL lexical/resource checks passed: 26 JS modules, eight WGSL sources, 26 compute entry points, 170 compiled showcase nodes.
- TypeScript public API checking passed.
- Site and standalone builds passed. The standalone contains 12 embedded JS modules and eight exact WGSL sources, with no external script/style assets.

## Native validation status

Native shader compilation and GPU execution were **not verified** in this authoring environment. The actual Chromium runner attempt was blocked at page navigation with `net::ERR_BLOCKED_BY_ADMINISTRATOR`, before any shader ran. An independent native validator could not be installed because of the environment's network/download restrictions. No browser policy was bypassed, and GPU validation was not disabled.

An optional `npm run check:native` command and a corresponding CI job are now included. They use the official Dawn Node binding, pinned in the installation command to `webgpu@0.6.1`, to reject the original malformed comparator and validate the full compute module, all 26 compute pipelines with explicit resource layouts, and the presentation pipeline for two formats. The default `null` backend is for WGSL/pipeline validation only; it does not execute shaders. The command fails explicitly when its optional binding is missing. This is the failure observed locally; no passing run of this new native command or remote CI job is claimed.

```sh
npm install --no-save --package-lock=false webgpu@0.6.1
npm run check:native
```

The app itself still has no runtime package dependencies. Actual GPU execution and browser behavior require the existing `tests/gpu.html` gate and device qualification described in `VALIDATION.md`.

## Opening the repaired standalone

The supplied log also contains a separate `file:` origin warning. Use localhost rather than relying on local-file origin behavior. From the folder containing `helion-ui-fixed.html`:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080/helion-ui-fixed.html`. For the extracted source project, run `npm start` inside `helion-ui` and open `http://127.0.0.1:8080`. The source's GPU test page is `http://127.0.0.1:8080/tests/gpu.html`.
