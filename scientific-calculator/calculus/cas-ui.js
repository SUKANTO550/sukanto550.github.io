'use strict';

/* =========================================================
   Indefinite calculus: calculator integration.
   - runs ∫ f dx / d/dx(f) when [=] is pressed in Indefinite mode
   - JS engine (cas.js) first, SymPy (Pyodide in a Web Worker) as fallback
   - result line with 1:Steps / 2:Steps with notation, scrollable steps screen
   Pyodide is loaded only when needed, from calculus/pyodide/ (no network).
   ========================================================= */

(() => {
  const BASE = new URL('.', document.currentScript.src).href;
  const TIMEOUT_MS = 20000;
  const PRELOAD_ON_TEMPLATE = true; // start loading SymPy when the ∫ template is inserted

  /* ---------- SymPy worker bridge ---------- */
  const B = { w: null, status: 'idle', seq: 0, waits: new Map() }; // status: idle | loading | ready | failed

  function failAll(msg) {
    for (const w of B.waits.values()) { clearTimeout(w.timer); w.reject(msg); }
    B.waits.clear();
  }
  function kill(status) {
    if (B.w) B.w.terminate();
    B.w = null;
    B.status = status;
  }
  function armTimer(id) {
    const w = B.waits.get(id);
    if (!w || w.timer || w.op === 'init') return;
    w.timer = setTimeout(() => { kill('idle'); failAll('Timeout'); }, TIMEOUT_MS);
  }
  function worker() {
    if (B.w) return B.w;
    if (B.status === 'failed') return null;
    try {
      B.w = new Worker(BASE + 'cas-worker.js');
    } catch (e) { // e.g. the page was opened as a file:// URL
      B.status = 'failed';
      return null;
    }
    B.status = 'loading';
    B.w.onmessage = (e) => {
      const m = e.data;
      if (m.op === 'status') {
        B.status = m.status;
        if (m.status === 'ready') B.waits.forEach((_, id) => armTimer(id));
        rerender();
        return;
      }
      const w = B.waits.get(m.id);
      if (!w) return;
      clearTimeout(w.timer);
      B.waits.delete(m.id);
      if (m.ok) w.resolve(m.data);
      else {
        if (B.status !== 'ready') { kill('failed'); failAll('CAS unavailable'); w.reject('CAS unavailable'); return; }
        w.reject('Math ERROR');
      }
    };
    B.w.onerror = () => { kill('failed'); failAll('CAS unavailable'); rerender(); };
    return B.w;
  }
  function ask(op, payload = {}) {
    return new Promise((resolve, reject) => {
      const w = worker();
      if (!w) { reject('CAS unavailable'); return; }
      const id = ++B.seq;
      B.waits.set(id, { resolve, reject, op, timer: null });
      if (B.status === 'ready') armTimer(id);
      w.postMessage({ id, op, ...payload });
    });
  }
  function warm() {
    if (!PRELOAD_ON_TEMPLATE || B.w || B.status === 'failed') return;
    ask('init').catch(() => {});
  }
  function rerender() {
    if (S.screen === 'calc' && S.symRes && S.symRes.pending) render();
    else if (S.screen === 'app' && (S.app === 'D' || S.app === 'E')) render(); // Series / Algebra: "Loading CAS…" → "Calculating…"
  }

  /* ---------- running a calculation ---------- */
  const INDEF = ['iinteg', 'ideriv'];
  const handles = (row) => row.items.some((it) => isTpl(it) && INDEF.includes(it.kind));
  let seq = 0;

  function unavailableLines(f, res, verified) {
    const out = [{ note: 'SymPy found the answer, but could not trace the steps', html: 'Steps unavailable' }];
    if (verified) {
      out.push({
        note: 'Check: differentiating the answer gives back the integrand',
        html: `${CAS.html(CAS.Der(res, 'x'))}=${CAS.html(f)}`,
      });
    }
    return out;
  }

  function run(row, record) {
    S.note = S.fact = null;
    S.engExp = null;
    S.multi = null;
    S.symRes = null;
    const items = row.items;
    if (items.length !== 1 || !INDEF.includes(items[0].kind)) { S.error = SYNTAX; S.done = false; return; }
    const node = items[0];
    let f;
    try { f = CAS.simp(CAS.fromRow(node.slots.f)); } catch (e) { S.error = typeof e === 'string' ? e : SYNTAX; S.done = false; return; }

    S.ans = 0; // an indefinite result is not a number: Ans resets to 0
    S.error = null;
    S.done = true;
    if (record) { S.history.push(cloneRow(S.root)); S.hIdx = S.history.length; }
    const id = ++seq;

    if (node.kind === 'ideriv') {
      try {
        const d = CAS.diff(f, 'x');
        const res = CAS.simp(d.res);
        S.symRes = { id, kind: 'd', f, res, lines: CAS.derivativeLines(d) };
      } catch (e) { S.error = typeof e === 'string' ? e : MATH; S.done = false; }
      return;
    }

    let st = null;
    try { st = CAS.integ(f, 'x'); } catch (e) { st = null; }
    if (st) {
      const res = CAS.simp(st.res);
      S.symRes = { id, kind: 'i', f, res, lines: CAS.integralLines(st, f, res) };
      return;
    }

    // JS rules gave up: ask SymPy
    S.symRes = { id, kind: 'i', f, pending: true };
    let src;
    try { src = CAS.toPy(f); } catch (e) { S.symRes = { id, kind: 'i', f, msg: SYNTAX }; return; }
    ask('integrate', { expr: src }).then((out) => {
      const r = S.symRes;
      if (!r || r.id !== id) return; // the user moved on
      if (out.noElem) r.msg = 'No elementary form';
      else if (out.error || !out.res) r.msg = MATH;
      else {
        try {
          const res = CAS.simp(CAS.fromJSON(out.res));
          r.res = res;
          r.lines = out.steps
            ? CAS.integralLines(CAS.treeFromJSON(out.steps), f, res)
            : unavailableLines(f, res, out.verified);
        } catch (e) { r.msg = MATH; }
      }
      r.pending = false;
      render();
    }, (msg) => {
      const r = S.symRes;
      if (!r || r.id !== id) return;
      r.pending = false;
      r.msg = msg;
      render();
    });
  }

  /* ---------- result line ---------- */
  const ready = () => !!(S.done && S.symRes && !S.error && S.symRes.lines);
  function resultHTML() {
    const r = S.symRes;
    if (r.pending) return `<span class="cas-wait">${B.status === 'ready' ? 'Calculating…' : 'Loading CAS…'}</span>`;
    if (r.msg) return `<span class="err">${r.msg}</span>`;
    const ans = CAS.html(r.res) + (r.kind === 'i' ? CAS.C_HTML : '');
    return `<div class="cas-res"><div class="cas-ans"><span class="cas-ans-in">${ans}</span></div>`
      + '<div class="cas-btns"><span class="cas-btn" data-cas-steps="1" role="button">1:Steps</span>'
      + '<span class="cas-btn" data-cas-steps="2" role="button">2:Steps with notation</span></div></div>';
  }

  /* ---------- steps screen ---------- */
  function openSteps(mode) {
    S.casSteps = { mode, sx: 0, sy: 0 };
    S.screen = 'steps';
  }
  // keys 1 / 2 open the steps only while the two buttons are on screen
  function calcKey(id, shifted, alpha) {
    if (shifted || alpha || !ready() || (id !== '1' && id !== '2')) return false;
    openSteps(+id);
    return true;
  }
  function stepsHTML() {
    const st = S.casSteps, r = S.symRes;
    if (!r || !r.lines) return '';
    const withNotes = st.mode === 2;
    const body = r.lines.map((l) => `<div class="cas-step">${withNotes && l.note ? `<div class="cas-note">${l.note}</div>` : ''}<div class="cas-math">${l.html}</div></div>`).join('');
    return `<div class="cas-steps"><div class="cas-head"><span>${withNotes ? 'Steps with notation' : 'Steps'}</span>`
      + '<span class="cas-back" data-act="ac" role="button">[AC]:Back</span></div>'
      + `<div class="cas-scroll">${body}</div></div>`;
  }
  function scroller() { return document.querySelector('#panel .cas-scroll'); }
  function stepsKey(id) {
    const st = S.casSteps, el = scroller();
    const h = el ? el.clientHeight : 200, w = el ? el.clientWidth : 300;
    if (id === 'up') st.sy = Math.max(0, st.sy - h * 0.25);
    else if (id === 'down') st.sy += h * 0.25;
    else if (id === 'left') st.sx = Math.max(0, st.sx - w * 0.4);
    else if (id === 'right') st.sx += w * 0.4;
    else if (id === '1' || id === '2') { if (st.mode !== +id) S.casSteps = { mode: +id, sx: 0, sy: 0 }; }
    else if (id === 'ac' || id === 'eq' || id === 'del') S.screen = 'calc';
  }
  function afterRender() {
    const el = scroller();
    if (!el) return;
    const st = S.casSteps;
    el.style.setProperty('--vw', `${el.clientWidth}px`);
    el.scrollTop = st.sy;
    el.scrollLeft = st.sx;
    st.sy = el.scrollTop; // clamp to what is really scrollable
    st.sx = el.scrollLeft;
    el.addEventListener('scroll', () => { st.sy = el.scrollTop; st.sx = el.scrollLeft; }, { passive: true });
  }

  // tapping the buttons under the answer
  document.getElementById('result').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cas-steps]');
    if (!b || !S.power || S.screen !== 'calc' || !ready()) return;
    openSteps(+b.dataset.casSteps);
    if (window.triggerHaptic) window.triggerHaptic();
    render();
  });

  window.CASUI = { handles, run, warm, calcKey, resultHTML, stepsHTML, stepsKey, afterRender, ready, bridge: B, ask };
})();
