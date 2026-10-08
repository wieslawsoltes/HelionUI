# Helion UI 0.12.1 — designer shader compilation repair

This is a repair of the 0.12.0 source package. It corrects the reported WGSL source errors and the stale release label. It does not add framework features, lower rendering quality, switch to CPU rendering, or change frame pacing.

## Root cause and complete syntax audit

WGSL requires explicit grouping when `&&` and `||` occur in the same expression. The designer code used JavaScript/C-style implicit precedence instead. The first reported expression is now:

```wgsl
fn dsAllowed(kind:u32)->bool {
 return (kind >= 1u && kind <= 18u && kind != 11u) || kind == 20u;
}
```

The numeric property guard is now:

```wgsl
if ((field == 22u && (v <= 0.0 || v > 1024.0)) ||
    (field == 25u && (v < 0.0 || v > 1.0)) ||
    ((field == 27u || field == 28u) && (v < .001 || v > 64.0))) {
 return false;
}
```

The audit of all 25 shader source files found **seven** expressions of this kind, all in `shaders/designer.wgsl`, at original 0.12.0 lines **28, 67, 71, 72, 219, 270, and 308**. All seven are repaired, including Grid bounds, pan input, restored dimensions, and track validation. The replacement follows the intended conjunction-before-disjunction grouping rather than changing predicates to force startup.

All 24 other WGSL files are byte-identical to 0.12.0. After removing parentheses, comments, and whitespace, the designer shader's token text is identical too. This is evidence of a grouping-only shader change, not native execution or a GPU benchmark. The source audit is in `shader-repair-audit.json`.

The shared compute module contains the designer source even for applications not currently showing designer controls. Therefore this parser failure could stop the showcase and playground as well as Studio. All three standalone pages, the static site, and the designer's embedded app-export template have been regenerated with the repaired shader.

## Why earlier host tests missed it

The scalar test adapters execute selected WGSL function bodies after translating them into JavaScript. JavaScript accepts these mixed operators and supplies precedence; passing those tests did not prove WGSL syntax validity.

The new delimiter-aware check runs on the original WGSL before scalar extraction/translation, during `npm run check`, and on the embedded shaders during `npm run check:build`. It distinguishes nested expressions, calls, statement boundaries, and nested comments. It is deliberately a focused syntax guard, **not a general WGSL parser or type checker**.

Thirty-five new host tests cover the exact reported expressions, valid and invalid grouping, source positions, guard integration, palette/range semantics, version consistency, and the compile-harness wiring. The harness tests use a non-executing fake device and are not native validation. Restoring the broken `dsAllowed` expression was also tested against the real `npm run check` command: it failed with the intended diagnostic.

## Correct release identification

`src/version.js` defines `BUILD_VERSION = '0.12.1-experimental'`, independently of retained-buffer ABI 3. Showcase, playground, Studio, exported applications, and current browser benchmark metadata use this identifier. Package and HTML metadata are checked against it.

The earlier `Build: 0.7.0-experimental` text was hard-coded in `examples/showcase.js`. It was not evidence that a font or saved design caused this error, nor reliable evidence of which runtime was loaded. The initial-scene cache key is intentionally unchanged: initial buffers and their ABI are unchanged, and that cache does not hold WGSL modules.

## Verification actually performed

- **766 host tests passed**, zero failures or skips. The original 0.12.0 suite had 731 passing host tests despite the bad WGSL; the new guard closes this specific gap.
- Source checks passed for 142 JavaScript modules, 25 WGSL source files, and 45 core compute entries.
- Strict TypeScript API checks passed.
- Standalone closure checks passed for 72 exact embedded JavaScript modules, all 25 shaders, both worker bundles, and the app-export template.
- Initial node, state, and heap hashes match 0.12.0 for the showcase, playground, and all three designer examples. These comparisons used the built-in diagnostic font geometry, not external typefaces or rendered pixels. Font parser/geometry code is unchanged.

**Native compilation and GPU execution are not verified in this environment.** The browser was launched, but navigation to the served localhost test page failed with `ERR_BLOCKED_BY_ADMINISTRATOR`. `npm run check:native` exited nonzero because the optional Dawn binding is absent. An attempted npm lookup failed with `EAI_AGAIN`. Neither is counted as a successful native test. See `shader-repair-validation.json` and the current command logs.

## Native check without loading fonts

```sh
npm start
# Open http://127.0.0.1:8080/tests/shaders.html
```

The new compile-only page requires WebGPU but no fonts or application startup. It first confirms rejection of the original bad expressions and acceptance of the repaired fixtures, then creates all 49 compute pipelines (45 UI + four diagnostics) and six presentation pipelines. It uses the same suite as the Node/Dawn command:

```sh
npm install --no-save --package-lock=false webgpu@0.6.1
npm run check:native
```

The Node default uses Dawn's null backend. A successful run establishes compiler/pipeline acceptance, **not rendering, pointer behavior, visual quality, or performance**. The browser page can export its result JSON. `/tests/designer.html` remains the separate execution and rendering gate.

## Run the repaired applications

Extract the source, enter `helion-ui`, run `npm start`, and open `/designer/`, `/playground/`, or `/`.

For the standalone package, keep its three HTML files together, serve their folder with `python3 -m http.server 8080 --bind 127.0.0.1`, and open `http://127.0.0.1:8080/helion-designer.html` (or the playground/showcase filename). Use the complete replacement files; the nested app-export template also contains shaders. No font file is included. Fonts still load at runtime or from the existing local-font picker.

The repair patch excludes regenerated HTML/worker bundles and historical reports. After applying it to the 0.12.0 source, run `npm run build` to regenerate application files.

Primary syntax reference: W3C WGSL, sections 8.19 and 8.20, https://www.w3.org/TR/WGSL/#operator-precedence-and-associativity .
