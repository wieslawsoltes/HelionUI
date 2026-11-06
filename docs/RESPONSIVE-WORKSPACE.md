# Unified, responsive GPU workspace

The root application is a Helion-rendered overview and navigation shell. Showcase,
Playground, Designer, Typography and the test directory share a neutral dark visual
language: charcoal surfaces, violet selection and primary actions, compact controls,
and proportional interface text. Editors retain their monospaced font.

All running application content is rendered through Helion. HTML supplies canvas
and iframe hosting, hidden input/file bridges, and the startup/error notice. The
linked standalone browser test harnesses remain diagnostic pages.

## Retention and scheduling

Tools mount lazily. Returning to a tool resumes its existing surface, documents,
undo state, and GPU buffers. Hidden tools stop their frame producers; the navigation
surface renders only when invalidated. This avoids rendering several workspaces
at once, at the cost of retaining each visited workspace's GPU memory. The shell
does not snapshot documents to switch views.

The browser still provides startup compilation, networking, input and explicit
file/navigation actions. This design is not a claim of zero CPU use, sub-200 ms
cold startup, or zero compositor-dropped frames.

## Responsive controls

- `DockWorkspace({dockBreakpoint:960, dockPrimary:'artboard-pane'})` shows one
  full-width pane below the CSS viewport breakpoint. Its header opens a GPU pane
  picker. Selection, visibility, input and geometry stay on the device. Expanding
  the viewport restores the existing desktop split tree and documents. A zero
  breakpoint preserves ordinary docking. Valid nonzero breakpoints are 320–4096.
- `UniformGrid({minColumnWidth:300,gap:12})` chooses as many columns as fit and
  retains the same child nodes. It applies when both rows and columns are automatic;
  explicit counts retain their existing meaning. The minimum is positive and at
  most 16384 CSS pixels. A narrower viewport still gets one column.
- `ScrollViewer({scrollHorizontal:true})` permits horizontal content overflow.
  The default stays width-constrained so paragraphs and cards reflow. `Toolbar`
  opts in. Wheel and touch scrolling update GPU scroll state. A touch drag beyond
  six pixels suppresses activation of the button where the drag began; a tap still
  activates it. Editor/list gestures retain their dedicated behavior.
- `Dialog({responsive:true,width:720,height:500})` treats the requested dimensions
  as maxima so settings fit a narrow window.

The compiler reserves extension word 22 for the adaptive column minimum, extension
flag 128 for horizontal scrolling, and docking header word 15 for compact-pane
metadata. Initial-scene cache revision `responsive1` prevents stale compiled
metadata reuse. Use matching compiler, runtime and shaders.

## Verification

Run `npm test`, `npm run check`, `npm run build`, and `npm run check:build`.
`tools/browser-test.mjs` runs the application and native GPU gates with real Chrome
WebGPU. The framework gate covers adaptive columns, horizontal scrolling and touch
activation; the editor gate covers narrow-pane selection and desktop restoration.

`npm run check:workspaces` additionally checks real GPU navigation, idle/hidden
surfaces, retained edits, history, test links, mobile navigation and an actual touch
scroll. Set `HELION_PLAYWRIGHT_MODULE` to an optional Playwright installation.
Visual review covers 1440×1000 and 390×844 viewports. Browser evidence qualifies the
recorded browser/device only; it does not imply cross-browser performance parity.
