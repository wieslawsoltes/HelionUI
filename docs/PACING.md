# Refresh-aligned bounded submission — 0.7.0-experimental

## Scope and observed status

This release changes the actual host submission scheduler. The preceding 0.6.1 default admitted an unlimited number of complete frames. Its optional bounded path requested only one completion checkpoint at a time, registering a newer tail after an older callback arrived. Neither behavior is the new default.

The new default is **rAF-driven, at most two unacknowledged application frames, with independently registered per-frame completion notifications**. This is an implementation of bounded frame production, not evidence that the user's compositor stops dropping frames or that a particular GPU can sustain 120 Hz. Native execution, final pixels, end-to-end latency and hardware FPS remain unverified in this environment. See [the validation record](VALIDATION.md).

No new source trace was attached to this scheduling request. The supplied screenshot is an observation of the earlier build; it cannot measure this release or independently establish GPU busy time.

## What actually changes

1. **A single rAF producer.** One persistent callback is armed before encoding. Vsync mode never draws from a completion callback, a timer, MessageChannel, a microtask catch-up loop, or a guessed monitor deadline. A duplicate/backward rAF timestamp cannot generate a second frame. A numeric callback handle of zero is treated as a valid handle; `null` is the absence sentinel.
2. **Bound admission before side effects.** With the default limit of two, a full pipeline refuses the render before draining commands, resizing, acquiring a canvas texture, encoding GPU work or writing uniforms. It leaves one redraw intent and the ordered command FIFO available for a later rAF. There is no queue of saved per-rAF command buffers or obsolete animation clocks to replay.
3. **Independent completion tracking.** Immediately after each admitted bounded submission, `QueueProgress.request()` registers a snapshot of that submitted queue tail, even while earlier snapshots remain outstanding. A callback only returns the proven completed serial prefix. Older callbacks arriving after newer ones cannot return credit twice. It does not wait for callback A to register checkpoint B.
4. **Newest input and clock.** The next admitted rAF uses its current timestamp and current FIFO packet. Existing adjacent move/wheel coalescing is retained; discrete key/text/down/up/property events remain ordered. Large command queues still use the existing 256-command packet and 8,192-command FIFO limits. Redraw opportunities may be coalesced; discrete input is not silently discarded.
5. **No catch-up bursts.** A long callback gap produces one current render, not a burst attempting to reproduce missed refreshes. Stop, hidden-page changes and disposal cancel scheduled work. A policy/mode change never pretends already queued GPU work has completed.

This differs from both the earlier unbounded default and the older, chained-checkpoint two-frame gate. Simply changing the numeric limit back to two would leave the checkpoint registration defect.

## Default policy and explicit controls

```js
const surface = await HelionSurface.mount(canvas, view, {
  submissionMode: 'vsync',
  maxFramesInFlight: 2,    // Default: bounded refresh-aligned producer
  asapFramesInFlight: 8,  // Separate opt-in throughput bound
  performanceHUD: true
});

surface.setMaxFramesInFlight(3); // More overlap; potentially more latency
surface.setMaxFramesInFlight(0); // Explicit unbounded reference, not the default
surface.setMaxFramesInFlight(2); // Restore paced vsync without remounting
surface.setSubmissionMode('asap');
surface.setSubmissionMode('vsync');
```

The **Vsync: paced / unbounded** toolbar button switches between two and zero. The **As fast as possible** toggle remains off on a fresh mount. It still uses a yielding, bounded task pump and is not a physical presentation-mode switch.

`maxFramesInFlight` accepts 0–32 and now controls vsync; `asapFramesInFlight` accepts 1–32 and controls ASAP independently. This is an intentional experimental API change: callers that previously used a positive `maxFramesInFlight` to constrain ASAP must set `asapFramesInFlight` explicitly. Existing compiled ABI-3 views remain compatible.

If unbounded mode has already accumulated work, switching to paced mode stops adding frames until the previously submitted prefix is acknowledged. Previously submitted command buffers cannot be cancelled. The transition neither drops unsent commands nor resets GPU-owned edits.

## What the bound does and does not guarantee

Two is a capacity, **not a 60 Hz cap** or a target refresh divider. When work and notifications allow it, the host admits each delivered rAF. Under overload it declines additional work instead of creating an ever-growing queue of old frames. A lower submitted count can therefore accompany a more current UI; count alone is not a success criterion.

A completion notification proves earlier application work finished; its delivery time is not a GPU timestamp or scanout. Notification delays can still make the bound conservative and can limit cadence. Registering independent checkpoints removes the avoidable chained wait but does not abolish browser callback latency. The explicit limit of three and unbounded control allow same-device comparisons. Per-submission notifications have CPU/API/driver overhead; they are not claimed to be free.

