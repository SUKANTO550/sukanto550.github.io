'use strict';

/* =========================================================
   Scientific Calculator - UI: key layout, actions, rendering.
   Math lives in engine.js, MENU/SETUP screens in screens.js.
   ========================================================= */

const $ = (s) => document.querySelector(s);

/* ---------- Editing actions (calculation screen) ---------- */
function snapshot() {
  S.undo.push({ root: cloneRow(S.root), path: pathOf(S.cur) });
  if (S.undo.length > 50) S.undo.shift();
}
// leave result view before editing; operators continue from Ans
function startEdit(continues) {
  if (S.done) {
    newExpr();
    if (continues) insertItem(TK.ans);
    S.done = false;
    S.symRes = null;
  }
  S.error = S.note = S.fact = null;
  S.engExp = null;
}
function ins(tok) {
  snapshot();
  if (S.insArm && !S.done && tok.t === 'func') { // INS: f( … ) around the value left of the cursor
    S.insArm = false;
    const { row, idx } = S.cur;
    const s = operandStart(row.items, idx);
    row.items.splice(idx, 0, TK.close);
    row.items.splice(s, 0, tok);
    S.cur = { row, idx: idx + 2 };
    return;
  }
  startEdit(tok.t === 'op' || tok.t === 'post' || tok.t === 'dms');
  insertItem(tok);
}
// slot that receives the wrapped value for INS
const INS_SLOT = { sqrt: 'arg', root: 'arg', abs: 'arg', logab: 'arg', pow10: 'exp', exp: 'exp', integ: 'f', deriv: 'f', sigma: 'f', frac: 'num', iinteg: 'f', ideriv: 'f' };
// ∫ and d/dx keys: limits / point in Definite mode, symbolic templates in Indefinite mode (SETUP Calculus)
function calcTpl(kind) {
  if (S.cfg.calc !== 'indef') { insTpl(kind); return; }
  insTpl(kind === 'integ' ? 'iinteg' : 'ideriv');
  if (kind === 'integ' && window.CASUI) CASUI.warm(); // derivatives never need SymPy
}
// insert a Natural Display template; opts.fill pre-fills slots, opts.enter = slot to put the cursor in (null = after it)
// start index of the operand just left of `idx`: a number, a constant/variable, a template
// or a bracketed group (incl. "sin(...)"), plus any trailing x², x⁻¹, ! etc. Returns idx if none.
function operandStart(items, idx) {
  let i = idx;
  while (i > 0 && (items[i - 1].t === 'post' || (isTpl(items[i - 1]) && items[i - 1].kind === 'pow'))) i--;
  if (i === 0) return idx;
  const it = items[i - 1];
  if (it.t === 'num') { while (i > 0 && items[i - 1].t === 'num') i--; return i; }
  if (it.t === 'const' || isTpl(it)) return i - 1;
  if (it.t === 'close') {
    let depth = 0;
    for (let j = i - 1; j >= 0; j--) {
      const t = items[j].t;
      if (t === 'close') depth++;
      else if ((t === 'open' || t === 'func') && --depth === 0) return j;
    }
  }
  return idx;
}

// a/b key: the number typed just before becomes the numerator, cursor goes to the denominator
function insFrac() {
  snapshot();
  if (S.done) {
    startEdit(false);
    const n = mkNode('frac', { num: [TK.ans] });
    insertItem(n);
    S.cur = { row: n.slots.den, idx: 0 };
    return;
  }
  startEdit(false);
  const { row, idx } = S.cur;
  const s = operandStart(row.items, idx);
  const moved = row.items.splice(s, idx - s);
  const n = mkNode('frac', { num: moved });
  S.cur = { row, idx: s };
  insertItem(n);
  const target = moved.length ? n.slots.den : n.slots.num;
  S.cur = { row: target, idx: 0 };
}

function insTpl(kind, opts = {}) {
  snapshot();
  if (S.insArm && !S.done && INS_SLOT[kind]) { // INS: the value left of the cursor becomes the argument
    S.insArm = false;
    const { row, idx } = S.cur;
    const s = operandStart(row.items, idx);
    const moved = row.items.splice(s, idx - s);
    const n = mkNode(kind, { ...(opts.fill || {}), [INS_SLOT[kind]]: moved });
    S.cur = { row, idx: s };
    insertItem(n);
    return;
  }
  startEdit(kind === 'pow');
  const n = mkNode(kind, opts.fill);
  insertItem(n);
  const enter = opts.enter === undefined ? SLOTS[kind][0] : opts.enter;
  if (enter) S.cur = { row: n.slots[enter], idx: n.slots[enter].items.length };
}

