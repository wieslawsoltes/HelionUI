import {launchScript, launchPages} from './launch-bootstrap.mjs';
import {publishedBundles,publishedHTML} from './published-bundles.mjs';
import {gzipSync} from 'node:zlib';
import { buildWorkerSource, buildAuthoringSource } from './build-worker.mjs';
import { readdir, readFile, mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)), out = resolve(root, 'dist');
const walk = async dir => (await Promise.all((await readdir(resolve(root, dir), { withFileTypes: true })).map(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]))).flat();
await rm(out, { recursive: true, force: true }); await mkdir(out, { recursive: true });
for (const page of launchPages) {
  const html = await readFile(resolve(root,page.file),'utf8');
  if (!html.includes(launchScript(page.entry,{path:page.path}))) throw new Error(`Stale launch guard: ${page.file}; run node tools/launch-bootstrap.mjs`);
}
const files = [...(await walk('src')).filter(f => f.endsWith('.js')), 'examples/showcase.js','playground/app.js','playground/examples.js','designer/app.js','designer/examples.js','designer/runner.js','typography/app.js','typography/view.js'];
const imports = {};
for (const file of files) {
  let code = await readFile(resolve(root, file), 'utf8');
  code = code.replace(/(\bfrom\s*|\bimport\s*)['"](\.[^'"]+)['"]/g, (_, prefix, relative) => {
    const target=posix.normalize(posix.join(posix.dirname(file),relative));
    return `${prefix}'@helion.bundle/${target}'`;
  });
  code += `\n//# sourceURL=helion/${file}\n`;
  imports[`@helion.bundle/${file}`] = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}
const shaders = {};
for (const name of (await readdir(resolve(root, 'shaders'))).filter(f => f.endsWith('.wgsl'))) shaders[name.slice(0, -5)] = await readFile(resolve(root, 'shaders', name), 'utf8');
const workerSource = await buildWorkerSource(root);
const authoringSource = await buildAuthoringSource(root);
await writeFile(resolve(root, 'playground/authoring.bundle.js'), authoringSource);
await writeFile(resolve(out, 'helion-startup-worker.js'), workerSource);
const escape = value => JSON.stringify(value).replace(/</g, '\\u003c');
const index = await readFile(resolve(root, 'index.html'), 'utf8');
const standalone = index.replace("location.href='./playground/index.html'","location.href='./helion-playground.html'").replace("location.href='./designer/index.html'","location.href='./helion-designer.html'").replace(launchScript('./examples/showcase.js',{path:'/'}), () => `<script>globalThis.__HELION_SHADERS__=${escape(shaders)};</script>\n<script>globalThis.__HELION_PREPARE_WORKER_SOURCE__=${escape(workerSource)};</script>\n<script type="importmap">${escape({ imports })}</script>\n${launchScript('@helion.bundle/examples/showcase.js',{standalone:true})}`);
await writeFile(resolve(out, 'helion-standalone.html'), standalone);
// The app-export template is a data-only, independently runnable Helion app.
// It deliberately does not embed itself or include a third-party font asset.
const runner = await readFile(resolve(root,'designer/runner.html'),'utf8');
const exportTemplate=runner.replace(launchScript('./runner.js',{path:'/designer/runner.html'}),()=>`<script>globalThis.__HELION_SHADERS__=${escape(shaders)};</script>
<script>globalThis.__HELION_PREPARE_WORKER_SOURCE__=${escape(workerSource)};</script>
<script type="importmap">${escape({imports})}</script>
${launchScript('@helion.bundle/designer/runner.js',{standalone:true})}`);
await writeFile(resolve(root,'designer/export-template.html'),exportTemplate);
for (const file of ['index.html', 'README.md', 'LICENSE', 'NOTICE', 'START-HERE.md', 'serve-helion.py', 'start-helion.command', 'start-helion.sh', 'start-helion.cmd']) await cp(resolve(root, file), resolve(out, file));
for (const dir of ['src', 'shaders', 'examples', 'docs', 'tests', 'playground', 'designer', 'typography']) await cp(resolve(root, dir), resolve(out, dir), { recursive: true });
// Published routes share a few cacheable modules; standalone exports retain
// their exact, independent source graph and embedded startup worker.
const published=await publishedBundles(root,out);
await mkdir(resolve(out,'assets'),{recursive:true});
for(const file of published.files)await writeFile(file.path,file.contents);
for(const page of launchPages){
  const path=resolve(out,page.file),html=await readFile(path,'utf8');
  await writeFile(path,publishedHTML(html,page,published));
}
console.log(`Built dist/ and dist/helion-standalone.html (${Buffer.byteLength(standalone).toLocaleString()} bytes). Application code is embedded. Real fonts load at mount from configured sources or local files.`);

