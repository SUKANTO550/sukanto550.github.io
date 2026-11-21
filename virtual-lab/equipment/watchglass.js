/* Watch glass — 75 mm borosilicate dish (typical lab watch glass; no owner photo yet).
   A thin spherical shell: convex side down, it rests on its centre (outer bottom at y = 0).
   Contract with index.html / actions:
     R  = 0.0375   rim radius
     RC = 0.11     radius of curvature
     T  = 0.0016   glass thickness
     inner surface height at radius r:  E.watchglassY(r) = T + RC - sqrt(RC^2 - r^2)
     rim top = E.watchglassY(R) (~ 8 mm)  */
(function () {
  const E = window.EQUIP = window.EQUIP || {};
  const R = 0.0375, RC = 0.11, T = 0.0016;
  const sag = r => RC - Math.sqrt(RC * RC - r * r);
  E.watchglassDims = { R, RC, T };
  E.watchglassY = r => T + sag(Math.min(Math.abs(r), R));

  E.watchglass = (k, it) => {
    const { THREE, M } = k;
    // lathe profile: outer surface out to the rim, rounded rim, inner surface back to the centre
    const pts = [], N = 24;
    for (let i = 0; i <= N; i++) { const r = R * i / N; pts.push([Math.max(1e-4, r), sag(r)]); }
    pts.push([R + 0.0004, sag(R) + T * 0.5]);
    for (let i = N; i >= 0; i--) { const r = R * i / N; pts.push([Math.max(1e-4, r), sag(r) + T]); }
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 56);
    const m = new THREE.Mesh(g, M.watchGlass || M.glass); m.renderOrder = 3; m.castShadow = false;
    it.obj.add(m);
    E.watchglassRim(k, it.obj);
    it.r = R + 0.002; it.h = sag(R) + T;
  };
  // thin darker line round the rim, so the dish shows on the white balance (owner); also used by the lab copies
  E.watchglassRim = (k, parent) => {
    const { THREE, M } = k;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.0002, 0.0012, 8, 64), M.glassRim || M.glass);
    rim.rotation.x = Math.PI / 2; rim.position.y = sag(R) + T * 0.5; rim.renderOrder = 4; rim.castShadow = false; rim.receiveShadow = false;
    parent.add(rim); return rim;
  };
})();
