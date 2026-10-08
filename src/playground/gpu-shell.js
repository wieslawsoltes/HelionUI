import {h} from '../core/declaration.js';
import {createWorkbench,WORKBENCH_STYLE} from './workbench.js';
import {DockTabs,DockSplit} from '../docking/index.js';
import {defineModel,field,modelBinding} from '../models/index.js';
import {hostAction,Dialog,Toolbar} from '../controls/index.js';
import {dataSource} from '../data/index.js';

export const DOCUMENT_IDS=Object.freeze({code:'source-editor',css:'style-editor',notes:'notes-editor',data:'data-editor'});
export const PANE_IDS=Object.freeze(['source-pane','style-pane','notes-pane','model-pane','explorer-pane','console-pane','help-pane','data-editor-pane','data-pane','preview-pane']);
export const INITIAL_ROWS=Object.freeze([
 {id:1,name:'Measure / arrange',value:2,enabled:true},
 {id:2,name:'Virtualized DataGrid',value:65536,enabled:true},
 {id:3,name:'Resident editor documents',value:6,enabled:true},
 {id:4,name:'Independent rAF producers',value:1,enabled:true}
]);
export const HELP_TEXT=`HELION / GPU PLAYGROUND 0.12

Everything inside this canvas is a Helion control: toolbars, tabs, lists, trees,
modal settings, editors, console, docking, data grid, help and embedded preview.
The browser still supplies files, fonts, IME commits, clipboard, workers and time.

RUN AN APP
Return a Helion view or call app(view). Ctrl/Cmd+Enter runs the current source.
Subsequent app(view) calls replace ONLY the embedded preview. The workspace,
documents, undo history, dock state and dataset stay mounted.
The preview shares the owner's device, prepared pipelines, frame clock and queue.
Input coordinates and preview composition are evaluated on the GPU.

DYNAMIC DATA
const rows = Helion.dataSource({
  key: 'id', capacity: 4096,
  columns: [{field:'name',type:'text'}, {field:'value',type:'number'}],
  rows: [{id:1,name:'First',value:12}]
});
h('DataGrid', {id:'grid', ItemsSource:rows});
app.data('grid', 'patch', 1, {value:42});
app.data('grid', 'upsert', [{id:2,name:'Next',value:5}]);
app.data('grid', 'remove', 2);
app.data('grid', 'replace', [{id:3,name:'Replacement',value:9}]);
app.data('grid', 'sort', 'value', 'descending');

Rows have unique unsigned 32-bit keys, not array positions. Insert/update/remove
keep the other row identities, sorting and selection stable. Batched operations
are ordered. A replacement is capacity-checked before clearing existing data.
Text is retained in a bounded arena with GPU compaction; capacity failures are
observable, not silently truncated. Column schemas and capacities are declared.

RUNTIME CONTROLS
app.text('label', 'Changed'); // reserve TextCapacity on the label
app.items('list', [{key:1,label:'One'}, {key:2,label:'Two'}]);
app.model('model', 'set', 'value', 0.5);
set('control', 'opacity', 0.8);
app.onAction(event => console.log(event.name));
h('Button', {text:'Invoke JS',action:Helion.hostAction('invoke')});
Host actions are explicit, asynchronous input-event readbacks. Ordinary GPU
commands/bindings do not need these callbacks. No document polling is performed.

EDITING
Ctrl/Cmd+Z / Y: undo / redo. Ctrl/Cmd+F / H: literal find / replace.
Ctrl/Cmd+Space: configured completions. Tab: snippet stops.
Ctrl/Cmd+D: next occurrence. Alt+click: add caret. Shift+Alt+drag: rectangle.
Ctrl/Cmd+/: toggle comment. Alt+Up/Down: move lines. Ctrl/Cmd+G: line.
Ctrl/Cmd+Shift+P: editor palette. Ctrl/Cmd+S: workspace export.
Ctrl/Cmd+O: file picker. Ctrl/Cmd+Alt+F: local font picker, including during boot.

DOCKING
Drag tabs between groups or to a group edge to split. Drag out to float inside
the canvas. Floating title bars move; bottom-right corners resize. Ctrl/Cmd+Tab
cycles document tabs. Reopen all restores closed panes. Documents are not rebuilt
when panes move. The preview tab hosts a GPU texture, not an HTML frame.

DATASET
Edit data.json, then Apply JSON. This changes the live table without remounting.
Snapshot table copies the current rows (including GPU cell edits) into data.json.
Patch / add / remove demonstrates live keyed ingestion. Clear removes all rows.
Schema changes require a new scene; rows within the declared capacity do not.

FILES / PLATFORM
Open and Save use explicit snapshots, never a continuously synchronized document.
Import does not execute source. Auto-run is off until you explicitly enable it.
Run does not reset editor history. Choosing a new font snapshots/remounts the shell
and resets history. Native file/permission dialogs cannot execute in a shader.

LIMITS AND VERIFICATION
This is an experimental bounded framework, not a complete IDE or OS UI toolkit.
One DataGrid and one embedded presenter per surface; nested presenters are rejected.
No semantic LSP, debugger, regex engine, complete Unicode/bidi/preedit/accessibility
or certified hostile-code isolation is supplied. Source runs in a network-disabled
worker; Stop terminates it, but there is no hard worker/GPU memory quota.
GPU/native and real-browser gates must be run on the target device. Host tests
are not a measured frame-rate or pixel-quality guarantee.
`;

