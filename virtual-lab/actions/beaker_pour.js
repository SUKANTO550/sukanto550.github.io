/* ACTION: pour from a beaker (spout) into another beaker or a conical flask.
   Close-up clip (actions/player.js).
     intro  source beaker lifts beside the target, spout turned over the target's mouth
     loop   beaker tips until the liquid reaches the spout - the angle follows the REAL fill level
            (solved for the vessel shape: the level surface holding the real volume reaches the spout), so a full
            beaker barely tips and an almost empty one tips far; stream from the spout; the surface inside stays
            LEVEL (clipping plane at the solved height).
            Released (hold mode) = tips back just below flowing.
     outro  tips back upright over the mouth (last drop), goes home
   Context c:
     src = { obj (beaker, spout on local +x), lipR, lipY (spout tip, local), R (inside radius), H (inside rim height),
             inner ([[y, r], ...] inside profile), surfaceY() (local liquid height), start (ml), hideContents?(bool) }
     dst = { obj, mouth (local Vector3), mouthR, surfaceY() }
     color, available(), room(), onAmount(ml)
   Host must set renderer.localClippingEnabled = true (level liquid surface).
   Claude default (owner to confirm): no glass rod; spout held just inside the target's rim. */
(function () {
  const C = window.CLIPS;

  C.register('beakerPour', {
    label: 'Beaker → beaker / conical flask (pour)', unit: 'ml',
    intro: 1.0, outro: 1.1, minLoop: 2, maxLoop: 6,
    rate: c => Math.max(0.5, Math.min(25, (c.src.cap || 250) / 12)),   // ml/s, as in the app's pour
    moves: c => [c.src.obj],

    setup(k, c) {
      const { THREE, up } = k, s = { b: c.src.obj };
      s.d = k.camRight().negate();                                    // spout points to screen-left; beaker hangs on the right
      s.mouthW = k.world(c.dst.obj, c.dst.mouth);
      s.qYaw = new THREE.Quaternion().setFromAxisAngle(up, Math.atan2(-s.d.z, s.d.x));   // spout (+x) -> d
      s.axis = new THREE.Vector3().crossVectors(up, s.d).normalize();
      s.lipL = new THREE.Vector3(c.src.lipR, c.src.lipY, 0);
      s.lipW = s.mouthW.clone().addScaledVector(s.d, -c.dst.mouthR * 0.3).addScaledVector(up, 0.006);
      s.home = k.poseOf(s.b);
      s.floorY = k.world(c.dst.obj, new THREE.Vector3()).y;
      const r = c.src.R + 0.003, h = c.src.H;
      s.hull = []; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; for (const y of [0, h]) s.hull.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
      s.stream = k.fx.stream();
      // level liquid: the inside filled to the rim, cut by a horizontal plane through the axis at the liquid height
      c.src.hideContents && c.src.hideContents(true);
      s.plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
      const inn = c.src.inner, y0 = inn[0][0], pts = [[0.0001, y0]];
      for (let i = 0; i <= 12; i++) { const y = y0 + (inn[inn.length - 1][0] - y0) * i / 12; pts.push([rAt(inn, y) - 0.0003, y]); }
      pts.push([0.0001, inn[inn.length - 1][0]]);
      s.liq = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([rr, y]) => new THREE.Vector2(rr, y)), 40),
        new THREE.MeshStandardMaterial({ color: c.color, transparent: true, opacity: 0.55, roughness: 0.08, depthWrite: false, side: THREE.DoubleSide, clippingPlanes: [s.plane] }));
      s.liq.renderOrder = 2; s.b.add(s.liq);
      s.th = 0;
      return s;
    },

    shot(k, c, s) {
      const look = s.mouthW.clone().addScaledVector(k.up, 0.03).addScaledVector(s.d, -0.03);
      return k.shotAt(look, 0.32, 0.24);
    },

    pose(k, c, s, phase, u, on) {
      const { THREE } = k;
      const at = (th, lift = 0) => {
        const q = new THREE.Quaternion().setFromAxisAngle(s.axis, th).multiply(s.qYaw);
        const o = new THREE.Object3D(); k.placeBy(o, q, s.lipL, s.lipW.clone().addScaledVector(k.up, lift));
        let low = Infinity; for (const p of s.hull) low = Math.min(low, p.clone().applyQuaternion(q).add(o.position).y);
        if (low < s.floorY + 0.006) o.position.y += s.floorY + 0.006 - low;
        return { pos: o.position, quat: o.quaternion };
      };
      const set = P => { s.b.position.copy(P.pos); s.b.quaternion.copy(P.quat); s.b.updateMatrixWorld(true); };
      // level surface: height (above the vessel origin) that holds the real volume at the current tilt
      const level = th => {
        s.liq.visible = c.available() > 0.05;
        s.plane.constant = s.b.position.y + levelAt(c.src.inner, th, c.available());
      };
      // tilt at which that surface reaches the spout (exact for the vessel shape, also when the bottom shows)
      const flowTh = () => flowAngle(c.src.inner, c.src.lipR, c.src.lipY, c.available());

      if (phase === 'intro') { k.blendPose(s.b, s.home, at(Math.max(0, flowTh() - 0.25) * 0.8 * u), u, 0.04); level(Math.max(0, flowTh() - 0.25) * 0.8 * u); s.stream.hide(); return 0; }
      if (phase === 'loop') {
        const f = flowTh(), thOn = Math.min(1.85, f + 0.1) + 0.02 * Math.sin(u * 5.1), thOff = Math.max(0, f - 0.2);
        s.th = thOff + (thOn - thOff) * on;
        set(at(s.th)); level(s.th);
        if (on > 0.85 && c.available() > 0) {
          const lip = k.world(s.b, s.lipL);
          const tgt = k.world(c.dst.obj, new THREE.Vector3(c.dst.mouth.x, c.dst.surfaceY(), c.dst.mouth.z)).addScaledVector(s.d, c.dst.mouthR * 0.15);
          s.stream.set(lip, tgt, 0.0026, c.color, 0.6, s.d);
        } else s.stream.hide();
        return 1;
      }
      // outro
      s.stream.hide();
      if (!s.out) s.out = { th: s.th };
      if (u < 0.36) {
        const v = k.smooth(0, 0.36, u); set(at(s.out.th * (1 - v), 0.006 * v)); level(s.out.th * (1 - v));
        if (!s.dripped && u > 0.1 && c.available() > 0) { s.dripped = true;
          k.fx.fall(k.world(s.b, s.lipL), k.world(c.dst.obj, new THREE.Vector3(c.dst.mouth.x, c.dst.surfaceY(), c.dst.mouth.z)), c.color, 1, { grain: false, spread: 0 }); }
        s.upPose = k.poseOf(s.b);
      } else {
        s.upPose = s.upPose || k.poseOf(s.b);
        k.blendPose(s.b, s.upPose, s.home, k.ease((u - 0.36) / 0.64), 0.03); level(0);
      }
      return 0;
    },

    cleanup(k, c, s) {
      s.stream.dispose(); s.b.remove(s.liq); s.liq.geometry.dispose(); s.liq.material.dispose();
      c.src.hideContents && c.src.hideContents(false);
    },
  });

  /* Liquid in a tipped round vessel. Vessel tipped by th about a horizontal axis, spout (local +x) going down.
     A point (x along the spout side, axial height a) sits at height a*cos(th) - x*sin(th) above the origin.
     Each axial slice is a disk; the part below level Y is a circle segment. */
  const segFrac = d => d >= 1 ? 1 : d <= -1 ? 0 : (Math.PI - Math.acos(d) + d * Math.sqrt(1 - d * d)) / Math.PI;
  function volBelow(inner, th, Y) {               // ml below height Y
    const y0 = inner[0][0], y1 = inner[inner.length - 1][0], n = 48, da = (y1 - y0) / n, c = Math.cos(th), sn = Math.sin(th);
    let v = 0;
    for (let i = 0; i < n; i++) {
      const a = y0 + (i + 0.5) * da, r = rAt(inner, a);
      const f = sn < 1e-4 ? (a * c <= Y ? 1 : 0) : segFrac((Y - a * c) / (r * sn));
      v += Math.PI * r * r * f * da;
    }
    return v * 1e6;
  }
  function levelAt(inner, th, ml) {               // height of the surface (bisection)
    let lo = -0.3, hi = 0.3;
    for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (volBelow(inner, th, m) < ml) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  function flowAngle(inner, lipR, lipY, ml) {    // smallest tilt where the surface reaches the spout tip
    const g = th => levelAt(inner, th, ml) - (lipY * Math.cos(th) - lipR * Math.sin(th));
    if (g(0) >= 0) return 0;
    let lo = 0, hi = 1.9; if (g(hi) < 0) return hi;
    for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (g(m) < 0) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  function rAt(inner, y) {
    if (y <= inner[0][0]) return inner[0][1];
    for (let i = 0; i < inner.length - 1; i++) { const [ya, ra] = inner[i], [yb, rb] = inner[i + 1]; if (y <= yb) return ra + (rb - ra) * ((y - ya) / (yb - ya || 1)); }
    return inner[inner.length - 1][1];
  }
})();
