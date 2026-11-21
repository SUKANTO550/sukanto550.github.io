/* SYNTHESIS block family: STIRRING / HEATING (hotplate B in the fume hood; the flask goes onto it if
   it is not there yet). Owner: liquid never above 50 °C.
   stir  { rpm: 400, T: 40, min: 3,
           label: 'Equilibrating'   optional: text during the wait
           dissolve: true           optional: everything dissolved at the end
           color: 'sol' }           optional: colour at the end (recipe.colors key or { col, op })
   cool  = stir with T 25 (hotplate off, still stirring): { rpm: 300, min: 30 } */
(function () {
  const S = window.SYNTH;
  async function stir(p, cool) {
    const run = S.run, f = run.flask, hp = run.hp.B;
    if (f.surface !== hp.plateSurface) await S.carry(f, S.wpos(hp.plateSurface.root), { surf: hp.plateSurface });
    const T = cool ? 25 : (p.T != null ? p.T : 25);
    hp.machine.setRpm = p.rpm || 0; hp.machine.setT = T;
    await S.cam(S.wpos(f.obj).add(S.V3(0, 0.05, 0)), S.DIR.hood(), 0.45);
    await S.wait(p.min * 60, p.label || (cool ? 'Cooling to room temperature' : `Stirring (${p.rpm} rpm, ${T} °C)`));
    if (p.dissolve) S.dissolveAll(f);
    if (p.color) { S.setLook(f, p.color); await S.sleep(1); }
  }
  S.block('stir', {
    text: p => `Stir at ${p.rpm} rpm, ${p.T != null ? p.T : 25} °C for ${S.fmtDur(p.min * 60)}.`,
    play: p => stir(p, false),
  });
  S.block('cool', {
    text: p => `Cool to room temperature, still stirring at ${p.rpm} rpm (~${p.min} min).`,
    play: p => stir(p, true),
  });
})();
