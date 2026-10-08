/** Bounded, versioned authoring ABI. Offsets are words, not bytes. */
export const DESIGN_VERSION = 1;
export const DESIGN_MAGIC = 0x48445331;
export const DESIGN_HEADER = 128;
export const DESIGN_RECORD = 96;
export const DESIGN_NAME = 64;
export const DESIGN_TEXT = 512;
export const DESIGN_KEYS = 12;
export const DESIGN_TRACK = 4 + DESIGN_KEYS * 4;
export const DESIGN_TRACKS = 6;
export const DESIGN_STATE_COUNT = 4;
export const DESIGN_STATE_RECORD = 12;
export const DESIGN_RESOURCE_COUNT = 16;
export const DESIGN_RESOURCE_RECORD = 68;
export const DesignCommand = Object.freeze({
 select:0, tool:1, insert:2, delete:3, duplicate:4, undo:5, redo:6,
 property:7, text:8, name:9, reparent:10, reorder:11, group:12, ungroup:13,
 align:14, distribute:15, lock:16, visibility:17, zoom:18, fit:19,
 snap:20, grid:21, preview:22, play:23, stop:24, seek:25, record:26,
 keyframe:27, removeKey:28, easing:29, selectAll:30, state:31, captureState:32,
 resetState:33, resource:34, bindResource:35, copy:36, paste:37, cancel:38,
 gridTrack:39, documentSize:40, duration:41, restore:42, resetView:43,
 toggleGuides:44, bind:45, action:46, template:47, controlTheme:48, templateDefaults:49, themePreference:50, themeAccent:51, templatePreview:52
});
export const DesignTool = Object.freeze({select:0,hand:1,rectangle:2,text:3,ellipse:4,button:5});
export const DesignFlags = Object.freeze({snapGrid:1,snapObjects:2,showGrid:4,rulers:8,preview:16,record:32,playing:64,loop:128,guides:256});
export const DesignField = Object.freeze({
 x:8,y:9,width:10,height:11,minWidth:12,minHeight:13,maxWidth:14,maxHeight:15,
 padding:16,gap:17,marginLeft:18,marginTop:19,marginRight:20,marginBottom:21,
 fontSize:22,radius:23,borderWidth:24,opacity:25,rotation:26,scaleX:27,scaleY:28,
 translateX:29,translateY:30,foreground:31,background:32,borderColor:33,
 horizontalAlignment:34,verticalAlignment:35,row:36,column:37,rowSpan:38,columnSpan:39,
 orientation:40,wrap:41,dock:42,lastChildFill:43,uniformRows:44,uniformColumns:45,stretch:46,
 columnsCount:48,rowsCount:49,value:82,actionKind:85,actionTarget:86,actionValue:87,
 bindingSource:88,bindingScale:89,bindingOffset:90,backgroundResource:91,foregroundResource:92
});
export const DESIGN_COLOR_FIELDS = new Set([31,32,33]);
export const DESIGN_INTEGER_FIELDS = new Set([34,35,36,37,38,39,40,41,42,43,44,45,46,48,49,85,86,88,91,92]);
export const DESIGN_ANIMATED_FIELDS = Object.freeze([25,29,30,27,28,26]);
export const DESIGN_ANIMATED_NAMES = Object.freeze(['opacity','translateX','translateY','scaleX','scaleY','rotation']);
export const DESIGN_TYPE_NAMES = Object.freeze(['Canvas','Grid','StackPanel','DockPanel','WrapPanel','UniformGrid','Border','TextBlock','Button','CheckBox','Slider','TextBox','ProgressBar','Path','Panel','Viewbox','ScrollViewer','ContentControl']);
export const DESIGN_PALETTE = Object.freeze([
 {name:'Select',tool:0}, {name:'Hand',tool:1},
 ...DESIGN_TYPE_NAMES.filter(x=>x!=='Path').map(type=>({name:type,type})),
 {name:'Ellipse',type:'Path',shape:1},{name:'Star',type:'Path',shape:2},{name:'Line',type:'Path',shape:3}
]);
/** Type 0 numeric, 1 packed RGBA, 2 enum, 3 label/name, 4 text, 5 headings. */
export const DESIGN_INSPECTOR = Object.freeze([
 ['Identity',0,5],['Name',5,3],['Text',6,4],
 ['Layout',0,5],['X',8,0],['Y',9,0],['Width',10,0],['Height',11,0],['Padding',16,0],['Spacing',17,0],
 ['Align horizontal',34,2],['Align vertical',35,2],['Grid row',36,0],['Grid column',37,0],['Row span',38,0],['Column span',39,0],
 ['Appearance',0,5],['Background',32,1],['Foreground',31,1],['Border',33,1],['Corner radius',23,0],['Border width',24,0],['Font size',22,0],
 ['Composition',0,5],['Opacity',25,0],['Rotation °',26,0],['Scale X',27,0],['Scale Y',28,0],['Offset X',29,0],['Offset Y',30,0],
 ['Panel',0,5],['Orientation',40,2],['Wrap text',41,2],['Dock edge',42,2],['Last child fills',43,2],['Uniform rows',44,0],['Uniform columns',45,0],['Stretch',46,2],
 ['Constraints',0,5],['Min width',12,0],['Min height',13,0],['Max width',14,0],['Max height',15,0],
 ['Margin left',18,0],['Margin top',19,0],['Margin right',20,0],['Margin bottom',21,0],
 ['Control / bindings',0,5],['Value',82,0],['Binding source',88,2],['Binding scale',89,0],['Binding offset',90,0],
 ['Action',85,2],['Action target',86,2],['Action value',87,0]
]);
export function designOffsets(capacity) {
 const records=64+DESIGN_RESOURCE_COUNT*DESIGN_RESOURCE_RECORD;
 const names=records+capacity*DESIGN_RECORD;
 const text=names+capacity*DESIGN_NAME;
 const tracks=text+capacity*DESIGN_TEXT;
 const states=tracks+capacity*DESIGN_TRACKS*DESIGN_TRACK;
 const words=states+capacity*DESIGN_STATE_COUNT*DESIGN_STATE_RECORD;
 return {records,names,text,tracks,states,words};
}
