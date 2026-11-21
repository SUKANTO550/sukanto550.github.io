/* Box furnace — SIMPLE DUMMY (owner 2026-11-20: "very simple, like a dummy"), for the final anneal
   (RT -> 150 -> 300 -> 500 °C, furnace cool). No owner photo; typical small 1200 °C muffle box furnace:
   outer 360 W x 420 H x 420 D mm, white-grey steel body, chamber 120 W x 100 H x 200 D mm of light firebrick,
   door hinged on the LEFT (swings open towards the user), controller panel at the right of the door with a red
   LED display. Rests on y = 0, front at +z.
   Also: E.aluminaSetter = flat alumina plate 50 x 50 x 3 mm (cream), rests on y = 0.
   it.furnace = { door (pivot; rotation.y = -open angle), floor (local point: chamber floor centre),
                  mouth (local point: chamber front centre at floor height), depth, setTemp(T, label?) } */
(function () {
  const E = window.EQUIP = window.EQUIP || {};
  const W = 0.36, H = 0.42, D = 0.42, CW = 0.12, CH = 0.1, CD = 0.2, CY = 0.2;   // CY = chamber floor height
  const DX = -0.05;                                    // chamber / door centre x (panel on the right)
  E.furnaceDims = { W, H, D, CW, CH, CD, CY, DX };

  E.furnace = (k, it) => {
    const { THREE } = k;
    const body = k.colMat('#e3e6e8', 0.5), dark = k.colMat('#3b4249', 0.5), brick = k.colMat('#efe6d6', 0.9), steel = k.M.steel;
    const g = new THREE.Group(); it.obj.add(g);
    // body = 4 full-depth blocks around the chamber + a block behind it (the chamber is a real hole)
    const add = (w, h, d, x, y, z, m = body) => { const b = k.rbox(w, h, d, 0.0004, m, 1); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
    const left = DX - CW / 2, right = DX + CW / 2, y0 = 0.02, zb = D / 2 - CD;   // zb = chamber back
    add(left + W / 2, H - y0, D, (-W / 2 + left) / 2, (H + y0) / 2, 0);                 // left of the chamber
    add(W / 2 - right, H - y0, D, (right + W / 2) / 2, (H + y0) / 2, 0);                // right (panel side)
    add(CW, CY - y0, D, DX, (CY + y0) / 2, 0);                                          // below
    add(CW, H - CY - CH, D, DX, (H + CY + CH) / 2, 0);                                  // above
    add(CW, CH, zb + D / 2, DX, CY + CH / 2, (zb - D / 2) / 2);                         // behind
    // feet
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(0.03, 0.02, 0.03, x * (W / 2 - 0.03), 0.01, z * (D / 2 - 0.03), dark);
    // chamber: firebrick lining (open box, front face open), origin = front edge of the floor
    const ch = new THREE.Group(); ch.position.set(DX, CY, D / 2); g.add(ch);
    const lin = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), brick); m.position.set(x, y, z); m.receiveShadow = true; ch.add(m); };
    lin(CW - 0.002, 0.004, CD, 0, 0.002, -CD / 2);                       // floor (top at y = 0.004)
    lin(CW - 0.002, 0.004, CD, 0, CH - 0.002, -CD / 2);                  // roof
    lin(0.004, CH, CD, -CW / 2 + 0.002, CH / 2, -CD / 2);
    lin(0.004, CH, CD, CW / 2 - 0.002, CH / 2, -CD / 2);
    lin(CW, CH, 0.004, 0, CH / 2, -CD + 0.002);                          // back
    // door: hinged on the left edge of the opening, insulated plug on the inside
    const door = new THREE.Group(); door.position.set(DX - CW / 2 - 0.03, CY + CH / 2, D / 2 + 0.001); g.add(door);
    const dw = CW + 0.06, dh = CH + 0.06;
    const slab = k.rbox(dw, dh, 0.03, 0.004, body); slab.position.set(dw / 2, 0, 0.015); slab.castShadow = true; door.add(slab);
    const plug = new THREE.Mesh(new THREE.BoxGeometry(CW - 0.012, CH - 0.012, 0.02), brick); plug.position.set(dw / 2, 0, -0.01); door.add(plug);
    const handle = k.cyl(0.006, 0.006, 0.07, steel, 16); handle.position.set(dw - 0.018, 0, 0.045); door.add(handle);
    for (const y of [-0.03, 0.03]) { const p = k.cyl(0.004, 0.004, 0.015, steel, 10); p.rotation.x = Math.PI / 2; p.position.set(dw - 0.018, y, 0.037); door.add(p); }
    // controller: panel + red LED display (canvas) + 2 buttons, mains switch
    const px = (right + W / 2) / 2, pz = D / 2 + 0.0015;   // on the right block's front face
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.2), k.colMat('#2f353b', 0.5)); panel.position.set(px, CY + 0.05, pz); g.add(panel);
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.0375), new THREE.MeshBasicMaterial({ map: tex })); disp.position.set(px, CY + 0.11, pz + 0.0006); g.add(disp);
    for (const [i, c] of [[0, '#c8cdd2'], [1, '#c8cdd2'], [2, '#3fae5a']]) { const b = k.cyl(0.006, 0.006, 0.004, k.colMat(c, 0.4), 16); b.rotation.x = Math.PI / 2; b.position.set(px - 0.025 + i * 0.025, CY + 0.06, pz + 0.002); g.add(b); }
    const sw = k.rbox(0.02, 0.03, 0.01, 0.002, k.colMat('#c0392b', 0.4)); sw.position.set(px, CY - 0.07, pz + 0.004); g.add(sw);
    // label strip
    const lt = k.canvasTex(256, 32, (c, w, h) => { c.fillStyle = '#2f353b'; c.fillRect(0, 0, w, h); c.fillStyle = '#e8ecef'; c.font = 'bold 20px system-ui'; c.textAlign = 'center'; c.fillText('BOX FURNACE  1200 °C', w / 2, 23); });
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.025), new THREE.MeshStandardMaterial({ map: lt, roughness: 0.6 })); lab.position.set(0, H - 0.04, D / 2 + 0.0012); g.add(lab);
    let last = '';
    const setTemp = (Tc, label = '') => {
      const key = Math.round(Tc) + '|' + label; if (key === last) return; last = key;
      const c = cv.getContext('2d'); c.fillStyle = '#140808'; c.fillRect(0, 0, 256, 128);
      c.fillStyle = '#ff3b2a'; c.font = 'bold 64px "Courier New",monospace'; c.textAlign = 'right'; c.fillText(String(Math.round(Tc)), 200, 70);
      c.font = 'bold 26px system-ui'; c.fillText('°C', 246, 46);
      c.fillStyle = '#ffb02a'; c.font = '22px system-ui'; c.textAlign = 'center'; c.fillText(label, 128, 112);
      tex.needsUpdate = true;
    };
    setTemp(25, 'READY');
    it.furnace = { door, floor: new THREE.Vector3(DX, CY + 0.004, D / 2 - CD / 2 - 0.01), mouth: new THREE.Vector3(DX, CY + 0.004, D / 2 + 0.01), depth: CD, setTemp, dims: E.furnaceDims };
    it.r = Math.hypot(W, D) / 2;
    return it;
  };

  E.aluminaSetter = (k, it) => {
    const m = k.rbox(0.05, 0.003, 0.05, 0.0008, k.colMat('#f1ead8', 0.85)); m.position.y = 0.0015; m.castShadow = true; m.receiveShadow = true;
    it.obj.add(m); it.setterTop = 0.003; it.r = 0.036; return it;
  };
})();
