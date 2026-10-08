import { h, compile, HelionSurface, Opcode } from '../src/index.js';
const view=h('Grid',{rows:'42 *'},h('TextBox',{id:'query'}),h('DataGrid',{id:'table',row:1,rowCount:128,filter:'query'}));
const prepared=compile(view,{limits:{maxRows:128}});
async function example(canvas:HTMLCanvasElement){const surface=await HelionSurface.mount(canvas,prepared);surface.set('table','opacity',.8).send(Opcode.Key,{c:9});const snapshot=await surface.inspect({includeHeap:true});return snapshot.state;}
void example;
// @ts-expect-error No arbitrary controls in the GPU ABI.
h('ArbitraryWidget');
// @ts-expect-error No layout animation in the composition API.
h('Border',{animations:[{property:'width',from:0,to:1,duration:1}]});

import {loadFonts, loadFont, parseOpenType, DEFAULT_FONT_SOURCES, PreparedFont} from '../src/index.js';
async function realFontExample(canvas:HTMLCanvasElement, bytes:ArrayBuffer) {
 const font:PreparedFont=parseOpenType(bytes); const fonts=await loadFonts(DEFAULT_FONT_SOURCES);
 const tree=h('TextBlock',{fontFamily:'Noto Sans',fontWeight:600,fontStyle:'italic',fontSize:18,kerning:true,ligatures:true,lineHeight:28,textDecoration:'underline',textAlignment:'center',text:'Zażółć',wrap:true});
 const gpu=await HelionSurface.mount(canvas,tree,{fonts,glyphCache:true,performanceHUD:true,limits:{glyphCacheSlots:2048}});
 const packed=compile(tree,{fonts:[font]}); return [gpu,packed,await loadFont(bytes)];
}
void realFontExample;
// @ts-expect-error No arbitrary CSS font synthesis.
h('TextBlock',{fontStyle:'synthetic-bold'});

import {decodeWOFF} from '../src/text/index.js';
async function decodeOnly(data:ArrayBuffer){const sfnt:Uint8Array=await decodeWOFF(data);return sfnt;}
void decodeOnly;

import { prepare, clearStartupCache, StartupEvent } from '../src/index.js';
async function fastStartup(canvas:HTMLCanvasElement) {
 const controller=new AbortController();
 const onStartup=(event:StartupEvent)=>console.log(event.stage,event.elapsedMs);
 const prepared=await prepare(view,{startupWorker:true,startupCache:'app-v1',signal:controller.signal,onStartup});
 const surface=await HelionSurface.mount(canvas,prepared,{maxFramesInFlight:2,pipelineConcurrency:4,onStartup});
 const cadence:number=surface.stats.rafHz;
 const readyMs:number|undefined=surface.startup.firstCompletedMs;
 return {cadence,readyMs,cleared:await clearStartupCache()};
}
void fastStartup;
// @ts-expect-error Cache requires an explicit application revision, not true.
prepare(view,{startupCache:true});
// @ts-expect-error Frame credit limit remains bounded.
HelionSurface.mount({} as HTMLCanvasElement,view,{submissionMode:'invalid'});

async function submissionModes(canvas:HTMLCanvasElement) {
 const surface=await HelionSurface.mount(canvas,view,{submissionMode:'vsync',maxFramesInFlight:0,asapFramesInFlight:8});
 surface.setSubmissionMode('asap'); surface.setSubmissionMode('vsync');
 await surface.whenSubmittedWorkDone(); const timing=await surface.inspectPerformance();
 const cpu:number|undefined=timing.current?.cpuEncodeMs; void cpu;
}
void submissionModes;

async function synchronizedFrames(canvas:HTMLCanvasElement) {
 const surface=await HelionSurface.mount(canvas,view,{timingDetail:'frame',parallelGrid:true,hudScissor:true});
 surface.setTimingDetail('stages');const host=surface.inspectFrameSync();const interval:number|null=host.submitIntervalMs.median;
 const metrics=await surface.inspectPerformance();const covered:number|undefined=metrics.current?.coveredMs;
 const raw:string|undefined=metrics.rawTimestamps[0]?.startNs;return {interval,covered,raw};
}
void synchronizedFrames;
// @ts-expect-error Neither CPU time nor GPU ranges measure physical busy time.
HelionSurface.mount({} as HTMLCanvasElement,view,{timingDetail:'busy'});

