> **0.10 supplement:** [Dynamic DataGrid sources, fully Helion playground, embedded GPU preview, explicit action bridges and current limits](DYNAMIC-WORKSPACE.md). This supplement supersedes older playground-shell, immutable-source, single-surface transfer and frame-loop descriptions below. Historical sections retain their version-specific scope.

# Helion UI 0.9 — compute editor, docking, and model workbench

## Delivery and qualification

This package contains the source implementation, runnable playground, original UI showcase, tests, build tools, and standalone HTML builds. It continues the established **0.8.0 source archive**, not the earlier editor downloads whose completion claims were retracted.

**It is an experimental editor/workbench, not a feature-complete IDE or full WPF/Avalonia/WinUI replacement. Native WGSL compilation, GPU execution, final pixels, browser clipboard/IME behavior, and hardware performance have not been verified in the authoring environment.** Host algorithm tests, worker execution, TypeScript/static checks, and reproducible builds are separately reported in `workbench-validation.json`. Native gates are provided at `/tests/editor.html` and the existing test pages; they are not represented as passed.

## Start and build

Use Node 20 or newer:

```sh
npm start
# http://127.0.0.1:8080/playground/
```

No runtime npm installation is required. The server root remains the original UI showcase. To build:

```sh
npm test
npm run check
npm run build
npm run check:build
```

`dist/` is the deployable site. `dist/helion-playground.html` is the standalone workbench; `dist/helion-standalone.html` is the standalone original showcase. Keep the two files alongside one another and serve them over localhost or HTTPS. Opening the files directly from a filesystem URL is not the supported workflow.

The single-file builds embed application modules, WGSL, and startup/authoring workers. **They do not embed font assets.** The workbench loads a pinned Noto Sans Mono Regular URL at runtime, or accepts local static font files. The showcase retains its configured three-font sources. No third-party font file or extracted third-party outline data is redistributed. An original tiny synthetic font builder exists only for correctness tests.

## Ownership and reusable modules

| Module | Responsibility |
|---|---|
| `src/editor/` | Initial document packing, declarations, command enums, explicit snapshot/clipboard controller. Mutation and drawing execute in WGSL. |
| `shaders/editor.wgsl` | Resident gap buffer, selections, edit transactions/history, navigation, search, lexical analysis, snippets, folding, line and wrap indexes. |
| `shaders/editor-render.wgsl` | Virtualized editor primitives, gutter, selection, caret, tokens, diagnostics, minimap, and editor popups through the existing raster pipeline. |
| `src/docking/`, `shaders/docking.wgsl` | Tab/split declarations, topology validation, explicit snapshot/restore, and device-owned layout/pointer operations. |
| `src/models/`, `shaders/models.wgsl` | Typed structure-of-arrays model packing, bounded expression compiler, commands, derived values, and UI bindings. |
| `src/playground/workbench.js` | Helion-authored editor toolbar, three documents, dock workspace, and live numeric-model inspector. |
| `playground/` | Browser file/font services, Run/Stop, source snapshots, preview hosting, and authoring-worker integration. |

The package exports `./editor`, `./docking`, and `./models`, with adjacent TypeScript declarations. They share the existing core/runtime; they are not separately published services or npm packages. `defineViewModel` is an alias of the same resident model declaration system, not a separate JavaScript-observable object implementation.

After mounting, authoritative document text, selections, history, search state, folds, dock topology, and model values reside in the GPU heap. JavaScript retains identifiers, capacities, schemas, pending command payloads, and scheduling metadata—not a continuously synchronized copy of mutable documents. Initial source/asset objects may still be retained by the caller.

The browser still provides events, committed IME text, files, clipboard permissions, worker execution, rendering opportunities, and command submission. None of those services is claimed to have migrated into a compute shader.

## Text and code editing

Both `TextEditor` and `CodeEditor` are Helion nodes participating in the existing Measure/Arrange and compute-raster pipeline. There is **no visible textarea or Canvas2D editor fallback**. A one-pixel hidden textarea bridges operating-system input; it does not contain the complete live document.

