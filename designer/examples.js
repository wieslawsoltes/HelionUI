const node=(type,id,props={},children=[])=>({type,props:{id,...props},children});
export const designerExamples=[
 {version:1,title:'Aurora / product landing',width:960,height:640,duration:4,capacity:64,history:16,
  resources:[{name:'Accent',color:'#66d8d3'},{name:'Ink',color:'#e1ebf7'},{name:'Surface',color:'#192e43'}],
  states:[{name:'Focused',overrides:{heroCard:{scaleX:1.035,scaleY:1.035,background:'#22435c'},launch:{background:'#459ca5'}}}],
  root:node('Canvas','Artboard',{background:'#101e2d',fontFamily:'Noto Sans'},[
   node('TextBlock','brand',{x:48,y:30,width:260,height:35,text:'AURORA / WORKSPACE',fontSize:17,fontWeight:600,foreground:'#8ce4e0'}),
   node('TextBlock','navigation',{x:618,y:34,width:304,height:30,text:'Product    Resources    Company',fontSize:13,foreground:'#99adbe'}),
   node('TextBlock','headline',{x:48,y:142,width:408,height:140,text:'Bring your ideas\ninto motion.',fontSize:43,fontWeight:600,foreground:'#e7f0fc'}),
   node('TextBlock','description',{x:50,y:294,width:360,height:78,text:'A thoughtful workspace for the things you want to make. Fast, focused, and unmistakably yours.',fontSize:16,foreground:'#a4bccf',wrap:true}),
   node('Button','launch',{x:48,y:405,width:168,height:46,text:'Start creating',fontSize:14,background:'#2e7384',foreground:'#f4ffff',radius:9,action:{type:'toggle',target:'ready'}}),
   node('Button','explore',{x:232,y:405,width:152,height:46,text:'Explore the tools',fontSize:13,background:'#1d3447',foreground:'#d2e6f3',radius:9}),
   node('Canvas','heroCard',{x:498,y:126,width:396,height:352,background:'#192e43',radius:18},[
    node('TextBlock','cardTitle',{x:24,y:24,width:320,height:34,text:'MAKE ROOM FOR YOUR NEXT IDEA',fontSize:13,fontWeight:600,foreground:'#bad1e2'}),
    node('Path','orbit',{x:106,y:71,width:188,height:188,shape:1,foreground:'#254762'}),
    node('Path','spark',{x:145,y:112,width:109,height:109,shape:2,foreground:'#7bdfd5',animations:[{property:'rotation',keyframes:[{time:0,value:-.14,easing:'smooth'},{time:2,value:.14,easing:'smooth'},{time:4,value:-.14,easing:'smooth'}]}]}),
    node('TextBlock','cardCaption',{x:27,y:283,width:292,height:29,text:'Your canvas. Your momentum.',fontSize:16,foreground:'#c8e3ef'})]),
   node('TextBlock','dividerLabel',{x:48,y:534,width:210,height:30,text:'LIVE PREVIEW CONTROLS',fontSize:11,foreground:'#84a6bb'}),
   node('Slider','level',{x:286,y:529,width:246,height:30,value:.68}),
   node('ProgressBar','progress',{x:565,y:539,width:171,height:9,foreground:'#67dad2',bind:{source:'level'}}),
   node('CheckBox','ready',{x:769,y:528,width:140,height:32,text:'Ready to build',fontSize:12,value:1}),
   node('TextBlock','footer',{x:48,y:592,width:840,height:25,text:'Made with Helion · retained layout, real fonts, compute rendering',fontSize:11,foreground:'#6f8ba2'})
  ])},
 {version:1,title:'Layout / adaptive dashboard',width:900,height:600,duration:3,capacity:64,history:16,
  resources:[{name:'Accent',color:'#72d9d2'},{name:'Card',color:'#1b3045'}],
  root:node('Grid','Dashboard',{rows:'64 * 44',columns:'190 *',gap:14,padding:20,background:'#101b28'},[
   node('TextBlock','Title',{columnSpan:2,text:'Your workspace, organized.',fontSize:26,foreground:'#deebf8',verticalAlignment:'center'}),
   node('StackPanel','Navigation',{row:1,gap:10,padding:14,background:'#172a3c',radius:10},[
    node('Button','Overview',{text:'Overview',height:38,background:'#2b617c'}),node('Button','Library',{text:'Library',height:38,background:'#213b52'}),node('Button','Settings',{text:'Settings',height:38,background:'#213b52'})]),
   node('Grid','Content',{row:1,column:1,rows:'* *',columns:'* *',gap:12},[
    node('Border','CardA',{padding:22,backgroundResource:'Card',radius:12},[node('TextBlock','CardATitle',{text:'Measure / Arrange',fontSize:22,wrap:true})]),
    node('Border','CardB',{column:1,padding:22,background:'#24405a',radius:12},[node('TextBlock','CardBTitle',{text:'Live GPU layout',fontSize:22,wrap:true})]),
    node('StackPanel','CardC',{row:1,columnSpan:2,padding:22,gap:16,background:'#1b3549',radius:12},[node('TextBlock','FormTitle',{text:'Keep the essentials close.',fontSize:19}),node('TextBox','Entry',{height:40,text:'A real Helion input control'}),node('CheckBox','Agree',{height:32,text:'GPU-owned state',value:1})])]),
   node('TextBlock','Footer',{row:2,columnSpan:2,text:'Select a Grid and open Grid tracks. Child row/column/span are in Properties.',fontSize:12,foreground:'#96b5c8',wrap:true})
  ])},
 {version:1,title:'Motion / states and keyframes',width:800,height:520,duration:4,capacity:64,history:16,
  resources:[{name:'Mint',color:'#8cdbbc'},{name:'Coral',color:'#f08f93'}],
  states:[{name:'Expanded',overrides:{tile:{scaleX:1.35,scaleY:1.35,background:'#357b82'},label:{foreground:'#fff4cb'}}},{name:'Quiet',overrides:{tile:{opacity:.4,rotation:-.12},label:{opacity:.6}}}],
  root:node('Canvas','Motion',{background:'#111c2b'},[
   node('TextBlock','title',{x:48,y:38,width:700,height:72,text:'Design the transition.',fontSize:32,fontWeight:600}),
   node('Border','tile',{x:108,y:174,width:196,height:184,background:'#275a70',radius:20,animations:[{property:'translateX',keyframes:[{time:0,value:0,easing:'smooth'},{time:2,value:318,easing:'cubicInOut'},{time:4,value:0,easing:'cubicInOut'}]},{property:'rotation',keyframes:[{time:0,value:-.12},{time:2,value:.12},{time:4,value:-.12}]}]},[node('TextBlock','label',{text:'Make\nit move.',fontSize:31,fontWeight:600,margin:22,wrap:true})]),
   node('TextBlock','hint',{x:48,y:428,width:700,height:48,text:'Play the timeline, scrub a key, or select a visual state. No per-frame CPU property updates.',fontSize:14,foreground:'#8eaec4',wrap:true})
  ])}
];
export const blankDesign=()=>({version:1,title:'Untitled design',width:960,height:640,duration:4,capacity:64,history:16,resources:[{name:'Accent',color:'#70dbd3'}],root:node('Canvas','Artboard',{background:'#f3f5fa'})});
