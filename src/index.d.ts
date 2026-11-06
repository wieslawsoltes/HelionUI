import type {TemplateBindingValue,ThemeResourceValue,ControlTemplateDefinition,ControlTheme,TemplateController,TemplateManifest,TemplateSystemManifest} from './templates/index.js';
export * from './templates/index.js';
/** Release identifier; not the compiled-buffer ABI. */
export const BUILD_VERSION: string;
/** Public authoring API. WebGPU internals are deliberately not typed as portable application APIs. */
export type ViewKind = 'Grid' | 'StackPanel' | 'Canvas' | 'Border' | 'TextBlock' | 'Button' | 'CheckBox' | 'Slider' | 'TextBox' | 'ProgressBar' | 'DataGrid' | 'Path' | 'ScrollViewer' | 'Panel' | 'DockPanel' | 'WrapPanel' | 'UniformGrid' | 'Viewbox' | 'Drawing' | 'ContentControl' | 'ContentPresenter' | 'TextEditor' | 'CodeEditor' | 'DockWorkspace' | 'DockItem' | 'SurfacePresenter' | 'ListBox' | 'TreeView' | 'Modal' | 'DesignSurface' | 'DesignTree' | 'PropertyInspector' | 'AnimationTimeline' | 'ColorPicker' | 'DesignAdorner' | 'NativeContentPresenter';
export type ActionName = 'none' | 'toggle' | 'increment' | 'set' | 'animations' | 'theme' | 'bounds' | 'clear' | 'page' | 'resetScroll' | 'editor' | 'dock' | 'model' | 'host' | 'designer' | 'template';
export type Metric = 'none' | 'value' | 'matched' | 'selected' | 'nodes' | 'strips' | 'upload' | 'frame' | 'layout' | 'rows' | 'overflow' | 'activePage';
export type CompositionProperty = 'translateX' | 'translateY' | 'scaleX' | 'scaleY' | 'rotation' | 'opacity';
export type MutableProperty = CompositionProperty | 'value' | 'width' | 'height' | 'visible' | 'scrollY' | 'padding' | 'textClear';
export type Color = string | number;
export type Alignment = 'stretch' | 'start' | 'center' | 'end';
export type TrackLength = number | 'Auto' | 'auto' | '*' | `${number}*`;
export type Track = TrackLength | TrackDefinition;
export interface TrackDefinition {length?:TrackLength; width?:TrackLength; height?:TrackLength; min?:number; max?:number;}
export interface GPUAction { type: ActionName; name?:string; target?: string; value?: number; command?:string; extra?:number; model?:string; row?:number;group?:string;state?:string;theme?:string;variant?:'dark'|'light';option?:'contrast'|'density'|'accent'|'reducedMotion';preferenceValue?:Color|boolean|null; }
export interface Binding { source?: string; metric?: Metric; scale?: number; offset?: number; }
export type EasingName='linear'|'smooth'|'spring'|'cubicIn'|'cubicOut'|'cubicInOut'|'sineInOut'|'backOut'|'step';
export type AnimationDirection='normal'|'reverse'|'alternate'|'alternateReverse';
export type AnimationFill='none'|'backwards'|'forwards'|'both';
export interface KeyFrameValue<T=number>{cue:number;value:T;easing?:EasingName;}
export interface Animation { property:CompositionProperty; from?:number;to?:number;duration?:number;delay?:number;repeat?:boolean;alternate?:boolean;easing?:EasingName;speed?:string;
 keyFrames?:KeyFrameValue[];iterations?:number|'infinite';direction?:AnimationDirection;fillMode?:AnimationFill;id?:string;
 expression?:{source:string;scale:number;offset:number;min:number;max:number}; }
export interface Transition {property:CompositionProperty|'background'|'foreground'|'borderColor'|'radius'|'borderWidth';duration:number;easing?:EasingName;}
export interface ResourceReference {resource:string;}
export interface StyleRule {selector:string;setters:ViewProps;}
export type Styles=string|ReadonlyArray<string|StyleRule>;

