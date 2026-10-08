#!/usr/bin/env python3
"""Optional real-browser gate. Requires separately installed Playwright + Chromium.
No browser policy changes or disabled GPU validation. A missing/blocked GPU fails.
Start `npm start`, then: python tools/gpu-test.py --url http://127.0.0.1:8080/tests/gpu.html
"""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://127.0.0.1:8080/tests/gpu.html')
parser.add_argument('--executable', help='Optional existing permitted Chromium executable')
parser.add_argument('--headed', action='store_true')
parser.add_argument('--output', default='gpu-results.json')
parser.add_argument('--kind', choices=['ui','text','hud','metrics','frame-sync'], default='ui', help='Choose the gate result variable (and supply its matching --url)')
args = parser.parse_args()
result = {'status': 'FAIL', 'error': 'Browser did not finish'}
try:
    with sync_playwright() as p:
        options = {'headless': not args.headed}
        if args.executable:
            options['executable_path'] = args.executable
        browser = p.chromium.launch(**options)
        page = browser.new_page(viewport={'width': 1000, 'height': 900})
        page.goto(args.url + ('&' if '?' in args.url else '?') + 'autorun', wait_until='load')
        variable = {'ui':'__HELION_TEST_RESULT__','text':'__HELION_TEXT_RESULT__','hud':'__HELION_HUD_RESULT__','metrics':'__HELION_METRICS_RESULT__','frame-sync':'__HELION_FRAME_SYNC_RESULT__'}[args.kind]
        page.wait_for_function('(key) => window[key] && [\"PASS\",\"FAIL\"].includes(window[key].status)', arg=variable, timeout=180000)
        result = page.evaluate('(key) => window[key]', variable)
        browser.close()
except Exception as error:
    result = {'status': 'FAIL', 'error': str(error)}
Path(args.output).write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result, indent=2))
raise SystemExit(0 if result['status'] == 'PASS' else 1)
