/** A host notification watchdog. It never labels callback latency GPU time,
 * performs readback, resubmits, or abandons/acknowledges an unfinished serial. */
export class ProgressWatchdog {
  // Keep native Window/Worker timer receivers: this.schedule(...) must not
  // invoke the Web IDL setTimeout method with a ProgressWatchdog as `this`.
  constructor({timeoutMs=10000,onStall=()=>{},now=()=>performance.now(),schedule=(callback,delay)=>globalThis.setTimeout(callback,delay),cancel=handle=>globalThis.clearTimeout(handle)}={}) {
    if(!Number.isFinite(timeoutMs)||timeoutMs<0||timeoutMs>600000)throw new RangeError('gpuWatchdogMs must be 0–600000');
    Object.assign(this,{timeoutMs,onStall,now,schedule,cancel});this.serial=0;this.acknowledged=0;this.timer=null;this.disposed=false;this.suspended=false;this.fired=false;
  }
  submitted(serial){if(this.disposed)return;this.serial=Math.max(this.serial,serial);this.arm();}
  completed(serial){if(this.disposed||serial<=this.acknowledged)return;this.acknowledged=serial;this.clear();this.arm();}
  arm(){if(!this.timeoutMs||this.disposed||this.suspended||this.fired||this.timer!==null||this.acknowledged>=this.serial)return;
    const started=this.now();this.timer=this.schedule(()=>{this.timer=null;if(this.disposed||this.suspended||this.acknowledged>=this.serial)return;this.fired=true;this.onStall({submitted:this.serial,acknowledged:this.acknowledged,notificationGapMs:this.now()-started});},this.timeoutMs);this.timer?.unref?.();}
  clear(){if(this.timer!==null)this.cancel(this.timer);this.timer=null;}
  suspend(value=true){this.suspended=value;this.clear();if(!value)this.arm();}
  dispose(){this.disposed=true;this.clear();}
}
