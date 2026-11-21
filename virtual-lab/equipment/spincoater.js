/* Spin coater — light grey body 250 x 120 x 250 mm, steel bowl, dark bowl floor, black vacuum chuck with a
   white mark, glass dome lid on a hinge at the back, front panel with display + 3 buttons.
   (Moved out of index.html on 2026-11-20 so the action clips' demo uses the same model; shape unchanged.)
   Contracts with index.html: returns { spinner (group, turns about y; chuck top at local y 0.0122),
   lidHinge (rotation.x = -1.3 * open fraction), dispMesh (plane, MeshBasicMaterial - host sets its map) }. */
(function () {
  const E = window.EQUIP = window.EQUIP || {};
  E.spincoater = (k, it) => {
    const { THREE, M } = k, o = it.obj;
    const b = k.rbox(0.25, 0.12, 0.25, 0.014, k.colMat('#dfe4e8', 0.35), 4); b.position.y = 0.06; o.add(b);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const f = k.cyl(0.009, 0.009, 0.006, M.black, 14); f.position.set(sx * (0.125 - 0.03), 0.001, sz * (0.125 - 0.03)); o.add(f); }
    o.add(k.lathe([[0.07, 0.12], [0.09, 0.16], [0.094, 0.16], [0.074, 0.12]], M.steelDark, 48));
    const floor = k.cyl(0.072, 0.072, 0.002, k.colMat('#5a636d', 0.5), 40); floor.position.y = 0.121; o.add(floor);
    const spinner = new THREE.Group(); spinner.position.y = 0.122; o.add(spinner);
    const chuck = k.cyl(0.012, 0.014, 0.012, M.black, 24); chuck.position.y = 0.006; spinner.add(chuck);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.0005, 0.01), k.colMat('#ffffff')); mark.position.set(0, 0.0123, 0.006); spinner.add(mark);
    const hinge = new THREE.Group(); hinge.position.set(0, 0.16, -0.095); o.add(hinge);
    // lid: tinted acrylic dome (owner: the clear-glass lid was barely visible, and invisible when open - its inside was
    // not drawn). Own smoky blue-grey material, drawn on BOTH sides, edge brighter, + a solid grey rim ring.
    const lidM = new THREE.MeshStandardMaterial({ color: 0x8fa4b4, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.42,
      envMapIntensity: 0.6, depthWrite: false, side: THREE.DoubleSide });
    lidM.onBeforeCompile = M.glass.onBeforeCompile;
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.095, 40, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), lidM); lid.scale.y = 0.55; lid.position.set(0, -0.025, 0.095); lid.renderOrder = 3; hinge.add(lid);
    const rimY = -0.025 + 0.095 * Math.cos(Math.PI * 0.32) * 0.55, rimR = 0.095 * Math.sin(Math.PI * 0.32);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.0028, 10, 64), k.colMat('#5d6a75', 0.4)); rim.rotation.x = Math.PI / 2; rim.position.set(0, rimY, 0.095); hinge.add(rim);
    const knob = k.cyl(0.008, 0.008, 0.012, M.black, 16); knob.position.set(0, 0.012, 0.18); hinge.add(knob);
    const pn = k.rbox(0.2, 0.05, 0.006, 0.003, M.bodyDark || k.colMat('#34404c', 0.5)); pn.position.set(0, 0.06, 0.126); o.add(pn);
    for (let i = 0; i < 3; i++) { const bt = k.cyl(0.007, 0.007, 0.004, k.colMat(['#7d8894', '#d9a21b', '#3c9a5f'][i], 0.4), 20); bt.rotation.x = Math.PI / 2; bt.position.set(0.02 + i * 0.024, 0.06, 0.13); o.add(bt); }
    const dispMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.024), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dispMesh.position.set(-0.05, 0.06, 0.1295); o.add(dispMesh);
    o.traverse(m => { if (m.isMesh && !m.material.transparent) { m.castShadow = true; m.receiveShadow = true; } });
    return { spinner, lidHinge: hinge, dispMesh };
  };
})();
