/* Glass pipettes.
   Graduated pipette — owner's photo (VirtualLab/Equipments/pippet): clear borosilicate tube, narrow
   mouthpiece on top, long taper to the tip, BLUE printing (scale + class/volume text). No colour band.
   Dropper — Pasteur pipette: short wide body, long thin capillary, red rubber bulb.
   Contracts with index.html (upright, tip down):
     pipette: tip end y = -0.03, liquid level = 0.002 + 0.32 * 0.9 * fill, straight tube to y = 0.33
     dropper: tip end y = -0.05, liquid level = 0.002 + 0.06 * 0.9 * fill, it.bulb = rubber bulb group */
(function () {
  const E = window.EQUIP = window.EQUIP || {};

  function liquid(k, it, r, len) {
    const liq = k.cyl(r, r, 1, k.colMat('#bfe0ff', 0.2, { transparent: true, opacity: 0.6 }), 10);
    liq.visible = false; liq.renderOrder = 2; liq.castShadow = false;
    it.obj.add(liq); it.toolLiq = { mesh: liq, len };
  }

  // small printed text band wrapped on the front of a tube (blue print on glass)
  function printBand(k, it, r, y0, y1, lines, color, key) {
    const { THREE } = k;
    const tex = k.texCache(key, () => k.canvasTex(128, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
      const n = lines.length;
      lines.forEach((l, i) => { g.font = `bold ${i === 0 ? 46 : 24}px system-ui,sans-serif`; g.fillText(l, w / 2, h * (i + 0.6) / (n + 0.2)); });
    }));
    const phi = 1.5;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y1 - y0, 16, 1, true, -phi / 2, phi),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.position.y = (y0 + y1) / 2; m.renderOrder = 4; it.obj.add(m);
  }

  E.pipette = (k, it, ml, printColor) => {
    const R = 0.0042;
    it.obj.add(k.bake('pipette-body', g => {
      g.add(k.lathe([[0.0007, -0.03], [0.001, -0.0285], [0.0016, -0.022], [0.0031, -0.007], [R, 0], [R, 0.33], [R - 0.0003, 0.334],
        [0.0031, 0.342], [0.003, 0.364], [0.0027, 0.3655]], k.M.glass, 18));
    }));
    liquid(k, it, R * 0.7, 0.32);
    printBand(k, it, R + 0.0004, 0.296, 0.328, [ml + ' mL', '0.1', 'Class B', 'Ex + 5 s'], printColor, 'pip-print-' + ml);
  };

  E.dropper = (k, it) => {
    const R = 0.0036;
    it.obj.add(k.bake('dropper-glass', g => {
      g.add(k.lathe([[0.00055, -0.05], [0.0009, -0.0485], [0.001, -0.01], [0.0022, -0.004], [R, 0.002], [R, 0.07], [R + 0.0006, 0.072], [R, 0.074]], k.M.glass, 16));
    }));
    const bulb = k.bake('dropper-bulb', g => {
      const b = k.lathe([[0.0001, 0.063], [0.0042, 0.063], [0.0049, 0.064], [0.0048, 0.072], [0.0055, 0.078], [0.0072, 0.083],
        [0.0074, 0.09], [0.0062, 0.098], [0.0035, 0.103], [0.0001, 0.104]], k.M.rubber, 24);
      g.add(b);
    });
    it.obj.add(bulb); it.bulb = bulb;              // clips squeeze it (scale x/z)
    liquid(k, it, R * 0.72, 0.06);
  };
})();
