'use strict';

/* =========================================================
   MENU D: Series
   1: Taylor series      f(x) about x = a, order n (+ general term, interval, remainder)
   2: Σ Sum              Σ f(x), x = start … ∞ | n | number   (closed form, Sₙ, convergence)
   3: Π Product          Π f(x), x = start … end              (numeric)
   4: Binomial           (p+qx)ⁿ, typed (A+B)ⁿ, or symbolic (a+b)ⁿ; terms, coefficients
   5: Sum of Expansion   Σ aₖ(x) → closed form, from a general term or the first terms
   Every result has 1:Steps / 2:Steps with notation; OPTN on a result offers more
   (evaluate at x, plot, specific terms …).
   JS (calculus/cas.js) does Taylor, Π and Binomial; SymPy (calculus/cas-worker.js)
   does the sums, general terms and convergence intervals. SymPy starts loading
   when a type that needs it is chosen. Symbolic work is in radians.
   ========================================================= */
(() => {
  const STYLE = `<style>
  .sr-hd { font-size: calc(26 * var(--s)); line-height: calc(32 * var(--s)); white-space: nowrap; overflow: hidden; display: flex; }
  .sr-hd .sr-tag { margin-left: auto; padding-left: calc(8 * var(--s)); }
  .sr-ed { font-size: calc(42 * var(--s)); }
  .sr-fl { display: flex; align-items: center; min-height: calc(90 * var(--s)); white-space: nowrap; }
  .sr-fl .sr-lb { flex-shrink: 0; margin-right: calc(4 * var(--s)); }
  .sr-fl .sr-lb i { font-family: "Times New Roman", serif; }
  .sr-ex { flex: 1; overflow: hidden; white-space: nowrap; line-height: 1.15; }
  .sr-ex .tk.var { font-style: italic; }
  .sr-rg { display: flex; white-space: nowrap; padding: 0 calc(6 * var(--s)); font-size: calc(36 * var(--s)); line-height: calc(44 * var(--s)); }
  .sr-rg .sr-v { margin-left: auto; }
  .sr-rg.on .sr-v { background: var(--lcd-ink); color: var(--lcd-1); padding: 0 calc(4 * var(--s)); }
  .sr-rg.on .sr-v.ed { background: none; color: inherit; }
  .sr-out { overflow: hidden; white-space: nowrap; }
  .sr-out .sr-main { font-size: calc(38 * var(--s)); line-height: 1.3; min-height: calc(84 * var(--s)); display: flex; align-items: center; }
  .sr-out .sr-main > span, .sr-out .sr-ln > span { display: inline-block; padding-right: calc(12 * var(--s)); }
  .sr-out .sr-ln { font-size: calc(27 * var(--s)); line-height: 1.35; }
  .sr-hint { font-size: calc(22 * var(--s)); opacity: .85; white-space: nowrap; overflow: hidden; margin-top: calc(2 * var(--s)); }
  .sr-grid { display: grid; grid-template-columns: 1fr 1fr; font-size: calc(30 * var(--s)); line-height: calc(46 * var(--s)); }
  .sr-plot { display: block; width: 100%; height: calc(250 * var(--s)); }
  .sr-plot .ax { stroke: var(--lcd-ink); stroke-width: .6; opacity: .55; }
  .sr-plot .cv { fill: none; stroke: var(--lcd-ink); stroke-linejoin: round; }
  .sr-leg { font-size: calc(22 * var(--s)); white-space: nowrap; overflow: hidden; }
  .sr-leg svg { width: calc(34 * var(--s)); height: calc(12 * var(--s)); vertical-align: middle; }
  .sr-leg span { margin-right: calc(10 * var(--s)); }
  #ind-APP.blink { animation: sr-blink 1s steps(2, start) infinite; }
  @keyframes sr-blink { to { visibility: hidden; } }
  </style>`;
  document.head.insertAdjacentHTML('beforeend', STYLE);

  /* ---------- types, modes and their inputs ---------- */
  const KINDS = {
    taylor: { title: 'Taylor Series', sympy: true },
    sum: { title: 'Σ Sum', sympy: true },
    prod: { title: 'Π Product' },
    binom: { title: 'Binomial Expansion', modes: [['pq', '(<i>p</i>+<i>qx</i>)<span class="nd-sup"><i>n</i></span>'], ['typed', 'Typed (<i>A</i>+<i>B</i>)<span class="nd-sup"><i>n</i></span>'], ['sym', '(<i>a</i>+<i>b</i>)<span class="nd-sup"><i>n</i></span> symbolic']] },
    sumexp: { title: 'Sum of Expansion', sympy: true, modes: [['general', 'General term <i>a<sub>k</sub></i>'], ['first', 'First terms']] },
  };
  const ORDER = ['taylor', 'binom', 'prod', 'sumexp', 'sum']; // menu order: Σ Sum sits on page 2

  const PARAMS = {
    taylor: [['a', 'Point <i>a</i>:'], ['n', 'Order <i>n</i>:']],
    sum: [['lo', 'Start:'], ['hi', 'End:']],
    prod: [['lo', 'Start:'], ['hi', 'End:']],
    'binom:pq': [['p', '<i>p</i>:'], ['q', '<i>q</i>:'], ['n', '<i>n</i>:'], ['terms', 'Terms:']],
    'binom:typed': [['terms', 'Terms:']],
    'binom:sym': [['n', '<i>n</i>:']],
    'sumexp:general': [['lo', 'Start <i>k</i>:']],
    'sumexp:first': [],
  };
  const DEFAULTS = () => ({
    taylor: { a: 0, n: 5 }, sum: { lo: 1, hi: 'oo' }, prod: { lo: 1, hi: 10 },
    'binom:pq': { p: 1, q: 1, n: 5, terms: 5 }, 'binom:typed': { terms: 5 }, 'binom:sym': { n: 5 },
    'sumexp:general': { lo: 0 }, 'sumexp:first': {},
  });
  const FX_LABEL = {
    taylor: '<i>f</i>(<i>x</i>)=', sum: 'Σ <i>f</i>(<i>x</i>)=', prod: 'Π <i>f</i>(<i>x</i>)=',
    'binom:typed': '(<i>A</i>+<i>B</i>)<span class="nd-sup"><i>n</i></span>=', 'sumexp:general': '<i>a<sub>k</sub></i>=', 'sumexp:first': 'Terms:',
  };
  const MAX_ORDER = 12, MAX_TERMS = 15;

  const SR = {
    kind: null, mode: null,
    page: 0,                     // pick menu page (4 rows per page, like other menus)
    sel: 0,                      // highlighted row in the pick / mode menus
    stage: 'pick',               // pick | mode | fx | par | res | ask | steps | plot
    fns: {}, vals: DEFAULTS(),
    psel: 0, buf: null,
    res: null, sub: null,        // main result / answer to a follow-up question
    ask: null,                   // { label, act(v) }
    steps: null,                 // { mode: 1|2, sx, sy }
    plot: null,
    sx: 0, seq: 0,
  };
  const key = () => (KINDS[SR.kind].modes ? `${SR.kind}:${SR.mode}` : SR.kind);
  const needsFx = () => key() in FX_LABEL;
  const row = () => (SR.fns[key()] = SR.fns[key()] || Row());
  const shown = () => SR.sub || SR.res;

  const C = () => CAS;          // cas.js loads after this file
  const T = () => CAS.T;
  const H = (n) => CAS.html(CAS.simp(n));
  const X = () => T().sym('x');

  function edit() {
    S.root = row();
    S.cur = { row: S.root, idx: S.root.items.length };
    S.done = false; S.error = null;
  }
  function preload() {
    if (KINDS[SR.kind].sympy && window.CASUI && CASUI.ask) CASUI.ask('init').catch(() => {});
  }
  function pick(kind) {
    SR.kind = kind; SR.mode = null; SR.sub = null; SR.msel = 0;
    SR.sel = ORDER.indexOf(kind); SR.page = Math.floor(SR.sel / 4); // AC from the next screen returns to this row
    preload();
    if (KINDS[kind].modes) { SR.stage = 'mode'; return; }
    toInput();
  }
  function pickMode(m) { SR.mode = m; toInput(); }
  function toInput() {
    if (needsFx()) { SR.stage = 'fx'; edit(); } else toParams();
  }
  function toParams() {
    SR.stage = 'par'; SR.psel = 0; SR.buf = null;
    if (!PARAMS[key()].length) run();
  }

  // keys that would evaluate S.root or leave the editor make no sense inside f(x)
  const BLOCK = new Set(['calc', 'calc:s', 'calc:a', 'sto', 'sto:s', 'eng', 'eng:s', 'eng:a', 'sd', 'sd:s',
    'mplus', 'mplus:s', 'dms:s', '9:s', 'ans:s', 'eq', 'eq:s', 'optn:s']);
  function forwardKey(id, mods) {
    const k = KEYS[id];
    if (!k) return;
    const tag = id + (mods.shift ? ':s' : mods.alpha ? ':a' : '');
    if (BLOCK.has(tag)) return;
    const layer = mods.shift ? k.s : mods.alpha ? k.a : null;
    let act = layer ? layer[1] : k.m;
    if (typeof act === 'string') { const n = act; act = () => ins(varTok(n)); }
    if (act) act();
    S.done = false;
    SR.fns[key()] = S.root; // undo may replace the tree
  }

  const typeList = () => openList(ORDER.map((k) => ({ label: KINDS[k].title, act: () => pick(k) })));
  function fxOptn() {
    const items = [];
    if (key() === 'sumexp:general') items.push({ label: 'Insert <i>k</i>', act: () => { ins(varTok('k')); SR.fns[key()] = S.root; } });
    items.push({ label: 'Change Type', act: typeList });
    openList(items);
  }

  /* ---------- keys ---------- */
  // menus: ▲▼ move the highlight, ▶ or = enters it, ◀ goes back, number keys pick directly
  function pickKey(id) {
    const n = ORDER.length, k = keyNum(id);
    if (id === 'down') SR.sel = (SR.sel + 1) % n;
    else if (id === 'up') SR.sel = (SR.sel + n - 1) % n;
    else if (id === 'right' || id === 'eq') return pick(ORDER[SR.sel]);
    else if (id === 'left') return openMenu();
    else if (k >= 1 && k <= 4 && SR.page * 4 + k <= n) return pick(ORDER[SR.page * 4 + k - 1]);
    SR.page = Math.floor(SR.sel / 4);
  }
  function modeKey(id) {
    const ms = KINDS[SR.kind].modes, k = keyNum(id);
    if (id === 'down') SR.msel = (SR.msel + 1) % ms.length;
    else if (id === 'up') SR.msel = (SR.msel + ms.length - 1) % ms.length;
    else if (id === 'right' || id === 'eq') pickMode(ms[SR.msel][0]);
    else if (id === 'ac' || id === 'left') SR.stage = 'pick';
    else if (k >= 1 && k <= ms.length) pickMode(ms[k - 1][0]);
  }
  function fxKey(id, mods) {
    if (id === 'ac' && !mods.shift) {
      if (!S.root.items.length) { SR.stage = KINDS[SR.kind].modes ? 'mode' : 'pick'; return; }
      newExpr();
      SR.fns[key()] = S.root;
    } else if (id === 'ac') KEYS.ac.s[1](); // OFF
    else if (id === 'eq' && !mods.shift) { if (row().items.length) toParams(); }
    else if (id === 'optn' && !mods.shift) fxOptn();
    else if (id === 'left' || id === 'right') move(id === 'left' ? -1 : 1);
    else if (id === 'up' || id === 'down') moveVert(id === 'up' ? -1 : 1);
    else forwardKey(id, mods);
  }
  function parKey(id) {
    const P = PARAMS[key()], V = SR.vals[key()];
    const name = P[SR.psel][0];
    if (SR.kind === 'sum' && name === 'hi' && (id === 'left' || id === 'right')) {
      SR.buf = null; V.hi = V.hi === 'oo' ? 'n' : 'oo';
      return;
    }
    const nb = entryKey(SR.buf, id);
    if (nb !== undefined) { SR.buf = nb; return; }
    if (id === 'up') { SR.buf = null; SR.psel = Math.max(0, SR.psel - 1); }
    else if (id === 'down') { SR.buf = null; SR.psel = Math.min(P.length - 1, SR.psel + 1); }
    else if (id === 'ac') {
      if (SR.buf !== null) SR.buf = null;
      else if (needsFx()) { SR.stage = 'fx'; edit(); }
      else SR.stage = KINDS[SR.kind].modes ? 'mode' : 'pick';
    } else if (id === 'eq') {
      if (SR.buf !== null) {
        const v = entryValue(SR.buf);
        SR.buf = null;
        if (!Number.isFinite(v)) return;
        V[name] = v;
      }
      if (SR.psel < P.length - 1) SR.psel++;
      else run();
    }
  }
  function resKey(id) {
    const r = shown();
    if (r.pending) { if (id === 'ac') back(); return; }
    if (id === 'left') SR.sx = Math.max(0, SR.sx - 120);
    else if (id === 'right') SR.sx += 120;
    else if ((id === '1' || id === '2') && r.steps && r.steps.length) { SR.steps = { mode: +id, sx: 0, sy: 0 }; SR.stage = 'steps'; }
    else if (id === 'optn') moreList();
    else if (id === 'ac' || id === 'eq') back();
  }
  function back() {
    if (SR.sub) { SR.sub = null; return; }
    SR.seq++; // drop a pending SymPy answer
    if (PARAMS[key()].length) { SR.stage = 'par'; SR.buf = null; }
    else if (needsFx()) { SR.stage = 'fx'; edit(); }
    else SR.stage = 'pick';
  }
  function askKey(id) {
    const nb = entryKey(SR.buf, id);
    if (nb !== undefined) { SR.buf = nb; return; }
    if (id === 'ac') { SR.buf = null; SR.stage = 'res'; }
    else if (id === 'eq') {
      const v = entryValue(SR.buf);
      SR.buf = null;
      if (!Number.isFinite(v)) return;
      SR.stage = 'res';
      SR.sx = 0;
      try { SR.sub = SR.ask.act(v); } catch (e) { SR.sub = { msg: typeof e === 'string' ? e : MATH }; }
    }
  }
  function stepsKey(id) {
    const st = SR.steps, el = document.querySelector('#panel .cas-scroll');
    const h = el ? el.clientHeight : 200, w = el ? el.clientWidth : 300;
    if (id === 'up') st.sy = Math.max(0, st.sy - h * 0.25);
    else if (id === 'down') st.sy += h * 0.25;
    else if (id === 'left') st.sx = Math.max(0, st.sx - w * 0.4);
    else if (id === 'right') st.sx += w * 0.4;
    else if (id === '1' || id === '2') { if (st.mode !== +id) SR.steps = { mode: +id, sx: 0, sy: 0 }; }
    else if (id === 'ac' || id === 'eq' || id === 'del') SR.stage = 'res';
  }
  function moreList() {
    const r = shown();
    const items = (r.more || []).map((m) => ({ label: m.label, act: m.act }));
    items.push({ label: 'Change Type', act: typeList });
    openList(items);
  }
  function askFor(label, act) { SR.ask = { label, act }; SR.buf = null; SR.stage = 'ask'; }
  function showPlot(p) { SR.plot = p; SR.stage = 'plot'; }
  function showSub(r) { SR.sub = r; SR.stage = 'res'; SR.sx = 0; }

  /* ---------- formatting helpers ---------- */
  const num = (v) => plainNum(tidy(v));
  const ITAL = (s) => `<i>${s}</i>`;
  const PRIMES = ['', '′', '″', '‴'];
  const derName = (k, v = 'x') => (k < 4 ? `<i>f</i>${PRIMES[k]}(<i>${v}</i>)` : `<i>f</i><span class="nd-sup">(${k})</span>(<i>${v}</i>)`);
  const derAt = (k, aH) => (k < 4 ? `<i>f</i>${PRIMES[k]}(${aH})` : `<i>f</i><span class="nd-sup">(${k})</span>(${aH})`);
  const sig = (body, v, lo, hi, s = 'Σ') => C().sigmaHTML(body, v, lo, hi, s);
  const par = (h) => PAR(h);
  const frac = (a, b) => `<span class="nd-frac"><span class="num">${a}</span><span class="den">${b}</span></span>`;
  // interval of convergence (trees, or JSON trees from SymPy) -> "−1 < x ≤ 1"
  function ivHTML(iv, json = false) {
    if (!iv) return '';
    if (iv.all) return 'all real <i>x</i>';
    const tr = (t) => (json ? H(C().fromJSON(t)) : H(t));
    const sgn = (b) => (b ? '≤' : '<');
    const q = iv.loIn === null || iv.hiIn === null || iv.loIn === undefined || iv.hiIn === undefined;
    return `${tr(iv.lo)} ${sgn(iv.loIn)} <i>x</i> ${sgn(iv.hiIn)} ${tr(iv.hi)}${q ? ' (endpoints not decided)' : ''}`;
  }
  function partHTML(p) {
    if (typeof p === 'string') return p;
    if (p.e) return H(C().fromJSON(p.e));
    if (p.sum) return sig(par(H(C().fromJSON(p.sum.f))), p.sum.v, H(C().fromJSON(p.sum.lo)), H(C().fromJSON(p.sum.hi)));
    if (p.iv) return ivHTML(p.iv, true);
    return '';
  }
  const stepLinesFromPy = (steps) => (steps || []).map((s) => ({ note: s.note, html: s.parts.map(partHTML).join('') }));

  /* ---------- running ---------- */
  function done(r) { SR.res = r; SR.sub = null; SR.stage = 'res'; SR.sx = 0; }
  function askCAS(op, payload) {
    if (!window.CASUI || !CASUI.ask) return Promise.reject('CAS unavailable');
    return CASUI.ask(op, payload);
  }
  // run op on SymPy; shape(out) -> result object. The screen shows "Loading CAS…" meanwhile.
  function viaSymPy(op, payload, shape) {
    const id = ++SR.seq;
    done({ pending: true });
    askCAS(op, payload).then((out) => {
      if (SR.seq !== id) return; // the user moved on
      let r;
      try { r = out.error ? { msg: MATH } : shape(out); } catch (e) { r = { msg: MATH }; }
      SR.res = r;
      if (S.app === 'D') render();
    }, (msg) => {
      if (SR.seq !== id) return;
      SR.res = { msg: typeof msg === 'string' ? msg : MATH };
      if (S.app === 'D') render();
    });
  }
  const isInt = (v) => Number.isInteger(v);

  function run() {
    SR.sub = null;
    try {
      ({ taylor: runTaylor, sum: runSum, prod: runProd, binom: runBinom, sumexp: runSumExp })[SR.kind]();
    } catch (e) { done({ msg: typeof e === 'string' ? e : MATH }); }
  }
  const parseRow = () => C().simp(C().fromRow(row()));

  /* ===================== 1: Taylor ===================== */
  function runTaylor() {
    const V = SR.vals.taylor;
    if (!isInt(V.n) || V.n < 0 || V.n > MAX_ORDER) { done({ msg: `Order: 0~${MAX_ORDER}` }); return; }
    const f = parseRow();
    const py = C().toPy(f);
    let t = null;
    try { t = C().taylor(f, V.a, V.n); } catch (e) { t = null; }
    if (t) {
      const r = taylorResult(f, V, t.terms, t.exact, t.dn1, t.ders);
      done(r);
      if (!t.exact) taylorExtras(r, py, V);
      return;
    }
    viaSymPy('taylor', { expr: py, a: C().pyNum(V.a), n: V.n, needTerms: true }, (out) => {
      if (out.noSeries) return { msg: 'No Taylor series' };
      if (!out.terms) return { msg: MATH };
      const J = (j) => C().simp(C().fromJSON(j));
      const terms = out.terms.map(([k, c]) => ({ k, c: J(c) }));
      const ders = out.ders ? out.ders.map(([k, d, v]) => ({ k, d: d ? J(d) : null, v: J(v) })) : null;
      const r = taylorResult(f, V, terms, out.exact, out.dn1 ? J(out.dn1) : null, ders);
      applyExtras(r, out);
      return r;
    });
  }

  function taylorResult(f, V, terms, exact, dn1, ders) {
    const { a, n } = V;
    const aH = H(T().toNum(a));
    const xa = C().xaHTML(a);
    const main = `${derName(0)}=${C().seriesHTML(terms, a, n, exact)}`;
    const steps = [{
      note: 'Taylor series of <i>f</i> about <i>x</i> = <i>a</i>',
      html: `${derName(0)}=${sig(`${frac('<i>f</i><span class="nd-sup">(<i>k</i>)</span>(<i>a</i>)', '<i>k</i>!')}${par('<i>x</i>−<i>a</i>')}<span class="nd-sup"><i>k</i></span>`, 'k', '0', '∞')}`,
    }, { note: 'Here', html: `<i>a</i> = ${aH},   <i>n</i> = ${n}` }];
    if (ders) {
      for (const d of ders) {
        if (d.d && T().size(d.d) < 80) steps.push({ note: d.k ? `Differentiate (derivative ${d.k})` : 'The function', html: `${derName(d.k)}=${H(d.d)}` });
        steps.push({
          note: `Put <i>x</i> = ${aH} and divide by ${d.k}! = ${C().factorial(d.k)}`,
          html: `${derAt(d.k, aH)}=${H(d.v)}  ⇒  <i>c</i><sub>${d.k}</sub>=${H(terms[d.k].c)}`,
        });
      }
    } else {
      steps.push({ note: 'The derivatives are not defined at <i>a</i> (removable singularity), so SymPy expanded <i>f</i> directly', html: '' });
    }
    steps.push({ note: `Add the terms <i>c<sub>k</sub></i>${xa}<span class="nd-sup"><i>k</i></span>`, html: main });
    if (exact) steps.push({ note: `<i>f</i> is a polynomial of degree ≤ ${n}, so the expansion is exact (no remainder)`, html: '' });
    const r = {
      title: 'Taylor Series', main, lines: [], steps, f, terms, dn1, a, n, exact,
      more: [
        { label: 'Evaluate at <i>x</i>', act: () => askFor('<i>x</i> =', (x0) => taylorEval(r, x0)) },
        { label: 'Plot', act: () => showPlot(taylorPlot(r)) },
      ],
    };
    r.lines.push(exact ? 'Exact: <i>f</i> is a polynomial' : 'General term: <span class="cas-wait">…</span>');
    return r;
  }
  function taylorExtras(r, py, V) {
    askCAS('taylor', { expr: py, a: C().pyNum(V.a), n: V.n, needTerms: false }).then((out) => {
      if (SR.res !== r) return;
      if (!out.error) applyExtras(r, out); else r.lines = ['General term: not found'];
      if (S.app === 'D') render();
    }, (msg) => {
      if (SR.res !== r) return;
      r.lines = [`General term: ${msg === 'CAS unavailable' ? 'needs CAS' : 'not found'}`];
      if (S.app === 'D') render();
    });
  }
  function applyExtras(r, out) {
    if (r.exact) return;
    r.lines = [];
    if (out.general) {
      r.general = C().simp(C().fromJSON(out.general));
      const g = sig(H(r.general), 'k', '0', '∞');
      r.lines.push(`General: ${g}`);
      r.steps.push({ note: 'Pattern in the coefficients: the general term (checked against the first 13 coefficients)', html: `${derName(0)}=${g}` });
    } else r.lines.push('General term: not found');
    if (out.interval) {
      r.interval = out.interval;
      r.lines.push(`Converges: ${ivHTML(out.interval, true)}`);
      if (out.ratio) r.steps.push({ note: 'Ratio test on the general term: <i>L</i> = lim |<i>a</i><sub><i>k</i>+1</sub>/<i>a<sub>k</sub></i>|', html: `<i>L</i> = ${H(C().fromJSON(out.ratio))}` });
      r.steps.push({ note: 'Interval of convergence (<i>L</i> < 1, endpoints tested separately)', html: ivHTML(out.interval, true) });
    }
    if (!r.dn1 && out.dn1) r.dn1 = C().simp(C().fromJSON(out.dn1));
  }
  const taylorP = (r, x, K = Infinity) => r.terms.reduce((s, { k, c }) => (k <= K ? s + C().evalN(c) * Math.pow(x - r.a, k) : s), 0);

  function taylorEval(r, x0) {
    const { a, n } = r;
    const P = taylorP(r, x0);
    const F = C().evalAt(r.f, { x: x0 });
    const err = Math.abs(F - P);
    const fx0 = `<i>f</i>(${num(x0)}) = ${Number.isFinite(F) ? num(F) : 'undefined'}`;
    const lines = [fx0];
    if (Number.isFinite(F)) lines.push(`Error |<i>f</i>−<i>P</i><sub>${n}</sub>| = ${num(err)}`);
    const steps = [
      { note: `Put <i>x</i> = ${num(x0)} into the Taylor polynomial`, html: `<i>P</i><sub>${n}</sub>(${num(x0)}) = ${num(P)}` },
      { note: 'Exact value (radians)', html: fx0 },
    ];
    if (r.exact) lines.push('Remainder: 0 (exact)');
    else if (r.dn1) {
      const lo = Math.min(a, x0), hi = Math.max(a, x0);
      let M = 0;
      for (let i = 0; i <= 400; i++) {
        const v = Math.abs(C().evalAt(r.dn1, { x: lo + (hi - lo) * i / 400 }));
        if (Number.isFinite(v)) M = Math.max(M, v); else { M = NaN; break; }
      }
      if (Number.isFinite(M)) {
        const bound = M * Math.pow(Math.abs(x0 - a), n + 1) / C().factorial(n + 1);
        lines.push(`|<i>R</i><sub>${n}</sub>| ≤ ${num(bound)}`);
        steps.push({
          note: `Lagrange remainder: |<i>R<sub>n</sub></i>| ≤ <i>M</i>|<i>x</i>−<i>a</i>|<span class="nd-sup"><i>n</i>+1</span>/(<i>n</i>+1)!, where <i>M</i> = max |${derName(n + 1, 't')}| for <i>t</i> between ${num(a)} and ${num(x0)}`,
          html: `${derName(n + 1)}=${H(r.dn1)}`,
        }, {
          note: 'Largest value of the derivative on that interval (sampled)',
          html: `<i>M</i> ≈ ${num(M)}  ⇒  |<i>R</i><sub>${n}</sub>| ≤ ${num(M)}·${num(Math.abs(x0 - a))}<span class="nd-sup">${n + 1}</span>/${n + 1}! = ${num(bound)}`,
        });
      }
    }
    if (Number.isFinite(F)) steps.push({ note: 'Actual error', html: `|${num(F)} − ${num(P)}| = ${num(err)}` });
    return { title: 'Evaluate', main: `<i>P</i><sub>${n}</sub>(${num(x0)}) ≈ ${num(P)}`, lines, steps };
  }
  function ivRange(iv) {
    if (!iv || iv.all) return null;
    const lo = C().evalN(C().fromJSON(iv.lo)), hi = C().evalN(C().fromJSON(iv.hi));
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    return { mid: (lo + hi) / 2, rad: (hi - lo) / 2 };
  }
  function taylorPlot(r) {
    const nz = r.terms.filter((t) => !T().isZero(t.c)).map((t) => t.k);
    const picks = [...new Set(nz.length <= 4 ? nz : [nz[0], nz[1], nz[Math.floor(nz.length / 2)], nz[nz.length - 1]])];
    const curves = picks.map((K) => ({ label: `<i>P</i><sub>${K}</sub>`, f: (x) => taylorP(r, x, K) }));
    let c0 = r.a, h = 3;
    const R = ivRange(r.interval);
    if (R) { c0 = R.mid; h = Math.min(6, Math.max(0.5, R.rad * 1.4)); }
    return { curves: [{ label: '<i>f</i>', f: (x) => C().evalAt(r.f, { x }) }, ...curves], x0: c0 - h, x1: c0 + h };
  }

  /* ===================== 2: Σ Sum ===================== */
  function runSum() {
    const V = SR.vals.sum;
    if (!isInt(V.lo)) { done({ msg: 'Start: integer' }); return; }
    if (V.hi !== 'oo' && V.hi !== 'n' && (!isInt(V.hi) || V.hi < V.lo)) { done({ msg: 'Range ERROR' }); return; }
    const f = parseRow();
    const hiH = V.hi === 'oo' ? '∞' : V.hi === 'n' ? ITAL('n') : String(V.hi);
    const head1 = sig(par(H(f)), 'x', String(V.lo), hiH);
    const lhs = V.hi === 'n' ? '<i>S<sub>n</sub></i>' : '<i>S</i>';
    viaSymPy('sum', { expr: C().toPy(f), lo: String(V.lo), hi: String(V.hi) }, (out) => {
      const steps = stepLinesFromPy(out.steps);
      const base = { title: 'Σ Sum', steps, lines: [head1] };
      if (out.div) return { ...base, main: 'Diverges' };
      if (out.res) {
        const res = C().simp(C().fromJSON(out.res));
        const lines = [head1];
        if (typeof out.approx === 'number' && V.hi !== 'n' && !T().isNum(res)) lines.push(`≈ ${num(out.approx)}`);
        return { ...base, lines, main: `${lhs}=${H(res)}` };
      }
      if (typeof out.approx === 'number') return { ...base, main: `${lhs} ≈ ${num(out.approx)}`, lines: [head1, 'No closed form'] };
      if (out.unknown) return { msg: "Can't Solve" };
      return { msg: MATH };
    });
  }

  /* ===================== 3: Π Product ===================== */
  function runProd() {
    const { lo, hi } = SR.vals.prod;
    if (!isInt(lo) || !isInt(hi) || hi < lo) { done({ msg: 'Range ERROR' }); return; }
    if (hi - lo > 1e5) { done({ msg: 'Range Limit' }); return; }
    const rw = row();
    const fx = fOfX(rw);
    const vals = [];
    let p = 1;
    for (let k = lo; k <= hi; k++) {
      const v = fx(k);
      if (typeof v !== 'number' || !Number.isFinite(v)) { done({ msg: MATH }); return; }
      p *= v;
      if (!Number.isFinite(p)) { done({ msg: MATH }); return; }
      vals.push([k, v, p]);
      if (p === 0) break;
    }
    const head1 = sig(par(rowHTML(rw, false)), 'x', String(lo), String(hi), 'Π');
    const steps = [{ note: 'The product', html: head1 }];
    const list = vals.length <= 10 ? vals : [...vals.slice(0, 6), null, ...vals.slice(-3)];
    for (const v of list) {
      if (!v) { steps.push({ note: '…', html: '⋮' }); continue; }
      steps.push({ note: `Multiply by <i>f</i>(${v[0]})`, html: `<i>f</i>(${v[0]}) = ${num(v[1])},   product = ${num(v[2])}` });
    }
    if (p === 0) steps.push({ note: 'A factor is 0, so the whole product is 0', html: '' });
    steps.push({ note: 'Result', html: `Π = ${num(p)}` });
    done({ title: 'Π Product', main: `Π = ${num(p)}`, lines: [head1], steps });
  }

  /* ===================== 4: Binomial ===================== */
  // c·x^m  ->  { c: x-free tree, m: number }, or null
  function monomial(t) {
    t = C().simp(t);
    if (C().freeOf(t, 'x')) return { c: t, m: 0 };
    const fs = t.t === 'mul' ? t.args : [t];
    let m = 0;
    const cs = [];
    for (const a of fs) {
      if (a.t === 'sym' && a.name === 'x') m += 1;
      else if (a.t === 'pow' && a.base.t === 'sym' && a.base.name === 'x' && T().isNum(a.exp)) m += a.exp.n / a.exp.d;
      else if (C().freeOf(a, 'x')) cs.push(a);
      else return null;
    }
    return { c: cs.length ? C().simp(T().mul(...cs)) : T().ONE, m };
  }
  // generalized binomial coefficient C(n, r) = n(n−1)…(n−r+1)/r!, exact
  function binomC(nN, r) {
    const { rMul, rAdd, num: N } = T();
    let c = N(1);
    for (let i = 0; i < r; i++) c = rMul(c, rMul(rAdd(nN, N(-i)), N(1, i + 1)));
    return c;
  }
  function binomCore() {
    const mode = SR.mode, V = SR.vals[key()];
    const { num: N, sym, mul, pw } = T();
    let A, B, nv;
    if (mode === 'pq') {
      if (V.q === 0) throw 'q ≠ 0';
      A = T().toNum(V.p); B = mul(T().toNum(V.q), X()); nv = V.n;
    } else if (mode === 'sym') {
      if (!isInt(V.n) || V.n < 0 || V.n > 20) throw 'n: 0~20';
      A = sym('a'); B = sym('b'); nv = V.n;
    } else {
      const f = C().fromRow(row());
      if (f.t !== 'pow') throw 'Enter (A+B)ⁿ';
      const e = C().simp(f.exp);
      if (!T().isNum(e)) throw 'n: a number';
      const b = f.base;
      if (b.t !== 'add' || b.args.length !== 2 || b.args.some((t) => t.t === 'add')) throw 'Enter (A+B)ⁿ';
      A = C().simp(b.args[0]); B = C().simp(b.args[1]); nv = e.n / e.d;
    }
    const nN = T().toNum(nv);
    const finite = isInt(nv) && nv >= 0;
    if (finite && nv > 40) throw 'n: 0~40';
    if (!finite && (!isInt(V.terms) || V.terms < 1 || V.terms > MAX_TERMS)) throw `Terms: 1~${MAX_TERMS}`;
    const count = finite ? nv + 1 : V.terms;
    const term = (i) => {
      const c = binomC(nN, i);
      return { i, C: c, t: C().simp(mul(c, pw(A, T().rAdd(nN, N(-i))), pw(B, N(i)))) };
    };
    const terms = [];
    for (let i = 0; i < count; i++) terms.push(term(i));
    return { A, B, n: nv, nN, finite, terms, term, mA: monomial(A), mB: monomial(B), sym: mode === 'sym' };
  }
  const nH = (bc) => H(bc.nN);
  // the coefficient worked out: 5!/(2!·3!) = 10, or (1/2)(−1/2)/2! = −1/8
  function binomCWork(bc, i) {
    const val = H(bc.term(i).C);
    if (bc.finite) return `<span class="nd-sup">${bc.n}</span>C<sub>${i}</sub> = ${bc.n}!/(${i}!·${bc.n - i}!) = ${val}`;
    if (i === 0) return `C(${nH(bc)}, 0) = 1`;
    const fs = [];
    for (let j = 0; j < i; j++) fs.push(par(H(T().rAdd(bc.nN, T().num(-j)))));
    return `C(${nH(bc)}, ${i}) = ${fs.join('')}/${i}! = ${val}`;
  }
  // brackets only where needed: 2^r, a^r, but (3x)^r, (−1)^r
  const bpar = (t) => { t = C().simp(t); return (t.t === 'sym' || (T().isNum(t) && t.d === 1 && t.n >= 0)) ? H(t) : par(H(t)); };
  // a term of (a+b)^n in the usual order: 4ab³ (the simplifier would sort it as 4b³a)
  function symTermHTML(bc, t) {
    const p = (v, e) => (e === 0 ? '' : e === 1 ? `<i>${v}</i>` : `<i>${v}</i><span class="nd-sup">${e}</span>`);
    const c = H(t.C), body = p('a', bc.n - t.i) + p('b', t.i);
    return (c === '1' && body ? '' : c) + body;
  }
  const termH = (bc, t) => (bc.sym ? symTermHTML(bc, t) : H(t.t));
  const lhsHTML = (bc) => CAS.html(T().pw(T().add(bc.A, bc.B), bc.nN));
  const termWork = (bc, t) => `<i>T</i><sub>${t.i + 1}</sub>=${H(t.C)}·${bpar(bc.A)}<span class="nd-sup">${H(T().rAdd(bc.nN, T().num(-t.i)))}</span>·${bpar(bc.B)}<span class="nd-sup">${t.i}</span>=${termH(bc, t)}`;
  function binomValidity(bc) {
    // the series needs |B/A| < 1; for B/A = c·x that is |x| < 1/|c|, endpoints by the binomial-series rules
    if (bc.finite || bc.sym) return null;
    const u = monomial(T().div(bc.B, bc.A));
    if (!u || u.m !== 1) return { text: `|${H(T().div(bc.B, bc.A))}| < 1` };
    const cv = C().evalN(u.c);
    if (!Number.isFinite(cv) || cv === 0) return null;
    const rho = C().simp(T().fn('abs', T().pw(u.c, T().num(-1))));
    const n = bc.n;
    const atPlus = n > -1, atMinus = n >= 0; // (1+u)^n converges at u = 1 iff n > −1, at u = −1 iff n ≥ 0
    const hiIn = cv > 0 ? atPlus : atMinus, loIn = cv > 0 ? atMinus : atPlus;
    return { iv: { lo: T().negate(rho), hi: rho, loIn, hiIn }, rho: C().evalN(rho) };
  }
  function generalHTML(bc) {
    const nmr = `${bc.finite ? bc.n : nH(bc)}−<i>r</i>`;
    const cH = bc.finite ? `<span class="nd-sup">${bc.n}</span>C<sub><i>r</i></sub>` : `C(${nH(bc)},<i>r</i>)`;
    let h = `${cH}·${bpar(bc.A)}<span class="nd-sup">${nmr}</span>·${bpar(bc.B)}<span class="nd-sup"><i>r</i></span>`;
    if (bc.mA && bc.mB && (bc.mA.m || bc.mB.m)) {
      // power of x in the r-th term: m1(n−r) + m2·r
      const k1 = bc.mA.m * bc.n, k2 = bc.mB.m - bc.mA.m;
      const rPart = k2 ? `${k2 > 0 ? (k1 ? '+' : '') : '−'}${Math.abs(k2) === 1 ? '' : num(Math.abs(k2))}<i>r</i>` : '';
      h += `   (<i>x</i> power: ${(k1 ? num(k1) : '') + rPart || '0'})`;
    }
    return h;
  }
  function binomSteps(bc, val, main) {
    const steps = [{
      note: bc.finite ? 'Binomial theorem' : 'Binomial series (valid while |<i>B</i>/<i>A</i>| < 1)',
      html: `(<i>A</i>+<i>B</i>)<span class="nd-sup"><i>n</i></span>=${sig(`${bc.finite ? '<span class="nd-sup"><i>n</i></span>C<sub><i>r</i></sub>' : 'C(<i>n</i>,<i>r</i>)'}<i>A</i><span class="nd-sup"><i>n</i>−<i>r</i></span><i>B</i><span class="nd-sup"><i>r</i></span>`, 'r', '0', bc.finite ? ITAL('n') : '∞')}`,
    }, { note: 'Here', html: `<i>A</i> = ${H(bc.A)},   <i>B</i> = ${H(bc.B)},   <i>n</i> = ${nH(bc)}` }];
    const list = bc.terms.length <= 9 ? bc.terms : [...bc.terms.slice(0, 7), null, bc.terms[bc.terms.length - 1]];
    for (const t of list) {
      if (!t) { steps.push({ note: '…', html: '⋮' }); continue; }
      steps.push({ note: `<i>r</i> = ${t.i}: ${binomCWork(bc, t.i)}`, html: termWork(bc, t) });
    }
    steps.push({ note: bc.finite ? `Add all ${bc.terms.length} terms` : `Add the first ${bc.terms.length} terms`, html: main });
    if (val) {
      steps.push({
        note: val.iv ? '|<i>B</i>/<i>A</i>| < 1 gives the range. The binomial series also converges at <i>B</i>/<i>A</i> = 1 when <i>n</i> > −1, and at <i>B</i>/<i>A</i> = −1 when <i>n</i> ≥ 0' : 'Condition for the series',
        html: val.iv ? ivHTML(val.iv) : val.text,
      });
    }
    return steps;
  }
  function runBinom() {
    const bc = binomCore();
    const sumH = bc.sym ? bc.terms.map((t) => symTermHTML(bc, t)).join('+') : C().sumHTML(bc.terms.map((t) => t.t));
    const main = `${lhsHTML(bc)}=${sumH}${bc.finite ? '' : '+⋯'}`;
    const val = binomValidity(bc);
    bc.val = val;
    const lines = [`General: <i>T</i><sub><i>r</i>+1</sub>=${generalHTML(bc)}`];
    if (val) lines.push(`Valid for ${val.iv ? ivHTML(val.iv) : val.text}`);
    done({ title: 'Binomial', main, lines, steps: binomSteps(bc, val, main), bc, more: binomMore(bc) });
  }
  function binomMore(bc) {
    const items = [
      { label: '<i>r</i>-th Term', act: () => askFor('Term number <i>r</i> =', (r) => binomTermAns(bc, r)) },
      { label: 'Middle Term', act: () => showSub(binomMiddle(bc)) },
    ];
    if (!bc.sym) {
      items.push(
        { label: 'Coefficient of <i>x<span class="nd-sup">k</span></i>', act: () => askFor('<i>k</i> =', (k) => binomCoeffAns(bc, k, false)) },
        { label: 'Term indep. of <i>x</i>', act: () => showSub(binomCoeffAns(bc, 0, true)) },
        { label: 'Evaluate at <i>x</i>', act: () => askFor('<i>x</i> =', (x0) => binomEval(bc, x0)) },
        { label: 'Plot', act: () => showPlot(binomPlot(bc)) },
      );
    }
    return items;
  }
  function termAnswer(bc, i, title, pre = []) {
    if (!isInt(i) || i < 0 || (bc.finite && i > bc.n) || i > 200) return { msg: 'No such term' };
    const t = bc.term(i);
    const steps = [...pre,
      { note: `<i>T</i><sub><i>r</i>+1</sub>=${bc.finite ? '<span class="nd-sup"><i>n</i></span>C<sub><i>r</i></sub>' : 'C(<i>n</i>,<i>r</i>)'}<i>A</i><span class="nd-sup"><i>n</i>−<i>r</i></span><i>B</i><span class="nd-sup"><i>r</i></span> with <i>r</i> = ${i}`, html: binomCWork(bc, i) },
      { note: 'Substitute and simplify', html: termWork(bc, t) }];
    const lines = [];
    const m = monomial(t.t);
    if (m && !bc.sym) lines.push(`Coefficient: ${H(m.c)}`);
    return { title, main: `<i>T</i><sub>${i + 1}</sub>=${termH(bc, t)}`, lines, steps, i };
  }
  function binomTermAns(bc, r) {
    if (!isInt(r) || r < 1) return { msg: 'r: 1, 2, 3…' };
    return termAnswer(bc, r - 1, `Term ${r}`);
  }
  function binomMiddle(bc) {
    if (!bc.finite) return { msg: 'Needs whole n ≥ 0' };
    const n = bc.n;
    if (n % 2 === 0) {
      return termAnswer(bc, n / 2, 'Middle Term', [{ note: `<i>n</i> = ${n} is even: ${n + 1} terms, the middle one is term ${n / 2 + 1}`, html: `<i>r</i> = <i>n</i>/2 = ${n / 2}` }]);
    }
    const a = termAnswer(bc, (n - 1) / 2, 'Middle Terms', [{ note: `<i>n</i> = ${n} is odd: ${n + 1} terms, so two middle terms (${(n + 1) / 2} and ${(n + 3) / 2})`, html: `<i>r</i> = ${(n - 1) / 2} and ${(n + 1) / 2}` }]);
    const b = termAnswer(bc, (n + 1) / 2, '');
    return { ...a, main: `${a.main},   ${b.main}`, lines: [], steps: [...a.steps, ...b.steps.slice(-2)] };
  }
  function binomCoeffAns(bc, k, indep) {
    if (!bc.mA || !bc.mB) return { msg: 'Terms must be c·xᵐ' };
    const m1 = bc.mA.m, m2 = bc.mB.m;
    const title = indep ? 'Indep. of x' : `Coeff. of x^${k}`;
    if (m1 === m2) return { msg: m1 * bc.n === k ? 'Every term' : 'No such term' };
    const r = (k - m1 * bc.n) / (m2 - m1);
    const pre = [{
      note: `Power of <i>x</i> in <i>T</i><sub><i>r</i>+1</sub> is ${num(m1)}(<i>n</i>−<i>r</i>) + ${num(m2)}<i>r</i>; set it equal to ${k}`,
      html: `${num(m1 * bc.n)} ${m2 - m1 >= 0 ? '+' : '−'} ${num(Math.abs(m2 - m1))}<i>r</i> = ${k}  ⇒  <i>r</i> = ${num(r)}`,
    }];
    const ri = Math.round(r);
    if (Math.abs(r - ri) > 1e-9 || ri < 0 || (bc.finite && ri > bc.n)) {
      return { title, main: indep ? 'No term free of <i>x</i>' : `No <i>x</i><span class="nd-sup">${k}</span> term`, lines: [], steps: [...pre, { note: '<i>r</i> must be a whole number in range, so there is no such term', html: '' }] };
    }
    const ans = termAnswer(bc, ri, title, pre);
    const t = bc.term(ri).t;
    if (!indep) { ans.lines = [ans.main]; ans.main = `Coefficient = ${H(monomial(t).c)}`; }
    return ans;
  }
  function binomEval(bc, x0) {
    const vals = bc.terms.map((t) => C().evalAt(t.t, { x: x0 }));
    const P = vals.reduce((s, v) => s + v, 0);
    const F = C().evalAt(T().pw(T().add(bc.A, bc.B), bc.nN), { x: x0 });
    const lines = [`Exact: ${Number.isFinite(F) ? num(F) : 'undefined'}`];
    if (Number.isFinite(F)) lines.push(`Error = ${num(Math.abs(F - P))}`);
    const steps = [{ note: `Put <i>x</i> = ${num(x0)} into each term`, html: vals.map((v) => num(v)).join(' + ') },
      { note: bc.finite ? 'Sum of all terms' : `Sum of the first ${vals.length} terms`, html: `≈ ${num(P)}` },
      { note: 'Exact value', html: `${lhsHTML(bc)} = ${num(F)}` }];
    if (bc.val && bc.val.rho !== undefined && Math.abs(x0) >= bc.val.rho) {
      lines.push('Outside the valid range!');
      steps.push({ note: '<i>x</i> is outside the range of convergence: the partial sums do not approach the true value', html: '' });
    }
    return { title: 'Evaluate', main: `≈ ${num(P)}`, lines, steps };
  }
  function binomPlot(bc) {
    const fx = (x) => C().evalAt(T().pw(T().add(bc.A, bc.B), bc.nN), { x });
    const n = bc.terms.length;
    const picks = [...new Set(n <= 4 ? bc.terms.map((t) => t.i + 1) : [1, 2, Math.ceil(n / 2), n])];
    const curves = picks.map((m) => ({ label: `${m} term${m > 1 ? 's' : ''}`, f: (x) => bc.terms.slice(0, m).reduce((s, t) => s + C().evalAt(t.t, { x }), 0) }));
    const h = bc.val && bc.val.rho ? Math.min(6, bc.val.rho * 1.4) : 2;
    return { curves: [{ label: lhsHTML(bc), f: fx }, ...curves], x0: -h, x1: h };
  }

  /* ===================== 5: Sum of Expansion ===================== */
  function runSumExp() {
    const f = parseRow();
    const k0 = SR.mode === 'general' ? SR.vals['sumexp:general'].lo : 0;
    const finish = (out, term) => {
      if (out.noPattern) return { msg: 'Pattern not found' };
      const steps = stepLinesFromPy(out.steps);
      const general = out.general ? C().simp(C().fromJSON(out.general)) : term;
      const lines = [];
      if (general) lines.push(`General: ${sig(H(general), 'k', String(k0), '∞')}`);
      if (out.interval) lines.push(`Converges: ${ivHTML(out.interval, true)}`);
      if (out.unknown || !out.closed) return { title: 'Sum of Expansion', main: 'No closed form found', lines, steps };
      const closed = C().simp(C().fromJSON(out.closed));
      const r = { title: 'Sum of Expansion', main: `<i>S</i>(<i>x</i>)=${H(closed)}`, lines, steps, closed, general, k0, interval: out.interval };
      r.more = [
        { label: 'Evaluate at <i>x</i>', act: () => askFor('<i>x</i> =', (x0) => sumExpEval(r, x0)) },
        { label: 'Plot', act: () => showPlot(sumExpPlot(r)) },
      ];
      return r;
    };
    if (SR.mode === 'general') {
      if (!isInt(k0) || k0 < 0) { done({ msg: 'Start k: 0, 1, 2…' }); return; }
      viaSymPy('sumexp', { expr: C().toPy(f), lo: String(k0) }, (out) => finish(out, f));
      return;
    }
    const cs = C().polyCoeffs(f);
    if (!cs || cs.length < 4 || cs.filter((c) => !T().isZero(c)).length < 3) { done({ msg: 'Enter ≥ 4 terms' }); return; }
    viaSymPy('firstterms', { coeffs: JSON.stringify(cs.map((c) => C().toPy(c))) }, (out) => finish(out, null));
  }
  function partial(r, x, m) {
    let s = 0;
    for (let k = r.k0; k < r.k0 + m; k++) s += C().evalAt(r.general, { x, k });
    return s;
  }
  function sumExpEval(r, x0) {
    const F = C().evalAt(r.closed, { x: x0 });
    const lines = [], steps = [{ note: `Put <i>x</i> = ${num(x0)} into the closed form`, html: `<i>S</i>(${num(x0)}) = ${num(F)}` }];
    if (r.general) {
      for (const m of [5, 10, 20]) {
        const p = partial(r, x0, m);
        lines.push(`${m} terms: ${num(p)}`);
        steps.push({ note: `Partial sum of the first ${m} terms`, html: `≈ ${num(p)}` });
      }
    }
    const R = ivRange(r.interval);
    if (R && Math.abs(x0 - R.mid) > R.rad) lines.push('Outside the interval of convergence!');
    return { title: 'Evaluate', main: `<i>S</i>(${num(x0)}) = ${Number.isFinite(F) ? num(F) : 'undefined'}`, lines, steps };
  }
  function sumExpPlot(r) {
    const curves = [{ label: '<i>S</i>(<i>x</i>)', f: (x) => C().evalAt(r.closed, { x }) }];
    if (r.general) for (const m of [1, 2, 4, 8]) curves.push({ label: `${m} term${m > 1 ? 's' : ''}`, f: (x) => partial(r, x, m) });
    const R = ivRange(r.interval);
    const c0 = R ? R.mid : 0, h = R ? Math.min(6, Math.max(0.5, R.rad * 1.4)) : 3;
    return { curves, x0: c0 - h, x1: c0 + h };
  }

  /* ---------- rendering ---------- */
  function afterRender() {
    setTimeout(() => {
      const box = document.querySelector('#panel .sr-ex');
      if (box) {
        const c = box.querySelector('.cursor');
        if (!c) box.scrollLeft = 0;
        else {
          const l = c.offsetLeft - box.offsetLeft, w = box.clientWidth;
          if (l < box.scrollLeft + 10) box.scrollLeft = Math.max(0, l - 30);
          else if (l > box.scrollLeft + w - 12) box.scrollLeft = l - w + 30;
        }
      }
      const out = document.querySelector('#panel .sr-out');
      if (out) { out.scrollLeft = SR.sx; SR.sx = out.scrollLeft; }
      const sc = document.querySelector('#panel .cas-scroll');
      if (sc && SR.stage === 'steps') {
        const st = SR.steps;
        sc.style.setProperty('--vw', `${sc.clientWidth}px`);
        sc.scrollTop = st.sy; sc.scrollLeft = st.sx;
        st.sy = sc.scrollTop; st.sx = sc.scrollLeft;
        sc.addEventListener('scroll', () => { st.sy = sc.scrollTop; st.sx = sc.scrollLeft; }, { passive: true });
      }
    }, 0);
  }
  const head = (tag = '') => `<div class="sr-hd"><span>${SR.kind ? KINDS[SR.kind].title : 'Series'}</span>${tag ? `<span class="sr-tag">${tag}</span>` : ''}</div>`;

  function pickHTML() {
    const pages = Math.ceil(ORDER.length / 4);
    return ORDER.slice(SR.page * 4, SR.page * 4 + 4).map((k, j) => `<div class="ln ln-clickable${SR.page * 4 + j === SR.sel ? ' on' : ''}">${j + 1}:${KINDS[k].title}</div>`).join('')
      + scrollbar(SR.page, pages);
  }
  function modeHTML() {
    return KINDS[SR.kind].modes.map(([, lb], i) => `<div class="ln ln-clickable${i === SR.msel ? ' on' : ''}">${i + 1}:${lb}</div>`).join('');
  }
  function fxHTML() {
    const k = key();
    const hint = k === 'sumexp:general' ? 'OPTN: insert <i>k</i>' : k === 'sumexp:first' ? 'e.g. 1+2<i>x</i>+3<i>x</i><span class="nd-sup">2</span>+4<i>x</i><span class="nd-sup">3</span>'
      : k === 'binom:typed' ? 'e.g. (2+3<i>x</i>)<span class="nd-sup">4</span>,  (<i>x</i>+1/<i>x</i>)<span class="nd-sup">6</span>' : '';
    return head() + `<div class="sr-ed"><div class="sr-fl"><span class="sr-lb">${FX_LABEL[k]}</span>`
      + `<span class="sr-ex">${rowHTML(row(), true)}</span></div></div>${hint ? `<div class="sr-hint">${hint}</div>` : ''}`;
  }
  function parHTML() {
    const P = PARAMS[key()], V = SR.vals[key()];
    const rows = P.map(([k, name], i) => {
      const on = i === SR.psel, ed = on && SR.buf !== null;
      const val = ed ? entryHTML(SR.buf) : V[k] === 'oo' ? '∞' : V[k] === 'n' ? '<i>n</i>' : plainNum(V[k]);
      return `<div class="sr-rg${on ? ' on' : ''}">${name}<span class="sr-v${ed ? ' ed' : ''}">${val}</span></div>`;
    }).join('');
    const hint = SR.kind === 'sum' && P[SR.psel][0] === 'hi' ? '◀▶: ∞ / <i>n</i>, or type a number'
      : SR.kind === 'binom' && P[SR.psel][0] === 'terms' ? 'Terms: used when <i>n</i> is negative or a fraction' : '';
    return head() + rows + (hint ? `<div class="sr-hint">${hint}</div>` : '');
  }
  function resHTML() {
    const r = shown();
    const B = window.CASUI && CASUI.bridge;
    if (r.pending) return head() + `<div class="vr center"><span class="cas-wait">${B && B.status === 'ready' ? 'Calculating…' : 'Loading CAS…'}</span></div><div class="hint">[AC] :Cancel</div>`;
    if (r.msg) return head() + `<div class="vr center big">${r.msg}</div><div class="hint">[AC] :Back</div>`;
    const lines = (r.lines || []).map((l) => `<div class="sr-ln"><span>${l}</span></div>`).join('');
    const hint = [r.steps && r.steps.length ? '1:Steps 2:Notation' : '', 'OPTN:More', SR.sub ? '[AC]:Back' : '◀▶'].filter(Boolean).join('  ');
    return head(SR.sub ? SR.sub.title || '' : '') + `<div class="sr-out"><div class="sr-main"><span>${r.main}</span></div>${lines}</div><div class="sr-hint">${hint}</div>`;
  }
  function askHTML() {
    const val = SR.buf !== null ? entryHTML(SR.buf) : '<span class="cursor"></span>';
    return head() + `<div class="sr-rg on">${SR.ask.label}<span class="sr-v ed">${val}</span></div><div class="sr-hint">[=] :OK   [AC] :Cancel</div>`;
  }
  function stepsHTML() {
    const r = shown(), st = SR.steps;
    const withNotes = st.mode === 2;
    const body = r.steps.map((l) => {
      const note = l.note && (withNotes || !l.html) ? `<div class="cas-note">${l.note}</div>` : '';
      return `<div class="cas-step">${note}${l.html ? `<div class="cas-math">${l.html}</div>` : ''}</div>`;
    }).join('');
    return `<div class="cas-steps"><div class="cas-head"><span>${withNotes ? 'Steps with notation' : 'Steps'}</span>`
      + '<span class="cas-back" data-act="ac" role="button">[AC]:Back</span></div>'
      + `<div class="cas-scroll">${body}</div></div>`;
  }
  const DASH = [null, '6 3', '2 2.5', '9 3 2 3', '1 3'];
  function plotHTML() {
    const p = SR.plot, W = 300, Hh = 130, NS = 240;
    const xs = Array.from({ length: NS + 1 }, (_, i) => p.x0 + (p.x1 - p.x0) * i / NS);
    const ys = p.curves.map((c) => xs.map((x) => { try { const v = c.f(x); return Number.isFinite(v) ? v : NaN; } catch (e) { return NaN; } }));
    const base = ys[0].filter(Number.isFinite).sort((a, b) => a - b);
    if (!base.length) return head() + '<div class="vr center">Nothing to plot</div><div class="hint">[AC] :Back</div>';
    let lo = base[Math.floor(base.length * 0.03)], hi = base[Math.ceil(base.length * 0.97) - 1];
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.25;
    lo -= pad; hi += pad;
    const PX = (x) => ((x - p.x0) / (p.x1 - p.x0)) * W, PY = (y) => Hh - ((y - lo) / (hi - lo)) * Hh;
    let svg = '';
    if (lo < 0 && hi > 0) svg += `<line class="ax" x1="0" y1="${PY(0)}" x2="${W}" y2="${PY(0)}"/>`;
    if (p.x0 < 0 && p.x1 > 0) svg += `<line class="ax" x1="${PX(0)}" y1="0" x2="${PX(0)}" y2="${Hh}"/>`;
    ys.forEach((col, ci) => {
      let d = '', pen = false;
      col.forEach((y, i) => {
        if (!Number.isFinite(y) || y < lo - (hi - lo) * 2 || y > hi + (hi - lo) * 2) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${PX(xs[i]).toFixed(1)} ${PY(y).toFixed(1)}`;
        pen = true;
      });
      const dash = DASH[ci % DASH.length];
      svg += `<path class="cv" d="${d}" stroke-width="${ci ? 1.1 : 2}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
    });
    const leg = p.curves.map((c, ci) => {
      const dash = DASH[ci % DASH.length];
      return `<span><svg viewBox="0 0 30 10"><line x1="0" y1="5" x2="30" y2="5" stroke="currentColor" stroke-width="${ci ? 1.4 : 2.4}"${dash ? ` stroke-dasharray="${dash}"` : ''}/></svg>${c.label}</span>`;
    }).join('');
    return head(`${num(p.x0)} ≤ <i>x</i> ≤ ${num(p.x1)}`)
      + `<svg class="sr-plot" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none"><defs><clipPath id="srclip"><rect width="${W}" height="${Hh}"/></clipPath></defs><g clip-path="url(#srclip)">${svg}</g></svg>`
      + `<div class="sr-leg">${leg}</div>`;
  }

  // status bar: "CAS" blinks while SymPy loads, steady when ready
  function casIndicator() {
    const B = window.CASUI && CASUI.bridge;
    const el = document.getElementById('ind-APP');
    if (el) el.classList.toggle('blink', !!(B && B.status === 'loading'));
    return B && (B.status === 'loading' || B.status === 'ready') ? 'CAS' : 'SER';
  }

  registerApp('D', {
    name: 'Series',
    indicator: casIndicator,
    enter() { SR.stage = 'pick'; SR.page = 0; SR.sel = 0; SR.kind = null; SR.sub = null; S.screen = 'app'; },
    leave() {
      SR.seq++;
      newExpr();
      const el = document.getElementById('ind-APP');
      if (el) el.classList.remove('blink');
    },
    key(id, mods) {
      if (id === 'optn' && mods.shift) { openAbout(); return; } // SHIFT OPTN = About everywhere
      const st = SR.stage;
      if (st === 'pick') pickKey(id);
      else if (st === 'mode') modeKey(id);
      else if (st === 'fx') fxKey(id, mods);
      else if (st === 'par') parKey(id);
      else if (st === 'res') resKey(id);
      else if (st === 'ask') askKey(id);
      else if (st === 'steps') stepsKey(id);
      else if (st === 'plot' && ['ac', 'eq', 'del'].includes(id)) SR.stage = 'res';
    },
    render() {
      afterRender();
      const st = SR.stage;
      if (st === 'pick') return pickHTML();
      if (st === 'mode') return modeHTML();
      if (st === 'fx') return fxHTML();
      if (st === 'par') return parHTML();
      if (st === 'ask') return askHTML();
      if (st === 'steps') return stepsHTML();
      if (st === 'plot') return plotHTML();
      return resHTML();
    },
    // MENU then AC lands on the calc screen while the app is still active: come back to the panel
    calcKey(id, mods) { S.screen = 'app'; this.key(id, mods); return true; },
    test: { SR, run, pick, pickMode, binomCore, monomial, binomC, DEFAULTS, shown },
  });
})();
