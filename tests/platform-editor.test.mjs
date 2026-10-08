import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserInput} from '../src/platform/input.js';
test('pointerdown detail zero uses a bounded same-position click sequence',()=>{
 const input=Object.create(BrowserInput.prototype);const event=(timeStamp,clientX=8,pointerType='mouse',detail=0)=>({timeStamp,clientX,clientY:8,pointerType,detail});
 assert.equal(input.clickCount(event(0)),1);assert.equal(input.clickCount(event(100)),2);assert.equal(input.clickCount(event(200)),3);assert.equal(input.clickCount(event(300)),1);assert.equal(input.clickCount(event(900)),1);assert.equal(input.clickCount(event(950,25)),1);assert.equal(input.clickCount(event(1000,25,'touch')),1);assert.equal(input.clickCount(event(1100,25,'touch',2)),2);
});
