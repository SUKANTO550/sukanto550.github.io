/* ACTION: cut a 25 x 75 mm glass slide into 3 pieces with the owner's slide cutting guide.
   Step-by-step clip (actions/player.js: noLoop). Sequence (owner, 2026-11-20):
     1. slide goes into the base pocket (76.2 x 25), pushed against end wall 1
     2. guide block (upper cover) is placed in the middle of the base, then slid to wall 1 until it mates
     3. glass cutter goes into the block's slot and makes ONE stroke, top (far) to bottom (near)
        -> mark 1 at 25.35 mm (slot 5.5 mm wide, 22.6 mm from the block's mating edge)
     4. block lifts, turns 180 degrees, is placed in the middle again and slid to wall 2; the slide sits against wall 2
     5. one stroke again -> mark 2 at 25.35 mm from the other end (middle piece = the rest, 24.3 mm)
     6. cutter and block lifted away; the base is held in TWO HANDS (outline sketch, this step only),
        both thumbs press the middle of the underside, the base bows a little, the glass breaks on both marks
     7. base is turned over a petri dish, the 3 pieces drop in (no hands)
   Cutter path + angle from the owner's STEP (cutting animation.STEP): 36.6 deg from vertical, handle leaning
   towards the user, 25.2 mm stroke along z. The cutter SHAPE is equipment/tools.js (owner's choice).
   Context c:
     base   = { obj }  slide cutter base (equipment/slidecutter.js 'base' frame: rests on y = 0)
     block  = { obj }  guide block, same frame as the base when assembled
     slide  = { obj, centerY? }  75 x 1 x 25 mm slide, long side along local x; centerY = local y of its centre
                       (0 = origin at the centre; the lab's substrate has its origin at the bottom: 0.00055)
     cutter = { obj, inner? }  glass cutter item; inner = its model group (equipment/tools.js 'up' frame,
                               axis +y, cutting tip at (0.00098, -0.02786, 0)); default obj.children[0]
     dish   = { obj, floorY (local y of the inner floor), R (inner radius) }
     onPieces(meshes)  the 3 pieces, now in the dish (the host takes them over)                          */
