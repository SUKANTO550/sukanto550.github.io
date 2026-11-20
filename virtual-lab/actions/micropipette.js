/* ACTIONS: micropipette — DRAW and DISPENSE. Step clips (noLoop): the amount is the set volume on the counter,
   so hold / set-amount do not apply (Skip still works). Liquid is shown inside the tip.
   DRAW ('micropipetteDraw')            (standard forward pipetting; owner to confirm)
     comes upright over the source -> plunger pressed to the FIRST stop (above the liquid) -> tip ~3 mm under
     the surface -> plunger released SLOWLY (liquid rises in the tip) -> short wait -> straight up out -> home
   DISPENSE ('micropipetteDispense')
     tip on the target's inner wall (pipette ~20 deg) -> pressed slowly to the FIRST stop (liquid out, runs down
     the wall) -> pause -> SECOND stop (blow-out) -> slid up the wall and out while held -> plunger released -> home
   Context c:
     tool = { obj (micropipette item; model upright, nose at y ~ 0), it (EQUIP.micropipette item: setPlunger(d),
              tipBottom, tipMesh), vol (ml = set volume), have() (ml in the tip) }
     src / dst = vessel { obj, mouth, mouthR, surfaceY() }.  color, onAmount(ml)               */
(function () {
  const C = window.CLIPS;
  const FIRST = 0.007, SECOND = 0.0105;

  function setP(o, P) { o.position.copy(P.pos); o.quaternion.copy(P.quat); o.updateMatrixWorld(true); }
  function surfW(k, v) { return k.world(v.obj, new k.THREE.Vector3(v.mouth.x, v.surfaceY(), v.mouth.z)); }
  function common(k, c, s, v) {
    const { THREE } = k;
    s.m = c.tool.obj; s.it = c.tool.it; s.home = k.poseOf(s.m);
    s.qUp = new THREE.Quaternion().setFromAxisAngle(k.up, Math.atan2(-k.camRight().z, k.camRight().x));   // counter (+z) towards the camera
    s.mouthW = k.world(v.obj, v.mouth); s.d = k.camRight().negate();
    s.tipEnd = new THREE.Vector3(0, s.it.tipBottom + (c.tool.yOff || 0), 0);   // yOff: model offset inside tool.obj (lab: lift of the upright pose)
    s.liq = makeTipLiquid(k, s.it, c.color); s.liqTab = tipTable(s.it);
    s.shown = 0;
  }
  function pose(k, s, P, lean = 0) {
    const { THREE } = k; let q = s.qUp.clone();
    if (lean) { const ax = new THREE.Vector3().crossVectors(k.up, s.d).normalize(); q = new THREE.Quaternion().setFromAxisAngle(ax, -lean).multiply(q); }
    const o = new THREE.Object3D(); k.placeBy(o, q, s.tipEnd, P); return { pos: o.position.clone(), quat: o.quaternion.clone() };
  }
  // liquid inside the tip: lathe of the tip's inside up to the height that holds `ml`
  const TIP = big => big ? [[0.0005, -0.046], [0.0009, -0.0445], [0.0029, 0.0], [0.0034, 0.0045], [0.0037, 0.0085]] : [[0.0005, -0.03], [0.0009, -0.0285], [0.0029, 0.0], [0.0034, 0.0045], [0.0037, 0.0085]];
  function rIn(prof, y) { for (let i = 0; i < prof.length - 1; i++) { const [ra, ya] = prof[i], [rb, yb] = prof[i + 1]; if (y <= yb) return Math.max(0.0002, ra + (rb - ra) * (y - ya) / (yb - ya) - 0.0003); } return prof[prof.length - 1][0] - 0.0003; }
  function tipTable(it) {
    const prof = TIP(it.tipBottom < -0.04), y0 = prof[0][1] + 0.0004, y1 = prof[prof.length - 1][1], n = 80, dy = (y1 - y0) / n, t = [[y0, 0]]; let v = 0;
    for (let i = 1; i <= n; i++) { const y = y0 + i * dy, r = rIn(prof, y - dy / 2); v += Math.PI * r * r * dy * 1e6; t.push([y, v]); }
    return { prof, t };
  }
  function makeTipLiquid(k, it, color) {
    const m = new k.THREE.Mesh(new k.THREE.BufferGeometry(), new k.THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.88, roughness: 0.1, depthWrite: false }));
    m.renderOrder = 4; m.visible = false; it.tipMesh.parent.add(m); return m;   // drawn after the tinted tip, so it reads clearly
  }
  function showTip(k, s, ml) {
    if (Math.abs(ml - s.shown) < 1e-5 && s.liq.geometry.attributes.position) return; s.shown = ml;
    const { prof, t } = s.liqTab; let h = t[0][0];
    if (ml <= 1e-6) { s.liq.visible = false; return; }
    for (let i = 1; i < t.length; i++) { h = t[i][0]; if (t[i][1] >= ml) break; }
    const pts = [new k.THREE.Vector2(0.0001, t[0][0])];
    for (let i = 0; i <= 10; i++) { const y = t[0][0] + (h - t[0][0]) * i / 10; pts.push(new k.THREE.Vector2(rIn(prof, y), y)); }
    pts.push(new k.THREE.Vector2(0.0001, h));
    s.liq.geometry.dispose(); s.liq.geometry = new k.THREE.LatheGeometry(pts, 14); s.liq.visible = true;
  }
  // onAmount(ml) always means ml moved forward (draw: source -> tip, dispense: tip -> target)
  function drawTo(c, target) { const d = target - c.tool.have(); if (d > 1e-9) c.onAmount(d); }
  function emptyTo(c, target) { const d = c.tool.have() - target; if (d > 1e-9) c.onAmount(d); }

  // ---------------- DRAW ----------------
  const TD = { toHover: [0, 0.8], press: [0.85, 1.2], dip: [1.2, 1.5], release: [1.5, 2.6], wait: [2.6, 3.1], out: [3.1, 3.5], END: 3.6 };
  C.register('micropipetteDraw', {
    label: 'Micropipette: draw', unit: 'ml', intro: TD.END, outro: 0.9, noLoop: true, linear: true,
    moves: c => [c.tool.obj],
    setup(k, c) {
      const s = {}; common(k, c, s, c.src);
      const sy = surfW(k, c.src).y;
      s.hover = s.mouthW.clone().setY(Math.max(s.mouthW.y + 0.012, sy + 0.012)); s.tipIn = s.mouthW.clone().setY(sy - 0.003);
      s.start = c.tool.have(); s.goal = s.start + c.tool.vol;
      return s;
    },
    shot(k, c, s) { const l = s.tipIn.clone().add(new k.THREE.Vector3(0, 0.02, 0)); return k.shotAt(l, 0.2, 0.2); },
    camAt(k, c, s) { return this.shot(k, c, s); },
    pose(k, c, s, phase, u) {
      if (phase === 'outro') { k.blendPose(s.m, s.outA || (s.outA = k.poseOf(s.m)), s.home, k.ease(u), 0.03); showTip(k, s, c.tool.have()); return 0; }
      const t = u * TD.END, sm = w => k.smooth(w[0], w[1], t);
      if (t < TD.dip[0]) k.blendPose(s.m, s.home, pose(k, s, s.hover), k.ease(sm(TD.toHover)), 0.04);
      else if (t < TD.out[0]) k.blendPose(s.m, pose(k, s, s.hover), pose(k, s, s.tipIn), sm(TD.dip));
      else k.blendPose(s.m, pose(k, s, s.tipIn), pose(k, s, s.hover), sm(TD.out));
      s.it.setPlunger(FIRST * (sm(TD.press) - sm(TD.release)));
      drawTo(c, s.start + (s.goal - s.start) * sm(TD.release));       // liquid follows the slow release
      showTip(k, s, c.tool.have());
      return 0;
    },
    complete(k, c, s) { drawTo(c, s.goal); },
    cleanup(k, c, s) { s.it.setPlunger(0); s.liq.parent.remove(s.liq); s.liq.geometry.dispose(); s.liq.material.dispose(); },
  });

  // ---------------- DISPENSE ----------------
  const TP = { toWall: [0, 0.9], first: [0.95, 1.8], pause: [1.8, 2.2], second: [2.2, 2.45], slide: [2.5, 3.0], release: [3.0, 3.3], END: 3.4 };
  C.register('micropipetteDispense', {
    label: 'Micropipette: dispense', unit: 'ml', intro: TP.END, outro: 0.9, noLoop: true, linear: true,
    moves: c => [c.tool.obj],
    setup(k, c) {
      const s = {}; common(k, c, s, c.dst);
      const sy = surfW(k, c.dst).y;
      s.wall = s.mouthW.clone().addScaledVector(s.d, c.dst.mouthR - 0.0008).setY(Math.max(sy + 0.003, s.mouthW.y - 0.01));
      s.hover = s.wall.clone().addScaledVector(s.d, -c.dst.mouthR * 0.5).setY(s.mouthW.y + 0.015);
      s.outP = s.wall.clone().setY(s.mouthW.y + 0.006).addScaledVector(s.d, -0.002);
      s.start = c.tool.have(); s.film = k.fx.stream();
      return s;
    },
    shot(k, c, s) { const l = s.wall.clone().add(new k.THREE.Vector3(0, 0.02, 0)); return k.shotAt(l, 0.2, 0.22); },
    camAt(k, c, s) { return this.shot(k, c, s); },
    pose(k, c, s, phase, u) {
      if (phase === 'outro') { s.film.hide(); k.blendPose(s.m, s.outA || (s.outA = k.poseOf(s.m)), s.home, k.ease(u), 0.03); return 0; }
      const t = u * TP.END, sm = w => k.smooth(w[0], w[1], t), LEAN = 0.35;
      if (t < TP.first[0]) {
        const v = sm(TP.toWall);
        if (v < 0.7) k.blendPose(s.m, s.home, pose(k, s, s.hover, LEAN), k.ease(v / 0.7), 0.04);
        else k.blendPose(s.m, pose(k, s, s.hover, LEAN), pose(k, s, s.wall, LEAN), (v - 0.7) / 0.3);
      } else if (t < TP.slide[0]) setP(s.m, pose(k, s, s.wall, LEAN));
      else k.blendPose(s.m, pose(k, s, s.wall, LEAN), pose(k, s, s.outP, LEAN), sm(TP.slide));
      s.it.setPlunger(FIRST * sm(TP.first) + (SECOND - FIRST) * sm(TP.second) - SECOND * sm(TP.release));
      // first stop pushes ~97 % out, blow-out the rest
      emptyTo(c, s.start * (1 - 0.97 * sm(TP.first) - 0.03 * sm(TP.second)));
      showTip(k, s, c.tool.have());
      const flowing = (t > TP.first[0] && t < TP.first[1] + 0.2) || (t > TP.second[0] && t < TP.second[1] + 0.15);
      if (flowing) { const top = k.world(s.m, s.tipEnd), bot = surfW(k, c.dst).setX(top.x).setZ(top.z);
        s.film.setPath([top, top.clone().lerp(bot, 0.5), bot], 0.0007, c.color, 0.5); } else s.film.hide();
      return 0;
    },
    complete(k, c, s) { emptyTo(c, 0); },
    cleanup(k, c, s) { s.it.setPlunger(0); s.film.dispose(); s.liq.parent.remove(s.liq); s.liq.geometry.dispose(); s.liq.material.dispose(); },
  });
})();
