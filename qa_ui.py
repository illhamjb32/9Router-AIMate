from pathlib import Path
from playwright.sync_api import sync_playwright
import json, functools, http.server, threading
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(Path(__file__).parent/'ui')))
threading.Thread(target=server.serve_forever, daemon=True).start()
root=Path(__file__).parent
out=root/'qa';out.mkdir(exist_ok=True)
with sync_playwright() as p:
 browser=p.chromium.launch()
 page=browser.new_page(viewport={'width':360,'height':420},device_scale_factor=2)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 results=[]
 for state in ['working','idle','offline']:
  page.goto(f'http://127.0.0.1:{server.server_port}/?preview='+state)
  page.wait_for_function("document.querySelector('#mochi-3d').dataset.ready === 'true'")
  page.wait_for_timeout(400)
  assert page.locator('#widget').get_attribute('data-state')==state
  assert page.locator('#preview-badge').is_visible()
  page.screenshot(path=str(out/(state+'.png')),omit_background=True)
  results.append({'preview':state,'label':page.locator('#state-label').inner_text(),'overflow':page.evaluate('document.documentElement.scrollHeight > innerHeight')})
 page.locator('#settings-button').click();assert page.locator('#settings').is_visible()
 page.screenshot(path=str(out/'settings.png'),omit_background=True)
 page.locator('#close-settings').click();assert not page.locator('#settings').is_visible()
 assert not errors,errors
 print(json.dumps({'results':results,'pageErrors':errors,'settings':'PASS'}))
 browser.close()
