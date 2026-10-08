# Helion UI 0.14 — theme and template refinement

## Release scope and evidence

This release continues the actual 0.13.0 template source archive. It refines the
existing retained control-template runtime, original Fluent/macOS 26-inspired
palettes, Studio authoring, and the GPU playground. It does not replace the UI
with DOM controls, ship platform fonts, or claim complete WPF/WinUI/macOS parity.

Host tests, strict types, static checks, reproducible bundles, numerical palette
checks and actual browser startup-worker tests are recorded separately from native
GPU verification. The current served template and shader pages are blocked by
Chromium with ERR_BLOCKED_BY_ADMINISTRATOR. Native WGSL acceptance, final pixels,
full browser interactions and hardware performance remain unverified. No unchanged
FPS, startup improvement, accessibility certification or native OS fidelity is
claimed. Historical reports in this package apply to their named versions only.

## Refined control visuals

Button, TextBox, CheckBox, Slider and ToggleSwitch now use a separate named
`FocusRing` overlay. A focus transition changes its opacity rather than modifying
the content border or padding. It follows normal retained geometry and the same
compute coverage path as the rest of the control. It is shown for focused controls,
not only keyboard-origin focus; input-modality-specific focus policy is not added.

The ordinary Button and TextBox templates now have a Grid `Layout` root and a
`Chrome` child. Code should address parts by name, not assume the root is Chrome or
that a particular native index is stable. `Content`, `Chrome`, `FocusRing`, and
TextBox's `PART_ContentHost` have independent per-instance IDs. Existing serialized
custom templates are not silently rewritten into the new built-ins.

Disabled states explicitly set semantic disabled foreground/surface/stroke colors.
They take priority over hover/press/checked styling, hide the focus ring, and do not
change the actual control value. In particular, a checked toggle button now keeps
its `accentText` foreground on its accent background during hover/press. The old
normal foreground could be unreadable there. A checked disabled switch still
retains its thumb position; a disabled checkbox retains its check indication.

New reusable exports are `AccentButtonTemplate`, `SubtleButtonTemplate`,
`DestructiveButtonTemplate`, `ToggleButtonTemplate`, and the `AccentButton`,
`SubtleButton`, and `DestructiveButton` declaration helpers. `TemplatedToggleButton`
and `ToggleSwitch` remain available. These are regular Helion Button/CheckBox
owners with existing command, focus and interaction behavior, not new DOM widgets.
Subtle buttons deliberately retain a transparent base surface; their readability
also depends on the actual backing surface chosen by the application.

## Palettes, density and custom accents

Both original themes now contain light/dark palettes, high-contrast light/dark
alternatives, and compact numeric metrics. Fluent retains compact rectangular
shapes; the macOS-inspired preset uses rounder surfaces. This release uses opaque
base fills to make foreground/background contrast predictable. Neither theme
implements Mica, Acrylic, Liquid Glass blur/refraction, system backdrops, native
widgets or native OS fonts. Theme changes affect tokenized/template properties,
not every legacy hard-coded editor/DataGrid/docking color or application literal.

Defaults remain `themeContrast:'standard'` and `controlDensity:'comfortable'`.
Compact controls use smaller heights and padding, not smaller fonts. Button minimum
height changes from 36 to 28, TextBox from 38 to 30, and selection-control minimum
height from 32 to 28. Explicit authored dimensions/local overrides still win; density
is not a global scaling transform and does not shrink fixed-size design objects.

An opaque custom accent updates accent, accent foreground, hover, pressed and accent
stroke roles. Initial packing derives these values once on the host; a live command
derives them once on the GPU. Foreground selection uses linear-sRGB luminance and
chooses black or white. Tint channel blending uses bounded integer round-half-up
arithmetic to avoid float rounding at byte half-boundaries. The native luminance
calculation is still WGSL f32; the host/scalar comparison is not proof of every
native floating-point result. Translucent accents are rejected rather than choosing
text against an unknown backdrop. `null` restores the preset accent.

High-contrast mode deliberately ignores—but retains—the custom accent. Switching
back to standard restores it. The built-in high-contrast alternatives use fixed,
readable colors. Custom theme descriptors may supply `contrastDark`, `contrastLight`
and `compact` maps; missing maps fall back to that descriptor's standard values,
not invented high-contrast or density behavior.

