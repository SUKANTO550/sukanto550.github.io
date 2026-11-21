/* =====================================================================
   MARKER — write labels on equipment with the black permanent marker (owner, 2026-11-22)
   =====================================================================
   Hold the marker, click any equipment -> "Write a label…": 2 short lines (max 16 characters each). The marker
   comes over, the cap goes onto its back end, it writes, the cap goes back on. The text appears HANDWRITTEN in
   black marker ink on the item, facing you:
     round vessels (beaker, flask, vial, jar, bottle, cylinder)  on the glass, at about half height
     petri dish                                                  on the lid (or the base if it has no lid)
     glass slide / piece (substrate)                             on the BACK (underside, non-deposition side)
     anything else                                               on its side that faces you
   One label per item: writing again replaces it; "Wipe the label off" removes it.
   Permanent marker survives water; ACETONE / ETHANOL / IPA take it off (owner): a solvent rinse at the basin or
   an auto-clean wipes the label.
   API (also used by the Recipe book film, actions/synthesis): MARKER.apply(it, [l1, l2], { mode }) = instant label,
   MARKER.wipe(it), MARKER.anchor(it) = { obj, pos (world), normal (world) } where the marker writes.
   Plain <script>, loaded after lab_hooks.js (wraps its after / busy / tick hooks). */
