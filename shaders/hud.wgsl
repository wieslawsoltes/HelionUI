// Two small compute entries. Neither maps buffers or uploads strings each frame.
@group(0) @binding(0) var<uniform> hudFrame:HudFrame;
@group(0) @binding(1) var<storage,read> hudHeap:array<u32>;
@group(0) @binding(2) var<storage,read> surfaceState:array<u32>;
@group(0) @binding(3) var<storage,read_write> hudFont:array<u32>;
@group(0) @binding(4) var<storage,read> history:array<u32>;
@group(0) @binding(5) var<storage,read_write> hudData:array<u32>;

// Executed only on first display or changed effective HUD pixel scale.
// One disjoint workgroup per glyph/size. No atomics, locks or shared UI-cache pressure.
@compute @workgroup_size(64)
fn rasterHudFont(@builtin(workgroup_id) group:vec3<u32>,@builtin(local_invocation_index) lane:u32) {
 let index=group.x; if(index>=HUD_GLYPHS) { return; }
 let code=32u+index%HUD_CHARACTERS; let kind=index/HUD_CHARACTERS; let face=surfaceState[32];
 let record=hudHeap[face+4u]+hudGlyphId(code)*4u; let path=hudHeap[record]; let em=hudSize(kind)*hudRatio();
 var origin=vec2<f32>(0.0); var extent=vec2<f32>(0.0);
 if(path!=0u) {
  let margin=1.0+hudFloat(path+5u)*em*0.5;
  origin=floor(vec2<f32>(hudFloat(path+6u),hudFloat(path+7u))*em-vec2<f32>(margin));
  extent=ceil(vec2<f32>(hudFloat(path+8u),hudFloat(path+9u))*em+vec2<f32>(margin))-origin;
 }
 // All 95x95 ASCII kerning pairs are independent. Only the small-size bank
 // populates the table; the following dispatch observes the complete result.
 if(kind==0u) { for(var right=lane;right<HUD_CHARACTERS;right+=64u) {
  hudFont[HUD_PAIR_TABLE+(code-32u)*HUD_CHARACTERS+right]=bitcast<u32>(hudPairFromFont(code,32u+right));
 } }
 let cached=path!=0u && all(extent<=vec2<f32>(64.0)) && all(extent>vec2<f32>(0.0)); let at=hudFontRecord(index);
 if(lane==0u) {
  hudFont[at]=path; hudFont[at+1u]=bitcast<u32>(em); hudFont[at+2u]=bitcast<u32>(hudFloat(record+1u)*em);
  hudFont[at+3u]=bitcast<u32>(origin.x); hudFont[at+4u]=bitcast<u32>(origin.y);
  hudFont[at+5u]=u32(extent.x); hudFont[at+6u]=u32(extent.y); hudFont[at+7u]=select(0u,1u,cached);
  if(index==0u) { hudFont[0]=bitcast<u32>(hudRatio()); hudFont[1]+=1u; }
 }
 if(!cached) { return; } // Large glyphs use direct coverage in the HUD compute compositor; never clipped/substituted.
 let words=(u32(extent.x)+3u)/4u;
 for(var word=lane;word<words*u32(extent.y);word+=64u) {
  let y=word/words; let x=(word%words)*4u; var packed=0u;
  for(var k=0u;k<4u;k++) { if(x+k<u32(extent.x)) {
   packed|=u32(round(hudOutlineCoverage(path,em,origin+vec2<f32>(f32(x+k),f32(y)))*255.0))<<(k*8u);
  } }
  hudFont[HUD_FONT_PIXELS+index*1024u+y*16u+x/4u]=packed;
 }
}

