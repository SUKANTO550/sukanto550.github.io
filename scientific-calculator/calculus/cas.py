# SymPy side of the indefinite-calculus feature.
# Loaded once by cas-worker.js inside Pyodide. The JS side calls
# cas_integrate(expr_string) and gets back a JSON string:
#   {"res": tree, "steps": rule-tree | null, "verified": bool}
#   {"noElem": true}                  integral has no elementary form
#   {"error": "message"}              anything else went wrong
# Expression trees use the same shape as the JS engine (calculus/cas.js):
#   {"t":"num","n":p,"d":q} {"t":"float","v":1.5} {"t":"sym","name":"x"}
#   {"t":"const","name":"pi"|"e"} {"t":"add","args":[...]} {"t":"mul","args":[...]}
#   {"t":"pow","base":..,"exp":..} {"t":"fn","name":"sin","arg":..}

import json
from sympy import (Symbol, sympify, integrate, diff, simplify, Integral, Add, Mul, Pow,
                   exp, log, Abs, S, apart, expand, cancel, trigsimp, together, factor,
                   expand_trig, sin, cos, tan, sec, csc, cot, asin, acos, atan,
                   sinh, cosh, tanh, asinh, acosh, atanh)
from sympy.integrals import manualintegrate as MI

x = Symbol('x')

# functions whose appearance means "no elementary antiderivative"
SPECIAL = {
    'erf', 'erfc', 'erfi', 'erf2', 'Si', 'Ci', 'Shi', 'Chi', 'Ei', 'li', 'Li', 'expint',
    'fresnels', 'fresnelc', 'gamma', 'uppergamma', 'lowergamma', 'polylog', 'zeta',
    'hyper', 'meijerg', 'elliptic_e', 'elliptic_f', 'elliptic_k', 'elliptic_pi',
    'LambertW', 'besselj', 'bessely', 'besseli', 'besselk', 'airyai', 'airybi',
    'Integral', 'polygamma', 'loggamma', 'beta',
}

FUNCS = {sin: 'sin', cos: 'cos', tan: 'tan', sec: 'sec', csc: 'csc', cot: 'cot',
         asin: 'asin', acos: 'acos', atan: 'atan', sinh: 'sinh', cosh: 'cosh',
         tanh: 'tanh', asinh: 'asinh', acosh: 'acosh', atanh: 'atanh', Abs: 'abs'}

LOCALS = {'x': x, 'E': S.Exp1, 'pi': S.Pi}
_ORD = [False]  # True while answering MENU E (ordered trees)
_LIT = set()    # ids of sums built in a chosen order (kept as written)


def tojs(e):
    """sympy expression -> JSON-able tree"""
    e = sympify(e)
    if e.is_Integer:
        return {'t': 'num', 'n': int(e), 'd': 1}
    if e.is_Rational:
        return {'t': 'num', 'n': int(e.p), 'd': int(e.q)}
    if e.is_Float:
        return {'t': 'float', 'v': float(e)}
    if e is S.Pi:
        return {'t': 'const', 'name': 'pi'}
    if e is S.Exp1:
        return {'t': 'const', 'name': 'e'}
    if e is S.Infinity:
        return {'t': 'const', 'name': 'oo'}
    if e is S.NegativeInfinity:
        return {'t': 'mul', 'args': [{'t': 'num', 'n': -1, 'd': 1}, {'t': 'const', 'name': 'oo'}]}
    if type(e).__name__ == 'harmonic':  # H_n^(m), e.g. S_n of 1/x^2
        m = int(e.args[1]) if len(e.args) > 1 and e.args[1].is_Integer else 1
        return {'t': 'fn', 'name': 'harm%d' % m, 'arg': tojs(e.args[0])}
    if type(e).__name__ == 'factorial':
        return {'t': 'fn', 'name': 'fact', 'arg': tojs(e.args[0])}
    if e is S.ImaginaryUnit:
        return {'t': 'const', 'name': 'i'}
    if e.is_Symbol:
        return {'t': 'sym', 'name': e.name}
    if isinstance(e, Add):  # MENU E keeps SymPy's print order (x² + 2x + 1)
        return {'t': 'add', 'args': [tojs(a) for a in (e.as_ordered_terms() if _ORD[0] and id(e) not in _LIT else e.args)]}
    if isinstance(e, Mul):
        fs = e.args
        if _ORD[0]:  # print order, with i last: √2 i
            fs = sorted(e.as_ordered_factors(), key=lambda f: f is S.ImaginaryUnit)
        return {'t': 'mul', 'args': [tojs(a) for a in fs]}
    if isinstance(e, Pow):
        return {'t': 'pow', 'base': tojs(e.base), 'exp': tojs(e.exp)}
    if isinstance(e, exp):
        return {'t': 'pow', 'base': {'t': 'const', 'name': 'e'}, 'exp': tojs(e.args[0])}
    if isinstance(e, log):
        if len(e.args) == 2:  # log(a, b) = ln a / ln b
            return {'t': 'mul', 'args': [{'t': 'fn', 'name': 'ln', 'arg': tojs(e.args[0])},
                                         {'t': 'pow', 'base': {'t': 'fn', 'name': 'ln', 'arg': tojs(e.args[1])},
                                          'exp': {'t': 'num', 'n': -1, 'd': 1}}]}
        return {'t': 'fn', 'name': 'ln', 'arg': tojs(e.args[0])}
    if e.func in FUNCS and len(e.args) == 1:
        return {'t': 'fn', 'name': FUNCS[e.func], 'arg': tojs(e.args[0])}
    # anything else: keep the name so the display can still show it
    return {'t': 'fn', 'name': e.func.__name__, 'arg': tojs(e.args[0]) if e.args else {'t': 'num', 'n': 0, 'd': 1}}


