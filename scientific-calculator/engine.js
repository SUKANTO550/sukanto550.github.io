'use strict';

/* =========================================================
   Engine: state, Natural-Display expression tree, evaluation,
   exact-result recognition and number formatting.
   ========================================================= */

const MATH = 'Math ERROR';
const SYNTAX = 'Syntax ERROR';

const DEFAULT_CFG = () => ({
  io: 'MathO',                 // 'MathO' (exact results) | 'DecO' (decimal results)
  angle: 'D',                  // D | R | G
  fmt: { type: 'Norm', n: 1 }, // Fix 0-9 | Sci 0-9 | Norm 1-2
  engSym: false,
  fracRes: 'dc',               // 'abc' mixed | 'dc' improper
  decMark: '.',
  digitSep: false,
  contrast: 5,
  calc: 'def',                 // SETUP Calculus: 'def' (definite) | 'indef' (indefinite, symbolic); not saved, so every start is 'def'
});

const S = {
  root: null, cur: null,       // expression tree + cursor {row, idx}
  ans: 0, mem: 0,
  vars: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, x: 0, y: 0 },
  shift: false, alpha: false, sto: false,
  done: false, error: null, note: null, fact: null,
  view: 'exact', mixed: false, exactOK: false, engExp: null,
  power: true,
  history: [], hIdx: 0, undo: [],
  screen: 'calc',              // calc | menu | setup | msg
  menuSel: 0, menuTop: 0,
  setup: { page: 0, sub: null, fmtType: null },
  msg: null,
  solve: null,                 // SOLVE / CALC prompt state
  app: null,                   // active extra mode (menu key), see screens.js
  list: null,                  // numbered option list state
  cfg: DEFAULT_CFG(),
};

/* ---------- Math helpers ---------- */
const toRad = (x) => (S.cfg.angle === 'D' ? x * Math.PI / 180 : S.cfg.angle === 'G' ? x * Math.PI / 200 : x);
const fromRad = (x) => (S.cfg.angle === 'D' ? x * 180 / Math.PI : S.cfg.angle === 'G' ? x * 200 / Math.PI : x);
const clean = (x) => (Math.abs(x) < 1e-14 ? 0 : x);
const isInt = (n) => Number.isInteger(n);

function factorial(n) {
  if (n < 0 || !isInt(n) || n > 170) return NaN;
  let r = 1;
  for (let k = 2; k <= n; k++) r *= k;
  return r;
}
function nPr(n, r) {
  if (!isInt(n) || !isInt(r) || n < 0 || r < 0 || r > n) return NaN;
  let p = 1;
  for (let k = 0; k < r; k++) p *= n - k;
  return p;
}
function nCr(n, r) {
  if (!isInt(n) || !isInt(r) || n < 0 || r < 0 || r > n) return NaN;
  r = Math.min(r, n - r);
  let c = 1;
  for (let k = 1; k <= r; k++) c = c * (n - r + k) / k;
  return Math.round(c);
}
function xroot(n, x) {
  if (n === 0) return NaN;
  if (x < 0 && isInt(n) && Math.abs(n) % 2 === 1) return -Math.pow(-x, 1 / n);
  return Math.pow(x, 1 / n);
}
function power(b, e) {
  // allow odd roots of negatives written as fractional powers, e.g. (-8)^(1/3)
  if (b < 0 && !isInt(e)) {
    const r = ratApprox(e, 99, 1e-12);
    if (r && r.q % 2 === 1) return (r.p % 2 === 0 ? 1 : -1) * Math.pow(-b, e);
  }
  return Math.pow(b, e);
}

