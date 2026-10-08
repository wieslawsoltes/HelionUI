# Validation — 0.14.0-experimental

The current record is [theme-refinement-validation.json](theme-refinement-validation.json).
[THEME-REFINEMENT.md](THEME-REFINEMENT.md) describes the current APIs, implementation,
costs and limits. Earlier named reports in this directory are historical.

## Performed host checks

**946 tests pass**, zero failures/skips/cancellations: the 0.13 baseline had 897;
48 theme regression tests and one executed playground-example case were added.
Tests cover retained plan/selector logic, actual initial compilation, mock-device
command submission, CPU-translated scalar WGSL, project history/restoration, and
isolated Node authoring-worker execution. They do not execute native GPU shaders.

Source checks pass for 171 JS modules, 26 WGSL files and 48 core compute entry points.
Strict TypeScript checks pass. Bundle checks verify 88 exact embedded JS modules,
all shaders, startup/authoring worker closures, four guarded launch routes, the
losslessly compressed export template, and the local-server launchers.

The palette audit checks eight built-in color combinations and 4,096 deterministic
custom accents. Its worst sampled opaque accent/foreground ratio is 4.580393742.
All specified normal text pairs exceed 4.5:1; focus pairs exceed 3:1. These checks
are host math, not accessibility conformance or rendered antialiasing/alpha tests.
See [theme-refinement-audit.json](theme-refinement-audit.json).

The complete ordinary showcase buffers match the 0.13 baseline with the same private
DejaVu Sans Regular face: 202 views, 65,536 rows, eight animations. Twenty-three
protected font, coverage, launch, timing, worker and pacing files match. 24/26 WGSL
sources are unchanged; templates/designer logic deliberately changes. Studio grows
from 440 to 480 nodes with five editors, remaining within the existing capacity.
See [preservation](theme-refinement-preservation.json). No font binary is packaged.

## Actual browser result versus native GPU result

Chromium 144 executed two real classic Blob preparation workers. Both returned
complete node/state/heap arrays and template/palette manifests identical to host
compilation, including high contrast, compact density and custom accents. This is
browser CPU/worker integration evidence, not GPU pipeline or final-pixel validation.

The server returned HTTP 200, but Chromium rejected both current native-gate page
navigations before loading with ERR_BLOCKED_BY_ADMINISTRATOR. No origin/CSP/admin
policy bypass was used. The headless container launch uses --no-sandbox, which is
not a security qualification. The optional Dawn binding is absent; `check:native`
exits nonzero and does not compile shaders. Neither native attempt is counted as a
pass. See [browser report](theme-refinement-browser.json) and the current logs.

**Native WGSL acceptance/execution, full application behavior, final GPU pixels,
platform-theme fidelity and device performance remain unverified.** A source-count
reduction, initial-array equality, successful host test or browser worker result is
not a hardware FPS, startup or image-quality measurement.

## Reproduce

```
npm test
npm run check
tsc --strict --noEmit --target es2022 --module nodenext --moduleResolution nodenext --lib es2023,dom tests/api-types.ts tests/designer-api.ts tests/templates-api.ts
npm run build
npm run check:build
npm start
```

The native gate `/tests/templates.html?autorun` includes new preference, focus,
text-buffer, designer transaction and retained/full-pixel comparisons.
`/tests/shaders.html?autorun` covers native compilation of all partitioned programs.
Both are provided, not recorded as passing here. Existing runtime, editor, designer,
text, dynamic-data, pacing and quality gates remain in the package.

Final source-ZIP extraction/retest/rebuild, SHA-256 hashes, font-file exclusions and
standalone equivalence are recorded in the separately delivered package manifest.
