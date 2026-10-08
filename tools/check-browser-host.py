#!/usr/bin/env python3
"""Optional Playwright host-API gate. It never requests a WebGPU device.
The application navigation result and isolated blank-document API results are
reported separately. Origin/CSP/file-access/browser policy is not relaxed.
The root container uses --no-sandbox for Chromium process launch; this tool
is not a browser sandbox/security qualification.
"""
import argparse
import base64
import json
from pathlib import Path
import re
import zipfile
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--browser', default='/usr/bin/chromium')
parser.add_argument('--url', default='http://127.0.0.1:8080/dist/tests/host-startup.html?autorun')
parser.add_argument('--baseline', type=Path)
parser.add_argument('--output', type=Path, default=Path('browser-host-results.json'))
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
html = (root / 'dist/helion-standalone.html').read_text()
imports = json.loads(re.search(r'<script type="importmap">(.*?)</script>', html, re.S)[1])
worker = json.loads(re.search(r'globalThis\.__HELION_PREPARE_WORKER_SOURCE__=(.*?);</script>', html, re.S)[1])
authoring = (root / 'dist/playground/authoring.bundle.js').read_text()
suite = (root / 'tests/host-startup-suite.js').read_text() + '\n//# sourceURL=helion/tests/host-startup-suite.js\n'
suite_uri = 'data:text/javascript;base64,' + base64.b64encode(suite.encode()).decode()
result = {'scope': 'Native browser host APIs only; no shader compilation, GPU execution or application performance measurement.'}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=args.browser, headless=True, args=['--no-sandbox'])
    result['browser'] = browser.version
    result['browserLaunch'] = {'headless': True, 'containerArgs': ['--no-sandbox'], 'originOrCSPBypass': False}
    page = browser.new_page()
    try:
        page.goto(args.url, wait_until='domcontentloaded', timeout=15000)
        page.wait_for_function('globalThis.__HELION_HOST_STARTUP_RESULT__?.status', timeout=30000)
        result['servedPage'] = page.evaluate('globalThis.__HELION_HOST_STARTUP_RESULT__')
    except Exception as error:
        result['servedPage'] = {'status': 'UNVERIFIED', 'error': str(error)}
    page.close()
    page = browser.new_page()  # No attempt to navigate around a blocked URL.
    console = []
    page.on('console', lambda message: console.append({'type': message.type, 'text': message.text[:1600]}))
    page.add_script_tag(type='importmap', content=json.dumps(imports))
    try:
        result['isolated'] = page.evaluate('''async ({suiteURI,workerSource,authoringSource})=>{
          const {runHostStartupSuite}=await import(suiteURI);
          const {ProgressWatchdog}=await import('@helion.bundle/src/gpu/progress-watchdog.js');
          const {prepareView}=await import('@helion.bundle/src/startup/prepare.js');
          const {h,compile}=await import('@helion.bundle/src/core/compiler.js');
          const {diagnosticFont}=await import('@helion.bundle/src/text/fonts.js');
          const {AppSandbox}=await import('@helion.bundle/src/playground/sandbox.js');
          return runHostStartupSuite({ProgressWatchdog,prepareView,h,compile,diagnosticFont,AppSandbox,workerSource,authoringSource,includeSourceWorker:false});
        }''', {'suiteURI': suite_uri, 'workerSource': worker, 'authoringSource': authoring})
        result['isolated']['context'] = 'New about:blank document with exact built import-map modules; not a loaded application page or source-module-worker test.'
    except Exception as error:
        result['isolated'] = {'status': 'FAIL', 'error': str(error)}
    if args.baseline:
        with zipfile.ZipFile(args.baseline) as z:
            old = z.read('helion-ui/src/gpu/progress-watchdog.js').decode().replace('export class', 'class')
        result['baselineWatchdog'] = page.evaluate('''source=>{
          const C=Function(source+';return ProgressWatchdog;')();let w;
          try {w=new C({timeoutMs:15});w.submitted(1);return {error:null};}
          catch(e){return {error:String(e)};}
          finally{try{w?.dispose();}catch{}}
        }''', old)
    result['isolatedWorkerRouteProbe'] = page.evaluate('''async()=>{
      const result={};for(const type of ['module','classic']){let worker,url,timer;
        try{url=URL.createObjectURL(new Blob(['postMessage({ok:true});'],{type:'text/javascript'}));
          result[type]=await new Promise(resolve=>{timer=setTimeout(()=>resolve({error:'timeout'}),2500);worker=new Worker(url,{type});worker.onmessage=e=>{clearTimeout(timer);resolve(e.data)};worker.onerror=e=>{e.preventDefault();clearTimeout(timer);resolve({error:e.message??null,rejected:true})}});
        }catch(e){result[type]={error:String(e),rejected:true}}
        finally{clearTimeout(timer);worker?.terminate();if(url)URL.revokeObjectURL(url)}
      }return result;
    }''')
    # Exercise the shipped inline guard with a synthetic file location and real DOM.
    result['fileLaunchGuards'] = []
    for app in ['designer', 'playground', 'standalone']:
        page_html = (root / f'dist/helion-{app}.html').read_text()
        guard = re.search(r'<script data-helion-launch>(.*?)</script>', page_html, re.S)[1]
        observed = page.evaluate('''({guard,app})=>{
          document.body.innerHTML='<div id="boot" hidden><h1 id="boot-title"></h1><p id="boot-detail"></p><p id="boot-hint"></p></div>';
          const mock={location:{protocol:'file:',href:'file:///private/Helion%20UI/helion-'+app+'.html'}};
          Function('globalThis',guard)(mock);
          return {app,status:mock.__HELION_LAUNCH_STATUS__,visible:!document.getElementById('boot').hidden,text:document.getElementById('boot-detail').textContent};
        }''', {'guard': guard, 'app': app})
        result['fileLaunchGuards'].append(observed)
    result['console'] = console
    browser.close()
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
# A blocked page is unverified, not passed, even when the isolated API checks pass.
raise SystemExit(0 if result.get('isolated',{}).get('status')=='PASS' and result.get('servedPage',{}).get('status')=='PASS' else 2)
