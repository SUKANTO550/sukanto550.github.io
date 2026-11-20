/* Micropipette — modelled on the owner's photo (VirtualLab/Equipments/Micro pippet, 100–1000 µl).
   White handle with curved finger hook, coloured plunger cap + tip-eject button + lower shaft
   (blue-grey on the 100–1000 µl, yellow on the 10–100 µl), vertical volume counter that shows the
   REAL set volume, black ring where the tip sits, clear tinted tip. Generic: no brand print.
   Contracts with index.html: upright, nose at y ~ 0; tip end at it.tipY; it.tipMesh; it.updateCounter();
   it.press() starts a short plunger dip (animated by it.animate(dt) from the main loop);
   it.setPlunger(d) sets the plunger depth directly (clips); it.tipBottom = tip end y. */
(function () {
  const E = window.EQUIP = window.EQUIP || {};

  E.micropipette = (k, it, big) => {
    const { THREE, M } = k;
    const accent = big ? '#7f9dbd' : '#d9a92a';
    const accM = k.colMat(accent, 0.42), white = k.colMat('#f4f5f3', 0.38), side = k.colMat('#e2e5e7', 0.42), black = k.colMat('#15181b', 0.45);
    const key = big ? 'mp-big' : 'mp-small';

    // body: shaft, handle, side (ejector) strip, eject button, finger hook
    it.obj.add(k.bake(key + '-body', g => {
      g.add(k.lathe([[0.0001, -0.006], [0.0021, -0.006], [0.0031, 0.004], [0.0001, 0.004]], k.colMat('#d9dcdf', 0.35), 20));   // tip cone
      g.add(k.lathe([[0.0001, 0.004], [0.0034, 0.004], [0.0035, 0.0085], [0.0001, 0.0085]], black, 20));                      // black ring
      g.add(k.lathe([[0.0001, 0.0085], [0.0033, 0.0085], [0.0039, 0.03], [0.0045, 0.056], [0.0058, 0.068], [0.0082, 0.079],
        [0.0094, 0.086], [0.0094, 0.0905], [0.0001, 0.0905]], accM, 28));                                                       // shaft
      const body = k.rbox(0.024, 0.13, 0.02, 0.0065, white, 4); body.position.y = 0.0895 + 0.065; g.add(body);
      const strip = k.rbox(0.0055, 0.104, 0.017, 0.0022, side, 3); strip.position.set(0.0128, 0.166, 0); g.add(strip);
      const ej = k.rbox(0.017, 0.0085, 0.015, 0.0028, accM, 3); ej.position.set(0.0118, 0.2235, 0); g.add(ej);
      // finger hook (side view outline, extruded through the body depth)
      const sh = new THREE.Shape();
      sh.moveTo(-0.0105, 0.2175);
      sh.quadraticCurveTo(-0.027, 0.219, -0.0335, 0.2045);
      sh.lineTo(-0.0322, 0.2015);
      sh.quadraticCurveTo(-0.0262, 0.2095, -0.0105, 0.2085);
      const hg = new THREE.ExtrudeGeometry(sh, { depth: 0.013, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0009, bevelSegments: 2, curveSegments: 10 });
      hg.translate(0, 0, -0.0065); hg.deleteAttribute('uv');
      g.add(new THREE.Mesh(k.creased(hg, 0.7), white));
    }, { cast: false }));

    // plunger (moves): white rod + coloured cap
    const pl = k.bake(key + '-plunger', g => {
      g.add(k.lathe([[0.0001, 0.2185], [0.0044, 0.2185], [0.0044, 0.2385], [0.0001, 0.2385]], white, 20));
      g.add(k.lathe([[0.0001, 0.2375], [0.0063, 0.2375], [0.0069, 0.2405], [0.0069, 0.2455], [0.006, 0.2475], [0.0001, 0.2478]], accM, 28));
    });
    it.obj.add(pl);
    it.obj.add(k.bake(key + '-ridges', g => {           // grip ridges round the cap (detail)
      for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; const r = new THREE.Mesh(new THREE.BoxGeometry(0.0009, 0.0042, 0.0008), accM);
        r.position.set(Math.sin(a) * 0.0069, 0.2432, Math.cos(a) * 0.0069); r.rotation.y = a; g.add(r); }
    }, { detailDist: 1.0 }));
    const ridges = it.obj.children[it.obj.children.length - 1];

    // volume counter window (front, +z): redrawn only when the set volume changes
    const c = document.createElement('canvas'); c.width = 64; c.height = 192;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.0068, 0.0215), new THREE.MeshBasicMaterial({ map: tex }));
    win.position.set(-0.001, 0.148, 0.01005); it.obj.add(win);
    let shown = null;
    it.updateCounter = () => {
      const v = it.setVol, s = big ? String(Math.round(v)).padStart(4, '0') : (Math.round(v * 10) / 10).toFixed(1).padStart(5, '0').replace('.', '');
      if (s === shown) return; shown = s;
      const g = c.getContext('2d');
      g.fillStyle = '#16191c'; g.fillRect(0, 0, 64, 192);
      g.fillStyle = '#f2f2f2'; g.fillRect(8, 6, 48, 180);
      g.font = 'bold 40px ui-monospace,Consolas,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const n = s.length;
      for (let i = 0; i < n; i++) { g.fillStyle = (!big && i === n - 1) ? '#c62828' : '#111'; g.fillText(s[i], 32, 6 + 180 * (i + 0.5) / n); }
      if (!big) { g.fillStyle = '#111'; g.fillRect(28, 6 + 180 * (n - 1) / n - 3, 8, 3); }   // decimal mark before the red digit
      tex.needsUpdate = true;
    };
    // range print under the window
    const rt = k.texCache('mp-range-' + big, () => k.canvasTex(64, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.save(); g.translate(w / 2, h / 2); g.rotate(-Math.PI / 2);
      g.fillStyle = '#5a6168'; g.font = 'bold 30px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(big ? '100–1000 µl' : '10–100 µl', 0, 0); g.restore();
    }));
    const rl = new THREE.Mesh(new THREE.PlaneGeometry(0.005, 0.02), new THREE.MeshBasicMaterial({ map: rt, transparent: true, depthWrite: false }));
    rl.position.set(0.0045, 0.118, 0.01005); it.obj.add(rl);

    // tip (shown when attached)
    const tipBottom = big ? -0.046 : -0.03;
    const tipM = k.colMat(big ? '#8fd3e6' : '#ffe08a', 0.25, { transparent: true, opacity: 0.75, depthWrite: false });
    const tip = k.lathe([[0.0005, tipBottom], [0.0009, tipBottom + 0.0015], [0.0029, 0.0], [0.0034, 0.0045], [0.0037, 0.0085], [0.0039, 0.0095]], tipM, 18);
    tip.visible = false; tip.castShadow = false; tip.renderOrder = 3; it.obj.add(tip);
    it.tipMesh = tip; it.tipY = tipBottom - 0.001;

    // plunger dip when drawing / dispensing
    let t = -1;
    it.press = () => { t = 0; k.animate(it); };
    // direct plunger depth (metres) for the close-up clips: first stop ~0.007, second stop (blow-out) ~0.0105
    it.setPlunger = d => { t = -1; pl.position.y = ridges.position.y = -d; };
    it.tipBottom = tipBottom;
    it.animate = dt => {
      if (t < 0) return false;
      t += dt; const d = t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / 0.3);
      pl.position.y = ridges.position.y = -0.007 * d;
      if (t > 0.45) { t = -1; pl.position.y = ridges.position.y = 0; return false; }
      return true;
    };
    it.updateCounter();
  };
})();
