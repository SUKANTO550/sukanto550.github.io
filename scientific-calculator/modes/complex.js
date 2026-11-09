'use strict';

/* =========================================================
   MENU 2: Complex  and  MENU 3: Base-N
   Both use the normal expression screen; they plug into the
   engine through TYPES.complex, HOOKS and app.calcKey.
   ========================================================= */

document.head.insertAdjacentHTML('beforeend', `<style>
  .cx-sm { font-size: .72em; }
  .cx-xs { font-size: .56em; }
  .bn-bin { display: inline-flex; flex-direction: column; align-items: flex-end; font-size: .5em; line-height: 1.1; letter-spacing: .04em; }
</style>`);

// fresh start for a mode: the real calculator clears history when the mode changes
function cxClearHistory() {
  S.history = []; S.hIdx = 0; S.undo = [];
}

/* ===================== Complex numbers ===================== */

// build a value: imaginary part 0 -> plain number (keeps fractions/surds working for reals)
function cxMake(re, im) {
  re = tidy(re); im = tidy(im);
  if (Math.abs(im) < 1e-12 * Math.abs(re)) im = 0;
  if (Math.abs(re) < 1e-12 * Math.abs(im)) re = 0;
  return im === 0 ? re : { type: 'complex', re, im };
}
// any value -> {re, im}
const cxParts = (v) => (typeof v === 'number' ? { re: v, im: 0 } : { re: v.re, im: v.im });

function cxMul(a, b) {
  const x = cxParts(a), y = cxParts(b);
  return cxMake(x.re * y.re - x.im * y.im, x.re * y.im + x.im * y.re);
}
function cxDiv(a, b) {
  const x = cxParts(a), y = cxParts(b);
  const d = y.re * y.re + y.im * y.im;
  if (d === 0) throw MATH;
  return cxMake((x.re * y.re + x.im * y.im) / d, (x.im * y.re - x.re * y.im) / d);
}
const cxAbs = (v) => { const p = cxParts(v); return Math.hypot(p.re, p.im); };
const cxArgRad = (v) => { const p = cxParts(v); return Math.atan2(p.im, p.re); };
function cxLn(v) {
  const p = cxParts(v);
  if (p.re === 0 && p.im === 0) throw MATH;
  return cxMake(Math.log(Math.hypot(p.re, p.im)), Math.atan2(p.im, p.re));
}
function cxExp(v) {
  const p = cxParts(v), m = Math.exp(p.re);
  return cxMake(m * Math.cos(p.im), m * Math.sin(p.im));
}
function cxSqrt(v) {
  const p = cxParts(v);
  const r = Math.hypot(p.re, p.im);
  const re = Math.sqrt((r + p.re) / 2);
  const im = Math.sqrt((r - p.re) / 2) * (p.im < 0 ? -1 : 1);
  return cxMake(re, im);
}
function cxPow(a, b) {
  // integer exponent: repeated squaring (keeps results like (1+i)^4 = -4 exact)
  if (typeof b === 'number' && isInt(b) && Math.abs(b) <= 1024) {
    let r = 1, base = a, n = Math.abs(b);
    while (n) {
      if (n & 1) r = cxMul(r, base);
      base = cxMul(base, base);
      n >>= 1;
    }
    return b < 0 ? cxDiv(1, r) : r;
  }
  const x = cxParts(a);
  if (x.re === 0 && x.im === 0) {
    if (cxParts(b).re > 0) return 0;
    throw MATH;
  }
  return cxExp(cxMul(b, cxLn(a)));
}
// SETUP > Complex: default result form, 'abi' (a+bi) or 'polar' (r∠θ)
window.ComplexSetup = window.ComplexSetup || { form: 'abi' };
const cxForm = () => (window.ComplexSetup && window.ComplexSetup.form === 'polar' ? 'polar' : 'abi');

