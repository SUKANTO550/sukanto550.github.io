'use strict';

/* =========================================================
   MENU A: Equation/Func (Simul Equation, Polynomial)
   MENU B: Inequality
   MENU C: Ratio
   Everything lives in one IIFE so nothing clashes with the other
   mode files; the pure maths is exposed as EQN_MATH for testing.
   ========================================================= */

(() => {
  /* ======================= Maths ======================= */

  /* ---- linear systems: Gauss-Jordan with partial pivoting ----
     M: n rows of [a1 … an, rhs]. Returns { x } or { err }.        */
  function solveLinear(M) {
    const n = M.length;
    const A = M.map((r) => r.slice());
    const scale = Math.max(...A.flat().map(Math.abs), 1e-300);
    const tol = 1e-10 * scale;
    let row = 0;
    for (let col = 0; col < n && row < n; col++) {
      let p = row;
      for (let i = row + 1; i < n; i++) if (Math.abs(A[i][col]) > Math.abs(A[p][col])) p = i;
      if (Math.abs(A[p][col]) <= tol) continue; // no pivot in this column
      [A[row], A[p]] = [A[p], A[row]];
      const pv = A[row][col];
      for (let j = col; j <= n; j++) A[row][j] /= pv;
      for (let i = 0; i < n; i++) {
        if (i === row || A[i][col] === 0) continue;
        const f = A[i][col];
        for (let j = col; j <= n; j++) A[i][j] -= f * A[row][j];
      }
      row++;
    }
    if (row < n) {
      // rank deficient: the remaining rows have all-zero coefficients
      for (let i = row; i < n; i++) if (Math.abs(A[i][n]) > tol) return { err: 'No Solution' };
      return { err: 'Infinite Solution' };
    }
    const x = A.map((r) => tidy(r[n]));
    return x.every(Number.isFinite) ? { x } : { err: MATH };
  }

  /* ---- complex helpers ([re, im]) and polynomial evaluation ---- */
  const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cdiv = (a, b) => {
    const d = b[0] * b[0] + b[1] * b[1];
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
  };
  const cabs = (a) => Math.hypot(a[0], a[1]);
  // Horner; c = coefficients, highest power first
  function peval(c, z) {
    let r = [0, 0];
    for (const k of c) { r = cmul(r, z); r[0] += k; }
    return r;
  }
  const reval = (c, x) => c.reduce((r, k) => r * x + k, 0);
  const deriv = (c) => c.slice(0, -1).map((k, i) => k * (c.length - 1 - i));

  // Newton steps on polynomial c from z, kept only while |P| shrinks
  function polish(c, z, target = c) {
    const d = deriv(c);
    let best = z, bestR = cabs(peval(target, z));
    for (let it = 0; it < 30; it++) {
      const dz = peval(d, z);
      if (cabs(dz) === 0) break;
      const step = cdiv(peval(c, z), dz);
      z = [z[0] - step[0], z[1] - step[1]];
      const r = cabs(peval(target, z));
      if (r <= bestR) { best = z; bestR = r; } else if (it > 3) break;
      if (cabs(step) <= 1e-17 * Math.max(1, cabs(z))) break;
    }
    return best;
  }

  // snap a value to a nearby simple fraction when that does not worsen the residual
  function snapRoot(c, z) {
    const r0 = cabs(peval(c, z));
    const snap = (v) => {
      if (Number.isInteger(v)) return v;
      const q = ratApprox(v, 9999, 1e-9);
      return q ? q.p / q.q : v;
    };
    const s = [snap(z[0]), snap(z[1])];
    return cabs(peval(c, s)) <= r0 ? s : z;
  }

  /* ---- quadratic: closed form, with an exact "p ± √q" description ---- */
  function quadRoots(a, b, c) {
    let D = b * b - 4 * a * c;
    if (Math.abs(D) <= 1e-13 * (b * b + Math.abs(4 * a * c))) D = 0;
    const base = tidy(-b / (2 * a));
    if (D === 0) return [{ re: base, im: 0, m: 2 }];
    const half = Math.sqrt(Math.abs(D)) / (2 * Math.abs(a));
    if (D < 0) {
      const im = tidy(half);
      return [{ re: base, im, m: 1 }, { re: base, im: -im, m: 1 }];
    }
    // numerically stable pair
    const q = -(b + (b < 0 ? -1 : 1) * Math.sqrt(D)) / 2;
    let r = [q / a, c / q].map(tidy).sort((u, v) => v - u);
    return r.map((re, i) => ({ re, im: 0, m: 1, ex: { base, half, sg: i === 0 ? 1 : -1 } }));
  }

  // Durand-Kerner estimates for all roots; keeps the iterate with the smallest residual
  function durandKerner(a) {
    const n = a.length - 1;
    const R = Math.max(1, ...a.slice(1).map((v, i) => Math.pow(Math.abs(v), 1 / (i + 1))));
    const res = (zs) => Math.max(...zs.map((zi) => cabs(peval(a, zi))));
    let z = [];
    let w = [1, 0];
    for (let k = 0; k < n; k++) { z.push([w[0] * R, w[1] * R]); w = cmul(w, [0.4, 0.9]); }
    let best = z, bestR = res(z);
    for (let it = 0; it < 2000; it++) {
      let moved = 0;
      z = z.map((zi, i) => {
        let den = [1, 0];
        z.forEach((zj, j) => { if (j !== i) den = cmul(den, [zi[0] - zj[0], zi[1] - zj[1]]); });
        if (cabs(den) === 0) den = [1e-12, 1e-12];
        const step = cdiv(peval(a, zi), den);
        moved = Math.max(moved, cabs(step) / Math.max(1, cabs(zi)));
        return [zi[0] - step[0], zi[1] - step[1]];
      });
      const r = res(z);
      if (r < bestR) { best = z; bestR = r; }
      if (moved < 1e-16 || r === 0) break;
    }
    return best;
  }

  // roots of a monic polynomial a (degree >= 3) as [{ z, m }]
  function numericRoots(a) {
    const n = a.length - 1;
    const z = durandKerner(a);
    const size = a.reduce((s, v) => s + Math.abs(v), 0);
    const tiny = (w) => cabs(peval(a, w)) <= 1e-13 * size * Math.pow(Math.max(1, cabs(w)), n);
    // group repeated roots (Durand-Kerner spreads them out); a group is kept
    // only if its centre, polished as a simple root of the (m-1)th derivative, is a root
    const used = new Array(n).fill(false);
    const roots = [];
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const grp = [i];
      for (let j = i + 1; j < n; j++) {
        if (!used[j] && cabs([z[i][0] - z[j][0], z[i][1] - z[j][1]]) < 1e-2 * Math.max(1, cabs(z[i]))) grp.push(j);
      }
      const m = grp.length;
      let mean = [grp.reduce((s, g) => s + z[g][0], 0) / m, grp.reduce((s, g) => s + z[g][1], 0) / m];
      let d = a;
      for (let k = 1; k < m; k++) d = deriv(d);
      mean = polish(d, mean, a);
      if (m > 1 && !tiny(mean)) { // close but distinct roots: keep them apart
        used[i] = true;
        roots.push({ z: snapRoot(a, polish(a, z[i])), m: 1 });
        continue;
      }
      grp.forEach((g) => { used[g] = true; });
      roots.push({ z: snapRoot(a, mean), m });
    }
    return roots;
  }

  // synthetic division of c by (x - r)
  function deflate(c, r) {
    const out = [c[0]];
    for (let i = 1; i < c.length - 1; i++) out.push(c[i] + out[i - 1] * r);
    return out;
  }

  /* ---- all roots of a polynomial (degree 1-4, c[0] != 0) ----
     Rational roots are found first (snapped Durand-Kerner estimates, checked
     and divided out with their multiplicity), a remaining quadratic is solved
     in closed form, anything left numerically. Returns distinct roots
     {re, im, m}: real roots descending, then complex pairs (+i first).        */
  function polyRoots(c) {
    const n = c.length - 1;
    if (n === 1) return [{ re: tidy(-c[1] / c[0]), im: 0, m: 1 }];
    if (n === 2) return quadRoots(c[0], c[1], c[2]);
    let p = c.map((v) => v / c[0]);
    const found = [];
    const zero = (q, x) => Math.abs(reval(q, x)) <= 1e-12 * q.reduce((s, v) => s + Math.abs(v), 0) * Math.pow(Math.max(1, Math.abs(x)), q.length - 1);
    for (const z of durandKerner(p)) {
      if (p.length <= 3) break;
      if (Math.abs(z[1]) > 1e-2 * Math.max(1, cabs(z))) continue;
      const q = Number.isInteger(Math.round(z[0])) && Math.abs(z[0] - Math.round(z[0])) < 1e-2 ? { p: Math.round(z[0]), q: 1 } : ratApprox(z[0], 99, 1e-3);
      for (const x of q ? [q.p / q.q] : []) {
        let m = 0;
        while (p.length > 1 && zero(p, x)) { p = deflate(p, x); m++; }
        if (m) { found.push({ z: [x, 0], m }); break; }
      }
    }
    let rest = [];
    if (p.length === 2) rest = [{ z: [-p[1], 0], m: 1 }];
    else if (p.length === 3) {
      rest = quadRoots(1, p[1], p[2]);
      if (!found.length) return rest;
      rest = rest.map((r) => (r.ex ? { z: [r.re, r.im], m: r.m, ex: r.ex } : { z: [r.re, r.im], m: r.m }));
    } else if (p.length > 3) rest = numericRoots(p);
    // merge rational roots that also came out of the remainder
    const roots = [];
    for (const r of [...found, ...rest]) {
      const same = roots.find((o) => cabs([o.z[0] - r.z[0], o.z[1] - r.z[1]]) < 1e-9 * Math.max(1, cabs(r.z)));
      if (same) same.m += r.m; else roots.push(r);
    }
    // classify real / complex; complex roots come in conjugate pairs
    const isReal = ({ z: [re, im] }) => Math.abs(im) <= 1e-9 * Math.max(1, Math.abs(re));
    const out = roots.filter(isReal).map((r) => ({ re: tidy(r.z[0]), im: 0, m: r.m, ...(r.ex ? { ex: r.ex } : {}) }));
    out.sort((u, v) => v.re - u.re);
    const cpx = roots.filter((r) => !isReal(r) && r.z[1] > 0).sort((u, v) => v.z[0] - u.z[0]);
    for (const { z: [re, im], m } of cpx) {
      out.push({ re: tidy(re), im: tidy(im), m }, { re: tidy(re), im: -tidy(im), m });
    }
    return out;
  }

  /* ---- polynomial inequality ----
     rel: '>', '<', '>=', '<='. Returns { all } | { none } | { parts: [{lo, hi}] }
     where lo/hi are null (infinite) or { r: root, closed }.                       */
  function solveIneq(c, rel) {
    const rs = polyRoots(c).filter((r) => r.im === 0).sort((u, v) => u.re - v.re);
    const strict = rel === '>' || rel === '<';
    const want = rel[0] === '>' ? 1 : -1;
    const k = rs.length;
    // tokens in order: I0, R1, I1, R2, … Rk, Ik
    const toks = [];
    for (let i = 0; i <= k; i++) {
      const x = k === 0 ? 0 : i === 0 ? rs[0].re - 1 : i === k ? rs[k - 1].re + 1 : (rs[i - 1].re + rs[i].re) / 2;
      toks.push({ in: Math.sign(reval(c, x)) === want });
      if (i < k) toks.push({ in: !strict, r: rs[i] });
    }
    const parts = [];
    for (let i = 0; i < toks.length; i++) {
      if (!toks[i].in) continue;
      let j = i;
      while (j + 1 < toks.length && toks[j + 1].in) j++;
      if (i === 0 && j === toks.length - 1) return { all: true };
      // run i..j: even index = interval, odd = root
      const lo = i === 0 ? null : i % 2 ? { r: toks[i].r, closed: true } : { r: toks[i - 1].r, closed: false };
      const hi = j === toks.length - 1 ? null : j % 2 ? { r: toks[j].r, closed: true } : { r: toks[j + 1].r, closed: false };
      parts.push({ lo, hi });
      i = j;
    }
    return parts.length ? { parts } : { none: true };
  }

  /* ---- ratio: form 1 A:B=X:D, form 2 A:B=C:X ---- */
  function ratio(form, p, q, r) {
    const x = form === 1 ? (p * r) / q : (q * r) / p;
    return Number.isFinite(x) ? tidy(x) : null;
  }

  globalThis.EQN_MATH = { solveLinear, polyRoots, solveIneq, ratio };
  if (typeof registerApp !== 'function') return; // loaded for unit tests only

  /* ======================= Formatting ======================= */
  const I = '<i class="eq-i">i</i>';
  const dec = (v) => plainNum(v);
  const minus = (s) => s.replace(/-/g, '−');

  // exact HTML of one real number, or null (surds only when allowed)
  function exactPart(v, surd) {
    const e = exactOf(tidy(v));
    if (!e || e.k === 'pi' || (e.k === 'surd' && !surd)) return null;
    if (e.k === 'int') return minus(String(e.p));
    return exactHTML(e, false);
  }
  // "re ± im·i" from already formatted parts (imAbs = |im| html, '' for 1)
  const joinC = (reH, neg, imH) => (reH === null ? (neg ? '−' : '') : reH + (neg ? '−' : '+')) + imH + I;

  // root value as HTML; exact form when available and wanted
  function rootHTML(r, exact) {
    if (exact) {
      if (r.ex) {
        const b = exactPart(r.ex.base, false), h = exactPart(r.ex.half, true);
        if (b !== null && h !== null && /√/.test(h)) {
          return (r.ex.base === 0 ? (r.ex.sg < 0 ? '−' : '') : b + (r.ex.sg < 0 ? '−' : '+')) + h;
        }
      }
      if (r.im === 0) { const e = exactPart(r.re, true); if (e !== null) return e; }
      else {
        const re = r.re === 0 ? null : exactPart(r.re, true);
        const im = Math.abs(r.im) === 1 ? '' : exactPart(Math.abs(r.im), true);
        if ((r.re === 0 || re !== null) && im !== null) return joinC(re, r.im < 0, im);
      }
    }
    if (r.im === 0) return dec(r.re);
    return joinC(r.re === 0 ? null : dec(r.re), r.im < 0, Math.abs(r.im) === 1 ? '' : dec(Math.abs(r.im)));
  }
  // plain real result (simul / ratio): fractions only
  const valHTML = (v, exact) => (exact && exactPart(v, false)) || dec(v);
  // font class from the visible text length so long values still fit the LCD
  function fit(html, big = 14, mid = 20) {
    const n = html.replace(/<[^>]*>/g, '').length;
    return n <= big ? '' : n <= mid ? ' eq-s1' : ' eq-s2';
  }
  // compact cell text for the coefficient grid
  function cellText(v) {
    let s = String(+v.toPrecision(6));
    if (s.length > 7) s = v.toExponential(1).replace('e+', 'E').replace('e', 'E');
    return minus(s);
  }
  const sub = (n) => `<sub>${n}</sub>`;
  const supN = (n) => (n > 1 ? `<sup>${n}</sup>` : '');
  const LETTERS = 'abcde';
  const VARS = ['x', 'y', 'z', 't'];
  const REL = { '>': '&gt;', '<': '&lt;', '>=': '≥', '<=': '≤' };
  // "ax³+bx²+cx+d" for degree n
  const polyTpl = (n) => Array.from({ length: n + 1 }, (_, i) => LETTERS[i] + (i < n ? `<i>x</i>${supN(n - i)}` : '')).join('+');

  /* ======================= Shared editor =======================
     ed = { rows, cols, cells[], heads[], label(i), sel, buf, top }    */
  function newEditor(rows, cols, heads, label, old) {
    const cells = old && old.length === rows * cols ? old : new Array(rows * cols).fill(0);
    return { rows, cols, cells, heads, label, sel: 0, buf: null, top: 0 };
  }
  function commit(ed) {
    if (ed.buf === null) return;
    const v = entryValue(ed.buf);
    if (Number.isFinite(v)) ed.cells[ed.sel] = v;
    ed.buf = null;
  }
  // returns 'solve' when [=] is pressed without typing
  function editorKey(ed, id) {
    const nb = entryKey(ed.buf, id);
    if (nb !== undefined) { ed.buf = nb; return null; }
    const { rows, cols } = ed;
    const r = Math.floor(ed.sel / cols), c = ed.sel % cols;
    if (id === 'eq') {
      if (ed.buf === null) return 'solve';
      commit(ed);
      ed.sel = (ed.sel + 1) % (rows * cols);
    } else if (id === 'ac') ed.buf = null;
    else if (id === 'left') { commit(ed); ed.sel = r * cols + (c + cols - 1) % cols; }
    else if (id === 'right') { commit(ed); ed.sel = r * cols + (c + 1) % cols; }
    else if (id === 'up') { commit(ed); ed.sel = ((r + rows - 1) % rows) * cols + c; }
    else if (id === 'down') { commit(ed); ed.sel = ((r + 1) % rows) * cols + c; }
    return null;
  }
  function editorHTML(ed, tpl) {
    const vis = 3; // visible rows
    const r = Math.floor(ed.sel / ed.cols);
    if (r < ed.top) ed.top = r;
    if (r >= ed.top + vis) ed.top = r - vis + 1;
    let g = ed.heads.map((h) => `<div class="h">${h}</div>`).join('');
    for (let i = ed.top; i < Math.min(ed.rows, ed.top + vis); i++) {
      for (let j = 0; j < ed.cols; j++) {
        const k = i * ed.cols + j, on = k === ed.sel;
        const txt = on && ed.buf !== null ? minus(ed.buf) : cellText(ed.cells[k]);
        g += `<div class="${on ? 'on' : ''}">${txt}</div>`;
      }
    }
    const v = ed.cells[ed.sel];
    const cur = ed.buf !== null ? entryHTML(ed.buf) : valHTML(v, true);
    const arr = ed.rows > vis ? `<span class="arr">${ed.top > 0 ? '▲' : ''}${ed.top + vis < ed.rows ? '▼' : ''}</span>` : '';
    return (tpl ? `<div class="eq-tpl">${tpl}</div>` : '')
      + `<div class="eq-grid" style="grid-template-columns:repeat(${ed.cols},1fr)">${g}</div>`
      + `<div class="eq-cur">${ed.label(ed.sel)}=<span class="eq-v">${cur}</span></div>` + arr;
  }

  /* ======================= Shared result views ======================= */
  const errHTML = (msg) => `<div class="vr center big">${msg}</div><div class="hint">[AC] :Back</div>`;
  // one named value per screen, ▲▼ to step
  function stepHTML(items, sel, exact) {
    const it = items[sel];
    const v = it.html(exact);
    const arr = `<span class="arr">${sel > 0 ? '▲' : ''}${sel < items.length - 1 ? '▼' : ''}</span>`;
    return `<div class="eq-name">${it.name}=</div><div class="eq-big${fit(v)}">${v}</div>` + arr;
  }
  // result-screen keys common to A and C; returns 'back' to go to the editor
  function stepKey(st, id) {
    const n = st.res.items ? st.res.items.length : 0;
    if (id === 'sd') st.exact = !st.exact;
    else if (id === 'up' && n) st.rsel = Math.max(0, st.rsel - 1);
    else if (id === 'down' && n) st.rsel = Math.min(n - 1, st.rsel + 1);
    else if (id === 'eq' && n && st.rsel < n - 1) st.rsel++;
    else if (id === 'ac' || id === 'eq' || (!n && /^(up|down|left|right)$/.test(id))) return 'back';
    return null;
  }
  const startExact = () => S.cfg.io !== 'DecO';
  function sizeHTML(q) { return lines([q, 'Select 2~4']); }

  /* ======================= A: Equation/Func ======================= */
  const A = { stage: 'size', type: 'simul', n: 2, ed: null, res: null, rsel: 0, exact: true, saved: {} };

  function chooseTypeA(back) {
    openList([
      { label: 'Simul Equation', act: () => { A.type = 'simul'; A.stage = 'size'; } },
      { label: 'Polynomial', act: () => { A.type = 'poly'; A.stage = 'size'; } },
    ], { back });
  }
  function openEditorA(n) {
    A.n = n;
    const key = A.type + n;
    if (A.type === 'simul') {
      const heads = [...VARS.slice(0, n).map((v) => `<i>${v}</i>`), '='];
      A.ed = newEditor(n, n + 1, heads, (i) => LETTERS[i % (n + 1)] + sub(Math.floor(i / (n + 1)) + 1), A.saved[key]);
    } else {
      A.ed = newEditor(1, n + 1, LETTERS.slice(0, n + 1).split(''), (i) => LETTERS[i], A.saved[key]);
    }
    A.saved[key] = A.ed.cells;
    A.stage = 'edit';
  }
  function solveA() {
    const { ed, n } = A;
    A.rsel = 0;
    A.exact = startExact();
    A.stage = 'res';
    if (A.type === 'simul') {
      const M = [];
      for (let i = 0; i < n; i++) M.push(ed.cells.slice(i * (n + 1), (i + 1) * (n + 1)));
      const r = solveLinear(M);
      A.res = r.err ? r : { items: r.x.map((v, i) => ({ name: `<i>${VARS[i]}</i>`, html: (ex) => valHTML(v, ex) })) };
      return;
    }
    if (ed.cells[0] === 0) { A.res = { err: MATH }; return; }
    const roots = polyRoots(ed.cells);
    const one = roots.length === 1;
    A.res = { items: roots.map((r, i) => ({ name: `<i>x</i>${one ? '' : sub(i + 1)}`, html: (ex) => rootHTML(r, ex) })) };
  }

  registerApp('A', {
    name: 'Equation/Func',
    enter() { S.screen = 'app'; A.stage = 'size'; chooseTypeA(openMenu); },
    key(id) {
      if (id === 'optn' && A.stage !== 'size') { chooseTypeA(null); return; }
      if (A.stage === 'size') {
        const k = keyNum(id);
        if (k >= 2 && k <= 4) openEditorA(k);
        else if (id === 'ac') chooseTypeA(openMenu);
      } else if (A.stage === 'edit') {
        if (editorKey(A.ed, id) === 'solve') solveA();
      } else if (stepKey(A, id) === 'back') A.stage = 'edit';
    },
    render() {
      if (A.stage === 'size') return sizeHTML(A.type === 'simul' ? 'Number of Unknowns?' : 'Polynomial Degree?');
      if (A.stage === 'edit') return editorHTML(A.ed, A.type === 'poly' ? polyTpl(A.n) + '=0' : '');
      return A.res.err ? errHTML(A.res.err) : stepHTML(A.res.items, A.rsel, A.exact);
    },
  });

  /* ======================= B: Inequality ======================= */
  const B = { stage: 'size', n: 2, rel: '>', ed: null, res: null, exact: true, saved: {} };
  const RELS = ['>', '<', '>=', '<='];

  function chooseFormB(n) {
    openList(RELS.map((rel) => ({
      label: polyTpl(n) + REL[rel] + '0',
      act: () => {
        B.n = n; B.rel = rel;
        B.ed = newEditor(1, n + 1, LETTERS.slice(0, n + 1).split(''), (i) => LETTERS[i], B.saved[n]);
        B.saved[n] = B.ed.cells;
        B.stage = 'edit';
      },
    })));
  }
  // "a<x≤b" style text for one part of the solution set
  function partHTML(p, exact) {
    const x = '<i>x</i>';
    const op = (b) => (b.closed ? '≤' : '&lt;');
    const v = (b) => rootHTML(b.r, exact);
    if (p.lo && p.hi && p.lo.closed && p.hi.closed && p.lo.r === p.hi.r) return `${x}=${v(p.lo)}`;
    return (p.lo ? v(p.lo) + op(p.lo) : '') + x + (p.hi ? op(p.hi) + v(p.hi) : '');
  }
  function resultB() {
    const r = B.res;
    if (r.err) return errHTML(r.err);
    if (r.all) return '<div class="eq-sol">All Real Numbers</div>';
    if (r.none) return '<div class="eq-sol">No Solution</div>';
    const parts = r.parts.map((p) => partHTML(p, B.exact));
    const longest = parts.reduce((a, p) => (p.replace(/<[^>]*>/g, '').length > a.length ? p.replace(/<[^>]*>/g, '') : a), '');
    return `<div class="eq-sol${fit(longest, 16, 22)}">${parts.map((p, i) => `<span>${p}${i < parts.length - 1 ? ',' : ''}</span>`).join('')}</div>`;
  }

  registerApp('B', {
    name: 'Inequality',
    enter() { S.screen = 'app'; B.stage = 'size'; },
    key(id) {
      if (B.stage === 'size') {
        const k = keyNum(id);
        if (k >= 2 && k <= 4) chooseFormB(k);
        else if (id === 'ac') openMenu();
      } else if (id === 'optn') B.stage = 'size';
      else if (B.stage === 'edit') {
        if (editorKey(B.ed, id) !== 'solve') return;
        const c = B.ed.cells;
        B.res = c[0] === 0 ? { err: MATH } : solveIneq(c, B.rel);
        B.exact = startExact();
        B.stage = 'res';
      } else if (id === 'sd') B.exact = !B.exact;
      else if (id === 'ac' || id === 'eq') B.stage = 'edit';
    },
    render() {
      if (B.stage === 'size') return sizeHTML('Polynomial Degree?');
      if (B.stage === 'edit') return editorHTML(B.ed, polyTpl(B.n) + REL[B.rel] + '0');
      return resultB();
    },
  });

  /* ======================= C: Ratio ======================= */
  const C = { stage: 'edit', form: 1, ed: null, res: null, rsel: 0, exact: true, saved: {} };
  const RATIO_TPL = { 1: 'A:B=X:D', 2: 'A:B=C:X' };

  function chooseFormC(back) {
    openList([1, 2].map((form) => ({
      label: RATIO_TPL[form],
      act: () => {
        C.form = form;
        const names = form === 1 ? ['A', 'B', 'D'] : ['A', 'B', 'C'];
        C.ed = newEditor(1, 3, names, (i) => names[i], C.saved[form]);
        C.saved[form] = C.ed.cells;
        C.stage = 'edit';
      },
    })), { back });
  }

  registerApp('C', {
    name: 'Ratio',
    enter() { S.screen = 'app'; C.ed = null; chooseFormC(openMenu); },
    key(id) {
      if (!C.ed) { if (id === 'ac') openMenu(); return; }
      if (id === 'optn') { chooseFormC(null); return; }
      if (C.stage === 'edit') {
        if (editorKey(C.ed, id) !== 'solve') return;
        const x = ratio(C.form, ...C.ed.cells);
        C.res = x === null ? { err: MATH } : { items: [{ name: 'X', html: (ex) => valHTML(x, ex) }] };
        C.rsel = 0;
        C.exact = startExact();
        C.stage = 'res';
      } else if (stepKey(C, id) === 'back') C.stage = 'edit';
    },
    render() {
      if (!C.ed) return '';
      if (C.stage === 'edit') return editorHTML(C.ed, RATIO_TPL[C.form]);
      return C.res.err ? errHTML(C.res.err) : stepHTML(C.res.items, 0, C.exact);
    },
  });

  /* ======================= Styles ======================= */
  document.head.insertAdjacentHTML('beforeend', `<style>
.panel .eq-tpl { font-size: .72em; line-height: calc(40 * var(--s)); white-space: nowrap; overflow: hidden; }
.panel .eq-tpl sup, .panel .eq-sol sup { font-size: .6em; line-height: 0; }
.panel .eq-grid { display: grid; font-size: .72em; line-height: calc(37 * var(--s)); margin-right: calc(16 * var(--s)); }
.panel .eq-grid > div { text-align: right; padding: 0 calc(6 * var(--s)); overflow: hidden; white-space: nowrap; }
.panel .eq-grid > .h { text-align: center; border-bottom: calc(2 * var(--s)) solid var(--lcd-ink); }
.panel .eq-grid > .on { background: var(--lcd-ink); color: var(--lcd-1); }
.panel .eq-cur { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: baseline; white-space: nowrap; }
.panel .eq-cur .eq-v { margin-left: auto; }
.panel .eq-cur sub, .panel .eq-name sub { font-size: .6em; line-height: 0; }
.panel .eq-name { line-height: calc(60 * var(--s)); }
.panel .eq-big { text-align: right; white-space: nowrap; font-size: 1.1em; margin-top: calc(24 * var(--s)); }
.panel .eq-sol { display: flex; flex-wrap: wrap; column-gap: .45em; margin-top: calc(10 * var(--s)); }
.panel .eq-sol > span { white-space: nowrap; }
.panel .eq-big .nd-frac.r { font-size: .8em; }
.panel .eq-s1 { font-size: .85em; }
.panel .eq-s2 { font-size: .68em; }
.panel .eq-i { font-family: "Times New Roman", serif; }
</style>`);
})();
