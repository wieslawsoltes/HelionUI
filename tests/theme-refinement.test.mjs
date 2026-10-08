/** Scalar WGSL/authoring regression tests. These are NOT native GPU execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compile,h} from '../src/core/compiler.js';
import {rgba,fromBits,Opcode} from '../src/core/schema.js';
import {CommandStream} from '../src/core/protocol.js';
import {HelionSurface} from '../src/gpu/runtime.js';
import {ButtonTemplate,AccentButtonTemplate,SubtleButtonTemplate,DestructiveButtonTemplate,ToggleButtonTemplate,TextBoxTemplate,CheckBoxTemplate,SliderTemplate,ToggleSwitchTemplate,ControlTemplate,TemplateBinding as B,ThemeResource as R,WinUIFluentTheme,MacOS26Theme,themePreferenceAction,themeAccentColors,resolveThemePalette,normalizeThemeSettings} from '../src/templates/index.js';
import {scalarTemplate} from '../tools/template-kernel-host.mjs';
import {scalarDesigner} from '../tools/designer-kernel-host.mjs';
import {DesignerController,DesignDocument,projectToView} from '../src/designer/index.js';
import {encodeDesignData} from '../src/designer/pack.js';
import {createDesignerWorkbench} from '../src/designer/workbench.js';
import {designerExamples} from '../designer/examples.js';
const themes=[WinUIFluentTheme,MacOS26Theme];
const scene=(template=ButtonTemplate,settings={},props={})=>h('Grid',{...settings},h(template.targetType,{id:'owner',text:'AB',template,...props}));
const part=(s,name)=>s.compiled.templates.find(t=>t.owner===s.id('owner')).names[name];
const opacity=(s,id)=>fromBits(s.state[s.cs(id)+3]);
const color=(value)=>{const n=rgba(value);return [0,8,16].map(i=>(n>>>i&255)/255);};
const luminance=value=>color(value).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((v,x,i)=>v+x*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
for(const theme of themes)for(const variant of ['light','dark'])for(const themeContrast of ['standard','high'])test(`palette text pairs: ${theme.name}/${variant}/${themeContrast}`,()=>{
 const p=resolveThemePalette(theme,variant,{themeContrast});
 for(const bg of ['control','controlHover','controlPressed','field','fieldHover','canvas','surface'])assert.ok(contrast(p.text,p[bg])>=4.5,`${bg} text contrast`);
 for(const bg of ['accent','accentHover','accentPressed'])assert.ok(contrast(p.accentText,p[bg])>=4.5,`${bg} text contrast`);
 for(const bg of ['danger','dangerHover','dangerPressed'])assert.ok(contrast(p.dangerText,p[bg])>=4.5,`${bg} text contrast`);
 for(const bg of ['control','field'])assert.ok(contrast(p.focus,p[bg])>=3,`${bg} focus contrast`);
});
for(const theme of themes)for(const variant of ['dark','light'])test(`density remains a live numeric theme plan: ${theme.name}/${variant}`,()=>{
 const s=scalarTemplate(scene(ButtonTemplate,{theme:theme.name,themeVariant:variant})).step();
 const owner=s.id('owner'),chrome=part(s,'Chrome'),old=s.nodes[owner].size.w;
 s.kernel.templateCommand(0,8,1,0);s.step(1);
 assert.ok(s.nodes[owner].size.w<old);assert.equal(s.nodes[owner].size.w,theme.compact.controlHeight);
 assert.equal(s.kernel.layoutPadding(s.nodes[chrome]).x,theme.compact.controlPadding);assert.ok(s.scratch[8]&1);
 s.step(2);assert.equal(s.scratch[8]&1,0,'clean density must not keep Measure dirty');
 s.kernel.templateCommand(0,8,0,0);s.step(3);assert.equal(s.nodes[owner].size.w,old);
});
for(const t of [ButtonTemplate,TextBoxTemplate,CheckBoxTemplate,SliderTemplate,ToggleSwitchTemplate])test(`focus never changes a content border or padding: ${t.name}`,()=>{
 const s=scalarTemplate(scene(t)).step(),ring=part(s,'FocusRing'),geometry=s.nodes.map(n=>[n.size.slice(),n.limits.slice(),n.margin.slice()]);s.state[0]=s.id('owner');s.step(1).step(1.2);
 assert.equal(opacity(s,ring),1);assert.deepEqual(s.nodes.map(n=>[n.size.slice(),n.limits.slice(),n.margin.slice()]),geometry);assert.equal(s.scratch[8]&1,0);
 s.nodes[s.id('owner')].text.y|=16;s.step(2).step(2.2);assert.equal(opacity(s,ring),0,'disabled focus must be hidden');
});
for(const t of [AccentButtonTemplate,SubtleButtonTemplate,DestructiveButtonTemplate,ToggleButtonTemplate])test(`variants retain owner interaction and per-instance names: ${t.name}`,()=>{
 const c=compile(h('StackPanel',{},h(t.targetType,{id:'a',template:t}),h(t.targetType,{id:'b',template:t})));assert.equal(c.templates.length,2);assert.notEqual(c.templates[0].names.FocusRing,c.templates[1].names.FocusRing);assert.equal(c.templates[0].targetType,t.targetType);assert.ok(c.nodeCount<16);
});
for(const theme of themes)for(const variant of ['light','dark'])test(`checked toggle keeps readable text through hover, press, disabled: ${theme.name}/${variant}`,()=>{
 const s=scalarTemplate(scene(ToggleButtonTemplate,{theme:theme.name,themeVariant:variant},{value:1})).step(),o=s.id('owner'),c=part(s,'Chrome'),t=part(s,'Content');
 for(const [time,input] of [[1,'hover'],[2,'pressed'],[3,'disabled']]){
  s.state[1]=o;if(input==='pressed')s.state[2]=o;if(input==='disabled')s.nodes[o].text.y|=16;
  s.step(time).step(time+.3);assert.ok(contrast(s.nodes[t].paint.y,s.nodes[c].paint.x)>=4.5);
 }
});
test('native TextBox still aliases its owner through additional focus geometry',()=>{
 const s=scalarTemplate(scene(TextBoxTemplate,{}, {text:'unchanged'})).step(),o=s.id('owner'),p=part(s,'PART_ContentHost');const ptr=s.nodes[p].text.z;
 s.kernel.templateCommand(0,0,1,1);s.kernel.templateCommand(0,7,1,0);s.kernel.templateCommand(0,8,1,0);s.step(1);
 assert.equal(s.nodes[p].text.z,ptr);assert.equal(s.nodes[p].text.z,s.nodes[o].text.z);assert.equal(s.nodes[p].text.w,9);
});
test("checked state does not override Disabled and hover does not masquerade as checked",()=>{
 const s=scalarTemplate(scene(ToggleButtonTemplate,{},{value:1,disabled:true})).step();assert.equal(s.nodes[part(s,'Content')].paint.y,rgba(WinUIFluentTheme.dark.disabledText));assert.equal(s.nodes[part(s,'Chrome')].paint.x,rgba(WinUIFluentTheme.dark.disabledSurface));
});
test('custom accent commands derive matching foreground/hover colors on device',()=>{
 const s=scalarTemplate(scene(AccentButtonTemplate)).step();
 for(const hex of ['#000000','#ffffff','#ff0080','#b99cff','#69d5a0','#765423','#4488aa']){const n=rgba(hex),a=themeAccentColors(n);s.kernel.templateCommand(0,5,n&65535,n>>>16);s.step();const system=s.kernel.templateSystem();for(const [i,key]of ['accent','accentText','accentHover','accentPressed'].entries())assert.equal(s.heap[system+15+i],a[key]);assert.equal(s.nodes[part(s,'Chrome')].paint.x,n);}
});
test('high contrast temporarily overrides custom accent, without discarding it',()=>{
 const s=scalarTemplate(scene(AccentButtonTemplate,{accentColor:'#f8c572'})).step(),c=part(s,'Chrome');assert.equal(s.nodes[c].paint.x,rgba('#f8c572'));s.kernel.templateCommand(0,7,1,0);s.step();assert.equal(s.nodes[c].paint.x,rgba(WinUIFluentTheme.contrastDark.accent));s.kernel.templateCommand(0,7,0,0);s.step();assert.equal(s.nodes[c].paint.x,rgba('#f8c572'));s.kernel.templateCommand(0,6,0,0);s.step();assert.equal(s.nodes[c].paint.x,rgba(WinUIFluentTheme.dark.accent));
});
test('accent input validation rejects translucent paints before queuing anything',()=>{
 for(const value of ['#11223380','transparent']){assert.throws(()=>normalizeThemeSettings({accentColor:value}),/opaque/);assert.throws(()=>themePreferenceAction('accent',value),/opaque/);}
});
test('bad raw preference commands leave the previous GPU palette and counters intact',()=>{
 const s=scalarTemplate(scene()).step(),p=s.kernel.templateSystem(),old=s.heap.slice(p,p+32);for(const c of [[7,2,0],[8,3,0],[5,65536,65535],[5,1,2]])s.kernel.templateCommand(0,...c);assert.deepEqual(s.heap.slice(p,p+32),old);assert.equal(s.state[43],4);
});
test('theme resource selection covers all eight prepared combinations',()=>{
 for(const theme of themes)for(const themeVariant of ['dark','light'])for(const themeContrast of ['standard','high'])for(const controlDensity of ['comfortable','compact']){
  const options={theme:theme.name,themeVariant,themeContrast,controlDensity};const s=scalarTemplate(h('Border',{...options,id:'block',background:R('canvas'),radius:R('radius'),padding:R('panelPadding')})).step();const expected=resolveThemePalette(theme,themeVariant,options);assert.equal(s.nodes[0].paint.x,rgba(expected.canvas));assert.equal(s.nodes[0].limits.z,expected.panelPadding);
 }
});
test('controlThemes false opts out a subtree while explicit templates remain available',()=>{
 const c=compile(h('StackPanel',{controlThemes:true},h('Button',{id:'implicit'}),h('StackPanel',{controlThemes:false},h('Button',{id:'native'}),h('Button',{id:'explicit',template:ButtonTemplate})),h('Button',{id:'alsoNative',template:false})));
 assert.deepEqual(c.templates.filter(x=>x.root!==0xffffffff).map(x=>x.owner),[c.ids.get('implicit'),c.ids.get('explicit')]);
});
test('read-only built-in theme graphs cannot be globally mutated by a consumer',()=>{assert.throws(()=>WinUIFluentTheme.dark.text='#333');assert.throws(()=>ButtonTemplate.root.children.push(h('Border')));const copy=structuredClone(ButtonTemplate);copy.root.props.padding=3;assert.equal(ButtonTemplate.root.props.padding,undefined);});
test('unconverted two-way bindings reject clamps, negation and relative offsets',()=>{for(const options of [{min:0},{max:1},{negate:true},{relativeOffset:1}])assert.throws(()=>B('value',{mode:'twoWay',...options}),/unconverted/);});
test('state groups are searched once per owner/stage, not once per property rule',()=>{
 const s=scalarTemplate(scene(ButtonTemplate)).step();const groups=s.compiled.templates[0].groups.length;assert.equal(s.stateScans,groups*2);s.state[2]=s.id('owner');s.step(1);assert.equal(s.stateScans,groups*4);
});
test("reduced motion does not erase the outgoing transition definition",()=>{
 const s=scalarTemplate(scene(ToggleSwitchTemplate)).step(),o=s.id('owner'),thumb=part(s,'Thumb');s.state[s.cs(o)]=new Uint32Array(new Float32Array([1]).buffer)[0];s.kernel.templateCommand(0,3,1,0);s.step(1);assert.equal(fromBits(s.state[s.cs(thumb)+8]),18);
 s.kernel.templateCommand(0,3,0,0);s.state[s.cs(o)]=0;s.step(2);assert.equal(fromBits(s.state[s.cs(thumb)+8]),18);s.step(2.08);assert.ok(fromBits(s.state[s.cs(thumb)+8])>0);s.step(2.3);assert.equal(fromBits(s.state[s.cs(thumb)+8]),0);
});
test('interrupted transitions preserve their already displayed value',()=>{
 const s=scalarTemplate(scene(ButtonTemplate)).step(),o=s.id('owner'),c=part(s,'Chrome');s.state[1]=o;s.step(1).step(1.06);const old=s.nodes[c].paint.x;s.state[1]=0xffffffff;s.step(1.06);assert.equal(s.nodes[c].paint.x,old);s.step(2);assert.equal(s.nodes[c].paint.x,rgba(WinUIFluentTheme.dark.control));
});
const project=()=>({capacity:8,history:16,templateCapacity:2,templates:[ButtonTemplate],root:{type:'Canvas',props:{id:'root'},children:[{type:'Button',props:{id:'button',text:'AB',template:'Button',templateDefaults:true}}]}});
test('designer contrast, density, accent and reduced motion are undoable GPU settings',()=>{
 const d=scalarDesigner(project()),s=scalarTemplate(null,{compiled:d.compiled});s.step();const n=rgba('#b99cff');d.command('themePreference',0,1).command('themePreference',1,1).command('themeAccent',n&65535,n>>>16).command('themePreference',2,1);s.step();const a=d.snapshot();assert.equal(a.themeContrast,'high');assert.equal(a.controlDensity,'compact');assert.equal(a.accentColor,n);assert.equal(a.reducedMotion,true);
 d.command('undo').command('undo').command('undo').command('undo');s.step();const b=d.snapshot();assert.equal(b.themeContrast,'standard');assert.equal(b.controlDensity,'comfortable');assert.equal(b.accentColor,null);assert.equal(b.reducedMotion,false);
 d.command('redo').command('redo').command('redo').command('redo');s.step();assert.deepEqual(d.snapshot(),a);
});
test('designer preferences survive restore serialization and native declaration export',()=>{
 const p={...project(),themeContrast:'high',controlDensity:'compact',accentColor:'#bbcc88',reducedMotion:true};const d=scalarDesigner(p),snapshot=d.snapshot();const v=projectToView(snapshot);assert.equal(v.props.themeContrast,'high');assert.equal(v.props.controlDensity,'compact');assert.equal(v.props.accentColor,rgba('#bbcc88'));assert.equal(compile(v).templateSystem.themeContrast,'high');assert.deepEqual(encodeDesignData(snapshot,d.meta),d.heap.slice(d.meta.data,d.meta.data+d.meta.offsets.words));
});
test('bad designer preference commands are transactional rejections',()=>{
 const d=scalarDesigner(project()),old=d.snapshot();for(const c of [['themePreference',0,2],['themePreference',.5,1],['themeAccent',65536,65535],['themeAccent',4,25]])d.command(...c);assert.deepEqual(d.snapshot(),old);assert.equal(d.heap[d.d+55],4);
});
test('designer state simulation is transient and does not change native control value or project history',()=>{
 const d=scalarDesigner(project()),s=scalarTemplate(null,{compiled:d.compiled});s.step();const old=d.snapshot(),o=d.meta.slots[1];d.select(1).command('templatePreview',4);s.step(1).step(2);const p=s.kernel.templateInfo(o),root=s.heap[p+1],chrome=s.heap[s.nodes[root].info.z];assert.equal(s.nodes[chrome].paint.x,rgba(WinUIFluentTheme.dark.controlPressed));assert.equal(s.state[s.cs(o)],0);assert.deepEqual(d.snapshot(),old);d.command('templatePreview',0);s.step(3).step(4);assert.equal(s.nodes[chrome].paint.x,rgba(WinUIFluentTheme.dark.control));
});
test('Studio with all refinement controls remains within its fixed 512-node arena',()=>{for(const p of designerExamples){const c=compile(createDesignerWorkbench(p));assert.ok(c.nodeCount<=512);assert.equal(c.editors.length,5);assert.equal(c.designers[0].templateCapacity,8);}});
test('new runtime settings use one 32-byte packet command each; no readback',()=>{
 const surface=Object.create(HelionSurface.prototype);surface.manifest={templateSystem:{themes:[{name:'fluent'}]}};surface.commands=new CommandStream();surface.send=function(kind,p){this.commands.push(kind,p);return this;};surface.setThemeContrast('high').setControlDensity('compact').setAccentColor('#bbcc88').setAccentColor(null);
 assert.equal(surface.commands.length,4);const queue={writeBuffer(){}};const packet=surface.commands.flush(queue,{});assert.equal(packet.bytes,128);assert.equal(packet.payloadBytes,0);
});
test('GPU preference actions compile their string choices to bounded integer pairs',()=>{
 for(const [option,value,code]of [['contrast','high',7],['density','compact',8],['accent','#b99cff',5],['accent',null,6],['reducedMotion',true,3]]){
  const c=compile(h('Button',{action:themePreferenceAction(option,value)})),n=new Uint32Array(c.nodes.buffer);assert.equal(n[38],code);assert.ok(c.templateSystem);
 }
});
test('new shader helpers retain the grouping syntax guard',async()=>{const source=await readFile(new URL('../shaders/templates.wgsl',import.meta.url),'utf8');assert.match(source,/fn templateSetAccent/);assert.match(source,/heap\[heap\[p\+4u\]\+heap\[r\]\*4u\+3u\]/);assert.ok(!source.includes('textureSample'));});

// Stable round-half-up tint bytes, without f32 half-boundary sensitivity.
test('accent tint channels use matching bounded integer arithmetic',()=>{
 const s=scalarTemplate(scene(AccentButtonTemplate)).step(),p=s.kernel.templateSystem();
 for(let channel=0;channel<256;channel++)for(let lane=0;lane<3;lane++){
  const color=(0xff585858 & ~(255<<(lane*8)) | channel<<(lane*8))>>>0;
  s.kernel.templateCommand(0,5,color&65535,color>>>16);const expected=themeAccentColors(color);
  assert.equal(s.heap[p+17],expected.accentHover);assert.equal(s.heap[p+18],expected.accentPressed);
 }
});
test('startup signatures distinguish theme preference options',async()=>{
 const {cacheSignature}=await import('../src/startup/cache.js');
 const view=h('Button',{template:ButtonTemplate});
 const options={startupCache:'theme-test',fontSources:[{source:'https://example.invalid/font.ttf'}]};
 const signatures=await Promise.all([{}, {themeContrast:'high'}, {controlDensity:'compact'}, {accentColor:'#ff0080'}, {reducedMotion:true}].map(x=>cacheSignature(view,{...options,...x})));
 assert.ok(signatures.every(Boolean));assert.equal(new Set(signatures).size,signatures.length);
});