def _funcs(e):
    out = []
    stack = [e]
    while stack:
        a = stack.pop()
        if a.args:
            out.append(a)
            stack.extend(a.args)
    return out


def no_elementary(e):
    return e.has(Integral) or any(type(a).__name__ in SPECIAL for a in _funcs(e))


# ---------- manualintegrate rule tree -> step tree ----------
RuleBase = getattr(MI, 'Rule', None)


def is_rule(r):
    return RuleBase is not None and isinstance(r, RuleBase)


def rule_eval(r):
    if hasattr(r, 'eval'):
        return r.eval()
    return MI._manualintegrate(r)


def has_unknown(r):
    """True when the rule tree contains a step SymPy could not do"""
    if not is_rule(r):
        return False
    name = type(r).__name__
    if name == 'DontKnowRule':
        return True
    if name == 'AlternativeRule':
        return all(has_unknown(a) for a in r.alternatives)
    for v in vars(r).values():
        if is_rule(v) and has_unknown(v):
            return True
        if isinstance(v, (list, tuple)) and any(is_rule(a) and has_unknown(a) for a in v):
            return True
    return False


def conv(r):
    name = type(r).__name__
    if name == 'AlternativeRule':
        for a in r.alternatives:
            if not has_unknown(a):
                return conv(a)
    node = {'rule': name, 'f': tojs(r.integrand), 'var': str(r.variable), 'res': tojs(rule_eval(r))}
    if name == 'ConstantTimesRule':
        node['c'] = tojs(r.constant)
        node['sub'] = [conv(r.substep)]
    elif name == 'AddRule':
        node['sub'] = [conv(s) for s in r.substeps]
    elif name == 'URule':
        node['u'] = r.u_var.name
        node['ufunc'] = tojs(r.u_func)
        node['du'] = tojs(diff(r.u_func, r.variable))
        node['sub'] = [conv(r.substep)]
    elif name == 'PartsRule':
        node['pu'] = tojs(r.u)
        node['dv'] = tojs(r.dv)
        node['pv'] = tojs(rule_eval(r.v_step))
        node['sub'] = [conv(r.second_step)] if r.second_step is not None else []
    elif name == 'RewriteRule':
        node['rw'] = tojs(r.rewritten)
        node['sub'] = [conv(r.substep)]
    return node


def steps_for(f):
    try:
        r = MI.integral_steps(f, x)
    except Exception:
        return None
    if has_unknown(r):
        return None
    try:
        return conv(r), rule_eval(r)
    except Exception:
        return None


def rewrites(f):
    out = []
    for fn in (apart, expand, cancel, together, factor, trigsimp, expand_trig,
               lambda g: g.rewrite(sin), lambda g: g.rewrite(cos), lambda g: expand(trigsimp(g))):
        try:
            g = fn(f)
            if g != f and g not in out:
                out.append(g)
        except Exception:
            pass
    return out


def cas_integrate(src):
    try:
        f = sympify(src, locals=LOCALS)
    except Exception as e:
        return json.dumps({'error': 'parse: %s' % e})
    try:
        found = steps_for(f)
        steps, res = (found if found else (None, None))
        if steps is None:
            # step tracer failed: try rewritten integrands
            for g in rewrites(f):
                found = steps_for(g)
                if found:
                    sub, res = found
                    steps = {'rule': 'RewriteRule', 'f': tojs(f), 'var': 'x', 'rw': tojs(g),
                             'res': tojs(res), 'sub': [sub]}
                    break
        if res is None or no_elementary(res):
            res = integrate(f, x)
        if no_elementary(res):
            return json.dumps({'noElem': True})
        verified = False
        try:
            verified = simplify(diff(res, x) - f) == 0
        except Exception:
            pass
        return json.dumps({'res': tojs(res), 'steps': steps, 'verified': bool(verified)})
    except Exception as e:
        return json.dumps({'error': str(e)})


# =====================================================================
# MENU D: Series (modes/series.js). Every function returns a JSON string.
# Steps are lists of {"note": text, "parts": [...]}; a part is a text string,
# {"e": tree}, {"sum": {"f","v","lo","hi"}} (a Σ sign) or {"iv": interval}.
# An interval is {"all": true} or {"lo","hi": tree, "loIn","hiIn": bool|null}.
# =====================================================================
from sympy import (series as _series, summation as _summation, Sum as _Sum, Poly as _Poly, oo as _oo,
                   zoo as _zoo, nan as _nan, N as _N, factorial as _fact, limit as _limit, solve as _solve,
                   Piecewise as _Pw, gammasimp as _gsimp, Abs as _Abs, igcd as _igcd, degree as _degree,
                   count_ops as _ops, Integer as _Int, Basic as _Basic, gamma as _gamma, expand_func as _xfunc)
from sympy.polys.polyerrors import PolynomialError as _PolyErr
from sympy.concrete.guess import guess as _guess, guess_generating_function_rational as _ggf

K = Symbol('k', integer=True, nonnegative=True)   # series index
NN = Symbol('n', integer=True, positive=True)     # S_n upper limit
LOCALS['k'] = K
LOCALS['n'] = NN


