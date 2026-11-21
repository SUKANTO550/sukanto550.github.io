/* ACTION: substrate from the ethanol dip onto the spin-coater chuck (owner's practice, protocol step 24-25):
   cleaned substrates wait dipped in ethanol; for each layer one is taken out with CLEAN tweezers, the back
   (non-film) side is wiped with tissue, it is laid on the chuck and the vacuum holds it.
   Step clip (actions/player.js: noLoop):
     1. tweezers come in tilted, tips pinch the substrate EDGE (3 mm in) under the ethanol
     2. lifted out; tilted ~25° so the ethanol runs off the far edge (drops fall back into the dish)
     3. a tissue comes up under it and wipes the BACK side once (never the top face)
     4. carried to the chuck, laid down flat and centred, tips let go -> vacuum on, tweezers home
   No hands (as the other clips; the tissue moves by itself). Esc = Skip: substrate on the chuck.
   Context c:
     sub   = { obj, size? (0.025), thick? (0.0011), baseY? (local y of the bottom face; 0 for the lab substrate) }
     tool  = { obj } tweezers (equipment/tweezers.js lying frame: tips at +z, arms side by side along x)
     from  = { pos } world point under the substrate centre (dish floor / bottom of the substrate in the dip)
     to    = { pos } world point: chuck top centre
     color      liquid colour of the dip (ethanol: clear)
     onPlaced(end)  substrate on the chuck; end = { sub: {pos, quat} } (world). The player puts moved objects
                    back at the end, so the HOST moves its substrate there (onEnd). Also on Skip.
     onVacuum()     vacuum switched on (host: machine.vacuum = true)                                       */
