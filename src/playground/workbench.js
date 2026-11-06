import {h} from '../core/declaration.js';
import {DockTabs,DockSplit} from '../docking/index.js';
import {defineModel,field,computed,expr,modelBinding} from '../models/index.js';
export const EDITOR_FONT_SOURCES=Object.freeze([{source:'https://raw.githubusercontent.com/notofonts/noto-fonts/v20201206-phase3/hinted/ttf/NotoSansMono/NotoSansMono-Regular.ttf',family:'Noto Sans Mono',weight:400}]);
export const WORKBENCH_STYLE=`
 Button.tool {Background: #22363d; Foreground: #d0ded8; CornerRadius: 5; FontSize: 11;}
 Button.tool:pointerover {Background: #35554d;}
 Button.tool:pressed {Background: #3c6e5d;}
 Button.tool:focus {BorderBrush: #80ddc2; BorderThickness: 1;}
`;
const snippets=[
 {label:'h — create a view',insertText:"h('${1:TextBlock}', { text: '${2:Hello}' })$0"},
 {label:'function — declaration',insertText:'function ${1:name}(${2:args}) {\n  ${0}\n}'},
 {label:'for — counted loop',insertText:'for (let ${1:i} = 0; ${1} < ${2:10}; ${1}++) {\n  $0\n}'},
 {label:'model — device-owned fields',insertText:"defineModel({\n  count: field('f32', ${1:0}),\n  doubled: computed('f32', expr.mul(expr.ref('count'), 2))\n})$0"}
];
export function createWorkbench({code='',css='',notes='Notes are retained on the GPU.\n\nCtrl/Cmd+F: find   Ctrl/Cmd+H: replace\nCtrl/Cmd+Space: completions and snippets\nAlt+click: another caret\nShift+Alt+drag: rectangular selection\nCtrl/Cmd+Tab: next document tab\n\nDrag a tab into a group or near an edge to dock.\nDrag outside the workspace and release to float.\nRun and Save read explicit source snapshots.\n'}={}) {
 const tool=(text,command)=>h('Button',{text,classes:'tool',width:64,height:29,action:{type:'editor',command}});
 const model=defineModel({level:field('f32',.35),percent:computed('f32',expr.mul(expr.ref('level'),100)),count:field('i32',0),doubled:computed('i32',expr.mul(expr.ref('count'),2)),canIncrement:computed('bool',expr.lt(expr.ref('count'),10000))},
 {commands:{increment:{canExecute:expr.ref('canIncrement'),assign:{count:expr.add(expr.ref('count'),1)}},reset:{assign:{count:0,level:.35}}}});
 const label=(text,props={})=>h('TextBlock',{text,fontSize:11,foreground:'#96b0c2',...props});
 const editorProps={fontFamily:'Noto Sans Mono',fontSize:13,editorLineHeight:21,documentCapacity:65536,historyCapacity:262144,background:'#101923',foreground:'#dce9f3',lineNumbers:true,clip:true};
 return h('Grid',{id:'workbench-root',rows:'36 *',background:'#0d1823',styles:WORKBENCH_STYLE,models:{workbench:model}},
  h('ScrollViewer',{height:36},h('StackPanel',{orientation:'horizontal',gap:4,padding:3},...[
    ['Undo','undo'],['Redo','redo'],['Find','find'],['Replace','replace'],['All','replaceAll'],['Wrap','toggleWrap'],['Map','toggleMinimap'],['Fold','fold'],['Unfold','unfoldAll'],['Comment','toggleComment'],['Indent','indent'],['Outdent','outdent'],['Palette','commandPalette']
  ].map(([name,command])=>tool(name,command)))),
  h('DockWorkspace',{id:'workspace-dock',row:1,background:'#0e1924',dockLayout:DockSplit('vertical',.75,DockTabs(['source-pane','style-pane','notes-pane'],'source-pane'),DockTabs(['model-pane']))},
   h('DockItem',{id:'source-pane',title:'app.js'},h('CodeEditor',{...editorProps,id:'source-editor',language:'javascript',text:code,completions:[...['const','let','return','function','async','await','console.log','h','Helion','Grid','DockWorkspace','CodeEditor','DrawingContext','defineModel','field','computed','expr'],...snippets]})),
   h('DockItem',{id:'style-pane',title:'styles.css'},h('CodeEditor',{...editorProps,id:'style-editor',language:'css',text:css})),
   h('DockItem',{id:'notes-pane',title:'notes.txt'},h('TextEditor',{...editorProps,id:'notes-editor',language:'text',wordWrap:true,text:notes})),
   h('DockItem',{id:'model-pane',title:'GPU view model',canClose:false},
    h('ScrollViewer',{padding:12},h('StackPanel',{gap:6},
     label('TYPED GPU MODEL · two-way input → computed values',{foreground:'#56d3d2'}),
     h('Grid',{columns:'* 95 80',gap:8,height:30},h('Slider',{id:'model-level',modelBind:modelBinding('workbench','level',{mode:'twoWay'})}),label('Percent ',{column:1,bind:modelBinding('workbench','percent')}),h('ProgressBar',{column:2,height:10,verticalAlignment:'center',bind:modelBinding('workbench','level')})),
     h('StackPanel',{orientation:'horizontal',gap:8,height:30},h('Button',{text:'Increment',width:100,height:28,classes:'tool',action:{type:'model',model:'workbench',command:'increment'}}),h('Button',{text:'Reset',width:70,height:28,classes:'tool',action:{type:'model',model:'workbench',command:'reset'}}),label('Count ',{width:120,bind:modelBinding('workbench','count')}),label('Doubled ',{width:130,bind:modelBinding('workbench','doubled')})),
     label('All live values and derived expressions stay in device memory. No polling.',{wrap:true}))))
  ));
}
