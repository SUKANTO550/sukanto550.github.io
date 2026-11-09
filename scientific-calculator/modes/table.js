'use strict';

/* =========================================================
   MENU 9: Table   and   MENU 8: Spreadsheet
   Both apps own the LCD panel (S.screen = 'app').
   ========================================================= */
(() => {

  /* ---------- shared helpers ---------- */
  const STYLE = `<style>
  .tb-ed { font-size: calc(42 * var(--s)); }
  .tb-fl { display: flex; align-items: center; min-height: calc(100 * var(--s)); white-space: nowrap; }
  .tb-fl .tb-lb { flex-shrink: 0; margin-right: calc(4 * var(--s)); }
  .tb-fl .tb-lb i { font-family: "Times New Roman", serif; }
  .tb-ex { flex: 1; overflow: hidden; white-space: nowrap; line-height: 1.15; }
  .tb-ex .tk.var { font-style: italic; }
  .tb-rg { display: flex; white-space: nowrap; padding: 0 calc(6 * var(--s)); }
  .tb-rg .tb-v { margin-left: auto; }
  .tb-rg.on .tb-v { background: var(--lcd-ink); color: var(--lcd-1); padding: 0 calc(4 * var(--s)); }
  .tb-rg.on .tb-v.ed { background: none; color: inherit; }

  .tb-tab, .ss-grid { position: relative; font-size: calc(28 * var(--s)); line-height: calc(32 * var(--s)); }
  .tb-row, .ss-row { display: grid; }
  .tb-row > span, .ss-row > span {
    text-align: right; white-space: nowrap; overflow: hidden;
    padding: 0 calc(5 * var(--s)); border-left: calc(2 * var(--s)) solid var(--lcd-ink);
  }
  .tb-row > span:first-child, .ss-row > span:first-child { border-left: none; font-size: .8em; padding: 0 calc(4 * var(--s)) 0 0; }
  .tb-h > span, .ss-h > span { text-align: center; border-bottom: calc(2 * var(--s)) solid var(--lcd-ink); }
  .tb-h i { font-family: "Times New Roman", serif; }
  .tb-row > .on, .ss-row > .on { background: var(--lcd-ink); color: var(--lcd-1); }
  .tb-sb, .ss-sb { position: absolute; right: calc(-14 * var(--s)); top: calc(34 * var(--s)); bottom: 0; width: calc(6 * var(--s)); }
  .tb-sb b, .ss-sb b { position: absolute; left: 0; right: 0; background: var(--lcd-ink); border-radius: 2px; }
  .tb-big, .ss-line {
    position: absolute; left: 0; right: 0; bottom: 0; height: calc(46 * var(--s));
    white-space: nowrap; overflow: hidden; text-align: right; font-size: calc(40 * var(--s)); line-height: calc(46 * var(--s));
  }
  .tb-tab, .ss-grid { margin-right: calc(14 * var(--s)); }
  .ss-line { font-size: calc(34 * var(--s)); }
  .ss-line.l { text-align: left; }
  .ss-fl { white-space: nowrap; overflow: hidden; }
  </style>`;
  document.head.insertAdjacentHTML('beforeend', STYLE);

  // number squeezed into w characters (table / spreadsheet cells); extra digits are cut
  // off like on the real cells (guide: 17404.744 shows as 17404, 1182.94 as 1182.9)
  function fitNum(v, w) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return 'ERROR';
    v = tidy(v);
    const out = (s) => s.replace('-', '−').replace('.', S.cfg.decMark);
    const a = Math.abs(v);
    if (v === 0) return '0';
    if (a >= 0.01 && a < 1e10) {
      const s = plain(+v.toPrecision(12));
      const int = s.split('.')[0];
      if (s.length <= w) return out(s);
      if (int.length <= w) return out(s.slice(0, w).replace(/\.$/, ''));
    }
    for (let p = 6; p >= 1; p--) {
      const [m, e] = v.toExponential(p - 1).split('e');
      const s = `${+m}E${+e}`;
      if (s.length <= w || p === 1) return out(s);
    }
    return '';
  }

  // keep the blinking cursor inside a horizontally clipped box (after the panel is drawn)
  function scrollCursor(sel) {
    setTimeout(() => {
      document.querySelectorAll(sel).forEach((box) => {
        const c = box.querySelector('.cursor');
        if (!c) { box.scrollLeft = 0; return; }
        const l = c.offsetLeft - box.offsetLeft, w = box.clientWidth;
        if (l < box.scrollLeft + 10) box.scrollLeft = Math.max(0, l - 30);
        else if (l > box.scrollLeft + w - 12) box.scrollLeft = l - w + 30;
      });
    }, 0);
  }

  const msgHTML = (text, hint = '[AC] :Cancel') => `<div class="vr center big">${text}</div><div class="hint">${hint}</div>`;

  /* =========================================================
     9: Table
     ========================================================= */
  const TB = {
    two: false,                 // false: f(x) only, true: f(x) and g(x)
    fns: [Row(), Row()],        // expression trees of f and g
    edit: 0,                    // function being edited
    stage: 'fx',                // fx | range | table | msg
    range: { start: 1, end: 5, step: 1 },
    rsel: 0, buf: null,         // range screen: selected line, typed number
    rows: [], sel: 0, col: 0, top: 0,
    msg: null,
  };
  const TB_ROWS = 4;            // visible table rows

  // put function i into the global editor (S.root / S.cur)
  function tbEdit(i) {
    TB.edit = i;
    S.root = TB.fns[i];
    S.cur = { row: S.root, idx: S.root.items.length };
    S.done = false; S.error = null;
  }
  // SETUP > Table (1:f(x) 2:f(x),g(x)) changes this setting from screens.js
  window.TableSetup = {
    get two() { return TB.two; },
    set two(v) { if (S.app === '9') tbSetTwo(v); else { TB.two = v; TB.stage = 'fx'; } },
  };

  function tbSetTwo(two) {
    TB.two = two;
    TB.stage = 'fx';
    tbEdit(0);
  }
  const tbOptn = () => openList([
    { label: '<i>f</i>(<i>x</i>)', act: () => tbSetTwo(false) },
    { label: '<i>f</i>(<i>x</i>),<i>g</i>(<i>x</i>)', act: () => tbSetTwo(true) },
  ]);

  // keys that make no sense inside f(x) (they would evaluate S.root)
  const TB_BLOCK = new Set(['calc', 'calc:s', 'calc:a', 'sto', 'sto:s', 'eng', 'eng:s', 'eng:a', 'sd', 'sd:s',
    'mplus', 'mplus:s', 'dms:s', '9:s', 'ans:s', 'eq', 'eq:s']);
  // run a key's normal editing action on S.root (same layer logic as press())
  function forwardKey(id, mods) {
    const k = KEYS[id];
    if (!k) return;
    const tag = id + (mods.shift ? ':s' : mods.alpha ? ':a' : '');
    if (TB_BLOCK.has(tag)) return;
    const layer = mods.shift ? k.s : mods.alpha ? k.a : null;
    let act = layer ? layer[1] : k.m;
    if (typeof act === 'string') { const n = act; act = () => ins(varTok(n)); }
    if (act) act();
    S.done = false;
    TB.fns[TB.edit] = S.root; // undo may replace the tree
  }

  // value of function i at x (null = no function, NaN = error)
  function tbCalc(i, x) {
    const row = TB.fns[i];
    if (!row.items.length) return null;
    try {
      const v = fOfX(row)(x);
      return typeof v === 'number' ? tidy(v) : NaN;
    } catch (e) { return NaN; }
  }
  function tbRowOf(x) {
    return { x, f: tbCalc(0, x), g: TB.two ? tbCalc(1, x) : null };
  }
  function tbMsg(text, back) { TB.msg = { text, back }; TB.stage = 'msg'; }

  function tbBuild() {
    const { start, end, step } = TB.range;
    const n = step === 0 ? -1 : Math.floor((end - start) / step + 1e-9) + 1;
    if (n < 1) { tbMsg('Range ERROR', 'range'); return; }
    if (n > (TB.two ? 30 : 45)) { tbMsg('Range Limit', 'range'); return; }
    TB.rows = [];
    for (let i = 0; i < n; i++) TB.rows.push(tbRowOf(tidy(+(start + i * step).toPrecision(14))));
    TB.stage = 'table';
    TB.sel = TB.col = TB.top = 0;
    TB.buf = null;
  }

  function tbFxKey(id, mods) {
    if (id === 'ac') {
      if (mods.shift) { KEYS.ac.s[1](); return; } // OFF
      newExpr();
      TB.fns[TB.edit] = S.root;
    } else if (id === 'eq' && !mods.shift) {
      if (TB.two && TB.edit === 0) tbEdit(1);
      else if (TB.fns[0].items.length) { TB.stage = 'range'; TB.rsel = 0; TB.buf = null; }
    } else if (id === 'optn') tbOptn();
    else if (id === 'up' || id === 'down') {
      const d = id === 'up' ? -1 : 1;
      if (!moveVert(d) && TB.two) tbEdit(d > 0 ? 1 : 0);
    } else if (id === 'left' || id === 'right') move(id === 'left' ? -1 : 1);
    else forwardKey(id, mods);
  }

  const RANGE_KEYS = ['start', 'end', 'step'];
  function tbRangeKey(id) {
    const nb = entryKey(TB.buf, id);
    if (nb !== undefined) { TB.buf = nb; return; }
    if (id === 'up') { TB.buf = null; TB.rsel = Math.max(0, TB.rsel - 1); }
    else if (id === 'down') { TB.buf = null; TB.rsel = Math.min(2, TB.rsel + 1); }
    else if (id === 'ac') {
      if (TB.buf !== null) TB.buf = null;
      else { TB.stage = 'fx'; tbEdit(0); }
    } else if (id === 'eq') {
      if (TB.buf !== null) {
        const v = entryValue(TB.buf);
        TB.buf = null;
        if (!Number.isFinite(v)) return;
        TB.range[RANGE_KEYS[TB.rsel]] = v;
      }
      if (TB.rsel < 2) TB.rsel++;
      else tbBuild();
    }
  }

  function tbTableKey(id) {
    const n = TB.rows.length;
    const max = TB.two ? 30 : 45;
    // empty line below the last row: [+] / [=] add previous x + step, [−] previous x − step
    if (TB.sel === n && TB.buf === null && ['add', 'eq', 'sub'].includes(id)) {
      const x = tidy(+(TB.rows[n - 1].x + (id === 'sub' ? -1 : 1) * TB.range.step).toPrecision(14));
      TB.rows.push(tbRowOf(x));
      TB.sel = Math.min(n + 1, max - 1);
      tbScroll();
      return;
    }
    if (TB.col === 0) {
      const nb = entryKey(TB.buf, id);
      if (nb !== undefined) { TB.buf = nb; return; }
    }
    if (id === 'up' || id === 'down') {
      TB.buf = null;
      // one empty line after the last row (while under the row limit) accepts new x values
      TB.sel = Math.max(0, Math.min(n < max ? n : n - 1, TB.sel + (id === 'up' ? -1 : 1)));
      if (TB.sel === n) TB.col = 0;
    } else if (id === 'left' || id === 'right') {
      TB.buf = null;
      if (TB.sel === n) return;
      const cols = TB.two ? 3 : 2;
      TB.col = (TB.col + (id === 'left' ? cols - 1 : 1)) % cols;
    } else if (id === 'eq') {
      if (TB.buf === null) return;
      const v = entryValue(TB.buf);
      TB.buf = null;
      if (Number.isFinite(v)) TB.rows[TB.sel] = tbRowOf(tidy(v)); // replace (or add) x, recompute the row
    } else if (id === 'ac') {
      if (TB.buf !== null) TB.buf = null;
      else { TB.stage = 'fx'; tbEdit(0); }
    } else if (id === 'optn') tbOptn();
    tbScroll();
  }
  function tbScroll() {
    if (TB.sel < TB.top) TB.top = TB.sel;
    if (TB.sel >= TB.top + TB_ROWS) TB.top = TB.sel - TB_ROWS + 1;
  }

  const FNAME = ['<i>f</i>(<i>x</i>)=', '<i>g</i>(<i>x</i>)='];
  function tbFxHTML() {
    const fl = (i) => `<div class="tb-fl"><span class="tb-lb">${FNAME[i]}</span>`
      + `<span class="tb-ex">${rowHTML(TB.fns[i], TB.edit === i)}</span></div>`;
    scrollCursor('#panel .tb-ex');
    return `<div class="tb-ed">${fl(0)}${TB.two ? fl(1) : ''}</div>`;
  }
  function tbRangeHTML() {
    const names = ['Start:', 'End:', 'Step:'];
    const rows = RANGE_KEYS.map((k, i) => {
      const on = i === TB.rsel, ed = on && TB.buf !== null;
      const val = ed ? entryHTML(TB.buf) : plainNum(TB.range[k]);
      return `<div class="tb-rg${on ? ' on' : ''}">${names[i]}<span class="tb-v${ed ? ' ed' : ''}">${val}</span></div>`;
    }).join('');
    return `<div class="ln">Table Range</div>${rows}`;
  }
  function tbTableHTML() {
    const cols = TB.two ? 3 : 2;
    const w = TB.two ? 7 : 10;
    const tpl = `style="grid-template-columns: calc(44 * var(--s)) repeat(${cols}, 1fr)"`;
    const head = ['', '<i>x</i>', '<i>f</i>(<i>x</i>)', '<i>g</i>(<i>x</i>)'].slice(0, cols + 1);
    let h = `<div class="tb-row tb-h" ${tpl}>${head.map((c) => `<span>${c}</span>`).join('')}</div>`;
    const keys = ['x', 'f', 'g'];
    for (let i = TB.top; i < Math.min(Math.max(TB.rows.length, TB.sel + 1), TB.top + TB_ROWS); i++) {
      const r = TB.rows[i] || { x: null, f: null, g: null }; // empty line for a new x
      h += `<div class="tb-row" ${tpl}><span>${i + 1}</span>`;
      for (let c = 0; c < cols; c++) {
        const v = r[keys[c]];
        h += `<span${i === TB.sel && c === TB.col ? ' class="on"' : ''}>${v === null ? '' : fitNum(v, w)}</span>`;
      }
      h += '</div>';
    }
    const n = TB.rows.length;
    if (n > TB_ROWS) h += `<div class="tb-sb"><b style="top:${(TB.top / n) * 100}%;height:${(TB_ROWS / n) * 100}%"></b></div>`;
    const cur = TB.rows[TB.sel] ? TB.rows[TB.sel][keys[TB.col]] : null;
    const big = TB.buf !== null ? entryHTML(TB.buf)
      : cur === null ? '' : Number.isNaN(cur) ? 'ERROR' : plainNum(cur);
    return `<div class="tb-tab">${h}</div><div class="tb-big">${big}</div>`;
  }

  registerApp('9', {
    name: 'Table',
    enter() { TB.stage = 'fx'; S.screen = 'app'; tbEdit(0); },
    leave() { newExpr(); },
    key(id, mods) {
      if (TB.stage === 'fx') tbFxKey(id, mods);
      else if (TB.stage === 'range') tbRangeKey(id);
      else if (TB.stage === 'table') tbTableKey(id);
      else if (TB.stage === 'msg' && ['ac', 'eq', 'left', 'right'].includes(id)) TB.stage = TB.msg.back;
    },
    render() {
      if (TB.stage === 'fx') return tbFxHTML();
      if (TB.stage === 'range') return tbRangeHTML();
      if (TB.stage === 'table') return tbTableHTML();
      return msgHTML(TB.msg.text);
    },
    // MENU then AC lands on the calc screen while the app is still active: come back to the panel
    calcKey(id, mods) { S.screen = 'app'; this.key(id, mods); return true; },
    test: { TB, tbCalc, tbBuild, tbEdit },
  });

  /* =========================================================
     8: Spreadsheet
     ========================================================= */
  const NR = 45, NC = 5, VR = 4, VC = 4; // size and visible rows / columns
  const COLS = 'ABCDE';
  const SS = {
    cells: Array.from({ length: NR }, () => Array(NC).fill(null)), // { f: formula|null, v: value }
    r: 0, c: 0, top: 0, left: 0,
    ed: null,      // line editor { toks, cur }
    mode: 'grid',  // grid | fill | msg | confirm
    fill: null,    // { kind: 'formula'|'value', field, eds: [ed, ed] }
    clip: null,    // { mode: 'cut'|'copy', r, c }
    msg: null,     // { text, back() }
    grab: null,    // OPTN Grab: { r0, c0 } = the cell being edited, cursor picks a reference
  };
  // SETUP > Spreadsheet (wired by screens.js): Auto Calc on/off, Show Cell formula/value
  window.SpreadsheetSetup = { autoCalc: true, showCell: 'formula' };
  const ssCfg = () => window.SpreadsheetSetup;

  /* ----- formula strings: tokens and evaluation ----- */
  const FN1 = {
    'sin(': TK.sin.f, 'cos(': TK.cos.f, 'tan(': TK.tan.f,
    'sin⁻¹(': TK.asin.f, 'cos⁻¹(': TK.acos.f, 'tan⁻¹(': TK.atan.f,
    'log(': Math.log10, 'ln(': Math.log, '√(': Math.sqrt, 'Abs(': Math.abs,
    '10^(': (x) => Math.pow(10, x), 'e^(': Math.exp,
  };
  const AGG = {
    'Min(': (a) => Math.min(...a),
    'Max(': (a) => Math.max(...a),
    'Mean(': (a) => a.reduce((s, x) => s + x, 0) / a.length,
    'Sum(': (a) => a.reduce((s, x) => s + x, 0),
  };
  const LEX = [...Object.keys(FN1), ...Object.keys(AGG), 'Ans', '^(', '⁻¹', '²', '³', '!', 'π', 'e', 'ᴇ',
    '+', '−', '×', '÷', '(', ')', ',', ':', '=', '.', '$', ...'0123456789', ...COLS].sort((a, b) => b.length - a.length);
  const isDigit = (t) => /^[0-9.]$/.test(t);
  const isCol = (t) => t && t.length === 1 && COLS.includes(t);

  function lex(str) {
    const out = [];
    let i = 0;
    while (i < str.length) {
      const t = LEX.find((x) => str.startsWith(x, i)) || str[i];
      out.push(t);
      i += t.length;
    }
    return out;
  }

  // evaluate a formula string; get(r, c) returns a cell value or null (empty)
  function evalFormula(str, get) {
    const t = lex(str);
    let i = 0;
    const peek = () => t[i];
    const digits = () => { let s = ''; while (i < t.length && isDigit(t[i])) s += t[i++]; return s; };
    const ref = () => { // [$]column [$]row ('$' = absolute, only matters for Fill / Copy)
      if (t[i] === '$') i++;
      const c = COLS.indexOf(t[i++]);
      if (c < 0) throw SYNTAX;
      if (t[i] === '$') i++;
      const d = digits();
      const r = +d - 1;
      if (!/^\d+$/.test(d) || r < 0 || r >= NR) throw SYNTAX;
      return { r, c };
    };
    const isRef = (j) => isCol(t[j]) || (t[j] === '$' && isCol(t[j + 1]));
    const startsValue = (x) => x && (isDigit(x) || isRef(i) || FN1[x] || AGG[x] || ['(', 'π', 'e', 'Ans', 'ᴇ'].includes(x));
    const rangeAhead = () => { // "B1:" starts a cell range
      if (!isRef(i)) return false;
      let j = i + (t[i] === '$' ? 2 : 1);
      if (t[j] === '$') j++;
      const k = j;
      while (isDigit(t[j])) j++;
      return j > k && t[j] === ':';
    };
    const closeParen = () => { if (peek() === ')') i++; else if (i < t.length) throw SYNTAX; };
    const finite = (v) => { if (!Number.isFinite(v)) throw MATH; return v; };

    function expr() {
      let v = term();
      while (peek() === '+' || peek() === '−') v = t[i++] === '+' ? v + term() : v - term();
      return v;
    }
    function term() {
      let v = unary();
      for (;;) {
        const x = peek();
        if (x === '×') { i++; v *= unary(); }
        else if (x === '÷') { i++; const d = unary(); if (d === 0) throw MATH; v /= d; }
        else if (startsValue(x)) v *= unary(); // implicit multiplication: 2B1, 3(4)
        else return v;
      }
    }
    function unary() {
      if (peek() === '−') { i++; return -unary(); }
      if (peek() === '+') { i++; return unary(); }
      return postfix();
    }
    function postfix() {
      let v = primary();
      for (;;) {
        const x = peek();
        if (x === '²') { i++; v = v * v; }
        else if (x === '³') { i++; v = v * v * v; }
        else if (x === '⁻¹') { i++; if (v === 0) throw MATH; v = 1 / v; }
        else if (x === '!') { i++; v = finite(factorial(v)); }
        else if (x === '^(') { i++; const e = expr(); closeParen(); v = finite(power(v, e)); }
        else return v;
      }
    }
    function primary() {
      const x = peek();
      if (x === undefined) throw SYNTAX;
      if (isDigit(x) || x === 'ᴇ') {
        let v = 1;
        if (x !== 'ᴇ') {
          const s = digits();
          if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) throw SYNTAX;
          v = Number(s);
        }
        if (peek() === 'ᴇ') {
          i++;
          let sg = 1;
          if (peek() === '−') { i++; sg = -1; }
          const e = digits();
          if (!/^\d+$/.test(e)) throw SYNTAX;
          v *= Math.pow(10, sg * +e);
        }
        return v;
      }
      if (isRef(i)) {
        const { r, c } = ref();
        if (peek() === ':') throw SYNTAX; // a range only inside Min/Max/Mean/Sum
        const v = get(r, c);
        return v === null ? 0 : v;
      }
      i++;
      if (x === 'π') return Math.PI;
      if (x === 'e') return Math.E;
      if (x === 'Ans') return typeof S.ans === 'number' ? S.ans : 0;
      if (x === '(') { const v = expr(); closeParen(); return v; }
      if (FN1[x]) { const a = expr(); closeParen(); return finite(FN1[x](a)); }
      if (AGG[x]) {
        const vals = [];
        do {
          if (rangeAhead()) {
            const a = ref(); i++; // ':'
            if (!isRef(i)) throw SYNTAX;
            const b = ref();
            for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) {
              for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) {
                const v = get(r, c);
                if (v !== null) vals.push(v); // empty cells are skipped
              }
            }
          } else vals.push(expr());
        } while (peek() === ',' && ++i);
        closeParen();
        if (!vals.length) throw MATH;
        return finite(AGG[x](vals));
      }
      throw SYNTAX;
    }

    const v = expr();
    if (i < t.length) throw SYNTAX;
    return finite(v);
  }

  // recompute every formula cell (cycles and errors give NaN = "ERROR")
  function recalc() {
    const state = new Map(); // key -> 'busy' | value
    const val = (r, c) => {
      const cell = SS.cells[r][c];
      if (!cell) return null;
      if (cell.f === null) return cell.v;
      const k = r * NC + c;
      if (state.get(k) === 'busy') throw MATH; // circular reference
      if (state.has(k)) { if (Number.isNaN(state.get(k))) throw MATH; return state.get(k); }
      state.set(k, 'busy');
      let v;
      try { v = tidy(evalFormula(cell.f, val)); } catch (e) { v = NaN; }
      state.set(k, v);
      cell.v = v;
      if (Number.isNaN(v)) throw MATH;
      return v;
    };
    for (let r = 0; r < NR; r++) {
      for (let c = 0; c < NC; c++) { try { val(r, c); } catch (e) { /* stored as NaN */ } }
    }
  }
  // value getter for one-off evaluation (typed values, Fill Value)
  const getNow = (r, c) => {
    const cell = SS.cells[r][c];
    if (!cell) return null;
    if (Number.isNaN(cell.v)) throw MATH;
    return cell.v;
  };

  // shift relative references by (dr, dc): "B2+25" -> "B3+25"; "$" parts stay fixed,
  // a part pushed outside the grid becomes '?' (the cell then shows ERROR)
  const shiftRefs = (f, dr, dc) => f.replace(/(\$?)([A-E?])(\$?)(\d+|\?)/g, (m, ac, col, ar, row) => {
    const c = COLS.indexOf(col) + dc, r = +row + dr;
    const cs = ac || col === '?' ? col : c >= 0 && c < NC ? COLS[c] : '?';
    const rs = ar || row === '?' ? row : r >= 1 && r <= NR ? String(r) : '?';
    return ac + cs + ar + rs;
  });
  // cells a formula refers to (ranges expanded)
  function refsOf(f) {
    const out = [];
    const cell = (s) => { const m = /^\$?([A-E])\$?(\d+)$/.exec(s); return { r: +m[2] - 1, c: COLS.indexOf(m[1]) }; };
    const rest = f.replace(/(\$?[A-E]\$?\d+):(\$?[A-E]\$?\d+)/g, (m, x, y) => {
      const a = cell(x), b = cell(y);
      for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) {
        for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) out.push({ r, c });
      }
      return ' ';
    });
    (rest.match(/\$?[A-E]\$?\d+/g) || []).forEach((x) => out.push(cell(x)));
    return out.filter((x) => x.r >= 0 && x.r < NR);
  }
  // does the formula in (r0, c0) depend on itself?
  function isCircular(r0, c0) {
    const seen = new Set();
    const visit = (r, c) => {
      const cell = SS.cells[r][c];
      if (!cell || cell.f === null) return false;
      return refsOf(cell.f).some((x) => {
        if (x.r === r0 && x.c === c0) return true;
        const k = x.r * NC + x.c;
        if (seen.has(k)) return false;
        seen.add(k);
        return visit(x.r, x.c);
      });
    };
    return visit(r0, c0);
  }
  // after cells changed: Auto Calc recalculates everything, otherwise only the new formulas
  function changed(list) {
    if (ssCfg().autoCalc) { recalc(); return; }
    for (const [r, c] of list) {
      const cell = SS.cells[r][c];
      if (cell && cell.f !== null) { try { cell.v = tidy(evalFormula(cell.f, getNow)); } catch (e) { cell.v = NaN; } }
    }
  }
  const rangeCells = (rg) => {
    const out = [];
    for (let r = rg.r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) out.push([r, c]);
    return out;
  };
  // "B3:B6" or "B3" -> { r1, c1, r2, c2 } (null if invalid)
  function parseRange(str) {
    const m = /^\$?([A-E])\$?(\d+)(?::\$?([A-E])\$?(\d+))?$/.exec(str);
    if (!m) return null;
    const a = { r: +m[2] - 1, c: COLS.indexOf(m[1]) };
    const b = m[3] ? { r: +m[4] - 1, c: COLS.indexOf(m[3]) } : a;
    if ([a.r, b.r].some((r) => r < 0 || r >= NR)) return null;
    return { r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) };
  }
  // Fill Formula: the formula is written for the range's first cell, others are shifted
  function fillFormula(f, rg) {
    evalFormula(f, () => 1); // syntax check (throws)
    for (let r = rg.r1; r <= rg.r2; r++) {
      for (let c = rg.c1; c <= rg.c2; c++) SS.cells[r][c] = { f: shiftRefs(f, r - rg.r1, c - rg.c1), v: NaN };
    }
    changed(rangeCells(rg));
  }
  function fillValue(str, rg) {
    const v = tidy(evalFormula(str, getNow));
    for (let r = rg.r1; r <= rg.r2; r++) for (let c = rg.c1; c <= rg.c2; c++) SS.cells[r][c] = { f: null, v };
    changed([]);
  }
  // number -> formula-string form ("−1.5ᴇ−7")
  const numStr = (v) => String(v).replace(/e\+?/, 'ᴇ').replace(/-/g, '−');

  /* ----- line editor (bottom line / fill fields) ----- */
  const ED_MAIN = {
    add: '+', sub: '−', mul: '×', div: '÷', frac: '÷', neg: '−', open: '(', close: ')', dot: '.',
    sin: 'sin(', cos: 'cos(', tan: 'tan(', log: 'log(', ln: 'ln(', sqrt: '√(', sq: '²', pow: '^(',
    inv: '⁻¹', exp: 'ᴇ', ans: 'Ans',
  };
  const ED_SHIFT = {
    sin: 'sin⁻¹(', cos: 'cos⁻¹(', tan: 'tan⁻¹(', neg: 'log(', ln: 'e^(', log: '10^(', sq: '³',
    inv: '!', close: ',', exp: 'π', open: 'Abs(',
  };
  // ALPHA + (−) °'" x⁻¹ sin cos give the column letters A-E, ALPHA ∫ gives ':', ALPHA CALC '='
  const ED_ALPHA = { neg: 'A', dms: 'B', inv: 'C', sin: 'D', cos: 'E', integ: ':', calc: '=', exp: 'e' };
  const keyTok = (id, mods) => {
    if (mods.alpha) return ED_ALPHA[id] || null;
    if (mods.shift) return ED_SHIFT[id] || null;
    if (/^[0-9]$/.test(id)) return id;
    return ED_MAIN[id] || null;
  };
  // fresh: pre-filled text that the first typed token replaces (Fill dialog fields)
  const edNew = (str = '', fresh = false) => { const toks = lex(str); return { toks, cur: toks.length, fresh }; };
  // returns true when the key was used by the editor
  function edKey(ed, id, mods, allowEq) {
    if (['left', 'right', 'del'].includes(id)) ed.fresh = false;
    if (id === 'left') { ed.cur = Math.max(0, ed.cur - 1); return true; }
    if (id === 'right') { ed.cur = Math.min(ed.toks.length, ed.cur + 1); return true; }
    if (id === 'del' && !mods.shift && !mods.alpha) {
      if (ed.cur > 0) { ed.toks.splice(ed.cur - 1, 1); ed.cur--; }
      return true;
    }
    const tok = keyTok(id, mods);
    if (!tok) return false;
    if (tok === '=' && !(allowEq && ed.cur === 0 && ed.toks[0] !== '=')) return true;
    edIns(ed, tok);
    return true;
  }
  function edIns(ed, tok) {
    if (ed.fresh) { ed.toks = []; ed.cur = 0; ed.fresh = false; }
    ed.toks.splice(ed.cur, 0, tok);
    ed.cur++;
  }
  const TOK_HTML = { 'ᴇ': '<small>×10</small>', 'π': '<i>π</i>', 'e': '<i>e</i>' };
  const edHTML = (ed, editing) => {
    const t = ed.toks.map((x) => TOK_HTML[x] || x);
    if (editing) t.splice(ed.cur, 0, '<span class="cursor"></span>');
    return t.join('');
  };
  const edStr = (ed) => ed.toks.join('');

  /* ----- grid actions ----- */
  function ssMsg(text, back) { SS.msg = { text, back, prev: SS.mode }; SS.mode = 'msg'; }
  const errText = (e) => (typeof e === 'string' ? e : MATH);

  function ssScroll() {
    if (SS.r < SS.top) SS.top = SS.r;
    if (SS.r >= SS.top + VR) SS.top = SS.r - VR + 1;
    if (SS.c < SS.left) SS.left = SS.c;
    if (SS.c >= SS.left + VC) SS.left = SS.c - VC + 1;
  }
  function ssMove(dr, dc) {
    SS.r = Math.max(0, Math.min(NR - 1, SS.r + dr));
    SS.c = Math.max(0, Math.min(NC - 1, SS.c + dc));
    ssScroll();
  }

  // [=] in the cell editor: "=..." stores a live formula; anything else (7×5, sin30, A2+7)
  // is a constant: evaluated once, only the number is stored
  function ssCommit() {
    const str = edStr(SS.ed);
    if (!str || str === '=') { SS.ed = null; return; }
    const old = SS.cells[SS.r][SS.c];
    try {
      if (str[0] === '=') {
        const f = str.slice(1);
        evalFormula(f, () => 1); // syntax check
        SS.cells[SS.r][SS.c] = { f, v: NaN };
        if (isCircular(SS.r, SS.c)) { SS.cells[SS.r][SS.c] = old; throw 'Circular ERROR'; }
      } else SS.cells[SS.r][SS.c] = { f: null, v: tidy(evalFormula(str, getNow)) };
    } catch (e) {
      ssMsg(errText(e), () => {}); // back to the editor
      return;
    }
    SS.ed = null;
    changed([[SS.r, SS.c]]);
    ssMove(1, 0);
  }

  function ssPaste() {
    const { mode, r, c } = SS.clip;
    const src = SS.cells[r][c];
    let cell = src ? { ...src } : null;
    if (cell && cell.f !== null && mode === 'copy') cell.f = shiftRefs(cell.f, SS.r - r, SS.c - c);
    SS.cells[SS.r][SS.c] = cell;
    if (mode === 'cut') { if (r !== SS.r || c !== SS.c) SS.cells[r][c] = null; SS.clip = null; }
    changed([[SS.r, SS.c]]);
  }

  const cellName = (r, c) => COLS[c] + (r + 1);
  function ssFill(kind) {
    const here = cellName(SS.r, SS.c);
    const cell = SS.cells[SS.r][SS.c];
    const first = kind === 'formula' ? (cell && cell.f !== null ? cell.f : '') : '';
    SS.fill = { kind, field: 0, eds: [edNew(first, true), edNew(`${here}:${here}`, true)] };
    SS.mode = 'fill';
  }
  function ssFillRun() {
    const F = SS.fill;
    const rg = parseRange(edStr(F.eds[1]));
    if (!rg) { F.field = 1; ssMsg(SYNTAX, () => {}); return; }
    try {
      if (!F.eds[0].toks.length) throw SYNTAX;
      if (F.kind === 'formula') fillFormula(edStr(F.eds[0]), rg);
      else fillValue(edStr(F.eds[0]), rg);
    } catch (e) { F.field = 0; ssMsg(errText(e), () => {}); return; }
    SS.fill = null;
    SS.mode = 'grid';
  }
  function freeSpace() {
    let used = 0;
    SS.cells.forEach((row) => row.forEach((cell) => { if (cell) used += cell.f === null ? 10 : 10 + cell.f.length; }));
    return Math.max(0, 1700 - used);
  }

  // Min( Max( Mean( Sum( : insert into the open editor or start a new formula
  function ssInsAgg(tok) {
    if (SS.mode === 'fill') { const ed = SS.fill.eds[SS.fill.field]; edIns(ed, tok); return; }
    if (!SS.ed) SS.ed = edNew('=');
    edIns(SS.ed, tok);
  }
  const aggItems = () => Object.keys(AGG).map((k) => ({ label: k.slice(0, -1), act: () => ssInsAgg(k) }));
  function ssOptn() {
    if (SS.mode === 'fill') { openList([{ label: '$', act: () => ssInsAgg('$') }, ...aggItems()]); return; }
    if (SS.ed) {
      openList([
        { label: '$', act: () => ssInsAgg('$') },
        { label: 'Grab', act: () => { SS.grab = { r0: SS.r, c0: SS.c }; } },
        ...aggItems(),
      ]);
      return;
    }
    const cell = SS.cells[SS.r][SS.c];
    openList([
      { label: 'Fill Formula', act: () => ssFill('formula') },
      { label: 'Fill Value', act: () => ssFill('value') },
      { label: 'Edit Cell', act: () => { SS.ed = edNew(!cell ? '' : cell.f !== null ? '=' + cell.f : numStr(cell.v)); } },
      { label: 'Free Space', act: () => ssMsg(`Free Space:<br>${freeSpace()} bytes`, () => {}) },
      { label: 'Cut &amp; Paste', act: () => { SS.clip = { mode: 'cut', r: SS.r, c: SS.c }; } },
      { label: 'Copy &amp; Paste', act: () => { SS.clip = { mode: 'copy', r: SS.r, c: SS.c }; } },
      { label: 'Delete All', act: () => { SS.mode = 'confirm'; } },
      { label: 'Recalculate', act: recalc },
      ...aggItems(),
    ]);
  }

  // Grab: arrows pick a cell, [=] inserts its reference into the formula
  function grabKey(id) {
    const back = () => { SS.r = SS.grab.r0; SS.c = SS.grab.c0; SS.grab = null; ssScroll(); };
    if (id === 'up') ssMove(-1, 0);
    else if (id === 'down') ssMove(1, 0);
    else if (id === 'left') ssMove(0, -1);
    else if (id === 'right') ssMove(0, 1);
    else if (id === 'eq') { const name = cellName(SS.r, SS.c); back(); lex(name).forEach((t) => edIns(SS.ed, t)); }
    else if (id === 'ac') back();
  }

  function ssKey(id, mods) {
    if (SS.grab) { grabKey(id); return; }
    if (SS.mode === 'msg') {
      if (id === 'ac' || id === 'eq' || id === 'left' || id === 'right') { SS.mode = SS.msg.prev; SS.msg.back(); }
      return;
    }
    if (SS.mode === 'confirm') { // Delete All?
      if (id === 'eq') { SS.cells.forEach((row) => row.fill(null)); SS.clip = null; changed([]); }
      if (id === 'eq' || id === 'ac') SS.mode = 'grid';
      return;
    }
    if (id === 'ac' && mods.shift) { KEYS.ac.s[1](); return; } // OFF
    if (SS.mode === 'fill') {
      const F = SS.fill;
      if (id === 'ac') { SS.fill = null; SS.mode = 'grid'; }
      else if (id === 'up' || id === 'down') F.field = id === 'up' ? 0 : 1;
      else if (id === 'eq') { if (F.field === 0) F.field = 1; else ssFillRun(); }
      else if (id === 'optn') ssOptn();
      else edKey(F.eds[F.field], id, mods, false);
      return;
    }
    if (SS.ed) { // editing the current cell
      if (id === 'eq') ssCommit();
      else if (id === 'ac') SS.ed = null;
      else if (id === 'optn') ssOptn();
      else edKey(SS.ed, id, mods, true);
      return;
    }
    // grid navigation
    if (id === 'up') ssMove(-1, 0);
    else if (id === 'down') ssMove(1, 0);
    else if (id === 'left') ssMove(0, -1);
    else if (id === 'right') ssMove(0, 1);
    else if (id === 'optn') ssOptn();
    else if (id === 'ac') SS.clip = null;
    else if (id === 'eq') { if (SS.clip) ssPaste(); }
    else if (id === 'del' && !mods.shift && !mods.alpha) { SS.cells[SS.r][SS.c] = null; changed([]); }
    else {
      const tok = keyTok(id, mods);
      if (tok) { SS.ed = edNew(); edKey(SS.ed, id, mods, true); }
    }
  }

  function ssGridHTML() {
    const tpl = 'style="grid-template-columns: calc(44 * var(--s)) repeat(4, 1fr)"';
    const cols = Array.from({ length: VC }, (_, j) => SS.left + j);
    let h = `<div class="ss-row ss-h" ${tpl}><span></span>${cols.map((c) => `<span>${COLS[c]}</span>`).join('')}</div>`;
    for (let r = SS.top; r < SS.top + VR; r++) {
      h += `<div class="ss-row" ${tpl}><span>${r + 1}</span>`;
      for (const c of cols) {
        const cell = SS.cells[r][c];
        h += `<span${r === SS.r && c === SS.c ? ' class="on"' : ''}>${cell ? fitNum(cell.v, 6) : ''}</span>`;
      }
      h += '</div>';
    }
    h += `<div class="ss-sb"><b style="top:${(SS.top / NR) * 100}%;height:${(VR / NR) * 100}%"></b></div>`;
    // bottom line: editor, paste prompt, formula or value of the current cell
    const cell = SS.cells[SS.r][SS.c];
    let line = '', left = true;
    if (SS.grab) line = 'Set:[=]';
    else if (SS.ed) line = edHTML(SS.ed, true);
    else if (SS.clip) line = `${SS.clip.mode === 'cut' ? 'Cut' : 'Copy'} ${cellName(SS.clip.r, SS.clip.c)}: [=]Paste`;
    else if (cell && cell.f !== null && ssCfg().showCell !== 'value') line = edHTML(edNew('=' + cell.f), false);
    else if (cell && Number.isNaN(cell.v)) { line = 'ERROR'; left = false; }
    else if (cell) { line = plainNum(cell.v); left = false; }
    scrollCursor('#panel .ss-line');
    return `<div class="ss-grid">${h}</div><div class="ss-line${left ? ' l' : ''}">${line}</div>`;
  }
  function ssFillHTML() {
    const F = SS.fill;
    const lb = F.kind === 'formula' ? ['Fill Formula', 'Form =', 'Range :'] : ['Fill Value', 'Value:', 'Range :'];
    const fl = (k) => `<div class="ss-fl">${lb[k + 1]}${edHTML(F.eds[k], F.field === k)}</div>`;
    scrollCursor('#panel .ss-fl');
    return `<div class="ln">${lb[0]}</div>${fl(0)}${fl(1)}<div class="hint">[=] :Confirm</div>`;
  }

  registerApp('8', {
    name: 'Spreadsheet',
    enter() { S.screen = 'app'; SS.mode = 'grid'; SS.ed = SS.clip = SS.grab = null; if (ssCfg().autoCalc) recalc(); },
    key: ssKey,
    render() {
      if (SS.mode === 'msg') return msgHTML(SS.msg.text, '[AC] :Back');
      if (SS.mode === 'confirm') return '<div class="ln">Delete All Cells?</div><div class="ln"></div>'
        + '<div class="ln">[=] :Yes</div><div class="ln">[AC] :Cancel</div>';
      if (SS.mode === 'fill') return ssFillHTML();
      return ssGridHTML();
    },
    calcKey(id, mods) { S.screen = 'app'; ssKey(id, mods); return true; },
    test: { SS, evalFormula, recalc, fillFormula, isCircular, fillValue, parseRange, shiftRefs, fitNum, lex },
  });
})();