def _E(e):
    return {'e': tojs(e)}


def _step(note, *parts):
    out = []
    for p in parts:
        if isinstance(p, _Basic) or isinstance(p, int):
            out.append(_E(p))
        else:
            out.append(p)
    return {'note': note, 'parts': out}


def _asc(e):
    """parts for a polynomial in rising powers of x: 1 + x + x²/2 + …"""
    terms = sorted(Add.make_args(expand(e)), key=lambda t: _degree(t, x) if t.is_polynomial(x) else 0)
    out = []
    for i, t in enumerate(terms):
        if i == 0:
            out.append(_E(t))
        elif t.could_extract_minus_sign():
            out += [' − ', _E(-t)]
        else:
            out += [' + ', _E(t)]
    return out


def _SUM(f, v, lo, hi):
    return {'sum': {'f': tojs(f), 'v': v, 'lo': tojs(lo), 'hi': tojs(hi)}}


def _finite(v):
    try:
        c = complex(_N(v, 15))
        ok = abs(c.imag) < 1e-12 and c.real == c.real and abs(c.real) != float('inf')
        return ok, c.real
    except Exception:
        return False, None


def _small(e, n=120):
    try:
        return _ops(e) <= n
    except Exception:
        return False


def _guess_term(coeffs, u):
    """general term (in K and u) whose u-power coefficients are coeffs[0..N], or None"""
    nz = [i for i, c in enumerate(coeffs) if c != 0]
    if len(nz) < 2:
        return None
    s0 = nz[0]
    m = 0
    for i in nz[1:]:
        m = _igcd(m, i - s0)
    m = m or 1
    count = (len(coeffs) - 1 - s0) // m + 1
    b = [coeffs[s0 + m * j] for j in range(count)]
    if len(b) < 4:
        return None
    for scaled in (False, True):
        seq = [b[j] * _fact(m * j + s0) for j in range(count)] if scaled else list(b)
        try:
            found = _guess(seq)
        except Exception:
            found = []
        for g in found:
            try:
                syms = list(g.free_symbols)
                cj = g.subs(syms[0], K + 1) if syms else g
                if scaled:
                    cj = cj / _fact(m * K + s0)
                cj = simplify(_xfunc(_gsimp(cj.rewrite(_gamma))))
                if cj.has(_gamma):
                    cj = cj.rewrite(_fact)
                if all(simplify(cj.subs(K, j) - b[j]) == 0 for j in range(count)):
                    return cj * u ** (m * K + s0)
            except Exception:
                continue
    return None


def _interval(term, k0):
    """interval of convergence of Σ term (k = k0 … ∞) in x, via the ratio test, with endpoint checks"""
    try:
        r = simplify(term.subs(K, K + 1) / term)
        L = simplify(_limit(r, K, _oo))
        if L == 0:
            return {'all': True}, _Abs(L)
        if not L.has(x) or L.has(K):
            return None, None
        xr = Symbol('xr', real=True)
        Lr = L.subs(x, xr)
        ends = sorted({e for e in _solve(_Abs(Lr) - 1, xr) if e.is_real}, key=lambda e: float(e))
        if len(ends) != 2:
            return None, _Abs(L)
        lo, hi = ends
        mid = (lo + hi) / 2
        if not (_Abs(Lr.subs(xr, mid)) < 1):
            return None, _Abs(L)

        def conv(e):
            te = simplify(term.subs(x, e))
            try:
                c = _Sum(te, (K, k0, _oo)).is_convergent()
                if c is not None:
                    return bool(c)
            except Exception:
                pass
            try:  # n-th term test, then Leibniz for alternating terms
                if simplify(_limit(_Abs(te), K, _oo)) != 0:
                    return False
                g = simplify(te * (-1) ** K)
                if not g.has((-1) ** K) and simplify(g.subs(K, K + 1) / g - 1).is_negative is not False:
                    if _limit(g, K, _oo) == 0 and (g.subs(K, k0 + 3) > 0) == True:
                        return True
            except Exception:
                pass
            return None
        return {'lo': tojs(lo), 'hi': tojs(hi), 'loIn': conv(lo), 'hiIn': conv(hi)}, _Abs(L)
    except Exception:
        return None, None


def _ratio_steps(iv, L):
    st = []
    if L is not None:
        st.append(_step('Ratio test: L = lim |a<sub>k+1</sub>/a<sub>k</sub>| as k → ∞', 'L = ', L))
    if iv is not None:
        st.append(_step('Converges where L < 1' + ('' if iv.get('all') else '; each endpoint is tested separately'),
                        {'iv': iv}))
    return st