// top-level ':' splits a multi-statement; [=] steps through the parts
function statements(row) {
  const parts = [[]];
  row.items.forEach((it) => (it.t === 'colon' ? parts.push([]) : parts[parts.length - 1].push(it)));
  return parts.map((items) => { const r = Row(); r.items = items; return r; });
}
function eqKey() {
  if (S.done && S.multi && S.multi.idx < S.multi.n - 1) { S.multi.idx++; equals(false, S.multi.idx); return; }
  equals();
}
function equals(record = true, part = 0) {
  if (!S.root.items.length) return;
  if (window.CASUI && CASUI.handles(S.root)) { CASUI.run(S.root, record); return; } // indefinite ∫ / d/dx
  S.note = S.fact = null;
  S.engExp = null;
  try {
    const parts = statements(S.root);
    S.multi = parts.length > 1 ? { n: parts.length, idx: part } : null;
    const row = parts[part];
    S.ans = tidy(evalRow(row));
    S.exactOK = typeof S.ans === 'number' && !hasInexact(row);
    S.view = hasDms(row) ? 'dms' : S.cfg.io === 'DecO' || S.cfg.io === 'LineDecO' ? 'dec' : 'exact';
    S.mixed = S.cfg.fracRes === 'abc';
    S.error = null;
    S.done = true;
    if (record) { S.history.push(cloneRow(S.root)); S.hIdx = S.history.length; }
  } catch (e) {
    S.error = typeof e === 'string' ? e : MATH;
    S.done = false;
  }
}
function approx() { equals(); S.view = 'dec'; }
function ensureResult() {
  if (!S.done && S.root.items.length) equals();
  return !S.error;
}

function del() {
  if (S.done) { S.done = false; S.cur = { row: S.root, idx: S.root.items.length }; return; }
  S.error = null;
  const { row, idx } = S.cur;
  if (idx > 0) {
    const it = row.items[idx - 1];
    if (isTpl(it) && it.kind !== 'pow' && !isEmptyNode(it)) { moveLeft(); return; } // step into the template
    snapshot();
    row.items.splice(idx - 1, 1);
    S.cur = { row, idx: idx - 1 };
    return;
  }
  if (row.up) {
    const { row: pr, node } = row.up;
    if (isEmptyNode(node)) {
      snapshot();
      const i = pr.items.indexOf(node);
      pr.items.splice(i, 1);
      S.cur = { row: pr, idx: i };
    } else moveLeft();
  }
}

function ac() {
  S.histView = false;
  newExpr();
  S.done = false;
  S.symRes = null;
  S.error = S.note = S.fact = null;
  S.sto = false;
  S.engExp = null;
}

function undo() {
  if (S.lastWasUndo && S.redo) { // second UNDO redoes
    const r = S.redo; S.redo = null;
    S.undo.push({ root: cloneRow(S.root), path: pathOf(S.cur) });
    S.root = r.root; S.cur = resolvePath(r.root, r.path); S.done = false;
    return;
  }
  const u = S.undo.pop();
  if (!u) return;
  S.redo = { root: cloneRow(S.root), path: pathOf(S.cur) };
  S.root = u.root;
  S.cur = resolvePath(u.root, u.path);
  S.done = false;
  S.error = S.note = S.fact = null;
}

function move(d) {
  S.note = S.fact = null;
  S.histView = false; // ◀ ▶ while viewing history: edit that entry
  if (S.done || S.error) {
    S.done = false;
    S.error = null;
    S.cur = { row: S.root, idx: d < 0 ? S.root.items.length : 0 };
    return;
  }
  if (d > 0) moveRight(); else moveLeft();
}
// ▲ ▼: open history only from an empty screen (after AC / ON); while viewing history they
// step through it; while editing they only move the cursor (slots, then wrapped rows)
function vert(d) {
  if (S.histView) { hist(d); return; }
  if (S.error || S.done) return;
  if (!S.root.items.length) {
    if (!S.history.length) return;
    S.histView = true;
    S.hIdx = d < 0 ? S.history.length - 1 : 0; // ▲ = latest, ▼ = oldest
    showHist();
    return;
  }
  if (!moveVert(d)) moveLine(d);
}
function hist(d) {
  if (!S.history.length) return;
  S.hIdx = Math.max(0, Math.min(S.history.length - 1, S.hIdx + d));
  showHist();
}
function showHist() {
  S.root = cloneRow(S.history[S.hIdx]);
  S.cur = { row: S.root, idx: S.root.items.length };
  equals(false);
}
// cursor to the previous / next wrapped row of the expression, nearest horizontal position
function moveLine(d) {
  if (S.cur.row !== S.root) return;
  const cur = input.querySelector('.cursor');
  const expr = input.firstElementChild;
  if (!cur || !expr) return;
  const c = cur.getBoundingClientRect(), x = c.left;
  const els = [...expr.children].filter((e) => e !== cur);
  if (els.length !== S.root.items.length) return; // one element per item, otherwise give up
  const mid = (r) => (r.top + r.bottom) / 2;
  const rects = els.map((e) => e.getBoundingClientRect());
  const side = rects.map((r, i) => ({ i, r, m: mid(r) })).filter((o) => (d < 0 ? o.m < c.top : o.m > c.bottom));
  if (!side.length) return;
  const lineMid = d < 0 ? Math.max(...side.map((o) => o.m)) : Math.min(...side.map((o) => o.m));
  const tol = c.height * 0.6;
  let best = null, bestD = Infinity;
  side.filter((o) => Math.abs(o.m - lineMid) <= tol).forEach((o) => {
    [[o.i, o.r.left], [o.i + 1, o.r.right]].forEach(([idx, px]) => {
      const dist = Math.abs(px - x);
      if (dist < bestD) { bestD = dist; best = idx; }
    });
  });
  if (best !== null) S.cur = { row: S.root, idx: best };
}