Implemented operations include insertion/deletion, overwrite, read-only documents, selection extension, word/line/document navigation, PageUp/PageDown, word and line selection, up to 16 carets, rectangular selection, literal find/replace, undo/redo, indentation, line duplication/deletion/movement, simple line comments, paired delimiters, completion lists, snippet tab stops, folding, word wrapping, whitespace marks, zoom, gutters, current-line highlighting, matching brackets, lexical diagnostics, and a line-density minimap.

### Editing and history semantics

Text is stored as Unicode scalars in a bounded gap buffer; input line endings normalize to LF. Cursor/API offsets are **Unicode scalar indexes**, not UTF-16 code units. Host import/API paths reject unpaired surrogates. The editor has basic base-plus-combining navigation; this is not complete Unicode grapheme, bidi, or shaping support.

Multi-selection splices are normalized and applied in document order as a transaction. Overlapping selections are coalesced for the edit; undo restores the original selection set. Capacity failures reject the edit without partially modifying text. The GPU counter `rejectedEdits` is available through explicit snapshots.

Bulk inserts, multi-caret edits, replace-all, and line operations form undo groups. Ordinary typed characters currently create separate groups rather than word/time-coalesced typing groups. History is bounded. When a new transaction does not fit, older history is reset; a transaction larger than the entire history allocation can apply without an undo record. This increments `historyResets`. History is not persisted in workspace export, and there is no infinite history or automatic arena growth.

Insertion/deletion moves gap contents serially in one document invocation. Typical nearby edits reuse the gap; distant edits can move substantial text. Each dirty document is lexed/reindexed by a single ordered GPU invocation. This is **not a rope, persistent piece tree, incremental compiler, or proven million-line performance design**. The host tests include randomized edits; they are not throughput benchmarks.

### Navigation and editor chrome

| Input | Action |
|---|---|
| Ctrl/Cmd+A; Z; Shift+Z or Y | Select all; undo; redo |
| Ctrl/Cmd+F; H; G | Find; replace; go to line |
| F3 / Shift+F3 | Next / previous literal match |
| Ctrl/Cmd+D | Add next occurrence as another selection |
| Ctrl/Cmd+Space | Open configured prefix completions |
| Tab / Shift+Tab | Indentation or snippet tab-stop navigation |
| Ctrl/Cmd+/ | Toggle simple `//` line comments |
| Ctrl/Cmd+L | Select current line |
| Alt+Up / Alt+Down | Move line up/down |
| Shift+Alt+Up/Down | Duplicate the selected line block |
| Ctrl/Cmd+[ / ] | Fold at caret / unfold all |
| Ctrl/Cmd+Tab / Shift+Tab | Next / previous tab in its docking group |
| Ctrl/Cmd+Shift+P | Bounded command palette |
| Alt+click; Shift+Alt+drag | Extra caret; rectangular selection (up to 16 rows) |
| Double/triple click | Word/line selection |
| Insert; Ctrl/Cmd+plus/minus | Overwrite toggle; font-size change |

The command palette recognizes a small fixed vocabulary by its first letter: undo, redo, wrap, minimap, fold, duplicate, comment. It is **not a fuzzy project-wide command registry**. Toolbars expose additional commands. Find/replace fields are small GPU-rendered append/backspace fields, not full nested editor instances. Search is literal, with ASCII case-folding and optional word boundaries; regular expressions and Unicode collation are not implemented.

Line-density minimap bars summarize line lengths; they are not miniature fully rasterized source text. Visible row emission is bounded to 128 rows plus chrome. Width and height use retained viewport metrics, not DOM text measurement. Large visible output or extreme zoom may exceed the existing primitive/strip arenas and produces explicit overflow instead of an automatic quality reduction.

### Language behavior and completions

