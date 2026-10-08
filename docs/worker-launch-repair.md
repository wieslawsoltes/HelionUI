# Helion UI 0.12.3 — timer receivers, workers, and launch origins

## Repair scope

This release repairs the 0.12.2 source archive. It preserves all 25 WGSL files,
font preparation/coverage, initial scenes, buffer formats, and the paced frame
producer. It does not lower quality, move visual rendering to the CPU, disable
browser origin checks, or claim to fix every native-driver hang.

### ProgressWatchdog: the reported Illegal invocation

The old constructor assigned the browser's `setTimeout` and `clearTimeout`
functions directly to instance fields. Calling `this.schedule(...)` then passed
a ProgressWatchdog object as the native timer's receiver. Chromium rejects that
receiver. The failure occurred while tracking an already submitted frame, not
while compiling a shader.

The defaults now use lexical wrappers:

```js
schedule = (callback, delay) => globalThis.setTimeout(callback, delay)
cancel = handle => globalThis.clearTimeout(handle)
```

Both timer APIs keep their Window/Worker global receiver. Existing injectable
test callbacks, timeout settings, stall behavior, and completion serial accounting
are unchanged. No GPU buffer mapping or additional frame submissions are added.
The original class reproduced `TypeError: Illegal invocation` in Chromium 144;
the fixed, built class passed native arm/cancel/suspend/resume/stall checks.

### Standalone preparation worker

The embedded preparation bundle is already self-contained: it contains no ES
imports, document import-map aliases, or font binaries. It now runs as a
**classic Blob worker**, rather than a module Blob worker. The browser obtains
the top-level script from a locally created object URL, without an HTTP redirect
or a module-entry resolution relative to a data URL. An isolated Chromium probe
rejected the old module route and accepted the classic route. This is not proof
that every browser/deployment error has the same cause.

Unbundled source hosting still uses a **same-origin module worker**, so relative
module imports continue to resolve normally. A cross-origin source entry or a
missing embedded bundle is detected before attempting the inappropriate Worker
constructor. Existing host-preparation fallback remains explicit in startup
statistics for worker/CSP/load failures; actual compiler/font failures after
worker readiness remain errors rather than silently becoming placeholder text.

Readiness/result messages are accepted once. Abort, load failure, optional-cache
completion and timeout all use idempotent cleanup. Object URLs are revoked after
readiness or failure; cancellation still terminates optional cache work after a
scene has been delivered. This changes host startup/lifecycle code only.

### Direct file opening

A standalone HTML file is a single-file **distribution**, not permission to
bypass file-origin restrictions. All three standalone apps, source app pages,
and exported application templates now check `file:`/`data:` origins before
importing the application. They display readable local-server instructions
instead of attempting workers, font downloads, or GPU startup. Library mount
also rejects these unsupported launch origins before allocating GPU resources.

No `--disable-web-security`, file-access exception, CSP relaxation, sandbox
attribute change, or insecure automatic browser redirection is used in the apps.
The authoring sandbox source is byte-identical to 0.12.2.

## Launch

Extract the entire package. With Python 3 installed, run the included launcher:

- macOS: `sh ./start-helion.command` (or open the command file when executable).
- Windows: `start-helion.cmd`.
- Linux: `sh ./start-helion.sh`.

The launcher binds only `127.0.0.1`, prints the three app addresses and opens
Studio in the normal default browser. It serves from its own package directory,
including paths containing spaces. Keep the terminal open. `--port 8081` selects
another port. The Python server sends JavaScript module MIME types and no-store
headers and refuses resolved paths outside the package. It is a development
server, not a production hosting/security product. Only the Linux shell/Python
server was executed in the authoring environment; macOS/Windows launcher behavior
has not been independently exercised on those operating systems.

Manual standalone launch:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `/helion-designer.html`, `/helion-playground.html`, or
`/helion-standalone.html` on that localhost server. For a source checkout, use
`npm start` and open `/designer/`, `/playground/`, or `/`.

Fonts remain runtime/local assets. No font files or third-party extracted glyph
outlines are included in any package. Use complete replacement files rather than
mixing modules or HTML from different versions. Existing initial-scene cache
compatibility is retained; clearing it is not required for this host-code fix.

## Validation and exact limits of the evidence

**839 host tests pass**, zero failures/skips (805 baseline + 34 regression tests).
Static and strict TypeScript checks pass. Build checks compare 78 embedded modules,
all 25 shader sources, both workers, four guarded bootstrap routes, and the nested
app-export template to source. Five initial scenes and all shader bytes match
0.12.2 in the preservation audit. Native GPU execution is not inferred from these
host or source comparisons.

The isolated Chromium 144 checks execute the actual built import-map modules:

- Default native watchdog timers arm, cancel, suspend/resume and fire once.
- A real classic Blob worker returns node/state/heap arrays identical to host
  compilation of an original diagnostic-font scene (864/448/143,468 bytes).
- Cancellation of a real embedded worker rejects without a successful fallback.

The shipped file-launch guards were also executed with real browser DOM and a
synthetic file location. This is a guard test, not an actual `file:` application
launch. The baseline watchdog reproducer throws the exact reported exception.

The served browser gate was **blocked before navigation by
ERR_BLOCKED_BY_ADMINISTRATOR**. The blank-document context does not expose
`crypto.randomUUID`, so secure-context authoring-sandbox integration is marked
unverified, not passed. No same-origin policy workaround or UUID replacement was
used. Source HTTP module-worker integration, complete app startup, rendering,
clipboard/IME, and hardware speed/hang resolution remain unverified. The
container's headless Chromium launch uses `--no-sandbox`; these tests do not
qualify OS-process sandbox security. The applications' CSP/origin behavior was
not relaxed.

Fresh extraction into a directory containing spaces exposed two existing test-
harness path bugs (`URL.pathname` used as a filesystem path). Both harnesses now
use `fileURLToPath`, so package verification also covers paths such as `Helion UI`.
This does not change runtime rendering or worker algorithms.

Reports: `browser-fix-validation.json`, `browser-fix-browser.json`,
`browser-fix-preservation.json`, and `browser-fix-logs/`.

To run the host-only browser gate with no GPU/font download:

```sh
npm run build
npm start
# http://127.0.0.1:8080/dist/tests/host-startup.html?autorun
```

For the prebuilt site, open `/tests/host-startup.html?autorun`. The independent
native shader and designer gates remain at `/tests/shaders.html` and
`/tests/designer.html`. Optional `tools/check-browser-host.py` requires Playwright
and an installed Chromium path; it exits nonzero while the served gate remains
unverified, even when isolated checks pass. Historical release reports elsewhere
in the archive are not current GPU verification.

## Platform specifications

Timer receiver and worker-constructor semantics were checked against WHATWG HTML:
https://html.spec.whatwg.org/multipage/timers-and-user-prompts.html#timers
https://html.spec.whatwg.org/multipage/workers.html#worker-processing-model

File-origin limitations are documented by MDN:
https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy

These references describe platform behavior; the local reports describe what was
actually tested for this release.
