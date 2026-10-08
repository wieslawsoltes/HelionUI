export const examples = [
{ name:'Workbench · layout & styles', code:`const { h, Thickness } = Helion;
const button = text => h('Button', { Content: text, Classes: 'tool' });
return h('DockPanel', { Padding: Thickness(22), Gap: 16 },
  h('StackPanel', { Dock: 'top', Gap: 6 },
    h('TextBlock', { Text: 'Make yourself at home.', Classes: 'title' }),
    h('TextBlock', { Text: 'Edit this app. Layout and interaction stay on the GPU.', Classes: 'subtitle', Wrap: true })),
  h('Border', { Dock: 'bottom', Height: 44, Classes: 'card' },
    h('TextBlock', { Text: 'Try resizing the preview or hovering over a button.', FontSize: 12 })),
  h('Border', { Dock: 'left', Width: 155, Classes: 'card' },
    h('StackPanel', { Gap: 12 }, button('Overview'), button('Activity'), button('Settings'))),
  h('Grid', { RowDefinitions: 'auto *', Gap: 16 },
    h('WrapPanel', { Orientation: 'horizontal', Gap: 10 }, ...['Layouts', 'Styles', 'Drawing', 'Composition'].map(button)),
    h('UniformGrid', { 'Grid.Row': 1, Columns: 2, Rows: 2, Gap: 12 },
      ...['Measure + Arrange', 'Retained controls', 'GPU transitions', 'Reusable modules'].map((title, i) =>
        h('Border', { Classes: 'card' }, h('StackPanel', { Gap: 14 },
          h('TextBlock', { Text: title, FontSize: 15, Wrap: true }),
          h('Slider', { Name: 's' + i, Value: (i + 1) / 5, Height: 30 }),
          h('ProgressBar', { Height: 6, Bind: { source: 's' + i }, Foreground: '#43d3cb' })))))));
`, css:`${''}Button.tool { MinWidth: 94; Height: 37; }
Button.tool:pointerover { Background: #345c72; }
Button.tool:pressed { Background: #147b90; }
`},
{ name:'DrawingContext · brushes & paths', code:`const { h, DrawingContext, LinearGradientBrush, RadialGradientBrush, GradientStop,
  Pen, FormattedText, PathGeometry, RotateTransform, TranslateTransform } = Helion;
const dc = new DrawingContext({ width: 600, height: 390 });
const ocean = LinearGradientBrush([GradientStop('#27d5c7', 0), GradientStop('#435de0', 1)]);
dc.DrawRoundedRectangle('#102a3b', Pen('#34596f', 1), [12, 12, 576, 366], 20);
dc.DrawRoundedRectangle(ocean, null, [38, 90, 230, 145], 22);
dc.DrawEllipse(RadialGradientBrush([GradientStop('#edfefa', 0), GradientStop('#3878d0', 1)]), null, [420, 164], 100, 74);
dc.DrawText(FormattedText('Draw once. Retain on the device.', { fontSize: 24 }), [38, 36], '#eaf5ff');
dc.DrawGeometry(null, Pen('#ffcf7a', 3), PathGeometry('M 38 302 C 120 210 170 380 248 292 S 414 208 550 300'));
const scope = dc.PushTransform(TranslateTransform(355, 300));
const turn = dc.PushTransform(RotateTransform(-12));
dc.DrawRoundedRectangle('#214354', Pen('#59d7cb', 2), [-54, -26, 140, 52], 9);
dc.DrawText(FormattedText('Transform', { fontSize: 15 }), [-38, -11], '#eaf5ff');
turn.dispose(); scope.dispose();
return h('Viewbox', { Padding: 20, Stretch: 'Uniform' }, dc.toView());
`,css:''},
{ name:'Composition · keyframes & expressions', code:`const { h, Compositor, bindExpression } = Helion;
const compositor = new Compositor();
const motion = compositor.CreateScalarKeyFrameAnimation({ duration: 4, iterations: 'infinite', direction: 'alternate' });
motion.InsertKeyFrame(0, 0).InsertKeyFrame(0.55, 260, 'cubicInOut').InsertKeyFrame(1, 140, 'backOut');
return h('Grid', { Rows: 'auto * auto', Padding: 24, Gap: 18 },
  h('TextBlock', { Text: 'Composition without layout invalidation', Classes: 'title', Wrap: true }),
  h('Canvas', { Row: 1, Clip: true, Background: '#0e202d' },
    h('Border', { Name: 'animated', X: 28, Y: 50, Width: 140, Height: 95, Radius: 18,
      Background: '#176c86', Animations: [motion.toAnimation('translateX')] },
      h('TextBlock', { Text: 'Keyframes', Margin: [22, 34], FontSize: 16 })),
    h('Border', { X: 28, Y: 190, Width: 140, Height: 75, Radius: 15, Background: '#316958',
      Animations: [bindExpression('translateX', 'control', { scale: 260 })] },
      h('TextBlock', { Text: 'Expression', Margin: [21, 23], FontSize: 16 }))),
  h('StackPanel', { Row: 2, Gap: 10 },
    h('TextBlock', { Text: 'Move the second visual with a resident scalar binding.', Classes: 'subtitle', Wrap: true }),
    h('Slider', { Name: 'control', Height: 38, Value: 0.35 })));
`,css:''},
{ name:'DataGrid · 65,536 resident rows', code:`const { h } = Helion;
return h('Grid', { Rows: 'auto 42 *', Padding: 18, Gap: 14 },
  h('TextBlock', { Text: 'Resident resource explorer', Classes: 'title' }),
  h('TextBox', { Name: 'search', Row: 1, FontSize: 14 }),
  h('DataGrid', { Name: 'resources', Row: 2, RowCount: 65536, RowHeight: 36,
    Filter: 'search', FontSize: 13, Background: '#10202c', BorderColor: '#32566d', BorderWidth: 1 }));
`,css:''},
{ name:'Components · resources & constraints', code:`const { h, StaticResource, ColumnDefinition } = Helion;
function MetricCard({ title, value, children }) {
  return h('Border', { Classes: 'card', MinHeight: 108 },
    h('StackPanel', { Gap: 12 },
      h('TextBlock', { Text: title, Classes: 'subtitle' }),
      h('TextBlock', { Text: value, FontSize: 30, Foreground: StaticResource('accent') }), ...children));
}
return h('Grid', { Rows: 'auto *', Padding: [24, 20], Gap: 20,
    Resources: { accent: '#54d5d0' } },
  h('TextBlock', { Text: 'Components are plain functions.', Classes: 'title', Wrap: true }),
  h('Grid', { Row: 1, Columns: [ColumnDefinition('*', 160, 340), ColumnDefinition('2*', 160, 600)], Gap: 16 },
    h('StackPanel', { Gap: 14 }, h(MetricCard, { title: 'ACTIVE', value: '128' }), h(MetricCard, { title: 'QUEUED', value: '24' })),
    h('Border', { Column: 1, Classes: 'card' },
      h('WrapPanel', { Orientation: 'horizontal', Gap: 9, ItemWidth: 105, ItemHeight: 42 },
        ...Array.from({ length: 16 }, (_, i) => h('Button', { Content: 'Item ' + (i + 1) }))))));
`,css:''}
];