const playgroundCSS = await readFile(resolve(root,'playground/playground.css'),'utf8');
const playground = (await readFile(resolve(root,'playground/index.html'),'utf8'))
 .replace('<link rel="stylesheet" href="./playground.css">',()=>'<style>'+playgroundCSS+'</style>');

const playgroundStandalone=playground.replace(launchScript('./app.js',{path:'/playground/'}),()=>`<script>globalThis.__HELION_SHADERS__=${escape(shaders)};globalThis.__HELION_PREPARE_WORKER_SOURCE__=${escape(workerSource)};globalThis.__HELION_AUTHORING_SOURCE__=${escape(authoringSource)};</script>\n<script type="importmap">${escape({imports})}</script>\n${launchScript('@helion.bundle/playground/app.js',{standalone:true})}`)
 .replaceAll('href="../index.html"','href="./helion-standalone.html"').replaceAll('href="../docs/','href="./docs/');
await writeFile(resolve(out,'helion-playground.html'),playgroundStandalone);
console.log(`Built standalone playground (${Buffer.byteLength(playgroundStandalone).toLocaleString()} bytes); app execution uses a network-disabled sandbox worker.`);

const designerCSS=await readFile(resolve(root,'designer/designer.css'),'utf8');
const designer=(await readFile(resolve(root,'designer/index.html'),'utf8'))
 .replace('<link rel="stylesheet" href="./designer.css">',()=>'<style>'+designerCSS+'</style>')
 .replace(launchScript('./app.js',{path:'/designer/'}),()=>`<script>globalThis.__HELION_SHADERS__=${escape(shaders)};</script>
<script>globalThis.__HELION_PREPARE_WORKER_SOURCE__=${escape(workerSource)};</script>
<script>globalThis.__HELION_DESIGN_EXPORT_GZIP__=${escape(gzipSync(exportTemplate,{level:9}).toString('base64'))};</script>
<script type="importmap">${escape({imports})}</script>
${launchScript('@helion.bundle/designer/app.js',{standalone:true})}`);
await writeFile(resolve(out,'helion-designer.html'),designer);
console.log(`Built standalone designer (${Buffer.byteLength(designer).toLocaleString()} bytes) and exact standalone app-export template (${Buffer.byteLength(exportTemplate).toLocaleString()} bytes). Fonts remain runtime/local assets.`);

const typographyCSS=await readFile(resolve(root,'typography/typography.css'),'utf8');
const typography=(await readFile(resolve(root,'typography/index.html'),'utf8'))
 .replace('<link rel="stylesheet" href="./typography.css">',()=>'<style>'+typographyCSS+'</style>')
 .replace(launchScript('./app.js',{path:'/typography/'}),()=>`<script>globalThis.__HELION_SHADERS__=${escape(shaders)};</script>
<script>globalThis.__HELION_PREPARE_WORKER_SOURCE__=${escape(workerSource)};</script>
<script type="importmap">${escape({imports})}</script>
${launchScript('@helion.bundle/typography/app.js',{standalone:true})}`);
await writeFile(resolve(out,'helion-typography.html'),typography);
console.log(`Built standalone typography lab (${Buffer.byteLength(typography).toLocaleString()} bytes).`);
