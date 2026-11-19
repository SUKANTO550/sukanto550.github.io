/* Syringe 10 ml + syringe filter.
   Filter — owner's photo (VirtualLab/Equipments/Cyringe filter): ~25 mm disc housing with a ribbed
   rim, clear centre over the PTFE membrane, female luer inlet on top, male outlet nozzle below.
   Syringe — clear barrel, finger flange, black rubber stopper on a cross-ribbed plunger that MOVES
   with the volume (it.onLevel(fill)).
   Contracts with index.html: barrel y 0..0.09 (liquid level = 0.002 + 0.09 * 0.9 * fill), luer tip
   end y = -0.012, attached filter outlet end y ~ -0.034 (it.filterMesh). */
(function () {
  const E = window.EQUIP = window.EQUIP || {};

  // filter model, centred so the inlet top is at y = +0.0075 and the outlet end at y = -0.0145
  function filterParts(k, g) {
    const { THREE } = k;
    const house = k.colMat('#f3f3ef', 0.4), clear = k.colMat('#e9eef0', 0.15, { transparent: true, opacity: 0.55, depthWrite: false });
    g.add(k.lathe([[0.0001, -0.003], [0.0118, -0.003], [0.0126, -0.0018], [0.0126, 0.0018], [0.0118, 0.003], [0.0085, 0.0032], [0.0001, 0.0032]], house, 40));
    g.add(k.lathe([[0.0001, 0.0033], [0.0082, 0.0033], [0.0001, 0.0035]], clear, 32));                 // window over the membrane
    g.add(k.lathe([[0.0001, 0.003], [0.0034, 0.003], [0.0034, 0.0062], [0.0042, 0.0064], [0.0042, 0.0075], [0.0001, 0.0075]], house, 20));   // inlet
    g.add(k.lathe([[0.0001, -0.0145], [0.0011, -0.0145], [0.0016, -0.006], [0.0024, -0.003], [0.0001, -0.003]], house, 16));               // outlet
    for (let i = 0; i < 44; i++) {                                                                     // ribbed rim
      const a = i / 44 * Math.PI * 2; const r = new THREE.Mesh(new THREE.BoxGeometry(0.0008, 0.0042, 0.0007), house);
      r.position.set(Math.sin(a) * 0.0127, 0, Math.cos(a) * 0.0127); r.rotation.y = a; g.add(r);
    }
  }

  E.filterItem = (k, it) => {                      // loose filter lying on the table (outlet down needs support -> lies flat)
    const m = k.bake('filter', g => filterParts(k, g));
    m.rotation.x = Math.PI / 2; m.position.y = 0.0126; it.obj.add(m);
    it.r = 0.015;
  };

  E.syringe = (k, it) => {
    const { THREE } = k;
    const barrelM = k.colMat('#f2f6f8', 0.25, { transparent: true, opacity: 0.38, depthWrite: false });
    const white = k.colMat('#f7f8f8', 0.4);
    it.obj.add(k.bake('syringe-barrel', g => {
      g.add(k.lathe([[0.0011, -0.012], [0.0016, -0.0118], [0.0021, -0.004], [0.0034, -0.0025], [0.0072, 0.0], [0.0083, 0.0008], [0.0083, 0.0895],
        [0.0088, 0.09]], barrelM, 28));
    }));
    it.obj.add(k.bake('syringe-flange', g => {
      const f = k.rbox(0.034, 0.0022, 0.015, 0.0045, white, 3); f.position.y = 0.0905; g.add(f);
    }));
    // plunger: stopper + cross rod + thumb press; group y = liquid level
    const pl = k.bake('syringe-plunger', g => {
      g.add(k.lathe([[0.0001, 0.002], [0.0074, 0.002], [0.0079, 0.0028], [0.0074, 0.0042], [0.0079, 0.0056], [0.0074, 0.0072], [0.0045, 0.0076], [0.0001, 0.0076]], k.M.black, 24));
      for (const ry of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.0108, 0.098, 0.0012), white); b.position.y = 0.0076 + 0.049; b.rotation.y = ry; g.add(b); }
      g.add(k.lathe([[0.0001, 0.1054], [0.009, 0.1054], [0.0094, 0.1068], [0.009, 0.1082], [0.0001, 0.1082]], white, 24));
    });
    it.obj.add(pl);
    it.onLevel = f => { pl.position.y = 0.09 * 0.9 * f; };
    // liquid below the stopper
    const liq = k.cyl(0.0074, 0.0074, 1, k.colMat('#bfe0ff', 0.2, { transparent: true, opacity: 0.6 }), 16);
    liq.visible = false; liq.renderOrder = 2; liq.castShadow = false; it.obj.add(liq); it.toolLiq = { mesh: liq, len: 0.09 };
    // attached filter
    const fm = k.bake('filter', g => filterParts(k, g)); fm.position.y = -0.012 - 0.0075 + 0.003; fm.visible = false; it.obj.add(fm);
    // (hide the meshes too, so a hidden filter cannot be clicked)
    it.filterMesh = { get visible() { return fm.visible; }, set visible(v) { fm.visible = v; fm.children.forEach(c => c.visible = v); } };
    it.filterMesh.visible = false; it.filterTipY = fm.position.y - 0.0145;
  };
})();
