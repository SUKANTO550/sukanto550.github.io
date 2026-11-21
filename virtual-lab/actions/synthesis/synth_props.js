/* =====================================================================
   SYNTHESIS — props + stations
   =====================================================================
   The film uses its OWN props (made with the lab's builders) plus the REAL hotplates A/B/C, balance,
   spin coater, sonicator (dummy, time only) and basin. Closing (or a jump back) removes the props and
   puts the machines back exactly: the lab is untouched.

   Built from the protocol (no list to keep up to date):
     working jars   one per liquid used by a 'pipetteAdd' step, in the fume hood, clean + filled
                    (start volume = protocol.jars[id], else enough for all its steps + rinses)
     stock bottles  one per liquid whose 'pipetteAdd' step has refill (the jar is refilled from it)
     salt vials     one 20 ml vial per solid of a 'weighAdd' step (filled earlier, not shown), on the
                    balance table; from: 'box' = straight from its stock jar (NaOH pellets)
   Fixed apparatus (always): 100 ml screw-cap conical flask + stir bar, pipettes 10 + 2 ml + pump,
   rinse + waste beakers, wash bottles, syringe + 0.22 µm filter, 40 ml vial, watch glass, spatula,
   250 ml beaker, petri dishes, micropipette, tweezers, slide cutter set, funnel cover, box furnace. */