(function () {
  const C = window.CLIPS;
  const POCKET = 0.0381, FLOOR = 0.0017, L = 0.075, W = 0.025, TH = 0.001, TOP = FLOOR + TH;
  const DX = 0.00692;                     // block shift from its assembled pose to a mated end wall
  const MID = 0.01118;                    // block shift that centres it in the pocket (where it is first placed)
  const SLOT = 0.02535 - POCKET;          // slot centre (base x) with the block mated to wall 1: -0.01275
  const MARK = -L / 2 + 0.02535;          // mark 1 on the slide (slide x); mark 2 = -MARK
  const STROKE = 0.0126, TILT = 0.639, HALF = 0.0481, BOW = 0.0015;
  const WHEEL = [0.00098, -0.02786, 0], WHEEL_R = 0, TIP_GAP = 0.0003;   // cutting tip of the head (equipment/tools.js)
  // timeline (s)
  const T = { blockUp: [0, 0.7], slideIn: [0.5, 1.3], slideDown: [1.3, 1.6], nudge1: [1.55, 1.7], blockDown: [1.7, 2.5], blockSlide1: [2.5, 3.1],
    cutIn: [3.1, 3.9], cutDown: [3.9, 4.2], stroke1: [4.2, 5.6], cutUp: [5.6, 6.0],
    blockLift: [6.0, 6.4], blockTurn: [6.4, 7.2], blockLower: [7.2, 7.6], blockSlide2: [7.6, 8.2], nudge2: [8.0, 8.2],
    cutMove: [8.2, 8.6], cutDown2: [8.6, 8.8], stroke2: [8.8, 10.2], cutUp2: [10.2, 10.5], cutHome: [10.5, 11.4], blockAside: [10.4, 11.4],
    baseLift: [11.4, 12.2], handsIn: [12.0, 12.4], press: [12.3, 12.6], bowUp: [12.6, 13.4], crack: 13.0, bowDown: [13.6, 14.2], handsOut: [14.2, 14.6],
    toDish: [14.6, 15.4], flip: [15.4, 16.0], release: 15.85, flipBack: [16.2, 16.8], baseHome: [16.8, 17.6], END: 17.8 };
  const OFFS = [[-0.021, -0.012, 0.4], [0.004, 0.014, -0.7], [0.022, -0.007, 1.9]];   // pieces in the dish (x, z, yaw), scaled by R

  C.register('glassCut', {
    label: 'Glass slide → 3 pieces (slide cutter)', unit: '',
    intro: T.END, outro: 1.4, noLoop: true, linear: true,
    moves: c => [c.base.obj, c.block.obj, c.slide.obj, c.cutter.obj],

    setup(k, c) {
      const { THREE } = k, s = { k, c };
      s.base = c.base.obj; s.block = c.block.obj; s.slide = c.slide.obj; s.cut = c.cutter.obj;
      [s.base, s.block, s.slide, s.cut].forEach(o => o.updateMatrixWorld(true));
      s.base0 = k.poseOf(s.base); s.B0 = s.base.matrixWorld.clone(); s.B0inv = s.B0.clone().invert();
      s.blockRel0 = s.B0inv.clone().multiply(s.block.matrixWorld);
      s.slide0 = k.poseOf(s.slide); s.cut0 = k.poseOf(s.cut); s.block0 = k.poseOf(s.block);
      const inner = c.cutter.inner || s.cut.children[0];
      s.innerInv = inner.matrix.clone().invert();
      // cutter model rotation in the base frame: axis (handle) up + towards the user (+z), wheel rolls along z
      const y = new THREE.Vector3(0, Math.cos(TILT), Math.sin(TILT)), x = new THREE.Vector3(0, -Math.sin(TILT), Math.cos(TILT)), z = new THREE.Vector3().crossVectors(x, y);
      s.Rc = new THREE.Matrix4().makeBasis(x, y, z); s.handle = y;
      s.contactL = new THREE.Vector3(...WHEEL).add(new THREE.Vector3(Math.sin(TILT), -Math.cos(TILT), 0).multiplyScalar(WHEEL_R));
      // score lines on the slide (grow behind the wheel)
      s.scoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false });
      s.scores = [MARK, -MARK].map(mx => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.0003, 0.00005, 1), s.scoreMat);
        m.position.set(mx, TH / 2 + 0.00003, 0); m.visible = false; m.renderOrder = 6; s.slide.add(m); return m; });
      // base bending (own copy of the geometry; the shared model is untouched)
      s.baseMesh = null; s.base.traverse(o => { if (!s.baseMesh && o.isMesh) s.baseMesh = o; });
      if (s.baseMesh) { s.geoOrig = s.baseMesh.geometry; s.baseMesh.geometry = s.geoOrig.clone(); s.pos0 = s.geoOrig.attributes.position.array.slice(); }
      s.hands = makeHands(THREE, s.base);
      // dish target
      s.dishW = k.world(c.dish.obj, new THREE.Vector3(0, 0, 0));
      s.flags = {};
      return s;
    },

    camAt(k, c, s, t) {
      const { THREE } = k, q = s.base0.quat;
      const dir = v => new THREE.Vector3(...v).normalize().applyQuaternion(q);
      const cutLook = s.base0.pos.clone().add(new THREE.Vector3(0, 0.004, 0));
      const S1 = { look: cutLook, eye: cutLook.clone().addScaledVector(dir([0.8, 1.1, -0.35]), 0.23) };   // from the side, above the slot: the handle leans away to the right
      const brk = baseBreakPos(k, s).add(new THREE.Vector3(0, 0.002, 0));
      const S2 = { look: brk, eye: brk.clone().addScaledVector(dir([0, 0.36, 1]), 0.2) };
      const mid = hoverPos(k, s).lerp(s.dishW, 0.5);
      const S3 = { look: mid, eye: mid.clone().addScaledVector(dir([0.15, 0.95, 0.8]), 0.36) };
      const mix = (A, B, u) => ({ look: A.look.clone().lerp(B.look, u), eye: A.eye.clone().lerp(B.eye, u) });
      if (t < T.baseLift[0]) return S1;
      if (t < T.toDish[0]) return mix(S1, S2, k.ease(k.smooth(T.baseLift[0], T.baseLift[1], t)));
      return mix(S2, S3, k.ease(k.smooth(T.toDish[0], T.toDish[1], t)));
    },
    shot(k, c, s) { return this.camAt(k, c, s, 0); },

    pose(k, c, s, phase, u) {
      const { THREE } = k, sm = (w, t) => k.smooth(w[0], w[1], t);
      if (phase === 'outro') {   // block from beside the base back onto it
        const v = k.ease(u);
        setRel(k, s, s.block, blockRel(k, s, 0, -0.068 * (1 - v), Math.PI * (1 - v), -0.001 * (1 - v) + Math.sin(Math.PI * v) * 0.04), s.B0);
        return 0;
      }
      const t = u * T.END;
      const B = baseMatrix(k, s, t);
      // ---- base: lift, bow, flip ----
      setM(k, s.base, B);
      const bow = BOW * (sm(T.bowUp, t) - sm(T.bowDown, t));
      setBow(s, bow);
      // ---- guide block ----
      let dx = 0, dz = 0, ang = 0, lift = 0;
      // placed in the MIDDLE of the base, then slid along the grooves until it mates the end wall (owner)
      if (t < T.blockUp[1]) { const v = k.ease(sm(T.blockUp, t)); dx = MID * v; lift = 0.045 * v; }
      else if (t < T.blockLift[0]) { lift = 0.045 * (1 - k.ease(sm(T.blockDown, t))); dx = MID + (-DX - MID) * k.ease(sm(T.blockSlide1, t)); }
      else if (t < T.blockAside[0]) {
        lift = 0.035 * (sm(T.blockLift, t) - sm(T.blockLower, t));
        const v = k.ease(sm(T.blockTurn, t)); ang = Math.PI * v;
        dx = -DX + (DX - MID) * v + (DX + MID) * k.ease(sm(T.blockSlide2, t));   // turned: middle = -MID, wall 2 = +DX
      } else { const v = k.ease(sm(T.blockAside, t)); dx = DX * (1 - v); dz = -0.068 * v; ang = Math.PI; lift = -0.001 * v + Math.sin(Math.PI * v) * 0.04; }
      setRel(k, s, s.block, blockRel(k, s, dx, dz, ang, lift), s.B0);
      // ---- slide / pieces ----
      const xs = -POCKET + L / 2 + 0.0004 * (1 - sm(T.nudge1, t)) + 0.0012 * sm(T.nudge2, t);
      const slideRel = new THREE.Matrix4().makeTranslation(xs, FLOOR + TH / 2 - (c.slide.centerY || 0) + 0.03 * (1 - sm(T.slideDown, t)), 0);
      if (t < T.slideIn[1]) {
        const A = s.slide0, Bp = decomp(k, s.B0.clone().multiply(slideRel));
        k.blendPose(s.slide, A, Bp, k.ease(sm(T.slideIn, t)), 0.02);
      } else if (t < T.crack) setM(k, s.slide, B.clone().multiply(slideRel));
      s.scores[0].visible = t > T.stroke1[0] && t < T.crack; s.scores[1].visible = t > T.stroke2[0] && t < T.crack;
      const grow = (w, i) => { const z = -STROKE + 2 * STROKE * k.smooth(w[0], w[1], t), len = Math.max(0.0001, Math.min(W, z + W / 2));
        s.scores[i].scale.z = len; s.scores[i].position.z = -W / 2 + len / 2; };
      grow(T.stroke1, 0); grow(T.stroke2, 1);
      if (t >= T.crack) {
        if (!s.pieces) makePieces(k, s);
        s.slide.visible = false;
        const gap = 0.00025 * k.smooth(T.crack, T.crack + 0.2, t);
        const relOf = i => {   // piece centre on the bowed base: lift + tilt follow the bow at its centre
          const p = s.pieceX[i] + (i - 1) * gap, yb = bow * (1 - (p / HALF) ** 2), slope = -2 * bow * p / (HALF * HALF);
          return new THREE.Matrix4().makeTranslation(p, FLOOR + TH / 2 + yb, 0).multiply(new THREE.Matrix4().makeRotationZ(Math.atan(slope)));
        };
        if (!s.flags.chips) { s.flags.chips = true;   // a few glass chips at the break
          for (const mx of [MARK, -MARK]) { const p = new THREE.Vector3(xs + mx, TOP, 0.012).applyMatrix4(B);
            k.fx.fall(p, p.clone().setY(s.base0.pos.y + 0.0005), 0xe6f2ee, 2, { grain: true, spread: 0.01 }); } }
        for (let i = 0; i < 3; i++) {
          const fallT = t - T.release - i * 0.06;
          if (fallT < 0) { setM(k, s.pieces[i], B.clone().multiply(relOf(i))); continue; }
          if (!s.relPose) { const BR = baseMatrix(k, s, T.release); s.relPose = [0, 1, 2].map(j => decomp(k, BR.clone().multiply(relOf(j)))); }
          const v = Math.min(1, fallT / 0.35), A = s.relPose[i], F = s.final[i], P = s.pieces[i];
          P.position.set(A.pos.x + (F.pos.x - A.pos.x) * v, A.pos.y + (F.pos.y - A.pos.y) * v * v, A.pos.z + (F.pos.z - A.pos.z) * v);
          P.quaternion.slerpQuaternions(A.quat, F.quat, Math.min(1, v * 1.2)); P.updateMatrixWorld(true);
        }
        if (t > T.release + 0.6 && !s.flags.given) { s.flags.given = true; c.onPieces && c.onPieces(s.pieces); }
      }
      // ---- hands (step 6 only) ----
      const op = sm(T.handsIn, t) - sm(T.handsOut, t);
      s.hands.set(op, sm(T.press, t), bow);
      // ---- glass cutter ----
      const at = (slotX, z, lft) => {
        const P = new THREE.Vector3(slotX, TOP + TIP_GAP, z).sub(s.contactL.clone().applyMatrix4(s.Rc)).addScaledVector(s.handle, lft);
        const Mm = new THREE.Matrix4().copy(s.Rc).setPosition(P);
        return decomp(k, s.B0.clone().multiply(Mm).multiply(s.innerInv));
      };
      if (t < T.cutIn[0]) setP(s.cut, s.cut0);
      else if (t < T.cutDown[0]) k.blendPose(s.cut, s.cut0, at(SLOT, -STROKE, 0.025), k.ease(sm(T.cutIn, t)), 0.03);
      else if (t < T.stroke1[0]) setP(s.cut, at(SLOT, -STROKE, 0.025 * (1 - sm(T.cutDown, t))));
      else if (t < T.cutUp[0]) setP(s.cut, at(SLOT, -STROKE + 2 * STROKE * sm(T.stroke1, t), 0));
      else if (t < T.cutMove[0]) setP(s.cut, at(SLOT, STROKE, 0.07 * k.ease(sm(T.cutUp, t))));
      else if (t < T.cutDown2[0]) k.blendPose(s.cut, at(SLOT, STROKE, 0.07), at(-SLOT, -STROKE, 0.025), k.ease(sm(T.cutMove, t)), 0.01);
      else if (t < T.stroke2[0]) setP(s.cut, at(-SLOT, -STROKE, 0.025 * (1 - sm(T.cutDown2, t))));
      else if (t < T.cutUp2[0]) setP(s.cut, at(-SLOT, -STROKE + 2 * STROKE * sm(T.stroke2, t), 0));
      else if (t < T.cutHome[0]) setP(s.cut, at(-SLOT, STROKE, 0.03 * k.ease(sm(T.cutUp2, t))));
      else k.blendPose(s.cut, at(-SLOT, STROKE, 0.03), s.cut0, k.ease(sm(T.cutHome, t)), 0.03);
      return 0;
    },

    complete(k, c, s) {   // Skip: pieces straight into the dish
      if (!s.pieces) makePieces(k, s);
      s.slide.visible = false;
      s.pieces.forEach((P, i) => setP(P, s.final[i]));
      if (!s.flags.given) { s.flags.given = true; c.onPieces && c.onPieces(s.pieces); }
    },

    cleanup(k, c, s) {
      if (s.baseMesh) { s.baseMesh.geometry.dispose(); s.baseMesh.geometry = s.geoOrig; }
      s.scores.forEach(m => { s.slide.remove(m); m.geometry.dispose(); }); s.scoreMat.dispose();
      s.hands.dispose();
    },
  });

  /* ---------- helpers ---------- */
  function decomp(k, m) { const pos = new k.THREE.Vector3(), quat = new k.THREE.Quaternion(); m.decompose(pos, quat, new k.THREE.Vector3()); return { pos, quat }; }
  function setP(o, P) { o.position.copy(P.pos); o.quaternion.copy(P.quat); o.updateMatrixWorld(true); }
  function setM(k, o, m) { setP(o, decomp(k, m)); }
  function setRel(k, s, o, rel, B) { setM(k, o, B.clone().multiply(rel)); }
  function blockRel(k, s, dx, dz, ang, lift) {
    const M = k.THREE.Matrix4;
    return new M().makeTranslation(dx, lift, dz).multiply(new M().makeRotationY(ang)).multiply(s.blockRel0);
  }
  function baseBreakPos(k, s) { return s.base0.pos.clone().add(new k.THREE.Vector3(0, 0.1, 0)); }
  function hoverPos(k, s) { return s.dishW.clone().add(new k.THREE.Vector3(0, 0.06, 0)); }
  function baseMatrix(k, s, t) {
    const { THREE } = k, sm = (a, b) => k.smooth(a, b, t);
    const p0 = s.base0.pos, pb = baseBreakPos(k, s), ph = hoverPos(k, s);
    let pos = p0.clone(), phi = 0;
    if (t < T.baseLift[0]) pos = p0.clone();
    else if (t < T.toDish[0]) pos = p0.clone().lerp(pb, k.ease(sm(...T.baseLift)));
    else if (t < T.baseHome[0]) pos = pb.clone().lerp(ph, k.ease(sm(...T.toDish)));
    else { const v = k.ease(sm(...T.baseHome)); pos = ph.clone().lerp(p0, v); pos.y += Math.sin(Math.PI * v) * 0.02; }
    phi = Math.PI * (k.ease(sm(...T.flip)) - k.ease(sm(...T.flipBack)));
    const q = s.base0.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), phi));
    return new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1));
  }
  function setBow(s, b) {
    if (!s.baseMesh) return;
    const a = s.baseMesh.geometry.attributes.position, p0 = s.pos0;
    for (let i = 0; i < a.count; i++) { const x = p0[i * 3]; a.array[i * 3 + 1] = p0[i * 3 + 1] + b * Math.max(0, 1 - (x / HALF) ** 2); }
    a.needsUpdate = true;
  }
  function makePieces(k, s) {
    const { THREE } = k;
    const mat = s.slide.isMesh ? s.slide.material : new THREE.MeshStandardMaterial({ color: 0xdcefe9, transparent: true, opacity: 0.45, roughness: 0.1 });
    const cuts = [-L / 2, MARK, -MARK, L / 2];
    s.pieces = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(cuts[i + 1] - cuts[i], TH, W), mat);
      m.renderOrder = 3; m.castShadow = false; s.k.scene.add(m); s.pieces.push(m);
    }
    // piece centres in the base frame: slide against wall 2 (centre POCKET - L/2) + the piece's centre on the slide
    const xc = POCKET - L / 2; s.pieceX = [0, 1, 2].map(i => xc + (cuts[i] + cuts[i + 1]) / 2);
    const R = s.c.dish.R / 0.043, dish = s.c.dish.obj, dq = new THREE.Quaternion(); dish.getWorldQuaternion(dq);
    s.final = OFFS.map(([x, z, yaw]) => ({
      pos: dish.localToWorld(new THREE.Vector3(x * R, s.c.dish.floorY + TH / 2 + 0.0002, z * R)),
      quat: dq.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, yaw, 0))) }));
  }

  /* ---------- outline hands (vector sketch: lines only, no fill) ----------
     Side view, mm. x = outwards from the base end, y = up from the base underside (base 0..3 mm thick).
     Fingers over the top near the end, palm at the end face, thumb under the base reaching to the middle. */
  const HAND = [[55, 9], [40, 11.5], [28, 14], [20, 16.5], [12, 17], [6, 15], [0, 14.6], [-6, 15.4], [-11, 14], [-17, 13.6], [-23, 12],
    [-27, 9.5], [-27.5, 6.5], [-25, 4], [-14, 3.4], [-3, 3.4], [2.5, 3.1], [3.5, 1.5], [3, -0.6], [-8, -0.7], [-20, -0.8], [-30, -1.1], [-35, -1.8],
    [-37.5, -3.6], [-36.5, -5.8], [-33, -7.4], [-25, -8.3], [-14, -9], [-4, -10.4], [6, -13.5], [16, -17], [28, -18.5], [42, -16], [55, -12]];
  const EXTRA = [[[6, 15], [1, 18], [-7, 18.6], [-14, 17.6], [-19, 15.2]],      // next finger behind
    [[-5, -4.4], [1, -4.6], [6, -6.4]],                                           // thumb crease
    [[49, 10], [49, -13.6]]];                                                     // cuff
  function ribbon(THREE, pts, w) {
    const pos = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      pos.push(pts[i][0] - dy * w / 2, pts[i][1] + dx * w / 2, 0, pts[i][0] + dy * w / 2, pts[i][1] - dx * w / 2, 0);
    }
    const idx = []; for (let i = 0; i < n - 1; i++) { const j = i * 2; idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
  }
  function makeHands(THREE, base) {
    const white = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const dark = new THREE.MeshBasicMaterial({ color: 0x1b2027, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const hands = [1, -1].map(side => {
      const g = new THREE.Group(); g.position.set(side * HALF, 0, 0.0335); g.scale.set(side * 0.001, 0.001, 0.001); g.visible = false;
      g.renderOrder = 7; base.add(g); return { g, meshes: [] };
    });
    let lastKey = '';
    const build = (press, bow) => {
      const key = press.toFixed(3) + '|' + bow.toFixed(6); if (key === lastKey) return; lastKey = key;
      // thumb points follow the bowed underside (+ close the small gap when pressing)
      const pts = HAND.map(([x, y]) => {
        if (y < 0 && x < 0) { const bx = (HALF - (-x) * 0.001) / HALF, k = Math.min(1, -x / 12);
          return [x, y + k * (press * 0.6 + bow * 1000 * Math.max(0, 1 - bx * bx))]; }
        return [x, y];
      });
      const lines = [pts, ...EXTRA];
      for (const h of hands) {
        h.meshes.forEach(m => { h.g.remove(m); m.geometry.dispose(); }); h.meshes = [];
        for (const l of lines) {
          const d = new THREE.Mesh(ribbon(THREE, l, 2.2), dark); d.position.z = -0.3; d.renderOrder = 7;
          const wte = new THREE.Mesh(ribbon(THREE, l, 1.1), white); wte.renderOrder = 8;
          h.g.add(d, wte); h.meshes.push(d, wte);
        }
      }
    };
    return {
      set(op, press, bow) {
        white.opacity = op; dark.opacity = op * 0.8;
        hands.forEach(h => h.g.visible = op > 0.01);
        if (op > 0.01) build(press, bow);
      },
      dispose() { hands.forEach(h => { h.meshes.forEach(m => m.geometry.dispose()); base.remove(h.g); }); white.dispose(); dark.dispose(); },
    };
  }
})();
