import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceHost} from '../site/workspaces.js';
import {createHub,HUB_ROUTES} from '../src/hub/view.js';
import {compile} from '../src/core/compiler.js';
import {readFile,access} from 'node:fs/promises';
import {tests} from '../src/hub/catalog.js';

test('overview, responsive navigation and tests are one retained GPU scene with a canvas-only host',async()=>{
  const scene=compile(createHub());
  assert.ok(scene.nodeCount<512);
  for(const route of HUB_ROUTES)for(const size of ['wide','small'])assert.ok(scene.ids.has(`nav-${size}-${route}`));
  for(const name of ['overview','test-directory'])assert.ok(scene.ids.has(name));
  assert.equal(scene.models.length,1);
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.equal((html.match(/<canvas\b/g)||[]).length,1);
  assert.doesNotMatch(html,/<(?:nav|button|a|textarea|select)\b/);
  for(const [id]of tests)await access(new URL(`./${id}.html`,import.meta.url));
});

function fixture() {
  let active='designer',visible=true;
  const entries=new Map(['designer','playground'].map(id=>[id,{frame:{contentWindow:{id}}}]));
  const host=createWorkspaceHost({entries,active:()=>active,visible:()=>visible,navigate:route=>{
    if(!entries.has(route))return false;active=route;return true;
  }});
  const surface=()=>({running:false,starts:0,stops:0,document:{privateEdits:true},
    start(){this.running=true;this.starts++;},stop(){this.running=false;this.stops++;}});
  return {host,entries,surface,activate:id=>{active=id;host.sync();},visibility:value=>{visible=value;host.sync();}};
}
test('workspace switches retain the exact surface and document while stopping hidden producers',()=>{
  const f=fixture(),a=f.surface(),b=f.surface(),document=a.document;
  f.host.register(f.entries.get('designer').frame.contentWindow,a);
  f.host.register(f.entries.get('playground').frame.contentWindow,b);
  assert.equal(a.running,true);assert.equal(b.running,false);
  f.activate('playground');assert.equal(a.running,false);assert.equal(b.running,true);
  f.activate('designer');assert.equal(a.running,true);assert.equal(b.running,false);
  assert.equal(f.entries.get('designer').surface,a);assert.equal(a.document,document);
  f.activate('home');assert.equal(a.running,false);assert.equal(b.running,false);
});
test('late boot and remount respect the current route and document visibility',()=>{
  const f=fixture(),child=f.entries.get('designer').frame.contentWindow;
  f.activate('playground');const late=f.surface();f.host.register(child,late);assert.equal(late.running,false);
  f.activate('designer');assert.equal(late.running,true);
  f.visibility(false);assert.equal(late.running,false);
  late.disposed=true;const replacement=f.surface();f.host.register(child,replacement);assert.equal(replacement.running,false);
  f.visibility(true);assert.equal(replacement.running,true);assert.equal(late.starts,1);
});
test('unknown child windows cannot register surfaces or navigate the application',()=>{
  const f=fixture(),foreign=f.surface();
  assert.equal(f.host.register({},foreign),false);assert.equal(foreign.starts,0);
  assert.equal(f.host.navigate({},'playground'),false);
  const child=f.entries.get('designer').frame.contentWindow;
  assert.equal(f.host.navigate(child,'https://example.com/'),false);
  assert.equal(f.host.navigate(child,'playground'),true);
});