/* ---------- Simple tokens (leaf items of the tree) ---------- */
const F = (d, f) => ({ d, t: 'func', f });
const TK = {
  sin: F('sin(', (x) => clean(Math.sin(toRad(x)))),
  cos: F('cos(', (x) => clean(Math.cos(toRad(x)))),
  tan: F('tan(', (x) => {
    const r = toRad(x);
    return Math.abs(Math.cos(r)) < 1e-14 ? NaN : clean(Math.tan(r));
  }),
  asin: F('sin⁻¹(', (x) => fromRad(Math.asin(x))),
  acos: F('cos⁻¹(', (x) => fromRad(Math.acos(x))),
  atan: F('tan⁻¹(', (x) => fromRad(Math.atan(x))),
  log: { d: 'log(', t: 'func', multi: true, f: (...a) => {
    if (a.length === 1) return Ops.fn('log(', Math.log10, a[0]);
    if (a.length !== 2) throw SYNTAX;
    const [b, x] = a;
    return b <= 0 || b === 1 || x <= 0 ? NaN : Math.log(x) / Math.log(b);
  } },
  ln: F('ln(', Math.log),
  rnd: F('Rnd(', (x) => {
    const { type, n } = S.cfg.fmt;
    if (type === 'Fix') return +x.toFixed(n);
    if (type === 'Sci') return +x.toPrecision(n || 10);
    return +x.toPrecision(10);
  }),
  // sexagesimal input: 2°20°30° = 2°20'30"
  dms: { d: '°', t: 'dms' },
  colon: { d: ':', t: 'colon' }, // multi-statement separator
  // Pol(x,y) -> r, θ   Rec(r,θ) -> x, y   (results also stored in x and y)
  pol: { d: 'Pol(', t: 'func', multi: true, f: (x, y) => {
    if (y === undefined) throw SYNTAX;
    const r = Math.hypot(x, y), th = fromRad(Math.atan2(y, x));
    S.vars.x = r; S.vars.y = th;
    return { type: 'pair', a: r, b: th, la: '<i>r</i>', lb: '<i>θ</i>' };
  } },
  rec: { d: 'Rec(', t: 'func', multi: true, f: (r, th) => {
    if (th === undefined) throw SYNTAX;
    const x = clean(r * Math.cos(toRad(th))), y = clean(r * Math.sin(toRad(th)));
    S.vars.x = x; S.vars.y = y;
    return { type: 'pair', a: x, b: y, la: '<i>x</i>', lb: '<i>y</i>' };
  } },
  ranInt: { d: 'RanInt#(', t: 'func', multi: true, ran: true, f: (a, b) => {
    if (b === undefined || !isInt(a) || !isInt(b) || a >= b) throw MATH;
    return a + Math.floor(Math.random() * (b - a + 1));
  } },

  open: { d: '(', t: 'open' },
  close: { d: ')', t: 'close' },

  add: { d: '+', t: 'op', op: '+' },
  sub: { d: '−', t: 'op', op: '-' },
  mul: { d: '×', t: 'op', op: '*' },
  div: { d: '÷', t: 'op', op: '/' },
  npr: { d: 'P', t: 'op', op: 'P' },
  ncr: { d: 'C', t: 'op', op: 'C' },
  neg: { d: '-', t: 'neg' },
  E: { d: '<small>×10</small>', t: 'E' },

  inv: { d: '⁻¹', t: 'post', f: (x) => (x === 0 ? NaN : 1 / x) },
  fact: { d: '!', t: 'post', f: factorial },
  pct: { d: '%', t: 'post', f: (x) => x / 100 },
  deg: { d: '°', t: 'post', f: (x) => (S.cfg.angle === 'D' ? x : S.cfg.angle === 'R' ? x * Math.PI / 180 : x * 200 / 180) },

  pi: { d: '<i>π</i>', t: 'const', v: () => Math.PI },
  e: { d: '<i>e</i>', t: 'const', v: () => Math.E },
  ans: { d: 'Ans', t: 'const', v: () => S.ans },
  ran: { d: 'Ran#', t: 'const', ran: true, v: () => Math.round(Math.random() * 1000) / 1000 },
  eqs: { d: '=', t: 'eqs' }, // equation sign for SOLVE / CALC (ALPHA CALC)
  comma: { d: ',', t: 'comma' }, // argument separator (SHIFT ))
};
// OPTN (Calculate): hyperbolic functions, angle-unit suffixes, engineering symbols
const HYP = [
  F('sinh(', Math.sinh), F('cosh(', Math.cosh), F('tanh(', Math.tanh),
  F('sinh⁻¹(', Math.asinh), F('cosh⁻¹(', Math.acosh), F('tanh⁻¹(', Math.atanh),
];
const ANGLE_SUFFIX = [
  TK.deg,
  { d: '<sup>r</sup>', t: 'post', f: (x) => fromRad(x) },
  { d: '<sup>g</sup>', t: 'post', f: (x) => fromRad(x * Math.PI / 200) },
];
const ENG_TOKENS = [['m', -3], ['μ', -6], ['n', -9], ['p', -12], ['f', -15], ['k', 3], ['M', 6], ['G', 9], ['T', 12], ['P', 15], ['E', 18]]
  .map(([d, ex]) => ({ d, t: 'post', f: (x) => x * Math.pow(10, ex) }));

// CONV (SHIFT 8): unit conversion suffixes, grouped like the real calculator
const conv = (from, to, f) => ({ d: `${from}<small>▸</small>${to}`, t: 'post', decimal: true, f });
const pair = (a, b, k) => [conv(a, b, (x) => x * k), conv(b, a, (x) => x / k)];
const CONV = [
  { name: 'Length', items: [...pair('in', 'cm', 2.54), ...pair('ft', 'm', 0.3048), ...pair('yd', 'm', 0.9144),
    ...pair('mile', 'km', 1.609344), ...pair('n mile', 'm', 1852), ...pair('pc', 'km', 3.0856775814914e13)] },
  { name: 'Area', items: pair('acre', 'm²', 4046.8564224) },
  { name: 'Volume', items: [...pair('gal(US)', 'L', 3.785412), ...pair('gal(UK)', 'L', 4.54609)] },
  { name: 'Mass', items: [...pair('oz', 'g', 28.349523125), ...pair('lb', 'kg', 0.45359237)] },
  { name: 'Velocity', items: pair('km/h', 'm/s', 1 / 3.6) },
  { name: 'Pressure', items: [...pair('atm', 'Pa', 101325), ...pair('mmHg', 'Pa', 133.322368), ...pair('kgf/cm²', 'Pa', 98066.5),
    ...pair('lbf/in²', 'kPa', 6.894757293)] },
  { name: 'Energy', items: [...pair('kgf·m', 'J', 9.80665), ...pair('J', 'cal', 1 / 4.1855)] },
  { name: 'Power', items: pair('hp', 'kW', 0.73549875) },
  { name: 'Temperature', items: [conv('°F', '°C', (x) => (x - 32) * 5 / 9), conv('°C', '°F', (x) => x * 9 / 5 + 32)] },
];

const varTok = (n) => ({ d: n, t: 'const', var: true, v: () => S.vars[n] });
const digit = (c) => ({ d: c, t: 'num' });

/* ---------- Natural Display tree ----------
   Row  = { items: [...], up: {row, node, slot} | null }
   Node = { t:'tpl', kind, slots: { name: Row } }            */
const SLOTS = {
  frac: ['num', 'den'],
  mixed: ['whole', 'num', 'den'],
  sqrt: ['arg'],
  root: ['idx', 'arg'],
  pow: ['exp'],
  pow10: ['exp'],
  exp: ['exp'],
  logab: ['base', 'arg'],
  abs: ['arg'],
  // calculus templates: x is the bound variable inside 'f'
  integ: ['f', 'lo', 'hi'],
  deriv: ['f', 'at'],
  sigma: ['f', 'lo', 'hi'],
  // Indefinite mode (calculus/cas.js): ∫ f dx and d/dx(f) without limits / point
  iinteg: ['f'],
  ideriv: ['f'],
};
const isTpl = (it) => it && it.t === 'tpl';
const Row = (up = null) => ({ items: [], up });

