import {startWorkspace,navigateWorkspace} from '../src/platform/workspace.js';
import {hostAction} from '../src/controls/index.js';
import {defineModel,field,modelBinding} from '../src/models/index.js';
import {BUILD_VERSION} from '../src/version.js';
import { h, HelionSurface, DEFAULT_FONT_SOURCES, clearStartupCache } from '../src/index.js';

const C = { base: '#111114', panel: '#19191f', inset: '#151519', line: '#303038', text: '#eeeef2', muted: '#a0a0ad', accent: '#b9a7ff', green: '#9ecb88', violet: '#b5a1ed' };
const text = (value, props = {}) => h('TextBlock', { text: value, fontSize: 13, foreground: C.text, ...props });
const button = (value, action, props = {}) => h('Button', { text: value, action, fontSize: 11, height: 30, radius: 6, background: '#202027', foreground: C.text, ...props });
const card = (props, ...children) => h('Grid', { padding: 18, background: C.panel, radius: 12, borderColor: C.line, borderWidth: 1, ...props }, ...children);
const stat = (label, metric, props = {}) => card({ rows: '17 *', padding: 12, ...props },
  text(label, { foreground: C.muted, fontSize: 11 }), text('', { row: 1, fontSize: 25, foreground: C.accent, bind: { metric } }));
const orbitPath = 'M 50 6 C 77 6 94 24 94 50 C 94 76 76 94 50 94 C 24 94 6 76 6 50 C 6 24 24 6 50 6 Z';
const helixPath = 'M 8 50 C 8 0 42 0 50 50 C 58 100 92 100 92 50 C 92 0 58 0 50 50 C 42 100 8 100 8 50';
const compose = (property, from, to, duration, extra = {}) => ({ property, from, to, duration, speed: 'speed', ...extra });

