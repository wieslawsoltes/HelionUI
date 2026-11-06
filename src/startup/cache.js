// One initial-scene record per origin, never a saved snapshot of mutable GPU state.
// Cache use is opt-in with an application revision key. Local/private fonts are
// deliberately not persisted. Storage denial, blocked databases and eviction miss.
const DATABASE = 'helion-startup-v1';
const REVISION = 'helion-0.15.0-abi3-responsive1';
const MAX_BYTES = 72 * 1024 * 1024;
function canonical(value) {
  if (value === undefined) return ['undefined'];
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new TypeError('Nonfinite cache input'); return Object.is(value, -0) ? ['-0'] : value; }
  if (value instanceof Map) return ['map', [...value].map(([k,v]) => [canonical(k),canonical(v)])];
  if (Array.isArray(value)) return ['array', value.map(canonical)];
  if (Object.getPrototypeOf(value) === Object.prototype) return ['object', Object.keys(value).sort().map(k => [k, canonical(value[k])])];
  throw new TypeError('Cache inputs must be plain declarations and immutable font URLs');
}
const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2,'0')).join('');
export async function cacheSignature(view, options) {
  if (!options.startupCache || typeof options.startupCache !== 'string' || options.startupCache.length > 128 || options.font || options.fonts || !globalThis.crypto?.subtle) return null;
  if (!options.fontSources?.every(f => typeof f.source === 'string' && /^https?:\/\//.test(f.source) && !f.signal)) return null;
  try { return await hash(new TextEncoder().encode(JSON.stringify(canonical({ revision: REVISION, namespace: options.startupCache, textShaping:options.textShaping, typographyOperationBudget:options.typographyOperationBudget, unicodeEngine: globalThis.navigator?.userAgent || 'non-browser', view, limits: options.limits, inputInboxCapacity:options.inputInboxCapacity, styles:options.styles, resources:options.resources, theme:options.theme, themes:options.themes, themeVariant:options.themeVariant, themeContrast:options.themeContrast, controlDensity:options.controlDensity, accentColor:options.accentColor, templates:options.templates, reducedMotion:options.reducedMotion, fonts: options.fontSources })))); }
  catch { return null; }
}
export async function compiledDigest(compiled) {
  const { nodes, state, heap, ...metadata } = compiled;
  const parts = await Promise.all([hash(nodes), hash(state), hash(heap)]);
  parts.push(JSON.stringify(canonical(metadata)));
  return hash(new TextEncoder().encode(parts.join('|')));
}
export function validCachedScene(value) {
  if (!value || value.version !== 3 || !(value.nodes instanceof Uint8Array) || !(value.state instanceof Uint32Array) || !(value.heap instanceof Uint32Array) || !(value.ids instanceof Map)) return false;
  if (!Number.isInteger(value.nodeCount) || value.nodeCount < 1 || value.nodeCount > 512 || value.nodes.byteLength !== value.nodeCount * 288 || value.state.length !== 64 + value.nodeCount * 16) return false;
  if (!value.limits || value.heap.length > value.limits.maxHeapWords || value.heap.byteLength + value.nodes.byteLength + value.state.byteLength > MAX_BYTES) return false;
  return Array.isArray(value.fonts) && Array.isArray(value.tables) && Array.isArray(value.declarations);
}
export async function openStartupCache() {
  if (!globalThis.indexedDB) return null;
  return new Promise(resolve => {
    let settled = false, request;
    const finish = value => { if (settled) { value?.close(); return; } settled = true; clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => finish(null), 250);
    try {
      request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('scene');
      request.onblocked = () => finish(null); request.onerror = () => finish(null);
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); finish(request.result); };
    } catch { finish(null); }
  });
}
export async function readStartupCache(db, signature) {
  if (!db || !signature) return null;
  const record = await new Promise(resolve => {
    let settled = false, tx;
    const finish = value => { if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => { try { tx?.abort(); } catch {} finish(null); }, 250);
    try {
      tx = db.transaction('scene', 'readonly'); const r = tx.objectStore('scene').get('latest');
      r.onsuccess = () => finish(r.result); r.onerror = () => finish(null); tx.onabort = () => finish(null);
    } catch { finish(null); }
  });
  if (record?.signature !== signature || !validCachedScene(record.compiled)) return null;
  try { if (await compiledDigest(record.compiled) !== record.digest) return null; } catch { return null; }
  return record.compiled;
}
/** put() clones synchronously before the worker transfers its output buffers. */
export function writeStartupCache(db, signature, compiled, digest) {
  if (!db || !signature || !validCachedScene(compiled)) return Promise.resolve(false);
  return new Promise(resolve => {
    let tx, settled = false;
    const finish = value => { if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
    const timer = setTimeout(() => { try { tx?.abort(); } catch {} finish(false); }, 1500);
    try {
      tx = db.transaction('scene', 'readwrite'); tx.oncomplete = () => finish(true); tx.onerror = tx.onabort = () => finish(false);
      tx.objectStore('scene').put({ signature, digest, compiled }, 'latest');
    } catch { finish(false); }
  });
}
export async function clearStartupCache() {
  const db = await openStartupCache(); if (!db) return false;
  try {
    return await new Promise(resolve => {
      let tx, settled = false;
      const finish = value => { if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
      const timer = setTimeout(() => { try { tx?.abort(); } catch {} finish(false); }, 1500);
      try {
        tx = db.transaction('scene', 'readwrite'); tx.oncomplete = () => finish(true); tx.onerror = tx.onabort = () => finish(false);
        tx.objectStore('scene').clear();
      } catch { finish(false); }
    });
  } finally { db.close(); }
}
