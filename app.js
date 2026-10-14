(function () {
  'use strict';

  /* =====================================================================
     helpers
  ===================================================================== */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  };
  const clamp = (v, a, b, d) => { v = parseFloat(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
  const n2 = (v) => Math.round(v * 100) / 100;
  const hex2rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const rgb2hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const money = (v) => '$' + Math.round(v).toLocaleString('en-US');
  const fmtSens = (v) => (v >= 10 ? v.toFixed(2) : v >= 1 ? v.toFixed(3) : v.toFixed(4));

  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    if (/^(input|select|textarea)$/.test(tag) && !e.getAttribute('name')) {
      e.setAttribute('name', String(e.getAttribute('aria-label') || tag).toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    }
    (kids || []).forEach((c) => e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return e;
  }

  function coerce(def, src) {
    const out = {};
    Object.keys(def).forEach((k) => {
      const d = def[k], v = src ? src[k] : undefined;
      if (typeof d === 'boolean') out[k] = typeof v === 'boolean' ? v : d;
      else if (typeof d === 'number') { const f = parseFloat(v); out[k] = Number.isFinite(f) ? f : d; }
      else out[k] = typeof v === 'string' ? v : d;
    });
    return out;
  }

  /* =====================================================================
     theme: team (T / CT) and mode (dark / light). Default: dark + T.
  ===================================================================== */
  const root = document.documentElement;
  let team = store.get('cs2team', 't'); if (team !== 't' && team !== 'ct') team = 't';
  let mode = store.get('cs2mode', 'dark'); if (mode !== 'dark' && mode !== 'light') mode = 'dark';
  function applyTheme() {
    root.setAttribute('data-theme', team);
    root.setAttribute('data-mode', mode);
    root.style.colorScheme = mode;
    $('#themeBtn').textContent = team === 't' ? 'T side' : 'CT side';
    $('#modeBtn').textContent = mode === 'dark' ? 'Dark' : 'Light';
    $('#modeBtn').setAttribute('aria-pressed', mode === 'light' ? 'true' : 'false');
  }
  $('#themeBtn').addEventListener('click', () => { team = team === 't' ? 'ct' : 't'; store.set('cs2team', team); applyTheme(); });
  $('#modeBtn').addEventListener('click', () => { mode = mode === 'dark' ? 'light' : 'dark'; store.set('cs2mode', mode); applyTheme(); });
  applyTheme();

  /* =====================================================================
     state + validation
  ===================================================================== */
  const DEF = {
    X: { style: 4, size: 5, thick: 1, gap: -1, alpha: 255, color: '#3fe08a', outline: true, othick: 1, dot: false, t: false },
    A: { radar: true, rscale: 0.4, hrscale: 1.1, center: false, vm: false, fov: 68, ox: 2.5, oy: 0, oz: -1.5, bob: false, buy: true, swap: true, mute: true, fps: false, cross: false, binds: true },
    P: { round: 60, money: 60000, freeze: true, buy: true, nade: true, impact: true, botstop: true, binds: true },
    L: { exec: true, novid: true, console: false, high: false, fps: false, fpsval: 0 },
    S: { dpi: 800, game: 'cs2', sens: 1, yaw: 0.022, target: 30 },
    E: { money: 800, outcome: 'loss', streak: 1, planted: false, plant: 600, k100: 0, k300: 0, k600: 0, k900: 0, k1500: 0 }
  };
  const GAMES = {
    cs2: { name: 'Counter-Strike 2', yaw: 0.022 },
    valorant: { name: 'VALORANT', yaw: 0.07 },
    ow2: { name: 'Overwatch 2', yaw: 0.0066 },
    apex: { name: 'Apex Legends', yaw: 0.022 }
  };

  function cleanX(o) {
    const c = coerce(DEF.X, o);
    c.style = [1, 2, 3, 4].indexOf(Math.round(c.style)) >= 0 ? Math.round(c.style) : 4;
    c.size = clamp(c.size, 0, 15, 5); c.thick = clamp(c.thick, 0, 6, 1); c.gap = clamp(c.gap, -8, 8, -1);
    c.alpha = Math.round(clamp(c.alpha, 0, 255, 255)); c.othick = clamp(c.othick, 0, 3, 1);
    if (!/^#[0-9a-f]{6}$/i.test(c.color)) c.color = DEF.X.color;
    return c;
  }
  function cleanA(o) {
    const c = coerce(DEF.A, o);
    c.rscale = clamp(c.rscale, 0.2, 1, 0.4); c.hrscale = clamp(c.hrscale, 0.8, 1.3, 1.1);
    c.fov = Math.round(clamp(c.fov, 54, 68, 68)); c.ox = clamp(c.ox, -2.5, 2.5, 2.5); c.oy = clamp(c.oy, -2, 2, 0); c.oz = clamp(c.oz, -2, 2, -1.5);
    return c;
  }
  function cleanP(o) {
    const c = coerce(DEF.P, o);
    c.round = Math.round(clamp(c.round, 1, 60, 60)); c.money = Math.round(clamp(c.money, 800, 60000, 60000));
    return c;
  }
  function cleanL(o) { const c = coerce(DEF.L, o); c.fpsval = Math.round(clamp(c.fpsval, 0, 1000, 0)); return c; }
  function cleanS(o) {
    const c = coerce(DEF.S, o);
    c.dpi = clamp(c.dpi, 100, 32000, 800); c.sens = clamp(c.sens, 0.001, 100, 1); c.yaw = clamp(c.yaw, 0.0001, 1, 0.022); c.target = clamp(c.target, 1, 500, 30);
    if (c.game !== 'custom' && !GAMES[c.game]) c.game = 'cs2';
    return c;
  }
  function cleanE(o) {
    const c = coerce(DEF.E, o);
    c.money = clamp(c.money, 0, 16000, 800); c.streak = Math.round(clamp(c.streak, 1, 5, 1)); c.plant = clamp(c.plant, 0, 2000, 600);
    ['k100', 'k300', 'k600', 'k900', 'k1500'].forEach((k) => { c[k] = Math.round(clamp(c[k], 0, 5, 0)); });
    if (['win_elim', 'win_bomb', 'loss'].indexOf(c.outcome) < 0) c.outcome = 'loss';
    return c;
  }

  let X = cleanX(store.get('cs2x', {}));
  let A = cleanA(store.get('cs2a', {}));
  let P = cleanP(store.get('cs2p', {}));
  let L = cleanL(store.get('cs2l', {}));
  let S = cleanS(store.get('cs2s', {}));
  let E = cleanE(store.get('cs2e', {}));

  /* ---------- share link decode (#x=...). Not saved until you edit. ---------- */
  function b64enc(str) { return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64dec(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; return atob(str); }
  const hashParams = new URLSearchParams(location.hash.slice(1));
  let loadedFromLink = false;
  if (hashParams.has('x')) {
    try { X = cleanX(JSON.parse(b64dec(hashParams.get('x')))); loadedFromLink = true; } catch (e) { /* ignore bad link */ }
  }

  /* =====================================================================
     generic binding between state objects and form controls
  ===================================================================== */
  function labelVal(e) { return document.querySelector('label[for="' + e.id + '"] .val'); }
  function pushToUI(obj, prefix) {
    Object.keys(obj).forEach((k) => {
      const e = $('#' + prefix + '_' + k); if (!e) return;
      if (e.type === 'checkbox') e.checked = !!obj[k]; else e.value = obj[k];
      const s = labelVal(e); if (s) s.textContent = obj[k];
    });
  }
  function bindAll(getObj, setObj, prefix, storeKey, clean, render) {
    Object.keys(DEF[prefix.toUpperCase()]).forEach((k) => {
      const e = $('#' + prefix + '_' + k); if (!e) return;
      e.addEventListener('input', () => {
        const obj = getObj(), cur = obj[k];
        let v;
        if (typeof cur === 'boolean') v = e.checked;
        else if (typeof cur === 'number') { v = parseFloat(e.value); if (!Number.isFinite(v)) return; }
        else v = e.value;
        const next = clean(Object.assign({}, obj, { [k]: v }));
        setObj(next);
        const s = labelVal(e); if (s) s.textContent = next[k];
        store.set(storeKey, next);
        render();
      });
    });
    pushToUI(getObj(), prefix);
  }

  /* =====================================================================
     CROSSHAIR
  ===================================================================== */
  const PRESETS = {
    classic: { style: 4, size: 5, thick: 1, gap: -1, alpha: 255, color: '#3fe08a', outline: true, othick: 1, dot: false, t: false },
    dot: { style: 4, size: 0, thick: 1, gap: 0, alpha: 255, color: '#ffffff', outline: true, othick: 1, dot: true, t: false },
    tiny: { style: 4, size: 2, thick: 1, gap: -2, alpha: 255, color: '#00e5ff', outline: true, othick: 0.5, dot: false, t: false },
    tcross: { style: 4, size: 4, thick: 1, gap: -1, alpha: 255, color: '#f5e050', outline: true, othick: 1, dot: false, t: true },
    big: { style: 4, size: 8, thick: 2, gap: 0, alpha: 255, color: '#ffe14d', outline: true, othick: 1, dot: false, t: false },
    minimal: { style: 4, size: 3, thick: 0.5, gap: -3, alpha: 255, color: '#ffffff', outline: false, othick: 0, dot: false, t: false }
  };
  const COLOR_IDX = ['#ff0000', '#00ff00', '#ffff00', '#0000ff', '#00ffff'];

  function crossCommands(x) {
    x = x || X;
    const c = hex2rgb(x.color);
    return [
      'cl_crosshairstyle ' + x.style,
      'cl_crosshairsize ' + n2(x.size),
      'cl_crosshairthickness ' + n2(x.thick),
      'cl_crosshairgap ' + n2(x.gap),
      'cl_crosshair_drawoutline ' + (x.outline ? 1 : 0),
      'cl_crosshair_outlinethickness ' + n2(x.othick),
      'cl_crosshaircolor 5',
      'cl_crosshaircolor_r ' + c[0],
      'cl_crosshaircolor_g ' + c[1],
      'cl_crosshaircolor_b ' + c[2],
      'cl_crosshairalpha ' + x.alpha,
      'cl_crosshairdot ' + (x.dot ? 1 : 0),
      'cl_crosshair_t ' + (x.t ? 1 : 0)
    ];
  }

  function parseCross(text) {
    const o = Object.assign({}, X);
    const map = {
      cl_crosshairstyle: 'style', cl_crosshairsize: 'size', cl_crosshairthickness: 'thick', cl_crosshairgap: 'gap',
      cl_crosshair_drawoutline: 'outline', cl_crosshair_outlinethickness: 'othick', cl_crosshairalpha: 'alpha',
      cl_crosshairdot: 'dot', cl_crosshair_t: 't'
    };
    const bools = { outline: 1, dot: 1, t: 1 };
    let found = 0, idx = null; const rgb = { r: null, g: null, b: null };
    text.split(/[\n;]/).forEach((raw) => {
      const line = raw.replace(/\/\/.*$/, '').trim(); if (!line) return;
      const m = line.match(/^([a-z_]+)\s+"?(-?\d*\.?\d+)"?$/i); if (!m) return;
      const k = m[1].toLowerCase(), v = parseFloat(m[2]); if (!Number.isFinite(v)) return;
      if (map[k]) { o[map[k]] = bools[map[k]] ? v !== 0 : v; found++; }
      else if (k === 'cl_crosshaircolor') { idx = v; found++; }
      else if (k === 'cl_crosshaircolor_r') { rgb.r = v; found++; }
      else if (k === 'cl_crosshaircolor_g') { rgb.g = v; found++; }
      else if (k === 'cl_crosshaircolor_b') { rgb.b = v; found++; }
    });
    if (rgb.r !== null && rgb.g !== null && rgb.b !== null) o.color = rgb2hex(rgb.r, rgb.g, rgb.b);
    else if (idx !== null && idx >= 0 && idx <= 4) o.color = COLOR_IDX[Math.round(idx)];
    return { found: found, crosshair: cleanX(o) };
  }

  /* ---- drawing (shared by preview and aim trainer) ---- */
  function drawCrosshairOn(g, cx, cy, spread, scale) {
    const s = scale || 5;
    const len = X.size * s, th = Math.max(1, X.thick * s * 0.6);
    const gap = Math.max(0, (X.gap + 4) * s * 0.6) + th / 2 + (spread || 0);
    const ot = X.outline ? Math.max(1, X.othick * s * 0.4) : 0;
    const rgb = hex2rgb(X.color), a = X.alpha / 255;
    const bars = [];
    if (len > 0) {
      bars.push([cx - gap - len, cy - th / 2, len, th]);
      bars.push([cx + gap, cy - th / 2, len, th]);
      bars.push([cx - th / 2, cy + gap, th, len]);
      if (!X.t) bars.push([cx - th / 2, cy - gap - len, th, len]);
    }
    if (X.dot) bars.push([cx - th / 2, cy - th / 2, th, th]);
    if (ot) { g.fillStyle = 'rgba(0,0,0,' + a + ')'; bars.forEach((b) => g.fillRect(b[0] - ot, b[1] - ot, b[2] + ot * 2, b[3] + ot * 2)); }
    g.fillStyle = 'rgba(' + rgb.join(',') + ',' + a + ')';
    bars.forEach((b) => g.fillRect(b[0], b[1], b[2], b[3]));
  }

  let bgMode = 'dark';
  function paintBg(g, W, H) {
    if (bgMode === 'light') { g.fillStyle = '#d8dde3'; g.fillRect(0, 0, W, H); }
    else if (bgMode === 'sky') { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#6fb1e6'); gr.addColorStop(1, '#cfe6f7'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    else if (bgMode === 'wall') {
      g.fillStyle = '#b79a6b'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(0,0,0,.12)';
      for (let i = 0; i < W; i += 40) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, H); g.stroke(); }
      for (let j = 0; j < H; j += 40) { g.beginPath(); g.moveTo(0, j); g.lineTo(W, j); g.stroke(); }
    } else if (bgMode === 'dust') {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#e2cf9f'); gr.addColorStop(1, '#bfa56f'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(90,70,40,.25)'; g.fillRect(0, H * 0.62, W, H * 0.38);
      g.fillStyle = 'rgba(60,45,25,.35)'; g.fillRect(W * 0.12, H * 0.28, W * 0.22, H * 0.34); g.fillRect(W * 0.66, H * 0.2, W * 0.2, H * 0.42);
    } else { g.fillStyle = '#10151c'; g.fillRect(0, 0, W, H); }
  }

  let previewRaf = 0;
  function drawPreview(ts) {
    const cv = $('#cv'); if (!cv) return;
    const g = cv.getContext('2d');
    paintBg(g, cv.width, cv.height);
    const bloom = $('#x_bloom').checked && X.style === 3;
    const spread = bloom ? 9 * Math.abs(Math.sin((ts || 0) / 260)) : 0;
    drawCrosshairOn(g, cv.width / 2, cv.height / 2, spread, 5);
    $('#x_out').value = crossCommands().join('\n');
    cancelAnimationFrame(previewRaf);
    if (bloom && !$('#cross').hidden) previewRaf = requestAnimationFrame(drawPreview);
  }

  /* =====================================================================
     BUY CATALOG + SLOTS
  ===================================================================== */
  const CATALOG = [
    { g: 'Rifles', items: [['AK-47', 'ak47', 2700], ['M4A4', 'm4a1', 3100], ['M4A1-S', 'm4a1_silencer', 2900], ['Galil AR', 'galilar', 1800], ['FAMAS', 'famas', 1950], ['AUG', 'aug', 3300], ['SG 553', 'sg556', 3000], ['SSG 08', 'ssg08', 1700], ['AWP', 'awp', 4750]] },
    { g: 'SMGs', items: [['MAC-10', 'mac10', 1050], ['MP9', 'mp9', 1250], ['MP7', 'mp7', 1500], ['MP5-SD', 'mp5sd', 1500], ['UMP-45', 'ump45', 1200], ['P90', 'p90', 2350], ['PP-Bizon', 'bizon', 1400]] },
    { g: 'Pistols', items: [['Dual Berettas', 'elite', 300], ['P250', 'p250', 300], ['Tec-9', 'tec9', 500], ['Five-SeveN', 'fn57', 500], ['CZ75-Auto', 'cz75a', 500], ['Desert Eagle', 'deagle', 700], ['R8 Revolver', 'revolver', 600], ['P2000 / USP-S', 'hkp2000', 200]] },
    { g: 'Heavy', items: [['Nova', 'nova', 1050], ['XM1014', 'xm1014', 2000], ['MAG-7', 'mag7', 1300], ['Sawed-Off', 'sawedoff', 1100], ['M249', 'm249', 5200], ['Negev', 'negev', 1700]] },
    { g: 'Equipment', items: [['Kevlar', 'vest', 650], ['Kevlar + Helmet', 'vesthelm', 1000], ['Defuse kit', 'defuser', 400], ['Zeus x27', 'taser', 200]] },
    { g: 'Grenades', items: [['HE grenade', 'hegrenade', 300], ['Flashbang', 'flashbang', 200], ['Smoke', 'smokegrenade', 300], ['Decoy', 'decoy', 50], ['Molotov', 'molotov', 400], ['Incendiary', 'incgrenade', 600]] }
  ];
  const ITEM = {};
  CATALOG.forEach((grp) => grp.items.forEach((i) => { ITEM[i[1]] = { name: i[0], cmd: i[1], price: i[2] }; }));

  function cleanSlots(arr) {
    const d = [{ key: 'F1', items: ['vesthelm', 'hegrenade', 'flashbang', 'smokegrenade'] }, { key: 'F2', items: [] }, { key: 'F3', items: [] }];
    if (!Array.isArray(arr)) return d;
    return d.map((def, i) => {
      const s = arr[i] || {};
      const key = typeof s.key === 'string' && /^[A-Za-z0-9_]{1,12}$/.test(s.key) ? s.key : def.key;
      const items = (Array.isArray(s.items) ? s.items : def.items).filter((c) => typeof c === 'string' && ITEM[c]).slice(0, 20);
      return { key: key, items: items };
    });
  }
  let B = cleanSlots(store.get('cs2b', null));

  function renderSlots() {
    const box = $('#slots'); box.textContent = '';
    B.forEach((slot, i) => {
      const keyIn = h('input', { type: 'text', maxlength: '12', 'aria-label': 'Key for slot ' + (i + 1), value: slot.key });
      keyIn.addEventListener('input', () => {
        const v = keyIn.value.trim();
        if (/^[A-Za-z0-9_]{1,12}$/.test(v)) { B[i].key = v; store.set('cs2b', B); renderAuto(); }
      });
      const sel = h('select', { 'aria-label': 'Add item to slot ' + (i + 1) });
      sel.appendChild(h('option', { value: '', text: 'Add item...' }));
      CATALOG.forEach((grp) => {
        const og = h('optgroup', { label: grp.g });
        grp.items.forEach((it) => og.appendChild(h('option', { value: it[1], text: it[0] + ' (' + money(it[2]) + ')' })));
        sel.appendChild(og);
      });
      sel.addEventListener('change', () => {
        if (sel.value && ITEM[sel.value] && B[i].items.length < 20) { B[i].items.push(sel.value); store.set('cs2b', B); renderSlots(); renderAuto(); }
      });
      const chips = h('div', { class: 'chips' });
      let total = 0;
      slot.items.forEach((c, idx) => {
        total += ITEM[c].price;
        const rm = h('button', { type: 'button', 'aria-label': 'Remove ' + ITEM[c].name, text: '×' });
        rm.addEventListener('click', () => { B[i].items.splice(idx, 1); store.set('cs2b', B); renderSlots(); renderAuto(); });
        chips.appendChild(h('span', { class: 'tag' }, [ITEM[c].name, rm]));
      });
      box.appendChild(h('div', { class: 'slot' }, [
        h('div', { class: 'top' }, [keyIn, sel]),
        chips,
        h('div', { class: 'price', text: 'Total: ' + money(total) })
      ]));
    });
  }

  /* =====================================================================
     AUTOEXEC / PRACTICE / LAUNCH text
  ===================================================================== */
  function autoexecText() {
    const o = ['// cs2-config lab / autoexec.cfg', '// https://github.com/0xrcph/cs2-config', '', 'echo "[cs2-config] loading autoexec..."', ''];
    if (A.radar) o.push('// Radar', 'cl_radar_scale ' + n2(A.rscale), 'cl_hud_radar_scale ' + n2(A.hrscale), 'cl_radar_always_centered ' + (A.center ? 1 : 0), '');
    if (A.vm) {
      o.push('// Viewmodel', 'viewmodel_fov ' + A.fov, 'viewmodel_offset_x ' + n2(A.ox), 'viewmodel_offset_y ' + n2(A.oy), 'viewmodel_offset_z ' + n2(A.oz));
      if (A.bob) o.push('cl_bob_lower_amt 5');
      o.push('');
    } else if (A.bob) o.push('// Weapon bob', 'cl_bob_lower_amt 5', '');
    const q = [];
    if (A.buy) q.push('cl_use_opens_buy_menu 0');
    if (A.swap) q.push('cl_autowepswitch 0');
    if (A.mute) q.push('snd_mute_losefocus 0');
    if (A.fps) q.push('cl_showfps 1');
    if (q.length) o.push.apply(o, ['// Quality of life'].concat(q, ['']));
    if (A.cross) o.push.apply(o, ['// Crosshair'].concat(crossCommands(), ['']));
    if (A.binds) {
      const lines = B.filter((s) => s.items.length).map((s) => 'bind "' + s.key + '" "' + s.items.map((c) => 'buy ' + c).join('; ') + '"');
      if (lines.length) o.push.apply(o, ['// Buy binds'].concat(lines, ['']));
    }
    o.push('echo "[cs2-config] done."');
    return o.join('\n') + '\n';
  }
  function practiceText() {
    const o = ['// cs2-config lab / practice.cfg', '// OFFLINE only. sv_cheats does not work on official servers.', '', 'echo "[cs2-config] loading practice..."', '', 'sv_cheats 1', 'mp_warmup_end'];
    o.push('mp_roundtime ' + P.round, 'mp_roundtime_defuse ' + P.round, 'mp_roundtime_hostage ' + P.round);
    if (P.freeze) o.push('mp_freezetime 0');
    o.push('mp_startmoney ' + P.money, 'mp_maxmoney ' + P.money);
    if (P.buy) o.push('mp_buytime 9999', 'mp_buy_anywhere 1');
    o.push('mp_autoteambalance 0', 'mp_limitteams 0', '');
    if (P.nade) o.push('sv_infinite_ammo 1', 'ammo_grenade_limit_total 5', 'sv_grenade_trajectory_prac_pipreview 1', 'sv_grenade_trajectory_prac_trailtime 5', '');
    if (P.impact) o.push('sv_showimpacts 1', '');
    if (P.botstop) o.push('bot_stop 1');
    o.push('bot_kick', '');
    if (P.binds) {
      o.push('alias rr "mp_restartgame 1"', 'alias bots "bot_kick; bot_add_t; bot_add_ct"', 'alias freeze "bot_stop 1"', 'alias unfreeze "bot_stop 0"', '',
        'bind "n" "noclip"', 'bind "k" "sv_rethrow_last_grenade"', 'bind "l" "impulse 101"', 'bind "o" "exec practice"', '');
    }
    o.push('mp_restartgame 1', 'echo "[cs2-config] practice mode on."');
    return o.join('\n') + '\n';
  }
  function launchText() {
    const o = [];
    if (L.exec) o.push('+exec autoexec');
    if (L.novid) o.push('-novid');
    if (L.console) o.push('-console');
    if (L.high) o.push('-high');
    if (L.fps) o.push('+fps_max ' + L.fpsval);
    return o.join(' ');
  }
  function renderAuto() { $('#a_out').value = autoexecText(); }
  function renderPrac() { $('#p_out').value = practiceText(); }
  function renderLaunch() { $('#l_out').value = launchText(); }

  /* =====================================================================
     SENSITIVITY
  ===================================================================== */
  function curYaw() { return S.game === 'custom' ? S.yaw : GAMES[S.game].yaw; }
  function renderSens() {
    $('#s_customwrap').hidden = S.game !== 'custom';
    const yaw = curYaw(), cm = 360 * 2.54 / (S.dpi * S.sens * yaw);
    $('#o_edpi').textContent = Math.round(S.dpi * S.sens * 100) / 100;
    $('#o_cm').textContent = cm.toFixed(1);
    $('#o_in').textContent = (cm / 2.54).toFixed(1);
    $('#o_need').textContent = fmtSens(360 * 2.54 / (S.dpi * yaw * S.target));
    const body = $('#conv'); body.textContent = '';
    Object.keys(GAMES).forEach((k) => {
      const val = S.sens * yaw / GAMES[k].yaw;
      body.appendChild(h('tr', {}, [h('td', { text: GAMES[k].name + (k === S.game ? '  (selected)' : '') }), h('td', { class: 'num', text: fmtSens(val) })]));
    });
  }

  /* =====================================================================
     ECONOMY
  ===================================================================== */
  const LADDER = [1400, 1900, 2400, 2900, 3400];
  function renderEco() {
    $('#e_lossbox').hidden = E.outcome !== 'loss';
    const lines = []; let gain = 0;
    if (E.outcome === 'win_elim') { gain += 3250; lines.push('Round win: ' + money(3250)); }
    else if (E.outcome === 'win_bomb') { gain += 3500; lines.push('Round win by bomb: ' + money(3500)); }
    else {
      const b = LADDER[Math.min(E.streak, 5) - 1]; gain += b; lines.push('Loss bonus (' + (E.streak >= 5 ? '5+' : E.streak) + '): ' + money(b));
      if (E.planted) { gain += E.plant; lines.push('Plant bonus: ' + money(E.plant)); }
    }
    [[100, E.k100], [300, E.k300], [600, E.k600], [900, E.k900], [1500, E.k1500]].forEach((p) => {
      if (p[1] > 0) { gain += p[0] * p[1]; lines.push(p[1] + ' kill' + (p[1] > 1 ? 's' : '') + ' at ' + money(p[0]) + ': ' + money(p[0] * p[1])); }
    });
    const next = Math.min(16000, E.money + gain);
    $('#o_next').textContent = money(next);
    const ul = $('#o_break'); ul.textContent = '';
    lines.push('Starting money: ' + money(E.money));
    if (E.money + gain > 16000) lines.push('Capped at $16,000');
    lines.forEach((l) => ul.appendChild(h('li', { text: l })));
    renderLoadout();
  }
  const qty = {};
  function buildLoadout() {
    const box = $('#loadout'); box.textContent = '';
    CATALOG.forEach((grp) => {
      box.appendChild(h('h2', { class: 'sub', text: grp.g }));
      grp.items.forEach((it) => {
        const inp = h('input', { type: 'number', min: '0', max: '9', step: '1', value: '0', 'aria-label': it[0] + ' quantity', style: 'width:64px' });
        inp.addEventListener('input', () => { qty[it[1]] = Math.max(0, Math.min(9, Math.round(parseFloat(inp.value) || 0))); renderLoadout(); });
        box.appendChild(h('div', { class: 'row', style: 'justify-content:space-between;margin:4px 0' }, [
          h('span', { text: it[0] }), h('span', { class: 'hint', text: money(it[2]) }), inp
        ]));
      });
    });
  }
  function renderLoadout() {
    let total = 0; Object.keys(qty).forEach((k) => { if (ITEM[k]) total += ITEM[k].price * qty[k]; });
    $('#lo_total').textContent = money(total);
    const left = E.money - total;
    $('#lo_left').textContent = (left < 0 ? '-' : '') + money(Math.abs(left));
    $('#lo_left').parentNode.classList.toggle('bad', left < 0);
  }

  /* =====================================================================
     AIM LAB
  ===================================================================== */
  const AIM_MODES = { classic: { rmin: 24, rmax: 36, life: 1600 }, flick: { rmin: 18, rmax: 26, life: 950 }, precision: { rmin: 10, rmax: 15, life: 1900 } };
  const aimCv = $('#aim'), aimG = aimCv.getContext('2d'), AW = aimCv.width, AH = aimCv.height;
  const aim = { run: false, end: 0, score: 0, hits: 0, miss: 0, rts: [], tg: null, mx: AW / 2, my: AH / 2, fx: [], raf: 0, mode: 'classic', msg: '' };
  let audioCtx = null;
  function beep(freq, dur) {
    if (!$('#aim_sound').checked) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), gn = audioCtx.createGain();
      o.frequency.value = freq; gn.gain.value = 0.05; o.connect(gn); gn.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + dur);
    } catch (e) { /* audio unavailable */ }
  }
  function aimBest() { return store.get('cs2aim', {}); }
  function aimModeValue() { const v = $('#aim_mode').value; return AIM_MODES[v] ? v : 'classic'; }
  function refreshAimStats(now) {
    const left = aim.run ? Math.max(0, (aim.end - now) / 1000) : 30;
    $('#aim_time').textContent = left.toFixed(1);
    $('#aim_score').textContent = aim.score;
    const tot = aim.hits + aim.miss;
    $('#aim_acc').textContent = tot ? Math.round(aim.hits / tot * 100) + '%' : '-';
    $('#aim_rt').textContent = aim.rts.length ? Math.round(aim.rts.reduce((a, b) => a + b, 0) / aim.rts.length) + ' ms' : '-';
    const b = aimBest()[aim.mode];
    $('#aim_best').textContent = b ? b : '-';
  }
  function aimBackground() {
    aimG.fillStyle = '#0c1118'; aimG.fillRect(0, 0, AW, AH);
    aimG.strokeStyle = 'rgba(255,255,255,.05)';
    for (let i = 0; i < AW; i += 45) { aimG.beginPath(); aimG.moveTo(i, 0); aimG.lineTo(i, AH); aimG.stroke(); }
    for (let j = 0; j < AH; j += 45) { aimG.beginPath(); aimG.moveTo(0, j); aimG.lineTo(AW, j); aimG.stroke(); }
  }
  function aimIdle() {
    if (aim.run) return;
    aimBackground();
    aimG.fillStyle = '#e6edf3'; aimG.font = '700 22px ui-monospace, Consolas, monospace'; aimG.textAlign = 'center';
    aimG.fillText(aim.msg || 'Press Start to begin', AW / 2, AH / 2 - 8);
    aimG.fillStyle = '#8b98a5'; aimG.font = '14px ui-monospace, Consolas, monospace';
    aimG.fillText('Mode: ' + aim.mode + '  |  30 seconds', AW / 2, AH / 2 + 22);
    drawCrosshairOn(aimG, aim.mx, aim.my, 0, 5);
    refreshAimStats(0);
  }
  function aimSpawn(now) {
    const m = AIM_MODES[aim.mode], r = m.rmin + Math.random() * (m.rmax - m.rmin);
    aim.tg = { x: r + Math.random() * (AW - 2 * r), y: r + Math.random() * (AH - 2 * r), r: r, born: now, life: m.life };
  }
  function aimFrame(now) {
    if (!aim.run) return;
    if (now >= aim.end) { aimFinish(); return; }
    if (now - aim.tg.born > aim.tg.life) { aim.miss++; aimSpawn(now); }
    aimBackground();
    const tg = aim.tg, f = 1 - 0.45 * ((now - tg.born) / tg.life), r = tg.r * f;
    [[1, '#e8e8e8'], [0.72, '#e23b3b'], [0.45, '#e8e8e8'], [0.2, '#e23b3b']].forEach((p) => {
      aimG.beginPath(); aimG.arc(tg.x, tg.y, r * p[0], 0, Math.PI * 2); aimG.fillStyle = p[1]; aimG.fill();
    });
    aim.fx = aim.fx.filter((e) => now - e.t0 < 350);
    aim.fx.forEach((e) => {
      const p = (now - e.t0) / 350;
      aimG.beginPath(); aimG.arc(e.x, e.y, 10 + p * 34, 0, Math.PI * 2);
      aimG.strokeStyle = e.hit ? 'rgba(63,224,138,' + (1 - p) + ')' : 'rgba(255,95,86,' + (1 - p) + ')'; aimG.lineWidth = 3; aimG.stroke();
    });
    drawCrosshairOn(aimG, aim.mx, aim.my, 0, 5);
    refreshAimStats(now);
    aim.raf = requestAnimationFrame(aimFrame);
  }
  function aimStart() {
    cancelAnimationFrame(aim.raf);
    aim.mode = aimModeValue();
    Object.assign(aim, { run: true, score: 0, hits: 0, miss: 0, rts: [], fx: [], msg: '' });
    const now = performance.now(); aim.end = now + 30000; aimSpawn(now);
    aimCv.classList.add('playing');
    aim.raf = requestAnimationFrame(aimFrame);
  }
  function aimFinish() {
    aim.run = false; cancelAnimationFrame(aim.raf); aimCv.classList.remove('playing');
    const tot = aim.hits + aim.miss, acc = tot ? Math.round(aim.hits / tot * 100) : 0;
    const avg = aim.rts.length ? Math.round(aim.rts.reduce((a, b) => a + b, 0) / aim.rts.length) : 0;
    const best = aimBest(); let isBest = false;
    if (!best[aim.mode] || aim.score > best[aim.mode]) { best[aim.mode] = aim.score; store.set('cs2aim', best); isBest = true; }
    aim.msg = 'Score ' + aim.score + '  |  ' + acc + '% accuracy  |  ' + avg + ' ms' + (isBest ? '  |  NEW BEST' : '');
    aimIdle(); beep(660, 0.25);
  }
  function aimPoint(e) {
    const r = aimCv.getBoundingClientRect();
    aim.mx = (e.clientX - r.left) * AW / r.width; aim.my = (e.clientY - r.top) * AH / r.height;
  }
  aimCv.addEventListener('pointermove', (e) => { aimPoint(e); if (!aim.run) aimIdle(); });
  aimCv.addEventListener('pointerdown', (e) => {
    aimPoint(e); if (!aim.run) return;
    const now = performance.now(), tg = aim.tg, f = 1 - 0.45 * ((now - tg.born) / tg.life), r = tg.r * f;
    if (Math.hypot(aim.mx - tg.x, aim.my - tg.y) <= r) {
      const rt = now - tg.born; aim.hits++; aim.rts.push(rt);
      aim.score += Math.round(Math.max(20, 150 - rt / 8));
      aim.fx.push({ x: tg.x, y: tg.y, t0: now, hit: true }); beep(880, 0.05); aimSpawn(now);
    } else {
      aim.miss++; aim.score = Math.max(0, aim.score - 15); aim.fx.push({ x: aim.mx, y: aim.my, t0: now, hit: false }); beep(180, 0.06);
    }
  });
  $('#aim_start').addEventListener('click', aimStart);
  $('#aim_mode').addEventListener('change', () => { if (!aim.run) { aim.mode = aimModeValue(); aim.msg = ''; aimIdle(); } });

  /* ---- reaction test ---- */
  const rtEl = $('#rt'); let rtState = 'idle', rtTimer = 0, rtStart = 0;
  function rtBest() { return store.get('cs2rt', null); }
  function rtShowBest() { const b = rtBest(); $('#rt_best').textContent = 'Best: ' + (b ? b + ' ms' : '-'); }
  function rtClick() {
    if (rtState === 'idle') {
      rtState = 'wait'; rtEl.className = 'rt wait'; rtEl.textContent = 'Wait for green...';
      rtTimer = setTimeout(() => { rtState = 'go'; rtEl.className = 'rt go'; rtEl.textContent = 'CLICK!'; rtStart = performance.now(); }, 1500 + Math.random() * 3000);
    } else if (rtState === 'wait') {
      clearTimeout(rtTimer); rtState = 'idle'; rtEl.className = 'rt'; rtEl.textContent = 'Too early! Click to try again';
    } else {
      const ms = Math.round(performance.now() - rtStart); rtState = 'idle'; rtEl.className = 'rt'; rtEl.textContent = ms + ' ms. Click to try again';
      const b = rtBest(); if (!b || ms < b) store.set('cs2rt', ms);
      rtShowBest();
    }
  }
  rtEl.addEventListener('pointerdown', rtClick);
  rtEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rtClick(); } });
  rtShowBest();

  /* =====================================================================
     WARM-UP PLANNER
  ===================================================================== */
  function cleanWarm(o) {
    const d = [{ name: 'Aim lab', min: 3 }, { name: 'Deathmatch', min: 10 }, { name: 'Nade lineups', min: 5 }, { name: 'Spray control', min: 3 }];
    if (!Array.isArray(o)) return d;
    const out = o.slice(0, 12).map((s) => ({ name: String((s && s.name) || 'Step').slice(0, 40), min: clamp(s && s.min, 0.5, 120, 5) }));
    return out.length ? out : d;
  }
  let W = cleanWarm(store.get('cs2w', null));
  const wr = { run: false, idx: 0, remain: 0, last: 0, timer: 0 };
  function fmtTime(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); }
  function renderWarmList() {
    const box = $('#w_list'); box.textContent = '';
    W.forEach((s, i) => {
      const name = h('input', { type: 'text', value: s.name, maxlength: '40', 'aria-label': 'Step ' + (i + 1) + ' name' });
      name.addEventListener('input', () => { W[i].name = name.value.slice(0, 40) || 'Step'; store.set('cs2w', W); renderWarmTotal(); });
      const min = h('input', { type: 'number', min: '0.5', max: '120', step: '0.5', value: String(s.min), 'aria-label': 'Step ' + (i + 1) + ' minutes', style: 'width:80px' });
      min.addEventListener('input', () => { W[i].min = clamp(min.value, 0.5, 120, 5); store.set('cs2w', W); renderWarmTotal(); });
      const rm = h('button', { type: 'button', class: 'chip', 'aria-label': 'Remove step ' + (i + 1), text: 'Remove' });
      rm.addEventListener('click', () => { if (W.length > 1) { W.splice(i, 1); store.set('cs2w', W); renderWarmList(); } });
      box.appendChild(h('div', { class: 'row', style: 'margin:6px 0;flex-wrap:nowrap' }, [name, min, h('span', { class: 'hint', text: 'min' }), rm]));
    });
    renderWarmTotal();
  }
  function renderWarmTotal() { const t = W.reduce((a, s) => a + s.min, 0); $('#w_total').textContent = 'Total: ' + (Math.round(t * 10) / 10) + ' min'; }
  function warmShow() {
    const s = W[Math.min(wr.idx, W.length - 1)];
    $('#w_now').textContent = wr.run || wr.remain ? (wr.idx + 1) + '/' + W.length + '  ' + s.name : 'Ready';
    $('#w_time').textContent = fmtTime(wr.remain || 0);
    const full = s.min * 60000, p = wr.remain ? 100 - wr.remain / full * 100 : 0;
    $('#w_bar').style.width = Math.max(0, Math.min(100, p)) + '%';
  }
  function warmTick() {
    const now = performance.now(); wr.remain -= now - wr.last; wr.last = now;
    if (wr.remain <= 0) {
      beep(740, 0.2);
      if (wr.idx + 1 >= W.length) { wr.run = false; clearInterval(wr.timer); wr.remain = 0; $('#w_now').textContent = 'Done. Go win some rounds.'; $('#w_time').textContent = '00:00'; $('#w_bar').style.width = '100%'; return; }
      wr.idx++; wr.remain = W[wr.idx].min * 60000;
    }
    warmShow();
  }
  function warmStart() {
    if (wr.run) return;
    if (!wr.remain || wr.idx >= W.length) { wr.idx = 0; wr.remain = W[0].min * 60000; }
    wr.run = true; wr.last = performance.now(); clearInterval(wr.timer); wr.timer = setInterval(warmTick, 250); beep(740, 0.1); warmShow();
  }
  $('#w_start').addEventListener('click', warmStart);
  $('#w_pause').addEventListener('click', () => { wr.run = false; clearInterval(wr.timer); });
  $('#w_reset').addEventListener('click', () => { wr.run = false; clearInterval(wr.timer); wr.idx = 0; wr.remain = 0; $('#w_now').textContent = 'Ready'; $('#w_time').textContent = '00:00'; $('#w_bar').style.width = '0%'; });
  $('#w_add').addEventListener('click', () => { if (W.length < 12) { W.push({ name: 'New step', min: 5 }); store.set('cs2w', W); renderWarmList(); } });

  /* =====================================================================
     COMMAND REFERENCE
  ===================================================================== */
  const CMDS = [
    ['cl_crosshairstyle 4', 'Crosshair style (4 = classic static)', 'Crosshair', false],
    ['cl_crosshairsize 5', 'Length of the crosshair lines', 'Crosshair', false],
    ['cl_crosshairthickness 1', 'Thickness of the lines', 'Crosshair', false],
    ['cl_crosshairgap -1', 'Gap between center and lines', 'Crosshair', false],
    ['cl_crosshair_drawoutline 1', 'Draw a black outline', 'Crosshair', false],
    ['cl_crosshaircolor 5', 'Use a custom color (set r, g, b below)', 'Crosshair', false],
    ['cl_crosshaircolor_r 63', 'Red channel 0-255 (also _g and _b)', 'Crosshair', false],
    ['cl_crosshairdot 0', 'Center dot on or off', 'Crosshair', false],
    ['cl_crosshair_t 0', 'T-style crosshair (no top line)', 'Crosshair', false],
    ['cl_crosshairalpha 255', 'Crosshair opacity 0-255', 'Crosshair', false],
    ['viewmodel_fov 68', 'Field of view of the weapon model', 'Viewmodel & HUD', false],
    ['viewmodel_offset_x 2.5', 'Move the weapon model left or right', 'Viewmodel & HUD', false],
    ['cl_bob_lower_amt 5', 'Reduce weapon bob when moving', 'Viewmodel & HUD', false],
    ['cl_radar_scale 0.4', 'How much of the map the radar shows', 'Viewmodel & HUD', false],
    ['cl_hud_radar_scale 1.1', 'Size of the radar on screen', 'Viewmodel & HUD', false],
    ['cl_radar_always_centered 0', 'Keep the radar centered on you', 'Viewmodel & HUD', false],
    ['cl_showfps 1', 'Show an FPS counter', 'Performance & audio', false],
    ['fps_max 0', 'Remove the frame rate cap', 'Performance & audio', false],
    ['snd_mute_losefocus 0', 'Keep game audio when alt-tabbed', 'Performance & audio', false],
    ['cl_use_opens_buy_menu 0', 'E no longer opens the buy menu', 'Gameplay', false],
    ['cl_autowepswitch 0', 'No auto weapon switch on pickup', 'Gameplay', false],
    ['bind "F1" "buy ak47; buy vesthelm"', 'Example buy bind, press F1 in the buy phase', 'Buy', false],
    ['buy vesthelm', 'Buy kevlar and helmet (buy phase only)', 'Buy', false],
    ['sv_cheats 1', 'Unlock cheat commands. Offline or private server only', 'Practice', true],
    ['noclip', 'Fly through walls', 'Practice', true],
    ['god', 'Take no damage', 'Practice', true],
    ['impulse 101', 'Max cash, health and ammo', 'Practice', true],
    ['sv_infinite_ammo 1', 'Never run out of ammo', 'Practice', true],
    ['sv_showimpacts 1', 'Show bullet impact points', 'Practice', true],
    ['sv_grenade_trajectory_prac_pipreview 1', 'Preview grenade landing spot', 'Practice', true],
    ['sv_rethrow_last_grenade', 'Throw your last grenade again', 'Practice', true],
    ['host_timescale 0.5', 'Slow the game down', 'Practice', true],
    ['mp_restartgame 1', 'Restart the match', 'Practice', true],
    ['mp_warmup_end', 'End warmup', 'Practice', true],
    ['mp_freezetime 0', 'Remove freeze time', 'Practice', true],
    ['mp_roundtime 60', 'Round length in minutes', 'Practice', true],
    ['mp_buytime 9999', 'Unlimited buy time', 'Practice', true],
    ['mp_buy_anywhere 1', 'Buy anywhere on the map', 'Practice', true],
    ['mp_startmoney 60000', 'Starting money', 'Practice', true],
    ['mp_maxmoney 60000', 'Maximum money', 'Practice', true],
    ['ammo_grenade_limit_total 5', 'Carry more grenades in total', 'Practice', true],
    ['bot_add_t', 'Add a bot on T side', 'Bots', true],
    ['bot_add_ct', 'Add a bot on CT side', 'Bots', true],
    ['bot_kick', 'Remove all bots', 'Bots', true],
    ['bot_stop 1', 'Freeze bots in place', 'Bots', true],
    ['bot_place', 'Place a bot where you aim (single source, verify in game)', 'Bots', true]
  ];
  function renderCmds() {
    const q = $('#c_q').value.trim().toLowerCase(), cat = $('#c_cat').value;
    const body = $('#c_body'); body.textContent = '';
    let count = 0;
    CMDS.forEach((c) => {
      if (cat && c[2] !== cat) return;
      if (q && (c[0] + ' ' + c[1] + ' ' + c[2]).toLowerCase().indexOf(q) < 0) return;
      count++;
      const copy = h('button', { type: 'button', class: 'chip', text: 'Copy', 'aria-label': 'Copy ' + c[0] });
      copy.addEventListener('click', () => { copyText(c[0], copy, 'Copied'); });
      body.appendChild(h('tr', {}, [
        h('td', {}, [h('code', { text: c[0] })]),
        h('td', { text: c[1] + (c[3] ? '  (needs sv_cheats)' : '') }),
        h('td', { text: c[2] }),
        h('td', {}, [copy])
      ]));
    });
    $('#c_count').textContent = count + ' command' + (count === 1 ? '' : 's');
  }
  (function () {
    const cats = []; CMDS.forEach((c) => { if (cats.indexOf(c[2]) < 0) cats.push(c[2]); });
    cats.forEach((c) => $('#c_cat').appendChild(h('option', { value: c, text: c })));
  })();
  $('#c_q').addEventListener('input', renderCmds);
  $('#c_cat').addEventListener('change', renderCmds);

  /* =====================================================================
     copy / download / share / profile
  ===================================================================== */
  function flash(id, msg, bad) {
    const e = $('#' + id); if (!e) return;
    e.className = bad ? 'err' : 'ok'; e.textContent = msg; setTimeout(() => { e.textContent = ''; }, 2200);
  }
  function fallbackCopy(text, done) {
    const ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0' }); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
    ta.remove();
  }
  function writeClipboard(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  }
  function copyText(text, btn, msg) {
    writeClipboard(text, () => { const old = btn.textContent; btn.textContent = msg || 'Copied'; setTimeout(() => { btn.textContent = old; }, 1200); });
  }
  function copyFrom(srcId, okId) { writeClipboard($('#' + srcId).value, () => flash(okId, 'Copied')); }
  function download(name, text, type) {
    const a = h('a', { download: name }); a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain' }));
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  $('#x_copy').addEventListener('click', () => copyFrom('x_out', 'x_ok'));
  $('#a_copy').addEventListener('click', () => copyFrom('a_out', 'a_ok'));
  $('#p_copy').addEventListener('click', () => copyFrom('p_out', 'p_ok'));
  $('#l_copy').addEventListener('click', () => copyFrom('l_out', 'l_ok'));
  $('#x_dl').addEventListener('click', () => download('crosshair.cfg', crossCommands().join('\n') + '\n'));
  $('#a_dl').addEventListener('click', () => download('autoexec.cfg', autoexecText()));
  $('#p_dl').addEventListener('click', () => download('practice.cfg', practiceText()));
  $('#x_share').addEventListener('click', () => {
    const url = location.origin + location.pathname + '#x=' + b64enc(JSON.stringify(X));
    writeClipboard(url, () => flash('x_ok', 'Share link copied'));
  });
  $('#x_import').addEventListener('click', () => {
    const r = parseCross($('#x_in').value);
    if (!r.found) { flash('x_imsg', 'No crosshair commands found', true); return; }
    X = r.crosshair; store.set('cs2x', X); pushToUI(X, 'x'); renderAll();
    flash('x_imsg', 'Loaded ' + r.found + ' setting' + (r.found > 1 ? 's' : ''));
  });
  $$('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    X = cleanX(PRESETS[b.getAttribute('data-preset')]); store.set('cs2x', X); pushToUI(X, 'x'); renderAll();
  }));
  $$('[data-bg]').forEach((b) => b.addEventListener('click', () => { bgMode = b.getAttribute('data-bg'); drawPreview(performance.now()); }));
  $('#x_bloom').addEventListener('input', () => drawPreview(performance.now()));

  $('#exp').addEventListener('click', () => {
    download('cs2-config-lab-profile.json', JSON.stringify({ v: 1, X: X, A: A, P: P, L: L, S: S, E: E, B: B, W: W, team: team, mode: mode }, null, 2), 'application/json');
  });
  $('#imp').addEventListener('click', () => $('#impfile').click());
  $('#impfile').addEventListener('change', () => {
    const f = $('#impfile').files[0]; if (!f) return;
    if (f.size > 200000) { flash('pmsg', 'File too large', true); return; }
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const d = JSON.parse(String(rd.result));
        if (!d || typeof d !== 'object') throw new Error('bad');
        X = cleanX(d.X); A = cleanA(d.A); P = cleanP(d.P); L = cleanL(d.L); S = cleanS(d.S); E = cleanE(d.E); B = cleanSlots(d.B); W = cleanWarm(d.W);
        if (d.team === 't' || d.team === 'ct') team = d.team;
        if (d.mode === 'dark' || d.mode === 'light') mode = d.mode;
        store.set('cs2x', X); store.set('cs2a', A); store.set('cs2p', P); store.set('cs2l', L); store.set('cs2s', S); store.set('cs2e', E); store.set('cs2b', B); store.set('cs2w', W); store.set('cs2team', team); store.set('cs2mode', mode);
        pushToUI(X, 'x'); pushToUI(A, 'a'); pushToUI(P, 'p'); pushToUI(L, 'l'); pushToUI(S, 's'); pushToUI(E, 'e');
        applyTheme(); renderSlots(); renderWarmList(); renderAll(); flash('pmsg', 'Profile loaded');
      } catch (e) { flash('pmsg', 'Not a valid profile file', true); }
      $('#impfile').value = '';
    };
    rd.readAsText(f);
  });

  /* =====================================================================
     tabs + routing + keyboard
  ===================================================================== */
  const TABS = { cross: 'cross', auto: 'auto', prac: 'prac', launch: 'launch', sens: 'sens', eco: 'eco', aim: 'aim-sec', warm: 'warm', cmds: 'cmds' };
  const tabBtns = $$('nav button[data-tab]');
  function showTab(name, focus) {
    if (!TABS[name]) name = 'cross';
    tabBtns.forEach((b) => { const on = b.getAttribute('data-tab') === name; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    Object.keys(TABS).forEach((k) => { $('#' + TABS[k]).hidden = k !== name; });
    try { history.replaceState(null, '', '#tab=' + name); } catch (e) { /* ignore */ }
    if (name === 'cross') drawPreview(performance.now());
    if (name === 'aim') aimIdle();
  }
  tabBtns.forEach((b, i) => {
    b.addEventListener('click', () => showTab(b.getAttribute('data-tab')));
    b.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault(); const d = e.key === 'ArrowRight' ? 1 : -1;
        showTab(tabBtns[(i + d + tabBtns.length) % tabBtns.length].getAttribute('data-tab'), true);
      }
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target && e.target.tagName; if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= tabBtns.length) showTab(tabBtns[n - 1].getAttribute('data-tab'));
  });

  /* =====================================================================
     init
  ===================================================================== */
  function renderAll() { drawPreview(performance.now()); renderAuto(); renderPrac(); renderLaunch(); renderSens(); renderEco(); }
  bindAll(() => X, (v) => { X = v; }, 'x', 'cs2x', cleanX, renderAll);
  bindAll(() => A, (v) => { A = v; }, 'a', 'cs2a', cleanA, renderAll);
  bindAll(() => P, (v) => { P = v; }, 'p', 'cs2p', cleanP, renderAll);
  bindAll(() => L, (v) => { L = v; }, 'l', 'cs2l', cleanL, renderAll);
  bindAll(() => S, (v) => { S = v; }, 's', 'cs2s', cleanS, renderAll);
  bindAll(() => E, (v) => { E = v; }, 'e', 'cs2e', cleanE, renderAll);
  renderSlots(); renderWarmList(); buildLoadout(); renderCmds();
  renderAll();
  const startTab = loadedFromLink ? 'cross' : (hashParams.get('tab') || (TABS[location.hash.slice(1)] ? location.hash.slice(1) : 'cross'));
  showTab(startTab);
  if (loadedFromLink) flash('x_ok', 'Loaded crosshair from link');
})();
