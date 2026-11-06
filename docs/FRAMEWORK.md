> **Current workspace:** [Unified GPU navigation, neutral theme, responsive docking and touch scrolling](RESPONSIVE-WORKSPACE.md).

> **0.10 supplement:** [Dynamic DataGrid sources, fully Helion playground, embedded GPU preview, explicit action bridges and current limits](DYNAMIC-WORKSPACE.md). This supplement supersedes older playground-shell, immutable-source, single-surface transfer and frame-loop descriptions below. Historical sections retain their version-specific scope.

> **0.9 supplement:** [Editor, docking, models, and playground](EDITOR-WORKBENCH.md) defines the new workbench APIs and limits. Historical scope statements below apply to their stated releases.

# Layout, styling, drawing and playground — 0.8.0-experimental

## Scope and evidence

Helion 0.8 extends the retained JavaScript/WGSL engine. It is **not a source-compatible or behaviorally complete port of WPF, Avalonia, WinUI, Win2D, CSS, or Vello**. Public names deliberately resemble those frameworks; the implemented contract below, tests and TypeScript definitions describe what actually exists.

The new algorithms have host tests, independently implemented layout references, executed authoring-worker tests and executable native gates. **Native shader compilation/execution, final GPU pixels, browser sandbox integration, and performance parity have not been verified in this environment.** Browser test navigation was blocked before loading. See [VALIDATION.md](VALIDATION.md). Do not interpret host tests or a shell screenshot as a hardware result.

The previous paced-vsync scheduler, fonts, glyph-cache sampling, DataGrid size, output-resolution policy and timing arithmetic are retained. This is a feature release, not a claim to fix the previously reported hardware frame-rate problem.

## Run the showcase and playground

Extract the source, enter `helion-ui`, then run `npm start`. There are no runtime npm dependencies. Open `http://127.0.0.1:8080/` for the original showcase and `http://127.0.0.1:8080/playground/` for the editor. The showcase toolbar has a Playground button.

`npm run build` produces the static site, `dist/helion-standalone.html`, and `dist/helion-playground.html`. Keep both standalone files beside each other for their navigation links. The standalone files embed JS/WGSL and their startup/authoring workers, **not font assets**. Reference documents are in the source/site archives; the API guide is also built into the playground.

Fonts load from the configured existing Noto sources at runtime. Local static fonts can be selected in the showcase Fonts panel or playground API guide. The playground uses one Regular face by default, reusing parsed fonts between runs; select multiple real faces when an app requires weight/style variants. The original showcase still loads its three configured faces. No installed/downloaded font file or extracted third-party font data is distributed.

## Reusable module boundaries

| Module | Responsibility |
| --- | --- |
| `src/layout/index.js` | Thickness, GridLength, definitions, attached/property-name adapters and enums. Layout execution is in WGSL. |
| `src/styling/index.js` | Stylesheet parser, selectors, resources, compile-time cascade and starter theme. |
| `src/drawing/index.js` | Retained DrawingContext, geometry, pens/brushes, images, glyph runs, transform and color helpers. |
| `src/composition/index.js` | Serializable keyframes, groups, easing descriptors and reference-value expressions. |
| `src/core/index.js` | Shared declarations, bounded binary compiler and protocol. |
| `src/gpu/` and `shaders/` | Device setup, input/layout/state/animation/drawing/raster execution, damage, text cache and presentation. |
| `src/playground/` | Restricted authoring exports and sandbox transport. No GPU runtime is exposed in the authoring worker. |
| `playground/` | HTML editor shell, examples, console and real GPU preview host. |

Each public authoring module has an ESM entry and TypeScript declarations and can be imported without the showcase/playground. They share core utilities; these are not independently published npm packages. The package remains private. CPU `src/layout/reference.js` exists for tooling/tests and is **not a runtime layout fallback**.

## Layout and declaration contract

