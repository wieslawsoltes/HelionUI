# Helion UI

**A retained, compute-driven UI framework in plain JavaScript and WGSL.**

`0.15.0-experimental` · MIT · no runtime npm dependencies · no CPU visual fallback

JavaScript or inert HTML views compile into retained buffers. Compute shaders execute control state, logical Measure/Arrange, models, editor operations, DataGrid queries, composition, text/vector coverage and pixel compositing. The browser supplies source preparation, operating-system input/services, frame scheduling and final presentation.

Browser startup repair: large input, shaping and designer compiler graphs now use
bounded GPU stages. Retina backing pixels and shader scale agree. See the
[pipeline audit and hardware results](docs/browser-pipeline-repair.md) and run
`npm run check:browser` with optional Playwright and an installed WebGPU Chrome.
The latest [published startup and retained-text improvements](docs/startup-bundles-optimization.md)
reduce module requests and repeated preparation; the 200 ms navigation-to-frame target remains unmet.
The earlier [GPU frame-pacing fix](docs/frame-pacing-optimization.md) removes clean-frame raster scans.
Earlier [startup reductions](docs/startup-followup.md) remain documented.

## 0.15: retained shaping and paragraph layout

TextBox/native template content, shaped labels, DrawingContext text, Studio's
mutable slots and opt-in DataGrid visible rows now share GPU-resident shaping
results. The reusable `@helion/typography` module exposes glyph/cluster/line/caret
buffers with no UI runtime or frame scheduler. It has no CPU shaper fallback.

Run the new **Typography Lab** at `/typography/`, or `helion-typography.html` in
the standalone package. Fonts load at runtime or from local selections, never
from embedded font binaries. All previous applications remain included.

See [the typography contract](docs/TYPOGRAPHY.md), [validation](docs/typography-validation.json)
and [differential samples](docs/typography-differential.json). Native GPU checks
are now recorded in the [browser repair audit](docs/browser-pipeline-repair.md).
Full complex-script/Unicode/editor
parity and variable/color fonts are not claimed. The code editor still uses fixed
cells; its grapheme operations improved, not its entire bidi layout engine.

## 0.14: refined retained templates and themes

Original Fluent/macOS-inspired themes now have explicit high-contrast variants,
compact metrics, custom accents, and semantic disabled states. Separate focus
rings preserve content geometry; checked toggles keep a readable accent foreground.
Accent/Subtle/Destructive Button helpers share the existing native owner behavior.
Visual-state selections are cached once per group/stage; outgoing transitions and
reduced-motion retargeting retain their state definitions. All live work stays in
the existing compute graph, without normal template/palette readback.

Studio adds undoable contrast, density, accent and motion settings plus transient
visual-state previews. Its JSON/visual-part catalog workflows remain. Playground
includes an editable Theme Lab alongside the eleven earlier examples.

Host/source/type/bundle and actual isolated browser-worker checks are recorded in
[Current validation](docs/VALIDATION.md). Native GPU acceptance and pixel checks
have since passed on the adapter recorded in the browser repair audit; full browser
coverage and portable performance are not claimed. These are
original themes, not native OS rendering, complete accessibility or full framework
parity. No font assets or CPU renderer are included.
[Refinement/API/cost guide](docs/THEME-REFINEMENT.md) ·
[Base template API and workflow](docs/TEMPLATES.md) ·
[Preservation audit](docs/theme-refinement-preservation.json)

## Preserved 0.12.3: native timer and standalone-worker repair

The progress watchdog now calls browser timers with their global receiver. The
self-contained embedded startup worker uses a classic Blob script rather than a
module-worker entry; source hosting keeps a same-origin module worker. Standalone
and source application pages check file/data origins **before importing any app
module** and show local-server instructions instead of attempting blocked startup.

Use `start-helion.command` (macOS), `start-helion.cmd` (Windows), or
`start-helion.sh` (Linux), with Python 3 installed. The launcher serves only
127.0.0.1 and opens Studio. Or run `npm start` in this source checkout. Do not
open the HTML files directly from Finder/Explorer. Font assets remain external.

See [the repair notes](docs/worker-launch-repair.md) and the native host-only
regression gate at `/dist/tests/host-startup.html` after `npm run build`.
Full application/GPU qualification is separate from these timer/worker tests.

## 0.12.2: startup and designer stall repair