export interface Column { title?: string; field: string; type?: 'text' | 'number' | 'status' | 'progress' | 'boolean'; width?: number; minWidth?: number; maxWidth?: number; editable?: boolean; }
/** Kind, p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y. Kind 0=line, 1=quadratic, 2=cubic. */
export type CurveSegment = [number,number,number,number,number,number,number,number,number];
export interface CanonicalViewProps {
 textShaping?:'auto'|'simple'|'opentype'; shapingCapacity?:number; fontFeatures?:string|Record<string,number|boolean>; fontScript?:string; fontLanguage?:string; flowDirection?:'auto'|'ltr'|'rtl';
 template?:ControlTemplateDefinition|string|false;templates?:Record<string,ControlTemplateDefinition>;controlThemes?:boolean;theme?:string;themes?:readonly ControlTheme[];themeVariant?:'dark'|'light';themeContrast?:'standard'|'high';controlDensity?:'comfortable'|'compact';accentColor?:Color|null;reducedMotion?:boolean;
 id?: string; text?: string; width?: number | 'auto'; height?: number | 'auto'; minWidth?: number; minHeight?: number; maxWidth?: number; maxHeight?: number;
 padding?: number | [number] | [number,number] | [number,number,number,number]; gap?: number; margin?: number | [number] | [number,number] | [number,number,number,number]; background?: Color; foreground?: Color; borderColor?: Color; radius?: number; borderWidth?: number;
 horizontalAlignment?: Alignment; verticalAlignment?: Alignment; column?: number; row?: number; columnSpan?: number; rowSpan?: number; columns?: number | string | Track[]; rows?: number | string | Track[];
 x?: number; y?: number; fontSize?: number;
 fontFamily?:string; fontWeight?:number|'normal'|'regular'|'light'|'medium'|'semibold'|'bold'|'black'; fontStyle?:'normal'|'italic'|'oblique'; kerning?:boolean; ligatures?:boolean; letterSpacing?:number; lineHeight?:number;
 textAlignment?:'left'|'center'|'right'|'start'|'end'; textDecoration?:'none'|'underline'|'line-through'|'underline line-through'; orientation?: 'horizontal' | 'vertical'; wrap?: boolean; clip?: boolean; disabled?: boolean; hidden?: boolean; editable?: boolean;
 value?: number; opacity?: number; translateX?: number; translateY?: number; scaleX?: number; scaleY?: number; rotation?: number; action?: ActionName | GPUAction; bind?: Binding | ModelBinding; page?: number;
 path?: string | CurveSegment[]; stroke?: number; fillRule?: 'nonzero' | 'evenodd';
 /** Bounds [minX,minY,maxX,maxY], NOT SVG's x/y/width/height tuple. */
 viewBox?: [number,number,number,number]; animations?: Animation[];
 data?: Record<string,string|number|null|undefined>[]; dataColumns?: Column[]; rowCount?: number; rowHeight?: number; filter?: string; activeOnly?: string; minViewportWidth?: number; maxViewportWidth?: number;
}
export interface CanonicalViewProps {
 dock?:'left'|'top'|'right'|'bottom';lastChildFill?:boolean;firstColumn?:number;itemWidth?:number;itemHeight?:number;
 stretch?:'none'|'fill'|'uniform'|'uniformToFill';stretchDirection?:'both'|'uponly'|'downonly';
 renderTransform?:MatrixValue;renderTransformOrigin?:PointValue;right?:number;bottom?:number;rowSpacing?:number;columnSpacing?:number;
 zIndex?:number;useLayoutRounding?:boolean;classes?:string|string[];styles?:Styles;resources?:Record<string,unknown>;transitions?:Transition[];
 drawing?:RetainedDrawing;content?:Child;children?:Child[];
}
export type ViewProps = { [K in keyof CanonicalViewProps]?:CanonicalViewProps[K]|ResourceReference|TemplateBindingValue|ThemeResourceValue } &
 { [K in keyof CanonicalViewProps as Capitalize<K & string>]?:K extends 'horizontalAlignment' ? CanonicalViewProps[K]|'Left'|'Right'|'Center'|'Stretch'|ResourceReference|TemplateBindingValue|ThemeResourceValue : K extends 'verticalAlignment' ? CanonicalViewProps[K]|'Top'|'Bottom'|'Center'|'Stretch'|ResourceReference|TemplateBindingValue|ThemeResourceValue : K extends 'orientation' ? CanonicalViewProps[K]|'Horizontal'|'Vertical'|ResourceReference|TemplateBindingValue|ThemeResourceValue : K extends 'stretch' ? CanonicalViewProps[K]|'None'|'Fill'|'Uniform'|'UniformToFill'|ResourceReference|TemplateBindingValue|ThemeResourceValue : K extends 'stretchDirection' ? CanonicalViewProps[K]|'Both'|'UpOnly'|'DownOnly'|ResourceReference|TemplateBindingValue|ThemeResourceValue : CanonicalViewProps[K]|ResourceReference|TemplateBindingValue|ThemeResourceValue } & {
 Name?:string;'x:Name'?:string;Content?:Child|TemplateBindingValue|ThemeResourceValue;Child?:Child;Children?:Child[];RowDefinitions?:string|Track[];ColumnDefinitions?:string|Track[];
 Spacing?:number;CornerRadius?:number|TemplateBindingValue|ThemeResourceValue;BorderBrush?:Color|ResourceReference|TemplateBindingValue|ThemeResourceValue;BorderThickness?:number|TemplateBindingValue|ThemeResourceValue;IsEnabled?:boolean|ResourceReference|TemplateBindingValue|ThemeResourceValue;IsVisible?:boolean|ResourceReference|TemplateBindingValue|ThemeResourceValue;
 HorizontalAlignment?:Alignment|'Left'|'Right'|'Center'|'Stretch'|ResourceReference|TemplateBindingValue|ThemeResourceValue;VerticalAlignment?:Alignment|'Top'|'Bottom'|'Center'|'Stretch'|ResourceReference|TemplateBindingValue|ThemeResourceValue;
 TextWrapping?:'Wrap'|'NoWrap';ClipToBounds?:boolean;Fill?:Color;StrokeThickness?:number;Data?:string|CurveSegment[];
 'Grid.Row'?:number;'Grid.Column'?:number;'Grid.RowSpan'?:number;'Grid.ColumnSpan'?:number;
 'Canvas.Left'?:number;'Canvas.Top'?:number;'Canvas.Right'?:number;'Canvas.Bottom'?:number;'DockPanel.Dock'?:'Left'|'Top'|'Right'|'Bottom'|'left'|'top'|'right'|'bottom'|ResourceReference|TemplateBindingValue|ThemeResourceValue;
 HorizontalSpacing?:number;VerticalSpacing?:number;
};
export interface View { type: ViewKind; props: ViewProps; children: View[]; }
export type Child = View | string | false | null | undefined | Child[];
export interface Limits { maxHeapWords:number; maxNodes:number; maxDepth:number; maxRows:number; maxColumns:number; textCapacity:number; maxPrimitives:number; maxJobs:number; maxStrips:number; maxAlphaTiles:number; maxTileEntries:number; maxDimension:number; maxRenderTiles?:number; glyphCacheSlots:number; }
export interface VectorGlyph { code:number; advance:number; stroke:number; bounds:[number,number,number,number]; segments:CurveSegment[]; }
export interface VectorAlphabet { units:number; fallback?:number; glyphs:VectorGlyph[]; }
export interface PreparedFont {
 readonly format:'helion-opentype-1'; readonly family:string; readonly weight:number; readonly style:string; readonly units:1; readonly sourceUnits?:number;
 readonly ascent:number; readonly descent:number; readonly lineGap:number; readonly underlinePosition:number; readonly underlineThickness:number; readonly strikePosition:number; readonly strikeThickness:number;
 readonly cmap:Map<number,number>; readonly glyphs:{id:number;advance:number;bearing?:number;stroke:number;bounds:number[];segments:CurveSegment[]}[];
 readonly warnings:string[]; readonly sourceBytes:number; readonly diagnostic?:boolean;
}
export interface FontOptions { family?:string; weight?:number; style?:'normal'|'italic'|'oblique'; collectionIndex?:number; maxBytes?:number; maxPoints?:number; timeoutMs?:number; signal?:AbortSignal; }
export interface FontSource extends FontOptions { source:string|URL|Blob|ArrayBuffer|ArrayBufferView; }
export interface FontManifest { family:string; weight:number; style:string; glyphCount:number; mappedScalars:number; sourceBytes:number; warnings:string[]; diagnostic:boolean; }
/** Supply prepared fonts for real typography. With no font, synchronous compile() uses an explicit diagnostic alphabet; mount(view) loads a real font. */
export interface CompileOptions {textShaping?:'auto'|'simple'|'opentype';typographyOperationBudget?:number;theme?:string;themes?:readonly ControlTheme[];themeVariant?:'dark'|'light';themeContrast?:'standard'|'high';controlDensity?:'comfortable'|'compact';accentColor?:Color|null;templates?:Record<string,ControlTemplateDefinition>;reducedMotion?:boolean; inputInboxCapacity?:number; limits?:Partial<Limits>; fonts?:PreparedFont[]; font?:VectorAlphabet|PreparedFont; styles?:Styles; resources?:Record<string,unknown>; }
export class FontFormatError extends Error {}
export function parseOpenType(data:ArrayBuffer|ArrayBufferView,options?:FontOptions):PreparedFont;
export function loadFont(source:string|URL|Blob|ArrayBuffer|ArrayBufferView,options?:FontOptions):Promise<PreparedFont>;
export function loadFonts(sources?:ReadonlyArray<FontSource|PreparedFont>):Promise<PreparedFont[]>;
export const DEFAULT_FONT_SOURCES:ReadonlyArray<Readonly<FontSource>>;
export interface CompiledView { shapedTexts:import('./typography/index.js').PreparedRun[]; version:3; fonts:FontManifest[]; textMode:'opentype'|'diagnostic'; nodes:Uint8Array; state:Uint32Array; heap:Uint32Array; nodeCount:number; styleNodes?:number; extensions?:boolean; maxDepth:number; ids:Map<string,number>; paths:number; tables:{node:number;offset:number;rowCount:number;paddedCount:number;columns:number;source?:DataSourceManifest}[]; animations:number; limits:Limits; editors:EditorManifest[];docks:DockManifest[];models:ModelManifest[];modelRows:number;editorInbox:number;editorInboxCapacity:number;declarations:{id:string;type:ViewKind;index:number;depth:number;parent:number}[]; }
export interface StartupEvent { stage:string; detail:string; elapsedMs:number; done?:number; total?:number; }
export interface StartupOptions extends CompileOptions {
 fontSources?:ReadonlyArray<FontSource|PreparedFont>;
 /** Default true. CSP/worker-load failure uses the identical host compiler. */
 startupWorker?:boolean;
 /** Default false. Opt in with an application revision; stores ONE initial scene per origin. No local/prepared fonts or live GPU edits are persisted. */
 startupCache?:false|string;
 signal?:AbortSignal; onStartup?:(event:StartupEvent)=>void;
}
export interface StartupStats {
 status:string; startedAt:number; worker?:boolean; workerFallback?:string; cache?:string;
 fontMs?:number; compileMs?:number; cacheReadMs?:number; cacheDigestMs?:number; cacheWriteScheduled?:boolean;
 shaderCompilation?:'partitioned'|'monolithic'; shaderPrograms?:{name:string;bytes:number;entries:string[]}[];
 adapterAndShadersMs?:number; deviceMs?:number; shaderModulesMs?:number; pipelineMs?:number; pipelineConcurrency?:number;
 hudPipelineMs?:number; hudReadyMs?:number; firstHUDCompletedMs?:number; hudError?:string;
 pipelineEntries?:{name:string;startMs:number;elapsedMs:number}[];
 uploadAndBindingsMs?:number; mountMs?:number; firstSubmitMs?:number; firstCompletedMs?:number;
}
export interface SurfaceOptions extends StartupOptions {
 onAction?:(event:HostActionEvent)=>void|Promise<void>; editorChangeEvents?:boolean;
 onKey?:(event:KeyboardEvent)=>boolean|void; onEditorInput?:()=>void;
 /** Default native: physical pixels within explicit tile/dimension limits. balanced retains the 2048/DPR-2 cap. */
 resolutionMode?:'native'|'balanced';
 /** Default sharp: device-space source-curve coverage; reference retains flattened glyphs/filtered HUD. */
 textQuality?:'sharp'|'reference';
 powerPreference?:'high-performance'|'low-power'; pixelRatio?:number; autoStart?:boolean; input?:boolean; onError?:(error:Error)=>void;
 /** Default vsync: rAF-driven, bounded two-frame pipeline; ASAP is opt-in and yields between submissions. */
 submissionMode?:'vsync'|'asap';
 /** Default 2: independently acknowledged vsync submissions. Integer 1–32; explicit 0 restores unbounded reference mode. Does not limit ASAP. */
 maxFramesInFlight?:number;
 /** Default 8; integer 1–32. Independent bound for ASAP mode. */
 asapFramesInFlight?:number;
 /** Default 4; integer 1–32. Does not change shader code or optimization quality. */
 pipelineConcurrency?:number;
 /** Startup-only WGSL reachability partitions; monolithic is a diagnostic reference. */
 shaderCompilation?:'partitioned'|'monolithic';
 /** Deadlines in milliseconds; zero disables. They cannot preempt browser/driver work. */
 startupTimeoutMs?:number; pipelineTimeoutMs?:number; gpuWatchdogMs?:number;
 /** Default true: optional GPU HUD compiles after the first application frame. */
 deferHUD?:boolean;
 onDiagnosticsError?:(error:Error)=>void;
 /** Default frame combines clean-frame compute work. stages adds timestamp pass boundaries. */
 timingDetail?:'off'|'frame'|'stages';
 /** Default true; false selects the identical serial-row reference path for A/B qualification. */
 parallelGrid?:boolean;
 /** Default true; false uses a fullscreen texel-copy reference instead of the GPU-positioned HUD quad. Text/graphs stay in compute. */
 hudScissor?:boolean;
 performanceHUD?:boolean; profiling?:boolean; gpuTiming?:boolean; damageTracking?:boolean; glyphCache?:boolean;
}
export interface SurfaceStats {
 frames:number; actionReadbackBytes?:number; actionBackpressure?:number; uploadedBytes:number; initialUploadBytes:number; readbackBytes:number; submittedGraphs:number;
 completedFrames:number; skippedSubmissions:number; peakFramesInFlight:number; lastCompletionLatencyMs:number;
 cpuLayoutEncodeMs:number; cpuRenderEncodeMs:number; cpuEncodeMs:number; cpuSubmitMs:number; animationFrameCallbacks:number;
 rafCapacityDeferrals:number; duplicateRafCallbacks:number;
 rafSubmissions:number; asapSubmissions:number; completionCheckpoints:number; pendingAcknowledgements:number;
 /** Observed rAF callback cadence, zero while unknown; NOT scanout/display hardware Hz. */
 rafHz:number;
}
/** Startup-only asynchronous compilation. Full glyph geometry/metrics retained. */
export function prepare(view:View,options?:StartupOptions):Promise<CompiledView>;
/** Clear the single opt-in initial-scene cache. False when storage is unavailable. */
export function clearStartupCache():Promise<boolean>;
export interface CommandPayload { target?:number; x?:number; y?:number; a?:number; b?:number; c?:number; }
export interface Snapshot { state:Uint32Array; nodes?:Uint32Array; heap?:Uint32Array; stats:SurfaceStats; errors:string[]; }
export function h(type:ViewKind,props?:ViewProps,...children:Child[]):View;
export function h<P extends object>(component:(props:P & {children:Child[]})=>View,props:P,...children:Child[]):View;
export function compile(view:View,options?:CompileOptions):CompiledView;
export function fromHTML(element:Element|HTMLTemplateElement):View;
export function parsePath(path:string|CurveSegment[]):CurveSegment[];
export class GPUUnavailableError extends Error {}
export interface SurfaceResolution {
 width:number;height:number;dpr:number;w:number;h:number;tileCols:number;tileRows:number;
 requestedDpr:number;requestedW:number;requestedH:number;nativeResolution:boolean;devicePixelBox:boolean;
 resolutionMode:'native'|'balanced';maxTiles:number;limitedBy:'balanced-policy'|'configured-capacity'|null;
}
export class HelionSurface {
 template(name:string|number):TemplateController;setTheme(name:string,variant?:'light'|'dark'):this;setThemeContrast(value:'standard'|'high'):this;setControlDensity(value:'comfortable'|'compact'):this;setAccentColor(value:Color|null):this;setReducedMotion(value:boolean):this;
 static mount(canvas:HTMLCanvasElement,view:View|CompiledView|Element|HTMLTemplateElement,options?:SurfaceOptions):Promise<HelionSurface>;
 readonly textQuality:'sharp'|'reference'; readonly resolutionMode:'native'|'balanced';
 readonly resolution:SurfaceResolution;
 setTextQuality(value:'sharp'|'reference'):this; setResolutionMode(value:'native'|'balanced'):this;
 readonly hudReady:boolean; readonly hudError?:string;
 readonly maxFramesInFlight:number; readonly submissionMode:'vsync'|'asap'; readonly timingDetail:'off'|'frame'|'stages'; readonly lastSubmissionCompletion:Promise<void>;
 readonly ids:Map<string,number>; readonly startup:StartupStats; readonly stats:SurfaceStats; readonly errors:string[]; readonly disposed:boolean; readonly commands:CommandStream; readonly hudVisible:boolean; readonly gpuTiming:boolean; readonly manifest:Omit<CompiledView,'nodes'|'state'|'heap'>;
 designer(name:string|number):import('./designer/index.js').DesignerController;
 dataSource(name:string|number):DataSourceController; list(name:string|number):ListController;
 setText(name:string|number,text:string):this;
 attachSurface(name:string|number,view:View,options?:SurfaceOptions):Promise<HelionSurface|null>;
 detachSurface():this; /** Both zero selects GPU-derived Fit; otherwise use 32–4096 CSS-pixel design dimensions. */
  setPresenterSize(width:number,height:number):this;
 editor(name:string|number):EditorController; docking(name:string|number):DockController; model(name:string):ModelController;
 platformSnapshot<T>(task:()=>Promise<T>|T):Promise<T>;
 id(name:string|number):number; set(name:string|number,property:MutableProperty,value:number|boolean):this; send(kind:number,payload?:CommandPayload):this;
 controlAnimation(name:string|number,command:'start'|'pause'|'resume'|'stop'|'seek',seconds?:number):this;
 setMaxFramesInFlight(limit?:number):this; setSubmissionMode(mode?:'vsync'|'asap'):this; whenSubmittedWorkDone():Promise<void>;
 setTimingDetail(detail?:'off'|'frame'|'stages'):this; inspectFrameSync():FrameSyncSnapshot;
 inspectPerformance():Promise<PerformanceSnapshot>;
 start():void; stop():void; render(now?:number):boolean; setPerformanceHUD(visible?:boolean):this; focusTextInput():void; inspect(options?:{includeNodes?:boolean;includeHeap?:boolean}):Promise<Snapshot>; dispose():void;
}
export class CommandStream {
 constructor(capacity?:number,maxQueued?:number); readonly length:number; readonly capacity:number; readonly sentBytes:number; readonly coalesced:number;
 push(kind:number,payload?:CommandPayload):this;
 pushBulk(kind:number,payload:CommandPayload,data:Uint32Array,destinationWords:number):this;
 flush(queue:{writeBuffer(buffer:unknown,offset:number,data:ArrayBuffer,dataOffset:number,size:number):void},buffer:unknown,maxEvents?:number,heapBuffer?:unknown):{lastSequence:number;payloadBytes:number;count:number;caretCommands:number;discrete:boolean;bytes:number;layout:boolean;query:boolean;hitTest:boolean;actionCandidate:boolean};
}
export const Kind:Readonly<Record<ViewKind,number>>;
export const Action:Readonly<Record<ActionName,number>>;
export const Source:Readonly<Record<Metric,number>>;
export const Property:Readonly<Record<MutableProperty,number>>;
export const Opcode:Readonly<Record<'Move'|'Down'|'Up'|'Wheel'|'Key'|'Text'|'Set'|'Cancel'|'Animation'|'Editor'|'Dock'|'Model'|'Data'|'Controls'|'Designer',number>>;
export const Key:Readonly<Record<'Backspace'|'Tab'|'Enter'|'Escape'|'Space'|'End'|'Home'|'ArrowLeft'|'ArrowUp'|'ArrowRight'|'ArrowDown'|'Delete'|'PageUp'|'PageDown'|'A',number>>;
export const DEFAULT_LIMITS:Readonly<Limits>;
export const AUTO_TARGET:number;

