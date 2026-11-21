/* =====================================================================
   SYNTHESIS — engine  (button "Recipe book" -> "Synthesis library")
   =====================================================================
   A synthesis = a PROTOCOL (data, one file in synthesis/library/) made of STEPS. Each step names a
   BLOCK (a reusable piece of lab work with its own animation, one family per file in
   synthesis/blocks/) plus its values (ml, g, rpm, °C, min, colour ...).

   Files (all plain <script>, no modules, so double-click / file:// works):
     synth_core.js     this file: registry, runner, jump, scheduler, camera / carry / clip / wait
     synth_tools.js    lab work shared by the blocks (pipette + pump, caps, weighing, pours, labels)
     synth_props.js    the film's own props + stations, built from the protocol; reset / clean-up
     synth_panel.js    Recipe book button, Synthesis library, run panel (step list, jump), caption
     blocks/index.js   list of block files       (new block family  = new file + one line there)
     library/index.js  list of protocol files    (new protocol      = new file + one line there)

   JUMP to any step: the props are reset, every earlier step is played INSTANTLY (same code, all
   moves finish at once, clips skipped, waits applied in one go), then play goes on normally. So a
   step never needs a separate "end state" description: what it does when played is what a jump
   gives.

   API for blocks:    SYNTH.block(name, { text(p, R), play: async (p, S) => {...} })
   API for protocols: SYNTH.protocol({ id, name, group, product, source, summary, recipe, sections, steps })
   Started from lab_hooks.js: SYNTH.init(LAB, LAB_HOOKS). Debug: window.SYNTH (run, playFrom, open). */