Studio now overlaps font-worker preparation with GPU setup, enables its public
starter's initial-scene cache, compiles reachable shader groups, and omits eight
unused DataGrid pipelines. Shortcut routers use one call site into their large
command handlers. Hidden editors retain dirty layout until visible; ruler loops
have explicit bounds. The standalone export template is losslessly compressed
and expanded on Export, not parsed eagerly on startup.

Preparation/cancellation deadlines and a host GPU-progress watchdog report
stalls and stop further production. These do not preempt a blocked native driver
or prove resolution of every Chrome hang. Native verification remains unavailable.
[Repairs, costs and evidence](docs/STARTUP-REPAIR.md) ·
[Current validation](docs/VALIDATION.md).

## Previous 0.12.1: shader-startup repair

Seven mixed `&&` / `||` expressions in the designer shader now use explicit WGSL
grouping. Error/build labels use the current release instead of hard-coded 0.7.0.
The source check, scalar test adapter, and bundled-shader check catch this syntax
before delivery. [Repair and verification](docs/SHADER-REPAIR.md).
Use `/tests/shaders.html` for the new no-font native compilation/pipeline check.
Native compiler acceptance and rendered pixels remain unverified here.

## New in 0.12: Helion Studio visual designer

Open **`/designer/`** for a Helion-authored, compute-driven workspace with Assets,
Objects, an interactive artboard, property inspector, solid brushes/resources,
visual states, Grid editing, timeline/keyframes, project JSON and source export.
The authored objects are real Helion controls. GPU-owned selection, transformations,
topology and bounded undo/redo do not rebuild a DOM design tree on pointer moves.

The project includes three editable samples, a standalone designer and an embedded
standalone-app exporter. Use Designer in the playground/showcase to open it.
The application is Blend-inspired, **not feature-complete Microsoft Blend parity**.

**The historical 0.12 designer release did not have native GPU qualification.**
The current browser repair includes actual designer GPU execution and pixel tests.
[Designer API, ownership, costs and limits](docs/DESIGNER.md) ·
[Current validation](docs/VALIDATION.md) · [Preservation](docs/designer-preservation.json)

The existing sharp font coverage/native pixels, GPU playground, editors, docking,
models, mutable DataGrid and embedded app preview remain.
[Text quality](docs/TEXT-QUALITY.md) · [Dynamic workspace](docs/DYNAMIC-WORKSPACE.md)

## Run

```sh
npm start
```

Node.js 20 or newer. No runtime `npm install` is required. Open:

```text
http://127.0.0.1:8080/designer/
http://127.0.0.1:8080/playground/
```

The original showcase is at the server root. Serve on localhost or HTTPS in a permitted WebGPU browser. A GPU/font error produces a bootstrap error notice, not a hidden CPU renderer.

The playground has eleven editable examples, a GPU docking workspace, six editors, a virtualized Explorer/example picker, a live keyed dataset and embedded preview. Ctrl/Cmd+Enter runs, Ctrl/Cmd+S saves, Ctrl/Cmd+O opens, and Ctrl/Cmd+Alt+F opens the local-font picker. Auto-run, ASAP and the performance overlay are off by default. GPU timestamp collection starts off and can be enabled from settings.

## Use a live DataGrid

```js
import {h, dataSource, HelionSurface} from './src/index.js';

const source = dataSource({
  key: 'id', capacity: 4096,
  columns: [
    {field: 'name', type: 'text', width: 240},
    {field: 'value', type: 'number', editable: true},
    {field: 'enabled', type: 'boolean', editable: true}
  ],
  rows: [{id: 1, name: 'Alpha', value: 12.5, enabled: true}]
});
const view = h('Grid', {rows: '40 *'},
  h('TextBox', {id: 'filter'}),
  h('DataGrid', {id: 'records', row: 1, ItemsSource: source, filter: 'filter'}));
const surface = await HelionSurface.mount(canvas, view);
const table = surface.dataSource('records');
table.patch(1, {value: 25});
table.upsert({id: 2, name: 'Beta', value: 9, enabled: false});
table.sort('name', 'ascending').select(2);
// Explicit readback only when application export/integration needs the data:
const snapshot = await table.snapshot();
```

