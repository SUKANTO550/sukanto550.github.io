'use strict';

/* =========================================================
   LCD screens other than the calculation screen:
   MENU icon grid, SETUP pages and "not available" notices.
   ========================================================= */

// crisp line icons (stroke/fill use currentColor so the selected cell can invert)
const svgIcon = (body) => `<svg class="mi-svg" viewBox="0 0 40 26" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="square">${body}</svg>`;
const MENU_ITEMS = [
  { k: '1', name: 'Calculate', icon: svgIcon('<path d="M7 3l7 7M14 3l-7 7M23 6.5h10M7 19h8M11 15v8M23 19h10"/><g fill="currentColor" stroke="none"><circle cx="28" cy="2.6" r="1.7"/><circle cx="28" cy="10.4" r="1.7"/></g>') },
  { k: '2', name: 'Complex', icon: svgIcon('<rect x="4" y="4" width="14" height="18"/><path d="M11 12v7M24 21h12M24 21L34 6"/><circle cx="11" cy="8" r="1.8" fill="currentColor" stroke="none"/>') },
  { k: '3', name: 'Base-N', icon: svgIcon('<g class="mi-txt big"><text x="20" y="11">2  8</text><text x="20" y="25">10 16</text></g>') },
  { k: '4', name: 'Matrix', icon: svgIcon('<path d="M9 3H5v20h4M31 3h4v20h-4"/><g fill="currentColor" stroke="none"><rect x="11" y="6" width="7" height="5"/><rect x="22" y="6" width="7" height="5"/><rect x="11" y="15" width="7" height="5"/><rect x="22" y="15" width="7" height="5"/></g>') },
  { k: '5', name: 'Vector', icon: svgIcon('<path d="M9 22V5M5 9l4-5 4 5M9 22L30 6M23 5h8v8"/>') },
  { k: '6', name: 'Statistics', icon: svgIcon('<path d="M4 23h32M4 3v20"/><g fill="currentColor" stroke="none"><rect x="8" y="13" width="5" height="10"/><rect x="15" y="5" width="5" height="18"/><rect x="22" y="10" width="5" height="13"/><rect x="29" y="16" width="5" height="7"/></g>') },
  { k: '7', name: 'Distribution', icon: svgIcon('<path d="M3 23h34"/><path d="M4 22C12 22 14 4 20 4s8 18 16 18"/><path d="M20 5v18" stroke-width="1.6" stroke-dasharray="2 2"/>') },
  { k: '8', name: 'Spreadsheet', icon: svgIcon('<rect x="6" y="3" width="28" height="20"/><path d="M6 9h28M6 16h28M15 3v20M24 3v20" stroke-width="1.6"/><rect x="6" y="3" width="28" height="6" fill="currentColor" stroke="none"/>') },
  { k: '9', name: 'Table', icon: svgIcon('<rect x="4" y="4" width="14" height="18"/><rect x="22" y="4" width="14" height="18"/><path d="M4 9h14M22 9h14M7 14h8M7 18h8M25 14h8M25 18h8" stroke-width="1.8"/>') },
  { k: 'A', name: 'Equation/Func', icon: svgIcon('<g class="mi-txt big"><text x="20" y="11">x y</text><text x="26" y="25">0</text></g><path d="M9 17h8M9 21h8"/>') },
  { k: 'B', name: 'Inequality', icon: svgIcon('<g class="mi-txt big"><text x="20" y="11">x y</text><text x="26" y="25">0</text></g><path d="M10 15.5l7 3.5-7 3.5"/>') },
  { k: 'C', name: 'Ratio', icon: svgIcon('<rect x="4" y="7" width="11" height="12"/><rect x="25" y="7" width="11" height="12"/><g fill="currentColor" stroke="none"><circle cx="20" cy="9.5" r="1.8"/><circle cx="20" cy="16.5" r="1.8"/></g>') },
  { k: 'D', name: 'Series', icon: svgIcon('<path d="M30 4H10l9 9-9 9h20" stroke-linejoin="miter"/><g fill="currentColor" stroke="none"><circle cx="33" cy="22" r="1.6"/></g>') },
  { k: 'E', name: 'Algebra', icon: svgIcon('<g class="mi-txt big"><text x="20" y="11">a b</text></g><path d="M8 14c-2.5 3-2.5 7 0 10M15 14c2.5 3 2.5 7 0 10M25 14c-2.5 3-2.5 7 0 10M32 14c2.5 3 2.5 7 0 10" stroke-width="2"/>') },
];
// keys that type a menu number: digits plus A/B/C/D/E on (−), °'", x⁻¹, sin, cos
const KEY_TO_NUM = { neg: 10, dms: 11, inv: 12, sin: 13, cos: 14, tan: 15, mplus: 16, xvar: 17 };
const keyNum = (id) => (/^[0-9]$/.test(id) ? +id : KEY_TO_NUM[id] ?? null);

