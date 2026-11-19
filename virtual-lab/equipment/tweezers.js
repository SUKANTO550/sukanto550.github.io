/* Tweezers — modelled on the owner's photos (VirtualLab/Equipments/Tweezers, .../Tweezer with ceramic head).
   Steel: 16 cm dressing forceps, wide flat back, arms open in a V, blunt rounded tips, ridged grip.
   Ceramic: 13 cm, steel arms with white pointed zirconia tips held by 2 screws each.
   Lies on the table like the owner's ceramic-tweezer photo: on the EDGES of the arms, the two arms
   side by side (V opens sideways, along x), straight lower edge on the table (y = 0), tips at +z.
   Both arms are mirror images: joined at the back, each bends out by half the opening.
   (Modelled with the arms stacked in y, then the whole model is turned 90° about z.) */
(function () {
  const E = window.EQUIP = window.EQUIP || {};
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // flat strip: wAt(s) = width at length s (s0 = back, s1 = tip); thickness T; lift(z) raises it.
  // edge > 0: one long edge stays straight at x = -edge/2 (it becomes the edge resting on the table)
  function strip(k, wAt, s0, s1, T, lift, roundBack = 0.3, n = 28, edge = 0) {
    const { THREE } = k;
    const sh = new THREE.Shape(), right = [];
    const wb = wAt(s0) / 2, sb = s0 + wb * roundBack * 2;
    for (let j = 1; j <= 4; j++) { const a = Math.PI / 2 * j / 4; right.push([wb * Math.sin(a), s0 + (sb - s0) * (1 - Math.cos(a))]); }
    for (let i = 1; i <= n; i++) { const s = sb + (s1 - sb) * i / n; right.push([wAt(s) / 2, s]); }
    const wt = wAt(s1) / 2; right.push([wt * 0.6, s1 + wt * 0.5], [0, s1 + wt * 0.75]);
    sh.moveTo(0, s0);
    right.forEach(([x, y]) => sh.lineTo(x, y));
    for (let i = right.length - 2; i >= 0; i--) sh.lineTo(-right[i][0], right[i][1]);
    if (edge) {                                   // shift each cross-section so its lower edge lines up
      const cl = y => Math.min(s1, Math.max(s0, y));
      for (const c of sh.curves) for (const v of [c.v1, c.v2]) if (v && !v._sh) { v.x += -edge / 2 + wAt(cl(v.y)) / 2; v._sh = 1; }
    }
    const bev = Math.min(0.00025, T * 0.2);
    let g = new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 1, steps: 1 });
    g.rotateX(Math.PI / 2);                       // shape y (length) -> z, thickness -> -y
    g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + lift(p.getZ(i)));
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    return k.creased(g, 0.6);
  }

  // turn the stacked model onto its edges: arms side by side (gap along x), straight edge down on y = 0
  function onEdge(k, g, edge, gap) {
    const r = new k.THREE.Group(); r.rotation.z = Math.PI / 2; r.position.set(gap / 2, edge / 2 + 0.0003, 0); g.add(r); return r;
  }

  E.tweezers = (k, it, ceramic) => {
    const { THREE, M } = k;
    const T = 0.0011, Tt = T + 0.0005;
    // SYMMETRIC arms: joined at the back (stacked, touching), each bends outward by half the opening,
    // so both legs are mirror images (neither stays straight).
    const lowY = open => z => -open(z) / 2, upY = open => z => Tt + open(z) / 2;
    if (!ceramic) {
      const L = 0.16, z0 = -L / 2, z1 = L / 2;
      const w = s => s < z0 + 0.03 ? 0.0105 : 0.0105 - 0.0068 * ss(z0 + 0.03, z1 - 0.004, s);
      // opens in a clean V just after the joint, then runs almost straight, closing slightly at the tips
      const zo = z0 + 0.1;
      const open = z => Math.max(0, 0.0095 * ss(z0 + 0.03, zo, z) - 0.004 * Math.max(0, (z - zo) / (z1 - zo)));
      const lo = lowY(open), up = upY(open), E0 = 0.0105, cx = z => -E0 / 2 + w(z) / 2;
      const side = g => onEdge(k, g, E0, Tt + T);
      it.obj.add(k.bake('tweezers-steel4', g => {
        const r = side(g);
        r.add(new THREE.Mesh(strip(k, w, z0, z1, T, lo, 0.3, 28, E0), M.steel));
        r.add(new THREE.Mesh(strip(k, w, z0, z1, T, up, 0.3, 28, E0), M.steel));
      }));
      // grip ridges on the outer face of each arm (detail, hidden when far)
      it.obj.add(k.bake('tweezers-steel-ridges4', g => {
        const r0 = side(g);
        for (let i = 0; i < 26; i++) {
          const z = -0.022 + i * 0.0016;
          for (const y of [up(z) + Tt + 0.00005, lo(z) - 0.00027]) {
            const r = new THREE.Mesh(new THREE.BoxGeometry(w(z) * 0.82, 0.00022, 0.0006), M.steelDark);
            r.position.set(cx(z), y, z); r0.add(r);
          }
        }
      }, { detailDist: 1.0 }));
      it.r = L / 2 + 0.004;
    } else {
      const L = 0.13, z0 = -L / 2, z1 = L / 2, zc = z0 + 0.082;     // steel ends / ceramic starts
      const w = s => 0.0092 - 0.0016 * ss(z0, zc, s);
      const open = z => z < zc ? 0.0085 * ss(z0 + 0.025, zc, z) : 0.0085 - 0.006 * ss(zc, z1, z);   // V, then the tips converge
      const lo = lowY(open), up = upY(open), E0 = 0.0092, side = g => onEdge(k, g, E0, Tt + T);
      const TC = 0.0019, d = (TC - T) / 2, wc = s => 0.0074 * (1 - 0.9 * ss(zc - 0.004, z1, s));
      it.obj.add(k.bake('tweezers-ceramic4', g => {
        const r = side(g);
        r.add(new THREE.Mesh(strip(k, w, z0, zc + 0.006, T, lo, 0.15, 28, E0), M.steel));
        r.add(new THREE.Mesh(strip(k, w, z0, zc + 0.006, T, up, 0.15, 28, E0), M.steel));
        // ceramic tips continue each arm to a fine point (a little thicker than the steel)
        r.add(new THREE.Mesh(strip(k, wc, zc - 0.004, z1, TC, z => lo(z) - d, 0.05, 28, E0), M.ceramicTip));
        r.add(new THREE.Mesh(strip(k, wc, zc - 0.004, z1, TC, z => up(z) - d, 0.05, 28, E0), M.ceramicTip));
      }));
      it.obj.add(k.bake('tweezers-ceramic-screws4', g => {
        const r = side(g), cx = z => -E0 / 2 + wc(z) / 2;
        const sm = k.colMat('#8d939a', 0.3, { metalness: 0.5 }), slot = k.colMat('#2a2e33', 0.5);
        // 2 screws on the OUTER face of each arm (as in the photo)
        for (const [face, dir] of [[z => lo(z) - d, -1], [z => up(z) - d + TC, 1]]) {
          for (const z of [zc - 0.0005, zc + 0.0045]) {
            const y = face(z), x = cx(z);
            const h = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.0005, 12), sm); h.position.set(x, y + dir * 0.00025, z); r.add(h);
            const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.0018, 0.0002, 0.0003), slot); s1.position.set(x, y + dir * 0.00055, z); s1.rotation.y = 0.6; r.add(s1);
            const s2 = s1.clone(); s2.rotation.y += Math.PI / 2; r.add(s2);
          }
        }
      }, { detailDist: 1.0 }));
      it.r = L / 2 + 0.004;
    }
  };
})();
