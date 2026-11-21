/* Borosilicate glass funnel — used by the owner as a DUST COVER: placed upside down over a substrate on a
   hotplate (up to ~410 °C, so glass, not plastic). Only need: its rim must cover a 25 x 25 mm substrate
   (diagonal 35.4 mm) with room to spare. Typical "50 ml" short-stem funnel: 65 mm across the rim, 60° cone,
   short stem 8 mm wide.
   Model frame = how it rests on a table or a hotplate: UPSIDE DOWN, rim on y = 0, stem pointing up (+y).
   it.funnel = { rimR (inner radius at the rim), height, D } for the hosts / clips. */
(function () {
  const E = window.EQUIP = window.EQUIP || {};
  const D = 0.065, RO = D / 2, W = 0.0016, RS = 0.004, CONE = Math.PI / 6;   // rim Ø, wall, stem outer radius, half-angle
  const HC = (RO - RS) / Math.tan(CONE), STEM = 0.035, H = HC + STEM;
  E.funnelDims = { D, rimR: RO - W, height: H, coneH: HC };

  E.funnel = (k, it) => {
    // profile from the rim (y = 0) up the cone and the stem, back down the inside; small bead at the rim
    const pts = [
      [RO - W, 0.0004], [RO - W * 0.2, 0], [RO + 0.0006, 0.0006], [RO + 0.0004, 0.0018], [RO, 0.0024],
      [RS, HC], [RS, H - 0.0006], [RS - 0.0004, H], [RS - W, H], [RS - W, HC + 0.001],
      [RO - W - W * Math.tan(CONE) * 0.5, 0.0024],
    ];
    const m = k.lathe(pts, k.M.glass, 48); m.renderOrder = 3; m.castShadow = false;
    it.obj.add(m);
    it.funnel = { rimR: RO - W, height: H, D };
    it.r = RO + 0.001;
    return it;
  };
})();