fn hudPut(code:u32,kind:u32,baseline:vec2<f32>,color:u32) {
 if(code==32u) { return; }
 let id=hudData[0]; if(id>=HUD_MAX_ITEMS) { hudData[1]|=1u; return; }
 let index=hudFontIndex(code,kind); let recordAt=hudFontRecord(index);
 if(hudFont[recordAt]==0u || hudFont[recordAt+5u]==0u || hudFont[recordAt+6u]==0u) { return; }
 let ratio=hudRatio(); var origin=baseline+vec2<f32>(hudFontFloat(recordAt+3u),hudFontFloat(recordAt+4u))/ratio;
 if((hudFrame.flags.y&16384u)==0u) {
  let panel=hudOrigin()*hudFrame.viewport.z;
  origin=(round(panel+origin*ratio)-panel)/ratio;
 }
 let size=vec2<f32>(f32(hudFont[recordAt+5u]),f32(hudFont[recordAt+6u]))/ratio;
 let at=HUD_ITEMS+id*8u; hudData[0]=id+1u;
 hudData[at]=bitcast<u32>(origin.x); hudData[at+1u]=bitcast<u32>(origin.y);
 hudData[at+2u]=bitcast<u32>(size.x); hudData[at+3u]=bitcast<u32>(size.y); hudData[at+4u]=index; hudData[at+5u]=color;
 let lo=vec2<u32>(clamp(floor(origin/16.0),vec2<f32>(0.0),vec2<f32>(26.0,21.0)));
 let hi=vec2<u32>(clamp(floor((origin+size)/16.0),vec2<f32>(0.0),vec2<f32>(26.0,21.0)));
 for(var y=lo.y;y<=hi.y;y++) { for(var x=lo.x;x<=hi.x;x++) {
  let bin=y*HUD_BIN_COLS+x; let count=hudData[HUD_BIN_COUNTS+bin];
  if(count<HUD_BIN_CAPACITY) { hudData[HUD_BIN_LIST+bin*HUD_BIN_CAPACITY+count]=id; hudData[HUD_BIN_COUNTS+bin]=count+1u; }
  else { hudData[1]|=2u; } // Presenter scans the complete bounded list instead of dropping text.
 } }
}

// Immutable diagnostic vocabulary; font geometry is never embedded here.
// 0: Performance
// 1: GPU frame ranges
// 2: CPU encode timings
// 3: Submit FPS
// 4: rAF Hz
// 5: Interval / ms
// 6: Layout / ms
// 7: GPU span / ms
// 8: 120 samples / 0-50 ms
// 9: rAF step
// 10: ms
// 11: Previous sample
// 12: Not scanout
// 13: Data
// 14: N/A
// 15: Warming up
// 16: 9999+
// 17: CPU encode
// 18: Covered
// 19: Host / ms
// 20: Compute
// 21: Overlap
// 22: Present
// 23: Gaps
// 24: Vsync / every rAF
// 25: ASAP / bounded
// 26: Timing error
// 27: GPU end Hz
// 28: Idle
// 29: GPU stage ranges
// 30: Vsync / paced
const HUD_LABELS:array<u32,314> =array<u32,314>(80u,101u,114u,102u,111u,114u,109u,97u,110u,99u,101u,71u,80u,85u,32u,102u,114u,97u,109u,101u,32u,114u,97u,110u,103u,101u,115u,67u,80u,85u,32u,101u,110u,99u,111u,100u,101u,32u,116u,105u,109u,105u,110u,103u,115u,83u,117u,98u,109u,105u,116u,32u,70u,80u,83u,114u,65u,70u,32u,72u,122u,73u,110u,116u,101u,114u,118u,97u,108u,32u,47u,32u,109u,115u,76u,97u,121u,111u,117u,116u,32u,47u,32u,109u,115u,71u,80u,85u,32u,115u,112u,97u,110u,32u,47u,32u,109u,115u,49u,50u,48u,32u,115u,97u,109u,112u,108u,101u,115u,32u,47u,32u,48u,45u,53u,48u,32u,109u,115u,114u,65u,70u,32u,115u,116u,101u,112u,109u,115u,80u,114u,101u,118u,105u,111u,117u,115u,32u,115u,97u,109u,112u,108u,101u,78u,111u,116u,32u,115u,99u,97u,110u,111u,117u,116u,68u,97u,116u,97u,78u,47u,65u,87u,97u,114u,109u,105u,110u,103u,32u,117u,112u,57u,57u,57u,57u,43u,67u,80u,85u,32u,101u,110u,99u,111u,100u,101u,67u,111u,118u,101u,114u,101u,100u,72u,111u,115u,116u,32u,47u,32u,109u,115u,67u,111u,109u,112u,117u,116u,101u,79u,118u,101u,114u,108u,97u,112u,80u,114u,101u,115u,101u,110u,116u,71u,97u,112u,115u,86u,115u,121u,110u,99u,32u,47u,32u,101u,118u,101u,114u,121u,32u,114u,65u,70u,65u,83u,65u,80u,32u,47u,32u,98u,111u,117u,110u,100u,101u,100u,84u,105u,109u,105u,110u,103u,32u,101u,114u,114u,111u,114u,71u,80u,85u,32u,101u,110u,100u,32u,72u,122u,73u,100u,108u,101u,71u,80u,85u,32u,115u,116u,97u,103u,101u,32u,114u,97u,110u,103u,101u,115u,86u,115u,121u,110u,99u,32u,47u,32u,112u,97u,99u,101u,100u);
const HUD_LABEL_RANGES:array<vec2<u32>,31> =array<vec2<u32>,31>(vec2<u32>(0u,11u),vec2<u32>(11u,16u),vec2<u32>(27u,18u),vec2<u32>(45u,10u),vec2<u32>(55u,6u),vec2<u32>(61u,13u),vec2<u32>(74u,11u),vec2<u32>(85u,13u),vec2<u32>(98u,21u),vec2<u32>(119u,8u),vec2<u32>(127u,2u),vec2<u32>(129u,15u),vec2<u32>(144u,11u),vec2<u32>(155u,4u),vec2<u32>(159u,3u),vec2<u32>(162u,10u),vec2<u32>(172u,5u),vec2<u32>(177u,10u),vec2<u32>(187u,7u),vec2<u32>(194u,9u),vec2<u32>(203u,7u),vec2<u32>(210u,7u),vec2<u32>(217u,7u),vec2<u32>(224u,4u),vec2<u32>(228u,17u),vec2<u32>(245u,14u),vec2<u32>(259u,12u),vec2<u32>(271u,10u),vec2<u32>(281u,4u),vec2<u32>(285u,16u),vec2<u32>(301u,13u));