const SETUP_PAGES = [
  [['Input/Output', 'io'], ['Angle Unit', 'angle'], ['Number Format', 'fmt'], ['Engineer Symbol', 'engSym'], ['Calculus', 'calcMode']],
  [['Fraction Result', 'fracRes'], ['Complex', 'complex'], ['Statistics', 'stat'], ['Spreadsheet', 'sheet']],
  [['Equation/Func', null], ['Table', 'table'], ['Decimal Mark', 'decMark'], ['Digit Separator', 'digitSep']],
  [['MultiLine Font', null], ['About', 'about'], ['Contrast', 'contrast']],
];
const SETUP_SUB = {
  io: { opts: ['MathI/MathO', 'MathI/DecimalO', 'LineI/LineO', 'LineI/DecimalO'], vals: ['MathO', 'DecO', 'LineO', 'LineDecO'] },
  angle: { opts: ['Degree', 'Radian', 'Gradian'], vals: ['D', 'R', 'G'] },
  fmt: { opts: ['Fix', 'Sci', 'Norm'], vals: ['Fix', 'Sci', 'Norm'] },
  engSym: { title: 'Engineer Symbol?', opts: ['On', 'Off'], vals: [true, false] },
  fracRes: { opts: ['a<sup>b</sup>/<sub>c</sub>', 'd/c'], vals: ['abc', 'dc'] },
  decMark: { title: 'Decimal Mark?', opts: ['Dot', 'Comma'], vals: ['.', ','] },
  digitSep: { title: 'Digit Separator?', opts: ['On', 'Off'], vals: [true, false] },
  // Definite: numeric ∫ with limits and d/dx at a point. Indefinite: symbolic ∫ f dx and d/dx(f).
  // Switching clears the current input, since the templates differ.
  calcMode: {
    opts: ['Definite Calculus', 'Indefinite Calculus'], vals: ['def', 'indef'],
    apply: (v) => { if (S.cfg.calc !== v) { S.cfg.calc = v; ac(); } },
  },
  // settings owned by the Complex / Statistics / Table / Spreadsheet apps
  sheet: { opts: ['Auto Calc', 'Show Cell'], vals: ['ssAuto', 'ssShow'], next: (v) => v },
  ssAuto: { title: 'Auto Calc?', opts: ['On', 'Off'], vals: [true, false], apply: (v) => { if (window.SpreadsheetSetup) SpreadsheetSetup.autoCalc = v; } },
  ssShow: { title: 'Show Cell?', opts: ['Formula', 'Value'], vals: ['formula', 'value'], apply: (v) => { if (window.SpreadsheetSetup) SpreadsheetSetup.showCell = v; } },
  complex: { opts: ['<i>a</i>+<i>bi</i>', '<i>r</i>∠<i>θ</i>'], vals: ['abi', 'polar'], apply: (v) => { window.ComplexSetup = window.ComplexSetup || {}; ComplexSetup.form = v; } },
  stat: { title: 'Frequency?', opts: ['On', 'Off'], vals: [true, false], apply: (v) => { if (window.StatsSetup) StatsSetup.freq = v; } },
  table: { opts: ['<i>f</i>(<i>x</i>)', '<i>f</i>(<i>x</i>),<i>g</i>(<i>x</i>)'], vals: [false, true], apply: (v) => { if (window.TableSetup) TableSetup.two = v; } },
};

