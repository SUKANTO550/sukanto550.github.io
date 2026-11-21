/* SYNTHESIS block family: SUBSTRATES (main table; the sonicator is a dummy: time only, owner)
   cutSlide    the 25 x 75 mm glass slide cut into 3 equal 25 x 25 mm pieces (glass_cut clip). {}
   bathClean   pieces into the 250 ml beaker with a liquid, sonicate, discard the liquid at the basin.
               { ml: 50, naoh: 2.5,  optional: g NaOH pellets dissolved in the DI water (5 %)
                 sonic: 15 }         minutes
   toEthanol   pieces into a clean petri dish, submerged in absolute ethanol (kept dipped). { ml: 30 }
   coverDish   lid on the ethanol dish. { min: 5 } */
(function () {
  const S = window.SYNTH;
  let L = null;
  S.onInit(() => { L = S.L; });
  const V3 = (x, y, z) => new L.THREE.Vector3(x, y, z);
  const wpos = o => S.wpos(o);

  async function piecesInto(bk) {
    const floor = bk.vessel.inner[0][0] + 0.0012;
    for (const [i, p] of S.run.pieces.entries()) {
      L.removeFrom(p);
      await S.carry(p, wpos(bk.obj).add(V3((i - 1) * 0.012, floor + i * 0.0012, 0)), { dur: 0.5, lift: 0.06 });
      bk.obj.attach(p.obj);
    }
  }
  async function piecesOut(bk, dish) {
    const floor = dish.vessel.inner[0][0];
    for (const [i, p] of S.run.pieces.entries()) {
      L.scene.attach(p.obj);
      await S.carry(p, wpos(dish.obj).add(V3((i - 1) * 0.028, floor, (i % 2) * 0.01)), { dur: 0.5, lift: 0.06, rotY: 0 });
      dish.obj.attach(p.obj);
    }
  }
  async function sonicate(bk, min) {
    const run = S.run, M = run.main, so = run.sonic, home = wpos(bk.obj);
    await Promise.all([S.carry(bk, so.top.clone(), { dur: 1.6 }), S.cam(so.top.clone(), S.DIR.machine(), 0.7, 1.6)]);
    await S.wait(min * 60, 'Sonicating (the sonicator is a dummy: time only, owner)', { sim: false });
    await Promise.all([S.carry(bk, home, { surf: M.s }), S.cam(home.clone().add(V3(0, 0.05, 0)), S.DIR.main(), 0.6, 1.6)]);
  }
  async function discard(bk) {
    const run = S.run, basinP = run.basinPt;
    await Promise.all([S.carry(bk, basinP.clone(), { dur: 1.4 }), S.cam(basinP.clone().add(V3(0, -0.05, 0)), S.DIR.basin(), 0.7, 1.4)]);
    const q0 = bk.obj.quaternion.clone(), ax = V3(0, 0, 1);
    let t = 0;
    await S.every(dt => { t += dt; const u = Math.min(1, t / 0.6); bk.obj.quaternion.copy(q0).multiply(new L.THREE.Quaternion().setFromAxisAngle(ax, -1.2 * u)); return u >= 1; });
    const h = L.totLiq(bk.contents); if (h > 0) L.takeLiquidFraction(bk.contents, 1, true);
    for (const id in bk.contents.dis) delete bk.contents.dis[id];
    await S.sleep(0.5); t = 0;
    await S.every(dt => { t += dt; const u = Math.min(1, t / 0.5); bk.obj.quaternion.copy(q0).multiply(new L.THREE.Quaternion().setFromAxisAngle(ax, -1.2 * (1 - u))); return u >= 1; });
    await Promise.all([S.carry(bk, run.main.beakerSpot.clone(), { surf: run.main.s, dur: 1.4 }), S.cam(run.main.beakerSpot.clone().add(V3(0, 0.05, 0)), S.DIR.main(), 0.6, 1.4)]);
  }

  S.block('cutSlide', {
    text: () => 'Cut the 25 × 75 mm glass slide into 3 equal 25 × 25 mm pieces with the slide cutter. Edges are sharp.',
    async play() {
      const run = S.run, g = run.cut;
      await S.cam(wpos(g.base).add(V3(0, 0.02, 0)), S.DIR.main(), 0.45);
      await S.clip('glassCut', { base: { obj: g.base }, block: { obj: g.up }, slide: { obj: g.slide, centerY: 0 }, cutter: { obj: g.cutter }, dish: { obj: g.dish.obj, floorY: g.dish.vessel.inner[0][0], R: 0.0438 },
        available: () => 1, onPieces: meshes => { run.pieces = meshes.map(m => { const it = L.F.substrate(); it.obj.scale.x = 1 / 3; it.name = 'Glass piece 25 × 25 mm (substrate)'; it.cutPiece = true; it.r = 0.018;
          const p = wpos(m), q = m.getWorldQuaternion(new L.THREE.Quaternion()); L.scene.add(it.obj); it.obj.position.copy(p).add(V3(0, -0.00055, 0));
          it.obj.quaternion.setFromEuler(new L.THREE.Euler(0, new L.THREE.Euler().setFromQuaternion(q, 'YXZ').y, 0)); m.parent && m.parent.remove(m); return it; }); } });
      g.slide.visible = false; S.adv(10 * 60);
    },
  });
  S.block('markPieces', {
    text: () => 'Label each piece on the BACK (non-deposition) side with the permanent marker.',
    async play(p) {
      const run = S.run; if (!run.pieces) return;
      await S.cam(wpos(run.pieces[1].obj).add(V3(0, 0.01, 0)), S.DIR.main(), 0.3);
      for (const [i, pc] of run.pieces.entries()) { S.say(`Piece ${i + 1}: "${(p.prefix || '') + (i + 1)}" on the back`); await S.markWrite(pc, [(p.prefix || '') + (i + 1)], 'back'); }
      S.adv((p.min != null ? p.min : 5) * 60);
    },
  });
  S.block('bathClean', {
    text: p => p.naoh ? `Pieces into a beaker with 5 % NaOH (${p.naoh} g pellets in ${p.ml} ml DI water). Sonicate ${p.sonic} min. Discard the NaOH.`
      : `Add ${p.ml} ml DI water. Sonicate ${p.sonic} min. Discard the water.`,
    async play(p) {
      const run = S.run, M = run.main, bk = run.beaker;
      await S.cam(wpos(bk.obj).add(V3(0, 0.05, 0)), S.DIR.main(), 0.6);
      await S.squirt(run.wbWater, bk, p.ml);
      if (p.naoh) {
        await S.weigh('naoh', p.naoh, 'NaOH pellets');
        await S.wgOffPan();
        await Promise.all([S.carry(run.wg, M.wgSpot.clone(), { surf: M.s }), S.spHold(run.sp, M.spSpot.clone().add(V3(0, 0.12, 0.05))), S.cam(wpos(bk.obj).add(V3(0, 0.05, 0)), S.DIR.main(), 0.6, 1.6)]);
        await S.spatulaIn(run.wg, bk, run.sp);
        await S.stow(run.sp);                                              // spatula into the clean tool stand
        S.dissolveAll(bk);
      }
      if (run.pieces && run.pieces[0].obj.parent !== bk.obj) await piecesInto(bk);
      await sonicate(bk, p.sonic || 15); await discard(bk);
    },
  });
  S.block('toEthanol', {
    text: () => 'Pieces into a clean petri dish and submerged in absolute ethanol (owner: kept dipped until used).',
    async play(p) {
      const run = S.run, d = run.ethDish, bk = run.beaker;
      await S.cam(wpos(d.obj).add(V3(0, 0.03, 0)), S.DIR.main(), 0.55);
      await S.capOff(d, V3(0.11, 0, 0));
      await piecesOut(bk, d);
      await S.squirt(run.wbEth, d, p.ml || 30);
    },
  });
  S.block('coverDish', {
    text: () => 'Cover the dish. Use within 24 h. Never touch the deposition surface.',
    async play(p) { const d = S.run.ethDish; await S.capOn(d); await S.sleep(0.8); S.adv((p.min != null ? p.min : 5) * 60); },
  });
})();