Language selectors are `text`, `javascript`, `typescript`, `css`, `json`, `html`, `wgsl`, and `markdown`. These select **lightweight lexical presets**. JavaScript and TypeScript share a lexer; HTML/CSS/Markdown are not complete grammars. Coloring distinguishes common words, numbers, strings, comments, and delimiters. Diagnostics are bounded lexical/delimiter checks, not compiler/type errors. Folding uses brace/bracket regions, not an AST provider. Contextual template strings, regex literals, nested script grammars, language-specific comment formats, and all lexical edge cases are not qualified.

Completions come from an initial bounded keyword/snippet list and match a typed prefix. There is no TypeScript language service, LSP connection, semantic symbol index, reliable references/rename, debugger, code action engine, or project-wide refactoring in this release.

Snippets support `$1`, `${1:default}`, references to an earlier default, and `$0`, with at most 16 stop occurrences. Equal stop numbers become linked selections. Repeated explicit defaults reuse the first value. Malformed/capacity-rejected templates do not corrupt an existing active snippet. Nested placeholders, choices, transforms, variables, forward references with later defaults, and advanced snippet escape rules are not supported.

### Text quality boundaries

The editor uses loaded font outlines and the existing glyph-coverage cache, with fixed-width code cells derived from the face's M advance. The default is an actual monospaced font. This is not proportional paragraph layout. Application TextBlock/DrawingText retain their existing shaping path; the editor does not acquire complete OpenType shaping merely by reusing glyph coverage. Existing font-container, grayscale, hinting, complex-script, color-emoji, and clipping limitations still apply. Full RTL/bidi, Indic/Arabic shaping, complete grapheme segmentation, visual-order navigation, screen-reader semantics, and IME preedit/candidate anchoring are not implemented.

## Editor API

```js
import { h, HelionSurface, TextDocument } from './src/index.js';

const view = h('CodeEditor', {
  id: 'source',
  ...TextDocument('const answer = 42;\n', {
    documentCapacity: 65536,
    historyCapacity: 262144,
    language: 'javascript'
  }),
  fontSize: 14,
  editorLineHeight: 22,
  wordWrap: false,
  minimap: true,
  completions: [
    'const', 'return',
    {label: 'function', insertText: 'function ${1:name}(${2:args}) {\n  $0\n}'}
  ]
});
const surface = await HelionSurface.mount(canvas, view);
const editor = surface.editor('source');
editor.focus().select(0).insert('// edited on the GPU\n');
editor.command('undo');
editor.search('answer', {caseSensitive: true, wholeWord: true});
editor.setReplacement('result').command('replaceAll');
editor.insertSnippet('${1:value} + $1 = $0');

// Explicit platform boundary. Do not put this in the normal rendering loop.
const snapshot = await editor.snapshot();
console.log(snapshot.text, snapshot.revision, snapshot.selections);
```

`replaceDocument(text)` is an explicit bulk load that resets history/selection; it is not an ordinary undoable edit. `copy({cut:true})` takes an explicit source/selection snapshot and requests browser clipboard access. The subsequent cut command checks both document and selection revisions; it refuses a stale cut rather than deleting a changed selection. Clipboard permission, focus/user-activation requirements, and cross-browser support remain native integration concerns.

## Docking

```js
const layout = DockSplit('horizontal', 0.65,
  DockTabs(['source-pane', 'notes-pane'], 'source-pane'),
  DockTabs(['model-pane'])
);
const workspace = h('DockWorkspace', {id:'workspace', dockLayout:layout},
  h('DockItem', {id:'source-pane', title:'app.js'},
    h('CodeEditor', {id:'source', text:'return Helion.h("Button", {text:"Run"});'})),
  h('DockItem', {id:'notes-pane', title:'Notes'},
    h('TextEditor', {id:'notes', text:'Notes stay resident.'})),
  h('DockItem', {id:'model-pane', title:'Inspector'},
    h('TextBlock', {text:'Inspector'}))
);
```

Tabs select/close on the GPU. Dragging a tab to a group center moves it there; dropping near an edge splits the group. Dropping outside a group floats the pane within the canvas. Splitters and floating windows can be dragged/resized. Painter-order ranking moves a whole floating subtree without renumbering its control IDs. Closing a pane hides it; it does not dispose its document or undo history.

