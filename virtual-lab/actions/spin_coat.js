/* ACTION: spin coater run — a list of SPIN and DROP steps (owner's practice, protocol step 25-27, no ramp:
   each spin step runs at full speed at once). Default = the owner's whole sequence for one layer:
     spin 3000 rpm 10 s (the ethanol from the dip flies off)
     drop ~100 µl ethanol (micropipette, centre)  ->  spin 3000 rpm 60 s (spin dry)
     drop 20 µl sol on the centre of the STATIONARY substrate (it does not cover it - owner: spinning does)
     -> spin 500 rpm 5 s (spread) -> 3000 rpm 30 s (thin)
   The protocol can also play just part of it (c.steps). Step clip (actions/player.js: noLoop):
     lid closes before each spin and opens after it; drops are given with the lid open.
     Spin time on screen is shortened (display counts the REAL seconds); the chuck turns at a capped speed
     the eye can follow (as the lab). Liquid: puddle spreads to the edges, drops fly off to the bowl wall,
     ethanol dries off, the sol leaves a thin film (opacity grows a bit with each layer: c.filmOpacity).
   Context c:
     coater = { obj, spinner (group, turns about y), lidHinge (rotation.x = -1.3 * open), setDisplay?(rpm, s, label) }
     sub    = { obj (child of the spinner), puddle (circle mesh, unit radius, lying flat; scale = radius),
                film (mesh on the top face), wet? (true = still wet from the ethanol dip) }
     pip    = { obj, it (equipment/micropipette.js item: setPlunger(d), tipBottom), yOff? } micropipette for drops
     steps  = [{ spin: rpm, s: seconds, label? } | { drop: ml, what, color, dries? (true = evaporates, no film) }]
     filmColor, filmOpacity   film after the sol spin
     onStep(i, step)  each step starts;  onDone()  at the end (also on Skip)                                      */
