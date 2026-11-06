/** Lossless, controlled-source function reachability slicing. This is NOT a WGSL
 * optimizer/parser: non-function declarations and kept function tokens are copied
 * verbatim. Unsupported/ambiguous declarations fail closed. Native validation
 * still checks types, uniformity and interfaces. No frame-loop work is added.
 */
function commentMask(code) {
  const chunks = []; let at = 0; const comments = /\/[/*]/g; let match;
  while ((match = comments.exec(code))) {
    const start = match.index; chunks.push(code.slice(at, start));
    let end;
    if (match[0] === '//') {
      const newline = code.indexOf('\n', comments.lastIndex); end = newline < 0 ? code.length : newline;
    } else {
      const delimiters = /\/\*|\*\//g; delimiters.lastIndex = comments.lastIndex;
      let depth = 1, delimiter;
      while (depth && (delimiter = delimiters.exec(code))) depth += delimiter[0] === '/*' ? 1 : -1;
      if (depth) throw new SyntaxError('Unterminated WGSL block comment');
      end = delimiters.lastIndex;
    }
    chunks.push(code.slice(start, end).replace(/[^\n]/g, ' ')); at = end; comments.lastIndex = end;
  }
  chunks.push(code.slice(at)); return chunks.join('');
}
let cachedSource, cachedAnalysis;
/** One preparation graph shared by partitioning and ABI resource discovery. */
export function shaderDeclarations(code) {
  if (cachedSource !== code) { const analysis = analyzeShaderDeclarations(code); cachedSource = code; cachedAnalysis = analysis; }
  return cachedAnalysis;
}

export function analyzeShaderDeclarations(code) {
  const clean=commentMask(code), declarations=[], functions=new Map();
  let begin=0, depth=0;
  const append=end=>{
    const text=clean.slice(begin,end), match=/\bfn\s+(\w+)\s*\(/.exec(text);
    const item={start:begin,end,name:match?.[1]??null};
    if(match){if(functions.has(item.name))throw new SyntaxError(`Duplicate WGSL function ${item.name}`);item.body=text.slice(text.indexOf('{')+1);item.calls=[...item.body.matchAll(/\b(\w+)\s*\(/g)].map(m=>m[1]);functions.set(item.name,item);}
    declarations.push(item);begin=end;
  };
  for(let i=0;i<clean.length;i++) {
    if(clean[i]==='{')depth++;
    if(clean[i]==='}'){if(--depth<0)throw new SyntaxError('Unbalanced WGSL declaration');if(depth===0)append(i+1);}
    else if(clean[i]===';'&&depth===0)append(i+1);
  }
  if(depth)throw new SyntaxError('Unbalanced WGSL declaration');
  if(clean.slice(begin).trim())throw new SyntaxError('Unterminated WGSL declaration');
  if(begin<code.length)declarations.push({start:begin,end:code.length,name:null});
  return {declarations,functions};
}
/** A group intentionally contains related entries, rather than reparsing the
 * entire editor/designer/control library for each unrelated native pipeline. */
export function shaderPartition(entry) {
  if(['prepareTextInput','shapeTextRuns','layoutTextRuns'].includes(entry))return 'typography';
  if(['resolveTemplateLayout','resolveTemplateVisuals','rankTemplateTree'].includes(entry))return 'templates';
  if(['input','hitTest'].includes(entry))return 'input';
  if(['measure','constraints','arrange','compose'].includes(entry))return 'layout';
  if(['animate','resolveStyles'].includes(entry))return 'composition';
  if(['initializeData','filterScan','scanBlocks','scatterRows','sortBlocks','mergeRows','resolveSelection'].includes(entry))return 'data';
  if(['analyzeEditors','layoutEditors'].includes(entry))return 'editor-analysis';
  if(['pullModels','evaluateModels','pushModels'].includes(entry))return 'models';
  if(['synchronizeDesigners','animateDesigners'].includes(entry))return 'designer-state';
  if(['clearFrame','schedule','finishWork','finishFrame','prepareDraws','prepareJobs','prepareStrips','finishGlyphRequests'].includes(entry))return 'schedule';
  if(['buildJobs','makeStrips','binStrips','composite'].includes(entry))return 'raster';
  if(['collectGlyphRequests','prepareGlyphCache','rasterGlyphCache'].includes(entry))return 'glyph-cache';
  return entry;
}
export function partitionShaderProgram(program, entries) {
  const analysis=shaderDeclarations(program.code), result=new Map(), groups=new Map();
  const lineStarts=[0];for(let i=0;i<program.code.length;i++)if(program.code[i]==='\n')lineStarts.push(i+1);
  const lineAt=offset=>{let a=0,b=lineStarts.length;while(a+1<b){const m=(a+b)>>1;if(lineStarts[m]<=offset)a=m;else b=m;}return a+1;};
  for(const entry of entries){if(!analysis.functions.has(entry))throw new ReferenceError(`Shader entry not found: ${entry}`);const group=shaderPartition(entry);if(!groups.has(group))groups.set(group,[]);groups.get(group).push(entry);}
  for(const [name,roots] of groups) {
    const keep=new Set(),active=new Set();
    const visit=n=>{if(active.has(n))throw new SyntaxError(`Recursive WGSL function ${n}`);if(keep.has(n))return;active.add(n);const f=analysis.functions.get(n);for(const c of f.calls)if(analysis.functions.has(c))visit(c);active.delete(n);keep.add(n);};roots.forEach(visit);
    const sections=[];let code='', nextLine=1;
    for(const item of analysis.declarations) {
      if(item.name&&!keep.has(item.name))continue;
      // Split source map spans at the original assembly's file boundaries.
      let at=item.start;
      while(at<item.end){const line=lineAt(at);const source=program.sections.find(s=>line>=s.startLine&&line<=s.endLine);
        const end=source?Math.min(item.end,lineStarts[source.endLine]??program.code.length):item.end;
        if(end<=at)throw new Error('Invalid shader source map boundary');
        const text=program.code.slice(at,end), count=text.split('\n').length;
        sections.push({name:source?.name??'<generated WGSL>',startLine:nextLine,endLine:nextLine+count-1-(text.endsWith('\n')?1:0),sourceLine:(source?.sourceLine??1)+line-(source?.startLine??1)});
        code+=text;nextLine+=count-1;at=end;
      }
      // Do not concatenate independent declarations onto the same generated line.
      if(program.code[item.end-1]!=='\n'){code+='\n';nextLine++;}
    }
    result.set(name,{name,entries:roots,code,sections,functionNames:[...keep]});
  }
  return result;
}
