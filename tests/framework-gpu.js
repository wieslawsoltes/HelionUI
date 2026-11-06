/** This gate requires a permitted WebGPU browser. All reads below are explicit tests. */
import {h,HelionSurface,DrawingContext,Pen,Rect,LinearGradientBrush,GradientStop,TransformGroup,TranslateTransform,RotateTransform,ImageSource,ColumnDefinition,Opcode} from '../src/index.js';
import {fixtureFont} from './font-fixture.mjs';
import {fromBits,rgba} from '../src/core/schema.js';
const canvas=document.querySelector('#canvas'),log=document.querySelector('#log'),button=document.querySelector('#run');
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const near=(a,b,e=.015)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
async function pixels(surface){const{w,h}=surface.viewport,stride=Math.ceil(w*4/256)*256,buffer=surface.device.createBuffer({size:stride*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{const e=surface.device.createCommandEncoder();e.copyTextureToBuffer({texture:surface.output},{buffer,bytesPerRow:stride},[w,h]);surface.device.queue.submit([e.finish()]);await buffer.mapAsync(GPUMapMode.READ);const bytes=new Uint8Array(buffer.getMappedRange()),tight=new Uint8Array(w*h*4);for(let y=0;y<h;y++)tight.set(bytes.subarray(y*stride,y*stride+w*4),y*w*4);return tight;}finally{buffer.unmap();buffer.destroy();}}
export async function runFrameworkGate(){
 button.disabled=true;const result={status:'RUNNING',scope:'Native GPU correctness, not an FPS/compatibility certificate',checks:[],started:new Date().toISOString()};globalThis.__HELION_FRAMEWORK_RESULT__=result;let surface;
 const pass=label=>{result.checks.push(label);log.textContent=JSON.stringify(result,null,2);};
 try{
  const d=new DrawingContext({width:280,height:140});d.DrawRectangle(LinearGradientBrush([GradientStop('black',0),GradientStop('white',1)],[0,0],[1,0]),null,Rect(0,0,100,40));
  const transform=d.PushTransform(TransformGroup(TranslateTransform(140,20),RotateTransform(45))),clip=d.PushClip(Rect(0,0,40,40));d.DrawRectangle('red',null,Rect(-20,-20,100,100));clip.dispose();transform.dispose();
  d.DrawImage(ImageSource(2,1,[255,0,0,255,0,0,255,255]),Rect(0,60,100,20));
  const view=h('Canvas',{background:'black'},
   h('DockPanel',{x:0,y:0,width:300,height:120,Spacing:2},h('Border',{id:'top','DockPanel.Dock':'Top',height:20}),h('Border',{id:'left','DockPanel.Dock':'Left',width:30}),h('Border',{id:'right','DockPanel.Dock':'Right',width:40}),h('Border',{id:'bottom','DockPanel.Dock':'Bottom',height:10}),h('Border',{id:'fill'})),
   h('WrapPanel',{x:0,y:130,width:160,height:100,gap:10},h('Border',{id:'wrap0',width:70,minHeight:20}),h('Border',{id:'wrap1',width:70,minHeight:30}),h('Border',{id:'wrap2',width:100,minHeight:10})),
   h('UniformGrid',{x:310,y:0,width:280,height:120,columns:2,firstColumn:1,rowSpacing:10,columnSpacing:10},...['u0','u1','u2'].map(id=>h('Border',{id}))),
   h('Viewbox',{x:310,y:130,width:200,height:100},h('Canvas',{id:'scaled',width:200,height:200})),d.toView({x:0,y:240}),
   h('Button',{id:'styled',x:310,y:250,width:130,height:50,Styles:'Button { Background: #102030; Opacity: 1; transition: background 0.2s linear; } Button:hover { Background: #0066ff; Opacity: 0.8; }'}),
   h('Border',{id:'moving',x:500,y:270,width:50,height:50,background:'teal',opacity:1,animations:[{property:'opacity',duration:1,iterations:'infinite',keyFrames:[{cue:0,value:.2},{cue:.5,value:1},{cue:1,value:.2}]}]})
  );
  surface=await HelionSurface.mount(canvas,view,{fonts:[fixtureFont()],startupWorker:false,autoStart:false,input:false,pixelRatio:1,performanceHUD:false,damageTracking:true});result.adapter=surface.adapterInfo;
  let now=surface.startTime;const step=async(dt=50)=>{const before=surface.stats.readbackBytes;assert(surface.render(now+=dt),'Frame refused');await surface.whenSubmittedWorkDone();assert(surface.stats.readbackBytes===before,'Implicit readback during render');assert(!surface.faulted,surface.errors.join('\n'));};await step();
  let snapshot=await surface.inspect({includeHeap:true});const rect=id=>[...snapshot.nodes.slice(surface.id(id)*72+52,surface.id(id)*72+56)].map(fromBits);const rectIs=(id,expected)=>rect(id).forEach((x,i)=>near(x,expected[i]));
  rectIs('top',[0,0,300,20]);rectIs('left',[0,22,30,98]);rectIs('right',[260,22,40,98]);rectIs('bottom',[32,110,226,10]);rectIs('fill',[32,22,226,86]);pass('native DockPanel all edges and LastChildFill');
  rectIs('wrap0',[0,130,70,30]);rectIs('wrap1',[80,130,70,30]);rectIs('wrap2',[0,170,100,10]);pass('native WrapPanel line sizing and placement');
  rectIs('u0',[455,0,135,55]);rectIs('u1',[310,65,135,55]);rectIs('u2',[455,65,135,55]);pass('native UniformGrid auto rows, FirstColumn and independent spacing');
  const at=surface.id('scaled')*72;near(fromBits(snapshot.nodes[at+60]),.5);near(fromBits(snapshot.nodes[at+63]),.5);near(fromBits(snapshot.nodes[at+64]),205);near(fromBits(snapshot.nodes[at+65]),65);pass('native Viewbox uniform composition, independent of desired geometry');
  surface.send(Opcode.Move,{target:surface.id('styled'),x:330,y:270});await step();await step(100);await step(100);snapshot=await surface.inspect({includeNodes:true});assert(snapshot.nodes[surface.id('styled')*72+20]===rgba('#0066ff'),'Hover color/transition mismatch');pass('GPU pseudo-state selector and timed color transition');
  surface.set('styled','opacity',.45);await step();snapshot=await surface.inspect({includeNodes:false});near(fromBits(snapshot.state[64+surface.id('styled')*16+3]),.45);pass('imperative composition Set has local precedence over pseudo style');
  surface.controlAnimation('moving','seek',.5);await step();snapshot=await surface.inspect({includeNodes:false});near(fromBits(snapshot.state[64+surface.id('moving')*16+3]),1);surface.controlAnimation('moving','pause');await step();snapshot=await surface.inspect({includeNodes:false});const held=fromBits(snapshot.state[64+surface.id('moving')*16+3]);await step(100);await step(100);snapshot=await surface.inspect({includeNodes:false});near(fromBits(snapshot.state[64+surface.id('moving')*16+3]),held);surface.controlAnimation('moving','stop');await step();snapshot=await surface.inspect({includeNodes:false});near(fromBits(snapshot.state[64+surface.id('moving')*16+3]),1);pass('native keyframe seek/pause/hold/stop without CPU animation evaluation');
  const bytes=await pixels(surface),pixel=(x,y)=>[...bytes.slice((y*surface.viewport.w+x)*4,(y*surface.viewport.w+x)*4+4)];
  const center=pixel(50,260);assert(center[0]>180&&center[0]<196&&center[0]===center[1]&&center[1]===center[2],'Linear-light gradient center');const inside=pixel(140,288),outside=pixel(113,263);assert(inside[0]>250&&inside[1]<4,'Rotated clip center missing');assert(outside[0]<4&&outside[1]<4,'Clip is only an AABB, not a transformed rectangle');const red=pixel(25,310),blue=pixel(75,310);assert(red[0]>240&&red[2]<30&&blue[2]>240&&blue[0]<30,'Image source/filter mismatch');pass('compute gradient, RGBA image and transformed clip pixels');
  surface.options.damageTracking=false;await step(0);const full=await pixels(surface);assert(bytes.every((v,i)=>v===full[i]),'Dirty/full drawing pixels differ');snapshot=await surface.inspect({includeNodes:false});assert(snapshot.state[15]===0,`Arena overflow ${snapshot.state[15]}`);pass('drawing retained damage agrees with complete rerasterization; no arena overflow');
  surface.dispose();surface=null;
  surface=await HelionSurface.mount(canvas,h('Grid',{width:300,height:80,columns:[ColumnDefinition('*',120,1000),ColumnDefinition('*',0,30)]},h('Border',{id:'large'}),h('Border',{id:'small',column:1})),{fonts:[fixtureFont()],startupWorker:false,autoStart:false,input:false,pixelRatio:1});surface.render(surface.startTime+16);await surface.whenSubmittedWorkDone();snapshot=await surface.inspect();near(fromBits(snapshot.nodes[surface.id('large')*72+54]),270);near(fromBits(snapshot.nodes[surface.id('small')*72+54]),30);pass('native constrained-star allocation releases a minimum after another column saturates');
  surface.dispose();surface=null;
  surface=await HelionSurface.mount(canvas,h('ScrollViewer',{id:'scroll',scrollHorizontal:true,width:200,height:160},h('Grid',{width:420,height:400},h('Button',{id:'tap',width:90,height:32,horizontalAlignment:'start',verticalAlignment:'start',action:{type:'page',value:1},text:'Tap'}))),{fonts:[fixtureFont()],startupWorker:false,autoStart:false,input:false,pixelRatio:1});
  now=surface.startTime;await step();const scroll=surface.id('scroll'),tap=surface.id('tap');
  surface.send(Opcode.Wheel,{target:scroll,x:10,y:10,a:50,b:0});await step();snapshot=await surface.inspect({includeNodes:false});near(fromBits(snapshot.state[64+scroll*16+2]),50);
  surface.send(Opcode.Wheel,{target:scroll,x:10,y:10,a:-50,b:0});await step();
  surface.send(Opcode.Down,{target:tap,x:50,y:20,c:2});await step();surface.send(Opcode.Move,{target:tap,x:50,y:-60,c:2});await step();surface.send(Opcode.Up,{target:tap,x:50,y:-60,c:2});await step();
  snapshot=await surface.inspect({includeNodes:false});near(fromBits(snapshot.state[64+scroll*16+1]),80);assert(snapshot.state[8]===0,'Touch drag activated its starting button');
  surface.set('scroll','scrollY',0);await step();surface.send(Opcode.Down,{target:tap,x:50,y:20,c:2});await step();surface.send(Opcode.Up,{target:tap,x:50,y:20,c:2});await step();snapshot=await surface.inspect({includeNodes:false});assert(snapshot.state[8]===1,'Touch tap no longer activates a button');
  pass('ScrollViewer supports horizontal wheel and GPU touch drag without accidental button activation');
  surface.dispose();surface=null;
  surface=await HelionSurface.mount(canvas,h('UniformGrid',{id:'responsive-grid',minColumnWidth:280,gap:12},...['card-a','card-b','card-c'].map(id=>h('Border',{id,height:80}))),{fonts:[fixtureFont()],startupWorker:false,autoStart:false,input:false,pixelRatio:1});now=surface.startTime;await step();snapshot=await surface.inspect();let cells=new Float32Array(snapshot.nodes.buffer);assert(cells[surface.id('card-b')*72+52]>0,'Wide auto grid did not form multiple columns');
  canvas.style.width='390px';surface.resizePending=true;await step();await step();snapshot=await surface.inspect();cells=new Float32Array(snapshot.nodes.buffer);near(cells[surface.id('card-b')*72+52],0);assert(cells[surface.id('card-b')*72+53]>cells[surface.id('card-a')*72+53],'Narrow auto grid did not stack its existing nodes');
  pass('UniformGrid chooses responsive columns on the GPU without replacing nodes');
  result.status='PASS';
 }catch(error){result.status='FAIL';result.error=error.stack||String(error);}finally{surface?.dispose();button.disabled=false;result.finished=new Date().toISOString();log.textContent=JSON.stringify(result,null,2);}return result;
}
button.onclick=runFrameworkGate;if(new URLSearchParams(location.search).has('autorun'))runFrameworkGate();