// remember the screen MENU / SETUP was opened from, so AC returns there (e.g. into an app)
const OVERLAYS = ['menu', 'setup', 'msg', 'list'];
function rememberScreen() { if (!OVERLAYS.includes(S.screen)) S.prevScreen = S.screen; }
function openMenu() { rememberScreen(); S.screen = 'menu'; }
function openSetup() { rememberScreen(); S.screen = 'setup'; S.setup = { page: 0, row: 0, sub: null, srow: 0, fmtType: null }; }
function backToCalc() { S.screen = S.prevScreen || 'calc'; }
function notAvailable(name, back) { S.msg = { name, back }; S.screen = 'msg'; }
// creator attribution (SHIFT OPTN, SETUP > About); any key returns
function openAbout(back) { rememberScreen(); S.msg = { about: true, back: back || S.prevScreen || 'calc' }; S.screen = 'msg'; }
const APP_VERSION = '1.4.1'; // keep in step with versionName in the Android app's build.gradle
const PORTFOLIO_URL = 'https://sukanto550.github.io/';
const ABOUT_HTML = `<div class="about" data-href="${PORTFOLIO_URL}" role="link" title="Open Sukanto's portfolio">`
  + '<div class="ab-t">Scientific Calculator</div>'
  + `<div class="ab-v">Version ${APP_VERSION}</div>`
  + '<div class="ab-rule"></div>'
  + '<div class="ab-s">Created by</div>'
  + '<div class="ab-n">Sukanto Biswas</div>'
  + '<div class="ab-s">Mechanical Engineer</div>'
  + '<div class="ab-c">© 2026 FreeTility</div>'
  + '</div><div class="hint msg-btn" data-act="ac" role="button">[AC] :Back</div>';

/* ---------- key handling ---------- */
function screenKey(id, shifted, alpha) {
  if (id === 'on') { leaveApp(); S.screen = 'calc'; ac(); return; }
  if (id === 'menu') { if (shifted) openSetup(); else openMenu(); return; }
  if (S.screen === 'list') listKey(id);
  else if (S.screen === 'app') { const app = curApp(); if (app && app.key) app.key(id, { shift: shifted, alpha }); }
  else if (S.screen === 'menu') menuKey(id);
  else if (S.screen === 'setup') setupKey(id);
  else if (S.screen === 'solve') solveKey(id);
  else if (S.screen === 'steps') CASUI.stepsKey(id);
  else if (S.screen === 'msg') {
    if (S.msg.confirm) { if (id === 'eq') S.msg.confirm(); else if (id === 'ac') S.screen = S.msg.back; }
    else S.screen = S.msg.back;
  } else if (S.screen === 'recall') recallKey(id);
}

function menuKey(id) {
  const n = MENU_ITEMS.length;
  if (id === 'left') S.menuSel = (S.menuSel + n - 1) % n;
  else if (id === 'right') S.menuSel = (S.menuSel + 1) % n;
  else if (id === 'up') S.menuSel = Math.max(0, S.menuSel - 4);
  else if (id === 'down') S.menuSel = Math.min(n - 1, S.menuSel + 4);
  else if (id === 'eq') selectMenu(S.menuSel);
  else if (id === 'ac') backToCalc();
  else {
    const k = keyNum(id);
    if (k >= 1 && k <= n) { S.menuSel = k - 1; selectMenu(k - 1); }
  }
}
/* ---------- App framework for the extra modes ----------
   registerApp(menuKey, app) with app = {
     name, indicator?(): string,           // short text shown in the status bar
     enter(), leave?(),                    // called on MENU selection / when another app is chosen
     key?(id, mods) ,                      // keys while S.screen === 'app'  (mods = {shift, alpha})
     render?(): html,                      // panel content while S.screen === 'app'
     calcKey?(id, mods): boolean,          // keys on the calculation screen; return true if handled
   }
   An app may use its own panel (S.screen = 'app') and/or the normal expression
   screen (S.screen = 'calc'); it can switch between them at any time.            */
const APPS = {};
function registerApp(menuKey, app) { APPS[menuKey] = app; }
const curApp = () => (S.app ? APPS[S.app] : null);

function leaveApp() {
  const app = curApp();
  if (app && app.leave) app.leave();
  S.app = null;
  HOOKS.parseNumber = null;
  HOOKS.fmtResult = null;
  HOOKS.num = null;
}
function selectMenu(i) {
  const k = MENU_ITEMS[i].k;
  leaveApp();
  if (i === 0) { S.screen = 'calc'; ac(); return; }
  if (APPS[k]) {
    S.app = k;
    S.screen = 'app';
    ac();
    APPS[k].enter();
    return;
  }
  notAvailable(MENU_ITEMS[i].name, 'menu');
}

