# Dynamic data and the GPU playground — 0.10.0-experimental

## Status and scope

This release adds mutable, keyed DataGrid sources and replaces the remaining visible HTML playground controls with Helion controls. The running workspace has one canvas, one owning animation-frame producer, one WebGPU device, and one queue submission per admitted application frame. Its embedded preview uses that same encoder and queue. It is not a GPU-hosted JavaScript/browser runtime or complete framework/IDE parity.

**658 host tests pass. Native WGSL execution, final pixels, browser sandbox/clipboard/IME integration, and hardware performance remain unverified.** The current Chromium navigation to `/tests/dynamic.html?autorun` was blocked before loading by `ERR_BLOCKED_BY_ADMINISTRATOR`. The optional Dawn validator is not installed. Source, scalar-adapter, mock-device and packaging checks are recorded separately from native qualification. See [VALIDATION.md](VALIDATION.md) and [dynamic-validation.json](dynamic-validation.json).

No font file, third-party font outline data, downloaded font, CPU text raster atlas, reduced DataGrid size, or lower-quality text mode is included. Existing font sources, analytical text coverage, glyph caching, and paced-vsync admission remain. This feature release does not claim an FPS or startup-speed improvement.

## 1. Mutable DataGrid ItemsSource

```js
import {h, dataSource, HelionSurface} from './src/index.js';

const source = dataSource({
  key: 'id',
  capacity: 4096,
  stringCapacity: 131072, // u32 words, including string-length prefixes
  inboxCapacity: 131072, // u32 words per immutable ingestion packet
  columns: [
    {field: 'name', title: 'Name', type: 'text', width: 240},
    {field: 'value', title: 'Value', type: 'number', editable: true},
    {field: 'enabled', title: 'Enabled', type: 'boolean', editable: true}
  ],
  rows: [
    {id: 1, name: 'Alpha', value: 12.5, enabled: true},
    {id: 2, name: 'Beta', value: 4, enabled: false}
  ]
});
const view = h('Grid', {rows: '40 *', gap: 6},
  h('TextBox', {id: 'filter'}),
  h('DataGrid', {id: 'records', row: 1, ItemsSource: source, filter: 'filter'}));
const surface = await HelionSurface.mount(canvas, view);
const table = surface.dataSource('records');
table.patch(1, {value: 25});
table.upsert({id: 3, name: 'Gamma', value: 9, enabled: true});
table.remove(2);
table.sort('name', 'ascending').select(3);
```

`itemsSource` and `dataSource` are aliases; choose one, never both. `ItemsSource` is normalized by the existing PascalCase authoring adapter. A bare object-row array is also accepted, with `dataColumns`, `rowKey` and `rowCapacity` as optional schema controls. Without a schema, inference uses the first row's fields other than the key; more than eight inferred fields rejects rather than dropping data. Empty arrays require an explicit column schema.

Legacy `data` and generated `rowCount` scenes remain supported, but a legacy table cannot be mutated through this new controller. Supplying `data` together with `ItemsSource` rejects before allocation. Mutating the original JavaScript array after mounting does not update device memory: use the explicit controller, and do not treat the source descriptor as a live CPU mirror.

### Schema and ownership

There are 1–8 columns with `text`, `number`, `boolean`, `status` or `progress` kinds. The existing status presentation uses its Ready/Queued/Paused vocabulary; progress uses its bounded meter presentation. Numeric data is f32, not arbitrary-precision/decimal/64-bit integer storage. Text is UTF-32 with explicit length words. Display typography and ASCII-case-insensitive table filtering/collation retain the earlier text/query limitations.

Keys are unique exact u32 values from **0 through 4,294,967,294**; 4,294,967,295 is reserved. Keys are not converted to f32. Safe dotted field paths are accepted, including nested key paths. Overlapping key/column paths, duplicate columns/keys, prototype-sensitive paths, nonfinite numeric values, and unpaired UTF-16 surrogates reject at ingestion.

