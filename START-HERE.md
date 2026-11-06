# Helion UI 0.15.0-experimental

Do not open the HTML apps directly from Finder/Explorer. The app will show local
server instructions without trying workers or GPU startup from a file origin.

## Quick start (Python 3)

macOS: `sh ./start-helion.command`
Windows: run `start-helion.cmd`
Linux: `sh ./start-helion.sh`

The launcher starts a loopback-only server, opens Studio and prints links to all
four apps. Keep its terminal open. It accepts `--port 8081` when 8080 is busy.

Manual alternative: run `python3 -m http.server 8080 --bind 127.0.0.1` from the
extracted app folder. For standalone packages open:

- http://127.0.0.1:8080/helion-designer.html
- http://127.0.0.1:8080/helion-playground.html
- http://127.0.0.1:8080/helion-standalone.html
- http://127.0.0.1:8080/helion-typography.html

## Source checkout

Run `npm start` in the `helion-ui` directory. Open `/designer/`, `/playground/`,
`/typography/`, or `/`. No runtime npm installation is required. `npm run build` produces the
static site and four standalone HTML apps. `npm test`, `npm run check`, and
`npm run check:build` perform the host/source/bundle checks.

Code, shaders and workers are embedded in standalone HTML; fonts are not.
Configured fonts load at runtime, or choose local static fonts with the app's
font controls. Use complete replacement files from the same version.

The watchdog Illegal invocation was reproduced and its repair tested with real
Chromium timers. The embedded worker also passed an isolated real-browser test.
The current browser repair also verifies served apps and native GPU execution.
See `docs/browser-pipeline-repair.md` for the measured adapter and exact scope,
and `docs/worker-launch-repair.md` for the earlier worker repair.

Studio now includes a Templates dock pane for assignment, theme switching, JSON
definition editing and visual part editing. In the playground choose the new
Control templates example. Read docs/TEMPLATES.md for the supported contract and
explicit limits; these are original Fluent/macOS-inspired themes, not native OS
materials. Native pixel checks cover the fixtures listed in the browser repair audit.

0.14 adds Studio contrast/density/accent/motion settings and state previews. In the
playground, choose Theme lab · contrast, density & accent. These are GPU-rendered
template controls; consult docs/THEME-REFINEMENT.md for the APIs and limits.

0.15 adds retained OpenType shaping and paragraph layout. Read docs/TYPOGRAPHY.md
for integration, reusable API, capacities, validation and remaining limitations.
