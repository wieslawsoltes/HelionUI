import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {startWorkspace} from '../src/platform/workspace.js';

function fixture(source,end,extra){
  const mounts=[],errors=[],canvas={},notice={hidden:false};
  const context=vm.createContext({AbortController,startWorkspace,performance:{now:()=>0},BUILD_VERSION:'test',
    $:id=>id==='boot'?notice:canvas,bootNotice(){},log(){},status(){},action(){},keyboard(){},key(){},
    console:{error:e=>errors.push(e)},fail:e=>errors.push(e),
    HelionSurface:{async mount(canvas,view,options){mounts.push({canvas,view,options});return{render(){},async whenSubmittedWorkDone(){},start(){},dispose(){},faulted:false};}},
    ...extra});
  const begin=source.indexOf('async function boot('),finish=source.indexOf(end,begin);
  assert.ok(begin>=0&&finish>begin);
  vm.runInContext(source.slice(begin,finish),context);
  return{context,mounts,errors,notice};
}

test('Playground starts GPU preparation without awaiting host fonts and persists only the built-in initial scene',async()=>{
  const source=await readFile(new URL('../playground/app.js',import.meta.url),'utf8');
  const initial=Object.freeze({code:'public code',css:'public style'}),fonts=[{source:'https://example.invalid/pinned-font.ttf'}];
  const f=fixture(source,'async function readSource(',{
    defaultBootData:initial,lastBootData:initial,localFonts:null,EDITOR_FONT_SOURCES:fonts,bootEpoch:0,bootController:null,
    examples:[],limits:{},createGPUShell:data=>data,fonts(){throw new Error('Host font loading blocks GPU preparation');}
  });
  await f.context.boot();assert.deepEqual(f.errors,[]);assert.equal(f.mounts.length,1);
  const first=f.mounts[0].options;assert.equal(first.fontSources,fonts);assert.equal(first.fonts,undefined);assert.equal(first.startupWorker,true);assert.equal(first.startupCache,'playground-public-example-v1');assert.equal(f.notice.hidden,true);
  await f.context.boot({...initial,notes:'private notes'});
  assert.equal(f.mounts[1].options.startupCache,false);assert.equal(first.signal.aborted,true);
  f.context.localFonts=[{source:{privateFile:true}}];await f.context.boot(initial);
  assert.equal(f.mounts[2].options.fontSources,f.context.localFonts);assert.equal(f.mounts[2].options.startupCache,false);
  assert.deepEqual(f.errors,[]);
});

test('Typography caches the public default font scene but never opted-in local faces',async()=>{
  const source=await readFile(new URL('../typography/app.js',import.meta.url),'utf8');
  const fonts=[{source:'https://example.invalid/pinned-font.ttf'}];
  const f=fixture(source,"$('font-files').addEventListener",{surface:null,epoch:0,TYPOGRAPHY_FONT_SOURCES:fonts,createTypographyLab:()=>({type:'Grid'})});
  await f.context.boot();assert.equal(f.mounts[0].options.startupCache,'typography-public-example-v1');
  const local=[{source:{privateFile:true}}];await f.context.boot(local);
  assert.equal(f.mounts[1].options.fontSources,local);assert.equal(f.mounts[1].options.startupCache,false);
  assert.deepEqual(f.errors,[]);assert.equal(f.notice.hidden,true);
});