/* Numbered option list (4 per page, keys 1-4, AC back), e.g. OPTN menus.
   ▲▼ move the highlight (paging at the edges), ▶ or = enters it, ◀ goes back like AC.
   items: [{ label, act }]; opts: { title, back } — back() runs on AC.            */
// opts.grid: show up to 12 items in two columns numbered 1-9, A, B, C (like CONV / engineering symbols)
function openList(items, opts = {}) {
  S.list = { items, page: 0, sel: 0, title: opts.title || null, back: opts.back || null, prev: S.screen, grid: !!opts.grid, cols: opts.cols || 2 };
  S.screen = 'list';
}
function listKey(id) {
  const L = S.list;
  const n = L.items.length;
  const k = keyNum(id);
  const run = (item) => { if (!item) return; S.screen = L.prev; item.act(); };
  if (id === 'down') L.sel = (L.sel + 1) % n;
  else if (id === 'up') L.sel = (L.sel + n - 1) % n;
  else if (id === 'right' || id === 'eq') return run(L.items[L.sel]);
  else if (id === 'ac' || id === 'left') { S.screen = L.prev; if (L.back) L.back(); return; }
  else if (L.grid) return run(k >= 1 ? L.items[k - 1] : null);
  else if (k >= 1 && k <= 4) return run(L.items[L.page * 4 + k - 1]);
  if (!L.grid) L.page = Math.floor(L.sel / 4);
}
const numLabel = (i) => (i < 9 ? String(i + 1) : 'ABCDEFM'[i - 9] || '<i>x</i>');
function listHTML() {
  const L = S.list;
  if (L.grid) {
    const cells = L.items.map((it, i) => `<div class="gl-cell gl-clickable${i === L.sel ? ' on' : ''}" data-list-idx="${i}" role="button">${numLabel(i)}:${it.label}</div>`).join('');
    return `<div class="grid-list${L.items.length > 8 ? ' dense' : ''}" style="grid-template-columns:repeat(${L.cols},1fr)">${cells}</div>`;
  }
  const pages = Math.ceil(L.items.length / 4);
  const rows = L.items.slice(L.page * 4, L.page * 4 + 4).map((it, j) => `<div class="ln ln-clickable${L.page * 4 + j === L.sel ? ' on' : ''}" data-list-idx="${L.page * 4 + j}" role="button">${j + 1}:${it.label}</div>`);
  return (L.title ? `<div class="ln">${L.title}</div>` : '') + rows.join('') + (pages > 1 ? scrollbar(L.page, pages) : '');
}

/* ---------- Calculate mode: OPTN and CONV (SHIFT 8) ---------- */
function calcOptn() {
  openList([
    { label: 'Hyperbolic Func', act: () => openList(HYP.map((t) => ({ label: t.d.replace('(', ''), act: () => ins(t) })), { grid: true }) },
    { label: 'Angle Unit', act: () => openList(ANGLE_SUFFIX.map((t) => ({ label: t.d, act: () => ins(t) }))) },
    { label: 'Engineer Symbol', act: () => openList(ENG_TOKENS.map((t) => ({ label: t.d, act: () => ins(t) })), { grid: true, cols: 3 }) },
  ]);
}
function convMenu() {
  openList(CONV.map((c) => ({
    label: c.name,
    act: () => openList(c.items.map((t) => ({ label: t.d, act: () => ins(t) })), { grid: true }),
  })));
}