The GPU owns live cells, keys, slot liveness, a hash lookup, free slots, sorted identity indexes, filtering, selection, revisions, and string allocation. Host metadata stores schema and reserved addresses, not a mutable copy of current rows. Sorting/filtering/selection remain on-device and visible rows remain virtualized. A key survives sorting and a cell update. Deleting its slot clears selection before that slot can be reused by another key. Dead slots are compared by identity, never by reclaimed string contents.

### Mutations, revisions and errors

```js
table.batch([
  {type: 'patch', key: 1, row: {name: 'Updated'}},
  {type: 'remove', key: 3},
  {type: 'upsert', row: {id: 4, name: 'Delta', value: 7, enabled: false}}
], {expectedRevision: 5});

// Explicit synchronization/readback boundaries, not per-frame polling:
const snapshot = await table.snapshot();
console.log(snapshot.revision, snapshot.rows, snapshot.selectedKey);
table.replace([{id: 8, name: 'Replacement', value: 1, enabled: true}]);
table.clear();
```

`patch` changes only supplied fields and rejects a missing key. `upsert` inserts or replaces all defined columns for that key; missing values become the kind's empty/default value. `remove` of an absent key is a no-op. `sort` and `select` do not change row contents.

An expected revision guards the batch before mutation. Ordinary batches commit their operations in order; they are **not arbitrary multi-operation rollback transactions**. In contrast, `replace` is encoded as clear plus complete upserts, validated as a whole, and capacity-checked on the GPU **before clearing**. Invalid replacement row/string capacity leaves the old table intact. Successful clear and each successful write/remove advance revisions; a batch is not necessarily one revision.

Host structural/encoding failures throw before queuing. GPU rejection is asynchronous: the last result, sequence and rejection count are available in an explicit snapshot. Result codes are 0 accepted/no error, 1 malformed transaction, 2 stale revision, 3 capacity exhaustion, and 4 missing patch key. Controllers return themselves for ordered queuing; a return value is not proof that the GPU accepted a mutation.

Two fixed string pools support on-device compaction when append space runs out. A growing cell excludes its superseded value from the compaction size check. Non-growing values can reuse their storage. Compaction and row ingestion are ordered work, not an unbounded or lock-free allocator, and can have appreciable cost on large sources. No automatic heap growth, network fetch, lazy server paging, schema replacement, or arbitrary callback executes in these kernels.

Numeric editing and editable boolean toggles are connected to the new source revision/sort invalidation path. Boolean activation uses the selected column with Enter/Space or double-click. Text cells can be patched through the API; a general multiline text-cell editor and arbitrary cell templates are not added.

### Limits

Capacity is 1–65,536 rows, bounded by the surface's configured `maxRows`. Source `stringCapacity` and `inboxCapacity` are 16–4,194,304 u32 words each, independently subject to the retained heap and device limits. Every field is validated before uploading. Very large replacements may exceed the reserved packet even when their eventual cells fit; reserve a larger inbox or use ordered smaller updates. There is still **one DataGrid per retained surface**; the playground has one in its workspace and can have a second in its independently retained embedded application.

## 2. Reusable controls and live properties

The new `src/controls/` module exports `Toolbar`, `StatusBar`, `Menu`, `ToggleButton`, `Separator`, `Popup`, `Dialog`, `hostAction`, and list controllers. These are real retained declarations built from the existing panels, buttons and state system, not a browser CSS or DOM widget library.

`ListBox` and `TreeView` provide GPU selection, visible-index construction, tree expansion, label filtering through a linked TextBox, keyboard navigation, disabled-item skipping, wheel scrolling, draggable vertical scrollbars, and virtualized row emission. Items have stable integer keys and Unicode labels:

```js
const view = h('TreeView', {
  id: 'explorer', itemCapacity: 1024, itemTextCapacity: 32768,
  items: [{key: 1, label: 'Sources', children: [
    {key: 2, label: 'app.js'}, {key: 3, label: 'styles.css'}
  ]}],
  action: hostAction('open-document')
});
surface.list('explorer').replace([{key: 4, label: 'New item'}]);
surface.list('explorer').select(4);
```

Up/Down, Home/End and Page keys navigate lists; tree Left/Right collapse/expand; Enter activates. Pointer activation also emits the stable key. Replacement reuses allocated storage and preserves selection when its key remains. A tree filter matches a row's own label within currently expanded branches; it is not a recursively materialized descendant-query view.