```js
const dock = surface.docking('workspace');
dock.command('activate', 'notes-pane');
dock.command('float', 'source-pane');
dock.command('reopen', 'source-pane');
const layoutSnapshot = await dock.snapshot(); // explicit readback
await dock.restore(layoutSnapshot);          // validated topology upload
```

Snapshot validation rejects cycles, disconnected nodes, inconsistent parents, invalid active tabs, duplicate/missing pane membership, and nonfinite/invalid sizes before uploading. Restoration leaves document storage untouched and invalidates GPU layout. The snapshot records layout, not a full runtime/document-history checkpoint.

Each workspace supports 16 panes and 31 topology nodes. Repeated splitting does not compact empty groups or grow the topology automatically. There are no real multi-browser/OS floating windows, auto-hide strips, arbitrary dynamic insertion/removal, persisted undo history, or Visual Studio/AvalonDock parity. Composition-transformed docking/input has not been independently qualified.

## GPU models and view models

```js
import {defineViewModel, field, computed, expr, modelBinding} from './src/index.js';
const vm = defineViewModel({
  level: field('f32', 0.25),
  percent: computed('f32', expr.mul(expr.ref('level'), 100)),
  count: field('i32', 0),
  canIncrement: computed('bool', expr.lt(expr.ref('count'), 100))
}, {
  count: 1,
  commands: {
    increment: {
      canExecute: expr.ref('canIncrement'),
      assign: {count: expr.add(expr.ref('count'), 1)}
    }
  }
});
const view = h('StackPanel', {models:{vm}, gap:12},
  h('Slider', {modelBind:modelBinding('vm','level',{mode:'twoWay'})}),
  h('TextBlock', {text:'Percent ', bind:modelBinding('vm','percent')}),
  h('Button', {text:'Increment', action:{type:'model',model:'vm',command:'increment'}})
);
// After mounting:
surface.model('vm').set('level', 0.7);
surface.model('vm').execute('increment');
```

Fields use GPU-resident structure-of-arrays buffers. Derived fields compile into a topologically ordered, bounded postfix program; cycles and unknown references reject. Writable fields have `f32`, `i32`, `u32`, or `bool` storage. Dirty rows evaluate in parallel. Derived guards are refreshed before each queued command, so `canExecute` does not read stale computed state. A command evaluates its simultaneous assignments before storing them; nonfinite results reject the assignment set and increment a per-row error counter.

`expr` includes field/argument references, arithmetic, comparisons, boolean operations, min/max/clamp, selection, absolute value, square root, trigonometric and rounding operations. **This is an explicit numeric DSL, not arbitrary JavaScript-to-WGSL compilation.** Arithmetic uses f32; integer API values are limited to exact f32 integers (±2^24, nonnegative for u32). Derived integer stores clamp to that domain. Division by zero returns zero; square root of a negative argument returns zero. Nonfinite derived values retain the prior field and report an error. These are defined experimental semantics, not .NET or JavaScript numeric equivalence.

A binding targets a fixed model row/cell. Exactly one two-way UI writer per cell is permitted, currently through the `value` property. One-way bindings support the documented numeric node properties. Use a derived field for scaling/offsetting. Arbitrary object graphs, strings, dynamic lists, entity insertion/removal, asynchronous commands, persistence/networking, general DataGrid data-provider binding, and reactive JavaScript callbacks are outside this model implementation.

Model dimensions are bounded to 16 models, 64 fields/model, 65,536 rows/model, 64 commands/model, 32 assignments/command, 256 instructions/expression, and 64 evaluation-stack entries. Surface heap limits apply before these maxima can all be combined. `snapshot({start,count})` explicitly reads selected rows and includes error/revision arrays; it is never used for the live inspector.

## Playground integration

