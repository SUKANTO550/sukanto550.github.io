'use strict';

/* =========================================================
   MENU E: Algebra
   1: Factorize          over ℚ by default; ◀▶ switch to ℝ / ℂ
                         OPTN: Roots, Factor List, Expand Check
   2: Simplify           with the excluded values (x ≠ …)
                         OPTN: Expand, Combine Fractions, Cancel
   3: Partial Fractions  with polynomial division, ansatz and solving for A, B, …
                         OPTN: Check (combine back)
   Every result has 1:Steps / 2:Steps with notation.
   Any variable letter (x, y, ALPHA A–F, M) stays a symbol here.
   All the work is done by SymPy (calculus/cas.py), which starts loading
   when the tile is opened. Uses the sr-* styles injected by modes/series.js.
   ========================================================= */
(() => {
  const STYLE = `<style>
  .al-out { overflow: hidden; }
  .al-out .sr-main { white-space: normal; }
  .al-out .sr-main > span { display: inline; line-height: 1.5; }
  .al-out .sr-ln { white-space: normal; }
  </style>`;
  document.head.insertAdjacentHTML('beforeend', STYLE);

  const KINDS = {
    factor: { title: 'Factorize', op: 'factor' },
    simplify: { title: 'Simplify', op: 'simplify' },
    apart: { title: 'Partial Fractions', op: 'apart' },
  };
  const ORDER = ['factor', 'simplify', 'apart'];
  const FIELDS = ['Q', 'R', 'C'];
  const FIELD_NAME = { Q: 'ℚ', R: 'ℝ', C: 'ℂ' };
  const FIELD_LONG = { Q: 'rational numbers ℚ', R: 'real numbers ℝ', C: 'complex numbers ℂ' };

  const AL = {
    stage: 'pick',               // pick | fx | res | steps
    sel: 0, kind: null,
    fns: {},                     // input row per kind
    res: null, sub: null,        // result / OPTN answer shown on top of it
    field: 'Q',                  // Factorize: ℚ | ℝ | ℂ
    steps: null,                 // { mode: 1|2, sx, sy }
    sy: 0, seq: 0,
  };
  const row = () => (AL.fns[AL.kind] = AL.fns[AL.kind] || Row());
  const shown = () => AL.sub || AL.res;

  /* ---------- trees from SymPy, printed exactly as sent ---------- */
  function raw(j) {
    switch (j.t) {
      case 'num': return { t: 'num', n: j.n, d: j.d };
      case 'float': return { t: 'num', n: j.v, d: 1 };
      case 'sym': return { t: 'sym', name: j.name };
      case 'const': return { t: 'const', name: j.name };
      case 'add': return { t: 'add', args: j.args.map(raw) };
      case 'mul': return { t: 'mul', args: j.args.map(raw) };
      case 'pow': return { t: 'pow', base: raw(j.base), exp: raw(j.exp) };
      case 'fn': return { t: 'fn', name: j.name, arg: raw(j.arg) };
    }
    return { t: 'sym', name: '?' };
  }
  const H = (j) => CAS.htmlRaw(raw(j));
  const partHTML = (p) => (typeof p === 'string' ? p : p && p.e ? H(p.e) : '');
  const minus = (s) => s.replace(/(^|[\s(,=→])-(?=\d)/g, '$1−'); // -12 → −12 in the notes
  const stepLines = (steps) => (steps || []).map((s) => ({ note: minus(s.note), html: s.parts.map(partHTML).join('') }));
  const V = (name) => `<i>${name}</i>`;

  // input row -> SymPy text; every variable letter becomes the symbol v_<letter>
  function pySource() {
    const t = CAS.fromRowSym(row());
    const ren = (n) => {
      if (!n || typeof n !== 'object') return n;
      if (n.t === 'sym') return { t: 'sym', name: 'v_' + n.name };
      const o = { ...n };
      if (n.args) o.args = n.args.map(ren);
      if (n.base) o.base = ren(n.base);
      if (n.exp) o.exp = ren(n.exp);
      if (n.arg) o.arg = ren(n.arg);
      return o;
    };
    return CAS.toPy(ren(t));
  }

  /* ---------- running ---------- */
  function preload() { if (window.CASUI && CASUI.ask) CASUI.ask('init').catch(() => {}); }
  function done(r) { AL.res = r; AL.sub = null; AL.stage = 'res'; AL.sy = 0; }
  function run() {
    let src;
    try { src = pySource(); } catch (e) { done({ msg: typeof e === 'string' ? e : SYNTAX }); return; }
    if (!window.CASUI || !CASUI.ask) { done({ msg: 'CAS unavailable' }); return; }
    const id = ++AL.seq, kind = AL.kind;
    done({ pending: true });
    CASUI.ask(KINDS[kind].op, { expr: src }).then((out) => {
      if (AL.seq !== id) return; // the user moved on
      let r;
      try { r = out.error ? { msg: MATH } : SHAPE[kind](out); } catch (e) { r = { msg: MATH }; }
      AL.res = r;
      if (S.app === 'E') render();
    }, (msg) => {
      if (AL.seq !== id) return;
      AL.res = { msg: typeof msg === 'string' ? msg : MATH };
      if (S.app === 'E') render();
    });
  }

  const SHAPE = {
    factor(out) {
      AL.field = 'Q';
      const r = { kind: 'factor', out, more: [] };
      r.more.push({ label: 'Roots', act: () => showSub(rootsAns(out)) });
      r.more.push({ label: 'Factor List', act: () => showSub(flistAns(out)) });
      r.more.push({ label: 'Expand Check', act: () => showSub(expandAns(out)) });
      return r;
    },
    simplify(out) {
      const lines = [];
      if (out.excl && out.excl.length) lines.push(`for ${out.excl.map((z) => `${V(out.var)} ≠ ${H(z)}`).join(', ')}`);
      return {
        main: H(out.res), lines, steps: stepLines(out.steps),
        more: [
          { label: 'Expand', act: () => showSub({ title: 'Expand', main: H(out.expand) }) },
          { label: 'Combine Fractions', act: () => showSub({ title: 'Combine', main: H(out.together) }) },
          { label: 'Cancel', act: () => showSub({ title: 'Cancel', main: H(out.cancel) }) },
        ],
      };
    },
    apart(out) {
      if (out.notRational) return { msg: `Not a fraction in ${V(out.var)}` };
      return {
        main: H(out.res), lines: [`in ${V(out.var)}`], steps: stepLines(out.steps),
        more: [{ label: 'Check (Combine)', act: () => showSub({ title: 'Check', main: H(out.check), lines: ['the fractions added back together'] }) }],
      };
    },
  };
  // Factorize shows the field chosen with ◀▶
  function factorView(r) {
    const f = r.out[AL.field];
    const lines = [];
    if (AL.field !== 'Q' && f.multi) lines.push('ℝ needs one variable: same as ℚ');
    else if (AL.field !== 'Q' && f.same) lines.push(`no further factors over ${FIELD_NAME[AL.field]}`);
    lines.push(`over ${FIELD_LONG[AL.field]}   ◀▶`);
    return { main: H(f.res), lines, steps: stepLines(f.steps), more: r.more, tag: FIELD_NAME[AL.field] };
  }
  const view = () => { const r = shown(); return r && r.kind === 'factor' ? factorView(r) : r; };

  function rootsAns(out) {
    const v = V(out.var);
    if (!out.roots) return { title: 'Roots', main: 'No roots to list', lines: ['(needs one variable)'] };
    if (!out.roots.length) return { title: 'Roots', main: 'No roots' };
    const lines = out.roots.map((r, i) => {
      const lhs = `${v}<sub>${i + 1}</sub> = `;
      const val = r.e ? H(r.e) : r.n.replace(/\*I$/, '<i>i</i>').replace(/\*/g, '').replace(/-/g, '−');
      const approx = r.e && r.n ? `  ≈ ${r.n.replace(/\*I$/, '<i>i</i>').replace(/\*/g, '').replace(/-/g, '−')}` : '';
      return `${lhs}${val}${approx}${r.m > 1 ? `  (×${r.m})` : ''}${r.real ? '' : '  complex'}`;
    });
    return { title: 'Roots', main: `${H(out.Q.res)} = 0`, lines };
  }
  function flistAns(out) {
    const lines = [`Constant: ${H(out.flist.c)}`, ...out.flist.f.map((f) => `${H(f.e)}${f.m !== 1 ? `   power ${String(f.m).replace('-', '−')}` : ''}`)];
    return { title: 'Factor List', main: `${out.flist.f.length} factor${out.flist.f.length === 1 ? '' : 's'}`, lines };
  }
  function expandAns(out) {
    return { title: 'Expand Check', main: H(out.expand.e), lines: [out.expand.ok ? '✓ equals the original expression' : '✗ does not match'] };
  }
  function showSub(r) { AL.sub = r; AL.stage = 'res'; AL.sy = 0; }

  /* ---------- keys ---------- */
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
    AL.fns[AL.kind] = S.root; // undo may replace the tree
  }
  function edit() {
    S.root = row();
    S.cur = { row: S.root, idx: S.root.items.length };
    S.done = false; S.error = null;
  }
  function pick(kind) {
    AL.kind = kind; AL.sel = ORDER.indexOf(kind); AL.sub = null;
    AL.stage = 'fx';
    edit();
  }
  const typeList = () => openList(ORDER.map((k) => ({ label: KINDS[k].title, act: () => pick(k) })));

  // menu: ▲▼ move the highlight, ▶ or = enters it, ◀ goes back, number keys pick directly
  function pickKey(id) {
    const n = ORDER.length, k = keyNum(id);
    if (id === 'down') AL.sel = (AL.sel + 1) % n;
    else if (id === 'up') AL.sel = (AL.sel + n - 1) % n;
    else if (id === 'right' || id === 'eq') pick(ORDER[AL.sel]);
    else if (id === 'left') openMenu();
    else if (k >= 1 && k <= n) pick(ORDER[k - 1]);
  }
  function fxKey(id, mods) {
    if (id === 'ac' && !mods.shift) {
      if (!S.root.items.length) { AL.stage = 'pick'; return; }
      newExpr();
      AL.fns[AL.kind] = S.root;
    } else if (id === 'ac') KEYS.ac.s[1](); // OFF
    else if (id === 'eq' && !mods.shift) { if (row().items.length) run(); }
    else if (id === 'optn' && !mods.shift) openList([{ label: 'Change Type', act: typeList }]);
    else if (id === 'left' || id === 'right') move(id === 'left' ? -1 : 1);
    else if (id === 'up' || id === 'down') moveVert(id === 'up' ? -1 : 1);
    else forwardKey(id, mods);
  }
  function resKey(id) {
    const r = shown();
    if (r.pending) { if (id === 'ac') back(); return; }
    const vw = view();
    if ((id === 'left' || id === 'right') && r.kind === 'factor' && !AL.sub) {
      const i = FIELDS.indexOf(AL.field);
      AL.field = FIELDS[(i + (id === 'left' ? 2 : 1)) % 3];
    } else if (id === 'up') AL.sy = Math.max(0, AL.sy - 40);
    else if (id === 'down') AL.sy += 40;
    else if ((id === '1' || id === '2') && vw.steps && vw.steps.length && !AL.sub) { AL.steps = { mode: +id, sx: 0, sy: 0 }; AL.stage = 'steps'; }
    else if (id === 'optn') openList([...(vw.more || []).map((m) => ({ label: m.label, act: m.act })), { label: 'Change Type', act: typeList }]);
    else if (id === 'ac' || id === 'eq') back();
  }
  function back() {
    if (AL.sub) { AL.sub = null; AL.sy = 0; return; }
    AL.seq++; // drop a pending SymPy answer
    AL.stage = 'fx';
    edit();
  }
  function stepsKey(id) {
    const st = AL.steps, el = document.querySelector('#panel .cas-scroll');
    const h = el ? el.clientHeight : 200, w = el ? el.clientWidth : 300;
    if (id === 'up') st.sy = Math.max(0, st.sy - h * 0.25);
    else if (id === 'down') st.sy += h * 0.25;
    else if (id === 'left') st.sx = Math.max(0, st.sx - w * 0.4);
    else if (id === 'right') st.sx += w * 0.4;
    else if (id === '1' || id === '2') { if (st.mode !== +id) AL.steps = { mode: +id, sx: 0, sy: 0 }; }
    else if (id === 'ac' || id === 'eq' || id === 'del') AL.stage = 'res';
  }

  /* ---------- screens ---------- */
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
      const out = document.querySelector('#panel .al-out');
      if (out) { out.scrollTop = AL.sy; AL.sy = out.scrollTop; }
      const sc = document.querySelector('#panel .cas-scroll');
      if (sc && AL.stage === 'steps') {
        const st = AL.steps;
        sc.style.setProperty('--vw', `${sc.clientWidth}px`);
        sc.scrollTop = st.sy; sc.scrollLeft = st.sx;
        st.sy = sc.scrollTop; st.sx = sc.scrollLeft;
        sc.addEventListener('scroll', () => { st.sy = sc.scrollTop; st.sx = sc.scrollLeft; }, { passive: true });
      }
    }, 0);
  }
  const head = (tag = '') => `<div class="sr-hd"><span>${KINDS[AL.kind].title}</span>${tag ? `<span class="sr-tag">${tag}</span>` : ''}</div>`;
  const pickHTML = () => ORDER.map((k, i) => `<div class="ln ln-clickable${i === AL.sel ? ' on' : ''}">${i + 1}:${KINDS[k].title}</div>`).join('');
  function fxHTML() {
    return head() + `<div class="sr-ed"><div class="sr-fl"><span class="sr-ex">${rowHTML(row(), true)}</span></div></div>`
      + '<div class="sr-hint">Letters: <i>x</i>, <i>y</i>, ALPHA <i>A</i>–<i>F</i></div>';
  }
  function resHTML() {
    const r = shown();
    const B = window.CASUI && CASUI.bridge;
    if (r.pending) return head() + `<div class="vr center"><span class="cas-wait">${B && B.status === 'ready' ? 'Calculating…' : 'Loading CAS…'}</span></div><div class="hint">[AC] :Cancel</div>`;
    if (r.msg) return head() + `<div class="vr center big">${r.msg}</div><div class="hint">[AC] :Back</div>`;
    const v = view();
    const lines = (v.lines || []).map((l) => `<div class="sr-ln"><span>${l}</span></div>`).join('');
    const hint = AL.sub ? 'OPTN:More  [AC]:Back' : [v.steps && v.steps.length ? '1:Steps 2:Notation' : '', 'OPTN:More'].filter(Boolean).join('  ');
    return head(AL.sub ? AL.sub.title : v.tag || '')
      + `<div class="sr-out al-out"><div class="sr-main"><span>${v.main}</span></div>${lines}</div><div class="sr-hint">${hint}</div>`;
  }
  function stepsHTML() {
    const v = view(), st = AL.steps;
    const withNotes = st.mode === 2;
    const body = v.steps.map((l) => {
      const note = l.note && (withNotes || !l.html) ? `<div class="cas-note">${l.note}</div>` : '';
      return `<div class="cas-step">${note}${l.html ? `<div class="cas-math">${l.html}</div>` : ''}</div>`;
    }).join('');
    return `<div class="cas-steps"><div class="cas-head"><span>${withNotes ? 'Steps with notation' : 'Steps'}</span>`
      + '<span class="cas-back" data-act="ac" role="button">[AC]:Back</span></div>'
      + `<div class="cas-scroll">${body}</div></div>`;
  }
  function casIndicator() {
    const B = window.CASUI && CASUI.bridge;
    const el = document.getElementById('ind-APP');
    if (el) el.classList.toggle('blink', !!(B && B.status === 'loading'));
    return B && (B.status === 'loading' || B.status === 'ready') ? 'CAS' : 'ALG';
  }

  registerApp('E', {
    name: 'Algebra',
    indicator: casIndicator,
    enter() { AL.stage = 'pick'; AL.sel = 0; AL.kind = null; AL.sub = null; S.screen = 'app'; preload(); },
    leave() {
      AL.seq++;
      newExpr();
      const el = document.getElementById('ind-APP');
      if (el) el.classList.remove('blink');
    },
    key(id, mods) {
      if (id === 'optn' && mods.shift) { openAbout(); return; } // SHIFT OPTN = About everywhere
      const st = AL.stage;
      if (st === 'pick') pickKey(id);
      else if (st === 'fx') fxKey(id, mods);
      else if (st === 'res') resKey(id);
      else if (st === 'steps') stepsKey(id);
    },
    render() {
      afterRender();
      const st = AL.stage;
      if (st === 'pick') return pickHTML();
      if (st === 'fx') return fxHTML();
      if (st === 'steps') return stepsHTML();
      return resHTML();
    },
    // MENU then AC lands on the calc screen while the app is still active: come back to the panel
    calcKey(id, mods) { S.screen = 'app'; this.key(id, mods); return true; },
    test: { AL, view },
  });
})();
