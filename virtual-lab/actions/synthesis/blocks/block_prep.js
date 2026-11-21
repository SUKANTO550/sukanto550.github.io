/* SYNTHESIS block family: PREPARATION
   washAll   wash every glassware item / tool at the basin first (owner, 2026-11-21)
             { first: 1.4, rest: 0.12 }  speed factors: first item ~30 s (normal), the rest ~3 s each
   The normal lab wash (as actions/auto_clean.js): detergent + brush, tap water, acetone, IPA, air-dry
   15 min. Working jars and salt vials are already clean and filled (not washed). Items go to the basin
   counter in batches (as many as fit), are washed one by one and go back to their places. */
(function () {
  const S = window.SYNTH;
  let L = null;
  S.onInit(() => { L = S.L; });
  const V3 = (x, y, z) => new L.THREE.Vector3(x, y, z);
  const wpos = o => S.wpos(o);
  const Q = () => new L.THREE.Quaternion();
  const qZ = a => new L.THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), a);
  const spoutW = () => L.basin.obj.localToWorld(L.basin.spout.clone());
  const basinW = (x, y, z) => L.basin.obj.localToWorld(V3(x, y, z));
  function mouthOf(it) { const v = it.vessel; if (!v) return null; const top = v.inner[v.inner.length - 1]; return { y: top[0], r: top[1], floor: v.inner[0][0] }; }
  function fillMax(it, kind) {
    if (!it.vessel) return 0; const cap = it.vessel.cap;
    return kind === 'det' ? Math.min(cap * 0.35, 80) : kind === 'tap' ? Math.min(cap * 0.3, 60) : Math.max(0.6, Math.min(cap * 0.06, 8));
  }
  const fillTo = (it, ml) => { if (!it.vessel) return; it.contents = L.emptyC(); if (ml > 0.02) it.contents.liq.water = ml; };   // shown only, never kept
  function glideO(o, p1, q1, dur, arc = 0) {
    const p0 = o.position.clone(), q0 = o.quaternion.clone(); let t = 0;
    return S.every(dt => { t += dt; const u = Math.min(1, t / Math.max(1e-3, dur)), v = u * u * (3 - 2 * u);
      o.position.lerpVectors(p0, p1, v); o.position.y += Math.sin(Math.PI * v) * arc; o.quaternion.slerpQuaternions(q0, q1, v); return u >= 1; });
  }
  function topW(it) {                                     // world point the water / jet aims at
    const m = mouthOf(it);
    if (!m) return it.obj.localToWorld(V3(0, 0, 0)).add(V3(0, Math.max(0.006, it.h || 0.01), 0));
    const ml = L.totLiq(it.contents);
    return it.obj.localToWorld(V3(0, ml > 0.02 ? L.heightFor(it.vessel, ml) : m.floor, 0));
  }
  function tapRun(it, ml, dur) {                          // tap on: water fills the vessel (tools: water runs over them)
    const a = spoutW(); let t = 0;
    return S.every(dt => { t += dt; const u = Math.min(1, t / Math.max(1e-3, dur)); fillTo(it, ml * u);
      const y = Math.min(a.y - 0.01, topW(it).y); L.setStream(S.washS.tap, a, V3(a.x, y, a.z), 0.006, new L.THREE.Color(0x7fbdf5), 0.95);
      if (u >= 1) { S.washS.tap.visible = false; return true; } return false; });
  }
  function brushRun(it, dur) {                            // scrub: brush up and down inside (tools: along them), item turning
    const b = S.run.brush, m = mouthOf(it), base = it.obj.quaternion.clone();
    if (m) { b.br.scale.set(Math.max(0.004, Math.min(0.028, m.r * 0.75)), 1, Math.max(0.004, Math.min(0.028, m.r * 0.75))); it.obj.add(b); b.rotation.set(0, 0, 0); }
    else { L.scene.add(b); b.br.scale.set(0.008, 1, 0.008); b.rotation.set(0, 0, Math.PI / 2); }
    b.visible = true;
    const c0 = it.obj.position.clone().add(V3(0, (it.h || 0.01) + 0.012, 0));
    let t = 0;
    return S.every(dt => { t += dt; const w = Math.sin(t * 9);
      if (m) { b.position.set(0, m.floor + 0.002 + Math.max(0.01, m.y - m.floor - 0.03) * (0.5 + 0.5 * w), 0); it.obj.quaternion.copy(base).multiply(new L.THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), t * 1.6)); }
      else b.position.copy(c0).add(V3(0.05 * w, 0, 0));
      if (t >= dur) { it.obj.quaternion.copy(base); b.visible = false; b.parent && b.parent.remove(b); return true; } return false; });
  }
  function swirlRun(it, dur) {
    const base = it.obj.quaternion.clone(); let t = 0;
    return S.every(dt => { t += dt; it.obj.quaternion.copy(base).multiply(new L.THREE.Quaternion().setFromEuler(new L.THREE.Euler(0.1 * Math.sin(t * 9), 0, 0.1 * Math.cos(t * 9))));
      if (t >= dur) { it.obj.quaternion.copy(base); return true; } return false; });
  }
  async function dumpRun(it, q0, dur) {                   // mouth down over the bowl, the water runs out (tools: shaken off)
    const m = mouthOf(it);
    if (!m) { await swirlRun(it, dur * 0.6); return; }
    const qd = qZ(2.2).multiply(q0.clone()), M = basinW(0.3, 0.95, 0.03), pd = M.clone().sub(V3(0, m.y, 0).applyQuaternion(qd));
    await glideO(it.obj, pd, qd, dur * 0.4, 0.02);
    const v0 = L.totLiq(it.contents), floorY = basinW(0, L.basin.bowlY, 0).y + 0.002; let t = 0;
    await S.every(dt => { t += dt; const u = Math.min(1, t / Math.max(1e-3, dur * 0.6)); fillTo(it, v0 * (1 - u));
      const lip = it.obj.localToWorld(V3(0, m.y, 0));
      if (v0 > 0.02 && u < 0.95) L.setStream(S.washS.pour, lip, V3(lip.x, floorY, lip.z), 0.0045 * Math.sqrt(1 - u * 0.8), new L.THREE.Color(0x7fbdf5), 0.85); else S.washS.pour.visible = false;
      if (u >= 1) { S.washS.pour.visible = false; return true; } return false; });
    fillTo(it, 0);
  }
  // a wash bottle from the basin counter: lifted beside the item, nozzle over the mouth, squeezed, put back
  async function jetRun(it, sol, dur) {
    const run = S.run, wb = run.basinWB[sol];
    if (!wb) { await S.sleep(dur * 0.3); return; }
    const par = wb.obj.parent, lp = wb.obj.position.clone(), lq = wb.obj.quaternion.clone();
    run.wbOut = { wb, par, lp, lq };
    L.scene.attach(wb.obj);
    const m = mouthOf(it), mouthW = m ? it.obj.localToWorld(V3(0, m.y, 0)) : topW(it).add(V3(0, 0.01, 0));
    const home = { p: wb.obj.position.clone(), q: wb.obj.quaternion.clone() };
    const d = mouthW.clone().sub(home.p).setY(0).normalize(), up = V3(0, 1, 0), axis = new L.THREE.Vector3().crossVectors(up, d).normalize();
    const q = Q().setFromAxisAngle(axis, 0.35).multiply(Q().setFromAxisAngle(up, Math.atan2(-d.z, d.x)));
    const tipW = mouthW.clone().addScaledVector(d, -(m ? m.r * 0.6 : 0.012)).add(V3(0, 0.02, 0));
    const posW = tipW.clone().sub(V3(0.0575, 0.1705, 0).applyQuaternion(q));
    await glideO(wb.obj, posW, q, dur * 0.25, 0.03);
    const col = new L.THREE.Color(0xd2e8ff), full = fillMax(it, 'rinse'); let t = 0;
    await S.every(dt => { t += dt; const u = Math.min(1, t / Math.max(1e-3, dur * 0.5)); fillTo(it, full * u);
      L.setStream(S.washS.sq, tipW, topW(it), 0.0015, col, 0.9);
      if (u >= 1) { S.washS.sq.visible = false; return true; } return false; });
    wb.contents.liq[sol] = Math.max(0, (wb.contents.liq[sol] || 0) - 5);
    await glideO(wb.obj, home.p, home.q, dur * 0.25, 0.03);
    par.attach(wb.obj); wb.obj.position.copy(lp); wb.obj.quaternion.copy(lq); run.wbOut = null;
  }
  async function washOne(it, f, k, n, holder) {
    const slow = f >= 1, T = s => s * f, a = spoutW(), m = mouthOf(it);
    const tell = t => S.say(slow ? `${it.name}: ${t}` : `Washing ${k + 1} / ${n}: ${it.name}`);
    const surf = it.surface, home = wpos(it.obj), q0 = it.obj.getWorldQuaternion(Q());
    if (surf) L.removeFrom(it);
    L.scene.attach(it.obj);
    const tapP = V3(a.x, a.y - 0.06 - (m ? m.y : (it.h || 0.01) + 0.01), a.z);
    const rinseP = basinW(0.3, 0.965, 0.08).add(V3(0, m ? 0 : 0.02, 0));
    if (k === 0) await S.cam(V3(a.x, a.y - 0.1, a.z + 0.06), V3(0.1, 0.42, 1), 0.48, 1.0);   // close on the tap + bowl
    tell('to the basin'); await glideO(it.obj, tapP, q0, T(1.6), 0.08);
    tell('detergent wash + brush (1–2 % detergent solution)');
    await tapRun(it, fillMax(it, 'det'), T(1.6)); await brushRun(it, T(4)); await dumpRun(it, q0, T(1.6));
    tell('rinse with tap water'); await glideO(it.obj, tapP, q0, T(0.5));
    await tapRun(it, fillMax(it, 'tap'), T(1.2)); await swirlRun(it, T(0.8)); await dumpRun(it, q0, T(1.4));
    for (const sol of ['acetone', 'ipa']) {
      tell(`rinse with ${sol === 'ipa' ? 'IPA' : 'acetone'}, then pour it out`);
      await glideO(it.obj, rinseP, q0, T(0.5), 0.02);
      await jetRun(it, sol, T(2.1)); await swirlRun(it, T(0.5)); await dumpRun(it, q0, T(1.0));
    }
    if (holder) { tell('into its clean holder to dry (never on the bench)'); await S.carryTo(it, holder, { dur: T(1.6), exact: true }); }
    else { tell('on the counter to dry'); await glideO(it.obj, home, q0, T(1.2), 0.05); if (surf) S.putOn(it, surf, home); }
    it.clean = 'clean'; it.residue.clear(); it.contents = L.emptyC(); it.wet = null; if (it.type !== 'vessel') L.refreshTool(it); L.touch(it);
    S.adv(slow ? 5 * 60 : 3 * 60);
  }

  S.block('washAll', {
    text: () => 'Wash all glassware and tools at the basin: detergent + brush, tap water, acetone, IPA; air-dry.',
    async play(p) {
      const run = S.run, list = run.washList, C = L.sCounter, n = list.length;
      const first = p.first != null ? p.first : 1.4, rest = p.rest != null ? p.rest : 0.12;
      if (!S.washS) S.washS = { tap: L.makeStream(), sq: L.makeStream(), pour: L.makeStream() };
      const origin = new Map(list.map(it => [it, { s: it.surface, x: it.obj.position.x, z: it.obj.position.z }]));
      const capped = list.filter(it => it.cap && typeof it.cap === 'object');
      const view = () => S.cam(spoutW().add(V3(-0.15, -0.15, 0.1)), S.DIR.basin(), 1.2, 1.2);
      await Promise.all(capped.map(it => S.capOff(it, it.vessel && it.vessel.cap > 60 ? V3(0.11, 0, 0) : V3(0.06, 0, 0.06))));
      let i = 0, k = 0;
      while (i < list.length) {
        // bring a batch to the basin counter (each spot reserved first, then all carried together)
        const batch = [];
        for (; i < list.length; i++) {
          const it = list[i], fr = L.findFree(C, it); if (!fr) break;
          const p0 = wpos(it.obj), q0 = it.obj.getWorldQuaternion(Q());
          L.placeOn(it, C, fr.x, fr.z); const to = wpos(it.obj);
          L.scene.attach(it.obj); it.obj.position.copy(p0); it.obj.quaternion.copy(q0);
          batch.push({ it, to });
        }
        if (!batch.length) { const it = list[i++]; batch.push({ it, to: null }); }   // nothing fits: washed straight from its place
        S.say(`To the basin: ${batch.length} item${batch.length > 1 ? 's' : ''}`);
        await Promise.all([view(), ...batch.map(b => b.to ? S.carry(b.it, b.to, { surf: C }) : Promise.resolve())]);
        // tools go straight from the wash into their clean holder (owner); vessels back to the counter, then home
        for (const b of batch) { const o = origin.get(b.it), hold = o.s && o.s.kind === 'stand' ? o.s : null; await washOne(b.it, k === 0 ? first : rest, k, n, hold); b.held = !!hold; k++; }
        // clean items back to their places
        await view();
        S.say('Clean — back to their places');
        await Promise.all(batch.map(b => { const o = origin.get(b.it); return b.to && !b.held ? S.carry(b.it, o.s.root.localToWorld(V3(o.x, b.it.baseY || 0, o.z)), { surf: o.s }) : Promise.resolve(); }));
      }
      await S.wait((p.dryMin || 15) * 60, 'Air-drying (all washed: detergent, tap water, acetone, IPA)', { sim: false });
      await Promise.all(capped.map(it => S.capOn(it)));
    },
  });
})();
