/** Canvas allocation only: never measures controls, shapes text or reads GPU state. */
export function resolutionMode(value = 'native') {
  if (!['native', 'balanced'].includes(value)) throw new TypeError('resolutionMode must be native or balanced');
  return value;
}
export function textQuality(value = 'sharp') {
  if (!['sharp', 'reference'].includes(value)) throw new TypeError('textQuality must be sharp or reference');
  return value;
}
export function pixelObservation(entry) {
  const box = entry?.devicePixelContentBoxSize;
  const item = Array.isArray(box) ? box[0] : box?.[0] ?? box;
  const css = entry?.contentRect;
  if (!item || !css || ![item.inlineSize,item.blockSize,css.width,css.height].every(Number.isFinite) || !(item.inlineSize > 0) || !(item.blockSize > 0)) return null;
  return { w: Math.round(item.inlineSize), h: Math.round(item.blockSize), width: css.width, height: css.height };
}
/** Integer backing pixels, rectangular tile budget. Exact observed device pixels
 * win over CSS×DPR estimates. A caller cap is reported rather than hidden. */
export function resolveViewport(rect, limits, { pixelRatio, devicePixelRatio = 1, resolutionMode: mode = 'native', observation, maxTextureDimension2D = 8192 } = {}) {
  resolutionMode(mode);
  if (pixelRatio != null && (!Number.isFinite(pixelRatio) || pixelRatio <= 0)) throw new RangeError('pixelRatio must be a positive finite number');
  const dimension = value => Number.isFinite(Number(value)) ? Math.max(1, Number(value)) : 1;
  const width = dimension(rect.width), height = dimension(rect.height);
  const requestedDpr = pixelRatio ?? (Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1);
  const observed = mode === 'native' && pixelRatio == null && observation && Math.abs(observation.width - width) < .02 && Math.abs(observation.height - height) < .02;
  const requestedW = observed ? observation.w : Math.max(1, Math.round(width * requestedDpr));
  const requestedH = observed ? observation.h : Math.max(1, Math.round(height * requestedDpr));
  const max = Math.min(limits.maxDimension, maxTextureDimension2D, mode === 'balanced' ? 2048 : Infinity);
  const maxTiles = Math.min(Math.ceil(limits.maxDimension / 16) ** 2, limits.maxRenderTiles ?? Infinity);
  const fits = (w, h) => w <= max && h <= max && Math.ceil(w / 16) * Math.ceil(h / 16) <= maxTiles;
  let w = requestedW, h = requestedH, dpr = requestedDpr;
  const ratioCap = mode === 'balanced' ? Math.min(1, 2 / requestedDpr) : 1;
  if (ratioCap < 1 || !fits(w, h)) {
    // Solve the actual ceil-to-tile allocation, not just a pixel-area estimate.
    let lo = 0, hi = Math.min(ratioCap, max / w, max / h);
    if (fits(Math.max(1,Math.floor(w*hi)),Math.max(1,Math.floor(h*hi)))) lo=hi;
    for (let j = 0; lo !== hi && j < 48; j++) {
      const mid = (lo + hi) * .5;
      if (fits(Math.max(1, Math.floor(w * mid)), Math.max(1, Math.floor(h * mid)))) lo = mid; else hi = mid;
    }
    w = Math.max(1, Math.floor(requestedW * lo)); h = Math.max(1, Math.floor(requestedH * lo));
    dpr = Math.min(w / width, h / height);
  }
  return { width, height, dpr, w, h, tileCols: Math.ceil(w / 16), tileRows: Math.ceil(h / 16),
    requestedDpr, requestedW, requestedH, nativeResolution: w === requestedW && h === requestedH,
    devicePixelBox: !!observed, resolutionMode: mode, maxTiles,
    limitedBy: w === requestedW && h === requestedH ? null : mode === 'balanced' ? 'balanced-policy' : 'configured-capacity' };
}
