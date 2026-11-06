import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserInput} from '../src/platform/input.js';
import {CommandStream} from '../src/core/protocol.js';
import {Key,Opcode} from '../src/core/schema.js';
test('uppercase shortcut letters remain printable without Ctrl or Meta',t=>{
 const previous={document:globalThis.document,window:globalThis.window};
 const element=()=>({listeners:{},style:{},setAttribute(){},focus(){},remove(){},
  addEventListener(name,fn){this.listeners[name]=fn;},getBoundingClientRect(){return {left:0,top:0,width:100,height:100};}});
 globalThis.document={createElement:element,body:{append(){}}};globalThis.window=element();
 t.after(()=>{for(const key of ['document','window']){if(previous[key]===undefined)delete globalThis[key];else globalThis[key]=previous[key];}});
 const canvas=element(),commands=new CommandStream(),input=new BrowserInput(canvas,commands,()=>{});
 const key=(target,value,modifiers={})=>{let prevented=false;target.listeners.keydown({target,key:value,...modifiers,preventDefault(){prevented=true;}});return prevented;};
 const letters='ACVXDFGHLPYZ';
 for(const value of letters){
  assert.equal(key(input.proxy,value),false,`${value} beforeinput was suppressed`);
  input.proxy.listeners.beforeinput({inputType:'insertText',data:value,preventDefault(){}});
 }
 assert.deepEqual(Array.from({length:commands.length},(_,i)=>commands.u32[i*8]),Array(letters.length).fill(Opcode.Text));
 assert.equal(String.fromCodePoint(...Array.from({length:commands.length},(_,i)=>commands.u32[i*8+6])),letters);
 assert.equal(key(canvas,'A'),true);assert.equal(commands.u32[(commands.length-1)*8],Opcode.Text);
 assert.equal(key(input.proxy,'a',{ctrlKey:true}),true);
 assert.equal(commands.u32[(commands.length-1)*8],Opcode.Key);assert.equal(commands.u32[(commands.length-1)*8+6],Key.A);
 input.dispose();
});
test('pointerdown detail zero uses a bounded same-position click sequence',()=>{
 const input=Object.create(BrowserInput.prototype);const event=(timeStamp,clientX=8,pointerType='mouse',detail=0)=>({timeStamp,clientX,clientY:8,pointerType,detail});
 assert.equal(input.clickCount(event(0)),1);assert.equal(input.clickCount(event(100)),2);assert.equal(input.clickCount(event(200)),3);assert.equal(input.clickCount(event(300)),1);assert.equal(input.clickCount(event(900)),1);assert.equal(input.clickCount(event(950,25)),1);assert.equal(input.clickCount(event(1000,25,'touch')),1);assert.equal(input.clickCount(event(1100,25,'touch',2)),2);
});
