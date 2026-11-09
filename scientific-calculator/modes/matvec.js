'use strict';

/* =========================================================
   MENU 4: Matrix and MENU 5: Vector.
   Both apps share one flow: Define (pick A-D) -> size prompt ->
   cell editor -> [AC] -> calculation screen, where OPTN inserts
   MatA / VctA ... and the special functions. The values are new
   engine types (TYPES.matrix / TYPES.vector), so the normal
   expression parser does the rest.
   ========================================================= */

(() => { // private scope: keeps helper names out of the shared global scope

document.head.insertAdjacentHTML('beforeend', `<style>
.mx-m { flex: none; display: inline-flex; align-items: stretch; vertical-align: middle; line-height: 1.2; }
.mx-b { flex: none; width: .22em; border: calc(3 * var(--s)) solid var(--lcd-ink); }
.mx-b.l { border-right: none; }
.mx-b.r { border-left: none; }
.mx-g { display: inline-grid; column-gap: .15em; padding: .04em .08em; }
.mx-c { display: flex; align-items: center; justify-content: flex-end; min-width: 1.1em; padding: 0 .15em; white-space: nowrap; }
.mx-c.on { background: var(--lcd-ink); color: var(--lcd-1); }
.mx-c .nd-frac.r { font-size: .6em; }
.mx-c.on .nd-frac > .num { border-color: var(--lcd-1); }
.mx-res { display: inline-flex; align-items: center; gap: .3em; }
.mx-res .mx-m { line-height: 1.05; }
.mx-res .mx-g { padding: 0 .08em; }
.mx-lbl { font-size: calc(30 * var(--s)); }
.mx-ed { position: absolute; inset: 0; }
.mx-name { position: absolute; left: 0; top: 0; font-size: .6em; line-height: 1.2; }
.mx-wrap { display: flex; justify-content: center; padding-top: calc(4 * var(--s)); }
.mx-val { position: absolute; right: 0; bottom: 0; white-space: nowrap; }
</style>`);

const DIM_ERR = 'Dimension ERROR';

/* ---------- number display inside a matrix / vector ---------- */
// exact fraction when Math output recognises a simple rational, else a short decimal
function mvCell(v, exact) {
  if (isInt(v) && Math.abs(v) < 1e7) return String(v).replace('-', '−');
  if (exact && S.cfg.io === 'MathO') {
    const e = exactOf(v);
    if (e && e.k === 'rat' && e.q <= 999 && Math.abs(e.p) < 1e5) return exactHTML(e, false);
  }
  return plainNum(+v.toPrecision(6));
}
// full value (editor bottom line)
function mvBig(v) {
  if (S.cfg.io === 'MathO' && !isInt(v)) {
    const e = exactOf(v);
    if (e && e.k === 'rat') return exactHTML(e, false);
  }
  return plainNum(v);
}
// rows: array of number arrays; sel = [r, c] highlighted cell (editor: short decimals) or null (result: fractions)
function gridHTML(rows, sel) {
  const cells = rows.map((r, i) => r.map((v, j) => {
    const on = sel && sel[0] === i && sel[1] === j;
    return `<span class="mx-c${on ? ' on' : ''}">${mvCell(v, !sel)}</span>`;
  }).join('')).join('');
  return `<span class="mx-m"><span class="mx-b l"></span>`
    + `<span class="mx-g" style="grid-template-columns:repeat(${rows[0].length},auto)">${cells}</span>`
    + `<span class="mx-b r"></span></span>`;
}
// result area ("MatAns=" + grid), scaled down to fit the result line
function resultHTML(label, rows) {
  // the result line is only about 94 units tall: fit all rows (fraction rows are taller)
  const frac = S.cfg.io === 'MathO';
  const ems = rows.reduce((h, r) => h + (frac && r.some((v) => !isInt(v)) ? 1.45 : 1.08), 0);
  const size = Math.min(44, Math.floor(88 / ems));
  return `<span class="mx-res" style="font-size:calc(${size} * var(--s))">`
    + `<span class="mx-lbl">${label}</span>${gridHTML(rows, null)}</span>`;
}

/* ---------- matrix maths ---------- */
const mat = (rows) => ({ type: 'matrix', r: rows.length, c: rows[0].length, a: rows.map((r) => r.map(tidy)) });
const isMat = (v) => typeOf(v) === 'matrix';
const mapMat = (m, f) => mat(m.a.map((r) => r.map(f)));
const identity = (n) => mat(Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));

function matMul(x, y) {
  if (x.c !== y.r) throw DIM_ERR;
  return mat(x.a.map((row) => y.a[0].map((_, j) => row.reduce((s, v, k) => s + v * y.a[k][j], 0))));
}
function matAddSub(x, y, sign) {
  if (!isMat(x) || !isMat(y)) throw MATH;
  if (x.r !== y.r || x.c !== y.c) throw DIM_ERR;
  return mat(x.a.map((r, i) => r.map((v, j) => v + sign * y.a[i][j])));
}
function det(m) {
  if (m.r !== m.c) throw DIM_ERR;
  const a = m.a.map((r) => r.slice());
  const n = m.r;
  let d = 1;
  for (let k = 0; k < n; k++) {
    let p = k; // partial pivoting
    for (let i = k + 1; i < n; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
    if (a[p][k] === 0) return 0;
    if (p !== k) { [a[p], a[k]] = [a[k], a[p]]; d = -d; }
    d *= a[k][k];
    for (let i = k + 1; i < n; i++) {
      const f = a[i][k] / a[k][k];
      for (let j = k; j < n; j++) a[i][j] -= f * a[k][j];
    }
  }
  return tidy(d);
}
// Gauss-Jordan on [M | I]
function inverse(m) {
  if (m.r !== m.c) throw DIM_ERR;
  const n = m.r;
  const scale = Math.max(...m.a.flat().map(Math.abs)) || 1;
  const a = m.a.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
    if (Math.abs(a[p][k]) < 1e-12 * scale) throw MATH; // singular
    [a[p], a[k]] = [a[k], a[p]];
    const pv = a[k][k];
    for (let j = 0; j < 2 * n; j++) a[k][j] /= pv;
    for (let i = 0; i < n; i++) {
      if (i === k || a[i][k] === 0) continue;
      const f = a[i][k];
      for (let j = 0; j < 2 * n; j++) a[i][j] -= f * a[k][j];
    }
  }
  return mat(a.map((r) => r.slice(n)));
}
function matPow(m, e) {
  if (typeof e !== 'number' || !isMat(m) || !isInt(e)) throw MATH;
  if (m.r !== m.c) throw DIM_ERR;
  if (Math.abs(e) > 99) throw MATH;
  let base = e < 0 ? inverse(m) : m;
  let r = identity(m.r);
  for (let k = 0; k < Math.abs(e); k++) r = matMul(r, base);
  return r;
}

TYPES.matrix = {
  add: (a, b) => matAddSub(a, b, 1),
  sub: (a, b) => matAddSub(a, b, -1),
  mul: (a, b) => {
    if (typeof a === 'number' && isMat(b)) return mapMat(b, (v) => a * v);
    if (isMat(a) && typeof b === 'number') return mapMat(a, (v) => v * b);
    if (isMat(a) && isMat(b)) return matMul(a, b);
    throw MATH;
  },
  div: (a, b) => {
    if (isMat(a) && typeof b === 'number' && b !== 0) return mapMat(a, (v) => v / b);
    throw MATH;
  },
  neg: (a) => mapMat(a, (v) => -v),
  pow: matPow,
  // unary functions by display name; undefined -> Math ERROR
  fn: (name, m) => ({
    '⁻¹': () => inverse(m),
    Abs: () => mapMat(m, Math.abs),
    'Det(': () => det(m),
    'Trn(': () => mat(m.a[0].map((_, j) => m.a.map((r) => r[j]))),
  }[name] || (() => undefined))(),
  check: (m) => { if (!m.a.flat().every(Number.isFinite)) throw MATH; },
  html: (m) => { MAT.ans = m; return resultHTML('MatAns=', m.a); },
};

/* ---------- vector maths ---------- */
const vec = (a) => ({ type: 'vector', a: a.map(tidy) });
const isVec = (v) => typeOf(v) === 'vector';
const dot = (x, y) => {
  if (!isVec(x) || !isVec(y)) throw MATH;
  if (x.a.length !== y.a.length) throw DIM_ERR;
  return tidy(x.a.reduce((s, v, i) => s + v * y.a[i], 0));
};
const norm = (x) => Math.sqrt(x.a.reduce((s, v) => s + v * v, 0));
function cross(x, y) {
  if (x.a.length !== y.a.length) throw DIM_ERR;
  const [a1, a2, a3 = 0] = x.a, [b1, b2, b3 = 0] = y.a; // 2-D: z = 0
  return vec([a2 * b3 - a3 * b2, a3 * b1 - a1 * b3, a1 * b2 - a2 * b1]);
}
function vecAddSub(x, y, sign) {
  if (!isVec(x) || !isVec(y)) throw MATH;
  if (x.a.length !== y.a.length) throw DIM_ERR;
  return vec(x.a.map((v, i) => v + sign * y.a[i]));
}
function angle(x, y) {
  if (!isVec(x) || !isVec(y)) throw MATH;
  const n = norm(x) * norm(y);
  if (n === 0) throw MATH;
  return fromRad(Math.acos(Math.max(-1, Math.min(1, dot(x, y) / n))));
}

TYPES.vector = {
  add: (a, b) => vecAddSub(a, b, 1),
  sub: (a, b) => vecAddSub(a, b, -1),
  mul: (a, b) => {
    if (typeof a === 'number' && isVec(b)) return vec(b.a.map((v) => a * v));
    if (isVec(a) && typeof b === 'number') return vec(a.a.map((v) => v * b));
    if (isVec(a) && isVec(b)) return cross(a, b);
    throw MATH;
  },
  div: (a, b) => {
    if (isVec(a) && typeof b === 'number' && b !== 0) return vec(a.a.map((v) => v / b));
    throw MATH;
  },
  neg: (a) => vec(a.a.map((v) => -v)),
  fn: (name, x) => {
    if (name === 'Abs') return norm(x);
    if (name === 'UnitV(') { const n = norm(x); if (n === 0) throw MATH; return vec(x.a.map((v) => v / n)); }
    return undefined;
  },
  check: (x) => { if (!x.a.every(Number.isFinite)) throw MATH; },
  html: (x) => { VCT.ans = x; return resultHTML('VctAns=', x.a.map((v) => [v])); },
};

/* ---------- shared app: define -> size -> editor -> calculation screen ----------
   cfg: { key, title ('Matrix'), pre ('Mat'), type, sizes(name) -> prompts, make(dims), rows(v), from(rows), tokens } */
const CONT = ['add', 'sub', 'mul', 'div', 'inv', 'sq', 'pow']; // operators that continue from Ans
function arrayApp(cfg) {
  const st = {
    store: { A: null, B: null, C: null, D: null },
    ans: null,
    view: 'define',   // define | editsel | size | edit | ans (MatAns / VctAns viewer)
    name: 'A',
    dims: [],         // answers to the size prompts so far
    sel: [0, 0], buf: null,
    sto: false,       // STO pressed: next A-D key copies the shown contents
  };
  const label = (n) => cfg.pre + n;
  const valTok = (n) => ({ d: label(n), t: 'const', v: () => { if (!st.store[n]) throw MATH; return st.store[n]; } });
  const ansTok = { d: cfg.pre + 'Ans', t: 'const', v: () => { if (!st.ans) throw MATH; return st.ans; } };

  const toApp = (view) => { st.view = view; S.screen = 'app'; };
  const toCalc = () => { st.buf = null; S.screen = 'calc'; };

  // after a matrix/vector result, operators continue from MatAns / VctAns (like Ans for numbers)
  function continueFromAns() {
    newExpr();
    insertItem(ansTok);
    S.done = false;
    S.error = S.note = S.fact = null;
  }
  function insTok(tok) {
    if (S.done && typeOf(S.ans) === cfg.type && (tok.t === 'op' || tok.t === 'post')) continueFromAns();
    ins(tok);
  }

  function openEditor(n) {
    st.name = n; st.sel = [0, 0]; st.buf = null;
    toApp('edit');
  }
  function pick(n) {
    if (st.view === 'editsel' && st.store[n]) { openEditor(n); return; }
    st.name = n; st.dims = [];
    st.view = 'size';
  }

  // commit the typed number into the selected cell
  function commit() {
    if (st.buf === null) return true;
    const v = entryValue(st.buf);
    if (!Number.isFinite(v)) return false;
    const rows = cfg.rows(st.store[st.name]);
    rows[st.sel[0]][st.sel[1]] = v;
    st.store[st.name] = cfg.from(rows);
    st.buf = null;
    return true;
  }
  function editKey(id) {
    const rows = cfg.rows(st.store[st.name]);
    const R = rows.length, C = rows[0].length;
    const nb = entryKey(st.buf, id);
    if (nb !== undefined) { st.buf = nb; return; }
    const [r, c] = st.sel;
    if (id === 'eq') {
      if (!commit()) return;
      st.sel = c < C - 1 ? [r, c + 1] : r < R - 1 ? [r + 1, 0] : [r, c]; // next cell, row by row
    } else if (id === 'ac') {
      if (st.buf !== null) st.buf = null; else toCalc();
    } else if (['up', 'down', 'left', 'right'].includes(id)) {
      commit();
      st.buf = null;
      if (id === 'up') st.sel = [Math.max(0, r - 1), c];
      if (id === 'down') st.sel = [Math.min(R - 1, r + 1), c];
      if (id === 'left') st.sel = [r, Math.max(0, c - 1)];
      if (id === 'right') st.sel = [r, Math.min(C - 1, c + 1)];
    }
  }

  // STO + letter key (alpha layer of (−) °'" x⁻¹ sin) -> copy to MatA-D / VctA-D
  const STO_KEYS = { neg: 'A', dms: 'B', inv: 'C', sin: 'D' };
  function stoKey(id) {
    st.sto = false;
    const n = STO_KEYS[id];
    if (!n) return;
    if (st.view === 'edit' && !commit()) return;
    st.store[n] = st.view === 'ans' ? st.ans : st.store[st.name];
    openEditor(n);
  }

  // result viewer: arrows browse, operators continue the calculation from MatAns / VctAns
  function ansKey(id, mods) {
    const rows = cfg.rows(st.ans);
    const [r, c] = st.sel;
    if (id === 'up') st.sel = [Math.max(0, r - 1), c];
    else if (id === 'down') st.sel = [Math.min(rows.length - 1, r + 1), c];
    else if (id === 'left') st.sel = [r, Math.max(0, c - 1)];
    else if (id === 'right') st.sel = [r, Math.min(rows[0].length - 1, c + 1)];
    else if (id === 'ac') toCalc();
    else if (CONT.includes(id) && (!mods.shift || id === 'sq')) {
      toCalc();
      continueFromAns();
      S.shift = mods.shift; // SHIFT x² = x³
      press(KEYS[id]);
    }
  }
  function showAns() {
    st.ans = S.ans; st.sel = [0, 0];
    toApp('ans');
  }

  function key(id, mods = {}) {
    const k = keyNum(id);
    if (st.view === 'edit' || st.view === 'ans') {
      if (st.sto) { stoKey(id); S.sto = false; return; }
      if (id === 'sto' && !mods.shift && !mods.alpha) { st.sto = true; S.sto = true; return; }
      if (st.view === 'ans') { ansKey(id, mods); return; }
    }
    if (st.view === 'define' || st.view === 'editsel') {
      if (k >= 1 && k <= 4) pick('ABCD'[k - 1]);
      else if (id === 'ac') toCalc();
    } else if (st.view === 'size') {
      const p = cfg.sizes[st.dims.length];
      if (k >= p.min && k <= p.max) {
        st.dims.push(k);
        if (st.dims.length === cfg.sizes.length) { st.store[st.name] = cfg.make(st.dims); openEditor(st.name); }
      } else if (id === 'ac') st.view = 'define';
    } else if (st.view === 'edit') editKey(id);
  }

  function render() {
    if (st.view === 'define' || st.view === 'editsel') {
      const sp = '&nbsp;&nbsp;&nbsp;';
      return lines([`${st.view === 'define' ? 'Define' : 'Edit'} ${cfg.title}`,
        `1:${label('A')}${sp}2:${label('B')}`, `3:${label('C')}${sp}4:${label('D')}`]);
    }
    if (st.view === 'size') {
      const p = cfg.sizes[st.dims.length];
      return lines([label(st.name), p.q, `Select ${p.min}~${p.max}`]);
    }
    // editor / result viewer
    const ans = st.view === 'ans';
    const rows = cfg.rows(ans ? st.ans : st.store[st.name]);
    const font = [0, 42, 42, 36, 30][rows.length];
    const v = rows[st.sel[0]][st.sel[1]];
    const val = st.buf !== null ? entryHTML(st.buf) : mvBig(v);
    return `<div class="mx-ed"><div class="mx-name">${ans ? cfg.pre + 'Ans=' : label(st.name)}</div>`
      + `<div class="mx-wrap" style="font-size:calc(${font} * var(--s))">${gridHTML(rows, st.sel)}</div>`
      + `<div class="mx-val">${val}</div></div>`;
  }

  // OPTN on the calculation screen
  function optn() {
    const items = [
      { label: `Define ${cfg.title}`, act: () => toApp('define') },
      { label: `Edit ${cfg.title}`, act: () => toApp('editsel') },
      ...'ABCD'.split('').map((n) => ({ label: label(n), act: () => insTok(valTok(n)) })),
      { label: cfg.pre + 'Ans', act: () => insTok(ansTok) },
      ...cfg.tokens.map(([lab, tok]) => ({ label: lab, act: () => insTok(tok) })),
    ];
    openList(items);
  }

  const app = {
    name: cfg.title,
    indicator: () => cfg.ind,
    enter: () => { st.buf = null; toApp('define'); },
    leave: () => { if (typeOf(S.ans) === cfg.type) S.ans = 0; },
    key,
    render,
    calcKey: (id, mods) => {
      if (id === 'optn' && !mods.shift) { optn(); return true; }
      if (id === 'eq') { // [=] / SHIFT [=] (≈): matrix / vector results open the MatAns screen
        if (mods.shift) approx(); else equals();
        if (S.done && typeOf(S.ans) === cfg.type) showAns();
        return true;
      }
      if (S.done && typeOf(S.ans) === cfg.type && CONT.includes(id) && (!mods.shift || id === 'sq')) continueFromAns();
      return false; // let the normal key action run
    },
  };
  registerApp(cfg.key, app);
  return st;
}

/* ---------- the two apps ---------- */
const MAT = arrayApp({
  key: '4', title: 'Matrix', pre: 'Mat', type: 'matrix', ind: 'MAT',
  sizes: [{ q: 'Number of Rows?', min: 1, max: 4 }, { q: 'Number of Columns?', min: 1, max: 4 }],
  make: ([r, c]) => mat(Array.from({ length: r }, () => Array(c).fill(0))),
  rows: (m) => m.a.map((r) => r.slice()),
  from: (rows) => mat(rows),
  tokens: [
    ['Determinant', { d: 'Det(', t: 'func', f: (x) => x }],
    ['Transposition', { d: 'Trn(', t: 'func', f: (x) => x }],
    ['Identity', {
      d: 'Identity(', t: 'func',
      f: (n) => { if (!isInt(n) || n < 1 || n > 4) throw MATH; return identity(n); },
    }],
  ],
});

const VCT = arrayApp({
  key: '5', title: 'Vector', pre: 'Vct', type: 'vector', ind: 'VCT',
  sizes: [{ q: 'Dimension?', min: 2, max: 3 }],
  make: ([n]) => vec(Array(n).fill(0)),
  rows: (v) => v.a.map((x) => [x]), // column vector
  from: (rows) => vec(rows.map((r) => r[0])),
  tokens: [
    ['Dot Product', { d: '•', t: 'op', op: 'custom', level: 'mul', f: dot }],
    ['Angle', {
      d: 'Angle(', t: 'func', multi: true,
      f: (...args) => { if (args.length !== 2) throw SYNTAX; return angle(...args); },
    }],
    ['Unit Vector', { d: 'UnitV(', t: 'func', f: () => { throw MATH; } }],
  ],
});
})();
