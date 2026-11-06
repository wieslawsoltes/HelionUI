/** Optional browser/GPU acceptance runner; no application dependency.
 * npm install --no-save --package-lock=false playwright
 * npm start
 * node tools/browser-test.mjs --channel chrome --output gpu-results.json
 * Serve dist and add --standalone to exercise the four embedded applications.
 * No GPU flags, disabled validation, software-adapter substitution or CPU fallback.
 */
import {parseArgs} from 'node:util';
import {writeFile, mkdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {instrumentPipelinePreparation} from './startup-compile-probe.mjs';

const {values: args} = parseArgs({options: {
  base: {type:'string',default:'http://127.0.0.1:8080/'},
  suite: {type:'string',default:'all'},
  channel: {type:'string',default:'chrome'},
  executable: {type:'string'}, headless: {type:'boolean',default:false},
  'disable-shader-cache': {type:'boolean',default:false},
  'compile-probe': {type:'boolean',default:false},
  'startup-budget-ms': {type:'string'},
  visits: {type:'string',default:'1'},
  'module-delay-ms': {type:'string',default:'0'},
  standalone: {type:'boolean',default:false}, output: {type:'string',default:'gpu-results.json'}
}});
if (!['all','apps','gates'].includes(args.suite)) throw new Error('--suite must be all, apps or gates');
if(args['compile-probe']&&(args.standalone||args.suite!=='apps'))throw new Error('--compile-probe requires source apps (--suite apps, no --standalone)');
const startupBudget=args['startup-budget-ms']==null?null:Number(args['startup-budget-ms']);
if(startupBudget!=null&&(!Number.isFinite(startupBudget)||startupBudget<=0||args.suite==='gates'))throw new Error('--startup-budget-ms requires a positive number and an application suite');
const visits=Number(args.visits);
if(!Number.isInteger(visits)||visits<1||visits>10||(visits>1&&args.suite!=='apps'))throw new Error('--visits requires 1–10 visits and --suite apps for repeated visits');
const moduleDelay=Number(args['module-delay-ms']);
if(!Number.isFinite(moduleDelay)||moduleDelay<0||moduleDelay>5000||(moduleDelay>0&&(args.standalone||args.suite!=='apps'||args['compile-probe'])))throw new Error('--module-delay-ms requires 0–5000 ms and uninstrumented source apps (--suite apps)');
const {chromium} = await import(process.env.HELION_PLAYWRIGHT_MODULE || 'playwright');
const apps = args.standalone
  ? ['helion-standalone.html','helion-designer.html','helion-playground.html','helion-typography.html']
  : ['', 'designer/', 'playground/', 'typography/'];
const gates = ['gpu','editor','designer','typography','templates','framework','dynamic','quality','shaders','metrics','frame-sync'].map(name=>`tests/${name}.html?autorun`);
const paths = [...(args.suite==='gates'?[]:apps), ...(args.suite==='apps'?[]:gates)];
const report = {status:'RUNNING',started:new Date().toISOString(),base:args.base,standalone:args.standalone,
  startupBudgetMs:startupBudget,visits,simulatedModuleRequestDelayMs:moduleDelay,
  scope:'Browser startup and native GPU correctness on the recorded adapter; not cross-browser or cold-cache performance qualification.',results:[]};
const output = resolve(args.output);
await mkdir(dirname(output), {recursive:true});
const save = ()=>writeFile(output,JSON.stringify(report,null,2)+'\n');
let browser;
try {
  report.browserShaderDiskCache=!args['disable-shader-cache'];
  browser = await chromium.launch({headless:args.headless,chromiumSandbox:true,
    args:args['disable-shader-cache']?['--disable-gpu-shader-disk-cache']:[],
    ...(args.executable?{executablePath:args.executable}:{channel:args.channel})});
  report.browser = browser.version();
  const contexts=new Map();
  for (const {path,visit} of paths.flatMap(path=>Array.from({length:visits},(_,i)=>({path,visit:i+1})))) {
    // Each application gets an isolated first visit, then reuses its HTTP/IDB
    // cache for reload measurements. The browser/OS shader cache is separate.
    if(!contexts.has(path))contexts.set(path,await browser.newContext({viewport:{width:1280,height:900}}));
    const context=contexts.get(path),page=await context.newPage();
    if(moduleDelay>0)await page.route('**/*.js',async route=>{
      await new Promise(resolve=>setTimeout(resolve,moduleDelay));await route.continue();
    });
    if(args['compile-probe']){
      // Fresh browser profiles cannot clear the OS shader cache. A test-only
      // out-of-range workgroup guard changes actual native code without
      // changing any legal Helion dispatch (all are far below this index).
      const guard=1000000000+Math.floor(Math.random()*1000000000);
      report.pipelineInstrumentation='Test-only unique out-of-range workgroup guards; not an unmodified production-page benchmark. OS cache state cannot be cleared by this runner.';
      (report.pipelineGuards??=[]).push({path,guard});
      await page.route('**/src/gpu/pipeline-library.js',async route=>{
        const response=await route.fetch();const code=instrumentPipelinePreparation(await response.text(),guard);
        await route.fulfill({response,body:code});
      });
    }
    const item = {path,visit,errors:[]}; report.results.push(item);
    page.on('pageerror',error=>item.errors.push(error.stack || String(error)));
    page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('404 (Not Found)'))item.errors.push(message.text());});
    page.on('requestfailed',request=>{if(request.failure()?.errorText!=='net::ERR_ABORTED')item.errors.push(`${request.url()}: ${request.failure()?.errorText}`);});
    try {
      const response = await page.goto(new URL(path,args.base).href,{waitUntil:'domcontentloaded'});
      if (!response?.ok()) throw new Error(`Navigation HTTP ${response?.status()}`);
      if (path.includes('?autorun')) {
        await page.waitForFunction(()=>Object.keys(globalThis).some(key=>/^__HELION_.*(?:RESULT|CHECK)__$/.test(key)&&['PASS','FAIL'].includes(globalThis[key]?.status)),null,{timeout:180000});
        item.gate = await page.evaluate(()=>Object.entries(globalThis).find(([key,value])=>/^__HELION_.*(?:RESULT|CHECK)__$/.test(key)&&['PASS','FAIL'].includes(value?.status))?.[1]);
        if (item.gate.status!=='PASS') throw new Error(item.gate.error || 'Native gate failed');
      } else {
        await page.waitForFunction(()=>{
          const s=globalThis.helion||globalThis.helionDesigner||globalThis.helionWorkbench||globalThis.helionTypography;
          const boot=document.querySelector('#boot');
          return (s?.stats.completedFrames>0&&boot?.hidden)||s?.faulted||document.querySelector('#boot.failed')||(!boot?.hidden&&/exceeded|doesn't exist|could not|failed|Entry point/i.test(boot?.textContent||''));
        },null,{timeout:90000});
        item.application = await page.evaluate(async()=>{
          const s=globalThis.helion||globalThis.helionDesigner||globalThis.helionWorkbench||globalThis.helionTypography;
          if (!s||s.faulted) throw new Error(s?.errors.join('\n')||document.querySelector('#boot')?.innerText);
          const before={...s.stats}; await new Promise(resolve=>setTimeout(resolve,300));
          if (s.faulted||s.stats.completedFrames<=before.completedFrames) throw new Error(s.errors.join('\n')||'GPU frames stopped completing');
          if (s.stats.readbackBytes!==before.readbackBytes) throw new Error('Idle frame readback');
          const a=s.adapterInfo;
          const {status,cache,fontMs,compileMs,adapterAndShadersMs,deviceMs,shaderModulesMs,uploadAndBindingsMs,pipelineMs,pipelineConcurrency,mountMs,startedAt,firstCompletedMs,pipelineEntries}=s.startup;
          return {adapter:{vendor:a.vendor,architecture:a.architecture,device:a.device,description:a.description},
            startup:{status,cache,fontMs,compileMs,adapterAndShadersMs,deviceMs,shaderModulesMs,uploadAndBindingsMs,pipelineMs,pipelineConcurrency,mountMs,firstCompletedMs,
              navigationToFirstCompletedMs:startedAt+firstCompletedMs,pipelineEntries},
            viewport:s.resolution,stats:{...s.stats},idleReadbackBytes:s.stats.readbackBytes-before.readbackBytes,
            network:performance.getEntriesByType('resource').map(r=>({url:r.name.startsWith('data:')?'embedded module':r.name,bytes:r.transferSize,startMs:r.startTime,durationMs:r.duration,initiator:r.initiatorType}))};
        });
        if (path===''||path==='helion-standalone.html') {
          // Exercise real DOM input delivery, then explicitly inspect the result.
          await page.locator('#surface').click({position:{x:180,y:255}});
          await page.keyboard.type('Aurora');
          await page.waitForFunction(()=>globalThis.helion.commands.length===0);
          item.interaction=await page.evaluate(async()=>{
            const s=globalThis.helion;await s.whenSubmittedWorkDone();
            const raw=await s.inspect(),id=s.id('search'),length=raw.state[64+id*16+4];
            const text=String.fromCodePoint(...new Uint32Array(await s.readHeapRange(raw.nodes[id*72+6],length)));
            if(text!=='Aurora')throw new Error(`DOM keyboard input produced ${JSON.stringify(text)}`);
            return {status:'PASS',check:'DOM pointer/keyboard to GPU TextBox',text};
          });
        }
        if (path==='playground/'||path==='helion-playground.html') {
          await page.locator('#workbench').focus();
          const modifier=await page.evaluate(()=>navigator.platform.includes('Mac')?'Meta':'Control');
          await page.keyboard.press(`${modifier}+Enter`);
          await page.waitForFunction(()=>globalThis.helionWorkbench.embedded?.surface.stats.frames>0,null,{timeout:30000});
          item.interaction=await page.evaluate(async()=>{
            const owner=globalThis.helionWorkbench,child=owner.embedded.surface;
            await owner.whenSubmittedWorkDone();
            if(owner.faulted||child.faulted)throw new Error([...owner.errors,...child.errors].join('\n'));
            if(owner.device!==child.device||child.stats.readbackBytes!==0)throw new Error('Preview lost shared-device/no-readback contract');
            return {status:'PASS',check:'Run app shortcut through sandbox worker to shared GPU preview',nodes:child.manifest.nodeCount,frames:child.stats.frames};
          });
        }
        item.screenshot = output.replace(/\.json$/,'')+`-${report.results.length}.png`;
        await page.screenshot({path:item.screenshot,timeout:15000});
        if(item.errors.length)throw new Error(item.errors.join('\n'));
        item.correctnessStatus='PASS';
        if(startupBudget!=null){
          const elapsed=item.application.startup.navigationToFirstCompletedMs;
          item.startupBudgetStatus=Number.isFinite(elapsed)&&elapsed<=startupBudget?'PASS':'FAIL';
          if(!Number.isFinite(elapsed)||elapsed>startupBudget)throw new Error(`Startup budget exceeded: ${Math.round(elapsed)} ms from navigation to completed application frame; budget ${startupBudget} ms`);
        }
      }
      if (item.errors.length) throw new Error(item.errors.join('\n'));
      item.status='PASS';
    } catch(error) { item.status='FAIL';item.error=error.stack || String(error); }
    console.log(`${item.status} ${path || '/'}${item.application?` (${Math.round(item.application.startup.firstCompletedMs)} ms to completed frame)`:''}`);
    await page.close();if(visit===visits){await context.close();contexts.delete(path);}await save();
  }
  report.status=report.results.every(item=>item.status==='PASS')?'PASS':'FAIL';
} catch(error) { report.status='FAIL';report.error=error.stack || String(error); }
finally { await browser?.close();report.finished=new Date().toISOString();await save(); }
process.exitCode=report.status==='PASS'?0:1;
