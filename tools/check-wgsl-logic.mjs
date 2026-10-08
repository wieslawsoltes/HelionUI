/**
 * Focused WGSL syntax guard, not a type checker or native compiler.
 * WGSL forbids && and || in one unparenthesized expression, unlike JS/C.
 * Track each delimiter scope and comma/statement boundary independently;
 * keep original offsets and line/column positions, including nested comments.
 * Runs only in tests/build tooling, never in the per-frame rendering path.
 */
export function checkLogicalGrouping(source, file = '<WGSL>') {
  if (typeof source !== 'string') throw new TypeError('WGSL source must be a string');
  const errors = [], scopes = [{ operator: null, reported: false }];
  let line = 1, column = 1, blockDepth = 0, lineComment = false;
  const advance = c => { if (c === '\n') { line++; column = 1; } else column++; };
  const reset = () => { const scope = scopes.at(-1); scope.operator = null; scope.reported = false; };
  for (let i = 0; i < source.length; i++) {
    const c = source[i], pair = source.slice(i, i + 2);
    if (lineComment) { if (c === '\n') lineComment = false; advance(c); continue; }
    if (blockDepth) {
      if (pair === '/*') { blockDepth++; advance(c); advance(source[++i]); }
      else if (pair === '*/') { blockDepth--; advance(c); advance(source[++i]); }
      else advance(c);
      continue;
    }
    if (pair === '//') { lineComment = true; advance(c); advance(source[++i]); continue; }
    if (pair === '/*') { blockDepth = 1; advance(c); advance(source[++i]); continue; }
    if (pair === '&&' || pair === '||') {
      const scope = scopes.at(-1);
      if (scope.operator && scope.operator !== pair && !scope.reported) {
        errors.push({ file, line, column, offset: i, message: "mixing '&&' and '||' requires parentheses" });
        scope.reported = true;
      }
      scope.operator ??= pair;
      advance(c); advance(source[++i]); continue;
    }
    if (c === '{') reset(); // End of an unparenthesized if/while condition.
    if ('([{'.includes(c)) scopes.push({ operator: null, reported: false });
    else if (')]}'.includes(c)) {
      if (scopes.length > 1) scopes.pop();
      if (c === '}') reset(); // Adjacent statements are separate expressions.
    } else if (c === ',' || c === ';' || c === ':') reset();
    advance(c);
  }
  return errors;
}
export function formatLogicalGroupingError(error) {
  return `${error.file}:${error.line}:${error.column}: ${error.message}`;
}
