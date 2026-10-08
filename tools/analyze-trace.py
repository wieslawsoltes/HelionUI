#!/usr/bin/env python3
"""Analyze Chrome Trace Event JSON/.json.gz without screenshots, OCR or URL export.
Reports trace event durations as recorded; does NOT relabel GPUTask as shader time.
Usage: python tools/analyze-trace.py trace.json.gz --output trace-analysis.json
"""
from __future__ import annotations
import argparse
import collections
import gzip
import hashlib
import json
from pathlib import Path


def distribution(values):
    a = sorted(float(v) for v in values)
    def quantile(p):
        if not a:
            return None
        at = (len(a) - 1) * p
        lo = int(at)
        return a[lo] + (a[min(lo + 1, len(a) - 1)] - a[lo]) * (at - lo)
    return {"count": len(a), "min": quantile(0), "median": quantile(.5),
            "p95": quantile(.95), "max": quantile(1),
            "mean": sum(a) / len(a) if a else None}


def analyze(trace, renderer_pid=None):
    events = trace.get('traceEvents', []) if isinstance(trace, dict) else trace
    if not isinstance(events, list) or not events:
        raise ValueError('No traceEvents array')
    metadata = trace.get('metadata', {}) if isinstance(trace, dict) else {}
    window = metadata.get('modifications', {}).get('initialBreadcrumb', {}).get('window') or {}
    lo = window.get('min', min(e.get('ts', 0) for e in events if 'ts' in e))
    hi = window.get('max', max(e.get('ts', 0) + e.get('dur', 0) for e in events))
    if hi <= lo:
        raise ValueError('Trace window must have positive duration')
    active = [e for e in events if lo <= e.get('ts', -1) <= hi]
    threads = {(e.get('pid'), e.get('tid')): e.get('args', {}).get('name')
               for e in events if e.get('name') == 'thread_name'}
    processes = {e.get('pid'): e.get('args', {}).get('name')
                 for e in events if e.get('name') == 'process_name'}
    candidates = collections.Counter(e['pid'] for e in active if e.get('name') == 'FireAnimationFrame')
    if renderer_pid is None:
        renderer_pid = candidates.most_common(1)[0][0] if candidates else None
    local = [e for e in active if renderer_pid is None or e.get('pid') == renderer_pid]
    named = lambda name: [e for e in local if e.get('name') == name]
    callbacks = named('FireAnimationFrame')
    def intervals(items):
        stamps = sorted(e['ts'] for e in items)
        return distribution((b - a) / 1000 for a, b in zip(stamps, stamps[1:]))
    gpu_tasks = [e for e in active if e.get('name') == 'GPUTask'
                 and (renderer_pid is None or e.get('args', {}).get('data', {}).get('renderer_pid') == renderer_pid)]
    stacks = collections.defaultdict(list)
    paired = []
    unmatched_ends = 0
    for e in sorted(events, key=lambda x: x.get('ts', 0)):
        if e.get('ph') not in ('b', 'e'):
            continue
        key = (e.get('pid'), json.dumps(e.get('id2', e.get('id')), sort_keys=True), e.get('name'), e.get('scope'))
        if e['ph'] == 'b':
            stacks[key].append(e)
        elif stacks[key]:
            begin = stacks[key].pop()
            if (renderer_pid is None or e.get('pid') == renderer_pid) and lo <= begin['ts'] <= e['ts'] <= hi:
                paired.append((begin, e))
        else:
            unmatched_ends += 1
    stages = {}
    for name in ['SendBeginMainFrameToCommit', 'EndActivateToSubmitCompositorFrame',
                 'SubmitCompositorFrameToPresentationCompositorFrame',
                 'SubmitToReceiveCompositorFrame', 'ReceiveCompositorFrameToStartDraw',
                 'StartDrawToSwapStart', 'BufferAvailableToBufferReady', 'BufferReadyToLatch',
                 'LatchToSwapEnd', 'SwapEndToPresentationCompositorFrame']:
        raw = [(a, b) for a, b in paired if a.get('name') == name]
        unique = {(a.get('pid'), a['ts'], b['ts']): (b['ts'] - a['ts']) / 1000 for a, b in raw}
        stages[name] = {'rawPairedCount': len(raw), 'duplicateIntervalsRemoved': len(raw) - len(unique),
                        'durationMs': distribution(unique.values())}
    reporter_states = collections.Counter(a.get('args', {}).get('frame_reporter', {}).get('state', 'unknown')
                                           for a, b in paired if a.get('name') == 'PipelineReporter')
    return {
        'schema': 1, 'scope': 'Source trace event analysis, NOT an updated-engine benchmark or hardware GPU busy-time measurement',
        'recordingStartUTC': metadata.get('startTime'), 'hostDPR': metadata.get('hostDPR'),
        'traceEvents': len(events), 'windowMicroseconds': {'start': lo, 'end': hi, 'duration': hi - lo},
        'rendererPID': renderer_pid, 'rendererProcessName': processes.get(renderer_pid),
        'requestAnimationFrameEvents': len(named('RequestAnimationFrame')),
        'animationFrameCallbacks': len(callbacks), 'callbacksPerRecordingSecond': len(callbacks) * 1e6 / (hi - lo),
        'callbackIntervalMs': intervals(callbacks),
        'callbackHostDurationMs': distribution(e['dur'] / 1000 for e in callbacks if 'dur' in e),
        'compositorBeginFrameEvents': len(named('BeginFrame')), 'compositorBeginFrameIntervalMs': intervals(named('BeginFrame')),
        'droppedFrameMarkers': len(named('DroppedFrame')), 'drawFrameEvents': len(named('DrawFrame')),
        'animationFramePresentationEvents': len(named('AnimationFrame::Presentation')),
        'animationFramePresentationIntervalMs': intervals(named('AnimationFrame::Presentation')),
        'gpuTask': {'count': len(gpu_tasks), 'recordedHostDurationMs': distribution(e['dur'] / 1000 for e in gpu_tasks if 'dur' in e),
                    'threads': sorted({threads.get((e.get('pid'), e.get('tid')), 'unknown') for e in gpu_tasks}),
                    'interpretation': 'GPUTask marks GPU-process command-processing CPU tasks; it is not the complete application shader duration.'},
        'compositorPipelineStages': stages, 'pipelineReporterStates': dict(reporter_states),
        'pairing': {'unmatchedEndsAcrossTrace': unmatched_ends,
                    'method': 'Paired async b/e events by process, async ID, name and scope. Fully contained intervals only. Exact duplicate process/start/end stage intervals removed to avoid counting forked reporters twice.'},
        'qualifications': [
            'BeginFrame cadence and DroppedFrame markers are compositor trace events, not independent measurements of physical scanout.',
            'Presentation-stage elapsed times may include queuing and waiting. Do not sum stage medians or equate them to kernel busy time.',
            'Whole-recording callback rate and short moving-window HUD rates need not match.',
            'This analyzer does not reconstruct Helion GPU query buffers; obtain raw timestamp/frame provenance through the explicit diagnostics button.',
            'No website URLs, screenshot image bytes, JS profiles, font files or user input contents are exported.']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('trace', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--pid', type=int)
    args = parser.parse_args()
    opener = gzip.open if args.trace.suffix == '.gz' else open
    try:
        with opener(args.trace, 'rt', encoding='utf-8') as stream:
            result = analyze(json.load(stream), args.pid)
        with args.trace.open('rb') as stream:
            result['sourceSHA256'] = hashlib.file_digest(stream, 'sha256').hexdigest()
        args.output.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
        print(f"{result['animationFrameCallbacks']} callbacks, {result['callbacksPerRecordingSecond']:.3f}/s; "
              f"{result['droppedFrameMarkers']} DroppedFrame markers. Wrote {args.output}")
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(1, f'Trace analysis failed: {error}\n')


if __name__ == '__main__':
    main()
