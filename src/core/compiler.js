import {packUITypography} from '../typography/ui-pack.js';
import {packDesignerTemplates} from '../designer/template-pack.js';
import {expandTemplates} from '../templates/expand.js';
import {packTemplates} from '../templates/pack.js';
import {expandDesigners} from '../designer/document.js';
import {packDesigners} from '../designer/pack.js';
import {DesignCommand} from '../designer/schema.js';
import {ACTION_EVENT_CAPACITY} from '../controls/index.js';
import {packList} from '../controls/pack.js';
import {normalizeItemsSource} from '../data/index.js';
import {packDataSource} from '../data/pack.js';
import { packEditor } from '../editor/pack.js';
import { EditorCommand } from '../editor/schema.js';
import { packDocks } from '../docking/pack.js';
import { DockCommand } from '../docking/index.js';
import { packModels } from '../models/pack.js';
import { h } from './declaration.js';
import { normalizeProperties } from '../layout/properties.js';
import { styleTree } from '../styling/styles.js';
import { packNodeExtension, packAnimation, packDrawing, easingCode } from './extensions.js';
import { VERSION, Action, AUTO_TARGET, COLUMN_WORDS, CONTROL_WORDS, DEFAULT_LIMITS, Flags, GLOBAL_WORDS, Kind, NODE_WORDS, PATH_WORDS, Source, TABLE_WORDS, fbits, finite, nextPowerOfTwo, rgba, tracks } from './schema.js';
import { parsePath, pathBounds } from '../render/paths.js';
import { diagnosticFont, packFonts, selectFace, combiningRanges } from '../text/fonts.js';
export { h };
export class HeapBuilder {
  constructor(maxWords = 16777216) {
    if (!Number.isSafeInteger(maxWords) || maxWords < 4) throw new RangeError('Invalid heap capacity');
    this.maxWords = maxWords; this.length = 4;
    this.words = new Uint32Array(Math.min(maxWords, 65536)); this.floatWords = new Float32Array(this.words.buffer); this.strings = new Map();
  }
  alloc(length) {
    const at = this.length, required = at + length;
    if (!Number.isSafeInteger(length) || length < 0 || required > this.maxWords) throw new RangeError('Invalid heap allocation');
    if (required > this.words.length) {
      const next = new Uint32Array(Math.min(this.maxWords, Math.max(required, this.words.length * 2)));
      next.set(this.words); this.words = next; this.floatWords = new Float32Array(next.buffer);
    }
    // Allocations are append-only. Typed-array growth is already zero initialized.
    this.length = required; return at;
  }
  set(at, values) {
    if (!Number.isSafeInteger(at) || at < 0 || at + values.length > this.length) throw new RangeError('Heap write exceeds allocated range');
    this.words.set(values, at); return at;
  }
  push(values) { return this.set(this.alloc(values.length), values); }
  finish() { return this.words.slice(0, this.length); }
  string(text, capacity = 0, prefixed = false) {
    text = String(text); const codes = Array.from(text, c => c.codePointAt(0));
    if (capacity && codes.length > capacity) throw new RangeError(`Text exceeds capacity ${capacity}`);
    const key = `${prefixed ? 1 : 0}:${text}`;
    if (!capacity && this.strings.has(key)) return this.strings.get(key);
    const at = this.alloc(Math.max(capacity, codes.length, 1) + (prefixed ? 1 : 0));
    this.set(at, prefixed ? [codes.length, ...codes] : codes);
    const r = [at, codes.length]; if (!capacity) this.strings.set(key, r); return r;
  }
}
function margin(value) {
  if (Array.isArray(value)) { if (![1, 2, 4].includes(value.length)) throw new RangeError('Margin requires 1, 2 or 4 values'); const a = value.map(x => finite(x, 0)); return a.length === 1 ? [a[0], a[0], a[0], a[0]] : a.length === 2 ? [a[0], a[1], a[0], a[1]] : a; }
  const n = finite(value, 0); return [n, n, n, n];
}
const alignment = { stretch: 0, start: 1, center: 2, end: 3 };
const known = new Set(('textShaping shapingCapacity fontFeatures fontScript fontLanguage flowDirection id text width height minWidth minHeight maxWidth maxHeight padding gap margin background foreground borderColor radius borderWidth horizontalAlignment verticalAlignment column row columnSpan rowSpan columns rows x y fontSize fontFamily fontWeight fontStyle kerning ligatures letterSpacing lineHeight textAlignment textDecoration orientation wrap clip disabled hidden editable value opacity translateX translateY scaleX scaleY rotation action bind page path stroke fillRule viewBox animations data dataColumns itemsSource dataSource rowKey rowCapacity items itemCapacity itemTextCapacity textCapacity changeAction presenterWidth presenterHeight rowCount rowHeight filter activeOnly minViewportWidth maxViewportWidth dock lastChildFill firstColumn scrollHorizontal minColumnWidth itemWidth itemHeight stretch stretchDirection renderTransform renderTransformOrigin right bottom rowSpacing columnSpacing stateStyles transitions drawing zIndex useLayoutRounding documentCapacity historyCapacity language completions readOnly wordWrap minimap tabSize editorLineHeight lineNumbers renderWhitespace autoClosingBrackets dockLayout dockBreakpoint dockPrimary title closed canClose models modelBind designDocument designTarget designSlot designSource designRole template templatePart templateInstance templateExpressions templateSystem theme themes themeVariant templates controlThemes reducedMotion').split(' '));
/** Shared validation, before allocating or requesting a GPU device. */
export function validatedLimits(overrides) {
  const limits = { ...DEFAULT_LIMITS, ...overrides };
  for (const [key, value] of Object.entries(limits)) if (!Object.hasOwn(DEFAULT_LIMITS, key) || !Number.isSafeInteger(value) || value < 1 || value > 0x3fffffff) throw new RangeError(`Invalid limit ${key}`);
  if (limits.maxRows > 65536 || limits.maxDepth > 30 || limits.maxNodes > 512 || limits.maxColumns > 8 || limits.textCapacity > 1024 || limits.maxDimension > 8192 || limits.maxRenderTiles > 262144) throw new RangeError("Limits exceed this kernel ABI variant");
  if (limits.glyphCacheSlots > 8192 || (limits.glyphCacheSlots & (limits.glyphCacheSlots - 1))) throw new RangeError('glyphCacheSlots must be a power of two, at most 8192');
  return limits;
}
/** Compile declarations and immutable assets once. No CPU measure/arrange or runtime view diff lives here. */
export function compile(view, options = {}) {
  const limits = validatedLimits(options.limits); const editors=[],lists=[],labels=[],hostActions=[],presenters=[];
  view = styleTree(expandTemplates(styleTree(expandDesigners(view), {...options,limits}), options), {...options,limits});
  const heap = new HeapBuilder(limits.maxHeapWords);
  const list = [], ids = new Map(), tables = [], paths = [], animationRecords = [];
  const visit = (v, parent = AUTO_TARGET, depth = 0) => {
    if (!v || !Object.hasOwn(Kind, v.type) || !Array.isArray(v.children)) throw new TypeError('Use h() to build a view');
    if (depth > limits.maxDepth) throw new RangeError(`Tree exceeds ${limits.maxDepth} levels`);
    if (list.length >= limits.maxNodes) throw new RangeError(`Tree exceeds ${limits.maxNodes} nodes`);
    for (const k of Object.keys(v.props)) if (!known.has(k)) throw new TypeError(`Unsupported ${v.type} property: ${k}`);
    const index = list.length, id = v.props.id ?? `node-${index}`;
    if (typeof id !== "string" || !id.length) throw new TypeError("View id must be a nonempty string");
    if (ids.has(id)) throw new TypeError(`Duplicate id: ${id}`);
    ids.set(id, index); const n = { ...v, id, index, parent, depth, childIds: [] }; list.push(n);
    const children=v.children.map((view,order)=>({view,order,z:finite(view.props.zIndex,0)}));
    const indexes=new Array(children.length);for(const item of children.sort((a,b)=>a.z-b.z||a.order-b.order))indexes[item.order]=visit(item.view,index,depth+1);
    n.childIds=indexes;return index;
  };
  visit(view);
  const buffer = new ArrayBuffer(list.length * NODE_WORDS * 4), u = new Uint32Array(buffer), f = new Float32Array(buffer);
  const state = new Uint32Array(GLOBAL_WORDS + list.length * CONTROL_WORDS);
  state[0] = state[1] = state[2] = AUTO_TARGET; state[3] = state[4] = state[5] = 1;
  state[14] = state[24] = state[25] = state[26] = state[27] = state[29] = AUTO_TARGET;
  state[49] = 1; // Retained table order starts dirty; independent from filter changes.
  state[37] = list.length; state[39] = limits.textCapacity;
  const resolve = id => { if (id == null) return AUTO_TARGET; if (!ids.has(id)) throw new ReferenceError(`Unknown view id: ${id}`); return ids.get(id); };
  const fonts = options.fonts || [options.font?.format === 'helion-opentype-1' ? options.font : diagnosticFont(options.font)];
  if (!Array.isArray(fonts) || !fonts.length || fonts.length > 8) throw new TypeError('Supply 1–8 prepared font faces');
  const addPath = (segments, stroke, bounds, fillRule = 0, fontPath = false) => {
    if (segments.length > 1024) throw new RangeError('A path supports at most 1024 source segments');
    segments = parsePath(segments);
    if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite) || bounds[2] < bounds[0] || bounds[3] < bounds[1] || stroke < 0) throw new RangeError("Invalid path bounds or stroke");
    const data = heap.alloc(segments.length * 12);
    // Write normalized source coordinates directly through the f32 heap view.
    // Same rounding/bits as fbits(), without temporary slices/maps per segment.
    for (let i = 0; i < segments.length; i++) {
      const at = data + i * 12, segment = segments[i]; heap.words[at] = segment[0];
      for (let j = 1; j < 9; j++) heap.floatWords[at + j] = segment[j];
    }
    // Curves are flattened on the GPU; reserve a bounded 32 lines per source curve.
    const capacity = Math.max(1, segments.reduce((a, s) => {
      if (!fontPath || !s[0]) return a + (s[0] ? 32 : 1);
      const length = (x,y) => Math.hypot(x,y);
      const bend = s[0] === 1 ? length(s[1]-2*s[3]+s[5], s[2]-2*s[4]+s[6]) : Math.max(length(s[1]-2*s[3]+s[5],s[2]-2*s[4]+s[6]),length(s[3]-2*s[5]+s[7],s[4]-2*s[6]+s[8]));
      // Conservative slack around the same WGSL bound, not CPU tessellation.
      return a + Math.max(1, Math.min(32, Math.ceil(Math.sqrt(bend / (s[0] === 1 ? .003 : .0015))) + 2));
    }, 0));
    const flat = heap.alloc(capacity * 4), meta = heap.alloc(PATH_WORDS);
    heap.set(meta, [data, segments.length, flat, capacity, 0, fbits(stroke || 0), ...bounds.map(fbits), fillRule, fontPath ? 1 : 0]);
    paths.push(meta); return meta;
  };
  const packedFonts = packFonts(heap, fonts, addPath);
  state[32] = packedFonts.pointers.get(fonts[0]);
  state[54] = packedFonts.composition; state[55] = packedFonts.compositionCount;
  const marks = combiningRanges(); state[56] = heap.push(marks); state[57] = marks.length / 2;
  const styles = new Map();
  for (const n of list) {
    const parent = n.parent === AUTO_TARGET ? {} : list[n.parent].typography;
    const p = n.props;
    n.typography = { shaping:p.textShaping??parent.shaping??options.textShaping??'auto', shape:{features:p.fontFeatures??parent.shape?.features,script:p.fontScript??parent.shape?.script,language:p.fontLanguage??parent.shape?.language,direction:p.flowDirection??parent.shape?.direction}, family: p.fontFamily ?? parent.family ?? fonts[0].family, weight: Number(p.fontWeight ?? parent.weight ?? 400), style: p.fontStyle ?? parent.style ?? 'normal',
      size: finite(p.fontSize, parent.size ?? 14), kerning: p.kerning ?? parent.kerning ?? true, ligatures: p.ligatures ?? parent.ligatures ?? true,
      spacing: finite(p.letterSpacing, parent.spacing ?? 0), lineHeight: finite(p.lineHeight, parent.lineHeight ?? 0), alignment: p.textAlignment ?? parent.alignment ?? 'left', decoration: p.textDecoration ?? parent.decoration ?? 'none' };
    const t = n.typography;
    if (typeof t.kerning !== 'boolean' || typeof t.ligatures !== 'boolean' || !Number.isInteger(t.weight) || t.weight < 1 || t.weight > 1000 || !['normal','italic','oblique'].includes(t.style) || !(t.size > 0 && t.size <= 1024) || t.lineHeight < 0 || !['left','center','right','start','end'].includes(t.alignment) || !['none','underline','line-through','underline line-through'].includes(t.decoration)) throw new RangeError('Invalid typography style');
    const primary = selectFace(fonts, t.family, t.weight, t.style), chain = [primary];
    const requestedFamilies = String(t.family).split(',').map(s => s.trim().replace(/^['\"]|['\"]$/g, ''));
    for (const family of new Set([...requestedFamilies, ...fonts.map(f => f.family)])) { const face = selectFace(fonts, family, t.weight, t.style); if (!chain.includes(face)) chain.push(face); }
    const signature = JSON.stringify([chain.map(f => packedFonts.pointers.get(f)),t.kerning,t.ligatures,t.spacing,t.lineHeight,t.alignment,t.decoration]);
    if (!styles.has(signature)) {
      const decoration = (t.decoration.includes('underline') ? 1 : 0) | (t.decoration.includes('line-through') ? 2 : 0);
      styles.set(signature, heap.push([chain.length, heap.push(chain.map(f => packedFonts.pointers.get(f))), (t.kerning ? 1 : 0) | (t.ligatures ? 2 : 0), fbits(t.spacing), fbits(t.lineHeight), Math.max(0,['left','center','right'].indexOf(t.alignment)), decoration, 0]));
    }
    n.fontStylePointer = styles.get(signature); n.primaryFont = primary; n.fontChain=chain;
  }
  for (const n of list) {
    const p = n.props, o = n.index * NODE_WORDS, s = GLOBAL_WORDS + n.index * CONTROL_WORDS;
    if (['Viewbox','ContentControl','ContentPresenter'].includes(n.type) && n.childIds.length > 1) throw new RangeError(`${n.type} accepts one child`);
    const trackLimits = [];
    const putU = (offset, values) => u.set(values, o + offset), putF = (offset, values) => f.set(values, o + offset);
    let flags = 0;
    if ([Kind.Button, Kind.CheckBox, Kind.Slider, Kind.TextBox, Kind.DataGrid, Kind.ScrollViewer,Kind.TextEditor,Kind.CodeEditor,Kind.DockWorkspace,Kind.DockItem,Kind.SurfacePresenter,Kind.ListBox,Kind.TreeView,Kind.Modal,Kind.DesignSurface,Kind.DesignTree,Kind.PropertyInspector,Kind.AnimationTimeline,Kind.ColorPicker].includes(Kind[n.type])) flags |= Flags.interactive;
    if (p.orientation === 'horizontal') flags |= Flags.horizontal;
    if (p.wrap) flags |= Flags.wrap;
    if (p.clip !== false) flags |= Flags.clip;
    if (p.disabled) flags |= Flags.disabled;
    if (p.hidden) flags |= Flags.hidden;
    if (p.editable) flags |= Flags.editable;
    const editable = n.type === 'TextBox';
    const [textAt, textLength] = heap.string(['TextEditor','CodeEditor'].includes(n.type)?'':p.text || '', editable ? limits.textCapacity : (p.textCapacity??0));
    putU(0, [Kind[n.type], n.parent, heap.push(n.childIds.length ? n.childIds : [0]), n.childIds.length]);
    putU(4, [n.depth, flags, textAt, textLength]);
    const width = p.width === 'auto' ? -1 : finite(p.width, -1), height = p.height === 'auto' ? -1 : finite(p.height, -1);
    const minW = finite(p.minWidth, 0), minH = finite(p.minHeight, 0), maxW = finite(p.maxWidth, 1e7), maxH = finite(p.maxHeight, 1e7);
    if (minW < 0 || minH < 0 || maxW < minW || maxH < minH || width < -1 || height < -1) throw new RangeError('Invalid size constraints');
    putF(8, [width, height, minW, minH]);
    putF(12, [maxW, maxH, Math.max(0, finite(Array.isArray(p.padding) ? 0 : p.padding, 0)), Math.max(0, finite(p.gap, 0))]);
    putF(16, margin(p.margin));
    const bg = p.background == null && ['Button', 'TextBox'].includes(n.type) ? '#1b2a3a' : p.background;
    putU(20, [rgba(bg), rgba(p.foreground, rgba('#dbe8f4')), rgba(p.borderColor), fbits(finite(p.radius, 0))]);
    if (p.orientation != null && !['horizontal', 'vertical'].includes(p.orientation)) throw new TypeError('Unknown orientation');
    if (p.fillRule != null && !['evenodd', 'nonzero'].includes(p.fillRule)) throw new TypeError('Unknown fill rule');
    const ax = alignment[p.horizontalAlignment || 'stretch'], ay = alignment[p.verticalAlignment || 'stretch'];
    if (!Object.hasOwn(alignment, p.horizontalAlignment || 'stretch') || !Object.hasOwn(alignment, p.verticalAlignment || 'stretch')) throw new TypeError('Unknown alignment');
    const col = Math.max(0, finite(p.column, 0)), row = Math.max(0, finite(p.row, 0));
    if (!Number.isInteger(col) || !Number.isInteger(row)) throw new TypeError('Grid indices must be integers');
    putU(24, [ax, ay, col, row]);
    if (n.type === 'Grid') {
      const expand = (value, axis) => {
        if (!Array.isArray(value) || !value.some(t=>t && typeof t==='object')) return tracks(value);
        const defs=value.map(t=>t && typeof t==='object'?t:{length:t});
        trackLimits[axis]=defs.map(t=>{ const lo=finite(t.min,0),hi=finite(t.max,1e7);if(lo<0||hi<lo)throw new RangeError('Invalid track constraints');return [lo,hi]; });
        return tracks(defs.map(t=>t.length ?? t.width ?? t.height ?? '*'));
      };
      const cols = expand(p.columns,0), rows = expand(p.rows,1);
      const store = a => heap.push(a.flatMap(([type, weight]) => [type, fbits(weight), 0, 0]));
      putU(28, [store(cols), cols.length, store(rows), rows.length]);
      for (const childId of n.childIds) {
        const cp = list[childId].props;
        const cc = Number(cp.column || 0), rr = Number(cp.row || 0), cs = Number(cp.columnSpan || 1), rs = Number(cp.rowSpan || 1);
        if (!Number.isInteger(cs) || !Number.isInteger(rs) || cs < 1 || rs < 1 || cc + cs > cols.length || rr + rs > rows.length) throw new RangeError('Child exceeds declared Grid tracks');
      }
    }
    putF(32, [finite(p.x, 0), finite(p.y, 0), n.typography.size, finite(p.borderWidth, 0)]);
    u[o + 71] = n.fontStylePointer;
    if(p.textCapacity!=null){if(!['TextBlock','Button','CheckBox','TextBox'].includes(n.type)||!Number.isInteger(p.textCapacity)||p.textCapacity<1||p.textCapacity>65536)throw new RangeError('textCapacity is 1–65536 on label controls');u[o+68]=editable?limits.textCapacity:p.textCapacity;labels.push({node:n.index,capacity:u[o+68],text:textAt});}
    if(n.type==='ListBox'||n.type==='TreeView'){if(lists.length>=8)throw new RangeError('At most eight retained lists per surface');if(p.filter&&list[resolve(p.filter)].type!=='TextBox')throw new TypeError('List filter requires a TextBox');const meta=packList(heap,p,resolve,lists.length);u[o+68]=meta.pointer;lists.push({...meta,node:n.index});}
    if(n.type==='SurfacePresenter'){if(presenters.length)throw new RangeError('One embedded SurfacePresenter per surface');const w=Number(p.presenterWidth??0),h=Number(p.presenterHeight??0);if(!Number.isFinite(w)||!Number.isFinite(h)||!((w===0&&h===0)||(w>=32&&h>=32&&w<=4096&&h<=4096)))throw new RangeError('Presenter dimensions must both be zero (Fit), or 32–4096');const meta=heap.push([fbits(w),fbits(h),0,0,0,0,0,0]);u[o+68]=meta;presenters.push({node:n.index,pointer:meta,width:w,height:h});}
    const action = typeof p.action === 'string' ? { type: p.action } : p.action || { type: 'none' };
    if (!Object.hasOwn(Action, action.type)) throw new TypeError(`Unknown GPU action ${action.type}`);
    putU(36, [Action[action.type], resolve(action.target), fbits(finite(action.value, 1)), 0]);
    const binding = p.bind || {};
    if (binding.metric && !Object.hasOwn(Source, binding.metric)) throw new TypeError(`Unknown metric ${binding.metric}`);
    putU(40, [resolve(binding.source), binding.metric ? Source[binding.metric] : binding.source ? Source.value : 0, fbits(finite(binding.scale, 1)), fbits(finite(binding.offset, 0))]);
    putF(44, [finite(p.columnSpan, 1), finite(p.rowSpan, 1), finite(p.page, -1), 0]);
    putF(60, [1, 0, 0, 1]); putF(64, [0, 0, 1, 0]);
    state[s] = fbits(finite(p.value, 0)); state[s + 3] = fbits(finite(p.opacity, 1));
    state[s + 4] = textLength; state[s + 5] = state[s + 6] = textLength;
    [p.translateX, p.translateY, p.scaleX, p.scaleY, p.rotation].forEach((v, j) => state[s + 8 + j] = fbits(finite(v, j === 2 || j === 3 ? 1 : 0)));
    if (n.type === 'TextEditor'||n.type==='CodeEditor') { if(editors.length>=8)throw new RangeError('At most eight editors per surface');const doc=packEditor(heap,p,n.type);u[o+68]=doc.pointer;editors.push({...doc,node:n.index,id:n.id});u[o+6]=heap.push(['Ln','Col','Carets','GPU · LF','Read only','Find','Replace','matches','Go to line','Command'].map(t=>heap.string(t,0,true)[0]));u[o+7]=0; }
    if(p.changeAction!=null){if(!['TextEditor','CodeEditor'].includes(n.type)||typeof p.changeAction!=='string'||!p.changeAction||p.changeAction.length>128)throw new TypeError('changeAction requires an editor and an action name');let token=hostActions.indexOf(p.changeAction);if(token<0){token=hostActions.length;hostActions.push(p.changeAction);}heap.words[u[o+68]+77]=token+1;editors[editors.length-1].changeAction=p.changeAction;}
    if(action.type==='host'){if(typeof action.name!=='string'||!action.name||action.name.length>128)throw new TypeError('Host action name required');let token=hostActions.indexOf(action.name);if(token<0){token=hostActions.length;hostActions.push(action.name);}u[o+37]=token+1;}
    if(action.type==='designer'){if(!(action.command in DesignCommand))throw new TypeError('Unknown designer action');u[o+38]=DesignCommand[action.command];u[o+39]=heap.push([fbits(finite(action.value,0)),fbits(finite(action.extra,0))]);}
    if(action.type==='editor'){if(!(action.command in EditorCommand))throw new TypeError('Unknown editor action');u[o+38]=EditorCommand[action.command];}
    if(action.type==='dock'){if(!(action.command in DockCommand))throw new TypeError('Unknown dock action');u[o+38]=DockCommand[action.command];}
    if (n.type === 'Drawing') u[o+68] = packDrawing(heap, p.drawing, addPath, n.primaryFont);
    const extension = packNodeExtension(heap, p, n.type, u, state, n.index, trackLimits); f[o+47] = extension;
    if (extension && heap.words[extension+25]) state[59]++;
    if (n.type === 'Path') {
      const segs = parsePath(p.path || ''); const bounds = p.viewBox || pathBounds(segs);
      const meta = addPath(segs, finite(p.stroke, 0), bounds, p.fillRule === 'evenodd' ? 1 : 0); putU(68, [meta, 0, 0, 0]);
    }
    putU(69, [fbits(finite(p.minViewportWidth, 0)), fbits(finite(p.maxViewportWidth, 1e7)), n.fontStylePointer]);
    const properties = { translateX: 8, translateY: 9, scaleX: 10, scaleY: 11, rotation: 12, opacity: 3 };
    const animated = new Set();
    for (const a of p.animations || []) {
      if (!Object.hasOwn(properties, a.property)) throw new TypeError('Only retained composition properties are animatable');
      if (animated.has(a.property)) throw new TypeError(`Conflicting animations on one property ${a.property}`);
      animated.add(a.property);
      const duration=finite(a.duration,a.expression?1:NaN); if(!(duration>0))throw new RangeError('Animation duration must be positive');
      const extra=packAnimation(heap,a,resolve,state[s+properties[a.property]]);
      if(extra.mode&&a.speed!=null)throw new TypeError('speed references are supported by legacy from/to animations only; extended timelines use their own clock');
      animationRecords.push([n.index, properties[a.property], fbits(finite(a.from,0)), fbits(finite(a.to,1)), fbits(duration), fbits(finite(a.delay,0)), a.repeat===false?0:1, a.alternate===false?0:1, easingCode(a.easing||'smooth'), resolve(a.speed), extra.pointer, extra.mode]);
    }
    if (n.type === 'DataGrid') {
      if (tables.length) throw new RangeError('This experimental surface supports one DataGrid; use another surface for a second independent table');
      if (p.filter && list[resolve(p.filter)].type !== "TextBox") throw new TypeError("DataGrid filter must target a TextBox");
      if (p.activeOnly && list[resolve(p.activeOnly)].type !== "CheckBox") throw new TypeError("DataGrid activeOnly must target a CheckBox");
      if(p.itemsSource!=null&&p.dataSource!=null)throw new TypeError('Use ItemsSource or dataSource, not both');
      const source=(p.itemsSource??p.dataSource)!=null?normalizeItemsSource(p.itemsSource??p.dataSource,p):null;
      if(source&&p.data!=null)throw new TypeError('Use ItemsSource or legacy data, not both');
      if(source&&source.capacity>limits.maxRows)throw new RangeError('DataSource capacity exceeds surface maxRows');
      const columns = source?.columns || p.dataColumns || [
        { title: 'Resource', field: 'name', type: 'text', width: 215 }, { title: 'Group', field: 'group', type: 'text', width: 118 },
        { title: 'Status', field: 'status', type: 'status', width: 105 }, { title: 'Latency', field: 'latency', type: 'number', width: 98, editable: true },
        { title: 'Ops / sec', field: 'ops', type: 'number', width: 108, editable: true }, { title: 'Utilization', field: 'load', type: 'progress', width: 150 }
      ];
      if (columns.length < 1 || columns.length > limits.maxColumns) throw new RangeError(`DataGrid supports 1–${limits.maxColumns} columns`);
      if (p.dataColumns && !p.data && !source) throw new TypeError("Custom columns require data; the demo generator has a fixed schema");
      const rowCount = source ? source.rows.length : p.data ? p.data.length : finite(p.rowCount, 16384);
      if (!Number.isSafeInteger(rowCount) || rowCount < 0 || rowCount > limits.maxRows) throw new RangeError(`DataGrid supports 0–${limits.maxRows} rows`);
      const rowHeight = finite(p.rowHeight, 38); if (rowHeight < 24 || rowHeight > 200) throw new RangeError("rowHeight must be 24–200 CSS pixels");
      const count = nextPowerOfTwo(source?.capacity??rowCount), meta = heap.alloc(TABLE_WORDS), colAt = heap.alloc(columns.length * COLUMN_WORDS);
      const rowsAt = heap.alloc(count * 8), orderAt = heap.alloc(count), maskAt = heap.alloc(count), prefixAt = heap.alloc(count);
      const sortedAt = heap.alloc(count), mergeAt = heap.alloc(count);
      const blockCount = Math.ceil(count / 128), sumsAt = heap.alloc(blockCount), blockPrefixAt = heap.alloc(blockCount);
      columns.forEach((c, k) => {
        const [titleAt, titleLength] = heap.string(c.title || c.field || `Column ${k + 1}`);
        const type = { text: 0, number: 1, status: 2, progress: 3, boolean: 4 }[c.type || 'text'];
        if (!['text', 'number', 'status', 'progress', 'boolean'].includes(c.type || 'text')) throw new TypeError('Unknown column type');
        const min = finite(c.minWidth, 56), max = finite(c.maxWidth, 600), width = finite(c.width, 120);
        if (!(min > 0 && max >= min && width >= min && width <= max)) throw new RangeError('Invalid column width');
        heap.set(colAt + k * 8, [titleAt, titleLength, type, k, fbits(width), fbits(min), fbits(max), c.editable ? 1 : 0]);
        if (p.data) p.data.forEach((r, j) => { const v = r[c.field]; const cell = type === 0 ? heap.string(v ?? '', 0, true)[0] : fbits(finite(v, 0)); heap.words[rowsAt + j * 8 + k] = cell; });
      });
      const dictionary = ['Aurora', 'Borealis', 'Cascade', 'Cirrus', 'Delta', 'Ember', 'Flux', 'Helix', 'Kestrel', 'Nebula', 'Orion', 'Pulsar', 'Compute', 'Storage', 'Network', 'Render'];
      const dictionaryAt = heap.push(dictionary.map(t => heap.string(t, 0, true)[0]));
      heap.set(meta, [rowCount, count, columns.length, rowsAt, orderAt, maskAt, prefixAt, sumsAt, blockPrefixAt, colAt, rowCount, 0, 0,
        resolve(p.filter), resolve(p.activeOnly), fbits(rowHeight), AUTO_TARGET, AUTO_TARGET, 0, 0, dictionaryAt,
        (p.data || source) ? 0 : 1, 0, 0, heap.alloc(limits.textCapacity), 0, 0, 0, AUTO_TARGET, 0, AUTO_TARGET, 0, sortedAt, mergeAt, (Math.max(0, Math.log2(count) - 8) % 2 ? mergeAt : sortedAt), 0, 0, 0, 0, 0]);
      putU(36, [Action[action.type], resolve(action.target), fbits(finite(action.value, 1)), meta]);
      const sourceMeta=source?packDataSource(heap,meta,source,rowsAt,columns):null;
      tables.push({ node: n.index, offset: meta, rowCount, paddedCount: count, columns: columns.length, ...(sourceMeta?{source:sourceMeta}:{}) });
      state[25] = n.index; state[26] = resolve(p.filter); state[27] = resolve(p.activeOnly);
    }
  }
  const docks=packDocks(heap,list,u);const models=packModels(heap,list,u,state);
  const designers=packDesigners(heap,list,u,state,resolve,addPath);
  const templateData=packTemplates(heap,list,u,state,resolve);
  packDesignerTemplates(heap,list,u,state,designers,templateData,resolve);
  state[60]=editors.length?heap.push(editors.map(e=>e.node)):0;state[61]=editors.length;
  const modals=list.filter(n=>n.type==='Modal').map(n=>n.index);state[42]=modals.length?heap.push([modals.length,AUTO_TARGET,AUTO_TARGET,...modals]):0;
  state[14]=lists.length?heap.push(lists.map(l=>l.node)):AUTO_TARGET;state[44]=lists.length;
  const actionOutbox=hostActions.length?heap.alloc(4+ACTION_EVENT_CAPACITY*6):0;state[9]=actionOutbox;
  const platformInbox=options.inputInboxCapacity??0; if(!Number.isInteger(platformInbox)||platformInbox<0||platformInbox>1048576)throw new RangeError('inputInboxCapacity must be 0–1048576');
  const editorInboxCapacity=Math.max(platformInbox,...editors.map(e=>e.capacity),...labels.map(l=>l.capacity),...(presenters.length?[65536]:[]));
  const editorInbox=editorInboxCapacity?heap.alloc(editorInboxCapacity):0;
  state[23]=editorInbox;state[40]=editorInboxCapacity;
  state[48] = heap.push(['Ready', 'Queued', 'Paused', 'rows', 'selected', 'Double-click numeric cells to edit', 'No matching rows', 'Search resources...'].map(t => heap.string(t, 0, true)[0]));
  state[33] = paths.length; state[34] = heap.push(paths);
  state[35] = heap.push(animationRecords.flat()); state[36] = animationRecords.length;
  const maxDepth = Math.max(...list.map(n => n.depth),...designers.map(d=>d.maxDepth));if(maxDepth>limits.maxDepth)throw new RangeError("Designer exceeds configured depth reservation");
  const shapedTexts=packUITypography(heap,list,u,state,fonts,packedFonts.pointers,{...options,textCapacity:limits.textCapacity,designers});
  return { shapedTexts,version: VERSION, nodes: new Uint8Array(buffer), state, heap: heap.finish(), nodeCount: list.length, maxDepth, ids,
    ...templateData,designers,editors,docks,models,lists,labels,hostActions,actionOutbox,presenters,editorInbox,editorInboxCapacity,modelRows:Math.max(0,...models.map(m=>m.count)),
    paths: paths.length, fonts: packedFonts.manifests, textMode: fonts.every(f => f.diagnostic) ? 'diagnostic' : 'opentype', tables, animations: animationRecords.length, styleNodes:state[59], extensions:true, limits,
    declarations: list.map(n => ({ id: n.id, type: n.type, index: n.index, depth: n.depth, parent: n.parent })) };
}
const tagMap = { grid: 'Grid', stack: 'StackPanel', 'stack-panel': 'StackPanel', canvas: 'Canvas', border: 'Border', text: 'TextBlock', 'text-block': 'TextBlock', button: 'Button', checkbox: 'CheckBox', slider: 'Slider', textbox: 'TextBox', progress: 'ProgressBar', 'data-grid': 'DataGrid', path: 'Path', scroll: 'ScrollViewer', 'panel':'Panel', 'dock-panel':'DockPanel', 'wrap-panel':'WrapPanel', 'uniform-grid':'UniformGrid', 'viewbox':'Viewbox', 'content-control':'ContentControl', 'content-presenter':'ContentPresenter', 'native-content-presenter':'NativeContentPresenter','text-editor':'TextEditor','code-editor':'CodeEditor','dock-workspace':'DockWorkspace','dock-item':'DockItem','list-box':'ListBox','tree-view':'TreeView','surface-presenter':'SurfacePresenter','modal':'Modal' };
const boolProps = new Set(['clip', 'disabled', 'hidden', 'wrap', 'editable', 'kerning', 'ligatures','lastChildFill','readOnly','wordWrap','minimap','lineNumbers','renderWhitespace','autoClosingBrackets','canClose','closed']);
export function fromHTML(element) {
  if (element?.content) element = element.content.firstElementChild;
  if (!element?.tagName) throw new TypeError('Expected a declarative element or template');
  const name = element.tagName.toLowerCase().replace(/^(ui|h)-/, '');
  const type = tagMap[name]; if (!type) throw new TypeError(`Unsupported declarative element ${element.tagName}`);
  const props = {};
  for (const { name, value } of element.attributes) {
    const key = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (key === 'action') { props.action = value.startsWith('{') ? JSON.parse(value) : value; continue; }
    if (['itemCapacity','itemTextCapacity','rowCapacity','textCapacity','presenterWidth','presenterHeight'].includes(key)) { props[key] = Number(value); continue; }
    if (key==='template'||key==='theme') {props[key]=value.trim().startsWith('{')?JSON.parse(value):value;continue;}
    if(key==='controlThemes'||key==='reducedMotion'){props[key]=value!=='false';continue;}
    if (['bind', 'animations', 'dataColumns', 'data','items','itemsSource','dataSource','styles','resources','transitions','dockLayout','models','modelBind','completions','templates','themes'].includes(key)) { props[key] = JSON.parse(value); continue; }
    if (key === 'viewBox') { props[key] = value.trim().startsWith('[') ? JSON.parse(value) : value.split(/[ ,]+/).map(Number); continue; }
    if (['margin','padding','renderTransform','renderTransformOrigin'].includes(key)) { props[key] = value.split(/[ ,]+/).map(Number); continue; }
    props[key] = boolProps.has(key) ? value !== 'false' : value;
  }
  if (!props.text) props.text = [...element.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
  return h(type, props, ...[...element.children].map(fromHTML));
}
