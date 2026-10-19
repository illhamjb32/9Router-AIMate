/* Mochi: original procedural miniature. Three.js 0.160.1, vendored MIT.
 * Integration: #mochi-3d inside #widget; data-state=working|idle|offline.
 * No network, textures, external fonts, or model assets required.
 */
import * as THREE from './vendor/three.module.js';

export function initMochi3D(container = document.getElementById('mochi-3d')) {
  if (!container || container.__mochiInstance) return container?.__mochiInstance;
  const widget = document.getElementById('widget');
  if (!widget) return null;
  let renderer, observer, resizeObserver, raf = 0, disposed = false, frames = 0;
  let state = 'offline', elapsed = 0, previous = 0, sleepMix = 0;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const geometries = new Set(), materials = new Set();
  const scene = new THREE.Scene();
  const animation = { breathing: 0, leftPaw: 0, rightPaw: 0, headLean: 0, sleepMix: 0 };
  const fail = error => {
    container.dataset.error = String(error?.message || error);
    delete container.dataset.ready;
    widget.classList.remove('has-3d');
  };
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);
    const camera = new THREE.OrthographicCamera(-2.7, 2.7, 2, -2, .1, 30);
    camera.position.set(0, 3.05, 8);
    camera.lookAt(0, 1.42, 0);
    scene.add(new THREE.HemisphereLight(0xe8f4ff, 0xc9adc0, 2.1));
    const key = new THREE.DirectionalLight(0xffead4, 3.3);
    key.position.set(-3, 6, 5); key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -3, near: .5, far: 15 });
    key.shadow.bias = -.0007; key.shadow.normalBias = .025;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xb4d9ff, 2);
    rim.position.set(4, 3, -3); scene.add(rim);
    const material = (color, options = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: .62, metalness: .02, ...options });
      materials.add(m); return m;
    };
    const cream = material('#fff0d9'), milk = material('#fffaf0');
    const blue = material('#87afcf'), pink = material('#efa8b5');
    const ink = material('#303e55', { roughness: .27 });
    const white = material('#ffffff', { roughness: .2 });
    const lavender = material('#b7afd4'), metal = material('#dad5ed', { metalness: .25 });
    const screen = material('#27384c', { emissive: '#27384c', emissiveIntensity: .3 });
    const mint = material('#aee6d1', { emissive: '#aee6d1', emissiveIntensity: .3 });
    const lineMat = material('#8194ac');
    const sphereGeometry = new THREE.SphereGeometry(1, 28, 20); geometries.add(sphereGeometry);
    function mesh(geometry, mat, parent, pos, scale) {
      geometries.add(geometry);
      const o = new THREE.Mesh(geometry, mat); o.position.set(...pos);
      if (scale) o.scale.set(...scale);
      o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
    }
    const ball = (parent, mat, pos, scale) => mesh(sphereGeometry, mat, parent, pos, scale);
    function rounded(parent, mat, pos, size, r = .06) {
      const [w, h, d] = size; r = Math.min(r, w / 3, h / 3, d / 3);
      const s = new THREE.Shape(), x = -w / 2 + r, y = -h / 2 + r;
      s.moveTo(x, -h / 2); s.lineTo(w / 2 - r, -h / 2);
      s.quadraticCurveTo(w / 2, -h / 2, w / 2, y);
      s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      s.lineTo(x, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      s.lineTo(-w / 2, y); s.quadraticCurveTo(-w / 2, -h / 2, x, -h / 2);
      const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r * .45, bevelSegments: 3, steps: 1, curveSegments: 5 });
      g.translate(0, 0, -d / 2 + r);
      return mesh(g, mat, parent, pos);
    }
    function tube(parent, mat, points, radius = .015) {
      const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
      return mesh(new THREE.TubeGeometry(curve, Math.max(10, points.length * 7), radius, 7, false), mat, parent, [0, 0, 0]);
    }
    const root = new THREE.Group(); scene.add(root);
    // A low oval cushion grounds the silhouette without an opaque background.
    ball(root, material('#d4dfdf'), [0, .12, .05], [1.84, .14, 1.02]);
    ball(root, material('#e7ece6'), [0, .19, .05], [1.78, .1, .98]);
    const floor = mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ color: 0x576b83, opacity: .16 }), scene, [0, .014, 0]);
    materials.add(floor.material); floor.rotation.x = -Math.PI / 2; floor.castShadow = false;
    const cat = new THREE.Group(); cat.position.set(0, .25, -.1); root.add(cat);
    const body = ball(cat, blue, [0, .68, -.03], [.66, .76, .54]);
    ball(cat, cream, [0, .66, .37], [.48, .58, .24]);
    const tail = new THREE.Group(); tail.position.set(-.45, .2, -.1); cat.add(tail);
    const tailMesh = tube(tail, blue, [[0, 0, 0], [-.55, .03, -.12], [-.93, .24, -.04], [-.97, .65, .04], [-.78, .82, .12]], .15);
    const tailTip = ball(tail, cream, [-.78, .82, .12], [.155, .155, .155]);
    // Deform the original vertices in place: no per-frame geometry allocation.
    const tailPositions = tailMesh.geometry.attributes.position;
    const tailRest = tailPositions.array.slice();
    tailMesh.frustumCulled = false;
    function tailOffset(y, t, amplitude) {
      const weight = THREE.MathUtils.clamp(y / .82, 0, 1);
      return Math.sin(t * 2.2 - weight * 2.4) * amplitude * weight * weight;
    }
    for (const x of [-.43, .43]) {
      ball(cat, cream, [x, .19, .34], [.29, .19, .36]);
      ball(cat, pink, [x, .18, .667], [.105, .072, .023]);
      for (const dx of [-.085, 0, .085]) ball(cat, pink, [x + dx, .265, .64], [.034, .037, .022]);
    }
    const head = new THREE.Group(); cat.add(head);
    ball(head, cream, [0, 0, 0], [.83, .72, .65]);
    const ears = [];
    // Soft triangular ears with sculpted pink inserts.
    for (const side of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(side * .57, .52, -.045); ear.rotation.z = -side * .22; head.add(ear); ears.push(ear);
      const eg = new THREE.ConeGeometry(.31, .65, 3, 1); eg.rotateY(Math.PI / 2);
      const e = mesh(eg, blue, ear, [0, .16, 0], [1, 1, .67]);
      e.rotation.x = -.08;
      const ig = new THREE.ConeGeometry(.19, .43, 3, 1); ig.rotateY(Math.PI / 2);
      mesh(ig, pink, ear, [0, .17, .115], [1, 1, .3]);
      ball(ear, blue, [0, .47, 0], [.075, .075, .06]);
    }
    ball(head, blue, [-.46, .41, -.04], [.38, .28, .54]);
    // Three tiny crown tufts, deliberately asymmetrical.
    for (let i = 0; i < 3; i++) {
      const tuft = ball(head, cream, [-.14 + i * .12, .65 + i * .015, .02], [.11, .19 - i * .025, .13]);
      tuft.rotation.z = -.35;
    }
    const openEyes = new THREE.Group(), shutEyes = new THREE.Group(); head.add(openEyes, shutEyes);
    for (const side of [-1, 1]) {
      const x = side * .29;
      ball(openEyes, ink, [x, .04, .597], [.105, .145, .061]);
      ball(openEyes, white, [x - .025, .091, .65], [.037, .043, .017]);
      ball(openEyes, mint, [x + .035, -.015, .65], [.021, .025, .012]);
      tube(shutEyes, ink, [[x - .105, .035, .61], [x, -.01, .638], [x + .105, .035, .61]], .021);
      ball(head, pink, [side * .51, -.15, .51], [.14, .073, .031]);
      ball(head, milk, [side * .13, -.19, .615], [.2, .145, .1]);
      for (let i = 0; i < 2; i++) tube(head, lineMat, [[side * .51, -.19 - i * .07, .55], [side * .71, -.16 - i * .11, .56], [side * .89, -.12 - i * .15, .52]], .009);
    }
    ball(head, pink, [0, -.13, .727], [.073, .052, .045]);
    tube(head, ink, [[0, -.17, .714], [0, -.235, .718]], .011);
    for (const s of [-1, 1]) tube(head, ink, [[0, -.235, .718], [s * .065, -.27, .711], [s * .11, -.23, .7]], .011);
    const paws = [-1, 1].map(side => {
      const p = new THREE.Group(); cat.add(p);
      ball(p, cream, [0, 0, 0], [.235, .18, .3]);
      for (const dx of [-.065, .035]) tube(p, lineMat, [[dx, -.015, .285], [dx, -.075, .26]], .009);
      ball(p, pink, [0, -.14, .08], [.09, .023, .11]);
      return p;
    });
    // Centered laptop: keyboard and screen face the kitten, lid back faces viewer.
    const laptop = new THREE.Group(); laptop.position.set(0, .55, 1.05); laptop.rotation.y = Math.PI; root.add(laptop);
    rounded(laptop, metal, [0, 0, 0], [1.55, .11, .91], .035);
    const lid = new THREE.Group(); lid.position.set(0, .07, -.34); lid.rotation.x = -.13; laptop.add(lid);
    rounded(lid, lavender, [0, .48, 0], [1.51, .97, .1], .045);
    rounded(lid, screen, [0, .49, .065], [1.32, .76, .025], .008);
    ball(lid, ink, [0, .9, .06], [.019, .019, .012]);
    // Code editor: titlebar dots, navigation rail, mint/lilac syntax lines.
    for (let i = 0; i < 3; i++) ball(lid, [pink, cream, mint][i], [-.54 + i * .07, .79, .088], [.018, .018, .01]);
    rounded(lid, lineMat, [-.51, .43, .087], [.025, .42, .012], .003);
    const codeLines = [];
    for (let i = 0; i < 5; i++) {
      const width = [.53, .73, .43, .61, .31][i];
      codeLines.push(rounded(lid, i % 2 ? lavender : mint, [-.35 + width / 2, .67 - i * .105, .087], [width, .026, .012], .004));
    }
    for (let row = 0; row < 3; row++) for (let col = 0; col < 10; col++) {
      rounded(laptop, row === 0 && col === 0 ? pink : lavender, [-.59 + col * .13, .069, -.17 + row * .13], [.1, .022, .09], .006);
    }
    rounded(laptop, lavender, [0, .065, .31], [.42, .014, .13], .004);
    // A tiny paw-print charm on the palm rest.
    ball(laptop, pink, [.55, .083, .31], [.045, .011, .04]);
    for (const dx of [-.04, 0, .04]) ball(laptop, pink, [.55 + dx, .082, .245], [.017, .01, .021]);
    // Small raised paw emblem on the outer lid, visible from the front.
    ball(lid, pink, [0, .48, -.068], [.10, .085, .018]);
    for (const x of [-.12, 0, .12]) ball(lid, cream, [x, .62, -.068], [.045, .048, .018]);
    const zzz = [];
    for (let i = 0; i < 3; i++) {
      const z = new THREE.Group(); root.add(z);
      const zm = material('#8b9dbf', { transparent: true, opacity: .7 });
      tube(z, zm, [[-.09, .1, 0], [.09, .1, 0], [-.09, -.1, 0], [.09, -.1, 0]], .018);
      zzz.push(z);
    }
    function update(dt) {
      const reduced = motion.matches, t = reduced ? 0 : elapsed;
      const sleeping = state === 'idle', working = state === 'working';
      sleepMix = reduced ? Number(sleeping) : THREE.MathUtils.damp(sleepMix, Number(sleeping), 7, dt);
      const breath = reduced ? 0 : Math.sin(t * (sleeping ? 1.7 : 2.1)) * .018;
      body.scale.y = .76 + breath;
      head.position.set(-sleepMix * .1, 1.84 - sleepMix * .72 + breath, .08 + sleepMix * .27);
      head.rotation.set((working ? .18 : .04) + sleepMix * .13, 0, sleepMix * -.17 + (working && !reduced ? Math.sin(t * 5) * .018 : 0));
      const blink = !reduced && (t % 5.4) > 5.22;
      openEyes.visible = !sleeping && !blink; shutEyes.visible = sleeping || blink;
      paws.forEach((p, i) => {
        const lift = working && !reduced ? Math.max(0, Math.sin(t * 10 + i * Math.PI)) * .13 : 0;
        const restingX = i ? .34 : -.34, typingX = i ? .34 : -.34;
        p.position.set(working ? typingX : restingX, sleeping ? .69 : working ? .43 + lift : .58, working ? 1.1 : .65);
        p.rotation.x = working ? -.15 - lift : 0;
        animation[i ? 'rightPaw' : 'leftPaw'] = lift;
      });
      const energy = (working ? .22 : .14) * (1 - sleepMix) + .035 * sleepMix;
      const amplitude = reduced ? 0 : energy;
      tail.rotation.y = Math.sin(t * 1.2) * amplitude;
      tail.rotation.z = Math.sin(t * 1.6) * amplitude * .65;
      for (let i = 0; i < tailPositions.count; i++) {
        const j = i * 3, bend = tailOffset(tailRest[j + 1], t, amplitude);
        tailPositions.array[j] = tailRest[j] + bend;
        tailPositions.array[j + 1] = tailRest[j + 1];
        tailPositions.array[j + 2] = tailRest[j + 2] + bend * .65;
      }
      tailPositions.needsUpdate = true;
      tailMesh.geometry.computeVertexNormals();
      const tipBend = tailOffset(.82, t, amplitude);
      tailTip.position.set(-.78 + tipBend, .82, .12 + tipBend * .65);
      ears.forEach((ear, i) => {
        const phase = (t + i * 1.7) % 6.8;
        const twitch = !reduced && phase < .65 ? Math.sin(phase / .65 * Math.PI) * Math.sin(phase * 19) : 0;
        ear.rotation.z = (i ? -1 : 1) * .22 + twitch * .13 * (1 - sleepMix * .7);
      });
      if (!reduced) {
        head.rotation.y = Math.sin(t * .85) * .055 * (1 - sleepMix);
        head.position.y += Math.sin(t * 5) * .018 * Number(working);
      }
      Object.assign(animation, { tailSway: tail.rotation.z, tailBend: tipBend, earTwitch: ears[0].rotation.z });
      zzz.forEach((z, i) => {
        const phase = reduced ? i / 3 : (t * .18 + i / 3) % 1;
        z.visible = sleeping;
        z.position.set(.18 + phase * .75, 2.05 + phase * .7, .15);
        z.scale.setScalar(.55 + phase * .55);
        z.rotation.z = -.12;
        z.children[0].material.opacity = reduced ? .65 : Math.sin(phase * Math.PI) * .8;
      });
      screen.emissiveIntensity = working ? .55 : sleeping ? .08 : .16;
      codeLines.forEach((line, i) => { line.scale.x = working && !reduced ? .85 + .15 * Math.sin(t * 2 + i) : 1; });
      Object.assign(animation, { breathing: breath, headLean: head.rotation.z, sleepMix });
    }
    function render() {
      if (disposed || document.hidden) return;
      try {
        renderer.render(scene, camera); frames++;
        container.dataset.ready = 'true'; delete container.dataset.error;
        widget.classList.add('has-3d');
      } catch (error) { fail(error); dispose(); }
    }
    function tick(now) {
      raf = 0;
      if (disposed || document.hidden || motion.matches) return;
      if (!previous || now - previous >= 1000 / 30 - .8) {
        const dt = previous ? Math.min((now - previous) / 1000, .1) : 1 / 30;
        previous = now; elapsed += dt; update(dt); render();
      }
      if (!disposed) raf = requestAnimationFrame(tick);
    }
    function resume() {
      cancelAnimationFrame(raf); raf = 0; previous = 0;
      if (disposed || document.hidden) return;
      update(1 / 30); render();
      if (!motion.matches && !disposed) raf = requestAnimationFrame(tick);
    }
    function setState() {
      const next = ['working', 'idle', 'offline'].includes(widget.dataset.state) ? widget.dataset.state : 'offline';
      if (next === state && container.dataset.state) return;
      state = next; container.dataset.state = state;
      if (!frames) sleepMix = Number(state === 'idle');
      update(motion.matches ? 1 : 1 / 30); render();
    }
    function resize() {
      if (disposed) return;
      // clientWidth avoids counting CSS zoom twice; the browser scales the canvas.
      const width = container.clientWidth || 312, height = container.clientHeight || 224;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(width, height, false);
      const aspect = width / height, halfHeight = Math.max(1.88, 2.5 / aspect);
      camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
      camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
      render();
    }
    function contextLost(event) { event.preventDefault(); fail(new Error('WebGL context lost')); dispose(); }
    function dispose() {
      if (disposed) return; disposed = true;
      cancelAnimationFrame(raf); observer?.disconnect(); resizeObserver?.disconnect();
      document.removeEventListener('visibilitychange', resume);
      motion.removeEventListener('change', resume);
      window.removeEventListener('pagehide', dispose);
      canvas.removeEventListener('webglcontextlost', contextLost);
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
      key.shadow.map?.dispose(); key.shadow.mapPass?.dispose();
      renderer.dispose(); canvas.remove();
      widget.classList.remove('has-3d'); delete container.dataset.ready;
    }
    const api = { getSnapshot: () => ({ state, frameCount: frames, frames, disposed, hidden: document.hidden, reducedMotion: motion.matches, ready: container.dataset.ready === 'true', dpr: renderer.getPixelRatio(), size: { width: canvas.width, height: canvas.height }, memory: { ...renderer.info.memory }, render: { ...renderer.info.render }, animation: { ...animation }, threeRevision: THREE.REVISION }), dispose };
    container.__mochiInstance = api; window.__mochi3d = api;
    observer = new MutationObserver(setState); observer.observe(widget, { attributes: true, attributeFilter: ['data-state'] });
    resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container);
    document.addEventListener('visibilitychange', resume);
    motion.addEventListener('change', resume);
    window.addEventListener('pagehide', dispose, { once: true });
    canvas.addEventListener('webglcontextlost', contextLost);
    setState(); resize(); resume();
    return api;
  } catch (error) {
    fail(error); cancelAnimationFrame(raf); observer?.disconnect(); resizeObserver?.disconnect();
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    renderer?.dispose(); renderer?.domElement.remove();
    return null;
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initMochi3D(), { once: true });
else initMochi3D();
