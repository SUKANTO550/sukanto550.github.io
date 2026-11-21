/* ACTION: move a hot substrate with the CERAMIC-TIP tweezers (owner's practice) — from one hotplate to the
   next (gelation 90 °C -> pyrolysis 280 °C -> burn-out 410 °C) or onto a petri dish to cool.
   The borosilicate funnel (equipment/funnel.js) is the owner's DUST COVER: it sits upside down over the
   substrate on the hotplate. Step-by-step clip (actions/player.js: noLoop):
     1. funnel cover lifted off the substrate and set aside (if it covers the source)
     2. tweezers come in from the side, tilted ~30° down, arms one above the other; the tips pinch the
        substrate EDGE (~3 mm in) — never the middle of the film
     3. substrate lifted flat, carried in an arc, set down flat at the target, tips let go, tweezers home
     4. funnel placed upside down over the substrate at the target (if c.coverTarget)
   No hands (as the other clips). Esc = Skip: substrate (and funnel) straight to the end pose.
   Context c:
     sub    = { obj, size? (edge, m; 0.025), thick? (0.0011), baseY? (local y of the glass's BOTTOM face: 0 when the
                origin is on the bottom face, as the lab substrate; -thick/2 when the origin is the centre) }
     tool   = { obj }  tweezers item (equipment/tweezers.js lying frame: tips at +z, arms side by side along x)
     from   = { pos: Vector3 world point on the surface under the substrate centre }
     to     = { pos: Vector3 world point on the target surface (substrate centre goes here), yaw? (default: keep) }
     funnel = { obj } optional; model frame = upside down, rim on y = 0 (equipment/funnel.js)
     coverSource  true = the funnel covers the substrate at the start (it is lifted off first)
     coverTarget  true = the funnel goes over the substrate at the target at the end
     funnelAside  Vector3 world (rim centre) where the funnel waits; default on the same plate, 56 mm behind the substrate
     onPlaced(end) called once the substrate rests at the target (also on Skip). end = { sub: {pos, quat},
                  funnel: {pos, quat} | null } (world). The player puts every moved object back at the end
                  of the clip, so the HOST applies these end poses (onEnd) / moves its items there.                            */
