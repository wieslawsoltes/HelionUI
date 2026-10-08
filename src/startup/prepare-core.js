import { compile } from '../core/compiler.js';
import { loadFonts, DEFAULT_FONT_SOURCES, combiningRanges } from '../text/fonts.js';
import { cacheSignature, compiledDigest, openStartupCache, readStartupCache, writeStartupCache } from './cache.js';

/** Startup-only asset preparation. The returned arrays are INITIAL state, never
 * read back or refreshed from the live surface. All glyphs and plans are retained.
 */
export async function prepareScene(view, options = {}, progress = () => {}) {
  options = { ...options, fontSources: options.fontSources || [DEFAULT_FONT_SOURCES[0]] };
  const stats = { cache: 'disabled', fontMs: 0, compileMs: 0, cacheReadMs: 0, cacheWriteScheduled: false };
  const signature = await cacheSignature(view, options);
  const db = signature ? await openStartupCache() : null;
  try {
    if (db) {
      const begin = performance.now(); progress('cache', 'Checking the lossless startup cache');
      const cached = await readStartupCache(db, signature);
      stats.cacheReadMs = performance.now() - begin; stats.cache = cached ? 'hit' : 'miss';
      if (cached) { db.close(); return { compiled: cached, stats, persisted: Promise.resolve(true) }; }
    } else if (options.startupCache) stats.cache = 'unavailable';
    progress('fonts', 'Loading and decoding real font faces');
    let begin = performance.now();
    const fontTask = options.fonts || (options.font ? undefined : loadFonts(options.fontSources));
    combiningRanges(); // native bulk matching overlaps the in-progress font requests
    const fonts = await fontTask;
    stats.fontMs = performance.now() - begin;
    progress('scene', 'Packing complete font outlines and the retained view'); begin = performance.now();
    const compiled = compile(view, { textShaping:options.textShaping, typographyOperationBudget:options.typographyOperationBudget, limits: options.limits, inputInboxCapacity:options.inputInboxCapacity, styles: options.styles, resources: options.resources, theme:options.theme, themes:options.themes, themeVariant:options.themeVariant, templates:options.templates, reducedMotion:options.reducedMotion, ...(fonts ? { fonts } : { font: options.font }) });
    stats.compileMs = performance.now() - begin;
    let persisted = Promise.resolve(false);
    if (db) {
      const started = performance.now(); const digest = await compiledDigest(compiled);
      stats.cacheDigestMs = performance.now() - started; stats.cacheWriteScheduled = true;
      persisted = writeStartupCache(db, signature, compiled, digest).finally(() => db.close());
    }
    return { compiled, stats, persisted };
  } catch (error) { db?.close(); throw error; }
}
