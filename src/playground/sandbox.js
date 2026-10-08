/** An authoring worker in an opaque-origin iframe. The editor does not evaluate
 * application source, expose its DOM, or let it supply WGSL. This is local-code
 * isolation, not a certified hostile multi-tenant resource sandbox. */
export const SANDBOX_CSP="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; child-src blob:; connect-src 'none'; img-src 'none'; style-src 'none'; base-uri 'none'; form-action 'none';";
/** The exact worker body is also executed by the Node integration tests. */
export function applicationBootstrap(code){
 return `
const api=globalThis.__HELION_AUTHORING__;
const output=(type,data)=>postMessage({type,...data});
const logger=Object.fromEntries(['log','info','warn','error'].map(level=>[level,(...args)=>output('log',{level,text:args.map(x=>{try{return typeof x==='string'?x:JSON.stringify(x);}catch{return String(x);}}).join(' ').slice(0,4000)})]));
const set=(id,property,value)=>output('set',{id,property,value});
const app=view=>output('view',{view});
app.text=(id,value)=>output('text',{id,value});
app.items=(id,items)=>output('items',{id,items});
for(const type of ['data','model','editor'])app[type]=(id,operation,...args)=>output(type,{id,operation,args});
const handlers=new Set();
app.onAction=handler=>{if(typeof handler!=='function')throw new TypeError('Action handler must be a function');handlers.add(handler);return()=>handlers.delete(handler);};
addEventListener('message',event=>{if(event.data?.type!=='host-action')return;for(const handler of handlers){try{Promise.resolve(handler(event.data.event)).catch(e=>logger.error(String(e)));}catch(e){logger.error(String(e));}}});
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
(async()=>{try{const result=await new AsyncFunction('Helion','app','set','console',${JSON.stringify(code+'\n//# sourceURL=helion/playground-app.js')})(api,app,set,logger);if(result)app(result);output('executed',{});}catch(error){output('error',{message:String(error.stack||error).slice(0,8000)});}})();
`;
}

function frameBootstrap() {
 let worker,channel,run,blob;
 const send=(type,data)=>parent.postMessage({helion:channel,run,type,...data},'*');
 addEventListener('message',event=>{
  if(event.source!==parent)return;const m=event.data;
  if(m.type==='action'){if(m.channel===channel&&m.run===run)worker?.postMessage({type:'host-action',event:m.event});return;}
  if(m.type==='stop'){worker?.terminate();worker=null;if(blob)URL.revokeObjectURL(blob);return;}
  if(m.type!=='start'||typeof m.channel!=='string'||typeof m.bundle!=='string'||typeof m.code!=='string')return;
  channel=m.channel;run=m.run;worker?.terminate();if(blob)URL.revokeObjectURL(blob);
  const bootstrap=applicationBootstrap(m.code);
  blob=URL.createObjectURL(new Blob([m.bundle,bootstrap],{type:'text/javascript'}));worker=new Worker(blob,{name:'Helion isolated application'});
  worker.onmessage=e=>{const d=e.data;if(!d||!['view','set','data','text','items','model','editor','log','error','executed'].includes(d.type))return;send(d.type,{data:d});};
  worker.onerror=e=>send('error',{data:{message:e.message||'Application worker failed'}});send('started',{});
 });
 parent.postMessage({helionSandboxReady:true},'*');
}
export function sandboxDocument() {return `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}"><script>const applicationBootstrap=${applicationBootstrap.toString()};(${frameBootstrap.toString()})()<\/script>`;}
export class AppSandbox {
 constructor({bundle,onMessage,timeoutMs=8000}={}){if(typeof bundle!=='string')throw new TypeError('Authoring bundle required');this.bundle=bundle;this.onMessage=onMessage;this.timeoutMs=timeoutMs;this.runId=0;}
 run(code){this.stop();if(typeof code!=='string'||code.length>256000)throw new RangeError('App source is limited to 256K characters');
  const run=++this.runId;const channel=crypto.randomUUID();this.channel=channel;const frame=document.createElement('iframe');frame.hidden=true;frame.setAttribute('sandbox','allow-scripts');frame.srcdoc=sandboxDocument();this.frame=frame;
  this.listener=event=>{if(event.source!==frame.contentWindow)return;const message=event.data;
   if(message?.helionSandboxReady){frame.contentWindow.postMessage({type:'start',channel,run,bundle:this.bundle,code},'*');return;}
   if(message?.helion!==channel||message.run!==run)return;
   if(['view','executed','error'].includes(message.type)){clearTimeout(this.timer);this.timer=null;}
   this.onMessage?.(message.type,message.data||{});
  };addEventListener('message',this.listener);document.body.append(frame);
  this.timer=setTimeout(()=>{this.stop();this.onMessage?.('error',{message:'Application startup exceeded the time limit. Its worker was terminated.'});},this.timeoutMs);
 }
 dispatchAction(event){this.frame?.contentWindow?.postMessage({type:'action',channel:this.channel,run:this.runId,event},'*');}
 stop(){clearTimeout(this.timer);this.timer=null;if(this.listener)removeEventListener('message',this.listener);this.listener=null;this.frame?.contentWindow?.postMessage({type:'stop'},'*');this.frame?.remove();this.frame=null;}
 dispose(){this.stop();}
}
/** Validate the transfer before any host GPU allocation. No arbitrary object hooks. */
export function validatePlaygroundView(view,{maxNodes=512,maxDepth=24}={}) {
 let count=0;const walk=(v,depth)=>{if(depth>maxDepth||++count>maxNodes)throw new RangeError('Playground scene limits exceeded');if(!v||typeof v.type!=='string'||!v.props||typeof v.props!=='object'||!Array.isArray(v.children))throw new TypeError('App must return a Helion view');
  for(const c of v.children)walk(c,depth+1);
 };walk(view,0);return view;
}
