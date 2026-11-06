# Startup follow-up — 2026-11-06

The previous browser repairs are now committed in focused changes. This follow-up
reduces pipeline preparation, module-discovery delays and repeated font/scene work.
**The 200 ms navigation-to-completed-frame target remains unmet.**

## Changes

| Commit | Change |
| --- | --- |
| `91648b9` | Prepare native pipelines in bounded batches of eight instead of four; retain the explicit 1–32 override. |
| `fa4d881` | Format numeric labels into a bounded GPU-local buffer, then emit through one glyph path with one baseline lookup and one font lookup per glyph. |
| `5262977` | Generate module preloads for published source routes from the exact static import graph. Standalone apps omit external preloads; file/data launch guards remain active. |
| `3dd0ee8` | Start Playground GPU preparation alongside font loading in the worker. Cache only built-in initial Playground/Typography scenes, with superseded Playground mounts cancelled. |

Local fonts, imported workspaces and live GPU edits are excluded from the new
cache opt-ins. Fonts for an explicitly requested Playground preview still prepare
when needed. No renderer, layout, mutable control state or normal-frame readback
moved to the CPU. Runtime glyph emission performs less redundant work.

## Measurements

Chrome 156.0.8078.80, Apple metal-3, headed with the browser sandbox enabled.
The localhost development server sends `Cache-Control: no-store`; repeat visits
reuse IndexedDB and native shader caches, but do not reproduce a CDN's warm HTTP
cache. Unrelated compiler jobs were observed on this machine. These are small
observational samples, not isolated experiments, percentiles or portable promises.

The baseline is commit `7337625`, after the previous round of repairs. The final
measurement uses the rebuilt published source routes in `dist/`. Means below use
visits two and three; the native shader caches were warm.

| App | Before: pipeline preparation | After: pipeline preparation | Before: navigation to frame | After: navigation to frame |
| --- | ---: | ---: | ---: | ---: |
| Showcase | 197 ms | 189 ms | 400 ms | 368 ms |
| Studio | 384 ms | 295 ms | 653 ms | 595 ms |
| Playground | 275 ms | 181 ms | 615 ms | 364 ms |
| Typography | 236 ms | 174 ms | 575 ms | 412 ms |

All final repeat visits hit the initial-scene cache: font decoding and scene
compilation both reported **0 ms**. Individual navigation-to-frame samples ranged
from **339 to 615 ms**. All twelve published-route visits passed correctness and
failed the 200 ms budget. Full startup still waits for all required GPU pipelines;
these changes do not introduce staged interaction readiness or a placeholder frame.

The GPU compilation probes, taken before the module-preload and application-cache
changes, completed in 8.18 s / 15.68 s / 12.48 s /
10.55 s for Showcase / Studio / Playground / Typography. Their baseline observations
were 13.35 s / 26.33 s / 19.47 s / 19.26 s. Both runs changed native code with unique
uniform guards to discourage driver cache reuse. They are **not unmodified cold
startup measurements**, and host contention prevents attributing an exact speedup.

With a synthetic 20 ms delay before each page JavaScript request, module request
start times spread across 148–236 ms without preloads and 2–3 ms with them. Request
counts stayed identical: 79 / 83 / 84 / 80 modules. This verifies removal of the
dependency-discovery waterfall; total navigation time remained variable due to
font requests and host work. The hints use the standard
[modulepreload behavior](https://html.spec.whatwg.org/multipage/links.html#link-type-modulepreload).

The [machine-readable record](startup-followup-results.json) includes provenance,
timing components, cache outcomes, compilation probes, module-discovery evidence,
native checks and the explicit failed latency budget.

## Validation

- **1,028 host tests pass**, including numeric glyph order/advances, preload closure
  and origin guards, startup font overlap, and public-only cache opt-in behavior.
- All **11 native GPU gates pass**, including editor/designer transactions,
  typography, template state, rendering quality and frame synchronization.
- All rebuilt published routes and standalone apps pass browser correctness,
  actual DOM typing and Playground Run checks, with zero additional idle readbacks.
- Static checks and exact standalone/build embedding checks pass.

The published site has not been pushed or redeployed. Generated standalone export
content is committed separately from the implementation changes.

```sh
npm test
npm run check
npm run build
npm run check:build
npm start
# Requires optional Playwright and an installed WebGPU-capable Chrome:
npm run check:browser -- --base http://127.0.0.1:8080/dist/ --suite apps --visits 3 --startup-budget-ms 200 --output startup-budget.json
# Expected nonzero exit while the 200 ms budget remains unmet.
npm run check:browser -- --base http://127.0.0.1:8080/dist/ --suite apps --module-delay-ms 20 --output module-discovery.json
```

The remaining large cold-start cost is native compilation of shaping, input and
emission interpreters. Achieving 200 ms requires a smaller initial GPU pipeline
graph and further asset/preparation work, with real interaction readiness measured
separately from showing a shell.