examples.push({name:'GPU code editors · docking',code:`const { h, DockTabs, DockSplit, TextDocument } = Helion;
return h('DockWorkspace', {
  Name: 'documents',
  DockLayout: DockSplit('horizontal', .62, DockTabs(['js','notes']), DockTabs(['styles']))
},
  h('DockItem', { Name:'js', Title:'main.js' },
    h('CodeEditor', { Name:'main', FontFamily:'Noto Sans Mono', FontSize:14,
      ...TextDocument('// Device-owned source\\nconst answer = 42;\\nconsole.log(answer);', {language:'javascript'}) })),
  h('DockItem', { Name:'notes', Title:'notes.txt' },
    h('TextEditor', { Text:'Drag tabs, split the workspace, then type.\\nDocuments and undo history stay on the GPU.', WordWrap:true })),
  h('DockItem', { Name:'styles', Title:'theme.css' },
    h('CodeEditor', { Language:'css', Text:'Button {\\n  Background: #1e5573;\\n  Foreground: white;\\n}' }))
);`,css:''});
examples.push({name:'GPU models · commands & bindings',code:`const { h, defineViewModel, field, computed, expr, modelBinding } = Helion;
const model = defineViewModel({
  amount:field('f32',.4), count:field('i32',0),
  percent:computed('f32',expr.mul(expr.ref('amount'),100)),
  total:computed('f32',expr.mul(expr.ref('count'),expr.ref('amount'))),
  canAdd:computed('bool',expr.lt(expr.ref('count'),100))
}, {commands:{
  add:{canExecute:expr.ref('canAdd'),assign:{count:expr.add(expr.ref('count'),1)}},
  reset:{assign:{count:0,amount:.4}}
}});
return h('StackPanel', {Padding:28, Gap:16, Models:{vm:model}},
  h('TextBlock',{Text:'No per-frame CPU view model',FontSize:24}),
  h('Slider',{Height:36, ModelBind:modelBinding('vm','amount',{mode:'twoWay'})}),
  h('TextBlock',{Text:'Percent ',Bind:modelBinding('vm','percent')}),
  h('TextBlock',{Text:'Count ',Bind:modelBinding('vm','count')}),
  h('TextBlock',{Text:'Total ',Bind:modelBinding('vm','total')}),
  h('Button',{Text:'Add',Height:38,Action:{type:'model',model:'vm',command:'add'}}),
  h('Button',{Text:'Reset',Height:38,Action:{type:'model',model:'vm',command:'reset'}}));`,css:''});