/* ---------- CONST (SHIFT 7), RESET (SHIFT 9), RECALL (SHIFT STO) ---------- */
function constMenu() {
  openList(CONSTS.map((c) => ({
    label: c.name,
    act: () => openList(c.items.map((t) => ({ label: t.d, act: () => ins(t) })), { grid: true, cols: 3 }),
  })));
}
function confirmScreen(name, fn, back = 'calc') { S.msg = { name, back, confirm: fn }; S.screen = 'msg'; }
function resetMenu() {
  const memory = () => {
    S.ans = 0; S.mem = 0; Object.keys(S.vars).forEach((v) => (S.vars[v] = 0));
    S.history = []; S.hIdx = 0; S.histView = false; // history is only deleted by a memory reset
  };
  const setup = () => { const c = S.cfg.contrast; S.cfg = DEFAULT_CFG(); S.cfg.contrast = c; };
  openList([
    { label: 'Setup Data', act: () => confirmScreen('Reset Setup Data?', () => { setup(); S.screen = 'calc'; }) },
    { label: 'Memory', act: () => confirmScreen('Clear Memory?', () => { memory(); S.screen = 'calc'; }) },
    { label: 'Initialize All', act: () => confirmScreen('Initialize All?', () => {
      leaveApp(); setup(); memory(); S.history = []; S.hIdx = 0; S.undo = []; ac(); S.screen = 'calc';
    }) },
  ]);
}
const RECALL_KEYS = { neg: 'A', dms: 'B', inv: 'C', sin: 'D', cos: 'E', tan: 'F', mplus: 'M', xvar: 'x', close: 'x', sd: 'y' };
function openRecall() { rememberScreen(); S.screen = 'recall'; }
function recallKey(id) {
  if (id === 'ac') { S.screen = 'calc'; return; }
  const v = RECALL_KEYS[id];
  if (v) { S.screen = 'calc'; ins(varTok(v)); }
}
function recallHTML() {
  // values always in Norm 1 like the real RECALL screen
  const fmt = (v) => { const c = S.cfg.fmt; S.cfg.fmt = { type: 'Norm', n: 1 }; const h = fmtNum(v); S.cfg.fmt = c; return h; };
  const cells = ['A', 'B', 'C', 'D', 'E', 'F', 'M', 'x', 'y']
    .map((n) => `<div class="gl-cell gl-clickable" data-recall-var="${n}" role="button">${n === 'x' || n === 'y' ? `<i>${n}</i>` : n}=${fmt(S.vars[n] || (n === 'M' ? S.mem : 0))}</div>`).join('');
  return `<div class="grid-list dense">${cells}</div>`;
}

/* Number entry helpers for value-input screens (matrix cells, coefficients, data …).
   buf is a string or null (= not editing).                                       */
function entryKey(buf, id) {
  // returns the new buffer, or undefined when the key is not an entry key
  if (/^[0-9]$/.test(id)) return (buf || '') + id;
  if (id === 'dot') return (buf || '') + (buf && buf.includes('.') ? '' : '.');
  if (id === 'neg' || id === 'sub') return !buf ? '-' : buf.endsWith('e') ? buf + '-' : buf;
  if (id === 'exp') return buf && !buf.includes('e') ? buf + 'e' : buf || '1e';
  if (id === 'frac') return buf && !buf.includes('/') ? buf + '/' : buf;
  if (id === 'del') return buf ? buf.slice(0, -1) || null : null;
  return undefined;
}
function entryValue(buf) {
  // supports "1/6" fractions and "2.5e9"; returns NaN when invalid
  if (buf === null || buf === '' || buf === '-') return NaN;
  if (buf.includes('/')) {
    const [a, b] = buf.split('/').map(Number);
    return b ? a / b : NaN;
  }
  return Number(buf);
}
const entryHTML = (buf) => `${buf.replace(/-/g, '−').replace('e', '×10').replace('/', '⌟')}<span class="cursor"></span>`;

function setupKey(id) {
  const st = S.setup;
  let k = keyNum(id);

  if (st.sub === 'contrast') {
    if (id === 'left') S.cfg.contrast = Math.max(1, S.cfg.contrast - 1);
    else if (id === 'right') S.cfg.contrast = Math.min(9, S.cfg.contrast + 1);
    else if (id === 'ac' || id === 'eq') backToCalc();
    return;
  }
  if (st.fmtType) { // waiting for Fix/Sci digits or Norm 1~2
    if (id === 'ac' || id === 'left') { st.fmtType = null; return; }
    const ok = st.fmtType === 'Norm' ? k === 1 || k === 2 : k !== null && k <= 9;
    if (ok) { S.cfg.fmt = { type: st.fmtType, n: k }; backToCalc(); }
    return;
  }
  if (st.sub) {
    if (id === 'ac' || id === 'left') { st.sub = null; return; }
    const sub = SETUP_SUB[st.sub];
    const m = sub.opts.length;
    if (id === 'down') { st.srow = (st.srow + 1) % m; return; }
    if (id === 'up') { st.srow = (st.srow + m - 1) % m; return; }
    if (id === 'right' || id === 'eq') k = st.srow + 1;
    if (k >= 1 && k <= sub.opts.length) {
      const val = sub.vals[k - 1];
      if (st.sub === 'fmt') { st.fmtType = val; return; }
      if (sub.next) { st.sub = sub.next(val); st.srow = 0; return; } // nested setting page
      if (sub.apply) sub.apply(val); else S.cfg[st.sub] = val;
      backToCalc();
    }
    return;
  }
  // top level list: the highlight walks across pages
  const P = SETUP_PAGES.length;
  if (id === 'right' || id === 'eq') k = st.row + 1;
  if (id === 'down') { if (++st.row >= SETUP_PAGES[st.page].length) { st.page = (st.page + 1) % P; st.row = 0; } }
  else if (id === 'up') { if (--st.row < 0) { st.page = (st.page + P - 1) % P; st.row = SETUP_PAGES[st.page].length - 1; } }
  else if (id === 'ac' || id === 'left') backToCalc();
  else if (k >= 1 && k <= SETUP_PAGES[st.page].length) {
    const [name, key] = SETUP_PAGES[st.page][k - 1];
    if (!key) notAvailable(name, 'setup');
    else if (key === 'about') openAbout('setup');
    else { st.sub = key; st.srow = 0; }
  }
}

