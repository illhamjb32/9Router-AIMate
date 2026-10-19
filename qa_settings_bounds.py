import os, subprocess, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
env=os.environ.copy();env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS']='--remote-debugging-port=19229'
proc=subprocess.Popen([str(root/'AIMate-Widget.exe')],env=env)
try:
 for _ in range(60):
  try:
   urllib.request.urlopen('http://127.0.0.1:19229/json/version',timeout=1);break
  except Exception:time.sleep(.2)
 with sync_playwright() as p:
  browser=p.chromium.connect_over_cdp('http://127.0.0.1:19229')
  page=browser.contexts[0].pages[0]
  page.wait_for_selector('#settings-button')
  for size in [50,70,100]:
   page.evaluate('(s) => localStorage.setItem("aimate-size",s)',str(size));page.reload()
   page.wait_for_timeout(900)
   before=page.evaluate('() => [innerWidth,innerHeight]')
   page.locator('#settings-button').click();page.wait_for_timeout(600)
   after=page.evaluate('() => [innerWidth,innerHeight]')
   assert before==after, f'WINDOW GREW: {before} -> {after}'
   for selector in ['#close-settings','#widget-size','#endpoint','#save-button']:
    page.locator(selector).scroll_into_view_if_needed()
    b=page.locator(selector).bounding_box()
    assert b['x']>=-1 and b['y']>=-1 and b['x']+b['width']<=after[0]+1 and b['y']+b['height']<=after[1]+1,(selector,b,after)
   page.locator('#close-settings').click();page.wait_for_timeout(300)
   assert page.evaluate('() => [innerWidth,innerHeight]')==before
   print('SETTINGS_BOUNDS_PASS',size,before,flush=True)
  page.evaluate('localStorage.setItem("aimate-size","70")');page.reload();page.wait_for_timeout(600)
  page.locator('#settings-button').click();page.wait_for_timeout(300)
  page.screenshot(path=str(root/'qa/settings-fixed.png'))
  page.locator('#close-settings').click()
  page.locator('#quit-button').click();proc.wait(timeout=8)
finally:
 if proc.poll() is None:proc.terminate()
