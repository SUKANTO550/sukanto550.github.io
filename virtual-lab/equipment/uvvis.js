/* UV-Vis station — generic models (no owner photo yet; NO brand names). Decor only for now (owner: "not working
   right now, the lid can be opened").
     E.uvvis(k, it)        double-beam benchtop UV-Vis spectrophotometer, 560 W x 230 H x 420 D mm, light grey body,
                           sample compartment on the right with a dark lid hinged at the back.
                           returns { lidHinge }  lid open = lidHinge.rotation.x = -1.75 * open fraction
     E.pcTower(k, it)      office PC tower 190 W x 420 H x 400 D mm: front USB / audio ports, power button +
                           LED ring, vent mesh, side vents, rear fan grille
     E.monitor(k, it)      24" monitor: thin bezel, vented back housing, height-adjustable stand; returns { screen }
                           (plane - host sets its map)
     E.keyboard(k, it)     full-size keyboard with real keycaps;   E.mouse(k, it)  mouse on a mouse pad
     E.deskLamp, E.notebook  decor;   E.officeDesk(k, g, W, D, H)  furniture (laminate top, steel frame,
                           drawer pedestal, cable tray)
     E.cuvetteRack(k, it)  small white rack, 4 holes, 2 quartz cuvettes (12.5 x 12.5 x 45 mm) standing in it
   All rest on y = 0, front at +z. */
