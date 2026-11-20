/* =====================================================================
   TOOL RULES — where clean things may be kept (owner, 2026-11-20). Warnings only, never blocks.
   =====================================================================
   1. Every surface is dirty. A clean small tool (spatula, tweezers, stir bar, glass rod, stir bar
      retriever, pipette, dropper, syringe) put down on any table / shelf / counter / hood / rack is
      DIRTY at once + a mistake. Clean holders:
        - Tool stand (new item, equipment/toolstand.js): ALWAYS clean. 8 holes (tools upright, working
          end up) + a cup for 3 stir bars. One on the main table, two on the equipment rack.
        - Pipette stand: clean holder for graduated pipettes only.
        - Beaker (empty, no cap): tools stand in it. 100/125 ml = 3, 250/500 ml = 5. While it holds tools
          it takes no liquid. A dirty beaker makes the tools dirty.
        - Petri dish base (empty): tools lie in it. 90 mm = 2, 60 mm = 1. Dirty dish = dirty tools.
   2. Rack storage: a clean vessel put on the equipment rack stays clean only with its cap / lid on.
      Uncapped (or a vessel that has no cap: beaker, cylinder, conical flask) = dirty at once + mistake.
      Opening a cap while the vessel stands on the rack = dirty + mistake.
   3. After an auto-clean, tools go to the nearest free clean holder (tool stand first, then the pipette
      stand for pipettes, then a clean beaker / petri dish). None free = warning, left on the basin
      counter (dirty). Vessels that came from the rack come back to the main table instead.
   4. Resting ON TOP (owner): a tool (not a stir bar) dropped on a container lies across its rim, or on its
      cap / lid. Beaker / open jar / flask / dish: 2, vial or a cap: 1, petri lid: 2. A small "Put inside"
      button floats beside it until it is picked up (open, empty containers only) - inside = standing in a
      beaker / jar / flask / vial, lying in a petri dish. Picking it up needs no button. On top keeps a
      clean tool clean (even on a dirty container); a DIRTY tool on an open clean container makes the
      container dirty. Pouring / drawing / capping / opening with a tool on top: it is set down beside
      first (on the table = dirty, as rule 1).
   5. The 4 stir bars start in their own 90 mm petri dish on the equipment rack (4 places).
   index.html calls (through lab_hooks.js): placed(it, s) at the end of placeOn, opened(v) when a cap
   comes off; menus via lab_hooks H.after. */