The **editor toolbars, tab groups, splitters, floating pane chrome, source/style/notes editors, and model inspector use Helion**. The surrounding file/font dialogs, Run/Stop controls, preview host splitter, log, help, and error UI are HTML platform shell controls. The application preview continues to use Helion. No claim is made that all browser shell UI has become a shader.

Eight editable examples cover the original layout/drawing/composition/DataGrid/components plus GPU editors/docking, numeric models, and plain-text/snippet commands. Run snapshots the live JavaScript and styles, sends them to the existing network-disabled authoring worker, and replaces the preview. It does not remount the workbench or reset editor undo history. Source is a function body using `Helion`, `app`, `set`, and `console`; this is not an npm/ESM/JSX bundler or debugger. A later Run still recreates the preview surface and its device/pipelines.

Save/export snapshots three documents and their docking layout into JSON. Import validates bounds before loading, but ordinary full-document replacement resets history. Imported code does not execute until Run (or explicitly enabled auto-run). Auto-run is off by default and debounces editor input; it is not incremental semantic hot reload. Switching fonts snapshots text and remounts the workbench, resetting undo history. No implicit durable autosave or device-loss recovery exists; export important work.

The existing opaque-origin sandbox worker and execution deadline remain. This is **not certified hostile-code isolation**: user source can still consume resources before bounded scene output is validated. Do not treat local-source execution as a secured multi-tenant service.

## Transfer, frame, and performance contract

Paced rAF with two independently acknowledged application frames remains the default; ASAP remains off. No scheduling/timing arithmetic was changed for this feature release. No lower DPR, smaller DataGrid, placeholder-font substitution, or reduced coverage quality was introduced to make performance numbers look better.

Ordinary submissions retain a **64-byte uniform plus 32 bytes per command**. Imported/pasted/programmatic strings additionally upload their UTF-32 payload (four bytes per scalar). Bulk commands use immutable FIFO payloads; packets stop at a second bulk payload so the shared staging range is not overwritten before use. Ordinary editing, rendering, model updates, and dock dragging do not map buffers. Deferred frame attempts do not consume queued input.

Run/save/export/clipboard/layout snapshots pause the application producer, drain the already queued command prefix, explicitly copy/map the requested state, and resume. They are intentionally synchronization/readback boundaries, not part of the zero-readback interactive path. Restore/import and local-font remount have additional upload costs. Browser/driver copies and command-encoding traffic are not included in the explicit payload byte count.

Editor/model entry pipelines are only created for scenes requiring them. Three editor entries perform document analysis, visual-line layout, and parallel visible-row emission. Three model entries perform control pull, dirty-row evaluation, and control push. Docking shares input/layout/emission. Structural features can cause additional conservative layout graph encoding; shader flags still decide whether layout is dirty. The complete shared shader module is larger and must still be parsed, so no unchanged startup time is promised.

The retained display-list headers grow by 8,320 bytes across both lists to provide stable per-editor row sections. Documents reserve text, scratch, upload, line/visual indexes, tokens, selections, history, and search/snippet records at mount. The default three-editor workbench occupies about 9.1 MB of compiled heap with the diagnostic fixture alphabet; actual font resources and rendering arenas are additional. It also runs a separate preview surface; combined GPU memory and frame costs are not measured here.

**There is no measured unchanged-FPS claim.** Whole-document lexical scans, gap moves, bounded-history resets, folding/line scans, richer controls, and two active surfaces can add cost. The native gate uses intentionally serialized correctness steps; do not report those as sustained frame-rate results.

## Unimplemented mature-editor systems

This release does not include semantic LSP/type services, project-wide symbols/references/refactoring, a debugger/terminal, Git UI, regex search, full diffs/merge, collaborative CRDT editing, extension hosting, softwrap paragraph shaping, complete Unicode/bidi/IME/accessibility, unrestricted files/project trees, arbitrary-language parsers, production security qualification, automatic GPU allocation growth, or recovery of unsaved GPU-only edits after device loss.

The implemented commands above are connected to the resident engine and playground. Missing features are not replaced with no-op API names or described as completed. Full mature-IDE parity remains a separate, substantial scope.