export function createShowcase({ rowCount = 65536 } = {}) {
  const view=h('Grid', { id: 'root', rows: '48 42 * 26', background: C.base, models:{tools:defineModel({open:field('bool',false)},{commands:{open:{assign:{open:true}},close:{assign:{open:false}}}})} },
    h('Grid', { id: 'header', columns: 'auto * auto auto auto auto', padding: [12,7], gap: 8, background: '#151519' },
      h('StackPanel', { orientation: 'horizontal', gap: 10 },
        h('Path', { width: 21, height: 24, minViewportWidth:780, path: 'M 1 2 L 8 2 L 8 12 L 20 12 L 20 2 L 27 2 L 27 29 L 20 29 L 20 19 L 8 19 L 8 29 L 1 29 Z', foreground: C.accent }),
        text('Showcase', { fontSize: 16, verticalAlignment: 'center' })),
      text('GPU-RESIDENT UI LAB', { column: 1, minViewportWidth: 780, fontSize: 11, foreground: C.muted, verticalAlignment: 'center', margin: [15, 0] }),
      button('Pause / run', 'animations', { id: 'pause', column: 2, width: 112, minViewportWidth: 630 }),
      button('Bounds', 'bounds', { id: 'bounds', column: 3, width: 78, minViewportWidth: 460 }),
      button('Theme', 'theme', { id: 'theme', column: 4, width: 72 }),button('Tools',{type:'model',model:'tools',command:'open'},{column:5,width:62})),
    h('Grid', { row: 1, columns: '* * * * *', padding: 8, gap: 7, maxWidth: 760 },
      ...['Data', 'Layout', 'Motion', 'Design', 'Type'].map((title, page) => button(title, { type: 'page', value: page }, { id: `tab${page}`, column: page }))),
    // All pages are uploaded once. Page switching only changes GPU visibility and invalidates layout.
    h('Grid', { id: 'dataPage', row: 2, page: 0, columns: '* auto', padding: 16, gap: 16 },
      h('Grid', { rows: '76 42 *', gap: 14 },
        h('Grid', { columns: '* * auto', gap: 12 },
          stat('RESIDENT ROWS', 'rows', { id: 'residentRows' }),
          stat('QUERY MATCHES', 'matched', { column: 1 }),
          stat('SELECTED ID', 'selected', { column: 2, width: 190, minViewportWidth: 800 })),
        h('Grid', { row: 1, columns: '* auto auto', gap: 10 },
          h('TextBox', { id: 'search', height: 40, fontSize: 14, background: C.inset, radius: 8, borderWidth: 1, borderColor: C.line }),
          h('CheckBox', { id: 'active', column: 1, text: 'Ready only', width: 129, fontSize: 12 }),
          button('Clear', { type: 'clear', target: 'search' }, { id: 'clear', column: 2, width: 67, height: 40, minViewportWidth: 510 })),
        h('DataGrid', { id: 'resources', row: 2, fontSize: 13, rowCount, rowHeight: 38, filter: 'search', activeOnly: 'active', background: C.inset, radius: 8, borderWidth: 1, borderColor: C.line })),
      card({ id: 'inspector', column: 1, width: 264, minViewportWidth: 1080, rows: '32 26 18 32 28 12 35 27 26 26 26 26 *', padding: 18 },
        text('ON THE DEVICE', { fontSize: 15 }),
        text('Composition speed', { row: 1, foreground: C.muted, fontSize: 12 }),
        text('Scale: ', { row: 2, fontSize: 11, bind: { source: 'speed', scale: 100 }, foreground: C.accent }),
        h('Slider', { id: 'speed', row: 3, value: 0.35, height: 32 }),
        text('No layout invalidation', { row: 4, foreground: C.muted, fontSize: 11 }),
        h('ProgressBar', { row: 5, height: 7, foreground: C.accent, bind: { source: 'speed' } }),
        text('LIVE GPU COUNTERS', { row: 7, fontSize: 11, foreground: C.muted }),
        text('View nodes  ', { row: 8, fontSize: 11, bind: { metric: 'nodes' } }),
        text('Strips      ', { row: 9, fontSize: 11, bind: { metric: 'strips' } }),
        text('Layouts     ', { row: 10, fontSize: 11, bind: { metric: 'layout' } }),
        text('Overflow    ', { row: 11, fontSize: 11, bind: { metric: 'overflow' } }),
        h('Grid', { row: 12, rows: '* auto', margin: [0, 18, 0, 0] },
          h('Canvas', {},
            h('Path', { x: 50, y: 18, width: 120, height: 120, path: orbitPath, stroke: 1.5, foreground: '#41566a', clip: false }),
            h('Path', { x: 68, y: 36, width: 84, height: 84, path: helixPath, stroke: 2, foreground: C.accent, clip: false, animations: [compose('rotation', 0, Math.PI * 2, 9, { easing: 'linear', alternate: false })] })),
          text('This panel collapses below\n1080 CSS pixels.', { row: 1, fontSize: 11, foreground: C.muted, height: 34 })))),
    h('Grid', { row: 2, page: 1, padding: 20, rows: 'auto *', gap: 18 },
      h('StackPanel', { gap: 7 }, text('Measure. Arrange. Retain.', { fontSize: 26 }),
        text('Resize the window. Pixel, Auto and star tracks are resolved on the GPU.', { wrap: true, foreground: C.muted })),
      h('Grid', { row: 1, columns: '* *', gap: 16 },
        card({ rows: 'auto *', gap: 14 }, text('01  CONSTRAINTS + TRACKS', { fontSize: 12, foreground: C.accent }),
          h('Grid', { row: 1, rows: '58 auto *', columns: 'auto *', gap: 10, padding: 10, background: C.inset, radius: 8 },
            h('Border', { columnSpan: 2, background: '#203c48', padding: 14, radius: 6 }, text('Pixel row / spanning cell', { wrap: true, fontSize: 12 })),
            h('Border', { row: 1, background: '#292b43', width: 82, padding: 10, radius: 6 }, text('Auto\ntrack', { fontSize: 12 })),
            h('Border', { row: 1, column: 1, padding: 10, background: '#1f3442', radius: 6 }, text('A wrapped label measures against the remaining width.', { wrap: true, fontSize: 12 })),
            h('Border', { row: 2, columnSpan: 2, padding: 16, background: '#1b2c38', radius: 6 },
              h('StackPanel', { gap: 14 }, text('Star row takes the remainder.', { wrap: true, fontSize: 13 }),
                h('CheckBox', { text: 'GPU toggle', fontSize: 12, height: 32 }), h('Slider', { id: 'layoutSlider', value: 0.62, height: 34 }),
                h('ProgressBar', { height: 9, foreground: C.green, bind: { source: 'layoutSlider' } }))))),
        card({ column: 1, rows: 'auto *', gap: 14 }, text('02  SCROLL + CLIP', { fontSize: 12, foreground: C.accent }),
          h('ScrollViewer', { row: 1, background: C.inset, padding: 12, radius: 8 },
            h('StackPanel', { gap: 12 }, ...Array.from({ length: 14 }, (_, i) => h('Border', { height: 82, background: i % 2 ? '#23303f' : '#202027', radius: 8, padding: 14 },
              h('StackPanel', { gap: 8 }, text(`Retained view  ${String(i + 1).padStart(2, '0')}`, { fontSize: 13 }), text('Wheel input updates GPU scroll state.', { wrap: true, fontSize: 11, foreground: C.muted }))))))))),
    h('Grid', { row: 2, page: 2, padding: 20, rows: 'auto * auto', gap: 18 },
      h('StackPanel', { gap: 8 }, text('Layout stays still. Pixels move.', { fontSize: 25, wrap: true }),
        text('Retained transforms, opacity and timelines. No per-frame scene upload.', { foreground: C.muted, wrap: true })),
      card({ row: 1, rows: '* auto', padding: 20 },
        h('Canvas', { id: 'motionCanvas' },
          h('Path', { id: 'orbit', x: 42, y: 25, width: 210, height: 210, path: orbitPath, stroke: 1.2, foreground: '#415a70' }),
          h('Path', { id: 'animatedHelix', x: 74, y: 57, width: 146, height: 146, path: helixPath, stroke: 2, foreground: C.accent, clip: false, animations: [compose('rotation', 0, Math.PI * 2, 10, { alternate: false, easing: 'linear' })] }),
          h('Border', { x: 320, y: 38, width: 174, height: 58, radius: 13, padding: 17, background: '#23454b', clip: false, animations: [compose('translateY', 0, 135, 3.1), compose('opacity', 0.45, 1, 3.1)] }, text('TRANSLATE', { fontSize: 15 })),
          h('Border', { x: 540, y: 70, width: 155, height: 155, radius: 22, padding: 20, background: '#393451', clip: false, animations: [compose('rotation', -0.18, 0.18, 4.2), compose('scaleX', 0.75, 1.12, 4.2), compose('scaleY', 0.75, 1.12, 4.2)] }, text('GPU\nCOMPOSITION', { fontSize: 15, margin: [0, 25, 0, 0] })),
          h('Path', { x: 790, y: 55, width: 175, height: 175, path: 'M 50 2 L 64 34 L 99 38 L 72 61 L 80 96 L 50 78 L 20 96 L 28 61 L 1 38 L 36 34 Z', foreground: C.green, animations: [compose('rotation', 0, Math.PI * 2, 14, { alternate: false, easing: 'linear' })] })),
        text('Transforms affect rendering and hit testing, not desired size. Narrow screens clip the stage.', { row: 1, fontSize: 12, wrap: true, foreground: C.muted })),
      h('Grid', { row: 2, columns: 'auto auto *', gap: 14 }, button('Pause / run', 'animations', { width: 130 }),
        button('Show bounds', 'bounds', { column: 1, width: 130 }), text('Layout executions  ', { column: 2, verticalAlignment: 'center', fontSize: 12, bind: { metric: 'layout' }, minViewportWidth: 610 }))),
    h('Grid', { row: 2, page: 3, padding: 20, rows: 'auto *', gap: 18 },
      h('StackPanel', { gap: 8 }, text('A small host. A resident engine.', { fontSize: 25, wrap: true }),
        text('Experimental architecture, explicit limits, observable failure.', { foreground: C.muted, wrap: true })),
      h('ScrollViewer', { row: 1 },
        h('StackPanel', { gap: 14 },
          ...[
            ['01 / DECLARE ONCE', 'JavaScript h() views or inert HTML templates compile into typed records. Curves, glyphs, text buffers, table rows and timelines are uploaded at mount.'],
            ['02 / SEND INTENT', '32-byte FIFO commands carry pointer, wheel, keyboard, text and property updates. Compatible adjacent moves and wheel commands coalesce. The host never hit-tests controls.'],
            ['03 / EXECUTE ON DEVICE', 'Compute kernels route input, edit text, scan and sort rows, measure, arrange, animate, emit primitives, generate sparse strips and composite pixels.'],
            ['04 / KEEP BOUNDARIES HONEST', 'The browser still owns events, IME, the frame clock and WebGPU submission. There is no claim of a fully GPU-hosted browser or a production accessibility tree.'],
            ['05 / RESEARCH, NOT PARITY', 'This is an independent sparse-strip experiment, not a port of Vello. Real font outlines, metrics and bounded Latin/Greek/Cyrillic OpenType plans stay resident. This is not a complete multilingual shaping system. Hardware qualification is still required.']
          ].map(([title, description]) => card({ rows: '24 auto', padding: 18 }, text(title, { fontSize: 12, foreground: C.accent }), text(description, { row: 1, wrap: true, fontSize: 13, foreground: C.muted })))))),
    h('Grid', { row: 2, page: 4, padding: 20, rows: 'auto *', gap: 18 },
      h('StackPanel', { gap: 7 }, text('Real outlines. Retained glyphs.', { fontSize: 27, fontWeight: 600, wrap: true }),
        text('Font metrics, kerning, ligatures and editable text. Raster coverage is cached on the GPU.', { foreground: C.muted, wrap: true })),
      h('ScrollViewer', { row: 1 }, h('StackPanel', { gap: 14 },
        card({ rows: 'auto auto auto auto', gap: 10 },
          text('01 / FONT FACES', { foreground: C.accent, fontSize: 11 }),
          text('The quick brown fox jumps over the lazy dog.', { row: 1, fontSize: 21, wrap: true }),
          text('Semibold — a real 600-weight face when loaded.', { row: 2, fontSize: 21, fontWeight: 600, wrap: true }),
          text('Italic — a real italic face when loaded.', { row: 3, fontSize: 21, fontStyle: 'italic', wrap: true })),
        card({ rows: 'auto auto auto auto', gap: 10 },
          text('02 / UNICODE REPERTOIRE', { foreground: C.accent, fontSize: 11 }),
          text('Zażółć gęślą jaźń. Łódź, Wrocław, Kraków.', { row: 1, fontSize: 22, wrap: true }),
          text('Ελληνικά · Καλημέρα   /   Кириллица · Привет', { row: 2, fontSize: 20, wrap: true }),
          text('Composed: Å café  /  decomposed: A\u030A cafe\u0301', { row: 3, fontSize: 19, wrap: true })),
        card({ rows: 'auto auto auto auto', gap: 10 },
          text('03 / SPACING AND SUBSTITUTION', { foreground: C.accent, fontSize: 11 }),
          text('AVATAR  WA  To  ·  office  affinity  final', { row: 1, fontSize: 26, wrap: true }),
          text('AVATAR  WA  To  ·  office  affinity  final', { row: 2, fontSize: 26, kerning: false, ligatures: false, wrap: true }),
          text('Top: font kerning + standard ligatures. Bottom: both disabled.', { row: 3, fontSize: 12, foreground: C.muted, wrap: true })),
        card({ rows: 'auto 48 auto', gap: 10 },
          text('04 / GPU TEXT EDITOR', { foreground: C.accent, fontSize: 11 }),
          h('TextBox', { id: 'typeEditor', row: 1, text: 'Type here: Zażółć / office / A\u030A', fontSize: 20, background: C.inset, borderWidth: 1, borderColor: C.line, radius: 6 }),
          text('Caret, selection, proportional advances and combining-sequence deletion use the same resident metrics. Applying another font set resets this showcase.', { row: 2, fontSize: 12, foreground: C.muted, wrap: true })),
        card({ rows: 'auto auto auto auto', gap: 12 },
          text('05 / WRAP, DECORATIONS AND SCALE', { foreground: C.accent, fontSize: 11 }),
          text('Word-aware wrapping retains the font’s advances instead of estimating a fixed character width. Resize the window to change the Measure constraint.', { row: 1, fontSize: 17, lineHeight: 26, wrap: true }),
          text('Underline follows the font metrics.', { row: 2, fontSize: 19, textDecoration: 'underline', wrap: true }),
          text('Strikethrough · real outline geometry · 0123456789', { row: 3, fontSize: 20, textDecoration: 'line-through', wrap: true })),
        text('Static TrueType-outline fonts; bounded OpenType support. Complex scripts, full bidi, color emoji and hinting are not implemented. Fonts are fetched once or loaded from your local files, never rerasterized by Canvas 2D.', { fontSize: 12, foreground: C.muted, wrap: true, margin: [4, 6, 4, 24] })
      ))),
    h('Grid', { row: 3, columns: '* auto', padding: 7, background: '#101a24' },
      text('EXPERIMENTAL / WebGPU required / no DOM renderer', { fontSize: 10, foreground: C.muted }),
      text('HOST BYTES SENT  ', { column: 1, fontSize: 10, bind: { metric: 'upload' }, foreground: C.muted, minViewportWidth: 680 })),showcaseTools());
  // Responsive panels are one retained tree. The GPU chooses the column count.
  const layout=view.children.find(node=>node.props?.page===1),cards=layout.children[1];
  cards.type='UniformGrid';cards.props={minColumnWidth:320,gap:16,verticalAlignment:'start'};
  for(const child of cards.children)child.props={...child.props,column:0,height:420};
  layout.children[1]=h('ScrollViewer',{row:1},cards);
  const motion=view.children.find(node=>node.props?.page===2),stage=motion.children[1],items=stage.children[0].children;
  items[2].props.x=42;items[2].props.y=25;items[3].props.x=58;items[3].props.y=50;items[4].props.x=48;items[4].props.y=48;
  stage.children[0]=h('ScrollViewer',{},h('UniformGrid',{id:'motionCanvas',minColumnWidth:240,gap:12,verticalAlignment:'start'},
    h('Canvas',{height:270},items[0],items[1]),...items.slice(2).map(item=>h('Canvas',{height:270},item))));
  stage.children[1].props.text='Each example reflows on the GPU. Resize the window to explore the same retained scene.';
  return view;
}

