# GPU frame pacing and startup — 2026-11-06

Studio now skips raster-job construction for unchanged frames using a GPU-resident
damage rectangle. This removes a measured 10.7 ms idle-frame bottleneck without
changing the two-frame admission limit, visual quality, or ownership of UI state.
**The 200 ms navigation-to-completed-frame startup target remains unmet.**

## Changes

- `eb46000`: reduce dirty tile bounds in GPU scratch words 50–53. The GPU writes a
  zero indirect job-dispatch count for clean frames and restricts scans to dirty
  bounds for changed frames. Per-tile damage remains exact. Full invalidation,
  resize and overflow recovery initialize the rectangle to the full viewport.
- `dddcbd0`: share compatible native binding/pipeline layouts and surface bind
  groups. The complete 85-entry ABI has 27 distinct binding sets. Caches are local
  to device preparation and each surface rebuild; resized textures, alternating
  display lists and embedded surfaces retain their own resources.
- `849842e`: add `npm run check:frames` for host scheduling measurements, optional
  Chrome traces and explicit post-capture GPU diagnostics. The runner never maps
  GPU state during the measured frame loop.

## Frame measurements

Headed Chrome 156.0.8078.80 on Apple metal-3, approximately 120 delivered rAF
callbacks/second. Baseline: `3e840c8`. The published Studio runtime matched that
baseline byte-for-byte when inspected. Each capture lasted approximately six
seconds; these are single-machine observations, not cross-device guarantees.

The wide viewport was 1280 × 900 CSS pixels, with an observed native backing size
of 2560 × 1800. Browser emulation requested DPR 1, but the actual device-pixel box
was DPR 2; the record reports both. Narrow captures used 560 × 950 at DPR 2.

| Measurement | Before | After |
| --- | ---: | ---: |
| Wide idle, stage timing: submitted frames | 341 | 725 |
| Wide idle, stage timing: capacity deferrals | 381 | 0 |
| GPU elapsed frame span, median recent history | 14.61 ms | 4.13 ms |
| Sparse raster elapsed range, median recent history | 10.75 ms | 0.066 ms |
| Narrow pointer motion, production timing off: submitted frames | 656 | 722 |
| Narrow pointer motion: capacity deferrals | 69 | 0 |
| Runtime readback bytes during every capture | 0 | 0 |

An isolated per-dispatch diagnostic identified `buildJobs` at 10.75 ms on a clean
frame. It scanned every primitive's bounds to discover no dirty tiles. GPU state
confirmed zero jobs, zero dirty tiles and no overflow. This is distinct from the
CPU encoder, whose median was approximately 0.1–0.2 ms.

Separate wide Chrome traces with frame timing enabled recorded 348 → 729
`CommitPresentedFrameToCA` events and 7 → 2 `DroppedFrame` events. The final narrow
pointer trace recorded 724 presentation commits, zero `DroppedFrame` events and
one `Scheduler::BeginFrameDropped` event. These event names have different scopes;
we do not claim universally drop-free presentation. Capacity deferrals are host
backpressure observations, **not compositor dropped-frame counts**. GPU elapsed
ranges can overlap and include waits; they are not exclusive GPU busy time.

## Startup

The layout reuse reduces native object creation. Source-route reload observations
improved for three apps, but Typography was slower in the initial batch; timings
are noisy and do not justify claiming a universal startup speedup. An alternating
Typography follow-up measured 321–326 ms before and 289–320 ms after on three
cache-hit visits each, so the initial slowdown did not reproduce. Full GPU
pipeline preparation still gates interaction readiness.

Final rebuilt published-source routes, visits two and three with warm native
shader/IndexedDB caches on the localhost `no-store` server:

| App | Navigation to first completed full-quality frame |
| --- | ---: |
| Showcase | 251–277 ms |
| Studio | 419–469 ms |
| Playground | 319–348 ms |
| Typography | 339–340 ms |

All twelve published-route visits passed correctness and failed the explicit
200 ms budget. A first visit also includes fonts/scene preparation. No placeholder
frame is counted as ready. These measurements do not reproduce cold-driver or
CDN-cache behavior. The remaining startup costs include module loading, native
pipeline preparation, upload and initial rendering.

## Validation and reproduction

1,029 host tests, static checks, exact build/standalone embedding, all 11 native
GPU gates, all four source apps and all four standalone apps passed. Native frame
checks now compare retained/full pixels after every scroll, selection, filter,
visibility, translation and opacity scenario. A clean frame explicitly verifies
zero indirect job workgroups, zero raster jobs and unchanged output pixels.

The [machine-readable evidence](frame-pacing-results.json) includes all captures,
startup visits, actual allocations, trace-event counts and gate results. Changes
are committed locally; this round does not publish or deploy the site.

```sh
npm test
npm run check
npm run build
npm run check:build
npm start
# Optional Playwright plus an installed WebGPU-capable Chrome required:
npm run check:frames -- --path designer/ --seconds 6 --timing stages --output frames.json
npm run check:frames -- --width 560 --height 950 --dpr 2 --pointer --timing off --trace --output pointer.json
npm run check:browser -- --base http://127.0.0.1:8080/dist/ --suite apps --visits 3 --startup-budget-ms 200 --output startup.json
# The startup budget command still exits nonzero, independently of correctness.
```