The included contrast audit checks named opaque text pairs against 4.5:1 and focus
roles against 3:1. It does not inspect final antialiased glyph pixels, arbitrary
alpha layering, custom application colors, or the accessibility tree. Passing
those palette checks is not WCAG conformance. See `theme-refinement-audit.json`.

## Runtime API

```js
import {
  h, HelionSurface, AccentButton, SubtleButton, DestructiveButton,
  ToggleSwitch, ThemeResource as R, themePreferenceAction
} from './src/index.js';

const view = h('StackPanel', {
  theme: 'fluent', themeVariant: 'dark',
  themeContrast: 'standard', controlDensity: 'comfortable',
  accentColor: '#b99cff', controlThemes: true,
  background: R('canvas'), foreground: R('text'), padding: 24, gap: 12
},
  AccentButton({ id: 'apply', text: 'Apply' }),
  SubtleButton({ text: 'Not now' }),
  DestructiveButton({ text: 'Delete' }),
  ToggleSwitch({ text: 'Enabled', value: 1 }),
  h('TextBox', { id: 'entry', text: 'GPU-owned text' }),
  h('Button', {
    text: 'Compact layout',
    action: themePreferenceAction('density', 'compact')
  })
);
const surface = await HelionSurface.mount(canvas, view);
surface.setTheme('macos26', 'light');
surface.setThemeContrast('high');
surface.setControlDensity('compact');
surface.setAccentColor('#69d5a0');
surface.setReducedMotion(true);
surface.setAccentColor(null); // Return to the prepared theme's accent.
```

Each imperative preference change sends one existing 32-byte command, not a new
palette or a visual-tree rebuild. `themePreferenceAction` lets a Helion button make
the same change entirely in the GPU command path. It accepts `contrast`, `density`,
`accent` or `reducedMotion`; no host action outbox/readback is required. Initial
options work in the startup worker and participate in initial-scene cache keys.
The cache revision changes, so the first mount of this release can be a cold scene
preparation; the change is not represented as a faster initial load.

Use `controlThemes:false` to opt a subtree out of inherited implicit templates.
`template:false` keeps native visuals for one control. Explicit templates still work
inside an opted-out subtree. Built-in definitions and palettes are deeply frozen;
clone with `structuredClone()` before customization rather than mutating shared
exports. `resolveThemePalette()` and `themeAccentColors()` are reusable initial
preparation/inspection helpers, not per-frame CPU style evaluators.

## State-runtime fixes and work reduction

Visual-state conditions are now evaluated once per instance/group for each encoded
template stage. Property plans read that cached group selection instead of searching
the same group for each matching rule. Storage reuses the group's reserved word;
there is no extra compute pipeline, dispatch or GPU buffer for this cache.

The audit's current Button graph has six property-rule searches under the old
strategy versus four group searches across layout+visual stages; the ToggleButton
has fifteen versus six. These are control-flow counts for the same current template
graph, not measured speedup or a baseline GPU benchmark. Expanded focus geometry
and additional state/property plans still have real runtime costs.

Transition state retains its selected duration/easing while returning to the live
base binding. Interrupted changes start from the current displayed value. Reduced
motion jumps to the target without erasing the outgoing transition definition;
reenabling motion cannot replay an obsolete start. Two-way TemplateBinding now
rejects clamping, negation and nonzero relative offsets in its strictly unconverted
value-to-value path, instead of silently accepting incompatible conversion options.

## Studio and playground

Studio's Templates pane now contains controls for contrast, comfortable/compact
density, reduced motion and preset custom accents/reset, alongside the existing
Fluent/macOS light/dark choices. These are Helion controls with GPU designer commands.
`DesignerController` exposes `setThemeContrast`, `setControlDensity`,
`setReducedMotion` and `setAccentColor`. They change authored document fields as
normal undoable transactions, survive project snapshots/restoration and generated
JS/HTML exports, and do not remount the authoring workspace. Direct inspector/local
values continue to take precedence over inherited theme defaults.

Normal/Over/Pressed/Focus/Checked/Disabled/Auto controls invoke
`previewTemplateState(...)` for selected instantiated templates. This is a transient
visual-state mask, not a fake input event, value change, actual disabling, or saved
state trigger. It does not add undo entries or alter authored interaction. Auto
restores automatic predicates; reusing a pooled template instance clears the mask.
Controls without an instantiated template reject preview rather than changing
unrelated data. Manual ordinary runtime state APIs continue to work independently.