(function () {
  const H = window.LAB_HOOKS;
  const MK = window.MARKER = {};
  let L = null, T = null, anim = null;
  const init0 = H.init; H.init = lab => { init0(lab); L = lab; T = L.THREE; };
  const after0 = H.after; H.after = (Ht, Tg, A) => { if (after0) after0(Ht, Tg, A); menu(Ht, Tg, A); };
  const busy0 = H.busy; H.busy = () => !!anim || (busy0 ? busy0() : false);
  const tick0 = H.tick; H.tick = dt => { if (tick0) tick0(dt); tick(dt); };
  const WIPES = ['acetone', 'ethanol', 'ipa'];
  const FONT = '"Segoe Print","Bradley Hand","Ink Free","Comic Sans MS",cursive';

  /* ---------------- where a label goes ---------------- */
  const rAt = (inner, y) => {
    if (y <= inner[0][0]) return inner[0][1];
    for (let i = 0; i < inner.length - 1; i++) { const [ya, ra] = inner[i], [yb, rb] = inner[i + 1]; if (y <= yb) return ra + (rb - ra) * ((y - ya) / (yb - ya || 1)); }
    return inner[inner.length - 1][1];
  };
  // the item that actually carries the label (petri dish -> its lid)
  const carrier = it => (it.vessel && it.kind === 'petri' && it.cap && typeof it.cap === 'object') ? it.cap : it;
  function modeOf(it) {
    if (it.type === 'substrate') return 'back';
    if (it.kind === 'petri' || it.type === 'cap' || it.kind === 'watchglass' || it.kind === 'boat') return 'top';
    if (it.vessel && it.vessel.inner && it.vessel.inner.length > 1) return 'round';
    return 'side';
  }
  // camera direction in the item's own frame (horizontal)
  function camLocal(obj) {
    obj.updateMatrixWorld(true);
    const c = obj.worldToLocal(L.camera.position.clone()); c.y = 0; if (c.lengthSq() < 1e-8) c.set(0, 0, 1); return c.normalize();
  }
  function localBox(obj) {
    obj.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(obj.matrixWorld).invert(), b = new T.Box3(), t = new T.Box3(), m = new T.Matrix4();
    obj.traverse(o => { if (o.isMesh && o.visible && !o.userData.markLabel && o.material && o.material.opacity !== 0) { o.geometry.computeBoundingBox(); t.copy(o.geometry.boundingBox).applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld)); b.union(t); } });
    return b;
  }
  // geometry of the label for an item: { mode, w, h, place(mesh), pos (local), normal (local) }
  function spec(it, mode) {
    const obj = it.obj, cam = camLocal(obj);
    let a = Math.atan2(cam.x, cam.z);
    // beakers / conical flasks carry their printed scale + patch on the front (+z): the label goes on the clear
    // glass beside it
    if (mode === 'round' && ['beaker', 'conical', 'screwflask'].includes(it.kind) && Math.abs(a) < 1.0) a = a < 0 ? a - 1.05 : a + 1.05;
    if (mode === 'round') {
      const inner = it.vessel.inner, y0 = inner[0][0], y1 = inner[inner.length - 1][0];
      const y = y0 + (y1 - y0) * (it.kind === 'vial' ? 0.42 : 0.38), r = rAt(inner, y) + 0.0024;
      const w = Math.min(0.06, Math.max(0.022, r * 1.5)), h = w * 0.42;
      const arc = w / r;
      return { mode, w, h, geo: () => new T.CylinderGeometry(r, r, h, 32, 1, true, a - arc / 2, arc), at: new T.Vector3(0, y, 0),
        pos: new T.Vector3(Math.sin(a) * r, y, Math.cos(a) * r), normal: new T.Vector3(Math.sin(a), 0, Math.cos(a)) };
    }
    const b = localBox(obj), cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
    const sx = 1 / (obj.scale.x || 1);                                // cut glass pieces are the slide scaled to 1/3
    if (mode === 'top' || mode === 'back') {
      const span = Math.min((b.max.x - b.min.x) / sx, b.max.z - b.min.z);
      const w = mode === 'back' ? Math.min(0.02, span * 0.8) : Math.min(0.05, Math.max(0.02, span * 0.55)), h = w * 0.42;
      const y = mode === 'back' ? b.min.y - 0.0002 : b.max.y + 0.0004;
      return { mode, w, h, geo: () => new T.PlaneGeometry(w, h), at: new T.Vector3(cx, y, cz), yaw: a, sx,
        pos: new T.Vector3(cx, y, cz), normal: new T.Vector3(0, mode === 'back' ? -1 : 1, 0) };
    }
    // side: flat on the box face nearest the camera
    const ex = (b.max.x - b.min.x) / 2, ez = (b.max.z - b.min.z) / 2, y = (b.min.y + b.max.y) / 2;
    const d = Math.abs(cam.x) * ex + Math.abs(cam.z) * ez + 0.001;
    const w = Math.min(0.06, Math.max(0.02, Math.min(b.max.y - b.min.y, 2 * Math.max(ex, ez)) * 0.6)), h = w * 0.42;
    const pos = new T.Vector3(cx + cam.x * d, y, cz + cam.z * d);
    return { mode, w, h, geo: () => new T.PlaneGeometry(w, h), at: pos, yaw: a, pos, normal: cam.clone() };
  }

  /* ---------------- the label ---------------- */
  function inkTex(lines) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 216; const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height); g.fillStyle = '#121315'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const rows = lines.filter(Boolean); const n = Math.max(1, rows.length);
    rows.forEach((t, i) => {
      let fs = n === 1 ? 120 : 84; do { g.font = `bold ${fs}px ${FONT}`; fs -= 4; } while (g.measureText(t).width > c.width - 30 && fs > 24);
      const y = n === 1 ? c.height / 2 : c.height * (i === 0 ? 0.3 : 0.74);
      g.save(); g.translate(c.width / 2, y); g.rotate((i ? 0.012 : -0.018)); g.fillText(t, 0, 0); g.restore();   // a little uneven, like handwriting
    });
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  MK.wipe = it0 => {
    const it = carrier(it0), lb = it.markLabel; if (!lb) return false;
    lb.mesh.parent && lb.mesh.parent.remove(lb.mesh); lb.mesh.geometry.dispose(); lb.mesh.material.map.dispose(); lb.mesh.material.dispose();
    it.markLabel = null; return true;
  };
  MK.label = it0 => { const it = carrier(it0); return it.markLabel ? it.markLabel.lines.slice() : null; };
  MK.apply = (it0, lines, { mode = null } = {}) => {
    const it = carrier(it0); MK.wipe(it);
    lines = (lines || []).map(s => String(s || '').trim()).filter(Boolean).slice(0, 2);
    if (!lines.length) return null;
    const sp = spec(it, mode || modeOf(it));
    const m = new T.Mesh(sp.geo(), new T.MeshStandardMaterial({ map: inkTex(lines), transparent: true, roughness: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
      side: sp.mode === 'round' ? T.FrontSide : T.DoubleSide }));
    m.userData.markLabel = true; m.renderOrder = 4; m.castShadow = false; m.receiveShadow = false;
    it.obj.add(m);
    if (sp.mode === 'round') m.position.copy(sp.at);
    else {
      // flat label: oriented in WORLD space (lids / pieces may be flipped or scaled): normal up (top), down (back) or
      // towards the camera (side); text reads from the camera. Local matrix = parentScale^-1 * T * R (stays rigid).
      const o = it.obj; o.updateMatrixWorld(true);
      const pW = o.localToWorld(sp.at.clone()), f = pW.clone().sub(L.camera.position).setY(0);
      if (f.lengthSq() < 1e-8) f.set(0, 0, -1); f.normalize();
      const n = sp.mode === 'top' ? new T.Vector3(0, 1, 0) : sp.mode === 'back' ? new T.Vector3(0, -1, 0) : f.clone().negate();
      const yv = sp.mode === 'side' ? new T.Vector3(0, 1, 0) : f.clone(), xv = new T.Vector3().crossVectors(yv, n).normalize();
      const qW = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(xv, yv, n));
      const pq = new T.Quaternion(), ps = new T.Vector3(), pp = new T.Vector3(); o.matrixWorld.decompose(pp, pq, ps);
      const qL = pq.clone().invert().multiply(qW);
      const posL = sp.at.clone().multiply(ps);                       // local position in unscaled parent units
      const Mr = new T.Matrix4().compose(posL, qL, new T.Vector3(1, 1, 1));
      m.matrixAutoUpdate = false; m.matrix.copy(new T.Matrix4().makeScale(1 / ps.x, 1 / ps.y, 1 / ps.z).multiply(Mr)); m.updateMatrixWorld(true);
    }
    it.markLabel = { mesh: m, lines };
    return m;
  };
  MK.anchor = (it0, mode) => {
    const it = carrier(it0), sp = spec(it, mode || modeOf(it));
    it.obj.updateMatrixWorld(true);
    const pos = it.obj.localToWorld(sp.pos.clone()), n = sp.normal.clone().transformDirection(it.obj.matrixWorld);
    return { obj: it.obj, pos, normal: n, mode: sp.mode };
  };

  /* ---------------- marker pose while writing (shared with the film) ---------------- */
  // tip on the label point, marker tilted ~35 deg off the surface normal, pointing in; cap on the back end
  MK.writePose = (mk, an, wig = 0) => {
    // a BACK label (glass piece lying on its face side up) is shown written from above, through the thin glass
    const n = an.mode === 'back' ? new T.Vector3(0, 1, 0) : an.normal, at = an.mode === 'back' ? an.pos.clone().add(new T.Vector3(0, 0.0014, 0)) : an.pos;
    const axis = n.clone().negate().multiplyScalar(0.75).add(new T.Vector3(0, -0.65, 0)).normalize();   // marker +z = tip direction
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), axis);
    const side = new T.Vector3(0, 1, 0).cross(n).normalize(); if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    const tipW = at.clone().addScaledVector(side, wig).addScaledVector(n, 0.0008);
    const tipLocal = new T.Vector3(0, mk.markerG.position.y, mk.tipZ);
    return { q, p: tipW.sub(tipLocal.applyQuaternion(q)) };
  };
  MK.capOff = (mk, f) => { if (mk.markerCap) mk.markerCap.position.z = mk.capZ0 + (-0.115 - mk.capZ0) * f; };   // slides onto the back end

  /* ---------------- menu + dialog (hand-held marker) ---------------- */
  function menu(Ht, Tg, A) {
    if (!Ht || Ht.type !== 'marker' || !Tg || Tg === Ht || Tg.fixed || Tg.machine && !Tg.vessel) return;
    const it = carrier(Tg), has = !!it.markLabel;
    for (let i = A.length - 1; i >= 0; i--) if (/^Nothing to do/.test(A[i].label)) A.splice(i, 1);
    A.unshift({ primary: !has && !A.some(a => a.primary), label: has ? `Write a new label on ${it.name} (replaces "${it.markLabel.lines.join(' / ')}")` : `Write a label on ${it.name}…`, fn: () => ask(Ht, Tg) });
    if (has) A.splice(1, 0, { label: 'Wipe the label off (acetone)', fn: () => { MK.wipe(it); L.toast(`Label wiped off ${it.name}.`, 'ok'); } });
  }
  function ask(mk, Tg) {
    const it = carrier(Tg), old = it.markLabel ? it.markLabel.lines : ['', ''];
    L.openDlg(`<h3>Write a label</h3><p></p><input class="l1" maxlength="16" placeholder="Line 1 (e.g. BFO-1)" style="width:100%;margin:6px 0;padding:7px;font-size:15px">
      <input class="l2" maxlength="16" placeholder="Line 2 (optional, e.g. 21-11 · 0.26 M)" style="width:100%;margin:0 0 8px;padding:7px;font-size:15px">
      <div class="row"><button class="c">Cancel</button><button class="o">Write</button></div>`, b => {
      b.querySelector('p').textContent = `On ${it.name} — black permanent marker (acetone / ethanol take it off).`;
      const i1 = b.querySelector('.l1'), i2 = b.querySelector('.l2'); i1.value = old[0] || ''; i2.value = old[1] || '';
      const go = () => { const lines = [i1.value, i2.value]; L.closeDlg(); if (!lines.some(s => s.trim())) { L.toast('Nothing written.'); return; } write(mk, Tg, lines); };
      b.querySelector('.c').onclick = () => L.closeDlg(); b.querySelector('.o').onclick = go;
      [i1, i2].forEach(x => x.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') go(); if (e.key === 'Escape') L.closeDlg(); }));
      setTimeout(() => i1.focus(), 30);
    });
  }
  // short animation: marker to the item, cap off, a few strokes, label appears, cap on, back to the hand
  function write(mk, Tg, lines) {
    const an = MK.anchor(Tg), o = mk.obj;
    L.scene.attach(o);
    anim = { mk, Tg, lines, an, t: 0, p0: o.position.clone(), q0: o.quaternion.clone() };
  }
  function tick(dt) {
    // permanent marker: a solvent rinse at the basin takes the label off (auto-clean: finish hook in auto_clean.js)
    if (L && L.items) for (const it of L.items) if (it.markLabel && it.wet && WIPES.includes(it.wet.solvent)) { MK.wipe(it); L.toast(`The ${it.wet.solvent === 'ipa' ? 'IPA' : L.CHEM[it.wet.solvent].name.toLowerCase()} rinse took the marker label off ${it.name}.`); }
    if (!anim) return;
    const A = anim, o = A.mk.obj; A.t += dt;
    const D = { in: 0.55, cap: 0.25, wr: 1.1, back: 0.5 }, t = A.t;
    const ease = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    if (t < D.in) { const v = ease(t / D.in), pose = MK.writePose(A.mk, { ...A.an, pos: A.an.pos.clone().addScaledVector(A.an.normal, 0.03) });
      o.position.lerpVectors(A.p0, pose.p, v); o.quaternion.slerpQuaternions(A.q0, pose.q, v); }
    else if (t < D.in + D.cap) { MK.capOff(A.mk, (t - D.in) / D.cap); const pose = MK.writePose(A.mk, { ...A.an, pos: A.an.pos.clone().addScaledVector(A.an.normal, 0.03 * (1 - (t - D.in) / D.cap)) }); o.position.copy(pose.p); o.quaternion.copy(pose.q); }
    else if (t < D.in + D.cap + D.wr) { const u = (t - D.in - D.cap) / D.wr, span = Math.min(0.02, A.an.mode === 'back' ? 0.008 : 0.016);
      const pose = MK.writePose(A.mk, A.an, (u - 0.5) * span + Math.sin(u * 40) * 0.0012); o.position.copy(pose.p); o.quaternion.copy(pose.q);
      if (u > 0.85 && !A.done) { A.done = true; MK.apply(A.Tg, A.lines); } }
    else { const u = Math.min(1, (t - D.in - D.cap - D.wr) / D.back); MK.capOff(A.mk, 1 - Math.min(1, u * 2));
      const pose = MK.writePose(A.mk, A.an); o.position.lerpVectors(pose.p, A.p0, ease(u)); o.quaternion.slerpQuaternions(pose.q, A.q0, ease(u));
      if (u >= 1) { if (!A.done) MK.apply(A.Tg, A.lines); MK.capOff(A.mk, 0); anim = null; L.toast(`Label written on ${carrier(A.Tg).name}: "${A.lines.filter(s => s.trim()).join(' / ')}".`, 'ok'); L.updateHand && L.updateHand(); } }
  }
})();
