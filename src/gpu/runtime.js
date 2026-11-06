import {TemplateController} from '../templates/index.js';
import {startupScope,boundedWait,timeoutOption} from '../startup/lifecycle.js';
import {ProgressWatchdog} from './progress-watchdog.js';
import {DesignerController} from '../designer/index.js';
import {resolveViewport, pixelObservation, resolutionMode, textQuality} from './viewport.js';
import {ListController,ActionBridge} from '../controls/index.js';
import {DataSourceController} from '../data/index.js';
import {EditorController,clipboardFromSurface} from '../editor/index.js';
import {DockController} from '../docking/index.js';
import {ModelController} from '../models/index.js';
import { fromHTML, validatedLimits } from '../core/compiler.js';
import { rgba, align, VERSION, Opcode, Property } from '../core/schema.js';
import { CommandStream } from '../core/protocol.js';
import { BrowserInput } from '../platform/input.js';
import { prepareGPU } from './pipeline-library.js';
import {viewFeatures} from './view-features.js';
import { prepareView } from '../startup/prepare.js';
import { FrameCadence } from './cadence.js';
import { FrameGate, mergePlan } from './frame-gate.js';
import { QueueProgress } from './queue-progress.js';
import { arenaLayout, DRAW_HEADS } from './arena-layout.js';
import { SubmissionTasks, submissionMode } from './submission.js';
import { METRICS_BYTES, TIMESTAMP_COUNT, packFrameInterval, decodePerformance, timingDetail } from './performance.js';

import { FrameSyncLog, FrameOpportunityLog } from './frame-sync.js';

const RELAY_FRAME_WORD=67588;
// Each FIFO boundary completes its GPU jobs before input resumes. Feature
// filtering happens once at mount, never by reading live focus/control state.
const INPUT_STAGES = ['applyDockInput','finishDesignerEdit','applyDesignerInput',
  'applyDesignerSurfaceInput','applyDesignerTreeInput','applyDesignerInspectorInput','applyDesignerTimelineInput','applyDesignerColorInput',
  'applyCoreKey','applyEditorInput','applyInputActions','applyEditorCommands','finishDesignerEdit',
  ...Array.from({length:7},(_,i)=>`applyDesignerCommands${i}`),'prepareTextInput','input'];
const DESIGNER_EMISSION = ['Surface','Tree','Inspector','Resources','States','Tracks','Timeline','Colors','Adorner'].map(role=>`emitDesigner${role}`);
const CONTROL_EMISSION = ['emit','emitTextBlock','emitButton','emitCheckBox','emitTextBox','emitDrawingNode','emitDockNode'];
const ONE_GROUP = [1];

export class GPUUnavailableError extends Error { constructor(message) { super(message); this.name = 'GPUUnavailableError'; } }
export class HelionSurface {
  static async mount(canvas, view, options = {}) {
    if (['file:', 'data:'].includes(globalThis.location?.protocol)) throw new GPUUnavailableError('Helion requires localhost or HTTPS. Run the package launcher or serve the extracted folder; direct file/data launches have isolated browser origins.');
    if (!globalThis.navigator?.gpu) throw new GPUUnavailableError('WebGPU is unavailable. Use a WebGPU-enabled browser on localhost or HTTPS. There is deliberately no CPU-rendered substitute.');
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('Expected a canvas');
    if (view?.nodeType || view?.content) view = fromHTML(view);
    if (view?.nodes && view.version !== VERSION) throw new TypeError(`Compiled ABI ${view.version} is incompatible with ABI ${VERSION}; recompile the declarations.`);
    const begin = performance.now(), startup = { status: 'preparing', startedAt: begin }, startupObserver = options.onStartup;
    let scope;
    const report = (stage, detail, extra = {}) => {
      scope?.stage(stage); startup.stage=stage; startup.detail=detail;
      const event = { stage, detail, elapsedMs: performance.now() - begin, ...extra };
      try { startupObserver?.(event); } catch (error) { console.warn('Helion startup observer failed', error); }
    };
    new FrameGate(options.maxFramesInFlight ?? 2);
    const asapLimit = options.asapFramesInFlight ?? 8;
    if (!Number.isInteger(asapLimit) || asapLimit < 1 || asapLimit > 32) throw new RangeError('asapFramesInFlight must be 1–32');
    submissionMode(options.submissionMode); timingDetail(options.timingDetail); resolutionMode(options.resolutionMode); textQuality(options.textQuality); // validate before GPU allocation
    if(options.pixelRatio!=null && (!Number.isFinite(options.pixelRatio)||options.pixelRatio<=0)) throw new RangeError('pixelRatio must be a positive finite number');
    const limits = validatedLimits(view?.nodes ? view.limits : options.limits);
    timeoutOption(options.pipelineTimeoutMs,30000,'pipelineTimeoutMs');
    timeoutOption(options.gpuWatchdogMs,10000,'gpuWatchdogMs');
    if(options.shaderCompilation!=null&&!['partitioned','monolithic'].includes(options.shaderCompilation))throw new TypeError('shaderCompilation must be partitioned or monolithic');
    scope=startupScope(options);options={...options,signal:scope.signal};
    report('start', 'Preparing fonts and GPU pipelines in parallel');
    // Fail fast and cancel the sibling path. A hung native promise must not
    // keep the font worker/device alive after its peer has already failed.
    let gpu, surface;
    try {
      const gpuTask = prepareGPU(limits, {...options,viewFeatures:viewFeatures(view,options)}, startup, report);
      gpuTask.then(value=>{if(scope.signal.aborted)value.device.destroy();else gpu=value;},()=>{});
      const sceneTask = view?.nodes ? Promise.resolve({compiled:view,stats:{cache:'precompiled',worker:false}}) : prepareView(view,options,report);
      const [prepared,scene] = await Promise.all([
        boundedWait(gpuTask,{signal:scope.signal,stage:'GPU preparation'}),
        boundedWait(sceneTask,{signal:scope.signal,stage:'scene preparation'})
      ]);
      gpu=prepared;Object.assign(startup,scene.stats);
      surface=new HelionSurface();surface.device=gpu.device;surface.startup=startup;surface.reportStartup=report;
      report('upload','Uploading the complete retained scene');const started=performance.now();
      await boundedWait(surface.initialize(canvas,scene.compiled,gpu,options),{signal:scope.signal,stage:'scene upload'});
      startup.uploadAndBindingsMs=performance.now()-started;startup.mountMs=performance.now()-begin;startup.status='initialized';
      report('initialized','Pipelines ready; waiting for the first full-quality frame');
      return surface;
    } catch(error) {
      startup.status='failed';startup.error=error.message;scope.abort(error);
      surface?.dispose();gpu?.device.destroy();throw error;
    } finally { scope.dispose(); }
  }

