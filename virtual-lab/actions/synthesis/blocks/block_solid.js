/* SYNTHESIS block family: SOLIDS (owner: weighed on a watch glass at the balance - tare, 3 spatula
   scoops - then pushed into the flask in the hood with the spatula; salts from their own small vial,
   NaOH pellets straight from the box)
   weighAdd  { chem: 'bi', g: 3.408, label: 'Bi nitrate',
               from: 'box'          optional: from the stock jar instead of a vial
               slow: true           optional: added slowly (~60 s on the clock)
               stir: 15             optional: then stir this many minutes until dissolved
               color: 'bi' }        optional: colour after dissolving (recipe.colors key or { col, op }) */
(function () {
  const S = window.SYNTH;
  S.block('weighAdd', {
    text: p => `Weigh ${p.g} g ${S.L && S.L.CHEM[p.chem] ? S.L.CHEM[p.chem].formula : p.chem} and add it to the flask${p.stir ? `; stir ${p.stir} min until dissolved` : ''}.`,
    async play(p) {
      const run = S.run, f = run.flask;
      await S.weigh(p.chem, p.g, p.label || S.chemName(p.chem));
      await S.saltIn(f);
      if (p.slow) S.adv(60);
      if (p.stir) {
        await S.wait(p.stir * 60, p.stirLabel || 'Stirring until dissolved');
        S.dissolveAll(f);
        if (p.color) { S.setLook(f, p.color); await S.cam(S.wpos(f.obj).add(S.V3(0, 0.04, 0)), S.DIR.hood(), 0.35); await S.sleep(1.2); }
      }
    },
  });
})();
