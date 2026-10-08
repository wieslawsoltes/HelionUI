import {h} from '../core/declaration.js';
import {DockSplit,DockTabs} from '../docking/index.js';
import {defineModel,field,modelBinding} from '../models/index.js';
import {hostAction,Dialog,Toolbar} from '../controls/index.js';
import {designerAction} from './index.js';
import {Kind} from '../core/schema.js';
import {DESIGN_PALETTE} from './schema.js';
import {DESIGN_TEMPLATE_LIBRARY} from './template-catalog.js';

export const DESIGNER_FONT_SOURCES=Object.freeze([
 {source:'https://raw.githubusercontent.com/notofonts/noto-fonts/v20201206-phase3/hinted/ttf/NotoSans/NotoSans-Regular.ttf',family:'Noto Sans',weight:400},
 {source:'https://raw.githubusercontent.com/notofonts/noto-fonts/v20201206-phase3/hinted/ttf/NotoSans/NotoSans-SemiBold.ttf',family:'Noto Sans',weight:600}
]);
export const DESIGNER_PANES=Object.freeze(['assets-pane','objects-pane','artboard-pane','properties-pane','brushes-pane','states-pane','grid-pane','timeline-pane','source-pane','project-pane','help-pane','log-pane','templates-pane']);
export const DESIGNER_THEME=`
 Button.design-tool { Background: #1c2c3c; Foreground: #c6d6e3; CornerRadius: 4; FontSize: 11; }
 Button.design-tool:pointerover { Background: #2d4a61; }
 Button.design-tool:pressed { Background: #286282; }
 Button.design-tool:focus { BorderBrush: #6ddedb; BorderThickness: 1; }
 Button.primary { Background: #276886; Foreground: #e9ffff; }
 Button.primary:pointerover { Background: #3288a0; }
 TextBlock.section { Foreground: #79d5dc; FontWeight: 600; FontSize: 11; }
`;
export const DESIGNER_GUIDE=`HELION STUDIO / COMPUTE VISUAL DESIGNER

A retained visual authoring workspace, inspired by Blend's artboard, assets,
objects, properties and timeline workflows. This is not full Microsoft Blend
compatibility. The source package contains the concrete supported contract.

ARTBOARD
Choose a control from Assets, then click or drag on the artboard to create it.
Select a container first to add into it; otherwise the artboard is the parent.
Click selects. Shift-click toggles selection. Drag an empty area for a marquee.
Double/triple clicks cycle overlapping/nested objects. The root is in Objects.
Drag a selection to move it. Drag its square handles to resize a single object.
Drag the round handle above the selection to rotate. Shift constrains.
Arrow keys nudge; Shift+arrows moves ten units. Alt-drag pans, Ctrl+wheel zooms.
Snap applies grid lines and neighboring object edges/centers for Canvas motion.
The grid, handles, hit tests, transforms and edits all run on the GPU.

OBJECTS / LAYOUT
Objects shows the real authored hierarchy, not a screenshot layer list.
Use its visibility and lock columns. Locks also protect descendants on canvas.
Drag a row onto another row to reorder, or farther right/Ctrl-drag to reparent.
Reparenting rejects cycles, depth overflow and invalid single-child containers.
Arrange offers alignment/distribution in Canvas, grouping and sibling order.
In layout panels, drag adjusts composition offsets instead of pretending that
Canvas.Left changes a Grid/Stack layout. Grid tracks have a dedicated tab.
Full transformed auto-layout reparenting equivalence is not claimed.

PROPERTIES / BRUSHES
Click a value, type, then Enter to commit or Escape to cancel. Edits have undo.
Enum values cycle on click. Binding Source / Action Target cycle object names;
double-click edits their raw slot. Shift+Enter inserts a text newline. Sizes accept auto; colors accept #RGB/#RRGGBBAA.
The brush pane edits RGBA channels. Select a named brush and apply it to the
selection's fill or foreground. Named brushes update their bound objects.
Multi-selection values display the primary object's value; an edit applies to
all selected objects as one transaction. Font faces are prepared at mount.

ANIMATION / STATES
The six tracks are opacity, translate X/Y, scale X/Y and rotation.
Scrub the ruler. Double-click a track to insert a key; drag diamonds in time.
Shift snaps key time to 0.1 s. Alt-drag a diamond vertically changes its value.
Select a key and choose easing. Record creates keys for composition edits;
with Record enabled, moving/resizing authors offsets/scales, not layout sizes.
Play evaluates retained keys on the GPU; Stop returns to time zero.
States has Base and three named states. Capture stores the current appearance;
editing a state changes supported paint/composition overrides, not Base.
Switching states interpolates retained values over 180 ms. Layout is shared.

PREVIEW
Preview enables real Helion control interaction instead of designer hit tests.
Basic numeric bindings and toggle/increment/set actions can be authored.
Preview text input uses separate storage and does not corrupt design history.
The editor and designed UI share one surface, one canvas and one frame producer.

TEMPLATES / THEMES
Templates applies a prepared template to selected leaf controls. Native visuals
removes it. Fluent/macOS light/dark buttons change the resident palette with undo.
Contrast, density, motion and accent options are GPU-owned, undoable theme choices.
State previews affect only the selected template's visuals; Return to automatic
restores input-driven states. These diagnostic state previews are not saved.
High contrast ignores the custom accent until Standard is selected again.

JSON opens the template definition and its visual-state setters. Apply JSON
validates the catalog then remounts from an explicit design snapshot, resetting
history. Edit parts opens a separate GPU authoring document; the original design
is retained as an explicit host snapshot until Save parts or Back/cancel.
Untouched TemplateBinding/ThemeResource values survive visual part edits. Editing
a property replaces its binding with the edited literal. Save parts validates
named-state references; use JSON to repair references before removing a part.
Templates have a fixed eight-part/16-instance maximum in Studio. Custom runtime
templates support up to 64 parts. These are original themes, not native OS widgets.

FILES / SOURCE
Save obtains an explicit GPU project snapshot. Open validates JSON; never eval.
Refresh source creates native Helion declarations from a consistent snapshot.
Edit project.json then Apply JSON for a validated authoring transaction boundary.
New path/font catalogs require Open project; structural editing within reserved
slots does not recompile the workspace. Export JS uses @helion/ui; export HTML
contains the runtime/worker code and loads real fonts at runtime (or locally).

SHORTCUTS
Ctrl/Cmd+Z: undo; Shift+Z/Y: redo; D: duplicate; G: group; Shift+G: ungroup.
Ctrl/Cmd+C/V/X: internal design copy/paste/cut when a design control has focus.
Delete removes selection. Escape cancels an in-progress authoring gesture.
Ctrl/Cmd+S: save; Ctrl/Cmd+O: open; Ctrl/Cmd+Enter: preview; F1: guide.
Ctrl/Cmd+Alt+F selects local font files, including before startup.
Code/project editors retain their own keyboard commands and undo history.

BOUNDARIES
Default 64 design objects (max 128), depth 16, six tracks/object, 12 keys/track,
16 solid resources, three visual states plus Base. History is a bounded ring of
complete authoring transactions. Export important work: unsaved device-owned
edits are not automatically recoverable after device loss.
The browser supplies files, clipboard, OS input, time and queue submission.
Those explicit services do not run in shaders. Shader execution, pixels and
performance require native validation; passing host tests alone is insufficient.
`;

