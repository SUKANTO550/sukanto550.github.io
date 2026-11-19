/* Consumables on the rack: nitrile gloves box, lint-free wipes box, aluminium foil box.
   Generic packaging (no brand names). Each builder adds its model to `o` (item root, y = 0 on the shelf).
   Footprints match index.html: gloves 0.24 x 0.125, wipes 0.21 x 0.115, foil 0.31 x 0.05 (lying). */
(function () {
  const E = window.EQUIP = window.EQUIP || {};

  // printed face: a plane just outside a box face (0 = +z front, 1 = -z back, 2 = +x, 3 = -x, 4 = top)
  function face(k, o, tex, W, H, D, which, inset = 0.0004) {
    const { THREE } = k;
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
    const dims = [[W, H], [W, H], [D, H], [D, H], [W, D]][which];
    const p = new THREE.Mesh(new THREE.PlaneGeometry(dims[0] - 0.002, dims[1] - 0.002), m);
    if (which === 0) p.position.set(0, H / 2, D / 2 + inset);
    if (which === 1) { p.position.set(0, H / 2, -D / 2 - inset); p.rotation.y = Math.PI; }
    if (which === 2) { p.position.set(W / 2 + inset, H / 2, 0); p.rotation.y = Math.PI / 2; }
    if (which === 3) { p.position.set(-W / 2 - inset, H / 2, 0); p.rotation.y = -Math.PI / 2; }
    if (which === 4) { p.position.set(0, H + inset, 0); p.rotation.x = -Math.PI / 2; }
    o.add(p); return p;
  }
  // soft crumpled sheet (tissue / glove / foil): a plane bent and rippled
  function sheet(k, w, h, seg, bend, rip, seed) {
    const { THREE } = k;
    const g = new THREE.PlaneGeometry(w, h, seg, seg), p = g.attributes.position;
    let s = seed; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
    const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), u = x / w, v = y / h;
      p.setZ(i, bend(u, v) + rip * (Math.sin(u * 17 + ph[0] + v * 5) * 0.6 + Math.sin(v * 13 + ph[1]) * 0.4 + Math.sin((u + v) * 23 + ph[2]) * 0.3));
    }
    g.computeVertexNormals(); return g;
  }

  E.gloves = (k, o) => {
    const { THREE } = k;
    const W = 0.24, H = 0.065, D = 0.125;
    const art = (top) => k.texCache('gloves-' + top, () => k.canvasTex(512, top ? 268 : 140, (g, w, h) => {
      g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#3d74d6'; g.fillRect(0, 0, w, top ? 34 : 40); g.fillRect(0, h - (top ? 22 : 18), w, top ? 22 : 18);
      g.fillStyle = '#ffffff'; g.font = `bold ${top ? 22 : 26}px system-ui`; g.textAlign = 'center'; g.fillText('NITRILE EXAMINATION GLOVES', w / 2, top ? 25 : 29);
      g.fillStyle = '#24467f'; g.font = `bold ${top ? 18 : 22}px system-ui`;
      if (top) {   // oval dispensing hole (dark inside)
        g.fillStyle = '#1b2230'; g.beginPath(); g.ellipse(w / 2, h / 2 + 4, 120, 46, 0, 0, 7); g.fill();
        g.strokeStyle = '#c8d3e2'; g.lineWidth = 4; g.stroke();
      } else {
        g.fillText('Powder-free · Ambidextrous · 100 pcs', w / 2, 78);
        g.fillStyle = '#3d74d6'; g.fillRect(w - 86, 52, 62, 62); g.fillStyle = '#fff'; g.font = 'bold 44px system-ui'; g.fillText('M', w - 55, 99);
      }
    }));
    o.add(k.bake('gloves-box', g => { const b = k.rbox(W, H, D, 0.002, k.colMat('#f1f3f5', 0.6), 2); b.position.y = H / 2; g.add(b); }, { cast: true }));
    face(k, o, art(false), W, H, D, 0); face(k, o, art(false), W, H, D, 1); face(k, o, art(true), W, H, D, 4);
    // blue glove cuffs + fingers puffing out of the hole
    o.add(k.bake('gloves-out', g => {
      const blue = k.colMat('#5d8fe2', 0.55, { side: THREE.DoubleSide });
      const pieces = [[0.0, 0.0, 0.0, 0.1, 0.06, 1], [-0.025, 0.004, 0.2, 0.07, 0.05, 2], [0.03, -0.004, -0.3, 0.075, 0.05, 3]];
      for (const [x, z, ry, w, h, sd] of pieces) {
        const m = new THREE.Mesh(sheet(k, w, h, 14, (u, v) => 0.012 * (1 - 4 * u * u) * (0.5 + v), 0.0022, sd * 77), blue);
        m.rotation.set(-1.25, ry, 0); m.position.set(x, H + 0.012, z); g.add(m);
      }
      for (let i = 0; i < 3; i++) {   // a few finger tips
        const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0055, 0.018, 4, 8), blue);
        f.rotation.set(0.6 + i * 0.15, 0.3 * i, 1.2 + i * 0.4); f.position.set(-0.02 + i * 0.02, H + 0.018 + i * 0.002, 0.004 - i * 0.004); g.add(f);
      }
    }));
  };

  E.wipes = (k, o) => {
    const { THREE } = k;
    const W = 0.21, H = 0.065, D = 0.115;
    const art = (top) => k.texCache('wipes-' + top, () => k.canvasTex(512, top ? 280 : 160, (g, w, h) => {
      g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2f9a5a'; g.fillRect(0, h - 46, w, 46);
      for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(47,154,90,${0.12 + (i % 3) * 0.05})`; g.beginPath(); g.arc(30 + i * 60, top ? 40 : 30, 18, 0, 7); g.fill(); }
      g.fillStyle = '#ffffff'; g.font = 'bold 24px system-ui'; g.textAlign = 'center'; g.fillText('LINT-FREE WIPES', w / 2, h - 16);
      if (top) { g.fillStyle = '#d9ddd8'; g.beginPath(); g.ellipse(w / 2, h / 2 - 6, 110, 26, 0, 0, 7); g.fill(); g.fillStyle = '#9aa29a'; g.fillRect(w / 2 - 100, h / 2 - 8, 200, 4); }
      else { g.fillStyle = '#2b5a3c'; g.font = 'bold 22px system-ui'; g.fillText('Delicate task wipers · 280 sheets', w / 2, 82); g.font = '18px system-ui'; g.fillText('11 x 21 cm · 1-ply', w / 2, 108); }
    }));
    o.add(k.bake('wipes-box', g => { const b = k.rbox(W, H, D, 0.002, k.colMat('#f7f7f3', 0.6), 2); b.position.y = H / 2; g.add(b); }, { cast: true }));
    face(k, o, art(false), W, H, D, 0); face(k, o, art(false), W, H, D, 1); face(k, o, art(true), W, H, D, 4);
    o.add(k.bake('wipes-tissue', g => {   // the next wipe pops up through the slot
      const tissue = k.colMat('#ffffff', 0.9, { side: THREE.DoubleSide });
      const m = new THREE.Mesh(sheet(k, 0.07, 0.06, 16, (u, v) => 0.014 * Math.sin((v + 0.5) * Math.PI) * (1 - 2 * u * u) + 0.01 * u * (v + 0.5), 0.0016, 11), tissue);
      m.rotation.set(-0.15, 0.25, 0); m.position.set(0, H + 0.028, -0.004); g.add(m);
    }));
  };

  E.foil = (k, o) => {
    const { THREE } = k;
    const L = 0.31, H = 0.048, D = 0.05;
    const art = k.texCache('foil-side', () => k.canvasTex(1024, 160, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2b5fb0'); gr.addColorStop(1, '#173e7c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#c9ced3'; g.fillRect(0, h - 30, w, 6);
      g.fillStyle = '#ffffff'; g.font = 'bold 52px system-ui'; g.textAlign = 'left'; g.fillText('ALUMINIUM FOIL', 40, 76);
      g.font = '28px system-ui'; g.fillText('30 cm × 10 m  ·  heavy duty', 40, 116);
      g.textAlign = 'right'; g.font = 'bold 30px system-ui'; g.fillText('Lab / Food grade', w - 40, 76);
    }));
    o.add(k.bake('foil-box', g => {
      const card = k.colMat('#1f4a91', 0.6), inside = k.colMat('#d8d2c4', 0.8);
      // open carton: base tray + back wall, lid hinged at the back and lifted
      const base = k.rbox(L, 0.004, D, 0.001, card); base.position.y = 0.002; g.add(base);
      for (const z of [-D / 2 + 0.002]) { const w = k.rbox(L, H, 0.004, 0.001, card); w.position.set(0, H / 2, z); g.add(w); }
      for (const x of [-L / 2 + 0.002, L / 2 - 0.002]) { const e = k.rbox(0.004, H, D, 0.001, card); e.position.set(x, H / 2, 0); g.add(e); }
      const fr = k.rbox(L, H * 0.55, 0.004, 0.001, card); fr.position.set(0, H * 0.275, D / 2 - 0.002); g.add(fr);
      const inner = k.rbox(L - 0.01, 0.002, D - 0.01, 0.0008, inside); inner.position.y = 0.005; g.add(inner);
      const lid = new THREE.Group(); lid.position.set(0, H, -D / 2); lid.rotation.x = -0.55; g.add(lid);
      const lt = k.rbox(L + 0.002, 0.004, D + 0.004, 0.001, card); lt.position.set(0, 0, D / 2); lid.add(lt);
      const lf = k.rbox(L + 0.002, 0.018, 0.004, 0.001, card); lf.position.set(0, -0.009, D + 0.002); lid.add(lf);
      const lp = new THREE.Mesh(new THREE.PlaneGeometry(L, D), new THREE.MeshStandardMaterial({ map: art, roughness: 0.6 })); lp.rotation.x = -Math.PI / 2; lp.position.set(0, 0.0021, D / 2); lid.add(lp);
      // serrated cutting edge on the front wall
      const teeth = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, L - 0.01, 3), k.colMat('#9aa0a5', 0.3, { metalness: 0.7 }));
      teeth.rotation.z = Math.PI / 2; teeth.position.set(0, H * 0.55 + 0.001, D / 2 - 0.002); g.add(teeth);
    }, { cast: true }));
    face(k, o, art, L, H, D, 1);
    o.add(k.bake('foil-roll', g => {
      const foil = new THREE.MeshStandardMaterial({ color: 0xd9dcdf, metalness: 1.0, roughness: 0.28, envMapIntensity: 1.0, side: THREE.DoubleSide });
      const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, L - 0.012, 32), foil); roll.rotation.z = Math.PI / 2; roll.position.y = 0.025; g.add(roll);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, L - 0.008, 20, 1, true), k.colMat('#b98f5a', 0.8, { side: THREE.DoubleSide }));
      core.rotation.z = Math.PI / 2; core.position.y = 0.025; g.add(core);
      // a crinkled sheet pulled over the front edge and hanging down
      const s = new THREE.Mesh(sheet(k, L - 0.03, 0.05, 20, (u, v) => -0.012 * (0.5 - v) * (0.5 - v), 0.0012, 5), foil);
      s.rotation.x = -0.2; s.position.set(0, H * 0.55 - 0.018, D / 2 + 0.006); g.add(s);
    }));
  };
})();
