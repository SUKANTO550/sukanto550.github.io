'use strict';

/* Web Worker that hosts Pyodide + SymPy, so the calculator never freezes.
   Everything is loaded from the local calculus/pyodide/ folder (no CDN).
   Messages in : { id, op: 'init' }  |  { id, op: 'integrate', expr: 'x**2*sin(x)' }
                 Series: { id, op: 'taylor', expr, a, n, needTerms } | { op: 'sum', expr, lo, hi }
                         { op: 'sumexp', expr, lo } | { op: 'firstterms', coeffs: JSON list }
                 Algebra: { id, op: 'factor' | 'simplify' | 'apart', expr }
   Messages out: { id, ok: true, data }  |  { id, ok: false, error }
                 { op: 'status', status: 'loading' | 'ready' }                    */

const BASE = new URL('./pyodide/', self.location.href).href;
let boot = null;

function start() {
  if (boot) return boot;
  boot = (async () => {
    self.postMessage({ op: 'status', status: 'loading' });
    importScripts(BASE + 'pyodide.js');
    const py = await self.loadPyodide({ indexURL: BASE });
    await py.loadPackage(['sympy'], { messageCallback: () => {} });
    const src = await (await fetch(new URL('./cas.py', self.location.href))).text();
    py.runPython(src);
    self.postMessage({ op: 'status', status: 'ready' });
    return py;
  })();
  return boot;
}

self.onmessage = async (e) => {
  const { id, op, expr, a, n, lo } = e.data;
  try {
    const py = await start();
    if (op === 'init') { self.postMessage({ id, ok: true, data: null }); return; }
    if (op === 'integrate') {
      const out = py.globals.get('cas_integrate')(expr);
      self.postMessage({ id, ok: true, data: JSON.parse(out) });
      return;
    }
    // MENU D: Series. Each op maps to a cas.py function returning JSON.
    const SERIES_OPS = {
      taylor: () => py.globals.get('cas_taylor')(expr, a, n, !!e.data.needTerms),
      sum: () => py.globals.get('cas_sum')(expr, lo, e.data.hi),
      sumexp: () => py.globals.get('cas_sumexp')(expr, lo),
      firstterms: () => py.globals.get('cas_firstterms')(e.data.coeffs),
      // MENU E: Algebra
      factor: () => py.globals.get('cas_factor')(expr),
      simplify: () => py.globals.get('cas_simplify')(expr),
      apart: () => py.globals.get('cas_apart')(expr),
    };
    if (SERIES_OPS[op]) {
      self.postMessage({ id, ok: true, data: JSON.parse(SERIES_OPS[op]()) });
      return;
    }
    self.postMessage({ id, ok: false, error: 'unknown op' });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