function storeTo(name) {
  if (!ensureResult()) return;
  S.vars[name] = S.ans;
  S.note = `Ans→<i>${name}</i>`;
  S.done = true;
}
function memAdd(sign) {
  if (!ensureResult()) return;
  S.mem += sign * S.ans;
  S.note = sign > 0 ? 'Ans M+' : 'Ans M−';
  S.done = true;
}
function dmsKey() {
  if (S.done && typeof S.ans === 'number') { S.engExp = null; S.view = S.view === 'dms' ? 'dec' : 'dms'; return; }
  ins(TK.dms);
}
function factCmd() {
  if (S.fact) { S.fact = null; return; } // FACT again re-displays the value
  if (!ensureResult()) return;
  if (isInt(S.ans) && S.ans > 1 && S.ans < 1e10) S.fact = factorHTML(S.ans);
  else S.error = MATH;
}
function resetAll() {
  ac();
  S.ans = 0; S.mem = 0; S.history = []; S.hIdx = 0; S.histView = false; S.undo = [];
  Object.keys(S.vars).forEach((k) => (S.vars[k] = 0));
  S.cfg = DEFAULT_CFG();
  S.note = 'Reset All';
}

// S⇔D: exact <-> decimal
function toggleSD() {
  if (!S.done) { if (!ensureResult()) return; S.view = 'dec'; return; }
  S.engExp = null;
  S.view = S.view === 'exact' ? 'dec' : 'exact';
}
// SHIFT S⇔D: mixed fraction <-> improper fraction
function toggleMixed() {
  if (!S.done && !ensureResult()) return;
  S.engExp = null;
  S.view = 'exact';
  S.mixed = !S.mixed;
}
// ENG moves the decimal right (exponent -3), SHIFT ENG (←) moves it left (+3)
function engStep(dir) {
  if (!ensureResult()) return;
  const v = S.ans;
  if (S.engExp === null) {
    const base = v === 0 ? 0 : Math.floor(Math.log10(Math.abs(v)) / 3) * 3;
    // with Engineer Symbol on the result is already shown in engineering form (10.5M),
    // so the first press steps straight away (ENG -> 10500k), like the guide
    if (S.cfg.engSym) S.engExp = Math.abs(v / Math.pow(10, base + dir * 3)) < 1e10 ? base + dir * 3 : base;
    else S.engExp = base + (dir > 0 ? 3 : 0);
  } else {
    const next = S.engExp + dir * 3;
    if (Math.abs(v / Math.pow(10, next)) < 1e10) S.engExp = next;
  }
  S.view = 'dec';
}

/* ---------- Key layout ---------- */
// K(id, label, main, [shiftLabel, shiftAction], [alphaLabel, alphaAction | 'VAR'], cssClass, blueLabel)
const K = (id, label, m, s, a, cls, b) => ({ id, label, m, s, a, cls, b });
const I = (t) => () => ins(t);
const T = (kind, opts) => () => insTpl(kind, opts);

// small template glyphs used on key faces and labels
const SQ = '<b class="sq"></b>'; // filled square
const BX = '<b class="bx"></b>'; // hollow box
const FRAC = (n, d) => `<span class="tf"><span>${n}</span><span>${d}</span></span>`;
const ROOT = (x) => `<span class="rt">√<span class="rt-in">${x}</span></span>`;
const HEX = (l) => [`<span class="hex">${l}</span>`, l];

const TOP = [
  { id: 'shift', area: 'shift', round: true, top: ['s', 'SHIFT'], mod: () => { S.shift = !S.shift; S.alpha = false; } },
  { id: 'alpha', area: 'alpha', round: true, top: ['a', 'ALPHA'], mod: () => { S.alpha = !S.alpha; S.shift = false; } },
  { id: 'menu', area: 'menu', round: true, top: ['w', 'MENU'], top2: ['s', 'SETUP'], m: openMenu, s: ['SETUP', openSetup] },
  { id: 'on', area: 'on', round: true, top: ['w', 'ON'], m: () => { S.screen = 'calc'; ac(); } },
  K('optn', 'OPTN', calcOptn, ['ABOUT', () => openAbout()]),
  K('calc', 'CALC', () => startSolve('calc'), ['SOLVE', () => startSolve('solve')], ['<span class="dbl">=</span>', I(TK.eqs)]),
  K('integ', `<span class="integ">∫<span class="lim">${BX}${BX}</span><b class="bar"></b></span>`, () => calcTpl('integ'),
    [`${FRAC('d', 'dx')}${SQ}`, () => calcTpl('deriv')], [':', I(TK.colon)]),
  K('xvar', '<i>x</i>', () => ins(varTok('x')), [`<span class="sig">Σ</span>${SQ}`, T('sigma')]),
];
TOP[4].area = 'optn'; TOP[5].area = 'calc'; TOP[6].area = 'integ'; TOP[7].area = 'xvar';