function linkSlots(row, node) {
  for (const s of SLOTS[node.kind]) {
    const r = node.slots[s];
    r.up = { row, node, slot: s };
    r.items.forEach((it) => isTpl(it) && linkSlots(r, it));
  }
}
function mkNode(kind, fill = {}) {
  const n = { t: 'tpl', kind, slots: {} };
  for (const s of SLOTS[kind]) {
    n.slots[s] = Row();
    (fill[s] || []).forEach((x) => n.slots[s].items.push(x));
  }
  return n;
}
function cloneRow(row) {
  const r = Row();
  r.items = row.items.map((it) => (isTpl(it) ? cloneNode(it) : it));
  r.items.forEach((it) => isTpl(it) && linkSlots(r, it));
  return r;
}
function cloneNode(n) {
  const m = { t: 'tpl', kind: n.kind, slots: {} };
  for (const s of SLOTS[n.kind]) m.slots[s] = cloneRow(n.slots[s]);
  return m;
}
const isEmptyNode = (n) => SLOTS[n.kind].every((s) => n.slots[s].items.length === 0);

// cursor <-> path (so undo/history snapshots survive cloning)
function pathOf(cur) {
  const p = [];
  let row = cur.row;
  while (row.up) {
    const { row: pr, node, slot } = row.up;
    p.unshift([pr.items.indexOf(node), slot]);
    row = pr;
  }
  return { p, idx: cur.idx };
}
function resolvePath(root, path) {
  let row = root;
  for (const [i, s] of path.p) row = row.items[i].slots[s];
  return { row, idx: path.idx };
}

function newExpr() {
  S.root = Row();
  S.cur = { row: S.root, idx: 0 };
}
function insertItem(item) {
  const { row, idx } = S.cur;
  row.items.splice(idx, 0, item);
  if (isTpl(item)) linkSlots(row, item);
  S.cur = { row, idx: idx + 1 };
}

/* cursor movement through template slots */
function moveRight() {
  const { row, idx } = S.cur;
  if (idx < row.items.length) {
    const it = row.items[idx];
    S.cur = isTpl(it) ? { row: it.slots[SLOTS[it.kind][0]], idx: 0 } : { row, idx: idx + 1 };
    return;
  }
  if (!row.up) { S.cur = { row, idx: 0 }; return; } // wrap around
  const { row: pr, node, slot } = row.up;
  const order = SLOTS[node.kind];
  const k = order.indexOf(slot);
  S.cur = k < order.length - 1
    ? { row: node.slots[order[k + 1]], idx: 0 }
    : { row: pr, idx: pr.items.indexOf(node) + 1 };
}
function moveLeft() {
  const { row, idx } = S.cur;
  if (idx > 0) {
    const it = row.items[idx - 1];
    if (isTpl(it)) {
      const last = it.slots[SLOTS[it.kind].at(-1)];
      S.cur = { row: last, idx: last.items.length };
    } else S.cur = { row, idx: idx - 1 };
    return;
  }
  if (!row.up) { S.cur = { row, idx: row.items.length }; return; }
  const { row: pr, node, slot } = row.up;
  const order = SLOTS[node.kind];
  const k = order.indexOf(slot);
  if (k > 0) {
    const prev = node.slots[order[k - 1]];
    S.cur = { row: prev, idx: prev.items.length };
  } else S.cur = { row: pr, idx: pr.items.indexOf(node) };
}
// up/down between numerator and denominator; returns false if not inside a fraction
// [slot reached with ▲, slot reached with ▼] for each template slot
const VERT_SLOTS = {
  frac: { num: [null, 'den'], den: ['num', null] },
  mixed: { whole: [null, 'den'], num: [null, 'den'], den: ['num', null] },
  integ: { f: ['hi', 'lo'], hi: [null, 'f'], lo: ['f', null] },
  sigma: { f: ['hi', 'lo'], hi: [null, 'f'], lo: ['f', null] },
  deriv: { f: [null, 'at'], at: ['f', null] },
  root: { idx: [null, 'arg'], arg: ['idx', null] },
  logab: { base: ['arg', null], arg: [null, 'base'] },
};
function moveVert(d) {
  let row = S.cur.row;
  while (row.up) {
    const { node, slot, row: pr } = row.up;
    const to = VERT_SLOTS[node.kind] && VERT_SLOTS[node.kind][slot] && VERT_SLOTS[node.kind][slot][d < 0 ? 0 : 1];
    if (to) { const target = node.slots[to]; S.cur = { row: target, idx: target.items.length }; return true; }
    row = pr;
  }
  return false;
}

/* ---------- Evaluation ---------- */
function evalRow(row) {
  if (!row.items.length) throw SYNTAX;
  return parseItems(row.items);
}
function evalNode(n) {
  const v = (s) => evalRow(n.slots[s]);
  switch (n.kind) {
    case 'frac': return Ops.div(v('num'), v('den'));
    case 'mixed': {
      const w = v('whole'), d = v('den');
      if (d === 0) throw MATH;
      const f = v('num') / d;
      return w < 0 ? w - f : w + f;
    }
    case 'sqrt': return Ops.fn('√', Math.sqrt, v('arg'));
    case 'root': return xroot(v('idx'), v('arg'));
    case 'logab': {
      const b = v('base'), a = v('arg');
      return b <= 0 || b === 1 || a <= 0 ? NaN : Math.log(a) / Math.log(b);
    }
    case 'abs': return Ops.fn('Abs', Math.abs, v('arg'));
    case 'pow10': return Math.pow(10, v('exp'));
    case 'exp': return Math.exp(v('exp'));
    case 'integ': {
      const a = v('lo'), b = v('hi');
      return integrate(fOfX(n.slots.f), a, b);
    }
    case 'deriv': {
      const d = derivative(fOfX(n.slots.f), v('at'));
      return Number.isFinite(d) ? +d.toPrecision(12) : NaN;
    }
    case 'sigma': {
      const a = v('lo'), b = v('hi');
      if (!isInt(a) || !isInt(b) || b < a) return NaN;
      if (b - a > 1e6) throw MATH;
      const f = fOfX(n.slots.f);
      let sum = 0;
      for (let k = a; k <= b; k++) sum += f(k);
      return sum;
    }
  }
  throw SYNTAX;
}

