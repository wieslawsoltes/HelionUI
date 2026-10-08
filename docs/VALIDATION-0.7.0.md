# Validation — 0.7.0-experimental

**Host validation passes. Native GPU execution, final pixels and hardware frame-rate improvement remain UNVERIFIED.**

## Observed host results

- `npm test`: **386 passed, 0 failed, 0 skipped**. Tests include actual host scheduling logic with a non-executing WebGPU double, per-tail progress with real JavaScript promises, 60–240 Hz callback simulations, FIFO preservation, queue saturation, out-of-order acknowledgement delivery, lifecycle/mode changes and unchanged GPU timing arithmetic.
- `npm run check`: **66 JavaScript modules, 14 WGSL sources, 33 core compute entries, 202 showcase nodes**. These are source/lexical/resource checks, not native shader compilation.
- Build and exact standalone closure checks: **27 embedded modules, 14 exact WGSL sources, and an exact independent startup worker**; no external script/style or bundled font files.
- Strict TypeScript API check: passes with the new capacity API, stats and opportunity-log types.
- Initial-scene preservation versus 0.6.1: node (58,176 bytes), state (13,184 bytes) and heap (54,960,608 bytes) are byte-identical with the same three private DejaVu faces. The full scene remains 65,536 rows, 202 nodes and eight animations. Font assets are not distributed.
- All 13 shader files except the one HUD-caption change in `hud.wgsl` are byte-identical to 0.6.1. No GPU buffer or pipeline is added. Normal uploads remain 64 bytes plus 32 per command.

The deterministic queue-model report uses assumed service and notification durations. It proves tested scheduling properties under those assumptions, not native FPS, GPU busy time, scanout or input-to-photon latency.

## Native attempts in this authoring environment

Chromium navigation to `http://127.0.0.1:8080/tests/pacing.html` failed before loading:

```
net::ERR_BLOCKED_BY_ADMINISTRATOR
```

The optional `webgpu@0.6.1` native package lookup failed with `EAI_AGAIN` while resolving `registry.npmjs.org`. No native pipeline or WGSL pass is represented as validated by that attempt.

The supplied native comparison is at **`/tests/pacing.html`**. It retains one mounted surface for paced/unbounded/paced arms, with full real-font and small-fixture options. It logs real callback/submission counts and deferrals; GPU inspection is outside measured phases. Existing `/tests/gpu.html`, `/tests/text.html`, `/tests/hud.html`, `/tests/frame-sync.html` and `/tests/metrics.html` remain available.

## Limits

The new default bounds unacknowledged application frames. It cannot force missing browser callbacks, make an overloaded GPU finish within the display budget, measure physical scanout, or remove all notification latency. Per-submission progress signals have overhead. Native comparison on the target configuration is required before claiming fewer displayed drops or improved latency.

Previous validation records remain archived, including [0.6.1](VALIDATION-0.6.1.md). Their test counts and startup/CPU measurements are not results for this release.

[Machine-readable validation](pacing-validation.json) · [Preservation](pacing-preservation.json) · [Queue model](pacing-queue-model.json)