The existing JSON and visual part-edit workflows remain. The part editor starts
with the active palette/preferences, and untouched binding/resource markers survive
its merge. Saving a template definition still uses an explicit snapshot/remount
boundary and resets main-project undo history; this is not live GPU topology growth.
A parts-only document without a template catalog does not run authoring theme-state
commands. The previous eight-definition/eight-part Studio catalog limits remain.

The playground adds **Theme lab · contrast, density & accent** as its twelfth example.
It runs the actual templates in a Helion scrollable/wrapping UI, with enabled and
disabled variants, a toggle, text entry and slider/progress pairing. Its settings
buttons send GPU commands. The example is editable and runs through the existing
stoppable authoring worker, not a DOM screenshot or separate renderer.

## Compatibility, traffic and allocation

Compiled node/state/heap ABI remains 3. New palette banks have eight entries per
theme (variant × contrast × density), versus two previously. Only referenced tokens
are packed. A numeric/color token in the two-theme bank uses 64 bytes rather than
16; string resources can use additional records. Palette flags, accent values,
per-group state cache and designer preferences occupy previously reserved fields.

The runtime retains legacy two-entry palette reading, but new preference commands
require a newly prepared eight-entry scene. Recompile 0.13 compiled objects for the
new settings; producer/compiler/shaders must come from this complete release.
Normal traffic remains 64 bytes per active retained surface plus 32 bytes per command
and explicit bulk data. There is no new normal template/palette/text readback.
Existing Run, file, clipboard, action-outbox and snapshot boundaries remain explicit.

Studio grows from 440 to 480 nodes, still within the 512-node surface bound, retains
five editors, and uses its previous template instance capacity. Additional UI and
focus parts can reduce remaining node headroom for custom workspaces. In the
single-face DejaVu Sans audit, the initial Studio heap grows by 56,936 bytes, nodes
by 11,520 bytes and state by 2,560 bytes (71,016 bytes combined). Other fonts and
scenes have different allocations. No raster arenas/textures or new pipelines are
introduced by this refinement. GPU pixel cost is not inferred from allocation size.

Sharp compute text, fractional positioning, fonts, DPR/native backing policy,
watchdog receiver fix, classic embedded worker, launch guards, submission/cadence
and timestamp arithmetic are preserved. 24 of 26 shader files are byte-identical;
only template and designer logic changes. The complete ordinary showcase buffers
remain byte-identical to 0.13 in the private real-font audit (202 views, 65,536 rows,
eight animations). Native pixel equivalence is not claimed for changed templates.

## Reproduce and limits

```sh
npm test
npm run check
tsc --strict --noEmit --target es2022 --module nodenext \
  --moduleResolution nodenext --lib es2023,dom \
  tests/api-types.ts tests/designer-api.ts tests/templates-api.ts
node tools/audit-theme-refinement.mjs --baseline=/path/to/0.13/helion-ui \
  --output=theme-audit.json
npm run build
npm run check:build
npm start
```

Serve `/tests/templates.html?autorun` for the expanded native layout, state, preference,
text aliasing, designer history and pixel gate; `/tests/shaders.html?autorun` for all
native shader/pipeline groups. `tools/check-template-browser.py` checks those pages
and actual isolated classic Blob workers with the new theme preferences. A blocked
page remains unverified even when its isolated worker tests pass.

The tests include CPU-translated scalar WGSL; those adapters now preserve unsigned
right shifts for u32 masks/colors instead of JavaScript's signed `>>`. The original
WGSL syntax guard runs before translation. Neither this adapter nor static resource
checks are a native compiler or renderer. New palette tests are not screenshots.

No system-preference observation, full access-key/accessibility model, platform
backdrop, high-contrast recoloring of literal application paints, new font shaping,
item-template generation or unbounded runtime template allocation is added. Native
application startup, pointer behavior, final GPU pixels and throughput are still
not qualified. Font files and third-party extracted outlines are not in any package.

## Primary design references

Microsoft's color guidance distinguishes neutral surfaces, accents, contrast and
light/dark presentation. These inform the independent palette choices, not a claim
that Helion is native WinUI:
https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/color

W3C WCAG 2.2 defines contrast criteria used as thresholds for the narrow host palette
checks, not a conformance claim for this experimental GPU-only interface:
https://www.w3.org/TR/WCAG22/#contrast-minimum
https://www.w3.org/TR/WCAG22/#non-text-contrast
