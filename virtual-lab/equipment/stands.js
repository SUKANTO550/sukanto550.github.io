/* Stands that hold tools upright (generic lab stands, polypropylene + steel).
   Pipette stand: base with drip cups, two posts, a split top bar the pipettes pass through (tip down).
     6 slots along x at PIPETTE_SLOTS, slot floor y = 0.016 (tip rests in the cup).
   Micropipette stand: base, two back posts, a hanger bar the finger hooks rest on.
     5 slots along x at MICRO_SLOTS, slot y = 0.012, pipette turned so its hook points to the back (-z);
     hanger bar top at y = 0.263 (hook underside = slot y + 0.2515).
   index.html creates the snap slots (surfaces) at these positions. */
(function () {
  const E = window.EQUIP = window.EQUIP || {};
  E.PIPETTE_SLOTS = [-0.0875, -0.0525, -0.0175, 0.0175, 0.0525, 0.0875];
  E.MICRO_SLOTS = [-0.1, -0.05, 0, 0.05, 0.1];

  E.pipetteStand = (k, o) => {
    const { THREE } = k;
    o.add(k.bake('pipette-stand', g => {
      const pp = k.colMat('#e9ecee', 0.45), blue = k.colMat('#2f6fb5', 0.45), dark = k.colMat('#3b4147', 0.5);
      const base = k.rbox(0.25, 0.012, 0.08, 0.004, pp, 2); base.position.y = 0.006; g.add(base);
      for (const x of E.PIPETTE_SLOTS) {          // drip cups the tips rest in
        const cup = k.lathe([[0.0001, 0.012], [0.0065, 0.012], [0.0065, 0.017], [0.0055, 0.017], [0.0055, 0.0135], [0.0001, 0.0135]], pp, 16); cup.position.x = x; g.add(cup);
        const d = new THREE.Mesh(new THREE.CircleGeometry(0.0045, 12), dark); d.rotation.x = -Math.PI / 2; d.position.set(x, 0.0137, 0); g.add(d);
      }
      for (const x of [-0.118, 0.118]) { const p = k.rbox(0.012, 0.23, 0.012, 0.003, blue, 2); p.position.set(x, 0.012 + 0.115, -0.012); g.add(p); }
      // split top bar: front + back rails with a gap the pipettes stand in
      for (const z of [-0.0145, 0.0145]) { const r = k.rbox(0.25, 0.012, 0.011, 0.003, pp, 2); r.position.set(0, 0.226, z); g.add(r); }
      for (const x of [-0.118, 0.118]) { const c = k.rbox(0.014, 0.014, 0.042, 0.003, blue, 2); c.position.set(x, 0.226, 0); g.add(c); }
    }, { cast: true }));
  };

  E.micropipetteStand = (k, o) => {
    const { THREE } = k;
    o.add(k.bake('micro-stand', g => {
      const pp = k.colMat('#e9ecee', 0.45), blue = k.colMat('#2f6fb5', 0.45);
      const base = k.rbox(0.27, 0.012, 0.09, 0.005, pp, 2); base.position.set(0, 0.006, 0); g.add(base);
      for (const x of E.MICRO_SLOTS) { const pad = k.cyl(0.009, 0.01, 0.003, k.colMat('#c9ced2', 0.5), 18); pad.position.set(x, 0.0135, 0.004); g.add(pad); }
      for (const x of [-0.128, 0.128]) { const p = k.rbox(0.012, 0.26, 0.014, 0.003, blue, 2); p.position.set(x, 0.012 + 0.13, -0.035); g.add(p); }
      const bar = k.rbox(0.268, 0.01, 0.022, 0.003, pp, 2); bar.position.set(0, 0.258, -0.027); g.add(bar);          // hanger bar (top at 0.263)
      const lip = k.rbox(0.268, 0.006, 0.004, 0.0015, pp, 2); lip.position.set(0, 0.264, -0.038); g.add(lip);       // back lip stops the hooks sliding off
      for (const x of E.MICRO_SLOTS) { const n = k.rbox(0.002, 0.004, 0.02, 0.0008, blue, 1); n.position.set(x - 0.012, 0.2645, -0.027); g.add(n); n.clone(); const n2 = n.clone(); n2.position.x = x + 0.012; g.add(n2); }
    }, { cast: true }));
  };
})();
