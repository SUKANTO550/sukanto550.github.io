/* =====================================================================
   CLOSE-UP ACTION CLIPS — player + shared effects
   =====================================================================
   One file per action in VirtualLab/actions/*.js. Each calls CLIPS.register(name, def).
   Plain <script> files (NOT modules) so double-click / file:// works.

   Every clip has 3 parts:
     intro  (plays once)  camera glides close, tools move into position
     loop   (repeats)     small repeating motion; amount moves while flowing
     outro  (plays once)  tools go back, camera returns
   Modes (owner: option C, picked in Settings):
     'hold'   - loop runs while the user HOLDS (button / Space); release = paused, Done = outro.
                Amount counts live, over-pouring possible.
     'amount' - user sets the amount first; loop runs until it is reached, then outro.
     'off'    - no clip (the host moves the amount at once; the player is not used).
   Skip (Esc): ends at once; in 'amount' mode the rest of the amount still moves.

   def = {
     label, unit ('g' | 'ml'),
     intro, outro          seconds
     rate(c)               amount per second at full flow (real-ish speed, used in 'hold' mode)
     minLoop, maxLoop      'amount' mode: loop time is kept within these (s); rate is scaled to fit
     moves(c)              objects the clip moves (saved + restored by the player)
     setup(k, c)           -> state s (make temporary meshes, work out poses)
     shot(k, c, s)         -> { eye, look } close-up camera (world)
     pose(k, c, s, phase, u, on)
                           phase 'intro' | 'loop' | 'outro'; u = 0..1 (intro/outro) or loop seconds;
                           on = 0..1 flow blend (hold pressed). Returns the flow factor for this
                           frame in the loop (average 1 over a cycle; 0 = nothing falls now).
     emit(k, c, s, amt, dt) visual for the amount that moved this frame (grains, drops)
     cleanup(k, c, s)
     -- optional, for step-by-step clips (e.g. glass cutting) --
     noLoop                no loop: intro (the whole sequence) then outro; hold / amount do not apply
     linear                intro gets raw time 0..1 (no easing), so the clip can run its own timeline
     camAt(k, c, s, t)     -> { eye, look } camera that follows the clip (t = intro seconds)
     complete(k, c, s)     on Skip: jump to the end result (e.g. pieces in the dish)
   }
   c (context from the host) = { src, dst, tool, color, available(), room(), onAmount(a), ... }
   Each vessel: { obj, mouth: Vector3 (local mouth centre), mouthR, surfaceY() (local y of contents top) }.
   Objects the clip moves must be direct children of the scene during the clip (the player
   re-parents them and puts them back).                                                        */