```js
import {
  h, HelionSurface, Thickness, Dock, ColumnDefinition
} from './src/index.js';

const view = h('DockPanel', { Padding: Thickness(16), Spacing: 12 },
  h('TextBlock', {
    'DockPanel.Dock': Dock.Top, Text: 'A retained workspace', FontSize: 26
  }),
  h('Border', { 'DockPanel.Dock': Dock.Left, Width: 160, Padding: 12 },
    h('TextBlock', { Text: 'Navigation', Wrap: true })),
  h('Grid', {
    ColumnDefinitions: [ColumnDefinition('*', 120, 300), ColumnDefinition('2*', 180, 900)],
    RowDefinitions: 'Auto *', Gap: 10
  },
    h('TextBox', { Name: 'search', 'Grid.ColumnSpan': 2 }),
    h('UniformGrid', { 'Grid.Row': 1, 'Grid.ColumnSpan': 2, Columns: 2, Gap: 12 },
      h('Button', { Content: 'One' }), h('Button', { Content: 'Two' }))));

const surface = await HelionSurface.mount(canvas, view);
```

PascalCase and canonical camelCase work in declarations. Attached keys include `Grid.Row`, `Grid.Column`, spans, `Canvas.Left/Top/Right/Bottom` and `DockPanel.Dock`. `Name`/`x:Name` map to IDs. `Content`, `Child` and `Children` expand to retained children; Button/CheckBox string Content becomes their label. There is no runtime XAML object model, dependency-property registration or CLR/JavaScript interpreter on the GPU.

`Thickness(10)` means all sides; `Thickness(10, 6)` means horizontal 10, vertical 6; four values mean **left, top, right, bottom**. This convention also applies to Helion stylesheet margin/padding values and differs from CSS's four-value top/right/bottom/left convention. BorderThickness and CornerRadius remain scalar, not four independent sides/corners.

| Panel/property | Executable contract |
| --- | --- |
| Panel | Overlay children in the available content area. |
| DockPanel | Ordered left/top/right/bottom consumption, independent horizontal/vertical gaps, LastChildFill. A child measures against remaining space; Arrange assigns its edge slot. |
| WrapPanel | Horizontal default, vertical option; line/column breaking, cross-axis line sizing, ItemWidth/ItemHeight and independent spacing. |
| UniformGrid | Fixed/automatic Rows and Columns, FirstColumn, equal cells, independent spacing. Invalid FirstColumn relative to explicit columns is ignored. |
| Viewbox | One child measured without viewport constraints; None/Fill/Uniform/UniformToFill and Both/UpOnly/DownOnly apply a composition scale. |
| ContentControl/ContentPresenter | One expanded content child. No templates, template selection or dynamic data context. |
| Grid | Existing pixel/Auto/star tracks and spans, plus per-definition minimum and maximum. Constrained stars use monotone water filling, allowing minimum overflow or maximum underfill rather than violating bounds. |
| Canvas | Existing Left/Top plus Right/Bottom anchoring. Explicit Left/Top wins on the corresponding axis. |
| Padding and spacing | Four-side padding; axis-specific gaps on relevant panels. |
| ZIndex | Compile-time sibling painter ordering; logical child order stays intact for Dock/Stack layout. Not mutable through the current command protocol. |
| RenderTransform / RenderTransformOrigin | Six-element affine matrix and relative origin, combined with retained TRS; composition/hit testing change without remeasure. |
| UseLayoutRounding | Inherited, opt-in physical-DPR rounding during Arrange; default remains unsnapped. |

Measure and Arrange are still **two logical phases implemented with multiple depth-ordered dispatches**, not two GPU dispatches. The solver is bounded: intrinsic bottom-up, constraint propagation, constrained bottom-up, then Arrange. It does not reproduce every remeasurement dependency or converge every coupled Grid/Auto/wrapping arrangement. No shared-size groups, RelativePanel constraints, GridSplitter, LayoutTransformControl, virtualized arbitrary panels or custom WGSL layout plug-in API is included.

Functional components are reusable authoring functions, evaluated once:

```js
const Card = ({ title, children }) => h('Border', { Classes: 'card' },
  h('StackPanel', { Gap: 12 },
    h('TextBlock', { Text: title }), children));
const app = h(Card, { title: 'Telemetry' }, h('Slider', { Value: 0.6 }));
```