export interface PerformanceSample {
 frame:number; submitIntervalMs:number; layoutMs:number; totalMs:number; gpuSpanMs:number|null; dataMs:number;
 phasesMs:Record<'input'|'layout'|'data'|'scene'|'glyph'|'sparse'|'hud'|'present',number>;
 cpuEncodeMs:number; uiRenderMs:number; passSumMs:number; gpuCompletionIntervalMs:number;
 /** Millisecond interval-set statistics, not hardware busy-time counters. */
 coveredMs:number; overlapMs:number; gapMs:number; computeCoveredMs:number;
 timingDetail:'off'|'frame'|'stages'; phaseMeaning:string; measuredPhaseMask:number; layoutExecuted:boolean;
}
export interface PerformanceSnapshot {
 schema:3; source:'gpu-elapsed-ranges'|'cpu-encoding-only'; submissionMode:'vsync'|'asap'; vsyncPacing:'bounded'|'unbounded';
 timingDetail:'off'|'frame'|'stages'; rawTimestampFrame:number;
 rawTimestamps:{phase:string;meaning:string;measured:boolean;startNs:string;endNs:string}[];
 sampleFrame:number; displayedSampleLag:string; submitFPS:number; gpuCompletionFPS:number|null; rafHz:number; rafBudgetMs:number;
 timestampErrors:number; current:PerformanceSample|null; history:PerformanceSample[];
}

