# Helion template API — original 0.13 contract

For current 0.14 refinements (new part roots/focus rings, palettes, API and Studio
preferences), read [THEME-REFINEMENT.md](THEME-REFINEMENT.md). Counts and test results
in this base document are historical 0.13 observations.

## Delivery and evidence

This release extends the actual 0.12.3 source with connected control templates,
GPU template bindings and visual-state transitions, reusable theme resources, and
Studio catalog/part editing. It retains the watchdog receiver repair, classic
embedded startup worker, launch-origin guards, sharp compute text and paced rAF.

This is a **bounded experimental implementation, not a complete WPF/WinUI port**.
The new features are implemented and packaged; native WGSL acceptance, final GPU
pixels, full browser interaction and hardware performance remain unverified.
Current host checks, actual isolated browser-worker checks and failed native
attempts are distinguished in `templates-validation.json`. Historical reports in
this package describe their named releases, not this release.

No CPU visual renderer, per-frame DOM template tree, font raster atlas, system font
file or upstream Microsoft/Apple control implementation is shipped.

## Public modules and authoring

`@helion/ui/templates` exports ControlTemplate, TemplateBinding, ThemeResource,
VisualState, VisualStateGroup, VisualStateManager, TemplateController, themeAction,
templateAction, ToggleSwitch, TemplatedToggleButton, and prepared templates/themes.
It shares the framework compiler/runtime and has TypeScript declarations; this
private package has not been published to npm.

```js
import {
  h, HelionSurface, ControlTemplate, TemplateBinding as B,
  ThemeResource as R, VisualState, VisualStateGroup, ToggleSwitch,
  themeAction
} from './src/index.js';

const ActionTemplate = ControlTemplate('Button',
  h('Border', {
    id: 'Chrome', padding: B('Padding'), radius: R('radius'),
    background: B('Background'), borderColor: R('stroke'), borderWidth: 1
  }, h('ContentPresenter', {
    id: 'Content', foreground: B('Foreground'), fontSize: B('FontSize'),
    horizontalAlignment: 'center', verticalAlignment: 'center'
  })), {
    name: 'ActionButton',
    defaults: { background: R('control'), foreground: R('text'), padding: 12 },
    visualStateGroups: [VisualStateGroup('CommonStates', [
      VisualState('Normal'),
      VisualState('PointerOver', { Chrome: { background: R('controlHover') } },
        { when: { pointerover: true }, duration: .12 }),
      VisualState('Pressed', { Chrome: { background: R('controlPressed') } },
        { when: { pressed: true }, duration: .08 }),
      VisualState('Disabled', { Chrome: { opacity: .45 } },
        { when: { disabled: true }, duration: .12 })
    ])]
});

const view = h('StackPanel', {
  padding: 24, gap: 12, theme: 'fluent', themeVariant: 'dark',
  templates: { ActionButton: ActionTemplate }
},
  h('Button', { id: 'run', template: 'ActionButton', text: 'Run' }),
  ToggleSwitch({ id: 'option', text: 'Enable animations' }),
  h('Button', { text: 'macOS-inspired light', action: themeAction('macos26', 'light') })
);
const surface = await HelionSurface.mount(canvas, view);
surface.template('run').goToState('CommonStates', 'Pressed');
surface.template('run').automatic('CommonStates');
surface.setTheme('fluent', 'light');
surface.setReducedMotion(true);
```

`controlThemes:true` applies the prepared defaults to supported controls; explicit
`template` selects a definition or registry name. PascalCase property aliases and
inert HTML declarations are supported. `theme` and `template` attributes may use
plain registry names; structured definitions use JSON. Arbitrary HTML/CSS, JS
functions or platform XAML templates are not evaluated by shaders.

## Template execution contract

### Native trees and per-instance names

Supported template owners are Button, CheckBox, Slider, TextBox, ProgressBar,
ContentControl, ContentPresenter, Panel and Border. There is no new independent
input widget behind a template: the owner keeps its native value, focus, pointer,
command and text state. The template supplies the native visual descendants and
suppresses the owner's old built-in drawing.