There are at most eight lists per surface, 4,096 flattened items per list, depth 31, and 128 emitted visible rows per list. `itemTextCapacity` is bounded to 1,048,576 words. Dynamic list replacement uses one immutable, capacity-validated bulk packet. There is no unlimited item materialization or dynamic insertion of arbitrary per-item child controls.

`textCapacity` reserves mutable labels for TextBlock/Button/CheckBox/TextBox. `surface.setText(id, text)` updates the GPU string without rebuilding the node tree. Auto-size labels dirty layout; fixed-intrinsic TextBox edits only affect paint/query. The legacy TextBox uses the surface-wide `limits.textCapacity`; its `textCapacity` declaration opts into the label controller, not a replacement of that legacy capacity. Use CodeEditor/TextEditor for document-size text.

`Dialog` expands to a Modal backdrop and a centered retained content panel. The topmost visible modal constrains hit-testing and focus, restores prior focus on dismissal, and supports its declared Escape action. This is not a complete nested native-window/modal-focus stack. `Menu` is a list-based menu helper, and `Popup` a high-Z retained container; native menus, window-manager popups and arbitrary geometry masks are not claimed.

HTML authoring recognizes `ui-list-box`, `ui-tree-view`, `ui-modal` and `ui-surface-presenter`; `items`, `items-source`, `data-source` and column metadata accept JSON attributes. HTML is inert authoring syntax, not the runtime rendering/control tree.

## 3. A single-canvas GPU playground

All visible application chrome after startup uses Helion: the top toolbars, source/style/notes/data editors, tabs, pane titles, draggable splits and floating panes, Explorer tree, filtered example picker, Console, API guide, dataset viewer, model inspector, preview presets, status line, and modal settings. There is no visible DOM textarea/select/button/dialog or DOM-controlled preview splitter.

The hidden browser bridge still supplies OS file/font selection, committed IME text, clipboard, download links, the execution sandbox, time and WebGPU submission. A small HTML **pre-GPU/error notice** is retained because no usable GPU surface exists before successful initialization or after a startup failure. Browser-owned file dialogs are not custom GPU dialogs. The canvas's label is not a full accessibility semantic tree.

The workspace has six retained editors, two virtualized lists and ten docking panes. Its live dataset can be replaced from the `data.json` editor, patched/appended/deleted, filtered, sorted and snapshotted back to JSON. Console messages arrive through a bounded/coalesced host-to-GPU string update, not a DOM log. Editing, docking and the model inspector retain their 0.9 features and documented boundaries.

Ten editable examples cover the original eight workbench/framework cases plus mutable data and dynamic lists/labels. Run snapshots the two executable editor documents and executes their function-body source in the existing worker sandbox. It attaches a new preview without remounting the workspace; editor history, docking, the console and workspace table remain. Stop detaches that preview and terminates its authoring worker.

Save snapshots four user documents, docking and the live dataset. Import validates document lengths, data packets and layout topology before queuing changes. Font switching snapshots/remounts the workspace and resets undo history. Automatic execution is off by default. When enabled, revision notifications are requested only from source/style editors and debounced 900 ms; typing in another pane or the preview does not trigger a global keyboard-based rerun. Programmatic document loads do not produce source-change notifications.

## 4. Embedded SurfacePresenter

```js
const shell = h('Grid', {columns: '* *'},
  h('CodeEditor', {id: 'source', documentCapacity: 65536}),
  h('SurfacePresenter', {id: 'preview', column: 1}));
const owner = await HelionSurface.mount(canvas, shell);
const child = await owner.attachSurface('preview', h('Button', {text: 'Hello'}), {
  fonts: preparedFonts
});
owner.setPresenterSize(390, 844); // fixed phone design, aspect fitted
owner.setPresenterSize(0, 0);     // Fit, actual GPU-derived content size
owner.detachSurface();
```