# ---------- 1: Taylor ----------
def cas_taylor(src, a_src, n, need_terms):
    try:
        f = sympify(src, locals=LOCALS)
        a = sympify(a_src, locals=LOCALS)
        n = int(n)
    except Exception as e:
        return json.dumps({'error': 'parse: %s' % e})
    try:
        out = {}
        exact = False
        try:
            exact = bool(f.is_polynomial(x)) and bool(_degree(f, x) <= n)
        except Exception:
            pass
        out['exact'] = exact
        N = n if exact else max(n, 12)
        t = Symbol('t_')
        if exact:
            g = expand(f.subs(x, a + t))
        else:
            g = expand(_series(f.subs(x, a + t), t, 0, N + 1).removeO())
        try:
            p = _Poly(g, t)
        except _PolyErr:
            return json.dumps({'noSeries': True})
        coeffs = [simplify(p.coeff_monomial(t ** k)) for k in range(N + 1)]
        if need_terms:
            out['terms'] = [[k, tojs(coeffs[k])] for k in range(n + 1)]
            ders, direct = [], False
            d = f
            for k in range(n + 1):
                v = simplify(d.subs(x, a))
                ok, _ = _finite(v)
                if not ok:
                    direct = True
                    break
                ders.append([k, tojs(d) if _small(d) else None, tojs(v)])
                d = diff(d, x)
            out['ders'] = None if direct else ders
        dn1 = simplify(diff(f, x, n + 1))
        if _small(dn1, 400):
            out['dn1'] = tojs(dn1)
        if not exact:
            term = _guess_term(coeffs, x - a)
            if term is not None:
                out['general'] = tojs(term)
                iv, L = _interval(term, 0)
                out['interval'] = iv
                out['ratio'] = tojs(L) if L is not None else None
        return json.dumps(out)
    except Exception as e:
        return json.dumps({'error': str(e)})


# ---------- 2: Σ Sum (x = lo … ∞ | n | number) ----------
def _sum_steps(f, lo, up, r, div):
    st = [_step('The series', _SUM(f, 'x', lo, up))]
    try:
        q = simplify(f.subs(x, x + 1) / f)
        a0 = simplify(f.subs(x, lo))
        if not q.free_symbols:
            st.append(_step('Geometric series: each term is the previous one times r', 'r = ', q, ',   first term a = ', a0))
            if up is _oo:
                if _Abs(q) < 1:
                    st.append(_step('|r| < 1, so it converges to a/(1−r)', 'S = ', a0, ' ÷ (1 − ', q, ')'))
                else:
                    st.append(_step('|r| ≥ 1: the terms do not shrink, so the series diverges'))
            else:
                st.append(_step('Sum of N terms of a geometric series: S = a(1 − r<sup>N</sup>)/(1 − r)',
                                'N = ', simplify(up - lo + 1)))
        elif f.is_polynomial(x):
            if up is _oo:
                st.append(_step('The terms do not tend to 0, so the series diverges (n-th term test)'))
            else:
                st.append(_step('Expand, then use the power sums Σx = n(n+1)/2, Σx<sup>2</sup> = n(n+1)(2n+1)/6, '
                                'Σx<sup>3</sup> = n<sup>2</sup>(n+1)<sup>2</sup>/4', _SUM(expand(f), 'x', lo, up)))
        else:
            pf = apart(f, x) if f.is_rational_function(x) else f
            if pf != f:
                st.append(_step('Partial fractions', f, ' = ', pf))
                if isinstance(pf, Add) and len(pf.args) == 2:
                    g1 = pf.args[0]
                    if simplify(pf - (g1 - g1.subs(x, x + 1))) == 0 or simplify(pf - (g1.subs(x, x + 1) - g1)) == 0:
                        st.append(_step('Telescoping: each term cancels part of the next, only the ends remain'))
            c, pexp = f.as_coeff_exponent(x)
            if pexp.is_number and pexp < 0 and not c.has(x):
                pp = -pexp
                st.append(_step('p-series Σ c/x<sup>p</sup> with p = %s: converges only when p > 1' % pp))
            elif up is _oo:
                L = simplify(_limit(_Abs(q), x, _oo))
                verdict = ('L < 1: converges' if L < 1 else 'L > 1: diverges' if L > 1 else 'L = 1: inconclusive')
                st.append(_step('Ratio test: L = lim |a<sub>x+1</sub>/a<sub>x</sub>| = ' , L, '   ' + verdict))
                if L == 1 and q.could_extract_minus_sign():
                    st.append(_step('Alternating series whose terms decrease to 0: converges (Leibniz test)'))
    except Exception:
        pass
    if div:
        st.append(_step('Result: the series diverges'))
    elif r is not None:
        st.append(_step('Result', 'S = ', r))
    return st


def cas_sum(src, lo_src, hi_src):
    try:
        f = sympify(src, locals=LOCALS)
        lo = sympify(lo_src, locals=LOCALS)
        up = _oo if hi_src == 'oo' else NN if hi_src == 'n' else sympify(hi_src, locals=LOCALS)
    except Exception as e:
        return json.dumps({'error': 'parse: %s' % e})
    try:
        r = _summation(f, (x, lo, up))
        if isinstance(r, _Pw):
            r = r.args[0][0]
        if r in (_oo, -_oo, _zoo, _nan) or r.has(_oo, -_oo, _zoo):
            return json.dumps({'div': True, 'steps': _sum_steps(f, lo, up, None, True)})
        if r.has(_Sum) or no_elementary(r):
            if not r.has(_Sum):
                ok, v = _finite(r)
                if ok:
                    return json.dumps({'res': tojs(r), 'approx': v, 'steps': _sum_steps(f, lo, up, r, False)})
            conv = None
            if up is _oo:
                try:
                    conv = _Sum(f, (x, lo, _oo)).is_convergent()
                except Exception:
                    conv = None
            if conv is False:
                return json.dumps({'div': True, 'steps': _sum_steps(f, lo, up, None, True)})
            if conv is True:
                ok, v = _finite(_Sum(f, (x, lo, _oo)))
                if ok:
                    return json.dumps({'approx': v, 'steps': _sum_steps(f, lo, up, None, False)})
            return json.dumps({'unknown': True})
        r = factor(simplify(r)) if up is NN else simplify(r)
        ok, v = _finite(r)
        return json.dumps({'res': tojs(r), 'approx': v if ok else None, 'steps': _sum_steps(f, lo, up, r, False)})
    except Exception as e:
        return json.dumps({'error': str(e)})


