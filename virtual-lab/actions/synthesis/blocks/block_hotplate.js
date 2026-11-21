/* SYNTHESIS block family: LAYER HEAT STAGES (main table, hotplates set by 'spinPrep': C = gel,
   B = pyro, A = burn). The hot substrate moves with the CERAMIC tweezers; the inverted funnel (dust
   cover) follows it on every hotplate (owner). Places: 'chuck' | 'gel' | 'pyro' | 'burn' | 'dish'.
   hotStage   substrate from where it is now to a place, then wait.  { to: 'gel', min: 1, label: 'Gelation' }
   fullLayer  one whole later layer, shown faster: chuck, sol + spin, every stage, cool on the dish.
              { layer: 2, drop: 0.02, program: [...], stages: [{ to, min, label }, ...], last: true }
              last = hotplates off afterwards. Shared: S.hop(fromSurface, toSurface, coverSource, coverTarget). */
(function () {
  const S = window.SYNTH;
  let L = null;
  S.onInit(() => { L = S.L; });
  const V3 = (x, y, z) => new L.THREE.Vector3(x, y, z);
  const wpos = o => S.wpos(o);
  const HOT = { gel: 'C', pyro: 'B', burn: 'A' };
  const surfAt = k => { const run = S.run; return k === 'chuck' ? run.sc.chuckSurface : k === 'dish' ? run.coolDish : run.hp[HOT[k]].plateSurface; };

  // hot substrate with the ceramic tweezers from one surface to another; funnel cover moved along
  S.hop = async (fromS, toS, coverSource, coverTarget) => {
    const run = S.run, sub = run.pieces[0], from = wpos(sub.obj), to = wpos(toS.root);
    await S.cam(from.clone().lerp(to, 0.5).add(V3(0, 0.02, 0)), S.DIR.main(), Math.max(0.35, from.distanceTo(to) * 1.1 + 0.2), 0.9);
    let endP = null;
    await S.clip('tweezerMove', { sub: { obj: sub.obj, size: 0.025, thick: 0.0011, baseY: 0 }, tool: { obj: run.tw.obj }, funnel: { obj: run.funnel }, from: { pos: from }, to: { pos: to },
      coverSource, coverTarget, onPlaced: e => { endP = e; } });
    if (endP && endP.funnel) { run.funnel.position.copy(endP.funnel.pos); run.funnel.quaternion.copy(endP.funnel.quat); }
    else if (coverTarget) run.funnel.position.copy(to);                    // skipped clip: the cover still ends on the target
    S.putOn(sub, toS, to); sub.obj.scale.x = 1 / 3;
  };
  async function stage(st, prefix = '') {
    const run = S.run, from = run.subAt || 'chuck';
    await S.hop(surfAt(from), surfAt(st.to), !!HOT[from], !!HOT[st.to]);
    run.subAt = st.to;
    await S.wait(st.min * 60, prefix + (st.label || (st.to === 'dish' ? 'Cooling' : st.to)));
  }
  const offAll = () => { const hp = S.run.hp; for (const h of [hp.A, hp.B, hp.C]) h.machine.setT = 25; };

  S.block('hotStage', {
    text: p => p.to === 'dish' ? `Off the hotplate onto a petri dish to cool before the next layer (${S.fmtDur(p.min * 60)}).`
      : `${p.label || p.to}: substrate (ceramic tweezers) to the ${p.to} hotplate, covered with the inverted funnel. ${S.fmtDur(p.min * 60)}.`,
    async play(p) { await stage(p); if (p.last) offAll(); },
  });
  S.block('fullLayer', {
    text: p => `Layer ${p.layer}: repeat — sol + spin, ${p.stages.map(s => s.label || s.to).join(', ')} (shown faster).`,
    async play(p) {
      const run = S.run;
      S.say(`Layer ${p.layer}`);
      if ((run.subAt || 'dish') !== 'chuck') { await S.hop(surfAt(run.subAt || 'dish'), run.sc.chuckSurface, false, false); run.subAt = 'chuck'; }
      await S.coatLayer(p.layer, p);
      for (const st of p.stages) await stage(st, `Layer ${p.layer}: `);
      if (p.last) offAll();
    },
  });
})();
