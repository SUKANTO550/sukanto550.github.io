/* SYNTHESIS block family: REACTION VESSEL
   takeFlask   the clean 100 ml screw-cap conical flask + stir bar into the fume hood, hotplate B
               beside it; cap off, stir bar in. {}  (owner: work in the fume hood throughout) */
(function () {
  const S = window.SYNTH;
  S.block('takeFlask', {
    text: () => 'Take a clean 100 ml screw-cap conical flask with a stir bar. Work in the fume hood throughout.',
    async play() {
      const run = S.run, H = run.hood, f = run.flask, V3 = S.V3;
      await S.cam(H.look(), S.DIR.hood(), 0.9);
      await Promise.all([S.carry(f, H.flaskSpot.clone(), { surf: H.s }), S.carry(run.hp.B, H.hpSpot.clone(), { surf: H.s, rotY: 0 })]);
      await S.capOff(f);
      await S.carry(run.bar, S.wpos(f.obj).add(V3(0, 0.12, 0)), { dur: 0.6 });
      f.obj.add(run.bar.obj); run.bar.obj.position.set(0, f.vessel.inner[0][0] + 0.001, 0); run.bar.obj.rotation.set(0, 0, 0);
      run.bar.inVessel = f; f.stirBar = run.bar;
      S.adv(120);
    },
  });
})();
