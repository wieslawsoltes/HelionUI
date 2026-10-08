# Helion Studio — compute visual designer (0.12.0-experimental)

## Delivery and evidence

This is a new visual-authoring application built on the actual Helion 0.11 source. Its visible workspace uses Helion controls and its authored controls use Helion's real Measure/Arrange, input, composition, font and sparse-strip rendering paths. It is not a DOM design canvas, a rendered screenshot editor, an embedded Microsoft product, or full Microsoft Blend feature/API parity.

**Host tests and reproducible builds pass; native WGSL compilation/execution, final GPU pixels, browser input behavior and performance remain unverified.** The current native gate was served successfully, but Chromium rejected navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. The optional Dawn binding was unavailable. `designer-validation.json` and `designer-native.json` distinguish these results. No startup, FPS or visual-correctness gain is asserted.

## Start

```sh
npm start
# http://127.0.0.1:8080/designer/
# http://127.0.0.1:8080/playground/
```

Node 20+; no runtime npm installation. The Designer button in the playground and original showcase opens Studio. `npm run build` produces three standalone applications: `helion-designer.html`, `helion-playground.html`, and `helion-standalone.html`. Keep them alongside one another for navigation, and serve the folder over localhost/HTTPS.

All application JavaScript, WGSL and startup workers are embedded in the standalone designer. Its app-export template is embedded too. **Font files are not embedded or redistributed.** The designer loads the existing pinned Noto Sans Regular/SemiBold sources at runtime. Ctrl/Cmd+Alt+F selects local static font faces, including when initial loading fails. Font changes remount the designer from an explicit document snapshot and reset authoring history.

## Workspace and reusable framework controls

Twelve dock panes provide Assets, Objects, Artboard, Properties, Brushes, States, Grid, Timeline, Source, Project JSON, Guide and Diagnostics. Four Helion CodeEditor/TextEditor instances provide source/project/help/log content. Existing GPU docking supports tabs, splitters, pane rearrangement and in-canvas floating windows. Closing a pane does not destroy its controls; Reopen restores access. The default sample workspace contains 266 native nodes and reserves 64 authoring slots.

The framework adds `DesignSurface`, `DesignTree`, `PropertyInspector`, `AnimationTimeline`, `ColorPicker`, and an internal `DesignAdorner`. They are reusable view kinds, not hand-positioned HTML overlays. The first five can be embedded in an application around one named DesignSurface. `src/designer/` is exported through `@helion/ui/designer` with TypeScript declarations. The package remains private; it is not published to npm.

A DesignSurface expands to reserved native nodes once at compilation. It then activates/reparents/orders these slots on the GPU, without rebuilding the workspace or creating a CPU visual tree on each pointer move. Selection, authored properties, topology, named brushes, keyframes, state overrides and document history remain authoritative in the resident heap. The host retains only identifiers, prepared font/path catalogs, capacities, commands, initial source objects, and explicitly requested snapshots.

## Visual authoring

**Create.** Select an asset, then click/drag the artboard. Select a valid container first to insert inside it. The implemented palette covers Canvas, Grid, StackPanel, DockPanel, WrapPanel, UniformGrid, Border, Panel, Viewbox, ScrollViewer, ContentControl, TextBlock, TextBox, Button, CheckBox, Slider, ProgressBar and Path. Original rectangle/ellipse/line/star shapes are available. Authored path geometry may also be provided through project data at mount.

**Select and transform.** Click selects; Shift-click toggles; an empty-area drag creates a marquee. Repeated clicks cycle overlapping/nested objects. Selection outlines follow actual composed native rectangles; single-object handles resize and rotate. Dragging moves the selection; arrows nudge, Shift+arrows nudge ten units. Alt-drag pans; Ctrl+wheel zooms; Fit fits the document to its current designer viewport. Grid and neighboring-edge/center snapping are device-side and have visible guides.

**Respect layout.** Canvas drags edit layout coordinates. Drags inside automatic layout panels edit composition offsets rather than claiming Canvas.Left changes a Stack/Grid slot. Record-mode resize edits composition scale, not layout width/height. Grid's dedicated panel edits pixel/Auto/star definitions and counts (up to eight per axis); removing a definition repairs child row/column/span indexes. Width/height can be Auto. The artboard size can change without remounting.

