import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compile,h} from '../src/core/compiler.js';
import {Kind,Opcode,fbits,rgba} from '../src/core/schema.js';
import {DesignDocument,decodeDesignSnapshot,projectToView,generateDesignSource,DESIGN_SHAPES} from '../src/designer/document.js';
import {encodeDesignData} from '../src/designer/pack.js';
import {DesignerController,designerAction,DesignField,DesignCommand} from '../src/designer/index.js';
import {makeDesignAppHTML} from '../src/designer/export.js';
import {createDesignerWorkbench} from '../src/designer/workbench.js';
import {designerExamples,blankDesign} from '../designer/examples.js';
import {scalarDesigner} from '../tools/designer-kernel-host.mjs';
import {viewFeatures} from '../src/gpu/view-features.js';
import {CommandStream} from '../src/core/protocol.js';
const n=(type,id,props={},children=[])=>({type,props:{id,...props},children});
const doc=children=>({capacity:16,history:4,root:n('Canvas','root',{},children)});
const children=d=>d.snapshot().root.children;
const selected=d=>d.heap[d.d+9];
const field=(d,k,p)=>d.value(k,DesignField[p]);
const header=(d,k)=>d.heap[d.d+k];
const allNodes=project=>{const out=[];const walk=n=>{out.push(n);n.children.forEach(walk);};walk(project.root);return out;};