export interface DurationSummary { count:number; min:number|null; median:number|null; p95:number|null; max:number|null; }
export interface FrameSyncSample {
 frame:number; source:'manual'|'raf'|'asap'; callbackStampMs:number; callbackArrivalMs:number;
 encodeStartMs:number; encodeEndMs:number; submitStartMs:number; submitEndMs:number;
 callbackOffsetMs:number|null; cpuEncodeMs:number; cpuSubmitMs:number;
}
export interface FrameSyncSnapshot {
 source:'host-monotonic-clock'; scope:string; samples:FrameSyncSample[];
 opportunities:{scope:string;counts:Record<'submitted'|'deferred-capacity'|'asap-observer'|'duplicate-callback'|'error',number>;
   samples:{callbackStampMs:number;callbackArrivalMs:number;outcome:string;submittedFrame:number|null;unacknowledgedBefore:number;admissionLimit:number}[];
   callbackIntervalMs:DurationSummary;callbackArrivalIntervalMs:DurationSummary};
 pacing:{policy:'bounded-latest-input'|'unbounded-reference';maxFramesInFlight:number;vsyncLimit:number;asapLimit:number;
   unacknowledgedFrames:number;pendingCheckpoints:number;acknowledgementStrategy:'independent-per-submission'|'sparse';note:string};
 submitIntervalMs:DurationSummary; cpuEncodeMs:DurationSummary; cpuSubmitMs:DurationSummary; callbackOffsetMs:DurationSummary;
 stats:SurfaceStats; submissionMode:'vsync'|'asap'; timingDetail:'off'|'frame'|'stages'; everyRaf:boolean;
 adapter:unknown; measuredRefresh:string; viewport:{width:number;height:number;dpr:number;w:number;h:number;tileCols:number;tileRows:number};
}

