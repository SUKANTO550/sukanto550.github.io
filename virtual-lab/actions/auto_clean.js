/* =====================================================================
   AUTO CLEAN — the basin's automatic cleaning protocol (owner, 2026-11-20).
   =====================================================================
   Protocol (fixed order): [empty into chemical waste] -> detergent wash + brush -> tap-water rinse
     -> acetone rinse -> IPA rinse -> air-dry. (No DI rinse - owner.)
   Where it starts:
     - click the basin / basin counter (hands empty): "Clean them all" = every item on the counter (batch)
     - click an item on the basin counter: "Clean automatically" (single)
     - hold an item, click the basin: "Clean automatically" (single), next to the manual wash / rinse
     - an action (pour, draw, scoop...) with unclean items: dialog "Clean all required" / "Continue anyway"
       (lab_hooks.js calls AUTO_CLEAN.guard). Only the items that still need it are cleaned, then the
       action goes on by itself.
   Each item flies to the basin, is washed there (animation), flies back to its place (or the hand).
   Time: the panel shows the PROTOCOL time (below). The first 2 s run in real time, then it is a
   time-lapse. A whole clean takes 30 s (one item) or 20 s per item (batch). The lab clock does not jump.
   Missing acetone / IPA wash bottle on the counter = warning, that rinse is skipped.
   Glass substrates: cleaned at once, no animation (their own protocol comes later).
   Manual washing (basin menu) is unchanged. */