(function () {
  const C = window.CLIPS;
  const PITCH = 0.52, GRIP_IN = 0.003;
  // timeline (s)
  const T = { fUp: [0.3, 0.9], fAside: [0.9, 1.6], tIn: [1.2, 2.4], tDown: [2.4, 2.75], pinch: [2.75, 2.95], lift: [2.95, 3.35],
    carry: [3.35, 4.85], lower: [4.85, 5.25], letGo: 5.4, tUp: [5.4, 5.75], tHome: [5.75, 6.7], fOver: [5.8, 7.0], END: 7.2 };

  function setP(o, P) { o.position.copy(P.pos); o.quaternion.copy(P.quat); o.updateMatrixWorld(true); }
  function decomp(k, m) { const pos = new k.THREE.Vector3(), quat = new k.THREE.Quaternion(); m.decompose(pos, quat, new k.THREE.Vector3()); return { pos, quat }; }
  function endOf(c, s) { return { sub: s.subEnd, funnel: s.fn ? (c.coverTarget ? s.fnDst : (c.coverSource ? s.fnAside : null)) : null }; }
  function matOf(k, P) { return new k.THREE.Matrix4().compose(P.pos, P.quat, new k.THREE.Vector3(1, 1, 1)); }

  // tip point of the tweezers in their own frame: centre of the vertices within 2 mm of the far (+z) end
  function tipLocal(k, obj) {
    const { THREE } = k, inv = obj.matrixWorld.clone().invert(), v = new THREE.Vector3(), all = [];
    obj.updateMatrixWorld(true);
    obj.traverse(o => { if (!o.isMesh || !o.geometry.attributes.position) return;
      const m = inv.clone().multiply(o.matrixWorld), p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i += 3) all.push(v.fromBufferAttribute(p, i).applyMatrix4(m).clone()); });
    if (!all.length) return new THREE.Vector3(0, 0, 0.065);
    const zMax = Math.max(...all.map(q => q.z)), near = all.filter(q => q.z > zMax - 0.002), c = new THREE.Vector3();
    near.forEach(q => c.add(q)); return c.multiplyScalar(1 / near.length).setZ(zMax - 0.0005);
  }

  C.register('tweezerMove', {
    label: 'Ceramic tweezers: move the hot substrate', unit: '',
    intro: T.END, outro: 1.0, noLoop: true, linear: true,
    moves: c => [c.sub.obj, c.tool.obj, c.funnel && c.funnel.obj],

    setup(k, c) {
      const { THREE } = k, s = {};
      s.sub = c.sub.obj; s.tw = c.tool.obj; s.fn = c.funnel && c.funnel.obj;
      const half = (c.sub.size || 0.025) / 2, th = c.sub.thick || 0.0011, cy = -(c.sub.baseY || 0);   // origin height over the surface
      s.sub0 = k.poseOf(s.sub); s.tw0 = k.poseOf(s.tw); s.fn0 = s.fn ? k.poseOf(s.fn) : null;
      s.tip = tipLocal(k, s.tw);
      // approach from the camera's right-front, so the substrate stays in view
      const d = k.camRight().multiplyScalar(0.75).add(k.camBack().multiplyScalar(0.66)).normalize();
      s.d = d;
      // substrate end pose: centre on c.to.pos, flat, same yaw (or c.to.yaw)
      const yaw0 = new THREE.Euler().setFromQuaternion(s.sub0.quat, 'YXZ').y;
      const qEnd = new THREE.Quaternion().setFromAxisAngle(k.up, c.to.yaw != null ? c.to.yaw : yaw0);
      s.subStart = { pos: c.from.pos.clone().add(new THREE.Vector3(0, cy, 0)), quat: new THREE.Quaternion().setFromAxisAngle(k.up, yaw0) };
      s.subEnd = { pos: c.to.pos.clone().add(new THREE.Vector3(0, cy, 0)), quat: qEnd };
      // grip point: on the substrate top, GRIP_IN inside the edge facing d (square: distance to the edge along d)
      const ex = new THREE.Vector3(1, 0, 0).applyQuaternion(s.subStart.quat), ez = new THREE.Vector3(0, 0, 1).applyQuaternion(s.subStart.quat);
      const reach = half / Math.max(Math.abs(d.dot(ex)), Math.abs(d.dot(ez)));
      const gripW = c.from.pos.clone().addScaledVector(d, reach - GRIP_IN).add(new THREE.Vector3(0, th * 0.5, 0));
      // tweezers rotation: tips point back along -d, pitched down; arms one above the other (local x ~ up)
      const f = d.clone().negate().multiplyScalar(Math.cos(PITCH)).add(new THREE.Vector3(0, -Math.sin(PITCH), 0)).normalize();
      const X = k.up.clone().addScaledVector(f, -k.up.dot(f)).normalize(), Y = new THREE.Vector3().crossVectors(f, X);
      s.qTw = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, f));
      const twAt = P => { const o = new THREE.Object3D(); k.placeBy(o, s.qTw, s.tip, P); return { pos: o.position.clone(), quat: o.quaternion.clone() }; };
      s.twGrip = twAt(gripW);
      s.twAbove = twAt(gripW.clone().add(new THREE.Vector3(0, 0.03, 0)).addScaledVector(d, 0.015));
      // substrate held: fixed offset from the tweezers at the grip
      s.rel = matOf(k, s.twGrip).invert().multiply(matOf(k, s.subStart));
      s.twEnd = decomp(k, matOf(k, s.subEnd).multiply(s.rel.clone().invert()));
      s.twEndAbove = { pos: s.twEnd.pos.clone().add(new THREE.Vector3(0, 0.03, 0)).addScaledVector(d, 0.015), quat: s.twEnd.quat.clone() };
      s.subLift = h => P => ({ pos: P.pos.clone().add(new THREE.Vector3(0, h, 0)), quat: P.quat.clone() });
      // funnel poses (rim on the surface, centred on the substrate)
      if (s.fn) {
        const fq = s.fn0.quat.clone();
        s.fnSrc = c.coverSource ? { pos: c.from.pos.clone(), quat: fq } : s.fn0;
        const aside = c.funnelAside || c.from.pos.clone().addScaledVector(d, -0.056);   // same plate, clear of the substrate corner (plate 160 mm)
        s.fnAside = c.coverSource ? { pos: aside, quat: fq } : s.fn0;
        s.fnDst = { pos: c.to.pos.clone(), quat: fq };
        if (c.coverSource) setP(s.fn, s.fnSrc);
      }
      setP(s.sub, s.subStart);
      s.mid = c.from.pos.clone().lerp(c.to.pos, 0.5);
      s.span = c.from.pos.distanceTo(c.to.pos);
      s.flags = {};
      return s;
    },

    camAt(k, c, s, t) {
      const { THREE } = k;
      const sm = (w) => k.smooth(w[0], w[1], t);
      // look at the source, slide over to the target while the substrate is carried; far enough to see both
      const look = c.from.pos.clone().lerp(c.to.pos, k.ease(sm(T.carry)));
      look.lerp(s.mid, 0.35).add(new THREE.Vector3(0, 0.01, 0));
      return k.shotAt(look, Math.max(0.22, 0.16 + s.span * 0.75), 0.55);
    },
    shot(k, c, s) { return this.camAt(k, c, s, 0); },

    pose(k, c, s, phase, u) {
      const sm = w => k.smooth(w[0], w[1], t);
      if (phase === 'outro') return 0;
      const t = u * T.END;
      // ---- funnel ----
      if (s.fn && c.coverSource && t < T.fOver[0]) {
        if (t < T.fAside[0]) { const v = k.ease(sm(T.fUp)); setP(s.fn, { pos: s.fnSrc.pos.clone().add(new k.THREE.Vector3(0, 0.05 * v, 0)), quat: s.fnSrc.quat }); }
        else k.blendPose(s.fn, { pos: s.fnSrc.pos.clone().add(new k.THREE.Vector3(0, 0.05, 0)), quat: s.fnSrc.quat }, s.fnAside, k.ease(sm(T.fAside)), 0);
      }
      if (s.fn && c.coverTarget && t >= T.fOver[0]) {
        const from = c.coverSource ? s.fnAside : s.fn0, v = k.ease(sm(T.fOver));
        const hover = { pos: s.fnDst.pos.clone().add(new k.THREE.Vector3(0, 0.03, 0)), quat: s.fnDst.quat };
        if (v < 0.75) k.blendPose(s.fn, from, hover, v / 0.75, 0.04);
        else k.blendPose(s.fn, hover, s.fnDst, (v - 0.75) / 0.25, 0);
      }
      // ---- tweezers + substrate ----
      if (t < T.tDown[0]) { k.blendPose(s.tw, s.tw0, s.twAbove, k.ease(sm(T.tIn)), 0.03); setP(s.sub, s.subStart); }
      else if (t < T.lift[0]) { k.blendPose(s.tw, s.twAbove, s.twGrip, k.ease(sm(T.tDown)), 0); setP(s.sub, s.subStart); }
      else if (t < T.letGo) {
        // lift 2 cm, carry in an arc, lower; the substrate follows the tips
        let P;
        const up = 0.02;
        if (t < T.carry[0]) P = s.subLift(up * k.ease(sm(T.lift)))(s.subStart);
        else if (t < T.lower[0]) {
          const v = k.ease(sm(T.carry)), A = s.subLift(up)(s.subStart), B = s.subLift(up)(s.subEnd);
          P = { pos: A.pos.clone().lerp(B.pos, v), quat: A.quat.clone().slerp(B.quat, v) }; P.pos.y += Math.sin(Math.PI * v) * 0.03;
        } else P = s.subLift(up * (1 - k.ease(sm(T.lower))))(s.subEnd);
        setP(s.sub, P);
        setP(s.tw, decomp(k, matOf(k, P).multiply(s.rel.clone().invert())));
      } else {
        setP(s.sub, s.subEnd);
        if (!s.flags.placed) { s.flags.placed = true; c.onPlaced && c.onPlaced(endOf(c, s)); }
        if (t < T.tHome[0]) k.blendPose(s.tw, s.twEnd, s.twEndAbove, k.ease(sm(T.tUp)), 0);
        else k.blendPose(s.tw, s.twEndAbove, s.tw0, k.ease(sm(T.tHome)), 0.03);
      }
      return 0;
    },

    complete(k, c, s) {          // Skip: straight to the end result
      setP(s.sub, s.subEnd);
      if (s.fn) setP(s.fn, c.coverTarget ? s.fnDst : (c.coverSource ? s.fnAside : s.fn0));
      if (!s.flags.placed) { s.flags.placed = true; c.onPlaced && c.onPlaced(endOf(c, s)); }
    },
  });
})();
