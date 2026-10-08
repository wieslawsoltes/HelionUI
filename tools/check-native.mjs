/** Optional native WGSL/pipeline validation using the official Dawn Node binding.
 * Setup: npm install --no-save --package-lock=false webgpu@0.6.1
 * Run: npm run check:native
 * The default null backend validates WGSL and pipeline interfaces without a GPU.
 * It does NOT execute shaders, inspect rendered output, or test browser integration.
 */
import { readFile } from 'node:fs/promises';
import {validateShaderPipelines} from '../tests/shader-compile-suite.js';
import { compile } from '../src/core/compiler.js';
import { arenaLayout } from '../src/gpu/arena-layout.js';
import { createShowcase } from '../examples/showcase.js';

let device, gpu;
try {
  let binding;
  try { binding = await import('webgpu'); }
  catch (error) {
    throw new Error('Native shader validation did not run. Install the optional official Dawn binding with: npm install --no-save --package-lock=false webgpu@0.6.1', { cause: error });
  }
  Object.assign(globalThis, binding.globals);
  const backend = process.argv.find(arg => arg.startsWith('--backend='))?.slice(10) || 'null';
  gpu = binding.create([`backend=${backend}`]);
  const adapter = await gpu.requestAdapter();
  if (!adapter) throw new Error(`No native WebGPU adapter for backend ${backend}; validation did not run`);
  device = await adapter.requestDevice();
  const shaders = Object.fromEntries(await Promise.all(['common','templates','designer','curve-coverage','unicode','shaping','shaping-bidi','paragraph','typography-ui','text','editor','editor-render','models','docking','controls','presenter','data-source','glyph-cache','layout','input','data','flatten','emit','designer-render','strips','present','metrics','hud-common','hud-viewport','hud','blit'].map(async name => [name, await readFile(new URL(`../shaders/${name}.wgsl`, import.meta.url), 'utf8')])));
  const { limits } = compile(createShowcase());
  const { constants: c } = arenaLayout(limits);
  c.VIEW_FEATURES = 511; // Include all optional families, including the active designer paths.
  const result=await validateShaderPipelines(device,shaders,c,()=>{},{compilation:process.argv.includes('--monolithic')?'monolithic':'partitioned'});
  console.log(JSON.stringify({...result,backend,browserIntegrationVerified:false},null,2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  device?.destroy();
  device = undefined;
  gpu = undefined;
}
