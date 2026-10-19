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
  page.wait_for_function("() => document.querySelector('#token-total').textContent !== '—'")
  status=page.evaluate("() => window.__TAURI__.core.invoke('get_status')")
  expected=page.evaluate("n => new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(n)", status['input_tokens']+status['output_tokens'])
  assert page.locator('#token-total').inner_text()==expected
  print('LIVE_TOKENS_PASS',status['input_tokens'],status['output_tokens'],expected,flush=True)
  for size in [50,75,100,70]:
   before=page.evaluate('() => [innerWidth,innerHeight]')
   page.locator('#settings-button').click()
   page.wait_for_timeout(200)
   assert page.evaluate('() => [innerWidth,innerHeight]')==before
   page.locator('#widget-size').fill(str(size))
   assert page.locator('#size-value').inner_text()==f'{size}%'
   page.locator('#close-settings').click()
   page.wait_for_timeout(1000)
   print('DEBUG',page.evaluate('() => ({w:innerWidth,h:innerHeight,msg:document.querySelector("#settings-message").textContent, size:localStorage.getItem("aimate-size")})'),flush=True)
   page.wait_for_function(f'() => Math.abs(innerWidth - {round(360*size/100)}) <= 1 && Math.abs(innerHeight - {round(420*size/100)}) <= 1')
   bounds=page.locator('#widget').bounding_box()
   assert abs(bounds['width']-360*size/100)<2,bounds
   assert abs(bounds['height']-420*size/100)<2,bounds
   print('SIZE_PASS',size,bounds,flush=True)
  page.reload()
  page.wait_for_function('() => innerWidth === 252 && Math.abs(innerHeight - 294) <= 1')
  assert page.locator('#size-value').inner_text()=='70%'
  print('PERSISTENCE_PASS reload 70%',flush=True)
  page.locator('#settings-button').click()
  page.wait_for_function('() => Math.abs(innerHeight - 294) <= 1')
  assert 'gagal' not in page.locator('#settings-message').inner_text()
  page.screenshot(path=str(root/'qa/size-settings.png'))
  page.locator('#close-settings').click()
  page.wait_for_function('() => Math.abs(innerHeight - 294) <= 1')
  page.screenshot(path=str(root/'qa/size-small.png'),omit_background=True)
  page.locator('#quit-button').click()
  proc.wait(timeout=8)
finally:
 if proc.poll() is None:proc.terminate()
