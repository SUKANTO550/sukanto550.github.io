/* =====================================================================
   SYNTHESIS — panel
   =====================================================================
   "Recipe book" button (top bar, next to Mistakes) -> SYNTHESIS LIBRARY: protocol cards in groups
   (Standard / From papers / Custom), each with Watch (auto film). "Do it yourself" (guided) = later.
   Run panel (right): protocol name, lab clock, Pause (Space), Skip step (Esc), Close, speed 1x/2x/4x,
   step list. Click a step = pick it: "Play from here" / "This step only" (a jump: the earlier steps are
   done instantly). After "This step only" the film waits: Continue = go on from the next step.
   Caption (bottom): section + step, step text, what is happening now, progress bar for waits. */
(function () {
  const S = window.SYNTH;
  let ui = null;
  const GROUPS = [['standard', 'Standard'], ['paper', 'From papers'], ['custom', 'Custom']];
  const PRODUCT = { film: 'Thin film', powder: 'Nanoparticles' };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const panel = S.panel = {};
  panel.make = () => {
    const css = document.createElement('style');
    css.textContent = `#prBox{position:fixed;top:64px;right:12px;width:340px;max-height:calc(100vh - 220px);display:none;flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px;z-index:7;color:var(--text);font:13px/1.35 system-ui,sans-serif}
#prBox h3{margin:0;font-size:14px;flex:1;min-width:0}.prHead{display:flex;align-items:center;gap:8px;margin-bottom:4px}
#prFold{padding:2px 8px!important;font-size:13px!important;line-height:1.2}
#prBox.fold{width:auto;min-width:220px;max-width:340px}#prBox.fold>:not(.prHead):not(.prClockRow){display:none!important}#prBox.fold .prClockRow{margin:2px 0 0}#prBox .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:6px 0}
#prBox button,#synLib button{background:var(--panel2,#2c3642);color:inherit;border:1px solid var(--line);border-radius:8px;padding:5px 9px;cursor:pointer;font:inherit}#prBox button.on{border-color:#4fb0ff;background:#25476a}
#prBox button:disabled{opacity:.45;cursor:default}
#prList{overflow:auto;flex:1;min-height:80px;margin-top:4px;padding-right:4px}.prSec{margin:8px 0 2px;font-weight:700;color:#9fd0ff}
.prStep{padding:3px 6px;border-radius:6px;color:var(--muted,#9aa8b8);cursor:pointer}.prStep:hover{background:rgba(79,176,255,.12)}
.prStep.on{background:#25476a;color:#fff}.prStep.done{opacity:.55}.prStep.sel{outline:1px solid #4fb0ff}
.prGo{display:flex;gap:6px;margin:3px 0 6px 10px}.prGo button{padding:4px 8px!important;font-size:12px!important}
#prClock{font-variant-numeric:tabular-nums;font-weight:700;font-size:15px}
#prCap{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);width:min(760px,calc(100vw - 24px));display:none;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 14px;z-index:7;color:var(--text);font:14px/1.4 system-ui,sans-serif}
#prCap .n{color:#9fd0ff;font-weight:700;font-size:12px}#prCap .t{font-size:15px;margin:2px 0}#prCap .s{color:var(--muted,#9aa8b8);font-size:12.5px;min-height:1em}
#prBar{height:5px;background:#33404d;border-radius:3px;margin-top:6px;display:none}#prBar>div{height:100%;background:#4fb0ff;border-radius:3px;width:0}
#prShield{position:fixed;inset:0;z-index:5;display:none}
#prJump{position:fixed;inset:0;z-index:6;display:none;align-items:center;justify-content:center;background:rgba(10,14,20,.55);color:#fff;font:600 16px system-ui,sans-serif}
#synLib{position:fixed;inset:0;z-index:9;display:none;align-items:center;justify-content:center;background:rgba(8,12,18,.55)}
#synLib .box{width:min(720px,calc(100vw - 32px));max-height:calc(100vh - 64px);overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;color:var(--text);font:14px/1.4 system-ui,sans-serif}
#synLib h2{margin:0 0 2px;font-size:18px}#synLib .sub{color:var(--muted,#9aa8b8);font-size:13px;margin-bottom:8px}
#synLib h4{margin:14px 0 6px;font-size:13px;color:#9fd0ff;text-transform:uppercase;letter-spacing:.04em}
#synLib .card{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:6px 0;display:flex;gap:12px;align-items:flex-start}
#synLib .card .tx{flex:1;min-width:0}#synLib .card b{font-size:15px}#synLib .meta{color:var(--muted,#9aa8b8);font-size:12.5px;margin-top:2px}
#synLib .synBadge{display:inline-block;font-size:11px;padding:1px 7px;border-radius:9px;background:#25476a;color:#cfe8ff;margin-left:6px;vertical-align:2px}
#synLib .none{color:var(--muted,#9aa8b8);font-size:13px;font-style:italic;margin:4px 2px}
#synLib .watch{background:#25476a!important;border-color:#4fb0ff!important;white-space:nowrap}
#synLib .top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}`;
    document.head.appendChild(css);
    const box = document.createElement('div'); box.id = 'prBox';
    box.innerHTML = `<div class="prHead"><h3 id="prName">Synthesis</h3><button id="prFold" title="Collapse / expand this panel">▾</button></div><div class="row prClockRow"><span id="prClock">Day 1 · 09:00</span></div>
      <div class="row"><button data-k="pause">Pause</button><button data-k="skip">Skip step (Esc)</button><button data-k="cont" style="display:none">Continue ▶</button><button data-k="stop">Close</button></div>
      <div class="row">Speed <button data-sp="1" class="on">1×</button><button data-sp="2">2×</button><button data-sp="4">4×</button></div>
      <div style="color:var(--muted,#9aa8b8);font-size:12px">Click a step to jump there.</div><div id="prList"></div>`;
    document.body.appendChild(box);
    const cap = document.createElement('div'); cap.id = 'prCap';
    cap.innerHTML = `<div class="n"></div><div class="t"></div><div class="s"></div><div id="prBar"><div></div></div>`;
    document.body.appendChild(cap);
    const shield = document.createElement('div'); shield.id = 'prShield';
    ['pointerdown', 'pointerup', 'wheel', 'contextmenu', 'touchstart'].forEach(ev => shield.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }, { passive: false }));
    document.body.appendChild(shield);
    const jump = document.createElement('div'); jump.id = 'prJump'; document.body.appendChild(jump);
    const lib = document.createElement('div'); lib.id = 'synLib';
    lib.innerHTML = `<div class="box"><div class="top"><div><h2>Synthesis library</h2><div class="sub">Pick a recipe and watch the whole synthesis as one film. Click any step later to jump there.</div></div><button data-k="libClose">Close</button></div><div id="synCards"></div></div>`;
    lib.addEventListener('pointerdown', e => { if (e.target === lib) panel.library(false); });
    document.body.appendChild(lib);
    ui = { box, cap, shield, jump, lib, cards: lib.querySelector('#synCards'), list: box.querySelector('#prList'), name: box.querySelector('#prName'), clock: box.querySelector('#prClock'),
      capN: cap.querySelector('.n'), capT: cap.querySelector('.t'), say: cap.querySelector('.s'), bar: cap.querySelector('#prBar'), barIn: cap.querySelector('#prBar>div'),
      pause: box.querySelector('[data-k=pause]'), skip: box.querySelector('[data-k=skip]'), cont: box.querySelector('[data-k=cont]'), sel: -1 };
    // collapse / expand (remembered in this browser only; works without storage too)
    const fold = on => { box.classList.toggle('fold', on); box.querySelector('#prFold').textContent = on ? '▸' : '▾'; try { localStorage.setItem('vl.synFold', on ? '1' : '0'); } catch (e) {} };
    box.querySelector('#prFold').onclick = () => fold(!box.classList.contains('fold'));
    try { if (localStorage.getItem('vl.synFold') === '1') fold(true); } catch (e) {}
    ui.pause.onclick = () => S.pause();
    ui.skip.onclick = S.skip;
    ui.cont.onclick = () => { if (S.run) S.playFrom(S.run.at); };
    box.querySelector('[data-k=stop]').onclick = S.close;
    lib.querySelector('[data-k=libClose]').onclick = () => panel.library(false);
    box.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { S.setSpeed(+b.dataset.sp); box.querySelectorAll('[data-sp]').forEach(x => x.classList.toggle('on', x === b)); });
    ui.list.addEventListener('click', e => {
      const btn = e.target.closest('[data-go]');
      if (btn) { const i = +btn.dataset.i; ui.sel = -1; S.playFrom(i, btn.dataset.go === 'one'); return; }
      const d = e.target.closest('.prStep'); if (!d) return;
      select(+d.dataset.i === ui.sel ? -1 : +d.dataset.i);
    });
    // open button next to the mistakes log
    const log = document.getElementById('bLog');
    const b = document.createElement('button'); b.id = 'bRecipe'; b.textContent = 'Recipe book'; b.title = 'Synthesis library: watch a whole synthesis as one film';
    b.onclick = () => { if (S.run) return; if (S.HK.busy && S.HK.busy()) return; panel.library(true); };
    if (log && log.parentNode) log.parentNode.insertBefore(b, log); else { Object.assign(b.style, { position: 'fixed', top: '12px', right: '12px', zIndex: 6 }); document.body.appendChild(b); }
    addEventListener('keydown', e => {
      if (ui.lib.style.display === 'flex') { if (e.code === 'Escape') { panel.library(false); e.preventDefault(); e.stopImmediatePropagation(); } return; }
      if (!S.run) return;
      if (e.code === 'Escape') S.skip(); else if (e.code === 'Space') S.pause();
      e.preventDefault(); e.stopImmediatePropagation();
    }, true);
  };

  /* ---------------- library ---------------- */
  panel.library = on => { if (!ui) return; ui.lib.style.display = on ? 'flex' : 'none'; if (on) panel.refresh(); };
  panel.refresh = () => {
    if (!ui) return;
    ui.cards.innerHTML = '';
    for (const [g, title] of GROUPS) {
      const h = document.createElement('h4'); h.textContent = title; ui.cards.appendChild(h);
      const list = S.protocols.filter(p => (p.group || 'custom') === g);
      if (!list.length) { const n = document.createElement('div'); n.className = 'none'; n.textContent = g === 'paper' ? 'None yet — protocols from published papers will be added here.' : 'None yet.'; ui.cards.appendChild(n); continue; }
      for (const p of list) {
        const c = document.createElement('div'); c.className = 'card';
        const nSteps = S.stepsOf(p).length;
        c.innerHTML = `<div class="tx"><b>${esc(p.name)}</b><span class="synBadge">${esc(PRODUCT[p.product] || p.product || '')}</span>
          <div class="meta">${esc(p.source || '')}${p.basedOn ? ' · based on ' + esc(p.basedOn) : ''} · ${nSteps} steps</div>
          <div style="margin-top:4px">${esc(p.summary || '')}</div></div><button class="watch">Watch ▶</button>`;
        c.querySelector('.watch').onclick = () => { panel.library(false); S.open(p); };
        ui.cards.appendChild(c);
      }
    }
  };

  /* ---------------- run panel ---------------- */
  panel.showRun = on => {
    ui.box.style.display = on ? 'flex' : 'none'; ui.cap.style.display = on ? 'block' : 'none'; ui.shield.style.display = on ? 'block' : 'none';
    ['tip', 'hand'].forEach(id => { const e = document.getElementById(id); if (e) e.style.visibility = on ? 'hidden' : ''; });   // room for the caption
    if (!on) { panel.bar(null); ui.jump.style.display = 'none'; return; }
    ui.name.textContent = S.run.proto.name; ui.sel = -1; ui.cont.style.display = 'none';
    ui.box.querySelectorAll('[data-sp]').forEach(x => x.classList.toggle('on', x.dataset.sp === '1'));
    listSteps();
  };
  const stepNo = st => st.tag != null ? st.tag : (st.n != null ? st.n : '·');
  function listSteps() {
    ui.list.innerHTML = '';
    const run = S.run, secs = run.proto.sections || {};
    let sec = null;
    run.steps.forEach((st, i) => {
      if (st.sec !== sec) { sec = st.sec; const h = document.createElement('div'); h.className = 'prSec'; h.textContent = secs[sec] || sec || ''; if (h.textContent) ui.list.appendChild(h); }
      const d = document.createElement('div'); d.className = 'prStep'; d.dataset.i = i;
      d.textContent = `${stepNo(st)}. ${S.stepText(st)}`; ui.list.appendChild(d);
    });
  }
  function select(i) {
    ui.sel = i;
    ui.list.querySelectorAll('.prGo').forEach(x => x.remove());
    ui.list.querySelectorAll('.prStep').forEach(d => d.classList.toggle('sel', +d.dataset.i === i));
    if (i < 0) return;
    const d = ui.list.querySelector(`.prStep[data-i="${i}"]`);
    const go = document.createElement('div'); go.className = 'prGo';
    go.innerHTML = `<button data-go="from" data-i="${i}">▶ Play from here</button><button data-go="one" data-i="${i}">▶ This step only</button>`;
    d.after(go);
  }
  function highlight(i) {
    const at = S.run ? S.run.at : 0;
    ui.list.querySelectorAll('.prStep').forEach(d => { const k = +d.dataset.i; d.classList.toggle('on', k === i); d.classList.toggle('done', i === -2 || k < (i < 0 ? at : i)); });
    const on = ui.list.querySelector('.prStep.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  panel.caption = st => {
    const run = S.run, i = run.steps.indexOf(st), secs = run.proto.sections || {};
    if (!run.instant) highlight(i);
    ui.cont.style.display = 'none'; ui.skip.disabled = ui.pause.disabled = false;
    const secName = (secs[st.sec] || st.sec || '').split('·')[0].trim();
    ui.capN.textContent = `${secName ? secName + ' · ' : ''}${st.tag != null ? st.tag : 'Step ' + stepNo(st)}`;
    ui.capT.textContent = S.stepText(st);
    if (run.instant) ui.jump.textContent = `Getting the lab ready for step ${stepNo(run.steps[run.jumpTo] || st)}…  (doing step ${stepNo(st)} instantly)`;
  };
  panel.jumping = i => {
    if (!ui) return;
    if (i < 0) { ui.jump.style.display = 'none'; return; }
    S.run.jumpTo = i; ui.jump.style.display = 'flex'; ui.jump.textContent = 'Getting the lab ready…';
  };
  panel.idle = k => {
    highlight(-1);
    ui.capN.textContent = 'Paused after the step'; const sk = S.run.steps[k]; ui.capT.textContent = `${sk.tag != null ? sk.tag : 'Step ' + stepNo(sk)} done. Continue, or click any step to jump there.`; panel.say('');
    ui.cont.style.display = S.run.at < S.run.steps.length ? '' : 'none'; ui.skip.disabled = ui.pause.disabled = true;
  };
  panel.done = () => {
    const run = S.run, R = S.R;
    highlight(-2); ui.cont.style.display = 'none'; ui.skip.disabled = ui.pause.disabled = true;
    ui.capN.textContent = 'Done';
    ui.capT.textContent = (run.proto.doneText || `${run.proto.name} complete.`) + ` Lab time ${S.fmtDur(run.clock)}. Close to put the lab back, or click a step to watch it again.`;
    panel.say('');
  };
  panel.failed = e => { ui.capN.textContent = 'Stopped'; ui.capT.textContent = 'The film hit a problem: ' + e.message; ui.skip.disabled = ui.pause.disabled = true; };
  panel.paused = on => { if (ui) ui.pause.textContent = on ? 'Play' : 'Pause'; };
  panel.say = t => { if (ui) ui.say.textContent = t; };
  panel.bar = f => { if (!ui) return; ui.bar.style.display = f == null ? 'none' : 'block'; if (f != null) ui.barIn.style.width = (100 * Math.min(1, f)).toFixed(1) + '%'; };
  panel.clock = () => {
    const run = S.run; if (!run || !ui) return;
    const t = 9 * 3600 + run.clock, d = Math.floor(t / 86400) + 1, h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60);
    const txt = `Day ${d} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (ui.clock.textContent !== txt) ui.clock.textContent = txt;
  };
})();
