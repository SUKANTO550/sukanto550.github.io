/* =====================================================================
   FURNITURE — movable base tables + office chair (owner, 2026-11-22)
   =====================================================================
   BASE TABLES (main table with its under-table shelf, machine table, balance table; NOT the racks, the computer
   desk, the fume hood or the basin): click empty bench space -> "Move this table". The table then follows the
   mouse / finger across the floor; R = turn 90 deg; click = put it down; Esc = cancel. A footprint on the floor
   shows green (free) or red (wall / other furniture in the way). Everything on the table moves with it (items,
   machines, the hotplates on the shelf). The area buttons follow the table (index.html VIEW_ON).
   Each base-table surface remembers its HOME frame (s.home) so the Recipe book film can place its props relative
   to where the table is now (actions/synthesis/synth_props.js).
   OFFICE CHAIR: click it -> "Turn the seat" (one slow spin) / "Move the chair": it rolls with the mouse, the castors
   steer to the direction of travel and roll; R or the mouse wheel turns the seat; click = leave it there.
   Plain <script>, loaded after lab_hooks.js (wraps its init / click / tick hooks). */
(function () {
  const H = window.LAB_HOOKS;
  let L = null, T = null, mv = null, swallowUp = false, ray = null, foot = null, spin = null, lastPtr = null;
  const init0 = H.init; H.init = lab => { init0(lab); init(lab); };
  const click0 = H.click; H.click = (t, s, x, y) => click(t, s, x, y) || (click0 ? click0(t, s, x, y) : false);
  const tick0 = H.tick; H.tick = dt => { if (tick0) tick0(dt); tick(dt); };

  function init(lab) {
    L = lab; T = L.THREE; ray = new T.Raycaster();
    for (const bt of L.baseTables) { bt.g.updateMatrixWorld(true); for (const s of bt.surfaces) { s.home = s.root.matrixWorld.clone(); s.baseTable = bt; } }
    foot = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0x3ccf6e, transparent: true, opacity: 0.28, depthWrite: false }));
    foot.rotation.x = -Math.PI / 2; foot.position.y = 0.004; foot.visible = false; foot.renderOrder = 6; L.scene.add(foot);
    addEventListener('pointermove', onMove, true);
    addEventListener('pointerdown', onDown, true);
    addEventListener('pointerup', onUp, true);
    addEventListener('keydown', onKey, true);
    addEventListener('wheel', onWheel, { capture: true, passive: false });
  }
  const busy = () => (window.SYNTH && window.SYNTH.run) || L.getHeld();

  /* ---------------- clicks ---------------- */
  function click(t, s, x, y) {
    if (mv) return true;
    if (t && t.type === 'chair') {
      L.openMenu('Office chair', [
        { label: 'Turn the seat (one slow spin)', fn: () => { spin = { t: 0, a0: L.chair.parts.top.rotation.y }; } },
        { label: 'Move the chair (R or mouse wheel turns the seat)', fn: () => start(chairTarget()) },
      ], x, y);
      return true;
    }
    if (!t && s && s.baseTable) {
      const bt = s.baseTable;
      L.openMenu(bt.name, [{ label: 'Move this table', fn: () => start(tableTarget(bt)) }], x, y);
      return true;
    }
    return false;
  }

  /* ---------------- move targets ---------------- */
  const snapYaw = a => Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
  function tableTarget(bt) {
    const g = bt.g;
    return { kind: 'table', name: bt.name, obj: g,
      ext: () => { const q = Math.abs(Math.round(snapYaw(g.rotation.y) / (Math.PI / 2))) % 2; return q ? { hx: bt.d / 2, hz: bt.w / 2 } : { hx: bt.w / 2, hz: bt.d / 2 }; },
      rotate: () => { g.rotation.y = snapYaw(g.rotation.y + Math.PI / 2); },
      hint: `Move the mouse to place the ${bt.name.toLowerCase()} · R = turn 90° · click = put it down · Esc = cancel` };
  }
  function chairTarget() {
    const c = L.chair;
    return { kind: 'chair', name: 'Office chair', obj: c.obj, ext: () => ({ hx: 0.33, hz: 0.33 }),
      rotate: () => { c.parts.top.rotation.y += Math.PI / 4; },
      hint: 'Move the mouse to roll the chair · R or the wheel turns the seat · click = leave it here · Esc = cancel' };
  }
  function start(tg) {
    if (busy()) { L.toast((window.SYNTH && window.SYNTH.run) ? 'Close the Recipe book film first.' : 'Put down what you are holding first.'); return; }
    mv = { tg, p0: tg.obj.position.clone(), r0: tg.obj.rotation.y, top0: tg.kind === 'chair' ? L.chair.parts.top.rotation.y : 0, off: null, ok: true, obstacles: obstacles(tg) };
    L.closeMenu && L.closeMenu();
    foot.visible = true; check();
    tips(false); L.toast(tg.hint, 'info', 6000);
  }
  function finish(keep) {
    if (!mv) return;
    if (!keep) { mv.tg.obj.position.copy(mv.p0); mv.tg.obj.rotation.y = mv.r0; if (mv.tg.kind === 'chair') L.chair.parts.top.rotation.y = mv.top0; }
    mv.tg.obj.updateMatrixWorld(true);
    foot.visible = false; mv = null; tips(true);
    L.renderer.shadowMap.needsUpdate = true; L.shadowPoke();
  }

  // the control-tips / holding lines hide while moving, so the hint toast is readable
  const tips = on => ['tip', 'hand'].forEach(id => { const e = document.getElementById(id); if (e) e.style.visibility = on ? '' : 'hidden'; });

  /* ---------------- free-spot check: room walls + other furniture (floor-level boxes) ---------------- */
  function obstacles(tg) {
    const list = [], box = new T.Box3();
    const add = o => { if (!o || o === tg.obj || !o.parent) return; box.setFromObject(o); if (box.isEmpty() || box.min.y > 1.3) return; list.push({ x0: box.min.x, x1: box.max.x, z0: box.min.z, z1: box.max.z }); };
    for (const bt of L.baseTables) add(bt.g);
    for (const o of L.fixedFurniture) add(o);
    if (tg.kind !== 'chair') add(L.chair.obj);
    return list;
  }
  function check() {
    const o = mv.tg.obj, e = mv.tg.ext(), R = L.ROOM, m = 0.02;
    const x0 = o.position.x - e.hx, x1 = o.position.x + e.hx, z0 = o.position.z - e.hz, z1 = o.position.z + e.hz;
    let ok = x0 > -R.x + m && x1 < R.x - m && z0 > -R.z + m && z1 < R.z - m, why = ok ? '' : 'The wall is in the way.';
    if (ok) for (const b of mv.obstacles) if (x0 < b.x1 && x1 > b.x0 && z0 < b.z1 && z1 > b.z0) { ok = false; why = 'Something is in the way there.'; break; }
    mv.ok = ok; mv.why = why;
    foot.scale.set(e.hx * 2, e.hz * 2, 1); foot.position.set(o.position.x, 0.004, o.position.z);
    foot.material.color.set(ok ? 0x3ccf6e : 0xe04848);
  }

  /* ---------------- pointer / keys (capture phase: the lab's own handlers do not see these while moving) ---------------- */
  function floorAt(e) {
    const r = L.renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), L.camera);
    const p = new T.Vector3(); return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), p) ? p : null;
  }
  function onMove(e) {
    lastPtr = e;
    if (!mv || (e.buttons & 6)) return;                   // right / middle drag = look around as usual
    const p = floorAt(e); if (!p) return;
    const o = mv.tg.obj;
    if (!mv.off) mv.off = o.position.clone().sub(p).setY(0);
    const prev = o.position.clone();
    o.position.set(p.x + mv.off.x, o.position.y, p.z + mv.off.z);
    if (mv.tg.kind === 'chair') roll(prev, o.position);
    check(); L.shadowPoke();
  }
  function onDown(e) {
    if (!mv || e.button !== 0) return;
    if (!e.target || e.target !== L.renderer.domElement) return;
    e.preventDefault(); e.stopImmediatePropagation(); swallowUp = true;
    if (!mv.off) { onMove(e); return; }                   // first touch on a phone: pick up the spot under the finger
    if (mv.ok) { const n = mv.tg.name; finish(true); L.toast(`${n} put down.`, 'ok'); } else L.toast(mv.why);
  }
  function onUp(e) { if (swallowUp && e.button === 0) { swallowUp = false; e.preventDefault(); e.stopImmediatePropagation(); } }
  function onKey(e) {
    if (!mv) return;
    if (e.code === 'Escape') { finish(false); L.toast('Moving cancelled.'); }
    else if (e.code === 'KeyR') { mv.tg.rotate(); check(); L.shadowPoke(); }
    else return;
    e.preventDefault(); e.stopImmediatePropagation();
  }
  function onWheel(e) {
    if (!mv || mv.tg.kind !== 'chair') return;
    e.preventDefault(); e.stopImmediatePropagation();
    L.chair.parts.top.rotation.y += Math.sign(e.deltaY) * 0.2; L.shadowPoke();
  }

  /* ---------------- chair: castors steer + roll; seat spin ---------------- */
  function roll(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d < 1e-5) return;
    const head = Math.atan2(dx, dz);
    for (const c of L.chair.parts.castors) {
      let dA = head - c.pivot.rotation.y; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
      c.pivot.rotation.y += dA * Math.min(1, d * 25 + 0.15);   // castors swing round to trail the motion
      c.wheel.rotation.x += d / 0.025;
    }
  }
  function tick(dt) {
    if (!spin) return;
    spin.t += dt; const u = Math.min(1, spin.t / 1.8), v = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    L.chair.parts.top.rotation.y = spin.a0 + v * Math.PI * 2; L.shadowPoke();
    if (u >= 1) spin = null;
  }
  window.FURNITURE = { start: n => { const bt = L.baseTables.find(b => b.name === n); if (bt) start(tableTarget(bt)); }, finish, get moving() { return !!mv; } };
})();
