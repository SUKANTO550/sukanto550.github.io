/* ACTIONS: graduated glass pipette with a pipette pump — DRAW and DISPENSE (two clips, like the app:
   draw at the source, carry the pipette, dispense at the target). Close-up clips (actions/player.js).
   DRAW ('pipetteDraw')
     intro  pipette (pump on top) comes upright over the source, tip goes ~1 cm under the surface
     loop   thumb wheel rolls UP: wheel turns, pump plunger rises, liquid climbs the scale (live amount)
     outro  tip lifted out, touched on the inner wall (removes the hanging drop), pipette goes home
   DISPENSE ('pipetteDispense')
     intro  pipette comes to the target, tip touching the inner wall below the rim (top leaning in a little)
     loop   wheel rolls DOWN: liquid runs out along the wall, level drops on the scale
     outro  tip held on the wall a moment, then withdrawn, pipette goes home
     c.drops = true: dropwise instead — tip held over the mouth centre, drops fall (~0.05 ml, ~3 per second)
   Camera follows the meniscus so the scale stays in view.
   Context c:
     tool = { obj (pipette item; the model's local frame: upright, tip end at y = tipY), tipY (-0.03),
              levelY(ml) (local y of the meniscus), cap (ml), have() (ml inside), pump? { plunger, wheel } }
     src / dst = vessel { obj, mouth (local), mouthR, surfaceY(), floorY? (local inner floor) }
     draw: src = vessel; dispense: dst = vessel.  color, available(), room(), onAmount(ml)
   Pump on the pipette (equipment/tools.js E.pipettePumpUp) is a child of tool.obj (moves with it).
   Typical technique; owner to confirm (e.g. "Ex + 5 s" wait after draining is not forced). */
