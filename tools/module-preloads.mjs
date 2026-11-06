import {posix} from 'node:path';

/** Traverse the same controlled static-import graph used by the standalone
 * bundler. Dynamic worker/application imports are intentionally excluded. */
export function modulePreloadPaths(graph,entry,page){
  const seen=new Set();
  const visit=file=>{
    if(seen.has(file))return;
    if(!graph.has(file))throw new Error(`Missing preload module: ${file}`);
    seen.add(file);for(const dependency of graph.get(file))visit(dependency);
  };
  visit(entry);
  return [...seen].map(file=>{
    const relative=posix.relative(posix.dirname(page),file);
    return relative.startsWith('.')?relative:`./${relative}`;
  });
}

function preloadModules(paths){
  // Match the launch guard: a direct file/data launch must not fetch modules.
  if(!['http:','https:'].includes(globalThis.location?.protocol))return;
  for(const href of paths){
    const link=document.createElement('link');link.rel='modulepreload';link.href=href;
    document.head.append(link);
  }
}

export function modulePreloadScript(graph,entry,page){
  const paths=JSON.stringify(modulePreloadPaths(graph,entry,page)).replace(/</g,'\\u003c');
  return `<script data-helion-preloads>(${preloadModules.toString()})(${paths});</script>`;
}