**Hierarchy.** Objects provides visibility/lock columns, selection, sibling order and drag reparenting. Cycles, depth overflow, capacity exhaustion, duplicate names and invalid single-child containers are rejected. Copy/duplicate/paste remap internal numeric binding/action references. Delete clears references to removed targets. Copy/paste is an internal document clipboard, not a browser-wide vector clipboard.

**Arrange.** Alignment/distribution operate in Canvas; group creates a Canvas; ungroup supports transparent, identity-transform Canvas groups and rejects transformations/paint/actions that cannot safely be discarded. General preservation of every transformed/automatic-layout arrangement on reparent/group is not implemented. Multi-object resize as a single affine operation is not included. These are explicit semantic bounds, not silent full-Blend equivalence.

## Properties, paint and interaction

The inspector exposes 55 fields spanning geometry, margins/padding, alignment, grid placement, typography size, colors, borders, opacity/transforms, visibility/lock and basic numeric interaction. Value editing, caret/selection, parsing, enum cycling, validation and commit/cancel run in compute. Enter commits, Escape cancels; Shift+Enter inserts a line break in a text-value edit. Multi-selection displays the primary value; edits apply to the selected objects as one transaction. Mixed-value summaries are not implemented.

Binding Source and Action Target cycle through live object names/None on click; double-click opens raw slot editing. Supported bindings read another control's numeric value with scale/offset. Actions are the existing toggle/increment/set vocabulary, not arbitrary JavaScript or a behavior graph. Preview mode disables designer interception over authored controls so actual Helion controls can be exercised. TextBox preview edits use separate runtime storage and cannot rewrite the authored text or its history.

Brushes provides GPU RGBA-channel editing and up to sixteen named solid colors, with fill/foreground references. Changing a named color updates bound objects. This is not a complete gradient/brush-transform/opacity-mask editor. Existing framework DrawingContext gradient support is not falsely presented as a designer gradient authoring feature.

Font family/weight/style catalogs and custom path geometry are prepared at mount. Text contents and font size are mutable. Arbitrary new faces/path definitions require Open/remount, not implicit shader-side parsing or font downloads. The runtime's existing sharp unhinted-grayscale font path and exact glyph cache are unchanged.

## Timeline and visual states

Six independent tracks target opacity, translateX/Y, scaleX/Y and rotation. Each has up to twelve time/value/easing keys over a bounded document duration. Scrub the ruler, double-click a track to add a key at the current rendered value, drag a diamond horizontally to retime, Shift-snap time to 0.1 seconds, or Alt-drag vertically to edit its value. Select/delete keys or change their easing. Changing document duration proportionally rescales keys.

Record mode adds composition keys when eligible edits commit; the base endpoint and changed endpoint form one undoable transaction. Track overflow rejects the transaction rather than dropping a partial set of keys. Play and looping evaluate keys on-device; Stop returns to time zero. Timeline rendering, clocks, playhead, selected keys and adorner updates have no per-frame host state readback.

Base plus three named visual states support the same six composition properties and three paint colors. Capture stores the current appearance. Editing a state changes its supported overrides, not Base. Switching states interpolates from the current appearance over 180 ms. States share layout, and are selected manually: there is no full visual-state-manager trigger/transition graph or multiple independent storyboards. Source/app export serializes the authored base and supported keyframe animations; state definitions remain in project JSON for future editing, not automatic runtime state triggers.

## Transaction and history semantics

A command/gesture records one bounded document transaction. Pointer updates change the resident draft; commit compares and validates the complete authored block, then advances a ring of snapshots. Undo/redo restores the document, including topology, text, brushes, states and keys. Redo branches are invalidated by a new edit. When the ring fills, the oldest state is evicted. Selection/viewport and transient preview input are not a persisted undo domain.