Each instance gets distinct native node IDs, state records and part names.
`surface.template('run').findName('Chrome')` returns that instance's node ID;
`parts` returns a copy of its name-to-ID metadata, not live GPU property values.
Repeated names across instances are valid. Duplicate names within one definition,
recursive templates, invalid types, missing targets and capacity violations reject.
The ordinary runtime supports up to 64 parts/template, part depth 12 and eight
nested template levels, subject to the existing 512-node surface limit.

ContentPresenter projects a string or the owner's native content subtree once.
Text and metrics flow through the existing compute text path. NativeContentPresenter
is reserved for the TextBox content host; a TextBox template must provide exactly
one. It draws and edits the owner's actual text/selection/caret rather than a
second independent string. General scroll/text-editor content hosts, item-container
recycling and DataTemplate selection are not supplied by this release.

Noninteractive visual parts let native owner hit testing/activation work. Explicit
interactive descendants have their own native interaction. This is not complete
WPF routed-event, logical-tree or templated-parent event retargeting equivalence.

### Live bindings and precedence

TemplateBinding reads the templated parent's retained property or supported state.
Numbers, packed colors, text pointers, padding, visibility/enabled flags, selected
layout properties and composition values have typed plans. Numeric bindings can
scale, offset and clamp. `relativeTo:'actualWidth'|'actualHeight'` multiplies a
composition value by the parent's arranged dimension plus `relativeOffset`;
actual-size feedback into Measure/Arrange properties is rejected.

Bindings execute in compute before layout or before composition as appropriate.
Changed layout targets invalidate the GPU layout flag; unchanged plans do not
claim a new layout execution. Text aliases device-owned storage without sending a
whole string back to the CPU each frame. Template text uses the loaded font and
existing shaping/coverage limitations, not a new Unicode engine.

One-way is the default. Helion also exposes a **non-WPF extension**, an unconverted
`value`-to-`value` two-way binding with exactly one writer per owner. It is not a
general object binding engine or a dependency-property registration API. Microsoft's
WPF TemplateBinding is one-way; the matching API name does not imply equivalence.

Template defaults yield to authored local values. Visual-state setters act on the
named parts. Explicit `setPart`/`surface.set` scalar writes lock the affected plan;
`clearPartValue` releases the local override so its binding/state can resume.
Static styles and template definitions are prepared on the host once. Arbitrary
runtime class/resource dictionaries or new template structures require preparation
and remount, not a CPU frame loop that diffs a hidden DOM tree.

### Visual states and motion

Up to eight independent named groups, with up to sixteen states each, select
bounded setters. Automatic predicates include pointer-over, pressed, focus,
checked, disabled and light/dark. Ordered matches select a state within its group.
Manual `goToState` persists until `automatic(group)` restores the predicates.

Color and numeric transitions retarget from the current value without jumping
back to an obsolete start. Reduced motion applies targets directly. State values
restore from their live binding/base value when a state ends. State names and part
references validate before upload. Supported easing descriptors are those accepted
by the implementation; arbitrary JavaScript easing functions do not run on the GPU.

This is not every WinUI VisualStateManager feature: no general trigger interpreter,
Timeline/Storyboard object graph, routed state events, natural-motion solver or
arbitrary dynamic state insertion is claimed.

## Original themes

| Export / name | Included appearance |
|---|---|
| WinUIFluentTheme / `fluent` | Light/dark colors, compact radii, control/field/stroke/accent roles, hover/pressed/disabled/focus styling and bounded motion. |
| MacOS26Theme / `macos26` | Independent light/dark palettes, larger rounded surfaces, accent/focus roles and softer translucent color choices. |

Both use the same retained control templates. Prepared visuals cover Button,
CheckBox, Slider, TextBox, ProgressBar and ContentControl, plus the explicit
ToggleSwitch and TemplatedToggleButton helpers. ThemeResource looks up the retained
selected palette. Live theme switches use one command and do not recreate runtime
control state. The initial registry can be customized; Studio's indexed theme
commands require the built-in Fluent/macOS bank in that order.