async function optionalDiagnosticStartup(canvas:HTMLCanvasElement) {
 const surface=await HelionSurface.mount(canvas,view,{deferHUD:true,timingDetail:'off',performanceHUD:true,onDiagnosticsError: error=>console.warn(error.message)});
 const hudReady:boolean=surface.hudReady;
 const hudReadyMs:number|undefined=surface.startup.hudReadyMs;
 surface.setTimingDetail('frame').setTimingDetail('off');
 return {hudReady,hudReadyMs};
}
void optionalDiagnosticStartup;

async function pacedVsync(canvas:HTMLCanvasElement) {
 const surface=await HelionSurface.mount(canvas,view,{submissionMode:'vsync',maxFramesInFlight:2,asapFramesInFlight:8});
 surface.setMaxFramesInFlight(0).setMaxFramesInFlight(2);
 const limit:number=surface.maxFramesInFlight;
 const deferred:number=surface.stats.rafCapacityDeferrals;
 const sync=surface.inspectFrameSync();const pending:number=sync.pacing.unacknowledgedFrames;
 const callbacks:number=sync.opportunities.counts.submitted;
 const timing=await surface.inspectPerformance();const policy:'bounded'|'unbounded'=timing.vsyncPacing;
 return {limit,deferred,pending,callbacks,policy};
}
void pacedVsync;

import {Dock,Thickness,ColumnDefinition,Style,StaticResource,FluentTheme,DrawingContext,Pen,Rect,Point,LinearGradientBrush,GradientStop,Compositor,GlyphRun,View,ViewProps} from '../src/index.js';
const columns=[ColumnDefinition('Auto',80,160),ColumnDefinition('2*',200,600),ColumnDefinition('*',100,300)];
const motion=new Compositor().CreateVector2KeyFrameAnimation({duration:2,iterations:'infinite',direction:'alternate'}).InsertKeyFrame(0,[0,0]).InsertKeyFrame(1,[20,0],'cubicOut');
const dc=new DrawingContext({width:240,height:120});dc.DrawRectangle(LinearGradientBrush([GradientStop('red',0),GradientStop('#48e',1)]),Pen('white',2),Rect(10,10,100,40));
const scope=dc.PushOpacity(.6);dc.DrawGlyphRun('#ffffff',GlyphRun([1,2],{baselineOrigin:Point(0,90)}));scope.dispose();
const framework=h('DockPanel',{Padding:Thickness(12,8),Styles:[Style('Button:pointerover',{Background:'#224455'})]},h('Button',{'DockPanel.Dock':Dock.Top,Content:'Actions',HorizontalAlignment:'Stretch'}),h('Grid',{ColumnDefinitions:columns},dc.toView({animations:motion.toAnimations('Offset')})));
const styled=compile(framework,{styles:FluentTheme,resources:{Accent:'#33aaff'}});void styled;
const reusable=(p:{title:string;children:import('../src/index.js').Child[]})=>h('Border',{Padding:10},h('TextBlock',{text:p.title}),...p.children);
h(reusable,{title:'Component'},h('TextBox'));h('TextBlock',{Foreground:StaticResource('Accent')});
const testViewbox:View=h('Viewbox',{Stretch:'Uniform',StretchDirection:'DownOnly'},h('Panel',{Width:400,Height:200}));void testViewbox;
// @ts-expect-error DrawingContext does not silently pretend opacity masks are implemented.
dc.PushOpacityMask('white');
// @ts-expect-error Invalid animation easing must not disappear into an any-typed API.
motion.InsertKeyFrame(.5,[1,2],'unknown-easing');
// @ts-expect-error Wrong matrix tuple length.
h('Border',{RenderTransform:[1,0,0,1]});
async function retainedControl(surface:HelionSurface){surface.controlAnimation('moving','pause').controlAnimation('moving','seek',.5).controlAnimation('moving','resume');}
void retainedControl;

h('Button',{IsEnabled:StaticResource('Enabled'),HorizontalAlignment:StaticResource('Align')});
h('WrapPanel',{Orientation:StaticResource('Direction')});

