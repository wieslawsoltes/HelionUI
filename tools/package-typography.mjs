/** Build the independent typography module from the same sources as Helion UI.
 * No font binaries, UI renderer or external runtime packages are copied.
 */
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const out=resolve(process.argv.find(x=>x.startsWith('--out='))?.slice(6)||resolve(root,'dist/typography-module'));
if(out===root||!relative(out,root).startsWith('..'))throw new Error('Output may not contain the framework source');
await mkdir(out,{recursive:true});
const files=[
 'src/typography/index.js','src/typography/index.d.ts','src/typography/pack.js',
 'src/typography/gpu.js','src/typography/opentype.js','src/typography/schema.js',
 'src/typography/unicode-data.js','src/typography/layout.js','src/typography/declaration.js',
 'src/typography/UNICODE-LICENSE.txt','src/text/opentype.js',
 'shaders/unicode.wgsl','shaders/shaping.wgsl','shaders/shaping-bidi.wgsl','shaders/paragraph.wgsl',
 'LICENSE','docs/HARFBUZZ-REFERENCE-NOTICE.txt','docs/TYPOGRAPHY.md',
 'tests/font-fixture.mjs'
];
for(const file of files){const to=resolve(out,file);await mkdir(dirname(to),{recursive:true});await copyFile(resolve(root,file),to);}
const FROM='fr'+'om';
await writeFile(resolve(out,'index.js'),`export * ${FROM} './src/typography/index.js';\nexport {loadFont,parseOpenType,decodeWOFF,FontFormatError} ${FROM} './src/text/opentype.js';\n`);
await writeFile(resolve(out,'index.d.ts'),`export * ${FROM} './src/typography/index.js';
export interface FontOptions {family?:string;weight?:number;style?:'normal'|'italic';collectionIndex?:number;maxBytes?:number;maxPoints?:number;timeoutMs?:number;signal?:AbortSignal;}
export interface PreparedFont {family:string;weight:number;style:string;glyphs:readonly unknown[];cmap:Map<number,number>;ascent:number;descent:number;lineGap:number;sourceUnits:number;warnings:string[];}
export class FontFormatError extends Error {}
export function parseOpenType(data:ArrayBuffer|ArrayBufferView,options?:FontOptions):PreparedFont;
export function loadFont(source:string|URL|Blob|ArrayBuffer|ArrayBufferView,options?:FontOptions):Promise<PreparedFont>;
export function decodeWOFF(data:ArrayBuffer|ArrayBufferView):Promise<Uint8Array>;
`);
const version=JSON.parse(await readFile(resolve(root,'package.json'),'utf8')).version;
await writeFile(resolve(out,'package.json'),JSON.stringify({name:'@helion/typography',version,private:true,type:'module',description:'Retained WebGPU OpenType shaping and bidi paragraph layout; experimental',exports:{'.':{types:'./index.d.ts',import:'./index.js'}},types:'./index.d.ts',scripts:{test:'node --test tests/module.test.mjs'},engines:{node:'>=20'},license:'MIT'},null,2)+'\n');
await writeFile(resolve(out,'tests/module.test.mjs'),`import test ${FROM} 'node:test';
import assert ${FROM} 'node:assert/strict';
import {readFile} ${FROM} 'node:fs/promises';
import {prepareTypography,parseOpenType,normalizeParagraph,GpuTypography,typographyShaderSource,typographyReadbackPlan,SHAPING_ABI} ${FROM} '../index.js';
import {makeTestFont} ${FROM} './font-fixture.mjs';
test('independent preparation has no UI runtime dependency',()=>{const font=parseOpenType(makeTestFont());const prepared=prepareTypography([font],[{text:'AV fi',width:200,fontSize:20,inputCapacity:32,capacity:96}]);assert.equal(prepared.version,SHAPING_ABI);assert.equal(prepared.runs.length,1);assert.equal(prepared.runs[0].paragraph.width,200);assert.ok(prepared.heap.byteLength>0);assert.ok(typographyReadbackPlan(prepared.runs[0]).bytes<prepared.heap.byteLength);assert.equal(typeof GpuTypography.create,'function');});
test('invalid text and dimensions reject',()=>{assert.throws(()=>prepareTypography([parseOpenType(makeTestFont())],[{text:'\\ud800'}]));assert.throws(()=>normalizeParagraph({width:-1}));});
test('all standalone shader sources assemble',async()=>{globalThis.__HELION_SHADERS__={};try{for(const name of ['unicode','shaping','shaping-bidi','paragraph'])globalThis.__HELION_SHADERS__[name]=await readFile(new URL('../shaders/'+name+'.wgsl',import.meta.url),'utf8');const source=await typographyShaderSource();assert.match(source,/fn shapeRuns/);assert.match(source,/fn layoutRuns/);assert.doesNotMatch(source,/var<.*> nodes:/);}finally{delete globalThis.__HELION_SHADERS__;}});
`);
await writeFile(resolve(out,'tests/module-api.ts'),`import {loadFont,prepareTypography,GpuTypography,normalizeParagraph,ShapedText} ${FROM} '../index.js';
async function mount(device:unknown,encoder:unknown){const face=await loadFont(new URL('http://localhost/font.ttf'),{family:'Local'});const data=prepareTypography([face],[{text:'office',features:{liga:1},width:220,flowDirection:'auto'}]);const engine=await GpuTypography.create(device,data);engine.updateLayout(0,{textAlignment:'end'}).setDirection(0,'rtl').encode(encoder);const result=await engine.snapshot();result.paragraph?.carets[0].leading;engine.dispose();}void mount;normalizeParagraph({wrap:'character'});ShapedText({text:'A'});
`);
await writeFile(resolve(out,'README.md'),`# @helion/typography — ${version}

Independent experimental compute shaper and paragraph-layout library. It does not
import Helion's UI runtime, a canvas, frame scheduler, DOM renderer, or HarfBuzz/WASM.
Font/container parsing and immutable table preparation happen on the host once;
live shaping and paragraph layout are WGSL. Use your own WebGPU device and consumer.

## Quick start

\`\`\`js
import {loadFont, prepareTypography, GpuTypography} ${FROM} './index.js';
const font = await loadFont('/assets/MyStaticFont.ttf');
const prepared = prepareTypography([font], [{
  text:'office AVATAR', features:{liga:1,kern:1}, direction:'auto',
  inputCapacity:1024, capacity:3072, width:360, fontSize:24, wrap:'word'
}]);
const text = await GpuTypography.create(device, prepared);
text.updateText(0, 'Retained text').updateLayout(0, {width:240});
const encoder = device.createCommandEncoder();
text.encode(encoder);
// Add your GPU consumer using text.output.buffer and retained metadata here.
device.queue.submit([encoder.finish()]);
// Explicit diagnostic only: never required for rendering.
const result = await text.snapshot(0);
text.dispose(); // does not destroy your device
\`\`\`

Serve the folder on localhost/HTTPS. The adjacent four WGSL files must be available
unless an assembled source or embedded shader bank is supplied. See
[the full contract](docs/TYPOGRAPHY.md) for buffer layouts, capacities, feature limits,
shaping versus layout units, cache/transfer costs and diagnostics.

\`npm test\` checks this module's imports, fixture preparation and shader assembly on
the host; it is NOT native shader validation. Type checking: \`tsc --strict --noEmit
--target es2022 --module nodenext --moduleResolution nodenext --lib es2023,dom
tests/module-api.ts\`. Helion's full source package contains the native browser gate
at /tests/typography.html and the differential/oracle tools.

**Native GPU execution and performance are unverified.** Full complex-script,
Unicode line-break, editor/IME/accessibility, variable/CFF/color-font and platform
rasterizer parity are not claimed. Font files are not included. The test fixture
is generated from original geometric shapes, not a redistributed font asset.
Unicode and HarfBuzz-reference notices are included. This package has not been
published to npm. Rebuild it with the framework's tools/package-typography.mjs.
`);
console.log(`Prepared @helion/typography ${version}: ${out} (${files.length} copied files plus package facade/tests/docs).`);
