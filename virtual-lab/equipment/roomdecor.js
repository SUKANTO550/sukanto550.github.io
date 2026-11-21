/* Room decor — generic models (no brand names).
     E.ceilingDiffuser(k, g) / E.returnGrille(k, g) / E.thermostat(k, g)   central AC (ceiling diffusers, return grille,
                           wall thermostat)
     E.coatRail(k, g)      wall rail with 4 hooks, 2 white lab coats + 1 white cotton apron hanging (furniture), back at z = 0
     E.wallShelf(k, g, W)  small wall shelf (furniture), top at y = 0, back at z = 0; returns depth
     E.goggles(k, it)      indirect-vent safety goggles: moulded frame + lens bent round the face, vent caps, flat strap
     E.fireExtCO2(k, g)    CO2 fire extinguisher on its wall bracket (furniture)
     E.officeChair(k, g)   office chair: returns { base, top, castors } - top swivels, castors steer + roll */
(function () {
  const E = window.EQUIP = window.EQUIP || {};

  // ---- CENTRAL AC (owner: "make it central AC type"; replaces the wall split unit) ----
  // E.ceilingDiffuser(k, g): square 4-way supply diffuser, 600 x 600 mm ceiling tile, stepped concentric louvre
  //   rings + dark duct throat in the middle. Hangs from the ceiling: top at y = 0, face down. Returns { air }
  //   (faint air streaks fanning out, host shows / animates while running).
  // E.returnGrille(k, g): 600 x 600 return-air grille (fine egg-crate), flush with the ceiling.
  // E.thermostat(k, g): wall control panel (front +z): white housing, LCD (host sets map), 4 buttons. Returns { disp }.
  E.ceilingDiffuser = (k, g) => {
    const { THREE } = k;
    // ceiling parts face DOWN, away from the ceiling lights: lit like the ceiling itself (bounce light = emissive)
    const lit = (c, e, ei) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, emissive: e, emissiveIntensity: ei });
    const white = lit(0xf2f3f3, 0xc4c9cd, 0.62), shade = lit(0xe2e5e7, 0xaeb4b9, 0.55), dark = lit(0x3a4046, 0x1c2024, 0.4);
    const S = 0.6;
    const plate = k.rbox(S, 0.012, S, 0.004, white, 2); plate.position.y = -0.006; g.add(plate);
    // 4 stepped louvre rings, each lower than the last (cone of blades seen from below)
    for (let i = 0; i < 4; i++) {
      const o = 0.25 - i * 0.055, w = 0.042, y = -0.014 - i * 0.01;
      for (const [x, z, sx, sz] of [[0, o, 2 * o + w, w], [0, -o, 2 * o + w, w], [o, 0, w, 2 * o + w], [-o, 0, w, 2 * o + w]]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.01, sz), i % 2 ? shade : white); b.position.set(x, y, z); g.add(b);
      }
      const gap = new THREE.Mesh(new THREE.PlaneGeometry(2 * o - 0.03, 2 * o - 0.03), dark); gap.rotation.x = Math.PI / 2; gap.position.y = y + 0.0055; g.add(gap);
    }
    const core = k.rbox(0.1, 0.01, 0.1, 0.003, white, 1); core.position.y = -0.056; g.add(core);
    // air: streaks fanning out on all 4 sides along the ceiling, then drifting down
    const air = new THREE.Group(); air.visible = false; g.add(air);
    const am = new THREE.MeshBasicMaterial({ color: 0xe6f4ff, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide });
    for (let s = 0; s < 4; s++) for (let i = 0; i < 3; i++) {
      const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.02, 0.35), new THREE.Vector3(0, -0.45, 0.6));
      const m = new THREE.Mesh(new THREE.TubeGeometry(c, 14, 0.003, 5, false), am);
      const q = new THREE.Group(); q.rotation.y = s * Math.PI / 2; q.position.y = -0.05; air.add(q);
      m.position.set(-0.15 + i * 0.15, 0, 0.27); m.userData.phase = (s * 3 + i) * 0.23; q.add(m);
    }
    return { air };
  };
  E.returnGrille = (k, g) => {
    const { THREE } = k;
    const frame = k.rbox(0.6, 0.01, 0.6, 0.004, new THREE.MeshStandardMaterial({ color: 0xf2f3f3, roughness: 0.6, emissive: 0xc4c9cd, emissiveIntensity: 0.62 }), 2); frame.position.y = -0.005; g.add(frame);
    const t = k.texCache('return-grille', () => k.canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#2b3035'; c.fillRect(0, 0, w, h); c.strokeStyle = '#e4e7e8'; c.lineWidth = 3;
      for (let i = 0; i <= w; i += 12) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); } }));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.54), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.5 })); face.rotation.x = Math.PI / 2; face.position.y = -0.0105; g.add(face);
  };
  E.thermostat = (k, g) => {
    const { THREE } = k;
    const body = k.rbox(0.09, 0.12, 0.022, 0.008, k.colMat('#f1f2f2', 0.5), 3); body.position.z = 0.011; g.add(body);
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.046), new THREE.MeshBasicMaterial({ color: 0xffffff })); disp.position.set(0, 0.022, 0.0225); g.add(disp);
    for (let i = 0; i < 4; i++) { const b = k.rbox(0.016, 0.009, 0.004, 0.003, k.colMat(i === 0 ? '#3a8f5a' : '#b9bfc4', 0.4), 1); b.position.set(-0.03 + i * 0.02, -0.032, 0.023); g.add(b); }
    return { disp };
  };

  // a hanging lab coat (front at +z): shoulders on the hook, body, sleeves, collar, pockets, buttons
  function labCoat(k, g, x) {
    const { THREE } = k;
    const cloth = k.colMat('#eef0ee', 0.95), seam = k.colMat('#d4d8d6', 0.9), btn = k.colMat('#c9cdd0', 0.4);
    const c = new THREE.Group(); c.position.set(x, 0, 0); g.add(c);
    const hang = k.tube([[-0.006, -0.01, 0.012], [0, 0.012, 0.018], [0.006, -0.01, 0.012]], 0.0015, seam); c.add(hang);
    const sh = k.rbox(0.36, 0.06, 0.07, 0.03, cloth, 3); sh.position.set(0, -0.06, 0.04); c.add(sh);
    // body: slightly flared towards the hem, gentle folds
    const pts = []; for (let i = 0; i <= 10; i++) { const y = -0.07 - i * 0.085; pts.push(new THREE.Vector2(0.17 + i * 0.006, y)); }
    const bodyGeo = new THREE.BoxGeometry(1, 0.86, 1, 6, 10, 1); const p = bodyGeo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = (0.43 - y) / 0.86; p.setX(i, p.getX(i) * (0.34 + t * 0.1)); p.setZ(i, p.getZ(i) * (0.06 + t * 0.02) + Math.sin(p.getX(i) * 18) * 0.004 * t); }
    bodyGeo.computeVertexNormals(); const body = new THREE.Mesh(bodyGeo, cloth); body.position.set(0, -0.52, 0.04); body.castShadow = true; c.add(body);
    for (const sx of [-1, 1]) {                                                      // sleeves hanging at the sides
      const sl = k.rbox(0.07, 0.56, 0.065, 0.03, cloth, 3); sl.position.set(sx * 0.2, -0.36, 0.04); sl.rotation.z = sx * 0.06; c.add(sl);
      const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.004, 0.066), seam); cuff.position.set(sx * 0.215, -0.6, 0.04); c.add(cuff);
      const lap = k.rbox(0.07, 0.16, 0.006, 0.003, cloth, 1); lap.position.set(sx * 0.045, -0.13, 0.078); lap.rotation.z = sx * 0.35; c.add(lap);   // collar / lapel
      const pk = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.002, 0.002), seam); pk.position.set(sx * 0.095, -0.66, 0.082); c.add(pk);          // pocket tops
    }
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.74, 0.002), seam); front.position.set(0.012, -0.55, 0.082); c.add(front);
    for (let i = 0; i < 4; i++) { const b = k.cyl(0.006, 0.006, 0.003, btn, 12); b.rotation.x = Math.PI / 2; b.position.set(0.024, -0.26 - i * 0.14, 0.083); c.add(b); }
  }
  // ---- WHITE COTTON LAB APRON (owner) ----
  // one subdivided cloth sheet shaped by a width profile (bib narrowing to the neck, wide skirt), soft vertical folds,
  // hemmed edges, front pocket with stitching, neck loop over the hook, waist ties hanging at the sides.
  function apron(k, g, x) {
    const { THREE } = k;
    const cloth = k.colMat('#f1f2ef', 0.95, { side: THREE.DoubleSide }), seam = k.colMat('#dcdfdb', 0.95), tie = k.colMat('#e9ebe7', 0.95);
    const a = new THREE.Group(); a.position.set(x, 0, 0); g.add(a);
    const L = 0.92, top = -0.1;
    const widthAt = t => t < 0.28 ? 0.2 + 0.05 * (t / 0.28) : t < 0.36 ? 0.25 + 0.27 * ((t - 0.28) / 0.08) : 0.52 + 0.04 * ((t - 0.36) / 0.64);   // t = 0 top .. 1 hem
    const geo = new THREE.PlaneGeometry(1, 1, 28, 46), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i), t = 0.5 - p.getY(i), w = widthAt(t);
      const fold = t > 0.36 ? Math.sin(u * 13 + 0.6) * 0.007 * ((t - 0.36) / 0.64 + 0.3) + Math.sin(u * 29) * 0.0018 : Math.sin(u * 9) * 0.002;
      p.setXYZ(i, u * w, top - t * L, 0.028 + fold + 0.012 * Math.sin(Math.PI * t) * (1 - Math.abs(u) * 1.6));
    }
    geo.computeVertexNormals();
    const sheet = new THREE.Mesh(geo, cloth); sheet.castShadow = true; a.add(sheet);
    // hems (thin seams along the edges), pocket + stitching
    const hem = (pts) => a.add(k.tube(pts, 0.0016, seam, 40));
    hem([[-0.1, top, 0.03], [0.1, top, 0.03]]);
    const edge = sx => { const pts = []; for (let j = 0; j <= 20; j++) { const t = j / 20; pts.push([sx * widthAt(t) / 2, top - t * L, 0.03 + 0.012 * Math.sin(Math.PI * t) * 0.2]); } return pts; };
    hem(edge(-1)); hem(edge(1));
    hem([[-0.28, top - L, 0.036], [0.28, top - L, 0.036]]);
    const pk = k.rbox(0.24, 0.13, 0.004, 0.008, cloth, 2); pk.position.set(0, top - 0.5, 0.045); a.add(pk);
    const st = k.texCache('apron-stitch', () => k.canvasTex(256, 140, (g2, w, h) => { g2.clearRect(0, 0, w, h); g2.strokeStyle = '#c9cdc8'; g2.setLineDash([6, 5]); g2.lineWidth = 3; g2.strokeRect(8, 8, w - 16, h - 16); g2.beginPath(); g2.moveTo(w / 2, 8); g2.lineTo(w / 2, h - 8); g2.stroke(); }));
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.13), new THREE.MeshStandardMaterial({ map: st, transparent: true, roughness: 0.9, depthWrite: false })); sm.position.set(0, top - 0.5, 0.0475); a.add(sm);
    // neck loop over the hook, waist ties hanging at the sides
    a.add(k.tube([[-0.095, top, 0.03], [-0.06, top + 0.07, 0.04], [-0.012, top + 0.105, 0.07], [0.012, top + 0.105, 0.07], [0.06, top + 0.07, 0.04], [0.095, top, 0.03]], 0.006, tie, 40));
    for (const sx of [-1, 1]) {
      const y0 = top - 0.33 * L;
      a.add(k.tube([[sx * 0.26, y0, 0.03], [sx * 0.285, y0 - 0.08, 0.04], [sx * 0.27, y0 - 0.25, 0.05], [sx * 0.28, y0 - 0.4, 0.045]], 0.007, tie, 40));
    }
  }
  E.coatRail = (k, g) => {
    const { THREE } = k;
    const wood = k.colMat('#8a6a4a', 0.6), steel = k.M.steel;
    const rail = k.rbox(1.0, 0.09, 0.022, 0.006, wood, 2); rail.position.set(0, 0, 0.011); g.add(rail);
    const xs = [-0.36, -0.12, 0.12, 0.36];
    for (const x of xs) { g.add(k.tube([[x, 0.0, 0.022], [x, 0.0, 0.06], [x, 0.03, 0.075]], 0.004, steel)); }
    labCoat(k, g, xs[0]); labCoat(k, g, xs[1]); apron(k, g, xs[3]);
    return g;
  };

  E.wallShelf = (k, g, W = 0.4) => {
    const s = k.rbox(W, 0.018, 0.16, 0.004, k.colMat('#c9cdd0', 0.5), 2); s.position.set(0, -0.009, 0.08); g.add(s);
    for (const sx of [-1, 1]) { const br = k.rbox(0.012, 0.09, 0.12, 0.003, k.M.steelDark, 1); br.position.set(sx * (W / 2 - 0.04), -0.06, 0.06); g.add(br); }
    return 0.16;
  };

  // ---- SAFETY GOGGLES, indirect vent (owner: realistic) ----
  // the moulded frame + lens are flat 2D outlines (D-shaped, nose notch) bent round a cylinder, so the frame follows
  // the face; 4 vent caps; wide flat elastic strap with buckles, lying flat behind (resting on a shelf / table).
  E.goggles = (k, it) => {
    const { THREE } = k;
    it.obj.add(k.bake('goggles-v2', g => {
      const frameM = k.colMat('#7fa9cc', 0.45, { transparent: true, opacity: 0.88 }), lensM = k.colMat('#e6f1f6', 0.05, { transparent: true, opacity: 0.32, depthWrite: false }),
        ventM = k.colMat('#3c5f80', 0.5), strapM = k.colMat('#26313d', 0.85), buckM = k.colMat('#1a1f25', 0.4);
      const Wd = 0.17, Ht = 0.062, R = 0.085, Y = 0.034, zc = 0.03 - R;
      const outline = (inset) => {                                 // D-shaped goggle outline with a nose notch at the bottom
        const s = new THREE.Shape(), w = Wd / 2 - inset, h = Ht / 2 - inset, r = 0.022 - inset * 0.5, n = 0.016 - inset * 0.3;
        s.moveTo(-w + r, h); s.lineTo(w - r, h); s.quadraticCurveTo(w, h, w, h - r); s.lineTo(w, -h + r * 1.3); s.quadraticCurveTo(w, -h, w - r * 1.3, -h);
        s.lineTo(n * 1.4, -h); s.quadraticCurveTo(0, -h + n * 1.2, -n * 1.4, -h);
        s.lineTo(-w + r * 1.3, -h); s.quadraticCurveTo(-w, -h, -w, -h + r * 1.3); s.lineTo(-w, h - r); s.quadraticCurveTo(-w, h, -w + r, h);
        return s;
      };
      const bend = geo => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = x / R, rr = R + z; p.setXYZ(i, Math.sin(a) * rr, p.getY(i) + Y, Math.cos(a) * rr + zc); } geo.computeVertexNormals(); return geo; };
      const ring = outline(0); ring.holes.push(outline(0.009));
      const fGeo = new THREE.ExtrudeGeometry(ring, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 14 });
      fGeo.translate(0, 0, -0.007); g.add(new THREE.Mesh(bend(fGeo), frameM));
      const lGeo = new THREE.ShapeGeometry(outline(0.006), 14); const pl = lGeo.attributes.position;
      // subdivide by re-tessellating along x: ShapeGeometry is coarse, so bend each vertex (outline points are dense enough)
      const lens = new THREE.Mesh(bend(lGeo), lensM); lens.renderOrder = 3; g.add(lens);
      // vent caps: 2 on top, 1 each side
      const onFrame = (x, y, zOff, w, h, d) => { const a = x / R, c = k.rbox(w, h, d, 0.003, ventM, 1); c.position.set(Math.sin(a) * (R + zOff), y + Y, Math.cos(a) * (R + zOff) + zc); c.rotation.y = a; g.add(c); };
      onFrame(-0.035, Ht / 2 - 0.004, 0.006, 0.026, 0.008, 0.012); onFrame(0.035, Ht / 2 - 0.004, 0.006, 0.026, 0.008, 0.012);
      onFrame(-Wd / 2 + 0.006, 0, 0.004, 0.01, 0.026, 0.012); onFrame(Wd / 2 - 0.006, 0, 0.004, 0.01, 0.026, 0.012);
      // strap: a wide flat band from both side buckles round the back, lying flat on the surface
      const aS = (Wd / 2) / R, bx = Math.sin(aS) * (R + 0.004), bz = Math.cos(aS) * (R + 0.004) + zc;
      for (const sx of [-1, 1]) { const b = k.rbox(0.006, 0.022, 0.014, 0.002, buckM, 1); b.position.set(sx * bx, Y, bz - 0.004); b.rotation.y = sx * aS; g.add(b); }
      const pts = []; for (let i = 0; i <= 30; i++) { const a = aS + i / 30 * (2 * Math.PI - 2 * aS); pts.push(new THREE.Vector3(Math.sin(a) * (R + 0.01), 0.0015, Math.cos(a) * (R + 0.03) + zc - 0.01)); }
      pts[0].set(bx, Y - 0.006, bz - 0.006); pts[pts.length - 1].set(-bx, Y - 0.006, bz - 0.006);
      const curve = new THREE.CatmullRomCurve3(pts), N = 80, pos = [], idx = [];
      for (let i = 0; i <= N; i++) { const t = i / N, c = curve.getPointAt(t), tg = curve.getTangentAt(t), side = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
        const up = c.y > 0.01 ? new THREE.Vector3(0, 1, 0) : null; const half = 0.011;
        if (up) { pos.push(c.x, c.y - half, c.z, c.x, c.y + half, c.z); } else { pos.push(c.x - side.x * half, c.y, c.z - side.z * half, c.x + side.x * half, c.y, c.z + side.z * half); }
        if (i) { const q = i * 2; idx.push(q - 2, q - 1, q, q - 1, q + 1, q); } }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setIndex(idx); sg.computeVertexNormals();
      g.add(new THREE.Mesh(sg, k.colMat('#26313d', 0.85, { side: THREE.DoubleSide })));
    }));
    it.r = 0.1;
  };

  // ---- CO2 FIRE EXTINGUISHER (owner: realistic, CO2 type) ----
  // red steel cylinder with a black band, domed shoulder, valve head with carrying handle + squeeze lever, safety
  // pin + ring + tamper tag, black hose to a black discharge horn clipped to the side, generic CO2 label, wall bracket.
  // Origin = floor under the cylinder, back towards the wall at -z; returns the group.
  E.fireExtCO2 = (k, g) => {
    const { THREE } = k;
    const red = k.colMat('#b8231f', 0.32), black = k.colMat('#18191b', 0.5), chrome = k.colMat('#cfd4d8', 0.25, { metalness: 0.8 }), steel = k.M.steelDark;
    const Y0 = 0.3, R = 0.07, Hc = 0.56;
    const body = k.lathe([[0.0001, Y0], [R * 0.92, Y0], [R, Y0 + 0.012], [R, Y0 + Hc - 0.06], [R * 0.86, Y0 + Hc - 0.02], [R * 0.5, Y0 + Hc + 0.008], [0.022, Y0 + Hc + 0.014], [0.0001, Y0 + Hc + 0.014]], red, 48);
    body.castShadow = true; g.add(body);
    const band = k.cyl(R + 0.0008, R + 0.0008, 0.05, black, 48, true); band.position.y = Y0 + Hc - 0.11; g.add(band);
    const lt = k.texCache('co2-label', () => k.canvasTex(512, 512, (c, w, h) => {
      c.fillStyle = '#f4f2ea'; c.fillRect(0, 0, w, h); c.fillStyle = '#18191b'; c.fillRect(0, 0, w, 70);
      c.fillStyle = '#fff'; c.font = 'bold 44px system-ui'; c.textAlign = 'center'; c.fillText('CO₂', w / 2, 50);
      c.fillStyle = '#b8231f'; c.font = 'bold 34px system-ui'; c.fillText('CARBON DIOXIDE', w / 2, 120); c.font = 'bold 28px system-ui'; c.fillText('FIRE EXTINGUISHER', w / 2, 158);
      c.strokeStyle = '#18191b'; c.lineWidth = 4; for (let i = 0; i < 3; i++) { c.strokeRect(40 + i * 150, 190, 130, 110); }
      c.fillStyle = '#18191b'; c.font = '22px system-ui'; ['B', 'E', '⚡'].forEach((t, i) => c.fillText(t, 105 + i * 150, 258));
      c.font = '20px system-ui'; c.textAlign = 'left'; ['1. Pull out the safety pin', '2. Aim the horn at the base of the fire', '3. Squeeze the lever', 'Do not hold the horn: it gets very cold', 'Contents 2 kg CO₂ · Test 250 bar'].forEach((t, i) => c.fillText(t, 40, 345 + i * 32));
    }));
    const label = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.0012, R + 0.0012, 0.26, 40, 1, true, -0.9, 1.8), new THREE.MeshStandardMaterial({ map: lt, roughness: 0.6 }));
    label.position.y = Y0 + 0.24; g.add(label);
    // valve head: chrome body, carrying handle (lower), squeeze lever (upper), safety pin + ring + tag
    const top = Y0 + Hc + 0.014;
    const vb = k.rbox(0.035, 0.05, 0.04, 0.006, chrome, 2); vb.position.set(0, top + 0.022, 0); g.add(vb);
    const neck = k.cyl(0.016, 0.02, 0.016, chrome, 20); neck.position.y = top + 0.004; g.add(neck);
    const handle = k.rbox(0.03, 0.012, 0.15, 0.004, black, 2); handle.position.set(0, top + 0.04, -0.06); handle.rotation.x = 0.12; g.add(handle);
    const lever = k.rbox(0.028, 0.01, 0.15, 0.004, black, 2); lever.position.set(0, top + 0.068, -0.055); lever.rotation.x = -0.18; g.add(lever);
    const pin = k.cyl(0.0022, 0.0022, 0.05, chrome, 8); pin.rotation.z = Math.PI / 2; pin.position.set(0, top + 0.054, -0.02); g.add(pin);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0022, 8, 20), chrome); ring.position.set(0.032, top + 0.054, -0.02); ring.rotation.y = Math.PI / 2; g.add(ring);
    const tag = k.rbox(0.0015, 0.018, 0.012, 0.001, k.colMat('#e8c21f', 0.5), 1); tag.position.set(0.034, top + 0.036, -0.02); g.add(tag);
    // hose from the valve, down the side to the horn clipped on a holder
    g.add(k.tube([[0.0, top + 0.03, 0.022], [0.04, top + 0.02, 0.06], [0.08, top - 0.08, 0.05], [0.09, top - 0.22, 0.04], [0.085, Y0 + 0.2, 0.04]], 0.008, black, 48));
    const horn = k.lathe([[0.012, 0], [0.014, 0.03], [0.02, 0.06], [0.034, 0.16], [0.03, 0.16], [0.016, 0.06], [0.009, 0.03], [0.009, 0]], black, 24);
    horn.rotation.x = Math.PI; horn.position.set(0.085, Y0 + 0.21, 0.04); g.add(horn);
    const clip = k.rbox(0.03, 0.02, 0.03, 0.004, steel, 1); clip.position.set(0.075, Y0 + 0.14, 0.03); g.add(clip);
    // wall bracket: back plate + hook under the valve + strap round the cylinder
    const plate = k.rbox(0.06, 0.2, 0.008, 0.003, steel, 1); plate.position.set(0, Y0 + Hc - 0.12, -0.115); g.add(plate);
    const hook = k.rbox(0.05, 0.02, 0.05, 0.004, steel, 1); hook.position.set(0, Y0 + Hc - 0.03, -0.09); g.add(hook);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(R + 0.004, 0.004, 6, 40, Math.PI), steel); strap.rotation.x = Math.PI / 2; strap.rotation.z = Math.PI; strap.position.set(0, Y0 + 0.2, 0); g.add(strap);
    return g;
  };

  // ---- OFFICE CHAIR: swivelling top + rolling base (owner: "revolve and move") ----
  // returns { base, top, castors: [{ pivot, wheel }] }: top (column top, seat, back) turns about y; each castor pivot
  // turns towards the direction of travel, wheel rolls.
  E.officeChair = (k, g) => {
    const { THREE } = k;
    const black = k.colMat('#22262b', 0.5), fabric = k.colMat('#2f3a46', 0.85), steel = k.M.steelDark;
    const base = new THREE.Group(); g.add(base);
    const castors = [];
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2, leg = k.rbox(0.3, 0.025, 0.04, 0.008, black, 2);
      leg.position.set(Math.cos(a) * 0.15, 0.065, Math.sin(a) * 0.15); leg.rotation.y = -a; base.add(leg);
      const pivot = new THREE.Group(); pivot.position.set(Math.cos(a) * 0.29, 0.03, Math.sin(a) * 0.29); base.add(pivot);
      const fork = k.rbox(0.012, 0.03, 0.03, 0.003, black, 1); fork.position.set(0, 0.02, -0.012); pivot.add(fork);
      const wheel = new THREE.Group(); wheel.position.set(0, 0, -0.018); pivot.add(wheel);
      const w = k.cyl(0.025, 0.025, 0.022, black, 16); w.rotation.z = Math.PI / 2; wheel.add(w);
      const hub = k.cyl(0.008, 0.008, 0.024, steel, 10); hub.rotation.z = Math.PI / 2; wheel.add(hub);
      castors.push({ pivot, wheel });
    }
    const hubC = k.cyl(0.05, 0.06, 0.04, black, 20); hubC.position.y = 0.075; base.add(hubC);
    const col = k.cyl(0.022, 0.026, 0.2, steel, 16); col.position.y = 0.19; base.add(col);
    const top = new THREE.Group(); top.position.y = 0.29; g.add(top);
    const col2 = k.cyl(0.03, 0.03, 0.12, black, 16); col2.position.y = 0.02; top.add(col2);
    const mech = k.rbox(0.2, 0.04, 0.2, 0.01, black, 2); mech.position.y = 0.1; top.add(mech);
    const lev = k.cyl(0.005, 0.005, 0.1, black, 8); lev.rotation.z = Math.PI / 2; lev.position.set(0.14, 0.1, 0.04); top.add(lev);
    const seat = k.rbox(0.48, 0.07, 0.46, 0.03, fabric, 4); seat.position.y = 0.16; seat.castShadow = true; top.add(seat);
    const post = k.rbox(0.05, 0.25, 0.03, 0.01, black, 2); post.position.set(0, 0.28, -0.22); top.add(post);
    const back = k.rbox(0.44, 0.42, 0.06, 0.03, fabric, 4); back.position.set(0, 0.56, -0.24); back.rotation.x = -0.1; back.castShadow = true; top.add(back);
    for (const sx of [-1, 1]) {                                                      // armrests
      const up = k.rbox(0.03, 0.18, 0.03, 0.008, black, 2); up.position.set(sx * 0.26, 0.24, -0.02); top.add(up);
      const pad = k.rbox(0.06, 0.025, 0.24, 0.01, black, 2); pad.position.set(sx * 0.26, 0.34, 0.0); top.add(pad);
    }
    return { base, top, castors };
  };
})();
