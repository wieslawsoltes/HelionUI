#!/usr/bin/env python3
"""Optional actual-browser host/worker check; not a GPU or visual test.
Served-page failures stay unverified. No origin/CSP/admin policy bypass is used.
"""
import argparse,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('--browser',default='/usr/bin/chromium');p.add_argument('--base',default='http://127.0.0.1:8123');p.add_argument('--output',type=Path,required=True);args=p.parse_args()
root=Path(__file__).resolve().parents[1];html=(root/'dist/helion-standalone.html').read_text()
imports=json.loads(re.search(r'<script type="importmap">(.*?)</script>',html,re.S)[1]);worker=json.loads(re.search(r'globalThis\.__HELION_PREPARE_WORKER_SOURCE__=(.*?);</script>',html,re.S)[1])
report={'version':json.loads((root/'package.json').read_text())['version'],'headless':True,'containerLaunchArgs':['--no-sandbox'],'scope':'Native browser host/worker serialization only unless a served GPU gate actually passes. No hardware performance claim.','served':[]}
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox']);report['browser']=b.version;report['originOrCSPBypass']=False
 for path,symbol in [('/tests/typography.html?autorun','__HELION_TYPOGRAPHY_RESULT__'),('/tests/shaders.html?autorun','__HELION_SHADER_CHECK__')]:
  page=b.new_page()
  try:
   page.goto(args.base+path,wait_until='domcontentloaded',timeout=15000);page.wait_for_function(f'globalThis.{symbol}?.status && globalThis.{symbol}.status !== "RUNNING"',timeout=90000);report['served'].append({'path':path,'result':page.evaluate('globalThis.'+symbol)})
  except Exception as e:report['served'].append({'path':path,'status':'UNVERIFIED','error':str(e)})
  finally:page.close()
 page=b.new_page();page.add_script_tag(type='importmap',content=json.dumps(imports))
 try:
  report['isolatedTypographyWorker']=page.evaluate('''async worker=>{
   const {h,compile}=await import('@helion.bundle/src/core/compiler.js');
   const {prepareView}=await import('@helion.bundle/src/startup/prepare.js');
   const {diagnosticFont}=await import('@helion.bundle/src/text/fonts.js');
   const {ButtonTemplate,TextBoxTemplate,ToggleSwitchTemplate}=await import('@helion.bundle/src/templates/index.js');
   globalThis.__HELION_PREPARE_WORKER_SOURCE__=worker;const fonts=[diagnosticFont()];const scenes=[
    h('StackPanel',{theme:'macos26',themeVariant:'light',themeContrast:'high',controlDensity:'compact',accentColor:'#b99cff'},h('Button',{id:'a',template:ButtonTemplate,text:'A'}),h('TextBox',{id:'b',template:TextBoxTemplate,text:'B'}),h('CheckBox',{id:'c',template:ToggleSwitchTemplate,text:'C'})),
    h('DesignSurface',{id:'design',designDocument:{capacity:8,history:2,templateCapacity:2,themeContrast:'high',controlDensity:'compact',accentColor:'#69d5a0',templates:[ButtonTemplate],root:{type:'Canvas',props:{id:'root'},children:[{type:'Button',props:{id:'button',template:'Button',text:'AB'}}]}}})
   ];const checks=[];for(const view of scenes){const expected=compile(view,{fonts}),result=await prepareView(view,{fonts});if(!result.stats.worker)throw Error('Worker fallback: '+result.stats.workerFallback);for(const field of ['nodes','state','heap'])if(result.compiled[field].length!==expected[field].length||!result.compiled[field].every((x,i)=>x===expected[field][i]))throw Error('Worker '+field+' mismatch');if(JSON.stringify(result.compiled.templateSystem)!==JSON.stringify(expected.templateSystem))throw Error('Theme manifest mismatch');if(result.compiled.templates.length!==expected.templates.length)throw Error('Template manifest mismatch');if(!expected.shapedTexts.length||JSON.stringify(result.compiled.shapedTexts)!==JSON.stringify(expected.shapedTexts))throw Error('Shaping manifest mismatch');checks.push({themeContrast:expected.templateSystem.themeContrast,controlDensity:expected.templateSystem.controlDensity,accentColor:expected.templateSystem.accentColor,nodes:expected.nodeCount,templates:expected.templates.length,shapedRuns:expected.shapedTexts.length,heapBytes:expected.heap.byteLength,status:'PASS'});}return {status:'PASS',scope:'Actual classic Blob worker, complete initial buffers, template and shaping manifests. No WGSL execution.',checks};
  }''',worker)
 except Exception as e:report['isolatedTypographyWorker']={'status':'FAIL','error':str(e)}
 page.close();b.close()
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
raise SystemExit(0 if all(x.get('result',{}).get('status')=='PASS' for x in report['served']) and report['isolatedTypographyWorker']['status']=='PASS' else 2)
