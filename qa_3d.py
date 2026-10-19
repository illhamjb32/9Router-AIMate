"""Real local HTTP + Chromium checks for the 3D companion."""
import functools, http.server, threading, json
from pathlib import Path
from playwright.sync_api import sync_playwright
root = Path(__file__).parent
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root/'ui')))
threading.Thread(target=server.serve_forever, daemon=True).start()
results = []
try:
 with sync_playwright() as p:
  browser = p.chromium.launch()
  page = browser.new_page(viewport={'width':360,'height':420}, device_scale_factor=2)
  errors = []
  page.on('pageerror', lambda e: errors.append(str(e)))
  for state in ['working','idle','offline']:
   page.goto(f'http://127.0.0.1:{server.server_port}/?preview={state}')
   page.wait_for_function("document.querySelector('#mochi-3d').dataset.ready === 'true'")
   page.wait_for_timeout(1800)
   assert page.locator('#widget').get_attribute('data-state') == state
   assert page.locator('#mochi-3d').get_attribute('data-state') == state
   assert not page.locator('svg.pet').is_visible()
   first = page.evaluate('window.__mochi3d.getSnapshot()')
   page.wait_for_timeout(500)
   second = page.evaluate('window.__mochi3d.getSnapshot()')
   page.screenshot(path=str(root/f'qa/3d-{state}.png'), omit_background=True)
   results.append({'state':state,'first':first,'second':second})
  page.locator('#settings-button').click()
  for size in ['50','75','100']:
   page.locator('#widget-size').fill(size)
   page.wait_for_timeout(150)
   assert page.locator('#size-value').inner_text() == size+'%'
  page.locator('#close-settings').click()
  assert not errors, errors
  print(json.dumps({'states': results,'pageErrors':errors,'settingsAndScale':'PASS'}, indent=2))
  browser.close()
finally:
 server.shutdown()