Rows use unique u32 keys, safe field paths and an explicit bounded schema. Capacity is at most 65,536 rows and eight columns, with one DataGrid per surface. Initial arrays are not automatically observed CPU mirrors. `replace` preflights capacity before clearing; ordinary batches commit in order rather than rolling back every operation. GPU rejection results and revisions are available through an explicit snapshot. [Complete contract](docs/DYNAMIC-WORKSPACE.md#1-mutable-datagrid-itemssource).

## Dynamic playground source

Source is a JavaScript function body with `Helion`, `app`, `set` and `console`. Return a view or call `app(view)`:

```js
const {h, hostAction} = Helion;
let count = 0;
app.onAction(event => {
  if (event.name === 'increment') app.text('label', `Count ${++count}`);
});
return h('StackPanel', {padding: 24, gap: 12},
  h('TextBlock', {id: 'label', text: 'Count 0', textCapacity: 128}),
  h('Button', {text: 'Increment', action: hostAction('increment')}));
```

JavaScript remains in a stoppable, network-disabled worker inside an opaque-origin iframe. It does not move into WGSL. GPU model expressions can run wholly on-device. The sandbox is not certified hostile-code/multi-tenant isolation; no arbitrary ESM/npm/DOM program hosting, semantic language service or resource-security certification is claimed.

## Reusable modules

ESM entries and TypeScript declarations are supplied for core, protocol, text, layout, styling, drawing, composition, editor, docking, models, **data**, **controls**, **designer** and **templates**. They share the retained compiler/runtime and are not separately published npm packages.

The 0.8 layout/drawing/style APIs and 0.9 multicaret editor, snippets, folding, docking and numeric model APIs remain. See [FRAMEWORK.md](docs/FRAMEWORK.md), [EDITOR-WORKBENCH.md](docs/EDITOR-WORKBENCH.md) and the current [supplement](docs/DYNAMIC-WORKSPACE.md). Native framework overloads, complete Unicode/bidi/IME/accessibility, full semantic IDE systems, unrestricted dynamic allocation and native floating windows are outside this experimental subset.

## Font and performance boundaries

The showcase uses real Noto Sans Regular/SemiBold/Italic; the playground uses Noto Sans Mono Regular. Fonts are runtime network/local inputs. **No font binary, data URL or repackaged third-party outlines are distributed.** Ctrl/Cmd+Alt+F selects local static fonts. TrueType-outline SFNT/TTC/WOFF1 support retains the documented limits; variable fonts, CFF/CFF2, WOFF2 and full shaping remain unsupported.

The original 202-node, 65,536-row, eight-animation showcase has byte-identical initial node/state/heap buffers versus 0.9 in the private three-font comparison. Listed font, glyph-cache, pacing and timing components are unchanged; new input/layout/emission/compositing code is not claimed byte-identical. No measured FPS/startup speedup is asserted.

Normal explicit frame records are 64 bytes per active retained surface: **128 bytes for workspace plus preview**, plus 32-byte commands and explicit bulk payloads. GPU-only interactions do not poll controls. Host-bound actions use input-triggered 12,496-byte outbox snapshots, and Run/save/clipboard use explicit document snapshots. This is deliberately not described as zero-readback for every interaction. [Transfers and timing](docs/DYNAMIC-WORKSPACE.md#5-dynamic-app-and-platform-commands).

## Build and validate

```sh
npm ci # install the pinned build/test tooling (no runtime npm dependencies)
npm test
npm run check
# Optional developer TypeScript compiler:
tsc --strict --noEmit --target es2022 --module nodenext \
  --moduleResolution nodenext --lib es2023,dom tests/api-types.ts tests/designer-api.ts tests/templates-api.ts
npm run build
npm run check:build
```

`dist/` contains the static site and `helion-designer.html`, `helion-playground.html`, and `helion-standalone.html`. All three HTML files embed code, styles, shaders and workers, but not fonts. Keep them together for navigation. `playground/authoring.bundle.js` is generated and included so the source package runs without building first.

`tests/dynamic.html` is the new native gate for data mutations/compaction, lists/labels, embedded GPU input and Fit layout. Existing editor/framework/text/UI/HUD/metrics/pacing gates remain. They intentionally synchronize/read back for correctness, not sustained performance measurement. The optional `npm run check:native` uses Dawn's null backend for compiler/interface checks only. Current native checks did not run successfully; see [VALIDATION.md](docs/VALIDATION.md).

## License and delivery

MIT. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Helion is independent and is not affiliated with Microsoft, Avalonia, Vello or Linebender. No upstream UI/editor runtime is linked.

The connected GitHub search did not identify a Helion repository. This delivery contains source/site/standalone packages; no repository was created or pushed. Historical release notes and benchmark results retained under `docs/` are not measurements of 0.13.