// These execute actual scalar WGSL function bodies through a test-only adapter.
// They are not native WGSL compilation, pointer/raster execution, or GPU benchmarks.
test('designer normalizes PascalCase and inherited typography before flat reservation',()=>{
 const p=DesignDocument(doc([n('Canvas','a',{FontFamily:'Example',FontWeight:600,FontSize:20},[n('TextBlock','b',{Text:'Hello'})])]));
 assert.equal(p.flat[2].props.fontFamily,'Example');assert.equal(p.flat[2].props.fontWeight,600);assert.equal(p.flat[2].props.fontSize,20);assert.equal(p.flat[2].props.text,'Hello');
 const c=compile(h('DesignSurface',{id:'design',designDocument:p}));assert.equal(c.designers[0].capacity,16);assert.ok(c.maxDepth>=17);assert.equal(c.designers[0].slots.length,16);
});
test('designer declarations reject duplicate names, unknown controls and unsupported authoring properties',()=>{
 assert.throws(()=>DesignDocument(doc([n('Button','x'),n('Button','x')])),/Duplicate/);
 assert.throws(()=>DesignDocument(doc([n('DataGrid','x')])),/Unsupported/);
 assert.throws(()=>DesignDocument(doc([n('Button','x',{fakeFeature:true})])),/Unsupported/);
 assert.throws(()=>DesignDocument(doc([n('Grid','x',{columnsCount:7})])),/Unsupported/);
});
test('designer size/history/depth/reservation limits reject before GPU upload',()=>{
 for(const p of [{capacity:7},{capacity:129},{history:1},{history:33},{width:31},{width:8193},{duration:0}])assert.throws(()=>DesignDocument(p));
 let chain=n('Canvas','deep');for(let i=0;i<18;i++)chain=n('Canvas','p'+i,{},[chain]);assert.throws(()=>DesignDocument({root:chain}),/depth/);
 assert.throws(()=>DesignDocument({capacity:8,root:n('Canvas','r',{},Array.from({length:8},(_,i)=>n('Button','b'+i)))}),/capacity/);
});
test('designer single-child containers and data-only project constraints are explicit',()=>{
 assert.throws(()=>DesignDocument(doc([n('Border','b',{},[n('Button','x'),n('Button','y')])])),/one child/);
 assert.throws(()=>DesignDocument(doc([n('Button','x',{},[n('Button','y')])])),/cannot own/);
 assert.throws(()=>DesignDocument({root:n('Button','root')}),/layout panel/);
 assert.throws(()=>DesignDocument({root:n('Canvas','r',{text:'\ud800'})}),/surrogate/);
 const cycle=n('Canvas','r');cycle.children.push(cycle);assert.throws(()=>DesignDocument({root:cycle}));
});
test('designer animation validation rejects missing and invalid keys rather than coercing undefined',()=>{
 for(const key of [{time:0},{value:2},{time:NaN,value:1},{time:2,value:Infinity}])assert.throws(()=>DesignDocument(doc([n('Button','b',{animations:[{property:'translateX',keyframes:[key]}]})])));
 for(const [property,value]of [['opacity',2],['scaleX',0],['scaleY',65]])assert.throws(()=>DesignDocument(doc([n('Button','b',{animations:[{property,keyframes:[{time:0,value}]}]})])));
 assert.throws(()=>DesignDocument(doc([n('Button','b',{animations:[{property:'width',keyframes:[{time:0,value:1}]}]})])));
});
test('designer resource/state names, targets and values are validated',()=>{
 assert.throws(()=>DesignDocument({...doc([]),resources:[{name:'a',color:'red'},{name:'a',color:'blue'}]}),/Duplicate/);
 assert.throws(()=>DesignDocument({...doc([]),states:[{name:'a'},{name:'a'}]}),/Duplicate/);
 assert.throws(()=>DesignDocument({...doc([]),states:[{name:'a',overrides:{missing:{opacity:0}}}]}),/target/);
 assert.throws(()=>DesignDocument({...doc([n('Button','b')]),states:[{name:'a',overrides:{b:{scaleX:0}}}]}));
 assert.throws(()=>DesignDocument(doc([n('Button','b',{backgroundResource:'unknown'})])),/resource/);
});
test('designer all sample workspaces compile with the real document and GPU controls',()=>{
 for(const project of designerExamples){const c=compile(createDesignerWorkbench(project,{examples:designerExamples}));const d=c.designers[0];assert.equal(d.title,project.title);assert.equal(d.capacity,64);assert.ok(c.nodeCount<=512);assert.ok(c.maxDepth<=24);assert.equal(c.editors.length,5);assert.equal(c.docks[0].panes.length,13);assert.ok(viewFeatures(c)&32);}
});
test('designer original project snapshot uses serializable data and recompiles to a native UI',()=>{
 for(const project of designerExamples){const d=scalarDesigner(project);assert.equal(d.kernel.dsValidateBlock(d.d,d.meta.data),true);const saved=d.snapshot();const view=projectToView(saved);assert.equal(view.props.width,project.width);assert.ok(compile(view).nodeCount>1);assert.equal(saved.title,project.title);assert.ok(generateDesignSource(saved).includes('export const view'));}
});
test('designer even-odd path assets and immutable typography catalogs survive explicit snapshots',()=>{
 const d=scalarDesigner(doc([n('Path','shape',{path:DESIGN_SHAPES[2],fillRule:'evenodd',fontWeight:600})]));const p=d.snapshot();assert.equal(p.root.children[0].props.fillRule,'evenodd');assert.equal(p.root.children[0].props.fontWeight,600);assert.ok(compile(projectToView(p)));
});
test('designer same-catalog restore refuses capacity/font/path/title changes',()=>{
 const d=scalarDesigner();const p=d.snapshot();assert.ok(encodeDesignData(p,d.meta));
 for(const changed of [{...p,capacity:32},{...p,title:'Changed'},{...p,history:8}])assert.throws(()=>encodeDesignData(changed,d.meta),/capacity|title/i);
 p.root.children.push(n('TextBlock','other',{fontFamily:'Unprepared'}));assert.throws(()=>encodeDesignData(p,d.meta),/catalog/);
});
test('designer malformed snapshot counts and cycles are rejected on explicit export',()=>{
 const d=scalarDesigner(doc([n('Canvas','a',{},[n('Button','b')])]));
 for(const index of [3,4]){const words=d.heap.slice(d.meta.data,d.meta.data+d.meta.offsets.words);words[index]=99;assert.throws(()=>decodeDesignSnapshot(words,d.meta));}
 const words=d.heap.slice(d.meta.data,d.meta.data+d.meta.offsets.words);words[d.meta.offsets.records+96+2]=2;assert.throws(()=>decodeDesignSnapshot(words,d.meta),/cycle/i);
});
test('designer initial pointer-free data validates against the executable GPU authoring rules',()=>{
 for(const p of [blankDesign(),...designerExamples]){const d=scalarDesigner(p);assert.equal(d.kernel.dsValidateBlock(d.d,d.meta.data),true);}
});
test('designer insertion creates genuine native nodes with retained names and properties',()=>{
 const d=scalarDesigner().command('insert',Kind.Button).command('property',8,120).command('property',9,80);
 assert.equal(selected(d),1);assert.equal(children(d)[0].type,'Button');assert.equal(d.nodes[d.meta.slots[1]].info.x,Kind.Button);assert.equal(field(d,1,'x'),120);assert.equal(d.nodes[d.meta.slots[1]].misc.x,120);assert.equal(d.nodes[d.meta.slots[1]].text.z,d.meta.data+d.meta.offsets.text+512);
});
test('designer property transactions undo and redo without remounting',()=>{
 const d=scalarDesigner().command('insert',Kind.Button);const old=field(d,1,'x');d.command('property',8,128);assert.equal(field(d,1,'x'),128);d.command('undo');assert.equal(field(d,1,'x'),old);d.command('redo');assert.equal(field(d,1,'x'),128);assert.equal(header(d,32),0);
});
test('designer undo branches truncate redo and history rolls over at its explicit bound',()=>{
 const d=scalarDesigner().command('insert',Kind.Button);for(let i=1;i<=14;i++)d.command('property',8,i*10);
 assert.equal(header(d,25),5);for(let i=0;i<4;i++)d.command('undo');assert.equal(field(d,1,'x'),100);d.command('redo').command('property',8,777).command('redo');assert.equal(field(d,1,'x'),777);assert.equal(header(d,25),3);
});
test('designer capacity failures are transactional and do not damage the live tree',()=>{
 const d=scalarDesigner({capacity:8});for(let i=0;i<7;i++)d.select(0).command('insert',Kind.Button);const before=d.snapshot();d.select(0).command('insert',Kind.Button);assert.equal(header(d,54),1);assert.deepEqual(d.snapshot(),before);assert.equal(header(d,32),0);
});
test('designer invalid geometry and nonfinite property values do not create undo records',()=>{
 const d=scalarDesigner().command('insert',Kind.Button);const before=d.snapshot(),count=header(d,25);for(const [f,v]of [[10,-.5],[25,2],[27,0],[38,0],[22,0],[8,NaN],[8,Infinity]]){d.command('property',f,v);assert.deepEqual(d.snapshot(),before);assert.equal(header(d,25),count);}
});
test('designer artboard size inspection and actual native dimensions agree',()=>{
 const d=scalarDesigner().select(0);assert.equal(d.kernel.dsNumber(d.d,0,10),960);d.command('documentSize',1234,720);assert.equal(d.kernel.dsNumber(d.d,0,10),1234);assert.equal(d.nodes[d.meta.slots[0]].size.x,1234);d.command('undo');assert.equal(d.snapshot().width,960);
});
test('designer multi-selection properties form one atomic undoable transaction',()=>{
 const d=scalarDesigner(doc([n('Button','a',{x:1}),n('Button','b',{x:2})]));d.select(1).select(2,true).command('property',8,300);assert.equal(field(d,1,'x'),300);assert.equal(field(d,2,'x'),300);d.command('undo');assert.equal(field(d,1,'x'),1);assert.equal(field(d,2,'x'),2);
});
test('designer duplicated subtrees remap children and internal bindings',()=>{
 const d=scalarDesigner(doc([n('Canvas','group',{},[n('Slider','level',{value:.2}),n('ProgressBar','bar',{bind:{source:'level'}})])]));d.select(1).command('duplicate');assert.equal(children(d).length,2);const copy=children(d)[1];assert.equal(copy.children.length,2);assert.equal(copy.children[1].props.bind.source,copy.children[0].props.id);assert.equal(selected(d),4);d.command('undo');assert.equal(children(d).length,1);
});
test('designer duplication into a full single-child parent rolls back instead of corrupting content',()=>{
 const d=scalarDesigner(doc([n('Border','border',{},[n('Button','b')])]));const before=d.snapshot();d.select(2).command('duplicate');assert.deepEqual(d.snapshot(),before);assert.equal(header(d,54),7);
});
test('designer deletion clears references and reuse cannot silently redirect old bindings',()=>{
 const d=scalarDesigner(doc([n('Slider','s'),n('ProgressBar','p',{bind:{source:'s'}})]));d.select(1).command('delete');assert.equal(d.raw(2,88),0xffffffff);d.select(0).command('insert',Kind.Button);assert.equal(d.raw(2,88),0xffffffff);assert.equal(children(d).length,2);
});
test('designer immutable internal clipboard survives source deletion and restores valid hierarchy',()=>{
 const d=scalarDesigner(doc([n('Canvas','g',{},[n('Button','b',{text:'Original'})])]));d.select(1).command('copy').command('delete').command('paste');assert.equal(children(d).length,1);assert.equal(children(d)[0].children[0].props.text,'Original');assert.equal(d.kernel.dsValidateBlock(d.d,d.meta.data),true);
});
test('designer copy/paste does not reuse a newly allocated source slot as its own parent',()=>{
 const d=scalarDesigner(doc([n('Canvas','g',{},[n('Button','b')])]));d.select(2).command('copy').select(1).command('delete').command('paste');assert.equal(children(d).length,1);assert.equal(children(d)[0].type,'Button');assert.equal(d.raw(selected(d),2),0);
});
test('designer default names avoid manually renamed suffix collisions',()=>{
 const d=scalarDesigner(doc([n('Button','Button_2')]));d.select(0).command('insert',Kind.Button);const names=allNodes(d.snapshot()).map(n=>n.props.id);assert.equal(new Set(names).size,names.length);assert.equal(header(d,54),0);
});
test('designer reparent rejects cycles and repairs Grid placement for valid moves',()=>{
 const d=scalarDesigner(doc([n('Canvas','a',{},[n('Button','b')]),n('Grid','grid',{columns:'* *',rows:'*'})]));const before=d.snapshot();d.select(1).command('reparent',2);assert.deepEqual(d.snapshot(),before);d.select(2).command('reparent',3);assert.equal(d.raw(2,2),3);assert.equal(d.nodes[d.meta.slots[2]].info.y,d.meta.slots[3]);assert.equal(d.raw(2,37),0);
});
test('designer Grid edits enforce spans and remove a track without invalidating descendants',()=>{
 const d=scalarDesigner(doc([n('Grid','g',{columns:'* *',rows:'*'},[n('Button','b',{column:1})])]));d.select(2).command('property',39,2);assert.equal(d.raw(2,39),1);d.select(1).command('gridTrack',0,-1);assert.equal(d.raw(1,48),1);assert.equal(d.raw(2,37),0);assert.equal(d.raw(2,39),1);assert.ok(compile(projectToView(d.snapshot())));
});
test('designer Unicode text and unique names are retained, undoable and not interpreted',()=>{
 const d=scalarDesigner().command('insert',Kind.TextBlock).text('Zażółć 🙂 </script>');assert.equal(children(d)[0].props.text,'Zażółć 🙂 </script>');d.text('Renamed','name');assert.equal(children(d)[0].props.id,'Renamed');d.command('undo');assert.equal(children(d)[0].props.id,'TextBlock_1');
 d.text('artboard','name');assert.equal(children(d)[0].props.id,'TextBlock_1');assert.ok(header(d,55)>0);d.command('cancel');
});
test('designer inline selection editing, cancel and numeric parsing use transactional state',()=>{
 const d=scalarDesigner().command('insert',Kind.Button);d.kernel.dsStartEdit(d.d,1,8);for(const cp of '123.25')d.kernel.dsEditText(d.d,cp.codePointAt(0));assert.equal(d.kernel.dsFinishEdit(d.d),true);d.update();assert.equal(field(d,1,'x'),123.25);
 d.kernel.dsStartEdit(d.d,1,8);d.kernel.dsEditText(d.d,45);d.kernel.dsEditText(d.d,46);assert.equal(d.kernel.dsFinishEdit(d.d),false);d.command('cancel');assert.equal(field(d,1,'x'),123.25);
});
test('designer RGBA parsing and live paint values preserve alpha ordering',()=>{
 const d=scalarDesigner().command('insert',Kind.Button);d.text('#1234','property',32);assert.equal(d.raw(1,32),rgba('#1234'));d.text('#10203080','property',31);assert.equal(d.raw(1,31),rgba('#10203080'));d.command('undo');assert.notEqual(d.raw(1,31),rgba('#10203080'));
});
test('designer named brushes are sampled on device and state overrides take precedence',()=>{
 const d=scalarDesigner({...doc([n('Button','b',{backgroundResource:'Accent'})]),resources:[{name:'Accent',color:'#112233'}],states:[{name:'Active',overrides:{b:{background:'#ff9900'}}}]});assert.equal(d.nodes[d.meta.slots[1]].paint.x,rgba('#112233'));d.command('state',1);d.frame.viewport.w=1;d.update();assert.equal(d.nodes[d.meta.slots[1]].paint.x,rgba('#ff9900'));
});
test('designer state capture/reset remains independent from authored base values',()=>{
 const d=scalarDesigner().command('insert',Kind.Button).command('property',25,.6).command('captureState',1);assert.equal(d.snapshot().states.length,1);d.command('state',1).command('property',25,.3);assert.equal(d.raw(1,25),fbits(.6));assert.ok(Math.abs(d.snapshot().states[0].overrides.Button_1.opacity-.3)<1e-6);d.command('resetState');assert.deepEqual(Object.keys(d.snapshot().states[0].overrides),[]);
});
test('designer timeline interpolates keys and clamps outside their range',()=>{
 const d=scalarDesigner(doc([n('Button','b',{animations:[{property:'translateX',keyframes:[{time:0,value:0,easing:'linear'},{time:4,value:200,easing:'linear'}]}]})]));const f=d.kernel.dsSample;assert.equal(f(d.d,1,1,2,999),100);assert.equal(f(d.d,1,1,-1,999),0);assert.equal(f(d.d,1,1,7,999),200);d.command('seek',2);assert.equal(d.state[64+d.meta.slots[1]*16+8],fbits(100));
});
test('designer auto-key captures base and changed value in one history transaction',()=>{
 const d=scalarDesigner().command('insert',Kind.Button).command('record').command('seek',2).command('property',29,100);const a=children(d)[0].props.animations[0];assert.equal(a.property,'translateX');assert.deepEqual(a.keyframes.map(k=>[k.time,k.value]),[[0,0],[2,100]]);d.command('undo');assert.equal(children(d)[0].props.animations,undefined);
});
test('designer a full key track rejects auto-key atomically without partial base mutation',()=>{
 const keys=Array.from({length:12},(_,j)=>({time:j/3,value:j,easing:'linear'}));const d=scalarDesigner(doc([n('Button','b',{animations:[{property:'translateX',keyframes:keys}]})]));const before=d.snapshot();d.select(1).command('record').command('seek',3.9).command('property',29,90);assert.deepEqual(d.snapshot(),before);assert.equal(header(d,54),4);assert.equal(header(d,32),0);
});
test('designer timeline duration rescales keys and undo restores authored seconds',()=>{
 const d=scalarDesigner(doc([n('Button','b',{animations:[{property:'translateX',keyframes:[{time:0,value:0},{time:4,value:10}]}]})]));d.command('duration',8);assert.equal(children(d)[0].props.animations[0].keyframes[1].time,8);d.command('undo');assert.equal(d.snapshot().duration,4);
});
test('designer preview TextBox uses separate runtime text storage from authoring history',()=>{
 const d=scalarDesigner(doc([n('TextBox','entry',{text:'Design value'})]));const i=d.meta.slots[1];d.command('preview');const runtime=d.nodes[i].text.z;assert.notEqual(runtime,d.meta.data+d.meta.offsets.text+512);d.heap[runtime]=88;assert.equal(children(d)[0].props.text,'Design value');d.command('preview');assert.equal(d.nodes[i].text.z,d.meta.data+d.meta.offsets.text+512);
});
test('designer block restoration validates before replacing history and retained scene',()=>{
 const d=scalarDesigner().command('insert',Kind.Button);const p=d.snapshot();p.root.children[0].props.text='Applied JSON';d.heap.set(encodeDesignData(p,d.meta),d.meta.inbox);d.command('restore',d.meta.offsets.words);assert.equal(children(d)[0].props.text,'Applied JSON');assert.equal(header(d,25),1);
 const before=d.snapshot();d.heap[d.meta.inbox+d.meta.offsets.records]=0;d.command('restore');assert.deepEqual(d.snapshot(),before);assert.equal(header(d,54),7);
});
test('designer randomized transactional edits keep native parent tree and exports valid',()=>{
 const d=scalarDesigner({capacity:32,history:8});let seed=0x12345678;const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
 for(let step=0;step<220;step++){const alive=Array.from({length:31},(_,j)=>j+1).filter(k=>d.raw(k,0));const choice=Math.floor(random()*6);if(!alive.length||choice===0)d.select(0).command('insert',[Kind.Button,Kind.TextBlock,Kind.Slider][step%3]);else{const k=alive[Math.floor(random()*alive.length)];d.select(k);if(choice===1)d.command('delete');else if(choice===2)d.command('duplicate');else if(choice===3)d.command('undo');else d.command('property',step%2?8:29,Math.floor(random()*900));}
  assert.equal(d.kernel.dsValidateBlock(d.d,d.meta.data),true,`step ${step}`);if(step%20===0)assert.ok(compile(projectToView(d.snapshot())));
 }
});
test('designer controller uses immutable command payloads and no normal snapshot polling',async()=>{
 const c=compile(h('DesignSurface',{id:'design',designDocument:doc([])}));const commands=new CommandStream();let invalidates=0;const sent=[];const surface={manifest:c,id:x=>c.ids.get(x),send:(...p)=>sent.push(p),commands,invalidate:()=>invalidates++};const d=new DesignerController(surface,'design');d.select(0).insert('Button').set('x',40).text('Hello');assert.equal(sent.length,3);assert.equal(sent[0][0],Opcode.Designer);assert.ok(commands.length);assert.equal(invalidates,1);assert.throws(()=>d.select(-1));assert.throws(()=>d.text('\ud800'));assert.throws(()=>d.set('background',1));assert.deepEqual(designerAction('design','undo'),{type:'designer',target:'design',command:'undo',value:0,extra:0});
});
test('designer HTML exporter escapes project text outside executable script and preserves data',()=>{
 const project=doc([n('TextBlock','text',{text:'</script><script>globalThis.bad=true</script>\u2028'})]);const template='<script type="application/json" id="helion-project">__HELION_PROJECT_JSON__</script><script type="module">/* runtime */</script>';const output=makeDesignAppHTML(template,project);assert.equal((output.match(/<script/g)||[]).length,2);const json=output.match(/id="helion-project">([\s\S]*?)<\/script>/)[1];assert.equal(JSON.parse(json).root.children[0].props.text,project.root.children[0].props.text);assert.throws(()=>makeDesignAppHTML('missing',project),/template/);
});
test('designer is opt-in and does not add document allocations to ordinary scenes',()=>{
 const c=compile(h('Button',{text:'Unchanged'}));assert.deepEqual(c.designers,[]);assert.equal(viewFeatures(c)&32,0);const s=compile(h('DesignSurface',{id:'design',designDocument:doc([])}));assert.ok(viewFeatures(s)&32);assert.ok(s.heap.byteLength>c.heap.byteLength);
});
test('designer shell uses only Helion-visible controls and a data-only import/export boundary',async()=>{
 const html=await readFile(new URL('../designer/index.html',import.meta.url),'utf8');assert.ok(!/<(?:button|textarea|select)\b/i.test(html));const app=await readFile(new URL('../designer/app.js',import.meta.url),'utf8');assert.ok(!/\beval\s*\(|new Function\(/.test(app));assert.match(app,/\.snapshot\(/);assert.match(app,/JSON\.parse/);
});
test('designer manual key insertion samples the current timeline value rather than the base property',()=>{
 const d=scalarDesigner(doc([n('Button','b',{animations:[{property:'translateX',keyframes:[{time:0,value:0,easing:'linear'},{time:4,value:200,easing:'linear'}]}]})]));d.select(1);d.heap[d.d+38]=1;d.command('seek',2).command('keyframe');const keys=children(d)[0].props.animations[0].keyframes;assert.equal(keys.length,3);assert.equal(keys[1].value,100);assert.equal(keys[1].time,2);
});
test('designer capture of a later state creates valid unique names for intermediate states',()=>{
 const d=scalarDesigner({...doc([n('Button','b')]),states:[{name:'State 2',overrides:{}}]});d.command('captureState',3);const p=d.snapshot();assert.equal(p.states.length,3);assert.equal(new Set(p.states.map(s=>s.name)).size,3);assert.equal(d.kernel.dsValidateBlock(d.d,d.meta.data),true);
});
test('designer invalid retained state names are rejected before restore changes the project',()=>{
 const d=scalarDesigner({...doc([n('Button','b')]),states:[{name:'A'},{name:'B'}]});const before=d.snapshot();d.heap.set(encodeDesignData(before,d.meta),d.meta.inbox);d.heap[d.meta.inbox+25]=65;d.command('restore');assert.deepEqual(d.snapshot(),before);assert.equal(header(d,54),7);
});
test('designer text inspector supports an explicit multiline edit without premature commit',()=>{
 const d=scalarDesigner().command('insert',Kind.TextBlock);d.kernel.dsStartEdit(d.d,1,6);d.kernel.dsEditText(d.d,65);d.kernel.dsEditKey(d.d,13,1);d.kernel.dsEditText(d.d,66);assert.equal(header(d,45),6);d.kernel.dsEditKey(d.d,13,0);d.update();assert.equal(children(d)[0].props.text,'A\nB');
});
test('designer toolbar commands restore artboard keyboard focus, preserving timeline focus',()=>{
 const d=scalarDesigner().command('insert',Kind.Button);d.state[0]=d.meta.slots[1];d.command('property',8,40);assert.equal(d.state[0],d.meta.node);d.nodes[d.meta.slots[1]].info.x=Kind.AnimationTimeline;d.state[0]=d.meta.slots[1];d.command('seek',1);assert.equal(d.state[0],d.meta.slots[1]);
});
test('designer controller rejects unsupported palette kinds before queueing a command',()=>{
 const c=compile(h('DesignSurface',{id:'design'})),calls=[];const surface={manifest:c,id:x=>c.ids.get(x),send:(...args)=>calls.push(args)};const d=new DesignerController(surface,'design');assert.throws(()=>d.insert('DataGrid'),/Unsupported/);assert.throws(()=>d.insert('CodeEditor'),/Unsupported/);assert.equal(calls.length,0);d.insert('Button');assert.equal(calls.length,1);
});
test('designer generated ES module is executable and retains the complete native view',async()=>{
 for(const p of designerExamples){const source=generateDesignSource(p).replace(JSON.stringify('@helion/ui'),JSON.stringify(new URL('../src/index.js',import.meta.url).href));const result=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));assert.deepEqual(result.view,projectToView(p));assert.equal(typeof result.mount,'function');assert.ok(compile(result.view));}
});