/** Layout authoring adapters. They do not perform CPU runtime layout. */
export type PointValue=[number,number];
export type RectValue=[number,number,number,number];
export type MatrixValue=[number,number,number,number,number,number];
export const Dock:Readonly<{Left:'left';Top:'top';Right:'right';Bottom:'bottom'}>;
export const Orientation:Readonly<{Horizontal:'horizontal';Vertical:'vertical'}>;
export const Stretch:Readonly<{None:'none';Fill:'fill';Uniform:'uniform';UniformToFill:'uniformToFill'}>;
export function Thickness(left?:number,top?:number,right?:number,bottom?:number):RectValue;
export function GridLength(value?:number,unit?:'auto'|'pixel'|'star'):TrackLength;
export function RowDefinition(height?:TrackLength,min?:number,max?:number):TrackDefinition;
export function ColumnDefinition(width?:TrackLength,min?:number,max?:number):TrackDefinition;
export function normalizeProperties(properties?:Record<string,unknown>):CanonicalViewProps;
export function propertyName(name:string):string;

export function Style(selector:string,setters:ViewProps):StyleRule;
export function StaticResource(key:string):ResourceReference;
export class ResourceDictionary {constructor(entries?:Record<string,unknown>);[name:string]:unknown;}
export function parseStyles(styles:Styles):StyleRule[];
export interface ParsedSelector {parts:{type:string;id?:string;classes:string[];required:number;forbidden:number;relation:string;specificity:number}[];specificity:number;}
export function parseSelector(selector:string):ParsedSelector;
export function matchesSelector(selector:string|ParsedSelector,node:View,ancestors?:View[]):boolean;
export function styleTree(view:View,options?:CompileOptions):View;
export const PseudoClass:Readonly<Record<'pointerover'|'hover'|'pressed'|'focus'|'checked'|'disabled'|'dark'|'light',number>>;
export const FluentTheme:string;

export const Easing:Readonly<Record<'Linear'|'Smooth'|'CubicIn'|'CubicOut'|'CubicInOut'|'SineInOut'|'BackOut'|'Spring'|'Step',EasingName>>;
export function KeyFrame<T=number>(cue:number,value:T,easing?:EasingName):KeyFrameValue<T>;
export interface KeyFrameAnimationOptions<T=number>{duration?:number;delay?:number;iterations?:number|'infinite';direction?:AnimationDirection;fillMode?:AnimationFill;keyFrames?:KeyFrameValue<T>[];}
export class ScalarKeyFrameAnimation<T=number>{constructor(options?:KeyFrameAnimationOptions<T>);duration:number;delay:number;iterations:number|'infinite';direction:AnimationDirection;fillMode:AnimationFill;keyFrames:KeyFrameValue<T>[];
 insertKeyFrame(cue:number,value:T,easing?:EasingName):this;InsertKeyFrame(cue:number,value:T,easing?:EasingName):this;toAnimation(property:CompositionProperty):Animation;}
export class Vector2KeyFrameAnimation extends ScalarKeyFrameAnimation<PointValue>{toAnimations(property:'Offset'|'Scale'|'offset'|'scale'):Animation[];}
export class CompositionAnimationGroup{constructor(...animations:(Animation|Animation[]|CompositionAnimationGroup)[]);add(animation:Animation|Animation[]|CompositionAnimationGroup):this;toAnimations():Animation[];}
export class Compositor{
 createScalarKeyFrameAnimation(options?:KeyFrameAnimationOptions):ScalarKeyFrameAnimation;
 createVector2KeyFrameAnimation(options?:KeyFrameAnimationOptions<PointValue>):Vector2KeyFrameAnimation;
 createAnimationGroup(...animations:(Animation|Animation[]|CompositionAnimationGroup)[]):CompositionAnimationGroup;
 CreateScalarKeyFrameAnimation(options?:KeyFrameAnimationOptions):ScalarKeyFrameAnimation;
 CreateVector2KeyFrameAnimation(options?:KeyFrameAnimationOptions<PointValue>):Vector2KeyFrameAnimation;
 CreateAnimationGroup(...animations:(Animation|Animation[]|CompositionAnimationGroup)[]):CompositionAnimationGroup;
}
export function bindExpression(property:CompositionProperty,source:string,options?:{scale?:number;offset?:number;min?:number;max?:number}):Animation;
export function transition(property:Transition['property'],duration?:number,easing?:EasingName):Transition;