examples.push({name:'GPU text · snippets & commands',code:`const { h, TextDocument } = Helion;
const tool = (Text,command) => h('Button',{Text,Width:100,Height:32,
  Action:{type:'editor',target:'source',command}});
return h('Grid',{Rows:'40 *',Padding:16,Gap:8},
  h('WrapPanel',{Gap:6},tool('Undo','undo'),tool('Redo','redo'),tool('Find','find'),
    tool('Wrap','toggleWrap'),tool('Complete','complete')),
  h('CodeEditor',{Name:'source',Row:1,FontFamily:'Noto Sans Mono',FontSize:14,
    ...TextDocument('// Ctrl/Cmd+Space shows completion snippets.\\nfun',{
      language:'javascript',completions:[
        {label:'function — declaration',insertText:'function \${1:name}(\${2:args}) {\\n  $0\\n}'},
        'const','return','console.log'
      ]
    })}));`,css:''});
examples.push({name:'Live data · keyed ItemsSource',code:`const {h,dataSource,hostAction} = Helion;
let nextKey=3;
app(h('Grid',{rows:'42 40 *',padding:18,gap:8},
  h('StackPanel',{orientation:'horizontal',gap:8},
    h('Button',{text:'Append row',width:130,height:34,action:hostAction('append')}),
    h('Button',{text:'Patch first',width:130,height:34,action:hostAction('patch')}),
    h('Button',{text:'Clear',width:85,height:34,action:hostAction('clear')})),
  h('TextBox',{id:'filter',row:1,height:34}),
  h('DataGrid',{id:'grid',row:2,filter:'filter',itemsSource:dataSource({
    capacity:4096,key:'id',columns:[
      {field:'name',title:'Name',type:'text',width:260},
      {field:'value',title:'Value',type:'number',width:140,editable:true}],
    rows:[{id:1,name:'First row',value:12},{id:2,name:'Second row',value:24}]
  })})));
app.onAction(event=>{
  if(event.name==='append')app.data('grid','upsert',{id:nextKey,name:'Row '+nextKey,value:nextKey++*10});
  if(event.name==='patch')app.data('grid','patch',1,{name:'Updated without remount',value:42});
  if(event.name==='clear')app.data('grid','clear');
});`,css:''});
examples.push({name:'Dynamic controls · lists & labels',code:`const {h,hostAction} = Helion;
let sequence=0;
app(h('Grid',{rows:'44 38 * 35',padding:20,gap:10},
  h('Button',{text:'Replace items + label',height:36,action:hostAction('refresh')}),
  h('TextBox',{id:'search',row:1}),
  h('ListBox',{id:'list',row:2,filter:'search',items:[{key:10,label:'One'},{key:20,label:'Two'}],
    action:hostAction('selected'),itemCapacity:256,itemTextCapacity:8192}),
  h('TextBlock',{id:'status',row:3,text:'Select an item',textCapacity:256})));
app.onAction(event=>{
 if(event.name==='refresh'){
   sequence++;
   app.items('list',Array.from({length:20},(_,i)=>({key:i,label:'Revision '+sequence+' / Item '+i})));
   app.text('status','Updated labels and items without recompiling');
 }
 if(event.name==='selected')app.text('status','Selected stable key: '+event.key);
});`,css:''});
examples.push({name:'Control templates · Fluent / macOS',code:`const {h,ThemeResource,TemplateBinding,ControlTemplate,ButtonTemplate,
  TextBoxTemplate,SliderTemplate,ProgressBarTemplate,ToggleSwitch,
  themeAction,templateAction} = Helion;
const R=ThemeResource;
const themeButton=(label,theme,variant)=>h('Button',{
  text:label,template:ButtonTemplate,height:38,width:142,
  action:themeAction(theme,variant)});
return h('Grid',{rows:'auto auto *',padding:24,gap:16,theme:'fluent',
  background:R('canvas')},
  h('TextBlock',{text:'Templates stay on the device.',fontSize:25,foreground:R('text')}),
  h('WrapPanel',{row:1,gap:8},themeButton('Fluent dark','fluent','dark'),
    themeButton('Fluent light','fluent','light'),themeButton('macOS dark','macos26','dark'),
    themeButton('macOS light','macos26','light')),
  h('StackPanel',{row:2,gap:16,maxWidth:520},
    h('Button',{id:'primary',text:'Hover, press or keyboard-focus me',
      template:ButtonTemplate,height:48}),
    ToggleSwitch({id:'toggle',text:'Resident checked-state transition'}),
    h('TextBox',{id:'input',template:TextBoxTemplate,text:'Edit using native Helion input',height:42}),
    h('Slider',{id:'level',template:SliderTemplate,value:.6}),
    h('ProgressBar',{template:ProgressBarTemplate,bind:{source:'level'},height:8}),
    h('TextBlock',{text:'Independent themes, not native OS widgets or Liquid Glass. Fonts, state, layout, and coverage use Helion.',
      foreground:R('muted'),fontSize:12,wrap:true})));`,css:''});