(function () {
  const S = window.SYNTH = window.SYNTH || {};
  S.blocks = S.blocks || {};
  S.protocols = S.protocols || [];
  const inits = [];
  S.onInit = fn => { inits.push(fn); if (S.L) fn(); };
  S.block = (name, def) => { S.blocks[name] = def; };
  S.protocol = def => {
    const i = S.protocols.findIndex(p => p.id === def.id);
    if (i >= 0) S.protocols[i] = def; else S.protocols.push(def);
    if (S.panel && S.panel.refresh) S.panel.refresh();
  };
  // loader used by blocks/index.js + library/index.js: files load in the listed order
  // (the index files' own ?v=... cache-busting query is passed on to the files they load: published copy)
  S.here = () => { const s = document.currentScript; if (!s) return ''; const q = (s.src.match(/\?.*$/) || [''])[0]; return { dir: s.src.replace(/\?.*$/, '').replace(/[^/]*$/, ''), q }; };
  S.load = (base, files) => files.forEach(f => {
    const dir = typeof base === 'string' ? base : base.dir, q = typeof base === 'string' ? '' : base.q;
    const s = document.createElement('script'); s.src = dir + f + q; s.async = false;
    s.onerror = () => console.error('Synthesis: could not load ' + dir + f);
    document.head.appendChild(s);
  });

  let L = null;
  S.run = null;                                           // the open synthesis (null = none)
  S.R = {};                                               // recipe of the open protocol
  const V3 = (x, y, z) => new L.THREE.Vector3(x, y, z);
  S.V3 = (x, y, z) => V3(x, y, z);

  /* ---------------- init (from lab_hooks.js) ---------------- */
  S.init = (lab, hooks) => {
    L = S.L = lab; S.HK = hooks;
    S.P = window.CLIPS.createPlayer({ THREE: L.THREE, scene: L.scene, camera: L.camera,
      getLook: () => L.controls.target, setLook: v => { L.controls.target.copy(v); L.camera.lookAt(v); }, lockView: () => {} });
    const t0 = hooks.tick; hooks.tick = dt => { t0(dt); tick(dt); };
    hooks.filmActive = () => !!S.run; hooks.filmMoving = moving;
    const pl = hooks.placed; hooks.placed = (it, s) => { if (!S.run) pl(it, s); };   // no clean-storage warnings for the film props
    const op = hooks.opened; hooks.opened = v => { if (!S.run) op(v); };
    inits.forEach(f => f());
    S.panel.make();
  };
  S.active = () => !!S.run;
  // for index.html (via LAB_HOOKS): steady resolution + no AO popping during the film; shadows refresh after moves
  const moving = () => !!S.run && !S.run.paused && !S.run.idle && (S.P.active || [...tasks].some(f => !f.still));

  /* ---------------- scheduler ---------------- */
  const tasks = new Set();
  S.tasks = tasks;
  function tick(dt) {
    const run = S.run;
    if (!run || run.paused || run.idle || run.instant) return;      // a jump ticks by itself (runInstant)
    const k = run.fast ? 40 : run.speed;
    S.P.tick(Math.min(0.25, dt * k));
    for (const f of [...tasks]) if (f(dt * k)) tasks.delete(f);
    S.panel.clock();
  }
  // a per-frame task; resolves when fn returns true
  S.every = (fn, still = false) => new Promise(res => { const f = dt => { if (fn(dt)) { res(); return true; } return false; }; f.still = still; tasks.add(f); });
  S.sleep = s => { let t = 0; return S.every(dt => (t += dt) >= s, true); };

  // instant play (jump): every task finishes at once, clips are skipped; yields between rounds so the
  // step's code can go on to its next move (MessageChannel = no 4 ms timer clamp)
  const mc = new MessageChannel(), waiting = [];
  mc.port1.onmessage = () => { const r = waiting.shift(); if (r) r(); };
  const yieldNow = () => new Promise(r => { waiting.push(r); mc.port2.postMessage(0); });
  async function runInstant(promise, gen) {
    let done = false; promise.then(() => { done = true; }, () => { done = true; });
    while (!done && S.run && S.run.gen === gen) {
      if (S.P.active) S.P.skip();
      for (const f of [...tasks]) if (f(1e5)) tasks.delete(f);
      await yieldNow();
    }
    if (S.run && S.run.gen === gen) await promise;
  }

  /* ---------------- director primitives ---------------- */
  S.wpos = o => { const v = V3(0, 0, 0); o.getWorldPosition(v); return v; };
  S.DIR = { hood: () => V3(0, 0.55, 1), balance: () => V3(0, 0.6, -1), main: () => V3(0, 0.62, 1), basin: () => V3(0.1, 0.6, 1), machine: () => V3(-1, 0.6, 0.15) };
  // camera: look at `look` from direction `dir` (world, towards the camera) at `dist`
  S.cam = (look, dir, dist, dur = 1.1) => {
    const c = L.camera, tg = L.controls.target, e0 = c.position.clone(), l0 = tg.clone();
    const e1 = look.clone().addScaledVector(dir.clone().normalize(), dist);
    let t = 0;
    return S.every(dt => { t += dt; const u = Math.min(1, t / dur), v = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      c.position.lerpVectors(e0, e1, v); tg.lerpVectors(l0, look, v); c.lookAt(tg); return u >= 1; });
  };
  // carry an item (or a plain group) to a world point (surface top); onto `surf` if given
  S.carry = (it, to, { surf = null, dur = 1.2, lift = 0.08, rotY = null } = {}) => {
    const obj = it.obj || it;
    if (it.surface) L.removeFrom(it);
    L.scene.attach(obj);
    const p0 = obj.position.clone(), q0 = obj.quaternion.clone();
    const q1 = rotY == null ? q0.clone() : new L.THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), rotY);
    const far = p0.distanceTo(to); dur = Math.max(dur, Math.min(2.6, 0.6 + far * 0.35)); lift = Math.max(lift, Math.min(0.4, far * 0.08));
    let t = 0;
    return S.every(dt => {
      t += dt; const u = Math.min(1, t / dur), v = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      obj.position.lerpVectors(p0, to, v); obj.position.y += Math.sin(Math.PI * v) * lift; obj.quaternion.slerpQuaternions(q0, q1, v);
      if (u >= 1) { if (surf && it.obj) S.putOn(it, surf, to, rotY); return true; }
      return false;
    });
  };
  S.putOn = (it, surf, world, rotY) => {
    const lp = surf.root.worldToLocal(world.clone());
    if (rotY != null) it.rotY = rotY - (new L.THREE.Euler().setFromQuaternion(surf.root.getWorldQuaternion(new L.THREE.Quaternion()), 'YXZ').y);
    L.placeOn(it, surf, lp.x, lp.z);
  };
  // play a clip; resolves at its end (a jump / close in the meantime: never resolves, the old step just stops)
  S.clip = (name, c, { amount = 0, title = '' } = {}) => {
    if (title) S.say(title);
    const run = S.run, gen = run.gen;
    return new Promise(res => {
      const def = window.CLIPS.defs[name];
      const onEnd = r => { if (S.run === run && run.gen === gen) res(r); };
      if (def.noLoop) S.P.play(name, c, { mode: 'hold', onEnd });                    // step clips: no amount
      else S.P.play(name, c, { mode: 'amount', amount: amount || 1e9, onEnd });
      if (run.fast || run.instant) S.P.skip();
    });
  };
  // a wait of `real` lab seconds: the clock runs fast; sim = true also runs the lab simulation that much
  S.wait = (real, label, { sim = true, show = null } = {}) => {
    const run = S.run;
    const dur = show || Math.min(5, Math.max(1.4, 1.2 + Math.log10(Math.max(1, real)) * 0.9));
    S.say(label + ` — ${S.fmtDur(real)}`);
    let done = 0, debt = 0;
    return S.every(dt => {
      const want = Math.min(real, real * (done / real + dt / dur)), step = want - done; done = want;
      run.clock += step;
      // lab simulation for the skipped time, within ~5 ms per frame (steps of up to 10 s); the rest carries
      // over to the next frames. (Doing it all at once made frames take up to ~0.8 s: the picture blinked.)
      // A jump uses bigger steps and a bigger budget (nothing is drawn meanwhile).
      if (sim) { debt += step; const big = run.instant, t0 = performance.now(), ms = big ? 40 : 5, mx = big ? 60 : 10;
        while (debt > 1e-6 && performance.now() - t0 < ms) { const s = Math.min(mx, debt); L.tick(s); debt -= s; } }
      S.panel.bar(done / real);
      if (done >= real - 1e-6 && debt <= 1e-6) { S.panel.bar(null); return true; }
      return false;
    }, true);
  };
  S.adv = s => { S.run.clock += s; };                       // clock for actions that took real time
  S.say = t => { S.panel.say(t); };
  S.fmtDur = s => s >= 86400 ? `${Math.floor(s / 86400)} d ${Math.floor(s % 86400 / 3600)} h` : s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.floor(s % 3600 / 60)).padStart(2, '0')} min` : s >= 60 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`;

  /* ---------------- steps ---------------- */
  S.stepsOf = proto => proto.steps.flat(Infinity).filter(Boolean);
  S.stepText = st => st.text || (S.blocks[st.block] && S.blocks[st.block].text ? S.blocks[st.block].text(st, S.R) : st.block);
  async function runStep(st) {
    const run = S.run, b = S.blocks[st.block];
    if (!b) throw new Error('Unknown block "' + st.block + '" (missing in blocks/index.js?)');
    S.panel.caption(st); S.say('');
    if (st.speed) run.speed = Math.max(run.baseSpeed, st.speed);
    try { await b.play(st, S); } finally { if (S.run === run) run.speed = run.baseSpeed; }
  }

  /* ---------------- run ---------------- */
  // open a protocol: props set up, run panel shown, plays from step 0
  S.open = proto => {
    if (S.run) return;
    if (L.getHeld()) L.releaseHeld();
    S.R = proto.recipe || {};
    S.run = { proto, steps: S.stepsOf(proto), clock: 0, speed: 1, baseSpeed: 1, paused: false, fast: false, instant: false,
      gen: 0, at: 0, atBoundary: true, idle: true };
    S.props.setup();
    S.panel.showRun(true);
    S.playFrom(0);
  };
  // play from step i (only = that step alone, then wait). A jump: reset if needed, earlier steps instantly.
  S.playFrom = async (i, only = false) => {
    const run = S.run; if (!run) return;
    i = Math.max(0, Math.min(run.steps.length - 1, i));
    const gen = ++run.gen;
    tasks.clear(); if (S.P.active) S.P.skip();            // the old step stops where it is (its clip promise is dropped)
    run.paused = false; run.fast = false; run.idle = false; run.speed = run.baseSpeed; S.panel.paused(false);
    try {
      let from = run.at;
      if (!run.atBoundary || i < run.at) { S.props.reset(); run.clock = 0; from = 0; run.at = 0; run.atBoundary = true; }
      if (from < i) {
        S.panel.jumping(i);
        run.instant = true; run.fast = true;
        try {
          for (let k = from; k < i; k++) {
            if (run.gen !== gen) return;
            run.at = k; run.atBoundary = false;
            await runInstant(runStep(run.steps[k]), gen);
            if (run.gen !== gen) return;
            run.at = k + 1; run.atBoundary = true;
          }
        } finally { if (S.run === run && run.gen === gen) { run.instant = false; run.fast = false; S.panel.jumping(-1); } }
      }
      for (let k = i; k < run.steps.length; k++) {
        if (run.gen !== gen) return;
        run.at = k; run.atBoundary = false; run.fast = false;
        await runStep(run.steps[k]);
        if (S.run !== run || run.gen !== gen) return;
        run.at = k + 1; run.atBoundary = true;
        if (only) { run.idle = true; S.panel.idle(k); return; }
        await S.sleep(0.4);
      }
      if (S.run === run && run.gen === gen) { run.idle = true; S.panel.done(); }
    } catch (e) {
      console.error(e);
      if (S.run === run && run.gen === gen) { run.idle = true; run.instant = false; run.fast = false; S.panel.jumping(-1); S.panel.failed(e); }
    }
  };
  S.skip = () => { const run = S.run; if (!run || run.idle) return; run.fast = true; if (S.P.active) S.P.skip(); };
  S.pause = on => { const run = S.run; if (!run || run.idle) return; run.paused = on == null ? !run.paused : on; S.panel.paused(run.paused); };
  S.setSpeed = v => { const run = S.run; if (!run) return; run.baseSpeed = run.speed = v; };
  S.close = () => {
    const run = S.run; if (!run) return;
    run.gen++; run.fast = true; tasks.clear(); if (S.P.active) S.P.skip();
    setTimeout(() => { if (S.run !== run) return; S.props.cleanup(); S.run = null; S.R = {}; S.panel.showRun(false); }, 300);
  };
})();
