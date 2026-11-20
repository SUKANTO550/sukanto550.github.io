/* ACTION: pour liquid from a stock bottle into a working jar (or any open vessel).
   Close-up clip (actions/player.js).
     intro  bottle lifts over the jar, label turned UP (away from the pouring side), tips to just before flowing
     loop   bottle tips until the liquid runs; stream into the jar; slight hand wobble; the emptier the
            bottle, the further it must tip. Released (hold mode) = tips back, stream stops.
     outro  tips back upright over the mouth (last drop falls), bottle goes home
   Context c:
     src = { obj (stock bottle, label on local +z), lipR, lipY (mouth rim radius / height, local), bodyR?, start (ml) }
     The bottle never dips into the bench: it is lifted when less tipped (bench = height the target stands on).
     dst = { obj, mouth (local Vector3), mouthR, surfaceY() }
     color, available(), room(), onAmount(ml)
   The cap must already be off (the host's "Take the cap off" step). Typical technique; owner to confirm. */
(function () {
  const C = window.CLIPS;

  C.register('stockPour', {
    label: 'Stock bottle → working jar (pour)', unit: 'ml',
    intro: 1.1, outro: 1.2, minLoop: 2, maxLoop: 6,
    rate: () => 12,                    // ml/s once flowing
    moves: c => [c.src.obj],

    setup(k, c) {
      const { THREE, up } = k;
      const s = { b: c.src.obj };
      s.d = k.camRight().negate();                                  // pours towards screen-left; bottle hangs on the right
      s.mouthW = k.world(c.dst.obj, c.dst.mouth);
      // label (+z) faces away from the pour side (-d), so it is on top while tipped; lip = local -z
      s.qBase = new THREE.Quaternion().setFromAxisAngle(up, Math.atan2(-s.d.x, -s.d.z));
      s.axis = new THREE.Vector3().crossVectors(up, s.d).normalize(); // tipping about this dips the lip down
      s.lipL = new THREE.Vector3(0, c.src.lipY, -c.src.lipR);
      s.lipW = s.mouthW.clone().addScaledVector(s.d, -c.dst.mouthR * 0.3).addScaledVector(up, 0.014);
      s.home = k.poseOf(s.b);
      // bench height = where the target vessel stands; bottle outline points (local) for the clearance check
      s.floorY = k.world(c.dst.obj, new THREE.Vector3()).y;
      const box = new THREE.Box3().setFromObject(s.b), sz = box.getSize(new THREE.Vector3());
      const r = c.src.bodyR || Math.max(sz.x, sz.z) / 2, h = c.src.lipY;
      s.hull = [];
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2;
        for (const y of [0, h * 0.68]) s.hull.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
      s.stream = k.fx.stream();
      s.th = 0.45;
      return s;
    },

    shot(k, c, s) {
      const look = s.mouthW.clone().addScaledVector(k.up, 0.035).addScaledVector(s.d, -0.03);
      return k.shotAt(look, 0.36, 0.26);
    },

    pose(k, c, s, phase, u, on) {
      const { THREE } = k;
      // lip over the mouth; if the bottle's lowest point would go into the bench, lift it (less tipped = held higher)
      const at = (th, lift = 0) => {
        const q = new THREE.Quaternion().setFromAxisAngle(s.axis, th).multiply(s.qBase);
        const o = new THREE.Object3D(); k.placeBy(o, q, s.lipL, s.lipW.clone().addScaledVector(k.up, lift));
        let low = Infinity;
        for (const p of s.hull) low = Math.min(low, p.clone().applyQuaternion(q).add(o.position).y);
        if (low < s.floorY + 0.008) o.position.y += s.floorY + 0.008 - low;
        return { pos: o.position, quat: o.quaternion };
      };
      const set = P => { s.b.position.copy(P.pos); s.b.quaternion.copy(P.quat); s.b.updateMatrixWorld(true); };
      const lip = () => k.world(s.b, s.lipL);
      const target = () => k.world(c.dst.obj, new THREE.Vector3(c.dst.mouth.x, c.dst.surfaceY(), c.dst.mouth.z)).addScaledVector(s.d, c.dst.mouthR * 0.15);

      if (phase === 'intro') { k.blendPose(s.b, s.home, at(0.45), u, 0.04); s.stream.hide(); return 0; }
      if (phase === 'loop') {
        const frac = Math.max(0, c.available() / Math.max(1e-6, c.src.start));
        const thOn = Math.min(1.85, 1.2 + 0.6 * (1 - frac)) + 0.025 * Math.sin(u * 5.3);
        s.th = 0.62 + (thOn - 0.62) * on;
        set(at(s.th));
        if (on > 0.85 && c.available() > 0) s.stream.set(lip(), target(), 0.0024 + 0.0008 * on, c.color, 0.6, s.d);
        else s.stream.hide();
        return 1;
      }
      // outro
      s.stream.hide();
      if (!s.out) s.out = { th: s.th };
      if (u < 0.36) {
        const v = k.smooth(0, 0.36, u);
        set(at(s.out.th + (0.08 - s.out.th) * v, 0.008 * v));
        if (!s.dripped && u > 0.12) { s.dripped = true; k.fx.fall(lip(), target(), c.color, 1, { grain: false, spread: 0 }); }
        s.upPose = k.poseOf(s.b);
      } else {
        s.upPose = s.upPose || k.poseOf(s.b);
        k.blendPose(s.b, s.upPose, s.home, k.ease((u - 0.36) / 0.64), 0.03);
      }
      return 0;
    },

    cleanup(k, c, s) { s.stream.dispose(); },
  });
})();
