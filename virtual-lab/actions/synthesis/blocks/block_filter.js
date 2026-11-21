/* SYNTHESIS block family: FILTER + STORE
   syringeFilter  the sol through a 0.22 µm PTFE syringe filter into the clean 40 ml vial (hotplate
                  stirring stops; 10 ml syringe, as many fills as needed). {}
   sealVial       cap on, Parafilm band, label.  { label: 'BFO', line2: '≈0.26 M (Fe)' } */
(function () {
  const S = window.SYNTH;
  S.block('syringeFilter', {
    text: () => 'Filter through a 0.22 µm PTFE syringe filter into a clean glass vial.',
    async play() {
      const run = S.run, L = S.L, V3 = S.V3, H = run.hood, sy = run.syr, f = run.flask, vi = run.vial;
      run.hp.B.machine.setRpm = 0;
      await S.cam(H.look(), S.DIR.hood(), 0.7);
      await S.capOff(f); await S.capOff(vi, V3(0.05, 0, 0.06));
      await S.take(sy);                                    // syringe out of the tool stand
      let n = 0;
      while (L.totLiq(f.contents) > 0.3 && n < 6) {
        n++; if (n > 1) run.speed = Math.max(run.speed, 3);
        sy.filter = null; L.refreshTool(sy);
        await S.draw(sy, f, Math.min(10, L.totLiq(f.contents)));
        sy.filter = { used: false }; L.refreshTool(sy);
        await S.give(sy, vi, 10);
      }
      run.speed = run.baseSpeed;
      sy.filter = null; L.refreshTool(sy);                // used filter off (single-use)
      await S.stow(sy);
      await S.capOn(f);
      await S.carry(f, H.flaskSpot.clone(), { surf: H.s });       // empty flask off the hotplate (stays in the hood)
      S.adv(6 * 60);
    },
  });
  S.block('sealVial', {
    text: () => 'Seal the vial with Parafilm. Label it: batch ID, date, concentration. Store sealed.',
    async play(p) {
      const run = S.run, vi = run.vial;
      await S.capOn(vi);
      const top = vi.vessel.inner[vi.vessel.inner.length - 1][0];
      run.parafilm = S.band(vi, top - 0.004, 0.0122, 0.012, '#e9eef0', 0.85);
      await S.cam(S.wpos(vi.obj).add(S.V3(0, 0.04, 0)), S.DIR.hood(), 0.3);
      S.say('Label written with the black permanent marker');
      await S.markWrite(vi, [`${p.label || 'SOL'}-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-1`, p.line2 || '']);
      await S.sleep(1.5); S.adv(120);
    },
  });
})();
