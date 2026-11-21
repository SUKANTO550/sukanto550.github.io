/* SYNTHESIS block family: AGING (the clock only - other sections can run meanwhile)
   ageStart  wrap the sealed vial in aluminium foil (dark); the aging clock starts. {}
   ageEnd    wait until the aging time is over (counted from ageStart), unwrap, inspect.  { h: 48 } */
(function () {
  const S = window.SYNTH;
  S.block('ageStart', {
    text: () => 'Store the sealed vial at room temperature in the dark: wrap it in aluminium foil.',
    async play() {
      const run = S.run;
      run.foil = S.band(run.vial, 0.002, 0.0158, 0.075, '#c9ced4', 1, 0.3);
      await S.sleep(1.4);
      run.agingStart = run.clock;
    },
  });
  S.block('ageEnd', {
    text: p => `After ${p.h} h: unwrap and inspect the sol — it must still be clear and homogeneous, no precipitate.`,
    async play(p) {
      const run = S.run, V3 = S.V3, vi = run.vial;
      const left = Math.max(0, p.h * 3600 - (run.clock - (run.agingStart || run.clock)));
      await S.cam(S.wpos(vi.obj).add(V3(0, 0.04, 0)), S.DIR.hood(), 0.6, 1.8);
      await S.wait(left, 'Aging in the dark', { sim: false, show: 4 });
      if (run.foil) run.foil.visible = false;
      await S.cam(S.wpos(vi.obj).add(V3(0, 0.03, 0)), S.DIR.hood(), 0.22); await S.sleep(1.5);
    },
  });
})();
