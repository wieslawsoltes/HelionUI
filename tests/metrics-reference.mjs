/** Independent BigInt interval-set/double oracle. TEST ONLY, never the live UI path. */
import { packFrameInterval, METRICS_BYTES, timestampMilliseconds } from '../src/gpu/performance.js';
export const f32 = value => Math.fround(value);
export function metricPacket({ flags = 2|4|8|1|256|512, interval = 1000/120, serial = 1, cpuLayout = .012, cpuEncode = .3, raf = 1000/120, reset = false } = {}) {
  const words = new Uint32Array(16), floats = new Float32Array(words.buffer);
  words[6] = serial; words[8] = packFrameInterval(interval);
  words[9] = flags | (reset ? 128 : 0) | (Math.round(raf*256)<<16);
  floats[10] = cpuLayout; floats[11] = cpuEncode;
  return words;
}
export function queryWords(durations = [.01,.02,.01,.05,.02,.1,.03,.06], start = 0x12345678fffffff0n, gapMs = 0) {
  const words = new Uint32Array(32), view = new DataView(words.buffer); let cursor = start;
  for (let i=0;i<8;i++) { view.setBigUint64(i*16,cursor,true); cursor+=BigInt(Math.round(durations[i]*1e6)); view.setBigUint64(i*16+8,cursor,true); if(i<7) cursor+=BigInt(Math.round(gapMs*1e6)); }
  return words;
}
/** This oracle uses a signed endpoint sweep, not the shader's sorted-range merge. */
export function rangeOracle(timestamps, mask) {
  const v=new DataView(timestamps.buffer,timestamps.byteOffset,timestamps.byteLength),points=[];let sum=0n;
  const invalid={valid:false,span:-1,covered:-1,overlap:-1,gaps:-1,sum:-1};
  for(let i=0;i<8;i++)if(mask&(1<<i)) {
    const a=v.getBigUint64(i*16,true),b=v.getBigUint64(i*16+8,true);
    if(b<a||b-a>60000000000n)return invalid;points.push([a,1],[b,-1]);sum+=b-a;
  }
  if(!points.length)return invalid;points.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:b[1]-a[1]);
  const first=points[0][0],last=points.at(-1)[0];if(last-first>60000000000n)return invalid;
  let active=0,covered=0n,previous=first;
  for(const [time,delta]of points){if(active>0)covered+=time-previous;active+=delta;previous=time;}
  const ms=n=>Number(n)/1e6;
  return {valid:true,first,last,span:ms(last-first),covered:ms(covered),overlap:ms(sum-covered),gaps:ms(last-first-covered),sum:ms(sum)};
}
export function applyMetricReference(words, packet, timestamps, layoutExecuted = !!(packet[9]&4)) {
  const pf=new Float32Array(packet.buffer),f=new Float32Array(words.buffer),flags=packet[9],native=!!(flags&2),detailed=!!(flags&512);
  if((flags&128)||words[31]!==3) { words[0]=words[1]=words[19]=0;words[3404]=0; }
  const slot=words[0],count=Math.min(120,words[1]+1),interval=(packet[8]>>>1)/1024;
  const measured=Array.from({length:8},(_,i)=>native&&([true,!!(flags&4),!!(flags&8),detailed||!!(flags&12),detailed&&!!(flags&256),detailed,detailed&&!!(flags&1),true][i]));
  const mask=measured.reduce((a,b,i)=>a|(b?1<<i:0),0);
  const skipped=i=>i===1&&!(flags&4)||i===2&&!(flags&8)||detailed&&(i===4&&!(flags&256)||i===6&&!(flags&1));
  const ms=(a,b)=>timestampMilliseconds(timestamps.subarray(a*2,a*2+2),timestamps.subarray(b*2,b*2+2));
  const phases=Array.from({length:8},(_,i)=>measured[i]?ms(i*2,i*2+1):native&&skipped(i)?0:-1);
  const ranges=rangeOracle(timestamps,mask),compute=rangeOracle(timestamps,mask&127),ui=detailed?rangeOracle(timestamps,mask&56).span:-1;
  let errors=phases.filter((x,i)=>measured[i]&&x<0).length;if(native&&!ranges.valid&&!errors)errors++;
  const total=native?ranges.span:pf[11],layout=native?(layoutExecuted?phases[1]:0):pf[10],data=native?phases[2]:-1;
  const pair=n=>[Number(n&0xffffffffn),Number(n>>32n)];
  const gpuInterval=native&&ranges.valid&&words[3404]?timestampMilliseconds([words[26],words[27]],pair(ranges.last)):-1;
  if(native&&ranges.valid&&words[3404]&&gpuInterval<0)errors++;
  words[3404]=Number(native&&ranges.valid);if(native&&ranges.valid){[words[26],words[27]]=pair(ranges.last);}
  f.set([interval,layout,total,data],32+slot*4);const at=512+slot*24;
  f.set([...phases,pf[11],ui,gpuInterval],at);words[at+11]=packet[6];
  f.set([ranges.covered,ranges.overlap,ranges.gaps],at+12);words[at+15]=mask;words[at+16]=flags&65535;words[at+17]=Number(layoutExecuted);f[at+18]=compute.covered;f[at+19]=ranges.sum;
  let elapsed=0,samples=0,gpuElapsed=0,gpuSamples=0;
  for(let j=0;j<count;j++) { const dt=f[32+((slot+120-j)%120)*4];if(dt<=0||dt>=1000)break;elapsed+=dt;samples++;if(elapsed>=500)break; }
  if(native)for(let j=0;j<count;j++){const dt=f[512+((slot+120-j)%120)*24+10];if(dt<0||dt>=1000)break;gpuElapsed+=dt;gpuSamples++;if(gpuElapsed>=500)break;}
  f[9]=gpuElapsed?gpuSamples*1000/gpuElapsed:0;f[10]=gpuInterval;
  words[0]=(slot+1)%120;words[1]=count;words[2]=Number(native);
  f[3]=elapsed?samples*1000/elapsed:0;f[4]=interval;f[5]=layout;f[6]=total;f[7]=data;f[8]=phases[0];
  f[11]=(flags>>>16)/256;f[12]=f[11]?1000/f[11]:0;words[13]=packet[6];
  f[14]=phases[6];f[15]=phases[7];f[16]=native?total:-1;f[17]=pf[11];
  words[18]=Number(!!(flags&64));words[19]+=errors;f[20]=ui;f[21]=ranges.sum;
  f[22]=phases[3];f[23]=phases[4];f[24]=phases[5];f[25]=pf[10];words[28]=samples;f[29]=elapsed;words[30]=flags&65535;words[31]=3;
  f.set([ranges.covered,ranges.overlap,ranges.gaps,compute.covered],3392);words[3396]=Number(layoutExecuted);words[3397]=Number(detailed);words[3398]=mask;
  for(let i=0;i<32;i++)words[3424+i]=measured[Math.floor(i/4)]?timestamps[i]:0;
  return words;
}
export function emptyMetrics(){return new Uint32Array(METRICS_BYTES/4);}