/* ---------- Value types & hooks used by the extra modes ----------
   Plain numbers stay JS numbers. Modes register other value types
   (complex, matrix, vector …) with TYPES[type] = { add, sub, mul, div,
   neg, pow, fn(name, x), check(v), html(v) }; any missing op -> Math ERROR. */
const TYPES = {};
// Set by a mode while it is active (cleared by leaveApp):
//  parseNumber(str) -> value      number literal parsing (Base-N digits)
//  fmtResult(v) -> html | null    result formatting override for plain numbers
//  num: { add, sub, mul, div, neg, pow, fn(name, f, x) }  overrides for plain-number maths
const HOOKS = { parseNumber: null, fmtResult: null, num: null };
const typeOf = (v) => (typeof v === 'number' ? 'num' : v && v.type);
function handlerFor(a, b) {
  const t = typeOf(a) !== 'num' ? typeOf(a) : typeOf(b);
  const h = TYPES[t];
  if (!h) throw MATH;
  return h;
}
const callOp = (name, a, b) => {
  const h = handlerFor(a, b);
  if (!h[name]) throw MATH;
  return h[name](a, b);
};
const bothNum = (a, b) => typeof a === 'number' && typeof b === 'number';
const numHook = (name) => HOOKS.num && HOOKS.num[name];
const Ops = {
  add: (a, b) => (bothNum(a, b) ? (numHook('add') ? HOOKS.num.add(a, b) : a + b) : callOp('add', a, b)),
  sub: (a, b) => (bothNum(a, b) ? (numHook('sub') ? HOOKS.num.sub(a, b) : a - b) : callOp('sub', a, b)),
  mul: (a, b) => (bothNum(a, b) ? (numHook('mul') ? HOOKS.num.mul(a, b) : a * b) : callOp('mul', a, b)),
  div: (a, b) => {
    if (!bothNum(a, b)) return callOp('div', a, b);
    if (numHook('div')) return HOOKS.num.div(a, b);
    if (b === 0) throw MATH;
    return a / b;
  },
  neg: (a) => (typeof a === 'number' ? (numHook('neg') ? HOOKS.num.neg(a) : -a) : callOp('neg', a)),
  pow: (a, b) => (bothNum(a, b) ? (numHook('pow') ? HOOKS.num.pow(a, b) : power(a, b)) : callOp('pow', a, b)),
  // unary function / postfix by display name, e.g. ('sin(', f, x)
  fn: (name, f, x) => {
    if (typeof x === 'number') return numHook('fn') ? HOOKS.num.fn(name, f, x) : f(x);
    const h = handlerFor(x);
    if (!h.fn) throw MATH;
    const r = h.fn(name, x);
    if (r === undefined) throw MATH;
    return r;
  },
};

