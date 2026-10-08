import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';

export function createStaticServer(root) {
  root = resolve(root);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wgsl': 'text/wgsl; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.png': 'image/png' };
  return createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname.includes('\0')) throw new URIError('Invalid path');
      let path = resolve(root, `.${pathname}`);
      if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403); response.end('Forbidden'); return; }
      if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
      const body = await readFile(path);
      response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      response.writeHead(error instanceof URIError ? 400 : error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500, { 'Content-Type': 'text/plain' });
      response.end(error instanceof URIError ? 'Bad request' : error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 'Not found' : 'Server error');
    }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] || fileURLToPath(new URL('..', import.meta.url)));
  const port = Number(process.env.PORT || 8080), host = process.env.HOST || '127.0.0.1';
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError('Invalid PORT');
  const server = createStaticServer(root);
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(port, host, () => console.log(`Helion: http://${host}:${port}\nRoot: ${root}\nGPU tests: /tests/gpu.html\nHTML declarations: /examples/declarative.html`));
}
