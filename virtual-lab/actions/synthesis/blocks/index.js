/* SYNTHESIS — list of block files (loaded in this order).
   New block family: make blocks/block_<name>.js (copy any small one, e.g. block_note.js), each block
   registered with SYNTH.block('name', { text(p, R), play: async (p, S) => {...} }), then add its file
   name here. index.html is never touched. */
SYNTH.load(SYNTH.here(), [
  'block_prep.js',        // washAll
  'block_vessel.js',      // takeFlask
  'block_liquid.js',      // pipetteAdd
  'block_solid.js',       // weighAdd
  'block_stir.js',        // stir, cool
  'block_filter.js',      // syringeFilter, sealVial
  'block_age.js',         // ageStart, ageEnd
  'block_substrate.js',   // cutSlide, markPieces, bathClean, toEthanol, coverDish
  'block_spin.js',        // spinPrep, chuckLoad, spinPrewet, spinLayer
  'block_hotplate.js',    // hotStage, fullLayer
  'block_anneal.js',      // toFurnace, furnaceAnneal, fromFurnace
  'block_note.js',        // note
]);
