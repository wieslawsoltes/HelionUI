/** Reproducible host numerical experiment. NOT a GPU benchmark or font screenshot. */
import {writeFile} from 'node:fs/promises';
import {lineArea,quadraticArea,quadraticPoints} from '../tests/curve-reference.mjs';
import {polygonPixelCoverage} from '../tests/hud-reference.mjs';
import {seeded} from '../tests/reference.mjs';
const random=seeded(0x513975),report={scope:'Host double-precision area mathematics on original synthetic quadratic contours; not GPU pixels, hinting, font shaping or performance',casesPerSize:160,sizes:[],oracle:'Independent 4096-segment polygon clipping and shoelace pixel area',oldPath:'0.10 font-space flattening rule ceil(sqrt(length(p0-2*p1+p2)/0.003)), capped at 32',newPath:'Root-partitioned quadratic area integration; host mirror of WGSL mathematics'};
const mean=v=>v.reduce((a,b)=>a+b,0)/v.length;
for(const size of [9,12,16,24,48,128,256,512]){
 const oldErrors=[],newErrors=[];
 for(let j=0;j<report.casesPerSize;j++){
  const source=Array.from({length:3},()=>[random()*.9,random()*.9]),t=random(),u=1-t,phase=[random(),random()];
  const at=[0,1].map(k=>(u*u*source[0][k]+2*u*t*source[1][k]+t*t*source[2][k])*size+phase[k]);
  const pixel=at.map(Math.floor),p=source.map(v=>v.map((x,k)=>x*size+phase[k]-pixel[k]));
  const steps=Math.max(1,Math.min(32,Math.ceil(Math.sqrt(Math.hypot(...[0,1].map(k=>source[0][k]-2*source[1][k]+source[2][k]))/.003))));
  const expected=polygonPixelCoverage(quadraticPoints(...p,4096),0,0);
  const old=polygonPixelCoverage(quadraticPoints(...p,steps),0,0),sharp=Math.min(1,Math.abs(quadraticArea(...p)+lineArea(p[2],p[0])));
  oldErrors.push(Math.abs(old-expected));newErrors.push(Math.abs(sharp-expected));
 }
 report.sizes.push({deviceScale:size,cases:oldErrors.length,referenceMaxAreaError:Math.max(...oldErrors),sharpMaxAreaError:Math.max(...newErrors),referenceMeanAreaError:mean(oldErrors),sharpMeanAreaError:mean(newErrors)});
}
report.totalCases=report.sizes.length*report.casesPerSize;
report.maxSharpAreaError=Math.max(...report.sizes.map(s=>s.sharpMaxAreaError));
report.caveat='JavaScript doubles do not prove WGSL f32 rounding, native execution or visual quality. The independent polygon oracle is itself a finite approximation.';
const json=JSON.stringify(report,null,2)+'\n';const file=process.argv.find(x=>x.startsWith('--output='))?.slice(9);if(file)await writeFile(file,json);console.log(json);
if(report.maxSharpAreaError>.0005)process.exitCode=1;