examples.push({name:'Theme lab · contrast, density & accent',css:'',code:`const {h,ThemeResource:R,themeAction,themePreferenceAction:pref,AccentButton,SubtleButton,DestructiveButton,ToggleSwitch,TemplatedToggleButton} = Helion;
const choice=(text,action)=>h('Button',{text,action,minWidth:86});
return h('ScrollViewer',{theme:'fluent',themeVariant:'dark',controlThemes:true,background:R('canvas'),padding:24},
 h('StackPanel',{gap:16},
  h('TextBlock',{text:'Theme laboratory',fontSize:26,foreground:R('text')}),
  h('TextBlock',{text:'Live GPU palette changes. No workspace remount. Focus rings do not move content.',wrap:true,foreground:R('muted')}),
  h('WrapPanel',{gap:8},choice('Fluent dark',themeAction('fluent','dark')),choice('Fluent light',themeAction('fluent','light')),choice('macOS dark',themeAction('macos26','dark')),choice('macOS light',themeAction('macos26','light'))),
  h('WrapPanel',{gap:8},choice('Standard',pref('contrast','standard')),choice('High contrast',pref('contrast','high')),choice('Comfortable',pref('density','comfortable')),choice('Compact',pref('density','compact'))),
  h('WrapPanel',{gap:8},choice('Violet accent',pref('accent','#b99cff')),choice('Green accent',pref('accent','#69d5a0')),choice('Theme accent',pref('accent',null)),choice('Reduce motion',pref('reducedMotion',true)),choice('Animate',pref('reducedMotion',false))),
  h('ContentControl',{},h('StackPanel',{gap:12},
   h('TextBlock',{text:'Actions & state contrast',fontSize:17,foreground:R('text')}),
   h('WrapPanel',{gap:10},choice('Standard'),AccentButton({text:'Primary action'}),SubtleButton({text:'Subtle action'}),DestructiveButton({text:'Delete item'})),
   h('WrapPanel',{gap:10},TemplatedToggleButton({id:'pin',text:'Pinned',value:1}),h('Button',{text:'Disabled',disabled:true}),AccentButton({text:'Unavailable',disabled:true})),
   ToggleSwitch({text:'GPU state transitions',value:1}),h('CheckBox',{text:'Keep my settings',value:1}),
   h('TextBox',{id:'field',text:'Typing stays resident.',maxWidth:480}),
   h('Slider',{id:'amount',value:.64,maxWidth:480}),h('ProgressBar',{bind:{source:'amount'},maxWidth:480})
  )),
  h('TextBlock',{text:'High contrast keeps its own accent. The customized accent returns in Standard. These are independent themes, not native OS materials.',wrap:true,foreground:R('muted')})
 ));`});

examples.push({name:'Typography · features, marks & retained paragraphs',css:'',code:`const {h,ShapedText} = Helion;
return h('ScrollViewer',{padding:24,background:'#101d29'},
 h('StackPanel',{gap:18},
  ShapedText({text:'Shape once. Reflow on the GPU.',fontSize:26,wrap:true}),
  ShapedText({text:'office AVATAR — café',fontSize:25,fontFeatures:{liga:1,kern:1}}),
  ShapedText({text:'office AVATAR — café',fontSize:25,fontFeatures:{liga:0,kern:0}}),
  ShapedText({text:'A\u030a and Å · Zażółć gęślą jaźń',fontSize:23}),
  ShapedText({text:'Shared measured glyph positions, cluster spans, fallback metrics, per-line ordering and caret data stay on the device. Resize this preview.',fontSize:19,wrap:true}),
  h('TextBox',{id:'sample',text:'Type here: office A\u030a',textShaping:'opentype',fontSize:22,height:52}),
  h('TextBlock',{text:'The loaded font controls available glyphs and features. Open Typography for multi-face Arabic/Hebrew specimens. Full editor bidi and variable/color fonts are not implemented.',wrap:true,fontSize:12})
 ));`});