/** All visible application UI is authored with Helion. Only platform services live in designer/app.js. */
export function createDesignerWorkbench(project,{examples=[]}={}){
 project={...project,templates:project.templates??DESIGN_TEMPLATE_LIBRARY,templateCapacity:project.templateCapacity??8};
 const text=(value,props={})=>h('TextBlock',{text:value,fontSize:12,foreground:'#b6c9d8',...props});
 const command=(title,name,a=0,b=0,props={})=>h('Button',{text:title,classes:'design-tool',height:29,width:80,action:designerAction('design',name,a,b),...props});
 const host=(title,name,value=0,props={})=>h('Button',{text:title,classes:'design-tool',height:30,width:86,action:hostAction(name,value),...props});
 const pane=(id,title,...children)=>h('DockItem',{id,title},...children);
 const section=(title,...children)=>h('StackPanel',{gap:5},text(title,{classes:'section',height:24}),...children);
 const inspector=(role='properties')=>h('PropertyInspector',{id:'inspector-'+role,designTarget:'design',designRole:role,background:'#15202d',foreground:'#d5e4ef',fontSize:12,clip:true});
 const rows=(buttons)=>Toolbar({height:37},...buttons);
 const editor={fontSize:12,editorLineHeight:20,documentCapacity:131072,historyCapacity:262144,background:'#101b27',foreground:'#d3e3ee',lineNumbers:true,clip:true};
 const shell=defineModel({settings:field('bool',false),confirm:field('bool',false)},{commands:{settings:{assign:{settings:true}},closeSettings:{assign:{settings:false}},confirm:{assign:{confirm:true}},closeConfirm:{assign:{confirm:false}}}});
 const layout=DockSplit('horizontal',.18,
  DockSplit('vertical',.49,DockTabs(['assets-pane']),DockTabs(['objects-pane'])),
  DockSplit('horizontal',.72,
   DockSplit('vertical',.68,DockTabs(['artboard-pane'],'artboard-pane'),DockTabs(['timeline-pane','source-pane','project-pane','help-pane','log-pane'],'timeline-pane')),
   DockTabs(['properties-pane','brushes-pane','states-pane','grid-pane','templates-pane'],'properties-pane')));
 const settings=Dialog({id:'designer-settings',width:590,height:498,modelBind:modelBinding('shell','settings',{property:'visible'}),action:{type:'model',model:'shell',command:'closeSettings'}},
  h('Grid',{rows:'36 * 36',gap:14},text('DESIGNER SETTINGS',{fontSize:19,foreground:'#74dadd'}),h('ScrollViewer',{row:1},h('StackPanel',{gap:12},
   section('DISPLAY',rows([host('Native pixels','resolution',0,{width:140}),host('Balanced 2048','resolution',1,{width:140})]),rows([host('Sharp curves','quality',0,{width:140}),host('Reference','quality',1,{width:140})])),
   h('CheckBox',{text:'GPU performance overlay',height:29,action:hostAction('hud')}),
   h('CheckBox',{text:'As fast as possible (off by default)',height:29,action:hostAction('asap')}),
   rows([host('Timing off','timing',0),host('Frame','timing',1),host('Stages','timing',2)]),
   rows([host('Typography lab','typography',0,{width:145})]),
   rows([host('Local fonts','fonts',0,{width:130}),host('GPU counters','counters',0,{width:130}),host('Frame sync','sync',0,{width:130})]),
   text('Paced rAF remains the default. Native pixels and preview workload have real GPU costs. No synthetic FPS or CPU text renderer.',{wrap:true,fontSize:11}),
   text('Font changes reopen the designer from a snapshot and reset authoring history. Font files are local or fetched at runtime.',{wrap:true,fontSize:11})
  )),h('Button',{row:2,text:'Done',classes:'design-tool primary',width:100,horizontalAlignment:'end',action:{type:'model',model:'shell',command:'closeSettings'}})));
 const confirm=Dialog({id:'designer-confirm',width:500,height:240,modelBind:modelBinding('shell','confirm',{property:'visible'}),action:{type:'model',model:'shell',command:'closeConfirm'}},
  h('Grid',{rows:'32 * 34',gap:12},text('REPLACE THE OPEN DESIGN?',{fontSize:17,foreground:'#7ee0dd'}),text('The current GPU-owned design and its undo history will be replaced. Save it first to keep your changes.',{row:1,wrap:true,fontSize:13}),h('StackPanel',{row:2,orientation:'horizontal',horizontalAlignment:'end',gap:10},h('Button',{text:'Cancel',classes:'design-tool',width:96,action:{type:'model',model:'shell',command:'closeConfirm'}}),host('Replace','confirm-replace',0,{classes:'design-tool primary',width:106}))));
 const assets=h('Grid',{rows:'* 135',gap:8,padding:10,background:'#14202c'},
  h('ScrollViewer',{},h('StackPanel',{gap:4},text('TOOLS / CONTROLS',{classes:'section',height:24}),
   ...DESIGN_PALETTE.map(item=>command(item.name,'tool',item.tool??(100+Kind[item.type]),item.shape??0,{width:190,height:28})),
   text('Select a tool, then click or drag on the artboard. Select a parent container before inserting.',{fontSize:10,wrap:true,margin:[0,8,0,0]}))),
  h('Grid',{row:1,rows:'25 *'},text('STARTER DESIGNS',{classes:'section'}),h('ListBox',{id:'design-examples',row:1,rowHeight:27,items:examples.map((p,key)=>({key,label:p.title})),itemCapacity:32,itemTextCapacity:2048,action:hostAction('example'),fontSize:11,background:'#101b25'})));
 const brushes=h('Grid',{rows:'* 225 40',gap:5,padding:8},inspector('resources'),h('ColorPicker',{id:'color-editor',row:1,designTarget:'design',foreground:'#dce9ef',background:'#162330'}),rows([command('Apply fill','bindResource',32,0,{width:98}),command('Apply text','bindResource',31,0,{width:98})]));brushes.children[2].props.row=2;
 const states=h('Grid',{rows:'145 35 *',gap:8,padding:10},inspector('states'),command('Reset state overrides','resetState',0,0,{row:1,width:220}),text('Click a state to preview it. Capture stores the current visual values. Changes to composition and colors in a state create overrides. Base contains the layout.',{row:2,wrap:true,fontSize:11}));
 const grid=h('Grid',{rows:'34 * 36',gap:5,padding:8},text('PIXEL / AUTO / STAR',{classes:'section'}),h('PropertyInspector',{row:1,designTarget:'design',designRole:'grid',background:'#14202c',foreground:'#d7e5ee'}),rows([command('Remove last col','gridTrack',0,-1,{width:110}),command('Remove last row','gridTrack',1,-1,{width:110})]));grid.children[2].props.row=2;
 const timeline=h('Grid',{rows:'37 * 35',background:'#14202c'},rows([command('Play / pause','play',0,0,{width:104}),command('Stop','stop',0,0,{width:64}),command('Record','record',0,0,{width:82}),command('Add key','keyframe'),command('Delete key','removeKey',0,0,{width:88}),command('2 s','duration',2,0,{width:50}),command('4 s','duration',4,0,{width:50}),command('8 s','duration',8,0,{width:50})]),h('AnimationTimeline',{id:'timeline',row:1,designTarget:'design',minHeight:224,background:'#14202c',foreground:'#dce9f2',clip:true}),Toolbar({row:2,height:35},...['Linear','Smooth','Spring','Cubic in','Cubic out','Cubic in/out','Sine','Back','Step'].map((name,key)=>command(name,'easing',key,0,{width:78,height:27}))));
 const source=h('Grid',{rows:'36 *'},rows([host('Refresh source','source',0,{width:120}),host('Export module','export-js',0,{width:120}),host('Export app HTML','export-html',0,{width:134})]),h('CodeEditor',{...editor,id:'generated-source',row:1,language:'javascript',readOnly:true,text:'// Refresh source to export the GPU-owned design as Helion declarations.\n'}));
 const json=h('Grid',{rows:'36 *'},rows([host('Snapshot JSON','snapshot-json',0,{width:128}),host('Apply JSON','apply-json',0,{width:100}),host('Save project','save',0,{width:110})]),h('CodeEditor',{...editor,id:'project-json',row:1,language:'json',text:'{\n  "note": "Click Snapshot JSON to read the retained project. Imported text is never evaluated."\n}\n'}));
 const catalog=project.templates;
 const templates=h('Grid',{rows:'190 *',background:'#15202d'},h('ScrollViewer',{},h('StackPanel',{padding:10,gap:7},
  text('CONTROL TEMPLATES',{classes:'section'}),text('Select an authored leaf control, then Apply. Assignments and theme choices participate in GPU undo.',{fontSize:11,wrap:true}),
  rows([host('New / copy','template-copy',0,{width:100}),host('Remove unused','template-remove',0,{width:110})]),
  rows([command('Native visuals','template',0,0,{width:110}),command('Theme defaults','templateDefaults',63,0,{width:115})]),
  rows([command('Fluent dark','controlTheme',0,0,{width:100}),command('Fluent light','controlTheme',0,1,{width:100})]),
  rows([command('macOS dark','controlTheme',1,0,{width:100}),command('macOS light','controlTheme',1,1,{width:100})]),
  text('CONTRAST / DENSITY',{classes:'section'}),
  rows([command('Standard','themePreference',0,0,{width:100}),command('High contrast','themePreference',0,1,{width:110})]),
  rows([command('Comfortable','themePreference',1,0,{width:105}),command('Compact','themePreference',1,1,{width:105})]),
  rows([command('Motion on','themePreference',2,0,{width:100}),command('Reduced','themePreference',2,1,{width:110})]),
  text('ACCENT',{classes:'section'}),
  rows([command('Blue','themeAccent',0xb772,0xffff,{width:60}),command('Violet','themeAccent',0xa98b,0xffee,{width:65}),command('Green','themeAccent',0xd26e,0xff98,{width:65})]),
  command('Use theme accent','themePreference',3,0,{width:160}),
  text('PREVIEW SELECTED TEMPLATE',{classes:'section'}),
  rows([command('Normal','templatePreview',1,0,{width:65}),command('Over','templatePreview',2,0,{width:60}),command('Pressed','templatePreview',4,0,{width:70})]),
  rows([command('Focus','templatePreview',5,0,{width:65}),command('Checked','templatePreview',9,0,{width:65}),command('Disabled','templatePreview',17,0,{width:70})]),
  command('Return to automatic states','templatePreview',0,0,{width:217}),
  text('State preview changes visuals only; Preview mode exercises actual input. Contrast overrides custom accent for legibility.',{fontSize:10,wrap:true}),
  ...catalog.map((t,i)=>h('StackPanel',{gap:4},text(t.name+' / '+t.targetType,{fontSize:11}),rows([command('Apply','template',i+1,1,{width:64}),host('JSON','template-json',i,{width:60}),host('Edit parts','template-parts',i,{width:90})]))),
  text('Catalog replacement validates and remounts from an explicit snapshot. Part edits use a separate GPU document/history.',{fontSize:10,wrap:true})
  )),h('Grid',{row:1,rows:'36 36 *'},rows([host('Apply JSON','template-apply-json',0,{width:102}),host('Save parts','template-save-parts',0,{width:98})]),Toolbar({row:1,height:36},host('Back / cancel','template-back',0,{width:118})),h('CodeEditor',{...editor,id:'template-json',row:2,language:'json',text:catalog.length?JSON.stringify(catalog[0],null,2):'{}'})));
 if(!catalog.length){const disable=n=>{if(['themePreference','themeAccent','templatePreview','controlTheme'].includes(n.props?.action?.command))n.props.disabled=true;n.children?.forEach(disable);};disable(templates);}
 return h('Grid',{id:'studio',rows:'46 39 * 26',background:'#0d1621',styles:DESIGNER_THEME,models:{shell}},
  h('Grid',{columns:'204 * auto',padding:[12,8],gap:8,background:'#152332'},h('StackPanel',{orientation:'horizontal',gap:9},text('H',{fontSize:25,fontWeight:600,foreground:'#7adce0',width:23}),text('HELION  /  STUDIO',{fontSize:13,fontWeight:600,verticalAlignment:'center'})),text(project?.title??'Untitled design',{column:1,fontSize:12,textCapacity:256,verticalAlignment:'center',id:'project-title'}),h('StackPanel',{column:2,orientation:'horizontal',gap:5},host('New','new',0,{width:54}),host('Open','open',0,{width:58}),host('Save','save',0,{width:58,classes:'design-tool primary'}),host('Export','export-html',0,{width:66}),host('Playground','playground',0,{width:88}),h('Button',{text:'Settings',classes:'design-tool',width:72,action:{type:'model',model:'shell',command:'settings'}}))),
  Toolbar({row:1,height:39,background:'#111d29'},command('Select','tool',0,0,{width:60}),command('Hand','tool',1,0,{width:58}),command('Undo','undo',0,0,{width:58}),command('Redo','redo',0,0,{width:58}),command('Duplicate','duplicate',0,0,{width:84}),command('Delete','delete',0,0,{width:62}),command('Group','group',0,0,{width:62}),command('Ungroup','ungroup',0,0,{width:72}),command('Snap','snap',0,0,{width:55}),command('Grid','grid',0,0,{width:50}),command('Fit','fit',0,0,{width:44}),command('100%','resetView',0,0,{width:54}),command('Preview','preview',0,0,{width:86,classes:'design-tool primary'}),host('Reopen panes','reopen',0,{width:106}),host('Help','help',0,{width:54})),
  h('DockWorkspace',{id:'designer-dock',row:2,dockLayout:layout,background:'#0e1822'},
   pane('assets-pane','Assets',assets),pane('objects-pane','Objects',h('Grid',{rows:'31 * 34'},Toolbar({height:31},command('Show/hide','visibility',0,0,{width:85,height:25}),command('Lock','lock',0,0,{width:55,height:25}),command('All','selectAll',0,0,{width:42,height:25})),h('DesignTree',{id:'objects',row:1,designTarget:'design',background:'#13202c',foreground:'#d7e5ef',clip:true}),Toolbar({row:2,height:34},command('Front','reorder',0,0,{width:54,height:26}),command('Back','reorder',1,0,{width:54,height:26}),command('Raise','reorder',2,0,{width:54,height:26}),command('Lower','reorder',3,0,{width:54,height:26})))),
   pane('artboard-pane','Design',h('Grid',{rows:'34 * 31'},Toolbar({height:34},...['Left','Center X','Right','Top','Center Y','Bottom'].map((name,key)=>command(name,'align',key,0,{width:66,height:26})),command('Space X','distribute',0,0,{width:68,height:26}),command('Space Y','distribute',1,0,{width:68,height:26})),h('DesignSurface',{id:'design',row:1,designDocument:project,background:'#101822',clip:true}),h('Grid',{row:2,columns:'* auto',padding:[8,6]},text('Shift: constrain    Alt: pan    Ctrl+wheel: zoom',{fontSize:10}),command('Artboard','select',0,0,{column:1,width:76,height:22})))),
   pane('templates-pane','Templates',templates),pane('properties-pane','Properties',inspector()),pane('brushes-pane','Brushes',brushes),pane('states-pane','States',states),pane('grid-pane','Grid tracks',grid),pane('timeline-pane','Timeline',timeline),pane('source-pane','Generated JS',source),pane('project-pane','project.json',json),pane('help-pane','Guide',h('TextEditor',{...editor,id:'designer-guide',readOnly:true,wordWrap:true,text:DESIGNER_GUIDE})),pane('log-pane','Diagnostics',h('TextEditor',{...editor,id:'designer-log',readOnly:true,wordWrap:true,text:'No native validation or hardware frame-rate claim is implied by the UI.\n'}))
  ),h('Grid',{row:3,columns:'* auto',padding:[10,5],background:'#132333'},text('Compute design workspace · explicit project snapshots · Ctrl/Cmd+S to save',{id:'designer-status',textCapacity:512,fontSize:10}),text('EXPERIMENTAL  /  WEBGPU',{column:1,fontSize:10,foreground:'#74d4d9'})),settings,confirm);
}
