import {h,compile,ShapedText,GpuTypography,prepareTypography,normalizeParagraph,decodeTypography,ParagraphOptions} from '../src/index.js';
const declaration=ShapedText({text:'مرحبا office',flowDirection:'auto',fontFeatures:{liga:1}});
compile(h('Grid',{textShaping:'opentype'},declaration,h('TextBox',{fontLanguage:'pl',shapingCapacity:512})),{textShaping:'auto',typographyOperationBudget:1000000});
const settings:ParagraphOptions={fontSize:18,width:240,wrap:'word',alignment:'start',tabSize:4};
normalizeParagraph(settings);
async function check(device:unknown,font:unknown,encoder:unknown){const prepared=prepareTypography([font],[{text:'office',...settings}]);const text=await GpuTypography.create(device,prepared);text.updateText(0,'AVATAR').setDirection(0,'rtl').updateLayout(0,{width:280});text.encode(encoder);const snap=await text.snapshot();console.log(snap.paragraph?.lines[0].baseline);decodeTypography(prepared.heap,prepared.runs[0]);text.dispose();}
void check;