export function Point(x?:number,y?:number):PointValue;
export function Rect(x?:number,y?:number,width?:number,height?:number):RectValue;
export function Matrix(m11?:number,m12?:number,m21?:number,m22?:number,offsetX?:number,offsetY?:number):MatrixValue;
export function TranslateTransform(x:number,y?:number):MatrixValue;
export function ScaleTransform(x:number,y?:number):MatrixValue;
/** Rotation in degrees. The scalar composition `rotation` property uses radians. */
export function RotateTransform(degrees:number):MatrixValue;
export function SkewTransform(x:number,y?:number):MatrixValue;
export function multiplyMatrices(a:MatrixValue,b:MatrixValue):MatrixValue;
export function TransformGroup(...matrices:MatrixValue[]):MatrixValue;
export interface Geometry{kind:'geometry';segments:CurveSegment[];bounds:RectValue;fillRule:'nonzero'|'evenodd';}
export function PathGeometry(path:string|CurveSegment[],fillRule?:Geometry['fillRule']):Geometry;
export function RectangleGeometry(rect:RectValue,radiusX?:number,radiusY?:number):Geometry;
export function EllipseGeometry(center:PointValue,radiusX:number,radiusY?:number):Geometry;
export function GeometryGroup(children:Geometry[],fillRule?:Geometry['fillRule']):Geometry;
export class StreamGeometry{constructor(fillRule?:Geometry['fillRule']);open():StreamGeometryContext;Open():StreamGeometryContext;toGeometry():Geometry;}
export class StreamGeometryContext{
 beginFigure(start:PointValue,isFilled?:boolean):this;lineTo(point:PointValue):this;quadraticBezierTo(control:PointValue,point:PointValue):this;cubicBezierTo(control1:PointValue,control2:PointValue,point:PointValue):this;
 arcTo(point:PointValue,radii:PointValue,rotation?:number,largeArc?:boolean,sweep?:'clockwise'|'counterclockwise'):this;endFigure(closed?:boolean):this;dispose():void;
 BeginFigure(start:PointValue,isFilled?:boolean):this;LineTo(point:PointValue):this;QuadraticBezierTo(control:PointValue,point:PointValue):this;CubicBezierTo(control1:PointValue,control2:PointValue,point:PointValue):this;BezierTo(control1:PointValue,control2:PointValue,point:PointValue):this;
 ArcTo(point:PointValue,radii:PointValue,rotation?:number,largeArc?:boolean,sweep?:'clockwise'|'counterclockwise'):this;EndFigure(closed?:boolean):this;Dispose():void;
}
export interface GradientStop{color:Color;offset:number;}
export type SpreadMethod='pad'|'repeat'|'reflect';
export type Brush=Color|{kind:'solid';color:Color;opacity:number}|{kind:'linear';stops:GradientStop[];start:PointValue;end:PointValue;spread:SpreadMethod}|{kind:'radial';stops:GradientStop[];center:PointValue;radius:PointValue;spread:SpreadMethod};
export interface Pen{brush:Brush;thickness:number;}
export interface FormattedText{text:string;fontSize:number;}
export interface ImageSource{width:number;height:number;pixels:Uint8Array;}
export interface GlyphRun{glyphIndices:number[];fontSize:number;baselineOrigin:PointValue;advances:number[]|null;offsets:PointValue[]|null;}
export function SolidColorBrush(color:Color,opacity?:number):Brush;
export function GradientStop(color:Color,offset:number):GradientStop;
export function LinearGradientBrush(stops:GradientStop[],start?:PointValue,end?:PointValue,spread?:SpreadMethod):Brush;
export function RadialGradientBrush(stops:GradientStop[],center?:PointValue,radius?:PointValue,spread?:SpreadMethod):Brush;
export function Pen(brush:Brush,thickness?:number):Pen;
export function FormattedText(text:string,options?:{fontSize?:number}):FormattedText;
export function ImageSource(width:number,height:number,pixels:ArrayLike<number>):ImageSource;
/** Indices refer to the selected primary face of the Drawing node, not Unicode scalars. */
export function GlyphRun(glyphIndices:ArrayLike<number>,options?:{fontSize?:number;baselineOrigin?:PointValue;advances?:number[]|null;offsets?:PointValue[]|null}):GlyphRun;
export interface RetainedDrawing{kind:'drawing';width:number;height:number;commands:Record<string,unknown>[];}
export interface DrawingOptions{width?:number;height?:number;maxCommands?:number;}
export interface DrawingScope{dispose():void;}
export class DrawingContext {
 constructor(options?:DrawingOptions);readonly width:number;readonly height:number;
 drawGeometry(brush:Brush|null,pen:Pen|null,geometry:Geometry|StreamGeometry|string):this;
 drawRectangle(brush:Brush|null,pen:Pen|null,rect:RectValue):this;
 drawRoundedRectangle(brush:Brush|null,pen:Pen|null,rect:RectValue,radiusX:number,radiusY?:number):this;
 drawEllipse(brush:Brush|null,pen:Pen|null,center:PointValue,radiusX:number,radiusY?:number):this;
 drawLine(pen:Pen,start:PointValue,end:PointValue):this;drawText(text:FormattedText|string,origin:PointValue,brush?:Brush):this;
 drawGlyphRun(brush:Brush,glyphRun:GlyphRun):this;drawImage(image:ImageSource,rect:RectValue):this;drawDrawing(drawing:RetainedDrawing|DrawingContext|DrawingGroup):this;
 pushTransform(matrix:MatrixValue):DrawingScope;pushClip(rect:RectValue):DrawingScope;pushOpacity(opacity:number):DrawingScope;pop():this;close():RetainedDrawing;toView(props?:ViewProps):View;
 DrawGeometry:DrawingContext['drawGeometry'];DrawRectangle:DrawingContext['drawRectangle'];DrawRoundedRectangle:DrawingContext['drawRoundedRectangle'];DrawEllipse:DrawingContext['drawEllipse'];DrawLine:DrawingContext['drawLine'];DrawText:DrawingContext['drawText'];DrawGlyphRun:DrawingContext['drawGlyphRun'];DrawImage:DrawingContext['drawImage'];DrawDrawing:DrawingContext['drawDrawing'];
 PushTransform:DrawingContext['pushTransform'];PushClip:DrawingContext['pushClip'];PushOpacity:DrawingContext['pushOpacity'];Pop:DrawingContext['pop'];Close:DrawingContext['close'];
}
export class DrawingGroup {constructor(options?:DrawingOptions);open():DrawingContext;Open():DrawingContext;toDrawing():RetainedDrawing;toView(props?:ViewProps):View;}
export function GeometryDrawing(brush:Brush|null,pen:Pen|null,geometry:Geometry|StreamGeometry|string):RetainedDrawing;
export function GlyphRunDrawing(brush:Brush,glyphRun:GlyphRun):RetainedDrawing;
export function parseColor(value:Color,fallback?:number):number;
export function ColorFromArgb(alpha:number,red:number,green:number,blue:number):number;
export const Color:Readonly<{Parse:typeof parseColor;FromArgb:typeof ColorFromArgb;FromRgb:(red:number,green:number,blue:number)=>number}>;