(function () {
  const S = window.SYNTH;
  let L = null;
  S.onInit(() => { L = S.L; });
  const V3 = (x, y, z) => new L.THREE.Vector3(x, y, z);
  const wpos = o => S.wpos(o);
  const surf = kind => L.surfaces.find(s => s.kind === kind);
  const surfNamed = n => L.surfaces.find(s => s.name === n);

  function watchGlass() {
    const E = window.EQUIP, { R: RR, RC, T: TT } = E.watchglassDims, Y = E.watchglassY;
    const sag = r => RC - Math.sqrt(RC * RC - r * r);
    const it = L.makeItem({ type: 'vessel', kind: 'watchglass', name: 'Watch glass 75 mm', clean: 'clean', solidsOnly: true, mass: 22.4 });
    const outer = []; for (let i = 0; i <= 20; i++) { const r = RR * i / 20; outer.push([Math.max(1e-4, r), sag(r)]); }
    outer.push([RR + 0.0004, sag(RR) + TT * 0.5]); for (let i = 20; i >= 0; i--) { const r = RR * i / 20; outer.push([Math.max(1e-4, r), sag(r) + TT]); }
    const inner = []; for (let i = 1; i <= 12; i++) { const r = RR * 0.95 * i / 12; inner.push([Y(r), r]); }
    L.makeVessel(it, outer, inner, L.M.watchGlass || L.M.glass, 56); if (E.watchglassRim) E.watchglassRim(L.K, it.obj);
    it.lipR = RR; it.lipY = Y(RR);
    return L.finishItem(it);
  }
  S.group = build => { const g = new L.THREE.Group(); build(g); L.scene.add(g); S.run.groups.push(g); return g; };

  // what the protocol needs (liquids for the jars, solids for the vials / boxes)
  function needs(steps) {
    const liq = new Map(), sol = new Map();
    for (const st of steps) {
      if (st.block === 'pipetteAdd') { const n = liq.get(st.chem) || { ml: 0, uses: 0, refill: 0, name: st.name }; n.ml += st.ml; n.uses++; n.refill = Math.max(n.refill, st.refill || 0); liq.set(st.chem, n); }
      if (st.block === 'weighAdd') { const n = sol.get(st.chem) || { g: 0, box: false, label: st.label }; n.g += st.g; n.box = n.box || st.from === 'box'; sol.set(st.chem, n); }
      if (st.block === 'bathClean' && st.naoh) { const n = sol.get('naoh') || { g: 0, box: true }; n.g += st.naoh; n.box = true; sol.set('naoh', n); }
    }
    return { liq, sol };
  }

  /* ---------------- set-up ---------------- */
  S.props = {};
  S.props.setup = () => {
    const run = S.run, T = L.THREE, R = S.R, need = needs(run.steps);
    run.before = new Set(L.items); run.surf0 = new Set(L.surfaces);
    run.groups = [];
    // fume hood glass door (sash) hidden during the film (owner: it blinked); shown again on close
    run.hoodIt = L.items.find(i => i.type === 'fumehood');
    if (run.hoodIt && run.hoodIt.sashG) { run.sashVis = run.hoodIt.sashG.visible; run.hoodIt.sashG.visible = false; }
    const hood = surf('hood'), main = surfNamed('Main table'), bt = surfNamed('Balance table'), mt = surfNamed('Machine table'), pan = surf('pan');
    const hRoot = wpos(hood.root), mRoot = wpos(main.root);
    // spots are written as world x, z of the table's HOME place; a base table that was moved (actions/furniture.js)
    // carries them along: home world -> table frame -> world now. Camera directions turn with the table too.
    const at = (s, x, z) => {
      if (!s.home) { const r = wpos(s.root); return V3(x, r.y, z); }
      const lp = V3(x, 0, z).applyMatrix4(new L.THREE.Matrix4().copy(s.home).invert()); lp.y = 0;
      s.root.updateMatrixWorld(true); return s.root.localToWorld(lp);
    };
    const atY = (s, x, y, z) => at(s, x, z).add(V3(0, y, 0));
    const yawOf = s => { if (!s.home) return 0; const q = new L.THREE.Quaternion(), e = new L.THREE.Euler();
      const now = e.setFromQuaternion(s.root.getWorldQuaternion(q), 'YXZ').y, home = new L.THREE.Euler().setFromRotationMatrix(s.home, 'YXZ').y; return now - home; };
    const up = V3(0, 1, 0), dMain = yawOf(main), dBal = yawOf(bt), dMach = yawOf(mt);
    S.DIR.main = () => V3(0, 0.62, 1).applyAxisAngle(up, dMain);
    S.DIR.balance = () => V3(0, 0.6, -1).applyAxisAngle(up, dBal);
    S.DIR.machine = () => V3(-1, 0.6, 0.15).applyAxisAngle(up, dMach);
    run.at3 = at;
    run.hood = { s: hood, flaskSpot: at(hood, 2.0, -3.0), hpSpot: at(hood, 1.85, -3.18), wgSpot: at(hood, 2.12, -2.95), spSpot: at(hood, 2.25, -2.92),
      look: () => V3(2.05, hRoot.y + 0.1, -3.08) };
    run.main = { s: main, look: () => atY(main, -0.2, 0.08, -1.6), vialSpot: at(main, 0.2, -1.33), wgSpot: at(main, -1.0, -1.32), spSpot: at(main, -0.88, -1.3), beakerSpot: at(main, -1.2, -1.4),
      hpSpots: [at(main, -0.6, -1.78), at(main, -0.36, -1.78), at(main, -0.12, -1.78)] };
    // machines (real) — remember where they were
    const hpOf = n => L.items.find(i => i.type === 'hotplate' && i.name.startsWith('Hotplate stirrer ' + n));
    run.hp = { A: hpOf('A'), B: hpOf('B'), C: hpOf('C') };
    run.saved = [];
    for (const k of ['A', 'B', 'C']) { const h = run.hp[k]; run.saved.push({ it: h, s: h.surface, p: h.obj.position.clone(), rotY: h.rotY || 0, m: { setT: h.machine.setT, setRpm: h.machine.setRpm } }); }
    run.sc = L.items.find(i => i.type === 'spincoater');
    run.scSaved = { lidOpen: run.sc.machine.lidOpen, vacuum: run.sc.machine.vacuum };
    const bal = L.items.find(i => i.type === 'balance');
    run.bal = { it: bal, pan, table: bt, spot: at(bt, 2.4, 2.92), tare0: bal.machine.tare, door0: bal.machine.doorOpen,
      doorX0: bal.machine.door ? bal.machine.door.position.x : 0 };
    // props
    const prop = (it, s, world, rotY) => { S.putOn(it, s, world, rotY); if (it.isMain) it.offWarned = true; return it; };
    const P2 = (it, s, x, z, rotY) => prop(it, s, at(s, x, z), rotY);
    const free = (it, s, x, z) => {                     // preferred spot, else the nearest free one on that surface
      P2(it, s, x, z);
      const o = it.obj;
      if (L.fpClash(s, it, o.position.x, o.position.z, o.rotation.y, 0.004)) { L.removeFrom(it); const fr = L.findFree(s, it); if (fr) L.placeOn(it, s, fr.x, fr.z); else P2(it, s, x, z); }
      return it;
    };
    run.flask = P2(L.F.conical(100, true), hood, 2.0, -2.98); run.flask.clean = 'clean'; run.flask.capItem = run.flask.cap;
    run.bar = L.F.stirbar(0.025);                                  // stirbar() takes metres: 25 mm PTFE bar (in the hood tool stand's cup)
    // working jars (owner): already clean and filled; liquids are taken from them with a graduated pipette
    run.jarsW = {}; run.stock = {};
    let ji = 0;
    for (const [id, n] of need.liq) {
      const start = (R.jars && R.jars[id] != null) ? R.jars[id] : Math.ceil(n.ml + n.uses * 1.2 + 5);
      const j = free(L.F.jar(), hood, 2.43 + ji * 0.12, -3.25); j.capItem = j.cap; j.clean = 'clean'; j.contents.liq[id] = start;
      S.labelOn(j, 0.03, n.name || (L.CHEM[id] ? L.CHEM[id].formula : id), 'working jar', 0.0286); run.jarsW[id] = j;
      if (n.refill) { const b = free(L.F.mainBottle(id), hood, 2.3 - ji * 0.1, -3.25); b.capItem = b.cap; run.stock[id] = b; }
      ji++;
    }
    run.p10 = L.F.pipette(10); run.p2 = L.F.pipette(2);             // in the pipette stand (below)
    run.pipettes = [run.p10, run.p2];
    run.rinseBk = P2(L.F.beaker(100), hood, 2.2, -3.12);
    run.waste = P2(L.F.beaker(250), hood, 2.2, -3.28); S.labelOn(run.waste, 0.035, 'WASTE', 'pipette rinses', 0.0356);
    run.wbHW = P2(L.F.washBottle('water'), hood, 2.58, -3.1); run.wbHE = P2(L.F.washBottle('ethanol'), hood, 2.58, -2.98);
    run.syr = L.F.syringe();
    run.vial = P2(L.F.vial(40), hood, 2.33, -3.0); run.vial.capItem = run.vial.cap;
    run.marker = P2(L.F.marker(), hood, 2.45, -2.9, Math.PI / 2);   // black permanent marker (labels: actions/marker.js)
    // salts (owner): each already in its own small vial, clean and filled; NaOH pellets straight from the box
    run.saltSrc = {};
    const balSpots = [[1.86, 3.2], [1.96, 3.2], [2.06, 3.2], [2.16, 3.2], [2.26, 3.2], [1.86, 3.08], [1.96, 3.08], [2.06, 3.08]];
    let si = 0;
    const solids = [...need.sol].sort((a, b) => a[1].box - b[1].box);          // vials first, boxes after
    for (const [id, n] of solids) {
      const [x, z] = balSpots[si] || [1.9 + si * 0.08, 2.96]; si++;
      if (n.box) { const j = free(L.F.mainBottle(id), bt, x, z); j.capItem = j.cap; run.saltSrc[id] = j; continue; }
      const v = free(L.F.vial(20), bt, x, z); v.capItem = v.cap; v.clean = 'clean';
      v.contents.sol[id] = +(Math.max(1, n.g * 1.6)).toFixed(2);
      S.labelOn(v, 0.026, n.label || (L.CHEM[id] ? L.CHEM[id].name : id), L.CHEM[id] ? L.CHEM[id].formula || '' : '', 0.0139);
      run.saltSrc[id] = v;
    }
    run.wg = P2(watchGlass(), bt, 2.3, 3.22); run.sp = L.F.spatula();
    // substrates + spin coating on the main table
    run.beaker = P2(L.F.beaker(250), main, -1.2, -1.4);
    run.wbWater = P2(L.F.washBottle('water'), main, -1.45, -1.3); run.wbEth = P2(L.F.washBottle('ethanol'), main, -1.35, -1.25);
    run.ethDish = P2(L.F.petri(90), main, 0.1, -1.35); run.ethDish.capItem = run.ethDish.cap;
    const cool = P2(L.F.petri(90), main, -0.36, -1.38); L.removeFrom(cool.cap); if (cool.cap) { const c = cool.cap; cool.cap = null; c.onVessel = null; cool.obj.remove(c.obj); S.putOn(c, main, at(main, -0.5, -1.3)); }
    if (!cool.pieceSurface) cool.pieceSurface = L.addSurface(cool.obj, { name: 'Petri dish', kind: 'dish', w: 0.072, d: 0.072, y: cool.vessel.inner[0][0], clear: 0.009 });
    cool.pieceSurface.owner = cool; run.coolDish = cool.pieceSurface;
    run.mp = L.F.micropipette(100);
    run.tw = L.F.tweezers(true); run.tw2 = L.F.tweezers(true);
    // CLEAN HOLDERS (owner: a clean tool is never put down on a table / hood / counter): tool stands in the hood,
    // on the main table and on the machine table; pipette stand in the hood; micropipette stand on the main table.
    // Tools are taken out into the hand (S.take) and put back (S.stow, nearest free slot).
    const TRm = window.TOOL_RULES;
    const tsH = free(TRm.makeToolStand(), hood, 1.72, -2.98), tsM = free(TRm.makeToolStand(), main, -0.12, -1.22), tsF = free(TRm.makeToolStand(), mt, 3.15, -0.32);
    const psH = free(L.F.stand('pipette'), hood, 1.9, -3.4), msM = free(L.F.stand('micro'), main, 0.42, -1.2);
    run.stands = [tsH, tsM, tsF, psH, msM];
    S.slotIn(run.p10, psH.slots[0]); S.slotIn(run.p2, psH.slots[1]);
    S.slotIn(run.sp, tsH.slots[0]); S.slotIn(run.syr, tsH.slots[1]);
    S.slotIn(run.bar, tsH.slots.find(s => s.accepts.includes('stirbar')));
    S.slotIn(run.mp, msM.slots[1]);
    S.slotIn(run.tw, tsM.slots[0]); S.slotIn(run.tw2, tsF.slots[0]);
    run.tmpPuddle = new T.Mesh(new T.CircleGeometry(1, 32), new T.MeshStandardMaterial({ color: 0xeef4ff, transparent: true, opacity: 0.5, roughness: 0.1, depthWrite: false }));
    run.tmpPuddle.rotation.x = -Math.PI / 2; run.tmpPuddle.position.y = 0.0014; run.tmpPuddle.visible = false; run.tmpPuddle.renderOrder = 5;
    run.tmpFilm = new T.Mesh(new T.PlaneGeometry(0.0745, 0.0245), new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, roughness: 0.2, depthWrite: false }));
    run.tmpFilm.rotation.x = -Math.PI / 2; run.tmpFilm.position.y = 0.00122; run.tmpFilm.visible = false; run.tmpFilm.renderOrder = 5;
    // glass cutting set (slide cutter base + block, glass cutter, slide, petri for the pieces)
    const E = window.EQUIP, cutAt = at(main, -1.0, -1.75);
    run.cut = { base: S.group(g => E.slideCutterPart(L.K, g, 'base')), up: S.group(g => E.slideCutterPart(L.K, g, 'up')), cutter: S.group(g => E.glassCutter(L.K, g)) };
    run.cut.base.position.copy(cutAt); run.cut.up.position.copy(cutAt); run.cut.cutter.position.copy(cutAt).add(V3(0.1, 0, 0.06));
    run.cut.slide = new T.Mesh(new T.BoxGeometry(0.075, 0.001, 0.025), new T.MeshStandardMaterial({ color: 0xdcefe9, transparent: true, opacity: 0.5, roughness: 0.08 }));
    run.cut.slide.position.copy(cutAt).add(V3(0, 0.0005, 0.09)); run.cut.slide.renderOrder = 3; L.scene.add(run.cut.slide); run.groups.push(run.cut.slide);
    run.cut.dish = P2(L.F.petri(90), main, -0.82, -1.62); { const c = run.cut.dish.cap; run.cut.dish.cap = null; c.onVessel = null; run.cut.dish.obj.remove(c.obj); S.putOn(c, main, at(main, -0.82, -1.4)); }
    // funnel (dust cover) — hidden until spin coating
    run.funnel = S.group(g => E.funnel(L.K, { obj: g })); run.funnel.visible = false;
    // sonicator top, basin
    const so = L.items.find(i => i.type === 'sonicator'); const sb = new T.Box3().setFromObject(so.obj);
    run.sonic = { top: V3((sb.min.x + sb.max.x) / 2, sb.max.y, (sb.min.z + sb.max.z) / 2) };
    const basin = L.items.find(i => i.type === 'basin'); const bb = new T.Box3().setFromObject(basin.obj);
    run.basinPt = V3((bb.min.x + bb.max.x) / 2, bb.max.y + 0.12, (bb.min.z + bb.max.z) / 2 + 0.05);
    // furnace (dummy) + alumina setter on the machine table (front faces the room, -x)
    // the lab's own box furnace + alumina setter (index.html; owner: the furnace is a lab item now). Their
    // place, door and display are put back on close.
    const fIt = L.items.find(i => i.type === 'furnace'), sIt = L.items.find(i => i.setter);
    run.furnSaved = { s: fIt.surface, p: fIt.obj.position.clone(), rotY: fIt.rotY || 0, open: fIt.machine.doorOpen,
      ss: sIt.surface, sp: sIt.obj.position.clone() };
    fIt.machine.doorOpen = false; fIt.openF = 0; fIt.furnace.door.rotation.y = 0;
    const fpos = wpos(fIt.obj);
    run.furn = { g: fIt.obj, it: fIt, setter: sIt, s: fIt.surface, dishSpot: at(mt, 3.22, -0.12), look: () => atY(mt, 3.4, 0.15, 0.08) };
    // the wash step (block 'washAll'): everything below starts dirty and is washed at the basin first (flask first)
    run.washList = [run.flask, run.beaker, run.rinseBk, run.waste, run.vial, run.ethDish, cool, run.cut.dish, run.wg,
      run.p10, run.p2, run.syr, run.sp, run.bar, run.tw, run.tw2];
    if (run.steps.some(s => s.block === 'washAll')) run.washList.forEach(it => { it.clean = 'dirty'; });
    // the lab's own acetone / IPA wash bottles on the basin counter (amounts put back on close)
    run.basinWB = {}; run.wbSave = [];
    for (const sol of ['acetone', 'ipa']) {
      const wb = L.sCounter.items.find(i => i.type === 'washBottle' && i.solvent === sol);
      if (wb) { run.basinWB[sol] = wb; run.wbSave.push([wb, wb.contents.liq[sol] || 0]); }
    }
    run.brush = S.group(g => {
      const h = new T.Mesh(new T.CylinderGeometry(0.0022, 0.0022, 0.22, 10), new T.MeshStandardMaterial({ color: 0x8a96a3, metalness: 0.6, roughness: 0.4 }));
      h.position.y = 0.155; g.add(h);
      const br = new T.Mesh(new T.CylinderGeometry(1, 1, 0.045, 14), new T.MeshStandardMaterial({ color: 0xf1ece0, roughness: 0.95 }));
      br.position.y = 0.0225; g.add(br); g.br = br;
    });
    run.brush.visible = false;
  };

  /* ---------------- clean-up (close) / reset (jump back) ---------------- */
  function clearScene() {
    const run = S.run;
    if (S.P.active) S.P.skip();
    S.tasks.clear();
    if (run.wbOut) { const o = run.wbOut; o.par.attach(o.wb.obj); o.wb.obj.position.copy(o.lp); o.wb.obj.quaternion.copy(o.lq); run.wbOut = null; }
    for (const [wb, ml] of run.wbSave || []) wb.contents.liq[wb.solvent] = ml;
    if (S.washS) for (const k in S.washS) S.washS[k].visible = false;
    for (const it of [...L.items]) if (!run.before.has(it)) L.disposeItem(it);
    for (const g of run.groups) g.parent && g.parent.remove(g);
    for (let i = L.surfaces.length - 1; i >= 0; i--) if (!run.surf0.has(L.surfaces[i])) L.surfaces.splice(i, 1);   // surfaces added on film props
    for (const r of run.saved) { const h = r.it; h.rotY = r.rotY; L.placeOn(h, r.s, r.p.x, r.p.z); h.machine.setT = r.m.setT; h.machine.setRpm = r.m.setRpm; }
    run.sc.machine.lidOpen = run.scSaved.lidOpen; run.sc.machine.vacuum = run.scSaved.vacuum; if (run.sc.machine.disp) run.sc.machine.disp._key = null;
    if (run.furnSaved) { const f = run.furn.it, r = run.furnSaved, st = run.furn.setter;
      f.rotY = r.rotY; L.placeOn(f, r.s, r.p.x, r.p.z); f.machine.doorOpen = r.open; f.openF = r.open ? 1 : 0; f.furnace.door.rotation.y = r.open ? -1.9 : 0; f.furnace.setTemp(25, 'READY');
      for (const c of [...st.obj.children]) if (c.userData && c.userData.item && c.userData.item !== st) st.obj.remove(c);   // the film's substrate
      if (st.surface !== r.ss || st.obj.parent !== r.ss.root) { L.scene.attach(st.obj); L.placeOn(st, r.ss, r.sp.x, r.sp.z); } }
    run.bal.it.machine.tare = run.bal.tare0; run.bal.it.machine.doorOpen = run.bal.door0;
    if (run.bal.it.machine.door) run.bal.it.machine.door.position.x = run.bal.doorX0;
    if (run.hoodIt && run.hoodIt.sashG) run.hoodIt.sashG.visible = run.sashVis !== false;
    S.panel.bar(null);
    // per-run marks set by the blocks
    for (const k of ['pieces', 'layer', 'subAt', 'agingStart', 'annealStart', 'parafilm', 'foil', 'label']) delete run[k];
  }
  S.props.cleanup = clearScene;
  S.props.reset = () => { clearScene(); S.props.setup(); };
})();