// ▶r∠θ / ▶a+bi only change how the result is shown: they must end the expression
// (a postfix token binds to the last operand, so the value itself is left unchanged)
const cxSuffix = () => {
  const last = S.root && S.root.items.at(-1);
  return last === CX_TK.toPolar ? 'polar' : last === CX_TK.toRect ? 'abi' : null;
};
const cxPolarShown = () => (cxSuffix() || cxForm()) === 'polar';

// complex functions by display name (see Ops.fn); undefined -> Math ERROR
const CX_FN = {
  '√': cxSqrt,
  'Abs': cxAbs,
  '⁻¹': (z) => cxDiv(1, z),
  '%': (z) => cxDiv(z, 100),
  'ln(': cxLn,
  'log(': (z) => cxDiv(cxLn(z), Math.LN10),
  'Arg(': (z) => tidy(fromRad(cxArgRad(z))),
  'Conjg(': (z) => cxMake(z.re, -z.im),
  'ReP(': (z) => z.re,
  'ImP(': (z) => z.im,
  '▶r∠θ': (z) => z,
  '▶a+b<i>i</i>': (z) => z,
};

TYPES.complex = {
  add: (a, b) => { const x = cxParts(a), y = cxParts(b); return cxMake(x.re + y.re, x.im + y.im); },
  sub: (a, b) => { const x = cxParts(a), y = cxParts(b); return cxMake(x.re - y.re, x.im - y.im); },
  mul: cxMul,
  div: cxDiv,
  neg: (a) => cxMake(-a.re, -a.im),
  pow: cxPow,
  fn: (name, z) => (CX_FN[name] ? CX_FN[name](z) : undefined),
  check: (v) => { if (!Number.isFinite(v.re) || !Number.isFinite(v.im)) throw MATH; },
  html: cxHTML,
};

// one real part: exact (fraction / surd / π) when Math output allows it, else decimal.
// coef: imaginary coefficient -> two-term exact forms get brackets, (1+√2)i
function cxPartHTML(x, coef) {
  const exact = S.cfg.io === 'MathO' && S.view === 'exact' && S.engExp === null && !hasInexact(S.root);
  const e = exact ? exactOf(x) : null;
  if (!e || e.k === 'int') return fmtNum(x);
  const h = exactHTML(e, false);
  return coef && (e.k === 'ratsurd' || e.k === 'surd2') ? `(${h})` : h;
}
function cxHTML(v) {
  let h;
  if (cxPolarShown()) {
    const r = tidy(cxAbs(v)), th = tidy(fromRad(cxArgRad(v)));
    h = `${cxPartHTML(r)}∠${cxPartHTML(th)}`;
  } else {
    const a = Math.abs(v.im);
    const re = v.re !== 0 ? cxPartHTML(v.re) : '';
    const sign = v.im < 0 ? '−' : re ? '+' : '';
    h = `${re}${sign}${a === 1 ? '' : cxPartHTML(a, true)}<i>i</i>`;
  }
  // shrink long results so they fit on the result line
  const len = h.replace(/<[^>]+>/g, '').length;
  return len > 20 ? `<span class="cx-xs">${h}</span>` : len > 14 ? `<span class="cx-sm">${h}</span>` : h;
}

const CX_TK = {
  i: { d: '<i>i</i>', t: 'const', v: () => ({ type: 'complex', re: 0, im: 1 }) },
  // polar entry r∠θ (θ in the current angle unit); same priority as nPr/nCr like the real calculator
  angle: {
    d: '∠', t: 'op', op: 'custom', level: 'comb',
    f: (r, th) => {
      if (typeof r !== 'number' || typeof th !== 'number') throw MATH;
      const t = toRad(th);
      return cxMake(r * Math.cos(t), r * Math.sin(t));
    },
  },
  // real arguments go through HOOKS.num.fn -> f(x)
  arg: F('Arg(', (x) => (x < 0 ? fromRad(Math.PI) : 0)),
  conj: F('Conjg(', (x) => x),
  rep: F('ReP(', (x) => x),
  imp: F('ImP(', () => 0),
  toPolar: { d: '▶r∠θ', t: 'post', f: (x) => x },
  toRect: { d: '▶a+b<i>i</i>', t: 'post', f: (x) => x },
};

