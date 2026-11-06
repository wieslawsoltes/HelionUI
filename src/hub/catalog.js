export const routes = {
 showcase:{title:'Showcase',url:'./showcase.html'},
 playground:{title:'Playground',url:'./playground/'},
 designer:{title:'Designer',url:'./designer/'},
 typography:{title:'Typography',url:'./typography/'}
};
export const tests = [
 ['gpu','Core GPU','Native pipelines, retained layout, and GPU interaction.','CORRECTNESS'],
 ['editor','Text editor','Editing, selection, undo, and document operations.','CORRECTNESS'],
 ['designer','Designer','Design documents, commands, history, and serialization.','CORRECTNESS'],
 ['typography','Typography','Shaping, paragraph layout, and retained text.','TEXT'],
 ['templates','Control templates','Template composition and control state transitions.','CORRECTNESS'],
 ['framework','Framework','Controls, models, docking, and application composition.','CORRECTNESS'],
 ['dynamic','Dynamic data','Live data ingestion and retained workbench behavior.','CORRECTNESS'],
 ['quality','Rendering quality','GPU output and rendering quality checks.','RENDERING'],
 ['shaders','Shader pipelines','Native shader compilation and resource interfaces.','VALIDATION'],
 ['metrics','Text metrics','Font metrics and measurement checks.','TEXT'],
 ['frame-sync','Frame synchronization','Pacing, submission credits, and completion handling.','PERFORMANCE'],
 ['startup','Startup','Startup stages and readiness diagnostics.','PERFORMANCE'],
 ['performance','Performance','Rendering workload measurements on this device.','PERFORMANCE'],
 ['pacing','Frame pacing','Submission cadence and frame timing diagnostics.','PERFORMANCE'],
 ['hud','Performance overlay','GPU timing and diagnostic overlay checks.','DIAGNOSTICS'],
 ['text','Text rendering','Glyph rendering and font coverage checks.','TEXT'],
 ['host-startup','Host startup','Host preparation without requesting a GPU.','HOST']
];
