/* Tool stand (owner, 2026-11-20): stainless steel, holds clean small tools upright.
   Typical lab utensil rack (no owner photo): base plate, 4 posts, a top plate at y = 0.07 with
   8 round holes (2 rows of 4) the tools pass through (working end up), and a shallow cup on the
   right for stir bars. Always counts as CLEAN (owner).
   Contract with actions/tool_rules.js:
     TOOLSTAND_HOLES  hole centres [x, z]; tool rests on the base at y = TOOLSTAND_FLOOR
     TOOLSTAND_CUP    { x, z, r, floor } stir-bar cup (bars lie in it) */
(function () {
  const E = window.EQUIP = window.EQUIP || {};
  const HX = [-0.084, -0.054, -0.024, 0.006], HZ = [-0.018, 0.018];
  E.TOOLSTAND_HOLES = []; for (const z of HZ) for (const x of HX) E.TOOLSTAND_HOLES.push([x, z]);
  E.TOOLSTAND_FLOOR = 0.006;
  E.TOOLSTAND_CUP = { x: 0.068, z: 0, r: 0.032, floor: 0.009 };

  E.toolStand = (k, o) => {
    const { THREE } = k;
    o.add(k.bake('tool-stand', g => {
      const st = k.M.steel, dark = k.M.steelDark;
      const base = k.rbox(0.2, 0.006, 0.075, 0.004, st, 2); base.position.set(0, 0.003, 0); g.add(base);
      // rubber feet
      for (const x of [-0.09, 0.09]) for (const z of [-0.03, 0.03]) { const f = k.cyl(0.005, 0.005, 0.002, k.M.black, 10); f.position.set(x, -0.001, z); g.add(f); }
      // top plate with 8 holes (shape with holes, extruded)
      const sh = new THREE.Shape(), w = 0.13, d = 0.064, x0 = -0.039;
      sh.moveTo(x0 - w / 2, -d / 2); sh.lineTo(x0 + w / 2, -d / 2); sh.lineTo(x0 + w / 2, d / 2); sh.lineTo(x0 - w / 2, d / 2); sh.lineTo(x0 - w / 2, -d / 2);
      for (const [x, z] of E.TOOLSTAND_HOLES) { const h = new THREE.Path(); h.absarc(x, z, 0.0095, 0, Math.PI * 2, true); sh.holes.push(h); }
      const tg = new THREE.ExtrudeGeometry(sh, { depth: 0.003, bevelEnabled: false, curveSegments: 16 });
      tg.rotateX(Math.PI / 2); tg.translate(0, 0.073, 0);
      g.add(k.mesh(tg, st));
      for (const [x, z] of [[x0 - w / 2 + 0.005, -d / 2 + 0.005], [x0 + w / 2 - 0.005, -d / 2 + 0.005], [x0 - w / 2 + 0.005, d / 2 - 0.005], [x0 + w / 2 - 0.005, d / 2 - 0.005]]) {
        const p = k.cyl(0.003, 0.003, 0.067, dark, 10); p.position.set(x, 0.0065 + 0.0335, z); g.add(p);
      }
      // drip rings on the base under each hole
      for (const [x, z] of E.TOOLSTAND_HOLES) { const r = new THREE.Mesh(new THREE.RingGeometry(0.006, 0.0085, 18), dark); r.rotation.x = -Math.PI / 2; r.position.set(x, 0.0062, z); g.add(r); }
      // stir-bar cup
      const C = E.TOOLSTAND_CUP;
      const cup = k.lathe([[0.0001, 0.006], [C.r, 0.006], [C.r + 0.001, 0.008], [C.r + 0.001, 0.026], [C.r - 0.001, 0.026], [C.r - 0.001, C.floor], [0.0001, C.floor]], st, 32);
      cup.position.set(C.x, 0, C.z); g.add(cup);
    }, { cast: true }));
  };
})();