# ---------- 5: Sum of Expansion ----------
def _sumexp(term, k0, pre):
    st = list(pre)
    st.append(_step('The expansion', _SUM(term, 'k', k0, _oo)))
    iv, L = _interval(term, k0)
    st += _ratio_steps(iv, L)
    def total(t):
        r = _summation(t, (K, k0, _oo))
        return r.args[0][0] if isinstance(r, _Pw) else r
    r = total(term)
    if r.has(_Sum):  # e.g. (k+1)x^k: sum the expanded pieces separately
        parts = Add.make_args(expand(term))
        if len(parts) > 1:
            r = Add(*[total(t) for t in parts])
    if r.has(_Sum) or r.has(_zoo) or r.has(_nan):
        return {'unknown': True, 'interval': iv, 'steps': st}
    r = simplify(r)
    st.append(_step('Sum of the series (closed form)', 'S(x) = ', r))
    try:
        chk = expand(_series(r, x, 0, 4).removeO())
        st.append(_step('Check: expanding S(x) gives back the first terms', *_asc(chk), ' + …'))
    except Exception:
        pass
    return {'closed': tojs(r), 'interval': iv, 'steps': st}


def cas_sumexp(src, k0_src):
    try:
        term = sympify(src, locals=LOCALS)
        k0 = int(sympify(k0_src))
    except Exception as e:
        return json.dumps({'error': 'parse: %s' % e})
    try:
        return json.dumps(_sumexp(term, k0, [_step('General term', 'a<sub>k</sub> = ', term)]))
    except Exception as e:
        return json.dumps({'error': str(e)})


def cas_firstterms(coeff_srcs):
    try:
        coeffs = [sympify(c, locals=LOCALS) for c in json.loads(coeff_srcs)]
    except Exception as e:
        return json.dumps({'error': 'parse: %s' % e})
    try:
        given = sum(c * x ** i for i, c in enumerate(coeffs))
        term = _guess_term(coeffs, x)
        if term is None:
            try:
                g = _ggf(coeffs, X=x)
            except Exception:
                g = None
            if g is None:
                return json.dumps({'noPattern': True})
            g = factor(simplify(g))
            st = [_step('Given terms', *_asc(given), ' + …'),
                  _step('No simple formula for the k-th coefficient, but they satisfy a linear recurrence, '
                        'so the series is a rational function', 'S(x) = ', g)]
            return json.dumps({'closed': tojs(g), 'interval': None, 'steps': st})
        pre = [_step('Given terms', *_asc(given), ' + …'),
               _step('Pattern in the coefficients: general term', 'a<sub>k</sub> = ', term)]
        out = _sumexp(term, 0, pre)
        out['general'] = tojs(term)
        return json.dumps(out)
    except Exception as e:
        return json.dumps({'error': str(e)})


# =====================================================================
# MENU E: Algebra (Factorize, Simplify, Partial Fractions)
# The JS side sends variables as v_<letter> (v_x, v_y, v_A ...) so that letters
# such as E never clash with SymPy names. Trees come back in print order.
# =====================================================================
import re as _re
from sympy import (Poly, Rational, sqrt, roots as _roots, div as _div, fraction as _fraction,
                   factor_list as _factor_list, divisors as _divisors, gcd as _gcd,
                   re as _Re, im as _Im, N as _N, count_ops as _ops)
from sympy import solve as _asolve


def _alg_parse(src):
    loc = dict(LOCALS)
    for n in set(_re.findall(r'\bv_([A-Za-z])\b', src)):
        loc['v_' + n] = Symbol(n)
    return sympify(src, locals=loc)


def _alg_out(fn):
    """run fn() with ordered trees and wrap the answer as JSON"""
    _ORD[0] = True
    try:
        return json.dumps(fn())
    except Exception as e:
        return json.dumps({'error': str(e)})
    finally:
        _ORD[0] = False
        _LIT.clear()


def _gens(e):
    return sorted(e.free_symbols, key=lambda s: (s.name != 'x', s.name))


def _main_var(e):
    fs = _gens(e)
    return fs[0] if fs else x


def _U(*a):     # product shown as written
    return Mul(*a, evaluate=False)


def _P(b, n):   # power shown as written
    return Pow(b, n, evaluate=False)


def _A(*a):     # sum shown as written, in this order
    e = Add(*a, evaluate=False)
    _LIT.add(id(e))
    return e


def _vname(v):
    return '<i>%s</i>' % v.name