const FN = [
  K('frac', '<span class="frac-ic"><b></b><hr><b></b></span>', insFrac,
    [`${SQ}<span class="frac-ic mini"><b></b><hr><b></b></span>`, T('mixed')]),
  K('sqrt', ROOT(SQ), T('sqrt'), [`<sup>3</sup>${ROOT(SQ)}`, T('root', { fill: { idx: [digit('3')] }, enter: 'arg' })]),
  K('sq', '<i>x</i><sup>2</sup>', T('pow', { fill: { exp: [digit('2')] }, enter: null }),
    ['<i>x</i><sup>3</sup>', T('pow', { fill: { exp: [digit('3')] }, enter: null })], null, '', 'DEC'),
  K('pow', `<i>x</i><sup>${SQ}</sup>`, T('pow'), [`<sup>${SQ}</sup>${ROOT(BX)}`, T('root')], null, '', 'HEX'),
  K('log', `log<sub>${SQ}</sub>${BX}`, T('logab'), [`10<sup>${SQ}</sup>`, T('pow10')], null, '', 'BIN'),
  K('ln', 'ln', I(TK.ln), [`<i>e</i><sup>${SQ}</sup>`, T('exp')], null, '', 'OCT'),

  K('neg', '(−)', I(TK.neg), ['log', I(TK.log)], HEX('A')),
  K('dms', '°&thinsp;’&thinsp;”', dmsKey, ['FACT', factCmd], HEX('B')),
  K('inv', '<i>x</i><sup>−1</sup>', I(TK.inv), ['<i>x</i>!', I(TK.fact)], HEX('C')),
  K('sin', 'sin', I(TK.sin), ['sin<sup>−1</sup>', I(TK.asin)], HEX('D')),
  K('cos', 'cos', I(TK.cos), ['cos<sup>−1</sup>', I(TK.acos)], HEX('E')),
  K('tan', 'tan', I(TK.tan), ['tan<sup>−1</sup>', I(TK.atan)], HEX('F')),

  K('sto', 'STO', () => { S.sto = true; }, ['RECALL', openRecall]),
  K('eng', 'ENG', () => engStep(-1), ['<span class="cpx">∠</span><span class="nv">←</span>', () => engStep(1)], ['<i class="nv">i</i>', null]),
  K('open', '(', I(TK.open), ['Abs', T('abs')]),
  K('close', ')', I(TK.close), [',', I(TK.comma)], ['<i>x</i>', 'x']),
  K('sd', 'S⇔D', toggleSD, [`a${FRAC('b', 'c')}⇔${FRAC('d', 'c')}`, toggleMixed], ['<i>y</i>', 'y']),
  K('mplus', 'M+', () => memAdd(1), ['M−', () => memAdd(-1)], ['M', 'M']),
];

const NUM = [
  K('7', '7', I(digit('7')), ['CONST', constMenu]),
  K('8', '8', I(digit('8')), ['CONV', convMenu]),
  K('9', '9', I(digit('9')), ['RESET', resetMenu]),
  K('del', 'DEL', del, ['INS', () => { S.insArm = true; }], ['UNDO', undo], 'tan'),
  K('ac', 'AC', ac, ['OFF', () => { ac(); S.power = false; }], null, 'tan'),

  K('4', '4', I(digit('4'))),
  K('5', '5', I(digit('5'))),
  K('6', '6', I(digit('6'))),
  K('mul', '<span class="opr">×</span>', I(TK.mul), ['nPr', I(TK.npr)]),
  K('div', '<span class="opr">÷</span>', I(TK.div), ['nCr', I(TK.ncr)]),

  K('1', '1', I(digit('1'))),
  K('2', '2', I(digit('2'))),
  K('3', '3', I(digit('3'))),
  K('add', '<span class="opr">+</span>', I(TK.add), ['Pol', I(TK.pol)]),
  K('sub', '<span class="opr">−</span>', I(TK.sub), ['Rec', I(TK.rec)]),

  K('0', '0', I(digit('0')), ['Rnd', I(TK.rnd)]),
  K('dot', '<span class="dot"></span>', I(digit('.')), ['Ran#', I(TK.ran)], ['RanInt', I(TK.ranInt)]),
  K('exp', '<span class="x10">×10<sup><i>x</i></sup></span>', I(TK.E), ['<i>π</i>', I(TK.pi)], ['<i>e</i>', I(TK.e)], 'small'),
  K('ans', 'Ans', I(TK.ans), ['%', I(TK.pct)], null, 'small'),
  K('eq', '<span class="opr">=</span>', eqKey, ['≈', approx]),
];

const PAD = [
  { id: 'up', cls: 'up', m: () => vert(-1) },
  { id: 'down', cls: 'down', m: () => vert(1) },
  { id: 'left', cls: 'left', m: () => move(-1) },
  { id: 'right', cls: 'right', m: () => move(1) },
];

const KEYS = {};

/* ---------- Building the UI ---------- */
// single-symbol labels (π, e, %, ≈, =, …) get a larger size so they read like the words around them
const lab = (cls, html) => `<span class="${cls}${html.replace(/<[^>]*>|&[a-z]+;/g, '').trim().length === 1 ? ' one' : ''}">${html}</span>`;
function labelsHTML(k) {
  let h = '';
  if (k.top) h += lab(k.top[0], k.top[1]);
  if (k.top2) h += lab(k.top2[0], k.top2[1]);
  if (k.s && !k.top2) h += lab('s', k.s[0]);
  if (k.a) h += lab('a', k.a[0]);
  if (k.b) h += `<span class="b">${k.b}</span>`;
  return `<div class="labels">${h}</div>`;
}

