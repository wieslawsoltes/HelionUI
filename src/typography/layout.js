/** Retained paragraph layout. All sizes are CSS/device-independent pixels. */
export const Paragraph = Object.freeze({
  width:0,fontSize:1,lineHeight:2,letterSpacing:3,alignment:4,wrap:5,
  revision:6,completed:7,shapedRevision:8,lines:9,positions:10,order:11,carets:12,
  lineCount:13,measuredWidth:14,measuredHeight:15,glyphCount:16,valid:17,tabSize:18
});
export const PARAGRAPH_WORDS=32;
export const LINE_WORDS=12;
export const POSITION_WORDS=4;
export function normalizeParagraph(options={}) {
  const width=Number(options.width??0),fontSize=Number(options.fontSize??16),lineHeight=Number(options.lineHeight??0),letterSpacing=Number(options.letterSpacing??0),tabSize=Number(options.tabSize??4);
  const alignment=options.textAlignment??options.alignment??'start';
  const wrap=options.wrap===false?'none':options.wrap===true?'word':options.wrap??'word';
  if(!Number.isFinite(width)||width<0||width>1e7||!Number.isFinite(fontSize)||fontSize<=0||fontSize>1024||!Number.isFinite(lineHeight)||lineHeight<0||lineHeight>1e7||!Number.isFinite(letterSpacing)||Math.abs(letterSpacing)>1024||!Number.isInteger(tabSize)||tabSize<1||tabSize>32)throw new RangeError('Invalid paragraph dimensions');
  if(!['left','center','right','start','end'].includes(alignment))throw new TypeError('Invalid paragraph alignment');
  if(!['none','word','character'].includes(wrap))throw new TypeError('Invalid paragraph wrapping');
  return {width,fontSize,lineHeight,letterSpacing,tabSize,alignment,wrap};
}