function showcaseTools(){
 const commands=[['Fonts: local','fonts'],['Default fonts','default-fonts'],['Clear font cache','clear-cache'],['Startup','startup'],['Frame sync','frame-sync'],['GPU counters','counters'],['FPS / graphs','hud'],['Timing mode','timing'],['Vsync pacing','pacing'],['ASAP mode','asap'],['Keyboard','keyboard'],['Save JSON','save-diagnostics'],['Playground','playground'],['Designer','designer']];
 return h('Grid',{id:'showcase-tools',rowSpan:4,rows:'38 auto *',padding:18,gap:12,background:C.base,modelBind:modelBinding('tools','open',{property:'visible'}),zIndex:100},
  h('Grid',{columns:'* 74'},text('Tools & diagnostics',{fontSize:20,fontWeight:600}),button('Close',{type:'model',model:'tools',command:'close'},{column:1,height:30})),
  h('WrapPanel',{row:1,itemWidth:132,itemHeight:34,gap:6},...commands.map(([label,name])=>button(label,hostAction(name),{height:30,fontSize:11}))),
  h('ScrollViewer',{row:2,padding:14,background:C.inset},text('Diagnostics run only when requested.\n\nLocal/default font changes restart the showcase and reset its edits. Use Ctrl/Cmd+Alt+F to choose local fonts, including during startup.\n\nFrame timestamps and completion callbacks do not measure display scanout.',{id:'showcase-diagnostics',fontSize:12,wrap:true,textCapacity:768})));
}

