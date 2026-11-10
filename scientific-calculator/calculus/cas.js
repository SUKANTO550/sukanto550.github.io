'use strict';

/* =========================================================
   Indefinite calculus: small symbolic engine (no dependencies).
   - expression trees, simplifier, printers (LCD HTML / SymPy text)
   - converter from the calculator's input tree
   - symbolic derivative and rule-based integrator, both recording steps
   Integrals it cannot do are passed to SymPy (calculus/cas-ui.js).
   Symbolic results always use radians, whatever the angle setting.

   Tree nodes:
     {t:'num', n, d}  rational n/d (d=1 for integers; n may be a float)
     {t:'sym', name}  variable x (or u inside a substitution)
     {t:'const', name: 'pi' | 'e'}
     {t:'add', args}  {t:'mul', args}  {t:'pow', base, exp}
     {t:'fn', name, arg}   sin cos tan sec csc cot asin acos atan
                           sinh cosh tanh asinh acosh atanh ln abs
     {t:'I', f, v} / {t:'D', f, v}   unevaluated ∫ f dv and d/dv(f), used in steps
   ========================================================= */

const CAS = (() => {
  /* ---------- rationals ---------- */
  const gcd = (a, b) => {
    a = Math.abs(a); b = Math.abs(b);
    if (!Number.isInteger(a) || !Number.isInteger(b)) return 1;
    while (b) [a, b] = [b, a % b];
    return a || 1;
  };
  function num(n, d = 1) {
    if (d === 0) throw MATH;
    if (d < 0) { n = -n; d = -d; }
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) {
      const v = n / d;
      if (!Number.isFinite(v)) throw MATH;
      return { t: 'num', n: v, d: 1 };
    }
    const g = gcd(n, d);
    return { t: 'num', n: n / g, d: d / g };
  }
  // a plain JS number -> exact rational when it looks like one
  function toNum(v) {
    if (!Number.isFinite(v)) throw MATH;
    if (Number.isInteger(v)) return num(v);
    const r = ratApprox(v, 1e6, 1e-12);
    return r ? num(r.p, r.q) : { t: 'num', n: v, d: 1 };
  }
  const rAdd = (a, b) => num(a.n * b.d + b.n * a.d, a.d * b.d);
  const rMul = (a, b) => num(a.n * b.n, a.d * b.d);
  const val = (a) => a.n / a.d;

  /* ---------- constructors ---------- */
  const ZERO = num(0), ONE = num(1), M1 = num(-1), HALF = num(1, 2);
  const sym = (name) => ({ t: 'sym', name });
  const X = sym('x');
  const cst = (name) => ({ t: 'const', name });
  const E = cst('e');
  const fn = (name, arg) => ({ t: 'fn', name, arg });
  const pw = (base, exp) => ({ t: 'pow', base, exp });
  const mul = (...args) => ({ t: 'mul', args });
  const add = (...args) => ({ t: 'add', args });
  const neg = (a) => mul(M1, a);
  const div = (a, b) => mul(a, pw(b, M1));
  const sub = (a, b) => add(a, neg(b));
  const ln = (a) => fn('ln', a);
  const Int = (f, v = 'x') => ({ t: 'I', f, v });
  const Der = (f, v = 'x') => ({ t: 'D', f, v });

  const isNum = (n) => n.t === 'num';
  const isZero = (n) => isNum(n) && n.n === 0;
  const isOne = (n) => isNum(n) && n.n === 1 && n.d === 1;
  const isInt = (n) => isNum(n) && n.d === 1 && Number.isInteger(n.n);
  const isSym = (n, v) => n.t === 'sym' && n.name === v;

  function key(n) {
    switch (n.t) {
      case 'num': return n.d === 1 ? String(n.n) : `${n.n}/${n.d}`;
      case 'sym': return n.name;
      case 'const': return '#' + n.name;
      case 'fn': return `${n.name}(${key(n.arg)})`;
      case 'pow': return `(${key(n.base)})^(${key(n.exp)})`;
      case 'mul': return `*(${n.args.map(key).join(',')})`;
      case 'add': return `+(${n.args.map(key).join(',')})`;
      case 'I': return `I_${n.v}(${key(n.f)})`;
      case 'D': return `D_${n.v}(${key(n.f)})`;
    }
    return '?';
  }
  const same = (a, b) => key(a) === key(b);

  function freeOf(n, v) {
    switch (n.t) {
      case 'sym': return n.name !== v;
      case 'num': case 'const': return true;
      case 'fn': return freeOf(n.arg, v);
      case 'pow': return freeOf(n.base, v) && freeOf(n.exp, v);
      case 'add': case 'mul': return n.args.every((a) => freeOf(a, v));
      case 'I': case 'D': return freeOf(n.f, v);
    }
    return true;
  }
  function size(n) {
    switch (n.t) {
      case 'fn': return 1 + size(n.arg);
      case 'pow': return 1 + size(n.base) + size(n.exp);
      case 'add': case 'mul': return 1 + n.args.reduce((s, a) => s + size(a), 0);
      case 'I': case 'D': return 1 + size(n.f);
    }
    return 1;
  }

  /* ---------- simplifier (canonical form) ---------- */
  function simp(n) {
    switch (n.t) {
      case 'fn': return simpFn(n.name, simp(n.arg));
      case 'pow': return simpPow(simp(n.base), simp(n.exp));
      case 'mul': return simpMul(n.args.map(simp));
      case 'add': return simpAdd(n.args.map(simp));
      case 'I': case 'D': return { ...n, f: simp(n.f) };
    }
    return n;
  }

  const ODD = ['sin', 'tan', 'cot', 'csc', 'asin', 'atan', 'sinh', 'tanh', 'asinh', 'atanh'];
  const EVEN = ['cos', 'sec', 'cosh', 'abs'];
  const AT_ZERO = { sin: 0, tan: 0, asin: 0, atan: 0, sinh: 0, tanh: 0, asinh: 0, atanh: 0, cos: 1, sec: 1, cosh: 1 };
  // "−u" style term: negative number or a product led by a negative number
  const negCoef = (n) => (isNum(n) ? n.n < 0 : n.t === 'mul' && isNum(n.args[0]) && n.args[0].n < 0);
  const negate = (n) => simpMul([M1, n]);

  function simpFn(name, a) {
    if (isZero(a) && name in AT_ZERO) return num(AT_ZERO[name]);
    if (name === 'abs' && isNum(a)) return num(Math.abs(a.n), a.d);
    if (name === 'abs' && a.t === 'fn' && a.name === 'abs') return a;
    if (name === 'ln') {
      if (isOne(a)) return ZERO;
      if (a.t === 'const' && a.name === 'e') return ONE;
      if (a.t === 'pow' && a.base.t === 'const' && a.base.name === 'e') return a.exp;
    }
    if (negCoef(a)) {
      if (ODD.includes(name)) return negate(fn(name, negate(a)));
      if (EVEN.includes(name)) return fn(name, negate(a));
    }
    return fn(name, a);
  }

  function intRoot(n, q) {
    if (n < 0) return null;
    const r = Math.round(Math.pow(n, 1 / q));
    for (const c of [r - 1, r, r + 1]) if (c >= 0 && Math.pow(c, q) === n) return c;
    return null;
  }
  function simpPow(b, e) {
    if (isNum(e)) {
      if (isZero(e)) return ONE;
      if (isOne(e)) return b;
    }
    if (isNum(b)) {
      if (isOne(b)) return ONE;
      if (isZero(b) && isNum(e) && val(e) > 0) return ZERO;
      if (isInt(e) && Math.abs(e.n) <= 64 && b.d !== 0 && !(isZero(b) && e.n < 0)) {
        const k = Math.abs(e.n);
        const r = num(Math.pow(b.n, k), Math.pow(b.d, k));
        return e.n < 0 ? num(r.d, r.n) : r;
      }
      if (isNum(e) && e.d > 1 && Number.isInteger(b.n) && b.n > 0 && e.d <= 12) {
        const q = e.d, p = e.n;
        const rn = intRoot(b.n, q), rd = intRoot(b.d, q);
        if (rn !== null && rd !== null) return simpPow(num(rn, rd), num(p));
        // b^(p/q) = b^w · b^(r/q), then pull k^q out of b: √8 = 2√2
        const w = Math.floor(p / q), r = p - w * q;
        if (b.d === 1 && b.n < 1e9) {
          let k = 1, m = b.n;
          for (let c = 2; Math.pow(c, q) <= m; c++) while (m % Math.pow(c, q) === 0) { m /= Math.pow(c, q); k *= c; }
          if (k > 1 || w !== 0) {
            const parts = [num(Math.pow(k, r))];
            if (w !== 0) parts.push(simpPow(b, num(w)));
            if (m !== 1) parts.push(pw(num(m), num(r, q)));
            return simpMul(parts);
          }
        }
      }
      return pw(b, e);
    }
    if (b.t === 'pow' && isInt(e)) return simpPow(b.base, simpMul([b.exp, e]));
    if (b.t === 'pow' && isNum(e) && isNum(b.exp) && isInt(simpMul([b.exp, e])) && b.exp.d > 1) {
      return simpPow(b.base, simpMul([b.exp, e])); // (x^(1/2))^2 = x
    }
    if (b.t === 'mul' && isInt(e)) return simpMul(b.args.map((a) => simpPow(a, e)));
    if (b.t === 'const' && b.name === 'e') {
      if (e.t === 'fn' && e.name === 'ln') return e.arg;
      if (e.t === 'mul' && e.args.length === 2 && isNum(e.args[0]) && e.args[1].t === 'fn' && e.args[1].name === 'ln') {
        return simpPow(e.args[1].arg, e.args[0]);
      }
    }
    return pw(b, e);
  }

  // display / canonical order of factors: number, π, x, (…), functions, unevaluated ∫ / d/dx
  function rank(n) {
    switch (n.t) {
      case 'num': return 0;
      case 'const': return 1;
      case 'sym': return 2;
      case 'pow':
        if (n.base.t === 'const' && n.base.name === 'e') return 5;
        if (n.base.t === 'num') return 1.5;
        return n.base.t === 'sym' ? 2 : n.base.t === 'fn' ? 6 : 4;
      case 'add': return 4;
      case 'fn': return 6;
      default: return 7;
    }
  }
  const byRank = (a, b) => rank(a) - rank(b) || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);

  function simpMul(args) {
    let coef = ONE;
    let fs = [];
    let pending = args;
    const flat = (list) => {
      for (const a of list) {
        if (a.t === 'mul') flat(a.args);
        else if (isNum(a)) coef = rMul(coef, a);
        else fs.push(a);
      }
    };
    // combine equal bases (x·x² = x³); results that turn into numbers or products go round again
    for (let pass = 0; pass < 8 && pending.length; pass++) {
      flat(pending);
      pending = [];
      if (isZero(coef)) return ZERO;
      const groups = new Map();
      for (const f of fs) {
        const [b, e] = f.t === 'pow' ? [f.base, f.exp] : [f, ONE];
        const k = key(b);
        if (!groups.has(k)) groups.set(k, { b, es: [], orig: f });
        groups.get(k).es.push(e);
      }
      const out = [];
      for (const { b, es, orig } of groups.values()) {
        if (es.length === 1) { out.push(orig); continue; }
        const r = simpPow(b, simpAdd(es));
        if (isNum(r) || r.t === 'mul') pending.push(r);
        else out.push(r);
      }
      fs = out;
    }
    if (isZero(coef)) return ZERO;
    fs.sort(byRank);
    if (!fs.length) return coef;
    // a number times one sum is multiplied out, like SymPy: 2(x+1) = 2x+2
    if (fs.length === 1 && fs[0].t === 'add' && !isOne(coef)) return simpAdd(fs[0].args.map((t) => simpMul([coef, t])));
    if (isOne(coef)) return fs.length === 1 ? fs[0] : mul(...fs);
    return mul(coef, ...fs);
  }

  // polynomial degree in x of a term (used only for ordering)
  function degree(n) {
    if (isSym(n, 'x') || isSym(n, 'u')) return 1;
    if (n.t === 'pow' && (isSym(n.base, 'x') || isSym(n.base, 'u')) && isNum(n.exp)) return val(n.exp);
    if (n.t === 'mul') return n.args.reduce((s, a) => s + degree(a), 0);
    return 0;
  }
  function splitCoef(t) {
    if (isNum(t)) return [t, ONE];
    if (t.t === 'mul' && isNum(t.args[0])) {
      const rest = t.args.slice(1);
      return [t.args[0], rest.length === 1 ? rest[0] : mul(...rest)];
    }
    return [ONE, t];
  }
  function simpAdd(args) {
    let c = ZERO;
    const terms = new Map();
    const take = (list) => {
      for (const a of list) {
        if (a.t === 'add') { take(a.args); continue; }
        if (isNum(a)) { c = rAdd(c, a); continue; }
        const [k, rest] = splitCoef(a);
        const id = key(rest);
        if (terms.has(id)) terms.get(id).k = rAdd(terms.get(id).k, k);
        else terms.set(id, { k, rest });
      }
    };
    take(args);
    const out = [];
    for (const { k, rest } of terms.values()) {
      if (isZero(k)) continue;
      const t = isOne(k) ? rest : simpMul([k, rest]);
      if (t.t === 'add') { take(t.args); continue; }
      if (!isZero(t)) out.push(t);
    }
    // highest power first; equal powers: the more complex term first (x·ln x − x)
    out.sort((a, b) => degree(b) - degree(a) || size(b) - size(a)
      || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
    if (!isZero(c)) out.push(c);
    if (!out.length) return ZERO;
    return out.length === 1 ? out[0] : add(...out);
  }

  /* ---------- expansion ---------- */
  function distribute(a, b) {
    const ta = a.t === 'add' ? a.args : [a];
    const tb = b.t === 'add' ? b.args : [b];
    return simp(add(...ta.flatMap((p) => tb.map((q) => mul(p, q)))));
  }
  function expand(n) {
    n = simp(n);
    if (n.t === 'add') return simp(add(...n.args.map(expand)));
    if (n.t === 'mul') return n.args.map(expand).reduce((acc, f) => distribute(acc, f));
    if (n.t === 'pow' && n.base.t === 'add' && isInt(n.exp) && n.exp.n >= 2 && n.exp.n <= 8) {
      const b = expand(n.base);
      let r = b;
      for (let i = 1; i < n.exp.n; i++) r = distribute(r, b);
      return r;
    }
    return n;
  }

  // structural replace of every copy of `target` by `by`
  function replace(n, tk, by) {
    if (key(n) === tk) return by;
    switch (n.t) {
      case 'fn': return fn(n.name, replace(n.arg, tk, by));
      case 'pow': return pw(replace(n.base, tk, by), replace(n.exp, tk, by));
      case 'add': return add(...n.args.map((a) => replace(a, tk, by)));
      case 'mul': return mul(...n.args.map((a) => replace(a, tk, by)));
    }
    return n;
  }

  /* ---------- input tree (calculator items) -> expression ---------- */
  const FUNC_D = {
    'sin(': 'sin', 'cos(': 'cos', 'tan(': 'tan', 'sin⁻¹(': 'asin', 'cos⁻¹(': 'acos', 'tan⁻¹(': 'atan',
    'ln(': 'ln', 'sinh(': 'sinh', 'cosh(': 'cosh', 'tanh(': 'tanh',
    'sinh⁻¹(': 'asinh', 'cosh⁻¹(': 'acosh', 'tanh⁻¹(': 'atanh',
  };
  const TEN = num(10);

  let SYMV = false; // MENU E (Algebra): every variable letter stays a symbol
  function fromRowSym(row) { SYMV = true; try { return fromRow(row); } finally { SYMV = false; } }
  function fromRow(row) {
    if (!row.items.length) throw SYNTAX;
    return fromItems(row.items);
  }
  function fromNode(t) {
    const R = (s) => fromRow(t.slots[s]);
    switch (t.kind) {
      case 'frac': return div(R('num'), R('den'));
      case 'mixed': {
        const w = R('whole'), f = div(R('num'), R('den'));
        return negCoef(simp(w)) ? sub(w, f) : add(w, f);
      }
      case 'sqrt': return pw(R('arg'), HALF);
      case 'root': return pw(R('arg'), pw(R('idx'), M1));
      case 'pow10': return pw(TEN, R('exp'));
      case 'exp': return pw(E, R('exp'));
      case 'logab': return div(ln(R('arg')), ln(R('base')));
      case 'abs': return fn('abs', R('arg'));
      case 'ideriv': return diff(simp(R('f')), 'x').res; // d/dx(…) inside an integral
    }
    throw SYNTAX; // definite ∫, d/dx at a point, Σ, nested ∫ dx …
  }

  function fromItems(raw) {
    const toks = [];
    let buf = '';
    const flush = () => {
      if (!buf) return;
      if (!/^\d*\.?\d*$/.test(buf) || buf === '.') throw SYNTAX;
      const [ip, fp = ''] = buf.split('.');
      toks.push({ t: 'number', v: num(Number(ip + fp || '0'), Math.pow(10, fp.length)) });
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
    const isPowNode = (t) => isTpl(t) && t.kind === 'pow';
    const startsPrimary = (t) => t && (['number', 'const', 'func', 'open'].includes(t.t) || (isTpl(t) && !isPowNode(t)));

    function expr() {
      let v = term();
      for (;;) {
        const t = peek();
        if (isOp(t, '+', '-')) { i++; const r = term(); v = t.op === '+' ? add(v, r) : sub(v, r); } else break;
      }
      return v;
    }
    function term() {
      let v = imp();
      for (;;) {
        const t = peek();
        if (isOp(t, '*', '/')) { i++; const r = imp(); v = t.op === '/' ? div(v, r) : mul(v, r); } else break;
      }
      return v;
    }
    function imp() {
      let v = unary();
      while (startsPrimary(peek())) v = mul(v, unary());
      return v;
    }
    function unary() {
      const t = peek();
      if (t && (t.t === 'neg' || isOp(t, '-'))) { i++; return neg(unary()); }
      if (isOp(t, '+')) { i++; return unary(); }
      return postfix();
    }
    function postfix() {
      let v = primary();
      for (;;) {
        const t = peek();
        if (t && t.t === 'post') {
          i++;
          if (t === TK.inv) v = pw(v, M1);
          else if (t === TK.pct) v = div(v, num(100));
          else if (t === TK.fact) {
            const s = simp(v);
            if (!isInt(s) || s.n < 0 || s.n > 20) throw MATH;
            v = num(factorial(s.n));
          } else throw SYNTAX; // angle / unit suffixes have no symbolic meaning
        } else if (isPowNode(t)) { i++; v = pw(v, fromRow(t.slots.exp)); }
        else if (t && t.t === 'E') {
          i++;
          let sign = 1;
          const s = peek();
          if (s && (s.t === 'neg' || isOp(s, '-'))) { i++; sign = -1; }
          const n = peek();
          if (!n || n.t !== 'number') throw SYNTAX;
          i++;
          v = mul(v, pw(TEN, num(sign * val(n.v))));
        } else break;
      }
      return v;
    }
    function primary() {
      const t = toks[i++];
      if (!t) throw SYNTAX;
      if (isTpl(t)) { if (isPowNode(t)) throw SYNTAX; return fromNode(t); }
      switch (t.t) {
        case 'number': return t.v;
        case 'const':
          if (t.var) return t.d === 'x' ? X : t.d === 'k' ? sym('k') : SYMV ? sym(t.d) : toNum(S.vars[t.d]); // k: series index (MENU D)
          if (t === TK.pi) return cst('pi');
          if (t === TK.e) return E;
          if (t.ran) throw SYNTAX;
          return toNum(t.v()); // Ans, scientific constants
        case 'func': case 'open': {
          const args = [expr()];
          while (peek() && peek().t === 'comma') { i++; args.push(expr()); }
          if (peek() && peek().t === 'close') i++;
          if (t.t === 'open') { if (args.length > 1) throw SYNTAX; return args[0]; }
          if (t === TK.log) {
            if (args.length === 1) return div(ln(args[0]), ln(TEN));
            if (args.length === 2) return div(ln(args[1]), ln(args[0]));
            throw SYNTAX;
          }
          const name = FUNC_D[t.d];
          if (!name || args.length > 1) throw SYNTAX;
          return fn(name, args[0]);
        }
        case 'E': i--; return ONE;
      }
      throw SYNTAX;
    }
    const v = expr();
    if (i < toks.length) throw SYNTAX;
    return v;
  }

  /* ---------- JSON tree from SymPy -> expression ---------- */
  function fromJSON(j) {
    switch (j.t) {
      case 'num': return num(j.n, j.d);
      case 'float': return toNum(j.v);
      case 'sym': return sym(j.name.replace(/^_/, ''));
      case 'const': return cst(j.name);
      case 'add': return add(...j.args.map(fromJSON));
      case 'mul': return mul(...j.args.map(fromJSON));
      case 'pow': return pw(fromJSON(j.base), fromJSON(j.exp));
      case 'fn': return fn(j.name, fromJSON(j.arg));
    }
    throw MATH;
  }

  /* ---------- printers ---------- */
  const PY_FN = { ln: 'log', abs: 'Abs' };
  function toPy(n) {
    switch (n.t) {
      case 'num': return n.d === 1 ? `(${n.n})` : `(${n.n}/${n.d})`;
      case 'sym': return n.name;
      case 'const': return n.name === 'pi' ? 'pi' : 'E';
      case 'add': return `(${n.args.map(toPy).join(' + ')})`;
      case 'mul': return `(${n.args.map(toPy).join('*')})`;
      case 'pow':
        if (n.base.t === 'const' && n.base.name === 'e') return `exp(${toPy(n.exp)})`;
        return `(${toPy(n.base)})**(${toPy(n.exp)})`;
      case 'fn': return `${PY_FN[n.name] || n.name}(${toPy(n.arg)})`;
    }
    throw SYNTAX;
  }

  const FN_HTML = {
    asin: 'sin<sup>−1</sup>', acos: 'cos<sup>−1</sup>', atan: 'tan<sup>−1</sup>',
    asinh: 'sinh<sup>−1</sup>', acosh: 'cosh<sup>−1</sup>', atanh: 'tanh<sup>−1</sup>', zeta: 'ζ',
  };
  const fnName = (name) => FN_HTML[name] || name;
  const frac = (a, b) => `<span class="nd-frac"><span class="num">${a}</span><span class="den">${b}</span></span>`;
  const par = (h) => PAR(h);
  const numStr = (v) => {
    if (Number.isInteger(v)) return String(Math.abs(v));
    return String(+Math.abs(v).toPrecision(10));
  };

  // ctx: 'top' | 'factor' (inside a product) | 'base' (of a power)
  // MENU E: print a tree exactly as written (no re-simplifying when a minus sign is pulled out)
  let RAW = false;
  const negRaw = (n) => {
    if (isNum(n)) return num(-n.n, n.d);
    const c = n.args[0], rest = n.args.slice(1);
    if (c.n === -1 && c.d === 1) return rest.length === 1 ? rest[0] : { t: 'mul', args: rest };
    return { t: 'mul', args: [num(-c.n, c.d), ...rest] };
  };
  function htmlRaw(n) { RAW = true; try { return html(n); } finally { RAW = false; } }
  function html(n, ctx = 'top') {
    switch (n.t) {
      case 'num': {
        const sg = n.n < 0 ? '−' : '';
        const body = n.d === 1 ? numStr(n.n) : frac(numStr(n.n), n.d);
        if (ctx === 'base' && (n.n < 0 || n.d !== 1)) return par(sg + body);
        return sg + body;
      }
      case 'sym': return `<i>${n.name}</i>`;
      case 'const': return n.name === 'pi' ? '<i>π</i>' : n.name === 'e' ? '<i>e</i>' : n.name === 'oo' ? '∞' : `<i>${n.name}</i>`;
      case 'add': {
        let h = '';
        // a positive constant goes first instead of a minus sign: 1−x² rather than −x²+1
        let terms = n.args;
        const p = terms.findIndex((t) => isNum(t) && t.n > 0);
        if (negCoef(terms[0]) && p > 0) terms = [terms[p], ...terms.filter((_, i) => i !== p)];
        terms.forEach((t, i) => {
          if (i === 0) h += html(t);
          else if (negCoef(t)) h += '−' + html(RAW ? negRaw(t) : negate(t));
          else h += '+' + html(t);
        });
        return ctx === 'top' ? h : par(h);
      }
      case 'mul': return mulHTML(n, ctx);
      case 'pow': return powHTML(n, ctx);
      case 'fn': {
        if (n.name === 'abs') return `<span class="nd-abs">${html(n.arg)}</span>`;
        if (n.name === 'ln' && n.arg.t === 'fn' && n.arg.name === 'abs') return `<span class="nw">ln${html(n.arg)}</span>`;
        if (/^harm\d+$/.test(n.name)) { // harmonic number H_n^(m) from SymPy
          const m = +n.name.slice(4);
          return `<span class="nw"><i>H</i><sub>${html(n.arg)}</sub>${m > 1 ? `<span class="nd-sup">(${m})</span>` : ''}</span>`;
        }
        if (n.name === 'fact') return `<span class="nw">${n.arg.t === 'sym' || (isNum(n.arg) && n.arg.d === 1 && n.arg.n >= 0) ? html(n.arg) : par(html(n.arg))}!</span>`;
        return `<span class="nw">${fnName(n.name)}${par(html(n.arg))}</span>`;
      }
      case 'I':
        return `<span class="nd-int cas-int">${INT_SIGN}<span class="body">${html(n.f)}</span><i class="dx">d${n.v}</i></span>`;
      case 'D':
        return `<span class="nd-der"><span class="nd-frac"><span class="num">d</span><span class="den"><i>d${n.v}</i></span></span>${par(html(n.f))}</span>`;
    }
    return '?';
  }
  function powHTML(n, ctx) {
    const { base: b, exp: e } = n;
    if (isNum(e) && e.n < 0) return frac('1', html(simpPow(b, num(-e.n, e.d)), 'top'));
    if (isNum(e) && e.n === 1 && e.d === 2) return `<span class="nd-sqrt"><span class="rad">√</span><span class="ov">${html(b)}</span></span>`;
    if (isNum(e) && e.n === 1 && e.d > 2) {
      return `<span class="nd-sqrt"><span class="idx">${e.d}</span><span class="rad">√</span><span class="ov">${html(b)}</span></span>`;
    }
    const ex = isNum(e) && e.d !== 1 ? `${e.n < 0 ? '−' : ''}${Math.abs(e.n)}/${e.d}` : html(e);
    const sup = `<span class="nd-sup">${ex}</span>`;
    // sin²(x) instead of (sin(x))²
    if (b.t === 'fn' && b.name !== 'abs' && isInt(e) && e.n > 0) {
      return `<span class="nw">${fnName(b.name)}${sup}${b.name === 'ln' && b.arg.t === 'fn' && b.arg.name === 'abs' ? html(b.arg) : par(html(b.arg))}</span>`;
    }
    const bh = ['add', 'mul', 'pow', 'I', 'D'].includes(b.t) || (b.t === 'fn' && b.name !== 'abs') ? par(html(b)) : html(b, 'base');
    const h = `<span class="nw">${bh}${sup}</span>`;
    return ctx === 'base' ? par(h) : h;
  }
  function mulHTML(n, ctx) {
    let coef = ONE;
    const top = [], bot = [];
    for (const f of n.args) {
      if (isNum(f)) coef = rMul(coef, f);
      else if (f.t === 'pow' && isNum(f.exp) && f.exp.n < 0) bot.push(simpPow(f.base, num(-f.exp.n, f.exp.d)));
      else top.push(f);
    }
    const sg = coef.n < 0 ? '−' : '';
    const cn = Math.abs(coef.n), cd = coef.d;
    const join = (list, lead) => {
      let h = '';
      list.forEach((f, i) => {
        // a sum needs brackets only next to other factors: 2(x+1), but 1/(x+1) → x+1 alone in the denominator
        const fh = f.t === 'add' ? (list.length > 1 || lead ? par(html(f)) : html(f)) : html(f, 'factor');
        const prevNum = i === 0 ? lead : false;
        h += (prevNum && (isNum(f) || f.t === 'pow' && isNum(f.base)) ? '·' : '') + fh;
      });
      return h;
    };
    let numH = (cn !== 1 || !top.length ? numStr(cn) : '') + join(top, cn !== 1);
    let denH = cd !== 1 ? String(cd) + join(bot, true) : join(bot, false);
    if (!bot.length && cd === 1) {
      const h = sg + numH;
      return ctx === 'base' ? par(h) : h;
    }
    if (!numH) numH = '1';
    if (!denH) denH = '1';
    const h = sg + frac(numH, denH);
    return ctx === 'base' ? par(h) : h;
  }

  /* ---------- derivative with steps ---------- */
  const U = '<i>u</i>';
  const FN_DERIV = { // f′(g) as an expression of g, plus the rule text
    sin: [(g) => fn('cos', g), `d/d${U} sin(${U}) = cos(${U})`],
    cos: [(g) => neg(fn('sin', g)), `d/d${U} cos(${U}) = −sin(${U})`],
    tan: [(g) => pw(fn('sec', g), num(2)), `d/d${U} tan(${U}) = sec<sup>2</sup>(${U})`],
    sec: [(g) => mul(fn('sec', g), fn('tan', g)), `d/d${U} sec(${U}) = sec(${U})tan(${U})`],
    csc: [(g) => neg(mul(fn('csc', g), fn('cot', g))), `d/d${U} csc(${U}) = −csc(${U})cot(${U})`],
    cot: [(g) => neg(pw(fn('csc', g), num(2))), `d/d${U} cot(${U}) = −csc<sup>2</sup>(${U})`],
    asin: [(g) => pw(sub(ONE, pw(g, num(2))), num(-1, 2)), `d/d${U} sin<sup>−1</sup>(${U}) = 1/√(1−${U}<sup>2</sup>)`],
    acos: [(g) => neg(pw(sub(ONE, pw(g, num(2))), num(-1, 2))), `d/d${U} cos<sup>−1</sup>(${U}) = −1/√(1−${U}<sup>2</sup>)`],
    atan: [(g) => pw(add(ONE, pw(g, num(2))), M1), `d/d${U} tan<sup>−1</sup>(${U}) = 1/(1+${U}<sup>2</sup>)`],
    sinh: [(g) => fn('cosh', g), `d/d${U} sinh(${U}) = cosh(${U})`],
    cosh: [(g) => fn('sinh', g), `d/d${U} cosh(${U}) = sinh(${U})`],
    tanh: [(g) => pw(fn('cosh', g), num(-2)), `d/d${U} tanh(${U}) = 1/cosh<sup>2</sup>(${U})`],
    asinh: [(g) => pw(add(pw(g, num(2)), ONE), num(-1, 2)), `d/d${U} sinh<sup>−1</sup>(${U}) = 1/√(${U}<sup>2</sup>+1)`],
    acosh: [(g) => pw(sub(pw(g, num(2)), ONE), num(-1, 2)), `d/d${U} cosh<sup>−1</sup>(${U}) = 1/√(${U}<sup>2</sup>−1)`],
    atanh: [(g) => pw(sub(ONE, pw(g, num(2))), M1), `d/d${U} tanh<sup>−1</sup>(${U}) = 1/(1−${U}<sup>2</sup>)`],
    ln: [(g) => pw(g, M1), `d/d${U} ln(${U}) = 1/${U}`],
    abs: [(g) => div(g, fn('abs', g)), `d/d${U} |${U}| = ${U}/|${U}|`],
  };
  const DNOTE = {
    ConstantRule: 'Derivative of a constant: d/d<i>x</i>(<i>c</i>) = 0',
    PowerRule: 'Power rule: d/d<i>x</i>(<i>x</i><sup><i>n</i></sup>) = <i>n</i>·<i>x</i><sup><i>n</i>−1</sup>',
    SumRule: 'Sum rule: (<i>u</i>+<i>v</i>)′ = <i>u</i>′+<i>v</i>′',
    ConstantTimesRule: 'Constant multiple rule: (<i>c</i>·<i>u</i>)′ = <i>c</i>·<i>u</i>′',
    ProductRule: 'Product rule: (<i>u</i>·<i>v</i>)′ = <i>u</i>′<i>v</i>+<i>u</i><i>v</i>′',
    QuotientRule: 'Quotient rule: (<i>u</i>/<i>v</i>)′ = (<i>u</i>′<i>v</i>−<i>u</i><i>v</i>′)/<i>v</i><sup>2</sup>',
    PowerChainRule: 'Power rule + chain rule: (<i>u</i><sup><i>n</i></sup>)′ = <i>n</i>·<i>u</i><sup><i>n</i>−1</sup>·<i>u</i>′',
    ExpRule: 'Exponential rule: d/d<i>x</i>(<i>e</i><sup><i>x</i></sup>) = <i>e</i><sup><i>x</i></sup>',
    ExpBaseRule: 'Exponential rule: d/d<i>x</i>(<i>a</i><sup><i>x</i></sup>) = <i>a</i><sup><i>x</i></sup>ln(<i>a</i>)',
    ExpChainRule: 'Chain rule: (<i>e</i><sup><i>u</i></sup>)′ = <i>e</i><sup><i>u</i></sup>·<i>u</i>′',
    ExpBaseChainRule: 'Chain rule: (<i>a</i><sup><i>u</i></sup>)′ = <i>a</i><sup><i>u</i></sup>ln(<i>a</i>)·<i>u</i>′',
    LogDiffRule: 'Write <i>f</i><sup><i>g</i></sup> = <i>e</i><sup><i>g</i>·ln<i>f</i></sup>, then use the chain rule',
    Combine: 'Simplify',
  };

  function dleaf(rule, f, v, res, note) { return { rule, f, var: v, res: simp(res), note, sub: [] }; }
  function splitFree(f, v) { // product -> [x-free part, x-dependent part]
    const fs = f.t === 'mul' ? f.args : [f];
    const c = fs.filter((a) => freeOf(a, v)), r = fs.filter((a) => !freeOf(a, v));
    return [simpMul(c), r.length ? (r.length === 1 ? r[0] : mul(...r)) : ONE];
  }

  function diff(f, v = 'x') {
    f = simp(f);
    if (freeOf(f, v)) return dleaf('ConstantRule', f, v, ZERO, DNOTE.ConstantRule);
    switch (f.t) {
      case 'sym': return dleaf('PowerRule', f, v, ONE, DNOTE.PowerRule);
      case 'add': {
        const s = f.args.map((a) => diff(a, v));
        return { rule: 'SumRule', f, var: v, rhs: add(...f.args.map((a) => Der(a, v))), sub: s, res: simp(add(...s.map((x) => x.res))), note: DNOTE.SumRule };
      }
      case 'mul': {
        const [c, rest] = splitFree(f, v);
        if (!isOne(c)) {
          const s = diff(rest, v);
          return { rule: 'ConstantTimesRule', f, var: v, rhs: mul(c, Der(rest, v)), sub: [s], res: simp(mul(c, s.res)), note: DNOTE.ConstantTimesRule };
        }
        const top = [], bot = [];
        for (const a of f.args) {
          if (a.t === 'pow' && isNum(a.exp) && a.exp.n < 0) bot.push(simpPow(a.base, num(-a.exp.n, a.exp.d)));
          else top.push(a);
        }
        if (top.length && bot.length) {
          const u = simpMul(top), w = simpMul(bot);
          const su = diff(u, v), sw = diff(w, v);
          const res = simp(mul(sub(mul(su.res, w), mul(u, sw.res)), pw(w, num(-2))));
          const rhs = mul(sub(mul(Der(u, v), w), mul(u, Der(w, v))), pw(w, num(-2)));
          return { rule: 'QuotientRule', f, var: v, rhs, sub: [su, sw], res, note: DNOTE.QuotientRule };
        }
        const u = f.args[0], w = simpMul(f.args.slice(1));
        const su = diff(u, v), sw = diff(w, v);
        return {
          rule: 'ProductRule', f, var: v, rhs: add(mul(Der(u, v), w), mul(u, Der(w, v))), sub: [su, sw],
          res: simp(add(mul(su.res, w), mul(u, sw.res))), note: DNOTE.ProductRule,
        };
      }
      case 'pow': {
        const { base: b, exp: e } = f;
        const bx = !freeOf(b, v), ex = !freeOf(e, v);
        if (bx && !ex) {
          const outer = mul(e, pw(b, sub(e, ONE)));
          if (isSym(b, v)) return dleaf('PowerRule', f, v, outer, DNOTE.PowerRule);
          const s = diff(b, v);
          return { rule: 'ChainRule', f, var: v, rhs: mul(outer, Der(b, v)), sub: [s], res: simp(mul(outer, s.res)), note: DNOTE.PowerChainRule };
        }
        if (!bx && ex) {
          const isE = b.t === 'const' && b.name === 'e';
          const outer = isE ? f : mul(f, ln(b));
          if (isSym(e, v)) return dleaf('ExpRule', f, v, outer, isE ? DNOTE.ExpRule : DNOTE.ExpBaseRule);
          const s = diff(e, v);
          return { rule: 'ChainRule', f, var: v, rhs: mul(outer, Der(e, v)), sub: [s], res: simp(mul(outer, s.res)), note: isE ? DNOTE.ExpChainRule : DNOTE.ExpBaseChainRule };
        }
        const g = simp(mul(e, ln(b)));
        const s = diff(g, v);
        return { rule: 'LogDiffRule', f, var: v, rhs: mul(f, Der(g, v)), sub: [s], res: simp(mul(f, s.res)), note: DNOTE.LogDiffRule };
      }
      case 'fn': {
        const d = FN_DERIV[f.name];
        if (!d) throw MATH;
        const outer = d[0](f.arg);
        if (isSym(f.arg, v)) return dleaf('FnRule', f, v, outer, d[1].replace(/<i>u<\/i>/g, `<i>${v}</i>`));
        const s = diff(f.arg, v);
        return { rule: 'ChainRule', f, var: v, rhs: mul(outer, Der(f.arg, v)), sub: [s], res: simp(mul(outer, s.res)), note: `Chain rule: (<i>f</i>(<i>u</i>))′ = <i>f</i>′(<i>u</i>)·<i>u</i>′, with ${d[1]}` };
      }
    }
    throw MATH;
  }

  /* ---------- integral with steps ---------- */
  const INOTE = {
    ConstantRule: 'Integral of a constant: ∫<i>c</i> d<i>x</i> = <i>c</i><i>x</i>',
    ConstantTimesRule: 'Constant multiple rule: ∫<i>c</i>·<i>f</i> d<i>x</i> = <i>c</i>∫<i>f</i> d<i>x</i>',
    AddRule: 'Sum rule: ∫(<i>f</i>+<i>g</i>) d<i>x</i> = ∫<i>f</i> d<i>x</i> + ∫<i>g</i> d<i>x</i>',
    PowerRule: 'Power rule: ∫<i>x</i><sup><i>n</i></sup> d<i>x</i> = <i>x</i><sup><i>n</i>+1</sup>/(<i>n</i>+1), <i>n</i> ≠ −1',
    ReciprocalRule: 'Reciprocal rule: ∫1/<i>x</i> d<i>x</i> = ln|<i>x</i>|',
    ExpRule: 'Exponential rule: ∫<i>e</i><sup><i>x</i></sup> d<i>x</i> = <i>e</i><sup><i>x</i></sup>',
    ExpBaseRule: 'Exponential rule: ∫<i>a</i><sup><i>x</i></sup> d<i>x</i> = <i>a</i><sup><i>x</i></sup>/ln(<i>a</i>)',
    URule: 'Substitution rule',
    PartsRule: 'Integration by parts: ∫<i>u</i> d<i>v</i> = <i>u</i><i>v</i> − ∫<i>v</i> d<i>u</i>',
    CyclicPartsRule: 'Integration by parts twice: the original integral appears again, solve for it',
    RewriteRule: 'Rewrite the integrand',
    ExpandRule: 'Multiply out the integrand',
    TrigRule: 'Standard trigonometric integral',
    ArctanRule: 'Standard integral: ∫1/(<i>a</i>+<i>x</i><sup>2</sup>) d<i>x</i> = tan<sup>−1</sup>(<i>x</i>/√<i>a</i>)/√<i>a</i>',
    ArcsinRule: 'Standard integral: ∫1/√(<i>a</i>−<i>x</i><sup>2</sup>) d<i>x</i> = sin<sup>−1</sup>(<i>x</i>/√<i>a</i>)',
  };
  const FN_INT = { // ∫ f(x) dx for f applied directly to the variable
    sin: [(x) => neg(fn('cos', x)), '∫sin(<i>x</i>) d<i>x</i> = −cos(<i>x</i>)'],
    cos: [(x) => fn('sin', x), '∫cos(<i>x</i>) d<i>x</i> = sin(<i>x</i>)'],
    tan: [(x) => neg(ln(fn('abs', fn('cos', x)))), '∫tan(<i>x</i>) d<i>x</i> = −ln|cos(<i>x</i>)|'],
    cot: [(x) => ln(fn('abs', fn('sin', x))), '∫cot(<i>x</i>) d<i>x</i> = ln|sin(<i>x</i>)|'],
    sec: [(x) => ln(fn('abs', add(fn('sec', x), fn('tan', x)))), '∫sec(<i>x</i>) d<i>x</i> = ln|sec(<i>x</i>)+tan(<i>x</i>)|'],
    csc: [(x) => neg(ln(fn('abs', add(fn('csc', x), fn('cot', x))))), '∫csc(<i>x</i>) d<i>x</i> = −ln|csc(<i>x</i>)+cot(<i>x</i>)|'],
    sinh: [(x) => fn('cosh', x), '∫sinh(<i>x</i>) d<i>x</i> = cosh(<i>x</i>)'],
    cosh: [(x) => fn('sinh', x), '∫cosh(<i>x</i>) d<i>x</i> = sinh(<i>x</i>)'],
    tanh: [(x) => ln(fn('cosh', x)), '∫tanh(<i>x</i>) d<i>x</i> = ln(cosh(<i>x</i>))'],
  };

  let budget = 0;
  const leaf = (rule, f, v, res, note) => ({ rule, f, var: v, res: simp(res), note: note || INOTE[rule], sub: [] });
  const vx = (v, s) => s.replace(/<i>x<\/i>/g, `<i>${v}</i>`);

  function integ(f, v = 'x') {
    budget = 4000;
    return istep(simp(f), v, 0);
  }

  function istep(f, v, depth) {
    if (--budget < 0 || depth > 14) return null;
    const X = sym(v);
    if (freeOf(f, v)) return leaf('ConstantRule', f, v, mul(f, X), vx(v, INOTE.ConstantRule));
    if (f.t === 'add') {
      const s = f.args.map((a) => istep(a, v, depth + 1));
      if (s.some((x) => !x)) return expandStep(f, v, depth);
      return { rule: 'AddRule', f, var: v, sub: s, res: simp(add(...s.map((x) => x.res))), note: vx(v, INOTE.AddRule) };
    }
    if (f.t === 'mul') {
      const [c, rest] = splitFree(f, v);
      if (!isOne(c)) {
        const s = istep(rest, v, depth + 1);
        if (!s) return null;
        return { rule: 'ConstantTimesRule', f, var: v, c, sub: [s], res: simp(mul(c, s.res)), note: vx(v, INOTE.ConstantTimesRule) };
      }
    }
    return table(f, v) || rewriteTrig(f, v, depth) || usub(f, v, depth) || expandStep(f, v, depth) || parts(f, v, depth);
  }

  function table(f, v) {
    const X = sym(v);
    const note = (r) => vx(v, INOTE[r]);
    if (isSym(f, v)) return leaf('PowerRule', f, v, mul(HALF, pw(X, num(2))), note('PowerRule'));
    if (f.t === 'pow') {
      const { base: b, exp: e } = f;
      if (isSym(b, v) && freeOf(e, v)) {
        if (isNum(e) && e.n === -1 && e.d === 1) return leaf('ReciprocalRule', f, v, ln(fn('abs', X)), note('ReciprocalRule'));
        const n1 = simp(add(e, ONE));
        return leaf('PowerRule', f, v, div(pw(X, n1), n1), note('PowerRule'));
      }
      if (isSym(e, v) && freeOf(b, v)) {
        if (b.t === 'const' && b.name === 'e') return leaf('ExpRule', f, v, f, note('ExpRule'));
        return leaf('ExpBaseRule', f, v, div(f, ln(b)), note('ExpBaseRule'));
      }
      if (b.t === 'fn' && isSym(b.arg, v) && isInt(e)) {
        const k = e.n, nm = b.name;
        if (k === 2 && nm === 'sec') return leaf('TrigRule', f, v, fn('tan', X), vx(v, '∫sec<sup>2</sup>(<i>x</i>) d<i>x</i> = tan(<i>x</i>)'));
        if (k === 2 && nm === 'csc') return leaf('TrigRule', f, v, neg(fn('cot', X)), vx(v, '∫csc<sup>2</sup>(<i>x</i>) d<i>x</i> = −cot(<i>x</i>)'));
        if (k === -2 && nm === 'cos') return leaf('TrigRule', f, v, fn('tan', X), vx(v, '∫1/cos<sup>2</sup>(<i>x</i>) d<i>x</i> = tan(<i>x</i>)'));
        if (k === -2 && nm === 'sin') return leaf('TrigRule', f, v, neg(fn('cot', X)), vx(v, '∫1/sin<sup>2</sup>(<i>x</i>) d<i>x</i> = −cot(<i>x</i>)'));
        if (k === -2 && nm === 'cosh') return leaf('TrigRule', f, v, fn('tanh', X), vx(v, '∫1/cosh<sup>2</sup>(<i>x</i>) d<i>x</i> = tanh(<i>x</i>)'));
        if (k === -1 && nm === 'cos') return leaf('TrigRule', f, v, FN_INT.sec[0](X), vx(v, FN_INT.sec[1]));
        if (k === -1 && nm === 'sin') return leaf('TrigRule', f, v, FN_INT.csc[0](X), vx(v, FN_INT.csc[1]));
      }
      // 1/(a + x²) and 1/√(a − x²), a > 0
      if (b.t === 'add' && b.args.length === 2 && isNum(e) && (val(e) === -1 || val(e) === -0.5)) {
        const sq = b.args.find((t) => t.t === 'pow' && isSym(t.base, v) && isNum(t.exp) && val(t.exp) === 2);
        const nsq = b.args.find((t) => t.t === 'mul' && t.args.length === 2 && isNum(t.args[0]) && val(t.args[0]) === -1
          && t.args[1].t === 'pow' && isSym(t.args[1].base, v) && val(t.args[1].exp) === 2);
        const a = b.args.find(isNum);
        if (a && val(a) > 0) {
          const ra = simpPow(a, HALF);
          if (sq && val(e) === -1) return leaf('ArctanRule', f, v, div(fn('atan', div(X, ra)), ra), note('ArctanRule'));
          if (nsq && val(e) === -0.5) return leaf('ArcsinRule', f, v, fn('asin', div(X, ra)), note('ArcsinRule'));
        }
      }
    }
    if (f.t === 'fn' && isSym(f.arg, v) && FN_INT[f.name]) {
      return leaf('TrigRule', f, v, FN_INT[f.name][0](X), vx(v, FN_INT[f.name][1]));
    }
    if (f.t === 'mul' && f.args.length === 2 && f.args.every((a) => a.t === 'fn' && isSym(a.arg, v))) {
      const names = f.args.map((a) => a.name).sort().join(',');
      if (names === 'sec,tan') return leaf('TrigRule', f, v, fn('sec', X), vx(v, '∫sec(<i>x</i>)tan(<i>x</i>) d<i>x</i> = sec(<i>x</i>)'));
      if (names === 'cot,csc') return leaf('TrigRule', f, v, neg(fn('csc', X)), vx(v, '∫csc(<i>x</i>)cot(<i>x</i>) d<i>x</i> = −csc(<i>x</i>)'));
    }
    return null;
  }

  // sin², cos², tan², cot² -> power-reduction / Pythagorean identities
  function rewriteTrig(f, v, depth) {
    if (f.t !== 'pow' || f.base.t !== 'fn' || !isInt(f.exp) || f.exp.n !== 2 || freeOf(f.base.arg, v)) return null;
    const g = f.base.arg, nm = f.base.name;
    const two = num(2);
    const RW = {
      sin: [() => mul(HALF, sub(ONE, fn('cos', mul(two, g)))), 'Power-reduction identity: sin<sup>2</sup>(<i>u</i>) = (1−cos(2<i>u</i>))/2'],
      cos: [() => mul(HALF, add(ONE, fn('cos', mul(two, g)))), 'Power-reduction identity: cos<sup>2</sup>(<i>u</i>) = (1+cos(2<i>u</i>))/2'],
      tan: [() => sub(pw(fn('sec', g), two), ONE), 'Identity: tan<sup>2</sup>(<i>u</i>) = sec<sup>2</sup>(<i>u</i>)−1'],
      cot: [() => sub(pw(fn('csc', g), two), ONE), 'Identity: cot<sup>2</sup>(<i>u</i>) = csc<sup>2</sup>(<i>u</i>)−1'],
    };
    if (!RW[nm]) return null;
    const rw = simp(RW[nm][0]());
    const s = istep(rw, v, depth + 1);
    if (!s) return null;
    return { rule: 'RewriteRule', f, var: v, rw, sub: [s], res: s.res, note: RW[nm][1] };
  }

  // candidate inner functions u = g(x): arguments of functions, bases and exponents of powers
  function candidates(f, v) {
    const out = new Map();
    const visit = (n) => {
      const addC = (c) => { if (!freeOf(c, v) && !isSym(c, v)) out.set(key(c), c); };
      if (n.t === 'fn') { addC(n.arg); addC(n); visit(n.arg); }
      else if (n.t === 'pow') { addC(n.base); if (!freeOf(n.exp, v)) { addC(n.exp); addC(n); } visit(n.base); visit(n.exp); }
      else if (n.t === 'add' || n.t === 'mul') n.args.forEach(visit);
    };
    visit(f);
    out.delete(key(f));
    return [...out.values()].sort((a, b) => size(a) - size(b) || (key(a) < key(b) ? 1 : -1));
  }
  function usub(f, v, depth) {
    if (depth > 10) return null;
    const uName = v === 'u' ? 'w' : 'u';
    const Uv = sym(uName);
    for (const g of candidates(f, v)) {
      let dg;
      try { dg = diff(g, v).res; } catch (e) { continue; }
      if (isZero(dg)) continue;
      let q;
      try { q = simp(replace(simp(div(f, dg)), key(g), Uv)); } catch (e) { continue; }
      if (!freeOf(q, v)) {
        // try again after replacing inside the expanded quotient
        try { q = simp(replace(expand(div(f, dg)), key(g), Uv)); } catch (e) { continue; }
        if (!freeOf(q, v)) continue;
      }
      if (same(q, f)) continue;
      const s = istep(q, uName, depth + 1);
      if (!s) continue;
      const res = simp(replace(s.res, uName, g));
      return {
        rule: 'URule', f, var: v, u: uName, ufunc: g, du: dg, sub: [s], res,
        note: `Substitution: let <i>${uName}</i> = <i>g</i>(<i>${v}</i>), d<i>${uName}</i> = <i>g</i>′(<i>${v}</i>) d<i>${v}</i>`,
      };
    }
    return null;
  }

  function expandStep(f, v, depth) {
    if (depth > 12) return null;
    const e = expand(f);
    if (same(e, f) || e.t !== 'add') return null;
    const s = istep(e, v, depth + 1);
    if (!s) return null;
    return { rule: 'RewriteRule', f, var: v, rw: e, sub: [s], res: s.res, note: INOTE.ExpandRule };
  }

  // LIATE: logarithmic, inverse trig, algebraic, trigonometric, exponential
  function liate(n, v) {
    if (n.t === 'fn' && n.name === 'ln') return 0;
    if (n.t === 'fn' && ['asin', 'acos', 'atan'].includes(n.name)) return 1;
    if (isSym(n, v) || (n.t === 'pow' && isSym(n.base, v) && isInt(n.exp) && n.exp.n > 0)) return 2;
    if (n.t === 'fn' && ['sin', 'cos', 'sinh', 'cosh'].includes(n.name)) return 3;
    if (n.t === 'pow' && freeOf(n.base, v)) return 4;
    return 9;
  }
  function parts(f, v, depth) {
    if (depth > 10) return null;
    const fs = f.t === 'mul' ? f.args : [f];
    let u, dv;
    if (fs.length === 1) {
      if (liate(f, v) > 1) return null; // ∫ln(x), ∫tan⁻¹(x): u = f, dv = dx
      u = f; dv = ONE;
    } else {
      const order = fs.map((a, i) => [liate(a, v), i]).sort((a, b) => a[0] - b[0]);
      if (order[0][0] > 2) return null;
      u = fs[order[0][1]];
      dv = simpMul(fs.filter((_, i) => i !== order[0][1]));
      if (liate(u, v) === 2 && !(liate(dv, v) >= 3 && liate(dv, v) <= 4)) return null;
    }
    const vs = istep(dv, v, depth + 1);
    if (!vs) return null;
    const V = vs.res;
    let du;
    try { du = diff(u, v).res; } catch (e) { return null; }
    const second = simp(mul(V, du));
    const s2 = istep(second, v, depth + 1);
    if (!s2) return null;
    return {
      rule: 'PartsRule', f, var: v, pu: u, dv, pv: V, sub: [s2], res: simp(sub(mul(u, V), s2.res)),
      note: vx(v, INOTE.PartsRule),
    };
  }

  /* ---------- steps -> display lines ---------- */
  const H = (n) => html(simp(n));
  const ruleTitle = (r) => r.replace(/Rule$/, '').replace(/([a-z])([A-Z])/g, '$1 $2') + ' rule';
  const C_HTML = '+<i>C</i>';

  function intLines(n, out) {
    const lhs = Int(n.f, n.var);
    const eq = (l, r, note, plusC = '') => out.push({ note, html: `${l ? H(l) : ''}=${H(r)}${plusC}` });
    const s0 = n.sub && n.sub[0];
    switch (n.rule) {
      case 'AddRule':
        out.push({ note: n.note || INOTE.AddRule, html: `${H(lhs)}=${n.sub.map((s) => H(Int(s.f, s.var))).join('+')}` });
        n.sub.forEach((s) => intLines(s, out));
        return;
      case 'ConstantTimesRule':
        eq(lhs, mul(n.c, Int(s0.f, s0.var)), n.note || INOTE.ConstantTimesRule);
        intLines(s0, out);
        return;
      case 'URule':
        out.push({
          note: n.note || INOTE.URule,
          html: `<i>${n.u}</i>=${H(n.ufunc)}, d<i>${n.u}</i>=${H(n.du)}·d<i>${n.var}</i>`,
        });
        eq(lhs, Int(s0.f, s0.var), `Rewrite the integral in terms of <i>${n.u}</i>`);
        intLines(s0, out);
        eq(lhs, n.res, `Substitute back <i>${n.u}</i> = ${H(n.ufunc)}`);
        return;
      case 'PartsRule':
        out.push({
          note: n.note || INOTE.PartsRule,
          html: `<i>u</i>=${H(n.pu)}, d<i>v</i>=${H(n.dv)}·d<i>${n.var}</i>, <i>v</i>=${H(n.pv)}`,
        });
        if (s0) {
          // uv − ∫(−g) is shown as uv + ∫g
          const rest = negCoef(s0.f) ? Int(negate(s0.f), s0.var) : neg(Int(s0.f, s0.var));
          eq(lhs, add(mul(n.pu, n.pv), rest), '∫<i>u</i> d<i>v</i> = <i>u</i><i>v</i> − ∫<i>v</i> d<i>u</i>');
          intLines(s0, out);
        }
        eq(lhs, n.res, 'Combine');
        return;
      case 'RewriteRule':
        eq(lhs, Int(n.rw, n.var), n.note || INOTE.RewriteRule);
        intLines(s0, out);
        return;
    }
    eq(lhs, n.res, n.note || INOTE[n.rule] || ruleTitle(n.rule));
  }
  function integralLines(tree, f, res) {
    const out = [];
    intLines(tree, out);
    out.push({ note: 'Add the constant of integration <i>C</i>', html: `${H(Int(f, 'x'))}=${H(res)}${C_HTML}` });
    return out;
  }
  function derLines(n, out) {
    const lhs = Der(n.f, n.var);
    if (!n.rhs) { out.push({ note: n.note, html: `${H(lhs)}=${H(n.res)}` }); return; }
    out.push({ note: n.note, html: `${H(lhs)}=${H(n.rhs)}` });
    n.sub.forEach((s) => derLines(s, out));
    out.push({ note: DNOTE.Combine, html: `${H(lhs)}=${H(n.res)}` });
  }
  function derivativeLines(tree) {
    const out = [];
    derLines(tree, out);
    return out;
  }
  // tree from SymPy: convert every expression field
  function treeFromJSON(j) {
    const t = { ...j };
    for (const k of ['f', 'res', 'c', 'ufunc', 'du', 'pu', 'dv', 'pv', 'rw']) if (j[k]) t[k] = simp(fromJSON(j[k]));
    t.var = (j.var || 'x').replace(/^_/, '');
    if (j.u) t.u = j.u.replace(/^_/, '');
    t.sub = (j.sub || []).map(treeFromJSON);
    return t;
  }

  /* ---------- Taylor series (MENU D: Series) ---------- */
  // numeric value of an x-free tree (radians); NaN when undefined
  const FN_NUM = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan, sec: (v) => 1 / Math.cos(v), csc: (v) => 1 / Math.sin(v),
    cot: (v) => 1 / Math.tan(v), asin: Math.asin, acos: Math.acos, atan: Math.atan, sinh: Math.sinh,
    cosh: Math.cosh, tanh: Math.tanh, asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
    ln: (v) => (v > 0 ? Math.log(v) : NaN), abs: Math.abs,
  };
  FN_NUM.fact = (v) => { if (!Number.isInteger(v) || v < 0 || v > 170) return NaN; let r = 1; for (let i = 2; i <= v; i++) r *= i; return r; };
  // numeric value of a tree; env gives the symbols ({x: 0.5, k: 3}); NaN when undefined
  function evalAt(n, env = {}) {
    const ev = (m) => evalAt(m, env);
    switch (n.t) {
      case 'num': return n.n / n.d;
      case 'sym': return n.name in env ? env[n.name] : NaN;
      case 'const': return n.name === 'pi' ? Math.PI : n.name === 'e' ? Math.E : NaN;
      case 'add': return n.args.reduce((s, a) => s + ev(a), 0);
      case 'mul': return n.args.reduce((s, a) => s * ev(a), 1);
      case 'pow': {
        const b = ev(n.base), e = ev(n.exp);
        // odd roots of negatives: (−8)^(1/3) = −2
        if (b < 0 && isNum(n.exp) && n.exp.d % 2 === 1 && !Number.isInteger(e)) return (n.exp.n % 2 ? -1 : 1) * Math.pow(-b, e);
        return Math.pow(b, e);
      }
      case 'fn': return FN_NUM[n.name] ? FN_NUM[n.name](ev(n.arg)) : NaN;
    }
    return NaN;
  }
  const evalN = (n) => evalAt(n);
  const subst = (n, v, by) => replace(n, key(sym(v)), by);
  const factorialN = (k) => { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; };

  // Taylor polynomial of f about x = a (a: plain number) up to order n.
  // Returns { terms: [{k, c}], ders: [{k, d, v}], dn1, exact } — c: coefficient of (x−a)^k,
  // d: k-th derivative, v: its value at a, dn1: (n+1)-th derivative (remainder bound),
  // exact: f is a polynomial of degree ≤ n. null when the JS rules give up (→ SymPy).
  function taylor(f, a, n) {
    const A = toNum(a);
    const terms = [], ders = [];
    let d = simp(f);
    for (let k = 0; k <= n + 1; k++) {
      if (k === n + 1) return { terms, ders, dn1: d, exact: isZero(d) };
      const raw = subst(d, 'x', A);
      const c = simp(raw);
      const v = evalN(c);
      // check the unsimplified value too: sin(x)/x at 0 is 0·0⁻¹, which simp() would turn into 0
      if (!Number.isFinite(v) || !Number.isFinite(evalN(raw)) || !freeOf(c, 'x') || size(c) > 60) return null;
      ders.push({ k, d, v: c });
      terms.push({ k, c: simp(mul(c, num(1, factorialN(k)))) });
      d = simp(diff(d, 'x').res);
      if (size(d) > 3000) return null;
    }
    return null;
  }
  // a plain number as a SymPy literal (exact when it looks rational)
  const pyNum = (v) => toPy(toNum(v));

  // LCD HTML of Σ c_k (x−a)^k in rising powers, plus the O((x−a)^(n+1)) remainder
  const SLOT = '\u0001';
  // "x" or "(x−a)"
  function xaHTML(a) {
    const A = toNum(a);
    return isZero(A) ? '<i>x</i>' : `(<i>x</i>${negCoef(A) ? '+' : '−'}${html(negCoef(A) ? negate(A) : A)})`;
  }
  function seriesHTML(terms, a, n, exact = false) {
    const A = toNum(a);
    const base = xaHTML(a);
    let h = '';
    for (const { k, c } of terms) {
      const t = simp(mul(c, pw(sym(SLOT), num(k))));
      if (isZero(t)) continue;
      const neg = negCoef(t);
      const body = html(neg ? negate(t) : t, 'top');
      h += (h || neg ? (neg ? '−' : '+') : '') + body;
    }
    const fill = (s) => s.split(`<i>${SLOT}</i>`).join(base);
    const big = `<span class="nw">O(${base}<span class="nd-sup">${n + 1}</span>)</span>`;
    return fill(h || '0') + (exact ? '' : '+' + big);
  }

  // coefficients [c0, c1, …] of a polynomial in x (exact trees), or null when f is not one
  function polyCoeffs(f) {
    const e = expand(simp(f));
    const terms = e.t === 'add' ? e.args : [e];
    const out = [];
    for (const t of terms) {
      const fs = t.t === 'mul' ? t.args : [t];
      let p = 0;
      const c = [];
      for (const a of fs) {
        if (isSym(a, 'x')) p += 1;
        else if (a.t === 'pow' && isSym(a.base, 'x') && isInt(a.exp) && a.exp.n > 0) p += a.exp.n;
        else if (freeOf(a, 'x')) c.push(a);
        else return null;
      }
      if (p > 40) return null;
      while (out.length <= p) out.push(ZERO);
      out[p] = simp(add(out[p], c.length ? mul(...c) : ONE));
    }
    return out;
  }
  // a sum of trees in the given order, signs folded: a − b + c
  function sumHTML(list) {
    let h = '';
    for (const t0 of list) {
      const t = simp(t0);
      if (isZero(t)) continue;
      const ng = negCoef(t);
      const body = html(ng ? negate(t) : t, 'top');
      h += (h || ng ? (ng ? '−' : '+') : '') + body;
    }
    return h || '0';
  }
  // Σ with limits (lo/hi: html strings)
  const sigmaHTML = (body, v, lo, hi, sym = 'Σ') => `<span class="nd-sum"><span class="nd-sig"><span class="hi">${hi}</span><span class="sym">${sym}</span>`
    + `<span class="lo"><i>${v}</i>=${lo}</span></span>${body}</span>`;

  // building blocks for modes/series.js
  const T = { num, sym, cst, fn, pw, mul, add, neg, div, sub, ZERO, ONE, toNum, isNum, isZero, isOne, isInt, negCoef, negate, size, rAdd, rMul };

  return {
    fromRow, fromRowSym, fromJSON, treeFromJSON, simp, html, htmlRaw, toPy, diff, integ, Int, Der, freeOf,
    integralLines, derivativeLines, C_HTML, taylor, seriesHTML, pyNum, evalN, evalAt,
    expand, polyCoeffs, sumHTML, sigmaHTML, subst, factorial: factorialN, T, xaHTML,
  };
})();
