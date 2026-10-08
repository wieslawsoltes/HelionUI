import {readFile}from'node:fs/promises';
import {parseOpenType}from'../src/text/opentype.js';
import {prepareTypography}from'../src/typography/pack.js';
import {scalarTypography}from'./typography-kernel-host.mjs';
const font=parseOpenType(await readFile('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'));
for(const text of ['office AVATAR','مرحبا بالعالم','Hello world and AVATAR.','abc אבג 123','hello\nworld\n','A\r\nB','']){
 const a=prepareTypography([font],[{text,width:120,fontSize:18}]);const c=scalarTypography(a);c.shape();const r=a.runs[0].pointer;c.run.layoutRun(r);const h=c.heap,f=new Float32Array(h.buffer),p=h[r+50];console.log(JSON.stringify({text,valid:h[p+17],lines:h[p+13],size:[f[p+14],f[p+15]],glyphCount:h[r+7],err:h[r+18]}));
}
