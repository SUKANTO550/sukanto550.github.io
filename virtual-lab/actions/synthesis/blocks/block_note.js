/* SYNTHESIS block family: NOTES (caption only - for small steps and for any step that has no
   animation yet: a paper's step can be entered at once and animated later)
   note  { text: '...',      the caption (required)
           say: '...',       optional: line under the caption
           min: 5,           optional: lab minutes this takes (clock moves on)
           show: 1.6,        optional: seconds on screen (default 1.4)
           look: 'substrate' optional: camera to 'substrate' | 'vial' | 'flask' first } */
(function () {
  const S = window.SYNTH;
  S.block('note', {
    text: p => p.text || '',
    async play(p) {
      const run = S.run, V3 = S.V3;
      const target = p.look === 'substrate' ? run.pieces && run.pieces[0] : p.look === 'vial' ? run.vial : p.look === 'flask' ? run.flask : null;
      if (target) await S.cam(S.wpos(target.obj), p.look === 'substrate' ? V3(0.2, 1, 0.4) : S.DIR.hood(), p.look === 'substrate' ? 0.18 : 0.3, 1.6);
      if (p.say) S.say(p.say);
      await S.sleep(p.show || 1.4);
      if (p.min) S.adv(p.min * 60);
    },
  });
})();
