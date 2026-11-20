/* ACTION: squirt solvent from a wash bottle into a beaker / jar (adding solvent).
   Close-up clip (actions/player.js).
     intro  bottle lifts beside the vessel, tilts so the nozzle points down over the mouth
     loop   bottle is squeezed (body pinches in); a thin jet leaves the nozzle STRAIGHT along it (ballistic:
            ~1.8 m/s + gravity, so it barely curves), hits the far inner wall and runs straight down the wall
            into the liquid. The bottle angle is solved so the jet lands there. Released = springs back, jet stops.
     outro  squeeze released (last drop from the nozzle), bottle goes home
   Context c:
     src = { obj (wash bottle, nozzle along local +x), tip (local Vector3, nozzle end), body? (mesh that pinches),
             bodyR?, height?, start (ml) }
     dst = { obj, mouth (local Vector3), mouthR, surfaceY() }
     color, available(), room(), onAmount(ml)
   Claude default (owner to confirm): the jet is aimed at the inner wall so it runs down (no splashing). */
(function () {
  const C = window.CLIPS;

  C.register('washBottle', {
    label: 'Wash bottle → beaker / jar (squirt)', unit: 'ml',
    intro: 1.0, outro: 1.0, minLoop: 2, maxLoop: 6,
    rate: () => 3,                       // ml/s (same as the app's wash-bottle squirt)
    moves: c => [c.src.obj],

    setup(k, c) {
      const { THREE, up } = k, s = { b: c.src.obj };
      s.d = k.camRight().negate();                                    // nozzle points to screen-left; bottle stands on the right
      s.mouthW = k.world(c.dst.obj, c.dst.mouth);
      s.qYaw = new THREE.Quaternion().setFromAxisAngle(up, Math.atan2(-s.d.z, s.d.x));   // local +x (nozzle) -> d
      s.axis = new THREE.Vector3().crossVectors(up, s.d).normalize();
      s.tipL = c.src.tip.clone();
      s.tipW = s.mouthW.clone().addScaledVector(s.d, -c.dst.mouthR * 0.55).addScaledVector(up, 0.014);
      s.home = k.poseOf(s.b);
      s.floorY = k.world(c.dst.obj, new THREE.Vector3()).y;
      const r = c.src.bodyR || 0.036, h = c.src.height || 0.13;
      s.hull = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; for (const y of [0, h * 0.85]) s.hull.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
      s.axisW = k.world(c.dst.obj, new THREE.Vector3(c.dst.mouth.x, 0, c.dst.mouth.z));
      // aim: far inner wall, a third of the way from the rim down to the liquid
      const surfY = () => k.world(c.dst.obj, new THREE.Vector3(0, c.dst.surfaceY(), 0)).y;
      const aimAt = () => s.mouthW.clone().addScaledVector(s.d, c.dst.mouthR * 0.97).setY(s.mouthW.y - (s.mouthW.y - surfY()) * 0.33);
      // tilt so the ballistic jet passes the aim point; the bottle must also stay above the bench (else hold it higher)
      for (let pass = 0; pass < 3; pass++) {
        s.TH = solveTilt(k, s, aimAt());
        const lift = benchLift(k, s, s.TH);
        if (lift <= 1e-5) break;
        s.tipW.y += lift;
      }
      s.jet = k.fx.stream(); s.run = k.fx.stream();
      s.body = c.src.body || null; s.body0 = s.body ? s.body.scale.clone() : null;
      s.sq = 0;
      return s;
    },

    shot(k, c, s) {
      const look = s.mouthW.clone().addScaledVector(k.up, 0.02).addScaledVector(s.d, -0.02);
      return k.shotAt(look, 0.3, 0.32);
    },

    pose(k, c, s, phase, u, on) {
      const { THREE } = k;
      const at = (th, lift = 0) => {
        const q = new THREE.Quaternion().setFromAxisAngle(s.axis, th).multiply(s.qYaw);
        const o = new THREE.Object3D(); k.placeBy(o, q, s.tipL, s.tipW.clone().addScaledVector(k.up, lift));
        let low = Infinity; for (const p of s.hull) low = Math.min(low, p.clone().applyQuaternion(q).add(o.position).y);
        if (low < s.floorY + 0.006) o.position.y += s.floorY + 0.006 - low;
        return { pos: o.position, quat: o.quaternion };
      };
      const set = P => { s.b.position.copy(P.pos); s.b.quaternion.copy(P.quat); s.b.updateMatrixWorld(true); };
      const squeeze = v => { s.sq = v; if (s.body) s.body.scale.set(s.body0.x * (1 - 0.07 * v), s.body0.y, s.body0.z * (1 - 0.07 * v)); };
      const TH = s.TH;

      if (phase === 'intro') { k.blendPose(s.b, s.home, at(TH), u, 0.04); squeeze(0); return 0; }
      if (phase === 'loop') {
        set(at(TH + 0.04 * on));
        squeeze(on * (0.85 + 0.15 * Math.sin(u * 7)));                 // steady squeeze with a little hand pulse
        if (on > 0.85 && c.available() > 0) {
          const path = jetPath(k, s, c, k.world(s.b, s.tipL), nozzleDir(k, s.b.quaternion));
          s.jet.setPath(path.pts, 0.0011, c.color, 0.7);
          if (path.wall) {                                            // film runs straight down the wall
            const hit = path.pts[path.pts.length - 1], sy = k.world(c.dst.obj, new THREE.Vector3(0, c.dst.surfaceY(), 0)).y;
            const inward = s.axisW.clone().setY(hit.y).sub(hit).normalize().multiplyScalar(0.0008);
            s.run.setPath([hit.clone().add(inward), hit.clone().add(inward).setY((hit.y + sy) / 2), hit.clone().add(inward).setY(sy)], 0.0007, c.color, 0.45);
          } else s.run.hide();
        } else { s.jet.hide(); s.run.hide(); }
        return 1;
      }
      // outro: let go (bottle springs back), last drop, home
      s.jet.hide(); s.run.hide();
      if (!s.out) s.out = { sq: s.sq, pose: k.poseOf(s.b) };
      squeeze(s.out.sq * (1 - k.smooth(0, 0.25, u)));
      if (!s.dripped && u > 0.1) { s.dripped = true; const tip = k.world(s.b, s.tipL);
        k.fx.fall(tip, k.world(c.dst.obj, new THREE.Vector3(c.dst.mouth.x, c.dst.surfaceY(), c.dst.mouth.z)).addScaledVector(s.d, -c.dst.mouthR * 0.4), c.color, 1, { grain: false, spread: 0 }); }
      if (u < 0.3) set(s.out.pose);
      else k.blendPose(s.b, s.out.pose, s.home, k.ease((u - 0.3) / 0.7), 0.03);
      return 0;
    },

    cleanup(k, c, s) { s.jet.dispose(); s.run.dispose(); if (s.body) s.body.scale.copy(s.body0); },
  });

  const V0 = 1.8, G = 9.81;
  function nozzleDir(k, q) { return new k.THREE.Vector3(1, -1, 0).normalize().applyQuaternion(q); }   // nozzle exit direction (model)
  function quatAt(k, s, th) { return new k.THREE.Quaternion().setFromAxisAngle(s.axis, th).multiply(s.qYaw); }
  // height of the jet when it has travelled (horizontally, along d) as far as point P
  function jetYAt(k, s, th, P) {
    const n = nozzleDir(k, quatAt(k, s, th)), nh = n.dot(s.d), D = P.clone().sub(s.tipW).dot(s.d);
    if (nh <= 1e-3) return -Infinity;
    const t = D / (V0 * nh); return s.tipW.y + V0 * n.y * t - 0.5 * G * t * t;
  }
  function solveTilt(k, s, P) {                     // more tilt = jet goes lower; bisection
    let lo = -0.7, hi = 0.75;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (jetYAt(k, s, m, P) > P.y) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  function benchLift(k, s, th) {
    const q = quatAt(k, s, th), o = new k.THREE.Object3D(); k.placeBy(o, q, s.tipL, s.tipW);
    let low = Infinity; for (const p of s.hull) low = Math.min(low, p.clone().applyQuaternion(q).add(o.position).y);
    return Math.max(0, s.floorY + 0.006 - low);
  }
  // sample the ballistic jet until it meets the inner wall or the liquid surface
  function jetPath(k, s, c, tip, n) {
    const pts = [tip.clone()], R = c.dst.mouthR * 0.97, sy = k.world(c.dst.obj, new k.THREE.Vector3(0, c.dst.surfaceY(), 0)).y;
    for (let i = 1; i <= 60; i++) {
      const t = i * 0.0012, p = tip.clone().addScaledVector(n, V0 * t); p.y -= 0.5 * G * t * t;
      const hr = Math.hypot(p.x - s.axisW.x, p.z - s.axisW.z);
      if (p.y <= sy) { pts.push(p.setY(sy)); return { pts, wall: false }; }
      if (hr >= R && p.y < s.mouthW.y) { pts.push(p); return { pts, wall: true }; }
      pts.push(p);
    }
    return { pts, wall: false };
  }
})();
