import {h} from '../core/declaration.js';
import {hostAction,Toolbar} from '../controls/index.js';
import {defineModel,field,computed,expr,modelBinding} from '../models/index.js';
import {tests} from './catalog.js';

export const HUB_FONT_SOURCES=[
 {source:'https://raw.githubusercontent.com/notofonts/noto-fonts/v20201206-phase3/hinted/ttf/NotoSans/NotoSans-Regular.ttf',family:'Noto Sans',weight:400},
 {source:'https://raw.githubusercontent.com/notofonts/noto-fonts/v20201206-phase3/hinted/ttf/NotoSans/NotoSans-SemiBold.ttf',family:'Noto Sans',weight:600}
];
export const HUB_ROUTES=['home','showcase','playground','designer','typography','tests'];
const C={base:'#101b21',panel:'#19282e',inset:'#142229',line:'#304149',text:'#e0ebe6',muted:'#9aafa8',accent:'#80ddc2'};
const text=(value,props={})=>h('TextBlock',{text:value,fontSize:12,foreground:C.text,...props});
const tag=(value,props={})=>text(value,{fontSize:10,foreground:C.accent,...props});
const button=(label,name,value,props={})=>h('Button',{text:label,action:hostAction(name,value),classes:'hub-button',fontSize:12,height:32,background:'#243b3d',foreground:C.text,radius:5,...props});
const visible=name=>modelBinding('navigation',name,{property:'visible'});
const title=(value,size=26,props={})=>text(value,{fontSize:size,fontWeight:600,...props});
const line=()=>h('Border',{height:1,background:C.line});
function navItem(label,index,compact){
 return h('Grid',{width:compact?undefined:[88,90,98,90,102,64][index],height:30,column:compact?index%3:0,row:compact?Math.floor(index/3):0},
  h('Border',{background:'#31534d',radius:5,modelBind:visible('nav'+index)}),
  button(label,'navigate',index,{id:`nav-${compact?'small':'wide'}-${HUB_ROUTES[index]}`,height:30,background:'#00000000'}));
}
function nav(compact=false){
 return h('Grid',{height:compact?108:54,rows:compact?'34 66':'*',columns:compact?'*':'130 * 78',padding:compact?[8,4]:[18,8],background:C.inset,borderWidth:1,borderColor:C.line,minViewportWidth:compact?0:780,maxViewportWidth:compact?779:1e7},
  h('StackPanel',{orientation:'horizontal',gap:9,verticalAlignment:'center'},title('H',24,{foreground:C.accent,width:23}),title('helion',18)),
  h(compact?'Grid':'ScrollViewer',{id:compact?'navigation-small':'navigation-wide',row:compact?1:0,column:compact?0:1,height:compact?64:38,columns:compact?'* * *':undefined,rows:compact?'30 30':undefined,gap:4},
   ...(compact?['Overview','Showcase','Playground','Designer','Typography','Tests'].map((label,index)=>navItem(label,index,true)):[h('StackPanel',{orientation:'horizontal',gap:6,padding:4},...['Overview','Showcase','Playground','Designer','Typography','Tests'].map((label,index)=>navItem(label,index,false)))])),
  button('GitHub','link',0,{column:compact?0:2,width:70,height:28,horizontalAlignment:'end',verticalAlignment:'center',maxViewportWidth:compact?779:1e7}));
}
function illustration(){
 return h('Border',{column:1,padding:16,background:'#1c302f',radius:9,borderColor:'#35504a',borderWidth:1},
  h('Grid',{rows:'25 29 * 21',gap:6},
   tag('HELION / STUDIO',{fontSize:10}),
   h('Grid',{row:1,columns:'* auto'},text('Untitled interface',{fontSize:11}),text('Save',{column:1,fontSize:11,foreground:C.accent})),
   h('Grid',{row:2,columns:'90 * 76',gap:10},
    h('StackPanel',{gap:13,padding:8,background:C.inset,radius:5},text('Layers',{fontSize:10}),tag('Artboard',{fontSize:9}),text('Header',{fontSize:9}),text('Content',{fontSize:9}),text('Cards',{fontSize:9})),
    h('Border',{column:1,background:'#dfe8d9',radius:3,padding:15},h('StackPanel',{gap:12},text('MAKE ROOM FOR IDEAS',{fontSize:8,foreground:'#3e6657'}),title('Something\nworth building.',22,{foreground:'#223d31'}),h('Grid',{columns:'* * *',height:30,gap:6},...['#b1ccb4','#83b4a4','#cfc2a7'].map((background,column)=>h('Border',{column,background,radius:3}))),text('Start creating',{fontSize:10,foreground:'#275547'}))),
    h('StackPanel',{column:2,gap:10,padding:6},text('Design',{fontSize:10}),text('W   960',{fontSize:9}),text('H   640',{fontSize:9}),line(),text('Auto layout',{fontSize:8}))),
   text('Retained controls. Live composition.',{row:3,fontSize:9,foreground:C.muted})));
}
function hero(compact=false){
 return h('Grid',{columns:compact?'*':'* *',height:compact?236:268,gap:30,minViewportWidth:compact?0:780,maxViewportWidth:compact?779:1e7},
  h('StackPanel',{gap:12,verticalAlignment:'center'},tag('THE WEBGPU INTERFACE LAB'),
   title('Interfaces. On the GPU.',compact?29:36,{wrap:true}),
   text('Explore real controls, build a live app, and shape your next interface. One workspace, with UI that stays on the device.',{fontSize:13,foreground:C.muted,wrap:true,maxWidth:460,lineHeight:21}),
   Toolbar({height:42},button('Explore showcase','navigate',1,{width:169,background:'#367b68'}),button('Start building','navigate',2,{width:122})),
   text('Open source  /  Experimental  /  WebGPU',{fontSize:10,foreground:C.muted})),
  ...(compact?[]:[illustration()]));
}
function toolCard(index,props={}){
 const data=[['01 / EXPLORE','See it in action.','Controls, data grids, text, and interaction in a live GPU interface.','Open showcase',1],['02 / BUILD','Code. Run. Explore.','Edit an example and see your app in the live preview.','Open playground',2],['03 / DESIGN','Give ideas shape.','Arrange controls, refine properties, and export your interface.','Open designer',3]][index];
 return h('Grid',{rows:'19 32 * 34',gap:5,padding:18,height:168,background:C.panel,radius:7,borderWidth:1,borderColor:C.line,...props},tag(data[0]),title(data[1],19,{row:1}),text(data[2],{row:2,fontSize:12,wrap:true,foreground:C.muted}),button(data[3]+'','navigate',data[4],{row:3,horizontalAlignment:'start',width:167,height:30,background:'#254238'}));
}
function home(){
 return h('ScrollViewer',{id:'overview',row:1,modelBind:visible('home'),padding:20},
  h('StackPanel',{gap:20,maxWidth:1160,horizontalAlignment:'center'},hero(),hero(true),
   h('StackPanel',{gap:6},tag('CHOOSE YOUR STARTING POINT'),title('From curious to creating.',24)),
   h('Grid',{columns:'* * *',gap:12,height:168,minViewportWidth:780},...Array.from({length:3},(_,i)=>toolCard(i,{column:i}))),
   h('StackPanel',{gap:10,maxViewportWidth:779},...Array.from({length:3},(_,i)=>toolCard(i))),line(),
   h('WrapPanel',{itemWidth:280,itemHeight:102,gap:12},
    h('StackPanel',{gap:8},tag('LOOK A LITTLE CLOSER'),title('The details matter.',21),text('Explore text. Verify your device.',{foreground:C.muted,fontSize:11})),
    h('StackPanel',{gap:9},title('Typography lab',17),text('Fonts, shaping, and paragraph layout',{fontSize:11,foreground:C.muted}),button('Explore typography','navigate',4,{width:190})),
    h('StackPanel',{gap:9},title('Tests & diagnostics',17),text('Browser checks and GPU validation',{fontSize:11,foreground:C.muted}),button('Open test directory','navigate',5,{width:190}))),line(),
   h('WrapPanel',{itemWidth:280,itemHeight:34,gap:12},text('helion  /  An open-source interface experiment.',{fontSize:10,foreground:C.muted}),text('Save or export your work before closing this tab.',{fontSize:10,foreground:C.muted}),button('Documentation','link',1,{width:170,height:28})),
   h('Border',{height:12})));
}
function directory(){
 return h('ScrollViewer',{id:'test-directory',row:1,padding:24,modelBind:visible('tests')},
  h('StackPanel',{maxWidth:1160,horizontalAlignment:'center',gap:18},tag('TESTS & DIAGNOSTICS'),title('See what holds up.',32),
   text('Run checks on your browser and GPU. Each opens a separate test harness; nothing runs automatically here.',{fontSize:13,foreground:C.muted,wrap:true}),
   text('Results describe this device and browser. They are not a cross-platform performance guarantee.',{fontSize:11,foreground:C.muted,wrap:true}),
   h('WrapPanel',{itemWidth:272,itemHeight:138,gap:12},...tests.map(([id,name,description,category],i)=>h('Grid',{rows:'22 * 31',gap:6,padding:14,background:C.panel,radius:6,borderWidth:1,borderColor:C.line},
    title(name,16),text(description,{row:1,fontSize:11,wrap:true,foreground:C.muted}),button('Open test','test',i,{row:2,width:130,height:28})))),
   Toolbar({height:38},button('Validation guide','link',2,{width:145}),button('CI runs','link',3,{width:100})),h('Border',{height:12})));
}
export function createHub(){
 const fields={route:field('i32',0),home:computed('bool',expr.eq(expr.ref('route'),0)),tests:computed('bool',expr.eq(expr.ref('route'),5))};
 for(let i=0;i<HUB_ROUTES.length;i++)fields['nav'+i]=computed('bool',expr.eq(expr.ref('route'),i));
 return h('Grid',{id:'helion-hub',rows:'auto *',background:C.base,fontFamily:'Noto Sans',models:{navigation:defineModel(fields)},styles:`Button.hub-button:pointerover { Background: #36584f; } Button.hub-button:pressed { Background: #427866; } Button.hub-button:focus { BorderBrush: #80ddc2; BorderThickness: 1; }`},nav(),nav(true),home(),directory());
}
