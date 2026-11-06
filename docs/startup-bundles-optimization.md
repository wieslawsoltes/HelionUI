# Published startup and retained Studio text — 2026-11-06

Published apps now load 3–4 JavaScript modules instead of roughly 80, and use the
existing self-contained startup worker. Shader preparation shares its parsed graph
and memoizes resource closures. Studio retains static labels in GPU OpenType runs.
**Sub-200 ms startup and universally zero missed frames are not achieved.**

## Committed changes

| Commit | Change |
| --- | --- |
| `9732503` | Share parsed shader declarations between partitioning and binding discovery; memoize transitive resource masks; mask comments by slices instead of character-by-character concatenation. |
| `b6d1491` | Launch published pages with the self-contained worker, preserving same-origin/file-origin checks and the source-worker fallback. Expose `workerReadyMs`. |
| `271a1e5` | Opt Studio into retained OpenType runs for static Latin labels too, removing repeated glyph mapping/kerning from frame emission. |
| `3a065f7` | Bundle published apps into shared, hashed modules with exact generated preloads. Preserve original shader/worker/authoring URLs beneath repository subpaths. Fix the serialized Playground bootstrap to receive its dependency explicitly. |
| `0dacce9` | Regenerate the independently runnable standalone export. |

[esbuild](https://esbuild.github.io/api/#splitting) is pinned at 0.28.2 as a build/test
dependency, with a lockfile and `npm ci` in Pages CI. There is no runtime npm
dependency. Source routes remain runnable without building; standalone apps retain
their exact embedded source graph. Published source maps are emitted separately.
The native compilation stress probe requires the unbundled source server and now
rejects published bundles explicitly instead of silently missing instrumentation.

## Observed costs

A nine-sample alternating Node benchmark of partitioning plus all 85 resource
closures measured a median **61.1 → 29.8 ms**. Every generated shader and resource
binding list matched exactly. This measures host preparation, not total browser
startup or native GPU compilation.

An alternating Studio worker experiment measured median ready notifications of
56.5 ms with the source module worker and 43.0 ms with the published classic
bundle. Total navigation did not improve reliably in that comparison. The worker
loads fewer dependencies; unrelated main-thread/native work still gates readiness.

Studio's static retained run count grew from 96 to 280. Initial upload increased
from 69,550,888 to 74,246,632 bytes, approximately **4.7 MB extra**. Glyph positions,
shaping results and mutable text remain GPU-owned. The existing full OpenType
engine is used for these labels; this is not a CPU text cache.

The final stage-timed Studio capture measured a median GPU elapsed frame span of
**3.24 ms**, versus approximately 4.13 ms in the previous round. Scene emission was
2.16 ms. These are elapsed ranges, potentially including overlap/waits, not GPU
exclusive busy time. No timing result justifies reducing native resolution or
relaxing the two-frame admission limit; neither was changed.

## Frame pacing

The final wide Retina pointer-motion capture lasted 20 seconds:

- 2,402 submitted and completed frames; 2,403 rAF callbacks.
- Zero Chrome `DroppedFrame` markers and zero long rAF gaps by the runner's metric.
- One capacity deferral, with no input loss or runtime GPU readback.
- One `Scheduler::BeginFrameDropped` marker, 83.916 ms after the final rAF callback,
  following the runner stop. This is reported separately from application drops.

The corresponding baseline also recorded zero Chrome `DroppedFrame` markers.
Misses are intermittent, so this does **not** establish that every missed-frame
condition has been eliminated. The measured GPU reduction adds frame-budget
headroom. Both the final production-timing capture and the stage-timing capture
had zero normal-loop readback bytes and no GPU arena overflow.

## Startup target

Final published routes, warm native-cache/IndexedDB reloads (visits 2 and 3):

| App | Navigation to first completed full-quality frame |
| --- | ---: |
| Showcase | 249–310 ms |
| Studio | 562–647 ms |
| Playground | 299–304 ms |
| Typography | 341–354 ms |

All twelve published visits passed correctness and failed the explicit 200 ms
budget. First visits, with initial-scene cache misses, measured approximately
453–970 ms, but native driver caches were already warm; these are not cold-driver
measurements. Other compiler jobs and a busy Chrome renderer were observed during
this round. Sequential browser runs reduce our own interference, but these results
cannot isolate a universal startup speedup or be compared directly with earlier
quiet-machine minima. The localhost server also uses `Cache-Control: no-store`.

Larger pipeline batches (16/32 versus 8) did not improve Studio. Synchronous
compute-pipeline creation was slower in the tested Showcase comparison. Both
experiments were discarded; production retains bounded asynchronous compilation.

## Validation

- **1,033 host tests pass**, plus static checks for 202 JS modules, 31 WGSL sources
  and 85 compute entries.
- All **11 native GPU gates pass**.
- All four source apps, all four standalone apps and all published-route visits
  pass browser correctness, including actual typing and Playground Run.
- Generated published JS/source maps match current sources exactly. Their preload
  closure, repository-subpath asset URLs and minified sandbox serialization are
  checked. Standalone source/shader/worker embedding checks pass.
- A standalone TypeScript check was not rerun because `tsc` was unavailable.

The [machine-readable evidence](startup-bundles-results.json) records all final
samples and the rejected scheduling experiments. Changes are local commits; this
round does not push or deploy the published site.

```sh
npm ci
npm test
npm run check
npm run build
npm run check:build
npm start
# Optional Playwright and installed WebGPU-capable Chrome:
npm run check:browser -- --base http://127.0.0.1:8080/dist/ --suite apps --visits 3 --startup-budget-ms 200 --output startup.json
npm run check:frames -- --base http://127.0.0.1:8080/dist/ --seconds 20 --pointer --timing off --trace --output frames.json
# The startup-budget command still exits nonzero; correctness is reported separately.
```
