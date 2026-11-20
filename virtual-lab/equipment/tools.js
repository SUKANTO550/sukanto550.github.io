/* Small hand tools — modelled on the owner's photos (generic, no brand print).
   Pipette pump (VirtualLab/Equipments/Pippet pump): coloured body (10 ml = green), white ribbed holder
   sleeve at the bottom, white plunger + thumb disc on top, white thumb wheel and release lever on the side.
   Glass cutter (VirtualLab/Equipments/Glass cutter): brass knurled handle, ball end; steel head shaped like the
   owner's STEP head (5.5 mm plate, pointed tip; used to cut the glass slides).
   Both lie on the shelf, length along z, resting on y = 0. */
(function () {
  const E = window.EQUIP = window.EQUIP || {};

  /* Pipette pump parts (upright, y = axis, sleeve opening at y = 0). 'body' = sleeve + coloured body + lever,
     'plunger' = threaded rod + thumb disc (rises when liquid is drawn), 'wheel' = thumb wheel (turns, axis z at
     x 0.0125, y 0.142). */
  function pumpPart(k, g, color, which) {
    const { THREE } = k;
      const body = k.colMat(color, 0.4), white = k.colMat('#f4f5f2', 0.45), dark = k.colMat('#3a3f45', 0.5);
    if (which === 'body') {
      // holder sleeve (white, slightly conical) + dark opening
      g.add(k.lathe([[0.0001, 0], [0.0086, 0], [0.0088, 0.002], [0.0104, 0.034], [0.0098, 0.037], [0.0001, 0.037]], white, 28));
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.0045, 16), dark); hole.rotation.x = Math.PI / 2; hole.position.y = -0.0002; g.add(hole);
      for (let i = 0; i < 16; i++) {           // sleeve ribs
        const a = i / 16 * Math.PI * 2, r = new THREE.Mesh(new THREE.BoxGeometry(0.0012, 0.03, 0.0012), white);
        r.position.set(Math.sin(a) * 0.0097, 0.019, Math.cos(a) * 0.0097); r.rotation.y = a; r.rotation.x = 0; g.add(r);
      }
      // coloured body with a few rings near the top, collar
      g.add(k.lathe([[0.0001, 0.036], [0.0098, 0.036], [0.0106, 0.042], [0.0106, 0.12], [0.0112, 0.122], [0.0112, 0.126], [0.0106, 0.128],
        [0.0106, 0.132], [0.0112, 0.134], [0.0112, 0.138], [0.0106, 0.14], [0.0106, 0.152], [0.0118, 0.154], [0.0118, 0.16], [0.0001, 0.16]], body, 32));
      // release lever along the side + hinge pin
      const lev = k.rbox(0.0045, 0.06, 0.009, 0.002, white, 2); lev.position.set(0.0128, 0.088, 0); lev.rotation.z = -0.06; g.add(lev);
      const tab = k.rbox(0.008, 0.012, 0.009, 0.003, white, 2); tab.position.set(0.0152, 0.06, 0); g.add(tab);
      const pin = k.cyl(0.0018, 0.0018, 0.0105, k.colMat('#c9cdd1', 0.3), 10); pin.rotation.x = Math.PI / 2; pin.position.set(0.0118, 0.112, 0); g.add(pin);
    }
    if (which === 'plunger') {
      // plunger rod (threaded look) + thumb disc
      g.add(k.lathe([[0.0001, 0.16], [0.0042, 0.16], [0.0042, 0.164], [0.0036, 0.166], [0.0042, 0.168], [0.0036, 0.17], [0.0042, 0.172],
        [0.0036, 0.174], [0.0042, 0.176], [0.0042, 0.186], [0.0001, 0.186]], white, 20));
      g.add(k.lathe([[0.0001, 0.185], [0.011, 0.185], [0.0115, 0.1865], [0.011, 0.189], [0.0001, 0.189]], white, 28));
    }
    if (which === 'wheel') {
      // thumb wheel on the side (axis along z)
      const wheel = k.lathe([[0.0001, -0.0022], [0.0108, -0.0022], [0.0112, 0], [0.0108, 0.0022], [0.0001, 0.0022]], white, 28);
      wheel.rotation.x = Math.PI / 2; wheel.position.set(0.0125, 0.142, 0); g.add(wheel);
      const hub = k.cyl(0.003, 0.003, 0.009, white, 12); hub.rotation.x = Math.PI / 2; hub.position.set(0.0125, 0.142, 0); g.add(hub);
    }
  }

  E.pipettePump = (k, o, color = '#2f9e57') => {
    const { THREE } = k;
    const up = new THREE.Group();                 // modelled upright (y = axis), then laid down
    up.add(k.bake('pump-' + color, g => { for (const w of ['body', 'plunger', 'wheel']) pumpPart(k, g, color, w); }));
    up.rotation.x = -Math.PI / 2; up.rotation.y = 0;             // axis -> -z ... lay it down
    up.position.set(0, 0.0112, 0.093);                           // rest on the collar/sleeve, centred on the item
    const lay = new THREE.Group(); lay.add(up); lay.rotation.y = Math.PI; o.add(lay);
  };
  /* Upright pump with moving parts (for the pipetting clip): returns { plunger, wheel } groups.
     Plunger rises by `rise` metres; wheel turns about z (pivot at x 0.0125, y 0.142). */
  E.pipettePumpUp = (k, o, color = '#2f9e57') => {
    const { THREE } = k;
    o.add(k.bake('pumpU-body-' + color, g => pumpPart(k, g, color, 'body')));
    const plunger = new THREE.Group(); plunger.add(k.bake('pumpU-pl', g => pumpPart(k, g, color, 'plunger'))); o.add(plunger);
    const wheel = new THREE.Group(); wheel.position.set(0.0125, 0.142, 0);
    const wm = k.bake('pumpU-wh', g => pumpPart(k, g, color, 'wheel')); wm.position.set(-0.0125, -0.142, 0); wheel.add(wm); o.add(wheel);
    return { plunger, wheel };
  };

  E.glassCutter = (k, o) => {
    const { THREE } = k;
    const up = new THREE.Group();
    up.add(k.bake('glass-cutter', g => {
      const brass = k.colMat('#c9a24a', 0.32, { metalness: 0.85 }), steel = k.colMat('#c7ccd1', 0.3, { metalness: 0.8 });
      const knurlTex = k.texCache('knurl', () => {
        const t = k.canvasTex(64, 64, (c, w, h) => {
          c.fillStyle = '#c9a24a'; c.fillRect(0, 0, w, h); c.fillStyle = '#8a6a22';
          for (let x = 0; x < w; x += 8) for (let y = 0; y < h; y += 8) { c.beginPath(); c.moveTo(x + 4, y); c.lineTo(x + 8, y + 4); c.lineTo(x + 4, y + 8); c.lineTo(x, y + 4); c.closePath(); c.globalAlpha = 0.55; c.fill(); c.globalAlpha = 1; }
        }); t.repeat.set(10, 12); return t;
      });
      const knurl = new THREE.MeshStandardMaterial({ map: knurlTex, color: 0xffffff, metalness: 0.8, roughness: 0.45 });
      // brass body: ferrule, knurled grip, slim neck, ball end
      g.add(k.lathe([[0.0001, 0.0], [0.0035, 0.0], [0.0042, 0.004], [0.0055, 0.008], [0.0055, 0.024], [0.0068, 0.026], [0.0001, 0.026]], brass, 28));
      g.add(k.lathe([[0.0001, 0.026], [0.0072, 0.026], [0.0073, 0.03], [0.0073, 0.108], [0.007, 0.112], [0.0001, 0.112]], knurl, 32));
      g.add(k.lathe([[0.0001, 0.112], [0.0068, 0.112], [0.0058, 0.125], [0.0045, 0.142], [0.0042, 0.152], [0.0001, 0.152]], brass, 28));
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0078, 24, 16), brass); ball.position.y = 0.158; g.add(ball);
      // steel head (owner's STEP, Equipments/glass cutting animation): plate 5.5 mm thick (= the slide-cutter slot,
      // so it guides in the slot), 15 mm wide, 27.86 mm long, uneven pointed tip. Profile (x across, y along the axis):
      // tip (0.98, -27.86) -> (7.5, -23.03) -> (7.5, 0) -> (-7.5, 0) -> (-7.5, -16.85). Tilted 36.6 deg the edge
      // tip -> (7.5, -23.03) lies flat on the glass. Contract: cutting tip at (0.00098, -0.02786, 0) in this frame.
      const sh = new THREE.Shape(); sh.moveTo(0.00098, -0.02786); sh.lineTo(0.0075, -0.02303); sh.lineTo(0.0075, 0); sh.lineTo(-0.0075, 0); sh.lineTo(-0.0075, -0.01685); sh.closePath();
      const hg = new THREE.ExtrudeGeometry(sh, { depth: 0.0053, bevelEnabled: true, bevelThickness: 0.0001, bevelSize: 0.0001, bevelSegments: 1 });
      hg.translate(0, 0.0001, -0.00265); hg.deleteAttribute('uv'); g.add(new THREE.Mesh(k.creased(hg, 0.5), steel));
    }));
    up.rotation.x = Math.PI / 2;                 // axis -> +z
    up.position.set(0, 0.0078, -0.075);          // rests on the ball / grip
    o.add(up);
  };
})();
