/** Real browser timer/worker tests, independent of fonts, WebGPU and drivers.
 * Symbols are injected so the same suite can exercise the source site or the
 * exact modules extracted from the distributed standalone import map. */
export async function runHostStartupSuite({ProgressWatchdog,prepareView,compile,h,diagnosticFont,AppSandbox,workerSource,authoringSource,includeSourceWorker=true}) {
  const result={status:'RUNNING',scope:'Browser timers, preparation workers, sandbox transport and array equality only. No WebGPU execution.',checks:[]};
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const check=async(name,run)=>{try{result.checks.push({name,status:'PASS',detail:await run()});}catch(error){result.checks.push({name,status:'FAIL',error:String(error.stack||error)});}};
  await check('Native watchdog arm, cancel, suspend, resume and stall',async()=>{
    const reports=[];const w=new ProgressWatchdog({timeoutMs:15,onStall:e=>reports.push(e)});
    try{
      w.submitted(1);w.completed(1);await delay(30);assert(reports.length===0,'Completed work reported a stall');
      w.submitted(2);w.suspend();await delay(30);assert(reports.length===0,'Suspended work reported a stall');
      w.suspend(false);await delay(45);assert(reports.length===1,'Watchdog did not fire once');
      assert(reports[0].submitted===2&&reports[0].acknowledged===1,'Watchdog changed completion credit');
      return {reports:reports.length,acknowledged:w.acknowledged};
    }finally{w.dispose();}
  });
  const font=diagnosticFont(),view=h('Grid',{rows:'32 *'},h('TextBox',{id:'text',text:'AV 0123'}),h('Button',{row:1,text:'Worker probe'}));
  const expected=compile(view,{fonts:[font]});
  const compare=compiled=>{
    for(const name of ['nodes','state','heap']){
      assert(compiled[name].length===expected[name].length,name+' length differs');
      assert(compiled[name].every((v,i)=>v===expected[name][i]),name+' differs');
    }
    return Object.fromEntries(['nodes','state','heap'].map(name=>[name,expected[name].byteLength]));
  };
  if(includeSourceWorker)await check('Same-origin source module worker compiles identical scene',async()=>{
    const saved=globalThis.__HELION_PREPARE_WORKER_SOURCE__;delete globalThis.__HELION_PREPARE_WORKER_SOURCE__;
    try{const r=await prepareView(view,{fonts:[font]});assert(r.stats.worker,r.stats.workerFallback||'Source worker not used');return compare(r.compiled);}
    finally{if(saved!==undefined)globalThis.__HELION_PREPARE_WORKER_SOURCE__=saved;}
  });
  await check('Embedded classic Blob worker compiles identical scene',async()=>{
    const saved=globalThis.__HELION_PREPARE_WORKER_SOURCE__;globalThis.__HELION_PREPARE_WORKER_SOURCE__=workerSource;
    try{const r=await prepareView(view,{fonts:[font]});assert(r.stats.worker,r.stats.workerFallback||'Embedded worker not used');return compare(r.compiled);}
    finally{if(saved!==undefined)globalThis.__HELION_PREPARE_WORKER_SOURCE__=saved;else delete globalThis.__HELION_PREPARE_WORKER_SOURCE__;}
  });
  await check('Embedded worker cancellation rejects without fallback',async()=>{
    const saved=globalThis.__HELION_PREPARE_WORKER_SOURCE__;globalThis.__HELION_PREPARE_WORKER_SOURCE__=workerSource;
    try{
      const controller=new AbortController();const pending=prepareView(view,{fonts:[font],signal:controller.signal});controller.abort(new Error('Native cancellation probe'));
      let rejected=false;try{await pending;}catch(e){rejected=/Native cancellation probe/.test(e.message);}assert(rejected,'Cancellation did not propagate');return 'Abort propagated';
    }finally{if(saved!==undefined)globalThis.__HELION_PREPARE_WORKER_SOURCE__=saved;else delete globalThis.__HELION_PREPARE_WORKER_SOURCE__;}
  });
  if (typeof globalThis.crypto?.randomUUID !== 'function') result.checks.push({name:'Opaque-origin authoring sandbox',status:'UNVERIFIED',reason:'This isolated document is not a secure context and does not expose crypto.randomUUID. The unchanged sandbox must be checked from localhost/HTTPS.'});
  else await check('Opaque-origin authoring sandbox still returns a view and releases its iframe',async()=>{
    let sandbox,timer;const before=document.querySelectorAll('iframe').length;
    try{
      const events=await new Promise((resolve,reject)=>{
        const received=[];sandbox=new AppSandbox({bundle:authoringSource,timeoutMs:4000,onMessage(type,data){received.push(type);if(type==='error')reject(new Error(data.message));if(type==='executed')resolve(received);}});
        timer=setTimeout(()=>reject(new Error('Sandbox probe deadline')),5000);
        sandbox.run('return Helion.h("TextBlock", { text: "native worker" });');
      });
      assert(events.includes('view'),'No view event');sandbox.stop();assert(document.querySelectorAll('iframe').length===before,'Sandbox iframe leaked');return events;
    }finally{clearTimeout(timer);sandbox?.dispose();}
  });
  result.status=result.checks.some(c=>c.status==='FAIL')?'FAIL':result.checks.some(c=>c.status==='UNVERIFIED')?'PARTIAL':'PASS';return result;
}