// real-number maths in Complex mode: √(negative) gives an imaginary result
const CX_NUM = {
  fn(name, f, x) {
    if (name === '√' && x < 0) return cxMake(0, Math.sqrt(-x));
    return f(x);
  },
};

// Ans / variables holding complex values are not usable outside this mode
function cxDropComplex() {
  if (typeof S.ans !== 'number') S.ans = 0;
  Object.keys(S.vars).forEach((k) => { if (typeof S.vars[k] !== 'number') S.vars[k] = 0; });
}

registerApp('2', {
  name: 'Complex',
  indicator: () => (cxForm() === 'polar' ? '∠' : 'i'),
  enter() {
    S.screen = 'calc';
    cxClearHistory();
    HOOKS.num = CX_NUM;
    // real results stay plain, except an explicit ▶r∠θ: r∠0 / r∠180
    HOOKS.fmtResult = (v) => (cxSuffix() === 'polar' ? cxHTML(v) : null);
  },
  leave() {
    cxClearHistory();
    cxDropComplex();
  },
  calcKey(id, mods) {
    if (mods.alpha) return false;
    if (id === 'eng') { ins(mods.shift ? CX_TK.angle : CX_TK.i); return true; }
    if (id === 'mplus' && typeof S.ans !== 'number' && (S.done || !S.root.items.length)) {
      S.error = MATH; // M+/M− only take real values
      return true;
    }
    if (id === 'optn' && !mods.shift) {
      openList([
        { label: 'Argument', act: () => ins(CX_TK.arg) },
        { label: 'Conjugate', act: () => ins(CX_TK.conj) },
        { label: 'Real Part', act: () => ins(CX_TK.rep) },
        { label: 'Imaginary Part', act: () => ins(CX_TK.imp) },
        { label: '▶r∠θ', act: () => ins(CX_TK.toPolar) },
        { label: '▶a+b<i>i</i>', act: () => ins(CX_TK.toRect) },
      ]);
      return true;
    }
    return false;
  },
});

/* ===================== Base-N ===================== */

const BN = {
  base: 10,
  NAMES: { 10: 'Dec', 16: 'Hex', 2: 'Bin', 8: 'Oct' },
  DIGITS: { 10: /^[0-9]+$/, 16: /^[0-9A-F]+$/, 2: /^[01]+$/, 8: /^[0-7]+$/ },
  MAXLEN: { 10: 10, 16: 8, 2: 32, 8: 11 },
  PREFIX: { d: 10, h: 16, b: 2, o: 8 },
};
const BN_MIN = -2147483648, BN_MAX = 2147483647;

// keep a value in the signed 32-bit range
function bnCheck(v) {
  if (!isInt(v) || v < BN_MIN || v > BN_MAX) throw MATH;
  return v;
}
// literal in the current base (or with a d/h/b/o prefix); NaN -> Syntax ERROR
function bnParse(str) {
  let base = BN.base;
  const m = /^([dhbo])?(.*)$/.exec(str);
  if (m[1]) base = BN.PREFIX[m[1]];
  const s = m[2];
  if (!BN.DIGITS[base].test(s)) return NaN;
  const t = s.replace(/^0+(?=.)/, '');
  if (t.length > BN.MAXLEN[base]) throw MATH;
  const v = parseInt(t, base);
  if (base === 10) return bnCheck(v);
  if (v > 0xFFFFFFFF) throw MATH;
  return v | 0; // two's complement: FFFFFFFF -> -1
}
function bnFormat(v) {
  if (typeof v !== 'number' || !isInt(v)) return null;
  const b = BN.base;
  if (b === 10) return v < 0 ? '−' + (-v) : String(v);
  const s = (v >>> 0).toString(b).toUpperCase().padStart(BN.MAXLEN[b], '0');
  if (b === 2) return `<span class="bn-bin"><span>${s.slice(0, 16)}</span><span>${s.slice(16)}</span></span>`;
  return s;
}

