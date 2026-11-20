/* ACTIONS: syringe 10 ml (+ optional 0.22 µm syringe filter) — DRAW and DISPENSE. Close-up clips.
   DRAW ('syringeDraw')     (normally WITHOUT the filter: draw first, then attach it — the app's tip)
     intro  syringe upright over the source, luer tip goes ~8 mm into the liquid
     loop   plunger pulled up (it follows the volume), liquid fills the barrel (live amount)
     outro  tip out, syringe goes home
   DISPENSE ('syringeDispense')
     no filter : luer tip on the target's inner wall, plunger pushed, liquid runs down the wall (2 ml/s)
     filter    : filter outlet held inside the mouth (not touching), plunger pushed HARDER/slower, liquid comes
                 out of the filter in quick drops (filtration ~0.5 ml/s)
     outro  away from the vessel, home
   Context c:
     tool = { obj (syringe item; model upright), tipY (luer tip -0.012, or the filter outlet with a filter),
              filter (bool), cap (ml), have() (ml inside) }  — the plunger is moved by the host (it.onLevel).
     src / dst = vessel { obj, mouth, mouthR, surfaceY(), floorY? }.  color, available(), room(), onAmount(ml)
   Typical technique; owner to confirm. */
(function () {
  const C = window.CLIPS;

  function setP(o, P) { o.position.copy(P.pos); o.quaternion.copy(P.quat); o.updateMatrixWorld(true); }
  function surfW(k, v) { return k.world(v.obj, new k.THREE.Vector3(v.mouth.x, v.surfaceY(), v.mouth.z)); }
  function common(k, c, s, v) {
    const { THREE } = k;
    s.o = c.tool.obj; s.home = k.poseOf(s.o);
    s.qUp = new THREE.Quaternion().setFromAxisAngle(k.up, Math.atan2(-k.camRight().z, k.camRight().x));   // scale (+z) towards the camera
    s.mouthW = k.world(v.obj, v.mouth); s.d = k.camRight().negate();
  }
  function at(k, c, s, P, lean = 0) {
    const { THREE } = k; let q = s.qUp.clone();
    if (lean) { const ax = new THREE.Vector3().crossVectors(k.up, s.d).normalize(); q = new THREE.Quaternion().setFromAxisAngle(ax, -lean).multiply(q); }
    const o = new THREE.Object3D(); k.placeBy(o, q, new THREE.Vector3(0, c.tool.tipY, 0), P); return { pos: o.position.clone(), quat: o.quaternion.clone() };
  }

  C.register('syringeDraw', {
    label: 'Syringe: draw', unit: 'ml', intro: 1.3, outro: 1.1, minLoop: 1.5, maxLoop: 5,
    rate: () => 2,                                        // ml/s while pulling the plunger
    moves: c => [c.tool.obj],
    setup(k, c) {
      const s = {}; common(k, c, s, c.src);
      const sy = surfW(k, c.src).y, floor = c.src.floorY != null ? k.world(c.src.obj, new k.THREE.Vector3(0, c.src.floorY, 0)).y : sy - 0.05;
      s.hover = s.mouthW.clone().setY(Math.max(s.mouthW.y, sy) + 0.015);
      s.tipIn = s.mouthW.clone().setY(sy - Math.max(0.002, Math.min(0.008, sy - floor - 0.003)));
      return s;
    },
    shot(k, c, s) { return k.shotAt(s.tipIn.clone().add(new k.THREE.Vector3(0, 0.05, 0)), 0.26, 0.18); },
    pose(k, c, s, phase, u) {
      if (phase === 'intro') {
        if (u < 0.65) k.blendPose(s.o, s.home, at(k, c, s, s.hover), k.smooth(0, 0.65, u), 0.04);
        else k.blendPose(s.o, at(k, c, s, s.hover), at(k, c, s, s.tipIn), k.smooth(0.65, 1, u));
        return 0;
      }
      if (phase === 'loop') { setP(s.o, at(k, c, s, s.tipIn)); return 1; }
      if (u < 0.3) k.blendPose(s.o, at(k, c, s, s.tipIn), at(k, c, s, s.hover), k.smooth(0, 0.3, u));
      else k.blendPose(s.o, at(k, c, s, s.hover), s.home, k.ease(k.smooth(0.3, 1, u)), 0.04);
      return 0;
    },
  });

  C.register('syringeDispense', {
    label: 'Syringe: dispense (filter optional)', unit: 'ml', intro: 1.2, outro: 1.1, minLoop: 2, maxLoop: 8,
    rate: c => c.tool.filter ? 0.5 : 2,                   // pushing through a 0.22 µm filter is much slower
    moves: c => [c.tool.obj],
    setup(k, c) {
      const { THREE } = k, s = {}; common(k, c, s, c.dst);
      const sy = surfW(k, c.dst).y;
      if (c.tool.filter) { s.tipP = s.mouthW.clone().setY(Math.max(sy + 0.006, s.mouthW.y - 0.004)); s.lean = 0; }
      else { s.tipP = s.mouthW.clone().addScaledVector(s.d, c.dst.mouthR - 0.0015).setY(Math.max(sy + 0.004, s.mouthW.y - 0.01)); s.lean = 0.2; }
      s.hover = s.tipP.clone().addScaledVector(s.d, s.lean ? -c.dst.mouthR * 0.5 : 0).setY(s.mouthW.y + 0.02);
      s.film = k.fx.stream(); s.acc = 0;
      return s;
    },
    shot(k, c, s) { return k.shotAt(s.tipP.clone().add(new k.THREE.Vector3(0, 0.035, 0)), 0.26, 0.2); },
    pose(k, c, s, phase, u, on) {
      if (phase === 'intro') {
        if (u < 0.6) k.blendPose(s.o, s.home, at(k, c, s, s.hover, s.lean), k.smooth(0, 0.6, u), 0.04);
        else k.blendPose(s.o, at(k, c, s, s.hover, s.lean), at(k, c, s, s.tipP, s.lean), k.smooth(0.6, 1, u));
        return 0;
      }
      if (phase === 'loop') {
        setP(s.o, at(k, c, s, s.tipP, s.lean));
        if (!c.tool.filter && on > 0.85 && c.available() > 0) {   // runs down the wall
          const top = s.tipP.clone(), bot = surfW(k, c.dst).setX(top.x).setZ(top.z);
          s.film.setPath([top, top.clone().lerp(bot, 0.5), bot], 0.0011, c.color, 0.5);
        } else s.film.hide();
        return 1;
      }
      s.film.hide();
      if (u < 0.3) k.blendPose(s.o, at(k, c, s, s.tipP, s.lean), at(k, c, s, s.hover, s.lean), k.smooth(0, 0.3, u));
      else k.blendPose(s.o, at(k, c, s, s.hover, s.lean), s.home, k.ease(k.smooth(0.3, 1, u)), 0.04);
      return 0;
    },
    emit(k, c, s, amt) {                                  // with a filter: quick drops from the outlet (~0.03 ml each)
      if (!c.tool.filter) return;
      s.acc += amt;
      while (s.acc >= 0.03) { s.acc -= 0.03; k.fx.fall(k.world(s.o, new k.THREE.Vector3(0, c.tool.tipY, 0)), surfW(k, c.dst), c.color, 1, { grain: false, spread: 0 }); }
    },
    cleanup(k, c, s) { s.film.dispose(); },
  });
})();
