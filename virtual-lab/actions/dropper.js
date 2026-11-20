/* ACTIONS: dropper (Pasteur pipette + rubber bulb) — DRAW and DISPENSE. Close-up clips (actions/player.js).
   DRAW ('dropperDraw')
     intro  dropper upright over the source; bulb SQUEEZED while still above the liquid; tip goes ~8 mm in
     loop   bulb is let go slowly: it swells back, liquid rises in the body (live amount)
     outro  tip lifted out, dropper goes home
   DISPENSE ('dropperDispense')
     intro  tip held over the target mouth (not touching anything)
     loop   gentle squeeze: drops fall one by one (~0.05 ml each, ~3 per second), counted live
     outro  bulb kept squeezed while the tip comes out (no suck-back), let go away from the vessel, home
   Context c:
     tool = { obj (dropper item; model upright, tip end y = tipY), tipY (-0.05), bulb (group to squeeze),
              cap (ml), have() (ml inside) }
     src / dst = vessel { obj, mouth, mouthR, surfaceY(), floorY? }.  color, available(), room(), onAmount(ml)
   Typical technique; owner to confirm. */
(function () {
  const C = window.CLIPS;
  const DROP = 0.05;

  function setP(o, P) { o.position.copy(P.pos); o.quaternion.copy(P.quat); o.updateMatrixWorld(true); }
  function surfW(k, v) { return k.world(v.obj, new k.THREE.Vector3(v.mouth.x, v.surfaceY(), v.mouth.z)); }
  function common(k, c, s, v) {
    const { THREE } = k;
    s.o = c.tool.obj; s.home = k.poseOf(s.o); s.b = c.tool.bulb; s.b0 = s.b ? s.b.scale.clone() : null;
    s.qUp = new THREE.Quaternion().setFromAxisAngle(k.up, Math.atan2(-k.camRight().z, k.camRight().x));
    s.mouthW = k.world(v.obj, v.mouth);
  }
  function at(k, c, s, P) { const o = new k.THREE.Object3D(); k.placeBy(o, s.qUp, new k.THREE.Vector3(0, c.tool.tipY, 0), P); return { pos: o.position.clone(), quat: o.quaternion.clone() }; }
  function squeeze(s, v) { s.sq = v; if (s.b) s.b.scale.set(s.b0.x * (1 - 0.32 * v), s.b0.y * (1 + 0.04 * v), s.b0.z * (1 - 0.32 * v)); }

  C.register('dropperDraw', {
    label: 'Dropper: draw', unit: 'ml', intro: 1.4, outro: 1.1, minLoop: 1.5, maxLoop: 4,
    rate: c => Math.max(0.2, c.tool.cap * 0.3),          // 2 ml dropper fills at ~0.6 ml/s as the bulb swells
    moves: c => [c.tool.obj],
    setup(k, c) {
      const s = {}; common(k, c, s, c.src);
      const sy = surfW(k, c.src).y, floor = c.src.floorY != null ? k.world(c.src.obj, new k.THREE.Vector3(0, c.src.floorY, 0)).y : sy - 0.05;
      s.hover = s.mouthW.clone().setY(Math.max(s.mouthW.y, sy) + 0.015);
      s.tipIn = s.mouthW.clone().setY(sy - Math.max(0.002, Math.min(0.008, sy - floor - 0.003)));
      s.start = c.tool.have(); s.sq = 0;
      return s;
    },
    shot(k, c, s) { return k.shotAt(s.tipIn.clone().add(new k.THREE.Vector3(0, 0.04, 0)), 0.22, 0.2); },
    pose(k, c, s, phase, u, on) {
      if (phase === 'intro') {
        if (u < 0.6) k.blendPose(s.o, s.home, at(k, c, s, s.hover), k.smooth(0, 0.6, u), 0.04);
        else k.blendPose(s.o, at(k, c, s, s.hover), at(k, c, s, s.tipIn), k.smooth(0.75, 1, u));
        squeeze(s, k.smooth(0.55, 0.75, u));             // squeeze ABOVE the liquid, then dip
        return 0;
      }
      if (phase === 'loop') {
        setP(s.o, at(k, c, s, s.tipIn));
        const room = Math.max(1e-6, c.tool.cap - s.start);
        squeeze(s, Math.max(0, 1 - (c.tool.have() - s.start) / room));   // bulb swells back as liquid comes in
        return 1;
      }
      if (!s.out) s.out = { sq: s.sq, p: at(k, c, s, s.tipIn) };
      if (u < 0.3) k.blendPose(s.o, s.out.p, at(k, c, s, s.hover), k.smooth(0, 0.3, u));
      else k.blendPose(s.o, at(k, c, s, s.hover), s.home, k.ease(k.smooth(0.3, 1, u)), 0.04);
      squeeze(s, s.out.sq * (1 - k.smooth(0.3, 0.6, u)));
      return 0;
    },
    cleanup(k, c, s) { if (s.b) s.b.scale.copy(s.b0); },
  });

  C.register('dropperDispense', {
    label: 'Dropper: dispense (drops)', unit: 'ml', intro: 1.1, outro: 1.1, minLoop: 1.5, maxLoop: 8,
    rate: () => DROP * 3,                                 // ~3 drops per second
    moves: c => [c.tool.obj],
    setup(k, c) {
      const s = {}; common(k, c, s, c.dst);
      s.tipP = s.mouthW.clone().add(new k.THREE.Vector3(0, 0.008, 0));
      s.start = Math.max(1e-6, c.tool.have()); s.acc = 0; s.drops = 0; s.sq = 0;
      return s;
    },
    shot(k, c, s) { return k.shotAt(s.tipP.clone().add(new k.THREE.Vector3(0, 0.0, 0)), 0.22, 0.25); },
    pose(k, c, s, phase, u, on) {
      if (phase === 'intro') { k.blendPose(s.o, s.home, at(k, c, s, s.tipP), u, 0.04); squeeze(s, 0); return 0; }
      if (phase === 'loop') {
        setP(s.o, at(k, c, s, s.tipP));
        squeeze(s, Math.min(1, (1 - c.tool.have() / s.start) * 0.85 + 0.15 * on));
        return 1;
      }
      if (!s.out) s.out = { sq: s.sq };
      const up = s.tipP.clone().add(new k.THREE.Vector3(0, 0.03, 0));
      if (u < 0.3) k.blendPose(s.o, at(k, c, s, s.tipP), at(k, c, s, up), k.smooth(0, 0.3, u));
      else k.blendPose(s.o, at(k, c, s, up), s.home, k.ease(k.smooth(0.3, 1, u)), 0.04);
      squeeze(s, s.out.sq * (1 - k.smooth(0.35, 0.6, u)));   // let go only once away from the vessel
      return 0;
    },
    emit(k, c, s, amt) {                                  // one visible drop per 0.05 ml
      s.acc += amt;
      while (s.acc >= DROP * 0.999) { s.acc -= DROP; s.drops++;
        k.fx.fall(k.world(s.o, new k.THREE.Vector3(0, c.tool.tipY, 0)), surfW(k, c.dst), c.color, 1, { grain: false, spread: 0 }); }
      c.onDrops && c.onDrops(s.drops);
    },
    cleanup(k, c, s) { if (s.b) s.b.scale.copy(s.b0); },
  });
})();