def _mono_root(t, n):
    """t = c*prod(v^k), c > 0 an exact n-th power and every k divisible by n -> n-th root, else None"""
    c, rest = t.as_coeff_Mul()
    if not c.is_Rational or c <= 0:
        return None
    rc = c ** Rational(1, n)
    if not rc.is_Rational:
        return None
    if rest == 1:
        return rc
    out = rc
    for b, k in rest.as_powers_dict().items():
        if b.is_number or not (k.is_Integer and k % n == 0):
            return None
        out *= b ** (k // n)
    return out


def _signed_root(t, n):
    if t.could_extract_minus_sign():
        r = _mono_root(-t, n)
        return -r if (r is not None and n % 2) else None
    return _mono_root(t, n)


def _fsplit(p, st, depth=0):
    """factor polynomial p over Q, recording the method used; returns the list of factors"""
    p = expand(p)
    terms = p.as_ordered_terms() if isinstance(p, Add) else [p]
    if depth > 14 or p.is_number or len(terms) == 1:
        return [p]
    gens = _gens(p)
    if not p.is_polynomial(*gens):
        f = factor(p)
        if f != p:
            st.append(_step('Factorize', p, ' = ', f))
        return [f]
    P = Poly(p, *gens)
    # 1. common factor (a number and/or powers of the variables)
    c, q = p.as_content_primitive()
    mon, _ = P.terms_gcd()
    g = c * Mul(*[v ** k for v, k in zip(gens, mon)])
    if all(t.could_extract_minus_sign() for t in terms):
        g = -g
    if g != 1:
        q = expand(p / g)
        st.append(_step('Take out the factor −1' if g == -1 else 'Take out the common factor', p, ' = ', _U(g, q)))
        return [g] + _fsplit(q, st, depth + 1)
    # 2. two terms: difference of squares, sum / difference of cubes
    if len(terms) == 2:
        t1, t2 = terms
        if t1.could_extract_minus_sign() != t2.could_extract_minus_sign():
            pos, neg = (t1, -t2) if not t1.could_extract_minus_sign() else (t2, -t1)
            a, b = _mono_root(pos, 2), _mono_root(neg, 2)
            if a is not None and b is not None:
                f1, f2 = a - b, a + b
                st.append(_step('Difference of squares: a² − b² = (a − b)(a + b)',
                                p, ' = ', _A(_P(a, 2), _U(-1, _P(b, 2))), ' = ', _U(f1, f2)))
                return _fsplit(f1, st, depth + 1) + _fsplit(f2, st, depth + 1)
        a, b = _signed_root(t1, 3), _signed_root(t2, 3)
        if a is not None and b is not None:
            f1, f2 = expand(a + b), expand(a ** 2 - a * b + b ** 2)
            note = ('Difference of cubes: a³ − b³ = (a − b)(a² + ab + b²)' if b.could_extract_minus_sign()
                    else 'Sum of cubes: a³ + b³ = (a + b)(a² − ab + b²)')
            st.append(_step(note, p, ' = ', _U(f1, f2)))
            return _fsplit(f1, st, depth + 1) + _fsplit(f2, st, depth + 1)
    # 3. three terms in one variable: a quadratic in u = v^m
    if len(terms) == 3 and len(gens) == 1:
        v = gens[0]
        d0 = sorted((mm[0] for mm in P.monoms()), reverse=True)
        if d0[2] == 0 and d0[0] == 2 * d0[1]:
            m = d0[1]
            u = v ** m
            A_, B_, C_ = P.coeff_monomial(v ** (2 * m)), P.coeff_monomial(v ** m), P.coeff_monomial(1)
            D = B_ ** 2 - 4 * A_ * C_
            pre = '' if m == 1 else 'A quadratic in %s<sup>%d</sup>. ' % (_vname(v), m)
            if D == 0:
                ra, rc = _mono_root(A_, 2), _mono_root(C_, 2)
                if ra is not None and rc is not None:
                    f = ra * u + (rc if B_ > 0 else -rc)
                    st.append(_step(pre + 'Perfect square: a² ± 2ab + b² = (a ± b)²', p, ' = ', _P(f, 2)))
                    return _fsplit(f, st, depth + 1) * 2
                f = u + B_ / (2 * A_)
                st.append(_step(pre + 'Discriminant b² − 4ac = 0: a perfect square', p, ' = ', _U(A_, _P(f, 2))))
                return [A_] + _fsplit(f, st, depth + 1) * 2
            sD = sqrt(D)
            if D > 0 and sD.is_Rational:
                mm, nn = (B_ + sD) / 2, (B_ - sD) / 2
                st.append(_step(pre + 'Split the middle term: the two numbers with product ac = %s and sum b = %s are %s and %s'
                                % (A_ * C_, B_, mm, nn), p, ' = ', _A(A_ * u ** 2, mm * u, nn * u, C_)))
                g1 = _gcd(A_, mm)
                br = expand(cancel((A_ * u + mm) / g1))
                h = cancel((nn * u + C_) / br)
                f1 = expand(g1 * u + h)
                st.append(_step('Group in pairs and take out the common factor',
                                p, ' = ', _A(_U(g1 * u, br), _U(h, br)), ' = ', _U(f1, br)))
                return _fsplit(f1, st, depth + 1) + _fsplit(br, st, depth + 1)
            st.append(_step(pre + 'Discriminant b² − 4ac = %s is not a perfect square, so it does not factor over ℚ' % D, p))
            return [p]
    # 4. four terms: grouping
    if len(terms) == 4:
        for (i, j), (k, l) in [((0, 1), (2, 3)), ((0, 2), (1, 3)), ((0, 3), (1, 2))]:
            g1, g2 = _gcd(terms[i], terms[j]), _gcd(terms[k], terms[l])
            if terms[i].could_extract_minus_sign():
                g1 = -g1
            if terms[k].could_extract_minus_sign():
                g2 = -g2
            b1, b2 = expand((terms[i] + terms[j]) / g1), expand((terms[k] + terms[l]) / g2)
            if b2 == -b1:
                g2, b2 = -g2, b1
            if b1 == b2 and not b1.is_number:
                f1 = expand(g1 + g2)
                st.append(_step('Group in pairs and take out the common factors',
                                p, ' = ', _A(_U(g1, b1), _U(g2, b1)), ' = ', _U(f1, b1)))
                return _fsplit(f1, st, depth + 1) + _fsplit(b1, st, depth + 1)
    # 5. one variable, degree >= 3: rational root test + synthetic division
    if len(gens) == 1 and P.degree() >= 3 and all(cf.is_Rational for cf in P.all_coeffs()):
        v = gens[0]
        cs = [int(cf) for cf in P.all_coeffs()]
        a0, an = cs[-1], cs[0]
        if a0 != 0 and len(_divisors(abs(a0))) * len(_divisors(abs(an))) <= 600:
            cands = sorted({Rational(s * pp, qq) for pp in _divisors(abs(a0)) for qq in _divisors(abs(an)) for s in (1, -1)},
                           key=lambda r: (abs(r), bool(r < 0)))
            for r in cands:
                if P.eval(r) == 0:
                    lin = expand(r.q * v - r.p)
                    quo = _div(P, Poly(lin, v))[0].as_expr()
                    st.append(_step('Rational root test: P(%s) = 0, so it has the factor ' % r, lin))
                    st.append(_step('Divide (synthetic division): coefficients %s → %s'
                                    % (', '.join(map(str, cs)), ', '.join(str(cf) for cf in Poly(quo, v).all_coeffs())),
                                    p, ' = ', _U(lin, quo)))
                    return [lin] + _fsplit(quo, st, depth + 1)
            if P.degree() == 3:
                st.append(_step('No rational root, so this cubic does not factor over ℚ', p))
                return [p]
    # 6. anything else: SymPy
    f = factor(p)
    if f != p:
        st.append(_step('Factorize', p, ' = ', f))
        return [f]
    if P.total_degree() >= 2:
        st.append(_step('Cannot be factored further over ℚ', p))
    return [p]


def _over(fq, v, cplx):
    """refine a Q-factorization over R (cplx False) or C (True); returns (expr, steps)"""
    c, fl = _factor_list(fq)
    out, st = [c], []
    for f, m in fl:
        try:
            d = Poly(f, v).degree()
        except Exception:
            d = 0
        new = f
        if d >= 2:
            rs = _roots(Poly(f, v))
            if sum(rs.values()) == d and all(_ops(r) < 40 for r in rs):
                parts = []
                for r, k in rs.items():
                    if cplx or r.is_real:
                        parts += [v - r] * k
                    elif _Im(r) > 0:
                        parts += [expand(v ** 2 - 2 * _Re(r) * v + _Re(r) ** 2 + _Im(r) ** 2)] * k
                cand = Mul(Poly(f, v).LC(), *parts)
                if len(parts) > 1:
                    new = cand
                    note = ('Over ℂ it splits into linear factors (roots %s)' % ', '.join(str(r) for r in rs) if cplx
                            else 'Its real roots %s give linear factors' % ', '.join(str(r) for r in rs if r.is_real))
                    st.append(_step(note, f, ' = ', new))
        out.append(new ** m)
    return Mul(*out), st


def cas_factor(src):
    def go():
        e = _alg_parse(src)
        num, den = _fraction(together(e))
        v = _main_var(e)
        st = []
        if den != 1:
            st.append(_step('Factorize the numerator and the denominator separately', e, ' = ', _U(num, _P(den, -1))))
        _fsplit(num, st)
        if den != 1:
            _fsplit(den, st)
        F = factor(e)
        if not st:
            st.append(_step('Cannot be factored further over ℚ', e))
        st.append(_step('Result', e, ' = ', F))
        res = {'Q': {'res': tojs(F), 'steps': st}, 'var': v.name}
        one = len(e.free_symbols) == 1
        for key, cp in (('R', False), ('C', True)):
            if one:
                n2, s2 = _over(factor(num), v, cp)
                d2, s3 = _over(factor(den), v, cp) if den != 1 else (S.One, [])
                G = n2 / d2
                res[key] = {'res': tojs(G), 'same': bool(G == F), 'steps': st[:-1] + s2 + s3 + [_step('Result', e, ' = ', G)]}
            elif cp:
                G = factor(e, gaussian=True)
                more = [_step('Allow <i>i</i> (√−1) in the factors', F, ' = ', G)] if G != F else []
                res[key] = {'res': tojs(G), 'same': bool(G == F), 'steps': st[:-1] + more + [_step('Result', e, ' = ', G)]}
            else:
                res[key] = {'res': tojs(F), 'same': True, 'multi': True, 'steps': st}
        c, fl = _factor_list(num)
        cd, fd = _factor_list(den)
        fl = list(fl) + [(f, -m) for f, m in fd]
        res['flist'] = {'c': tojs(c / cd), 'f': [{'e': tojs(f), 'm': int(m)} for f, m in fl]}
        res['roots'] = None
        if one and e.is_rational_function(v) and num.has(v):
            try:
                Pn = Poly(num, v)
                rs = [{'e': tojs(r), 'm': int(k), 'real': bool(r.is_real), 'n': None if r.is_Rational else str(_N(r, 10))}
                      for r, k in _roots(Pn).items()]
                if sum(r['m'] for r in rs) < Pn.degree():   # no formula: numeric roots
                    rs = [{'e': None, 'm': 1, 'real': bool(_Im(r) == 0), 'n': str(r)} for r in Pn.nroots(n=10)]
                res['roots'] = rs
            except Exception:
                pass
        ex = expand(F)
        res['expand'] = {'e': tojs(ex), 'ok': bool(expand(e) == ex)}
        return res
    return _alg_out(go)


def cas_simplify(src):
    def go():
        e = _alg_parse(src)
        v = _main_var(e)
        st, cur = [], e
        t = together(cur)
        if t != cur and len(Add.make_args(cur)) > 1:
            st.append(_step('Combine into a single fraction', cur, ' = ', t))
            cur = t
        num, den = _fraction(cur)
        if den != 1:
            c = cancel(cur)
            if not _gcd(num, den).is_number:
                st.append(_step('Factorize the numerator and the denominator', cur, ' = ', _U(factor(num), _P(factor(den), -1))))
                st.append({'note': 'Cancel the common factor', 'parts': [{'e': tojs(factor(_gcd(num, den)))}]})
                st.append(_step('', cur, ' = ', c))
                cur = c
        if cur.has(sin, cos, tan, sec, csc, cot):
            ts = trigsimp(cur)
            if ts != cur:
                st.append(_step('Use trigonometric identities (sin²x + cos²x = 1, …)', cur, ' = ', ts))
                cur = ts
        r = simplify(cur)
        if r != cur and _ops(r) < _ops(cur):
            st.append(_step('Simplify', cur, ' = ', r))
            cur = r
        if not st:
            st.append(_step('Already in simplest form', e))
        st.append(_step('Result', e, ' = ', cur))
        excl = []
        d0 = _fraction(together(e))[1]
        if d0 != 1 and len(e.free_symbols) == 1:
            try:
                d1 = _fraction(together(cur))[1]
                for z in _asolve(d0, v):
                    if z.is_real and d1.subs(v, z) != 0:
                        excl.append(tojs(z))
            except Exception:
                pass
        tg = together(e)
        return {'res': tojs(cur), 'steps': st, 'excl': excl, 'var': v.name,
                'expand': tojs(expand(e)), 'together': tojs(factor(tg) if _fraction(tg)[1] != 1 else tg),
                'cancel': tojs(cancel(e))}
    return _alg_out(go)


def cas_apart(src):
    def go():
        e = together(_alg_parse(src))
        v = _main_var(e)
        num, den = _fraction(e)
        if not den.has(v) or not e.is_rational_function(v):
            return {'notRational': True, 'var': v.name}
        st = []
        Pn, Pd = Poly(num, v), Poly(den, v)
        q, r = S.Zero, num
        if Pn.degree() >= Pd.degree():
            qq, rr = _div(Pn, Pd)
            q, r = qq.as_expr(), rr.as_expr()
            st.append(_step('Improper fraction: divide the numerator by the denominator',
                            e, ' = ', _A(q, _U(r, _P(den, -1))) if r != 0 else q))
        if r == 0:
            st.append(_step('Result', e, ' = ', q))
            return {'res': tojs(q), 'steps': st, 'var': v.name, 'check': tojs(e)}
        c, fl = _factor_list(den)
        fden = factor(den)
        if fden != den:
            st.append(_step('Factorize the denominator', den, ' = ', fden))
        used = {s.name for s in e.free_symbols}
        letters = iter([L for L in 'ABCDFGHJKLMNPQRSTUVW' if L not in used])
        unknowns, terms, show = [], [], []
        for f, m in fl:
            d = Poly(f, v).degree()
            for j in range(1, m + 1):
                cs = [Symbol(next(letters)) for _ in range(d)]
                unknowns += cs
                nm = sum(cf * v ** i for i, cf in enumerate(reversed(cs)))
                terms.append((nm, f, j))
                show.append(_U(nm, _P(_P(f, j) if j > 1 else f, -1)))
        st.append(_step('Write it as a sum of partial fractions with unknown numerators',
                        _U(r, _P(den, -1)), ' = ', _A(*show) if len(show) > 1 else show[0]))
        others = [factor(cancel(den / c / f ** j)) for nm, f, j in terms]
        st.append(_step('Multiply both sides by the denominator', expand(r / c), ' = ',
                        _A(*[_U(nm, o) if o != 1 else nm for (nm, f, j), o in zip(terms, others)])))
        rhs = sum(nm * o for (nm, f, j), o in zip(terms, others))
        sol = _asolve(Poly(expand(r / c - rhs), v).all_coeffs(), unknowns, dict=True)
        if not sol:
            return {'error': 'no solution'}
        sol = sol[0]
        cover = all(m == 1 and Poly(f, v).degree() == 1 for f, m in fl)
        note = ('Cover-up: put %s equal to each root of the denominator' % _vname(v) if cover
                else 'Compare the coefficients of each power of %s and solve' % _vname(v))
        parts = []
        for u_ in unknowns:
            if parts:
                parts.append(',  ')
            parts += ['%s = ' % u_.name, {'e': tojs(sol.get(u_, S.Zero))}]
        st.append({'note': note, 'parts': parts})
        pf = [factor(nm.subs(sol)) / f ** j for nm, f, j in terms]
        pf = [t for t in pf if t != 0]
        out = _A(*([q] if q != 0 else []), *pf) if len(pf) + (q != 0) > 1 else (pf[0] if pf else q)
        st.append(_step('Result', e, ' = ', out))
        return {'res': tojs(out), 'steps': st, 'var': v.name, 'check': tojs(factor(together(apart(e, v))))}
    return _alg_out(go)