If the real GPU critical path exceeds the delivered display opportunity, scheduling alone cannot supply a genuinely new completed frame at each opportunity without reducing work. This release does not hide that by lowering DPR, reducing font quality, shrinking the dataset, displaying synthetic FPS, relabelling CPU time as GPU time, or counting an old texture redraw as a newly completed UI frame.

The bound covers Helion application-frame submissions, not browser compositor work, OS presentation buffering, or unrelated explicit inspection commands. rAF delivery remains browser-controlled. Neither a request nor a completed WebGPU queue submission is proof of physical scanout.

## Diagnostics: opportunities versus submissions

**Frame sync** now returns both the existing last-240-submission log and a separate fixed-size last-240-rAF-opportunity log. Each opportunity records callback timestamp/arrival, the admission limit, unacknowledged submissions before admission, an admitted serial when present, and one explicit outcome:

- `submitted`
- `deferred-capacity`
- `asap-observer`
- `duplicate-callback`
- `error`

`stats.rafCapacityDeferrals` is an application admission count; it is **not** labelled compositor dropped frames. `stats.duplicateRafCallbacks` counts rejected duplicate/nonmonotonic callback timestamps. Opportunity callback-interval statistics show real gaps, including callbacks that did not submit. Missing browser callbacks are not fabricated as extra log entries or given an assumed hardware refresh rate.

`inspectFrameSync()` is host-only: no GPU copy, map, fence, or control-state readback. The additional numeric opportunity ring uses **11,520 host bytes** at the default capacity, excluding JavaScript object/Promise overhead. Percentiles and object formatting run only during explicit inspection.

The HUD continues to display the existing measured submission interval, observed rAF cadence and GPU elapsed ranges. No timing units, timestamp subtraction, range union, or history smoothing are altered. Its footer says **Vsync / paced** for bounded mode and retains **Vsync / every rAF** for the explicit unbounded reference. GPU history carries the policy bit so the footer describes that previous sample, not a later host configuration.

## Residency and unchanged rendering quality

Normal explicit uploads remain **64 bytes per admitted frame plus 32 bytes per command**. Deferred attempts send zero bytes and consume zero commands. Completion signals carry no mapped control, glyph, timing or framebuffer payload. There is no normal GPU readback, CPU text rasterizer or control-state mirror.

No GPU buffers, textures, compute pipelines, render passes, shader stages, font resources, or new startup worker are added. The main UI and metrics shaders are unchanged; the only WGSL change appends one HUD caption and selects it from an existing flag word. Bit 12 (`0x1000`) of frame word 9 now records bounded-vsync provenance. Metrics schema 3 and compiled ABI 3 are unchanged. Producer/runtime/shaders should still come from the same release.

The full showcase remains **65,536 rows, 202 views, eight animations**, with unchanged font loading, repertoire, exact glyph coverage, fractional coordinates, dirty tiles, rendering resolution and startup preparation. The same three private DejaVu faces produce byte-identical node, initial-state and heap buffers compared with 0.6.1. All 13 shader files other than `hud.wgsl` are byte-identical. No font file or extracted third-party font data is distributed.

## Tests and reproducible comparisons

`npm test` exercises actual host runtime logic with a non-executing WebGPU test double: 60–240 Hz, independently delayed acknowledgements, overload before all side effects, command order, later-prefix completion, mode changes, visibility, stop/dispose, duplicate clocks and zero-valued callback IDs. Separate tests exercise the actual QueueProgress class with real JavaScript promises.

`tools/simulate-pacing.mjs` is an explicitly synthetic serial-queue model, not a GPU benchmark. It exercises the same admission/progress classes with specified 0.3 ms or 12 ms service times and specified notification delays. It demonstrates bounded queue age and removal of chained-checkpoint bubbles under those assumptions. It contains no browser compositor, GPU architecture or physical display model. Do not report its results as measured FPS or latency.

Run the normal app and `tests/pacing.html` over localhost for the native comparison. It reuses the same mounted surface across paced/unbounded/paced arms (or reversed), with identical real fonts, scene, viewport and profiling. It measures continuous scroll without awaiting each frame. GPU readbacks happen after each phase is stopped and drained. There is also a small original-fixture scheduling probe to separate a tiny workload from the full showcase. A failure, overflow, hidden tab, resize or drain timeout invalidates the run.

The native benchmark is provided but not recorded as passing here: current Chromium navigation was blocked before page loading by `ERR_BLOCKED_BY_ADMINISTRATOR`; the optional native validator package lookup failed with `EAI_AGAIN`. No device-FPS or dropped-display-frame improvement is asserted.

## Primary API references

- WHATWG HTML, animation frame callback registration/execution: https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#animation-frames
- GPUWeb, GPUQueue `submit` and `onSubmittedWorkDone` snapshot semantics: https://gpuweb.github.io/types/interfaces/GPUQueue.html

These references define platform semantics, not the result of running Helion on the user's device.
