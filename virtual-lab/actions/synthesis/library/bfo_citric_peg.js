/* =====================================================================
   PROTOCOL: BFO sol-gel thin film (citric acid + PEG 4000) — owner's lab practice
   =====================================================================
   Sections: 0 wash, A sol, B aging 48 h, C substrate cut + clean (during the aging), D spin coating
   5 layers, E final anneal. Owner's practice (2026-11-20 / 21): synthesis in the 100 ml SCREW-CAP
   conical flask, cap closed after every addition, liquid never above 50 °C; salts weighed on a watch
   glass and pushed in with the spatula, from their own small vials (NaOH from its box); liquids only by
   graduated pipette + pump from a working jar (10 ml for 2-MOE, 2 ml for acetic acid dropwise), rinsed
   DI water -> ethanol -> the liquid; the 2-MOE working jar starts low and is refilled from the stock
   bottle (shown). Substrates dipped in ethanol, back wiped, spin dried, 20 µl sol, no ramp; hot
   substrate moved with ceramic tweezers under the inverted funnel; cooled on a petri dish.
   Edit the values below freely (the step texts use them). */
(function () {
  const V = {
    moe1: 20, moe2: 5,                       // ml 2-methoxyethanol (step 2, step 8), 10 ml pipette
    moeRefill: 50,                           // ml poured from the stock bottle into the low working jar (step 2)
    bi: 3.408, fe: 2.583, citric: 0.267,     // g (steps 4, 5, 6)
    acetic: 1.0, peg: 1.25,                  // ml glacial acetic acid (dropwise), g PEG 4000 powder (owner)
    stir1: { rpm: 400, T: 40 }, stir2: { rpm: 500, T: 50 }, cool: { rpm: 300 },   // step 10: 50 °C (owner: never > 50 °C)
    naoh: 2.5, naohWater: 50,                // g NaOH pellets in ml DI water = 5 % (step 19)
    sonic: 15,                               // min each sonication
    ethDrop: 0.1, solDrop: 0.02,             // ml (step 25 ethanol ~100 µl, step 27 sol 20 µl)
    hot: { gel: 90, pyro: 280, burn: 410 },  // °C (steps 28-30)
    stages: { gel: 1, pyro: 3, burn: 3, cool: 2.5 },   // min on each hotplate / cooling on the dish
    program: [{ rpm: 500, s: 5, label: 'Stage 1 spread' }, { rpm: 3000, s: 30, label: 'Stage 2 thin' }],
    layers: 5,
  };
  const later = [];
  for (let n = 2; n <= V.layers; n++) later.push({ tag: `Layer ${n}`, sec: 'D', block: 'fullLayer', layer: n, drop: V.solDrop, program: V.program, speed: 3, last: n === V.layers,
    stages: [{ to: 'gel', min: V.stages.gel, label: 'gelation' }, { to: 'pyro', min: V.stages.pyro, label: 'pyrolysis' }, { to: 'burn', min: V.stages.burn, label: 'burn-out' }, { to: 'dish', min: V.stages.cool, label: 'cooling' }],
    text: `Layer ${n} of ${V.layers}: repeat 25–31 (shown faster).` });

  SYNTH.protocol({
    id: 'bfo_citric_peg',
    name: 'BFO sol-gel (citric + PEG)',
    group: 'standard',                       // standard | paper | custom
    product: 'film',                         // film | powder
    source: 'Owner — lab practice',
    summary: `BiFeO₃ sol in 2-MOE with citric acid and PEG 4000, aged 48 h, ${V.layers} spin-coated layers on 25 × 25 mm glass, annealed at 500 °C.`,
    doneText: `Protocol complete — ${V.layers} layers, annealed.`,
    recipe: {
      jars: { moe: 8, acetic: 15 },          // ml in the working jars at the start (2-MOE is low: refilled in step 2)
      colors: { bi: { col: '#f3ecc0', op: 0.3 }, fe: { col: '#c46d1c', op: 0.62 }, sol: { col: '#8a4a1c', op: 0.78 },   // owner: set per step, no rule
                film: '#8a4a1c', annealed: '#5a2a12' },
    },
    sections: { P: '0 · Preparation', A: 'A · Sol', B: 'B · Aging 48 h', C: 'C · Substrates (during aging)', D: 'D · Spin coating', E: 'E · Anneal' },
    steps: [
      // ---- 0: preparation ----
      { n: 0, sec: 'P', block: 'washAll', first: 1.4, rest: 0.12,
        text: 'Wash all glassware and tools at the basin: detergent + brush, tap water, acetone, IPA; air-dry. (Working jars and salt vials are already clean and filled.)' },
      // ---- A: sol ----
      { n: 1, sec: 'A', block: 'takeFlask' },
      { n: 2, sec: 'A', block: 'pipetteAdd', chem: 'moe', name: '2-MOE', ml: V.moe1, pipette: 10, refill: V.moeRefill,
        text: `Pipette ${V.moe1} ml of 2-methoxyethanol from the working jar into the flask (10 ml pipette, ${Math.ceil(V.moe1 / 10)} × ${Math.min(10, V.moe1)} ml).` },
      { n: 3, sec: 'A', block: 'stir', rpm: V.stir1.rpm, T: V.stir1.T, min: 3, label: `Equilibrating (${V.stir1.rpm} rpm, ${V.stir1.T} °C)`,
        text: `Flask on the hotplate: stir ${V.stir1.rpm} rpm, ${V.stir1.T} °C. Wait 3 minutes to equilibrate.` },
      { n: 4, sec: 'A', block: 'weighAdd', chem: 'bi', g: V.bi, label: 'Bi nitrate', slow: true, stir: 15, stirLabel: `Stirring until dissolved (${V.stir1.rpm} rpm, ${V.stir1.T} °C)`, color: 'bi',
        text: `Weigh ${V.bi} g Bi(NO₃)₃·5H₂O from its vial. Add slowly (~60 s) to the stirring 2-MOE. Stir 15 min → pale yellow.` },
      { n: 5, sec: 'A', block: 'weighAdd', chem: 'fe', g: V.fe, label: 'Fe nitrate', slow: true, stir: 15, color: 'fe',
        text: `Weigh ${V.fe} g Fe(NO₃)₃·9H₂O from its vial. Add slowly (~60 s) while stirring. Stir 15 min → orange-brown.` },
      { n: 6, sec: 'A', block: 'weighAdd', chem: 'citric', g: V.citric, label: 'Citric acid', stir: 5,
        text: `Weigh ${V.citric} g citric acid from its vial. Add it to the flask. Stir 5 min until dissolved.` },
      { n: 7, sec: 'A', block: 'pipetteAdd', chem: 'acetic', name: 'acetic acid', ml: V.acetic, pipette: 2, dropwise: true,
        text: `Add ${V.acetic} ml glacial acetic acid dropwise (~30 s) with the 2 ml pipette, from its working jar.` },
      { n: 8, sec: 'A', block: 'pipetteAdd', chem: 'moe', name: '2-MOE', ml: V.moe2, pipette: 10,
        text: `Pipette the remaining ${V.moe2} ml 2-MOE (total ~${V.moe1 + V.moe2} ml) into the flask, rinsing the flask walls.` },
      { n: 9, sec: 'A', block: 'weighAdd', chem: 'peg', g: V.peg, label: 'PEG 4000',
        text: `Weigh ${V.peg} g PEG 4000 powder from its vial and add it while stirring.` },
      { n: 10, sec: 'A', block: 'stir', rpm: V.stir2.rpm, T: V.stir2.T, min: 120, dissolve: true, color: 'sol',
        label: `Stirring (${V.stir2.rpm} rpm, ${V.stir2.T} °C — never above 50 °C)`,
        text: `Stir ${V.stir2.rpm} rpm at ${V.stir2.T} °C for 2 h → clear amber-brown sol, no particles.` },
      { n: 11, sec: 'A', block: 'cool', rpm: V.cool.rpm, min: 30 },
      { n: 12, sec: 'A', block: 'syringeFilter', text: 'Filter through a 0.22 µm PTFE syringe filter into a clean glass vial. (Owner: 0.22 µm.)' },
      { n: 13, sec: 'A', block: 'sealVial', label: 'BFO', line2: '≈0.26 M (Fe)' },
      // ---- B: aging (starts) ----
      { n: 14, sec: 'B', block: 'ageStart' },
      { n: 15, sec: 'B', block: 'note', say: 'Aging started — Section C is done during the 48 h.', show: 1.5,
        text: 'Leave it undisturbed for 48 h (chelation completes: better film quality and phase purity). The substrates are prepared meanwhile.' },
      // ---- C: substrates (during the aging) ----
      { n: 17, sec: 'C', block: 'cutSlide' },
      { n: 18, sec: 'C', block: 'note', min: 5, show: 1.6, text: 'Label each piece on the BACK (non-deposition) side with the diamond scribe.' },
      { n: 19, sec: 'C', block: 'bathClean', naoh: V.naoh, ml: V.naohWater, sonic: V.sonic,
        text: `Pieces into a beaker with 5 % NaOH (${V.naoh} g pellets in ${V.naohWater} ml DI water). Sonicate ${V.sonic} min. Discard the NaOH.` },
      { n: 20, sec: 'C', block: 'bathClean', ml: V.naohWater, sonic: V.sonic, text: `Add DI water. Sonicate ${V.sonic} min. Discard the water.` },
      { n: 21, sec: 'C', block: 'toEthanol', ml: 30 },
      { n: 22, sec: 'C', block: 'coverDish', min: 5 },
      { n: 16, sec: 'B', block: 'ageEnd', h: 48 },
      // ---- D: spin coating ----
      { n: 23, sec: 'D', block: 'spinPrep', gel: V.hot.gel, pyro: V.hot.pyro, burn: V.hot.burn, warm: 8 },
      { n: 24, sec: 'D', block: 'chuckLoad' },
      { n: 25, sec: 'D', block: 'spinPrewet', rpm: 3000, s1: 10, drop: V.ethDrop, s2: 60 },
      { n: 26, sec: 'D', block: 'note', show: 1.2, text: 'Spin program (no ramp, owner): stage 1 = 500 rpm 5 s (spread), stage 2 = 3000 rpm 30 s (thin).' },
      { n: 27, sec: 'D', block: 'spinLayer', layer: 1, drop: V.solDrop, program: V.program,
        text: `Dispense ${V.solDrop * 1000} µl sol on the centre of the stationary substrate; start the program at once.` },
      { n: 28, sec: 'D', block: 'hotStage', to: 'gel', min: V.stages.gel, label: 'Gelation',
        text: `Gelation: substrate (ceramic tweezers) to the ${V.hot.gel} °C hotplate, covered with the inverted funnel. 1 min → wet/shiny to matte.` },
      { n: 29, sec: 'D', block: 'hotStage', to: 'pyro', min: V.stages.pyro, label: 'Pyrolysis', text: `Pyrolysis: to the ${V.hot.pyro} °C hotplate (funnel follows). 3 min.` },
      { n: 30, sec: 'D', block: 'hotStage', to: 'burn', min: V.stages.burn, label: 'Burn-out', text: `Burn-out: to the ${V.hot.burn} °C hotplate. 3 min (partial PEG burn-out).` },
      { n: 31, sec: 'D', block: 'hotStage', to: 'dish', min: V.stages.cool, label: 'Cooling', last: V.layers === 1,
        text: 'Off the hotplate onto a petri dish to cool below 60 °C before the next layer (owner).' },
      later,
      // ---- E: anneal ----
      { n: 32, sec: 'E', block: 'toFurnace' },
      { n: 33, sec: 'E', block: 'furnaceAnneal', color: 'annealed' },     // program: CLIPS.furnaceProgram (actions/furnace_run.js)
      { n: 34, sec: 'E', block: 'fromFurnace' },
      { n: 35, sec: 'E', block: 'note', look: 'substrate', show: 2.5, text: 'Inspect: uniform reddish-brown to dark brown film, no cracks, no peeling. Ready for characterisation.' },
    ],
  });
})();