export function createGPUShell({code='',css='',notes='',data=JSON.stringify(INITIAL_ROWS,null,2),examples=[]}={}){
 const base=createWorkbench({code,css,...(notes?{notes}:{})});
 const oldDock=base.children[1];
 const watch=node=>{if(node.props?.id==='source-editor'||node.props?.id==='style-editor')node.props.changeAction='source-changed';for(const child of node.children??[])watch(child);};watch(base);
 const text=(value,props={})=>h('TextBlock',{text:value,fontSize:12,foreground:'#adc2d1',...props});
 const button=(title,name,value=0,props={})=>h('Button',{text:title,classes:'tool',height:32,width:94,action:hostAction(name,value),...props});
 const pane=(id,title,view)=>h('DockItem',{id,title},view);
 const doc={fontFamily:'Noto Sans Mono',fontSize:12,editorLineHeight:20,documentCapacity:65536,historyCapacity:131072,background:'#101923',foreground:'#cfdfeb',clip:true};
 const files=[{key:100,label:'WORKSPACE',children:[{key:0,label:'app.js'},{key:1,label:'styles.css'},{key:2,label:'notes.txt'},{key:3,label:'data.json'},{key:4,label:'Live dataset'},{key:5,label:'GPU view model'},{key:6,label:'Console'},{key:7,label:'API guide'},{key:8,label:'Live preview'}]}];
 const dockLayout=DockSplit('horizontal',.17,DockTabs(['explorer-pane']),DockSplit('horizontal',.57,
   DockSplit('vertical',.76,DockTabs(['source-pane','style-pane','notes-pane','data-editor-pane'],'source-pane'),DockTabs(['console-pane','model-pane','help-pane'],'console-pane')),
   DockTabs(['preview-pane','data-pane'],'preview-pane')));
 const source=dataSource({key:'id',capacity:4096,stringCapacity:131072,inboxCapacity:131072,
  columns:[{field:'name',title:'Name',type:'text',width:230},{field:'value',title:'Value',type:'number',width:115,editable:true},{field:'enabled',title:'Enabled',type:'boolean',width:105}],rows:INITIAL_ROWS.map(r=>({...r}))});
 const menu=defineModel({settings:field('bool',false)},{commands:{openSettings:{assign:{settings:true}},closeSettings:{assign:{settings:false}}}});
 const settings=Dialog({id:'settings-dialog',width:590,height:566,modelBind:modelBinding('shell','settings',{property:'visible'}),action:{type:'model',model:'shell',command:'closeSettings'}},
  h('Grid',{rows:'34 * 38',gap:12},text('WORKSPACE SETTINGS',{fontSize:19,foreground:'#62d7d2'}),
   h('ScrollViewer',{row:1},h('StackPanel',{gap:12},
    h('CheckBox',{id:'auto-run',text:'Auto-run editor input (900 ms debounce)',action:hostAction('auto-run'),height:30,fontSize:12}),
    h('CheckBox',{id:'hud-option',text:'GPU performance overlay',action:hostAction('hud'),height:30,fontSize:12}),
    h('CheckBox',{id:'paced-option',text:'Paced vsync: two independent frame credits',value:1,action:hostAction('paced'),height:30,fontSize:12}),
    h('CheckBox',{id:'asap-option',text:'As fast as possible (off by default)',action:hostAction('asap'),height:30,fontSize:12}),
    text('GPU timestamps are an opt-in diagnostic, not a scanout measurement.',{wrap:true,fontSize:11}),
    Toolbar({height:40},button('Frame timing','timing',1,{width:130}),button('No timestamps','timing',0,{width:134}),button('Stage timing','timing',2,{width:130})),
    text('TEXT / DISPLAY',{foreground:'#62d7d2'}),
    Toolbar({height:36},button('Sharp curves','text-quality',0,{width:144}),button('Reference','text-quality',1,{width:124})),
    Toolbar({height:36},button('Native pixels','resolution',0,{width:144}),button('Balanced 2048','resolution',1,{width:144})),
    text('Native pixels use more GPU memory/bandwidth on high-DPI displays.',{fontSize:11,wrap:true}),
    text('Font change is a snapshot/remount and resets undo history.',{fontSize:11,wrap:true}))),
   h('StackPanel',{row:2,orientation:'horizontal',gap:10},button('Local fonts','fonts',0,{width:130}),h('Button',{text:'Close',width:90,height:32,classes:'tool',action:{type:'model',model:'shell',command:'closeSettings'}}))));
 const core=h('Grid',{id:'shell-layout',rows:'46 36 * 26',background:'#0b1520'},
   Toolbar({id:'shell-toolbar',height:46,padding:4},
    text('HELION / GPU',{width:145,fontSize:17,foreground:'#65d8d0',verticalAlignment:'center'}),
    button('Run app','run',0,{width:92,background:'#1b5b62',foreground:'#f1ffff'}),button('Stop','stop',0,{width:64}),
    button('Open','open',0,{width:62}),button('Save','save',0,{width:62}),button('Export JS','export-js',0,{width:92}),
    button('Reopen all','reopen',0,{width:104}),button('Save layout','save-layout',0,{width:106}),button('Load layout','load-layout',0,{width:106}),
    h('Button',{text:'Settings',height:32,width:86,classes:'tool',action:{type:'model',model:'shell',command:'openSettings'}}),button('API','help',0,{width:55}),button('Designer','designer',0,{width:96}),button('Typography','typography',0,{width:104})),
   {...base.children[0],props:{...base.children[0].props,row:1}},
   h('DockWorkspace',{id:'workspace-dock',row:2,background:'#0e1924',dockLayout},
    ...oldDock.children,
    pane('explorer-pane','Explorer',h('Grid',{rows:'172 30 36 *',gap:7,padding:8},
      h('TreeView',{id:'documents',items:files,rowHeight:25,fontSize:11,foreground:'#bcd3e0',action:hostAction('document'),itemCapacity:64,itemTextCapacity:2048}),
      text('EXAMPLES',{row:1,foreground:'#60d6d2',verticalAlignment:'center'}),
      h('TextBox',{id:'example-search',row:2,height:34,fontSize:12}),
      h('ListBox',{id:'examples',row:3,items:examples.map((e,key)=>({key,label:e.name})),filter:'example-search',rowHeight:34,fontSize:11,action:hostAction('example'),itemCapacity:256,itemTextCapacity:8192}))),
    pane('console-pane','Console',h('Grid',{rows:'35 *'},Toolbar({height:35},button('Clear','clear-log',0,{width:70,height:28}),button('Read model','inspect-model',0,{height:28,width:102}),button('Frame sync','inspect-frames',0,{height:28,width:102})),h('TextEditor',{...doc,id:'console-editor',row:1,readOnly:true,lineNumbers:false,wordWrap:true,text:'The GPU workspace is ready. Run an example or apply a dataset.\n'}))),
    pane('help-pane','API guide',h('TextEditor',{...doc,id:'help-editor',readOnly:true,wordWrap:true,lineNumbers:false,text:HELP_TEXT})),
    pane('data-editor-pane','data.json',h('Grid',{rows:'35 *'},Toolbar({height:35},button('Apply JSON','apply-data',0,{width:116,height:28}),button('Snapshot table','snapshot-data',0,{width:132,height:28})),h('CodeEditor',{...doc,id:'data-editor',row:1,language:'json',text:data}))),
    pane('data-pane','Live dataset',h('Grid',{rows:'36 36 *',gap:4,padding:6},
     Toolbar({height:36},button('Patch','patch-data',0,{width:66,height:28}),button('Add','add-data',0,{width:56,height:28}),button('Remove last','remove-data',0,{width:112,height:28}),button('Clear','clear-data',0,{width:64,height:28})),
     h('Grid',{row:1,columns:'* 115',gap:8},h('TextBox',{id:'data-search',height:32,fontSize:12}),text('Rows ',{column:1,verticalAlignment:'center',bind:{metric:'rows'}})),
     h('DataGrid',{id:'dataset',row:2,itemsSource:source,filter:'data-search',rowHeight:30,fontSize:12,background:'#101923',borderWidth:1,borderColor:'#293f52'}))),
    pane('preview-pane','Live preview',h('Grid',{rows:'36 *',background:'#101b27'},
     Toolbar({height:36},button('Fit','viewport',0,{width:48,height:28}),button('Desktop','viewport',1,{width:86,height:28}),button('Tablet','viewport',2,{width:80,height:28}),button('Phone','viewport',3,{width:72,height:28}),button('FPS','hud-toggle',0,{width:56,height:28})),
     h('SurfacePresenter',{id:'preview',row:1,presenterWidth:0,presenterHeight:0,text:'Run app to attach a GPU preview',fontSize:15,foreground:'#91aabd',background:'#0c1823',padding:6})))),
   h('Grid',{row:3,columns:'* 215',padding:[10,4],background:'#13222f'},
     text('Ready · Ctrl/Cmd+Enter runs · Ctrl/Cmd+S saves',{id:'runtime-status',textCapacity:512,fontSize:10}),
     text('Single canvas / shared queue',{column:1,fontSize:10,foreground:'#62cbbb'})));
 return h('Panel',{id:'gpu-playground',fontFamily:'Noto Sans Mono',styles:WORKBENCH_STYLE,models:{...base.props.models,shell:menu},background:'#0b1520'},core,settings);
}
