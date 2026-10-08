import { prepareScene } from './prepare-core.js';
import { DEFAULT_FONT_SOURCES } from '../text/fonts.js';
import { startupWorkerPlan } from './worker-source.js';

/** Prepare on a one-shot worker when permitted; CSP/worker-load failures retain
 * the same compiler on the host. Actual font/compile failures are never hidden.
 */
export async function prepareView(view, options = {}, progress = () => {}) {
  const sources = options.fontSources || [DEFAULT_FONT_SOURCES[0]];
  const base = globalThis.document?.baseURI;
  const fontSources = sources.map(f => {
    if (f.format === 'helion-opentype-1') return f;
    const source = f.source instanceof URL ? f.source.href : typeof f.source === 'string' && base ? new URL(f.source, base).href : f.source;
    return { ...f, source };
  });
  const packed = { textShaping:options.textShaping, typographyOperationBudget:options.typographyOperationBudget, fonts: options.fonts, font: options.font, limits: options.limits, inputInboxCapacity:options.inputInboxCapacity, fontSources, startupCache: options.startupCache, styles: options.styles, resources: options.resources, theme:options.theme, themes:options.themes, themeVariant:options.themeVariant, themeContrast:options.themeContrast, controlDensity:options.controlDensity, accentColor:options.accentColor, templates:options.templates, reducedMotion:options.reducedMotion };
  const mainThread = async reason => {
    progress('host-preparation', reason);
    const hostOptions = options.signal ? { ...packed, fontSources: fontSources.map(f => ({ ...f, signal: f.signal || options.signal })) } : packed;
    const result = await prepareScene(view, hostOptions, progress);
    if (options.signal?.aborted) throw options.signal.reason || new Error('Startup aborted');
    result.stats.worker = false; result.stats.workerFallback = reason;
    return { compiled: result.compiled, stats: result.stats };
  };
  if (options.signal?.aborted) throw options.signal.reason || new Error('Startup aborted');
  if (options.startupWorker === false || typeof Worker === 'undefined' || fontSources.some(f => f.signal)) return mainThread('Preparing assets on the host (worker disabled or unavailable)');
  let worker, blobURL;
  try {
    const plan = startupWorkerPlan({
      embeddedSource: globalThis.__HELION_PREPARE_WORKER_SOURCE__,
      moduleURL: import.meta.url,
      documentURL: globalThis.location?.href || base
    });
    const url = plan.source !== undefined
      ? (blobURL = URL.createObjectURL(new Blob([plan.source], { type: 'text/javascript' })))
      : plan.url;
    worker = new Worker(url, { type: plan.type, name: 'Helion startup compiler' });
  } catch (error) {
    if (blobURL) URL.revokeObjectURL(blobURL);
    return mainThread(`Worker creation unavailable: ${error.message}; using the identical host compiler`);
  }
  let started = false, delivered = false;
  try {
    return await new Promise((resolve, reject) => {
      let timer = null, closed = false;
      const revoke = () => { if (blobURL) { URL.revokeObjectURL(blobURL); blobURL = null; } };
      const cleanup = () => {
        if (closed) return;
        closed = true; clearTimeout(timer); timer = null;
        options.signal?.removeEventListener('abort', abort);
        worker.onmessage = worker.onerror = worker.onmessageerror = null;
        worker.terminate(); revoke();
      };
      const fail = error => { cleanup(); reject(error); };
      const abort = () => fail(options.signal.reason || new Error('Startup aborted'));
      const deadline = (delay, message) => {
        clearTimeout(timer);
        timer = setTimeout(() => fail(new Error(message)), delay);
      };
      worker.onerror = event => { event.preventDefault?.(); fail(new Error(event.message || 'Startup worker failed to load')); };
      worker.onmessageerror = () => fail(new Error('Could not decode the startup worker response'));
      worker.onmessage = event => {
        if (closed) return;
        const message = event.data;
        if (!message || typeof message !== 'object') return;
        if (message.type === 'ready' && !started && !delivered) {
          started = true; revoke(); // The top-level script is loaded; release the Blob URL once.
          deadline(120000, 'Startup preparation exceeded 120 seconds');
          try { worker.postMessage({ view, options: packed }); }
          catch (error) { started = false; fail(error); }
        } else if (message.type === 'progress' && started && !delivered) progress(message.stage, message.detail);
        else if (message.type === 'result' && started && !delivered) {
          delivered = true; clearTimeout(timer);
          timer = setTimeout(cleanup, 2000); // Bounded optional cache write after delivery.
          resolve({ compiled: message.compiled, stats: { ...message.stats, worker: true } });
        } else if (message.type === 'stored' && delivered) cleanup();
        else if (message.type === 'error') {
          const error = new Error(message.message);
          error.name = message.name || 'Error'; error.stack = message.stack || error.stack;
          fail(error);
        }
      };
      deadline(3000, 'Startup worker did not load');
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) abort(); // Covers abort during worker construction.
    });
  } catch (error) {
    if (started || delivered || options.signal?.aborted) throw error;
    return mainThread(`Worker load unavailable: ${error.message}; using the identical host compiler`);
  }
}

/** Public asynchronous declaration compiler. Startup work only; no runtime CPU mirror. */
export async function prepare(view, options = {}) {
  const start = performance.now();
  const result = await prepareView(view, options, (stage, detail) => {
    try { options.onStartup?.({ stage, detail, elapsedMs: performance.now() - start }); }
    catch (error) { console.warn('Helion startup observer failed', error); }
  });
  return result.compiled;
}