The shader validator checks active parent chains, root validity, child arity, unique Unicode names, coordinates/constraints, grid spans, resource and object references, state masks/names and key capacities/order/ranges. Failed edits roll back and update explicit error/rejection counters. Initial imports also validate on the host before allocation. This is not a security-certified general-purpose GPU allocator or project sanitizer.

Default history retains sixteen document states, configurable from two to thirty-two. Full-block history trades simplicity/atomic restoration for memory/bandwidth. Some operations and topology validation are quadratic in the bounded slot count; input and transactions use ordered ownership. It is not a lock-free parallel scene database or a proven million-object editor.

## Data, source and standalone export

Save, Refresh Source, Snapshot JSON and app export request **explicit GPU snapshots**. They drain ordered pending edits and read the document/header, then resume frame production. The browser performs JSON/ES-module serialization and file download. This is a platform/export boundary, not normal per-frame polling.

Open accepts bounded, data-only JSON. It never evaluates project JavaScript. Project JSON can be edited with the framework CodeEditor and applied to the existing reserved workspace when capacity, history, title, font and path catalogs match. A successful Apply restarts document history. New catalogs/title/capacity require Open/remount. Imports do not reconstruct arbitrary JavaScript/XAML/CSS source or preserve comments in generated code.

Export JS emits native `h()` declarations and a `mount()` helper using `@helion/ui`. Use a local import path/import map or your own package installation; the private package is not fetched automatically. Export HTML injects escaped JSON into an embedded, data-only app template with the actual runtime/shaders/worker. The resulting app renders real controls and keyframe animation, not design-editor chrome. Font assets remain runtime/local inputs. Its root Viewbox uses uniform fit; it is not a generated responsive multi-page application.

Three editable projects are supplied: Aurora/product landing, adaptive layout dashboard, and states/keyframe motion. They can be saved, edited, restored and exported. Exported ES modules are actually imported and recompiled in host tests. No runtime GPU result is inferred from that host execution.

## Public API

```js
import {h, HelionSurface, DesignDocument, designerAction} from './src/index.js';

const project = DesignDocument({
  title: 'My interface', width: 960, height: 600, capacity: 64, history: 16,
  root: {type: 'Canvas', props: {id: 'root', background: '#142331'}, children: [
    {type: 'Button', props: {id: 'hello', text: 'Hello',
      x: 60, y: 60, width: 160, height: 44}}
  ]}
});
const view = h('Grid', {columns: '190 * 260', rows: '* 240'},
  h('DesignTree', {designTarget: 'design', rowSpan: 2}),
  h('DesignSurface', {id: 'design', column: 1, designDocument: project}),
  h('PropertyInspector', {column: 2, rowSpan: 2, designTarget: 'design'}),
  h('AnimationTimeline', {column: 1, row: 1, designTarget: 'design'}));
const surface = await HelionSurface.mount(canvas, view);
const designer = surface.designer('design');
designer.select(1).set('width', 200).setColor('background', '#277d9c');
designer.command('undo');
// Bind a Helion Button without a host action/readback:
const undoButton = h('Button', {text: 'Undo', action: designerAction('design', 'undo')});
// Explicit service boundary; never call this from an animation-frame loop.
const {project: saved, revision, rejectedOperations} = await designer.snapshot();
```

`DesignerController` also exposes `insert`, `text`, `name`, `source`, `restore`, and bounded command enums. `projectToView` and `generateDesignSource` are reusable host export/initialization functions. The actual source and adjacent `.d.ts` files are the supported API contract.

## Frame graph, costs and compatibility

There is one owning surface/canvas/device and one existing paced-rAF producer. The designer is not a second independently scheduled preview surface. Frame queue policy, timestamp arithmetic, native pixel resolution, glyph coverage/cache and font parser are preserved.

Two opt-in compute entries were added: `synchronizeDesigners` publishes authored topology/properties into real native nodes before layout; `animateDesigners` evaluates slot animation/state values before composition. Authoring pointer/keyboard routing executes in the input pass; designer chrome emits through the existing compute display-list/raster pipeline. Final graphics pipelines only copy completed pixels, as in 0.11.