(function () {
  const C = window.CLIPS = window.CLIPS || { defs: {} };
  C.register = (name, def) => { C.defs[name] = Object.assign({ intro: 1, outro: 1, minLoop: 2, maxLoop: 6, unit: 'ml' }, def); };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  C.ease = u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  C.smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------- salt heap: irregular crystalline pile (shared by clips + host) ----------
     Unit size: about 1 wide (radius ~1), ~0.42 high, base at y = 0. Scale the returned group UNIFORMLY.
     Lumpy outline, uneven cone-like height, flat-shaded facets, loose crystals on and around it. */
  C.saltHeap = (THREE, { color = '#ffffff', seed = 1, crystals = 110 } = {}) => {
    const hash = (x, y, z) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.3) * 43758.5453; return v - Math.floor(v); };
    const ph = [hash(1, 2, 3), hash(4, 5, 6), hash(7, 8, 9)].map(v => v * 6.283);
    const outline = a => 1 + 0.17 * Math.sin(2 * a + ph[0]) + 0.1 * Math.sin(3 * a + ph[1]) + 0.06 * Math.sin(7 * a + ph[2]);
    const heightAt = (rho, a) => 0.42 * Math.pow(Math.max(0, 1 - rho), 0.85) * (0.85 + 0.15 * Math.sin(3 * a + ph[1] * 2));
    const g = new THREE.Group();
    const geo = new THREE.SphereGeometry(1, 40, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
      const rho = Math.min(1, Math.hypot(x, z)), o = outline(a), bump = 0.9 + 0.2 * hash(Math.round(x * 40), Math.round(y * 40), Math.round(z * 40));
      const R = rho * o;
      p.setXYZ(i, Math.cos(a) * R * (rho > 0.001 ? 1 : 0), heightAt(rho, a) * bump * (y > 0.0001 ? 1 : 0), Math.sin(a) * R * 0.88 * (rho > 0.001 ? 1 : 0));
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true });
    g.add(new THREE.Mesh(geo, mat));
    // loose crystals: ~70 % on the heap surface, the rest scattered just around it
    const cg = new THREE.OctahedronGeometry(1, 0), cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, flatShading: true });
    const im = new THREE.InstancedMesh(cg, cm, crystals), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), base = new THREE.Color(color), col = new THREE.Color();
    for (let i = 0; i < crystals; i++) {
      const a = hash(i, 1, 0) * 6.283, on = hash(i, 2, 0) < 0.7;
      const rho = on ? Math.sqrt(hash(i, 3, 0)) * 0.95 : 1 + hash(i, 3, 0) * 0.55;
      const R = rho * outline(a), y = on ? heightAt(rho, a) * 0.95 : 0;
      const s = 0.035 + 0.06 * hash(i, 4, 0);
      q.setFromEuler(e.set(hash(i, 5, 0) * 3, hash(i, 6, 0) * 3, hash(i, 7, 0) * 3));
      m4.compose(new THREE.Vector3(Math.cos(a) * R, y + s * 0.3, Math.sin(a) * R * 0.88), q, new THREE.Vector3(s, s * (0.6 + 0.6 * hash(i, 8, 0)), s * 0.8));
      im.setMatrixAt(i, m4); im.setColorAt(i, col.copy(base).multiplyScalar(0.9 + 0.18 * hash(i, 9, 0)));
    }
    g.add(im);
    g.userData.setColor = c => { mat.color.set(c); const b = new THREE.Color(c); for (let i = 0; i < crystals; i++) im.setColorAt(i, col.copy(b).multiplyScalar(0.9 + 0.18 * hash(i, 9, 0))); im.instanceColor.needsUpdate = true; };
    g.userData.dispose = () => { geo.dispose(); mat.dispose(); cg.dispose(); cm.dispose(); im.dispose(); };
    return g;
  };

  /* ---------- shared effects: liquid stream, falling grains / drops ---------- */
  function makeFx(THREE, scene) {
    const flowTex = (() => {
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const g = cv.getContext('2d');
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, 64, 256);
      for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.6})`; g.fillRect(Math.random() * 64, Math.random() * 256, 1 + Math.random() * 3, 10 + Math.random() * 40); }
      const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); return t;
    })();
    const streams = [], parts = [];
    const grainGeo = new THREE.BoxGeometry(0.0016, 0.0016, 0.0016), dropGeo = new THREE.SphereGeometry(0.0018, 10, 8);
    const fx = {
      stream() {
        const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0xd6ebff, map: flowTex.clone(), transparent: true,
          opacity: 0.65, roughness: 0.08, depthWrite: false, emissive: 0x223344, emissiveIntensity: 0.25 }));
        m.material.map.needsUpdate = true; m.renderOrder = 5; m.visible = false; scene.add(m); streams.push(m);
        return {
          // falling arc from p0 (lip) to p2 (target); slight forward throw along `throwDir`
          // ctrlPt (optional): explicit curve control point, e.g. a wash-bottle jet leaving the nozzle sideways
          set(p0, p2, r, color, opacity, throwDir, ctrlPt) {
            const ctrl = ctrlPt ? ctrlPt.clone() : p0.clone().lerp(p2, 0.35); if (!ctrlPt) ctrl.y = p0.y - (p0.y - p2.y) * 0.15;
            if (throwDir && !ctrlPt) ctrl.addScaledVector(throwDir, 0.006);
            m.geometry.dispose(); m.geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, ctrl, p2), 20, r, 8, false);
            m.material.color.set(color || 0xd6ebff); m.material.opacity = opacity ?? 0.65; m.visible = true;
          },
          // through given points (e.g. a ballistic jet sampled by the clip)
          setPath(pts, r, color, opacity) {
            m.geometry.dispose(); m.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(8, pts.length * 2), r, 8, false);
            m.material.color.set(color || 0xd6ebff); m.material.opacity = opacity ?? 0.65; m.visible = true;
          },
          hide() { m.visible = false; },
          dispose() { scene.remove(m); m.geometry.dispose(); m.material.dispose(); streams.splice(streams.indexOf(m), 1); },
        };
      },
      // n grains (solid) or drops (liquid) falling from `from` to `to` (gravity-like), random spread in metres
      fall(from, to, color, n, { grain = true, spread = 0.004, delay = 0.03 } = {}) {
        for (let i = 0; i < n; i++) {
          const m = new THREE.Mesh(grain ? grainGeo : dropGeo, new THREE.MeshStandardMaterial({ color: color || 0xd6ebff, roughness: grain ? 0.6 : 0.1, transparent: !grain, opacity: grain ? 1 : 0.75 }));
          m.rotation.set(Math.random() * 3, Math.random() * 3, 0); m.visible = false; m.renderOrder = 6; scene.add(m);
          const j = () => (Math.random() - 0.5) * spread;
          const a = from.clone().add(new THREE.Vector3(j() * 0.4, 0, j() * 0.4)), b = to.clone().add(new THREE.Vector3(j(), 0, j()));
          parts.push({ m, a, b, t: -i * delay - Math.random() * 0.02, T: Math.max(0.12, Math.sqrt(2 * Math.max(0.002, a.y - b.y) / 9.81)) });
        }
      },
      tick(dt) {
        for (const m of streams) if (m.visible) m.material.map.offset.y -= dt * 3.2;
        for (let i = parts.length - 1; i >= 0; i--) {
          const p = parts[i]; p.t += dt; if (p.t < 0) continue;
          const u = Math.min(1, p.t / p.T); p.m.visible = true;
          p.m.position.set(p.a.x + (p.b.x - p.a.x) * u, p.a.y + (p.b.y - p.a.y) * u * u, p.a.z + (p.b.z - p.a.z) * u);
          if (u >= 1) { scene.remove(p.m); p.m.material.dispose(); parts.splice(i, 1); }
        }
      },
      clear() { for (const p of parts) { scene.remove(p.m); p.m.material.dispose(); } parts.length = 0; streams.forEach(m => m.visible = false); },
    };
    return fx;
  }

  /* ---------- player ----------
     env = { THREE, scene, camera, getLook(): Vector3, setLook(v), lockView(bool) } */
  C.createPlayer = env => {
    const { THREE, scene, camera } = env;
    const fx = makeFx(THREE, scene);
    const up = new THREE.Vector3(0, 1, 0);
    const k = {
      THREE, scene, camera, fx, ease: C.ease, smooth: C.smooth, up,
      // horizontal camera right / towards-camera directions (taken at clip start)
      camRight() { const r = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0); r.y = 0; return r.normalize(); },
      camBack() { const b = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2); b.y = 0; return b.normalize(); },
      // close-up eye: from the side the user already looks from, `dist` away, `elev` rad above level
      shotAt(look, dist, elev = 0.3, side = 0) {
        const b = k.camBack(); if (side) b.applyAxisAngle(up, side);
        return { eye: look.clone().addScaledVector(b, dist * Math.cos(elev)).addScaledVector(up, dist * Math.sin(elev)), look: look.clone() };
      },
      world(obj, local) { obj.updateMatrixWorld(true); return obj.localToWorld(local.clone()); },
      // pose an object so that its local point `pLocal` lands on world point `pWorld` with rotation q
      placeBy(obj, q, pLocal, pWorld) { obj.quaternion.copy(q); obj.position.copy(pWorld).sub(pLocal.clone().applyQuaternion(q)); obj.updateMatrixWorld(true); },
      // blend two poses {pos, quat} with a lift arc (metres) in the middle
      blendPose(obj, A, B, u, lift = 0) {
        obj.position.lerpVectors(A.pos, B.pos, u); obj.position.y += Math.sin(Math.PI * u) * lift;
        obj.quaternion.slerpQuaternions(A.quat, B.quat, u); obj.updateMatrixWorld(true);
      },
      poseOf(obj) { return { pos: obj.position.clone(), quat: obj.quaternion.clone() }; },
    };
    let cur = null;
    const CAM_T = 0.75;

    function finish(instant) {
      const c = cur; if (!c) return; cur = null;
      fx.clear();
      if (c.def.cleanup) c.def.cleanup(c.k, c.ctx, c.s);
      for (const r of c.saved) {               // back to the original parent + pose
        r.parent.add(r.o); r.o.position.copy(r.pos); r.o.quaternion.copy(r.quat); r.o.scale.copy(r.scale); r.o.updateMatrixWorld(true);
      }
      if (instant) { camera.position.copy(c.cam0.pos); env.setLook(c.cam0.look); }
      env.lockView && env.lockView(false);
      c.opts.onEnd && c.opts.onEnd({ done: c.done, skipped: !!instant });
    }

    const P = {
      fx, k,
      get active() { return !!cur; },
      get state() { return cur && { phase: cur.phase, t: cur.t, done: cur.done, goal: cur.goal, mode: cur.mode, holding: cur.holdOn }; },
      play(name, ctx, opts = {}) {
        if (cur) finish(true);
        const def = C.defs[name]; if (!def) throw new Error('No action clip: ' + name);
        const moves = (def.moves ? def.moves(ctx) : []).filter(Boolean);
        const saved = moves.map(o => ({ o, parent: o.parent, pos: o.position.clone(), quat: o.quaternion.clone(), scale: o.scale.clone() }));
        moves.forEach(o => scene.attach(o));
        const s = def.setup ? def.setup(k, ctx) || {} : {};
        const shot = def.camAt ? def.camAt(k, ctx, s, 0) : def.shot(k, ctx, s);
        const mode = opts.mode === 'amount' ? 'amount' : 'hold';
        let goal = Infinity, rate = def.rate ? def.rate(ctx) : 0;
        if (mode === 'amount') {
          goal = Math.max(0, Math.min(opts.amount || 0, ctx.available(), ctx.room ? ctx.room() : Infinity));
          rate = goal / clamp(goal / rate, def.minLoop, def.maxLoop);
        }
        cur = { def, ctx, s, k, opts, mode, goal, rate, saved, phase: 'intro', t: 0, loopT: 0, on: mode === 'amount' ? 0 : 0, holdOn: false, done: 0,
          cam0: { pos: camera.position.clone(), look: env.getLook().clone() }, shot, camT: 0 };
        env.lockView && env.lockView(true);
        def.pose(k, ctx, s, 'intro', 0, 0);
        return P;
      },
      hold(on) { if (cur) cur.holdOn = !!on; },
      done() { if (cur && cur.phase === 'loop') { cur.phase = 'outro'; cur.t = 0; cur.camOut = { eye: camera.position.clone(), look: env.getLook().clone() }; cur.ctx.onPhase && cur.ctx.onPhase('outro'); } },
      skip() {
        if (!cur) return;
        if (cur.mode === 'amount' && cur.goal > cur.done) {
          const rest = Math.min(cur.goal - cur.done, cur.ctx.available()); if (rest > 0) { cur.done += rest; cur.ctx.onAmount(rest); }
        }
        if (cur.def.complete) cur.def.complete(cur.k, cur.ctx, cur.s);
        finish(true);
      },
      tick(dt) {
        fx.tick(dt);
        const c = cur; if (!c) return;
        const { def, ctx, s } = c;
        // camera: glide in during the intro, glide back during the outro
        if (c.phase === 'intro' && def.camAt) c.shot = def.camAt(k, ctx, s, c.t);     // camera follows the clip
        const camFrom = c.phase === 'outro' ? (c.camOut || c.shot) : c.cam0, camTo = c.phase === 'outro' ? c.cam0 : c.shot;
        if (c.phase === 'intro' || c.phase === 'outro') {
          const u = C.ease(clamp(c.t / CAM_T, 0, 1));
          camera.position.lerpVectors(camFrom.eye || camFrom.pos, camTo.eye || camTo.pos, u);
          env.setLook(new THREE.Vector3().lerpVectors(camFrom.look, camTo.look, u));
        }
        c.t += dt;
        if (c.phase === 'intro') {
          const u = clamp(c.t / def.intro, 0, 1); def.pose(k, ctx, s, 'intro', def.linear ? u : C.ease(u), 0);
          if (c.t >= Math.max(def.intro, CAM_T)) {
            if (def.noLoop) { c.phase = 'outro'; c.camOut = { eye: camera.position.clone(), look: env.getLook().clone() }; }
            else c.phase = 'loop';
            c.t = 0; ctx.onPhase && ctx.onPhase(c.phase);
          }
        } else if (c.phase === 'loop') {
          if (def.camAt) {                                         // camera keeps following (e.g. the rising liquid in a pipette)
            const sh = def.camAt(k, ctx, s, def.intro + c.t), f = Math.min(1, dt * 3);
            camera.position.lerp(sh.eye, f); env.setLook(env.getLook().clone().lerp(sh.look, f));
          }
          const want = c.mode === 'amount' ? 1 : (c.holdOn ? 1 : 0);
          c.on += (want - c.on) * Math.min(1, dt * 6);
          if (c.on > 0.02 || want) c.loopT += dt;
          const f = def.pose(k, ctx, s, 'loop', c.loopT, c.on) || 0;
          let a = c.rate * dt * f * (c.on > 0.85 ? 1 : 0);
          a = Math.min(a, ctx.available(), c.goal - c.done, ctx.room ? ctx.room() : Infinity);
          if (a > 0) { c.done += a; ctx.onAmount(a); def.emit && def.emit(k, ctx, s, a, dt); }
          if (c.mode === 'amount' && c.done >= c.goal - 1e-9) P.done();
          else if (ctx.available() <= 1e-9 || (ctx.room && ctx.room() <= 1e-9)) {
            ctx.onNotice && ctx.onNotice(ctx.available() <= 1e-9 ? 'empty' : 'full');
            if (c.mode === 'amount') P.done(); else c.holdOn = false;
          }
        } else if (c.phase === 'outro') {
          const u = clamp(c.t / def.outro, 0, 1); def.pose(k, ctx, s, 'outro', u, 0);
          if (c.t >= Math.max(def.outro, CAM_T)) finish(false);
        }
      },
    };
    return P;
  };
})();