function makeKey(k, btnClass) {
  const wrap = document.createElement('div');
  wrap.className = `key k-${k.id}`;
  if (k.area) wrap.style.gridArea = k.area;
  wrap.innerHTML = labelsHTML(k);
  const b = document.createElement('button');
  b.className = `${btnClass} ${k.cls || ''}`;
  b.innerHTML = `<span class="face">${k.label || ''}</span>`;
  b.setAttribute('aria-label', k.id);
  wrap.appendChild(b);
  bindPress(wrap, b, k);
  k.el = b;
  KEYS[k.id] = k;
  return wrap;
}

// Fire on touch-down instead of click: click waits for the finger to lift,
// which feels laggy on phones. The pressed look stays until the finger lifts.
function bindPress(target, flashEl, k) {
  let downAt = 0;
  const release = () => {
    const wait = Math.max(0, 90 - (performance.now() - downAt));
    setTimeout(() => flashEl.classList.remove('flash'), wait);
  };
  target.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    downAt = performance.now();
    flashEl.classList.add('flash');
    press(k);
  });
  target.addEventListener('pointerup', release);
  target.addEventListener('pointercancel', release);
  // keyboard activation (Enter/Space on a focused button) still arrives as click with detail 0
  target.addEventListener('click', (e) => {
    if (e.detail !== 0) return;
    downAt = performance.now();
    flashEl.classList.add('flash');
    press(k);
    release();
  });
}

function build() {
  const top = $('#top');
  TOP.forEach((k) => top.appendChild(makeKey(k, k.round ? 'round' : 'fn-btn')));

  // D-pad drawn as SVG: up/down = angled chevron bands, left/right = rhombi
  const pad = document.createElement('div');
  pad.className = 'dpad';
  // Coordinates traced from the reference photo, origin = pad center.
  const SHAPES = {
    up: 'M-111.6 -109.7 L-25.3 -163.4 A48 48 0 0 1 25.3 -163.4 L111.6 -109.7 L72 -46 L0 -72 L-72 -46 Z',
    down: 'M-111.6 109.7 L-25.3 163.4 A48 48 0 0 0 25.3 163.4 L111.6 109.7 L72 46 L0 72 L-72 46 Z',
    left: 'M-132 -97 L-222.6 -40.8 A48 48 0 0 0 -222.6 40.8 L-132 97 L-92.4 33.3 Q-128 0 -92.4 -33.3 Z',
    right: 'M132 -97 L222.6 -40.8 A48 48 0 0 1 222.6 40.8 L132 97 L92.4 33.3 Q128 0 92.4 -33.3 Z',
  };
  const GRAD = { up: [0, 0, 0, 1], down: [0, 1, 0, 0], left: [0, 0, 1, 0], right: [1, 0, 0, 0] };
  // rounded rhombus: straight sides, every vertex rounded with the same r=70 arc
  // (buttons are inset 22 units, so their outer corners use r=48 on the same centers)
  const BASE = 'M-234.3 -59.5 L-36.9 -182 A70 70 0 0 1 36.9 -182 L234.3 -59.5 A70 70 0 0 1 234.3 59.5 '
    + 'L36.9 182 A70 70 0 0 1 -36.9 182 L-234.3 59.5 A70 70 0 0 1 -234.3 -59.5 Z';
  // recessed well inside the rim (inset 12, r=58, same arc centers)
  const WELL = 'M-227.9 -49.2 L-30.6 -171.8 A58 58 0 0 1 30.6 -171.8 L227.9 -49.2 A58 58 0 0 1 227.9 49.2 '
    + 'L30.6 171.8 A58 58 0 0 1 -30.6 171.8 L-227.9 49.2 A58 58 0 0 1 -227.9 -49.2 Z';
  pad.innerHTML = `
    <svg class="dpad-base" viewBox="-300 -200 600 400">
      <defs>
        ${PAD.map((k) => {
          const [x1, y1, x2, y2] = GRAD[k.id];
          return `<linearGradient id="g-${k.id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
            <stop offset="0" stop-color="#8592a7"/><stop offset=".55" stop-color="#76849a"/><stop offset="1" stop-color="#58657a"/>
          </linearGradient>`;
        }).join('')}
        <linearGradient id="g-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#d6dee8"/><stop offset=".5" stop-color="#bac6d5"/><stop offset="1" stop-color="#9aa9be"/>
        </linearGradient>
        <linearGradient id="g-well" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#93a3b9"/><stop offset="1" stop-color="#b1bdcd"/>
        </linearGradient>
        <!-- raised bevel: specular light from upper-left on a blurred height map -->
        <filter id="bevel" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="h"/>
          <feSpecularLighting in="h" surfaceScale="5" specularConstant=".75" specularExponent="16" lighting-color="#ffffff" result="spec">
            <fePointLight x="-250" y="-700" z="380"/>
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
          <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3=".9" k4="0"/>
        </filter>
        <!-- recessed well: inner shadow along the top edge -->
        <filter id="inset" x="-10%" y="-10%" width="120%" height="120%">
          <feComponentTransfer in="SourceAlpha" result="inv"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>
          <feOffset in="inv" dy="9" result="off"/>
          <feGaussianBlur in="off" stdDeviation="7" result="blur"/>
          <feFlood flood-color="#2e3a4c" flood-opacity=".75"/>
          <feComposite in2="blur" operator="in" result="shadow"/>
          <feComposite in="shadow" in2="SourceAlpha" operator="in" result="innerShadow"/>
          <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="innerShadow"/></feMerge>
        </filter>
        <filter id="lift" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#1d2533" flood-opacity=".45"/>
        </filter>
      </defs>
      <!-- raised rim -->
      <path d="${BASE}" fill="url(#g-base)" filter="url(#bevel)"/>
      <path d="${BASE}" fill="none" stroke="#7c8ca3" stroke-width="3"/>
      <!-- sunken well -->
      <path d="${WELL}" fill="url(#g-well)" filter="url(#inset)"/>
    </svg>
    <svg class="dpad-keys" viewBox="-300 -200 600 400">
      <!-- buttons: dark extruded side + beveled top face -->
      ${PAD.map((k) => `<g class="pad-btn" data-id="${k.id}" role="button" aria-label="${k.id}">
          <path class="side" d="${SHAPES[k.id]}" transform="translate(0 9)" filter="url(#lift)"/>
          <path class="face" d="${SHAPES[k.id]}" fill="url(#g-${k.id})" stroke="url(#g-${k.id})" filter="url(#bevel)"/>
        </g>`).join('')}
    </svg>`;
  PAD.forEach((k) => {
    const el = pad.querySelector(`[data-id="${k.id}"]`);
    bindPress(el, el, k);
    k.el = el;
    KEYS[k.id] = k;
  });
  top.appendChild(pad);

  FN.forEach((k) => $('#fn').appendChild(makeKey(k, 'fn-btn')));
  NUM.forEach((k) => $('#num').appendChild(makeKey(k, 'num-btn')));
}

