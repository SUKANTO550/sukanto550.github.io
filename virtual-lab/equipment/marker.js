/* Permanent lab marker, black, fine tip (owner: realistic; writes labels on any equipment - actions/marker.js).
   Generic (no brand). ~140 mm with the cap: black barrel with a grey printed band, separate cap with a pocket clip
   (covers the tip), black end plug. Model axis along z, TIP at +z; lies on its side on y = 0.
   it.markerCap = the cap group (actions/marker.js slides it onto the back end while writing)
   it.tipZ      = z of the fibre tip (cap off) */
(function () {
  const E = window.EQUIP = window.EQUIP || {};
  E.marker = (k, it) => {
    const { THREE } = k;
    const R = 0.0072, Lb = 0.105;                                      // barrel radius / length
    const black = k.colMat('#17181a', 0.38), cream = k.colMat('#d9dcdf', 0.5), tipM = k.colMat('#0b0b0c', 0.85);
    const g = new THREE.Group(); g.position.y = R + 0.0006; it.obj.add(g);
    // barrel (lathe along y, turned to z): slight waist, shoulder to the tip
    const barrel = k.lathe([[0.0001, -Lb / 2], [R * 0.86, -Lb / 2], [R * 0.95, -Lb / 2 + 0.004], [R, -Lb / 2 + 0.012], [R, Lb / 2 - 0.016], [R * 0.82, Lb / 2 - 0.006], [0.0028, Lb / 2], [0.0001, Lb / 2]], black, 28);
    barrel.rotation.x = Math.PI / 2; g.add(barrel);
    // printed band (generic): grey wrap with dark text
    // text runs ALONG the barrel: u = round the barrel, v = along it -> draw it turned 90 deg on a tall canvas
    const bt = k.texCache('marker-band', () => k.canvasTex(256, 512, (c, w, h) => { c.fillStyle = '#c9cdd1'; c.fillRect(0, 0, w, h); c.fillStyle = '#17181a';
      c.save(); c.translate(w * 0.25, h / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = 'bold 40px system-ui'; c.fillText('PERMANENT MARKER', 0, 0); c.font = '30px system-ui'; c.fillText('FINE · BLACK', 0, 48); c.restore(); }));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.0002, R + 0.0002, 0.056, 28, 1, true), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.5 }));
    band.rotation.x = Math.PI / 2; band.rotation.y = Math.PI / 2; band.position.z = -0.006; g.add(band);
    // fibre tip (cone, protrudes from the shoulder)
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0006, 0.0018, 0.008, 12), tipM); tip.rotation.x = Math.PI / 2; tip.position.z = Lb / 2 + 0.004; g.add(tip);
    it.tipZ = Lb / 2 + 0.008;
    // end plug
    const plug = k.cyl(R * 0.82, R * 0.82, 0.004, k.colMat('#26282b', 0.4), 20); plug.rotation.x = Math.PI / 2; plug.position.z = -Lb / 2 - 0.0015; g.add(plug);
    // cap with a pocket clip
    const cap = new THREE.Group(); cap.position.z = Lb / 2 - 0.004; g.add(cap);
    const capBody = k.lathe([[R + 0.0009, 0], [R + 0.0012, 0.004], [R + 0.0012, 0.03], [R * 0.9, 0.037], [0.0001, 0.039]], black, 28); capBody.rotation.x = Math.PI / 2; cap.add(capBody);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.0012, 0.0006, 6, 24), cream); ring.position.z = 0.004; cap.add(ring);
    const clip = k.rbox(0.004, 0.0014, 0.032, 0.0006, black, 1); clip.position.set(0, R + 0.0026, 0.016); cap.add(clip);
    const clipFoot = k.rbox(0.004, 0.0026, 0.004, 0.0006, black, 1); clipFoot.position.set(0, R + 0.0016, 0.031); cap.add(clipFoot);
    it.markerCap = cap; it.markerG = g; it.capZ0 = cap.position.z;
    it.r = 0.072;
  };
})();