/* ---------- SOLVE / CALC ----------
   Variable list: type a value + [=] stores it and moves down.
   SOLVE: [=] on a row without typing solves for that variable.
   CALC: [=] on the last row evaluates the expression.            */
function startSolve(mode) {
  if (!S.root.items.length) return;
  if (S.error) { S.error = null; }
  let vars;
  try {
    splitEq(S.root); // validates a single '='
    vars = collectVars(S.root);
  } catch (e) { S.error = SYNTAX; return; }
  if (mode === 'calc' && !vars.length) { equals(); return; }
  if (mode === 'solve') {
    if (!vars.length) { notAvailable('Variable ERROR', 'calc'); S.msg.title = true; return; }
    if (vars.includes('x')) vars = ['x', ...vars.filter((v) => v !== 'x')];
  }
  S.done = false;
  S.solve = { mode, vars, sel: 0, buf: null, result: null };
  S.screen = 'solve';
}

function solveKey(id) {
  const sv = S.solve;
  if (sv.result) { // result screen: [=] back to the list, [AC] back to the expression
    if (id === 'eq') sv.result = null;
    else if (id === 'ac') { S.screen = 'calc'; S.done = false; }
    return;
  }
  const name = sv.vars[sv.sel];
  if (/^[0-9]$/.test(id) || id === 'dot') {
    sv.buf = (sv.buf || '') + (id === 'dot' ? '.' : id);
  } else if (id === 'neg' || id === 'sub') {
    if (!sv.buf) sv.buf = '-';
  } else if (id === 'exp') {
    if (sv.buf && !/e/.test(sv.buf)) sv.buf += 'e';
  } else if (id === 'del') {
    if (sv.buf) sv.buf = sv.buf.slice(0, -1) || null;
  } else if (id === 'up') { sv.buf = null; sv.sel = Math.max(0, sv.sel - 1); }
  else if (id === 'down') { sv.buf = null; sv.sel = Math.min(sv.vars.length - 1, sv.sel + 1); }
  else if (id === 'ac') { S.screen = 'calc'; S.done = false; }
  else if (id === 'eq') {
    const typed = sv.buf !== null;
    if (typed) {
      const v = Number(sv.buf);
      sv.buf = null;
      if (!Number.isFinite(v)) return;
      S.vars[name] = v;
    }
    const last = sv.sel === sv.vars.length - 1;
    if (sv.mode === 'calc') {
      if (last) runCalc(); else sv.sel++;
    } else if (typed) {
      if (!last) sv.sel++;
    } else runSolve(name);
  }
}

function runCalc() {
  S.screen = 'calc';
  try {
    const [L, R] = splitEq(S.root);
    if (R) { // "y = expr": assign when the left side is a single variable
      if (L.items.length !== 1 || !L.items[0].var) throw SYNTAX;
      const v = tidy(evalRow(R));
      S.vars[L.items[0].d] = v;
      S.ans = v; S.exactOK = !hasInexact(R);
      S.view = 'exact'; S.mixed = S.cfg.fracRes === 'abc'; S.engExp = null;
      S.error = null; S.done = true;
      return;
    }
  } catch (e) { S.error = typeof e === 'string' ? e : MATH; return; }
  equals();
}