/* ---------- Key press dispatch ---------- */
function press(key) {
  if (!S.power) {
    if (key.id === 'on') { S.power = true; S.screen = 'calc'; ac(); render(); }
    return;
  }
  if (key.mod) { key.mod(); render(); return; }

  if (key.id !== 'up' && key.id !== 'down') S.histView = false;
  const shifted = S.shift;
  const layer = S.shift ? key.s : S.alpha ? key.a : null;
  const wasSto = S.sto;
  S.shift = S.alpha = S.sto = false;

  const alpha = layer === key.a && !shifted && !!key.a;
  if (S.screen !== 'calc') { screenKey(key.id, shifted, alpha); render(); return; }
  // after an indefinite result: 1 = Steps, 2 = Steps with notation (only while those buttons show)
  if (window.CASUI && CASUI.calcKey(key.id, shifted, alpha)) { render(); return; }

  // an active extra mode may take over keys on the calculation screen (e.g. OPTN, i, hex digits)
  const app = curApp();
  if (app && app.calcKey && app.calcKey(key.id, { shift: shifted, alpha })) { render(); return; }

  if (wasSto && key.a && typeof key.a[1] === 'string') {
    storeTo(key.a[1]);
    render();
    return;
  }

  let act = layer ? layer[1] : key.m;
  if (typeof act === 'string') { const name = act; act = () => ins(varTok(name)); }
  const armed = S.insArm;
  if (act) act();
  S.lastWasUndo = act === undo;
  if (armed && S.insArm) S.insArm = false; // INS lasts for one key only
  render();
}

/* ---------- Rendering ---------- */
const input = $('#input');
const result = $('#result');
const panel = $('#panel');
const CURSOR = '<span class="cursor"></span>';