(function () {
  const E = window.EQUIP = window.EQUIP || {};

  E.uvvis = (k, it) => {
    const { THREE } = k;
    const body = k.colMat('#d6dade', 0.55), dark = k.colMat('#3e464e', 0.45), black = k.M.black;
    const o = it.obj;
    // main body (rounded), darker base band, feet
    const b = k.rbox(0.56, 0.2, 0.42, 0.018, body, 4); b.position.y = 0.11; b.castShadow = true; o.add(b);
    const band = k.rbox(0.565, 0.02, 0.425, 0.006, dark, 2); band.position.y = 0.012; o.add(band);
    // sample compartment (right part): recessed well, cuvette holder (2 slots: reference + sample)
    const CX = 0.15, CW = 0.2, CD = 0.24;
    const well = new THREE.Mesh(new THREE.BoxGeometry(CW - 0.012, 0.004, CD - 0.012), k.colMat('#1e2328', 0.7)); well.position.set(CX, 0.212, 0.0); o.add(well);
    const holder = k.rbox(0.07, 0.022, 0.03, 0.003, k.colMat('#2a3036', 0.5)); holder.position.set(CX, 0.225, 0); o.add(holder);
    for (const dx of [-0.017, 0.017]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.0135, 0.004, 0.0135), black); s.position.set(CX + dx, 0.2365, 0); o.add(s); }
    // lid: hinged at the back edge of the compartment
    const hinge = new THREE.Group(); hinge.position.set(CX, 0.212, -CD / 2); o.add(hinge);
    const lid = k.rbox(CW, 0.03, CD, 0.008, dark, 3); lid.position.set(0, 0.015, CD / 2); lid.castShadow = true; hinge.add(lid);
    const lip = k.rbox(0.08, 0.012, 0.016, 0.004, k.colMat('#2c3238', 0.4)); lip.position.set(0, 0.012, CD + 0.006); hinge.add(lip);
    // left part: vent slots on top, front label strip, status display, power LED
    for (let i = 0; i < 9; i++) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.002, 0.006), k.colMat('#9aa1a7', 0.6)); v.position.set(-0.12, 0.211, -0.1 + i * 0.022); o.add(v); }
    const lt = k.texCache('uvvis-label', () => k.canvasTex(1024, 128, (g, w, h) => {
      g.fillStyle = '#c9ced3'; g.fillRect(0, 0, w, h); g.fillStyle = '#2b3238'; g.textBaseline = 'middle';
      g.font = '38px system-ui'; g.textAlign = 'right'; g.fillText('190 – 1100 nm', w - 30, h / 2);
      const room = w - 60 - g.measureText('190 – 1100 nm').width - 40; let fs = 56;                // main text shrinks to fit
      do { g.font = `bold ${fs}px system-ui`; fs -= 2; } while (g.measureText('UV-VIS SPECTROPHOTOMETER').width > room && fs > 20);
      g.textAlign = 'left'; g.fillText('UV-VIS SPECTROPHOTOMETER', 30, h / 2);
    }));
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.045), new THREE.MeshStandardMaterial({ map: lt, roughness: 0.6 })); lab.position.set(-0.08, 0.15, 0.2105); o.add(lab);
    const dt = k.texCache('uvvis-lcd', () => k.canvasTex(256, 96, (g, w, h) => {
      g.fillStyle = '#9fb59a'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d2a1b'; g.font = 'bold 40px ui-monospace,Consolas,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('READY', w / 2, h / 2);
    }));
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.026), new THREE.MeshBasicMaterial({ map: dt })); lcd.position.set(0.16, 0.15, 0.2105); o.add(lcd);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.004, 12, 8), new THREE.MeshStandardMaterial({ color: 0x35d06a, emissive: 0x35d06a, emissiveIntensity: 1.2 })); led.position.set(0.24, 0.15, 0.21); o.add(led);
    for (const [x, z] of [[-0.25, -0.18], [0.25, -0.18], [-0.25, 0.18], [0.25, 0.18]]) { const f = k.cyl(0.012, 0.014, 0.008, black, 14); f.position.set(x, 0.004, z); o.add(f); }
    it.r = 0.36;
    return { lidHinge: hinge };
  };

  // ---- computer desk parts (owner: "make the desktop realistic") ----
  // office PC tower: front panel with USB ports, audio jacks, power button + LED ring, vent mesh; side vents; rear fan
  E.pcTower = (k, it) => {
    const { THREE } = k;
    const o = it.obj, caseM = k.colMat('#2a2f35', 0.45), front = k.colMat('#1b1f24', 0.35), port = k.colMat('#0d0f11', 0.6);
    const W = 0.19, H = 0.42, D = 0.4;
    const b = k.rbox(W, H, D, 0.008, caseM, 3); b.position.y = H / 2 + 0.012; b.castShadow = true; o.add(b);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const f = k.rbox(0.03, 0.012, 0.05, 0.004, port, 1); f.position.set(x * (W / 2 - 0.025), 0.006, z * (D / 2 - 0.04)); o.add(f); }
    const fp = k.rbox(W - 0.004, H - 0.006, 0.012, 0.005, front, 2); fp.position.set(0, H / 2 + 0.012, D / 2); o.add(fp);
    const meshT = k.texCache('pc-mesh', () => k.canvasTex(256, 512, (g, w, h) => {
      g.fillStyle = '#1b1f24'; g.fillRect(0, 0, w, h); g.fillStyle = '#0a0c0e';
      for (let y = 6; y < h; y += 12) for (let x = (y / 12 % 2) * 6 + 6; x < w; x += 12) { g.beginPath(); g.arc(x, y, 3.4, 0, 7); g.fill(); }
    }));
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.03, H * 0.62), new THREE.MeshStandardMaterial({ map: meshT, roughness: 0.6 })); mesh.position.set(0, 0.17, D / 2 + 0.0065); o.add(mesh);
    const top = H + 0.012 - 0.03;
    const pb = k.cyl(0.011, 0.011, 0.005, k.colMat('#30363d', 0.3), 24); pb.rotation.x = Math.PI / 2; pb.position.set(0, top, D / 2 + 0.008); o.add(pb);
    const led = new THREE.Mesh(new THREE.TorusGeometry(0.0118, 0.0011, 6, 28), new THREE.MeshStandardMaterial({ color: 0x3d8bff, emissive: 0x3d8bff, emissiveIntensity: 1.6 })); led.position.set(0, top, D / 2 + 0.0085); o.add(led);
    for (let i = 0; i < 2; i++) {                                                     // USB-A ports (blue tongue) + USB-C
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.006, 0.003), port); p.position.set(-0.05 + i * 0.019, top - 0.04, D / 2 + 0.0065); o.add(p);
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.002, 0.003), k.colMat('#2f6fd6', 0.4)); t.position.set(-0.05 + i * 0.019, top - 0.0392, D / 2 + 0.0068); o.add(t);
    }
    const c = k.rbox(0.009, 0.0035, 0.003, 0.0015, port, 1); c.position.set(-0.012, top - 0.04, D / 2 + 0.0065); o.add(c);
    for (const [x, col] of [[0.035, '#2fa84f'], [0.055, '#d14a8b']]) {               // audio jacks
      const r = k.cyl(0.0035, 0.0035, 0.003, k.colMat(col, 0.5), 14); r.rotation.x = Math.PI / 2; r.position.set(x, top - 0.04, D / 2 + 0.0065); o.add(r);
      const hole = k.cyl(0.0018, 0.0018, 0.004, port, 10); hole.rotation.x = Math.PI / 2; hole.position.set(x, top - 0.04, D / 2 + 0.007); o.add(hole);
    }
    const ventT = k.texCache('pc-side-vent', () => k.canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#2a2f35'; g.fillRect(0, 0, w, h); g.fillStyle = '#121518'; for (let y = 10; y < h; y += 14) g.fillRect(18, y, w - 36, 6); }));
    for (const sx of [-1, 1]) { const v = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), new THREE.MeshStandardMaterial({ map: ventT, roughness: 0.6 }));
      v.rotation.y = sx * Math.PI / 2; v.position.set(sx * (W / 2 + 0.0005), 0.3, -0.06); o.add(v); }
    const fanT = k.texCache('pc-fan', () => k.canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#2a2f35'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 6;
      for (let r = 20; r < 118; r += 16) { g.beginPath(); g.arc(w / 2, h / 2, r, 0, 7); g.stroke(); } g.lineWidth = 8; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.cos(i * 1.57) * 118, h / 2 + Math.sin(i * 1.57) * 118); g.stroke(); } }));
    const fan = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), new THREE.MeshStandardMaterial({ map: fanT, roughness: 0.6 })); fan.rotation.y = Math.PI; fan.position.set(0, 0.32, -D / 2 - 0.0005); o.add(fan);
    it.r = 0.22;
  };

  // 24" monitor: thin bezel, slim panel with a thicker vented back housing, height-adjustable stand
  E.monitor = (k, it) => {
    const { THREE } = k;
    const o = it.obj, black = k.colMat('#17191c', 0.35), back = k.colMat('#24282d', 0.5), stand = k.colMat('#3a3f45', 0.35);
    const base = k.rbox(0.24, 0.012, 0.18, 0.008, stand, 3); base.position.set(0, 0.006, -0.02); o.add(base);
    const col = k.rbox(0.045, 0.3, 0.022, 0.008, stand, 2); col.position.set(0, 0.16, -0.075); o.add(col);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.14, 0.002), k.colMat('#1c1f23', 0.6)); slot.position.set(0, 0.16, -0.0635); o.add(slot);
    const Y = 0.33;
    const panel = k.rbox(0.545, 0.322, 0.012, 0.004, black, 2); panel.position.set(0, Y, -0.03); panel.castShadow = true; o.add(panel);
    const housing = k.rbox(0.4, 0.22, 0.035, 0.015, back, 3); housing.position.set(0, Y - 0.01, -0.052); housing.castShadow = true; o.add(housing);
    for (let i = 0; i < 8; i++) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.003, 0.001), k.colMat('#15171a', 0.6)); v.rotation.y = Math.PI; v.position.set(0, Y + 0.06 - i * 0.01, -0.0701); o.add(v); }
    const chin = k.rbox(0.545, 0.016, 0.014, 0.004, black, 2); chin.position.set(0, Y - 0.16, -0.029); o.add(chin);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0016, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9fd0ff, emissiveIntensity: 1.4 })); led.position.set(0.24, Y - 0.161, -0.021); o.add(led);
    for (let i = 0; i < 4; i++) { const bt = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.002, 0.004), k.colMat('#2a2e33', 0.4)); bt.position.set(0.17 + i * 0.013, Y - 0.169, -0.026); o.add(bt); }
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.531, 0.299), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    screen.position.set(0, Y + 0.004, -0.0236); o.add(screen);
    it.r = 0.29;
    return { screen };
  };

  // full-size keyboard with real keycaps (main block, F-row, arrows, nav block, number pad); slight tilt
  E.keyboard = (k, it) => {
    const { THREE } = k;
    it.obj.add(k.bake('keyboard-3d', g => {
      const caseM = k.colMat('#23272c', 0.45), keyM = k.colMat('#33383e', 0.55);
      const tilt = new THREE.Group(); tilt.rotation.x = 0.06; tilt.position.y = 0.004; g.add(tilt);
      const b = k.rbox(0.44, 0.018, 0.14, 0.006, caseM, 2); b.position.y = 0.009; tilt.add(b);
      const P = 0.0185, S = 0.0158, key = (x, z, w = 1) => { const c = k.rbox(S + (w - 1) * P, 0.008, S, 0.0025, keyM, 1); c.position.set(x + (w - 1) * P / 2, 0.022, z); tilt.add(c); };
      const X0 = -0.205, Z0 = -0.052;
      for (let i = 0; i < 13; i++) key(X0 + (i ? i * P + (i > 4 ? 0.008 : 0) + (i > 8 ? 0.008 : 0) + 0.012 : 0), Z0);          // Esc + F1-F12
      const rows = [[[1, 13], [2]], [[1.5], [1, 12], [1.5]], [[1.75], [1, 11], [2.25]], [[2.25], [1, 10], [2.75]], [[1.25, 3], [6.25], [1.25, 4]]];
      rows.forEach((row, r) => { let x = X0; const z = Z0 + 0.024 + r * P;
        for (const [w, n = 1] of row) for (let i = 0; i < n; i++) { key(x, z, w); x += w * P; } });
      const NX = X0 + 15.4 * P;                                                       // nav block + arrows
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) key(NX + c * P, Z0 + 0.024 + r * P);
      key(NX + P, Z0 + 0.024 + 3 * P); for (let c = 0; c < 3; c++) key(NX + c * P, Z0 + 0.024 + 4 * P);
      const PX = NX + 3.4 * P;                                                        // number pad
      for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) { if ((r === 2 || r === 4) && c === 3) continue; if (r === 4 && c === 1) continue; key(PX + c * P, Z0 + 0.024 + r * P, r === 4 && c === 0 ? 2 : 1); }
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.001, 0.002), new THREE.MeshStandardMaterial({ color: 0x46d27a, emissive: 0x46d27a, emissiveIntensity: 1 })); led.position.set(PX + 0.03, 0.0185, Z0 - 0.002); tilt.add(led);
    }));
    it.r = 0.23;
  };

  // mouse: two buttons with a split line, scroll wheel; on a dark mouse pad (the pad is part of the item)
  E.mouse = (k, it) => {
    const { THREE } = k;
    it.obj.add(k.bake('mouse-3d', g => {
      const pad = k.rbox(0.22, 0.003, 0.18, 0.012, k.colMat('#1f2328', 0.9), 2); pad.position.y = 0.0015; g.add(pad);
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), k.colMat('#2a2e33', 0.35));
      m.scale.set(0.031, 0.019, 0.058); m.position.y = 0.003; g.add(m);
      const split = new THREE.Mesh(new THREE.BoxGeometry(0.0008, 0.004, 0.03), k.colMat('#101215', 0.6)); split.position.set(0, 0.02, 0.026); g.add(split);
      const wheel = k.cyl(0.0045, 0.0045, 0.003, k.colMat('#5a6068', 0.6), 14); wheel.rotation.z = Math.PI / 2; wheel.position.set(0, 0.0205, 0.022); g.add(wheel);
    }));
    it.r = 0.12;
  };

  // desk lamp (decor): weighted base, two-part arm, shade
  E.deskLamp = (k, it) => {
    const { THREE } = k;
    it.obj.add(k.bake('desk-lamp', g => {
      const m = k.colMat('#3b4249', 0.4), j = k.M.steelDark;
      const base = k.cyl(0.065, 0.07, 0.022, m, 32); base.position.y = 0.011; g.add(base);
      const a1 = k.cyl(0.007, 0.007, 0.32, m, 12); a1.position.set(0, 0.17, -0.04); a1.rotation.x = -0.25; g.add(a1);
      const jt = new THREE.Mesh(new THREE.SphereGeometry(0.012, 14, 10), j); jt.position.set(0, 0.325, -0.08); g.add(jt);
      const a2 = k.cyl(0.006, 0.006, 0.26, m, 12); a2.rotation.x = 1.2; a2.position.set(0, 0.36, 0.035); g.add(a2);
      const shade = k.cyl(0.03, 0.065, 0.08, m, 28, true); shade.rotation.x = -0.6; shade.position.set(0, 0.34, 0.15); g.add(shade);
      const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.055, 24), new THREE.MeshStandardMaterial({ color: 0xfff3dc, emissive: 0xffe6b8, emissiveIntensity: 0.5 }));
      bulb.rotation.x = Math.PI / 2 - 0.6; bulb.position.set(0, 0.31, 0.172); g.add(bulb);
    }));
    it.r = 0.08;
  };

  // lab notebook + pen (decor)
  E.notebook = (k, it) => {
    const { THREE } = k;
    it.obj.add(k.bake('lab-notebook', g => {
      const cover = k.rbox(0.15, 0.012, 0.21, 0.002, k.colMat('#28507a', 0.6), 1); cover.position.y = 0.006; g.add(cover);
      const paper = new THREE.Mesh(new THREE.BoxGeometry(0.146, 0.009, 0.206), k.colMat('#efeee6', 0.9)); paper.position.set(0.003, 0.006, 0); g.add(paper);
      const pen = k.cyl(0.0045, 0.0045, 0.14, k.colMat('#1d3f8f', 0.4), 12); pen.rotation.z = Math.PI / 2; pen.rotation.y = 0.3; pen.position.set(0.02, 0.0165, 0.04); g.add(pen);
    }));
    it.r = 0.13;
  };

  // office computer desk (furniture): light grey laminate top, dark steel frame, drawer pedestal (right), cable tray
  E.officeDesk = (k, g, W, D, H) => {
    const { THREE } = k;
    const top = k.colMat('#b9bdbf', 0.6), frame = k.colMat('#3a3f45', 0.4), ped = k.colMat('#a9aeb1', 0.55);
    const t = k.rbox(W, 0.028, D, 0.006, top, 2); t.position.y = H - 0.014; t.castShadow = true; t.receiveShadow = true; g.add(t);
    for (const sx of [-1, 1]) {                                                         // two side frames (T-legs)
      const leg = k.rbox(0.05, H - 0.06, 0.05, 0.004, frame, 1); leg.position.set(sx * (W / 2 - 0.06), (H - 0.06) / 2 + 0.03, 0); g.add(leg);
      const foot = k.rbox(0.06, 0.03, D - 0.06, 0.006, frame, 1); foot.position.set(sx * (W / 2 - 0.06), 0.015, 0); g.add(foot);
      const arm = k.rbox(0.05, 0.03, D - 0.08, 0.004, frame, 1); arm.position.set(sx * (W / 2 - 0.06), H - 0.043, 0); g.add(arm);
    }
    const beam = k.rbox(W - 0.14, 0.04, 0.03, 0.004, frame, 1); beam.position.set(0, H - 0.07, -D / 2 + 0.08); g.add(beam);
    const modesty = k.rbox(W - 0.16, 0.3, 0.012, 0.004, frame, 1); modesty.position.set(0, H - 0.25, -D / 2 + 0.06); g.add(modesty);
    // cable tray under the back edge (open wire basket)
    const tray = new THREE.Group(); tray.position.set(-0.1, H - 0.12, -D / 2 + 0.12); g.add(tray);
    for (const z of [-0.05, 0.05]) { const r = k.cyl(0.002, 0.002, 0.8, frame, 6); r.rotation.z = Math.PI / 2; r.position.set(0, 0.03, z); tray.add(r); const r2 = r.clone(); r2.position.y = -0.02; tray.add(r2); }
    for (let i = 0; i <= 10; i++) { const u = k.tube([[-0.4 + i * 0.08, 0.03, -0.05], [-0.4 + i * 0.08, -0.02, -0.05], [-0.4 + i * 0.08, -0.02, 0.05], [-0.4 + i * 0.08, 0.03, 0.05]], 0.0016, frame); tray.add(u); }
    // drawer pedestal under the right end: 3 drawers with handles
    const pw = 0.4, pd = D - 0.12, ph = H - 0.1, px = W / 2 - 0.32;
    const box = k.rbox(pw, ph, pd, 0.006, ped, 2); box.position.set(px, ph / 2 + 0.04, 0.02); box.castShadow = true; g.add(box);
    for (let i = 0; i < 3; i++) {
      const dh = (ph - 0.03) / 3, y = 0.055 + dh * (i + 0.5);
      const fr = k.rbox(pw - 0.016, dh - 0.008, 0.012, 0.004, k.colMat('#b3b8bb', 0.5), 1); fr.position.set(px, y, 0.02 + pd / 2 + 0.004); g.add(fr);
      const hd = k.rbox(0.12, 0.012, 0.018, 0.005, k.M.steel, 1); hd.position.set(px, y + dh / 2 - 0.04, 0.02 + pd / 2 + 0.016); g.add(hd);
    }
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const c = k.cyl(0.012, 0.012, 0.03, frame, 10); c.position.set(px + x * (pw / 2 - 0.03), 0.02, 0.02 + z * (pd / 2 - 0.04)); g.add(c); }
    return g;
  };

  E.cuvetteRack = (k, it) => {
    const { THREE } = k;
    const o = it.obj;
    const b = k.rbox(0.09, 0.03, 0.03, 0.004, k.colMat('#f0f0ec', 0.5), 2); b.position.y = 0.015; o.add(b);
    for (let i = 0; i < 4; i++) { const h = new THREE.Mesh(new THREE.BoxGeometry(0.0135, 0.002, 0.0135), k.colMat('#9aa0a5', 0.6)); h.position.set(-0.0315 + i * 0.021, 0.0301, 0); o.add(h); }
    // two quartz cuvettes standing in the first two holes: clear walls, frosted grip sides
    for (let i = 0; i < 2; i++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.0125, 0.045, 0.0125), k.M.glass); c.position.set(-0.0315 + i * 0.021, 0.0305 + 0.0225 - 0.012, 0); c.renderOrder = 3; o.add(c);
      for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.0125, 0.045), k.colMat('#e9edef', 0.9, { transparent: true, opacity: 0.55, depthWrite: false })); f.rotation.y = Math.PI / 2; f.position.set(-0.0315 + i * 0.021 + sx * 0.00626, 0.0415, 0); o.add(f); }
    }
    it.r = 0.05;
  };

})();