(function () {
  const AC = window.AUTO_CLEAN = {};

  /* ---------- editable values ---------- */
  // protocol time shown on the panel (seconds) - typical practice (NIST GMP 7, TXST stockroom guide)
  const PROTO = { empty: 30, carry: 15, detergent: 120, tap: 30, rinse: 30, skip: 0, back: 15, dry: 900 };
  // relative screen time of each step (scaled so one item = SINGLE s, batch = BATCH s per item)
  const REAL = { empty: 2.5, carry: 2.5, detergent: 8, tap: 4.5, rinse: 4.5, skip: 1.2, back: 2, dry: 4 };
  // manual basin menu (same clip, no scaling): "Wash" = carry + detergent + tap + back, "Rinse" = carry + rinse + back
  const MANUAL = { carry: 1.2, detergent: 6, tap: 4.2, rinse: 4.2, back: 1 };
  const SINGLE = 30, BATCH = 20, REAL_FIRST = 2, DRY_ONLY = 3, RINSE_ML = 5;
  const SOLV = { acetone: 'acetone', ipa: 'IPA', ethanol: 'ethanol', water: 'DI water' };
  const LABEL = {
    empty: 'Emptying it into the chemical waste', carry: 'Carrying it to the basin',
    detergent: 'Detergent wash + brush (1–2 % solution), then pour it out', tap: 'Rinsing with tap water, then pour it out',
    back: 'Back to its place', dry: 'Air-drying',
  };
  // stream looks: tap water brighter / more opaque than before so it reads against the steel sink
  const TAP_COL = 0x7fbdf5, TAP_OP = 0.95, TAP_R = 0.0062;

  let L = null, THREE = null, run = null, panel = null, overlay = null, tapS = null, sqS = null, runS = null, pourS = null, brush = null, bubbles = null;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  /* ---------- which items ---------- */
  const NO_WASH = ['washBottle', 'tipbox', 'filterjar', 'boatstack', 'misc', 'cap', 'micropipette'];
  AC.cleanable = it => !!(it && !it.machine && !it.fixed && !it.isMain && !it.single && !NO_WASH.includes(it.type)
    && it.clean && it.clean !== 'na' && it.clean !== 'new' && !(it.type === 'substrate' && it.film));
  const capped = it => !!(it.cap && typeof it.cap === 'object');          // (it.cap is a number = capacity on pipettes)
  const notClean = it => it.clean === 'dirty' || it.clean === 'basin' || !!it.wet;
  // "required" = cleanable, empty (an item holding the chemical in use is never cleaned) and not clean yet
  const TR = () => window.TOOL_RULES || null;                  // actions/tool_rules.js
  const holdsTools = it => !!(TR() && TR().toolsAny(it) > 0);
  AC.needs = it => AC.cleanable(it) && L.totAll(it.contents) <= 0 && !capped(it) && !it.stirBar && !holdsTools(it) && notClean(it);
  const stateText = it => it.clean === 'dirty' ? 'dirty' : it.clean === 'basin' ? 'washed with water only, not rinsed'
    : it.wet ? `still wet (${Math.ceil(L.secsLeft(it))} s)` : 'clean';

  AC.busy = () => !!run;
  AC.state = () => run && run.jobs[run.i] && { seg: run.jobs[run.i].segs[run.jobs[run.i].seg], t: run.jobs[run.i].t };   // (debug / tests)

  /* ---------- init (from lab_hooks.js) ---------- */
  AC.init = lab => {
    L = lab; THREE = L.THREE;
    tapS = L.makeStream(); sqS = L.makeStream(); runS = L.makeStream(); pourS = L.makeStream();
    makeUI(); makeBrush();
  };

  function makeUI() {
    overlay = document.createElement('div');
    Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: 4, display: 'none', background: 'transparent' });
    ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'contextmenu', 'touchstart'].forEach(ev => overlay.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }, { passive: false }));
    document.body.appendChild(overlay);
    panel = document.createElement('div');
    Object.assign(panel.style, { position: 'fixed', left: '50%', bottom: '18px', transform: 'translateX(-50%)', zIndex: 6, display: 'none',
      background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px', padding: '10px 16px', minWidth: '300px', maxWidth: 'calc(100vw - 32px)' });
    panel.innerHTML = `<div class="t" style="color:var(--muted);font-size:12px"></div>
      <div class="s" style="font-weight:700;margin:4px 0 2px"></div>
      <div style="display:flex;align-items:baseline;gap:10px"><span class="c" style="font-size:26px;font-weight:700;font-variant-numeric:tabular-nums"></span>
        <span class="x" style="color:var(--muted);font-size:12px"></span><span style="flex:1"></span><button class="k">Skip (Esc)</button></div>
      <div style="height:5px;background:var(--panel2);border-radius:3px;margin-top:6px;overflow:hidden"><div class="p" style="height:100%;width:0;background:#4fb0ff"></div></div>`;
    document.body.appendChild(panel);
    panel.querySelector('.k').onclick = () => AC.skip();
  }
  function makeBrush() {
    brush = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.22, 10), new THREE.MeshStandardMaterial({ color: 0x8a96a3, metalness: 0.6, roughness: 0.4 }));
    handle.position.y = 0.11 + 0.045; brush.add(handle);
    const br = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.045, 14), new THREE.MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.95 }));
    br.position.y = 0.0225; brush.add(br); brush.br = br;
    bubbles = new THREE.Group();
    const bm = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, roughness: 0.2 });
    for (let i = 0; i < 14; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), bm);
      b.userData.o = { a: Math.random() * Math.PI * 2, r: Math.random(), y: Math.random(), s: 0.0025 + Math.random() * 0.0035, w: Math.random() * 6 };
      bubbles.add(b);
    }
  }

  /* ---------- menus ---------- */
  function counterList() {
    return L.sCounter.items.filter(it => AC.cleanable(it) && (notClean(it) || L.totAll(it.contents) > 0));
  }
  function bringBottles() {
    let n = 0, full = 0;
    for (const it of L.items) {
      if (it.type !== 'washBottle' || it.surface === L.sCounter || it === L.getHeld() || !it.obj.parent) continue;
      const f = L.findFree(L.sCounter, it);
      if (!f) { full++; continue; }
      L.placeOn(it, L.sCounter, f.x, f.z); n++;
    }
    L.toast(n ? `${n} wash bottle${n > 1 ? 's' : ''} brought to the basin counter.` : full ? 'No free space on the basin counter.' : 'All wash bottles are already at the basin.', n ? 'ok' : 'info');
  }
  const bringEntry = () => ({ label: 'Bring all wash bottles to the basin', fn: bringBottles });
  const s20 = n => `~${n * (n > 1 ? BATCH : SINGLE)} s`;

  // basin / counter clicked with empty hands (index.html onClick)
  AC.click = (t, s, x, y) => {
    if (!L || run) return false;
    if ((t && t.type === 'basin') || (!t && s === L.sCounter)) {
      const list = counterList();
      L.openMenu('Basin (sink)', [
        list.length ? { label: `Clean them all — ${list.length} item${list.length > 1 ? 's' : ''} on the counter (${s20(list.length)})`, fn: () => AC.run(list, { batch: list.length > 1 }) }
                    : { label: 'Clean them all (put items on the basin counter first)', disabled: true },
        bringEntry(),
        { label: 'Manual: pick up an item, then click the basin to wash / rinse it', disabled: true },
      ], x, y);
      return true;
    }
    if (t && t.surface === L.sCounter && AC.cleanable(t)) {
      L.openMenu(t.name, [
        { label: `Clean automatically (full protocol, ${s20(1)})`, fn: () => AC.run([t], { batch: false }) },
        { label: 'Pick up', fn: () => window.__lab.pickUp(t) },
      ], x, y);
      return true;
    }
    return false;
  };
  // holding H, clicked the basin: add the automatic entry above the manual ones
  AC.basinActions = (H, A) => {
    if (AC.cleanable(H)) A.unshift({ label: `Clean automatically (full protocol, ${s20(1)})`, fn: () => AC.run([H], { batch: false }) });
    A.push(bringEntry());
  };

  // an action is about to use these items: offer to clean the ones that need it (warnings never block)
  AC.guard = (list, go) => {
    const need = [...new Set(list.filter(Boolean))].filter(AC.needs);
    if (!need.length || run) return go();
    const rows = need.map(it => `<li><b></b> — <span></span></li>`).join('');
    L.openDlg(`<h3>Not clean yet</h3><p>These items are needed for this step and are not clean:</p><ul style="margin:6px 0 10px 18px;padding:0">${rows}</ul>
      <p style="color:var(--muted);font-size:12px">Clean them at the basin (automatic protocol), or go on anyway — that counts as a mistake.</p>
      <div class="row"><button class="c">Continue anyway</button><button class="o">Clean all required (${need.length})</button></div>`, b => {
      b.querySelectorAll('li').forEach((li, i) => { li.querySelector('b').textContent = need[i].name; li.querySelector('span').textContent = stateText(need[i]); });
      b.querySelector('.c').onclick = () => { L.closeDlg(); go(); };
      b.querySelector('.o').onclick = () => { L.closeDlg(); AC.run(need, { batch: need.length > 1, then: go }); };
    });
  };


  /* ---------- run ---------- */
  function startRun(jobs, { batch = false, then = null, held = null, manual = false } = {}) {
    L.closeMenu && L.closeMenu();
    const look = waterPoint().clone(); look.y -= 0.15; look.z += 0.06;
    run = { jobs, i: -1, batch: jobs.length > 1 || batch, then, warned: {}, heldAtStart: held, manual,
      cam: { p: L.camera.position.clone(), t: L.controls.target.clone() },
      view: { t: look, p: look.clone().add(V(0.06, 0.2, 0.52)) }, phase: 'in', u: 0 };
    overlay.style.display = 'block'; panel.style.display = 'block';
    ['tip', 'hand'].forEach(id => { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; });
    nextJob();
  }
  AC.run = (list, { batch = false, then = null } = {}) => {
    if (run) return;
    list = [...new Set(list)].filter(AC.cleanable);
    const jobs = [];
    for (const it of list) {
      if (capped(it)) { L.toast(`Take the ${it.cap.fit && it.cap.fit.startsWith('petri') ? 'lid' : 'cap'} off ${it.name} first.`, 'warn'); continue; }
      if (it.stirBar) { L.toast(`Take the stir bar out of ${it.name} first.`, 'warn'); continue; }
      if (holdsTools(it)) { L.toast(`Take the tools out of ${it.name} first.`, 'warn'); continue; }
      if (it.type === 'substrate') { finishState(it, true); L.toast(`${it.name} cleaned.`, 'ok'); continue; }   // owner: no animation for now
      jobs.push({ it });
    }
    if (!jobs.length) { then && then(); return; }
    const held = L.getHeld();
    if (held && jobs.some(j => j.it === held)) L.releaseHeld();
    startRun(jobs, { batch, then, held });
  };
  // manual basin menu (index.html washBasin / rinse): the same clip, only its wash or rinse part.
  // done() = the lab's own result (clean state, wash bottle use, toasts, mistakes).
  AC.manualClean = (H, kind, sol, wb, done) => {
    if (!L || run) return false;
    const held = L.getHeld();
    if (held === H) L.releaseHeld();
    startRun([{ it: H, manual: { kind, sol, wb, done } }], { held, manual: true });
    return true;
  };

  AC.skip = () => {
    if (!run || run.phase === 'out') return;
    { const j = run.jobs[run.i]; if (j && j.started) resetFx(j); }
    for (let k = Math.max(0, run.i); k < run.jobs.length; k++) {
      const j = run.jobs[k];
      if (!j.started) startJob(j, true);
      if (j.dryOnly) { finishState(j.it, true); continue; }
      if (!j.home) placeBack(j);
      if (j.manual) { finishManual(j); continue; }
      if (L.totAll(j.it.contents) > 0) emptyIt(j.it);
      for (const sol of ['acetone', 'ipa']) if (j.wb[sol] && !j.rinsed[sol]) rinseUse(j, sol);
      finishState(j.it, j.rinsedAny);
    }
    run.i = run.jobs.length; endAll();
  };

  /* ---------- one item ---------- */
  function nextJob() {
    run.i++;
    if (run.i >= run.jobs.length) return endAll();
    startJob(run.jobs[run.i]);
  }
  function startJob(j, quiet = false) {
    const it = j.it;
    j.started = true; j.t = 0; j.seg = -1; j.rinsed = {}; j.rinsedAny = false; j.wb = {};
    if (j.manual) {
      const m = j.manual;
      if (m.kind === 'rinse') j.wb[m.sol] = m.wb;
      const ks = m.kind === 'wash' ? [{ k: 'carry' }, { k: 'detergent' }, { k: 'tap' }, { k: 'back' }] : [{ k: 'carry' }, { k: 'rinse', sol: m.sol }, { k: 'back' }];
      ks.forEach(s => { s.real = MANUAL[s.k]; s.proto = PROTO[s.k]; });
      j.segs = ks;
      j.origin = (it === run.heldAtStart && !it.surface) ? { hand: true, prev: it.prev }
        : it.surface ? { s: it.surface, x: it.obj.position.x, z: it.obj.position.z } : { s: L.sMain, x: 0, z: 0, free: true };
    } else {
      // a clean item that is only still wet: just let it dry (no washing again)
      if (it.clean === 'clean' && it.wet && L.totAll(it.contents) <= 0) {
        j.dryOnly = true; j.home = true;
        j.segs = [{ k: 'dry', real: DRY_ONLY, proto: Math.round(PROTO.dry * (1 - it.wet.p)) }];
        return finishSetup(j);
      }
      if (it.pumpG && window.LAB_HOOKS && window.LAB_HOOKS.detachPump) window.LAB_HOOKS.detachPump(it, L.sCounter);
      for (const sol of ['acetone', 'ipa']) {
        j.wb[sol] = L.sCounter.items.find(i => i.type === 'washBottle' && i.solvent === sol && L.totLiq(i.contents) > 1) || null;
        if (!j.wb[sol] && !quiet && !run.warned[sol]) { run.warned[sol] = true; L.toast(`⚠ No ${SOLV[sol]} wash bottle at the basin — that rinse is skipped. (Basin menu: "Bring all wash bottles".)`, 'warn', 5000); }
      }
      const segs = [];
      if (L.totAll(it.contents) > 0) segs.push({ k: 'empty' });
      segs.push({ k: 'carry' }, { k: 'detergent' }, { k: 'tap' });
      for (const sol of ['acetone', 'ipa']) segs.push({ k: j.wb[sol] ? 'rinse' : 'skip', sol });
      segs.push({ k: 'back' }, { k: 'dry' });
      const total = segs.reduce((a, s) => a + REAL[s.k], 0), scale = (run.batch ? BATCH : SINGLE) / total;
      segs.forEach(s => { s.real = REAL[s.k] * scale; s.proto = PROTO[s.k]; });
      j.segs = segs;
      // where it goes back to (tool_rules.js: clean tools only into a clean holder; vessels never back onto the open rack)
      if (it === run.heldAtStart && !it.surface) j.origin = { hand: true, prev: it.prev };
      else if (TR() && TR().isTool(it)) {
        const slot = TR().holderFor(it, waterPoint());
        if (slot) { slot.reserved = true; j.origin = { s: slot, x: 0, z: 0, slot: true }; }
        else {
          j.origin = { s: L.sCounter, x: 0, z: 0, free: true };
          if (!quiet) L.toast(`⚠ No free clean holder (tool stand, clean beaker or petri dish) for ${it.name} — it will be left on the basin counter and get dirty.`, 'warn', 6000);
        }
      }
      else if (it.surface && TR() && TR().isRack(it.surface)) j.origin = { s: L.sMain, x: 0, z: 0, free: true };
      else if (it.surface) j.origin = { s: it.surface, x: it.obj.position.x, z: it.obj.position.z };
      else j.origin = { s: L.sMain, x: 0, z: 0, free: true };
    }
    if (quiet) return;
    it.busy = true;
    if (it.surface) L.removeFrom(it);
    L.scene.attach(it.obj);
    L.setPose(it, true);
    finishSetup(j);
  }
  function finishSetup(j) {
    let rc = 0, pc = 0; j.keys = [[0, 0]];
    j.segs.forEach(s => { s.r0 = rc; s.p0 = pc; rc += s.real; pc += s.proto; j.keys.push([rc, pc]); });
    j.realTotal = rc; j.protoTotal = pc;
    // panel clock: real time for the first 2 s, then each step compressed into its screen time
    j.clock = t => {
      if (t <= REAL_FIRST) return Math.min(t, pc);
      const ks = j.keys.filter(k => k[0] > REAL_FIRST && k[1] > REAL_FIRST);
      let a = [REAL_FIRST, Math.min(REAL_FIRST, pc)];
      for (const b of ks) { if (t <= b[0]) return a[1] + (b[1] - a[1]) * (t - a[0]) / Math.max(1e-6, b[0] - a[0]); a = b; }
      return pc;
    };
  }

  /* ---------- positions ---------- */
  function waterPoint() { return L.basin.obj.localToWorld(L.basin.spout.clone()); }
  const qE = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
  const Q0 = () => new THREE.Quaternion();
  function mouthOf(it) {                                         // local mouth height / radius, floor
    const v = it.vessel; if (!v) return { y: it.h, r: 0.008, floor: 0, hollow: false };
    const top = v.inner[v.inner.length - 1]; return { y: top[0], r: top[1], floor: v.inner[0][0], hollow: true };
  }
  // upright under the tap: the mouth 6 cm below the spout, on its axis
  function tapPose(it) { const a = waterPoint(), m = mouthOf(it); return { p: V(a.x, a.y - 0.06 - m.y, a.z), q: Q0() }; }
  function rinsePose(it) { return { p: L.basin.obj.localToWorld(V(0.3, 0.965, 0.08)), q: Q0() }; }
  // mouth down over the middle of the bowl (tipped ~125 deg to the left)
  const DUMP_TILT = 2.2;
  function dumpPose(it) {
    const m = mouthOf(it), q = qE(0, 0, DUMP_TILT), M = L.basin.obj.localToWorld(V(0.3, 0.95, 0.03));
    return { p: M.sub(V(0, m.y, 0).applyQuaternion(q)), q };
  }
  function binPose() { const p = new THREE.Vector3(); L.bin.obj.getWorldPosition(p); p.y += 0.78; return { p, q: qE(0, 0, 2.1) }; }
  function bowlFloorY() { return L.basin.obj.localToWorld(V(0, L.basin.bowlY, 0)).y; }
  function homePose(j) {
    const o = j.origin;
    if (o.hand) {
      const d = new THREE.Vector3(); L.camera.getWorldDirection(d);
      return { p: L.camera.position.clone().addScaledVector(d, 0.45).add(V(0, -0.08, 0)), q: Q0() };
    }
    if (o.free || !o.s.root.parent) {
      const ss = o.s && o.s.root.parent ? o.s : L.sMain;
      let f = L.findFree(ss, j.it); o.s = ss;
      if (!f) { f = L.findFree(L.sMain, j.it) || { x: 0, z: 0 }; o.s = L.sMain; }
      o.x = f.x; o.z = f.z; o.free = false;
    }
    const q = Q0(); o.s.root.getWorldQuaternion(q); q.multiply(qE(0, j.it.rotY || 0, 0));
    return { p: o.s.root.localToWorld(V(o.x, j.it.baseY || 0, o.z)), q };
  }
  function placeBack(j) {
    const it = j.it; j.home = true; it.busy = false;
    if (j.origin.hand) { L.holdItem(it, j.origin.prev); return; }
    if (j.origin.free || !j.origin.s.root.parent) homePose(j);
    const s = j.origin.s;
    if (j.origin.slot) { s.reserved = false; if (!s.items.length) return L.placeOn(it, s, 0, 0); j.origin = { s: L.sCounter, free: true }; homePose(j); return placeBack(j); }
    const clash = L.fpClash(s, it, j.origin.x, j.origin.z, it.rotY || 0, 0);
    if (clash) { const f = L.findFree(s, it); if (f) { j.origin.x = f.x; j.origin.z = f.z; } else return L.autoPlace(it, [L.sMain]); }
    L.placeOn(it, s, j.origin.x, j.origin.z);
  }

  /* ---------- state changes ---------- */
  function emptyIt(it) {
    L.chemsIn(it.contents).forEach(id => it.residue.add(id));
    it.contents = L.emptyC();
    if (it.type !== 'vessel') L.refreshTool(it);
  }
  function rinseUse(j, sol) {
    const wb = j.wb[sol]; if (!wb) return;
    wb.contents.liq[sol] = Math.max(0, (wb.contents.liq[sol] || 0) - RINSE_ML);
    j.rinsed[sol] = true; j.rinsedAny = true;
  }
  function finishState(it, rinsed) {
    it.clean = rinsed ? 'clean' : 'basin'; it.residue.clear(); if (it.flags) it.flags.rinsed = null;
    if (it.vessel) it.contents = L.emptyC();
    it.wet = null; it.dryTick = L.now() + 2; it.busy = false; L.touch(it);
    if (TR() && it !== L.getHeld()) TR().check(it);              // e.g. a tool left on the counter = dirty again
  }
  function finishManual(j) {
    const it = j.it; it.busy = false;
    if (it.vessel) it.contents = L.emptyC();
    j.manual.done();
  }
  // the wash water shown inside a vessel during a step (never real contents: cleared at the end)
  function setFill(it, id, ml) { if (!it.vessel) return; it.contents = L.emptyC(); if (ml > 0.02) it.contents.liq[id] = ml; }
  const fillOf = it => it.vessel ? L.totLiq(it.contents) : 0;
  function fillMax(it, kind) {
    if (!it.vessel) return 0; const cap = it.vessel.cap;
    return kind === 'detergent' ? Math.min(cap * 0.35, 80) : kind === 'tap' ? Math.min(cap * 0.3, 60) : Math.max(0.6, Math.min(cap * 0.06, 8));
  }

  /* ---------- per-frame ---------- */
  AC.tick = dt => {
    if (!run) return;
    // camera glide in / out
    if (run.phase === 'in' || run.phase === 'out') {
      run.u = Math.min(1, run.u + dt / 0.8);
      const e = 1 - Math.pow(1 - run.u, 3);
      const [a, b] = run.phase === 'in' ? [run.cam, run.view] : [run.view, run.cam];
      L.camera.position.lerpVectors(a.p, b.p, e); L.controls.target.lerpVectors(a.t, b.t, e); L.camera.lookAt(L.controls.target);
      if (run.u >= 1) { if (run.phase === 'out') return finishRun(); run.phase = 'run'; }
      if (run.phase === 'out') return;
    } else { L.camera.position.copy(run.view.p); L.controls.target.copy(run.view.t); L.camera.lookAt(run.view.t); }
    const j = run.jobs[run.i]; if (!j) return;
    j.t += dt;
    let si = j.segs.findIndex(s => j.t < s.r0 + s.real);
    if (si < 0) si = j.segs.length;
    while (j.seg < si) { if (j.seg >= 0) leave(j, j.segs[j.seg]); j.seg++; if (j.seg < j.segs.length) enter(j, j.segs[j.seg]); }
    if (si >= j.segs.length) { endJob(j); return; }
    const s = j.segs[si];
    update(j, s, (j.t - s.r0) / s.real, dt);
    // panel
    const c = j.clock(j.t), slope = j.t > REAL_FIRST && s.real > 0 ? Math.round(s.proto / s.real) : 1;
    const head = j.manual ? (j.manual.kind === 'wash' ? 'Washing: ' : 'Rinsing: ') : run.jobs.length > 1 ? `Auto-clean ${run.i + 1} / ${run.jobs.length}: ` : 'Auto-clean: ';
    panel.querySelector('.t').textContent = head + j.it.name;
    panel.querySelector('.s').textContent = s.k === 'skip' ? `${SOLV[s.sol]} rinse skipped — no wash bottle at the basin`
      : s.k === 'rinse' ? `Rinsing with ${SOLV[s.sol]}, then pour it out` : LABEL[s.k];
    panel.querySelector('.c').textContent = `${fmt(c)} / ${fmt(j.protoTotal)}`;
    panel.querySelector('.x').textContent = j.t <= REAL_FIRST ? 'real time' : slope > 1 ? `time-lapse ×${slope}` : 'time-lapse';
    panel.querySelector('.p').style.width = `${Math.min(100, 100 * j.t / j.realTotal)}%`;
  };
  const fmt = s => { s = Math.round(s); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  function enter(j, s) {
    const it = j.it;
    s.from = { p: it.obj.position.clone(), q: it.obj.quaternion.clone() };
    if (s.k === 'empty') s.to = binPose();
    else if (s.k === 'carry' || s.k === 'detergent' || s.k === 'tap') s.to = tapPose(it);
    else if (s.k === 'rinse' || s.k === 'skip') s.to = rinsePose(it);
    else if (s.k === 'back') s.to = homePose(j);
    else s.to = s.from;
    s.spin = 0;
  }
  function leave(j, s) {
    const it = j.it;
    hideStreams();
    if (s.k === 'empty') emptyIt(it);
    if (s.k === 'detergent') detachBrush();
    if (s.k === 'detergent' || s.k === 'tap' || s.k === 'rinse') setFill(it, 'water', 0);
    if (s.k === 'tap') it.residue.clear();
    if (s.k === 'rinse') { if (!j.manual) rinseUse(j, s.sol); wbBack(s, j.wb[s.sol]); }
    if (s.k === 'back') { it.obj.position.copy(s.to.p); it.obj.quaternion.copy(s.to.q); placeBack(j); }
  }
  function hideStreams() { tapS.visible = false; sqS.visible = false; runS.visible = false; pourS.visible = false; }
  function resetFx(j) {
    hideStreams(); detachBrush();
    const s = j.segs && j.seg >= 0 ? j.segs[j.seg] : null;
    if (s && s.k === 'rinse') wbBack(s, j.wb[s.sol]);
    if (j.it.vessel && s && ['detergent', 'tap', 'rinse'].includes(s.k)) setFill(j.it, 'water', 0);
  }
  function endJob(j) {
    resetFx(j);
    if (!j.home) placeBack(j);
    if (j.manual) finishManual(j);
    else {
      finishState(j.it, j.dryOnly ? true : j.rinsedAny);
      L.toast(`${j.it.name} cleaned${j.dryOnly ? ' (dried)' : j.rinsedAny ? '' : ' with water only — no solvent rinse'}.`, j.rinsedAny || j.dryOnly ? 'ok' : 'warn');
    }
    nextJob();
  }
  function endAll() {
    hideStreams(); detachBrush();
    run.phase = 'out'; run.u = 0;
  }
  function finishRun() {
    const then = run.then; run = null;
    overlay.style.display = 'none'; panel.style.display = 'none';
    ['tip', 'hand'].forEach(id => { const e = document.getElementById(id); if (e) e.style.visibility = ''; });
    L.updateHand && L.updateHand();
    if (then) then();
  }

  /* ---------- motion helpers ---------- */
  const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const clamp01 = x => Math.max(0, Math.min(1, x));
  const sub = (k, a, b) => clamp01((k - a) / (b - a));            // progress of k inside [a, b]
  function fly(it, s, k, arc = 0.22) {
    const e = ease(Math.min(1, k));
    it.obj.position.lerpVectors(s.from.p, s.to.p, e); it.obj.position.y += Math.sin(Math.PI * e) * arc;
    it.obj.quaternion.slerpQuaternions(s.from.q, s.to.q, e);
  }
  function moveTo(it, from, to, k, arc = 0) {
    const e = ease(clamp01(k));
    it.obj.position.lerpVectors(from.p, to.p, e); it.obj.position.y += Math.sin(Math.PI * e) * arc;
    it.obj.quaternion.slerpQuaternions(from.q, to.q, e);
  }
  const poseNow = it => ({ p: it.obj.position.clone(), q: it.obj.quaternion.clone() });
  function swirl(it, base, t, amp = 0.1) { it.obj.position.copy(base.p); it.obj.quaternion.copy(base.q).multiply(qE(amp * Math.sin(t * 9), 0, amp * Math.cos(t * 9))); }
  function spinAt(it, base, ang) { it.obj.position.copy(base.p); it.obj.quaternion.copy(base.q).multiply(qE(0, ang, 0)); }
  // world y of the liquid surface inside (or the floor / top for a tool)
  function surfaceW(it) {
    const m = mouthOf(it); if (!m.hollow) return it.obj.localToWorld(V(0, it.h * 0.9, 0)).y;
    const ml = fillOf(it); return it.obj.localToWorld(V(0, ml > 0.02 ? L.heightFor(it.vessel, ml) : m.floor, 0)).y;
  }
  function tapOn(it) {
    const a = waterPoint();
    L.setStream(tapS, a, V(a.x, Math.min(a.y - 0.01, surfaceW(it)), a.z), TAP_R, new THREE.Color(TAP_COL), TAP_OP);
  }
  // tip it mouth-down over the bowl; the water pours out of the low lip into the sink
  function dump(j, s, u, id) {
    const it = j.it, m = mouthOf(it);
    if (!s.dp) s.dp = { from: poseNow(it), to: dumpPose(it), v0: fillOf(it) };
    moveTo(it, s.dp.from, s.dp.to, u / 0.4, 0.02);
    if (!m.hollow) { if (u > 0.4) it.obj.quaternion.copy(s.dp.to.q).multiply(qE(0.08 * Math.sin(u * 40), 0, 0)); return; }   // tools: shake off
    const left = s.dp.v0 * (1 - ease(sub(u, 0.22, 0.9)));
    setFill(it, id, left);
    if (s.dp.v0 > 0.02 && u > 0.22 && u < 0.92) {
      it.obj.updateMatrixWorld(true);
      const lip = it.obj.localToWorld(V(-m.r, m.y, 0)), flow = Math.max(0.15, 1 - sub(u, 0.22, 0.92));
      L.setStream(pourS, lip, V(lip.x, bowlFloorY() + 0.002, lip.z), (id === 'water' ? 0.0048 : 0.0026) * Math.sqrt(flow),
        new THREE.Color(id === 'water' ? TAP_COL : 0xdfeeff), id === 'water' ? 0.9 : 0.75);
    } else pourS.visible = false;
  }

  /* ---------- one step, k = 0..1 ---------- */
  function update(j, s, k, dt) {
    const it = j.it;
    if (s.k === 'empty') { fly(it, s, k / 0.6); if (k > 0.6 && !s.binOpen) { s.binOpen = true; L.binDrop(null); } return; }
    if (s.k === 'carry' || s.k === 'back') return fly(it, s, k, s.k === 'back' && j.origin.hand ? 0.05 : 0.22);
    if (s.k === 'dry') return;
    s.spin += dt * 1.6;
    if (s.k === 'detergent') {
      // fill under the tap -> scrub with the brush (tap off) -> pour the detergent water out
      if (k < 0.08) { moveTo(it, s.from, s.to, k / 0.08); return; }
      if (k < 0.2) { spinAt(it, s.to, 0); tapOn(it); setFill(it, 'water', fillMax(it, 'detergent') * sub(k, 0.08, 0.2)); return; }
      if (!s.br) { s.br = true; attachBrush(it); }
      if (k < 0.66) { tapS.visible = false; spinAt(it, s.to, s.spin); moveBrush(it, j.t); return; }
      if (!s.noBrush) { s.noBrush = true; detachBrush(); }
      return dump(j, s, sub(k, 0.66, 1), 'water');
    }
    if (s.k === 'tap') {
      // back under the tap -> fill -> swirl -> pour out
      if (!s.back) s.back = poseNow(it);
      if (k < 0.14) { moveTo(it, s.back, s.to, k / 0.14, 0.02); return; }
      if (k < 0.46) { spinAt(it, s.to, s.spin * 0.5); tapOn(it); setFill(it, 'water', fillMax(it, 'tap') * sub(k, 0.14, 0.46)); return; }
      if (k < 0.62) { tapS.visible = false; swirl(it, s.to, j.t); return; }
      return dump(j, s, sub(k, 0.62, 1), 'water');
    }
    // rinse: over the bowl -> wash bottle lifted, straight jet in -> bottle back, swirl -> pour out into the sink
    if (!s.back) s.back = poseNow(it);
    if (k < 0.15) moveTo(it, s.back, s.to, k / 0.15, 0.03);
    else if (k < 0.62) swirl(it, s.to, j.t, k < 0.5 ? 0 : 0.1);
    if (s.k === 'skip') return;
    const wb = j.wb[s.sol];
    if (wb && k >= 0.1 && k < 0.62) bottle(j, s, wb, sub(k, 0.1, 0.25), sub(k, 0.5, 0.6), k >= 0.25 && k < 0.5 ? sub(k, 0.25, 0.5) : -1);
    if (k >= 0.62) { if (s.wbHome) wbBack(s, wb); runS.visible = false; sqS.visible = false; return dump(j, s, sub(k, 0.62, 1), s.sol); }
  }

  /* ---------- wash bottle: lifted beside the item, nozzle over the mouth, squeezed ----------
     The jet is ballistic (like actions/wash_bottle.js): it leaves the nozzle straight along it at ~1.8 m/s
     and only gravity bends it, so over a few cm it is practically a straight line. */
  const V0 = 1.8, G = 9.81, TIP_L = () => V(0.0575, 0.1705, 0), NOZ = () => V(1, -1, 0).normalize();
  function bottle(j, s, wb, kin, kout, sq) {
    const it = j.it, m = mouthOf(it), root = wb.obj.parent;
    if (!s.wbHome) {
      s.wbHome = { p: wb.obj.position.clone(), q: wb.obj.quaternion.clone(), body: wb.obj.children[0], b0: wb.obj.children[0] ? wb.obj.children[0].scale.clone() : null };
      // target: nozzle tip just above the near rim, pointing across and down into the item
      const bw = new THREE.Vector3(); wb.obj.getWorldPosition(bw);
      const mouthW = s.to.p.clone().add(V(0, m.y, 0));
      const d = mouthW.clone().sub(bw).setY(0).normalize();
      const up = V(0, 1, 0), axis = new THREE.Vector3().crossVectors(up, d).normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(axis, 0.35).multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.atan2(-d.z, d.x)));
      const tipW = mouthW.clone().addScaledVector(d, -m.r * 0.6).add(V(0, 0.018, 0));
      const posW = tipW.clone().sub(TIP_L().applyQuaternion(q));
      const counterY = L.sCounter.root.localToWorld(V(0, 0, 0)).y + 0.004;
      if (posW.y < counterY) { const dy = counterY - posW.y; posW.y += dy; tipW.y += dy; }
      const rq = Q0(); root.getWorldQuaternion(rq);
      s.wbTo = { p: root.worldToLocal(posW.clone()), q: rq.invert().multiply(q) };
      s.jetN = NOZ().applyQuaternion(q); s.tipW = tipW; s.mouthW = mouthW; s.axisW = V(s.to.p.x, 0, s.to.p.z);
    }
    const e = ease(Math.min(kin, 1 - kout));
    wb.obj.position.lerpVectors(s.wbHome.p, s.wbTo.p, e); wb.obj.position.y += Math.sin(Math.PI * e) * 0.03 * (kout > 0 ? 0 : 1);
    wb.obj.quaternion.slerpQuaternions(s.wbHome.q, s.wbTo.q, e);
    const body = s.wbHome.body, sqz = sq >= 0 ? Math.min(1, sq * 6, (1 - sq) * 6) : 0;
    if (body && s.wbHome.b0) body.scale.set(s.wbHome.b0.x * (1 - 0.07 * sqz), s.wbHome.b0.y, s.wbHome.b0.z * (1 - 0.07 * sqz));
    if (sq < 0 || sq > 0.94) { sqS.visible = false; runS.visible = false; return; }
    setFill(it, s.sol, fillMax(it, 'rinse') * sq);
    // sample the jet until it meets the far inner wall or the liquid; then a film runs down the wall
    const pts = [s.tipW.clone()], R = m.r * 0.95, sy = surfaceW(it);
    let hit = null;
    for (let i = 1; i <= 80; i++) {
      const t = i * 0.0012, p = s.tipW.clone().addScaledVector(s.jetN, V0 * t); p.y -= 0.5 * G * t * t;
      if (p.y <= sy) { pts.push(p.setY(sy)); break; }
      if (m.hollow && Math.hypot(p.x - s.axisW.x, p.z - s.axisW.z) >= R && p.y < s.mouthW.y) { pts.push(p); hit = p; break; }
      pts.push(p);
    }
    tube(sqS, pts, 0.0015, 0xd2e8ff, 0.9);
    if (hit) tube(runS, [hit, V(hit.x, (hit.y + sy) / 2, hit.z), V(hit.x, sy, hit.z)], 0.0011, 0xd2e8ff, 0.7); else runS.visible = false;
  }
  function wbBack(s, wb) {
    if (!wb || !s.wbHome) return;
    wb.obj.position.copy(s.wbHome.p); wb.obj.quaternion.copy(s.wbHome.q);
    if (s.wbHome.body && s.wbHome.b0) s.wbHome.body.scale.copy(s.wbHome.b0);
    s.wbHome = null;
  }
  function tube(m, pts, r, col, op) {
    if (pts.length < 2) { m.visible = false; return; }
    m.geometry.dispose();
    m.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(4, pts.length * 2), r, 8, false);
    m.material.color.set(col); m.material.opacity = op; m.visible = true;
  }

  /* ---------- brush + foam ---------- */
  function attachBrush(it) {
    const v = it.vessel;
    if (v) {
      const top = v.inner[v.inner.length - 1];
      brush.br.scale.set(Math.max(0.004, Math.min(0.028, top[1] * 0.75)), 1, Math.max(0.004, Math.min(0.028, top[1] * 0.75)));
      brush.floor = v.inner[0][0]; brush.topY = top[0];
      it.obj.add(brush); brush.visible = true;
    }
    it.obj.add(bubbles);
    const R = Math.max(0.006, (v ? v.inner[v.inner.length - 1][1] : it.r * 0.5) * 0.85);
    bubbles.children.forEach(b => { const o = b.userData.o; b.userData.R = R * o.r; b.scale.setScalar(o.s); });
  }
  function moveBrush(it, t) {
    if (brush.parent === it.obj) brush.position.y = brush.floor + 0.002 + (Math.max(0.01, brush.topY - brush.floor - 0.03)) * (0.5 + 0.5 * Math.sin(t * 9));
    const top = it.vessel && fillOf(it) > 0.02 ? L.heightFor(it.vessel, fillOf(it)) : it.h * 0.6;   // foam floats on the water
    bubbles.children.forEach(b => { const o = b.userData.o; b.position.set(Math.cos(o.a + t * 0.8) * b.userData.R, top + 0.002 + o.y * 0.006, Math.sin(o.a + t * 0.8) * b.userData.R); b.scale.setScalar(o.s * (0.85 + 0.25 * Math.sin(t * 5 + o.w))); });
  }
  function detachBrush() {
    if (brush.parent) brush.parent.remove(brush);
    if (bubbles.parent) bubbles.parent.remove(bubbles);
  }
})();
