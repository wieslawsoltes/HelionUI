#!/usr/bin/env python3
"""Loopback-only development launcher; Python standard library, no dependencies."""
import argparse
import functools
import http.server
from pathlib import Path
import sys
import threading
import webbrowser

class LocalHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.mjs': 'text/javascript',
                      '.wgsl': 'text/plain', '.json': 'application/json'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()
    def send_head(self):
        # Serve only paths within this extracted package, including symlinks.
        resolved = Path(self.translate_path(self.path)).resolve()
        try:
            resolved.relative_to(Path(self.directory).resolve())
        except ValueError:
            self.send_error(403, 'Outside package root')
            return None
        return super().send_head()

def main():
    parser = argparse.ArgumentParser(description='Serve this Helion package on 127.0.0.1 (not a production server).')
    parser.add_argument('--port', type=int, default=8080)
    parser.add_argument('--open', action='store_true', help='Open Studio in the default browser')
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('--port must be 1–65535')
    root = Path(__file__).resolve().parent
    if (root / 'helion-designer.html').is_file():
        paths = ['/helion-designer.html', '/helion-playground.html', '/helion-standalone.html', '/helion-typography.html']
    else:
        paths = ['/designer/', '/playground/', '/', '/typography/']
    origin = f'http://127.0.0.1:{args.port}'
    try:
        server = http.server.ThreadingHTTPServer(('127.0.0.1', args.port), functools.partial(LocalHandler, directory=str(root)))
    except OSError as error:
        print(f'Could not start the local server: {error}\nTry a different port, e.g. --port 8081.', file=sys.stderr)
        return 1
    print('Helion development server — keep this window open. Ctrl+C stops it.', flush=True)
    for label, path in zip(['Designer', 'Playground', 'Showcase'], paths):
        print(f'{label}: {origin}{path}', flush=True)
    if args.open:
        timer = threading.Timer(0.25, lambda: webbrowser.open(origin + paths[0]))
        timer.daemon = True
        timer.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0

if __name__ == '__main__':
    sys.exit(main())
