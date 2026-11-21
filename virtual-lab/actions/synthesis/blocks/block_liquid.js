/* SYNTHESIS block family: LIQUIDS (owner: only with a graduated pipette + pump from a working jar in
   the fume hood - never poured, no cylinders; the pipette is rinsed DI water -> ethanol -> the liquid)
   pipetteAdd  { chem: 'moe', ml: 20, name: '2-MOE',
                 pipette: 10        optional: 2 | 10 ml (default: the smallest that holds ml)
                 dropwise: true     optional: added drop by drop (acetic acid)
                 refill: 50 }       optional: the working jar is refilled from the stock bottle first (shown)
   Volumes larger than the pipette go in several draws. The working jar for each liquid is made by
   synth_props.js (start volume = recipe.jars[chem], else enough for all steps). */
(function () {
  const S = window.SYNTH;
  S.block('pipetteAdd', {
    text: p => `${p.dropwise ? 'Add' : 'Pipette'} ${p.ml} ml ${S.chemName(p.chem, p)} from the working jar into the flask${p.dropwise ? ' dropwise' : ''}.`,
    async play(p) {
      const run = S.run, L = S.L, V3 = S.V3, H = run.hood, jar = run.jarsW[p.chem], f = run.flask;
      const pip = S.pipetteFor(p.ml, p.pipette), name = S.chemName(p.chem, p);
      const jarOff = V3(-0.07, 0, 0.05);
      if (p.refill && run.stock[p.chem]) {                 // working jar low: refill it from the stock bottle (shown)
        const st = run.stock[p.chem];
        await S.cam(S.wpos(jar.obj).add(V3(0, 0.06, 0)), S.DIR.hood(), 0.55);
        S.say(`${name} working jar is low (${L.totLiq(jar.contents).toFixed(0)} ml left) — refill it from the stock bottle`); await S.sleep(1.4);
        await S.capOff(st, V3(0.06, 0, 0.06)); await S.capOff(jar, jarOff);
        await S.pour(st, jar, p.refill);
        await S.capOn(st);
        S.adv(60);
      } else await S.cam(H.look(), S.DIR.hood(), 0.7);
      await S.take(pip);                                   // out of the pipette stand, held (never on the bench)
      await S.pumpTo(pip);
      await S.capOff(jar, jarOff);
      await S.rinsePip(pip, jar, name);
      await S.cam(S.wpos(f.obj).add(V3(0, 0.05, 0)), S.DIR.hood(), 0.6, 0.8);
      for (let left = p.ml; left > 0.01; left -= pip.cap) {
        const ml = Math.min(pip.cap, left);
        S.say(`Drawing ${+ml.toFixed(2)} ml ${name}`); await S.pDraw(pip, jar, ml);
        if (left - ml <= 0.01) await S.capOn(jar);
        await S.capOff(f);
        S.say(p.dropwise ? 'Dropwise into the stirring sol' : 'Into the flask'); await S.pDisp(pip, f, ml, !!p.dropwise);
      }
      await S.capOn(jar);
      await S.capOn(f);
      await S.stow(pip);                                   // back into the pipette stand
      S.adv(p.dropwise ? 30 : 60 + 30 * Math.ceil(p.ml / pip.cap));
    },
  });
})();