function runSolve(name) {
  const sv = S.solve;
  let L, R;
  try { [L, R] = splitEq(S.root); } catch (e) { sv.result = { err: SYNTAX }; return; }
  const f = (v) => {
    const old = S.vars[name];
    S.vars[name] = v;
    try { return evalRow(L) - (R ? evalRow(R) : 0); } finally { S.vars[name] = old; }
  };
  const root = solveNum(f, S.vars[name]);
  if (root === null) { sv.result = { err: "Can't Solve" }; return; }
  const val = tidy(root);
  S.vars[name] = val;
  S.ans = val;
  let lr = 0;
  try { lr = tidy(f(val)); } catch (e) { lr = NaN; }
  sv.result = { name, val, lr };
}

/* ---------- rendering ---------- */
const varName = (n) => (n === 'x' || n === 'y' ? `<i>${n}</i>` : n);
const plainNum = (v) => fmtNum(v).replace(/<span class="dsep"><\/span>/g, '');

function solveHTML() {
  const sv = S.solve;
  const eqn = `<div class="eqn">${rowHTML(S.root, false)}</div>`;
  if (sv.result) {
    if (sv.result.err) return eqn + `<div class="vr center">${sv.result.err}</div>`;
    const { name, val, lr } = sv.result;
    return eqn
      + `<div class="vr">${varName(name)}=<span class="val">${plainNum(val)}</span></div>`
      + `<div class="vr">L−R=<span class="val">${Number.isNaN(lr) ? '—' : plainNum(lr)}</span></div>`;
  }
  const top = Math.max(0, Math.min(sv.sel - 1, sv.vars.length - 2));
  const rows = sv.vars.slice(top, top + 2).map((n, j) => {
    const i = top + j, on = i === sv.sel;
    const editing = on && sv.buf !== null;
    const val = editing ? `${sv.buf.replace('-', '−').replace('e', '×10')}<span class="cursor"></span>` : plainNum(S.vars[n]);
    return `<div class="vr left${on && !editing ? ' on' : ''}">${varName(n)} =<span class="val l">${val}</span></div>`;
  }).join('');
  const arr = `<span class="arr">${top > 0 ? '▲' : ''}${top + 2 < sv.vars.length ? '▼' : ''}</span>`;
  return eqn + rows + arr;
}
const lines = (arr) => arr.map((l) => `<div class="ln">${l}</div>`).join('');
const scrollbar = (page, pages) => `<div class="sb" data-act="sb" title="Scroll"><b style="top:${(page / pages) * 100}%;height:${100 / pages}%"></b></div>`;

function panelHTML() {
  if (S.screen === 'menu') {
    const row = Math.floor(S.menuSel / 4);
    if (row < S.menuTop) S.menuTop = row;
    if (row > S.menuTop + 1) S.menuTop = row - 1;
    const cells = MENU_ITEMS.slice(S.menuTop * 4, S.menuTop * 4 + 8).map((m, j) => {
      const i = S.menuTop * 4 + j;
      return `<div class="mi${i === S.menuSel ? ' on' : ''}" data-menu-idx="${i}" role="button" tabindex="0"><span class="ico">${m.icon}</span><span class="n">${m.k}</span></div>`;
    }).join('');
    const sel = MENU_ITEMS[S.menuSel];
    const arrows = `<span class="arr">${S.menuTop > 0 ? '<b data-arr="up" title="Previous page">▲</b>' : ''}${(S.menuTop + 2) * 4 < MENU_ITEMS.length ? '<b data-arr="down" title="Next page">▼</b>' : ''}</span>`;
    return `<div class="menu-grid">${cells}</div><div class="menu-label" data-menu-label="${S.menuSel}" role="button">${sel.k}:${sel.name}${arrows}</div>`;
  }

  if (S.screen === 'solve') return solveHTML();
  if (S.screen === 'steps') return CASUI.stepsHTML();
  if (S.screen === 'list') return listHTML();
  if (S.screen === 'app') { const app = curApp(); return app && app.render ? app.render() : ''; }

  if (S.screen === 'recall') return recallHTML();
  if (S.screen === 'msg') {
    if (S.msg.about) return ABOUT_HTML;
    if (S.msg.confirm) return lines([S.msg.name, '', '<span class="msg-btn" data-act="eq" role="button">[=] :Yes</span>', '<span class="msg-btn" data-act="ac" role="button">[AC] :Cancel</span>']);
    if (S.msg.title) return `<div class="vr center big">${S.msg.name}</div><div class="hint msg-btn" data-act="ac" role="button">[AC] :Back</div>`;
    return lines([S.msg.name, '', 'Not available', 'in this version']) + '<div class="hint msg-btn" data-act="ac" role="button">[AC] :Back</div>';
  }

  // setup
  const st = S.setup;
  if (st.sub === 'contrast') {
    const bar = Array.from({ length: 9 }, (_, i) => `<b class="${i < S.cfg.contrast ? 'on' : ''}"></b>`).join('');
    return lines(['CONTRAST', '']) + `<div class="contrast"><span class="c-btn" data-contrast="left" role="button">LIGHT ◀</span><span>${bar}</span><span class="c-btn" data-contrast="right" role="button">▶ DARK</span></div><div class="hint msg-btn" data-act="ac" role="button">[AC] :Done</div>`;
  }
  if (st.fmtType) {
    const range = st.fmtType === 'Norm' ? '1~2' : '0~9';
    return lines([`${st.fmtType} ${range}?`]);
  }
  if (st.sub) {
    const sub = SETUP_SUB[st.sub];
    const opts = sub.opts.map((o, i) => `<div class="ln ln-clickable${i === st.srow ? ' on' : ''}" data-setup-k="${i + 1}" role="button">${i + 1}:${o}</div>`);
    return (sub.title ? `<div class="ln">${sub.title}</div>` : '') + opts.join('');
  }
  const items = SETUP_PAGES[st.page].map(([name], i) => `<div class="ln ln-clickable${i === st.row ? ' on' : ''}" data-setup-k="${i + 1}" role="button">${i + 1}:${name}</div>`);
  return items.join('') + scrollbar(st.page, SETUP_PAGES.length);
}

