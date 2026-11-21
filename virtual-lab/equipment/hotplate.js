/* Hotplate stirrers — modelled on the owner's photos. Generic: no brand print.
   Big hotplates: VirtualLab/Equipments/Hot plate — thick white ceramic plate raised on white clips over a
   dark deck + steel frame, light grey body, front console with sloped face: grey-green LCD on the left,
   two large knobs with red scale marks, Heat / Stir lights, hot-surface warning.
   Mini stirrer: VirtualLab/Equipments/magnatic stirrer.
   Hotplate: grey body, steel tray under the plate, white front panel with LCD (temperature + rpm),
   Stir / Heat lights, two grey ribbed knobs with printed scales.
   Mini stirrer: grey body, round plate, red LED display, one knob.
   White ceramic top plate on a steel tray and a sloped front panel, as in the photo.
   Contracts with index.html: same W/D/H; it.plateZ / it.plateTop = plate centre z / plate top y (set here; mini:
   z -0.008, top H + 0.007 - big: z -D/2 + 0.1, top H + 0.0105);
   returns { knobT, knobR, dispMesh } (knobs turn about z). */
(function () {
  const E = window.EQUIP = window.EQUIP || {};

  function knob(k, r) {
    const { THREE } = k;
    const piv = new THREE.Group();
    piv.add(k.bake('knob-' + r, g => {
      const km = k.colMat('#33393f', 0.45), cap = k.colMat('#535b63', 0.35);   // dark knobs: stand out on the grey body
      const body = k.lathe([[0.0001, 0], [r, 0], [r, 0.011], [r * 0.93, 0.0135], [0.0001, 0.0138]], km, 32); body.rotation.x = Math.PI / 2; g.add(body);
      const top = k.lathe([[0.0001, 0.0137], [r * 0.78, 0.0137], [r * 0.7, 0.0152], [0.0001, 0.0154]], cap, 32); top.rotation.x = Math.PI / 2; g.add(top);
      for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; const b = new THREE.Mesh(new THREE.BoxGeometry(0.0013, 0.0013, 0.009), km);
        b.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.0048); b.rotation.z = a; g.add(b); }
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.0016, r * 0.6, 0.0006), k.colMat('#f3f4f2', 0.5)); line.position.set(0, r * 0.45, 0.0156); g.add(line);
    }));
    return piv;
  }

  function panelTex(k, spec, mini) {
    return k.texCache('hp-panel-' + (mini ? 'mini' : spec.maxT), () => k.canvasTex(512, 200, (g, w, h) => {
      g.fillStyle = '#f2f3f1'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7b838b'; g.font = '18px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.strokeStyle = '#9aa1a8'; g.lineWidth = 2;
      if (mini) {
        g.fillText('Power', 70, 70); g.fillText('Stir', 300, 108);
        g.fillText('0', 360, 175); g.fillText('1500', 490, 120);
        g.beginPath(); g.arc(430, 140, 62, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
      } else {
        g.fillText('Stir', 32, 38); g.fillText('Heat', 32, 90);
        g.fillText('RT', 108, 190); g.fillText(spec.maxT + ' °C', 230, 190);
        g.fillText('200', 290, 190); g.fillText('1500 rpm', 412, 190);
        g.beginPath(); g.arc(170, 148, 54, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
        g.beginPath(); g.arc(350, 148, 54, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
        g.font = '22px system-ui,sans-serif'; g.fillText('⚠', 470, 60);
      }
    }));
  }

  function miniStirrer(k, it, spec, W, D, H, mini) {
    const { THREE, M } = k;
    // plate centre: the mini's round plate (r 68 mm with its seat) must stay inside the top, behind the sloped front
    // (it overhung the front edge by ~7 mm with the big plate's -D/2 + 0.1)
    const zc = mini ? -0.008 : -D / 2 + 0.1;
    it.plateZ = zc; it.plateTop = H + (mini ? 0.007 : 0.0105);
    const slope = mini ? 0.015 : 0.026;              // front panel leans back (photo)
    const ang = Math.atan2(slope, H), faceL = Math.hypot(H, slope);
    it.obj.add(k.bake(mini ? 'hp-mini-body2' : 'hp-body2', g => {
      const grey = k.colMat('#6c747b', 0.55), deck = k.colMat('#5f676e', 0.55);
      // body: side profile (front sloped) extruded across the width, soft bevelled edges
      const b = 0.005, sh = new THREE.Shape();
      sh.moveTo(-(D / 2 - b), b); sh.lineTo(-(D / 2 - slope - b), H - b); sh.lineTo(D / 2 - b, H - b); sh.lineTo(D / 2 - b, b);
      const bg = new THREE.ExtrudeGeometry(sh, { depth: W - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3 });
      bg.rotateY(Math.PI / 2); bg.translate(-(W - 2 * b) / 2, 0, 0); bg.deleteAttribute('uv');
      g.add(new THREE.Mesh(k.creased(bg, 0.5), grey));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const f = k.cyl(0.007, 0.007, 0.005, M.black, 14); f.position.set(sx * (W / 2 - 0.018), 0.0005, sz * (D / 2 - 0.018)); g.add(f); }
      if (mini) {
        const seat = k.cyl(0.066, 0.068, 0.004, deck, 48); seat.position.set(0, H + 0.0015, zc); g.add(seat);
        const plate = k.cyl(0.06, 0.062, 0.006, k.colMat('#e6e9eb', 0.4), 48); plate.position.set(0, H + 0.004, zc); g.add(plate);
      } else {
        const well = k.rbox(0.19, 0.004, 0.19, 0.004, deck, 2); well.position.set(0, H + 0.0005, zc); g.add(well);
        const tray = k.rbox(0.176, 0.005, 0.176, 0.003, M.steel, 2); tray.position.set(0, H + 0.003, zc); g.add(tray);
        // white ceramic top plate, rounded corners, slightly overhanging the steel tray (photo)
        const plate = k.rbox(0.172, 0.011, 0.172, 0.0045, k.colMat('#f5f6f4', 0.22), 3); plate.position.set(0, H + 0.005, zc); g.add(plate);
      }
    }, { cast: true }));
    // heating-zone ring (faint on the white plate)
    const zr = mini ? 0.05 : 0.07;
    const zone = new THREE.Mesh(new THREE.RingGeometry(zr - 0.0012, zr, 48), k.colMat(mini ? '#a3a9ae' : '#dfe3e6', 0.6));
    zone.rotation.x = -Math.PI / 2; zone.position.set(0, H + (mini ? 0.0071 : 0.0107), zc); it.obj.add(zone);
    // everything on the sloped front lives in this tilted group (local y up the face, z out of it)
    const fr = new THREE.Group(); fr.position.set(0, H / 2, D / 2 - slope / 2 + 0.0002); fr.rotation.x = -ang; it.obj.add(fr);
    const pw = W * 0.86, ph = faceL * 0.8;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: panelTex(k, spec, mini), roughness: 0.5 }));
    fr.add(panel);
    const Y = f => (f - 0.5) * faceL;               // f = 0 bottom .. 1 top of the face
    const dw = mini ? 0.042 : 0.06, dh = mini ? 0.016 : 0.022, dx = mini ? 0.012 : 0, dy = Y(mini ? 0.64 : 0.69);
    const bez = k.rbox(dw + 0.006, dh + 0.005, 0.002, 0.0012, k.colMat('#2b3036', 0.4)); bez.position.set(dx, dy, 0.0008); fr.add(bez);
    const dispMesh = new THREE.Mesh(new THREE.PlaneGeometry(dw, dh), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dispMesh.position.set(dx, dy, 0.002); fr.add(dispMesh);
    if (!mini) for (const f of [0.74, 0.54]) { const led = k.cyl(0.0018, 0.0018, 0.0015, k.colMat('#7d858c', 0.4), 12); led.rotation.x = Math.PI / 2; led.position.set(-pw / 2 + 0.024, Y(f), 0.0006); fr.add(led); }
    const kr = mini ? 0.0115 : 0.0122, ky = Y(mini ? 0.34 : 0.27);
    const mk = x => { const p = knob(k, kr); p.position.set(x, ky, 0); fr.add(p); return p; };
    const knobT = spec.heat ? mk(-pw * 0.17) : null;
    const knobR = mk(mini ? W * 0.31 : pw * 0.17);
    return { knobT, knobR, dispMesh };
  };

  // ---- big hotplate: owner's photo VirtualLab/Equipments/Hot plate (digital hotplate stirrer, 2nd photo) ----
  function panelTexBig(k, spec) {
    return k.texCache('hp-panel2-' + spec.maxT, () => k.canvasTex(512, 160, (g, w, h) => {
      g.fillStyle = '#e8eae9'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#c9cdd0'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
      g.fillStyle = '#6f777e'; g.font = '15px system-ui,sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText('Heat', 288, 22); g.fillText('Stir', 414, 22);
      g.textAlign = 'center'; g.font = '13px system-ui,sans-serif';
      g.fillText(`RT – ${spec.maxT} °C`, 318, 148); g.fillText('100 – 1500 rpm', 444, 148);
      for (const [cx, n] of [[318, 13], [444, 13]]) for (let i = 0; i < n; i++) {    // red scale marks round each knob
        const a = Math.PI * 0.75 + i / (n - 1) * Math.PI * 1.5, r0 = 50, r1 = i % 3 ? 55 : 59;
        g.strokeStyle = i % 3 ? '#e07a72' : '#d23a2c'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, 92 + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, 92 + Math.sin(a) * r1); g.stroke();
      }
      g.fillStyle = '#f08a1c'; g.beginPath(); g.moveTo(492, 12); g.lineTo(504, 32); g.lineTo(480, 32); g.closePath(); g.fill();   // hot-surface warning
      g.fillStyle = '#1d2126'; g.font = 'bold 13px system-ui'; g.fillText('!', 492, 26);
      g.strokeStyle = '#9aa1a8'; g.lineWidth = 1.5;                                                                           // small icons under the LCD
      for (const x of [40, 64]) { g.beginPath(); g.moveTo(x, 132); g.lineTo(x + 8, 146); g.lineTo(x - 8, 146); g.closePath(); g.stroke(); }
    }));
  }
  function bigHotplate(k, it, spec, W, D, H) {
    const { THREE, M } = k;
    const zc = -D / 2 + 0.1, cz0 = D / 2 - 0.072;          // plate centre z; console starts here
    it.plateZ = zc; it.plateTop = H + 0.0105;
    const baseH = 0.052, top = H + 0.0105;                  // plate top must stay at H + 0.0105 (surface)
    const fb = [D / 2, 0.004], ft = [D / 2 - 0.012, 0.068];   // console front face: bottom / top (z, y)
    it.obj.add(k.bake('hp-big5', g => {
      const grey = k.colMat('#6c747b', 0.55), deck = k.colMat('#40474e', 0.5), white = k.colMat('#f7f8f6', 0.22), clipM = k.colMat('#f2f3f1', 0.3);   // mid-grey body / dark deck / white plate
      const bd = cz0 + 0.01 + D / 2;                  // base ends inside the console, so it never covers the sloped face
      const body = k.rbox(W, baseH, bd, 0.008, grey, 3); body.position.set(0, baseH / 2, -D / 2 + bd / 2); g.add(body);
      // console block: side profile extruded across the width (front face leans back)
      const b = 0.004, sh = new THREE.Shape();
      sh.moveTo(-(fb[0] - b), fb[1]); sh.lineTo(-(ft[0] - b), ft[1] - b); sh.lineTo(-(cz0 + b), 0.074 - b); sh.lineTo(-(cz0 + b), b);
      const cg = new THREE.ExtrudeGeometry(sh, { depth: W - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3 });
      cg.rotateY(Math.PI / 2); cg.translate(-(W - 2 * b) / 2, 0, 0); cg.deleteAttribute('uv');
      g.add(new THREE.Mesh(k.creased(cg, 0.5), grey));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const f = k.cyl(0.008, 0.009, 0.006, k.colMat('#9aa0a5', 0.5), 16); f.position.set(sx * (W / 2 - 0.02), 0.0, sz * (D / 2 - 0.02)); g.add(f); }
      const dk = k.rbox(0.19, 0.004, 0.19, 0.003, deck, 2); dk.position.set(0, baseH + 0.001, zc); g.add(dk);
      const fr = k.rbox(0.165, 0.005, 0.165, 0.002, M.steel, 2); fr.position.set(0, baseH + 0.006, zc); g.add(fr);
      // white clips that hold the plate (front corners + back corners)
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const c = k.rbox(0.03, 0.024, 0.007, 0.0025, clipM, 2); c.position.set(sx * 0.05, baseH + 0.016, zc + sz * 0.0885); g.add(c); }
      // thick white ceramic plate with rounded corners
      const pl = k.rbox(0.174, 0.016, 0.174, 0.006, white, 3); pl.position.set(0, top - 0.008, zc); g.add(pl);
    }, { cast: true }));
    const zone = new THREE.Mesh(new THREE.RingGeometry(0.0688, 0.07, 48), k.colMat('#e2e5e7', 0.6));
    zone.rotation.x = -Math.PI / 2; zone.position.set(0, top + 0.0002, zc); it.obj.add(zone);
    // front face group (local y up the face, z out of it)
    const faceL = Math.hypot(fb[0] - ft[0], ft[1] - fb[1]), ang = Math.atan2(fb[0] - ft[0], ft[1] - fb[1]);
    const fg = new THREE.Group(); fg.position.set(0, (fb[1] + ft[1]) / 2, (fb[0] + ft[0]) / 2 + 0.0003); fg.rotation.x = -ang; it.obj.add(fg);
    const pw = W * 0.9, ph = faceL * 0.85;
    fg.add(new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: panelTexBig(k, spec), roughness: 0.5 })));
    const P = (u, v) => [(u / 512 - 0.5) * pw, (0.5 - v / 160) * ph];   // texture pixel -> face position
    const [lx, ly] = P(118, 70);
    const bez = k.rbox(0.074, 0.032, 0.002, 0.0015, k.colMat('#3a4047', 0.4)); bez.position.set(lx, ly, 0.0008); fg.add(bez);
    const dispMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.026), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dispMesh.position.set(lx, ly, 0.0021); fg.add(dispMesh);
    for (const u of [278, 404]) { const [x, y] = P(u, 22); const led = k.cyl(0.0019, 0.0019, 0.0015, k.colMat('#4a5056', 0.4), 12); led.rotation.x = Math.PI / 2; led.position.set(x, y, 0.0006); fg.add(led); }
    const mk = u => { const [x, y] = P(u, 92); const p = knob(k, 0.0158); p.position.set(x, y, 0); fg.add(p); return p; };
    return { knobT: mk(318), knobR: mk(444), dispMesh };
  }

  E.hotplate = (k, it, spec, W, D, H, mini) => mini ? miniStirrer(k, it, spec, W, D, H, true) : bigHotplate(k, it, spec, W, D, H);
})();
