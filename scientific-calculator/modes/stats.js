'use strict';

/* =========================================================
   MENU 6: Statistics and MENU 7: Distribution.
   Everything lives in one IIFE so no names leak into the shared
   global scope of the other mode scripts. The pure maths is
   exposed as window.StatsMath for testing.
   ========================================================= */
(() => {
  /* ---------- styles (prefixed .st-) ---------- */
  if (typeof document !== 'undefined' && document.head) {
    document.head.insertAdjacentHTML('beforeend', `<style>
.panel .st-tbl { border-collapse: collapse; font-size: calc(28 * var(--s)); line-height: calc(35 * var(--s)); table-layout: fixed; }
.panel .st-tbl th, .panel .st-tbl td { width: calc(170 * var(--s)); }
.panel .st-tbl th { font-weight: normal; text-align: center; border-bottom: 1px solid var(--lcd-ink); }
.panel .st-tbl td { text-align: right; padding: 0 calc(8 * var(--s)); white-space: nowrap; overflow: hidden; border-left: 1px solid var(--lcd-ink); }
.panel .st-tbl th + th { border-left: 1px solid var(--lcd-ink); }
.panel .st-tbl .st-n { width: calc(52 * var(--s)); text-align: left; border-left: none; padding: 0 calc(4 * var(--s)); }
.panel .st-tbl td.on { background: var(--lcd-ink); color: var(--lcd-1); }
.panel .st-bot { position: absolute; left: 0; right: calc(14 * var(--s)); bottom: 0; text-align: right; font-size: calc(32 * var(--s)); white-space: nowrap; overflow: hidden; }
.panel .st-r { display: flex; align-items: baseline; white-space: nowrap; padding-right: calc(26 * var(--s)); }
.panel .st-r .st-l { display: inline-block; width: 3.8em; }
.panel .st-r .st-v { margin-left: auto; }
.panel .st-r.st-head { justify-content: flex-start; }
.panel .st-pv { display: flex; align-items: baseline; white-space: nowrap; padding: 0 calc(6 * var(--s)); }
.panel .st-pv .st-l { display: inline-block; min-width: 1.6em; }
.panel .st-pv.on { background: var(--lcd-ink); color: var(--lcd-1); }
.panel .st-pv .cursor { background: currentColor; }
.panel .st-msg { text-align: center; margin-top: calc(40 * var(--s)); }
</style>`);
  }

  /* =========================================================
     Pure maths
     ========================================================= */
  const LN_SQRT_2PI = 0.5 * Math.log(2 * Math.PI);

  // complementary error function, relative error ~1e-13 or better
  function erfc(x) {
    if (Number.isNaN(x)) return NaN;
    if (x < 0) return 2 - erfc(-x);
    if (x < 2.5) {
      // erf(x) = 2/√π e^(−x²) Σ 2ⁿ x^(2n+1) / (1·3·…·(2n+1))  (all terms positive)
      const x2 = 2 * x * x;
      let term = x, sum = x;
      for (let k = 1; k < 300; k++) {
        term *= x2 / (2 * k + 1);
        sum += term;
        if (term < sum * 1e-17) break;
      }
      return 1 - (2 / Math.sqrt(Math.PI)) * Math.exp(-x * x) * sum;
    }
    // continued fraction erfc(x) = e^(−x²)/√π · 1/(x + (1/2)/(x + 1/(x + (3/2)/(x + …)))), modified Lentz
    const tiny = 1e-300;
    let f = x, C = x, D = 0;
    for (let k = 1; k < 5000; k++) {
      const a = k / 2;
      D = x + a * D; D = D === 0 ? tiny : D; D = 1 / D;
      C = x + a / C; C = C === 0 ? tiny : C;
      const delta = C * D;
      f *= delta;
      if (Math.abs(delta - 1) < 1e-16) break;
    }
    return Math.exp(-x * x) / Math.sqrt(Math.PI) / f;
  }
  const normCdf = (z) => 0.5 * erfc(-z / Math.SQRT2); // P(Z ≤ z)
  const normSf = (z) => 0.5 * erfc(z / Math.SQRT2);   // P(Z > z)
  const normPdf = (z) => Math.exp(-0.5 * z * z - LN_SQRT_2PI);

  // inverse of the standard normal CDF: Acklam's rational approximation + Halley polish
  function normInv(p) {
    if (!(p > 0 && p < 1)) return NaN;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const lo = 0.02425;
    let x;
    if (p < lo) {
      const q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= 1 - lo) {
      const q = p - 0.5, r = q * q;
      x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      const q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    for (let i = 0; i < 3; i++) {
      // error in the tail that keeps precision
      const e = x <= 0 ? normCdf(x) - p : (1 - p) - normSf(x);
      const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
      x -= u / (1 + x * u / 2);
    }
    return x;
  }

  /* Binomial / Poisson probabilities via Loader's saddle-point method
     (log-gamma differences without cancellation, accurate for large N). */
  const lnFact = (n) => { let s = 0; for (let k = 2; k <= n; k++) s += Math.log(k); return s; };
  // stirlerr(n) = ln(n!) − [(n+½)ln n − n + ln√(2π)]
  function stirlerr(n) {
    if (n <= 15) return lnFact(n) - ((n + 0.5) * Math.log(n) - n + LN_SQRT_2PI);
    const nn = n * n;
    const S0 = 1 / 12, S1 = 1 / 360, S2 = 1 / 1260, S3 = 1 / 1680, S4 = 1 / 1188;
    return (S0 - (S1 - (S2 - (S3 - S4 / nn) / nn) / nn) / nn) / n;
  }
  // bd0(x, m) = x ln(x/m) + m − x, computed stably
  function bd0(x, m) {
    if (Math.abs(x - m) < 0.1 * (x + m)) {
      let v = (x - m) / (x + m);
      let s = (x - m) * v, ej = 2 * x * v;
      v *= v;
      for (let j = 1; j < 1000; j++) {
        ej *= v;
        const s1 = s + ej / (2 * j + 1);
        if (s1 === s) return s1;
        s = s1;
      }
      return s;
    }
    return x * Math.log(x / m) + m - x;
  }
  const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;

  function binomPdf(x, n, p) {
    if (!isNonNegInt(x) || !isNonNegInt(n) || !(p >= 0 && p <= 1)) return NaN;
    if (x > n) return 0;
    const q = 1 - p;
    if (p === 0) return x === 0 ? 1 : 0;
    if (q === 0) return x === n ? 1 : 0;
    if (x === 0) return Math.exp(p < 0.1 ? -bd0(n, n * q) - n * p : n * Math.log(q));
    if (x === n) return Math.exp(q < 0.1 ? -bd0(n, n * p) - n * q : n * Math.log(p));
    const lc = stirlerr(n) - stirlerr(x) - stirlerr(n - x) - bd0(x, n * p) - bd0(n - x, n * q);
    const lf = Math.log(2 * Math.PI) + Math.log(x) + Math.log1p(-x / n);
    return Math.exp(lc - 0.5 * lf);
  }
  function binomCdf(x, n, p) {
    if (!isNonNegInt(x) || !isNonNegInt(n) || !(p >= 0 && p <= 1)) return NaN;
    if (x >= n) return 1;
    let s = 0;
    for (let k = 0; k <= x; k++) s += binomPdf(k, n, p);
    return Math.min(1, s);
  }
  function poisPdf(x, lam) {
    if (!isNonNegInt(x) || !(lam > 0)) return NaN;
    if (x === 0) return Math.exp(-lam);
    return Math.exp(-stirlerr(x) - bd0(x, lam)) / Math.sqrt(2 * Math.PI * x);
  }
  function poisCdf(x, lam) {
    if (!isNonNegInt(x) || !(lam > 0) || x > 1e7) return NaN;
    let s = 0;
    for (let k = 0; k <= x; k++) s += poisPdf(k, lam);
    return Math.min(1, s);
  }

  function normalPd(x, sd, mu) { return sd > 0 ? normPdf((x - mu) / sd) / sd : NaN; }
  function normalCd(lo, up, sd, mu) {
    if (!(sd > 0)) return NaN;
    if (lo > up) [lo, up] = [up, lo];
    const zl = (lo - mu) / sd, zu = (up - mu) / sd;
    return zl > 0 ? normSf(zl) - normSf(zu) : normCdf(zu) - normCdf(zl);
  }
  function invNormal(area, sd, mu) { return sd > 0 ? mu + sd * normInv(area) : NaN; }

  /* ---------- statistics ---------- */
  // rows: [{x, y, f}] -> sorted values for quartiles etc.
  function quartiles(pairs) {
    // pairs: [[value, freq]] with freq > 0; Casio method (halves exclude the median for odd n)
    const s = pairs.slice().sort((a, b) => a[0] - b[0]);
    const n = s.reduce((t, p) => t + p[1], 0);
    const intFreq = s.every((p) => Number.isInteger(p[1]));
    if (!intFreq) {
      // non-integer frequencies: cumulative-proportion quantiles
      const at = (frac) => {
        let c = 0;
        for (let i = 0; i < s.length; i++) {
          c += s[i][1];
          const r = c / n;
          if (Math.abs(r - frac) < 1e-12) return i + 1 < s.length ? (s[i][0] + s[i + 1][0]) / 2 : s[i][0];
          if (r > frac) return s[i][0];
        }
        return s[s.length - 1][0];
      };
      return { q1: at(0.25), med: at(0.5), q3: at(0.75) };
    }
    // k-th value (1-based) in the frequency-expanded sorted list
    const kth = (k) => {
      let c = 0;
      for (const [v, f] of s) { c += f; if (k <= c) return v; }
      return s[s.length - 1][0];
    };
    // median of positions [from, to]
    const medOf = (from, to) => {
      const m = to - from + 1;
      return m % 2 ? kth(from + (m - 1) / 2) : (kth(from + m / 2 - 1) + kth(from + m / 2)) / 2;
    };
    const med = medOf(1, n);
    if (n === 1) return { q1: med, med, q3: med };
    const h = Math.floor(n / 2);
    return { q1: medOf(1, h), med, q3: medOf(n - h + 1, n) };
  }

  // transforms for linearisable models: [X(x), Y(y), a from A, b from B]
  const MODELS = {
    lin: { X: (x) => x, Y: (y) => y, a: (A) => A, b: (B) => B },
    log: { X: Math.log, Y: (y) => y, a: (A) => A, b: (B) => B },
    exp: { X: (x) => x, Y: Math.log, a: Math.exp, b: (B) => B },
    abexp: { X: (x) => x, Y: Math.log, a: Math.exp, b: Math.exp },
    pow: { X: Math.log, Y: Math.log, a: Math.exp, b: (B) => B },
    inv: { X: (x) => 1 / x, Y: (y) => y, a: (A) => A, b: (B) => B },
  };

  // least squares line through (X, Y) with weights f; returns {A, B, r}
  function linFit(pts) {
    let n = 0, mx = 0, my = 0;
    for (const [x, y, f] of pts) { n += f; mx += f * x; my += f * y; }
    mx /= n; my /= n;
    let sxx = 0, syy = 0, sxy = 0;
    for (const [x, y, f] of pts) { sxx += f * (x - mx) ** 2; syy += f * (y - my) ** 2; sxy += f * (x - mx) * (y - my); }
    const B = sxy / sxx;
    return { A: my - B * mx, B, r: sxy / Math.sqrt(sxx * syy) };
  }
  function solve3(M, v) {
    // Gaussian elimination with partial pivoting
    const A = M.map((row, i) => [...row, v[i]]);
    for (let c = 0; c < 3; c++) {
      let p = c;
      for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]];
      if (A[c][c] === 0) return null;
      for (let r = c + 1; r < 3; r++) {
        const k = A[r][c] / A[c][c];
        for (let j = c; j < 4; j++) A[r][j] -= k * A[c][j];
      }
    }
    const out = [0, 0, 0];
    for (let r = 2; r >= 0; r--) {
      let s = A[r][3];
      for (let j = r + 1; j < 3; j++) s -= A[r][j] * out[j];
      out[r] = s / A[r][r];
    }
    return out;
  }
  // regression coefficients {a, b, c?, r?}; values NaN when impossible
  function regress(model, pts) {
    const bad = { a: NaN, b: NaN, c: NaN, r: NaN };
    if (!pts.length) return bad;
    if (model === 'quad') {
      // centre x for numerical stability, then expand back
      let n = 0, mx = 0;
      for (const [x, , f] of pts) { n += f; mx += f * x; }
      mx /= n;
      const s = [0, 0, 0, 0, 0], t = [0, 0, 0];
      for (const [x0, y, f] of pts) {
        const x = x0 - mx;
        for (let k = 0; k < 5; k++) s[k] += f * x ** k;
        for (let k = 0; k < 3; k++) t[k] += f * y * x ** k;
      }
      const sol = solve3([[s[0], s[1], s[2]], [s[1], s[2], s[3]], [s[2], s[3], s[4]]], t);
      if (!sol || sol.some((v) => !Number.isFinite(v))) return bad;
      const [a0, b0, c] = sol;
      return { a: a0 - b0 * mx + c * mx * mx, b: b0 - 2 * c * mx, c, r: NaN };
    }
    const M = MODELS[model];
    const tp = pts.map(([x, y, f]) => [M.X(x), M.Y(y), f]);
    if (tp.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) return bad;
    const { A, B, r } = linFit(tp);
    if (!Number.isFinite(A) || !Number.isFinite(B)) return bad;
    return { a: M.a(A), b: M.b(B), r };
  }
  // estimated ŷ for x and x̂ (two roots for the quadratic) for y
  function yHat(model, R, x) {
    const { a, b, c } = R;
    switch (model) {
      case 'lin': return a + b * x;
      case 'quad': return a + b * x + c * x * x;
      case 'log': return a + b * Math.log(x);
      case 'exp': return a * Math.exp(b * x);
      case 'abexp': return a * Math.pow(b, x);
      case 'pow': return a * Math.pow(x, b);
      case 'inv': return a + b / x;
    }
    return NaN;
  }
  function xHat(model, R, y, which = 1) {
    const { a, b, c } = R;
    switch (model) {
      case 'lin': return (y - a) / b;
      case 'quad': {
        const d = b * b - 4 * c * (a - y);
        if (d < 0) return NaN;
        return (-b + (which === 1 ? 1 : -1) * Math.sqrt(d)) / (2 * c);
      }
      case 'log': return Math.exp((y - a) / b);
      case 'exp': return Math.log(y / a) / b;
      case 'abexp': return Math.log(y / a) / Math.log(b);
      case 'pow': return Math.pow(y / a, 1 / b);
      case 'inv': return b / (y - a);
    }
    return NaN;
  }

  // all statistics of the data; model = regression model key or null for 1-variable
  function computeStats(rows, useFreq, model) {
    const pts = rows
      .map((r) => [r.x, r.y, useFreq ? r.f : 1])
      .filter((p) => p[2] > 0);
    const o = { n: pts.reduce((t, p) => t + p[2], 0) };
    if (!pts.length || !(o.n > 0)) return null;
    const n = o.n;
    const sum = (fn) => pts.reduce((t, [x, y, f]) => t + f * fn(x, y), 0);
    o.sx = sum((x) => x); o.sx2 = sum((x) => x * x);
    o.sy = sum((x, y) => y); o.sy2 = sum((x, y) => y * y);
    o.sxy = sum((x, y) => x * y); o.sx3 = sum((x) => x ** 3);
    o.sx2y = sum((x, y) => x * x * y); o.sx4 = sum((x) => x ** 4);
    o.mx = o.sx / n; o.my = o.sy / n;
    // two-pass variances
    const dxx = sum((x) => (x - o.mx) ** 2), dyy = sum((x, y) => (y - o.my) ** 2);
    o.vx = dxx / n; o.sdx = Math.sqrt(o.vx);
    o.vy = dyy / n; o.sdy = Math.sqrt(o.vy);
    o.svx = n > 1 ? dxx / (n - 1) : NaN; o.ssdx = Math.sqrt(o.svx);
    o.svy = n > 1 ? dyy / (n - 1) : NaN; o.ssdy = Math.sqrt(o.svy);
    o.minx = Math.min(...pts.map((p) => p[0])); o.maxx = Math.max(...pts.map((p) => p[0]));
    o.miny = Math.min(...pts.map((p) => p[1])); o.maxy = Math.max(...pts.map((p) => p[1]));
    Object.assign(o, quartiles(pts.map((p) => [p[0], p[2]])));
    if (model) Object.assign(o, regress(model, pts));
    o.model = model;
    return o;
  }

  const StatsMath = {
    erfc, normCdf, normSf, normPdf, normInv, binomPdf, binomCdf, poisPdf, poisCdf,
    normalPd, normalCd, invNormal, quartiles, regress, yHat, xHat, computeStats,
  };
  if (typeof window !== 'undefined') window.StatsMath = StatsMath;
  if (typeof registerApp !== 'function') return; // loaded for testing only

  /* =========================================================
     Shared display helpers
     ========================================================= */
  const SUPD = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  // compact table cell: about 6 characters, truncated like the real LCD (0.33489… -> 0.3348, 0.0080… -> 8×10⁻³)
  function cellNum(v) {
    if (v === null || v === undefined) return '';
    if (!Number.isFinite(v)) return 'ERROR';
    const W = 6;
    const neg = v < 0 ? '−' : '';
    const a = Math.abs(tidy(v));
    if (a === 0) return '0';
    if (a >= 0.01 && a < 1e6) {
      let s = String(+a.toPrecision(10));
      if (s.length > W) s = s.slice(0, s.indexOf('.') >= W ? s.indexOf('.') : W).replace(/\.$/, '');
      return neg + s.replace('.', S.cfg.decMark);
    }
    const [m, e] = a.toExponential(9).split('e');
    const ex = String(+e).split('').map((ch) => SUPD[ch]).join('');
    const room = Math.max(1, W - 3 - ex.length);
    const mant = String(+m).slice(0, room).replace(/\.$/, '');
    return `${neg}${mant.replace('.', S.cfg.decMark)}×10${ex}`;
  }
  const fullNum = (v) => (Number.isFinite(v) ? plainNum(tidy(v)) : 'ERROR');

  // data table: cols [{h: header html, get(rowIndex) -> number|null}], visible rows window
  function tableHTML(cols, nRows, sel, top, buf) {
    const VIS = 3;
    const head = `<tr><th class="st-n"></th>${cols.map((c) => `<th>${c.h}</th>`).join('')}</tr>`;
    let body = '';
    for (let i = top; i < top + VIS; i++) {
      if (i >= nRows) { body += `<tr><td class="st-n">&nbsp;</td>${cols.map(() => '<td></td>').join('')}</tr>`; continue; }
      body += `<tr><td class="st-n">${i + 1}</td>${cols.map((c, j) => {
        const on = i === sel.row && j === sel.col;
        return `<td${on ? ' class="on"' : ''}>${cellNum(c.get(i))}</td>`;
      }).join('')}</tr>`;
    }
    const cur = cols[sel.col] ? cols[sel.col].get(sel.row) : null;
    const bot = buf !== null ? entryHTML(buf) : cur === null || cur === undefined ? '' : fullNum(cur);
    return `<table class="st-tbl">${head}${body}</table><div class="st-bot">${bot}</div>`;
  }
  const scrollTop = (sel, top, vis) => (sel < top ? sel : sel >= top + vis ? sel - vis + 1 : top);

  // "label = value" lines (head = line without '='), 4 visible, scroll by one line
  function resultHTML(items, top) {
    const VIS = 4;
    const rows = items.slice(top, top + VIS).map((it) => (it.head
      ? `<div class="st-r st-head">${it.head}</div>`
      : `<div class="st-r"><span class="st-l">${it.l}</span>=<span class="st-v">${fullNum(it.v)}</span></div>`)).join('');
    return rows + (items.length > VIS ? scrollbar(top, items.length - VIS + 1) : '');
  }
  const errorHTML = (msg) => `<div class="st-msg">${msg}</div><div class="hint">[AC] :Cancel</div>`;

  /* =========================================================
     MENU 6: Statistics
     ========================================================= */
  const ST_TYPES = [
    { label: '1-Variable', model: null },
    { label: '<i>y</i>=a+b<i>x</i>', model: 'lin' },
    { label: '<i>y</i>=a+b<i>x</i>+c<i>x</i>²', model: 'quad' },
    { label: '<i>y</i>=a+b·ln(<i>x</i>)', model: 'log' },
    { label: '<i>y</i>=a·<i>e</i>^(b<i>x</i>)', model: 'exp' },
    { label: '<i>y</i>=a·b^<i>x</i>', model: 'abexp' },
    { label: '<i>y</i>=a·<i>x</i>^b', model: 'pow' },
    { label: '<i>y</i>=a+b/<i>x</i>', model: 'inv' },
  ];
  const X = '<i>x</i>', Y = '<i>y</i>';
  // statistic variables: key -> [label, getter(o)]
  const SV = {
    mx: [`<i>x̄</i>`, (o) => o.mx], sx: [`Σ${X}`, (o) => o.sx], sx2: [`Σ${X}²`, (o) => o.sx2],
    vx: [`σ²${X}`, (o) => o.vx], sdx: [`σ${X}`, (o) => o.sdx], svx: [`s²${X}`, (o) => o.svx], ssdx: [`s${X}`, (o) => o.ssdx],
    n: ['n', (o) => o.n],
    my: ['<i>ȳ</i>', (o) => o.my], sy: [`Σ${Y}`, (o) => o.sy], sy2: [`Σ${Y}²`, (o) => o.sy2],
    vy: [`σ²${Y}`, (o) => o.vy], sdy: [`σ${Y}`, (o) => o.sdy], svy: [`s²${Y}`, (o) => o.svy], ssdy: [`s${Y}`, (o) => o.ssdy],
    sxy: [`Σ${X}${Y}`, (o) => o.sxy], sx3: [`Σ${X}³`, (o) => o.sx3], sx2y: [`Σ${X}²${Y}`, (o) => o.sx2y], sx4: [`Σ${X}⁴`, (o) => o.sx4],
    minx: [`min(${X})`, (o) => o.minx], maxx: [`max(${X})`, (o) => o.maxx],
    miny: [`min(${Y})`, (o) => o.miny], maxy: [`max(${Y})`, (o) => o.maxy],
    q1: ['Q₁', (o) => o.q1], med: ['Med', (o) => o.med], q3: ['Q₃', (o) => o.q3],
    a: ['a', (o) => o.a], b: ['b', (o) => o.b], c: ['c', (o) => o.c], r: ['r', (o) => o.r],
  };
  const ONE_VAR_LIST = ['mx', 'sx', 'sx2', 'vx', 'sdx', 'svx', 'ssdx', 'n', 'minx', 'q1', 'med', 'q3', 'maxx'];
  const TWO_VAR_LIST = ['mx', 'sx', 'sx2', 'vx', 'sdx', 'svx', 'ssdx', 'n', 'my', 'sy', 'sy2', 'vy', 'sdy', 'svy', 'ssdy',
    'sxy', 'sx3', 'sx2y', 'sx4', 'minx', 'maxx', 'miny', 'maxy'];

  const st = {
    type: 0, rows: [], freq: false,
    view: 'editor',            // editor | result | confirm
    row: 0, col: 0, top: 0, buf: null,
    res: null,                 // { items, top } or { err }
    pending: null,             // type waiting for "Clear memory?"
  };
  // SETUP > Statistics > Frequency On/Off changes this setting from screens.js
  window.StatsSetup = { get freq() { return st.freq; }, set freq(v) { st.freq = v; } };
  const model = () => ST_TYPES[st.type].model;
  const twoVar = () => model() !== null;
  const MAX_ROWS = 160;

  function stCols() {
    const cols = [{ k: 'x', h: X }];
    if (twoVar()) cols.push({ k: 'y', h: Y });
    if (st.freq) cols.push({ k: 'f', h: 'Freq' });
    return cols.map((c) => ({ ...c, get: (i) => (i < st.rows.length ? st.rows[i][c.k] : null) }));
  }
  const stats = () => computeStats(st.rows, st.freq, model());

  function toEditor() {
    st.view = 'editor';
    st.buf = null;
    st.col = Math.min(st.col, stCols().length - 1);
    st.row = Math.min(st.row, st.rows.length);
    S.screen = 'app';
  }
  function setType(i) {
    st.type = i;
    st.row = st.col = st.top = 0;
    toEditor();
  }
  function chooseType(i) {
    // data only has to go when switching between single-variable and paired-variable types
    if (st.rows.length && (ST_TYPES[i].model === null) !== (model() === null)) {
      st.pending = i;
      st.view = 'confirm';
      S.screen = 'app';
    } else setType(i);
  }
  function openTypeList() {
    openList(ST_TYPES.map((t, i) => ({ label: t.label, act: () => chooseType(i) })), { back: toEditor });
  }

  function showResult(items) {
    st.view = 'result';
    S.screen = 'app';
    st.res = stats() ? { items, top: 0 } : { err: 'Math ERROR' };
  }
  function varCalc() {
    const o = stats();
    showResult(o ? (twoVar() ? TWO_VAR_LIST : ONE_VAR_LIST).map((k) => ({ l: SV[k][0], v: SV[k][1](o) })) : []);
  }
  function regCalc() {
    const o = stats();
    if (!o) { showResult([]); return; }
    const keys = model() === 'quad' ? ['a', 'b', 'c'] : ['a', 'b', 'r'];
    showResult([{ head: ST_TYPES[st.type].label }, ...keys.map((k) => ({ l: k, v: o[k] }))]);
  }
  function statCalc() {
    S.screen = 'calc';
    ac();
  }
  function openFreq(back) {
    openList([
      { label: 'On', act: () => { st.freq = true; back(); } },
      { label: 'Off', act: () => { st.freq = false; back(); } },
    ], { title: 'Frequency?', back });
  }

  // OPTN > Editor: 1:Insert Row 2:Delete All
  function openEditMenu() {
    toEditor();
    openList([
      { label: 'Insert Row', act: () => { if (st.rows.length < MAX_ROWS) st.rows.splice(Math.min(st.row, st.rows.length), 0, { x: 0, y: 0, f: 1 }); } },
      { label: 'Delete All', act: () => { st.rows = []; st.row = st.top = 0; } },
    ], { back: toEditor });
  }

  // OPTN in the editor / result screens
  function openOptn() {
    const items = [
      { label: 'Select Type', act: openTypeList },
      { label: 'Editor', act: openEditMenu },
      { label: twoVar() ? '2-Variable Calc' : '1-Variable Calc', act: varCalc },
    ];
    if (twoVar()) items.push({ label: 'Regression Calc', act: regCalc });
    items.push({ label: 'Statistics Calc', act: statCalc });
    items.push({ label: 'Frequency', act: () => openFreq(toEditor) });
    openList(items);
  }

  // token returning the current value of a statistic (decimal result, like Ran#)
  function statToken(key) {
    return {
      d: SV[key][0], t: 'const', decimal: true,
      v: () => {
        const o = stats();
        const v = o ? SV[key][1](o) : NaN;
        if (!Number.isFinite(v)) throw MATH;
        return v;
      },
    };
  }
  // postfix estimate tokens: 3ŷ, 20x̂
  function estToken(d, fn) {
    return {
      d, t: 'post', decimal: true,
      f: (v) => {
        const o = stats();
        return o ? fn(o, v) : NaN;
      },
    };
  }

  // OPTN on the Statistics Calc screen
  function openCalcOptn() {
    const pick = (keys) => () => openList(keys.map((k) => ({ label: SV[k][0], act: () => ins(statToken(k)) })), { back: openCalcOptn });
    const two = twoVar();
    const items = [
      { label: 'Select Type', act: openTypeList },
      { label: two ? '2-Variable Calc' : '1-Variable Calc', act: varCalc },
    ];
    if (two) items.push({ label: 'Regression Calc', act: regCalc });
    items.push({ label: 'Data', act: toEditor });
    items.push(
      { label: 'Summation', act: pick(two ? ['sx', 'sx2', 'sy', 'sy2', 'sxy', 'sx3', 'sx2y', 'sx4'] : ['sx', 'sx2']) },
      { label: 'Variable', act: pick(two ? ['mx', 'vx', 'sdx', 'svx', 'ssdx', 'my', 'vy', 'sdy', 'svy', 'ssdy', 'n'] : ['mx', 'vx', 'sdx', 'svx', 'ssdx', 'n']) },
      { label: 'Min/Max', act: pick(two ? ['minx', 'maxx', 'miny', 'maxy'] : ['minx', 'maxx', 'q1', 'med', 'q3']) },
    );
    if (!two) {
      // Norm Dist: P(t)=Φ(t), Q(t)=Φ(t)−0.5, R(t)=1−Φ(t), x▸t=(x−x̄)/σx
      const fn = (d, f) => ({ label: d, act: () => ins({ d, t: 'func', decimal: true, f }) });
      items.push({
        label: 'Norm Dist',
        act: () => openList([
          fn('P(', (t) => normCdf(t)),
          fn('Q(', (t) => normCdf(t) - 0.5),
          fn('R(', (t) => normSf(t)),
          { label: '▸t', act: () => ins(estToken('<small>▸</small>t', (o, v) => (o.sdx > 0 ? (v - o.mx) / o.sdx : NaN))) },
        ], { back: openCalcOptn }),
      });
    }
    if (two) {
      items.push({
        label: 'Regression',
        act: () => {
          const m = model();
          const coef = (m === 'quad' ? ['a', 'b', 'c'] : ['a', 'b', 'r']).map((k) => ({ label: SV[k][0], act: () => ins(statToken(k)) }));
          const est = m === 'quad'
            ? [{ d: `<i>x̂</i>₁`, w: 1 }, { d: `<i>x̂</i>₂`, w: 2 }].map((e) => ({ label: e.d, act: () => ins(estToken(e.d, (o, v) => xHat(m, o, v, e.w))) }))
            : [{ label: `<i>x̂</i>`, act: () => ins(estToken(`<i>x̂</i>`, (o, v) => xHat(m, o, v))) }];
          const yh = { label: '<i>ŷ</i>', act: () => ins(estToken('<i>ŷ</i>', (o, v) => yHat(m, o, v))) };
          openList([...coef, ...est, yh], { back: openCalcOptn });
        },
      });
    }
    openList(items);
  }

  function editorKey(id) {
    const cols = stCols();
    const nRows = st.rows.length;
    if (id === 'del' && st.buf === null) {
      // DEL on a data cell deletes its row
      if (st.row < nRows) st.rows.splice(st.row, 1);
      return;
    }
    if (!(id === 'frac' && st.buf === null)) {
      const b = entryKey(st.buf, id);
      if (b !== undefined) { st.buf = b; return; }
    }
    if (id === 'eq') {
      if (st.buf === null) return;
      const v = entryValue(st.buf);
      st.buf = null;
      const key = cols[st.col].k;
      if (!Number.isFinite(v) || (key === 'f' && v < 0)) return;
      if (st.row >= nRows) {
        if (nRows >= MAX_ROWS) return;
        st.rows.push({ x: 0, y: 0, f: 1 });
      }
      st.rows[st.row][key] = tidy(v);
      st.row = Math.min(st.row + 1, Math.min(st.rows.length, MAX_ROWS - 1));
    } else if (id === 'up') { st.buf = null; st.row = Math.max(0, st.row - 1); }
    else if (id === 'down') { st.buf = null; st.row = Math.min(nRows, st.row + 1); }
    else if (id === 'left') { st.buf = null; st.col = Math.max(0, st.col - 1); }
    else if (id === 'right') { st.buf = null; st.col = Math.min(cols.length - 1, st.col + 1); }
    else if (id === 'ac') { if (st.buf !== null) st.buf = null; else statCalc(); } // AC leaves the editor for the calc screen
    else if (id === 'optn') { st.buf = null; openOptn(); }
  }

  const statsApp = {
    name: 'Statistics',
    indicator: () => 'STAT',
    enter() {
      st.view = 'editor';
      st.buf = null;
      S.screen = 'app';
      openTypeList();
    },
    key(id) {
      if (st.view === 'confirm') {
        if (id === 'eq') { st.rows = []; setType(st.pending); }
        else if (id === 'ac') toEditor();
        return;
      }
      if (st.view === 'result') {
        const r = st.res;
        if (id === 'ac') toEditor();
        else if (id === 'optn') openOptn();
        else if (r.items && id === 'down') r.top = Math.min(Math.max(0, r.items.length - 4), r.top + 1);
        else if (r.items && id === 'up') r.top = Math.max(0, r.top - 1);
        return;
      }
      editorKey(id);
    },
    calcKey(id, mods) {
      if (id === 'optn' && !mods.shift) { openCalcOptn(); return true; }
      return false;
    },
    render() {
      if (st.view === 'confirm') {
        return lines(['Clear memory?', '']) + '<div class="st-r">[=] :Yes</div><div class="st-r">[AC] :Cancel</div>';
      }
      if (st.view === 'result') return st.res.err ? errorHTML(st.res.err) : resultHTML(st.res.items, st.res.top);
      st.top = scrollTop(st.row, st.top, 3);
      return tableHTML(stCols(), st.rows.length + 1 > MAX_ROWS ? MAX_ROWS : st.rows.length + 1, { row: st.row, col: st.col }, st.top, st.buf);
    },
  };
  registerApp('6', statsApp);

  /* =========================================================
     MENU 7: Distribution
     ========================================================= */
  const DKINDS = [
    { name: 'Normal PD', params: ['x', 'σ', 'μ'], out: 'p', f: (v) => normalPd(v.x, v['σ'], v['μ']) },
    { name: 'Normal CD', params: ['Lower', 'Upper', 'σ', 'μ'], out: 'P', f: (v) => normalCd(v.Lower, v.Upper, v['σ'], v['μ']) },
    { name: 'Inverse Normal', params: ['Area', 'σ', 'μ'], out: 'xInv', f: (v) => invNormal(v.Area, v['σ'], v['μ']) },
    { name: 'Binomial PD', params: ['x', 'N', 'p'], out: 'P', list: true, f: (v) => binomPdf(v.x, v.N, v.p) },
    { name: 'Binomial CD', params: ['x', 'N', 'p'], out: 'P', list: true, f: (v) => binomCdf(v.x, v.N, v.p) },
    { name: 'Poisson PD', params: ['x', 'λ'], out: 'P', list: true, f: (v) => poisPdf(v.x, v['λ']) },
    { name: 'Poisson CD', params: ['x', 'λ'], out: 'P', list: true, f: (v) => poisCdf(v.x, v['λ']) },
  ];
  const DEFAULTS = { x: 0, 'σ': 1, 'μ': 0, Lower: 0, Upper: 0, Area: 0.5, N: 0, p: 0, 'λ': 0 };
  const PLABEL = { x: X, N: 'N', p: 'p', Lower: 'Lower', Upper: 'Upper', Area: 'Area', 'σ': 'σ', 'μ': 'μ', 'λ': 'λ' };

  const dt = {
    kind: null, listMode: false,
    view: 'vars',              // vars | result | list
    vals: {},                  // per kind: { param: { v, raw } }
    sel: 0, top: 0, buf: null,
    res: null,                 // { v } | { err }
    xs: [], ps: null, lrow: 0, lcol: 0, ltop: 0,
  };
  const kind = () => DKINDS[dt.kind];
  // parameters on the input screen (List mode takes x from the list)
  const dParams = () => kind().params.filter((p) => !(dt.listMode && p === 'x'));
  function dVals() {
    const k = dt.kind;
    if (!dt.vals[k]) dt.vals[k] = {};
    for (const p of kind().params) if (!dt.vals[k][p]) dt.vals[k][p] = { v: DEFAULTS[p], raw: String(DEFAULTS[p]) };
    return dt.vals[k];
  }
  const rawHTML = (raw) => raw.replace(/-/g, '−').replace('e', '×10').replace('/', '⌟');

  function toVars() { dt.view = 'vars'; dt.sel = 0; dt.top = 0; dt.buf = null; S.screen = 'app'; }
  function toDList() { dt.view = 'list'; dt.buf = null; S.screen = 'app'; }
  function setKind(i, listMode) {
    dt.kind = i;
    dt.listMode = listMode;
    dt.ps = null;
    dVals();
    if (listMode) { dt.lrow = dt.lcol = dt.ltop = 0; toDList(); } else toVars();
  }
  function openKindList() {
    openList(DKINDS.map((k, i) => ({
      label: k.name,
      act: () => {
        if (!k.list) { setKind(i, false); return; }
        openList([
          { label: 'List', act: () => setKind(i, true) },
          { label: 'Variable', act: () => setKind(i, false) },
        ], { back: openKindList });
      },
    })), { back: () => (dt.kind === null ? openKindList() : (dt.listMode ? toDList() : toVars())) });
  }
  function openDOptn() {
    const items = [{ label: 'Select Type', act: openKindList }];
    if (dt.listMode && dt.view === 'list') {
      items.push({
        label: 'Editor',
        act: () => openList([
          { label: 'Insert Row', act: () => { if (dt.xs.length < 45) { dt.xs.splice(Math.min(dt.lrow, dt.xs.length), 0, 0); dt.ps = null; dt.lcol = 0; } toDList(); } },
          { label: 'Delete All', act: () => { dt.xs = []; dt.ps = null; dt.lrow = dt.lcol = dt.ltop = 0; toDList(); } },
        ], { back: toDList }),
      });
    }
    if (kind().list) {
      items.push({ label: 'List', act: () => setKind(dt.kind, true) });
      items.push({ label: 'Variable', act: () => setKind(dt.kind, false) });
    }
    openList(items, { back: () => (dt.view === 'list' ? toDList() : toVars()) });
  }

  function compute() {
    const vals = {};
    for (const [p, o] of Object.entries(dVals())) vals[p] = o.v;
    if (dt.listMode) {
      if (!dt.xs.length) { dt.view = 'result'; dt.res = { err: 'Math ERROR' }; return; }
      // parameters must be valid on their own (test with x = 0)
      if (!Number.isFinite(kind().f({ ...vals, x: 0 }))) { dt.view = 'result'; dt.res = { err: 'Math ERROR' }; return; }
      dt.ps = dt.xs.map((x) => kind().f({ ...vals, x }));
      dt.lrow = 0; dt.lcol = 1; dt.ltop = 0;
      if (Number.isFinite(dt.ps[0])) S.ans = tidy(dt.ps[0]);
      toDList();
      return;
    }
    const v = kind().f(vals);
    dt.view = 'result';
    if (Number.isFinite(v)) { dt.res = { v: tidy(v) }; S.ans = dt.res.v; } else dt.res = { err: 'Math ERROR' };
  }

  function varsKey(id) {
    const ps = dParams();
    const b = entryKey(dt.buf, id);
    if (b !== undefined && !(id === 'del' && dt.buf === null)) { dt.buf = b; return; }
    if (id === 'eq') {
      if (dt.buf === null) { compute(); return; }
      const v = entryValue(dt.buf);
      if (Number.isFinite(v)) dVals()[ps[dt.sel]] = { v, raw: dt.buf };
      dt.buf = null;
      dt.sel = Math.min(ps.length - 1, dt.sel + 1);
    } else if (id === 'up') { dt.buf = null; dt.sel = Math.max(0, dt.sel - 1); }
    else if (id === 'down') { dt.buf = null; dt.sel = Math.min(ps.length - 1, dt.sel + 1); }
    else if (id === 'ac') { if (dt.buf !== null) dt.buf = null; else if (dt.listMode) toDList(); }
    else if (id === 'optn') { dt.buf = null; openDOptn(); }
  }

  function dListKey(id) {
    const n = dt.xs.length;
    if (id === 'del' && dt.buf === null) {
      if (dt.lcol === 0 && dt.lrow < n) { dt.xs.splice(dt.lrow, 1); dt.ps = null; }
      return;
    }
    if (dt.lcol === 0 && id !== 'frac') {
      const b = entryKey(dt.buf, id);
      if (b !== undefined) { dt.buf = b; return; }
    }
    if (id === 'eq') {
      if (dt.buf === null) { toVars(); return; } // on to the parameter screen
      const v = entryValue(dt.buf);
      dt.buf = null;
      if (!Number.isFinite(v)) return;
      if (dt.lrow >= n) { if (n >= 45) return; dt.xs.push(0); }
      dt.xs[dt.lrow] = tidy(v);
      dt.ps = null;
      dt.lrow = Math.min(dt.lrow + 1, Math.min(dt.xs.length, 44));
    } else if (id === 'up') { dt.buf = null; dt.lrow = Math.max(0, dt.lrow - 1); }
    else if (id === 'down') { dt.buf = null; dt.lrow = Math.min(dt.lcol === 0 ? n : Math.max(0, n - 1), dt.lrow + 1); }
    else if (id === 'left') { dt.buf = null; dt.lcol = 0; }
    else if (id === 'right') { dt.buf = null; dt.lcol = 1; dt.lrow = Math.min(dt.lrow, Math.max(0, n - 1)); }
    else if (id === 'ac') dt.buf = null;
    else if (id === 'optn') { dt.buf = null; openDOptn(); }
    if (dt.lcol === 1 && dt.ps && Number.isFinite(dt.ps[dt.lrow])) S.ans = tidy(dt.ps[dt.lrow]);
  }

  function varsHTML() {
    const ps = dParams();
    const vals = dVals();
    const VIS = 3;
    dt.top = scrollTop(dt.sel, dt.top, VIS);
    const rows = ps.slice(dt.top, dt.top + VIS).map((p, j) => {
      const i = dt.top + j, on = i === dt.sel;
      const editing = on && dt.buf !== null;
      const val = editing ? entryHTML(dt.buf) : rawHTML(vals[p].raw);
      return `<div class="st-pv${on && !editing ? ' on' : ''}"><span class="st-l">${PLABEL[p]}</span>&nbsp;:${val}</div>`;
    }).join('');
    const arr = `<span class="arr">${dt.top > 0 ? '▲' : ''}${dt.top + VIS < ps.length ? '▼' : ''}</span>`;
    return `<div class="ln">${kind().name}</div>${rows}${arr}`;
  }

  const distApp = {
    name: 'Distribution',
    indicator: () => 'DIST',
    enter() {
      dt.view = 'vars';
      dt.buf = null;
      S.screen = 'app';
      openKindList();
    },
    key(id) {
      if (dt.kind === null) { if (id === 'optn' || id === 'ac') openKindList(); return; }
      if (dt.view === 'result') {
        const r = dt.res;
        if (r.sto) {
          // STO then a variable key (A-F, x, y, M) stores the shown value
          r.sto = false;
          const k = typeof KEYS !== 'undefined' && KEYS[id];
          if (k && k.a && typeof k.a[1] === 'string' && r.v !== undefined) { if (k.a[1] === 'M') S.mem = r.v; else S.vars[k.a[1]] = r.v; r.stored = k.a[1]; return; }
        }
        if (id === 'sto' && r.v !== undefined) { r.sto = true; S.sto = true; }
        else if (id === 'eq' || id === 'ac') { dt.view = 'vars'; dt.buf = null; }
        else if (id === 'optn') openDOptn();
        return;
      }
      if (dt.view === 'list') dListKey(id); else varsKey(id);
    },
    render() {
      if (dt.kind === null) return '';
      if (dt.view === 'result') {
        if (dt.res.err) return errorHTML(dt.res.err);
        return `<div class="ln">${kind().name}</div>`
          + `<div class="st-r"><span>${kind().out}=</span><span class="st-v">${fullNum(dt.res.v)}</span></div>`
          + (dt.res.stored ? `<div class="st-r"><span class="st-v">→${varName(dt.res.stored)}</span></div>` : '');
      }
      if (dt.view === 'list') {
        const n = dt.xs.length;
        const cols = [
          { h: X, get: (i) => (i < n ? dt.xs[i] : null) },
          { h: 'P', get: (i) => (dt.ps && i < n ? dt.ps[i] : null) },
        ];
        dt.ltop = scrollTop(dt.lrow, dt.ltop, 3);
        return tableHTML(cols, Math.min(n + 1, 45), { row: dt.lrow, col: dt.lcol }, dt.ltop, dt.buf);
      }
      return varsHTML();
    },
  };
  registerApp('7', distApp);
})();