/* ---------- Tapping the LCD: MENU icons, SETUP rows, lists, dialogs ---------- */
const NUM_KEY = { A: 'neg', B: 'dms', C: 'inv', D: 'sin', E: 'cos' }; // menu numbers A-E live on these keys
function panelTap(e) {
  if (!S.power || S.screen === 'calc') return;
  const hit = (sel) => e.target.closest(sel);
  let el;
  // About: open the portfolio (the Android app hands non-app links to the external browser)
  if ((el = hit('[data-href]'))) {
    if (window.AndroidBridge) location.href = el.dataset.href;
    else window.open(el.dataset.href, '_blank', 'noopener');
    return;
  }
  if ((el = hit('[data-menu-idx]'))) { S.menuSel = +el.dataset.menuIdx; selectMenu(S.menuSel); }
  else if ((el = hit('[data-arr]'))) menuKey(el.dataset.arr);
  else if (hit('.menu-label')) selectMenu(S.menuSel);
  else if ((el = hit('[data-setup-k]'))) setupKey(el.dataset.setupK);
  else if ((el = hit('[data-list-idx]'))) {
    const it = S.list && S.list.items[+el.dataset.listIdx];
    if (!it) return;
    S.screen = S.list.prev;
    it.act();
  } else if ((el = hit('[data-contrast]'))) setupKey(el.dataset.contrast);
  else if ((el = hit('[data-recall-var]'))) { S.screen = 'calc'; ins(varTok(el.dataset.recallVar)); }
  else if ((el = hit('[data-act]'))) {
    const a = el.dataset.act;
    if (a !== 'sb') screenKey(a);
    else if (S.screen === 'setup') { S.setup.page = (S.setup.page + 1) % SETUP_PAGES.length; S.setup.row = 0; }
    else if (S.screen === 'app') screenKey('down');
    else if (S.screen === 'list' && S.list) { S.list.page = (S.list.page + 1) % Math.max(1, Math.ceil(S.list.items.length / 4)); S.list.sel = S.list.page * 4; }
  } else if ((el = hit('.ln, .hint, .vr, .gl-cell'))) {
    // app screens: rows written as "2:Name" or "[=] :Yes" act like pressing that key
    const t = el.textContent.trim();
    let m;
    if ((m = t.match(/^\[(=|AC)\]/))) screenKey(m[1] === '=' ? 'eq' : 'ac');
    else if ((m = t.match(/^([1-9A-E]):/))) screenKey(NUM_KEY[m[1]] || m[1], false, false);
    else return;
  } else return;
  if (window.triggerHaptic) window.triggerHaptic();
  render();
}
document.getElementById('panel').addEventListener('click', panelTap);