(function () {
  const C = window.CLIPS;
  const DIP = 0.01, PLUNGER_PER_ML = 0.004;

  // shared: pose the pipette so its tip end is at world point P, tilted `lean` rad (top leaning towards -w)
  function tipPose(k, c, s, P, lean = 0, w = null) {
    const { THREE } = k;
    let q = s.qUp.clone();
    if (lean && w) { const ax = new THREE.Vector3().crossVectors(k.up, w).normalize(); q = new THREE.Quaternion().setFromAxisAngle(ax, -lean).multiply(q); }
    const o = new THREE.Object3D(); k.placeBy(o, q, new THREE.Vector3(0, c.tool.tipY, 0), P);
    return { pos: o.position.clone(), quat: o.quaternion.clone() };
  }
  function setP(o, P) { o.position.copy(P.pos); o.quaternion.copy(P.quat); o.updateMatrixWorld(true); }
  function surfW(k, v) { return k.world(v.obj, new k.THREE.Vector3(v.mouth.x, v.surfaceY(), v.mouth.z)); }
  function pumpTick(c, s, dt, dir) {                    // wheel turns, plunger follows the volume inside
    if (!c.tool.pump) return;
    c.tool.pump.wheel.rotation.z += dir * dt * 7;
    c.tool.pump.plunger.position.y = Math.min(0.045, PLUNGER_PER_ML * c.tool.have());
  }
  function setupCommon(k, c, s, v) {
    const { THREE } = k;
    s.p = c.tool.obj; s.home = k.poseOf(s.p);
    s.qUp = new THREE.Quaternion().setFromAxisAngle(k.up, Math.atan2(-k.camRight().z, k.camRight().x));   // upright, print (+z) towards the camera
    s.mouthW = k.world(v.obj, v.mouth); s.back = k.camBack();
    s.d = k.camRight().negate();
  }
  function camFollow(k, c, s, tipW) {                  // keep tip and meniscus in view
    const men = tipW.clone().add(new k.THREE.Vector3(0, c.tool.levelY(c.tool.have()) - c.tool.tipY, 0));
    const look = tipW.clone().lerp(men, 0.5), span = Math.max(0.05, men.y - tipW.y);
    const dist = Math.max(0.2, span * 1.6);
    return { look, eye: look.clone().addScaledVector(s.back, dist * Math.cos(0.18)).add(new k.THREE.Vector3(0, dist * Math.sin(0.18), 0)) };
  }

  C.register('pipetteDraw', {
    label: 'Graduated pipette (pump): draw', unit: 'ml',
    intro: 1.4, outro: 1.4, minLoop: 2, maxLoop: 6,
    rate: c => Math.max(0.3, c.tool.cap * 0.15),          // 10 ml pipette: 1.5 ml/s while the wheel rolls
    moves: c => [c.tool.obj],
    setup(k, c) {
      const s = {}; setupCommon(k, c, s, c.src);
      const sy = surfW(k, c.src).y, floor = c.src.floorY != null ? k.world(c.src.obj, new k.THREE.Vector3(0, c.src.floorY, 0)).y : sy - 0.05;
      const dip = Math.max(0.002, Math.min(DIP, sy - floor - 0.004));
      s.tipIn = s.mouthW.clone().setY(sy - dip);
      s.hover = s.mouthW.clone().setY(Math.max(s.mouthW.y, sy) + 0.02);
      s.wallW = s.mouthW.clone().addScaledVector(s.d, c.src.mouthR * 0.8).setY(Math.min(s.mouthW.y - 0.006, sy + 0.012));
      return s;
    },
    shot(k, c, s) { return camFollow(k, c, s, s.tipIn); },
    camAt(k, c, s) { return camFollow(k, c, s, s.tipIn); },
    pose(k, c, s, phase, u, on) {
      if (phase === 'intro') {
        if (u < 0.65) k.blendPose(s.p, s.home, tipPose(k, c, s, s.hover), k.smooth(0, 0.65, u), 0.04);
        else k.blendPose(s.p, tipPose(k, c, s, s.hover), tipPose(k, c, s, s.tipIn), k.smooth(0.65, 1, u));
        return 0;
      }
      if (phase === 'loop') { setP(s.p, tipPose(k, c, s, s.tipIn)); pumpTick(c, s, 1 / 60 * on, 1); return 1; }
      // outro: out of the liquid, touch the inner wall, home
      if (!s.o) s.o = { up: tipPose(k, c, s, s.tipIn.clone().setY(s.wallW.y)), wall: tipPose(k, c, s, s.wallW, 0.12, s.d) };
      if (u < 0.25) k.blendPose(s.p, tipPose(k, c, s, s.tipIn), s.o.up, k.smooth(0, 0.25, u));
      else if (u < 0.42) k.blendPose(s.p, s.o.up, s.o.wall, k.smooth(0.25, 0.42, u));
      else if (u < 0.52) setP(s.p, s.o.wall);
      else k.blendPose(s.p, s.o.wall, s.home, k.ease(k.smooth(0.52, 1, u)), 0.04);
      return 0;
    },
  });

  // c.drops = true (protocol run, e.g. acetic acid "dropwise"): pipette held upright over the mouth centre,
  // the wheel turned slowly, one drop per DROP ml falls from the tip (no wall contact)
  const DROP = 0.05;
  C.register('pipetteDispense', {
    label: 'Graduated pipette (pump): dispense', unit: 'ml',
    intro: 1.3, outro: 1.3, minLoop: 2, maxLoop: 9,
    rate: c => c.drops ? DROP * 3 : Math.max(0.2, c.tool.cap * 0.08),   // 10 ml pipette drains ~0.8 ml/s; drops ~3 per second
    moves: c => [c.tool.obj],
    setup(k, c) {
      const { THREE } = k, s = {}; setupCommon(k, c, s, c.dst);
      if (c.drops) { s.tipP = s.mouthW.clone().add(new THREE.Vector3(0, 0.008, 0)); s.acc = 0; return s; }
      s.axisW = s.mouthW.clone();
      // tip on the inner wall (screen-left side), 12 mm below the rim, above the liquid
      const sy = surfW(k, c.dst).y;
      s.tipWall = s.mouthW.clone().addScaledVector(s.d, c.dst.mouthR - 0.0012).setY(Math.max(sy + 0.004, s.mouthW.y - 0.012));
      s.hover = s.tipWall.clone().addScaledVector(s.d, -c.dst.mouthR * 0.6).setY(s.mouthW.y + 0.02);
      s.film = k.fx.stream();
      return s;
    },
    shot(k, c, s) { return camFollow(k, c, s, c.drops ? s.tipP : s.tipWall); },
    camAt(k, c, s) { return camFollow(k, c, s, c.drops ? s.tipP : s.tipWall); },
    pose(k, c, s, phase, u, on) {
      if (c.drops) {
        const up = () => tipPose(k, c, s, s.tipP.clone().add(new k.THREE.Vector3(0, 0.03, 0)));
        if (phase === 'intro') { k.blendPose(s.p, s.home, tipPose(k, c, s, s.tipP), u, 0.04); return 0; }
        if (phase === 'loop') { setP(s.p, tipPose(k, c, s, s.tipP)); pumpTick(c, s, 1 / 60 * on, -0.4); return 1; }
        if (u < 0.3) k.blendPose(s.p, tipPose(k, c, s, s.tipP), up(), k.smooth(0, 0.3, u));
        else k.blendPose(s.p, up(), s.home, k.ease(k.smooth(0.3, 1, u)), 0.04);
        return 0;
      }
      const { THREE } = k, wall = () => tipPose(k, c, s, s.tipWall, 0.22, s.d);
      if (phase === 'intro') {
        if (u < 0.6) k.blendPose(s.p, s.home, tipPose(k, c, s, s.hover, 0.22, s.d), k.smooth(0, 0.6, u), 0.04);
        else k.blendPose(s.p, tipPose(k, c, s, s.hover, 0.22, s.d), wall(), k.smooth(0.6, 1, u));
        return 0;
      }
      if (phase === 'loop') {
        setP(s.p, wall()); pumpTick(c, s, 1 / 60 * on, -1);
        if (on > 0.85 && c.available() > 0) {              // liquid runs down the inner wall
          const top = s.tipWall.clone(), bot = surfW(k, c.dst).setX(top.x).setZ(top.z);
          s.film.setPath([top, top.clone().lerp(bot, 0.5), bot], 0.0009, c.color, 0.5);
        } else s.film.hide();
        return 1;
      }
      s.film.hide();
      if (u < 0.3) setP(s.p, wall());                      // touch-off on the wall
      else k.blendPose(s.p, wall(), s.home, k.ease(k.smooth(0.3, 1, u)), 0.05);
      return 0;
    },
    emit(k, c, s, amt) {                                  // drop mode: one visible drop per DROP ml
      if (!c.drops) return;
      s.acc += amt;
      while (s.acc >= DROP * 0.999) { s.acc -= DROP;
        k.fx.fall(k.world(s.p, new k.THREE.Vector3(0, c.tool.tipY, 0)), surfW(k, c.dst), c.color, 1, { grain: false, spread: 0 }); }
    },
    cleanup(k, c, s) { if (s.film) s.film.dispose(); },
  });
})();
