import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
import {relative,resolve,posix} from 'node:path';
import {launchPages,launchScript} from './launch-bootstrap.mjs';
import {modulePreloadScript,startupWorkerScript} from './module-preloads.mjs';

/** Build-time only: source and standalone routes remain independently runnable. */
export async function publishedBundles(root,out){
 const result=await build({absWorkingDir:root,
  entryPoints:Object.fromEntries(launchPages.map((page,i)=>[`app-${i}`,page.bundle])),
  outdir:resolve(out,'assets'),entryNames:'[name]-[hash]',chunkNames:'chunk-[hash]',
  bundle:true,splitting:true,format:'esm',platform:'browser',target:'es2022',
  // Sandbox bootstrap functions serialize their own bodies. Do not inject
  // keepNames helpers from the outer module into those isolated functions.
  minify:true,keepNames:false,sourcemap:'external',metafile:true,write:false,
  plugins:[{name:'original-module-urls',setup(builder){
   builder.onLoad({filter:/\.js$/},async({path})=>{
    const file=relative(root,path).split('\\').join('/');
    if(file.startsWith('../'))throw new Error(`Unexpected runtime dependency outside the project: ${file}`);
    // All output modules live directly in assets/. Preserve each original
    // module's shader, worker and authoring URLs, including Pages subpaths.
    const contents=(await readFile(path,'utf8')).replaceAll('import.meta.url',`new URL(${JSON.stringify('../'+file)},import.meta.url).href`);
    return {contents,loader:'js'};
   });
  }}]});
 const local=path=>relative(out,resolve(root,path)).split('\\').join('/');
 const graph=new Map(),routes=new Map();
 for(const [path,metadata] of Object.entries(result.metafile.outputs)){
  if(!path.endsWith('.js'))continue;
  if(metadata.imports.some(i=>i.external))throw new Error(`External published module import: ${path}`);
  graph.set(local(path),metadata.imports.filter(i=>i.kind==='import-statement').map(i=>local(i.path)));
  if(metadata.entryPoint)routes.set(metadata.entryPoint,local(path));
 }
 return {files:result.outputFiles,graph,routes};
}
export function publishedHTML(html,page,bundle){
 const entry=bundle.routes.get(page.bundle);if(!entry)throw new Error(`Missing published bundle: ${page.bundle}`);
 const path=posix.relative(posix.dirname(page.file),entry);
 const launch=launchScript(path.startsWith('.')?path:`./${path}`,{path:page.path}).replace('<script data-helion-launch>','<script data-helion-launch data-helion-bundle>');
 return html.replace(launchScript(page.entry,{path:page.path}),startupWorkerScript(page.file)+'\n'+modulePreloadScript(bundle.graph,entry,page.file)+'\n'+launch);
}