/** Experimental device-resident editors. All offsets are Unicode scalars, LF-only. */
export type EditorLanguageName='text'|'javascript'|'typescript'|'css'|'json'|'html'|'wgsl'|'markdown';
export type EditorCommandName='focus'|'undo'|'redo'|'selectAll'|'find'|'replace'|'findNext'|'findPrevious'|'replaceNext'|'replaceAll'|'goToLine'|'toggleWrap'|'toggleMinimap'|'toggleWhitespace'|'toggleComment'|'indent'|'outdent'|'duplicateLine'|'deleteLine'|'moveLineUp'|'moveLineDown'|'complete'|'acceptCompletion'|'addNextOccurrence'|'fold'|'unfoldAll'|'select'|'insertStaging'|'loadStaging'|'setSearch'|'cutRevision'|'zoom'|'toggleOverwrite'|'selectLine'|'selectWord'|'clearSelections'|'commandPalette'|'scrollToLine'|'insertInbox'|'insertSnippet'|'setReplacement';
export const EditorCommand:Readonly<Record<EditorCommandName,number>>;
export const EditorLanguage:Readonly<Record<EditorLanguageName,number>>;
export const EditorFlags:Readonly<Record<'readOnly'|'overwrite'|'wrap'|'minimap',number>>;
export interface CompletionItem {label:string;insertText:string;}
export interface EditorDocumentProps {
 text?:string;language?:EditorLanguageName;documentCapacity?:number;historyCapacity?:number;
 completions?:(string|CompletionItem)[];readOnly?:boolean;wordWrap?:boolean;minimap?:boolean;
 tabSize?:number;editorLineHeight?:number;lineNumbers?:boolean;renderWhitespace?:boolean;autoClosingBrackets?:boolean;
}
export interface CanonicalViewProps extends EditorDocumentProps {
 dockLayout?:DockLayout;title?:string;closed?:boolean;canClose?:boolean;
 models?:Record<string,GPUModelDefinition>;modelBind?:ModelBinding;
}
export function TextDocument(text?:string,options?:Omit<EditorDocumentProps,'text'>):EditorDocumentProps & {text:string};
export interface EditorManifest {node:number;pointer:number;capacity:number;lineCapacity:number;language:EditorLanguageName;staging:number;data:number;selectionPointer:number;changeAction?:string;}
export interface EditorSelection {caret:number;anchor:number;}
export interface DocumentSnapshot {
 text:string;codepoints:Uint32Array;length:number;revision:number;selectionRevision:number;selections:EditorSelection[];
 lineCount:number;visualLineCount:number;matches:number;matchesTruncated:boolean;diagnosticCount:number;
 rejectedEdits:number;historyResets:number;undoWords:number;capacity:number;language:EditorLanguageName;
 offsetUnit:'unicode-scalar';lineEnding:'LF';
}
export function decodeDocumentSnapshot(bytes:ArrayBuffer,meta:EditorManifest):DocumentSnapshot;
export class EditorController {
 constructor(surface:HelionSurface,name:string|number);readonly meta:EditorManifest;readonly id:number;
 command(name:EditorCommandName,a?:number,b?:number,flags?:number):this;focus():this;
 select(caret:number,anchor?:number,add?:boolean):this;insert(text:string):this;insertSnippet(template:string):this;
 replaceDocument(text:string):this;search(text:string,options?:{caseSensitive?:boolean;wholeWord?:boolean}):this;
 setReplacement(text:string):this;
 /** Explicit platform readback boundary, never a per-frame property getter. */
 snapshot():Promise<DocumentSnapshot>;selectedText():Promise<string>;copy(options?:{cut?:boolean}):Promise<string>;
}
export function clipboardFromSurface(surface:HelionSurface,cut?:boolean):Promise<string|undefined>;
export type DockLayout=DockTabLayout|DockSplitLayout;
export interface DockTabLayout {type:'tabs';panes:string[];active?:string;}
export interface DockSplitLayout {type:'split';orientation:'horizontal'|'vertical';ratio:number;first:DockLayout;second:DockLayout;}
export function DockTabs(panes:string[],active?:string):DockTabLayout;
export function DockSplit(orientation:'horizontal'|'vertical',ratio:number,first:DockLayout,second:DockLayout):DockSplitLayout;
export type DockCommandName='activate'|'close'|'reopen'|'float'|'dock'|'splitHorizontal'|'splitVertical'|'ratio'|'maximize';
export const DockCommand:Readonly<Record<DockCommandName,number>>;
export interface DockManifest {node:number;pointer:number;tree:number;panes:{node:number;id:string;pointer:number;subtreeNodes:number}[];}
export interface DockSnapshot {
 format:'helion-dock-layout-1';revision:number;root:number;
 nodes:{type:0|1;parent:number;first:number;second:number;ratio:number;axis:number;active:string|null}[];
 panes:{id:string;group:number;closed:boolean;floating:boolean;bounds:[number,number,number,number]}[];
}
export class DockController {
 constructor(surface:HelionSurface,name:string|number);readonly meta:DockManifest;
 command(name:DockCommandName,pane:string|number,argument?:number):this;
 snapshot():Promise<DockSnapshot>;restore(layout:DockSnapshot):Promise<this>;
}
export type ModelFieldType='f32'|'u32'|'i32'|'bool';
export type ModelExpression=number|boolean|{op:'field';name:string}|{op:'arg'}|{op:string;args:ModelExpression[]};
export interface GPUModelField {type:ModelFieldType;initial?:number|boolean|(number|boolean)[];expression?:ModelExpression;}
export interface GPUModelCommand {assign?:Record<string,ModelExpression>;canExecute?:ModelExpression;field?:string;value?:ModelExpression;}
export interface GPUModelDefinition {format:'helion-gpu-model-1';fields:Record<string,GPUModelField>;count:number;commands:Record<string,GPUModelCommand>;}
export function field(type?:ModelFieldType,initial?:number|boolean|(number|boolean)[]):GPUModelField;
export function computed(type:ModelFieldType,expression:ModelExpression):GPUModelField;
export function ref(name:string):ModelExpression;
export const expr:Readonly<{
 ref:typeof ref;arg:()=>ModelExpression;
 add:(a:ModelExpression,b:ModelExpression)=>ModelExpression;sub:(a:ModelExpression,b:ModelExpression)=>ModelExpression;
 mul:(a:ModelExpression,b:ModelExpression)=>ModelExpression;div:(a:ModelExpression,b:ModelExpression)=>ModelExpression;
 min:(a:ModelExpression,b:ModelExpression)=>ModelExpression;max:(a:ModelExpression,b:ModelExpression)=>ModelExpression;
 lt:(a:ModelExpression,b:ModelExpression)=>ModelExpression;le:(a:ModelExpression,b:ModelExpression)=>ModelExpression;
 gt:(a:ModelExpression,b:ModelExpression)=>ModelExpression;ge:(a:ModelExpression,b:ModelExpression)=>ModelExpression;
 eq:(a:ModelExpression,b:ModelExpression)=>ModelExpression;and:(a:ModelExpression,b:ModelExpression)=>ModelExpression;or:(a:ModelExpression,b:ModelExpression)=>ModelExpression;
 neg:(a:ModelExpression)=>ModelExpression;abs:(a:ModelExpression)=>ModelExpression;sin:(a:ModelExpression)=>ModelExpression;cos:(a:ModelExpression)=>ModelExpression;
 sqrt:(a:ModelExpression)=>ModelExpression;floor:(a:ModelExpression)=>ModelExpression;ceil:(a:ModelExpression)=>ModelExpression;round:(a:ModelExpression)=>ModelExpression;not:(a:ModelExpression)=>ModelExpression;
 clamp:(a:ModelExpression,min:ModelExpression,max:ModelExpression)=>ModelExpression;
 select:(condition:ModelExpression,yes:ModelExpression,no:ModelExpression)=>ModelExpression;
}>;
export function defineModel(fields:Record<string,GPUModelField>,options?:{count?:number;commands?:Record<string,GPUModelCommand>}):GPUModelDefinition;
/** View models share the same GPU storage/derived-field contract. */
export const defineViewModel:typeof defineModel;
export interface ModelBinding {model:string;field:string;row?:number;mode?:'oneWay'|'twoWay';property?:Exclude<MutableProperty,'textClear'>;}
export function modelBinding(model:string,field:string,options?:Omit<ModelBinding,'model'|'field'>):ModelBinding;
export interface ModelManifest {name:string;index:number;node:number;pointer:number;count:number;fields:{name:string;index:number;type:ModelFieldType;data:number;computed:boolean}[];commands:string[];}
export interface ModelSnapshot {name:string;start:number;count:number;fields:Record<string,number[]|boolean[]>;errors:number[];revisions:number[];}
export class ModelController {
 constructor(surface:HelionSurface,name:string);readonly meta:ModelManifest;
 set(field:string,value:number|boolean,row?:number):this;execute(command:string,arg?:number,row?:number):this;
 snapshot(options?:{start?:number;count?:number}):Promise<ModelSnapshot>;
}

