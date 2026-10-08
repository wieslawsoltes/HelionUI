export const SHAPING_ABI=1;
export const RUN_WORDS=64;
export const GLYPH_WORDS=20;
export const Run=Object.freeze({capacity:1,input:2,length:3,revision:4,completed:5,glyphs:6,count:7,scratch:8,faceCount:9,faces:10,plans:11,unicode:12,language:15,script:16,direction:17,errors:18,shapes:19,sourceCopy:20,boundaries:21,order:22,advance:23,flags:24,budget:25,steps:26,lastLength:27,sequence:28,taskCount:29,tasks:30,match:31,carets:32,lineCount:33,ascent:34,descent:35,optionsRevision:36,cachedOptions:37,joins:38,inputCapacity:39,sourceNode:40,attachmentCount:41,skippedLookups:42,paragraphLevel:43,firstUnsupported:44,featureWarnings:45,transactionScratch:46,valid:47,previousAdvance:48,layout:50,lineGap:51,source:63});
export const Glyph=Object.freeze({id:0,cluster:1,end:2,codepoint:3,face:4,properties:5,level:6,joining:7,advanceX:8,advanceY:9,offsetX:10,offsetY:11,x:12,y:13,parent:14,component:15,uid:16,script:17,bidiType:18,flags:19});
export const ShapingError=Object.freeze({capacity:1,operationBudget:2,malformedTable:4,contextDepth:8,unsupportedScript:16,unsupportedLookup:32,invalidGlyph:64});
