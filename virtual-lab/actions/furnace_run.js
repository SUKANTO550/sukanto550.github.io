/* ACTION: final anneal in the box furnace (equipment/furnace.js, a simple dummy - owner: "take it near the
   furnace and bring it from the furnace, just it"). Step clip (actions/player.js: noLoop):
     1. door swings open
     2. the alumina setter (with the substrate on it) goes in to the middle of the chamber
     3. door closes; the controller runs the program - the display shows the temperature and the stage,
        the real ~7 h program squeezed into a few seconds (display only; the host's lab clock does the real time)
     4. below 50 °C: door opens, the setter comes out to where it was, door closes
   No hands (as the other clips). Esc = Skip: straight to the end (annealed, setter back in place).
   Context c:
     furnace = { obj, f } f = it.furnace from equipment/furnace.js (door, floor, mouth, setTemp)
     load    = { obj } the setter (with the substrate as a child, or whatever the host moves in)
     program = [{ to, rate (°C/min), hold (min), label }]  last stage: rate = cooling rate down to `to`
               default = the owner's protocol (step 33)
     onTemp(T, minutes, label)  every frame while the program runs (optional)
     onDone()                   once the load is out again (also on Skip)                                   */
(function () {
  const C = window.CLIPS;
  const PROGRAM = [
    { to: 150, rate: 5, hold: 30, label: 'Stage 1 · solvent off' },
    { to: 300, rate: 5, hold: 30, label: 'Stage 2 · organics off' },
    { to: 500, rate: 3, hold: 90, label: 'Stage 3 · BFO crystallises' },
    { to: 50, rate: 3, hold: 0, label: 'Stage 4 · furnace cool' },
  ];
  const OPEN = 1.75;                                       // door opening angle (rad)
  const T = { open1: [0.2, 1.0], toMouth: [0.8, 1.8], inside: [1.8, 2.8], close1: [2.9, 3.6], run: [3.8, 11.8],
    open2: [12.0, 12.8], outMouth: [12.8, 13.8], home: [13.8, 14.8], close2: [14.6, 15.4], END: 15.6 };

  // program -> list of [minute, °C, label]
  function curve(prog, T0 = 25) {
    const pts = [[0, T0, prog[0].label]]; let t = 0, Tc = T0;
    for (const s of prog) {
      t += Math.abs(s.to - Tc) / s.rate; Tc = s.to; pts.push([t, Tc, s.label]);
      if (s.hold) { t += s.hold; pts.push([t, Tc, s.label]); }
    }
    return pts;
  }
  function at(pts, m) {
    for (let i = 1; i < pts.length; i++) if (m <= pts[i][0]) {
      const [a, A] = pts[i - 1], [b, B, lab] = pts[i]; return [A + (B - A) * (m - a) / (b - a || 1), lab];
    }
    const l = pts[pts.length - 1]; return [l[1], l[2]];
  }
  const hm = m => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min`;
  function setP(o, P) { o.position.copy(P.pos); o.quaternion.copy(P.quat); o.updateMatrixWorld(true); }

  C.register('furnaceRun', {
    label: 'Box furnace: anneal', unit: '',
    intro: T.END, outro: 1.0, noLoop: true, linear: true,
    moves: c => [c.load.obj],

    setup(k, c) {
      const { THREE } = k, s = {}, f = c.furnace.f, fo = c.furnace.obj;
      s.pts = curve(c.program || PROGRAM); s.total = s.pts[s.pts.length - 1][0];
      s.load = c.load.obj; s.home = k.poseOf(s.load);
      const fq = fo.getWorldQuaternion(new THREE.Quaternion());
      s.inP = { pos: k.world(fo, f.floor), quat: fq.clone() };
      s.mouthP = { pos: k.world(fo, f.mouth.clone().add(new THREE.Vector3(0, 0.003, 0.06))), quat: fq.clone() };
      s.door = f.door; s.door0 = s.door.rotation.y;
      s.dispW = k.world(fo, new THREE.Vector3(f.dims.DX + f.dims.CW / 2 + 0.08, f.dims.CY + 0.08, f.dims.D / 2));
      s.front = new THREE.Vector3(0, 0, 1).applyQuaternion(fq);
      s.flags = {};
      f.setTemp(25, 'READY');
      return s;
    },

    camAt(k, c, s, t) {
      const { THREE } = k;
      const mouth = s.mouthP.pos.clone().lerp(s.inP.pos, 0.3);
      // from the front-right, a bit above: sees the chamber, the door and the display
      const side = new THREE.Vector3().crossVectors(k.up, s.front).multiplyScalar(-1);   // furnace's +x
      const look = mouth.clone().lerp(s.dispW, 0.45);
      const eye = look.clone().addScaledVector(s.front, 0.5).addScaledVector(side, 0.12).add(new THREE.Vector3(0, 0.14, 0));
      // pulls back towards the setter's home while it travels
      const h = Math.max(1 - k.smooth(T.open1[0], T.toMouth[1], t), k.smooth(T.outMouth[0], T.home[1], t));
      const lookH = s.home.pos.clone().lerp(mouth, 0.5);
      return { look: look.clone().lerp(lookH, h * 0.5), eye: eye.clone().addScaledVector(s.front, h * 0.15) };
    },
    shot(k, c, s) { return this.camAt(k, c, s, 0); },

    pose(k, c, s, phase, u) {
      if (phase === 'outro') return 0;
      const t = u * T.END, sm = w => k.smooth(w[0], w[1], t), f = c.furnace.f;
      s.door.rotation.y = s.door0 - OPEN * (k.ease(sm(T.open1)) - k.ease(sm(T.close1)) + k.ease(sm(T.open2)) - k.ease(sm(T.close2)));
      // load path: home -> in front of the mouth -> inside; and back
      if (t < T.toMouth[1]) k.blendPose(s.load, s.home, s.mouthP, k.ease(sm(T.toMouth)), 0.05);
      else if (t < T.outMouth[0]) k.blendPose(s.load, s.mouthP, s.inP, k.ease(sm(T.inside)) - k.ease(sm(T.outMouth)), 0);
      else if (t < T.home[0]) k.blendPose(s.load, s.inP, s.mouthP, k.ease(sm(T.outMouth)), 0);
      else k.blendPose(s.load, s.mouthP, s.home, k.ease(sm(T.home)), 0.05);
      // program on the display
      if (t >= T.run[0]) {
        const m = s.total * sm(T.run), [Tc, lab] = at(s.pts, m);
        const done = t >= T.run[1];
        f.setTemp(Tc, done ? (t < T.close2[1] ? 'END · open' : 'READY') : lab.split(' · ')[0] + ' · ' + hm(m));
        if (!done) c.onTemp && c.onTemp(Tc, m, lab);
      }
      if (t >= T.home[1] && !s.flags.done) { s.flags.done = true; c.onDone && c.onDone(); }
      return 0;
    },

    complete(k, c, s) {
      s.door.rotation.y = s.door0; setP(s.load, s.home);
      c.furnace.f.setTemp(25, 'READY');
      if (!s.flags.done) { s.flags.done = true; c.onDone && c.onDone(); }
    },
    cleanup(k, c, s) { s.door.rotation.y = s.door0; },
  });
  C.furnaceProgram = PROGRAM;
  C.furnaceCurve = curve;
})();
