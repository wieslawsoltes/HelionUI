export { parseOpenType, loadFont, loadFonts, DEFAULT_FONT_SOURCES, FontFormatError } from '../index.js';
export type { PreparedFont, FontOptions, FontSource, FontManifest } from '../index.js';
/** Decode a WOFF1 container to an uncompressed SFNT byte array. Does not parse or validate the font outlines. */
export function decodeWOFF(data:ArrayBuffer|ArrayBufferView):Promise<Uint8Array>;
