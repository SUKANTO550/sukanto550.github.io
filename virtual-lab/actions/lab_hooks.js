/* =====================================================================
   LAB HOOKS — connects the close-up action clips (actions/*.js) to the main lab (index.html).
   =====================================================================
   index.html stays almost untouched: it loads this file, hands its internals over once
   (LAB_HOOKS.init(window.LAB)) and asks this file first at a few places:
     startPour(src, dst)      pour / squirt / watch glass + spatula        -> true = handled here
     drawLiquid(H, T)         pipette, micropipette, dropper, syringe draw -> true = handled here
     dispense(H, T, ml)       the same tools, dispensing                   -> true = handled here
     actions(H, T, A)         adds menu entries (glass slide -> slide cutter)
     tick(dt), busy()         drive the player; while busy the lab ignores the mouse / keys
   Settings -> "Transfers": Hold to pour (default) / Set amount / Off (old instant behaviour), remembered.
   Rules kept from the lab: warnings never block; mistakes are logged exactly as before; amounts move
   through the same contents functions (receive, takeLiquidFraction, takeSolid). */
(function () {
  const H = window.LAB_HOOKS = {};
  let L = null, P = null, bar = null, overlay = null, cur = null;
  const KEY = 'vl.transfers';
  const getMode = () => { try { return localStorage.getItem(KEY) || 'hold'; } catch (e) { return 'hold'; } };
  const setMode = m => { try { localStorage.setItem(KEY, m); } catch (e) {} };

  const AC = () => window.AUTO_CLEAN || null;                   // actions/auto_clean.js (basin auto-clean)
  const TR = () => window.TOOL_RULES || null;                   // actions/tool_rules.js (clean holders, rack storage)
  H.placed = (it, s) => { if (TR()) TR().placed(it, s); };
  H.opened = v => { if (TR()) TR().opened(v); };
  H.busy = () => !!(P && P.active) || !!(AC() && AC().busy());
  H.tick = dt => { if (P) P.tick(dt); if (AC()) AC().tick(dt); if (TR()) TR().tick(); };
  H.click = (t, s, x, y) => !!(AC() && AC().click(t, s, x, y));
  H.manualClean = (Ht, kind, sol, wb, done) => !!(AC() && AC().manualClean(Ht, kind, sol, wb, done));   // basin menu wash / rinse = the same clip
  H.basinActions = (Ht, A) => {
    if (Ht.type === 'pipette' && Ht.pumpG) A.unshift({ label: 'Take the pipette pump off', fn: () => detachPump(Ht) });
    if (AC()) AC().basinActions(Ht, A);
  };
  H.state = () => P && P.state;                                 // (debug / tests)

  /* ---------------- init (called once by index.html) ---------------- */
  H.init = lab => {
    L = lab;
    const { THREE } = L;
    L.renderer.localClippingEnabled = true;                     // beaker pour: level liquid surface
    P = window.CLIPS.createPlayer({ THREE, scene: L.scene, camera: L.camera,
      getLook: () => L.controls.target,
      setLook: v => { L.controls.target.copy(v); L.camera.lookAt(v); },
      lockView: on => { overlay.style.display = on ? 'block' : 'none'; } });
    makeUI();
    if (TR()) TR().init(L);
    if (AC()) AC().init(L);
    rebuildSlideCutter();
    addWatchGlasses();
    settingsHook();
    // keys during a clip: Space = hold, Esc = skip, everything else (walk, F, ...) is ignored
    addEventListener('keydown', e => {
      if (!H.busy()) return;
      if (e.target.closest && e.target.closest('input,select,textarea')) return;
      if (AC() && AC().busy()) { if (e.code === 'Escape') AC().skip(); e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (e.code === 'Space') { if (!e.repeat) setHold(true); }
      else if (e.code === 'Escape') P.skip();
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
    addEventListener('keyup', e => { if (H.busy() && e.code === 'Space') { setHold(false); e.stopImmediatePropagation(); } }, true);
  };

  /* ---------------- UI: clip bar + input shield ---------------- */
  function makeUI() {
    overlay = document.createElement('div');
    Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: 4, display: 'none', background: 'transparent' });
    ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'contextmenu', 'touchstart'].forEach(ev => overlay.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }, { passive: false }));
    document.body.appendChild(overlay);
    bar = document.createElement('div');
    Object.assign(bar.style, { position: 'fixed', left: '50%', bottom: '18px', transform: 'translateX(-50%)', zIndex: 6, display: 'none',
      gap: '8px', alignItems: 'center', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px', padding: '10px 14px' });
    bar.innerHTML = `<span class="t" style="color:var(--muted);max-width:240px"></span><span class="a" style="font-weight:700;min-width:84px;text-align:center;font-variant-numeric:tabular-nums"></span>
      <button class="h" style="background:#2a5d3a;border-color:#3f8a55;padding:9px 16px;user-select:none;touch-action:none">Hold to pour (Space)</button>
      <button class="d">Done</button><button class="s">Skip (Esc)</button>`;
    document.body.appendChild(bar);
    const hb = bar.querySelector('.h');
    hb.onpointerdown = e => { e.preventDefault(); hb.setPointerCapture(e.pointerId); setHold(true); };
    hb.onpointerup = hb.onpointercancel = () => setHold(false);
    bar.querySelector('.d').onclick = () => { setHold(false); P.done(); };
    bar.querySelector('.s').onclick = () => P.skip();
    (function upd() {                                           // live amount
      if (cur && P.active) { const st = P.state; if (st && cur.fmt) bar.querySelector('.a').textContent = cur.fmt(st.done) + (st.mode === 'amount' && isFinite(st.goal) ? ' / ' + cur.fmt(st.goal) : ''); }
      requestAnimationFrame(upd);
    })();
  }
  function setHold(on) { P.hold(on); bar.querySelector('.h').style.background = on ? '#3f8a55' : '#2a5d3a'; }
  function showBar(title, holdable, fmt) {
    bar.querySelector('.t').textContent = title;
    bar.querySelector('.h').style.display = holdable ? '' : 'none';
    bar.querySelector('.d').style.display = holdable ? '' : 'none';
    bar.querySelector('.a').textContent = ''; cur = { fmt }; bar.style.display = 'flex';
    ['tip', 'hand'].forEach(id => { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; });   // free the bottom of the screen
  }
  function hideBar() { bar.style.display = 'none'; cur = null; ['tip', 'hand'].forEach(id => { const e = document.getElementById(id); if (e) e.style.visibility = ''; }); }

  /* play a clip; mode: 'hold' | 'amount' (needs amount) | step clips ignore it */
  function play(name, c, { mode = 'hold', amount = 0, title = '', fmt = null, onEnd } = {}) {
    const def = window.CLIPS.defs[name];
    showBar(title || def.label, !def.noLoop && mode === 'hold', fmt);
    P.play(name, c, { mode, amount, onEnd: r => { hideBar(); onEnd && onEnd(r); L.updateHand && L.updateHand(); } });
    return true;
  }
  // ask the amount first (Set amount mode), else go straight on
  function withAmount(title, text, max, unit, step, go) {
    if (getMode() !== 'amount') return go('hold', 0);
    const fmt = v => unit === 'g' ? `${(+v).toFixed(3)} g` : L.fmtVol(+v);
    L.amountDialog({ title, text, min: step, max: Math.max(step, max), step, value: Math.max(step, max / 2), fmt, ok: v => go('amount', v) });
    return true;
  }

  /* ---------------- helpers on lab items ---------------- */
  const hex = col => col ? '#' + col.getHexString() : '#e8f0ff';
  const lookHex = it => { const l = L.contentsLook(it); return l ? hex(l.col) : '#e8f0ff'; };
  function vessel(T) {                                          // the clip's view of a lab vessel
    const v = T.vessel, top = v.inner[v.inner.length - 1];
    return { obj: T.obj, mouth: new L.THREE.Vector3(0, top[0] + 0.001, 0), mouthR: top[1], floorY: v.inner[0][0],
      surfaceY: () => { const l = L.totLiq(T.contents); return l > 0.0005 ? L.heightFor(v, l) : v.inner[0][0] + (L.totSol(T.contents) > 0 ? 0.003 : 0); } };
  }
  const isVessel = T => !!(T && T.vessel);
  function hideLayer(mesh, on) { if (mesh) mesh.layers.set(on ? 31 : 0); }
  function roomIn(T) { return T.vessel ? Math.max(0, T.vessel.cap - L.totLiq(T.contents)) : Infinity; }

  /* ---------------- POUR / SQUIRT / SPATULA ---------------- */
  H.startPour = (src, dst) => {
    if (getMode() === 'off' || H.busy() || !isVessel(dst)) return false;
    const liq = L.totLiq(src.contents), sol = L.totSol(src.contents);
    // watch glass with salt -> pushed in with a spatula
    if (src.kind === 'watchglass' && sol > 0 && liq < 0.0005) return spatulaIn(src, dst);
    if (liq <= 0.0005) return false;                            // solids from jars etc.: old pour
    let name = null;
    if (src.type === 'washBottle') name = 'washBottle';
    else if (src.kind === 'beaker') name = 'beakerPour';
    else if (src.isMain || src.vessel) name = 'stockPour';
    if (!name) return false;
    // same checks as the old pour (warnings only)
    if (dst.isMain) L.mistake('pourBack', `Never pour anything back into the stock bottle (${L.CHEM[dst.chem].name}).`, dst);
    L.checkClean(dst); L.checkResidue(dst, L.chemsIn(src.contents));
    const verb = name === 'washBottle' ? 'Squirt' : 'Pour';
    return withAmount(`${verb}: ${src.name}`, `Into ${dst.name}`, Math.min(liq, roomIn(dst)), 'ml', 0.1, (mode, amount) => {
      const c = { dst: vessel(dst), color: name === 'washBottle' ? '#dbe9ff' : lookHex(src),
        available: () => L.totLiq(src.contents), room: () => roomIn(dst),
        onAmount: ml => { const have = L.totLiq(src.contents); if (have <= 0) return; L.receive(dst, L.takeLiquidFraction(src.contents, Math.min(1, ml / have), true), { checks: false }); },
        onNotice: n => L.toast(n === 'empty' ? `${src.name} is empty.` : `${dst.name} is full.`) };
      if (name === 'washBottle') c.src = { obj: src.obj, tip: new L.THREE.Vector3(0.0575, 0.1705, 0), body: src.obj.children[0], bodyR: 0.036, height: 0.135, start: liq };
      else if (name === 'beakerPour') {
        const v = src.vessel, top = v.inner[v.inner.length - 1];
        c.src = { obj: src.obj, lipR: src.lipR, lipY: src.lipY, R: top[1], H: top[0], inner: v.inner, cap: v.cap, start: liq,
          surfaceY: () => L.heightFor(v, L.totLiq(src.contents)), hideContents: h => { hideLayer(v.liqMesh, h); hideLayer(v.surfMesh, h); } };
      } else {
        const top = src.vessel ? src.vessel.inner[src.vessel.inner.length - 1] : [src.h, src.r * 0.4];
        c.src = { obj: src.obj, lipR: src.lipR || top[1], lipY: src.lipY || top[0], bodyR: src.r - 0.003, start: liq };
      }
      return play(name, c, { mode, amount, title: `${verb}ing: ${src.name} → ${dst.name}`, fmt: v => L.fmtVol(v),
        onEnd: r => { L.touch(src); L.touch(dst); if (r.done > 0) L.toast(`${verb === 'Squirt' ? 'Squirted' : 'Poured'} ${L.fmtVol(r.done)}.`); } });
    });
  };

  // the spatula the user brought: the nearest one within 0.8 m of the target (not in the hand)
  function findSpatula(dst) {
    const { THREE } = L, dW = new THREE.Vector3(); dst.obj.getWorldPosition(dW);
    let sp = null, best = 0.8;
    for (const it of L.items) if (it.type === 'spatula' && it.obj.parent && it !== L.getHeld()) { const p = new THREE.Vector3(); it.obj.getWorldPosition(p); const dd = p.distanceTo(dW); if (dd < best) { best = dd; sp = it; } }
    return sp;
  }
  H.findSpatula = findSpatula;
  function spatulaIn(src, dst) {
    const { THREE } = L;
    // a spatula from near the vessel (within 0.8 m); otherwise one is brought along just for the clip
    const dW = new THREE.Vector3(); dst.obj.getWorldPosition(dW);
    const sp = findSpatula(dst);
    let temp = null;
    if (!sp) L.mistake('noTool', `No spatula next to ${dst.name} — bring a clean spatula from the equipment rack first (one was lent for this transfer).`, dst);
    if (!sp) { temp = new THREE.Group(); window.EQUIP.spatula(L.K, { obj: temp }); temp.position.copy(dW).add(new THREE.Vector3(0.12, 0, 0.08)); L.scene.add(temp); }
    if (dst.isMain) L.mistake('pourBack', `Never put chemical back into the stock bottle (${L.CHEM[dst.chem].name}).`, dst);
    L.checkClean(dst); L.checkResidue(dst, L.chemsIn(src.contents));
    if (sp) { L.checkClean(sp); L.chemsIn(src.contents).forEach(id => sp.residue.add(id)); }
    const id = Object.keys(src.contents.sol)[0], start = L.totSol(src.contents);
    return withAmount('Transfer with a spatula', `From ${src.name} into ${dst.name}`, start, 'g', 0.01, (mode, amount) => play('spatulaTransfer', {
      src: { obj: src.obj, start, hideContents: h => hideLayer(src.vessel.crystals, h) }, dst: vessel(dst), tool: sp ? sp.obj : temp,
      color: L.CHEM[id] ? L.CHEM[id].solid : '#ffffff',
      available: () => L.totSol(src.contents), onAmount: g => L.receive(dst, L.takeSolid(src.contents, g), { checks: false }),
      onNotice: () => L.toast(`${src.name} is empty.`) },
      { mode, amount, title: `Spatula: ${src.name} → ${dst.name}`, fmt: v => `${v.toFixed(3)} g`,
        onEnd: r => { if (temp) L.scene.remove(temp); L.touch(src); L.touch(dst); if (r.done > 0) L.toast(`Transferred ${r.done.toFixed(3)} g.`); } }));
  }

  /* ---------------- DRAW ---------------- */
  H.drawLiquid = (Ht, T) => {
    if (Ht.type === 'pipette' && !Ht.pumpG && !H.busy() && L.totLiq(T.contents) > 0)
      L.mistake('noPump', `No pipette pump on the ${Ht.name} — never pipette by mouth. Hold the pipette and click the pipette pump to attach it.`, Ht);
    if (getMode() === 'off') return false;
    if (H.busy() || !isVessel(T) || !['pipette', 'micropipette', 'dropper', 'syringe'].includes(Ht.type)) return false;
    if (Ht.type === 'micropipette' && !Ht.tip) { L.toast('Attach a tip first (click a tip box while holding the micropipette).'); return true; }
    const avail = L.totLiq(T.contents);
    const before = () => {                                      // same warnings as the old draw
      if (T.isMain) L.mistake('mainBottle', `Never take liquid straight from the stock bottle (${L.CHEM[T.chem].name}). Pour some into a working container first.`, T);
      if (Ht.type === 'micropipette') { if (Ht.tip.used) L.mistake('reuseSingle', 'That tip was already used — tips are single-use. Eject it and take a new one.', Ht); }
      else { L.checkClean(Ht); L.checkResidue(Ht, L.chemsIn(T.contents)); }
      if (Ht.type === 'syringe' && Ht.filter) L.toast('Tip: normally you draw first, then attach the filter.');
    };
    const onAmount = ml => {                                    // source -> tool, exactly like the old draw
      const a = L.totLiq(T.contents); if (a <= 0) return;
      const part = L.takeLiquidFraction(T.contents, Math.min(1, ml / a), false);
      L.addC(Ht.contents, part); L.chemsIn(part).forEach(id => (Ht.tip ? Ht.tip.residue : Ht.residue).add(id));
      if (Ht.tip) Ht.tip.used = true;
      L.refreshTool(Ht);
    };
    const end = r => { L.touch(T); L.refreshTool(Ht); if (r.done > 0) L.toast(`Drew ${L.fmtVol(r.done)}.`); };
    if (Ht.type === 'micropipette') {                           // volume = counter (asked like before)
      const step = Ht.min <= 10 ? 1 : 10;
      L.amountDialog({ title: `Draw with the ${Ht.name}`, text: `From ${T.name}`, min: Ht.min, max: Ht.max, step, value: Ht.setVol, fmt: v => `${v} µl`, ok: v => {
        Ht.setVol = v; Ht.updateCounter && Ht.updateCounter(); before();
        const vol = Math.min(v / 1000, avail);
        play('micropipetteDraw', { tool: { obj: Ht.obj, it: Ht, vol, have: () => L.totLiq(Ht.contents), yOff: Ht.upLift || 0 }, src: vessel(T), color: lookHex(T),
          onAmount, available: () => L.totLiq(T.contents) }, { title: `Micropipette: drawing ${v} µl`, onEnd: end });
      } });
      return true;
    }
    const cap = Ht.cap, room = () => Math.max(0, cap - L.totLiq(Ht.contents));
    const tool = toolDesc(Ht);
    const name = { pipette: 'pipetteDraw', dropper: 'dropperDraw', syringe: 'syringeDraw' }[Ht.type];
    return withAmount(`Draw with the ${Ht.name}`, `From ${T.name}`, Math.min(cap, avail), 'ml', 0.1, (mode, amount) => {
      before(); attachTempPump(Ht, tool, true);
      return play(name, { tool, src: vessel(T), color: lookHex(T), available: () => L.totLiq(T.contents), room, onAmount,
        onNotice: n => L.toast(n === 'empty' ? `${T.name} is empty.` : `${Ht.name} is full.`) },
        { mode, amount, title: `Drawing with the ${Ht.name}`, fmt: v => L.fmtVol(v), onEnd: r => { attachTempPump(Ht, tool, false); end(r); } });
    });
  };
  function toolDesc(Ht) {
    const lift = Ht.upLift || 0, cap = Ht.cap;
    if (Ht.type === 'pipette') return { obj: Ht.obj, tipY: -0.03 + lift, cap, have: () => L.totLiq(Ht.contents), levelY: ml => 0.002 + 0.288 * ml / cap + lift };
    if (Ht.type === 'dropper') return { obj: Ht.obj, tipY: -0.05 + lift, cap, bulb: Ht.bulb, have: () => L.totLiq(Ht.contents) };
    return { obj: Ht.obj, tipY: (Ht.filter ? Ht.filterTipY : -0.012) + lift, filter: !!Ht.filter, cap, have: () => L.totLiq(Ht.contents) };
  }
  // the lab's pipette pump (shelf item) is attached with "Attach the pipette pump" and stays on the pipette.
  // Without it the clip lends an upright pump for the clip only (the draw already logged the mistake).
  const isPumpItem = it => !!(it && it.type === 'misc' && /^Pipette pump/.test(it.name));
  function attachPump(Ht, pumpIt) {
    if (Ht.pumpG || !pumpIt) return;
    if (L.getHeld() === pumpIt) L.releaseHeld();
    if (pumpIt.surface) L.removeFrom(pumpIt);
    if (pumpIt.obj.parent) pumpIt.obj.parent.remove(pumpIt.obj);
    const g = new L.THREE.Group(); Ht.pumpModel = window.EQUIP.pipettePumpUp(L.K, g); g.position.y = 0.335;
    Ht.pumpModel.plunger.position.y = Math.min(0.045, 0.004 * L.totLiq(Ht.contents));
    g.traverse(o => { if (o.isMesh) { o.userData.item = Ht; Ht.meshes.push(o); } });
    (Ht.pose || Ht.obj).add(g); Ht.pumpG = g; Ht.pumpItem = pumpIt; pumpIt.onPipette = Ht;
    L.toast(`Pipette pump attached to the ${Ht.name}.`, 'ok');
  }
  function detachPump(Ht, toSurface) {
    if (!Ht.pumpG) return;
    Ht.pumpG.traverse(o => { if (o.isMesh) { const i = Ht.meshes.indexOf(o); if (i >= 0) Ht.meshes.splice(i, 1); } });
    Ht.pumpG.parent.remove(Ht.pumpG); Ht.pumpG = null; Ht.pumpModel = null;
    const pumpIt = Ht.pumpItem; Ht.pumpItem = null; if (!pumpIt) return;
    pumpIt.onPipette = null;
    const list = [toSurface, Ht.surface, Ht.prev && Ht.prev.s, L.sMain].filter(Boolean);
    for (const s of list) { const f = L.findFree(s, pumpIt); if (f) { L.placeOn(pumpIt, s, f.x, f.z); break; } }
    L.toast(`Pipette pump taken off — it is on the ${pumpIt.surface ? pumpIt.surface.name : 'table'}.`);
  }
  H.detachPump = detachPump;
  function attachTempPump(Ht, tool, on) {
    if (Ht.type !== 'pipette') return;
    if (Ht.pumpG) { tool.pump = on ? Ht.pumpModel : tool.pump; return; }   // the real, attached pump
    if (on) {
      const g = new L.THREE.Group(); tool.pump = window.EQUIP.pipettePumpUp(L.K, g); g.position.y = 0.335;
      tool.pump.plunger.position.y = Math.min(0.045, 0.004 * L.totLiq(Ht.contents));
      (Ht.pose || Ht.obj).add(g); tool._pumpG = g;
    } else if (tool._pumpG) { tool._pumpG.parent.remove(tool._pumpG); tool._pumpG = null; tool.pump = null; }
  }

  /* ---------------- DISPENSE ---------------- */
  H.dispense = (Ht, T, ml) => {
    if (getMode() === 'off') return false;
    if (H.busy() || !isVessel(T) || !['pipette', 'micropipette', 'dropper', 'syringe'].includes(Ht.type)) return false;
    const have = L.totLiq(Ht.contents); if (have <= 0) return true;
    if (ml && !L.roomFor(T, Math.min(ml, have))) return true;
    if (!ml && Ht.type === 'micropipette' && !L.roomFor(T, have)) return true;
    let caught = 0;
    const before = () => {
      if (T.isMain) L.mistake('pourBack', `Never put anything back into the stock bottle (${L.CHEM[T.chem].name}).`, T);
      L.checkClean(T); L.checkResidue(T, L.chemsIn(Ht.contents));
      if (Ht.type === 'syringe' && Ht.filter) { if (Ht.filter.used) L.mistake('reuseSingle', 'That syringe filter was already used — filters are single-use.', Ht); Ht.filter.used = true; }
    };
    const onAmount = a => {                                     // tool -> target, exactly like the old dispense
      const h = L.totLiq(Ht.contents); if (h <= 0) return;
      const part = L.takeLiquidFraction(Ht.contents, Math.min(1, a / h), true);
      if (Ht.type === 'syringe' && Ht.filter) { caught += L.totSol(part); part.sol = {}; }
      L.receive(T, part, { checks: false });
      if (L.totAll(Ht.contents) < 1e-6) Ht.contents = L.emptyC();
      L.refreshTool(Ht);
    };
    const end = r => { L.touch(T); L.refreshTool(Ht); if (caught > 0) L.toast(`The filter caught ${caught.toFixed(4)} g of undissolved solid.`); };
    if (Ht.type === 'micropipette') {
      before();
      return play('micropipetteDispense', { tool: { obj: Ht.obj, it: Ht, vol: have, have: () => L.totLiq(Ht.contents), yOff: Ht.upLift || 0 }, dst: vessel(T), color: lookHex(Ht),
        onAmount, available: () => L.totLiq(Ht.contents) }, { title: `Micropipette: dispensing into ${T.name}`, onEnd: end });
    }
    const tool = toolDesc(Ht);
    const name = { pipette: 'pipetteDispense', dropper: 'dropperDispense', syringe: 'syringeDispense' }[Ht.type];
    const go = (mode, amount) => {
      before(); attachTempPump(Ht, tool, true);
      return play(name, { tool, dst: vessel(T), color: lookHex(Ht), available: () => L.totLiq(Ht.contents), room: () => roomIn(T), onAmount,
        onNotice: n => L.toast(n === 'empty' ? `${Ht.name} is empty.` : `${T.name} is full.`) },
        { mode, amount, title: `${Ht.type === 'dropper' ? 'Drops' : 'Dispensing'}: ${Ht.name} → ${T.name}`, fmt: v => L.fmtVol(v),
          onEnd: r => { attachTempPump(Ht, tool, false); end(r); } });
    };
    if (ml) return go('amount', Math.min(ml, have));            // e.g. "Add 5 drops": exactly that much
    return withAmount(`Dispense with the ${Ht.name}`, `Into ${T.name}`, Math.min(have, roomIn(T)), 'ml', Ht.type === 'dropper' ? 0.05 : 0.1, go);
  };

  /* ---------------- menu entries ---------------- */
  H.actions = (Ht, T, A) => {
    if (Ht.kind === 'watchglass') A.forEach(a => { if (/^Pour into /.test(a.label)) a.label = a.label.replace('Pour into', 'Push the solid with a spatula into'); });
    if (Ht.type === 'substrate' && !Ht.cutPiece && T.slideCutter && L.totLiq(Ht.contents) <= 0 && !Ht.film)
      A.push({ primary: true, label: 'Cut into 3 pieces (slide cutter + glass cutter)', fn: () => cutSlide(Ht, T) });
  };
  // every menu (all branches of getActions): actions that use unclean items offer the basin auto-clean first
  H.after = (Ht, T, A) => {
    // pipette pump: hold the pipette, click the pump (or hold the pump, click the pipette)
    if (Ht.type === 'pipette' && isPumpItem(T)) A.push({ primary: !Ht.pumpG, label: Ht.pumpG ? 'This pipette already has a pump' : 'Attach the pipette pump', disabled: !!Ht.pumpG, fn: () => attachPump(Ht, T) });
    if (isPumpItem(Ht) && T.type === 'pipette') A.push({ primary: !T.pumpG, label: T.pumpG ? 'That pipette already has a pump' : `Attach the pump to the ${T.name}`, disabled: !!T.pumpG, fn: () => attachPump(T, Ht) });
    if (TR()) {
      TR().menu(Ht, T, A);                                      // tool stand / beaker / petri dish as tool holders
      A.forEach(a => { if (Ht.type === 'stirbar' && /^Drop the stir bar/.test(a.label) && a.fn) { const f = a.fn; a.fn = () => { f(); TR().barInto(Ht, T); }; } });
    }
    if (AC()) A.forEach(a => {
      if (a.disabled || a.primary || !a.fn) return;
      const list = requiredFor(a.label, Ht, T); if (!list) return;
      const fn = a.fn; a.fn = () => AC().guard(list, fn);
    });
  };
  // which items an action needs clean (the one holding the chemical is never on this list)
  function requiredFor(label, Ht, T) {
    if (/^Push the solid with a spatula/.test(label)) return [T, findSpatula(T)];
    if (/^(Pour into|Squirt|Tip everything|Dispense|Add \d|Push through|Tap the solid)/.test(label)) return [T];
    if (/^(Draw liquid|Scoop|Stir by hand)/.test(label)) return [Ht];
    return null;
  }

  /* ---------------- glass slide cutting ---------------- */
  function rebuildSlideCutter() {                              // the guide as 2 parts (base + block) so they can move apart
    const it = L.items.find(i => /^Slide cutting guide/.test(i.name)); if (!it) return;
    while (it.obj.children.length) it.obj.remove(it.obj.children[0]);
    it.meshes = []; it.baseG = new L.THREE.Group(); it.upG = new L.THREE.Group();
    window.EQUIP.slideCutterPart(L.K, it.baseG, 'base'); window.EQUIP.slideCutterPart(L.K, it.upG, 'up');
    it.obj.add(it.baseG, it.upG); L.finishItem(it); it.slideCutter = true;
  }
  function cutSlide(S, T) {
    if (H.busy()) return;
    const { THREE } = L;
    // the glass cutter the user brought: the nearest one (should lie next to the slide cutter)
    const tW = new THREE.Vector3(); T.obj.getWorldPosition(tW);
    let cutter = null, cd = Infinity;
    for (const i of L.items) if (/^Glass cutter/.test(i.name) && i.obj.parent && i !== L.getHeld()) { const p = new THREE.Vector3(); i.obj.getWorldPosition(p); const dd = p.distanceTo(tW); if (dd < cd) { cd = dd; cutter = i; } }
    if (!cutter) { L.toast('No glass cutter in the lab.'); return; }
    const sk = T.surface && T.surface.kind;                     // working space needed (both hands, the base is lifted)
    if (sk !== 'table' && sk !== 'hood') { L.toast('Put the slide cutter on a table (or in the fume hood) first.'); return; }
    if (cd > 0.5) L.mistake('noTool', 'The glass cutter is not next to the slide cutter — bring it over before you start (it was fetched for you this time).', T);
    // nearest OPEN 90 mm petri dish; without one the pieces are set down beside the cutter
    const cW = new THREE.Vector3(); T.obj.getWorldPosition(cW);
    let dish = null, best = 1.5;
    for (const it of L.items) if (it.kind === 'petri' && /90 mm/.test(it.name) && !it.cap && it.obj.parent) {
      const p = new THREE.Vector3(); it.obj.getWorldPosition(p); const dd = p.distanceTo(cW); if (dd < best) { best = dd; dish = it; } }
    let dishC, fake = null;
    if (dish) dishC = { obj: dish.obj, floorY: dish.vessel.inner[0][0], R: dish.vessel.inner[0][1] };
    else {
      L.toast('No open 90 mm petri dish nearby — the pieces go on the table. (Take the lid off a petri dish first.)');
      fake = new THREE.Object3D(); T.obj.parent.add(fake); fake.position.copy(T.obj.position).add(new THREE.Vector3(0.1, 0, 0.06));
      dishC = { obj: fake, floorY: 0, R: 0.04 };
    }
    L.checkClean(S);
    if (L.getHeld() === S) L.releaseHeld();
    if (S.surface) L.removeFrom(S);
    L.scene.attach(S.obj);
    play('glassCut', { base: { obj: T.baseG }, block: { obj: T.upG }, slide: { obj: S.obj, centerY: 0.00055 }, cutter: { obj: cutter.obj, inner: cutter.obj.children[0] },
      dish: dishC, available: () => 1, onPieces: meshes => makePieces(meshes, dish, T, S) },
      { title: 'Cutting the slide into 3 pieces', onEnd: () => { if (fake) fake.parent.remove(fake); L.disposeItem(S); } });
  }
  function makePieces(meshes, dish, T, S) {
    const { THREE } = L, lens = [25.35, 24.3, 25.35];
    let surf = null;
    if (dish) {
      if (!dish.pieceSurface) dish.pieceSurface = L.addSurface(dish.obj, { name: 'Petri dish', kind: 'dish', w: 0.072, d: 0.072, y: dish.vessel.inner[0][0], clear: 0.009 });
      surf = dish.pieceSurface;
    }
    meshes.forEach((m, i) => {
      const it = L.F.substrate(); it.cutPiece = true; it.name = `Glass piece ${lens[i]} × 25 mm (substrate)`; it.clean = S.clean;
      it.obj.scale.x = lens[i] / 75; it.r = 0.018;
      const wp = new THREE.Vector3(); m.getWorldPosition(wp);
      const e = new THREE.Euler().setFromQuaternion(m.getWorldQuaternion(new THREE.Quaternion()), 'YXZ');
      if (surf) { const lp = surf.root.worldToLocal(wp.clone()); it.rotY = e.y; L.placeOn(it, surf, lp.x, lp.z); }
      else { const s = T.surface || L.sMain; const p = L.findFree(s, it); if (p) L.placeOn(it, s, p.x, p.z); else L.autoPlace(it, [L.sMain]); }
      m.parent && m.parent.remove(m); m.geometry.dispose();
    });
    L.toast('Slide cut into 3 pieces (25.35 / 24.3 / 25.35 mm). They are dirty — wash and dry before use.', 'ok');
  }

  /* ---------------- watch glasses (new item: 75 mm, for weighing salts) ---------------- */
  function addWatchGlasses() {
    const E = window.EQUIP; if (!E || !E.watchglassY) return;
    const { R: RR, RC, T: TT } = E.watchglassDims, Y = E.watchglassY;
    const sag = r => RC - Math.sqrt(RC * RC - r * r);
    for (let n = 0; n < 2; n++) {
      const it = L.makeItem({ type: 'vessel', kind: 'watchglass', name: 'Watch glass 75 mm', clean: 'dirty', solidsOnly: true, mass: 22.4 });
      const outer = []; for (let i = 0; i <= 20; i++) { const r = RR * i / 20; outer.push([Math.max(1e-4, r), sag(r)]); }
      outer.push([RR + 0.0004, sag(RR) + TT * 0.5]); for (let i = 20; i >= 0; i--) { const r = RR * i / 20; outer.push([Math.max(1e-4, r), sag(r) + TT]); }
      const inner = []; for (let i = 1; i <= 12; i++) { const r = RR * 0.95 * i / 12; inner.push([Y(r), r]); }
      L.makeVessel(it, outer, inner, L.M.glass, 56);
      it.lipR = RR; it.lipY = Y(RR);
      L.finishItem(it);
      L.autoPlace(it, [L.R[3], L.R[4], L.R[2]]);
    }
  }

  /* ---------------- Settings: "Transfers" choice ---------------- */
  function settingsHook() {
    const box = document.getElementById('dlgBox'); if (!box) return;
    new MutationObserver(() => {
      const h = box.querySelector('h3'); if (!h || h.textContent !== 'Settings' || box.querySelector('.vlTransfers')) return;
      const set = box.querySelector('.set') || box;
      const d = document.createElement('div'); d.className = 'vlTransfers';
      d.innerHTML = `<div style="margin-top:14px;font-weight:700">Transfers (pour, pipette, spatula…)</div>
        <select style="width:100%;margin-top:6px;padding:8px;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:8px">
          <option value="hold">Close-up animation — hold to pour (live amount)</option>
          <option value="amount">Close-up animation — set the amount first</option>
          <option value="off">Off — instant, no animation</option></select>`;
      const sel = d.querySelector('select'); sel.value = getMode(); sel.onchange = () => setMode(sel.value);
      set.appendChild(d);
    }).observe(box, { childList: true });
  }
})();