(function () {
  const C = window.CLIPS;
  const PITCH = 0.52, GRIP_IN = 0.003, TILT = 0.44, LIFT = 0.06;
  const T = { tIn: [0.2, 1.2], tDown: [1.2, 1.5], pinch: [1.5, 1.7], lift: [1.7, 2.5], tilt: [2.5, 3.0], drip: [2.6, 3.7], untilt: [3.7, 4.1],
    tisIn: [4.0, 4.5], wipe: [4.5, 5.3], tisOut: [5.3, 5.8], carry: [5.8, 7.0], lower: [7.0, 7.4], letGo: 7.5, tUp: [7.5, 7.8], tHome: [7.8, 8.7], END: 8.9 };

  function setP(o, P) { o.position.copy(P.pos); o.quaternion.copy(P.quat); o.updateMatrixWorld(true); }
  function decomp(k, m) { const pos = new k.THREE.Vector3(), quat = new k.THREE.Quaternion(); m.decompose(pos, quat, new k.THREE.Vector3()); return { pos, quat }; }
  function matOf(k, P) { return new k.THREE.Matrix4().compose(P.pos, P.quat, new k.THREE.Vector3(1, 1, 1)); }
  function tipLocal(k, obj) {                       // centre of the vertices within 2 mm of the tips (+z end)
    const { THREE } = k, inv = obj.matrixWorld.clone().invert(), v = new THREE.Vector3(), all = [];
    obj.updateMatrixWorld(true);
    obj.traverse(o => { if (!o.isMesh || !o.geometry.attributes.position) return;
      const m = inv.clone().multiply(o.matrixWorld), p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i += 3) all.push(v.fromBufferAttribute(p, i).applyMatrix4(m).clone()); });
    if (!all.length) return new THREE.Vector3(0, 0, 0.065);
    const zMax = Math.max(...all.map(q => q.z)), near = all.filter(q => q.z > zMax - 0.002), c = new THREE.Vector3();
    near.forEach(q => c.add(q)); return c.multiplyScalar(1 / near.length).setZ(zMax - 0.0005);
  }
  function tissueMesh(THREE) {                      // folded tissue, 40 x 40 mm, a little wavy
    const g = new THREE.PlaneGeometry(0.04, 0.04, 8, 8), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, 0.0012 * Math.sin(p.getX(i) * 300) * Math.cos(p.getY(i) * 260));
    g.computeVertexNormals(); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xfbfbf8, roughness: 0.95, side: THREE.DoubleSide, transparent: true, opacity: 0 }));
    m.renderOrder = 5; return m;
  }

  C.register('chuckLoad', {
    label: 'Substrate: ethanol dip → wipe back → chuck', unit: '',
    intro: T.END, outro: 1.0, noLoop: true, linear: true,
    moves: c => [c.sub.obj, c.tool.obj],

    setup(k, c) {
      const { THREE } = k, s = {};
      s.sub = c.sub.obj; s.tw = c.tool.obj;
      const half = (c.sub.size || 0.025) / 2, th = c.sub.thick || 0.0011, cy = -(c.sub.baseY || 0);
      s.half = half; s.th = th;
      s.sub0 = k.poseOf(s.sub); s.tw0 = k.poseOf(s.tw); s.tip = tipLocal(k, s.tw);
      const d = k.camRight().multiplyScalar(0.75).add(k.camBack().multiplyScalar(0.66)).normalize(); s.d = d;
      const yaw0 = new THREE.Euler().setFromQuaternion(s.sub0.quat, 'YXZ').y, q0 = new THREE.Quaternion().setFromAxisAngle(k.up, yaw0);
      s.subStart = { pos: c.from.pos.clone().add(new THREE.Vector3(0, cy, 0)), quat: q0 };
      s.subEnd = { pos: c.to.pos.clone().add(new THREE.Vector3(0, cy, 0)), quat: q0.clone() };
      const ex = new THREE.Vector3(1, 0, 0).applyQuaternion(q0), ez = new THREE.Vector3(0, 0, 1).applyQuaternion(q0);
      const reach = half / Math.max(Math.abs(d.dot(ex)), Math.abs(d.dot(ez)));
      s.reach = reach;
      const gripW = c.from.pos.clone().addScaledVector(d, reach - GRIP_IN).add(new THREE.Vector3(0, th * 0.5, 0));
      const f = d.clone().negate().multiplyScalar(Math.cos(PITCH)).add(new THREE.Vector3(0, -Math.sin(PITCH), 0)).normalize();
      const X = k.up.clone().addScaledVector(f, -k.up.dot(f)).normalize(), Y = new THREE.Vector3().crossVectors(f, X);
      s.qTw = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, f));
      const twAt = P => { const o = new THREE.Object3D(); k.placeBy(o, s.qTw, s.tip, P); return { pos: o.position.clone(), quat: o.quaternion.clone() }; };
      s.twGrip = twAt(gripW);
      s.twAbove = twAt(gripW.clone().add(new THREE.Vector3(0, 0.035, 0)).addScaledVector(d, 0.015));
      s.rel = matOf(k, s.twGrip).invert().multiply(matOf(k, s.subStart));
      s.relInv = s.rel.clone().invert();
      s.twEnd = decomp(k, matOf(k, s.subEnd).multiply(s.relInv));
      s.twEndAbove = { pos: s.twEnd.pos.clone().add(new THREE.Vector3(0, 0.03, 0)).addScaledVector(d, 0.015), quat: s.twEnd.quat.clone() };
      // lifted (draining) pose; tilt about the horizontal axis through the grip, far edge down
      s.up = { pos: s.subStart.pos.clone().add(new THREE.Vector3(0, LIFT, 0)), quat: q0.clone() };
      s.pivot = gripW.clone().add(new THREE.Vector3(0, LIFT, 0));
      s.tiltAx = new THREE.Vector3().crossVectors(d, k.up).normalize();
      s.tissue = tissueMesh(THREE); k.scene.add(s.tissue);
      s.dripN = 0; s.flags = {};
      setP(s.sub, s.subStart);
      return s;
    },

    camAt(k, c, s, t) {
      const v = k.ease(k.smooth(T.carry[0], T.carry[1], t));
      const look = c.from.pos.clone().add(new k.THREE.Vector3(0, LIFT * 0.6, 0)).lerp(c.to.pos, v);
      // steeper over the chuck: it sits down in the spin-coater bowl
      return k.shotAt(look, 0.22 + 0.1 * v, 0.45 + 0.45 * v);
    },
    shot(k, c, s) { return this.camAt(k, c, s, 0); },

    pose(k, c, s, phase, u) {
      if (phase === 'outro') return 0;
      const { THREE } = k, t = u * T.END, sm = w => k.smooth(w[0], w[1], t);
      const tilted = (P, a) => {                    // rotate pose P by angle a about the tilt axis through the pivot
        const q = new THREE.Quaternion().setFromAxisAngle(s.tiltAx, a);
        return { pos: P.pos.clone().sub(s.pivot).applyQuaternion(q).add(s.pivot), quat: q.multiply(P.quat.clone()) };
      };
      const hold = P => { setP(s.sub, P); setP(s.tw, decomp(k, matOf(k, P).multiply(s.relInv))); };
      if (t < T.tDown[0]) { k.blendPose(s.tw, s.tw0, s.twAbove, k.ease(sm(T.tIn)), 0.03); setP(s.sub, s.subStart); }
      else if (t < T.lift[0]) { k.blendPose(s.tw, s.twAbove, s.twGrip, k.ease(sm(T.tDown)), 0); setP(s.sub, s.subStart); }
      else if (t < T.carry[0]) {
        const lifted = { pos: s.subStart.pos.clone().lerp(s.up.pos, k.ease(sm(T.lift))), quat: s.up.quat };
        hold(tilted(lifted, TILT * (k.ease(sm(T.tilt)) - k.ease(sm(T.untilt)))));
      } else if (t < T.letGo) {
        let P;
        if (t < T.lower[0]) {
          const v = k.ease(sm(T.carry)), B = { pos: s.subEnd.pos.clone().add(new THREE.Vector3(0, 0.02, 0)), quat: s.subEnd.quat };
          P = { pos: s.up.pos.clone().lerp(B.pos, v), quat: s.up.quat.clone().slerp(B.quat, v) }; P.pos.y += Math.sin(Math.PI * v) * 0.02;
        } else P = { pos: s.subEnd.pos.clone().add(new THREE.Vector3(0, 0.02 * (1 - k.ease(sm(T.lower))), 0)), quat: s.subEnd.quat };
        hold(P);
      } else {
        setP(s.sub, s.subEnd);
        if (!s.flags.placed) { s.flags.placed = true; c.onPlaced && c.onPlaced({ sub: s.subEnd }); c.onVacuum && c.onVacuum(); }
        if (t < T.tHome[0]) k.blendPose(s.tw, s.twEnd, s.twEndAbove, k.ease(sm(T.tUp)), 0);
        else k.blendPose(s.tw, s.twEndAbove, s.tw0, k.ease(sm(T.tHome)), 0.03);
      }
      // ethanol drips off the low (far) edge while tilted
      if (t > T.drip[0] && t < T.drip[1]) {
        const want = Math.floor((t - T.drip[0]) / 0.18);
        while (s.dripN < want) { s.dripN++;
          const edge = s.sub.localToWorld(new THREE.Vector3(0, 0, 0)).addScaledVector(s.d, -s.reach * 0.98);
          edge.y -= Math.sin(TILT) * s.reach;
          k.fx.fall(edge, edge.clone().setY(c.from.pos.y + 0.002), c.color || '#e8f0ff', 1, { grain: false, spread: 0.006 }); }
      }
      // tissue: comes up under the substrate, wipes the back once (slides off the far edge), goes away
      const tm = s.tissue, under = s.up.pos.clone().add(new THREE.Vector3(0, -0.0001, 0));
      const op = sm(T.tisIn) - sm(T.tisOut);
      tm.visible = op > 0.01; tm.material.opacity = op;
      if (tm.visible) {
        const w = k.ease(sm(T.wipe)), p = under.clone().addScaledVector(s.d, 0.006 - 0.045 * w);
        p.y -= 0.02 * (1 - k.ease(sm(T.tisIn))) + 0.02 * k.ease(sm(T.tisOut));
        tm.position.copy(p); tm.quaternion.copy(s.up.quat); tm.updateMatrixWorld(true);
      }
      return 0;
    },

    complete(k, c, s) {
      setP(s.sub, s.subEnd);
      if (!s.flags.placed) { s.flags.placed = true; c.onPlaced && c.onPlaced({ sub: s.subEnd }); c.onVacuum && c.onVacuum(); }
    },
    cleanup(k, c, s) { k.scene.remove(s.tissue); s.tissue.geometry.dispose(); s.tissue.material.dispose(); },
  });
})();