function parseItems(raw) {
  // merge digit tokens into numbers (Base-N mode can parse A-F digits via HOOKS.parseNumber)
  const toks = [];
  let buf = '';
  const flush = () => {
    if (!buf) return;
    const v = HOOKS.parseNumber ? HOOKS.parseNumber(buf) : Number(buf);
    if (typeof v === 'number' && Number.isNaN(v)) throw SYNTAX;
    toks.push({ t: 'number', v });
    buf = '';
  };
  for (const t of raw) {
    if (t.t === 'num') buf += t.d;
    else { flush(); toks.push(t); }
  }
  flush();

  let i = 0;
  const peek = () => toks[i];
  const isOp = (t, ...ops) => t && t.t === 'op' && ops.includes(t.op);
  // custom binary operators from modes: { t:'op', op:'custom', level:'low'|'add'|'mul'|'comb', f(a,b) }
  // 'low' binds looser than + and − (logic operators)
  const isCustom = (t, level) => t && t.t === 'op' && t.op === 'custom' && t.level === level;
  const isPowNode = (t) => isTpl(t) && t.kind === 'pow';
  const startsPrimary = (t) => t && (['number', 'const', 'func', 'open'].includes(t.t) || (isTpl(t) && !isPowNode(t)));

  function expr() {
    let v = sum();
    while (isCustom(peek(), 'low')) { const t = toks[i++]; v = t.f(v, sum()); }
    return v;
  }
  function sum() {
    let v = term();
    for (;;) {
      const t = peek();
      if (isOp(t, '+', '-')) { i++; const r = term(); v = t.op === '+' ? Ops.add(v, r) : Ops.sub(v, r); }
      else if (isCustom(t, 'add')) { i++; v = t.f(v, term()); }
      else break;
    }
    return v;
  }
  function term() {
    let v = comb();
    for (;;) {
      const t = peek();
      if (isOp(t, '*', '/')) { i++; const r = comb(); v = t.op === '/' ? Ops.div(v, r) : Ops.mul(v, r); }
      else if (isCustom(t, 'mul')) { i++; v = t.f(v, comb()); }
      else break;
    }
    return v;
  }
  function comb() {
    let v = imp();
    for (;;) {
      const t = peek();
      if (isOp(t, 'P', 'C')) { i++; const r = imp(); v = t.op === 'P' ? nPr(v, r) : nCr(v, r); }
      else if (isCustom(t, 'comb')) { i++; v = t.f(v, imp()); }
      else break;
    }
    return v;
  }
  // implied multiplication (2π, 3(4), 2√3) binds tighter than × ÷: 6÷2(1+2) = 6÷(2(1+2)) = 1
  function imp() {
    let v = unary();
    while (startsPrimary(peek())) v = Ops.mul(v, unary());
    return v;
  }
  function unary() {
    const t = peek();
    if (t && (t.t === 'neg' || isOp(t, '-'))) { i++; return Ops.neg(unary()); }
    if (isOp(t, '+')) { i++; return unary(); }
    return postfix();
  }
  function postfix() {
    let v = primary();
    for (;;) {
      const t = peek();
      if (t && t.t === 'post') { i++; v = Ops.fn(t.d, t.f, v); }
      else if (t && t.t === 'dms') {
        // d° m° s° -> d + m/60 + s/3600 (minutes / seconds are optional)
        i++;
        const sg = v < 0 ? -1 : 1;
        for (const div of [60, 3600]) {
          const n = peek(), m = toks[i + 1];
          if (!n || n.t !== 'number' || !m || m.t !== 'dms') break;
          v += sg * n.v / div;
          i += 2;
        }
      }
      else if (isPowNode(t)) { i++; v = Ops.pow(v, evalRow(t.slots.exp)); }
      else if (t && t.t === 'E') {
        i++;
        let sign = 1;
        const s = peek();
        if (s && (s.t === 'neg' || isOp(s, '-'))) { i++; sign = -1; }
        const n = peek();
        if (!n || n.t !== 'number') throw SYNTAX;
        i++;
        v = Ops.mul(v, Math.pow(10, sign * n.v));
      } else break;
    }
    return v;
  }
  function primary() {
    const t = toks[i++];
    if (!t) throw SYNTAX;
    if (isTpl(t)) { if (isPowNode(t)) throw SYNTAX; return evalNode(t); }
    switch (t.t) {
      case 'number': return t.v;
      case 'const': return t.v();
      case 'func':
      case 'open': {
        const args = [expr()];
        while (peek() && peek().t === 'comma') { i++; args.push(expr()); }
        if (peek() && peek().t === 'close') i++; // a missing ')' at the end is allowed
        if (t.t === 'open') { if (args.length > 1) throw SYNTAX; return args[0]; }
        if (t.multi) return t.f(...args);        // multi-argument functions handle their own types
        if (args.length > 1) throw SYNTAX;
        return Ops.fn(t.d, t.f, args[0]);
      }
      case 'E': i--; return 1; // "×10³" alone means 1×10³
    }
    throw SYNTAX;
  }

  const v = expr();
  if (i < toks.length) throw SYNTAX;
  if (typeof v === 'number') { if (!Number.isFinite(v)) throw MATH; }
  else if (TYPES[typeOf(v)] && TYPES[typeOf(v)].check) TYPES[typeOf(v)].check(v);
  return v;
}

// snap float noise: 3.9999999999999996 -> 4, 1e-17 -> 0
function tidy(v) {
  if (typeof v !== 'number') return v;
  if (Math.abs(v) < 1e-13) return 0;
  const r = Math.round(v);
  if (Math.abs(v) < 1e15 && Math.abs(v - r) < 1e-10 * Math.max(1, Math.abs(v))) return r;
  return v;
}
// random numbers and numeric integrals make the result decimal-only
// (typed decimals are fine: 0.5+0.25 shows 3/4, like the real Math I/O mode)
function hasInexact(row) {
  return row.items.some((it) => (isTpl(it)
    ? it.kind === 'integ' || SLOTS[it.kind].some((s) => hasInexact(it.slots[s]))
    : it.decimal)); // decimal: token values that should always display as decimals (statistics)
}

/* ---------- Calculus ---------- */
// f(x) evaluator for a slot, binding the variable x
function fOfX(row) {
  return (x) => {
    const old = S.vars.x;
    S.vars.x = x;
    try { return evalRow(row); } finally { S.vars.x = old; }
  };
}

// adaptive Simpson on 8 starting panels
function integrate(f, a, b) {
  if (a === b) return 0;
  let sgn = 1;
  if (a > b) { [a, b] = [b, a]; sgn = -1; }
  let evals = 0;
  const simpson = (a, b, fa, fm, fb) => (b - a) / 6 * (fa + 4 * fm + fb);
  const rec = (a, b, fa, fm, fb, whole, eps, depth) => {
    const m = (a + b) / 2, flm = f((a + m) / 2), frm = f((m + b) / 2);
    if ((evals += 2) > 400000) throw MATH;
    const left = simpson(a, m, fa, flm, fm), right = simpson(m, b, fm, frm, fb);
    const d = left + right - whole;
    if (depth <= 0 || Math.abs(d) <= 15 * eps) return left + right + d / 15;
    return rec(a, m, fa, flm, fm, left, eps / 2, depth - 1) + rec(m, b, fm, frm, fb, right, eps / 2, depth - 1);
  };
  const N = 8, h = (b - a) / N;
  let total = 0;
  for (let i = 0; i < N; i++) {
    const x0 = a + i * h, x1 = x0 + h;
    const f0 = f(x0), fm = f((x0 + x1) / 2), f1 = f(x1);
    total += rec(x0, x1, f0, fm, f1, simpson(x0, x1, f0, fm, f1), 1e-13, 40);
  }
  return sgn * total;
}

