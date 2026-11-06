import {h,ShapedText,DrawingContext,FormattedText,dataSource,hostAction,themeAction,Toolbar} from '../src/index.js';
export const TYPOGRAPHY_FONT_SOURCES=Object.freeze(['NotoSans','NotoSansArabic','NotoSansHebrew'].map(name=>Object.freeze({source:`https://raw.githubusercontent.com/notofonts/noto-fonts/v20201206-phase3/hinted/ttf/${name}/${name}-Regular.ttf`,family:name.replace('NotoSans','Noto Sans').replace('Arabic',' Arabic').replace('Hebrew',' Hebrew')})));
const T=(text,props={})=>ShapedText({text,wrap:true,fontSize:18,foreground:'#eeeef2',...props});
const B=(text,action,props={})=>h('Button',{text,action,height:32,fontSize:12,padding:8,background:'#202027',foreground:'#eeeef2',radius:7,...props});
const card=(title,...children)=>h('Border',{background:'#19191f',borderColor:'#303038',borderWidth:1,radius:10,padding:18},h('StackPanel',{gap:12},h('TextBlock',{text:title.toUpperCase(),fontSize:11,foreground:'#b9a7ff'}),...children));
export function createTypographyLab(){
 const dc=new DrawingContext({width:520,height:80});dc.DrawText(FormattedText('DrawingContext · office · שלום',{fontSize:24}),[10,12],'#b7dcd4');
 const records=dataSource({key:'id',capacity:4096,columns:[{field:'language',title:'Language / script',type:'text',width:210},{field:'specimen',title:'Retained glyph shaping',type:'text',width:420},{field:'count',title:'Count',type:'number',width:100}],rows:[{id:1,language:'Latin',specimen:'office AVATAR — café',count:42},{id:2,language:'Polski',specimen:'Zażółć gęślą jaźń',count:17},{id:3,language:'العربية',specimen:'مرحبا بالعالم',count:23},{id:4,language:'עברית',specimen:'שלום עולם',count:35},{id:5,language:'Mixed',specimen:'Invoice שלום 123 (USD)',count:57}]});
 return h('Grid',{rows:'48 42 * 26',fontFamily:'Noto Sans',background:'#111114',foreground:'#eeeef2'},
 h('Grid',{columns:'* auto auto auto',padding:[12,7],gap:8,background:'#151519'},T('Typography',{fontSize:16}),B('Fonts',hostAction('fonts'),{column:1}),B('FPS',hostAction('hud'),{column:2}),B('Playground',hostAction('playground'),{column:3})),
 Toolbar({row:1,height:42,padding:[12,2]},...['Paragraphs','Editing','DataGrid','Contract'].map((title,page)=>B(title,{type:'page',value:page}))),
 h('ScrollViewer',{row:2,page:0,padding:20},h('StackPanel',{gap:16},
 T('Shape once. Reflow on the device.',{fontSize:32}),
 T('Feature plans, clusters, bidi levels and positions remain in GPU buffers. Resize the window to reflow these paragraphs.',{fontSize:15,wrap:true,foreground:'#a0a0ad'}),
 h('WrapPanel',{gap:16},card('Kerning and ligatures',T('office  affinity  AVATAR',{fontSize:27}),T('office  affinity  AVATAR',{fontSize:27,fontFeatures:{liga:0,kern:0},foreground:'#b5a6d9'})),card('Marks and canonical composition',T('A\u030a  Å  a\u0323\u0301  café',{fontSize:27}),T('Zażółć gęślą jaźń',{fontLanguage:'pl',fontSize:23}))),
 card('Bidirectional paragraphs',T('مرحبا بالعالم — 123',{fontSize:32,flowDirection:'rtl',textAlignment:'start'}),T('שלום עולם — 2026',{fontSize:29,flowDirection:'rtl',textAlignment:'start'}),T('Invoice שלום 123 (USD) · office',{fontSize:24,flowDirection:'auto'})),
 card('Shared measure and draw positions',T('Ligatures and combining marks stay together. This paragraph wraps at its measured width; each line resolves visual order and fallback metrics independently. AVATAR office café.',{wrap:true,fontSize:21}),dc.toView({textShaping:'opentype'}))
 )),
 h('ScrollViewer',{row:2,page:1,padding:20},h('StackPanel',{gap:16},T('Real editing, retained glyphs.',{fontSize:30}),T('Type, move the caret, select, and delete. Single-line inputs use shaped glyph positions; editor grapheme deletion preserves joined sequences.',{wrap:true,fontSize:15,foreground:'#a0a0ad'}),
 card('Mixed-direction TextBox',h('TextBox',{id:'mixed',text:'office שלום 123 مرحبا',fontSize:24,height:56,textShaping:'opentype',background:'#0c1721'})),
 card('Templated native content host',h('TextBox',{id:'templated',text:'A\u030a café — العربية',fontSize:23,height:54,controlThemes:true})),
 card('Grapheme-aware code-cell editor — not a bidi paragraph editor',h('TextEditor',{id:'notes',text:'Delete complete sequences: 👩🏽‍🚀 🇵🇱 A\u0301\nThis editor retains fixed code cells. Full editor bidi/shaped wrapping is not claimed.',height:240,documentCapacity:4096,historyCapacity:16384,fontSize:17,wordWrap:true}))
 )),
 h('Grid',{row:2,page:2,rows:'auto auto *',padding:20,gap:12},T('Visible-row shaping cache',{fontSize:28}),h('TextBlock',{row:1,text:'Click headers to sort. String runs refresh after query changes; numeric cells keep the existing formatter.',fontSize:14,wrap:true}),h('DataGrid',{id:'table',row:2,itemsSource:records,textShaping:'opentype',shapingCapacity:96,fontSize:18,rowHeight:44})),
 h('ScrollViewer',{row:2,page:3,padding:20},h('StackPanel',{gap:18},T('Experimental contract',{fontSize:30}),...[
 'The raw GSUB/GPOS interpreter, Unicode segmentation, bidi resolution and paragraph layout execute in compute. Startup font parsing and plan packing are host work.',
 'The reusable GpuTypography module has no UI dependency and no frame scheduler. encode() never submits or reads back. Explicit snapshots copy only one run’s outputs.',
 'This is not complete HarfBuzz or Unicode conformance. Complex-script reordering outside the documented set, variable/CFF/color fonts, hinting, full UAX #14 and reshaping after forced word breaks remain unsupported.',
 'The code editor still uses fixed cells and its existing lexer. Grapheme navigation improves; full editor bidi/proportional shaping is not included.',
 'Native shader execution, rendered quality and hardware performance require validation on your device. The test page is /tests/typography.html.',
 'Font files are not shipped. The default sources load in your browser. Local font selection is an explicit remount and resets this specimen’s input state.'
 ].map(text=>card('Scope',T(text,{fontSize:16,wrap:true}))))),
 h('TextBlock',{row:3,text:'COMPUTE TYPOGRAPHY / experimental · source fonts + exact coverage · no CPU text renderer',fontSize:11,padding:8,background:'#151519'}));
}
