/* =====================================================================
   SYNTHESIS — tools: lab work shared by the blocks
   =====================================================================
   Clip contexts on lab items (as actions/lab_hooks.js), graduated pipette + pipette pump (owner:
   liquids only with a pipette from a working jar, rinsed DI water -> ethanol -> the liquid before each
   use), caps, weighing at the balance (watch glass + spatula, 3 scoops), salt into the flask, colours,
   labels / bands on vessels. Everything is put on window.SYNTH (S.pour, S.weigh ...). */
(function () {
  const S = window.SYNTH;
  let L = null;
  S.onInit(() => { L = S.L; });
  const V3 = (x, y, z) => new L.THREE.Vector3(x, y, z);
  const wpos = o => S.wpos(o);

  /* ---------------- clip contexts ---------------- */
  const hex = col => col ? '#' + col.getHexString() : '#e8f0ff';
  S.lookHex = it => { const l = L.contentsLook(it); return l ? hex(l.col) : '#e8f0ff'; };
  S.vessel = T => {
    const v = T.vessel, top = v.inner[v.inner.length - 1];
    return { obj: T.obj, mouth: V3(0, top[0] + 0.001, 0), mouthR: top[1], floorY: v.inner[0][0],
      surfaceY: () => { const l = L.totLiq(T.contents); return l > 0.0005 ? L.heightFor(v, l) : v.inner[0][0] + (L.totSol(T.contents) > 0 ? 0.003 : 0); } };
  };
  const roomIn = T => T.vessel ? Math.max(0, T.vessel.cap - L.totLiq(T.contents)) : Infinity;
  S.moveLiq = (src, dst, ml) => { const h = L.totLiq(src.contents); if (h > 0) L.receive(dst, L.takeLiquidFraction(src.contents, Math.min(1, ml / h), true), { checks: false }); };
  S.pour = (src, dst, ml, name = 'stockPour') => {
    const top = src.vessel ? src.vessel.inner[src.vessel.inner.length - 1] : [src.lipY, src.lipR];
    const c = { dst: S.vessel(dst), color: S.lookHex(src), available: () => L.totLiq(src.contents), room: () => roomIn(dst), onAmount: a => S.moveLiq(src, dst, a),
      src: { obj: src.obj, lipR: src.lipR || top[1], lipY: src.lipY || top[0], bodyR: src.isMain ? src.r - 0.003 : top[1] + 0.002, start: L.totLiq(src.contents) } };
    return S.clip(name, c, { amount: ml }).then(() => { L.touch(src); L.touch(dst); });
  };
  S.squirt = (wb, dst, ml) => {
    const c = { dst: S.vessel(dst), color: '#dbe9ff', available: () => L.totLiq(wb.contents), room: () => roomIn(dst), onAmount: a => S.moveLiq(wb, dst, a),
      src: { obj: wb.obj, tip: V3(0.0575, 0.1705, 0), body: wb.obj.children[0], bodyR: 0.036, height: 0.135, start: L.totLiq(wb.contents) } };
    return S.clip('washBottle', c, { amount: ml });
  };
  S.spatulaIn = (wg, dst, sp) => {
    const id = Object.keys(wg.contents.sol)[0], start = L.totSol(wg.contents);
    return S.clip('spatulaTransfer', { src: { obj: wg.obj, start, hideContents: h => { if (wg.vessel.crystals) wg.vessel.crystals.layers.set(h ? 31 : 0); } },
      dst: S.vessel(dst), tool: sp.obj, color: L.CHEM[id] ? L.CHEM[id].solid : '#ffffff',
      available: () => L.totSol(wg.contents), onAmount: g => L.receive(dst, L.takeSolid(wg.contents, g), { checks: false }) }, { amount: start });
  };
  function toolDesc(Ht) {
    const lift = Ht.upLift || 0, cap = Ht.cap;
    if (Ht.type === 'dropper') return { obj: Ht.obj, tipY: -0.05 + lift, cap, bulb: Ht.bulb, have: () => L.totLiq(Ht.contents) };
    return { obj: Ht.obj, tipY: (Ht.filter ? Ht.filterTipY : -0.012) + lift, filter: !!Ht.filter, cap, have: () => L.totLiq(Ht.contents) };
  }
  // syringe / dropper draw + give
  S.draw = async (Ht, T, ml) => {
    L.setPose(Ht, true);
    await S.clip(Ht.type === 'dropper' ? 'dropperDraw' : 'syringeDraw', { tool: toolDesc(Ht), src: S.vessel(T), color: S.lookHex(T), available: () => L.totLiq(T.contents),
      room: () => Math.max(0, Ht.cap - L.totLiq(Ht.contents)), onAmount: a => { const h = L.totLiq(T.contents); if (h > 0) L.addC(Ht.contents, L.takeLiquidFraction(T.contents, Math.min(1, a / h), false)); L.refreshTool(Ht); } }, { amount: ml });
    // stays upright: held in the hand until it is put into a holder (S.stow)
  };
  S.give = async (Ht, T, ml) => {
    L.setPose(Ht, true);
    await S.clip(Ht.type === 'dropper' ? 'dropperDispense' : 'syringeDispense', { tool: toolDesc(Ht), dst: S.vessel(T), color: S.lookHex(Ht), available: () => L.totLiq(Ht.contents),
      room: () => roomIn(T), onAmount: a => { const h = L.totLiq(Ht.contents); if (h > 0) { const part = L.takeLiquidFraction(Ht.contents, Math.min(1, a / h), true); if (Ht.filter) part.sol = {}; L.receive(T, part, { checks: false }); } L.refreshTool(Ht); } },
      { amount: Math.min(ml, L.totLiq(Ht.contents)) });
    // stays upright: held in the hand until it is put into a holder (S.stow)
  };
  S.mpDraw = async (mp, T, ml) => {
    mp.tip = { used: false, residue: new Set() }; mp.setVol = Math.round(ml * 1000); mp.updateCounter && mp.updateCounter(); L.refreshTool(mp);
    L.setPose(mp, true);
    await S.clip('micropipetteDraw', { tool: { obj: mp.obj, it: mp, vol: ml, have: () => L.totLiq(mp.contents), yOff: mp.upLift || 0 }, src: S.vessel(T), color: S.lookHex(T),
      available: () => L.totLiq(T.contents), onAmount: a => { const h = L.totLiq(T.contents); if (h > 0) L.addC(mp.contents, L.takeLiquidFraction(T.contents, Math.min(1, a / h), false)); } });
  };

  /* ---------------- graduated pipette + pipette pump ---------------- */
  function pipDesc(p) {                                   // as lab_hooks.js toolDesc + the attached pump
    const lift = p.upLift || 0;
    return { obj: p.obj, tipY: -0.03 + lift, cap: p.cap, have: () => L.totLiq(p.contents), levelY: ml => 0.002 + 0.288 * ml / p.cap + lift, pump: p.pumpModel || null };
  }
  S.pDraw = async (p, T, ml) => {
    L.setPose(p, true);
    await S.clip('pipetteDraw', { tool: pipDesc(p), src: S.vessel(T), color: S.lookHex(T), available: () => L.totLiq(T.contents), room: () => Math.max(0, p.cap - L.totLiq(p.contents)),
      onAmount: a => { const h = L.totLiq(T.contents); if (h > 0) L.addC(p.contents, L.takeLiquidFraction(T.contents, Math.min(1, a / h), false)); L.refreshTool(p); } }, { amount: ml });
    L.touch(T);                                           // stays upright in the hand
  };
  S.pDisp = async (p, T, ml, drops = false) => {
    L.setPose(p, true);
    await S.clip('pipetteDispense', { tool: pipDesc(p), dst: S.vessel(T), color: S.lookHex(p), drops, available: () => L.totLiq(p.contents), room: () => roomIn(T),
      onAmount: a => { const h = L.totLiq(p.contents); if (h > 0) L.receive(T, L.takeLiquidFraction(p.contents, Math.min(1, a / h), true), { checks: false });
        if (L.totAll(p.contents) < 1e-6) p.contents = L.emptyC(); L.refreshTool(p); } }, { amount: Math.min(ml, L.totLiq(p.contents)) });
    L.touch(T);                                           // stays upright in the hand
  };
  // the pump (one for all pipettes, as in the lab) goes on top of the pipette (lab_hooks.js attachPump)
  S.pumpOn = p => {
    const g = new L.THREE.Group(); p.pumpModel = window.EQUIP.pipettePumpUp(L.K, g); g.position.y = 0.335;
    (p.pose || p.obj).add(g); p.pumpG = g; S.run.groups.push(g);
  };
  S.pumpMove = async (a, b) => {
    if (b.pumpG) return;
    if (!a || !a.pumpG) { S.pumpOn(b); S.say(`Pipette pump on the ${b.name}`); await S.sleep(0.6); return; }
    const g = a.pumpG, model = a.pumpModel; a.pumpG = a.pumpModel = null;
    S.say(`Pipette pump moved to the ${b.name}`);
    L.scene.attach(g);
    const par = b.pose || b.obj, p0 = g.position.clone(), q0 = g.quaternion.clone();
    const p1 = par.localToWorld(V3(0, 0.335, 0)), q1 = par.getWorldQuaternion(new L.THREE.Quaternion());
    let t = 0;
    await S.every(dt => { t += dt; const u = Math.min(1, t / 0.9), v = u * u * (3 - 2 * u);
      g.position.lerpVectors(p0, p1, v); g.position.y += Math.sin(Math.PI * v) * 0.06; g.quaternion.slerpQuaternions(q0, q1, v); return u >= 1; });
    par.attach(g); g.position.set(0, 0.335, 0); g.quaternion.identity();
    b.pumpG = g; b.pumpModel = model; model.plunger.position.y = 0;
  };
  // the pump goes to pipette p (from whichever pipette has it, or fresh from the shelf the first time)
  S.pumpTo = p => S.pumpMove(S.run.pipettes.find(q => q !== p && q.pumpG), p);
  // pipette for a volume: the smallest one that holds it (2 ml for <= 2 ml, else 10 ml), or the one asked for
  S.pipetteFor = (ml, want) => {
    const ps = [...S.run.pipettes].sort((a, b) => a.cap - b.cap);
    return (want && ps.find(q => q.cap === want)) || ps.find(q => q.cap >= ml) || ps[ps.length - 1];
  };
  // quick rinse before each use (owner): DI water, ethanol, then a little of the liquid it will take; all into the waste beaker
  S.rinsePip = async (p, jar, what) => {
    const run = S.run, rb = run.rinseBk, wst = run.waste, sp0 = run.speed, r = Math.min(2, p.cap * 0.75);
    run.speed = Math.max(run.speed, 6);
    await S.cam(wpos(rb.obj).add(V3(0, 0.05, 0)), S.DIR.hood(), 0.6, 0.8);
    for (const [wb, name] of [[run.wbHW, 'DI water'], [run.wbHE, 'ethanol']]) {
      S.say(`Rinsing the ${p.name} with ${name}`);
      await S.squirt(wb, rb, r);
      await S.pDraw(p, rb, r); await S.pDisp(p, wst, L.totLiq(p.contents));
      if (L.totLiq(rb.contents) > 0) S.moveLiq(rb, wst, L.totLiq(rb.contents));
      p.contents = L.emptyC(); L.refreshTool(p);
    }
    S.say(`Rinsing the ${p.name} with a little ${what}`);
    await S.pDraw(p, jar, Math.min(1, p.cap * 0.3)); await S.pDisp(p, wst, L.totLiq(p.contents));
    p.contents = L.emptyC(); p.residue.clear(); L.refreshTool(p);
    run.speed = sp0; S.adv(2 * 60);
  };

  /* ---------------- clean holders (owner: a clean tool is NEVER put down on a table / hood / counter) -------
     Tools live in the film's stands (tool stands, pipette stand, micropipette stand) and are carried in the
     hand between uses: S.take lifts one out, S.stow puts it into the nearest free slot that accepts it. */
  const TR = () => window.TOOL_RULES;
  const poseIn = (it, slot) => { L.placeOn(it, slot, 0, 0); if (TR() && TR().pose) TR().pose(it, slot); };
  S.slotIn = poseIn;                                                     // instant (set-up)
  S.freeSlot = (it, from) => {
    const fromW = from || wpos(it.obj); let best = null, bd = Infinity;
    for (const h of S.run.stands || []) for (const sl of h.slots) {
      if (sl.items.length || !sl.accepts.includes(it.type)) continue;
      const d = wpos(sl.root).distanceTo(fromW); if (d < bd) { bd = d; best = sl; }
    }
    return best;
  };
  // carry a tool into a holder slot: the end pose (upright in a stand) is worked out first, then flown to
  S.carryTo = (it, slot, { dur = 1.0, lift = 0.08, exact = false } = {}) => {
    const o = it.obj;
    if (it.surface) L.removeFrom(it);
    L.scene.attach(o);
    const p0 = o.position.clone(), q0 = o.quaternion.clone(), up0 = it.upright;
    poseIn(it, slot); o.updateMatrixWorld(true);
    const p1 = wpos(o), q1 = o.getWorldQuaternion(new L.THREE.Quaternion()), up1 = it.upright;
    L.removeFrom(it); L.scene.attach(o); o.position.copy(p0); o.quaternion.copy(q0);
    if (it.lie) L.setPose(it, up0 || up1);
    const far = p0.distanceTo(p1); if (!exact) dur = Math.max(dur, Math.min(2.4, 0.5 + far * 0.35)); lift = Math.max(lift, Math.min(0.35, far * 0.08));
    let t = 0;
    return S.every(dt => { t += dt; const u = Math.min(1, t / dur), v = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      o.position.lerpVectors(p0, p1, v); o.position.y += Math.sin(Math.PI * v) * lift; o.quaternion.slerpQuaternions(q0, q1, v);
      if (u >= 1) { poseIn(it, slot); return true; } return false; });
  };
  // put a tool away: nearest free holder slot (nothing free = it stays in the hand, never on the bench)
  S.stow = (it, near) => { const sl = S.freeSlot(it, near); return sl ? S.carryTo(it, sl) : Promise.resolve(); };
  // take a tool out of its holder into the hand (lifted straight up, held upright)
  S.take = it => {
    if (!it.surface) return Promise.resolve();
    const o = it.obj; L.removeFrom(it); L.scene.attach(o);
    if (it.lie) L.setPose(it, true);
    return S.glideTo(o, o.position.clone().add(V3(0, 0.12, 0)), 0.45);
  };

  /* ---------------- caps ---------------- */
  // cap off: set down beside the vessel (world offset); cap on again
  S.capOff = (v, off = V3(0.07, 0, 0.03)) => {
    const cap = v.cap; if (!cap || typeof cap !== 'object') return Promise.resolve();
    v.cap = null; cap.onVessel = null; cap.prevVessel = v;
    const s = v.surface && v.surface.snap && v.surface.owner ? v.surface.owner.surface : v.surface;
    const to = wpos(v.obj).add(off); to.y = s ? wpos(s.root).y : to.y; if (v.surface && v.surface.snap) to.add(V3(0.06, 0, 0.09));
    return S.carry(cap, to, { surf: s, dur: 0.6, lift: 0.05 });
  };
  S.capOn = (v) => {
    const cap = v.capItem; if (!cap || v.cap === cap) return Promise.resolve();
    const to = wpos(v.obj).add(V3(0, v.capY, 0));
    return S.carry(cap, to, { dur: 0.6, lift: 0.04 }).then(() => { L.attachCap(cap, v); });
  };

  /* ---------------- contents ---------------- */
  // colour of a step (owner: set per step, no rules): a key of recipe.colors or { col, op }
  S.setLook = (it, k) => { const c = typeof k === 'string' ? S.R.colors[k] : k; if (!c) return; it.lookOverride = { col: new L.THREE.Color(c.col), opacity: c.op == null ? 0.7 : c.op }; };
  S.dissolveAll = it => { const c = it.contents; for (const id in c.sol) { c.dis[id] = (c.dis[id] || 0) + c.sol[id]; delete c.sol[id]; } };
  S.chemName = (id, p) => (p && p.name) || (L && L.CHEM[id] ? L.CHEM[id].name : id);

  /* ---------------- weighing at the balance ---------------- */
  S.glideTo = (obj, to, dur) => { const p0 = obj.position.clone(); let t = 0; return S.every(dt => { t += dt; const u = Math.min(1, t / dur), v = u * u * (3 - 2 * u); obj.position.lerpVectors(p0, to, v); obj.position.y += Math.sin(Math.PI * v) * 0.02; return u >= 1; }); };
  S.massOn = s => { let m = 0; for (const it of s.items) { m += it.mass + L.totSol(it.contents); for (const id in it.contents.dis) m += it.contents.dis[id]; for (const id in it.contents.liq) m += it.contents.liq[id] * (L.CHEM[id].rho || 1); if (it.cap) m += it.cap.mass; } return m; };
  // balance draft-shield door (front pane): slides sideways open / shut; machine.doorOpen follows
  S.balDoor = open => {
    const m = S.run.bal.it.machine, d = m.door; m.doorOpen = open;
    if (!d) return Promise.resolve();
    const x0 = d.position.x, x1 = open ? S.run.bal.doorX0 + 0.19 : S.run.bal.doorX0; let t = 0;
    return S.every(dt => { t += dt; const u = Math.min(1, t / 0.5), v = u * u * (3 - 2 * u); d.position.x = x0 + (x1 - x0) * v; return u >= 1; });
  };
  /* Spatula held by the handle, SPOON END first (spatula.js: spoon at +z, centre z = 0.083). A pose = where the
     spoon centre is (world), the heading (yaw, direction the spoon points) and the downward tilt (pitch). */
  const SPOON = () => V3(0, 0.004, 0.083);
  function spQuat(yaw, pitch) {
    return new L.THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), yaw).multiply(new L.THREE.Quaternion().setFromAxisAngle(V3(1, 0, 0), pitch));
  }
  function spPose(sp, spoon, yaw, pitch, dur, arc = 0) {
    const o = sp.obj, q1 = spQuat(yaw, pitch), p1 = spoon.clone().sub(SPOON().applyQuaternion(q1));
    const p0 = o.position.clone(), q0 = o.quaternion.clone(); let t = 0;
    return S.every(dt => { t += dt; const u = Math.min(1, t / Math.max(1e-3, dur)), v = u * u * (3 - 2 * u);
      o.position.lerpVectors(p0, p1, v); o.position.y += Math.sin(Math.PI * v) * arc; o.quaternion.slerpQuaternions(q0, q1, v); return u >= 1; });
  }
  const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  // spatula held in the hand at a point (spoon slightly up), carried there in an arc
  S.spHold = (sp, at, dur = 1.4) => { if (sp.surface) { L.removeFrom(sp); L.scene.attach(sp.obj); } return spPose(sp, at, Math.PI, -10 * Math.PI / 180, dur, 0.12); };
  const deg = d => d * Math.PI / 180;
  /* Weighing (Claude default, typical practice - owner to confirm): door open, empty watch glass onto the pan,
     door shut, TARE. Vial uncapped. Each scoop: spoon end first, tilted ~55 deg into the vial, dips into the salt,
     twists to scoop, lifts out nearly level; door open, in through the doorway (never through the glass), spoon
     ~1.2 cm over the watch glass, tilted, gentle taps: the salt falls a little with each tap and the reading
     climbs. 2 big scoops, then a top-up with small taps to the exact mass. Spatula out, laid beside the balance,
     door shut, the reading settles. */
  S.weigh = async (id, g, label) => {
    const run = S.run, B = run.bal, pan = B.pan, wg = run.wg, sp = run.sp, bo = B.it.obj;
    S.say(`Weighing ${g} g ${L.CHEM[id] ? L.CHEM[id].formula : id}…`);
    const jar = run.saltSrc[id];                                           // owner: salts from their small vial (filled earlier); NaOH from its box
    if (!jar) throw new Error('No vial / box for ' + id);
    // camera follows the work: close on the balance (door, tare, taps), close on the vial for each dip
    const camBal = (d = 1.1) => S.cam(bo.localToWorld(V3(0, 0.13, 0)), S.DIR.balance(), 0.55, d);
    const camVial = () => S.cam(wpos(jar.obj).add(V3(0, (jar.mouthY || jar.lipY || 0.06) + 0.01, 0)), S.DIR.balance(), 0.36, 0.7);
    await camBal();
    S.say('Open the draft-shield door; empty watch glass onto the pan');
    await S.balDoor(true);
    // the watch glass comes to the doorway first, then slides in level onto the pan (not down through the top)
    // the spatula comes out of its holder and stays IN THE HAND for the whole weighing + transfer (owner)
    const holdP = bo.localToWorld(V3(0.12, 0.2, 0.24));
    await Promise.all([S.carry(wg, bo.localToWorld(V3(0, 0.15, 0.22))), S.take(sp).then(() => spPose(sp, holdP, Math.PI, deg(-10), 1.4, 0.12))]);
    await S.carry(wg, wpos(pan.root), { surf: pan, dur: 0.6, lift: 0.0 });
    await S.balDoor(false);
    B.it.machine.tare = S.massOn(pan);                                    // TARE with the empty watch glass (door shut)
    S.say('Door shut — TARE'); await S.sleep(0.5);
    await S.capOff(jar, V3(0, 0, 0.09));
    // key points (world)
    const lw = (x, y, z) => bo.localToWorld(V3(x, y, z));
    const mouth = wpos(jar.obj).add(V3(0, jar.mouthY || jar.lipY || 0.108, 0));
    const floorY = jar.vessel ? jar.obj.localToWorld(V3(0, jar.vessel.inner[0][0], 0)).y : mouth.y - 0.06;
    const dip = V3(mouth.x, Math.max(floorY + 0.008, mouth.y - 0.035), mouth.z);
    const door = lw(0, 0.17, 0.2), over = lw(0, 0.094 + 0.008 + 0.012, -0.03), overHi = over.clone().add(V3(0, 0.02, 0));
    if (sp.surface) { L.removeFrom(sp); L.scene.attach(sp.obj); }
    const yIn = yawTo(holdP, mouth), yBal = yawTo(door, over);
    const parts = [g * 0.48, g * 0.4, null];                             // last = the rest (top-up)
    for (let i = 0; i < 3; i++) {
      const part = parts[i] == null ? Math.max(0, g - L.totSol(wg.contents)) : parts[i];
      S.say(i < 2 ? `Scoop ${i + 1}: spatula into the vial` : 'Top-up: a little more salt');
      // into the vial, spoon first
      await Promise.all([camVial(), spPose(sp, mouth.clone().add(V3(0, 0.03, 0)), yIn, deg(55), 0.7, i === 0 ? 0.04 : 0.02)]);
      await spPose(sp, dip, yIn, deg(55), 0.35);
      L.addC(sp.contents, L.takeSolid(jar.contents, part)); L.refreshTool(sp);
      await spPose(sp, dip.clone().add(V3(0, 0.006, 0)), yIn, deg(35), 0.3);              // twist: scoop
      await spPose(sp, mouth.clone().add(V3(0, 0.04, 0)), yIn, deg(12), 0.35);            // straight out, nearly level
      // through the open door to the watch glass
      await Promise.all([camBal(0.7), S.balDoor(true), spPose(sp, door, yBal, deg(6), 0.7, 0.03)]);
      await spPose(sp, overHi, yBal, deg(8), 0.45);
      await spPose(sp, over, yBal, deg(18), 0.3);
      // gentle taps: each one lets a little salt fall
      const taps = i < 2 ? 4 : 6, each = part / taps;
      for (let k = 0; k < taps; k++) {
        await spPose(sp, over.clone().add(V3(0, -0.002, 0)), yBal, deg(24), 0.09);
        await spPose(sp, over, yBal, deg(18), 0.11);
        L.receive(wg, L.takeSolid(sp.contents, k === taps - 1 ? L.totSol(sp.contents) : each), { checks: false }); L.refreshTool(sp);
        await S.sleep(0.08);
      }
      sp.contents = L.emptyC(); L.refreshTool(sp);
      // back out through the door
      await spPose(sp, overHi, yBal, deg(8), 0.25);
      await spPose(sp, door, yBal, deg(6), 0.4);
    }
    // spatula stays in the hand (spoon up, clear of the balance); door shut, the reading settles
    await spPose(sp, holdP, Math.PI, deg(-10), 0.6, 0.02);
    await S.balDoor(false);
    S.say('Door shut — reading settles'); await S.sleep(0.6);
    await S.capOn(jar);
    S.adv(90);
    S.say(`${label}: ${g.toFixed(3)} g on the watch glass.`); await S.sleep(0.8);
  };
  // the loaded watch glass comes off the pan: door opened, glass lifted out through the doorway, door shut
  S.wgOffPan = async () => {
    const run = S.run, wg = run.wg, B = run.bal;
    if (wg.surface !== B.pan) return;
    await S.balDoor(true);
    await S.carry(wg, B.it.obj.localToWorld(V3(0, 0.15, 0.22)), { dur: 0.6, lift: 0.01 });
    S.balDoor(false);
  };
  // watch glass + spatula from the balance to the flask in the hood, salt pushed in (cap off / on)
  S.saltIn = async target => {
    const run = S.run, H = run.hood, wg = run.wg, sp = run.sp;
    await S.wgOffPan();
    await Promise.all([S.carry(wg, H.wgSpot.clone(), { surf: H.s }), S.spHold(sp, H.spSpot.clone().add(V3(0, 0.12, 0.05))), S.cam(H.look(), S.DIR.hood(), 0.7, 1.6)]);
    await S.capOff(target);
    await S.spatulaIn(wg, target, sp);
    await S.capOn(target);
    await S.stow(sp);                                                     // back into the clean tool stand
  };

  /* ---------------- marker (actions/marker.js): write a label in the film ---------------- */
  // the film's marker comes to the item, cap onto its back end, a few strokes, the label appears, back home
  S.markWrite = async (it, lines, mode) => {
    const MK = window.MARKER, mk = S.run.marker; if (!MK || !mk) return;
    const an = MK.anchor(it, mode), o = mk.obj, surf = mk.surface, home = wpos(o), hq = o.getWorldQuaternion(new L.THREE.Quaternion());
    if (surf) L.removeFrom(mk); L.scene.attach(o);
    const p0 = o.position.clone(), q0 = o.quaternion.clone(), off = an.normal.clone().multiplyScalar(0.03);
    const go = (pose, dur) => { const pa = o.position.clone(), qa = o.quaternion.clone(); let t = 0;
      return S.every(dt => { t += dt; const u = Math.min(1, t / dur), v = u * u * (3 - 2 * u); o.position.lerpVectors(pa, pose.p, v); o.quaternion.slerpQuaternions(qa, pose.q, v); return u >= 1; }); };
    await go(MK.writePose(mk, { ...an, pos: an.pos.clone().add(off) }), 0.7);
    let t = 0; await S.every(dt => { t += dt; MK.capOff(mk, Math.min(1, t / 0.25)); return t >= 0.25; });
    await go(MK.writePose(mk, an), 0.2);
    const span = an.mode === 'back' ? 0.008 : 0.016; t = 0;
    await S.every(dt => { t += dt; const u = Math.min(1, t / 1.0), pose = MK.writePose(mk, an, (u - 0.5) * span + Math.sin(u * 40) * 0.0012); o.position.copy(pose.p); o.quaternion.copy(pose.q); return u >= 1; });
    MK.apply(it, lines, { mode });
    t = 0; await S.every(dt => { t += dt; MK.capOff(mk, 1 - Math.min(1, t / 0.25)); return t >= 0.25; });
    await go({ p: home, q: hq }, 0.6);
    if (surf) S.putOn(mk, surf, home);
  };

  /* ---------------- little visual helpers ---------------- */
  S.band = (it, y, r, h, color, opacity = 1, rough = 0.6) => {
    const m = new L.THREE.Mesh(new L.THREE.CylinderGeometry(r, r, h, 32, 1, true), new L.THREE.MeshStandardMaterial({ color, roughness: rough, metalness: color === '#c9ced4' ? 0.6 : 0, transparent: opacity < 1, opacity, side: L.THREE.DoubleSide }));
    m.position.y = y + h / 2; it.obj.add(m); return m;
  };
  S.labelOn = (it, y, a, b, r = 0.0147) => {
    const t = L.K.canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#fffdf6'; g.fillRect(0, 0, w, h); g.fillStyle = '#1b2027'; g.font = 'bold 30px system-ui'; g.textAlign = 'center'; g.fillText(a, w / 2, 52); g.font = '24px system-ui'; g.fillText(b, w / 2, 96); });
    t.wrapS = t.wrapT = L.THREE.ClampToEdgeWrapping;
    const m = new L.THREE.Mesh(new L.THREE.CylinderGeometry(r, r, 0.022, 32, 1, true, -0.9, 1.8), new L.THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
    m.position.y = y; it.obj.add(m); return m;
  };
})();
