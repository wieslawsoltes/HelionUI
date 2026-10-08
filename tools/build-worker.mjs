import { readFile } from 'node:fs/promises';
import { resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
/** Strict bundler for the startup worker's controlled named-import module graph.
 * Worker import maps are not inherited from the document. Emit a self-contained
 * worker instead of leaving any @helion.bundle aliases in its dependency graph.
 * Unsupported syntax fails the build rather than producing a partial bundle.
 */
export async function buildModuleBundle(root, entry) {
  const modules = [], visited = new Set(), active = new Set();
  const visit = async file => {
    if (visited.has(file)) return;
    if (active.has(file)) throw new Error(`Startup worker import cycle: ${file}`);
    if (!file.startsWith('src/')) throw new Error(`Worker import outside src: ${file}`);
    active.add(file); let code = await readFile(resolve(root, file), 'utf8');
    const imports = [...code.matchAll(/^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?\s*$/gm)];
    for (const match of imports) {
      const dependency = posix.normalize(posix.join(posix.dirname(file), match[2])); await visit(dependency);
      const bindings = match[1].trim().replace(/\b(\w+)\s+as\s+(\w+)\b/g, '$1: $2');
      code = code.replace(match[0], `const { ${bindings} } = __helionModules[${JSON.stringify(dependency)}];\n`);
    }
    const exports = [];
    code = code.replace(/^export\s+((?:async\s+)?(?:function|class|const|let|var))\s+(\w+)/gm, (_, type, name) => { exports.push(name); return `${type} ${name}`; });
    code = code.replace(/^export\s*\{([^}]+)\};?\s*$/gm, (_,names)=>{ exports.push(...names.split(',').map(s=>s.trim()));return ''; });
    if (/^\s*(import|export)\s/m.test(code) || /import\.meta/.test(code)) throw new Error(`Unsupported startup-worker module syntax: ${file}`);
    modules.push(`__helionModules[${JSON.stringify(file)}] = (() => {\n${code}\nreturn { ${exports.join(', ')} };\n})();`);
    active.delete(file); visited.add(file);
  };
  await visit(entry);
  return `// Helion standalone startup worker. No fonts, external scripts or import map.\n'use strict';\nconst __helionModules = Object.create(null);\n${modules.join('\n')}\n//# sourceURL=helion/startup-worker.bundle.js\n`;
}

export async function buildWorkerSource(root = fileURLToPath(new URL('..', import.meta.url))) {
 return buildModuleBundle(root, 'src/startup/prepare-worker.js');
}
export async function buildAuthoringSource(root = fileURLToPath(new URL('..', import.meta.url))) {
 return (await buildModuleBundle(root, 'src/playground/authoring.js')) + "\nglobalThis.__HELION_AUTHORING__ = __helionModules['src/playground/authoring.js'].authoringAPI;\n";
}