function rowHTML(row, editing) {
  const here = editing && S.cur.row === row;
  if (!row.items.length) {
    if (!row.up) return here ? CURSOR : '';
    return `<span class="slot">${here ? CURSOR : ''}</span>`;
  }
  let h = '';
  row.items.forEach((it, i) => {
    if (here && S.cur.idx === i) h += CURSOR;
    h += itemHTML(it, editing);
  });
  if (here && S.cur.idx === row.items.length) h += CURSOR;
  return h;
}
// 13⌟6 / 2⌟1⌟6 fraction output used by LineI/LineO
function lineFrac(e, mixed) {
  const a = Math.abs(e.p), sg = e.p < 0 ? '−' : '';
  if (mixed && a > e.q) return `${sg}${Math.trunc(a / e.q)}⌟${a % e.q}⌟${e.q}`;
  return `${sg}${a}⌟${e.q}`;
}
// one-line form of a template (LineI input)
function itemLine(it, ed) {
  const R = (s) => rowHTML(it.slots[s], ed);
  switch (it.kind) {
    case 'frac': return `${R('num')}⌟${R('den')}`;
    case 'mixed': return `${R('whole')}⌟${R('num')}⌟${R('den')}`;
    case 'sqrt': return `√(${R('arg')})`;
    case 'root': return `${R('idx')}<sup>x</sup>√(${R('arg')})`;
    case 'pow': return `^(${R('exp')})`;
    case 'pow10': return `10^(${R('exp')})`;
    case 'exp': return `<i>e</i>^(${R('exp')})`;
    case 'logab': return `log(${R('base')},${R('arg')})`;
    case 'abs': return `Abs(${R('arg')})`;
    case 'integ': return `∫(${R('f')},${R('lo')},${R('hi')})`;
    case 'deriv': return `<span class="tf"><span>d</span><span>d<i>x</i></span></span>(${R('f')},${R('at')})`;
    case 'sigma': return `Σ(${R('f')},${R('lo')},${R('hi')})`;
    case 'iinteg': return `∫(${R('f')})d<i>x</i>`;
    case 'ideriv': return `<span class="tf"><span>d</span><span>d<i>x</i></span></span>(${R('f')})`;
  }
  return '';
}
// stretchy parentheses / integral sign: SVG that grows with the content height
const STRETCH = (cls, d) => `<span class="${cls}"><svg viewBox="0 0 10 100" preserveAspectRatio="none"><path d="${d}"/></svg></span>`;
const PAR = (h) => `<span class="nd-par">${STRETCH('pl', 'M8 3Q1 50 8 97')}<span class="body">${h}</span>${STRETCH('pr', 'M2 3Q9 50 2 97')}</span>`;
const INT_SIGN = STRETCH('sym', 'M9 4C8 0 5.5 0.5 5.4 8L4.6 92C4.5 99.5 2 100 1 96');
function itemHTML(it, ed) {
  if (isTpl(it) && (S.cfg.io === 'LineO' || S.cfg.io === 'LineDecO')) return itemLine(it, ed);
  if (!isTpl(it)) {
    const d = it.t === 'num' && it.d === '.' ? S.cfg.decMark : it.d;
    // only lowercase variables (x, y) are italic, like the real display
    return `<span class="tk${it.var && /^[a-z]$/.test(it.d) ? ' var' : ''}">${d}</span>`;
  }
  const R = (s) => rowHTML(it.slots[s], ed);
  switch (it.kind) {
    case 'frac': return `<span class="nd-frac"><span class="num">${R('num')}</span><span class="den">${R('den')}</span></span>`;
    case 'mixed': return `<span class="nw">${R('whole')}<span class="nd-frac"><span class="num">${R('num')}</span><span class="den">${R('den')}</span></span></span>`;
    case 'sqrt': return `<span class="nd-sqrt"><span class="rad">√</span><span class="ov">${R('arg')}</span></span>`;
    case 'root': return `<span class="nd-sqrt"><span class="idx">${R('idx')}</span><span class="rad">√</span><span class="ov">${R('arg')}</span></span>`;
    case 'pow': return `<span class="nd-sup">${R('exp')}</span>`;
    case 'pow10': return `<span class="nw">10<span class="nd-sup">${R('exp')}</span></span>`;
    case 'exp': return `<span class="nw"><i>e</i><span class="nd-sup">${R('exp')}</span></span>`;
    case 'logab': return `<span class="nw">log<span class="nd-sub">${R('base')}</span>${PAR(R('arg'))}</span>`;
    case 'abs': return `<span class="nd-abs">${R('arg')}</span>`;
    // integrand sits inside the template so the ∫ sign and its limits stretch with it
    case 'integ':
      return `<span class="nd-int">${INT_SIGN}<span class="lims"><span class="hi">${R('hi')}</span>`
        + `<span class="lo">${R('lo')}</span></span><span class="body">${R('f')}</span><i class="dx">dx</i></span>`;
    case 'deriv':
      return `<span class="nd-der"><span class="nd-frac"><span class="num">d</span><span class="den"><i>dx</i></span></span>`
        + `${PAR(R('f'))}<span class="bar"></span><span class="sub"><i>x</i>=${R('at')}</span></span>`;
    case 'sigma':
      return `<span class="nd-sum"><span class="nd-sig"><span class="hi">${R('hi')}</span><span class="sym">Σ</span>`
        + `<span class="lo"><i>x</i>=${R('lo')}</span></span>${PAR(R('f'))}</span>`;
    // Indefinite mode: no limits, no evaluation point
    case 'iinteg':
      return `<span class="nd-int cas-int">${INT_SIGN}<span class="body">${R('f')}</span><i class="dx">dx</i></span>`;
    case 'ideriv':
      return `<span class="nd-der"><span class="nd-frac"><span class="num">d</span><span class="den"><i>dx</i></span></span>${PAR(R('f'))}</span>`;
  }
  return '';
}

// Give numerator and denominator the same height so every fraction bar sits on the
// math axis (vertical-align: middle), however deep a^b/c or (a/b)/(c/d) nest.
// Innermost fractions first, since they change the size of the outer ones.
function balanceFracs(root) {
  const fr = root.querySelectorAll('.nd-frac');
  for (let i = fr.length - 1; i >= 0; i--) {
    const num = fr[i].children[0], den = fr[i].children[1];
    if (!num || !den) continue;
    const d = num.offsetHeight - den.offsetHeight;
    if (d < 0) num.style.paddingTop = `${-d}px`;
    else if (d > 0) den.style.paddingBottom = `${d}px`;
  }
}
// keep the cursor's line (the whole top-level template it is in) inside the 5-row input area
function scrollToCursor() {
  const cur = input.querySelector('.cursor');
  if (!cur) { input.scrollTop = 0; return; }
  const expr = input.firstElementChild;
  let el = cur;
  while (el.parentElement && el.parentElement !== expr) el = el.parentElement;
  const ir = input.getBoundingClientRect();
  const a = el.getBoundingClientRect(), c = cur.getBoundingClientRect();
  const top = Math.min(a.top, c.top) - ir.top + input.scrollTop;
  const bot = Math.max(a.bottom, c.bottom) - ir.top + input.scrollTop;
  const h = input.clientHeight;
  if (bot - top > h) input.scrollTop = c.top - ir.top + input.scrollTop - h / 2; // taller than the screen: follow the cursor itself
  else if (top < input.scrollTop) input.scrollTop = top;
  else if (bot > input.scrollTop + h) input.scrollTop = bot - h;
}

