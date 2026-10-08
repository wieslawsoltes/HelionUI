#!/bin/sh
# macOS/Linux: run from any working directory, including paths with spaces.
set -eu
cd -- "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if command -v python3 >/dev/null 2>&1; then
  exec python3 ./serve-helion.py --open "$@"
fi
printf '%s\n' 'Python 3 is required for this launcher. With Node installed, the source package also supports npm start.' >&2
exit 1