These are **platform-inspired Helion themes**, not native OS skins. There is no
Mica, Acrylic, operating-system backdrop, Liquid Glass blur/refraction, native
widget/font/hinting implementation, or certification of platform design parity.
Not all legacy hard-coded editor, DataGrid and docking chrome is automatically
retemplated by `setTheme`. The palette affects tokenized/template controls, not
unrelated literal colors. No Segoe, SF, or other font binaries are included.

## Studio workflow

Studio adds a **Templates** dock pane and a GPU CodeEditor for template JSON.
The default workspace has seven prepared catalog definitions and eight reserved
instance slots. The existing 64-object authoring capacity, undo capacity and
framework node limit still apply.

1. Select a supported leaf control on the artboard. In Templates choose a catalog
   entry and Apply. Native visuals removes it; Theme defaults opts its appearance
   into template defaults. Incompatible selections and insufficient pool capacity
   reject as one authoring transaction, not a partially assigned selection.
2. Fluent/macOS dark/light changes the authoring theme. Template assignments,
   default-inheritance masks and theme selection are in the GPU undo/redo domain.
   Inspector edits clear the matching default-inheritance bit, giving that authored
   local appearance precedence. Native controls still work in Preview.
3. JSON opens the complete definition, including bindings and named visual-state
   setters. Apply JSON validates it and reopens the original project from an
   explicit snapshot. New/copy clones the current definition with a unique name;
   Remove unused refuses to delete an assigned definition.
4. Edit parts opens an actual DesignSurface for the selected template. The original
   main project is retained only as an explicit host snapshot during this operation.
   Move/resize/reparent/add parts and edit their properties using the same GPU
   inspector, objects tree and authoring undo. Save parts merges the edit, validates
   it and returns to the main project; Back cancels those definition changes.

Visual editing has deliberate representation boundaries. ContentPresenter and the
native TextBox host have preview stand-ins in the part-editing document, then their
roles are restored on save. The merge compares against an actual starting GPU
snapshot and uses slot/name identity: untouched TemplateBinding/ThemeResource
markers survive. Editing a property makes that property literal. Part renaming
repairs supported named references. Deleting a part used by a visual-state setter
requires repairing that reference in JSON before it can be accepted. There is no
arbitrary code/XAML round-trip or automatic guessing of the intended replacement.

**Definition changes/remounts reset the main project's undo history**; ordinary
assignment/theme changes do not. The visual part document has its own GPU undo
while open. Save/open/project snapshots and JS/HTML export preserve the template
catalog, assignment/default masks, theme and variant. Catalog definitions are host
asset data; live authored instances and interaction state are GPU-owned.

Studio limits: eight catalog definitions, at most eight parts and depth five per
definition, one to sixteen instance slots (default eight), and supported leaf owner
types. It rejects nested templates, complex item/document subsystems in an editable
part definition, extra native text hosts and incompatible content. Unused slots are
hidden and reused on the GPU; undo/reapply restores catalog assignment without a
per-gesture remount. Catalog capacity is fixed at mount. The wider runtime API has
larger limits and is not restricted to the Studio part editor's subset.

## Frame, memory and startup costs

Initial definition validation, expansion, name resolution, prototype preparation
and typed-plan packing are host work (normally in the existing startup worker).
After upload, template values, state transitions, owner interaction, layout,
composition and coverage use the retained compute pipeline. Final presentation
still copies already-composited pixels through the existing render pass.

Three optional entries are added: `rankTemplateTree`, `resolveTemplateLayout`, and
`resolveTemplateVisuals`. Instances run by template nesting level to preserve
parent-before-child dependencies; part layout uses the framework's existing depth
passes. Ranking/pool reconciliation early-out after initialization when layout is
clean. Scenes without templates/theme plans do not dispatch these entries.