function render() {
  const calc = $('#calc');
  calc.classList.toggle('off', !S.power);
  const ink = `rgba(14, 20, 16, ${0.5 + S.cfg.contrast * 0.055})`;
  if (ink !== render.ink) { render.ink = ink; $('.lcd').style.setProperty('--lcd-ink', ink); } // restyles the whole LCD, so only when it changes

  const ind = (id, on, text) => {
    const el = $('#ind-' + id);
    el.classList.toggle('on', on);
    if (text !== undefined) el.textContent = text;
  };
  ind('S', S.shift);
  ind('A', S.alpha);
  ind('M', S.mem !== 0);
  ind('STO', S.sto);
  ind('MATH', S.cfg.io === 'MathO' || S.cfg.io === 'DecO');
  ind('DISP', !!(S.multi && S.done && S.screen === 'calc'));
  const histEmpty = !S.done && !S.error && !S.root.items.length;
  ind('HIST', S.screen === 'calc' && S.history.length > 0 && (S.histView || histEmpty),
    S.histView ? `${S.hIdx > 0 ? '▲' : ''}${S.hIdx < S.history.length - 1 ? '▼' : ''}` : '▲▼');
  ind('FMT', S.cfg.fmt.type !== 'Norm', S.cfg.fmt.type.toUpperCase());
  ind('E', S.cfg.engSym);
  $('#ind-angle').textContent = S.cfg.angle;
  const appInd = curApp() && curApp().indicator ? curApp().indicator() : '';
  ind('APP', !!appInd, appInd);
  KEYS.shift.el.classList.toggle('active', S.shift);
  KEYS.alpha.el.classList.toggle('active', S.alpha);

  const onCalc = S.screen === 'calc';
  calc.classList.toggle('screen-panel', !onCalc);
  panel.dataset.screen = S.screen; // lets CSS lay out individual screens (e.g. centre the MENU)
  const symShown = onCalc && !!(S.done && S.symRes && !S.error && window.CASUI);
  calc.classList.toggle('cas-sym', symShown);
  if (!onCalc) {
    panel.innerHTML = panelHTML();
    balanceFracs(panel);
    if (S.screen === 'steps') CASUI.afterRender(); // keep the scroll position of the steps
    return;
  }

  // expression line
  input.innerHTML = `<span class="expr">${S.note || rowHTML(S.root, !S.done)}</span>`;
  balanceFracs(input);
  scrollToCursor();

  // result line
  let r = '';
  if (symShown) r = CASUI.resultHTML(); // indefinite ∫ / d/dx answer + step buttons
  else if (S.error) r = `<span class="err">${S.error}</span>`;
  else if (S.fact) r = S.fact;
  else if (S.done && typeof S.ans !== 'number') {
    const h = TYPES[typeOf(S.ans)];
    r = h && h.html ? h.html(S.ans) : '?';
  } else if (S.done && HOOKS.fmtResult && HOOKS.fmtResult(S.ans) != null) {
    r = HOOKS.fmtResult(S.ans);
  } else if (S.done) {
    const line = S.cfg.io === 'LineO' || S.cfg.io === 'LineDecO';
    let e = S.engExp === null && S.view === 'exact' && S.exactOK ? exactOf(S.ans) : null;
    if (e && line && e.k !== 'rat') e = null; // Line output: fractions only (no √ / π forms)
    if (S.view === 'dms') r = dmsHTML(S.ans);
    else if (e && e.k === 'rat' && line) r = lineFrac(e, S.mixed);
    else r = e && e.k !== 'int' ? exactHTML(e, S.mixed) : fmtNum(S.ans);
  }
  result.innerHTML = `<span class="res">${r}</span>`;
  balanceFracs(result);
}

/* ---------- Keyboard support ---------- */
const KEYMAP = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  '.': 'dot', ',': 'dot', '+': 'add', '-': 'sub', '*': 'mul', 'x': 'mul', '/': 'frac',
  '^': 'pow', '(': 'open', ')': 'close', 'Enter': 'eq', '=': 'eq',
  'Backspace': 'del', 'Delete': 'del', 'Escape': 'ac', 'm': 'menu',
  'ArrowLeft': 'left', 'ArrowRight': 'right', 'ArrowUp': 'up', 'ArrowDown': 'down',
  's': 'sin', 'c': 'cos', 't': 'tan', 'l': 'log', 'n': 'ln', 'r': 'sqrt', 'a': 'ans', 'e': 'exp', 'd': 'sd',
};
const KEYINS = { 'p': TK.pi, '!': TK.fact, '%': TK.pct };

document.addEventListener('keydown', (ev) => {
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (ev.key === 'Shift') return;
  if (KEYINS[ev.key] && S.power && S.screen === 'calc') { ins(KEYINS[ev.key]); render(); ev.preventDefault(); return; }
  const id = KEYMAP[ev.key];
  if (!id) return;
  ev.preventDefault();
  const k = KEYS[id];
  S.shift = S.alpha = false;
  press(k);
  k.el.classList.add('flash');
  setTimeout(() => k.el.classList.remove('flash'), 100);
});

newExpr();
build();
render();
