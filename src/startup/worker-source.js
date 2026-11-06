/** Choose a worker entry without routing an embedded script through a module
 * URL or a document import map. The generated bundle has no imports and is a
 * classic script; unbundled source retains a same-origin module worker. */
export function startupWorkerPlan({embeddedSource, bundledURL, moduleURL, documentURL} = {}) {
  if (documentURL) {
    const page = new URL(documentURL);
    if (page.protocol === 'file:' || page.protocol === 'data:') {
      throw new Error('Worker startup requires localhost or HTTPS; file/data documents have isolated origins');
    }
  }
  if (typeof embeddedSource === 'string' && embeddedSource.trim()) {
    return { type: 'classic', source: embeddedSource };
  }
  if (bundledURL != null) {
    const url = new URL(bundledURL, documentURL);
    if (!documentURL || !['http:', 'https:'].includes(url.protocol) || url.origin !== new URL(documentURL).origin) {
      throw new Error('The bundled startup worker must use HTTP(S) and share an origin with the document');
    }
    return { type: 'classic', url };
  }
  let url;
  try { url = new URL('./prepare-worker.js', moduleURL); }
  catch { throw new Error('The embedded startup worker is missing; cannot resolve a worker relative to a bundled module'); }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('A source worker requires an HTTP(S) module URL; serve Helion over localhost or HTTPS');
  }
  if (documentURL && url.origin !== new URL(documentURL).origin) {
    throw new Error('The source worker and document must share an origin; use the self-contained standalone bundle for cross-origin module hosting');
  }
  return { type: 'module', url };
}