(function () {
  const TR = window.TOOL_RULES = {};
  const TOOLS = ['spatula', 'tweezers', 'stirbar', 'rod', 'retriever', 'pipette', 'dropper', 'syringe'];
  const STAND_TOOLS = TOOLS.filter(t => t !== 'stirbar');
  const BEAKER_SLOTS = ml => ml >= 250 ? 5 : ml >= 100 ? 3 : 2;
  const DISH_SLOTS = mm => mm >= 90 ? 2 : 1;
  const TOP_TOOLS = TOOLS.filter(t => t !== 'stirbar');
  const IN_SLOTS = v => isBeaker(v) ? BEAKER_SLOTS(parseFloat(v.name.replace(/[^0-9.]/g, '')) || 100)
    : v.kind === 'jar' ? 3 : (v.kind === 'conical' || v.kind === 'screwflask') ? 2 : 1;
  let L = null, THREE = null;
  const stands = [];

  TR.isTool = it => !!(it && TOOLS.includes(it.type));
  const capped = it => !!(it.cap && typeof it.cap === 'object');
  const isRack = s => !!(s && (s.kind === 'rack'));
  const isBeaker = it => !!(it && it.type === 'vessel' && it.kind === 'beaker');
  const isDish = it => !!(it && it.type === 'vessel' && it.kind === 'petri');
  const holderOf = s => s && s.holderOf;                       // the item a holder slot belongs to

  /* ---------- init ---------- */
  TR.init = lab => {
    L = lab; THREE = L.THREE;
    for (let n = 0; n < 3; n++) {
      const st = makeToolStand();
      if (n === 0) L.autoPlace(st, [L.sMain]); else L.autoPlace(st, [L.R[1], L.R[0], L.R[2]]);
    }
    // the stir bars live in their own petri dish on the equipment rack (owner)
    const dish = L.F.petri(90); dish.name = 'Petri dish 90 mm (base) — stir bars'; dish.barDish = true;
    L.autoPlace(dish, [L.R[1], L.R[0], L.R[2]]);
    const ds = vesselSlots(dish);
    L.items.filter(i => i.type === 'stirbar' && !i.inVessel).slice(0, ds.length).forEach((b, i) => { if (b.surface) L.removeFrom(b); L.placeOn(b, ds[i], 0, 0); });
    makeButtons();
  };
  function makeToolStand() {
    const E = window.EQUIP;
    const it = L.makeItem({ type: 'stand', name: 'Tool stand (stainless, always clean)', mass: 600, toolStand: true });
    E.toolStand(L.K, it.obj); it.r = 0.105; L.finishItem(it);
    it.slots = E.TOOLSTAND_HOLES.map(([x, z], i) => {
      const s = L.addSurface(it.obj, { name: `${it.name} — hole ${i + 1}`, kind: 'stand', w: 0.018, d: 0.018, x, y: E.TOOLSTAND_FLOOR, z, owner: it, snap: true });
      s.accepts = STAND_TOOLS; s.acceptName = 'lab tools'; s.holderOf = it; s.upright = true; return s;
    });
    const C = E.TOOLSTAND_CUP;
    for (let i = 0; i < 3; i++) {
      const s = L.addSurface(it.obj, { name: `${it.name} — stir bar cup`, kind: 'stand', w: 0.02, d: 0.02, x: C.x, y: C.floor + i * 0.007, z: C.z + (i - 1) * 0.012, owner: it, snap: true });
      s.accepts = ['stirbar']; s.acceptName = 'stir bars'; s.holderOf = it; s.lie = true; s.rotY = (i - 1) * 0.5; it.slots.push(s);
    }
    stands.push(it);
    return it;
  }
  // holder slots inside a beaker / petri dish (made the first time they are needed)
  function vesselSlots(v) {
    if (v.slots) return v.slots;
    const top = v.vessel.inner[v.vessel.inner.length - 1], floor = v.vessel.inner[0][0], R = v.vessel.inner[0][1];
    const slots = [];
    if (!isDish(v)) {                                           // beaker, jar, flask, vial, cylinder: tools stand in it
      const n = IN_SLOTS(v);
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, rr = n > 1 ? R * 0.45 : 0;
        const s = L.addSurface(v.obj, { name: `${v.name} (as a tool holder)`, kind: 'stand', w: 0.01, d: 0.01, x: Math.cos(a) * rr, y: floor, z: Math.sin(a) * rr, owner: v, snap: true });
        s.accepts = TOOLS; s.acceptName = 'lab tools'; s.holderOf = v; s.upright = true; s.lean = a; slots.push(s);
      }
    } else {
      const n = v.barDish ? 4 : DISH_SLOTS(/90/.test(v.name) ? 90 : 60);
      for (let i = 0; i < n; i++) {
        const z = v.barDish ? (i - 1.5) * 0.017 : n > 1 ? (i ? 0.014 : -0.014) : 0;
        const s = L.addSurface(v.obj, { name: `${v.name} (as a tool rest)`, kind: 'stand', w: 0.01, d: 0.01, x: 0, y: floor, z, owner: v, snap: true });
        s.accepts = v.barDish ? ['stirbar'] : TOOLS; s.acceptName = v.barDish ? 'stir bars' : 'lab tools'; s.holderOf = v; s.lie = true; s.rotY = v.barDish ? 0 : 0.6 + i * 0.25; slots.push(s);
      }
    }
    // inside the glass the slots are menu-only (clicks still reach the beaker: pour, draw...)
    slots.forEach(s => s.hit.layers.set(31));
    v.slots = slots; v.toolHolder = true;
    return slots;
  }
  const toolsIn = v => (v.slots || []).reduce((a, s) => a + s.items.length, 0);
  TR.toolsIn = toolsIn;

  /* ---------- resting on top (across the rim, or on the cap / lid) ---------- */
  const canRest = v => !!(v && v.type === 'vessel' && v.vessel && !['boat', 'watchglass'].includes(v.kind));
  function topSlots(v) {
    if (v.topSlots) return v.topSlots;
    v.topSlots = [0, 1].map(i => {
      const s = L.addSurface(v.obj, { name: `on top of ${v.name}`, kind: 'top', w: 0.01, d: 0.01, x: i ? 0.011 : -0.011, y: 0, z: 0, owner: v, snap: true });
      s.top = true; s.holderOf = v; s.accepts = TOP_TOOLS; s.hit.layers.set(31); return s;
    });
    return v.topSlots;
  }
  const topCount = v => capped(v) ? (isDish(v) ? 2 : 1) : v.kind === 'vial' ? 1 : 2;
  const onTop = v => (v.topSlots || []).flatMap(s => s.items);
  const freeTop = v => topSlots(v).slice(0, topCount(v)).find(s => !s.items.length) || null;
  TR.toolsAny = v => toolsIn(v) + onTop(v).length;
  // container's top in its own frame: rim, or the cap / lid when closed
  function topY(v) {
    const b = new THREE.Box3(), t = new THREE.Box3(), vw = new THREE.Vector3(); v.obj.updateMatrixWorld(true); v.obj.getWorldPosition(vw);
    const add = list => list.forEach(m => { if (m.visible && m.isMesh) { t.setFromObject(m); b.union(t); } });
    add(v.meshes); if (capped(v)) add(v.cap.meshes);
    return b.isEmpty() ? v.h : b.max.y - vw.y;
  }
  // tools on top go down beside the container (pour / draw / cap / open / clean)
  function setAside(v, why) {
    const list = onTop(v); if (!list.length) return;
    const s0 = v.surface && !v.surface.snap ? v.surface : (v.prev && v.prev.s && !v.prev.s.snap ? v.prev.s : L.sMain);
    for (const it of list) {
      L.removeFrom(it);
      L.toast(`${it.name} was resting on ${v.name} — set down beside it${why ? ' (' + why + ')' : ''}. Take tools off first.`, 'warn', 4500);
      let s1 = s0, f = L.findFree(s0, it);
      if (!f) { s1 = L.sMain; f = L.findFree(L.sMain, it); }
      if (f) L.placeOn(it, s1, f.x, f.z); else L.autoPlace(it, [L.sMain]);
    }
  }
  TR.setAside = setAside;

  /* ---------- is this place clean for this tool? ---------- */
  function cleanHolder(s, it) {
    const h = holderOf(s); if (!h) return false;
    if (h.toolStand) return true;
    return h.clean === 'clean' && !h.wet;
  }
  function pipetteStand(s) { return !!(s && s.kind === 'stand' && s.owner && s.owner.type === 'stand' && !s.owner.toolStand && s.accepts && s.accepts.includes('pipette')); }
  TR.cleanPlace = (it, s) => !!s && (!!s.top || cleanHolder(s, it) || (it.type === 'pipette' && pipetteStand(s)));

  /* ---------- index.html: an item was put somewhere ---------- */
  TR.placed = (it, s) => {
    if (!L || !s) return;
    if (s.holderOf) pose(it, s);
    rule(it, s, true);
    // a dirty tool resting on top of an open, clean container makes the container dirty
    const v = s.top && s.holderOf;
    if (v && !it.busy && it.clean === 'dirty' && !capped(v) && v.clean !== 'dirty' && v.clean !== 'na') {
      dirtyNow(v); L.mistake('dirtyTool', `${it.name} is dirty — resting it on ${v.name} made ${v.name} dirty.`, v);
    }
  };
  function dirtyNow(it) { it.clean = 'dirty'; it.wet = null; }
  function rule(it, s, warn) {
    if (it.busy) return;                                        // flying through an auto-clean
    if (TR.isTool(it)) {
      if (it.clean === 'dirty' || it.clean === 'na' || !it.clean) return;
      if (TR.cleanPlace(it, s)) return;
      const h = holderOf(s);
      dirtyNow(it);
      if (warn) L.mistake(h ? 'dirtyHolder' : 'toolOnBench', h
        ? `${it.name} was put in ${h.name}, which is not clean — the tool is dirty now.`
        : `${it.name} was put down on the ${s.name.replace(/ —.*$/, '').toLowerCase()} — surfaces are not clean, so it is dirty now. Keep clean tools in a tool stand, a clean beaker or a clean petri dish.`, it);
      return;
    }
    // vessels on the equipment rack: only capped ones stay clean
    if (it.type === 'vessel' && isRack(s) && it.clean !== 'dirty' && it.clean !== 'na' && it.clean !== 'new' && !it.single && !capped(it)) {
      dirtyNow(it);
      if (warn) L.mistake('openOnRack', it.cap === undefined || !hasCapFit(it)
        ? `${it.name} has no cap — clean glassware left open on the rack collects dust, it is dirty now. Keep it capped / covered, or use it straight away.`
        : `${it.name} was put on the rack without its ${it.kind === 'petri' ? 'lid' : 'cap'} — it is dirty now. Close it before storing it.`, it);
    }
  }
  const hasCapFit = it => ['vial', 'screwflask', 'jar', 'petri'].includes(it.kind);
  TR.check = it => { if (it.surface) rule(it, it.surface, true); };

  // index.html: a cap / lid came off v
  TR.opened = v => {
    if (!L || !v) return;
    if (onTop(v).length) setAside(v, 'the cap was opened');
    if (!isRack(v.surface)) return;
    if (v.clean === 'dirty' || v.clean === 'na' || v.clean === 'new') return;
    dirtyNow(v);
    L.mistake('openOnRack', `${v.name} was opened on the rack — open clean containers only where you use them. It is dirty now.`, v);
  };

  /* ---------- how a tool sits in a holder ---------- */
  function pose(it, s) {
    if (s.top) {                                                // lies across the rim / on the cap
      if (it.lie) L.setPose(it, false);
      it.obj.rotation.set(0, 0, 0); it.obj.position.y = 0; it.obj.updateMatrixWorld(true);
      const bx = new THREE.Box3().setFromObject(it.obj), base = new THREE.Vector3(); s.root.getWorldPosition(base);
      it.obj.position.y = topY(s.holderOf) - (bx.min.y - base.y) + 0.0003;
      return;
    }
    if (!it.lie) {                                              // spatula, rod, tweezers, retriever, stir bar: modelled lying along z
      it.obj.rotation.set(0, s.rotY || 0, 0);
      it.obj.position.y = 0;
      if (s.upright && it.type !== 'stirbar') {
        // stand it up: the working end (+z) points up; in a beaker it leans out towards the rim
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
        if (s.lean !== undefined) q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.sin(s.lean), 0, -Math.cos(s.lean)), 0.16));
        it.obj.quaternion.copy(q);
        it.obj.updateMatrixWorld(true);                         // rest the lower end on the slot floor
        const bx = new THREE.Box3().setFromObject(it.obj), base = new THREE.Vector3(); s.root.getWorldPosition(base);
        it.obj.position.y = base.y - bx.min.y + 0.0005;
      } else if (s.lie && s.owner && s.owner.kind === 'petri') {
        it.obj.position.y = 0.0004; it.obj.rotation.x = -0.05;   // lies in the dish, handle over the rim
      }
    } else {
      // pipette / dropper / syringe: upright in a stand or beaker, lying in a dish
      L.setPose(it, !s.lie);
      if (s.lie) { it.obj.position.y = 0.0004; it.obj.rotation.y = s.rotY || 0; }
    }
  }

  /* ---------- menus (lab_hooks H.after) ---------- */
  const LIQ = /^(Pour into|Squirt|Tip everything|Dispense|Add \d|Push through|Tap the solid|Drop the stir bar|Draw liquid|Push the solid)/;
  TR.menu = (Ht, T, A) => {
    // a tool stand: pick a slot that takes this kind of tool
    const st = T.type === 'stand' && T.toolStand ? T : (T.surface && T.surface.holderOf && T.surface.holderOf.toolStand ? T.surface.holderOf : null);
    if (st) {
      A.length = 0;
      if (!TR.isTool(Ht)) { A.push({ label: 'Only lab tools go in the tool stand', disabled: true }); return; }
      const free = st.slots.find(s => !s.items.length && s.accepts.includes(Ht.type));
      A.push(free ? { primary: true, label: `Put it in the tool stand`, fn: () => put(Ht, free) } : { label: Ht.type === 'stirbar' ? 'The stir bar cup is full' : 'The tool stand is full', disabled: true });
      return;
    }
    // a beaker / petri dish used as a holder
    const hv = (isBeaker(T) || isDish(T)) ? T : null;
    if (hv && toolsIn(hv) > 0) {                                // holds tools: no liquids / solids in it
      for (let i = A.length - 1; i >= 0; i--) if (LIQ.test(A[i].label) && !A[i].disabled) A.splice(i, 1);
      if (!A.some(a => /Take the tools out/.test(a.label))) A.push({ label: `It holds tools — take the tools out of ${hv.name} first`, disabled: true });
    }
    // stir bars: laid inside a petri dish (they would roll off the top)
    if (Ht.type === 'stirbar' && isDish(hv) && !capped(hv) && L.totAll(hv.contents) <= 0) {
      const free = vesselSlots(hv).find(s => !s.items.length && s.accepts.includes('stirbar'));
      A.push(free ? { label: `Lay it in ${hv.name}`, fn: () => put(Ht, free) } : { label: `${hv.name} is full`, disabled: true });
    }
    // other tools: rest on top (straight away when nothing else can be done; else a menu entry)
    if (TOP_TOOLS.includes(Ht.type) && canRest(T)) {
      const free = freeTop(T), others = A.some(a => !a.disabled);
      A.push(free ? { primary: !others, label: `Rest it on top of ${T.name}`, fn: () => put(Ht, free, true) } : { label: `No room on top of ${T.name}`, disabled: true });
    }
    // a container with tools on top: they are set down beside it before pouring / drawing / capping
    for (const v of [Ht, T]) if (v && onTop(v).length)
      A.forEach(a => { if (a.disabled || !a.fn || !(LIQ.test(a.label) || /\b(cap|lid)\b/i.test(a.label))) return; const f = a.fn; a.fn = () => { setAside(v); f(); }; });
    // clicking a tool that sits in a beaker / dish: the stand branch of index.html made "Put it in ..."
    // with the first free slot - that is fine (same holder)
  };
  function put(it, s, quiet) {
    if (L.getHeld() === it) L.releaseHeld();
    if (it.surface) L.removeFrom(it);
    L.placeOn(it, s, 0, 0);
    if (!quiet) L.toast(`${it.name} put in ${holderOf(s).name}.`, 'ok');
  }

  /* ---------- "Put inside" buttons (one per tool resting on top, until it is picked up) ---------- */
  let layer = null; const btns = new Map();
  function makeButtons() {
    layer = document.createElement('div');
    Object.assign(layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 3 });
    document.body.appendChild(layer);
  }
  const insideSlot = (v, type) => !capped(v) && L.totAll(v.contents) <= 0 && !v.stirBar && !v.busy ? vesselSlots(v).find(s => !s.items.length && s.accepts.includes(type)) : null;
  TR.insideSlot = insideSlot;
  TR.tick = () => {
    if (!layer) return;
    const busy = window.LAB_HOOKS && window.LAB_HOOKS.busy && window.LAB_HOOKS.busy();
    const live = new Set();
    for (const it of L.items) {
      const s = it.surface; if (!s || !s.top || !it.obj.parent) continue;
      live.add(it);
      const slot = insideSlot(s.holderOf, it.type);
      let b = btns.get(it);
      if (!slot || busy || L.getHeld() === s.holderOf) { if (b) b.style.display = 'none'; continue; }
      if (!b) {
        b = document.createElement('button'); b.textContent = 'Put inside';
        Object.assign(b.style, { position: 'absolute', transform: 'translate(-50%, -130%)', pointerEvents: 'auto', fontSize: '12px', padding: '4px 9px', borderRadius: '8px' });
        b.onpointerdown = e => e.stopPropagation();
        b.onclick = e => { e.stopPropagation(); const sv = it.surface && it.surface.holderOf; const sl = sv && insideSlot(sv, it.type); if (sl) put(it, sl); };
        layer.appendChild(b); btns.set(it, b);
      }
      const p = new THREE.Vector3(); it.obj.getWorldPosition(p); p.y += 0.02;
      const dist = p.distanceTo(L.camera.position); p.project(L.camera);
      if (p.z > 1 || dist > 3) { b.style.display = 'none'; continue; }
      b.style.display = ''; b.style.left = ((p.x + 1) / 2 * innerWidth) + 'px'; b.style.top = ((1 - p.y) / 2 * innerHeight) + 'px';
    }
    for (const [it, b] of btns) if (!live.has(it)) { b.remove(); btns.delete(it); }
  };
  // the stir bar dropped into an empty beaker keeps the beaker's cleanliness
  TR.barInto = (bar, v) => {
    if (bar.clean === 'dirty' || L.totAll(v.contents) > 0) return;
    if (v.clean !== 'clean' || v.wet) { dirtyNow(bar); L.mistake('dirtyHolder', `${bar.name} was dropped into ${v.name}, which is not clean — the stir bar is dirty now.`, bar); }
  };

  /* ---------- auto-clean: where a cleaned tool goes ---------- */
  TR.holderFor = (it, from) => {
    const fromW = from || new THREE.Vector3();
    const dist = o => { const p = new THREE.Vector3(); o.obj.getWorldPosition(p); return p.distanceTo(fromW); };
    const ok = s => !s.items.length && s.accepts.includes(it.type) && !s.reserved;
    const live = o => o.obj.parent && !o.busy && o !== L.getHeld();
    const tryList = list => { list = list.filter(live).sort((a, b) => dist(a) - dist(b)); for (const h of list) { const s = (h.slots || []).find(ok); if (s) return s; } return null; };
    let s = tryList(stands);
    if (!s && it.type === 'pipette') s = tryList(L.items.filter(o => o.type === 'stand' && !o.toolStand && o.slots && o.slots[0].accepts.includes('pipette')));
    if (!s) {
      const vs = L.items.filter(o => (isBeaker(o) || isDish(o)) && o.clean === 'clean' && !o.wet && !capped(o) && L.totAll(o.contents) <= 0 && !o.stirBar && !(it.type === 'stirbar' && isBeaker(o)) && !isRack(o.surface));
      vs.forEach(vesselSlots);
      s = tryList(vs);
    }
    return s;
  };
  TR.isRack = isRack;
})();
