import { prepareScene } from './prepare-core.js';
// Worker lifetime is one startup. It terminates once an optional cache write settles.
self.postMessage({ type: 'ready' });
self.onmessage = async event => {
  try {
    const { view, options } = event.data;
    const result = await prepareScene(view, options, (stage, detail) => self.postMessage({ type: 'progress', stage, detail }));
    const { compiled, stats, persisted } = result;
    self.postMessage({ type: 'result', compiled, stats }, [compiled.nodes.buffer, compiled.state.buffer, compiled.heap.buffer]);
    self.postMessage({ type: 'stored', stored: await persisted });
  } catch (error) { self.postMessage({ type: 'error', name: error.name, message: error.message, stack: error.stack }); }
  finally { self.close(); }
};