/** Mutable keyed ItemsSource. Data ingestion is explicit; live rows remain GPU-owned. */
export type DataRow=Record<string,unknown>;
export interface DataSourceOptions {
 rows?:DataRow[];columns?:Column[];key?:string;capacity?:number;stringCapacity?:number;inboxCapacity?:number;
}
export interface DataSourceDescriptor extends Required<DataSourceOptions>{format:'helion-data-source-1';}
export const DataSourceFormat:'helion-data-source-1';
export function dataSource(options?:DataSourceOptions):DataSourceDescriptor;
export const createDataSource:typeof dataSource;
export function normalizeItemsSource(value:DataRow[]|DataSourceDescriptor,props?:{dataColumns?:Column[];rowKey?:string;rowCapacity?:number}):DataSourceDescriptor;
export function valueAt(row:unknown,path:string):unknown;
export function validateFieldPath(path:string):string;
export type DataOperation={type:'upsert';row:DataRow;key?:number}|{type:'patch';key:number;row:DataRow}|{type:'remove';key:number}|{type:'clear'};
export interface DataRevision {expectedRevision?:number|null;}
export interface DataSourceManifest {pointer:number;capacity:number;key:string;dataColumns:Column[];rows:number;table:number;inbox:number;inboxCapacity:number;stringCapacity:number;}
export interface DataSourceSnapshot {rows:DataRow[];revision:number;rejectedOperations:number;lastResult:number;lastSequence:number;capacity:number;selectedKey:number|null;usedStringWords:number;stringCapacity:number;stringCompactions:number;}
export function encodeDataBatch(meta:DataSourceManifest,operations:DataOperation[],options?:DataRevision):Uint32Array;
export class DataSourceController {
 constructor(surface:HelionSurface,name:string|number);readonly id:number;readonly meta:DataSourceManifest;
 batch(operations:DataOperation[],options?:DataRevision):this;upsert(rows:DataRow|DataRow[],options?:DataRevision):this;
 patch(key:number,row:DataRow,options?:DataRevision):this;remove(keys:number|number[],options?:DataRevision):this;
 clear(options?:DataRevision):this;replace(rows:DataRow[],options?:DataRevision):this;
 sort(column:string|number,direction?:'ascending'|'descending'):this;select(key:number):this;
 /** Explicit, producer-barriered snapshot, never a normal-frame poll. */
 snapshot():Promise<DataSourceSnapshot>;
}
export interface ListItem {key?:number;label?:string;text?:string;disabled?:boolean;expanded?:boolean;children?:(ListItem|string)[];}
export interface ListLimits {capacity?:number;textCapacity?:number;}
export interface ListManifest {node:number;pointer:number;capacity:number;textCapacity:number;inbox:number;inboxCapacity:number;}
export function normalizeItems(items:(ListItem|string)[],limits?:ListLimits):{items:{key:number;text:number[];parent:number;depth:number;flags:number}[];chars:number;};
export function encodeListItems(items:(ListItem|string)[],limits?:ListLimits):Uint32Array;
export class ListController {
 constructor(surface:HelionSurface,name:string|number);readonly id:number;readonly meta:ListManifest;
 replace(items:(ListItem|string)[]):this;select(key:number):this;toggle(key:number):this;
 snapshot():Promise<{count:number;visibleCount:number;selectedKey:number|null;revision:number;rejectedUpdates:number}>;
}
export interface HostActionEvent {name:string;target:number;sequence:number;value:number;key:number;frame:number;}
export function hostAction(name:string,value?:number):GPUAction & {type:'host';name:string;value:number};
export const ACTION_EVENT_CAPACITY:520;
export const ACTION_OUTBOX_BYTES:number;
export function Toolbar(props:ViewProps,...children:Child[]):View;
export function StatusBar(props:ViewProps,...children:Child[]):View;
export function Menu(props:ViewProps):View;
export function ToggleButton(props:ViewProps):View;
export function Separator(props:ViewProps):View;
export function Popup(props:ViewProps,...children:Child[]):View;
export function Dialog(props:ViewProps,...children:Child[]):View;
export interface CanonicalViewProps {
 itemsSource?:DataRow[]|DataSourceDescriptor;dataSource?:DataSourceDescriptor;rowKey?:string;rowCapacity?:number;
 items?:(ListItem|string)[];itemCapacity?:number;itemTextCapacity?:number;textCapacity?:number;
 presenterWidth?:number;presenterHeight?:number;
 /** Device revision notification; delivery is opt-in through editorChangeEvents/onAction. */
 changeAction?:string;
}
export interface CompiledView { shapedTexts:import('./typography/index.js').PreparedRun[];
 lists:ListManifest[];labels:{node:number;capacity:number;text:number}[];
 presenters:{node:number;pointer:number;width:number;height:number}[];
 hostActions:string[];actionOutbox:number;
}

export * from './designer/index.js';
export interface CanonicalViewProps {
 designDocument?:import('./designer/index.js').DesignProject;
 designTarget?:string;designRole?:'properties'|'resources'|'states'|'grid';
}
export interface CompiledView { shapedTexts:import('./typography/index.js').PreparedRun[];designers:import('./designer/index.js').DesignManifest[];}

export interface CompiledView { shapedTexts:import('./typography/index.js').PreparedRun[];templates:TemplateManifest[];templateSystem:TemplateSystemManifest|null;templateLevels:number;templateLayout:boolean;}
export * from './typography/index.js';