// Ridders' extrapolated central difference
function derivative(f, x) {
  const CON = 1.4, CON2 = CON * CON, NT = 10;
  let h = 0.1 * Math.max(1, Math.abs(x));
  const a = [[(f(x + h) - f(x - h)) / (2 * h)]];
  let err = Infinity, ans = NaN;
  for (let i = 1; i < NT; i++) {
    h /= CON;
    a[i] = [(f(x + h) - f(x - h)) / (2 * h)];
    let fac = CON2;
    for (let j = 1; j <= i; j++) {
      a[i][j] = (a[i][j - 1] * fac - a[i - 1][j - 1]) / (fac - 1);
      fac *= CON2;
      const e = Math.max(Math.abs(a[i][j] - a[i][j - 1]), Math.abs(a[i][j] - a[i - 1][j - 1]));
      if (e <= err) { err = e; ans = a[i][j]; }
    }
    if (Math.abs(a[i][i] - a[i - 1][i - 1]) >= 2 * err) break;
  }
  return ans;
}

/* ---------- Equations: SOLVE / CALC ---------- */
// split the top-level row at '=' into [left, right]; right is null when there is no '='
function splitEq(row) {
  const at = row.items.reduce((acc, it, i) => (it.t === 'eqs' ? [...acc, i] : acc), []);
  if (at.length > 1) throw SYNTAX;
  if (!at.length) return [row, null];
  const L = Row(), R = Row();
  L.items = row.items.slice(0, at[0]);
  R.items = row.items.slice(at[0] + 1);
  if (!L.items.length || !R.items.length) throw SYNTAX;
  return [L, R];
}

// variable names used in the expression, in order (x bound inside calculus templates is skipped)
function collectVars(row, out = []) {
  for (const it of row.items) {
    if (isTpl(it)) {
      for (const s of SLOTS[it.kind]) {
        if (s === 'f' && ['integ', 'deriv', 'sigma', 'iinteg', 'ideriv'].includes(it.kind)) continue;
        collectVars(it.slots[s], out);
      }
    } else if (it.var && !out.includes(it.d)) out.push(it.d);
  }
  return out;
}

// Newton's method from x0, then an outward bracket search + bisection as fallback
function solveNum(f, x0) {
  const F = (x) => { try { const v = f(x); return Number.isFinite(v) ? v : NaN; } catch (e) { return NaN; } };
  let x = x0;
  for (let i = 0; i < 150; i++) {
    const fx = F(x);
    if (Number.isNaN(fx)) break;
    if (fx === 0) return x;
    const h = 1e-7 * Math.max(1, Math.abs(x));
    const d = (F(x + h) - F(x - h)) / (2 * h);
    if (!Number.isFinite(d) || d === 0) break;
    const nx = x - fx / d;
    if (!Number.isFinite(nx)) break;
    if (Math.abs(nx - x) <= 1e-15 * Math.max(1, Math.abs(x))) { x = nx; break; }
    x = nx;
  }
  const scale = Math.max(1, Math.abs(x0));
  // accept Newton's answer only if it is a real root, not a run-off towards infinity (e.g. 1/x = 0)
  if (Number.isFinite(F(x)) && Math.abs(F(x)) < 1e-9 * scale && Math.abs(x) < 1e10 * scale) return x;

  const bisect = (lo, hi, flo) => {
    for (let i = 0; i < 200; i++) {
      const m = (lo + hi) / 2, fm = F(m);
      if (Number.isNaN(fm)) return null;
      if (Math.sign(fm) === Math.sign(flo)) { lo = m; flo = fm; } else hi = m;
    }
    const r = (lo + hi) / 2;
    return Math.abs(F(r)) < 1e-6 * scale ? r : null; // reject sign changes at poles
  };
  let pR = x0, fR = F(x0), pL = x0, fL = fR;
  for (let k = 0; k < 90; k++) {
    const step = 0.1 * Math.pow(1.3, k) * scale;
    for (const dir of [1, -1]) {
      const p = x0 + dir * step, fp = F(p);
      const [q, fq] = dir > 0 ? [pR, fR] : [pL, fL];
      if (Number.isFinite(fp) && Number.isFinite(fq) && Math.sign(fp) !== Math.sign(fq)) {
        const r = dir > 0 ? bisect(q, p, fq) : bisect(p, q, fp);
        if (r !== null) return r;
      }
      if (dir > 0) { pR = p; fR = fp; } else { pL = p; fL = fp; }
    }
  }
  return null;
}

/* ---------- Exact results: fractions, surds, multiples of π ---------- */
function ratApprox(x, maxDen, tol) {
  if (!Number.isFinite(x)) return null;
  const sg = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  let y = ax, h1 = 1, h0 = 0, k1 = 0, k0 = 1;
  for (let n = 0; n < 40; n++) {
    const a = Math.floor(y);
    [h1, h0] = [a * h1 + h0, h1];
    [k1, k0] = [a * k1 + k0, k1];
    if (k1 > maxDen) return null;
    if (Math.abs(ax - h1 / k1) <= tol * Math.max(1, ax)) return { p: sg * h1, q: k1 };
    const f = y - a;
    if (f < 1e-15) break;
    y = 1 / f;
  }
  return null;
}
const SQUAREFREE = (() => {
  const out = [];
  for (let n = 2; n <= 200; n++) {
    let ok = true;
    for (let p = 2; p * p <= n; p++) if (n % (p * p) === 0) { ok = false; break; }
    if (ok) out.push(n);
  }
  return out;
})();

