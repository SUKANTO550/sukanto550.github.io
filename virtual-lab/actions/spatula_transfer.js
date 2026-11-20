/* ACTION: salt from a watch glass into a beaker / conical flask, pushed off with a spatula.
   Close-up clip (actions/player.js).
     intro  watch glass lifts over the vessel mouth, tilted towards it; spatula comes in behind the pile
     loop   spatula strokes: blade pushes salt to the low edge, grains fall in, blade lifts and goes back
     outro  two light taps of the spatula on the edge, both go back
   Context c:
     src  = { obj (watch glass, equipment/watchglass.js), start (g at clip start), hideContents?(bool) }
     dst  = { obj, mouth (local Vector3), mouthR, surfaceY() }
     tool = spatula object (equipment/spatula.js: blade tip at local z = -0.102, lies flat, y up)
     color, available(), room?(), onAmount(g)
   Typical technique; the owner has not confirmed lab-specific details yet. */
(function () {
  const C = window.CLIPS;
  const PERIOD = 0.9;                 // one push stroke (s)
  const TIP = [0, 0.0008, -0.101];    // spatula blade tip (local)

  C.register('spatulaTransfer', {
    label: 'Salt: watch glass → vessel (spatula)', unit: 'g',
    intro: 1.1, outro: 1.3, minLoop: 2.5, maxLoop: 7,
    rate: () => 0.22,                 // ~0.2 g per stroke
    moves: c => [c.src.obj, c.tool],

    setup(k, c) {
      const { THREE, up } = k, E = window.EQUIP, R = E.watchglassDims.R, Y = E.watchglassY;
      const s = { R, Y, glass: c.src.obj, tool: c.tool };
      s.d = k.camRight().negate();                                     // low edge points to screen-left (right hand pushes)
      s.mouthW = k.world(c.dst.obj, c.dst.mouth);
      s.qYaw = new THREE.Quaternion().setFromAxisAngle(up, Math.atan2(-s.d.z, s.d.x));   // glass local +x -> d
      s.edgeL = new THREE.Vector3(R, Y(R), 0);
      s.edgeW = s.mouthW.clone().addScaledVector(s.d, c.dst.mouthR * 0.15).addScaledVector(up, 0.013);
      s.homeG = k.poseOf(s.glass); s.homeT = k.poseOf(s.tool);
      // spatula orientation in the glass frame: handle rises up/back (+z of the spatula), slightly away from the camera
      const back = k.camBack().applyQuaternion(s.qYaw.clone().invert());
      const zc = Math.sign(back.z) || 1, a = 0.5, b = -0.22;
      const z = new THREE.Vector3(-Math.cos(a) * Math.cos(b), Math.sin(a), zc * Math.sin(b)).normalize();
      const y = new THREE.Vector3(0, 1, 0).addScaledVector(z, -z.y).normalize(), x = new THREE.Vector3().crossVectors(y, z);
      s.qTool = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
      s.tipL = new THREE.Vector3(...TIP);
      // salt pile on the glass (the clip's own; the host's display is hidden meanwhile)
      c.src.hideContents && c.src.hideContents(true);
      s.sizeK = Math.cbrt(Math.max(0.05, c.src.start) / 2);
      s.pile = window.CLIPS.saltHeap(THREE, { color: c.color, seed: 3 });
      s.glass.add(s.pile);
      const mat = new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.6, flatShading: true });
      const cg = new THREE.OctahedronGeometry(1, 0);
      s.trail = [];                                                    // moving grains between pile and edge while pushing
      for (let i = 0; i < 14; i++) {
        const g = new THREE.Mesh(cg, mat); const sc = 0.0005 + Math.random() * 0.0005;
        g.scale.set(sc, sc * 0.8, sc); g.userData.f = Math.random(); g.userData.zj = (Math.random() - 0.5) * 0.012;
        g.rotation.set(Math.random() * 3, Math.random() * 3, 0); g.visible = false; s.glass.add(g); s.trail.push(g);
      }
      // grains LEFT BEHIND on the glass along the push path (more as more salt goes)
      const N = 80; s.resid = new THREE.InstancedMesh(cg, mat, N); s.resid.count = 0; s.residN = N; s.residP = [];
      for (let i = 0; i < N; i++) s.residP.push({ f: Math.pow(Math.random(), 0.7), z: (Math.random() - 0.5) * 0.016, s: 0.0003 + Math.random() * 0.0006, r: Math.random() * 6 });
      s.glass.add(s.resid); s.trailMat = mat; s.trailGeo = cg;
      s.frac = 1; s.ticks = 0;
      return s;
    },

    shot(k, c, s) {
      const look = s.mouthW.clone().addScaledVector(k.up, 0.016).addScaledVector(s.d, -0.022);
      return k.shotAt(look, 0.24, 0.34);
    },

    pose(k, c, s, phase, u, on) {
      const { THREE } = k, R = s.R, Y = s.Y;
      s.frac = Math.max(0, c.available() / Math.max(1e-6, c.src.start));
      // pile: shrinks with what is left, creeps towards the edge as it is pushed
      const sz = Math.cbrt(s.frac) * s.sizeK, px = -0.004 + 0.012 * (1 - s.frac);
      s.pile.visible = s.frac > 0.002;
      const pushed = 1 - s.frac, S = 0.012 * sz;                     // pushed heap: drawn out towards the edge, flatter
      s.pile.scale.set(S * (1 + 0.4 * pushed), S * (1 - 0.3 * pushed), S); s.pile.position.set(px, Y(px) - 0.0003, 0);
      const xe = R * 0.86, n = Math.min(s.residN, Math.round(pushed * s.residN * 1.4));
      if (n !== s.resid.count) {
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
        for (let i = 0; i < n; i++) { const r = s.residP[i], x = px + 0.006 + (xe - px - 0.006) * r.f;
          q.setFromEuler(e.set(r.r, r.r * 1.7, 0));
          m4.compose(new THREE.Vector3(x, Y(Math.hypot(x, r.z)) + r.s * 0.4, r.z), q, new THREE.Vector3(r.s, r.s * 0.7, r.s)); s.resid.setMatrixAt(i, m4); }
        s.resid.count = n; s.resid.instanceMatrix.needsUpdate = true;
      }
      const xa = px - 0.012 * Math.max(0.4, sz) - 0.004, xb = R * 0.86;
      const glassPose = th => {
        const q = s.qYaw.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -th));
        const g = new THREE.Object3D(); k.placeBy(g, q, s.edgeL, s.edgeW); return { pos: g.position, quat: g.quaternion };
      };
      // spatula pose from a blade-tip point given in the glass frame (uses the glass's CURRENT pose)
      const toolAt = (x, lift) => {
        const tipG = new THREE.Vector3(x, Y(x) + 0.0012 + lift, 0);
        const qW = s.glass.quaternion.clone().multiply(s.qTool);
        const tipW = s.glass.localToWorld(tipG);
        return { pos: tipW.sub(s.tipL.clone().applyQuaternion(qW)), quat: qW };
      };
      const setPose = (o, P) => { o.position.copy(P.pos); o.quaternion.copy(P.quat); o.updateMatrixWorld(true); };
      const trail = vis => s.trail.forEach(g => {
        const f = g.userData.f, x = px + 0.008 + (xb - px - 0.006) * f;
        g.visible = vis > 0.5 && s.frac > 0.002; g.position.set(x, Y(x) + 0.0005, g.userData.zj * (1 - f * 0.5));
      });

      if (phase === 'intro') {
        k.blendPose(s.glass, s.homeG, glassPose(0.3), u, 0.035);
        const v = k.smooth(0.2, 1, u);
        k.blendPose(s.tool, s.homeT, toolAt(xa, 0.007), v, 0.05);
        trail(0); return 0;
      }
      if (phase === 'loop') {
        setPose(s.glass, glassPose(0.3 + 0.07 * on));
        const p = (u % PERIOD) / PERIOD;
        let x, lift;
        if (p < 0.55) { const e = k.smooth(0, 0.55, p); x = xa + (xb - xa) * e; lift = 0.0004; }
        else { const e = k.smooth(0.55, 1, p); x = xb + (xa - xb) * e; lift = 0.006 * Math.sin(Math.PI * e); }
        setPose(s.tool, toolAt(xa + (x - xa) * on, 0.007 + (lift - 0.007) * on));
        const pushing = p > 0.25 && p < 0.58;
        trail(pushing ? on : 0);
        s.lastTh = 0.3 + 0.07 * on;
        return p > 0.3 && p < 0.6 ? 1 / 0.3 : 0;                      // grains fall only near the end of the push
      }
      // outro: tip to the edge, two light taps, then everything goes home
      trail(0);
      if (!s.out) s.out = { tool: k.poseOf(s.tool), th: s.lastTh || 0.3 };
      if (u < 0.42) {
        setPose(s.glass, glassPose(s.out.th + (0.3 - s.out.th) * k.smooth(0, 0.15, u)));
        if (u < 0.14) k.blendPose(s.tool, s.out.tool, toolAt(xb, 0.004), k.smooth(0, 0.14, u));
        else {
          const w = (u - 0.14) / 0.28, lift = 0.004 * Math.abs(Math.cos(Math.PI * 2 * w));   // 2 taps
          setPose(s.tool, toolAt(xb, lift));
          const n = Math.floor(w * 2 + 0.5); if (n > s.ticks && s.frac > 0) { s.ticks = n; emitGrains(k, c, s, 2); }
        }
        s.tapEnd = { glass: k.poseOf(s.glass), tool: k.poseOf(s.tool) };
      } else {
        s.tapEnd = s.tapEnd || { glass: k.poseOf(s.glass), tool: k.poseOf(s.tool) };
        const v = k.ease((u - 0.42) / 0.58);
        k.blendPose(s.glass, s.tapEnd.glass, s.homeG, v, 0.03);
        k.blendPose(s.tool, s.tapEnd.tool, s.homeT, k.smooth(0, 0.85, v), 0.05);
      }
      return 0;
    },

    emit(k, c, s, amt) { emitGrains(k, c, s, Math.min(4, Math.ceil(amt / 0.004))); },

    cleanup(k, c, s) {
      s.glass.remove(s.pile); s.pile.userData.dispose();
      s.trail.forEach(g => s.glass.remove(g)); s.glass.remove(s.resid); s.resid.dispose(); s.trailGeo.dispose(); s.trailMat.dispose();
      c.src.hideContents && c.src.hideContents(false);
    },
  });

  function emitGrains(k, c, s, n) {
    const { THREE } = k;
    const from = s.glass.localToWorld(new THREE.Vector3(s.R * 0.95, s.Y(s.R) + 0.0015, 0));
    const to = k.world(c.dst.obj, new THREE.Vector3(c.dst.mouth.x, c.dst.surfaceY(), c.dst.mouth.z));
    k.fx.fall(from, to, c.color, n, { grain: true, spread: Math.min(0.012, c.dst.mouthR * 0.9), delay: 0.04 });
  }
})();