The inert HTML adapter adds `ui-panel`, `ui-dock-panel`, `ui-wrap-panel`, `ui-uniform-grid`, `ui-viewbox`, `ui-content-control` and `ui-content-presenter`. Use kebab-case attributes and JSON for Styles/Resources/Animations. Arbitrary browser CSS/DOM does not become GPU UI. Drawing streams are authored in JS.

## Avalonia-inspired styles and resources

```js
import { FluentTheme, Style, StaticResource } from './src/index.js';
const styles = `
  Button.primary {
    Background: #17576e;
    Foreground: white;
    CornerRadius: 8;
    transition: background 140ms smooth, opacity 140ms linear;
  }
  Button.primary:pointerover { Background: #28768b; }
  Button.primary:pressed { Background: #126e80; }
  Button:disabled { Opacity: 0.45; }
`;
const root = h('StackPanel', {
  Resources: { Accent: '#51d4cf', '--text': '#dce9f3' },
  Styles: [FluentTheme, styles, Style('TextBlock', { Foreground: 'var(--text)' })]
}, h('Button', { Classes: 'primary', Content: 'Run' }),
   h('TextBlock', { Text: 'Resources', Foreground: StaticResource('Accent') }));
```

Selection supports type, universal, ID, class, descendant and direct-child selectors; comma-separated CSS rules; target `:pointerover`/`:hover`, `:pressed`, `:focus`, `:checked`, `:disabled`, `:dark`, `:light`, and `:not(:pseudoclass)`. Structural selectors resolve at compilation. GPU state determines target pseudoclasses; ancestor dynamic selectors are explicitly rejected.

The cascade uses scope proximity, Helion selector specificity and source order. Direct local values outrank style activators. It is not the complete Avalonia property-value-priority algorithm. Hover/pressed/focus currently follow the engine's single interactive hit/capture/focus target, not a general ancestor pointer-over route; noninteractive Border/Panel hover is not implemented. Checked uses the existing retained value-above-0.5 predicate. Disabled includes ancestor enablement. Theme masks use the existing surface light/dark flag; the starter theme does not fully retemplate all control parts.

Dynamic setters are limited to background/foreground/border colors, scalar radius/border width, opacity and TRS. Their transitions execute in compute and retarget from the current animated value. Color transitions interpolate packed sRGB RGBA channels, then existing compositing decodes to linear light. Layout/font setters may be **static** styles; dynamic layout/font setters reject rather than silently triggering a CPU layout loop. Imperative composition `surface.set()` has local precedence over the same style property. Extended animations run after style evaluation.

Resources are compile-time lexical dictionaries with missing-key/cycle checks. `var(--name)` refers to a declared resource, not a full browser custom-property implementation. There is no DynamicResource notification, mutable class list, nested style syntax, container query, `@media`, template selector, attribute selector or browser CSS parser. `FluentTheme` is an original small preset, not redistributed Avalonia/WinUI theme assets.

Color authoring supports CSS named colors, transparent, short/long hex, rgb()/rgba() and a bounded hsl()/hsla() form. **Hex alpha is last:** `#RRGGBBAA`. Use `Color.FromArgb(a,r,g,b)` to express XAML-style ARGB unambiguously. Values are stored as packed little-endian RGBA; there is no full CSS Color 4/color-management engine.

## Retained DrawingContext

```js
import {
  DrawingContext, Rect, Point, Pen, FormattedText,
  LinearGradientBrush, GradientStop, TranslateTransform
} from './src/index.js';

const dc = new DrawingContext({ width: 520, height: 260 });
const fill = LinearGradientBrush([
  GradientStop('#184459', 0), GradientStop('#40cbbb', 1)
], [0, 0], [1, 1]);
dc.DrawRoundedRectangle(fill, Pen('#8ce3dc', 1.5), Rect(16, 16, 488, 228), 18);
const transform = dc.PushTransform(TranslateTransform(36, 48));
const clip = dc.PushClip(Rect(0, 0, 420, 170));
dc.DrawEllipse('#a4f2e4', null, Point(58, 62), 40, 40);
dc.DrawText(FormattedText('Retained drawing', { fontSize: 25 }), Point(116, 28), 'white');
clip.dispose();
transform.dispose();
const drawingView = dc.toView({ Name: 'artwork', ClipToBounds: true });
```

Commands record geometry once on the CPU and compile to retained heap records. The compute emitter interprets them; GPU kernels flatten curves, lay out supported text, generate coverage, evaluate paints/clips and composite. There is no per-frame CPU DrawingContext callback or Canvas2D fallback. CPU arc conversion produces cubic source segments, not a raster atlas or per-frame tessellation.

| Family | Included API |
| --- | --- |
| Drawing | DrawGeometry, DrawRectangle, DrawRoundedRectangle, DrawEllipse, DrawLine, DrawText, DrawGlyphRun, DrawImage, DrawDrawing; camelCase aliases. |
| State | PushTransform, PushClip(Rect), PushOpacity, Pop and LIFO disposable scopes. |
| Geometry | PathGeometry, RectangleGeometry, EllipseGeometry, GeometryGroup, StreamGeometry and context methods including lines, quadratic/cubic Beziers and arcs. |
| Path syntax | Absolute/relative M/L/H/V/Q/T/C/S/A/Z. Elliptical arcs are converted to bounded cubic segments at recording/compilation. |
| Retained objects | DrawingGroup, GeometryDrawing, GlyphRunDrawing. Reuse by snapshot; no live mutable DrawingGroup reference graph. |
| Paint | SolidColorBrush, Pen, LinearGradientBrush, RadialGradientBrush, GradientStop; pad/repeat/reflect; 2–32 stops. |
| Images | ImageSource(width,height,RGBA8) and DrawImage into a destination Rect, bilinear premultiplied-linear sampling in compute. No image codec or network downloader is hidden behind this API. |
| Text | Inherited Drawing-node font family/weight/style; FormattedText carries text/size. GlyphRun accepts primary-face glyph IDs, baseline, optional advances/offsets. |
| Transforms | Matrix, TranslateTransform, ScaleTransform, RotateTransform, SkewTransform, TransformGroup. |

Matrix is `[m11,m12,m21,m22,offsetX,offsetY]` with `x'=m11*x+m21*y+offsetX`. TransformGroup multiplies left-to-right (`A*B` applies B first). RotateTransform/SkewTransform arguments are degrees; retained `rotation` animation is radians. Drawing transforms must be finite and invertible. Rect is `[x,y,width,height]`; PathGeometry bounds are `[minX,minY,maxX,maxY]`.

**Important semantic differences:**

- PushOpacity modulates each primitive; it does **not** isolate an overlapping group into an offscreen layer. This differs from true group opacity.
- PushClip accepts rectangles, including affine-transformed rectangles. Coverage multiplies primitive and clip coverages; correlated edges/nested clips do not provide a production isolated-mask intersection. General geometry/rounded clips, masks and antialias clip-path fidelity are not supplied.
- Pen supports a brush and scalar thickness. Complete join/cap/dash/miter/trim semantics are absent; strokes retain the existing distance-to-segment renderer. Unknown WinUI/WPF overloads are not implemented.
- Gradients use relative geometry bounds; radial focal-origin semantics, brush transforms, conic gradients, tiled/image/visual/drawing brushes and rich image source-cropping are absent.
- No isolated layers, effects/blur/shadow, backdrop, blend modes beyond over, HDR, video, native interop, boolean geometry operations, geometry hit-testing API or full SVG document reader.
- FormattedText is not an independently shaped paragraph engine. Per-run font overrides reject; use Drawing-node inherited typography or another drawing. GlyphRun does not shape codepoints; its IDs must belong to the selected primary face. Existing Unicode/OpenType limits remain.
- 4096 authored commands/drawing, 32 state levels, 1024 source segments/path, 1024 glyphs/run, up to 4M pixels/image. Expanded primitives still share the surface's existing bounded arenas; many commands can overflow those earlier. No automatic GPU arena growth is implemented.

WPF/Avalonia DrawingContext and WinUI's Composition/Win2D drawing APIs are different API families. Helion provides the stated retained drawing facade, **not every overload or a Win2D binary/source adapter**.

## Composition and animation

```js
import { Compositor, bindExpression } from './src/index.js';
const compositor = new Compositor();
const offset = compositor.CreateVector2KeyFrameAnimation({
  duration: 2, iterations: 'infinite', direction: 'alternate'
}).InsertKeyFrame(0, [0, 0]).InsertKeyFrame(1, [120, 24], 'cubicInOut');
const animated = h('Border', {
  Name: 'moving', Width: 120, Height: 80,
  Animations: offset.toAnimations('Offset')
});
// After mounting a tree containing moving:
surface.controlAnimation('moving', 'pause');
surface.controlAnimation('moving', 'seek', 0.75); // elapsed timeline seconds
surface.controlAnimation('moving', 'resume');
```

Scalar keyframes target translateX/Y, scaleX/Y, rotation or opacity. Vector2 keyframes expand Offset/Scale to two independent scalar tracks. Tracks have 2–64 unique cues including 0 and 1, duration/delay in seconds, finite or infinite iterations, normal/reverse/alternate/alternateReverse direction, and none/backwards/forwards/both fill. Easing includes linear, smooth, cubic in/out/in-out, sine in-out, back-out, step and a fixed spring-like easing formula. It is not a stateful mass/damping/spring simulation.

`bindExpression('opacity','level',{scale:.5,offset:.25,min:0,max:1})` reads a resident control value. It is an affine/clamp expression, not the WinUI expression-language interpreter, arbitrary JS or a cross-property dependency graph.

`controlAnimation(id,'start'|'pause'|'resume'|'stop'|'seek',value?)` sends one 32-byte command. It controls all **extended** tracks on that node; it does not control historical plain from/to records by track ID. Stop restores each track's compiled base value. Extended timelines use the existing GPU animation clock (including its global pause and 100ms per-frame delta clamp). Legacy speed-linked from/to records retain their previous behavior; `speed` on extended tracks rejects rather than being ignored. No animation-finished event readback, dynamic track insertion, 3D visual hierarchy, implicit animation collection, natural-motion engine or composition effects graph is implemented.

## Playground execution and safety

The editor has JS/styles tabs, line numbers, a console, Run/Stop, keyboard shortcuts, examples, app JSON/JS import, JSON export, an optional 900ms debounced auto-run mode, resizable panes, Fit/Tablet/Phone preview widths, local fonts, an API guide and the existing GPU FPS overlay toggle. The editor shell is ordinary HTML/CSS; **the app preview uses Helion**, not DOM layout.

Five editable examples cover a docked workbench, retained drawing, keyframes/reference expressions, the 65,536-row DataGrid, and reusable components/resources. Source is a JS function body with `Helion`, `app`, `set` and `console` parameters:

```js
const { h } = Helion;
return h('StackPanel', { Padding: 24, Spacing: 12 },
  h('TextBlock', { Text: 'Hello from the playground', FontSize: 24 }),
  h('Slider', { Name: 'level', Value: .6 }),
  h('ProgressBar', { Bind: { source: 'level' } }));
```

Return a view or call `app(view)`. `set(id,property,number)` emits supported explicit runtime scalar updates; ordinary control interactions remain device-owned. This is not an ESM/npm/JSX bundler, general filesystem/network IDE or full JS app-hosting service. There is no arbitrary browser DOM/WebGPU object access through the exposed Helion API. A later `app(view)` does not mutate the retained tree; Run replaces the preview and resets its state. Run/Stop terminate the old authoring worker and dispose its GPU surface. Font parsing is reused, but device/pipeline creation still occurs on Run; incremental live-structure patching is not implemented.

Source executes in a dedicated worker inside an **opaque-origin `allow-scripts` iframe without `allow-same-origin`**. Its CSP denies network connections; the editor verifies message source/channel/run IDs. The authoring bundle excludes GPU runtime and font acquisition. Stop and the initial eight-second deadline can terminate an infinite-looping authoring worker. Source is not evaluated in the editor's main thread. Files opened into the editor do not execute until Run. Local font files are not sent to the authoring worker or exported with source.

**This is not certified hostile-code or multi-tenant isolation.** Browser CSP/opaque-origin integration is unverified here; no hard worker memory quota or pre-clone message-allocation quota exists, and bounded-looking content can still consume excessive GPU work. Run only intended local code. Arbitrary script can create resource pressure before its output is validated. The host validates scene bounds before GPU allocation, bounds console history and runtime command rate, and ignores obsolete run messages. Security deployment, hostile input fuzzing, accessibility and mobile IME qualification are outstanding.

## GPU work, pacing and transfer costs

Ordinary declarations still compile once. Structural style matching/resource resolution and path recording are host preparation. Dynamic style states/transitions, new panel layout, keyframe/expression evaluation, command replay, text, paint/clip sampling and pixel compositing are implemented in compute. Final canvas presentation/HUD remains a render pass, as before.

There is one new core pipeline (`resolveStyles`). A surface without dynamic style records does not encode its dispatch. Styled surfaces add one node-parallel dispatch in the input pass. Static styles alone do not add a style dispatch. Layout extensions share the existing Measure/Arrange/Compose graph. Keyframes share the existing animation dispatch. Drawing commands emit into the existing retained display lists and damage/raster pipeline. No new dedicated GPU buffer/texture is required by these features; their optional records and image pixels occupy the retained heap. Additional source/pipeline compilation, record memory, per-node command interpretation and per-pixel paints/clips have real costs. Native profiling is required; **no unchanged-FPS or free-cost claim is made**.

Paced vsync remains two independently acknowledged frames; ASAP remains off by default. No scheduler/timing formula was changed for this feature expansion. Normal explicit upload remains 64 bytes/admitted frame plus 32 bytes/command. New animation control uses one such command. No style-state, geometry, glyph-cache or animation readback is introduced. Run/remount and initial font/image/scene upload are setup costs, not part of that frame payload. Explicit native tests/inspection still copy and map buffers on demand.

Compiled ABI 3 retains the 72-word node/16-word control records. Optional extension addresses occupy previously reserved node word 47 as an exact numeric f32; state word 59 counts dynamic-style nodes. New compiled objects need this runtime/shader build; old ABI-3 objects without extensions remain accepted. Startup-cache revision is advanced to avoid restoring scenes packed by a compiler that did not understand these features. Fonts/repertoire are not subsetted or replaced.

## Validation and remaining qualification

Run `npm test`, `npm run check`, strict TypeScript checks, `npm run build`, and `npm run check:build`. New host tests cover API normalization, bounds, layout references, cascade/resources, command packing, geometry/arcs/images/glyphs, keyframes, optional runtime dispatch/protocol behavior and executed isolated Node authoring workers. GPU host mocks do not compile or execute shaders.

`/tests/framework.html` is the new native layout/style/animation/drawing gate. It inspects actual GPU rectangles/state and pixels, including gradient interpolation, transformed rectangular clips, RGBA images, constrained stars and damage/full rerasterization. Existing GPU/text/HUD/metrics/frame-sync/pacing/startup tests remain. Those gates are included but **not recorded as passing in this environment**. The CPU preservation comparison and editor-shell visual checks have narrower scopes, recorded in the validation report.

## Primary API references consulted

These define the source frameworks, not proof of Helion conformance:

- Avalonia styles and selector model: https://docs.avaloniaui.net/docs/styling/styles and https://docs.avaloniaui.net/docs/styling/style-selectors
- Avalonia DockPanel and UniformGrid: https://docs.avaloniaui.net/controls/layout/panels/dockpanel and https://docs.avaloniaui.net/controls/layout/panels/uniformgrid
- Avalonia DrawingContext: https://api-docs.avaloniaui.net/docs/T_Avalonia_Media_DrawingContext
- WPF DrawingContext: https://learn.microsoft.com/en-us/dotnet/api/system.windows.media.drawingcontext
- WinUI composition animations: https://learn.microsoft.com/en-us/windows/apps/develop/composition/composition-animation
- Win2D drawing session: https://microsoft.github.io/Win2D/WinUI3/html/T_Microsoft_Graphics_Canvas_CanvasDrawingSession.htm

Reviewed September 24, 2026. No upstream runtime implementation is embedded; this remains an independent experimental library with explicit limits.