function exactOf(v) {
  if (isInt(v)) return { k: 'int', p: v };
  const r = ratApprox(v, 9999, 1e-13);
  if (r && Math.abs(r.p) < 1e9) return { k: 'rat', p: r.p, q: r.q };
  for (const n of SQUAREFREE) {
    const w = ratApprox(v / Math.sqrt(n), 99, 1e-13);
    if (w && Math.abs(w.p) < 10000) return { k: 'surd', p: w.p, q: w.q, r: n };
  }
  const w = ratApprox(v / Math.PI, 99, 1e-13);
  if (w && Math.abs(w.p) < 10000) return { k: 'pi', p: w.p, q: w.q };
  // (A + B√n) / q, e.g. 1+√2 or (2+√2)/2
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  for (let q = 1; q <= 12; q++) {
    const w = v * q;
    for (const n of SQUAREFREE) {
      if (n > 100) break;
      const sn = Math.sqrt(n);
      for (let B = -30; B <= 30; B++) {
        if (!B) continue;
        const A = w - B * sn, Ar = Math.round(A);
        if (Ar !== 0 && Math.abs(Ar) < 10000 && Math.abs(A - Ar) < 1e-12 * Math.max(1, Math.abs(w))) {
          const g = gcd(gcd(Math.abs(Ar), Math.abs(B)), q);
          return { k: 'ratsurd', A: Ar / g, B: B / g, q: q / g, r: n };
        }
      }
    }
  }
  // a√m + b√n with integer coefficients, e.g. √24−√98 = 2√6−7√2
  const sq = SQUAREFREE.filter((n) => n <= 50);
  for (let i = 0; i < sq.length; i++) {
    for (let j = i + 1; j < sq.length; j++) {
      const m = sq[i], n = sq[j];
      for (let b = -20; b <= 20; b++) {
        if (!b) continue;
        const a = (v - b * Math.sqrt(n)) / Math.sqrt(m);
        const ar = Math.round(a);
        if (ar !== 0 && Math.abs(ar) <= 99 && Math.abs(a - ar) < 1e-12 * Math.max(1, Math.abs(a))) return { k: 'surd2', a: ar, m, b, n };
      }
    }
  }
  return null;
}

const sqrtHTML = (n) => `<span class="nd-sqrt"><span class="rad">√</span><span class="ov">${n}</span></span>`;
// signed term like "−7√2" (first: no leading +)
const surdTerm = (c, n, first) => `${c < 0 ? '−' : first ? '' : '+'}${Math.abs(c) === 1 ? '' : Math.abs(c)}${sqrtHTML(n)}`;
const ndFrac = (n, d) => `<span class="nd-frac r"><span class="num">${n}</span><span class="den">${d}</span></span>`;
function exactHTML(e, mixed) {
  const sg = (x) => (x < 0 ? '−' : '');
  if (e.k === 'surd2') { // positive term first, like the guide: 2√6−7√2
    const t = e.b < 0 && e.a > 0 ? [[e.a, e.m], [e.b, e.n]] : [[e.b, e.n], [e.a, e.m]];
    return surdTerm(t[0][0], t[0][1], true) + surdTerm(t[1][0], t[1][1], false);
  }
  if (e.k === 'ratsurd') { // (A ± B√n)/q
    const neg = e.A < 0 && e.B < 0; // pull out a common minus sign
    const A = neg ? -e.A : e.A, B = neg ? -e.B : e.B;
    const num = `${A < 0 ? '−' : ''}${Math.abs(A)}${surdTerm(B, e.r, false)}`;
    return (neg ? '−' : '') + (e.q === 1 ? num : ndFrac(num, e.q));
  }
  if (e.k === 'rat') {
    const { p, q } = e;
    const a = Math.abs(p);
    if (mixed && a > q) return `${sg(p)}${Math.trunc(a / q)}${ndFrac(a % q, q)}`;
    return sg(p) + ndFrac(a, q);
  }
  const sym = e.k === 'surd' ? `<span class="nd-sqrt"><span class="rad">√</span><span class="ov">${e.r}</span></span>` : '<i>π</i>';
  const a = Math.abs(e.p);
  const coef = a === 1 ? '' : a;
  return e.q === 1 ? `${sg(e.p)}${coef}${sym}` : sg(e.p) + ndFrac(coef + sym, e.q);
}

/* ---------- Pol/Rec pair results ---------- */
const fst = (v) => (v && v.type === 'pair' ? v.a : v);
TYPES.pair = {
  add: (a, b) => Ops.add(fst(a), fst(b)), sub: (a, b) => Ops.sub(fst(a), fst(b)),
  mul: (a, b) => Ops.mul(fst(a), fst(b)), div: (a, b) => Ops.div(fst(a), fst(b)),
  neg: (a) => -fst(a), pow: (a, b) => Ops.pow(fst(a), fst(b)),
  fn: (name, x) => undefined,
  html: (v) => `<span class="pair">${v.la}=${fmtNum(tidy(v.a))}, ${v.lb}=${fmtNum(tidy(v.b))}</span>`,
};

/* ---------- Sexagesimal display 2°30'0" ---------- */
function dmsHTML(v) {
  const sg = v < 0 ? '−' : '';
  let a = Math.abs(v), d = Math.floor(a), m = Math.floor((a - d) * 60);
  let s = +((a - d - m / 60) * 3600).toFixed(2);
  if (s >= 60) { s -= 60; m++; }
  if (m >= 60) { m -= 60; d++; }
  return `${sg}${d}°${m}′${plain(s)}″`;
}
function hasDms(row) {
  return row.items.some((it) => (isTpl(it) ? SLOTS[it.kind].some((s) => hasDms(it.slots[s])) : it.t === 'dms'));
}