A presenter borrows the owner's device and prepared pipelines but has its own retained heap, state, editor data, glyph cache, damage/display lists and output texture. Attachment is asynchronous source/font preparation plus upload/initialization; it is not structural mutation of an existing child tree. Old children are retired after submitted work is complete. A canceled/obsolete attach cannot replace the current child.

The root routes pointer positions, wheel deltas, focus, capture, keyboard and text into the child through GPU storage. Root input uses previous-frame hit geometry, consistent with the rest of Helion. The owning frame encodes its input/layout, the child's compute graph, the root scene/raster and one final canvas presentation. The child has **no second canvas, browser input instance, rAF loop, or per-frame queue submission**. One-time asset initialization and explicit snapshots can make their own setup/diagnostic submissions.

**Fit is the default.** After the parent layout, one small compute dispatch derives the preview's active CSS dimensions and pixel extent, writes a frame record in the GPU relay, and copies it to the child's uniform buffer on-device. Dock resizing does not require reading rectangles to JavaScript. A conservative allocation sized to the root viewport is reused; groups outside the active extent return uniformly. Root viewport/preset changes can resize that allocation. The root samples only the active child extent, not unused allocation pixels. Fixed design presets use an aspect fit instead of pretending the child has a different layout width.

There is one presenter per surface; nesting is rejected. Attachable editor/model/list families must have been prepared by the owner. The playground includes all of them. API applications with a minimal owner receive an explicit unsupported-family error instead of compiling pipelines silently in the input loop. A preview texture is sampled as a composed image; arbitrary scaling does not provide freshly rerasterized vector glyph equality at every parent transform.

Two sets of scene/render arenas still have real memory and GPU cost. Pipeline reuse and a common submission producer remove duplicate preparation/scheduling work; **they do not establish a measured speedup**. Child layout/query graphs are conservatively encoded because actual input/size dirtiness is device-owned. Shader flags retain zero-work invalidation behavior, but dispatch/pass overhead is not zero. A hidden preview is not guaranteed zero cost.

## 5. Dynamic app and platform commands

Within the playground's worker, `app(view)` can replace the embedded application later. Ordinary edits can target existing controls without replacing that view:

```js
const {h, dataSource, hostAction} = Helion;
let next = 2;
app.onAction(event => {
  if (event.name === 'add') {
    app.data('rows', 'upsert', {id: next, name: `Item ${next}`, value: next++});
    app.text('status', 'A row was added');
  }
});
return h('Grid', {rows: '40 * 26'},
  h('Button', {text: 'Add row', action: hostAction('add')}),
  h('DataGrid', {id: 'rows', row: 1, ItemsSource: dataSource({
    key: 'id', capacity: 2048,
    columns: [{field: 'name', type: 'text'}, {field: 'value', type: 'number'}],
    rows: [{id: 1, name: 'Initial', value: 1}]
  })}),
  h('TextBlock', {id: 'status', row: 2, text: 'Ready', textCapacity: 128}));
```

`app.text`, `app.items`, `app.data`, `app.model`, `app.editor`, existing `set`, and `app.onAction` use a capability-checked transport. Data/model/editor operation names are allowlisted. Pending operations, command rate and payload complexity are bounded. Calls to `app(view)` reset that preview's state; they are not a keyed structural reconciler, automatic GPU heap growth, or migration of the old preview's unsaved document/model contents.

Arbitrary JavaScript remains in a stoppable, network-disabled worker inside an opaque-origin iframe. It does not run inside a compute shader. GPU model expressions and resident commands continue to execute on-device. This is not certified hostile-code or multi-tenant isolation: large inputs can consume resources before clone/scene validation, and there is no hard worker memory quota.

### Honest transfer/readback accounting

One active root frame uploads a 64-byte frame record plus 32 bytes per command. With an attached preview, the child has a second 64-byte frame template, so the baseline is **128 bytes per owning frame**, plus both command streams. The GPU Fit uniform copy is another 64-byte **GPU-to-GPU** copy, not a third CPU upload. String/document/list/source ingestion additionally uploads its explicit immutable UTF-32/record payload. Saturated frame admission consumes no queued input and sends no frame payload.

