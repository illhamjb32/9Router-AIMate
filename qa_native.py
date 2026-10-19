"""Launch real desktop EXE with temporary WebView debug port and inspect IPC."""
import os, subprocess, time, json, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).parent
exe=root/'AIMate-Widget.exe'
probe=subprocess.run([str(exe),'--probe'],capture_output=True,text=True,timeout=15)
print('LIVE_PROBE',probe.returncode,probe.stdout.strip(),flush=True)
assert probe.returncode==0
status=json.loads(probe.stdout)
assert status['state'] in ['working','idle']
env=os.environ.copy();env['WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS']='--remote-debugging-port=19229'
proc=subprocess.Popen([str(exe)],env=env)
try:
 for _ in range(50):
  try:
   urllib.request.urlopen('http://127.0.0.1:19229/json/version',timeout=1);break
  except Exception:time.sleep(.2)
 with sync_playwright() as p:
  browser=p.chromium.connect_over_cdp('http://127.0.0.1:19229')
  page=browser.contexts[0].pages[0]
  page.wait_for_function("document.querySelector('#widget')?.dataset.state !== 'offline'")
  real=page.evaluate("window.__TAURI__.core.invoke('get_status')")
  print('NATIVE_IPC',json.dumps(real),flush=True)
  assert not page.locator('#preview-badge').is_visible()
  page.screenshot(path=str(root/'qa/native.png'),omit_background=True)
  page.locator('#settings-button').click();assert page.locator('#settings').is_visible()
  page.locator('#close-settings').click()
  print('NATIVE_UI settings PASS; preview hidden; live '+real['state'],flush=True)
  page.locator('#quit-button').click()
  proc.wait(timeout=8)
  print('QUIT_PASS',proc.returncode,flush=True)
finally:
 if proc.poll() is None:proc.terminate()
