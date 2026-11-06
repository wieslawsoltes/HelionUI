import {STUDIO,studioButtons} from '../styling/studio-theme.js';
import {h} from '../core/declaration.js';
import {hostAction,Toolbar} from '../controls/index.js';
import {defineModel,field,computed,expr,modelBinding} from '../models/index.js';
import {tests} from './catalog.js';

export const HUB_FONT_SOURCES=[
 {source:'https://raw.githubusercontent.com/notofonts/noto-fonts/v20201206-phase3/hinted/ttf/NotoSans/NotoSans-Regular.ttf',family:'Noto Sans',weight:400},
 {source:'https://raw.githubusercontent.com/notofonts/noto-fonts/v20201206-phase3/hinted/ttf/NotoSans/NotoSans-SemiBold.ttf',family:'Noto Sans',weight:600}
];
export const HUB_ROUTES=['home','showcase','playground','designer','typography','tests'];
const C=STUDIO;
const text=(value,props={})=>h('TextBlock',{text:value,wrap:true,fontSize:12,foreground:C.text,...props});
const tag=(value,props={})=>text(value,{fontSize:10,foreground:C.accent,...props});
const button=(label,name,value,props={})=>h('Button',{text:label,action:hostAction(name,value),classes:'hub-button',fontSize:12,height:32,background:C.raised,foreground:C.text,radius:5,...props});
const visible=name=>modelBinding('navigation',name,{property:'visible'});
const title=(value,size=26,props={})=>text(value,{fontSize:size,fontWeight:600,...props});
const line=()=>h('Border',{height:1,background:C.line});
function navItem(label,index,compact){
 return h('Grid',{width:compact?undefined:[88,90,98,90,102,64][index],height:30,column:compact?index%3:0,row:compact?Math.floor(index/3):0},
  h('Border',{background:C.selected,radius:5,modelBind:visible('nav'+index)}),
  button(label,'navigate',index,{id:`nav-${compact?'small':'wide'}-${HUB_ROUTES[index]}`,height:30,background:'#00000000'}));
}
function nav(compact=false){
 return h('Grid',{height:compact?108:54,rows:compact?'34 66':'*',columns:compact?'*':'130 * 78',padding:compact?[8,4]:[18,8],background:C.inset,borderWidth:1,borderColor:C.line,minViewportWidth:compact?0:780,maxViewportWidth:compact?779:1e7},
  h('StackPanel',{orientation:'horizontal',gap:10,verticalAlignment:'center'},h('Border',{width:26,height:28,radius:7,background:C.accent},title('H',19,{foreground:C.onPrimary,horizontalAlignment:'center',verticalAlignment:'center'})),title('helion',18)),
  h(compact?'Grid':'ScrollViewer',{id:compact?'navigation-small':'navigation-wide',scrollHorizontal:!compact,row:compact?1:0,column:compact?0:1,height:compact?64:38,columns:compact?'* * *':undefined,rows:compact?'30 30':undefined,gap:4},
   ...(compact?['Overview','Showcase','Playground','Designer','Typography','Tests'].map((label,index)=>navItem(label,index,true)):[h('StackPanel',{orientation:'horizontal',gap:6,padding:4},...['Overview','Showcase','Playground','Designer','Typography','Tests'].map((label,index)=>navItem(label,index,false)))])),
  button('GitHub','link',0,{column:compact?0:2,width:70,height:28,horizontalAlignment:'end',verticalAlignment:'center',maxViewportWidth:compact?779:1e7}));
}
function illustration(){
 return h('Border',{column:1,padding:16,background:'#1c1b24',radius:9,borderColor:C.line,borderWidth:1},
  h('Grid',{rows:'25 29 * 21',gap:6},
   tag('HELION / STUDIO',{fontSize:10}),
   h('Grid',{row:1,columns:'* auto'},text('Untitled interface',{fontSize:11}),text('Save',{column:1,fontSize:11,foreground:C.accent})),
   h('Grid',{row:2,columns:'90 * 76',gap:10},
    h('StackPanel',{gap:13,padding:8,background:C.inset,radius:5},text('Layers',{fontSize:10}),tag('Artboard',{fontSize:9}),text('Header',{fontSize:9}),text('Content',{fontSize:9}),text('Cards',{fontSize:9})),
    h('Border',{column:1,background:'#e8e5ef',radius:3,padding:15},h('StackPanel',{gap:12},text('MAKE ROOM FOR IDEAS',{fontSize:8,foreground:'#655b79'}),title('Something\nworth building.',22,{foreground:'#2a2238'}),h('Grid',{columns:'* * *',height:30,gap:6},...['#c2b4e7','#9384bd','#d3c6dc'].map((background,column)=>h('Border',{column,background,radius:3}))),text('Start creating',{fontSize:10,foreground:'#514362'}))),
    h('StackPanel',{column:2,gap:10,padding:6},text('Design',{fontSize:10}),text('W   960',{fontSize:9}),text('H   640',{fontSize:9}),line(),text('Auto layout',{fontSize:8}))),
   text('Retained controls. Live composition.',{row:3,fontSize:9,foreground:C.muted})));
}
function hero(compact=false){
 return h('Grid',{columns:compact?'*':'* *',height:compact?272:284,gap:30,minViewportWidth:compact?0:780,maxViewportWidth:compact?779:1e7},
  h('StackPanel',{gap:12,verticalAlignment:'center'},tag('HELION STUDIO  /  WORKSPACE'),
   title('Build your next\ninterface.',compact?38:46,{wrap:true}),
   text('Design visually, build with code, or explore what is possible. A complete workspace, rendered with Helion.',{fontSize:13,foreground:C.muted,wrap:true,maxWidth:460,lineHeight:21}),
   Toolbar({height:42},button('Open Designer','navigate',3,{width:148,classes:'hub-button primary',background:C.primary,foreground:C.onPrimary}),button('Explore examples','navigate',1,{width:148})),
   text('GPU native  ·  Open source  ·  Experimental',{fontSize:10,foreground:C.muted})),
  ...(compact?[]:[illustration()]));
}
function toolCard(index,props={}){
 const data=[['01 / DESIGN','Designer','Shape your interface visually. Work with layouts, properties, and animation.','Open Designer',3],['02 / DEVELOP','Playground','Write JavaScript with a live preview. Start from an example and make it yours.','Open Playground',2],['03 / DISCOVER','Showcase','Explore controls, data, motion, and typography in a working interface.','Open Showcase',1]][index];
 return h('Grid',{rows:'22 35 * 34',gap:6,padding:20,height:190,background:C.panel,radius:7,borderWidth:1,borderColor:C.line,...props},tag(data[0]),title(data[1],23,{row:1}),text(data[2],{row:2,fontSize:12,wrap:true,foreground:C.muted}),button(data[3]+'','navigate',data[4],{row:3,horizontalAlignment:'start',width:167,height:30,background:C.raised}));
}
function home(){
 return h('ScrollViewer',{id:'overview',row:1,modelBind:visible('home'),padding:20},
  h('StackPanel',{gap:20,maxWidth:1120,horizontalAlignment:'center'},hero(),hero(true),
   h('StackPanel',{gap:6},tag('YOUR TOOLS'),title('Choose how you want to create.',24)),
   h('UniformGrid',{minColumnWidth:300,gap:12,verticalAlignment:'start'},...Array.from({length:3},(_,i)=>toolCard(i))),line(),
   h('WrapPanel',{itemWidth:280,itemHeight:102,gap:12},
    h('StackPanel',{gap:8},tag('EXPLORE THE DETAILS'),title('Built to be explored.',21),text('Explore text. Verify your device.',{foreground:C.muted,fontSize:11})),
    h('StackPanel',{gap:9},title('Typography lab',17),text('Fonts, shaping, and paragraph layout',{fontSize:11,foreground:C.muted}),button('Explore typography','navigate',4,{width:190})),
    h('StackPanel',{gap:9},title('Tests & diagnostics',17),text('Browser checks and GPU validation',{fontSize:11,foreground:C.muted}),button('Open test directory','navigate',5,{width:190}))),line(),
   h('WrapPanel',{itemWidth:280,itemHeight:34,gap:12},text('helion  /  An open-source interface experiment.',{fontSize:10,foreground:C.muted}),text('Save or export your work before closing this tab.',{fontSize:10,foreground:C.muted}),button('Documentation','link',1,{width:170,height:28})),
   h('Border',{height:12})));
}
function testCard([id,name,description,category],index,props={}){
 return h('Grid',{rows:'25 *',columns:'* 86',height:108,padding:16,gap:8,background:C.panel,radius:8,borderWidth:1,borderColor:C.line,...props},
  title(name,16),text(description,{row:1,fontSize:11,wrap:true,foreground:C.muted}),button('Open test','test',index,{id:'test-link-'+id,column:1,rowSpan:2,height:30,verticalAlignment:'center'}));
}
function directory(){
 return h('ScrollViewer',{id:'test-directory',row:1,padding:24,modelBind:visible('tests')},
  h('StackPanel',{maxWidth:1120,horizontalAlignment:'center',gap:20},tag('TESTS & DIAGNOSTICS'),title('Verify your workspace.',36),
   text('Check rendering, interaction, and performance on your device. Each test opens separately; nothing runs automatically.',{fontSize:13,foreground:C.muted,wrap:true,maxWidth:720}),
   h('UniformGrid',{minColumnWidth:440,gap:12,verticalAlignment:'start'},...tests.map((item,index)=>testCard(item,index))),
   text('Results describe this browser and GPU. They are not a cross-platform performance guarantee.',{fontSize:11,foreground:C.muted,wrap:true}),
   Toolbar({height:38},button('Validation guide','link',2,{width:145}),button('CI runs','link',3,{width:100})),h('Border',{height:12})));
}

export function createHub(){
 const fields={route:field('i32',0),home:computed('bool',expr.eq(expr.ref('route'),0)),tests:computed('bool',expr.eq(expr.ref('route'),5))};
 for(let i=0;i<HUB_ROUTES.length;i++)fields['nav'+i]=computed('bool',expr.eq(expr.ref('route'),i));
 return h('Grid',{id:'helion-hub',rows:'auto *',background:C.base,fontFamily:'Noto Sans',models:{navigation:defineModel(fields)},styles:studioButtons('hub-button')},nav(),nav(true),home(),directory());
}
