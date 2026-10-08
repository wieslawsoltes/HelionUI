// Schema 3. Pass ranges may overlap on the GPU timeline. They are not busy counters.
// The HUD displays the PREVIOUS submitted sample, with raw timestamp/frame provenance.
struct MetricFrame { viewport:vec4<f32>, counts:vec4<u32>, flags:vec4<u32>, screen:vec4<u32> }
@group(0) @binding(0) var<uniform> metricFrame:MetricFrame;
@group(0) @binding(1) var<storage,read> timestamps:array<vec2<u32>>;
@group(0) @binding(2) var<storage,read_write> metrics:array<u32>;
@group(0) @binding(3) var<storage,read> metricState:array<u32>;
const METRIC_EXTRA:u32=3392u;
const METRIC_RAW:u32=3424u;
fn timestampBefore(a:vec2<u32>,b:vec2<u32>)->bool { return a.y<b.y || (a.y==b.y && a.x<b.x); }
fn timestampDelta(a:vec2<u32>,b:vec2<u32>)->f32 {
 if(timestampBefore(b,a)) { return -1.0; }
 let low=b.x-a.x; let borrow=select(0u,1u,b.x<a.x); let high=b.y-a.y-borrow;
 if(high>13u) { return -1.0; }
 let ms=(f32(low)+f32(high)*4294967296.0)*0.000001;
 if(ms>60000.0) { return -1.0; } return ms;
}
fn milliseconds(first:u32,last:u32)->f32 { return timestampDelta(timestamps[first],timestamps[last]); }
fn measuredMask(flags:u32)->u32 {
 if((flags&2u)==0u) { return 0u; }
 var mask=129u;
 if((flags&4u)!=0u) { mask|=2u; } if((flags&8u)!=0u) { mask|=4u; }
 if((flags&512u)!=0u) {
  mask|=40u; if((flags&256u)!=0u) { mask|=16u; } if((flags&1u)!=0u) { mask|=64u; }
 } else if((flags&12u)!=0u) { mask|=8u; }
 return mask;
}
struct TimeRange { first:vec2<u32>, last:vec2<u32>, span:f32, covered:f32, overlap:f32, gaps:f32, sum:f32, valid:u32 }
fn rangeSummary(mask:u32)->TimeRange {
 var result=TimeRange(vec2<u32>(0u),vec2<u32>(0u),-1.0,-1.0,-1.0,-1.0,-1.0,0u);
 if(mask==0u) { return result; }
 var order:array<u32,8>; var count=0u; var sum=0.0;
 for(var i=0u;i<8u;i++) { if((mask&(1u<<i))==0u) { continue; }
  let duration=milliseconds(i*2u,i*2u+1u); if(duration<0.0) { return result; } sum+=duration;
  var j=count; // Sort exact u64 timestamps before subtracting; no large-float clock conversion.
  while(j>0u) { if(!timestampBefore(timestamps[i*2u],timestamps[order[j-1u]*2u])) { break; } order[j]=order[j-1u]; j--; }
  order[j]=i; count++;
 }
 result.first=timestamps[order[0]*2u]; var tail=result.first; var covered=0.0;
 for(var j=0u;j<count;j++) {
  let start=timestamps[order[j]*2u]; let end=timestamps[order[j]*2u+1u]; var uncovered=tail;
  if(timestampBefore(tail,start)) { uncovered=start; }
  if(timestampBefore(uncovered,end)) { covered+=timestampDelta(uncovered,end); }
  if(timestampBefore(tail,end)) { tail=end; }
 }
 let span=timestampDelta(result.first,tail); if(span<0.0) { return result; }
 result.last=tail; result.span=span; result.covered=covered; result.sum=sum;
 result.overlap=max(0.0,sum-covered); result.gaps=max(0.0,span-covered); result.valid=1u; return result;
}
@compute @workgroup_size(1)
fn recordMetrics() {
 let flags=metricFrame.flags.y; let gpu=(flags&2u)!=0u; let detailed=(flags&512u)!=0u;
 let reset=(flags&128u)!=0u || metrics[31]!=3u;
 if(reset) { metrics[0]=0u; metrics[1]=0u; metrics[19]=0u; metrics[METRIC_EXTRA+12u]=0u; }
 let slot=metrics[0]; let count=min(120u,metrics[1]+1u);
 let interval=f32(metricFrame.flags.x>>1u)/1024.0; let cpuLayout=bitcast<f32>(metricFrame.flags.z); let cpuEncode=bitcast<f32>(metricFrame.flags.w);
 let mask=measuredMask(flags); var phases:array<f32,8>; var errors=0u;
 for(var phase=0u;phase<8u;phase++) {
  phases[phase]=-1.0;
  if((mask&(1u<<phase))!=0u) { phases[phase]=milliseconds(phase*2u,phase*2u+1u); if(phases[phase]<0.0) { errors++; } }
  else if(gpu && ((phase==1u && (flags&4u)==0u) || (phase==2u && (flags&8u)==0u) || (detailed && ((phase==4u && (flags&256u)==0u) || (phase==6u && (flags&1u)==0u))))) { phases[phase]=0.0; }
 }
 let ranges=rangeSummary(mask); let compute=rangeSummary(mask&127u); var ui=-1.0;
 if(detailed) { ui=rangeSummary(mask&56u).span; }
 var total=cpuEncode; var layoutMs=cpuLayout; var query=-1.0; let layoutExecuted=metricState[58]!=0u;
 if(gpu) {
  total=ranges.span; layoutMs=select(0.0,phases[1],layoutExecuted); query=phases[2];
  if(ranges.valid==0u && errors==0u) { errors++; }
 }
 var gpuInterval=-1.0;
 if(gpu && ranges.valid!=0u && metrics[METRIC_EXTRA+12u]!=0u) {
  gpuInterval=timestampDelta(vec2<u32>(metrics[26],metrics[27]),ranges.last); if(gpuInterval<0.0) { errors++; }
 }
 metrics[METRIC_EXTRA+12u]=select(0u,1u,gpu && ranges.valid!=0u);
 if(gpu && ranges.valid!=0u) { metrics[26]=ranges.last.x; metrics[27]=ranges.last.y; }
 let at=32u+slot*4u; metrics[at]=bitcast<u32>(interval); metrics[at+1u]=bitcast<u32>(layoutMs); metrics[at+2u]=bitcast<u32>(total); metrics[at+3u]=bitcast<u32>(query);
 let detail=512u+slot*24u;
 for(var phase=0u;phase<8u;phase++) { metrics[detail+phase]=bitcast<u32>(phases[phase]); }
 metrics[detail+8u]=bitcast<u32>(cpuEncode); metrics[detail+9u]=bitcast<u32>(ui); metrics[detail+10u]=bitcast<u32>(gpuInterval); metrics[detail+11u]=metricFrame.counts.z;
 metrics[detail+12u]=bitcast<u32>(ranges.covered); metrics[detail+13u]=bitcast<u32>(ranges.overlap); metrics[detail+14u]=bitcast<u32>(ranges.gaps); metrics[detail+15u]=mask;
 metrics[detail+16u]=flags&65535u; metrics[detail+17u]=select(0u,1u,layoutExecuted); metrics[detail+18u]=bitcast<u32>(compute.covered); metrics[detail+19u]=bitcast<u32>(ranges.sum);
 var elapsed=0.0; var samples=0u; var gpuElapsed=0.0; var gpuSamples=0u;
 for(var j=0u;j<count;j++) { let dt=bitcast<f32>(metrics[32u+((slot+120u-j)%120u)*4u]); if(dt<=0.0 || dt>=1000.0) { break; } elapsed+=dt; samples++; if(elapsed>=500.0) { break; } }
 if(gpu) { for(var j=0u;j<count;j++) { let dt=bitcast<f32>(metrics[512u+((slot+120u-j)%120u)*24u+10u]); if(dt<0.0 || dt>=1000.0) { break; } gpuElapsed+=dt; gpuSamples++; if(gpuElapsed>=500.0) { break; } } }
 metrics[9]=bitcast<u32>(select(0.0,f32(gpuSamples)*1000.0/max(0.000001,gpuElapsed),gpuElapsed>0.0)); metrics[10]=bitcast<u32>(gpuInterval);
 metrics[0]=(slot+1u)%120u; metrics[1]=count; metrics[2]=select(0u,1u,gpu);
 metrics[3]=bitcast<u32>(select(0.0,f32(samples)*1000.0/max(0.000001,elapsed),elapsed>0.0));
 metrics[4]=bitcast<u32>(interval); metrics[5]=bitcast<u32>(layoutMs); metrics[6]=bitcast<u32>(total); metrics[7]=bitcast<u32>(query); metrics[8]=bitcast<u32>(phases[0]);
 let rafMs=f32(flags>>16u)/256.0; metrics[11]=bitcast<u32>(rafMs); metrics[12]=bitcast<u32>(select(0.0,1000.0/max(0.0001,rafMs),rafMs>0.0)); metrics[13]=metricFrame.counts.z;
 metrics[14]=bitcast<u32>(phases[6]); metrics[15]=bitcast<u32>(phases[7]); metrics[16]=bitcast<u32>(select(-1.0,total,gpu)); metrics[17]=bitcast<u32>(cpuEncode);
 metrics[18]=select(0u,1u,(flags&64u)!=0u); metrics[19]+=errors; metrics[20]=bitcast<u32>(ui); metrics[21]=bitcast<u32>(ranges.sum);
 metrics[22]=bitcast<u32>(phases[3]); metrics[23]=bitcast<u32>(phases[4]); metrics[24]=bitcast<u32>(phases[5]); metrics[25]=bitcast<u32>(cpuLayout); metrics[28]=samples; metrics[29]=bitcast<u32>(elapsed); metrics[30]=flags&65535u; metrics[31]=3u;
 metrics[METRIC_EXTRA]=bitcast<u32>(ranges.covered); metrics[METRIC_EXTRA+1u]=bitcast<u32>(ranges.overlap); metrics[METRIC_EXTRA+2u]=bitcast<u32>(ranges.gaps); metrics[METRIC_EXTRA+3u]=bitcast<u32>(compute.covered);
 metrics[METRIC_EXTRA+4u]=select(0u,1u,layoutExecuted); metrics[METRIC_EXTRA+5u]=select(0u,1u,detailed); metrics[METRIC_EXTRA+6u]=mask;
 for(var i=0u;i<16u;i++) { var value=vec2<u32>(0u); if((mask&(1u<<(i/2u)))!=0u) { value=timestamps[i]; } metrics[METRIC_RAW+i*2u]=value.x; metrics[METRIC_RAW+i*2u+1u]=value.y; }
}
