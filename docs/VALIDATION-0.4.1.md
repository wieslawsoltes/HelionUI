# Validation — 0.4.1-experimental

## Observed results

**279 host tests pass; zero failures or skipped tests.** Static JavaScript/import/WGSL lexical/resource checks, strict TypeScript API checking, source/site/standalone builds, exact thirteen-shader embedding and exact startup-worker embedding pass.

The new host tests cover HUD program/source-map assembly, real-font metadata and advances, bounded storage layout, responsive geometry, numeric rounding and explicit N/A/overflow handling, history ring order and gaps, and preservation of spike values. Runtime tests with a **non-executing GPU fake** check pass/binding order, first-use/DPR-only rasterization, warm and hidden cache reuse, distinct HUD/application glyph storage, and unchanged 64-byte frame uploads without buffer maps. They do not compile or execute WGSL.

The complete 0.4 core shader sources, timing-history shader, font compiler/parser, startup preparation/cache logic and cadence/gate modules remain byte-identical. Private real-font preparation checks preserve the complete compiled nodes/state/heap for the same three Noto Sans faces and showcase. Only aggregate hashes/metadata are distributed, never fonts or extracted outlines.

A private CPU layout reference was reviewed for text spacing. It is **not native GPU pixel validation**. [Current machine-readable record](hud-validation.json) · [HUD contract and limitations](HUD.md).

```sh
npm test
npm run check
tsc --noEmit --strict --target ES2022 --lib ES2022,DOM \
  --module NodeNext --moduleResolution NodeNext tests/api-types.ts
npm run build
npm run check:build
```

## Native results: NOT VERIFIED

The Chromium attempt to open the native test gate failed before loading with **ERR_BLOCKED_BY_ADMINISTRATOR**. Browser policy was not changed or bypassed. npm registry resolution failed (`EAI_AGAIN`), leaving the optional official Dawn native validator unavailable. These are unavailable test attempts, not passing shader/pipeline tests.

Native shader compilation, execution, real GPU text/chart pixels, browser-specific behavior and performance overhead remain unverified. No claimed FPS, display-rate, GPU-time or startup improvement is inferred from host tests. The prior startup CPU benchmark is historical and was not rerun as a hardware test for this HUD release.

[Browser attempt](hud-browser-attempt.json) · [native checker attempt](hud-logs/native-check.log) · [host log](hud-logs/host-tests.log).

## Included executable gates

`/tests/hud.html` adds a native mask/pixel/reference/lifecycle gate using an original geometric fixture, and a separately labelled real-font preview with synthetic history. It compares analytical GPU coverage with an independent polygon/pixel oracle within one 8-bit coverage unit, verifies mask reuse, final presentation tones and hidden/DPR lifecycle. All test readbacks are explicit and not on the normal frame path. [Details](HUD.md).

`/tests/gpu.html` retains UI/layout/query/edit/damage checks; `/tests/text.html` retains the broader main text/cache gate. `/tests/startup.html` remains the continuous-rAF startup/cadence benchmark, and `/tests/performance.html` is the prior serialized stage-cost comparison. Run them on the target device before making visual or performance guarantees.

Optional `npm run check:native` validates both new HUD compute entries and the assembled presentation shader with the official Dawn Node binding when it has been installed. The default null backend does not execute shaders. No remote CI run was performed.

[Historical 0.4 validation and scoped CPU benchmark](VALIDATION-0.4.md) · [historical 0.3 typography comparison](VALIDATION-0.3.md). Existing renderer/font/framework qualification gaps still apply.
