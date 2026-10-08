/** Native compiler diagnostics, without GPU state readback or source rewriting. */
export function shaderLocation(program, lineNum, linePos = 0) {
  const section = program.sections.find(s => lineNum >= s.startLine && lineNum <= s.endLine);
  return {
    file: section?.name ?? '<generated WGSL>',
    line: section ? lineNum - section.startLine + (section.sourceLine ?? 1) : lineNum,
    column: linePos,
    generatedLine: lineNum
  };
}

export function formatShaderMessages(program, messages) {
  const lines = program.code.split('\n');
  return messages.map(message => {
    const location = shaderLocation(program, message.lineNum ?? 0, message.linePos ?? 0);
    const header = `${location.file}:${location.line}:${location.column}: ${message.message}`;
    if (!message.lineNum || message.lineNum > lines.length) return header;
    const sourceLine = lines[message.lineNum - 1];
    const position = Math.max(0, Math.min(sourceLine.length, (message.linePos || 1) - 1));
    return `${header}\n${sourceLine}\n${' '.repeat(position)}^`;
  }).join('\n\n');
}

export class ShaderCompilationError extends Error {
  constructor(label, program, messages, validationError) {
    const detail = formatShaderMessages(program, messages)
      || validationError?.message || 'The WebGPU implementation rejected this shader module.';
    super(`${label}\n${detail}`);
    this.name = 'ShaderCompilationError';
    this.diagnostics = messages.map(m => ({ ...shaderLocation(program, m.lineNum ?? 0, m.linePos ?? 0), message: m.message, type: m.type }));
  }
}

/** Scope module errors so the caller gets the useful compiler message once,
 * rather than an earlier, often unhelpful, uncaptured GPUValidationError.
 * popErrorScope is paired even when a native API call throws or rejects.
 */
export async function createCheckedShaderModule(device, program, label) {
  device.pushErrorScope('validation');
  let module, infoPromise;
  try {
    module = device.createShaderModule({ code: program.code, label });
    infoPromise = module.getCompilationInfo();
  } catch (error) { await device.popErrorScope(); throw error; }
  // Pop on the content timeline BEFORE yielding. Parallel module checks must not
  // overlap or steal each other's error scopes. Native diagnostics remain awaited.
  const validationPromise = device.popErrorScope();
  const [info, validationError] = await Promise.all([infoPromise, validationPromise]);
  const errors = info.messages.filter(message => message.type === 'error');
  if (errors.length || validationError) throw new ShaderCompilationError(label, program, errors, validationError);
  return module;
}
