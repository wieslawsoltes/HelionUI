import {h,HelionSurface,DesignDocument,designerAction,DesignField,projectToView,generateDesignSource,type DesignProject} from '../src/index.js';
import {createDesignerWorkbench} from '../src/designer/workbench.js';
import {makeDesignAppHTML} from '../src/designer/export.js';
const document=DesignDocument({capacity:32,root:{type:'Canvas',props:{id:'root'},children:[{type:'Button',props:{id:'button',text:'Hello',x:80,y:80,width:150,height:40,animations:[{property:'translateX',keyframes:[{time:0,value:0},{time:4,value:100}]}]}}]}});
const view=h('Grid',{columns:'* 260'},h('DesignSurface',{id:'design',designDocument:document}),h('PropertyInspector',{designTarget:'design',column:1}));
const undo=h('Button',{text:'Undo',action:designerAction('design','undo')});
const shell=createDesignerWorkbench(document,{examples:[document]});
const preview=projectToView(document,{state:0});const code=generateDesignSource(document);
const exported=makeDesignAppHTML('__HELION_PROJECT_JSON__',document);
async function edit(canvas:HTMLCanvasElement){const surface=await HelionSurface.mount(canvas,shell);const designer=surface.designer('design');designer.select(1).set('x',140).setColor('background','#3355aa').command('undo').command('seek',2);designer.insert('TextBlock').text('Created on device');const snapshot=await designer.snapshot();await designer.restore(snapshot.project);return designer.source();}
void [view,undo,preview,code,exported,edit,DesignField.x];
// @ts-expect-error Unsupported design kind, not silently interpreted as a native control.
const unsupported:DesignProject={root:{type:'ImaginaryEditor'}};
void unsupported;
