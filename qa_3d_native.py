"""Verify embedded 3D in real WebView2 and existing live backend."""
import os, subprocess, time, urllib.request, json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
env=os.environ.copy();env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS']='--remote-debugging-port=19239'
proc=subprocess.Popen([str(root/'AIMate-Widget.exe')],env=env)
try:
 for _ in range(80):
  try: urllib.request.urlopen('http://127.0.0.1:19239/json/version',timeout=1);break
  except Exception: time.sleep(.25)
 with sync_playwright() as p:
  browser=p.chromium.connect_over_cdp('http://127.0.0.1:19239')
  page=browser.contexts[0].pages[0]
  errors=[];page.on('pageerror', lambda e:errors.append(str(e)))
  page.wait_for_function("document.querySelector('#mochi-3d')?.dataset.ready==='true'",timeout=30000)
  page.wait_for_timeout(1500)
  live=page.evaluate("window.__TAURI__.core.invoke('get_status')")
  snap=page.evaluate('window.__mochi3d.getSnapshot()')
  assert not page.locator('#preview-badge').is_visible()
  assert page.locator('#widget').get_attribute('data-state')==live['state']
  assert snap['state']==live['state']
  assert not page.locator('svg.pet').is_visible()
  page.screenshot(path=str(root/'qa/3d-native.png'),omit_background=True)
  page.locator('#settings-button').click();assert page.locator('#settings').is_visible()
  page.locator('#show-info').uncheck()
  page.locator('#close-settings').click()
  assert not page.locator('.brand').is_visible()
  assert not page.locator('.status-card').is_visible()
  assert page.locator('#mochi-3d canvas').is_visible()
  page.reload()
  page.wait_for_function("document.querySelector('#mochi-3d')?.dataset.ready==='true'")
  assert not page.locator('.status-card').is_visible()
  page.locator('#settings-button').click()
  assert not page.locator('#show-info').is_checked()
  page.locator('#show-info').check()
  page.locator('#close-settings').click()
  assert page.locator('.brand').is_visible()
  assert page.locator('.status-card').is_visible()
  print('INFO_HIDE_SHOW_PERSISTENCE_PASS',flush=True)
  assert not errors, errors
  print(json.dumps({'native3D':'PASS','liveState':live['state'],'frames':snap['frames'],'geometry':snap['memory'],'settings':'PASS','errors':errors}),flush=True)
  page.locator('#quit-button').click();proc.wait(timeout=10)
  print('QUIT_PASS',proc.returncode,flush=True)
finally:
 if proc.poll() is None:proc.terminate()