This is not zero-cost. Templates add native nodes, state and packed plan records.
Studio reserves prototype records and its native part pool. A template with layout
bindings can cause conservative host encoding of the layout graph even when GPU
indirect counts are zero. Dirty control/layout, animated templates, font cache
misses and more visual parts can increase GPU work. Source/compiler work also
increases. **No highest-performance, unchanged-FPS or startup-speedup result is
claimed.** The accompanying audit reports allocation/source counts, not hardware
milliseconds or throughput.

Ordinary frame traffic remains 64 bytes per active retained surface plus 32 bytes
per command and explicit bulk payloads. No template-state, palette, glyph or named
part polling/readback is added to ordinary rendering. Existing Run/file/clipboard
and host-action outbox boundaries remain. Studio catalog/part editing uses explicit
snapshots/remounts and has their additional transfer costs.

Compiled ABI stays 3 with new extension pointers/feature bits. Existing untemplated
scenes remain readable; new template scenes require this runtime and its matching
shaders. The startup-cache revision changes to avoid restoring a scene packed by a
compiler that did not understand these records. Update the complete package, not
only one shader file. Browser origin guards, timer wrappers and classic startup
worker behavior are retained.

## Validation and reproduction

```sh
npm test
npm run check
tsc --strict --noEmit --target es2022 --module nodenext \
  --moduleResolution nodenext --lib es2023,dom \
  tests/api-types.ts tests/designer-api.ts tests/templates-api.ts
npm run build
npm run check:build
npm start
```

`/tests/templates.html?autorun` is the new native interaction/layout/state/pixel gate;
`/tests/shaders.html?autorun` prepares all actual partitioned programs and pipelines.
These are supplied but **not recorded as passing** in this environment. The browser
rejected both served-page navigations before loading. The optional Dawn compiler
binding was unavailable, so no native compiler acceptance is inferred.

Host tests check expansion, types/cycles/names, initial buffers, scalar execution
of translated WGSL helpers, transitions, local/two-way bindings, pool reconciliation,
GPU authoring transactions, JSON/source export and visual-edit merge semantics.
The scalar harness is not a WGSL parser, native compiler or GPU renderer. Actual
isolated Chromium classic Blob workers did prepare templated ordinary/designer
scenes with byte-identical initial buffers; this verifies worker serialization and
compilation on the CPU only. Timer lifecycle checks also use native browser APIs.

The source-package verification extracts into a fresh directory containing spaces,
reruns tests and checks, rebuilds, and compares all three standalone HTML files.
No external font data is included in release archives or worker/HTML bundles.

## Launch

Source: `npm start`, then `/designer/`, `/playground/`, or `/`.
Standalone: extract the whole ZIP, then `sh ./start-helion.command` on macOS,
`start-helion.cmd` on Windows, or `sh ./start-helion.sh` on Linux (Python 3).
Manual alternative: `python3 -m http.server 8080 --bind 127.0.0.1` and open
`/helion-designer.html`, `/helion-playground.html` or `/helion-standalone.html`.
Do not open these HTML applications directly using file: URLs. No browser security
bypass is used. Fonts load from the configured runtime sources or local selection
(Ctrl/Cmd+Alt+F); app JavaScript, shaders and workers are embedded in standalone HTML.

## References and non-equivalence

These specify the source-platform concepts, not proof of Helion conformance:

- Microsoft, control templates: https://learn.microsoft.com/en-us/windows/apps/develop/platform/xaml/xaml-control-templates
- Microsoft, WPF TemplateBinding (one-way): https://learn.microsoft.com/en-us/dotnet/desktop/wpf/advanced/templatebinding-markup-extension
- Apple, materials: https://developer.apple.com/design/human-interface-guidelines/materials
- W3C, WebGPU and WGSL: https://www.w3.org/TR/webgpu/ and https://www.w3.org/TR/WGSL/

No full dependency-property, item template/container generator, platform routing,
accessibility, bidi/shaping, resource hot reload, arbitrary template allocation,
OS theme parity or production security qualification is asserted.
