(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const invoke = window.__TAURI__?.core?.invoke;
  const requestedPreview = new URLSearchParams(location.search).get('preview');
  const states = ['working', 'idle', 'offline'];
  const preview = !invoke || states.includes(requestedPreview);
  const labels = {
    working: ['Mengetik', 'Ide mengalir, kaki mengetik.', 'Mochi sedang mengetik bersama AI.'],
    idle: ['Tidur', 'Mochi tidur sebentar.', 'Belum ada permintaan aktif.'],
    offline: ['Terputus', 'Mochi kehilangan sinyal.', 'Periksa 9router atau alamat koneksinya.']
  };
  let size = Math.min(100, Math.max(50, Number(localStorage.getItem('aimate-size')) || 100));
  let resizeQueue = Promise.resolve();
  let showInfo = localStorage.getItem('aimate-show-info') !== 'false';
  function applyInfo() {
    $('widget').classList.toggle('pure-cat', !showInfo);
    $('show-info').checked = showInfo;
  }
  $('show-info').addEventListener('change', () => {
    showInfo = $('show-info').checked;
    localStorage.setItem('aimate-show-info', String(showInfo));
    applyInfo();
  });
  applyInfo();
  function applySize() {
    const scale = size / 100;
    $('widget').style.zoom = scale;
    $('settings').style.zoom = scale;
    $('widget-size').value = size;
    $('size-value').textContent = `${size}%`;
    if (invoke && !preview) {
      const width = Math.round(360 * scale);
      const height = Math.round(420 * scale);
      resizeQueue = resizeQueue.catch(() => {}).then(() =>
        window.__TAURI__.window.getCurrentWindow().setSize(new window.__TAURI__.dpi.LogicalSize(width, height))
      ).catch(error => { $('settings-message').textContent = `Ukuran gagal diubah: ${error}`; });
    }
  }
  $('widget-size').addEventListener('input', () => {
    size = Number($('widget-size').value);
    localStorage.setItem('aimate-size', String(size));
    applySize();
  });
  applySize();
  let endpoint = 'http://127.0.0.1:20128';
  let lastState = '';
  let polling = false;
  let saving = false;
  let generation = 0;
  function render(status) {
    const state = states.includes(status?.state) ? status.state : 'offline';
    const active = Number.isFinite(status?.active) ? Math.max(0, Math.floor(status.active)) : 0;
    $('widget').dataset.state = state;
    const fmt = new Intl.NumberFormat('id-ID');
    const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
    const input = status?.input_tokens;
    const output = status?.output_tokens;
    for (const [id, value] of [['token-input', input], ['token-output', output], ['token-total', Number.isFinite(input) && Number.isFinite(output) ? input + output : null]]) {
      $(id).textContent = Number.isFinite(value) ? compact.format(value) : '—';
      $(id).title = Number.isFinite(value) ? `${fmt.format(value)} token` : 'Data token belum tersedia';
    }
    $('state-label').textContent = labels[state][0];
    $('headline').textContent = labels[state][1];
    $('detail').textContent = status?.detail || labels[state][2];
    $('detail').title = $('detail').textContent;
    $('model').textContent = status?.model || 'Belum ada model';
    $('model').title = $('model').textContent;
    $('activity').textContent = state === 'offline' ? 'Tidak terhubung' : `${active} aktif`;
    $('pet-description').textContent = state === 'working' ? 'Mochi mengetik dengan kedua kaki bergantian.' : state === 'idle' ? 'Mochi tidur dengan mata tertutup, kepala bersandar, dan napas lembut.' : 'Mochi menunggu koneksi, dengan tanda terputus di sampingnya.';
    if (status?.endpoint && typeof status.endpoint === 'string') {
      endpoint = status.endpoint;
      if (!$('settings').open) $('endpoint').value = endpoint;
    }
    if (state !== lastState) {
      $('announcement').textContent = `${preview ? 'Preview. ' : ''}${labels[state][0]}. ${labels[state][1]}`;
      lastState = state;
    }
  }
  async function poll() {
    if (preview || polling || saving) return;
    polling = true;
    const requestGeneration = generation;
    try {
      const status = await invoke('get_status');
      if (requestGeneration === generation) render(status);
    } catch (error) {
      if (requestGeneration === generation) render({ state: 'offline', detail: `Koneksi belum tersedia: ${String(error)}` });
    } finally { polling = false; }
  }
  $('settings-button').addEventListener('click', () => {
    $('endpoint').value = endpoint;
    $('settings-message').textContent = preview ? 'Mode preview: perubahan tidak disimpan ke router.' : '';
    $('settings').showModal();
    applySize();
  });
  $('close-settings').addEventListener('click', () => $('settings').close());
  $('settings').addEventListener('close', () => { applySize(); $('settings-button').focus(); });
  $('settings-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving) return;
    const value = $('endpoint').value.trim();
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.hash || url.search) throw new Error('invalid');
    } catch {
      $('settings-message').textContent = 'Masukkan alamat HTTP/HTTPS tanpa sandi, query, atau fragmen.';
      $('endpoint').setAttribute('aria-invalid', 'true');
      $('endpoint').focus();
      return;
    }
    $('endpoint').removeAttribute('aria-invalid');
    if (preview) {
      $('settings-message').textContent = 'Ini hanya preview. Buka aplikasi desktop untuk menyimpan.';
      return;
    }
    saving = true;
    generation++;
    $('save-button').disabled = true;
    $('endpoint').disabled = true;
    $('settings-message').textContent = 'Menyimpan…';
    try {
      await invoke('set_endpoint', { endpoint: value });
      endpoint = value;
      $('settings-message').textContent = 'Tersimpan. Koneksi akan diperiksa kembali.';
    } catch (error) {
      $('settings-message').textContent = `Belum tersimpan: ${String(error)}`;
    } finally {
      saving = false;
      $('save-button').disabled = false;
      $('endpoint').disabled = false;
      void poll();
    }
  });
  $('quit-button').addEventListener('click', async () => {
    if (preview) {
      $('announcement').textContent = 'Mode preview: tombol keluar hanya tersedia di aplikasi desktop.';
      $('detail').textContent = 'Preview — tutup tab untuk keluar.';
      return;
    }
    try { await invoke('quit_app'); }
    catch (error) {
      $('detail').textContent = `Tidak dapat keluar: ${String(error)}`;
      $('announcement').textContent = $('detail').textContent;
    }
  });
  if (preview) {
    $('preview-badge').hidden = false;
    const state = states.includes(requestedPreview) ? requestedPreview : 'idle';
    render({ state, active: state === 'working' ? 2 : 0, model: 'Model contoh · preview', detail: `Preview ${state} — bukan aktivitas router.` });
  } else {
    void poll();
    const timer = setInterval(() => void poll(), 900);
    window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
  }
})();