(function () {
  const C = window.CLIPS;
  const STEPS = [
    { spin: 3000, s: 10, label: 'Spin dry' },
    { drop: 0.1, what: 'Ethanol', color: '#e8f0ff', dries: true },
    { spin: 3000, s: 60, label: 'Spin dry' },
    { drop: 0.02, what: 'Sol', color: '#8a4a1c' },
    { spin: 500, s: 5, label: 'Stage 1 · spread' },
    { spin: 3000, s: 30, label: 'Stage 2 · thin' },
  ];
  const LID = 0.7, SPIN_UP = 0.35, DROP_T = 3.0, FIRST = 0.007, SECOND = 0.0105;
  const shown = sec => Math.min(5, Math.max(1.8, sec * 0.12));      // seconds on screen for a real spin
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  function setP(o, P) { o.position.copy(P.pos); o.quaternion.copy(P.quat); o.updateMatrixWorld(true); }

  C.register('spinCoat', {
    label: 'Spin coater: spin + drops', unit: '',
    intro: 20, outro: 1.0, noLoop: true, linear: true,
    moves: c => [c.pip && c.pip.obj],

    setup(k, c) {
      const { THREE } = k, s = { segs: [] };
      const steps = c.steps || STEPS; let t = 0, lidOpen = c.coater.lidHinge.rotation.x < -0.6;
      steps.forEach((st, i) => {
        if (st.spin) {
          if (lidOpen) { s.segs.push({ kind: 'lid', to: 0, t0: t, t1: t + LID }); t += LID; lidOpen = false; }
          const d = shown(st.s) + 2 * SPIN_UP; s.segs.push({ kind: 'spin', st, i, t0: t, t1: t + d }); t += d;
        } else {
          if (!lidOpen) { s.segs.push({ kind: 'lid', to: 1, t0: t, t1: t + LID }); t += LID; lidOpen = true; }
          s.segs.push({ kind: 'drop', st, i, t0: t, t1: t + DROP_T }); t += DROP_T;
        }
      });
      if (!lidOpen) { s.segs.push({ kind: 'lid', to: 1, t0: t, t1: t + LID }); t += LID; }
      s.total = t + 0.3;
      C.defs.spinCoat.intro = s.total;             // the length depends on the steps (player reads def.intro)
      s.lid0 = c.coater.lidHinge.rotation.x;
      s.sub = c.sub; s.sx = c.sub.obj.scale.x || 1;
      // liquid on the substrate: { r (puddle radius), op, color, dries }
      s.liq = c.sub.wet ? { r: 0.0125, op: 0.35, color: '#e8f0ff', dries: true } : null;
      s.film = c.sub.film; s.film0 = s.film ? { vis: s.film.visible, op: s.film.material.opacity, col: s.film.material.color.clone() } : null;
      s.chuckW = k.world(c.coater.spinner, new THREE.Vector3(0, 0.0122, 0));
      if (c.pip) {
        s.p = c.pip.obj; s.pit = c.pip.it; s.home = k.poseOf(s.p);
        s.qUp = new THREE.Quaternion().setFromAxisAngle(k.up, Math.atan2(-k.camRight().z, k.camRight().x));
        s.tipEnd = new THREE.Vector3(0, s.pit.tipBottom + (c.pip.yOff || 0), 0);
        const at = P => { const o = new THREE.Object3D(); k.placeBy(o, s.qUp, s.tipEnd, P); return { pos: o.position.clone(), quat: o.quaternion.clone() }; };
        s.pOver = at(s.chuckW.clone().add(new THREE.Vector3(0, 0.0045, 0)));
        s.pHigh = at(s.chuckW.clone().add(new THREE.Vector3(0, 0.05, 0)));
      }
      s.lastT = 0; s.flags = {}; s.cur = -1; s.flung = 0;
      showLiq(k, s);
      return s;
    },

    shot(k, c, s) {                                // high and from the side: past the lid knob onto the chuck, display in view
      const look = s.chuckW.clone().addScaledVector(k.camBack(), 0.05).add(new k.THREE.Vector3(0, -0.025, 0));
      return k.shotAt(look, 0.36, 0.85, 0.5);
    },

    pose(k, c, s, phase, u) {
      if (phase === 'outro') return 0;
      const { THREE } = k, t = u * s.total, dt = Math.max(0, t - s.lastT); s.lastT = t;
      const seg = s.segs.find(g => t >= g.t0 && t < g.t1) || null;
      const co = c.coater;
      if (!seg) { co.setDisplay && co.setDisplay(0, 0, 'Done'); }
      if (seg && seg.i != null && seg.i !== s.cur) { s.cur = seg.i; c.onStep && c.onStep(seg.i, seg.st); if (seg.kind === 'drop') s.flags['drop' + seg.i] = 0; }
      if (seg && seg.kind === 'lid') {
        const from = seg.to ? 0 : 1, v = k.ease(clamp((t - seg.t0) / (seg.t1 - seg.t0), 0, 1));
        co.lidHinge.rotation.x = -1.3 * (from + (seg.to - from) * v);
      }
      if (seg && seg.kind === 'spin') {
        const st = seg.st, d = seg.t1 - seg.t0, x = t - seg.t0;
        const f = clamp(x / SPIN_UP, 0, 1) * clamp((d - x) / SPIN_UP, 0, 1);       // spin-up / down (no program ramp)
        const rpm = st.spin * (x < SPIN_UP ? clamp(x / SPIN_UP, 0, 1) : f);
        co.spinner.rotation.y += Math.min(rpm, 900) / 60 * Math.PI * 2 * dt;
        const prog = clamp((x - SPIN_UP) / (d - 2 * SPIN_UP), 0, 1);
        co.setDisplay && co.setDisplay(Math.round(rpm), Math.ceil(st.s * (1 - prog)), st.label || 'Spin');
        if (s.liq && rpm > 100) {
          const L = s.liq, sp = Math.min(1, prog * 4);
          L.r = Math.min(0.0125, L.r0 != null ? L.r0 + (0.0125 - L.r0) * sp : (L.r0 = L.r, L.r));
          // drops thrown off the edge to the bowl wall early in the spin
          if (prog < 0.35 && L.op > 0.05) {
            s.flung += dt * (st.spin > 1000 ? 14 : 5);
            while (s.flung >= 1) { s.flung--;
              const a = Math.random() * Math.PI * 2, e = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
              const from = s.chuckW.clone().addScaledVector(e, 0.0135).add(new THREE.Vector3(0, 0.0012, 0));
              k.fx.fall(from, s.chuckW.clone().addScaledVector(e, 0.075).add(new THREE.Vector3(0, -0.002, 0)), L.color, 1, { grain: false, spread: 0.002 }); }
          }
          // thins out: the puddle fades; a sol leaves the film
          const fade = clamp((prog - 0.15) / 0.6, 0, 1);
          L.op = L.op0 != null ? L.op0 * (1 - fade) : (L.op0 = L.op, L.op);
          if (!L.dries && s.film) {
            s.film.visible = true; s.film.material.color.set(c.filmColor || L.color);
            const base = s.film0.vis ? s.film0.op : 0;
            s.film.material.opacity = base + ((c.filmOpacity != null ? c.filmOpacity : 0.35) - base) * fade;
          }
          if (fade >= 1) s.liq = null;
          showLiq(k, s);
        }
      }
      if (seg && seg.kind === 'drop' && s.p) {
        const st = seg.st, x = t - seg.t0;
        co.setDisplay && co.setDisplay(0, 0, st.what || 'Drop');
        if (x < 0.7) k.blendPose(s.p, s.home, s.pHigh, k.ease(x / 0.7), 0.03);
        else if (x < 1.0) k.blendPose(s.p, s.pHigh, s.pOver, k.ease((x - 0.7) / 0.3), 0);
        else if (x < 2.0) {
          setP(s.p, s.pOver);
          const pr = clamp((x - 1.0) / 0.6, 0, 1); s.pit.setPlunger(pr < 0.75 ? FIRST * pr / 0.75 : FIRST + (SECOND - FIRST) * (pr - 0.75) / 0.25);
          if (x > 1.25 && !s.flags['drop' + seg.i]) {
            s.flags['drop' + seg.i] = 1;
            const tip = k.world(s.p, s.tipEnd);
            k.fx.fall(tip, s.chuckW.clone().add(new THREE.Vector3(0, 0.0012, 0)), st.color, 1, { grain: false, spread: 0 });
          }
          if (x > 1.45) {                          // puddle grows where the drop landed (stays a small dome: owner)
            const h = st.dries ? 0.0003 : 0.0006, r = Math.min(0.0125, Math.sqrt(st.drop * 1e-6 / (Math.PI * h)));
            const g = clamp((x - 1.45) / 0.4, 0, 1);
            s.liq = { r: r * (0.3 + 0.7 * g), op: 0.5, color: st.color, dries: !!st.dries };
            if (g >= 1) { s.liq.r0 = null; s.liq.op0 = null; }
            showLiq(k, s);
          }
        } else {
          s.pit.setPlunger(SECOND * (1 - clamp((x - 2.4) / 0.3, 0, 1)));
          k.blendPose(s.p, s.pOver, s.home, k.ease(clamp((x - 2.0) / 0.9, 0, 1)), 0.03);
        }
      }
      if (t >= s.total - 0.3 && !s.flags.done) { s.flags.done = true; c.onDone && c.onDone(); }
      return 0;
    },

    complete(k, c, s) {                            // Skip: the end result of every step at once
      const steps = c.steps || STEPS;
      const sol = steps.some(st => st.drop && !st.dries) && steps.slice(steps.findIndex(st => st.drop && !st.dries)).some(st => st.spin);
      s.liq = null; showLiq(k, s);
      if (sol && s.film) { s.film.visible = true; s.film.material.color.set(c.filmColor || '#8a4a1c'); s.film.material.opacity = c.filmOpacity != null ? c.filmOpacity : 0.35; }
      c.coater.lidHinge.rotation.x = -1.3;
      c.coater.setDisplay && c.coater.setDisplay(0, 0, 'Done');
      if (!s.flags.done) { s.flags.done = true; c.onDone && c.onDone(); }
    },
    cleanup(k, c, s) { if (s.pit) s.pit.setPlunger(0); },
  });

  function showLiq(k, s) {
    const pd = s.sub.puddle; if (!pd) return;
    const L = s.liq;
    pd.visible = !!L && L.op > 0.02;
    if (!pd.visible) return;
    pd.scale.set(L.r / s.sx, L.r, 1);
    pd.material.color.set(L.color); pd.material.opacity = L.op;
  }
  C.spinSteps = STEPS;
})();
