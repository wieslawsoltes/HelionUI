import { parseColor } from './colors.js';
/** Host/GPU ABI. All offsets are 32-bit words; nodes are 288-byte aligned records. */
export const VERSION = 3;
export const Kind = Object.freeze({ Grid: 1, StackPanel: 2, Canvas: 3, Border: 4, TextBlock: 5, Button: 6, CheckBox: 7, Slider: 8, TextBox: 9, ProgressBar: 10, DataGrid: 11, Path: 12, ScrollViewer: 13, Panel: 14, DockPanel: 15, WrapPanel: 16, UniformGrid: 17, Viewbox: 18, Drawing: 19, ContentControl: 20, ContentPresenter: 21, TextEditor:22, CodeEditor:23, DockWorkspace:24, DockItem:25, SurfacePresenter:26, ListBox:27, TreeView:28,Modal:29, DesignSurface:30, DesignTree:31, PropertyInspector:32, AnimationTimeline:33, ColorPicker:34, DesignAdorner:35, NativeContentPresenter:36 });
export const Action = Object.freeze({ none: 0, toggle: 1, increment: 2, set: 3, animations: 4, theme: 5, bounds: 6, clear: 7, page: 8, resetScroll: 9, model:10, editor:11, dock:12, host:13, designer:14, template:15 });
export const Opcode = Object.freeze({ Move: 1, Down: 2, Up: 3, Wheel: 4, Key: 5, Text: 6, Set: 7, Cancel: 8, Animation: 9, Editor:10, Dock:11, Model:12, Data:13, Controls:14, Designer:15, Template:16 });
export const Property = Object.freeze({ value: 0, width: 1, height: 2, opacity: 3, translateX: 4, translateY: 5, scaleX: 6, scaleY: 7, rotation: 8, visible: 9, scrollY: 10, padding: 11, textClear: 12 });
export const Key = Object.freeze({ Backspace: 8, Tab: 9, Enter: 13, Escape: 27, Space: 32, End: 35, Home: 36, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40, Delete: 46, PageUp: 33, PageDown: 34, A:65, C:67, V:86, X:88, D:68, F:70, G:71, H:72, L:76, P:80, Y:89, Z:90, Insert:45, F3:114, Slash:191, BracketLeft:219, BracketRight:221, Equal:187, Minus:189 });
export const Flags = Object.freeze({ interactive: 1, horizontal: 2, wrap: 4, clip: 8, disabled: 16, hidden: 32, editable: 64 });
export const Source = Object.freeze({ none: 0, value: 1, matched: 2, selected: 3, nodes: 4, strips: 5, upload: 6, frame: 7, layout: 8, rows: 9, overflow: 10, activePage: 11 });
export const AUTO_TARGET = 0xffffffff;
export const NODE_WORDS = 72;
export const CONTROL_WORDS = 16;
export const GLOBAL_WORDS = 64;
export const EVENT_WORDS = 8;
export const TABLE_WORDS = 40;
export const COLUMN_WORDS = 8;
export const PATH_WORDS = 12;
export const DEFAULT_LIMITS = Object.freeze({ maxHeapWords: 16777216, maxNodes: 512, maxDepth: 24, maxRows: 65536, maxColumns: 8, textCapacity: 256, maxPrimitives: 16384, maxJobs: 131072, maxStrips: 262144, maxAlphaTiles: 196608, maxTileEntries: 256, maxDimension: 8192, maxRenderTiles: 65536, glyphCacheSlots: 2048 });
// Synchronous numeric conversion uses one scratch word per JS realm, not three
// allocations per coordinate. Coerce before writing: user-defined valueOf may reenter.
const bitScratch = new ArrayBuffer(4), bitFloat = new Float32Array(bitScratch), bitUint = new Uint32Array(bitScratch);
export const fbits = value => { const n = +value; bitFloat[0] = n; return bitUint[0]; };
export const fromBits = bits => { const n = +bits; bitUint[0] = n; return bitFloat[0]; };
export const align = (n, a) => Math.ceil(n / a) * a;
export const nextPowerOfTwo = n => 2 ** Math.ceil(Math.log2(Math.max(1, n)));
export const rgba = parseColor;
export function finite(value, fallback, label = 'number') {
  if (value == null) return fallback;
  const n = Number(value); if (!Number.isFinite(n) || !Number.isFinite(Math.fround(n))) throw new TypeError(`Invalid ${label}: ${value}`); return n;
}
export function tracks(value = '*') {
  const list = Array.isArray(value) ? value : String(value).trim().split(/[ ,]+/);
  if (!list.length || list.length > 32) throw new RangeError('Grid supports 1–32 tracks per axis');
  return list.map(v => {
    if (String(v).toLowerCase() === 'auto') return [1, 0];
    if (String(v).endsWith('*')) { const n = Number(String(v).slice(0, -1) || 1); if (!(n > 0 && Number.isFinite(n) && Number.isFinite(Math.fround(n)))) throw new RangeError('Star weight must be positive'); return [2, n]; }
    const n = Number(v); if (!(n >= 0 && Number.isFinite(n) && Number.isFinite(Math.fround(n)))) throw new RangeError('Pixel track must be nonnegative'); return [0, n];
  });
}