fn hudLabelWidth(label:u32)->f32 {
 let range=HUD_LABEL_RANGES[label]; var width=0.0;
 for(var j=0u;j<range.y;j++) { let code=HUD_LABELS[range.x+j]; width+=hudAdvance(code,0u);
  if(j+1u<range.y) { width+=hudPair(code,HUD_LABELS[range.x+j+1u])*12.0; }
 } return width;
}
fn hudLabel(label:u32,baseline:vec2<f32>,color:u32) {
 let range=HUD_LABEL_RANGES[label]; var x=baseline.x;
 for(var j=0u;j<range.y;j++) { let code=HUD_LABELS[range.x+j]; hudPut(code,0u,vec2<f32>(x,baseline.y),color); x+=hudAdvance(code,0u);
  if(j+1u<range.y) { x+=hudPair(code,HUD_LABELS[range.x+j+1u])*12.0; }
 }
}
fn hudLabelRight(label:u32,end:vec2<f32>,color:u32) { hudLabel(label,end-vec2<f32>(hudLabelWidth(label),0.0),color); }
fn hudFixed(value:f32,kind:u32,baseline:vec2<f32>,color:u32,decimalPlaces:u32)->f32 {
 if(!(value>=0.0) || value>1e9) { hudLabel(14u,baseline,1u); return hudLabelWidth(14u); }
 if(value>=10000.0) { hudLabel(16u,baseline,color); return hudLabelWidth(16u); }
 // A digit cell uses the widest real digit advance; punctuation keeps its own advance.
 // This gives tabular, stable counters even with a proportional user-loaded font.
 var cell=0.0; for(var j=48u;j<=57u;j++) { cell=max(cell,hudAdvance(j,kind)); }
 var power=1u; for(var j=0u;j<decimalPlaces;j++) { power*=10u; }
 let rounded=u32(round(value*f32(power))); var integer=rounded/power;
 // Carry and range are checked AFTER rounding (9999.95 must not wrap a digit).
 if(integer>9999u) { hudLabel(16u,baseline,color); return hudLabelWidth(16u); }
 var divisor=1000u; while(divisor>1u && integer<divisor) { divisor/=10u; }
 var x=baseline.x;
 loop {
  let code=48u+integer/divisor; hudPut(code,kind,vec2<f32>(x+(cell-hudAdvance(code,kind))*0.5,baseline.y),color);
  x+=cell; integer%=divisor; if(divisor==1u) { break; } divisor/=10u;
 }
 if(decimalPlaces>0u) {
  hudPut(46u,kind,vec2<f32>(x,baseline.y),color); x+=hudAdvance(46u,kind);
  var remainder=rounded%power; var divisor=power/10u;
  for(var j=0u;j<decimalPlaces;j++) {
   let code=48u+remainder/divisor; hudPut(code,kind,vec2<f32>(x+(cell-hudAdvance(code,kind))*0.5,baseline.y),color);
   x+=cell; remainder%=divisor; divisor=max(1u,divisor/10u);
  }
 }
 return x-baseline.x;
}
fn hudNumeric(value:f32,kind:u32,baseline:vec2<f32>,color:u32,decimal:bool)->f32 {
 return hudFixed(value,kind,baseline,color,select(0u,1u,decimal));
}
fn hudMetric(label:u32,word:u32,x:f32,numberX:f32,y:f32) {
 hudLabel(label,vec2<f32>(x,y),1u);
 if(history[1]>0u) { hudFixed(bitcast<f32>(history[word]),0u,vec2<f32>(numberX,y),0u,3u); }
 else { hudLabel(14u,vec2<f32>(numberX,y),1u); }
}
@compute @workgroup_size(1)
fn buildHudText() {
 hudData[0]=0u; hudData[1]=0u;
 for(var bin=0u;bin<HUD_BIN_COLS*HUD_BIN_ROWS;bin++) { hudData[HUD_BIN_COUNTS+bin]=0u; }
 let size=min(history[1],120u); let native=history[2]!=0u; let budget=bitcast<f32>(history[11]);
 hudLabel(0u,vec2<f32>(20.0,23.0),0u); hudLabelRight(select(2u,select(1u,29u,history[3397u]!=0u),native),vec2<f32>(400.0,23.0),2u);
 hudLabel(3u,vec2<f32>(20.0,56.0),1u); hudLabel(4u,vec2<f32>(152.0,56.0),1u);
 if(history[28]>0u) { hudNumeric(bitcast<f32>(history[3]),1u,vec2<f32>(20.0,87.0),0u,false); }
 else { hudLabel(15u,vec2<f32>(20.0,84.0),1u); }
 if(budget>0.0) { hudNumeric(bitcast<f32>(history[12]),1u,vec2<f32>(152.0,87.0),0u,false); }
 else { hudLabel(14u,vec2<f32>(152.0,84.0),1u); }
 hudLabel(27u,vec2<f32>(284.0,56.0),1u);
 if(native && bitcast<f32>(history[9])>0.0) { hudNumeric(bitcast<f32>(history[9]),1u,vec2<f32>(284.0,87.0),0u,false); }
 else { hudLabel(14u,vec2<f32>(284.0,84.0),1u); }
 for(var series=0u;series<3u;series++) {
  let x=16.0+f32(series)*132.0; var label=5u+series;
  if(series==2u && !native) { label=19u; }
  hudLabel(label,vec2<f32>(x+10.0,126.0),series+2u);
  let value=bitcast<f32>(history[4u+series]);
  if(size>0u && native && series==1u && history[3396u]==0u) { hudLabel(28u,vec2<f32>(x+10.0,151.0),1u); }
  else if(size>0u && (series!=0u || value>0.0)) { hudFixed(value,1u,vec2<f32>(x+10.0,157.0),0u,2u); }
  else { hudLabel(14u,vec2<f32>(x+10.0,151.0),1u); }
 }
 hudLabel(8u,vec2<f32>(20.0,237.0),1u); hudLabel(9u,vec2<f32>(246.0,237.0),1u);
 if(budget>0.0) { let width=hudNumeric(budget,0u,vec2<f32>(317.0,237.0),0u,true); hudLabel(10u,vec2<f32>(322.0+width,237.0),1u); }
 else { hudLabel(14u,vec2<f32>(320.0,237.0),1u); }
 // Elapsed ranges are not additive GPU busy times. Covered is interval union.
 hudMetric(17u,17u,20.0,95.0,257.0); hudMetric(18u,3392u,222.0,282.0,257.0);
 hudMetric(20u,3395u,20.0,81.0,277.0); hudMetric(22u,15u,222.0,278.0,277.0);
 hudMetric(21u,3393u,20.0,77.0,297.0); hudMetric(13u,7u,151.0,187.0,297.0);
 if(native && size>0u && history[19]>0u) { hudLabel(26u,vec2<f32>(284.0,297.0),5u); }
 hudLabel(select(select(24u,30u,(history[30]&4096u)!=0u),25u,history[18]!=0u),vec2<f32>(20.0,321.0),2u);
 hudLabelRight(11u,vec2<f32>(400.0,321.0),1u);
 if(history[19]==0u) { hudLabelRight(12u,vec2<f32>(400.0,297.0),1u); }
}