  async initialize(canvas, compiled, gpu, options) {
    // Do not keep a CPU-side outline/shaping asset mirror alive through event closures.
    options = Object.fromEntries(Object.entries(options).filter(([key]) => !['fonts', 'font', 'fontSources', 'signal', 'onStartup'].includes(key)));
    this.preparedFeatures=viewFeatures(compiled);this.gpuTemplate=gpu;this.ownsDevice=options.borrowedDevice!==true;this.canvas = canvas; this.options = options; this.adapterInfo = gpu.adapter.info; this.disposed = false; this.running = false; this.faulted = false;
    this.resolutionMode = resolutionMode(options.resolutionMode); this.textQuality = textQuality(options.textQuality);
    this.submissionMode = submissionMode(options.submissionMode); this.timingDetail = timingDetail(options.timingDetail);
    this.frameSyncLog = new FrameSyncLog(); this.opportunityLog = new FrameOpportunityLog();
    this.callbackStamp = NaN; this.callbackArrival = NaN; this.lastRafStamp = null; this.raf = null;
    this.vsyncLimit = options.maxFramesInFlight ?? 2;
    this.asapLimit = options.asapFramesInFlight ?? 8;
    this.gate = new FrameGate(this.submissionMode === 'asap' ? this.asapLimit : this.vsyncLimit);
    this.cadence = new FrameCadence(); this.tasks = new SubmissionTasks(); this.inAnimationFrame = false;
    this.acknowledgedSerial = 0;
    this.lastSubmitStamp = null; this.metricsResetPending = true;
    this.hudVisible = options.performanceHUD === true; this.profiling = this.hudVisible || options.profiling === true;
    this.gpuTimingAvailable = gpu.gpuTiming; this.gpuTiming = gpu.gpuTiming && this.timingDetail !== 'off';
    this.prepareHUD = gpu.prepareHUD; this.hudReady = !!gpu.presentPipeline;
    this.drawIndex = 0; this.deferredRender = false;
    this.resources = []; this.errors = []; this.stats = { frames: 0, uploadedBytes: 0, initialUploadBytes: 0, readbackBytes: 0, submittedGraphs: 0, completedFrames: 0, skippedSubmissions: 0, peakFramesInFlight: 0, lastCompletionLatencyMs: 0, cpuLayoutEncodeMs: 0, cpuRenderEncodeMs: 0, animationFrameCallbacks: 0, rafHz: 0, rafSubmissions: 0, asapSubmissions: 0, completionCheckpoints: 0, cpuEncodeMs: 0, cpuSubmitMs: 0, pendingAcknowledgements: 0, rafCapacityDeferrals: 0, duplicateRafCallbacks: 0 };
    const { nodes, state, heap, ...manifest } = compiled; this.manifest = manifest; this.ids = manifest.ids;
    this.actionBridge=new ActionBridge(this);this.commands = new CommandStream(); this.frameBytes = new ArrayBuffer(64); this.frameF = new Float32Array(this.frameBytes); this.frameU = new Uint32Array(this.frameBytes);
    const limits = manifest.limits = validatedLimits(manifest.limits);
    if (limits.maxTileEntries !== 256) throw new RangeError('This kernel requires exactly 256 tile entries; other capacities need a shader variant');
    const { constants: c, scratchBytes, drawBytes, glyphCacheBytes } = arenaLayout(limits);
    const largest = Math.max(scratchBytes, heap.byteLength, drawBytes, glyphCacheBytes);
    if (largest > gpu.requiredLimits.maxStorageBufferBindingSize || largest > gpu.requiredLimits.maxBufferSize) throw new GPUUnavailableError('Compiled scene exceeds the requested device storage-buffer limits.');
    this.constants = c; this.device = gpu.device;
    const device = this.device;
    this.progress = new QueueProgress(device.queue, {
      onComplete: event => this.acknowledgeFrame(event),
      onError: error => {
        if (!this.disposed && !this.faulted) {
          this.faulted = true; this.errors.push(error.message); this.stop(); this.options.onError?.(error);
        }
      }
    });
    this.watchdog=new ProgressWatchdog({timeoutMs:options.gpuWatchdogMs??10000,onStall:info=>{
      if(this.disposed||this.faulted)return;
      const error=new Error(`GPU progress notifications stopped for ${Math.round(info.notificationGapMs)} ms (submitted ${info.submitted}, acknowledged ${info.acknowledged}). Helion stopped submitting frames. This is a host notification timeout, not a measured GPU duration. Reload to restart; unsaved GPU edits are not automatically recovered.`);
      this.faulted=true;this.errors.push(error.message);this.stop();this.options.onError?.(error);
    }});
    this.uncapturedError=event=>{if(this.disposed)return;this.errors.push(event.error.message);this.faulted=true;this.stop();options.onError?.(event.error);};device.addEventListener('uncapturederror',this.uncapturedError);
    device.lost.then(info => { if (!this.disposed) { this.faulted = true; this.stop(); options.onError?.(new Error(`WebGPU device lost: ${info.message}. Mutable state was GPU-owned; remount from application data to recover.`)); } });
    this.frameBuffer = this.buffer('Frame clock / viewport', 64, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    this.nodeBuffer = this.storage('Retained view tree', nodes);
    this.stateBuffer = this.storage('GPU-owned interaction and composition state', state);
    this.heapBuffer = this.storage('Resident strings, curves, rows and query indexes', heap);
    this.drawBuffers = [0, 1].map(i => this.buffer(`Retained GPU display list ${i}`, drawBytes, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC));
    this.drawBuffer = this.drawBuffers[0];
    this.scratchBuffer = this.buffer('Sparse jobs, strips, boundary alpha and tile bins', scratchBytes, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.indirectBuffer = this.buffer('GPU-generated dispatch arguments', 128, GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_SRC);
    this.forwardedBuffer=options.inputBridge||this.buffer('GPU cross-surface input relay',manifest.presenters?.length?(RELAY_FRAME_WORD+16)*4:16,GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST);
    this.emptyPreview=device.createTexture({label:'Unattached presenter',size:[1,1],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING});
    this.glyphCacheBuffer = this.buffer('Resident exact-coverage glyph LRU cache', glyphCacheBytes, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.eventBuffer = this.buffer('32-byte input command packet', 256 * 32, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    const stageRecords = [[0, 0, 0, 0]]; this.depthStages = []; this.intrinsicStages = [];
    for (let depth = 0; depth <= manifest.maxDepth; depth++) {
      this.depthStages.push(stageRecords.length * 256); stageRecords.push([depth, 0, 0, 0]);
      this.intrinsicStages.push(stageRecords.length * 256); stageRecords.push([depth, 1, 0, 0]);
    }
    this.sortStages = [];
    const rowCapacity = manifest.tables[0]?.paddedCount || 1;
    for (const record of mergePlan(rowCapacity)) { this.sortStages.push(stageRecords.length * 256); stageRecords.push(record); }
    const stageData = new Uint32Array(stageRecords.length * 64); stageRecords.forEach((v, i) => stageData.set(v, i * 64));
    this.stageBuffer = this.buffer('Immutable dispatch parameters', stageData.byteLength, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    device.queue.writeBuffer(this.stageBuffer, 0, stageData); this.stats.initialUploadBytes += stageData.byteLength;
    this.shaders = gpu.shaders; this.shaderSource = gpu.source; this.pipelines = new Map([...gpu.pipelines].map(([name,p])=>[name,{...p}]));
    this.inputStages = INPUT_STAGES.filter(name=>this.pipelines.has(name));
    this.emissionStages = CONTROL_EMISSION.filter(name=>this.pipelines.has(name));
    this.presentPipeline = gpu.presentPipeline; this.hudFullscreenPipeline = gpu.hudFullscreenPipeline; this.blitPipeline = gpu.blitPipeline; this.metricsPipeline = gpu.metricsPipeline; this.hudPipelines = gpu.hudPipelines;
    this.context = options.offscreen?{configure(){},unconfigure(){}}:canvas.getContext('webgpu'); if (!this.context) throw new GPUUnavailableError('Could not create a WebGPU canvas context');
    this.format = gpu.format; this.context.configure({ device, format: this.format, alphaMode: 'opaque' });
    this.metricsBuffer = this.buffer('GPU-resident FPS and 120-frame timing history', METRICS_BYTES, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.timingBuffer = this.buffer('GPU timestamp results (never CPU mapped)', TIMESTAMP_COUNT * 8, GPUBufferUsage.STORAGE | (this.gpuTimingAvailable ? GPUBufferUsage.QUERY_RESOLVE : 0));
    if (this.gpuTimingAvailable) this.querySet = device.createQuerySet({ type: 'timestamp', count: TIMESTAMP_COUNT });
    this.metricsBindGroup = device.createBindGroup({ layout: this.metricsPipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: this.frameBuffer } }, { binding: 1, resource: { buffer: this.timingBuffer } }, { binding: 2, resource: { buffer: this.metricsBuffer } }, { binding: 3, resource: { buffer: this.stateBuffer } }
    ] });
    // Isolated HUD coverage does not evict application glyphs. Buffers start zeroed;
    // all glyph masks, formatted values and bin contents are generated on the GPU.
    this.hudFontBuffer = this.buffer('HUD native-resolution font coverage', 820484, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.hudDrawBuffer = this.buffer('HUD glyph instances and spatial bins', 56840, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
    this.hudBindGroups = new Map();
    this.rebuildHudBindings();
    this.hudFontDirty = true;
    this.resize();
    const init = device.createCommandEncoder({ label: 'One-time GPU asset preparation' }); const pass = init.beginComputePass();
    this.dispatch(pass, 'flatten', [Math.ceil(manifest.paths / 64)]);
    if (manifest.tables.length) this.dispatch(pass, 'initializeData', [Math.ceil(manifest.tables[0].rowCount / 128)]);
    pass.end(); device.queue.submit([init.finish()]);
    this.input = options.input === false ? null : new BrowserInput(canvas, this.commands, () => this.invalidate(), {...options,onText:text=>{options.onEditorInput?.();if(!manifest.editorInbox||text.length<2)return false;const data=Uint32Array.from(String(text).replace(/\r\n?/g,'\n'),c=>c.codePointAt(0));if(data.length>manifest.editorInboxCapacity){options.onDiagnosticsError?.(new RangeError('Paste exceeds reserved editor capacity'));return true;}if(data.some(c=>c>=0xd800&&c<=0xdfff)){options.onDiagnosticsError?.(new TypeError('Input contains an unpaired surrogate'));return true;}this.commands.pushBulk(Opcode.Editor,{c:38,a:data.length},data,manifest.editorInbox);this.invalidate();return true;},onClipboard:(cut)=>clipboardFromSurface(this,cut).catch(error=>options.onDiagnosticsError?.(error))});
    if (!options.offscreen) {
      this.resizeObserver = new ResizeObserver(entries => {
        const entry = entries?.find(e => e.target === canvas);
        this.pixelObservation = pixelObservation(entry); this.resizePending = true;
        this.input?.refreshBounds(); if (options.autoStart !== false || this.running) this.invalidate();
      });
      try { this.resizeObserver.observe(canvas, {box:'device-pixel-content-box'}); }
      catch { this.resizeObserver.observe(canvas); }
    }
    this.abort = new AbortController(); document.addEventListener('visibilitychange', () => {
      this.cadence.reset(); this.lastRafStamp = null; this.resetMeasurements();
      this.watchdog?.suspend(document.hidden);
      if (document.hidden) { this.tasks.cancel(); if (this.raf != null) cancelAnimationFrame(this.raf); this.raf = null; }
      else if (this.running || this.deferredRender || (options.autoStart !== false && this.commands.length)) this.invalidate();
    }, { signal: this.abort.signal });
    this.first = true; this.running = options.autoStart !== false; this.startTime = performance.now(); this.lastTime = this.startTime;
    if (this.running) this.invalidate();
  }
  buffer(label, size, usage) { const b = this.device.createBuffer({ label, size: Math.max(4, align(size, 4)), usage }); this.resources.push(b); return b; }
  storage(label, data) { const b = this.buffer(label, data.byteLength, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC); this.device.queue.writeBuffer(b, 0, data); this.stats.initialUploadBytes += data.byteLength; return b; }
  rebuildBindings() {
    // Scope this cache to one rebuild: resize/presenter replacement must bind
    // the new textures, and different surfaces must never share mutable arenas.
    const groups = new Map();
    for (const value of this.pipelines.values()) {
      if (!groups.has(value.layout)) groups.set(value.layout, [0, 1].map(index => {
        const buffers = [this.frameBuffer, this.nodeBuffer, this.stateBuffer, this.heapBuffer, this.drawBuffers[index], this.scratchBuffer, this.indirectBuffer, this.eventBuffer];
        return this.device.createBindGroup({ layout: value.layout, entries: value.used.map(({ binding }) => ({ binding,
          resource: binding===12?(this.embedded?.surface.output??this.emptyPreview).createView():binding===13?{buffer:this.forwardedBuffer}:binding === 8 ? this.output.createView() : binding === 9 ? { buffer: this.stageBuffer, offset: 0, size: 16 } :
            { buffer: binding === 11 ? this.glyphCacheBuffer : binding === 10 ? this.drawBuffers[1 - index] : buffers[binding] }
        })) });
      }));
      value.bindGroups = groups.get(value.layout);
    }
    this.blitBindGroup = this.device.createBindGroup({ layout: this.blitPipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: this.output.createView() }, { binding: 3, resource: { buffer: this.stateBuffer } }
    ] });
    this.rebuildHudPresentationBindings();
  }
  rebuildHudPresentationBindings() {
    if (!this.hudReady || !this.hudOutput || !this.output) return;
    const device=this.device;
    this.hudCompositeBindGroup=device.createBindGroup({layout:this.hudPipelines.get('compositeHud').getBindGroupLayout(0),entries:[
      {binding:0,resource:this.output.createView()}, {binding:1,resource:{buffer:this.metricsBuffer}},
      {binding:2,resource:{buffer:this.frameBuffer}}, {binding:3,resource:{buffer:this.stateBuffer}},
      {binding:4,resource:{buffer:this.hudFontBuffer}}, {binding:5,resource:{buffer:this.hudDrawBuffer}},
      {binding:6,resource:{buffer:this.heapBuffer}}, {binding:7,resource:this.hudOutput.createView()}
    ]});
    this.presentBindGroup=device.createBindGroup({layout:this.presentPipeline.getBindGroupLayout(0),entries:[
      {binding:0,resource:this.hudOutput.createView()}, {binding:2,resource:{buffer:this.frameBuffer}}
    ]});
    this.hudFullscreenBindGroup=device.createBindGroup({layout:this.hudFullscreenPipeline.getBindGroupLayout(0),entries:[
      {binding:0,resource:this.hudOutput.createView()}, {binding:1,resource:this.output.createView()},
      {binding:2,resource:{buffer:this.frameBuffer}}, {binding:3,resource:{buffer:this.stateBuffer}}
    ]});
  }
  resizeHudOutput() {
    if (!this.hudReady || !this.viewport) return;
    const v=this.viewport, ratio=v.dpr*Math.max(.01,Math.min(1,(v.width-16)/420,(v.height-16)/338));
    // Conservative allocation only. Actual panel origin/extent and quad are GPU-derived.
    const w=Math.max(1,Math.min(v.w,Math.ceil(448*ratio)+8)), h=Math.max(1,Math.min(v.h,Math.ceil(366*ratio)+8));
    if (this.hudOutput && this.hudOutputSize[0]===w && this.hudOutputSize[1]===h) return;
    const old=this.hudOutput; this.hudOutputSize=[w,h];
    this.hudOutput=this.device.createTexture({label:'Compute HUD panel',size:[w,h],format:'rgba8unorm',usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_SRC});
    this.rebuildHudPresentationBindings(); old?.destroy();
  }

  rebuildHudBindings() {
    const resources = [this.frameBuffer, this.heapBuffer, this.stateBuffer, this.hudFontBuffer, this.metricsBuffer, this.hudDrawBuffer];
    this.hudBindGroups = new Map([...this.hudPipelines].filter(([entry])=>entry!=='compositeHud').map(([entry, pipeline]) => [entry, this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0), entries: (entry === 'rasterHudFont' ? [0, 1, 2, 3] : [0, 3, 4, 5]).map(binding => ({ binding, resource: { buffer: resources[binding] } }))
    })]));
  }
  /** Lazily compile the diagnostic UI after the first application frame. It never
   * blocks admission, remounts the view, substitutes fonts, or changes output DPR. */
  ensureHUD() {
    if (this.hudReady || !this.hudVisible || this.disposed || this.faulted || this.hudError) return Promise.resolve();
    if (this.hudPreparation) return this.hudPreparation;
    this.hudPreparation = this.prepareHUD().then(hud => {
      if (this.disposed || this.faulted) return;
      this.presentPipeline = hud.presentPipeline; this.hudFullscreenPipeline = hud.hudFullscreenPipeline; this.hudPipelines = hud.hudPipelines; this.hudReady = true;
      this.rebuildHudBindings(); this.resizeHudOutput(); this.rebuildBindings(); this.hudFontDirty = true;
      this.startup.hudReadyMs = performance.now() - this.startup.startedAt;
      this.reportStartup('hud-ready', 'GPU diagnostics ready');
      if (this.running) this.invalidate();
    }).catch(error => {
      if (this.disposed) return;
      // A diagnostic compiler failure must not hide or stop the working UI.
      this.hudError = error.message; this.startup.hudError = error.message;
      this.reportStartup('hud-error', error.message); console.error('Helion GPU HUD unavailable:', error);
      try { this.options.onDiagnosticsError?.(error); } catch (observerError) { console.warn('Helion diagnostics observer failed:', observerError); }
    });
    return this.hudPreparation;
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.observedDeviceDpr = globalThis.window?.devicePixelRatio || 1;
    this.viewport = resolveViewport(rect, this.manifest.limits, {
      pixelRatio:this.options.pixelRatio, devicePixelRatio:this.observedDeviceDpr,
      resolutionMode:this.resolutionMode, observation:this.pixelObservation,
      maxTextureDimension2D:this.device.limits?.maxTextureDimension2D ?? 8192
    });
    const {width,height,dpr,w,h} = this.viewport;
    if (!this.output || this.canvas.width !== w || this.canvas.height !== h) {
      const old = this.output; this.canvas.width = w; this.canvas.height = h;
      this.output = this.device.createTexture({ label: 'Compute-rasterized UI', size: [w, h], format: 'rgba8unorm', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC });
      if (this.blitPipeline && this.pipelines.size) this.rebuildBindings(); old?.destroy();
    }
    this.resizeHudOutput();
    // Moving the panel without changing its physical text scale reuses its glyph masks.
    const hudRatio = dpr * Math.max(0.01, Math.min(1, (width - 16) / 420, (height - 16) / 338));
    if (hudRatio !== this.hudRatio) { this.hudFontDirty = true; this.hudRatio = hudRatio; }
    this.resizePending = false; this.resized = true;
  }
  get resolution() { return {...this.viewport}; }
  setTextQuality(value) {
    const mode = textQuality(value); if (mode === this.textQuality) return this;
    this.textQuality = mode; this.hudFontDirty = true; this.resized = true;
    this.embedded?.surface.setTextQuality(mode);
    if (this.running) this.invalidate(); return this;
  }
  setResolutionMode(value) {
    this.resolutionMode = resolutionMode(value); this.resizePending = true;
    if (this.embedded) { this.embedded.surface.resolutionMode=this.resolutionMode; this.embedded.surface.resizePending=true; }
    if (this.running) this.invalidate(); return this;
  }
  dispatch(pass, name, count, offset = 0, indirectOffset = null) {
    const p = this.pipelines.get(name); pass.setPipeline(p.pipeline);
    pass.setBindGroup(0, p.bindGroups[this.drawIndex], p.dynamic ? [offset] : []);
    if (indirectOffset != null) pass.dispatchWorkgroupsIndirect(this.indirectBuffer, indirectOffset);
    else if (count[0] > 0) pass.dispatchWorkgroups(...count);
  }
  phase(encoder, label, firstQuery) {
    const descriptor = { label };
    if (this.profiling && this.gpuTiming) descriptor.timestampWrites = { querySet: this.querySet, beginningOfPassWriteIndex: firstQuery, endOfPassWriteIndex: firstQuery + 1 };
    return encoder.beginComputePass(descriptor);
  }
  /** One ordered graph. Default vsync admits at most two unacknowledged frames.
   * A full pipeline defers BEFORE input consumption, resize, encoding or canvas use.
   */
  render(now = performance.now(), sharedEncoder=null) {
    if (this.disposed || this.faulted) return false;
    if(!sharedEncoder&&this.commands.length&&(this.actionBridge.pending.size>=8||(this.embedded?.surface.actionBridge.pending.size??0)>=8)){this.stats.actionBackpressure=(this.stats.actionBackpressure??0)+1;this.deferredRender=true;return false;}
    if (!sharedEncoder && !this.gate.acquire()) { this.deferredRender = true; this.stats.skippedSubmissions++; return false; }
    this.deferredRender = false;
    let actionSnapshot=null,submitted=false;
    const encodeStarted = performance.now();
    try {
      if (!this.ownerSurface && this.options.pixelRatio == null && this.observedDeviceDpr !== (globalThis.window?.devicePixelRatio || 1)) {
        this.pixelObservation = null; this.resizePending = true;
      }
      if (this.resizePending) this.resize();
      const packet = this.commands.flush(this.device.queue, this.eventBuffer,256,this.heapBuffer), v = this.viewport;
      if(this.options.editorChangeEvents&&packet.count&&this.manifest.editors?.some(e=>e.changeAction))packet.actionCandidate=true;
      const layout = !!this.manifest.templateLayout || !!sharedEncoder || this.first || this.resized || packet.layout || (this.manifest.designers?.length>0 && packet.count>0) || (packet.count>0 && ((this.manifest.docks?.length??0)>0||(this.manifest.models?.length??0)>0));
      const query = this.manifest.tables.length > 0 && (!!sharedEncoder || this.first || packet.query);
      const work = layout || query || !!this.embedded;
      const drawHUD = this.hudVisible && this.hudReady;
      const detailed = this.profiling && this.gpuTiming && this.timingDetail === 'stages';
      if(packet.lastSequence)this.lastInputSequence=packet.lastSequence;
      this.stats.frames++; this.stats.uploadedBytes += 64 + packet.bytes;
      this.stats.peakFramesInFlight = this.gate.peak;
      this.drawIndex = (this.stats.frames - 1) & 1; this.drawBuffer = this.drawBuffers[this.drawIndex];
      this.frameF.set([v.width, v.height, v.dpr, (now - this.startTime) / 1000]);
      this.frameU.set([this.manifest.nodeCount, packet.count, this.stats.frames, this.stats.uploadedBytes], 4);
      this.frameU.set([0, (this.textQuality === 'reference' ? 16384 : 0) | (drawHUD ? 1 : 0) | (this.gpuTiming ? 2 : 0) | (layout ? 4 : 0) | (query ? 8 : 0) | (this.options.damageTracking === false ? 16 : 0) | (this.options.glyphCache === false ? 32 : 0) | (this.submissionMode === 'asap' ? 64 : 0) | (this.metricsResetPending ? 128 : 0) | (this.manifest.textMode === 'opentype' && this.options.glyphCache !== false ? 256 : 0) | (sharedEncoder?8192:0) | (detailed ? 512 : 0) | (this.options.parallelGrid === false ? 1024 : 0) | (this.timingDetail === 'off' ? 2048 : 0) | (this.submissionMode === 'vsync' && this.gate.limit > 0 ? 4096 : 0) | ((this.inAnimationFrame || this.running) ? this.cadence.packed : 0), 0, 0], 8);
      this.frameU.set([v.w, v.h, v.tileCols, v.tileRows], 12);
      const encoder = sharedEncoder || this.device.createCommandEncoder({ label: `Helion frame ${this.stats.frames}` });
      if(sharedEncoder){
        const owner=this.ownerSurface,prepare=encoder.beginComputePass({label:'GPU Fit viewport / presenter frame'});
        owner.dispatch(prepare,'preparePresenterFrame',[1]);prepare.end();
        encoder.copyBufferToBuffer(this.forwardedBuffer,RELAY_FRAME_WORD*4,this.frameBuffer,0,64);
      }
      const nodeGroups = Math.ceil(this.manifest.nodeCount / 64);
      let pass = this.phase(encoder, 'Input / GPU scheduling', 0);
      this.dispatch(pass, 'clearFrame', [Math.ceil(Math.max(DRAW_HEADS, v.tileCols * v.tileRows) / 128)]);
      if (sharedEncoder || packet.hitTest) this.dispatch(pass, 'hitTest', [nodeGroups]);
      // At most one caret-preparation yield and one effect yield per event.
      // Parent intent also bounds child relay events, without mapping the FIFO.
      this.inputBoundaryBudget = packet.caretCommands + packet.count + (sharedEncoder ? this.ownerSurface.inputBoundaryBudget : 0);
      if (sharedEncoder || packet.count) {
        this.dispatch(pass, 'input', [1]);
        for (let i = 0; i < this.inputBoundaryBudget; i++) {
          for (const entry of this.inputStages) this.dispatch(pass, entry, ONE_GROUP);
        }
      }
      if(this.manifest.designers?.length)this.dispatch(pass,'synchronizeDesigners',[Math.ceil(this.manifest.nodeCount/64)]);
      if(this.manifest.editors?.length)this.dispatch(pass,'analyzeEditors',[this.manifest.editors.length]);
      if(this.manifest.models?.length){this.dispatch(pass,'pullModels',[1]);this.dispatch(pass,'evaluateModels',[Math.ceil(this.manifest.modelRows/64),this.manifest.models.length]);this.dispatch(pass,'pushModels',[1]);}
      if(this.manifest.lists?.length)this.dispatch(pass,'layoutLists',[this.manifest.lists.length]);
      if (this.manifest.styleNodes) this.dispatch(pass, 'resolveStyles', [nodeGroups]);
      if(this.manifest.templateSystem){this.dispatch(pass,'rankTemplateTree',[1]);for(let level=0;level<this.manifest.templateLevels;level++)this.dispatch(pass,'resolveTemplateLayout',[nodeGroups],this.depthStages[level]);}
      if(this.manifest.shapedTexts?.length)this.dispatch(pass,'shapeTextRuns',[Math.ceil(this.manifest.shapedTexts.length/32)]);
      if (work) this.dispatch(pass, 'schedule', [1]);
      // In compact timing mode a clean/scroll frame has ONE compute encoder.
      // Layout/query frames keep their true dependency/bracketing boundaries.
      if (work || detailed) pass.end();
      let started = performance.now(), layoutMs = 0;
      if (layout) {
        pass = this.phase(encoder, 'Measure / Arrange', 2);
        for (let depth = this.manifest.maxDepth; depth >= 0; depth--) this.dispatch(pass, 'measure', [], this.intrinsicStages[depth], 0);
        for (const offset of this.depthStages) this.dispatch(pass, 'constraints', [], offset, 0);
        for (let depth = this.manifest.maxDepth; depth >= 0; depth--) this.dispatch(pass, 'measure', [], this.depthStages[depth], 0);
        for (const offset of this.depthStages) this.dispatch(pass, 'arrange', [], offset, 0);
        pass.end(); layoutMs = performance.now() - started;
      }
      if (query) {
        pass = this.phase(encoder, 'Retained sort / filter / selection', 4);
        this.dispatch(pass, 'sortBlocks', [], 0, 60);
        for (const offset of this.sortStages) this.dispatch(pass, 'mergeRows', [], offset, 72);
        this.dispatch(pass, 'filterScan', [], 0, 12); this.dispatch(pass, 'scanBlocks', [], 0, 96);
        this.dispatch(pass, 'scatterRows', [], 0, 12); this.dispatch(pass, 'resolveSelection', [], 0, 12);
        pass.end();
      }
      if(this.embedded){this.resizeEmbeddedAllocation();const e=this.embedded.surface;e.externalActionCandidate=packet.actionCandidate;e.render(now,encoder);}
      const splitRender = detailed;
      started = performance.now();
      if (work || detailed) pass = this.phase(encoder, detailed ? 'Scene: composition / display list / damage' : 'UI + HUD compute', 6);
      if (work) this.dispatch(pass, 'finishWork', [1]);
      if (this.manifest.animations) this.dispatch(pass, 'animate', [Math.ceil(this.manifest.animations / 64)]);
      if(this.manifest.designers?.length)this.dispatch(pass,'animateDesigners',[Math.ceil(this.manifest.nodeCount/64)]);
      if(this.manifest.templateSystem)for(let level=0;level<this.manifest.templateLevels;level++)this.dispatch(pass,'resolveTemplateVisuals',[nodeGroups],this.depthStages[level]);
      for (const offset of this.depthStages) this.dispatch(pass, 'compose', [nodeGroups], offset);
      if(this.manifest.editors?.length)this.dispatch(pass,'layoutEditors',[this.manifest.editors.length]);
      if(this.manifest.shapedTexts?.length)this.dispatch(pass,'layoutTextRuns',[Math.ceil(this.manifest.shapedTexts.length/32)]);
      for(const entry of this.emissionStages)this.dispatch(pass,entry,[nodeGroups]);
      if (this.manifest.designers?.length) for (const entry of DESIGNER_EMISSION) this.dispatch(pass, entry, [nodeGroups]);
      if(this.manifest.editors?.length)this.dispatch(pass,'emitEditorParts',[5,this.manifest.editors.length]);
      if (this.manifest.tables.length) this.dispatch(pass, 'emitGridParts', [5]);
      if(this.manifest.lists?.length)this.dispatch(pass,'emitListParts',[4,this.manifest.lists.length]);
      this.dispatch(pass, 'damage', [Math.ceil(DRAW_HEADS / 64)]); if (splitRender) pass.end();
      if (this.manifest.textMode === 'opentype' && this.options.glyphCache !== false) {
        if (splitRender) pass = this.phase(encoder, 'Glyph cache planning / coverage', 8);
        this.dispatch(pass, 'collectGlyphRequests', [Math.ceil(this.manifest.limits.maxPrimitives / 64)]);
        this.dispatch(pass, 'prepareGlyphCache', [Math.ceil(this.constants.GLYPH_SHARDS / 64)]); this.dispatch(pass, 'finishGlyphRequests', [1]); this.dispatch(pass, 'rasterGlyphCache', [], 0, 84); if (splitRender) pass.end();
      }
      if (splitRender) pass = this.phase(encoder, 'Sparse raster / tile composite', 10);
      this.dispatch(pass, 'prepareDraws', [1]); this.dispatch(pass, 'buildJobs', [], 0, 24);
      this.dispatch(pass, 'prepareJobs', [1]); this.dispatch(pass, 'makeStrips', [], 0, 36);
      this.dispatch(pass, 'prepareStrips', [1]); this.dispatch(pass, 'binStrips', [], 0, 48);
      this.dispatch(pass, 'composite', [v.tileCols, v.tileRows]); this.dispatch(pass, 'finishFrame', [1]);
      if (detailed) pass.end();
      const renderMs = performance.now() - started;
      if (drawHUD) {
        if (detailed) pass = this.phase(encoder, 'HUD: font coverage / format / bins', 12);
        if (this.hudFontDirty) {
          pass.setPipeline(this.hudPipelines.get('rasterHudFont')); pass.setBindGroup(0, this.hudBindGroups.get('rasterHudFont')); pass.dispatchWorkgroups(190);
        }
        pass.setPipeline(this.hudPipelines.get('buildHudText')); pass.setBindGroup(0, this.hudBindGroups.get('buildHudText')); pass.dispatchWorkgroups(1);
        pass.setPipeline(this.hudPipelines.get('compositeHud')); pass.setBindGroup(0,this.hudCompositeBindGroup);
        pass.dispatchWorkgroups(Math.ceil(this.hudOutputSize[0]/8),Math.ceil(this.hudOutputSize[1]/8));
        if (detailed) pass.end();
      }
      if (!detailed) pass.end();
      if(sharedEncoder){this.pendingActionSnapshot=this.actionBridge.encode(encoder,{actionCandidate:packet.actionCandidate||this.externalActionCandidate});this.frameF[10]=layoutMs;this.frameF[11]=performance.now()-encodeStarted;this.frameU[8]=packFrameInterval(this.lastSubmitStamp==null?0:now-this.lastSubmitStamp,this.first||this.resized);this.device.queue.writeBuffer(this.forwardedBuffer,RELAY_FRAME_WORD*4,this.frameBytes);this.first=false;this.resized=false;this.lastSubmitStamp=now;this.lastInputSequence=packet.lastSequence||this.lastInputSequence;return true;}
      const render = encoder.beginRenderPass({ label: 'Canvas blit + diagnostic overlay', ...(this.profiling && this.gpuTiming ? { timestampWrites: { querySet: this.querySet, beginningOfPassWriteIndex: 14, endOfPassWriteIndex: 15 } } : {}), colorAttachments: [{ view: this.context.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
      // Text and charts have already been composited in compute. The final pass
      // copies UI pixels and the GPU-positioned HUD quad, with no rasterization.
      if (this.options.hudScissor === false && drawHUD) {
        render.setPipeline(this.hudFullscreenPipeline); render.setBindGroup(0, this.hudFullscreenBindGroup); render.draw(3);
      } else {
        render.setPipeline(this.blitPipeline); render.setBindGroup(0, this.blitBindGroup); render.draw(3);
        if (drawHUD) {
          render.setPipeline(this.presentPipeline); render.setBindGroup(0, this.presentBindGroup); render.draw(6);
        }
      }
      render.end();
      // Resolve AFTER the final render pass. The HUD shows the previous complete
      // sample; it must not claim a partial UI pass covers its own presentation.
      if (this.profiling) {
        if (this.gpuTiming) encoder.resolveQuerySet(this.querySet, 0, TIMESTAMP_COUNT, this.timingBuffer, 0);
        pass = encoder.beginComputePass({ label: 'Record complete previous-display sample (no readback)' });
        pass.setPipeline(this.metricsPipeline); pass.setBindGroup(0, this.metricsBindGroup); pass.dispatchWorkgroups(1); pass.end();
      }
      actionSnapshot=this.actionBridge.encode(encoder,packet);
      const commandBuffer = encoder.finish();
      const encodeEnded = performance.now();
      this.frameF[10] = layoutMs; this.frameF[11] = encodeEnded - encodeStarted;
      this.stats.cpuLayoutEncodeMs = layoutMs; this.stats.cpuRenderEncodeMs = renderMs; this.stats.cpuEncodeMs = this.frameF[11];
      // Animation time is separate from this monotonic, near-submit timestamp.
      // Quantize a small double-precision DELTA, not an ever-growing f32 clock.
      const submitStarted = performance.now();
      this.frameU[8] = packFrameInterval(this.lastSubmitStamp == null ? 0 : submitStarted - this.lastSubmitStamp, this.first || this.resized);
      this.device.queue.writeBuffer(this.frameBuffer, 0, this.frameBytes);
      this.device.queue.submit([commandBuffer]);submitted=true;this.actionBridge.submitted(actionSnapshot);if(this.embedded){const child=this.embedded.surface;child.actionBridge.submitted(child.pendingActionSnapshot);child.pendingActionSnapshot=null;} this.stats.submittedGraphs++;
      this.lastSubmitStamp = submitStarted; this.first = false; this.resized = false;
      if (this.profiling) this.metricsResetPending = false;
      if (drawHUD) this.hudFontDirty = false;
      const submitEnded = performance.now(); this.stats.cpuSubmitMs = submitEnded - submitStarted;
      this.frameSyncLog.record(this.stats.frames, this.inAnimationFrame ? this.callbackStamp : NaN, this.inAnimationFrame ? this.callbackArrival : NaN, encodeStarted, encodeEnded, submitStarted, submitEnded,
        this.inAnimationFrame ? 1 : this.running && this.submissionMode === 'asap' ? 2 : 0);
      if (this.inAnimationFrame) this.stats.rafSubmissions++; else if (this.running && this.submissionMode === 'asap') this.stats.asapSubmissions++;
      this.stats.pendingAcknowledgements = this.gate.inFlight;
      if (this.stats.frames === 1) this.startup.firstSubmitMs = performance.now() - this.startup.startedAt;
      // Register this exact tail now, even while older acknowledgements are pending.
      // The default two-frame pipeline never waits to REGISTER its next fence.
      // Explicitly unbounded reference mode retains sparse progress bookkeeping.
      if (this.stats.frames === 1 || this.gate.limit > 0 || this.stats.frames - this.progress.lastRequested >= 16) this.trackCompletion();
      return true;
    } catch (error) { if(!submitted){this.actionBridge.cancel(actionSnapshot);if(this.embedded){this.embedded.surface.actionBridge.cancel(this.embedded.surface.pendingActionSnapshot);this.embedded.surface.pendingActionSnapshot=null;}}if(!sharedEncoder)this.gate.release(); this.faulted = true; this.stop(); throw error; }
  }
  /** Snapshot fence for explicit callers; never awaited by the normal rAF loop. */
  get lastSubmissionCompletion() { return this.whenSubmittedWorkDone(); }
  whenSubmittedWorkDone() { return this.ownerSurface?this.ownerSurface.whenSubmittedWorkDone():boundedWait(this.trackCompletion(true),{timeoutMs:this.options.gpuWatchdogMs??10000,stage:'submitted GPU work'}); }
  trackCompletion(force = false) {
    if (this.disposed) return Promise.resolve();
    const promise = this.progress.request(this.stats.frames, { independent: this.gate.limit > 0, force });
    this.stats.completionCheckpoints = this.progress.requests;
    this.watchdog?.submitted(this.stats.frames);
    return promise;
  }
  acknowledgeFrame({ serial, acknowledged, released, notificationMs }) {
    this.acknowledgedSerial = acknowledged; this.gate.release(released);
    this.watchdog?.completed(acknowledged);
    this.stats.completedFrames = acknowledged; this.stats.pendingAcknowledgements = this.gate.inFlight;
    this.stats.lastCompletionLatencyMs = notificationMs; // Notification lifetime, NOT GPU execution.
    if (this.disposed || this.faulted) return;
    if (this.startup.firstCompletedMs == null && serial >= 1) {
      this.startup.firstCompletedMs = performance.now() - this.startup.startedAt; this.startup.status = 'ready';
      this.reportStartup('ready', 'First full-quality application frame completed');
      this.ensureHUD();
    }
    // Only the explicitly selected throughput mode may wake from a completion.
    // Vsync draws exclusively in rAF, with the newest queued input and clock.
    if (this.running && this.submissionMode === 'asap') this.requestAsap();
  }
  resetMeasurements() { this.lastSubmitStamp = null; this.metricsResetPending = true; }
  requestAsap() {
    if (!this.running || this.submissionMode !== 'asap' || this.disposed || this.faulted || document.hidden) return;
    if (this.gate.limit > 0 && this.gate.inFlight >= this.gate.limit) { this.trackCompletion(); return; }
    this.tasks.schedule(() => {
      if (!this.running || this.submissionMode !== 'asap' || this.disposed || this.faulted || document.hidden) return;
      try { this.render(performance.now()); } catch (error) { this.options.onError?.(error); return; }
      this.requestAsap();
    });
  }
  invalidate() {
    if(this.ownerSurface){this.ownerSurface.invalidate();return;}
    if (this.disposed || this.faulted || document.hidden || this.platformBarrier) return;
    if (this.running && this.submissionMode === 'asap') this.requestAsap();
    if (this.raf != null) return;
    this.rafHandler ??= now => {
      this.raf = null;
      if (this.disposed || this.faulted || document.hidden || this.platformBarrier) return;
      this.callbackStamp = now; this.callbackArrival = performance.now();
      this.stats.animationFrameCallbacks++;
      // Schedule exactly one successor before encoding. Completion callbacks do
      // not drive this clock; no timers/predicted-vsync/catch-up submissions.
      if (this.running) this.invalidate();
      const pending = this.gate.inFlight, limit = this.gate.limit;
      if (!Number.isFinite(now) || (this.lastRafStamp != null && now <= this.lastRafStamp)) {
        this.stats.duplicateRafCallbacks++;
        this.opportunityLog.record(now, this.callbackArrival, 3, 0, pending, limit);
        if (this.commands.length || this.deferredRender) this.invalidate();
        return;
      }
      this.lastRafStamp = now; this.cadence.tick(now); this.stats.rafHz = this.cadence.hz;
      let outcome = 2;
      if (this.submissionMode === 'vsync' || !this.running) {
        this.inAnimationFrame = true;
        try {
          outcome = this.render(now) ? 0 : 1;
          if (outcome === 1) this.stats.rafCapacityDeferrals++;
        } catch (error) { outcome = 4; this.options.onError?.(error); }
        finally { this.inAnimationFrame = false; }
      } else this.requestAsap();
      this.opportunityLog.record(now, this.callbackArrival, outcome, outcome === 0 ? this.stats.frames : 0, pending, limit);
      if (this.running || this.commands.length || this.deferredRender) this.invalidate();
    };
    this.raf = requestAnimationFrame(this.rafHandler);
  }
  setTimingDetail(detail = 'frame') {
    detail = timingDetail(detail); if (detail === this.timingDetail) return this;
    this.timingDetail = detail; this.gpuTiming = this.gpuTimingAvailable && detail !== 'off'; this.resetMeasurements(); if (this.running) this.invalidate(); return this;
  }
  inspectFrameSync() {
    return { ...this.frameSyncLog.inspect(), opportunities: this.opportunityLog.inspect(),
      pacing: { policy: this.gate.limit > 0 ? 'bounded-latest-input' : 'unbounded-reference',
        maxFramesInFlight: this.gate.limit, vsyncLimit: this.vsyncLimit, asapLimit: this.asapLimit,
        unacknowledgedFrames: this.gate.inFlight, pendingCheckpoints: this.progress.pending.size,
        acknowledgementStrategy: this.gate.limit > 0 ? 'independent-per-submission' : 'sparse',
        note: 'Unacknowledged submissions include notification latency; not actual driver queue depth. Capacity deferrals are NOT compositor dropped frames.' }, stats: { ...this.stats }, submissionMode: this.submissionMode,
      timingDetail: this.timingDetail, adapter: this.adapterInfo, everyRaf: this.submissionMode === 'vsync' && this.gate.limit === 0,
      measuredRefresh: 'rAF callbacks only; no hardware refresh/scanout API', viewport: { ...this.viewport } };
  }
  setSubmissionMode(mode = 'vsync') {
    mode = submissionMode(mode);
    if (mode === this.submissionMode) return this;
    this.tasks.cancel(); this.submissionMode = mode;
    this.gate.limit = mode === 'asap' ? this.asapLimit : this.vsyncLimit;
    this.resetMeasurements();
    if (this.gate.limit > 0 && this.gate.inFlight > 0) this.trackCompletion(true);
    if (this.running) this.invalidate();
    return this;
  }
  /** Live A/B control. Zero explicitly restores unbounded vsync submission. */
  setMaxFramesInFlight(limit = 2) {
    new FrameGate(limit); this.vsyncLimit = limit;
    if (this.submissionMode === 'vsync') {
      this.gate.limit = limit; this.resetMeasurements();
      // Existing work cannot be cancelled or falsely acknowledged on a policy change.
      if (limit > 0 && this.gate.inFlight > 0) this.trackCompletion(true);
    }
    if (this.running) this.invalidate(); return this;
  }
  get maxFramesInFlight() { return this.vsyncLimit; }
  start() { if (!this.running) { this.cadence?.reset(); this.lastRafStamp = null; this.resetMeasurements(); } this.running = true; this.invalidate(); }
  stop() { this.running = false; this.deferredRender = false; this.cadence?.reset(); this.lastRafStamp = null; this.tasks?.cancel(); this.resetMeasurements(); if (this.raf != null) { cancelAnimationFrame(this.raf); this.raf = null; } }
  setPerformanceHUD(visible = true) {
    this.resetMeasurements(); this.hudVisible = Boolean(visible); this.profiling = this.hudVisible || this.options.profiling === true;
    if (this.stats.frames > 0) this.ensureHUD();
    this.invalidate(); return this;
  }
  /** Explicit platform boundary for Run/export/clipboard. Not a frame-loop poll. */
  platformSnapshot(task){
    if(this.ownerSurface)return this.ownerSurface.platformSnapshot(task);
    const operation=async()=>{if(this.disposed||this.faulted)throw new Error('Surface is unavailable');this.platformBarrier=true;if(this.raf!=null){cancelAnimationFrame(this.raf);this.raf=null;}this.tasks?.cancel();
      try{await this.whenSubmittedWorkDone();const target=this.commands.sequence>>>0;
        while((this.commands.length&&this.lastInputSequence!==target)||this.embedded?.surface.commands.length){if(!this.render(performance.now())){if(this.actionBridge.pending.size>=8)await this.actionBridge.delivery;if((this.embedded?.surface.actionBridge.pending.size??0)>=8)await this.embedded.surface.actionBridge.delivery;await this.whenSubmittedWorkDone();if(this.disposed||this.faulted)throw new Error('Snapshot flush failed');continue;}await this.whenSubmittedWorkDone();if(((this.lastInputSequence-target)>>>0)<0x80000000&&!this.embedded?.surface.commands.length)break;}
        return await task();
      }finally{this.platformBarrier=false;if(this.running||this.commands.length)this.invalidate();}
    };const promise=(this.platformOperations??Promise.resolve()).then(operation,operation);this.platformOperations=promise.catch(()=>{});return promise;
  }
  /** Compile replacement content off the frame path, reuse pipelines/device, keep the shell state. */
  async attachSurface(name,view,options={}){
    const id=this.id(name),meta=this.manifest.presenters?.find(p=>p.node===id);if(!meta)throw new TypeError('Expected SurfacePresenter');if(this.ownerSurface)throw new Error('Nested SurfacePresenter is not supported');
    const generation=(this.attachGeneration??0)+1;this.attachGeneration=generation;
    const {compiled}=await prepareView(view,{...options,limits:this.manifest.limits,inputInboxCapacity:65536,startupCache:false},()=>{});
    if(compiled.presenters?.length)throw new TypeError('Nested presenters are not supported');
    const features=viewFeatures(compiled);if((features&this.preparedFeatures)!==features)throw new Error('The owning surface has not prepared the required editor/model pipelines');
    if(this.disposed||generation!==this.attachGeneration)return null;
    const viewport={width:meta.width||this.viewport.width,height:meta.height||this.viewport.height};const canvas={width:0,height:0,getBoundingClientRect:()=>viewport};
    const child=new HelionSurface();child.startup={startedAt:performance.now(),status:'shared'};child.reportStartup=()=>{};
    try{await child.initialize(canvas,compiled,{...this.gpuTemplate,gpuTiming:false},{...options,offscreen:true,input:false,borrowedDevice:true,inputBridge:this.forwardedBuffer,autoStart:false,performanceHUD:false,profiling:false,gpuTiming:false,timingDetail:'off',textQuality:this.textQuality,resolutionMode:this.resolutionMode,pixelRatio:this.viewport.dpr});}
    catch(error){child.dispose();throw error;}
    if(this.disposed||generation!==this.attachGeneration){child.dispose();return null;}
    const old=this.embedded;this.embedded={surface:child,node:id,meta,viewport};child.ownerSurface=this;this.device.queue.writeBuffer(this.forwardedBuffer,4,new Uint32Array([id]));this.stats.initialUploadBytes+=4;this.rebuildBindings();this.set(name,'value',1);if(old)this.device.queue.onSubmittedWorkDone().then(()=>old.surface.dispose());return child;
  }
  detachSurface(){this.attachGeneration=(this.attachGeneration??0)+1;const old=this.embedded;this.embedded=null;if(old){this.rebuildBindings();this.set(old.node,'value',0);this.device.queue.onSubmittedWorkDone().then(()=>old.surface.dispose());}return this;}
  /** Resize only the GPU allocation at host-known viewport/preset boundaries.
   * Dock splitters alter the active extent inside this allocation on the GPU. */
  resizeEmbeddedAllocation(){
    const e=this.embedded;if(!e)return;
    const width=e.meta.width||this.viewport.width,height=e.meta.height||this.viewport.height;
    if(e.surface.resizePending||e.viewport.width!==width||e.viewport.height!==height||e.surface.options.pixelRatio!==this.viewport.dpr){
      Object.assign(e.viewport,{width,height});e.surface.options.pixelRatio=this.viewport.dpr;e.surface.resize();this.rebuildBindings();
    }
  }
  setPresenterSize(width,height){
    if(!this.embedded)throw new Error('No embedded surface');
    if(!Number.isInteger(width)||!Number.isInteger(height)||!((width===0&&height===0)||(width>=32&&height>=32&&width<=4096&&height<=4096)))throw new RangeError('Design dimensions must both be zero (Fit), or 32–4096');
    const e=this.embedded;Object.assign(e.meta,{width,height});this.device.queue.writeBuffer(this.heapBuffer,e.meta.pointer*4,new Float32Array([width,height]));
    this.resizeEmbeddedAllocation();this.stats.uploadedBytes+=8;if(this.running)this.invalidate();return this;
  }
  list(name){return new ListController(this,name);}
  setText(name,value){const id=this.id(name),meta=this.manifest.labels?.find(l=>l.node===id);if(!meta)throw new TypeError('Reserve textCapacity on the target label');const data=Uint32Array.from(String(value),c=>c.codePointAt(0));if(data.length>meta.capacity||data.some(c=>c>=0xd800&&c<=0xdfff))throw new RangeError('Text exceeds capacity or contains invalid Unicode');this.commands.pushBulk(Opcode.Controls,{target:id,c:1,a:data.length},data,this.manifest.editorInbox);if(this.running||this.options.autoStart!==false)this.invalidate();return this;}
  dataSource(name){return new DataSourceController(this,name);}
  editor(name){return new EditorController(this,name);}
  docking(name){return new DockController(this,name);}
  model(name){return new ModelController(this,name);}
  async readHeapRange(offset,words){
    if(!Number.isInteger(offset)||!Number.isInteger(words)||offset<0||words<0||(offset+words)*4>this.heapBuffer.size)throw new RangeError('Invalid heap snapshot');
    const size=Math.max(4,words*4),staging=this.device.createBuffer({size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    try{const encoder=this.device.createCommandEncoder({label:'Explicit bounded heap snapshot'});if(words)encoder.copyBufferToBuffer(this.heapBuffer,offset*4,staging,0,words*4);this.device.queue.submit([encoder.finish()]);await staging.mapAsync(GPUMapMode.READ);const bytes=staging.getMappedRange().slice(0,words*4);this.stats.readbackBytes+=words*4;return bytes;}finally{staging.destroy();}
  }
  designer(name){return new DesignerController(this,name);}
  id(name) { const id = typeof name === 'number' ? name : this.ids.get(name); if (!Number.isInteger(id) || id >= this.manifest.nodeCount || id < 0) throw new ReferenceError(`Unknown view ${name}`); return id; }
  template(name) { return new TemplateController(this,name); }
  setTheme(name,variant='dark') {const meta=this.manifest.templateSystem;if(!meta)throw new TypeError('Surface did not prepare a template theme bank');const index=meta.themes.findIndex(t=>t.name===name);if(index<0||!['dark','light'].includes(variant))throw new TypeError('Unknown prepared theme or variant');this.send(Opcode.Template,{target:0,c:0,a:index,b:variant==='light'?1:0});return this;}
  setThemeContrast(value) {if(!this.manifest.templateSystem||!['standard','high'].includes(value))throw new TypeError('Expected a prepared theme and standard/high');this.send(Opcode.Template,{target:0,c:7,a:value==='high'?1:0});return this;}
  setControlDensity(value) {if(!this.manifest.templateSystem||!['comfortable','compact'].includes(value))throw new TypeError('Expected a prepared theme and comfortable/compact');this.send(Opcode.Template,{target:0,c:8,a:value==='compact'?1:0});return this;}
  setAccentColor(value) {if(!this.manifest.templateSystem)throw new TypeError('Surface did not prepare themes');if(value==null){this.send(Opcode.Template,{target:0,c:6});return this;}const color=rgba(value);if((color>>>24)!==255)throw new RangeError('Accent colors must be opaque');this.send(Opcode.Template,{target:0,c:5,a:color&65535,b:color>>>16});return this;}
  setReducedMotion(value) {if(!this.manifest.templateSystem)throw new TypeError('Surface did not prepare templates');this.send(Opcode.Template,{target:0,c:3,a:value?1:0});return this;}
  set(name, property, value) { if (!Object.hasOwn(Property, property)) throw new TypeError(`Unknown GPU property ${property}`); this.commands.push(Opcode.Set, { target: this.id(name), c: Property[property], a: Number(value) }); if (this.options.autoStart !== false || this.running) this.invalidate(); return this; }
  send(kind, payload) { this.commands.push(kind, payload); if (this.options.autoStart !== false || this.running) this.invalidate(); return this; }
  controlAnimation(name, command, seconds = 0) {
    const code = { start:0, pause:1, resume:2, stop:3, seek:4 }[command];
    if (code == null || !Number.isFinite(seconds) || seconds < 0) throw new TypeError('Invalid animation controller command');
    return this.send(Opcode.Animation, {target:this.id(name), c:code, a:seconds});
  }
  focusTextInput() { this.input?.focusTextInput(); }
  /** Explicit diagnostic readback. NEVER called by the normal frame loop. */
  async inspect({ includeNodes = true, includeHeap = false } = {}) {
    const list = [{ key: 'state', buffer: this.stateBuffer }]; if (includeNodes) list.push({ key: 'nodes', buffer: this.nodeBuffer }); if (includeHeap) list.push({ key: 'heap', buffer: this.heapBuffer });
    const result = {}; const encoder = this.device.createCommandEncoder({ label: 'Explicit diagnostic readback' });
    const reads = list.map(item => { const staging = this.device.createBuffer({ size: item.buffer.size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); encoder.copyBufferToBuffer(item.buffer, 0, staging, 0, item.buffer.size); return { ...item, staging }; });
    this.device.queue.submit([encoder.finish()]);
    await Promise.all(reads.map(async item => { await item.staging.mapAsync(GPUMapMode.READ); const data = item.staging.getMappedRange().slice(0); result[item.key] = new Uint32Array(data); this.stats.readbackBytes += data.byteLength; item.staging.unmap(); item.staging.destroy(); }));
    result.stats = { ...this.stats }; result.errors = [...this.errors]; return result;
  }
  async inspectPerformance() {
    const bytes = METRICS_BYTES;
    const staging = this.device.createBuffer({ size: bytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    try {
      const encoder = this.device.createCommandEncoder({ label: 'Explicit performance snapshot' });
      encoder.copyBufferToBuffer(this.metricsBuffer, 0, staging, 0, bytes); this.device.queue.submit([encoder.finish()]);
      await staging.mapAsync(GPUMapMode.READ); const words = new Uint32Array(staging.getMappedRange().slice(0));
      this.stats.readbackBytes += bytes; return decodePerformance(words);
    } finally { staging.unmap(); staging.destroy(); }
  }
  dispose() { if (this.disposed) return; this.disposed = true; this.device?.removeEventListener?.('uncapturederror',this.uncapturedError); this.actionBridge?.dispose(); this.watchdog?.dispose(); this.stop(); this.progress?.dispose(); this.tasks?.dispose(); this.input?.dispose(); this.resizeObserver?.disconnect(); this.abort?.abort(); this.embedded?.surface.dispose();this.emptyPreview?.destroy(); this.hudOutput?.destroy(); this.output?.destroy(); this.querySet?.destroy(); this.resources?.forEach(b => b.destroy()); this.context?.unconfigure(); if(this.ownsDevice)this.device?.destroy(); }
}
