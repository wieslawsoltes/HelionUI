/** Deadlines bound application waits, not a browser driver's synchronous work. */
export class StartupTimeoutError extends Error {
  constructor(stage, milliseconds) { super(`Helion ${stage} exceeded ${milliseconds / 1000} seconds. The application stopped waiting; native browser/GPU work may still be pending.`);this.name='StartupTimeoutError';this.stage=stage;this.timeoutMs=milliseconds; }
}
export function timeoutOption(value, fallback, name) {
  value ??= fallback;
  if(!Number.isFinite(value)||value<0||value>600000)throw new RangeError(`${name} must be 0–600000 milliseconds (0 disables the deadline)`);
  return value;
}
/** The original promise is always observed, including after cancellation. A late
 * device result is destroyed by the caller's onLate callback instead of leaked. */
export function boundedWait(promise,{signal,timeoutMs=0,stage='operation',onLate}={}) {
  return new Promise((resolve,reject)=>{
    let settled=false,timer=null;
    const cleanup=()=>{if(timer!==null)clearTimeout(timer);signal?.removeEventListener('abort',abort);};
    const fail=error=>{if(settled)return;settled=true;cleanup();reject(error);};
    const abort=()=>fail(signal.reason||new Error(`Helion ${stage} cancelled`));
    if(timeoutMs>0){timer=setTimeout(()=>fail(new StartupTimeoutError(stage,timeoutMs)),timeoutMs);timer.unref?.();}
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    Promise.resolve(promise).then(value=>{if(settled){try{onLate?.(value);}catch{}return;}settled=true;cleanup();resolve(value);},fail);
  });
}
export function startupScope(options={}) {
  const controller=new AbortController();let stage='startup';
  const timeoutMs=timeoutOption(options.startupTimeoutMs,60000,'startupTimeoutMs');
  const abort=()=>controller.abort(options.signal?.reason||new Error('Helion startup cancelled'));
  options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();
  const timer=timeoutMs?setTimeout(()=>controller.abort(new StartupTimeoutError(stage,timeoutMs)),timeoutMs):null;timer?.unref?.();
  return {signal:controller.signal,stage(value){stage=value;},abort(error){controller.abort(error);},dispose(){if(timer!==null)clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}};
}
