/* Spatula — modelled on the owner's photo (VirtualLab/Equipments/Spatulla).
   Stainless steel: oval spoon at one end (+z), square flat blade at the other (-z), flat bar between
   that widens into the blade. Lies on the table (blade + spoon bottom touch y = 0).
   Contract with index.html: spoon centre at z = 0.083 (grains / pile are placed there). */
(function () {
  const E = window.EQUIP = window.EQUIP || {};
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  E.spatula = (k, it) => {
    const { THREE, M } = k;
    it.obj.add(k.bake('spatula', g => {
      // bar + blade outline (top view), s along z
      const z0 = -0.102, z1 = 0.07, T = 0.0014;
      const wAt = s => s < -0.072 ? 0.0125 : s < -0.056 ? 0.0125 - 0.0072 * ss(-0.072, -0.056, s) : 0.0053 + 0.0014 * ss(-0.056, 0.05, s) - 0.0022 * ss(0.05, z1, s);
      const sh = new THREE.Shape(), right = [];
      for (let i = 0; i <= 60; i++) { const s = z0 + (z1 - z0) * i / 60; right.push([wAt(s) / 2, s]); }
      sh.moveTo(-wAt(z0) / 2, z0); right.forEach(([x, y]) => sh.lineTo(x, y));
      for (let i = right.length - 1; i >= 0; i--) sh.lineTo(-right[i][0], right[i][1]);
      let bar = new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: true, bevelThickness: 0.0002, bevelSize: 0.0002, bevelSegments: 1 });
      bar.rotateX(Math.PI / 2); bar.computeBoundingBox(); bar.translate(0, -bar.boundingBox.min.y, 0);
      const p = bar.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.0033 * ss(-0.07, 0.066, p.getZ(i)));   // bar rises to the spoon rim
      bar.deleteAttribute('normal'); bar.deleteAttribute('uv');
      g.add(new THREE.Mesh(k.creased(bar, 0.6), M.steel));
      // spoon bowl: lower half of a squashed sphere, open at the top (seen from inside too)
      const steel2 = M.steel.clone(); steel2.side = THREE.DoubleSide;
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), steel2);
      bowl.scale.set(0.0098, 0.0043, 0.0155); bowl.position.set(0, 0.0046, 0.083); g.add(bowl);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 40), M.steel);
      rim.rotation.x = Math.PI / 2; rim.scale.set(0.0098, 0.0155, 0.004); rim.position.set(0, 0.0046, 0.083); g.add(rim);
    }));
    it.r = 0.1;
  };
})();