/* ---------- Scientific constants (CONST, CODATA 2010) ---------- */
const k = (d, v) => ({ d, t: 'const', decimal: true, v: () => v });
const CONSTS = [
  { name: 'Universal', items: [k('<i>h</i>', 6.62606957e-34), k('<i>ħ</i>', 1.054571726e-34), k('<i>c</i><sub>0</sub>', 299792458),
    k('ε<sub>0</sub>', 8.854187817e-12), k('μ<sub>0</sub>', 1.2566370614e-6), k('<i>Z</i><sub>0</sub>', 376.730313461),
    k('<i>G</i>', 6.67384e-11), k('<i>l</i><sub>P</sub>', 1.616199e-35), k('<i>t</i><sub>P</sub>', 5.39106e-44)] },
  { name: 'Electromagnetic', items: [k('μ<sub>N</sub>', 5.05078353e-27), k('μ<sub>B</sub>', 9.27400968e-24), k('<i>e</i>', 1.602176565e-19),
    k('Φ<sub>0</sub>', 2.067833758e-15), k('<i>G</i><sub>0</sub>', 7.7480917346e-5), k('<i>K</i><sub>J</sub>', 4.8359787e14),
    k('<i>R</i><sub>K</sub>', 25812.8074434)] },
  { name: 'Atomic&amp;Nuclear', items: [k('<i>m</i><sub>p</sub>', 1.672621777e-27), k('<i>m</i><sub>n</sub>', 1.674927351e-27),
    k('<i>m</i><sub>e</sub>', 9.10938291e-31), k('<i>m</i><sub>μ</sub>', 1.883531475e-28), k('<i>a</i><sub>0</sub>', 5.2917721092e-11),
    k('α', 7.2973525698e-3), k('<i>r</i><sub>e</sub>', 2.8179403267e-15), k('λ<sub>C</sub>', 2.4263102389e-12),
    k('γ<sub>p</sub>', 2.675222005e8), k('λ<sub>Cp</sub>', 1.32140985623e-15), k('λ<sub>Cn</sub>', 1.3195909068e-15),
    k('<i>R</i><sub>∞</sub>', 10973731.568539), k('μ<sub>p</sub>', 1.410606743e-26), k('μ<sub>e</sub>', -9.2847643e-24),
    k('μ<sub>n</sub>', -9.6623647e-27), k('μ<sub>μ</sub>', -4.49044807e-26), k('<i>m</i><sub>τ</sub>', 3.16747e-27)] },
  { name: 'Physico-Chem', items: [k('<i>u</i>', 1.660538921e-27), k('<i>F</i>', 96485.3365), k('<i>N</i><sub>A</sub>', 6.02214129e23),
    k('<i>k</i>', 1.3806488e-23), k('<i>V</i><sub>m</sub>', 0.022413968), k('<i>R</i>', 8.3144621),
    k('<i>c</i><sub>1</sub>', 3.74177153e-16), k('<i>c</i><sub>2</sub>', 0.01438777), k('σ', 5.670373e-8)] },
  { name: 'Adopted Values', items: [k('<i>g</i>', 9.80665), k('atm', 101325), k('<i>R</i><sub>K-90</sub>', 25812.807),
    k('<i>K</i><sub>J-90</sub>', 4.835979e14)] },
  { name: 'Other', items: [k('<i>t</i>', -273.15)] },
];

/* ---------- Decimal formatting (SETUP: Fix / Sci / Norm, ENG, separators) ---------- */
const sup = (e) => `<sup>${String(e).replace('-', '−')}</sup>`;
const ENG_SYM = { 18: 'E', 15: 'P', 12: 'T', 9: 'G', 6: 'M', 3: 'k', '-3': 'm', '-6': 'μ', '-9': 'n', '-12': 'p', '-15': 'f' };

function plain(x) {
  let s = String(x);
  if (/e/i.test(s)) { // tiny numbers: avoid "1e-7"
    s = x.toFixed(20).replace(/0+$/, '').replace(/\.$/, '');
  }
  return s;
}
function decorate(numStr) {
  // numStr like "-1234567.89" -> digit separators + decimal mark + real minus sign
  let [int, frac] = numStr.replace('-', '').split('.');
  if (S.cfg.digitSep) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, '<span class="dsep"></span>');
  const neg = numStr.startsWith('-') ? '−' : '';
  return neg + int + (frac !== undefined ? S.cfg.decMark + frac : '');
}
function sciParts(v, digits, trim) {
  let [m, e] = v.toExponential(digits - 1).split('e');
  if (trim) m = String(+m);
  return decorate(m) + '×10' + sup(+e);
}
function fmtNum(v) {
  if (S.engExp !== null) {
    const m = +(v / Math.pow(10, S.engExp)).toPrecision(10);
    const sym = S.cfg.engSym ? ENG_SYM[S.engExp] : null;
    if (S.engExp === 0 && !sym) return decorate(plain(m));
    return decorate(plain(m)) + (sym || '×10' + sup(S.engExp));
  }
  const a = Math.abs(v);
  const { type, n } = S.cfg.fmt;
  if (S.cfg.engSym && type === 'Norm' && v !== 0 && a >= 1e-15 && a < 1e15) {
    let ex = Math.floor(Math.log10(a) / 3) * 3;
    let m = +(v / Math.pow(10, ex)).toPrecision(10);
    if (Math.abs(m) >= 1000) { m /= 1000; ex += 3; }
    if (ex !== 0 && ENG_SYM[ex]) return decorate(plain(m)) + ENG_SYM[ex];
  }
  if (type === 'Fix') {
    if (a >= 1e10) return sciParts(v, 10, true);
    return decorate(v.toFixed(n));
  }
  if (type === 'Sci') return sciParts(v, n || 10, false);
  if (v === 0) return '0';
  const lo = n === 1 ? 1e-2 : 1e-9;
  if (a < lo || a >= 1e10) return sciParts(v, 10, true);
  return decorate(plain(+v.toPrecision(10)));
}

function factorHTML(n) {
  const parts = [];
  for (let p = 2; p * p <= n; p++) {
    let c = 0;
    while (n % p === 0) { n /= p; c++; }
    if (c) parts.push(p + (c > 1 ? sup(c) : ''));
  }
  if (n > 1) parts.push(String(n));
  return parts.join('×');
}