import {TextDocument,EditorController,DockTabs,DockSplit,defineViewModel,field,computed,expr,modelBinding,DocumentSnapshot,ModelSnapshot} from '../src/index.js';
import {EditorCommand as ModularEditorCommand} from '../src/editor/index.js';
import {DockController as ModularDock} from '../src/docking/index.js';
import {ModelController as ModularModel} from '../src/models/index.js';
const vm=defineViewModel({level:field('f32',.5),percentage:computed('f32',expr.mul(expr.ref('level'),100))},{commands:{increase:{assign:{level:expr.add(expr.ref('level'),.1)}}}});
const editorView=h('Grid',{Models:{vm}},h('DockWorkspace',{Name:'dock',DockLayout:DockSplit('horizontal',.5,DockTabs(['code']),DockTabs(['notes']))},h('DockItem',{Name:'code',Title:'app.js'},h('CodeEditor',{Name:'code-editor',...TextDocument('return h("TextBlock")',{language:'javascript',completions:[{label:'fn',insertText:'function ${1:name}() {$0}'}]})})),h('DockItem',{Name:'notes'},h('TextEditor',{Name:'notes-editor',WordWrap:true}))),h('Slider',{ModelBind:modelBinding('vm','level',{mode:'twoWay'})}));
async function editorIntegration(canvas:HTMLCanvasElement){const s=await HelionSurface.mount(canvas,editorView,{onEditorInput(){},onKey:event=>event.key==='F1'});const e:EditorController=s.editor('code-editor');e.insert('text').insertSnippet('${1:x}$0').search('x',{wholeWord:true}).setReplacement('y').command('replaceAll');const d:DocumentSnapshot=await e.snapshot();const dock:ModularDock=s.docking('dock');dock.command('float','code');const saved=await dock.snapshot();await dock.restore(saved);const m:ModularModel=s.model('vm');m.set('level',.8).execute('increase');const result:ModelSnapshot=await m.snapshot();return {d,result,ModularEditorCommand};}
void editorIntegration;
// @ts-expect-error LSP semantic refactoring is not a implemented editor command.
declare const nativeEditor:EditorController; nativeEditor.command('semanticRename');
// @ts-expect-error Models do not accept executable JavaScript expressions.
computed('f32',()=>42);
// @ts-expect-error Dock split orientation is constrained.
DockSplit('diagonal',.5,DockTabs(['a']),DockTabs(['b']));

import {dataSource,hostAction,Dialog,Toolbar,DataSourceController,ListController} from '../src/index.js';
const liveSource=dataSource({key:'id',capacity:4096,columns:[{field:'name',type:'text'},{field:'enabled',type:'boolean'}],rows:[{id:1,name:'hello',enabled:true}]});
const liveView=h('Panel',{},h('DataGrid',{Name:'grid',ItemsSource:liveSource}),h('TreeView',{Name:'tree',Items:[{key:0,label:'Root',children:['Child']}],Action:hostAction('select')}),h('SurfacePresenter',{Name:'preview',PresenterWidth:960,PresenterHeight:640}),Dialog({Name:'dialog'},Toolbar({},h('Button',{Text:'Run',Action:hostAction('run')}))));
async function dynamicAPIs(surface:HelionSurface){
 const data:DataSourceController=surface.dataSource('grid');data.upsert({id:2,name:'world',enabled:false}).patch(1,{name:'updated'},{expectedRevision:0}).sort('name').select(1);await data.snapshot();
 const list:ListController=surface.list('tree');list.replace([{key:2,label:'new'}]).select(2).toggle(2);await list.snapshot();
 surface.setText('label','dynamic');const embedded=await surface.attachSurface('preview',liveView,{onAction:event=>{console.log(event.name,event.key);},inputInboxCapacity:65536});embedded?.setText('label','child');surface.setPresenterSize(768,1024).detachSurface();
}
void dynamicAPIs;

// Text quality policy is independent of layout, model ownership and scheduling.
async function textQualityOptions(canvas:HTMLCanvasElement) {
 const surface=await HelionSurface.mount(canvas,h('TextBlock',{text:'Sharp'}),{textQuality:'sharp',resolutionMode:'native',limits:{maxDimension:8192,maxRenderTiles:65536}});
 surface.setTextQuality('reference').setTextQuality('sharp');
 surface.setResolutionMode('balanced').setResolutionMode('native');
 const native:boolean=surface.resolution.nativeResolution;
 return {native,pixels:surface.resolution.w};
}