export async function bootShowcase() {
 const $=id=>document.getElementById(id),canvas=$('surface');
 let surface=null,busy=false,diagnostic=null;
 const showDiagnostic=data=>{
  diagnostic=data;if(!surface)return;
  const output=JSON.stringify(data,null,2);
  surface.setText('showcase-diagnostics',output.length>700?output.slice(0,630)+'\n\nPreview truncated. Save JSON for the full snapshot.':output);
  surface.model('tools').set('open',1);
 };
 function showError(error){
  $('boot').hidden=false;$('boot-detail').textContent=`${error.message}\n\nBuild: ${BUILD_VERSION}.\nUse localhost or HTTPS and a WebGPU-enabled browser. Ctrl/Cmd+Alt+F selects local fonts. No CPU-rendered fallback is used.`;console.error(error);
 }
 async function mountFonts(sources){
  if(busy)return;busy=true;$('boot').hidden=false;
  try{
   surface?.dispose();surface=null;globalThis.helion=null;
   surface=await HelionSurface.mount(canvas,createShowcase(),{
    fontSources:sources,startupWorker:true,startupCache:sources===DEFAULT_FONT_SOURCES?'showcase-full-quality-v2':false,
    autoStart:false,performanceHUD:false,submissionMode:'vsync',maxFramesInFlight:2,onError:showError,onAction:action,
    onDiagnosticsError:error=>showDiagnostic({error:error.message}),
    onStartup:event=>{if(event.stage==='ready')$('boot').hidden=true;else $('boot-detail').textContent=event.detail;}
   });globalThis.helion=surface;startWorkspace(surface);return surface;
  }catch(error){showError(error);return null;}finally{busy=false;}
 }
 async function action(event){
  if(!surface)return;
  try{switch(event.name){
   case 'designer':case 'playground':navigateWorkspace(event.name,globalThis.__HELION_SHADERS__?`./helion-${event.name}.html`:`./${event.name}/`);return;
   case 'fonts':$('local-fonts').click();return;
   case 'default-fonts':await mountFonts(DEFAULT_FONT_SOURCES);return;
   case 'clear-cache':showDiagnostic({cacheCleared:await clearStartupCache()});return;
   case 'startup':showDiagnostic({startup:surface.startup,stats:surface.stats});return;
   case 'frame-sync':showDiagnostic({frameSync:surface.inspectFrameSync()});return;
   case 'hud':surface.setPerformanceHUD(!surface.hudVisible);showDiagnostic({graphs:surface.hudVisible});return;
   case 'timing':surface.setTimingDetail(({frame:'off',off:'stages',stages:'frame'})[surface.timingDetail]);showDiagnostic({timing:surface.timingDetail});return;
   case 'pacing':surface.setMaxFramesInFlight(surface.maxFramesInFlight===0?2:0);showDiagnostic({maxFramesInFlight:surface.maxFramesInFlight});return;
   case 'asap':surface.setSubmissionMode(surface.submissionMode==='vsync'?'asap':'vsync');showDiagnostic({submission:surface.submissionMode});return;
   case 'keyboard':surface.focusTextInput();return;
   case 'save-diagnostics':{
    if(!diagnostic)return;const url=URL.createObjectURL(new Blob([JSON.stringify(diagnostic,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='helion-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;
   }
   case 'counters':{
    const snapshot=await surface.inspect({includeNodes:false}),timing=surface.profiling?await surface.inspectPerformance():null;
    showDiagnostic({engine:BUILD_VERSION,note:'Explicit diagnostic readback only',timing,startup:surface.startup,stats:snapshot.stats,GPU:{layoutRuns:snapshot.state[11],queryRuns:snapshot.state[12],sortRuns:snapshot.state[50],events:snapshot.state[13],overflowBits:snapshot.state[15]},errors:snapshot.errors});return;
   }
  }}catch(error){showDiagnostic({error:error.message});}
 }
 $('local-fonts').addEventListener('change',async()=>{
  const files=Array.from($('local-fonts').files||[]);if(!files.length)return;
  if(files.length>8){showError(new Error('Choose 1–8 static TrueType-outline font faces.'));return;}
  await mountFonts(files.map(source=>({source})));
 });
 document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.altKey&&event.key.toLowerCase()==='f'){event.preventDefault();$('local-fonts').click();}});
 return mountFonts(DEFAULT_FONT_SOURCES);
}
if(typeof document!=='undefined'&&document.querySelector('#surface'))bootShowcase();
