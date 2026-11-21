/* SYNTHESIS block family: SPIN COATING (main table; no ramp, owner)
   spinPrep    aged sol vial + hotplates C / B / A to the main table, heated for the layer stages,
               funnel cover set out, spin-coater lid open.  { gel: 90, pyro: 280, burn: 410, warm: 8 (min) }
   chuckLoad   one substrate out of the ethanol with clean tweezers, back wiped, onto the chuck, vacuum on. {}
   spinPrewet  spin off the dip ethanol, ~100 µl ethanol, spin dry.  { rpm: 3000, s1: 10, drop: 0.1, s2: 60 }
   spinLayer   micropipette the sol onto the centre of the STATIONARY substrate, spin program.
               { layer: 1, drop: 0.02, program: [{ rpm: 500, s: 5, label }, { rpm: 3000, s: 30, label }] }
   The later layers (all stages in one step) are in block_hotplate.js: 'fullLayer'.
   Shared: S.coatLayer(n, p), S.spin(steps, wet). */
(function () {
  const S = window.SYNTH;
  let L = null;
  S.onInit(() => { L = S.L; });
  const V3 = (x, y, z) => new L.THREE.Vector3(x, y, z);
  const wpos = o => S.wpos(o);
  const DEF_PROGRAM = [{ rpm: 500, s: 5, label: 'Stage 1 spread' }, { rpm: 3000, s: 30, label: 'Stage 2 thin' }];

  // spin coater: the lab machine's lid is moved through machine.lidOpen; display drawn on its canvas
  function coater() {
    const sc = S.run.sc;
    const lid = { rotation: {} };
    Object.defineProperty(lid.rotation, 'x', { get: () => -1.3 * sc.lidAngle, set: v => { sc.machine.lidOpen = v < -0.65; } });
    return { obj: sc.obj, spinner: sc.spinner, lidHinge: lid, setDisplay: (rpm, s, label) => {
      const d = sc.machine.disp; if (!d || !d.g) return; const g = d.g, c = d.c; g.fillStyle = '#0b1610'; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#7dff9b'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = 'bold 36px ui-monospace,Consolas,monospace';
      g.fillText(`${rpm} rpm`, c.width / 2, c.height * 0.3); g.font = 'bold 26px ui-monospace,Consolas,monospace'; g.fillText(`${s ? s + 's ' : ''}${label}`.slice(0, 18), c.width / 2, c.height * 0.75);
      d.t.needsUpdate = true; d._key = null; } };
  }
  S.spin = (steps, wet = false) => {
    const run = S.run, sub = run.pieces[0];
    const pud = run.tmpPuddle, film = run.tmpFilm;
    pud.parent !== sub.obj && sub.obj.add(pud); film.parent !== sub.obj && sub.obj.add(film);
    const real = steps.reduce((a, s) => a + (s.spin ? s.s : 8), 0);
    return S.clip('spinCoat', { coater: coater(), sub: { obj: sub.obj, puddle: pud, film, wet }, pip: { obj: run.mp.obj, it: run.mp, yOff: run.mp.upLift || 0 }, steps,
      filmColor: S.R.colors.film, filmOpacity: Math.min(0.75, 0.3 + 0.08 * (run.layer || 0)) }).then(() => { S.adv(real); });
  };
  S.coatLayer = async (n, p) => {
    const run = S.run, vi = run.vial, sub = run.pieces[0], drop = p.drop || 0.02, prog = p.program || DEF_PROGRAM;
    await S.capOff(vi, V3(0.05, 0, 0.06));
    await S.take(run.mp);                                  // micropipette off its stand, held
    await S.mpDraw(run.mp, vi, drop);
    await S.capOn(vi);
    run.layer = n;
    run.tmpFilm.visible = false;
    await S.spin([{ drop, what: 'Sol', color: S.R.colors.film }, ...prog.map(s => ({ spin: s.rpm, s: s.s, label: s.label || `${s.rpm} rpm` }))]);
    run.mp.contents = L.emptyC(); run.mp.tip = null; L.refreshTool(run.mp);
    await S.stow(run.mp);                                  // back on the micropipette stand
    sub.film = { layers: n, col: new L.THREE.Color(S.R.colors.film), strength: 0.5, rpm: prog[prog.length - 1].rpm, rel: 1 };
    run.tmpFilm.visible = false;
  };

  S.block('spinPrep', {
    text: p => `Take the aged sol (still clear: do not re-filter unless something precipitated). Hotplates to ${p.gel} / ${p.pyro} / ${p.burn} °C.`,
    async play(p) {
      const run = S.run, M = run.main, vi = run.vial, hp = run.hp;
      await S.cam(M.look(), S.DIR.main(), 1.1, 1.6);
      await Promise.all([S.carry(vi, M.vialSpot.clone(), { surf: M.s }), S.carry(hp.C, M.hpSpots[0].clone(), { surf: M.s, rotY: 0 }), S.carry(hp.B, M.hpSpots[1].clone(), { surf: M.s, rotY: 0 }), S.carry(hp.A, M.hpSpots[2].clone(), { surf: M.s, rotY: 0 })]);
      if (run.parafilm) run.parafilm.visible = false;
      hp.C.machine.setT = p.gel; hp.B.machine.setT = p.pyro; hp.A.machine.setT = p.burn;
      run.funnel.position.copy(wpos(hp.C.plateSurface.root)).add(V3(0.0, 0, -0.05)); run.funnel.visible = true;
      run.sc.machine.lidOpen = true;
      await S.wait((p.warm || 8) * 60, 'Hotplates heating up');
    },
  });
  S.block('chuckLoad', {
    text: () => 'Take one substrate out of the ethanol with clean tweezers; wipe the BACK with tissue; onto the chuck, vacuum on.',
    async play() {
      const run = S.run, d = run.ethDish, sub = run.pieces[0];
      await S.capOff(d, V3(0.11, 0, 0));
      await S.cam(wpos(d.obj), S.DIR.main(), 0.4);
      sub.obj.scale.x = 1 / 3;
      await S.clip('chuckLoad', { sub: { obj: sub.obj, size: 0.025, thick: 0.0011, baseY: 0 }, tool: { obj: run.tw.obj }, from: { pos: wpos(sub.obj) }, to: { pos: wpos(run.sc.chuckSurface.root) },
        color: '#e8f0ff', onPlaced: () => {}, onVacuum: () => { run.sc.machine.vacuum = true; } });
      run.sc.machine.vacuum = true;
      L.placeOn(sub, run.sc.chuckSurface, 0, 0); sub.obj.scale.x = 1 / 3; run.subAt = 'chuck';
      await S.capOn(d);
    },
  });
  S.block('spinPrewet', {
    text: p => `Spin ${p.rpm || 3000} rpm ${p.s1 || 10} s, ~${(p.drop || 0.1) * 1000} µl ethanol, spin dry ${p.rpm || 3000} rpm ${p.s2 || 60} s.`,
    async play(p) {
      const run = S.run, d = run.ethDish, rpm = p.rpm || 3000, drop = p.drop || 0.1;
      await S.spin([{ spin: rpm, s: p.s1 || 10, label: 'Spin dry' }], true);
      await S.capOff(d, V3(0.11, 0, 0));
      await S.take(run.mp);
      await S.mpDraw(run.mp, d, drop);
      await S.capOn(d);
      await S.spin([{ drop, what: 'Ethanol', color: '#e8f0ff', dries: true }, { spin: rpm, s: p.s2 || 60, label: 'Spin dry' }]);
      run.mp.contents = L.emptyC(); run.mp.tip = null; L.refreshTool(run.mp);
      await S.stow(run.mp);
    },
  });
  S.block('spinLayer', {
    text: p => `Layer ${p.layer || 1}: dispense ${(p.drop || 0.02) * 1000} µl sol on the centre of the stationary substrate; start the program at once (${(p.program || DEF_PROGRAM).map(s => `${s.rpm} rpm ${s.s} s`).join(', ')}).`,
    play: p => S.coatLayer(p.layer || 1, p),
  });
})();