const BN_NUM = {
  add: (a, b) => bnCheck(a + b),
  sub: (a, b) => bnCheck(a - b),
  mul: (a, b) => bnCheck(a * b),
  div: (a, b) => { if (b === 0) throw MATH; return bnCheck(Math.trunc(a / b)); },
  neg: (a) => bnCheck(-a),
  pow: () => { throw SYNTAX; },
  fn: (name, f, x) => { if (name === 'Not(' || name === 'Neg(') return f(x); throw SYNTAX; },
};

const bnLogic = (d, f) => ({ t: 'op', op: 'custom', level: 'low', d, f: (a, b) => {
  if (typeof a !== 'number' || typeof b !== 'number') throw MATH;
  return f(bnCheck(a), bnCheck(b));
} });
const BN_TK = {
  and: bnLogic(' and ', (a, b) => a & b),
  or: bnLogic(' or ', (a, b) => a | b),
  xor: bnLogic(' xor ', (a, b) => a ^ b),
  xnor: bnLogic(' xnor ', (a, b) => ~(a ^ b)),
  not: F('Not(', (x) => ~bnCheck(x)),
  neg: F('Neg(', (x) => bnCheck(-x)),
};
const bnPrefix = (c) => ({ d: c, t: 'num' }); // merges with the digits that follow, parsed by bnParse

const BN_BASE_KEYS = { sq: 10, pow: 16, log: 2, ln: 8 };
const BN_HEX_KEYS = { neg: 'A', dms: 'B', inv: 'C', sin: 'D', cos: 'E', tan: 'F' };
// keys without meaning in Base-N (decimals, fractions, functions, calculus …)
const BN_OFF = ['frac', 'sqrt', 'dot', 'exp', 'integ', 'xvar', 'calc', 'sd', 'eng'];
// SHIFT functions still allowed (OFF, RESET, M−, ≈)
const BN_SHIFT_OK = ['ac', '9', 'mplus', 'eq', 'menu', 'on'];

registerApp('3', {
  name: 'Base-N',
  indicator: () => BN.NAMES[BN.base],
  enter() {
    S.screen = 'calc';
    BN.base = 10;
    cxClearHistory();
    if (!isInt(S.ans) || S.ans < BN_MIN || S.ans > BN_MAX) S.ans = 0;
    HOOKS.parseNumber = bnParse;
    HOOKS.fmtResult = bnFormat;
    HOOKS.num = BN_NUM;
  },
  leave() {
    BN.base = 10;
    cxClearHistory();
  },
  calcKey(id, mods) {
    if (id === 'menu' || id === 'on') return false;
    if (mods.shift) return !BN_SHIFT_OK.includes(id);
    if (mods.alpha) return false;
    if (BN_BASE_KEYS[id]) { BN.base = BN_BASE_KEYS[id]; return true; } // a shown result re-displays in the new base
    if (BN_HEX_KEYS[id]) { ins(digit(BN_HEX_KEYS[id])); return true; }
    if (BN_OFF.includes(id)) return true;
    if (id === 'optn') {
      openList([
        { label: 'and', act: () => ins(BN_TK.and) },
        { label: 'or', act: () => ins(BN_TK.or) },
        { label: 'xor', act: () => ins(BN_TK.xor) },
        { label: 'xnor', act: () => ins(BN_TK.xnor) },
        { label: 'Not(', act: () => ins(BN_TK.not) },
        { label: 'Neg(', act: () => ins(BN_TK.neg) },
        { label: 'd (decimal)', act: () => ins(bnPrefix('d')) },
        { label: 'h (hexadecimal)', act: () => ins(bnPrefix('h')) },
        { label: 'b (binary)', act: () => ins(bnPrefix('b')) },
        { label: 'o (octal)', act: () => ins(bnPrefix('o')) },
      ]);
      return true;
    }
    return false;
  },
});