Ordinary frames retain a 64-byte record plus 32 bytes per queued command. Programmatic text/restore commands additionally upload their explicit bulk payloads. GPU-local authoring buttons, drags, timeline scrubbing, hierarchy editing and numeric controls do not read the document back. Host file/font/source actions use the existing activation-driven action outbox; these are not zero-readback actions. The browser still owns OS events, files, clipboard permissions, scheduling and GPU submissions.

No dedicated GPU texture or standalone renderer was added for the designer. Document data/history/captions/catalog metadata occupy the retained heap; real native slots and preview text buffers are reserved at mount. For 64 slots, one document block is 268,800 bytes; sixteen history blocks alone require 4,300,800 bytes. Four editor buffers, document clipboard/draft and font geometry are additional. With one privately supplied DejaVu Sans face the test workspace heap is about 42.2 MB. This is an allocation accounting example, not the default Noto two-face download size, peak browser memory or a benchmark. `designer-preservation.json` records exact figures and their font scope. Large font catalogs/history can exceed the bounded heap and are rejected.

The shared source module is larger even when a surface does not create designer pipelines. More parsing/compilation can affect startup. The editor adds real work, including history copies, validators, layout on geometric edits and chrome rendering. **No zero-overhead, unchanged FPS, device-vsync success, or startup-speedup claim is made.**

Compiled ABI 3 remains; the optional descriptor uses unused extension words 34/35 and the feature bit 32. Existing scenes without the designer retain their initial node/state/heap data. The startup cache revision changes so old compiler records are not silently used. Runtime, shaders and descriptors must come from the same release.

## Capacity and missing systems

One DesignSurface per retained surface; 8–128 reserved authored nodes, sixteen parent levels within the overall framework depth limit, eight Grid definitions per axis, 64-scalar names, 512-scalar text values, sixteen solid resources, six tracks, twelve keys/track, Base plus three states, up to 64 prepared path assets. Some combinations exceed the heap or global 512-native-node limit before all maxima can be reached. Rejection is explicit, not runtime heap growth.

**Not implemented as full Blend parity:** arbitrary control/template/style/behavior editors; designer insertion of DataGrid/editor/dock/model-control families; gradient/brush transforms, effects, opacity masks and vector control-point tools; arbitrary path/font replacement without remount; project-wide resource graphs and semantic code/XAML round-trip; trigger graphs/multiple storyboards; multi-artboard/page management; persistent cross-session history/autosave/recovery; collaboration; native OS floating windows; full transformed-layout group/reparent equivalence; production accessibility, Unicode/bidi/IME, performance and security qualification. These are not represented by no-op buttons or compatibility claims.

## Verification

```sh
npm test
npm run check
tsc --strict --noEmit --target es2022 --module nodenext \
  --moduleResolution nodenext --lib es2023,dom tests/api-types.ts tests/designer-api.ts
npm run build
npm run check:build
npm start
# /tests/designer.html?autorun
```

The native gate covers module/pipeline creation, genuine control hit testing, pointer drag/undo, topology/track changes, state/keyframe behavior, preview/source isolation, restore and retained/full-render pixels. It is **provided, not recorded as passing here**. The test-only scalar WGSL-to-JavaScript adapter executes real scalar function bodies and catches data/transaction regressions, but is not a WGSL compiler, GPU emulator, vector pointer/raster test, or runtime fallback. Browser/device qualification remains necessary.

Original showcase preservation is an exact three-face CPU comparison: 202 nodes, 65,536 rows and eight animations, complete node/state/heap equality. Shader files that gained designer hooks are deliberately not claimed unchanged or native-pixel-identical. Font/coverage/cadence protected files are individually hashed.

## Primary reference context

Microsoft's Blend overview describes tools/assets/artboard and Objects and Timeline workflows: https://learn.microsoft.com/en-us/visualstudio/xaml-tools/creating-a-ui-by-using-blend-for-visual-studio?view=vs-2022 (reviewed 25 September 2026). This is inspiration, not a license or proof of parity. WGSL execution and synchronization concepts follow https://www.w3.org/TR/WGSL/ (21 September 2026 draft reviewed). Neither reference verifies this implementation's native behavior.
