# Validation — 0.6.1-experimental

## Observed checks

**352 host tests pass, zero failures and zero skipped.** Static checks pass for 61 JavaScript modules, 14 WGSL source files, 33 core compute entries and 202 showcase nodes. Strict TypeScript API checking passes. Both builds and exact standalone closure checks pass: 26 embedded JavaScript modules, 14 exact shader sources and the unchanged startup-worker source.

These tests do not execute WGSL. The new tests cover independent partition ownership/collision/capacity/randomized frames, current-frame eviction protection, dispatch ordering, deferred diagnostic startup without frame admission changes, disposal/visibility behavior, no-timestamp mode, normal transfer size and reachable HUD auto-layout resources. Existing UI/text/layout/query/metric host checks remain.

[Machine-readable current record](recovery-validation.json). Historical validation files in this directory describe their own releases, not additional native results for this one.

## Preservation and input evidence

[Preservation](recovery-preservation.json): all complete initial node/state/heap arrays match 0.6.0 with three privately loaded DejaVu Sans faces. The same declaration contains 65,536 rows, 202 views and eight animations. Eighteen protected compiler/font/startup/layout/data/flatten source files match, as do four exact glyph coordinate/coverage helper bodies. No font bytes or extracted third-party outlines are distributed. This is initial binary/source evidence, not GPU pixel equality.

[Latest supplied trace](recovery-trace-analysis.json): 575 callbacks over 8.970329 seconds, median CPU callback 0.096 ms, p95 callback interval 41.2607 ms. The recording does not contain startup font/pipeline events or the app's resolved GPU queries. It is not a test of 0.6.1.

## Native checks did not run

Chromium navigation to the current `/tests/frame-sync.html?autorun` fails before page loading with `ERR_BLOCKED_BY_ADMINISTRATOR`. The optional official Dawn Node binding is unavailable; `npm run check:native` reports that native validation did not run. No browser policy was bypassed. **Native WGSL compilation/execution, final pixels, browser first-frame/total startup improvement and sustained FPS remain unverified.**

The executable native gates remain provided: `/tests/text.html` for real-outline cached/direct reference behavior; `/tests/frame-sync.html` for grid/damage/timing/HUD pixel comparisons; `/tests/hud.html` for HUD masks/placement; `/tests/metrics.html` for raw timestamp arithmetic; `/tests/gpu.html` for controls/layout/query. Test-only readbacks do not become part of normal rendering.

`/tests/startup.html` now distinguishes first application-frame acknowledgement, HUD pipeline readiness and first HUD-containing frame acknowledgement. It awaits optional diagnostics before measuring steady-state phases. Off/frame/stages provide an instrumentation comparison with unchanged UI quality. `/tests/performance.html` remains a serialized rendering A/B, not a vsync test. No measured FPS or startup multiplier is asserted.

See [RECOVERY.md](RECOVERY.md) for the changes, ownership/collision tradeoff, deferred-overlay behavior and unchanged default submission policy.
