/* SYNTHESIS block family: FINAL ANNEAL (box furnace = simple dummy on the machine table, owner)
   toFurnace      cooling dish to the furnace; substrate (tweezers) onto the alumina setter. {}
   furnaceAnneal  setter into the chamber, program runs on the display, out again.
                  { program: [...] optional (default CLIPS.furnaceProgram), color: 'annealed' }
   fromFurnace    below 50 °C: substrate back onto the petri dish with tweezers. {} */
(function () {
  const S = window.SYNTH;
  let L = null;
  S.onInit(() => { L = S.L; });
  const V3 = (x, y, z) => new L.THREE.Vector3(x, y, z);
  const wpos = o => S.wpos(o);

  S.block('toFurnace', {
    text: () => 'All layers done: substrate on a clean alumina setter, in the centre of the box furnace.',
    async play() {
      const run = S.run, F = run.furn, dish = run.coolDish.owner, sub = run.pieces[0];
      await S.cam(F.look(), S.DIR.machine(), 1.0, 1.8);
      await S.carry(dish, F.dishSpot.clone(), { surf: F.s });
      await S.clip('tweezerMove', { sub: { obj: sub.obj, size: 0.025, thick: 0.0011, baseY: 0 }, tool: { obj: run.tw2.obj }, from: { pos: wpos(sub.obj) },
        to: { pos: wpos(F.setter.obj).add(V3(0, 0.003, 0)) }, onPlaced: () => {} });
      L.removeFrom(sub); F.setter.obj.add(sub.obj); sub.obj.position.set(0, 0.003, 0); sub.obj.rotation.set(0, 0, 0); run.subAt = 'furnace';
    },
  });
  S.block('furnaceAnneal', {
    text: () => 'Program: RT→150 °C (5 °C/min, 30 min) → 300 °C (5, 30 min) → 500 °C (3, 90 min) → furnace cool (3 °C/min).',
    async play(p) {
      const run = S.run, F = run.furn, C = window.CLIPS, prog = p.program || C.furnaceProgram, t0 = run.clock;
      run.annealStart = t0;
      const color = () => { const s = run.pieces[0]; if (s.film) s.film.col = new L.THREE.Color(typeof p.color === 'string' && S.R.colors[p.color] ? S.R.colors[p.color] : (p.color || S.R.colors.annealed)); };
      await S.clip('furnaceRun', { furnace: { obj: F.g, f: F.it.furnace }, load: { obj: F.setter.obj }, program: prog, onTemp: (T, m) => { run.clock = t0 + m * 60; }, onDone: color }, { title: 'Annealing…' });
      color();
      run.clock = t0 + C.furnaceCurve(prog).slice(-1)[0][0] * 60;
    },
  });
  S.block('fromFurnace', {
    text: () => 'Below 50 °C: take the substrate out with tweezers.',
    async play() {
      const run = S.run, F = run.furn, sub = run.pieces[0];
      L.scene.attach(sub.obj);
      await S.clip('tweezerMove', { sub: { obj: sub.obj, size: 0.025, thick: 0.0011, baseY: 0 }, tool: { obj: run.tw2.obj }, from: { pos: wpos(F.setter.obj).add(V3(0, 0.003, 0)) },
        to: { pos: wpos(run.coolDish.root) }, onPlaced: () => {} });
      S.putOn(sub, run.coolDish, wpos(run.coolDish.root)); run.subAt = 'dish';
    },
  });
})();
