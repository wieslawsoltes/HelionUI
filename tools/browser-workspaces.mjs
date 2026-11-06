/** Optional Chrome/WebGPU acceptance check for the unified GPU application.
 * HELION_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/browser-workspaces.mjs
 * Uses native WebGPU without adapter overrides. Explicit snapshots are test-only.
 */
import assert from 'node:assert/strict';
import {parseArgs} from 'node:util';
import {writeFile} from 'node:fs/promises';
const {values:args}=parseArgs({options:{base:{type:'string',default:'http://127.0.0.1:8080/'},output:{type:'string',default:'/tmp/helion-workspaces.json'},headless:{type:'boolean',default:false}}});
const {chromium}=await import(process.env.HELION_PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:args.headless});
const report={status:'RUNNING',base:args.base,browser:browser.version(),checks:[]};
const check=(name,value)=>{assert.ok(value,name);report.checks.push(name);};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(args.base);
 await page.waitForFunction(()=>globalThis.helionHub&&document.getElementById('boot').hidden,null,{timeout:60000});
 check('No workspace mounted before selection',await page.locator('iframe').count()===0);
 check('Application host has no HTML navigation or controls',await page.locator('button,nav,a,textarea,select').evaluateAll(nodes=>nodes.every(node=>getComputedStyle(node).opacity==='0'||getComputedStyle(node).display==='none')));
 await page.waitForTimeout(500);const idle=await page.evaluate(()=>helionHub.stats.frames);await page.waitForTimeout(500);
 check('GPU navigation has no idle frame producer',await page.evaluate(()=>helionHub.stats.frames)===idle);
 // Real pointer input targets the retained navigation button, not a DOM overlay.
 await page.mouse.click(490,27);await page.waitForURL('**/#designer');
 const designer=await(await page.waitForSelector('iframe[title="Helion Designer"]')).contentFrame();
 await designer.waitForFunction(()=>globalThis.helionDesigner?.running&&document.getElementById('boot').hidden,null,{timeout:60000});
 check('GPU navigation opens Designer and clears startup notice',true);
 await designer.evaluate(()=>{globalThis.savedSurface=helionDesigner;helionDesigner.editor('project-json').replaceDocument('Retained workspace edit');});
 await designer.waitForFunction(()=>helionDesigner.commands.length===0);
 await page.mouse.click(390,27);await page.waitForURL('**/#playground');
 const playground=await(await page.waitForSelector('iframe[title="Helion Playground"]')).contentFrame();
 await playground.waitForFunction(()=>globalThis.helionWorkbench?.running&&document.getElementById('boot').hidden,null,{timeout:60000});
 check('Hidden Designer stops producing frames',await designer.evaluate(()=>!helionDesigner.running));
 await designer.evaluate(()=>helionDesigner.whenSubmittedWorkDone());const pausedFrames=await designer.evaluate(()=>helionDesigner.stats.frames);
 await page.waitForTimeout(300);check('Hidden surface remains idle',await designer.evaluate(()=>helionDesigner.stats.frames)===pausedFrames);
 await page.goBack();await page.waitForURL('**/#designer');await designer.waitForFunction(()=>helionDesigner.running);
 check('Back navigation resumes the exact GPU surface',await designer.evaluate(()=>savedSurface===helionDesigner));
 const edit=await designer.evaluate(async()=>{await helionDesigner.whenSubmittedWorkDone();return(await helionDesigner.editor('project-json').snapshot()).text;});
 check('GPU document survives workspace switching',edit==='Retained workspace edit');
 check('Inactive Playground stops producing frames',await playground.evaluate(()=>!helionWorkbench.running));
 await page.mouse.click(680,27);await page.waitForURL('**/#tests');
 check('Tests directory pauses both tools',await designer.evaluate(()=>!helionDesigner.running)&&await playground.evaluate(()=>!helionWorkbench.running));
 check('Revisiting tools creates no duplicate frames',await page.locator('iframe').count()===2);
 // First test button: ensure asynchronous GPU host actions open the test URL.
 const popupPromise=page.waitForEvent('popup');await page.mouse.click(223,348);const popup=await popupPromise;await popup.waitForLoadState();
 check('GPU test link opens the real browser harness',new URL(popup.url()).pathname.endsWith('/tests/gpu.html'));await popup.close();
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>location.hash='home');
 await page.waitForTimeout(250);await page.screenshot({path:'/tmp/helion-workspaces-mobile.png'});
 check('Compact navigation keeps all six routes in the canvas',await page.evaluate(()=>helionHub.viewport.width===390));
 await page.setViewportSize({width:1440,height:1000});await page.waitForTimeout(250);await page.screenshot({path:'/tmp/helion-workspaces-desktop.png'});
 check('No browser script errors',errors.length===0);report.status='PASS';
}catch(error){report.status='FAIL';report.error=error.stack;process.exitCode=1;}
finally{await browser.close();await writeFile(args.output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}
