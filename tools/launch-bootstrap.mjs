import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchApplication} from '../src/platform/launch.js';
import {BUILD_VERSION} from '../src/version.js';

export const launchPages = [
  {file:'index.html',entry:'./site/app.js',bundle:'site/app.js',path:'/'},
  {file:'typography/index.html',entry:'./app.js',bundle:'typography/app.js',path:'/typography/'},
  {file:'showcase.html',entry:'./examples/showcase.js',bundle:'examples/showcase.js',path:'/showcase.html'},
  {file:'playground/index.html',entry:'./app.js',bundle:'playground/app.js',path:'/playground/'},
  {file:'designer/index.html',entry:'./app.js',bundle:'designer/app.js',path:'/designer/'},
  {file:'designer/runner.html',entry:'./runner.js',bundle:'designer/runner.js',path:'/designer/runner.html'}
];
export function launchScript(entry, options = {}) {
  const json = JSON.stringify({version:BUILD_VERSION,...options}).replace(/</g,'\\u003c');
  return `<script data-helion-launch>(${launchApplication.toString()})(${JSON.stringify(entry)},${json});</script>`;
}
/** Source HTML has an inline guard too: a file launch cannot first try to fetch
 * an ES module and fail with a generic file-origin console error. */
export async function updateLaunchPages(root = fileURLToPath(new URL('..',import.meta.url))) {
  for (const page of launchPages) {
    const filename = resolve(root,page.file), html = await readFile(filename,'utf8');
    const original = `<script type="module" src="${page.entry}"></script>`;
    const old = html.match(/<script data-helion-launch>[\s\S]*?<\/script>/)?.[0] || original;
    if (!html.includes(old)) throw new Error(`Missing launch point: ${page.file}`);
    await writeFile(filename,html.replace(old,launchScript(page.entry,{path:page.path})));
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await updateLaunchPages();