GPU-to-JavaScript actions require a real bridge. The root/child outbox has **520 six-word event records plus a four-word header: 12,496 bytes**. It is copied/mapped only after activation-eligible input, or opted-in source-editor change input; such a snapshot can contain zero actions. There is no idle, motion or wheel control-state polling. Independent maps may complete out of order, but delivery remains in submission order. At most eight pending action snapshots are admitted before input backpressure. Application handler promises do not block GPU event delivery; handler failures are isolated.

Consequently, **not every normal interaction is zero-readback**: Run and other host-bound commands have explicit event readback, and enabled auto-run has editor-change notifications. Ordinary source mutations, sorting, scrolling, docking, GPU model evaluation and text rendering do not download live documents/cells for control execution. Run/save/export/clipboard/layout/table snapshots are additional explicit, producer-barriered readbacks. No whole document is continuously mirrored into a DOM editor.

An asynchronously delivered GPU action may outlive browser transient activation. Native Open/Fonts controls can therefore be browser-policy dependent. Ctrl/Cmd+O and Ctrl/Cmd+Alt+F invoke the OS pickers directly from a keyboard event. Browser permissions still apply; the application does not bypass them.

## 6. Timing, resources and compatibility

Paced rAF remains two independently acknowledged application frames, ASAP off. The playground starts with timestamps off and HUD hidden; settings can opt into frame/stage timing and the real-font HUD. Metrics arithmetic is unchanged. Parent GPU span encloses the child graph between parent stages, but individual root-pass durations/covered intervals are not a dedicated child-stage profiler, and can omit that intervening attribution. No counter is a scanout/FPS guarantee.

Compiled node/state/heap ABI 3 remains; optional records, outbox, relay, bindings and runtime decoder require this same version. New data opcode is 13; controls opcode is 14. The 32-byte command ABI is unchanged. Initial-scene cache revision is advanced. No new font repertoire or raster quality reduction is used. The original showcase remains 202 views, 65,536 rows, eight animations, with byte-identical initial buffers in the private three-font comparison.

The data and control modules are reusable ESM exports with TypeScript declarations; they are not separately published npm artifacts. The full source includes WGSL, modules, examples, host/native tests and build/CI tools. No GitHub repository was identified for this project by the connected repository search, and no repository was created, pushed or published.

## 7. Validation and remaining boundaries

Host checks cover actual compiler/protocol/runtime JavaScript, real isolated Node execution of all ten authoring examples and action dispatch, queued shared-surface rendering with non-executing WebGPU mocks, and source/build closure. The scalar data harness adapts the actual mutation function bodies into JavaScript, including explicit hash wraparound. It agrees with a keyed Map oracle for 2,000 randomized transactions and tests 120 growing/shrinking string updates, revisions, capacity rejection, tombstones, and dead-slot sorting. **It is not a native compiler, GPU emulator or rendering/performance test.**

`tests/dynamic.html` is the native gate for source updates/compaction/rejection, lists, dynamic labels, shared device/submission, GPU-routed pointer/keyboard input, Fit layout, and document preservation. It performs serialized frames and explicit readbacks; even a passing run would be correctness evidence, not a steady-state frame-rate benchmark. Current native navigation did not reach that gate.

Outstanding: semantic language services, full editor/Unicode/bidi/IME/accessibility parity, unrestricted dynamic templates/heap allocation, arbitrary table cell controls, multi-column/grouped server queries, locale collation, fully incremental source-tree reconciliation, native floating windows, persistent recovery of unsaved GPU data, renderer/backend qualification and production security certification. The workbench, framework and text documents retain their more detailed limitations; old versioned performance reports are historical, not measurements of 0.10.

## Run and reproduce

```sh
npm start
# http://127.0.0.1:8080/playground/
# http://127.0.0.1:8080/tests/dynamic.html
npm test
npm run check
npm run build
npm run check:build
```

No runtime npm install is needed. Standalone HTML embeds modules, shaders, styles and workers, **not font assets**. Serve on localhost/HTTPS and use the runtime font source or the local-font selector. The source ZIP, static site, and standalone applications are independently packaged; the delivered source is extracted and rebuilt for byte-for-byte standalone verification.
