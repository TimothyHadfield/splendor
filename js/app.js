/* Splendor Lab — screens. The engine (SpEngine) owns every rule; this file only draws and sends moves.
   A "table" is the seat transport: LocalTable (this device: you + computers or friends passing the phone)
   or OnlineTable (the shared online module). Both expose view(). */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const { CARDS, NOBLES, CITIES } = SpCards;
  const E = SpEngine, B = SpBots, Art = SpArt;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sum = a => a.reduce((s, x) => s + x, 0);
  const COLW = ['white', 'blue', 'green', 'red', 'black', 'gold'];
  const SEAT_COL = ['#6ea8fe', '#f0b354', '#c58cf0', '#6ee7a8'];
  const LV_NAME = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  const LEVEL_NOTE = { easy: 'Grabs gems', medium: 'Chases points', hard: 'Plans ahead' };
  // how long a computer "thinks" before its move (Settings: Computer speed); Normal is the old fixed 750 ms
  const BOT_SPEED = { slow: 1300, normal: 750, fast: 300 };
  const botMs = () => BOT_SPEED[store.settings.botSpeed] || 750;
  // the Cities of Splendor modules (one at a time; the Cities variant wins over them)
  const modOn = () => (E.MODS.indexOf(store.settings.module) >= 0 ? store.settings.module : undefined);
  const MOD_NAME = { posts: 'Trading posts', forts: 'Strongholds' };
  const MOD_NOTE = { posts: 'Five trading posts: own the cards a post asks for and your coat of arms goes on it, for a lasting power or points.',
    forts: 'Each player has 3 strongholds. After every buy, put one on a card on the table (only you may buy or reserve it) or knock off someone else’s; all 3 on one card let you buy it at once.' };

  // ------------------------------------------------------------------ sound & effects (shared fx.js; switches in Settings)
  const FX = window.FX;
  FX.init({ game: 'splendor', accent: '#6ea8fe' });
  const anim = () => FX.settings.animations;
  const spd = () => (FX.settings.animSpeed === 'fast' ? 0.5 : 1);
  function fxClasses() {
    document.body.classList.toggle('fx-still', !anim());
    document.body.classList.toggle('fx-fast', anim() && FX.settings.animSpeed === 'fast');
  }
  fxClasses();
  FX.onChange(fxClasses);
  // an illegal tap: message + soft error sound + a little shake of what was tapped
  function nope(msg, el) { toast(msg); FX.play('error'); if (el) FX.shake(el); }

  // ------------------------------------------------------------------ storage (try/catch: private mode etc.)
  const KEY = 'splendor.v1';
  // a typed name: trimmed, 20 characters at most, never cutting an emoji in half
  function name20(x) { return Array.from(String(x == null ? '' : x).trim()).slice(0, 20).join('').trim(); }
  let store;
  try { store = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { store = null; }
  if (!store || typeof store !== 'object' || Array.isArray(store)) store = {};
  if (!store.settings || typeof store.settings !== 'object' || Array.isArray(store.settings)) store.settings = {};
  const defSettings = { seats: ['computer', 'off', 'off'], level: 'hard', cities: false, showTurns: true, hints: true, name: '', target: 15, styles: 'balanced', module: 'none', botSpeed: 'normal' };
  store.settings = Object.assign({}, defSettings, store.settings || {});
  { // clamp anything odd from an old or edited save
    const st = store.settings;
    if (!Array.isArray(st.seats) || st.seats.length !== 3) st.seats = defSettings.seats.slice();
    st.seats = st.seats.map((k, i) => (['computer', 'human', 'off'].indexOf(k) >= 0 && !(i === 0 && k === 'off')) ? k : (i === 0 ? 'computer' : 'off'));
    if (!LV_NAME[st.level]) st.level = 'hard';
    st.name = name20(st.name);
    st.cities = st.cities === true;
    if (E.TARGETS.indexOf(st.target) < 0) st.target = 15;
    if (st.styles !== 'mixed') st.styles = 'balanced';
    if (E.MODS.indexOf(st.module) < 0) st.module = 'none';
    if (!BOT_SPEED[st.botSpeed]) st.botSpeed = 'normal';
  }
  if (!store.chal || typeof store.chal !== 'object' || Array.isArray(store.chal)) store.chal = {};
  // the same seeded numbers as tools/measure.js, so a challenge deals exactly the cards its star marks were measured on
  function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* storage full or blocked */ } }

  // ------------------------------------------------------------------ tables
  function LocalTable(g) { this.g = g; }
  LocalTable.prototype.view = function (seat) { return E.view(this.g.state, seat); };
  let table = null;
  // a saved game must look exactly like one the engine made, or it is dropped (old or hand-edited saves)
  function validState(s) {
    const isArr = Array.isArray, int = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
    const ids = (a, max) => isArr(a) && a.every(x => int(x, 0, max));
    const gems = (a, n) => isArr(a) && a.length === n && a.every(x => int(x, 0, 99));
    if (!s || typeof s !== 'object' || !int(s.n, 2, 4) || !isArr(s.players) || s.players.length !== s.n) return false;
    if (!int(s.turn, 0, s.n - 1) || !int(s.start, 0, s.n - 1) || !int(s.turns, 0, 100000)) return false;
    if (['main', 'discard', 'noble', 'city', 'gem', 'fort', 'conquer'].indexOf(s.phase) < 0 || !isArr(s.log) || !gems(s.bank, 6)) return false;
    // the Cities of Splendor modules: only the pieces the engine makes for them
    if (s.mod !== undefined && E.MODS.indexOf(s.mod) < 0) return false;
    if (['gem', 'fort', 'conquer'].indexOf(s.phase) >= 0 && !s.mod) return false;
    if (s.phase === 'gem' && !int(s.gemNot, -1, 4)) return false;
    if (s.phase === 'conquer' && !(ids(s.nobleChoice, 89) && s.nobleChoice.length === 1)) return false;
    if (s.pend !== undefined && (!s.pend || typeof s.pend !== 'object')) return false;
    if (s.mod === 'forts' && (!s.forts || typeof s.forts !== 'object' || isArr(s.forts) ||
      !Object.keys(s.forts).every(k => int(Number(k), 0, 89) && s.forts[k] && int(s.forts[k].seat, 0, s.n - 1) && int(s.forts[k].n, 1, 3)))) return false;
    if (s.mod === 'posts' && !s.players.every(p => p && ids(p.posts, 4))) return false;
    if (!isArr(s.decks) || s.decks.length !== 3 || !s.decks.every(d => ids(d, 89))) return false;
    if (!isArr(s.market) || s.market.length !== 3 || !s.market.every(r => isArr(r) && r.length <= 4 && r.every(x => x === null || int(x, 0, 89)))) return false;
    if (!ids(s.nobles, NOBLES.length - 1) || !ids(s.cities || [], CITIES.length - 1)) return false;
    if ((s.phase === 'noble' || s.phase === 'city') && !ids(s.nobleChoice, 99)) return false;
    if (s.over && (!s.result || !isArr(s.result.winners) || !isArr(s.result.scores))) return false;
    return s.players.every(p => p && typeof p === 'object' && typeof p.name === 'string' && gems(p.gems, 6) && gems(p.bonus, 5) &&
      ids(p.cards, 89) && ids(p.nobles, NOBLES.length - 1) && ids(p.cities || [], CITIES.length - 1) && int(p.points, 0, 999) &&
      isArr(p.reserved) && p.reserved.length <= 3 && p.reserved.every(r => r && int(r.id, 0, 89)));
  }
  function validStudy(st) { return st && typeof st === 'object' && Array.isArray(st.rec) && Array.isArray(st.race) && st.race.every(r => Array.isArray(r) && Array.isArray(r[1])); }
  if (store.game) {
    try {
      const g = store.game;
      if (!validState(g.state)) throw new Error('bad state');
      if (!Array.isArray(g.kinds) || g.kinds.length !== g.state.n || g.kinds[0] !== 'human' || !g.kinds.every(k => k === 'human' || k === 'computer')) throw new Error('bad seats');
      if (!LV_NAME[g.level]) g.level = 'hard';
      if (!validStudy(g.study)) g.study = { rec: [], race: [] };
      if (!(Number.isInteger(g.lastHuman) && g.kinds[g.lastHuman] === 'human')) g.lastHuman = 0;
      if (!Array.isArray(g.undo) || !g.undo.every(u => u && validState(u.state))) g.undo = [];
      if (!Array.isArray(g.styles)) g.styles = [];
      E.view(g.state, 0); E.legal(g.state, g.state.turn);
      table = new LocalTable(g);
    } catch (e) { store.game = null; save(); }
  }
  if (store.last && !(typeof store.last === 'object' && Array.isArray(store.last.players) && store.last.players.length >= 2 && validStudy(store.last) &&
    store.last.players.every(p => p && typeof p.name === 'string' && Number.isFinite(p.points)) && Number.isInteger(store.last.me))) { store.last = null; save(); }
  function OnlineTable(room) { this.online = true; this.room = room; this.snap = room.view(); }
  OnlineTable.prototype.view = function () { return SpOnlineGame.viewFromSnap(this.snap); };

  // which seat's eyes the screen shows
  function mySeat() {
    if (!table) return 0;
    if (table.online) return table.snap.mySeat >= 0 ? table.snap.mySeat : 0;
    const g = table.g, s = g.state;
    if (g.kinds[s.turn] === 'human' && !s.over) return s.turn;
    return g.lastHuman != null ? g.lastHuman : g.kinds.indexOf('human');
  }
  function kindOf(seat) {
    if (table.online) { const x = table.snap.seats[seat]; return x ? x.kind : 'computer'; }
    return table.g.kinds[seat];
  }
  function canAct(v) {
    if (!v || v.over) return false;
    if (table.online) return !!table.snap.myTurn && !net.busy;
    return table.g.kinds[v.turn] === 'human';
  }

  // ------------------------------------------------------------------ online
  const net = { room: null, snap: null, busy: false, sentV: null, timer: null, connecting: false, savedLast: false };
  function loadOnline() {
    if (net.room) return Promise.resolve(net.room);
    return import(new URL('js/online.js?v=a3d0418b', location.href).href).then(mod => {
      if (net.room) return net.room;
      net.room = mod.createOnline({ game: SpOnlineGame.game, gameId: 'splendor', botDelayMs: 800 });
      net.room.on('change', onNet);
      net.room.on('error', msg => { unbusy(); toast(String(msg)); if (ui.tab === 'play') renderPlay(); });
      return net.room;
    });
  }
  function unbusy() { net.busy = false; clearTimeout(net.timer); }
  function backToLocal() {
    net.savedLast = false;
    table = store.game && store.game.state ? new LocalTable(store.game) : null;
    ui.prev = null;
  }
  function onNet(snap) {
    net.snap = snap;
    if (net.busy && snap.v !== net.sentV) unbusy();
    if (snap.status === 'playing' || snap.status === 'finished') {
      if (!table || !table.online) {
        table = new OnlineTable(net.room); resetSel(); ui.prev = null; net.savedLast = false; ui.study = { rec: [], race: [] };
        if (snap.status === 'playing') { FX.play('shuffle'); ui.dealAll = true; }
      }
      table.snap = snap;
      try { // points race for the Study tab, one point per finished turn
        const v = snap.pub ? SpOnlineGame.viewFromSnap(snap) : null;
        if (v && (v.phase === 'main' || v.over)) {
          const r = ui.study.race, last = r[r.length - 1];
          if (!last || last[0] !== v.turns) r.push([v.turns, v.players.map(p => p.points)]);
        }
      } catch (e) { /* study is best-effort */ }
      if (snap.status === 'finished' && snap.pub && !net.savedLast) {
        net.savedLast = true;
        const v = SpOnlineGame.viewFromSnap(snap);
        store.last = { players: v.players.map(p => ({ name: p.name, points: p.points, cards: p.cards.length })), result: v.result, me: snap.mySeat, rec: ui.study.rec, race: ui.study.race, online: true };
        save();
      }
    } else if (table && table.online) backToLocal();
    if (snap.status === 'closed' || snap.status === 'left') {
      store.online = false; save();
      if (snap.status === 'closed') toast('The room was closed');
    }
    if (ui.tab === 'play') renderPlay();
  }
  function leaveOnline() {
    const r = net.room;
    store.online = false; ui.online = false; save();
    backToLocal(); resetSel();
    if (r) r.leave().catch(() => {});
    renderPlay();
  }
  function onlineSeatsFromSettings() { return ['human'].concat(store.settings.seats.filter(k => k !== 'off').map(() => 'empty')); }
  async function onlineBtn(k) {
    if (k === 'open') { ui.online = true; renderPlay(); loadOnline().catch(() => toast('Online play couldn’t load. Check your internet.')); return; }
    if (k === 'back') {
      if (net.snap && net.snap.status === 'lobby') { confirmBox('Leave this room?', 'Leave', leaveOnline); return; }
      ui.online = false; renderPlay(); return;
    }
    if (k === 'start') {
      if (net.connecting) return;
      net.connecting = true; renderPlay();
      const r = await net.room.start();
      net.connecting = false;
      if (!r.ok) toast(r.message);
      renderPlay(); return;
    }
    if (k !== 'create' && k !== 'join') return;
    const nameEl = $('#on-name');
    if (nameEl) { store.settings.name = name20(nameEl.value); save(); }
    const name = store.settings.name || 'Player';
    const codeEl = $('#on-code');
    const code = codeEl ? codeEl.value.trim().toUpperCase() : '';
    if (k === 'join' && code.length !== 5) { toast('Room codes have 5 letters'); return; }
    if (net.connecting) return;
    net.connecting = true; renderPlay();
    let r;
    try {
      const room = await loadOnline();
      if (k === 'create') r = await room.createRoom({ name, seats: onlineSeatsFromSettings(), options: { level: store.settings.level, cities: store.settings.cities, module: store.settings.cities ? null : (modOn() || null) } });
      else r = await room.joinRoom(code, name);
    } catch (e) { r = { ok: false, message: 'Online play couldn’t load. Check your internet.' }; }
    net.connecting = false;
    if (r.ok) { store.online = true; save(); } else toast(r.message);
    renderPlay();
  }

  // ------------------------------------------------------------------ ui state
  const ui = { online: false, tab: 'play', sel: null, take: [], ret: [0, 0, 0, 0, 0, 0], hint: null, prev: null, botTimer: null,
    cardsLevel: 0, cardsSort: 'value', shownSeat: null, study: (store.game && store.game.study) || { rec: [], race: [] } };
  function resetSel() { ui.sel = null; ui.take = []; ui.ret = [0, 0, 0, 0, 0, 0]; ui.hint = null; ui.fortFrom = null; }
  // Strongholds step: the market cards a tap can act on (place / knock off; with none left in your supply, pick one of yours up)
  function fortTargetsFor(v, seat) {
    const moves = E.legal(v, seat);
    if (ui.fortFrom != null) return moves.filter(m => m.from === ui.fortFrom).map(m => m.id);
    const out = moves.filter(m => m.from === undefined).map(m => (m.id !== undefined ? m.id : m.rm));
    if (E.fortsLeft(v, seat) === 0) moves.forEach(m => { if (m.from !== undefined && out.indexOf(m.from) < 0) out.push(m.from); });
    return out;
  }

  // ------------------------------------------------------------------ helpers
  function heat(x, lo, hi) { const f = Math.max(0, Math.min(1, (x - lo) / (hi - lo))); return 'hsl(' + Math.round(f * 130) + ', 70%, 62%)'; }
  const qBtn = text => '<button class="q" data-q="' + esc(text) + '" aria-label="Why?">?</button>';
  function toast(msg) {
    document.querySelectorAll('.toast').forEach(x => x.remove()); // rapid taps: one message, not a pile
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2400);
  }
  function confirmBox(msg, yes, onYes) {
    const back = document.createElement('div');
    back.className = 'confirm-back';
    back.innerHTML = '<div class="panel"><p style="margin:0 0 14px">' + esc(msg) + '</p><div class="row" style="justify-content:flex-end">' +
      '<button class="btn ghost" data-c="no">Cancel</button><button class="btn primary" data-c="yes">' + esc(yes) + '</button></div></div>';
    back.addEventListener('click', e => {
      const b = e.target.closest('[data-c]');
      if (e.target === back || b) { back.remove(); dropOverlay(); if (b && b.dataset.c === 'yes') onYes(); }
    });
    document.body.appendChild(back);
    markOverlay();
  }
  // a sheet or box on screen gets its own history step, so phone Back closes it instead of leaving the site
  function markOverlay() { try { if (!(history.state && history.state.ov)) history.pushState({ tab: ui.tab, ov: 1 }, '', location.hash || '#' + ui.tab); } catch (e) { /* file:// */ } }
  // the shared kits' own overlays: the Rules sheet (coach.js) and My stats (profile.js)
  const kitOpen = () => !!((window.COACH && COACH.rulesOpen()) || (window.Profile && window.Profile.isOpen && window.Profile.isOpen()));
  function closeKits() {
    ui.closingQuiet = true;
    try { if (window.COACH && COACH.rulesOpen()) COACH.closeRules(); if (window.Profile && window.Profile.isOpen()) window.Profile.closePanel(); } catch (e) { /* never stops the game */ }
    ui.closingQuiet = false;
  }
  const modalOpen = () => !!($('#sheet') || $('.confirm-back') || kitOpen());
  function dropOverlay() {
    setTimeout(() => {
      if ($('#sheet') || $('.confirm-back') || kitOpen()) return;
      try { if (history.state && history.state.ov) { ui.skipPop = true; history.back(); } } catch (e) { /* file:// */ }
    }, 0);
  }
  function sheet(title, html) {
    closeSheet();
    const back = document.createElement('div');
    back.className = 'sheet-back'; back.id = 'sheet';
    back.innerHTML = '<div class="sheet"><div class="row"><h3 class="grow">' + esc(title) + '</h3><button class="btn small ghost" data-close>Close</button></div><div class="scroll">' + html + '</div></div>';
    back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) { closeSheet(); dropOverlay(); } });
    document.body.appendChild(back);
    markOverlay();
  }
  function closeSheet() { const s = $('#sheet'); if (s) s.remove(); }
  const gemTxt = k => Art.gem(k);
  function costTxt(id) { const c = CARDS[id].cost; return c.map((x, k) => x ? x + gemTxt(k) : '').join(' '); }
  function cardName(id) { const c = CARDS[id]; return 'Level ' + c.level + ' ' + COLW[c.bonus] + (c.points ? ' · ' + c.points + ' pt' + (c.points > 1 ? 's' : '') : ''); }
  function describe(a, v) {
    if (!a) return '';
    if (a.t === 'take') return 'Took ' + a.g.map(k => COLW[k]).join(', ');
    if (a.t === 'take2') return 'Took 2 ' + COLW[a.c];
    if (a.t === 'buy') return 'Bought ' + cardName(a.id);
    if (a.t === 'reserve') return a.deck ? 'Reserved from deck ' + a.deck : 'Reserved ' + cardName(a.id);
    if (a.t === 'discard') return 'Returned ' + sum(a.g) + ' gems';
    if (a.t === 'noble') return 'Chose a noble';
    return 'Passed';
  }
  function sameAction(a, b) {
    if (!a || !b || a.t !== b.t) return false;
    if (a.t === 'take') return a.g.slice().sort().join() === b.g.slice().sort().join();
    if (a.t === 'take2') return a.c === b.c;
    if (a.t === 'buy') return a.id === b.id;
    if (a.t === 'reserve') return a.id === b.id && a.deck === b.deck;
    return true;
  }

  // ------------------------------------------------------------------ tabs + back button
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) showTab(b.dataset.tab, true); });
  function showTab(tab, push) {
    ui.tab = tab;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + tab));
    if (push) try { history.pushState({ tab }, '', '#' + tab); } catch (e) { /* file:// */ }
    closeSheet();
    if (tab !== 'play') document.querySelectorAll('.flyer').forEach(f => f.remove()); // nothing keeps flying over another tab
    render();
  }
  const TABS = ['play', 'cards', 'study', 'settings'];
  window.addEventListener('popstate', e => {
    if (ui.skipPop) { ui.skipPop = false; return; } // our own step back after a sheet closed by its button
    // Back with a sheet or a confirm box open just closes it and stays on this tab
    const open = $('#sheet') || $('.confirm-back') || kitOpen();
    if (open) {
      document.querySelectorAll('#sheet, .confirm-back').forEach(x => x.remove());
      closeKits();
      if (!(e.state && e.state.tab === ui.tab)) { // landed on another tab's step: stay here
        try { history.pushState({ tab: ui.tab }, '', '#' + ui.tab); } catch (err) { /* file:// */ }
      }
      return;
    }
    const h = (location.hash || '').slice(1);
    showTab((e.state && TABS.indexOf(e.state.tab) >= 0 && e.state.tab) || (TABS.indexOf(h) >= 0 ? h : 'play'), false);
  });

  document.addEventListener('click', e => {
    const old = $('.pop');
    const q = e.target.closest('[data-q]');
    if (old) old.remove();
    if (!q || (old && old.dataset.for === q.dataset.q)) return;
    const pop = document.createElement('div');
    pop.className = 'pop'; pop.textContent = q.dataset.q; pop.dataset.for = q.dataset.q;
    document.body.appendChild(pop);
    const r = q.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    const x = Math.min(window.innerWidth - w - 12, Math.max(12, r.left + r.width / 2 - w / 2));
    let y = r.bottom + 8;
    if (y + h > window.innerHeight - 8) y = r.top - h - 8;
    pop.style.left = x + 'px'; pop.style.top = Math.max(8, y) + 'px';
  });

  function render() {
    if (ui.tab === 'play') renderPlay();
    else if (ui.tab === 'cards') renderCards();
    else if (ui.tab === 'study') renderStudy();
    else renderSettings();
  }
  // a screen that fails to draw drops whatever saved data broke it, instead of leaving a blank page
  function safely(fn, name) {
    return function () {
      try { return fn.apply(this, arguments); }
      catch (e) {
        if (window.console) console.warn('Splendor: ' + name + ' failed', e);
        if (name === 'study' && store.last) { store.last = null; save(); return fn.apply(this, arguments); }
        if (name === 'play' && table && !table.online) {
          clearTimeout(ui.botTimer); store.game = null; table = null; ui.prev = null; save();
          toast('That saved game couldn’t be loaded, so it was cleared.');
          return fn.apply(this, arguments);
        }
        throw e;
      }
    };
  }

  // ================================================================== PLAY
  const vPlay = $('#v-play');
  const renderPlay = safely(function () { vPlay.classList.remove('tbl-surface', 'tbl-wood-dark', 'on-table'); if (table) renderGame(); else if (ui.online) renderOnline(); else renderSetup(); }, 'play');

  function renderOnline() {
    const s = net.snap;
    const st = s ? s.status : 'none';
    let body;
    if (net.connecting && st !== 'lobby') body = '<div class="panel"><b>Connecting…</b><p class="muted small" style="margin:0">Talking to the game server.</p></div>';
    else if (st === 'joining') body = '<div class="panel"><b>Joining…</b><p class="muted small" style="margin:0">Waiting for the host to give you a seat.</p></div>';
    else if (st === 'lobby') {
      const host = s.isHost;
      const o = s.options || {};
      const seats = s.seats.map((x, i) => {
        const who = x.kind === 'human' ? esc(x.name || 'Player') + (i === s.mySeat ? ' <span class="muted">(you)</span>' : '') + (x.online ? '' : ' <span class="muted">· away</span>') :
          x.kind === 'computer' ? 'Computer' : '<span class="muted">Open seat</span>';
        let b = '';
        if (host && i !== s.mySeat) b = x.kind === 'empty' ? '<button class="btn small" data-seat="' + i + '" data-kind="computer">Computer</button>' :
          '<button class="btn small ghost" data-seat="' + i + '" data-kind="empty">' + (x.kind === 'human' ? 'Remove' : 'Open') + '</button>';
        return '<div class="seatrow"><span class="dot" style="background:' + SEAT_COL[i] + '"></span><span class="grow">' + who + '</span>' + b + '</div>';
      }).join('');
      body = '<div class="panel" style="align-items:center;gap:4px"><span class="label">Room code</span><div class="code-big" id="room-code">' + esc(s.code) + '</div>' +
        '<p class="muted small" style="margin:0;text-align:center">Friends open this site, tap Play online and type the code.</p></div>' +
        '<div class="panel"><span class="label">Seats</span><div class="seats" id="lobby-seats">' + seats + '</div>' +
        (host ? '<button class="btn primary" data-on="start" id="on-start" style="width:100%"' + (net.connecting ? ' disabled' : '') + '>' + (net.connecting ? 'Starting…' : 'Start') + '</button>' +
          '<p class="muted small" style="margin:0">' + (o.cities ? 'Cities variant. ' : MOD_NAME[o.module] ? MOD_NAME[o.module] + ' module. ' : '') + 'Open seats become ' + esc(LV_NAME[o.level] || 'Hard') + ' computers.</p>' :
          '<p class="muted small" style="margin:0">Waiting for the host to start…</p>') + '</div>';
    } else {
      body = '<div class="panel"><span class="label">Your name</span>' +
        '<input class="txt" id="on-name" maxlength="20" autocomplete="nickname" placeholder="Name" value="' + esc(store.settings.name || '') + '">' +
        '<button class="btn primary" data-on="create" id="on-create" style="width:100%">Create a room</button>' +
        '<p class="muted small" style="margin:0">Uses your number of players and computer level. Open seats can be friends or computers.</p></div>' +
        '<div class="panel"><span class="label">Join a friend</span><div class="row">' +
        '<input class="txt code" id="on-code" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Code">' +
        '<button class="btn primary" data-on="join" id="on-join">Join</button></div></div>';
    }
    vPlay.innerHTML = '<div class="setup"><div class="row"><button class="btn small ghost" data-on="back">Back</button><span class="grow"></span><span class="label">Play online</span></div>' + body + '</div>';
  }

  function strengthNote() {
    const S = window.SpStrength;
    if (!S) return 'Easy grabs random gems and buys what it can. Medium chases points per turn. Hard also values bonuses, chases nobles, reserves and blocks.';
    const d = S.duels;
    return 'Measured over ' + S.games + ' two-player games per pair: Hard beats Easy ' + d['hard:easy'] + '%, Hard beats Medium ' + d['hard:medium'] +
      '%, Medium beats Easy ' + d['medium:easy'] + '%' + (S.cities ? ' (Cities variant: ' + S.cities['hard:easy'] + '%, ' + S.cities['hard:medium'] + '%, ' + S.cities['medium:easy'] + '%)' : '') + '. Easy grabs random gems; Medium chases points per turn; Hard also values bonuses, nobles, reserving and blocking.';
  }

  function renderSetup() {
    const s = store.settings;
    const seatRows = s.seats.map((k, i) => {
      const opts = i === 0 ? ['computer', 'human'] : ['off', 'computer', 'human'];
      return '<div class="seatrow"><span class="dot" style="background:' + SEAT_COL[i + 1] + '"></span><span class="grow">Seat ' + (i + 2) + '</span>' +
        '<div class="seg" data-seat-kind="' + i + '">' + opts.map(o => '<button aria-pressed="' + (k === o) + '" data-v="' + o + '">' + (o === 'off' ? 'Off' : o === 'computer' ? 'Computer' : 'Friend') + '</button>').join('') + '</div></div>';
    }).join('');
    const demo = [CARDS.findIndex(c => c.level === 1 && c.points === 1 && c.bonus === 3), CARDS.findIndex(c => c.level === 2 && c.points === 2 && c.bonus === 1), CARDS.findIndex(c => c.level === 3 && c.points === 4 && c.bonus === 2)];
    const P = window.Profile && SP ? window.Profile : null;
    vPlay.innerHTML = '<div class="setup">' +
      '<div class="hero"><img src="icon.svg" alt=""><div class="grow"><h1>Splendor Lab</h1><p>Play Splendor with turns-to-afford on every card.</p></div>' +
      '<div class="hero-btns">' + (P ? '<button class="btn small ghost pf-open" data-stats id="my-stats">' + P.avatarSVG(P.avatar, 20) + 'My stats</button>' : '') +
      (SC ? '<button class="btn small ghost" data-rules id="rules-btn">Rules</button>' : '') + '</div></div>' +
      '<div class="demo-row">' + demo.map(id => Art.card(id)).join('') + Art.chip(5) + '</div>' +
      '<div class="panel">' +
      '<span class="label">Players · seat 1 is you</span>' +
      '<div class="seats">' + seatRows + '</div>' +
      '<div class="row"><span class="label grow">Computer</span>' + qBtn(strengthNote()) + '</div>' +
      '<div class="seg" data-set="level">' + ['easy', 'medium', 'hard'].map(l => '<button aria-pressed="' + (s.level === l) + '" data-v="' + l + '">' + LV_NAME[l] + '<small>' + LEVEL_NOTE[l] + '</small></button>').join('') + '</div>' +
      '<div class="setrow" style="min-height:40px"><div class="grow row" style="gap:6px"><b>Cities variant</b>' + qBtn('From the Cities of Splendor expansion: no nobles; 3 city tiles instead. Taking a city (enough points plus the bonuses shown) ends the game after the round, and only city holders can win.') + '</div><label class="switch"><input type="checkbox" data-setup-sw="cities"' + (s.cities ? ' checked' : '') + '><span></span></label></div>' +
      '<button class="btn primary" data-start id="deal" style="width:100%">Deal</button>' +
      '<div class="morerow"><button class="btn" data-on="open" id="open-online">Play online</button>' +
      (P ? '<button class="btn" data-daily id="daily-btn">' + (dailyDone() ? 'Daily ✓' : 'Daily') + '</button>' : '') +
      (window.SpChallenges ? '<button class="btn" data-chal id="chal-btn">Challenges</button>' : '') + '</div>' +
      (s.target !== 15 || (s.styles === 'mixed' && s.level === 'hard') || (modOn() && !s.cities) ? '<p class="muted small" style="margin:0">' + (modOn() && !s.cities ? MOD_NAME[modOn()] + ' module on. ' : '') + (s.target !== 15 ? 'First to ' + s.target + ' points. ' : '') + (s.styles === 'mixed' && s.level === 'hard' ? 'Hard computers play in mixed styles. ' : '') + '(Settings)</p>' : '') +
      '</div>' +
      (store.last ? '<button class="btn ghost" data-go="study">Study your last game</button>' : '') +
      '</div>';
  }

  // opt (all optional): { kinds, level, levels, cities, target, rng, firstSeat, daily, tutorial, challenge, styles }
  function startGame(opt) {
    opt = opt || {};
    if (window.COACH && COACH.closeOffer) COACH.closeOffer(); // the "New to Splendor?" offer never sits over a game
    const s = store.settings;
    const kinds = opt.kinds || ['human'].concat(s.seats.filter(k => k !== 'off'));
    const level = opt.level || s.level;
    // each computer seat's level (challenges can mix levels); style = Hard's personality, shown in its name
    const levels = kinds.map((k, i) => (k === 'computer' ? (opt.levels && opt.levels[i]) || level : null));
    let styles = kinds.map(() => null);
    if (opt.styles) styles = opt.styles;
    else if (level === 'hard' && s.styles === 'mixed' && !opt.daily && !opt.tutorial && !opt.challenge) {
      const pool = Object.keys(B.STYLES);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
      let n = 0;
      styles = kinds.map(k => (k === 'computer' ? pool[n++ % pool.length] : null));
    }
    let ci = 0;
    const comps = kinds.filter(k => k === 'computer').length;
    let fi = 1;
    const names = kinds.map((k, i) => i === 0 ? (s.name || 'You') : k === 'computer' ?
      (styles[i] && styles[i] !== 'balanced' ? LV_NAME[levels[i]] + ' · ' + B.STYLES[styles[i]].name : LV_NAME[levels[i]] + (comps > 1 && !opt.levels ? ' ' + (++ci) : '')) : 'Friend ' + (fi++));
    // two computers of one level in a challenge still get told apart
    if (opt.levels) { const seen = {}; names.forEach((nm, i) => { if (kinds[i] !== 'computer') return; seen[nm] = (seen[nm] || 0) + 1; }); const c2 = {}; names.forEach((nm, i) => { if (kinds[i] === 'computer' && seen[nm] > 1) { c2[nm] = (c2[nm] || 0) + 1; names[i] = nm + ' ' + c2[nm]; } }); }
    const rng = opt.rng || Math.random;
    const target = opt.target || (opt.daily || opt.tutorial || opt.challenge ? 15 : s.target);
    // the modules never come into the Daily, the guided game or a challenge (their deals and stars are measured on the base game)
    const module = opt.module !== undefined ? opt.module : (opt.daily || opt.tutorial || opt.challenge ? undefined : modOn());
    const state = E.setup(kinds.length, { cities: opt.cities != null ? opt.cities : (opt.daily || opt.tutorial ? false : s.cities), target, firstSeat: opt.firstSeat, module }, rng, names);
    store.game = { state, kinds, level, levels, styles, started: Date.now(), lastHuman: 0, study: { rec: [], race: [[0, state.players.map(() => 0)]] },
      undo: [], helped: false, hinted: false, recorded: false, myTurns: 0, reserves: 0,
      daily: opt.daily || null, tutorial: !!opt.tutorial, challenge: opt.challenge || null };
    ui.study = store.game.study;
    table = new LocalTable(store.game);
    resetSel(); ui.prev = null; ui.shownSeat = 0; ui.dealAll = true; ui.lastRecord = null;
    save();
    FX.play('shuffle');
    renderPlay();
  }
  // one person against computers on this device (Undo, My stats, challenges and the Daily only apply then)
  const soloVsComputers = g => !!(g && g.kinds && g.kinds.filter(k => k === 'human').length === 1);

  // ---- Undo (vs computers only; never in the Daily, a challenge or the guided game): back to just before your
  // last move, the computers' replies undone too. The game then counts as "with help" (not rated).
  function undoShown() {
    const g = table && !table.online ? table.g : null;
    return !!(g && soloVsComputers(g) && !g.daily && !g.tutorial && !g.challenge);
  }
  function canUndo() { return undoShown() && !table.g.state.over && !!(table.g.undo && table.g.undo.length); }
  function undo() {
    if (!canUndo()) return;
    const g = table.g, u = g.undo.pop();
    clearTimeout(ui.botTimer);
    g.state = u.state; g.helped = true;
    g.study.rec.length = Math.min(g.study.rec.length, u.rec); g.study.race.length = Math.min(g.study.race.length, u.race);
    g.myTurns = u.myTurns; g.reserves = u.reserves;
    ui.prev = null; resetSel(); save(); renderPlay();
    toast('Took back your last move');
  }

  // ---- My stats (js/profile.js + js/spprofile.js): one result per finished game vs computers.
  // Leaving after your first move counts as a loss; Hint or Undo makes it "with help" (not rated).
  const SP = window.SpProfile && window.Profile ? window.SpProfile : null;
  function recordGame() {
    const g = table && !table.online ? table.g : null;
    if (!SP || !g || g.recorded || g.tutorial || g.challenge || !soloVsComputers(g)) return null;
    if (!g.state.over && !g.myTurns) return null; // dealt and left at once: not a game
    g.recorded = true;
    let out = null;
    try {
      const r = SP.result({ state: g.state, me: 0, level: g.level, helped: g.helped, daily: !!g.daily, myTurns: g.myTurns, reserves: g.reserves });
      if (g.daily) r.date = g.daily; // a Daily finished after midnight still belongs to the day it was dealt
      out = window.Profile.recordResult(r);
    } catch (e) { /* the stats never stop the game */ }
    save();
    return out;
  }
  function dailyDone() { try { return !!(window.Profile && window.Profile.daily.played()); } catch (e) { return false; } }
  function busyElsewhere() {
    if (table && table.online) { toast('Leave the online room first'); return true; }
    if (table && !table.g.state.over) { toast('Finish or quit this game first'); return true; }
    return false;
  }
  function startDaily() {
    const P = window.Profile;
    if (!P || !SP) return;
    if (dailyDone()) { openStats('daily'); return; }
    if (busyElsewhere()) return;
    if (P.isOpen()) closeKits();
    const day = P.daily.date();
    if (ui.tab !== 'play') showTab('play', true);
    startGame({ kinds: ['human', 'computer'], level: SP.DAILY.level, styles: [null, 'balanced'], firstSeat: 0, rng: P.daily.rng(day, 'splendor-deal'), daily: day });
  }
  function openStats(t) {
    if (!window.Profile || !SP) return;
    document.querySelectorAll('#sheet, .confirm-back').forEach(x => x.remove());
    window.Profile.openPanel(t ? { tab: t } : undefined);
    if (window.Profile.isOpen()) markOverlay();
  }
  // ---- Rules sheet + guided first game (js/coach.js + js/spcoach.js)
  const SC = window.COACH && window.SpCoach ? window.SpCoach : null;
  function openRules() {
    if (!SC) return;
    document.querySelectorAll('#sheet, .confirm-back').forEach(x => x.remove());
    closeKits();
    COACH.rules(Object.assign({}, SC.RULES, { onClose: () => { if (!ui.closingQuiet) dropOverlay(); } }));
    markOverlay();
  }
  let tour = null;
  function startTutorial() {
    if (!tour) return;
    if (table && table.online) { toast('Leave the online room first'); return; }
    if (table && !table.g.state.over && !table.g.tutorial) { toast('Finish or quit this game first'); return; }
    tour.reset();
    if (ui.tab !== 'play') showTab('play', true);
    startGame({ kinds: ['human', 'computer'], level: SC.GAME.level, styles: [null, null], firstSeat: 0, rng: mulberry(SC.GAME.seed), tutorial: true });
    tour.start(0);
  }
  function offerTutorial() {
    if (!SC || !tour || table || ui.online || ui.tab !== 'play' || COACH.offered(SC.ID)) return;
    setTimeout(() => {
      if (table || ui.online || ui.tab !== 'play' || modalOpen()) return;
      COACH.offer({ id: SC.ID, title: 'New to Splendor?', text: 'Play one guided game against the Easy computer.', yes: 'Teach me', no: 'No thanks', onYes: startTutorial, place: 'auto', avoid: ['#deal'] });
    }, 600);
  }
  // ---- Challenges (js/challenges.js + js/challenge-pars.js): set deals with a goal and stars
  const CH = window.SpChallenges || null;
  const PARS = () => window.SpChallengePars || {};
  const starTxt = n => '<span class="stars" aria-label="' + n + ' of 3 stars">' + [1, 2, 3].map(i => '<i class="' + (i <= n ? 'on' : '') + '">★</i>').join('') + '</span>';
  function openChallenges() {
    if (!CH) return;
    const total = CH.LIST.reduce((a, c) => a + (store.chal[c.id] || 0), 0);
    const rows = CH.LIST.map((c, i) => {
      const par = PARS()[c.id];
      return '<button class="chal-row" data-chal-go="' + c.id + '"><span class="chal-n">' + (i + 1) + '</span><span class="grow"><b>' + esc(c.title) + '</b><span class="muted">' + esc(CH.goalText(c)) + ' · ' + esc(CH.oppText(c)) + '</span>' +
        (par && par[0] ? '<span class="muted chal-par">★★ in ' + par[0] + ' turns · ★★★ in ' + par[1] + '</span>' : '') + '</span>' + starTxt(store.chal[c.id] || 0) + '</button>';
    }).join('');
    sheet('Challenges · ' + total + ' of ' + CH.LIST.length * 3 + ' ★', '<p class="muted small" style="margin:0 0 8px">Set deals, you go first. Meet the goal for a star; finish in fewer of your turns for more. No Undo, and a Hint means one star at most. Not counted in My stats.</p><div class="chal-list">' + rows + '</div>');
    $('#sheet').addEventListener('click', e => {
      const b = e.target.closest('[data-chal-go]');
      if (!b) return;
      closeSheet(); dropOverlay();
      startChallenge(b.dataset.chalGo);
    });
  }
  function startChallenge(id) {
    const c = CH && CH.LIST.find(x => x.id === id);
    if (!c || busyElsewhere()) return;
    if (ui.tab !== 'play') showTab('play', true);
    startGame({ kinds: ['human'].concat(c.opps.map(() => 'computer')), level: c.opps[0], levels: [null].concat(c.opps), styles: c.opps.map(() => null).concat([null]),
      firstSeat: 0, rng: mulberry(c.seed), cities: !!c.cities, target: c.target || 15, challenge: c.id });
  }
  function gradeChallenge() {
    const g = table && !table.online ? table.g : null;
    if (!CH || !g || !g.challenge || !g.state.over) return null;
    const c = CH.LIST.find(x => x.id === g.challenge);
    if (!c) return null;
    const r = CH.grade(c, g.state, 0, { myTurns: g.myTurns, reserves: g.reserves, hinted: g.hinted }, PARS());
    if (!g.graded) {
      g.graded = true;
      const best = store.chal[c.id] || 0;
      r.best = r.stars > best;
      if (r.stars > best) store.chal[c.id] = r.stars;
      g.grade = r;
      save();
    }
    return Object.assign({ c }, g.grade || r);
  }

  // ------------------------------------------------------------------ making a move
  function act(action) {
    if (!table) return;
    const v = table.view(mySeat());
    if (!canAct(v)) return;
    const seat = v.turn;
    const recLen = !table.online ? table.g.study.rec.length : 0;
    // study record: what Hard would have done here, and how much worse this choice scores
    if (v.phase === 'main') recordStudy(v, seat, action);
    if (table.online) {
      net.busy = true; net.sentV = net.snap.v;
      net.timer = setTimeout(unbusy, 8000);
      resetSel();
      net.room.act(action).then(r => { if (!r.ok) { unbusy(); toast(r.message); renderPlay(); } });
      renderPlay();
      return;
    }
    const g = table.g, before = g.state;
    try { g.state = E.apply(before, seat, action); }
    catch (e) { g.study.rec.length = recLen; nope(e.message); return; }
    g.lastHuman = seat;
    if (soloVsComputers(g)) {
      // keep the spot for Undo (the last 8 of your moves), and count your turns and reserves for stats and stars
      if (undoShown()) {
        if (!Array.isArray(g.undo)) g.undo = [];
        g.undo.push({ state: before, rec: recLen, race: g.study.race.length, myTurns: g.myTurns || 0, reserves: g.reserves || 0 });
        if (g.undo.length > 8) g.undo.shift();
      }
      if (v.phase === 'main') { g.myTurns = (g.myTurns || 0) + 1; if (action.t === 'reserve') g.reserves = (g.reserves || 0) + 1; }
    }
    if (window.COACH) COACH.emit('acted');
    afterLocalMove();
  }
  function afterLocalMove() {
    const g = table.g, s = g.state;
    if (s.phase === 'main' || s.over) g.study.race.push([s.turns, s.players.map(p => p.points)]);
    if (s.over) finishLocal();
    resetSel();
    save();
    renderPlay();
  }
  function finishLocal() {
    const g = table.g, s = g.state;
    store.last = { players: s.players.map(p => ({ name: p.name, points: p.points, cards: p.cards.length })), result: s.result, me: 0,
      rec: g.study.rec, race: g.study.race, online: false, kinds: g.kinds };
    g.undo = [];
    ui.lastRecord = recordGame();
    gradeChallenge();
  }
  function recordStudy(v, seat, action) {
    try {
      const hint = B.explain(v, seat);
      const rec = { t: v.turns, seat, did: describe(action), best: describe(hint.action), same: sameAction(action, hint.action), lost: 0, why: hint.why };
      if (!rec.same && table && !table.online) {
        const s = table.g.state;
        const a1 = E.apply(s, seat, action), a2 = E.apply(s, seat, hint.action);
        rec.lost = Math.max(0, Math.round((B.evalFor(E.view(a2, seat), seat) - B.evalFor(E.view(a1, seat), seat)) * 10) / 10);
      } else if (!rec.same) rec.lost = null; // online: the hidden deck isn't here to replay the move
      ui.study.rec.push(rec);
      if (ui.study.rec.length > 200) ui.study.rec.shift();
    } catch (e) { /* study is best-effort */ }
  }

  // computers on this device
  function scheduleBot() {
    clearTimeout(ui.botTimer);
    if (!table || table.online) return;
    const g = table.g, s = g.state;
    if (s.over || g.kinds[s.turn] !== 'computer') return;
    // a tab in the background doesn't play the computers' turns (you'd miss them, and a second tab of the
    // same game would race this one); they play when you come back
    if (document.hidden) return;
    ui.botTimer = setTimeout(() => {
      if (!table || table.online || table.g !== g) return;
      const st = g.state;
      if (st.over || g.kinds[st.turn] !== 'computer') return;
      const seat = st.turn;
      try { g.state = E.apply(st, seat, B.decide(E.view(st, seat), seat, (g.levels && g.levels[seat]) || g.level || 'hard', Math.random, g.styles && g.styles[seat])); }
      catch (e) { g.state = E.apply(st, seat, E.legal(st, seat)[0]); }
      afterLocalMove();
    }, botMs());
  }

  // ------------------------------------------------------------------ the table screen
  function renderGame() {
    const seat = mySeat();
    const v = table.view(seat);
    if (!v) { vPlay.innerHTML = '<div class="setup"><div class="panel"><b>Connecting…</b></div></div>'; return; }
    // friends sharing one phone: cover the table until the next friend is holding it (blind reserves stay secret)
    if (!table.online && !v.over && table.g.kinds.filter(k => k === 'human').length > 1 &&
      table.g.kinds[v.turn] === 'human' && ui.shownSeat !== v.turn) {
      // the move that just ended still sounds (seen from the friend who made it); the table is covered, so no visuals
      if (ui.prev && ui.prevSeat != null) sfx(ui.prev, table.view(ui.prevSeat), ui.prevSeat, ui.wasMy, false, false);
      ui.prev = null; ui.wasMy = false;
      vPlay.innerHTML = '<div class="setup" style="justify-content:center"><div class="panel" style="align-items:center;text-align:center;gap:12px">' +
        '<span class="label">Pass the phone to</span><b style="font-size:24px">' + esc(v.players[v.turn].name) + '</b>' +
        '<p class="muted small" style="margin:0">Only they should look: their reserved cards show next.</p>' +
        '<button class="btn primary" data-ready id="ready" style="width:100%">Show my turn</button></div></div>';
      return;
    }
    const prev = ui.prev;
    const before = captureRects();
    const me = v.players[seat];
    const my = canAct(v) && v.turn === seat;
    const showT = store.settings.showTurns;
    const away = i => !!(table.online && table.snap.seats && table.snap.seats[i] && table.snap.seats[i].kind === 'human' && !table.snap.seats[i].online);

    // the other players, sitting across the table: name plate, their card columns, gems and the cards in their hand
    const seatsRow = v.players.map((p, i) => i === seat ? '' : seatHTML(p, i, v, away(i))).join('');
    const status = '<div class="status"><div class="seats-row n' + (v.players.length - 1) + '">' + seatsRow + '</div><button class="icon-btn" data-menu aria-label="Menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg></button></div>';

    // nobles
    const choose = (v.phase === 'noble' || v.phase === 'city') && my;
    const isCities = v.mode === 'cities';
    const nob = isCities ? v.cities.map(id => Art.city(id, 'noble' + (choose && v.nobleChoice.indexOf(id) >= 0 ? ' choose' : '')).replace('<svg ', '<svg data-city="' + id + '" ')).join('') +
      v.players.filter(p => p.cities.length).map(p => '<span class="small muted">' + esc(p.name) + (p.name === 'You' ? ' have' : ' has') + ' a city</span>').join('') : v.nobles.map(id => {
      const close = NOBLES[id].req.reduce((s, x, k) => s + Math.max(0, x - me.bonus[k]), 0);
      const cls = choose && v.nobleChoice.indexOf(id) >= 0 ? ' choose' : close <= 2 ? ' close' : '';
      return Art.noble(id, 'noble' + cls).replace('<svg ', '<svg data-noble="' + id + '" ');
    }).join('');
    const postsTile = v.mod === 'posts' ? Art.postsMini([0, 1, 2, 3, 4].map(i => v.players.map((p, j) => ((p.posts || []).indexOf(i) >= 0 ? SEAT_COL[j] : null)).filter(Boolean)), 'noble pmini').replace('<svg ', '<svg data-posts="1" id="posts-tile" role="button" ') : '';
    const tgt = v.target || 15;
    const rnd = '<div class="rnd">' + (v.finalRound && !v.over ? '<span class="final">Final round</span><br>' : '') + 'Round <b>' + (Math.floor(v.turns / v.n) + 1) + '</b>' + (tgt !== 15 && !isCities ? ' · to ' + tgt : '') +
      qBtn(isCities ? 'A city comes to you at the end of your turn once you have its prestige and bonuses (grey = that many of one colour; "other" = one colour not already shown). Then the round finishes; only city holders can win, most points first.' :
        'First to ' + tgt + ' prestige ends the game, but the round is finished so everyone has the same number of turns. Most points wins; a tie goes to whoever bought fewer cards.') + '</div>';
    const nobles = '<div class="nobles' + (postsTile ? ' more' : '') + '"><div class="ntiles">' + nob + postsTile + '</div>' + rnd + '</div>';

    // market (Strongholds: the towers standing on cards; in the stronghold step, the cards you may tap)
    const fortTargets = my && v.phase === 'fort' ? fortTargetsFor(v, seat) : null;
    const cqId = my && v.phase === 'conquer' ? v.nobleChoice[0] : null;
    let market = '<div class="market">';
    for (let l = 2; l >= 0; l--) {
      market += '<div class="mrow">';
      const dsel = ui.sel && ui.sel.kind === 'deck' && ui.sel.level === l + 1;
      // the deck is a real stack: its edge gets thinner as cards are drawn
      market += v.deckSizes[l] ? '<div class="slot deck' + (dsel ? ' sel' : '') + (ui.hint && ui.hint.deck === l + 1 ? ' hint' : '') + '" data-deck="' + (l + 1) + '" id="deck-' + (l + 1) + '" style="--stack:' + deckEdge(v.deckSizes[l]) + '">' + Art.back(l + 1) + '<span class="cnt">' + v.deckSizes[l] + '</span></div>' : '<div class="slot empty" id="deck-' + (l + 1) + '"></div>';
      v.market[l].forEach((id, i) => {
        if (id === null) { market += '<div class="slot empty"></div>'; return; }
        const t = E.turnsToAfford(me, id, v.bank);
        const badge = showT ? '<span class="tta' + (t === 0 ? ' now' : t === Infinity ? ' far' : '') + '" style="color:' + (t === 0 ? 'var(--good)' : t === Infinity ? '#59607a' : heat(4 - t, 0, 3)) + '">' + (t === 0 ? '✓' : t === Infinity ? '' : t) + '</span>' : '';
        const isNew = (prev && prev.market[l][i] !== id) || ui.dealAll;
        const sel = ui.sel && ui.sel.kind === 'card' && ui.sel.id === id;
        const hint = (ui.hint && (ui.hint.t === 'buy' || ui.hint.t === 'reserve') && ui.hint.id === id) || cqId === id;
        const fo = v.forts && v.forts[id];
        const fpick = fortTargets && fortTargets.indexOf(id) >= 0, ffrom = ui.fortFrom === id && v.phase === 'fort';
        market += '<div class="slot' + (sel || ffrom ? ' sel' : '') + (hint ? ' hint' : '') + (fpick ? ' fpick' : '') + (fo && fo.seat !== seat ? ' held' : '') + '"' + (isNew ? ' data-dealt="' + (l + 1) + '"' : '') + ' data-card="' + id + '" id="c-' + id + '">' + Art.card(id) + badge +
          (fo ? '<span class="fortb" title="' + esc(v.players[fo.seat].name) + ': ' + fo.n + ' stronghold' + (fo.n > 1 ? 's' : '') + '">' + Art.fort(SEAT_COL[fo.seat], fo.n) + '</span>' : '') + '</div>';
      });
      market += '</div>';
    }
    market += '</div>';

    // bank
    let bank = '<div class="bank" id="bank">';
    for (let k = 0; k < 6; k++) {
      const picked = ui.take.filter(x => x === k).length;
      const hint = ui.hint && ((ui.hint.t === 'take' && ui.hint.g.indexOf(k) >= 0) || (ui.hint.t === 'take2' && ui.hint.c === k));
      const changed = prev && prev.bank[k] !== v.bank[k];
      bank += '<button class="tok' + (v.bank[k] ? '' : ' zero') + (picked ? ' pick' : '') + (hint ? ' hint' : '') + (changed ? ' bump' : '') + '" data-tok="' + k + '" id="t-' + k + '" data-k="' + (picked ? '+' + picked : '') + '" aria-label="' + COLW[k] + ' gems: ' + v.bank[k] + '">' +
        chipStack(k, v.bank[k], 7) + '<span class="n">' + v.bank[k] + '</span></button>';
    }
    bank += '<div class="side">Bank' + qBtn('Take 3 gems of different colours, or 2 of one colour if 4 or more of it are left. Gold only comes from reserving a card. You may hold 10 gems at most.') + '</div></div>';

    // my area
    const discard = v.phase === 'discard' && my;
    let holds = '<div class="holds">';
    for (let k = 0; k < 6; k++) {
      const r = ui.ret[k];
      // each colour: the cards you bought in an overlapping column (as players lay them out), your gems stacked below
      holds += '<div class="hold' + (discard ? ' ret' : '') + '"' + (discard ? ' data-ret="' + k + '"' : '') + '>' + (k < 5 ? cardColumn(k, me.cards, 'col-' + k) : nobleSpot(me, v)) +
        '<button class="htok' + (me.gems[k] ? '' : ' zero') + (discard ? ' ret' : '') + (r ? ' retd' : '') + '" data-r="' + r + '" id="h-' + k + '" aria-label="' + COLW[k] + ' gems held: ' + me.gems[k] + '">' + chipStack(k, me.gems[k], 5, '<b>' + me.gems[k] + '</b>') + '</button></div>';
    }
    holds += '</div>';
    // reserved cards are held in your hand, fanned
    let res = '<div class="res hand n' + me.reserved.length + '" id="my-hand">';
    me.reserved.forEach(r => {
      const sel = ui.sel && ui.sel.kind === 'card' && ui.sel.id === r.id;
      const hint = ui.hint && ui.hint.t === 'buy' && ui.hint.id === r.id;
      res += '<div class="slot' + (sel ? ' sel' : '') + (hint ? ' hint' : '') + '" data-card="' + r.id + '" data-res="1" id="c-' + r.id + '">' + (r.id !== null ? Art.card(r.id) : Art.back(r.level)) + '</div>';
    });
    res += '</div>';
    const meBox = '<div class="me' + (my ? ' turn' : '') + '" id="me-box"><div class="mine-info"><b id="my-pts">' + me.points + '</b>pts<br>' + sum(me.gems) + '/10' + (v.forts ? '<span class="fsup" id="my-forts" title="Strongholds not on a card">' + Art.fort(SEAT_COL[seat]) + E.fortsLeft(v, seat) + '</span>' : '') + '</div>' + holds + res + '</div>';

    // action bar
    const acts = '<div class="acts' + (my ? ' go' : '') + '" id="acts">' + actionBar(v, seat, my) + '</div>';

    // laptop side panel: the race to the target, then the log (opponents now sit across the table)
    const side = '<div id="g-side">' + raceHTML(v, seat) +
      '<div class="panel log-box" style="min-height:0;display:flex;flex-direction:column;gap:6px"><span class="label">Log</span><div class="scroll" id="logbox"><ul class="log">' + logHTML(v, seat) + '</ul></div></div></div>';

    vPlay.classList.add('tbl-surface', 'tbl-wood-dark', 'on-table');
    vPlay.innerHTML = '<div id="game">' + status + nobles + market + bank + meBox + acts + side + '</div>';
    fitMarket();
    if (window.TABLE) TABLE.scatter(vPlay.querySelectorAll('.ntiles > svg'), 'nobles' + v.nobles.concat(v.cities || []).join(), { rot: 3, off: 1 });
    // each face-up card lies a hair off-square, the way hands put cards down (seeded by the card, so it stays put)
    if (window.TABLE) vPlay.querySelectorAll('.market .slot[data-card]').forEach(el => TABLE.scatter([el], 'mk' + el.dataset.card, { rot: 1.2, off: 0.6 }));
    const lb = $('#logbox'); if (lb) lb.scrollTop = lb.scrollHeight;
    // "your turn" for the chime ignores the brief "Sending…" moment online
    const myTurn = !v.over && v.turn === seat && (table.online ? !!table.snap.myTurn : table.g.kinds[v.turn] === 'human');
    const lead = prev ? animateMove(prev, v, before, seat) : 0;
    dealNew(before, lead);
    ui.dealAll = false;
    if (prev) sfx(prev, v, seat, ui.wasMy, myTurn, ui.tab === 'play');
    ui.prev = v; ui.prevSeat = seat; ui.wasMy = myTurn;
    scheduleBot();
    if (v.over && !ui.endShown) { ui.endShown = true; setTimeout(() => { if (ui.tab === 'play') showEnd(v, seat); else ui.endShown = false; }, 900); }
    if (!v.over) ui.endShown = false;
  }

  // cards keep their shape: as tall as a row allows, but never wider than a fifth of the row
  function fitMarket() {
    const m = $('.market');
    if (!m) return;
    const gap = parseFloat(getComputedStyle(m).rowGap) || 6;
    const h = (m.clientHeight - 2 * gap) / 3;
    let w = (m.clientWidth - 4 * gap) / 5;
    const g = $('#game'), side = $('#g-side');
    if (g && side && side.offsetWidth) { // laptop: the market column sizes to its cards, so measure the room around it
      const bk = $('.bank'), nb = $('.nobles');
      const room = g.clientWidth - side.offsetWidth - (bk ? bk.offsetWidth : 0) - (nb ? nb.offsetWidth : 0) - 7 * 14;
      w = (room - 4 * gap) / 5;
    }
    const ch = Math.max(40, Math.floor(Math.min(h, w * 1.4)));
    m.style.setProperty('--ch', ch + 'px');
    // tall phone: the cards are as big as the width allows, so give the spare height to your own cards and gems
    // (instead of an empty band of wood between the bank and your edge of the table)
    if (g && !(side && side.offsetWidth) && innerHeight > innerWidth) {
      const was = g.classList.contains('grow') ? parseFloat(g.style.getPropertyValue('--mex')) || 0 : 0;
      const spare = (m.clientHeight - 3 * ch - 2 * gap) + was;
      const mex = Math.max(0, Math.min(70, Math.floor(spare - 6)));
      if (mex >= 8) { g.classList.add('grow'); g.style.setProperty('--mex', mex + 'px'); }
      else { g.classList.remove('grow'); g.style.removeProperty('--mex'); }
      if (mex !== was) { const h2 = (m.clientHeight - 2 * gap) / 3; m.style.setProperty('--ch', Math.max(40, Math.floor(Math.min(h2, w * 1.4))) + 'px'); }
    } else if (g) { g.classList.remove('grow'); g.style.removeProperty('--mex'); }
  }
  window.addEventListener('resize', fitMarket);
  // ---- table pieces (real-looking cards, chips and stacks; original art)
  // a deck's edge: paper lines under the top card, thinner as the deck shrinks
  function deckEdge(n) {
    const t = window.TABLE ? TABLE.stackShadow(n, { perCard: 0.25, max: 9 }) : null;
    return t ? t.shadow : '0 2px 4px rgba(0,0,0,.4)';
  }
  // a pile of gem chips, each one a little higher; the count rides on the top chip
  function chipStack(k, n, cap, label) {
    const vis = Math.max(1, Math.min(n, cap));
    let s = '<span class="stk" style="--n:' + vis + '">';
    for (let i = 0; i < vis; i++) s += '<span class="st" style="--i:' + i + '">' + Art.chip(k) + (i === vis - 1 && label ? label : '') + '</span>';
    return s + '</span>';
  }
  // the cards of one colour laid in an overlapping column, the way players lay them out: the real cards, each one
  // lower than the last so its top band (points + gem) shows; the newest is in front. Long columns close up so
  // they still fit, and the number of cards rides on the front card once there are two or more.
  function cardColumn(k, cards, id, cap) {
    const all = cards.filter(c => CARDS[c].bonus === k), n = all.length;
    const vis = all.slice(-Math.min(n, cap || 9));
    let s = '<div class="ccol' + (n ? '' : ' none') + '" id="' + id + '" style="--m:' + Math.max(1, vis.length - 1) + '" title="' + n + ' ' + COLW[k] + ' card' + (n === 1 ? '' : 's') + '">';
    vis.forEach((c, i) => { s += '<span class="rc" style="--i:' + i + '">' + Art.card(c) + '</span>'; });
    return s + (n > 1 ? '<b class="cn">' + n + '</b>' : '') + '</div>';
  }
  // nobles (or a city) you earned lie beside your cards
  function nobleSpot(p) {
    const won = (p.cities || []).length ? Art.city(p.cities[p.cities.length - 1], 'mnob') : p.nobles.length ? Art.noble(p.nobles[p.nobles.length - 1], 'mnob') : '';
    const n = p.nobles.length + (p.cities || []).length;
    return '<div class="ccol nobcol" id="col-5">' + won + (n > 1 ? '<b class="nn">' + n + '</b>' : '') + '</div>';
  }
  // another player's place at the table
  function seatHTML(p, i, v, isAway) {
    const cols = [0, 1, 2, 3, 4].map(k => cardColumn(k, p.cards, 'oc-' + i + '-' + k, 5)).join('');
    const gems = [0, 1, 2, 3, 4, 5].map(k => '<span class="og' + (p.gems[k] ? '' : ' zero') + '" id="og-' + i + '-' + k + '">' + chipStack(k, p.gems[k], 4, '<b>' + p.gems[k] + '</b>') + '</span>').join('');
    const handBacks = p.reserved.map(r => '<span class="hb">' + Art.back(r.id !== null ? CARDS[r.id].level : r.level) + '</span>').join('') + (p.reserved.length > 1 ? '<b class="hn">' + p.reserved.length + '</b>' : '');
    // held in their hand, so from across the table you see the backs (the level shows); tap the seat to see the ones taken face up
    const handCards = p.reserved.map(r => '<span class="hc">' + Art.back(r.id !== null ? CARDS[r.id].level : r.level) + '</span>').join('');
    const nob = p.nobles.length + (p.cities || []).length;
    return '<div class="seat' + (i === v.turn && !v.over ? ' turn' : '') + (isAway ? ' away' : '') + '" data-player="' + i + '" id="chip-' + i + '">' +
      '<div class="plate" style="--sc:' + SEAT_COL[i] + '"><span class="dot" style="background:' + SEAT_COL[i] + '"></span><span class="nmx">' + esc(p.name) + '</span>' +
      (handBacks ? '<span class="hand-ph" id="oh-' + i + '">' + handBacks + '</span>' : '') +
      (nob ? '<span class="onob" title="' + nob + (v.mode === 'cities' ? ' city' : ' noble') + '">' + nob + '</span>' : '') + '<b class="pts">' + p.points + '</b></div>' +
      '<div class="otab"><div class="ocols">' + cols + '</div><div class="ogems">' + gems + '</div>' +
      '<span class="gtot" title="gems held"><i></i>' + sum(p.gems) + '</span>' + (handCards ? '<div class="hand-lp" id="ohl-' + i + '">' + handCards + '</div>' : '') + '</div></div>';
  }
  // everyone's points toward the target, with what they hold: fills the laptop side panel from the first turn
  function raceHTML(v, seat) {
    const goal = E.targetOf(v);
    const order = v.players.map((p, i) => i);
    const rows = order.map(i => {
      const p = v.players[i];
      const bonus = [0, 1, 2, 3, 4].map(k => p.cards.filter(c => CARDS[c].bonus === k).length);
      const nob = p.nobles.length + (p.cities || []).length;
      return '<div class="rrow' + (i === v.turn && !v.over ? ' turn' : '') + '"><div class="rtop"><span class="dot" style="background:' + SEAT_COL[i] + '"></span><span class="rname">' + esc(i === seat ? 'You' : p.name) + '</span>' +
        '<b class="rpts">' + p.points + '</b></div>' +
        '<div class="rbar"><i style="width:' + Math.min(100, Math.round(100 * p.points / goal)) + '%;background:' + SEAT_COL[i] + '"></i></div>' +
        '<div class="rbon">' + bonus.map((n, k) => '<span class="rb k' + k + (n ? '' : ' z') + '" title="' + n + ' ' + COLW[k] + ' card' + (n === 1 ? '' : 's') + '">' + n + '</span>').join('') +
        '<span class="rx" title="gems held">' + sum(p.gems) + ' gems</span>' + (p.reserved.length ? '<span class="rx">' + p.reserved.length + ' held</span>' : '') +
        (nob ? '<span class="rx">' + nob + (v.mode === 'cities' ? ' city' : nob === 1 ? ' noble' : ' nobles') + '</span>' : '') + '</div></div>';
    }).join('');
    return '<div class="panel race-box"><span class="label">Race to ' + goal + (v.finalRound && !v.over ? ' · final round' : '') + '</span>' + rows + '</div>';
  }
  function logHTML(v, seat) {
    return v.log.slice(-30).map(l => '<li class="' + (l.seat === seat ? 'mine' : '') + '">' + esc(l.text) + '</li>').join('');
  }

  function actionBar(v, seat, my) {
    const me = v.players[seat];
    const undoBtn = my && canUndo() ? '<button class="btn ghost" data-undo id="undo" aria-label="Undo your last move"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/></svg></button>' : '';
    const hintBtn = undoBtn + (store.settings.hints && my && v.phase === 'main' ? '<button class="btn ghost" data-hint id="hint">Hint</button>' : '');
    if (v.over) {
      const w = v.result.winners;
      return '<div class="say"><b>' + (w.length > 1 ? 'Shared win' : esc(w[0] === seat ? 'You win!' : v.players[w[0]].name + ' wins')) + '</b> · ' + v.players.map(p => p.points).join(' – ') + '</div>' +
        '<button class="btn" data-end>Results</button>' + (table.online ? '<button class="btn primary" data-leave>Leave</button>' : '<button class="btn primary" data-new>New game</button>');
    }
    if (!my) {
      const who = v.players[v.turn].name;
      let txt;
      if (table.online && table.snap.hostAway) txt = 'The host’s connection dropped. Another player takes over in about a minute.';
      else if (net.busy) txt = 'Sending…';
      else txt = esc(who) + (kindOf(v.turn) === 'computer' ? ' is thinking…' : '’s turn');
      const last = v.log.length ? v.log[v.log.length - 1] : null;
      return '<div class="say"><b>' + txt + '</b>' + (last ? '<br>' + esc(last.text) : '') + '</div>';
    }
    if (v.phase === 'discard') {
      const need = sum(me.gems) - 10, got = sum(ui.ret);
      return '<div class="say"><b>Too many gems.</b> Tap ' + (need - got > 0 ? (need - got) + ' more' : 'Return') + ' of yours to give back (10 max).</div>' +
        '<button class="btn ghost" data-clear>Clear</button><button class="btn primary" data-return' + (got === need ? '' : ' disabled') + '>Return ' + need + '</button>';
    }
    if (v.phase === 'noble') return '<div class="say"><b>' + (['Two', 'Three', 'Four', 'Five'][v.nobleChoice.length - 2] || 'Several') + ' nobles want to visit.</b> Tap the one you want.</div>';
    if (v.phase === 'city') return '<div class="say"><b>You qualify for more than one city.</b> Tap the one you take.</div>';
    if (v.phase === 'gem') return '<div class="say"><b>Trading post: take 1 free gem.</b> Tap ' + (v.gemNot >= 0 ? 'a colour other than ' + COLW[v.gemNot] : 'any colour') + ' in the bank.</div>';
    if (v.phase === 'fort') {
      const left = E.fortsLeft(v, seat), canRm = E.legal(v, seat).some(m => m.rm !== undefined);
      if (ui.fortFrom != null) return '<div class="say"><b>Move this stronghold.</b> Tap the card it goes to.</div><button class="btn ghost" data-fcancel>Cancel</button>';
      return '<div class="say"><b>Stronghold.</b> ' + (left ? 'Tap a card to put one on it (' + left + ' left)' : 'Tap one of yours to move it') + (canRm ? ', or tap another player’s to knock it off.' : '.') + '</div>';
    }
    if (v.phase === 'conquer') {
      const id = v.nobleChoice[0], pay = E.autoPay(me, id);
      return '<div class="say"><b>All 3 strongholds hold your ' + esc(cardName(id)) + '.</b> Buy it now as well' + (pay && pay[5] ? ' (uses ' + pay[5] + ' gold)' : '') + '?</div>' +
        '<button class="btn ghost" data-cq-skip id="cq-skip">Skip</button><button class="btn primary" data-cq id="cq-buy">Buy</button>';
    }
    const leg = E.legal(v, seat);
    if (leg.length === 1 && leg[0].t === 'pass') return '<div class="say"><b>No legal move.</b> You must pass.</div><button class="btn primary" data-pass>Pass</button>';
    if (ui.take.length) {
      const ok = takeAction(v);
      const k = ui.take;
      const txt = k.length === 2 && k[0] === k[1] ? '2 ' + COLW[k[0]] : k.map(x => COLW[x]).join(', ');
      const over = sum(me.gems) + k.length - 10;
      const left = Math.min(3, [0, 1, 2, 3, 4].filter(x => v.bank[x] > 0).length) - k.length;
      const more = left > 0 ? 'Pick ' + left + ' more colour' + (left > 1 ? 's' : '') + (k.length === 1 && v.bank[k[0]] >= 4 ? ' (or tap it again for 2).' : '.') : 'Tap a colour again to put it back.';
      return '<div class="say"><b>Take ' + txt + '</b>' + (ok ? (over > 0 ? '<br>You’ll return ' + over + '.' : '') : '<br>' + more) + '</div>' +
        '<button class="btn ghost" data-clear>Clear</button><button class="btn primary" data-take' + (ok ? '' : ' disabled') + ' id="do-take">Take</button>';
    }
    if (ui.sel && ui.sel.kind === 'card') {
      const id = ui.sel.id;
      const mine = me.reserved.some(r => r.id === id);
      const fo = !mine && v.forts && v.forts[id];
      if (fo && fo.seat !== seat) return '<div class="say"><b>' + esc(cardName(id)) + '</b><br>' + esc(v.players[fo.seat].name) + '’s stronghold' + (fo.n > 1 ? 's hold' : ' holds') + ' it: only they can buy or reserve it.</div>';
      const t = E.turnsToAfford(me, id, v.bank);
      const canBuy = E.autoPay(me, id) !== null;
      const pay = canBuy ? E.autoPay(me, id) : null;
      const gold = pay ? pay[5] : 0;
      const info = canBuy ? 'Buy now' + (gold ? ' (uses ' + gold + ' gold)' : '') : t === Infinity ? 'Out of reach for now' : t + ' turn' + (t > 1 ? 's' : '') + ' of gems away';
      return '<div class="say"><b>' + esc(cardName(id)) + '</b><br>' + info + '</div>' +
        (!mine && me.reserved.length < 3 ? '<button class="btn" data-reserve id="do-reserve">Reserve</button>' : '') +
        '<button class="btn primary" data-buy id="do-buy"' + (canBuy ? '' : ' disabled') + '>Buy</button>';
    }
    if (ui.sel && ui.sel.kind === 'deck') {
      return '<div class="say"><b>Level ' + ui.sel.level + ' deck</b><br>' + (me.reserved.length < 3 ? 'Reserve the top card unseen' + (v.bank[5] ? ' + 1 gold.' : '.') : 'You already hold 3 reserved cards.') + '</div>' +
        '<button class="btn primary" data-reserve id="do-reserve"' + (me.reserved.length < 3 ? '' : ' disabled') + '>Reserve</button>';
    }
    if (ui.hint) return '<div class="say"><b>Hint: ' + esc(describe(ui.hint)) + '</b><br>' + esc(ui.hintWhy || '') + '</div>' + hintBtn;
    // after the opening, the line says what the player before you just did (on phones the log is a tap away)
    const prevMove = v.turns >= v.n * 2 ? v.log.slice().reverse().find(l => l.seat !== seat && l.t >= v.turns - v.n) : null;
    if (prevMove) return '<div class="say"><b>Your turn.</b> ' + esc(prevMove.text) + '.</div>' + hintBtn;
    return '<div class="say"><b>Your turn.</b> Tap gems to take, or a card to buy or reserve.</div>' + hintBtn;
  }

  function takeAction(v) {
    const k = ui.take;
    if (k.length === 2 && k[0] === k[1]) return v.bank[k[0]] >= 4 ? { t: 'take2', c: k[0] } : null;
    const avail = [0, 1, 2, 3, 4].filter(x => v.bank[x] > 0).length;
    if (k.length && k.length === Math.min(3, avail) && new Set(k).size === k.length) return { t: 'take', g: k.slice() };
    return null;
  }

  // ------------------------------------------------------------------ motion: cards and gems travel
  function captureRects() {
    const r = {};
    vPlay.querySelectorAll('[data-card], [data-tok], .seat[data-player], #me-box, [data-deck], .htok, .og').forEach(el => { r[el.dataset.deck ? 'd' + el.dataset.deck : el.id] = { rect: el.getBoundingClientRect() }; });
    return r;
  }
  // Animations off = nothing flies; Fast = about half the time.
  // A flying piece is a fresh, solid copy of the card or chip (no badges, no see-through fade), so it looks exactly like the
  // real thing in the hand. Cards can turn over in 3-D on the way (face-down from a deck, face-up on arrival).
  const shown = el => (el && el.getBoundingClientRect().width > 0 ? el : null);
  function fly(fromRect, toEl, front, o) {
    o = o || {};
    // nothing flies while another tab is showing (a computer can move while you read the Cards tab)
    if (!fromRect || !toEl || !document.body.animate || !anim() || ui.tab !== 'play') { if (o.onDone) o.onDone(); return; }
    const to = toEl.getBoundingClientRect();
    const W = o.w || fromRect.width, H = o.h || fromRect.height;
    const x0 = fromRect.left + fromRect.width / 2 - W / 2, y0 = fromRect.top + fromRect.height / 2 - H / 2;
    const f = document.createElement('div');
    f.className = 'flyer' + (o.card ? ' card-fly' : '');
    f.innerHTML = o.back ? '<div class="fi"><div class="ff">' + front + '</div><div class="fb">' + o.back + '</div></div>' : front;
    Object.assign(f.style, { left: x0 + 'px', top: y0 + 'px', width: W + 'px', height: H + 'px' });
    const ms = Math.round((o.ms || 480) * spd()), delay = Math.round((o.delay || 0) * spd());
    document.body.appendChild(f);
    // land at the size of what it lands on (a card in a column, a hand, a seat), never bigger than it started
    const s = o.scale != null ? o.scale : Math.max(0.2, Math.min(1, (o.card ? to.height / H : to.width / W) || 1));
    const dx = to.left + to.width / 2 - (x0 + W / 2), dy = to.top + to.height / 2 - (y0 + H / 2);
    const rot = o.rot || 0;
    const timing = { duration: ms, delay, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'both' };
    const a = f.animate([{ transform: 'translate(0,0) scale(1) rotate(0deg)' }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + s + ') rotate(' + rot + 'deg)' }], timing);
    const inner = o.back && f.firstChild;
    if (inner) { // face-down: 180; turning up on the way = 180 -> 0
      const r0 = o.flip === 'up' || o.flip === 'stay' ? 180 : 0, r1 = o.flip === 'up' ? 0 : r0;
      inner.style.transform = 'rotateY(' + r1 + 'deg)';
      if (r0 !== r1) inner.animate([{ transform: 'rotateY(' + r0 + 'deg)', offset: 0 }, { transform: 'rotateY(' + r0 + 'deg)', offset: 0.35 }, { transform: 'rotateY(' + r1 + 'deg)' }], timing);
    }
    const done = () => { f.remove(); if (o.onDone) o.onDone(); };
    a.onfinish = done;
    setTimeout(() => { if (f.parentNode) done(); }, delay + ms + 400);
  }
  // one gem chip gliding (taking, paying back to the bank, returning over 10)
  const chipSize = k => { const t = $('#t-' + k); return t ? Math.min(44, t.querySelector('.st').getBoundingClientRect().width || 30) : 30; };
  function flyChip(fromRect, k, toEl, delay) {
    const z = chipSize(k);
    fly(fromRect, toEl, Art.chip(k), { w: z, h: z, delay, ms: 420, scale: Math.max(0.5, Math.min(1, (toEl.getBoundingClientRect().width || z) / z)) });
  }
  // where things land
  const cardSpot = (who, seat, k) => (who === seat ? shown($('#col-' + k)) : shown($('#oc-' + who + '-' + k))) || (who === seat ? $('#me-box') : $('#chip-' + who));
  const handSpot = (who, seat) => (who === seat ? shown($('#my-hand .slot:last-child')) || $('#my-hand') : shown($('#ohl-' + who + ' .hc:last-child')) || shown($('#oh-' + who)) || $('#chip-' + who));
  const gemSpot = (who, seat, k) => (who === seat ? $('#h-' + k) : shown($('#og-' + who + '-' + k)) || shown($('#chip-' + who + ' .gtot')) || $('#chip-' + who));
  // the card in your hand appears when the flying copy lands on it, not before
  const hideTill = el => { if (!el || !el.classList.contains('slot')) return null; el.style.visibility = 'hidden'; return () => { el.style.visibility = ''; }; };
  // returns how long the main flight takes, so a replacement card is dealt after it
  function animateMove(prev, v, before, seat) {
    const L = v.last;
    if (!L || v.turns === prev.turns && v.phase === prev.phase && JSON.stringify(v.bank) === JSON.stringify(prev.bank)) return 0;
    if (!anim()) return 0;
    const who = L.seat;
    if (!(who === seat ? $('#me-box') : $('#chip-' + who))) return 0;
    let lead = 0;
    const fromOf = k => (who === seat && before['h-' + k] ? before['h-' + k] : before['og-' + who + '-' + k] || before['chip-' + who] || before['me-box']);
    if (prev.phase === 'main') {
      const p = v.players[who];
      if (L.t === 'buy' && L.id != null && before['c-' + L.id]) { // the card is laid on its colour column
        fly(before['c-' + L.id].rect, cardSpot(who, seat, CARDS[L.id].bonus), Art.card(L.id), { card: true });
        lead = 380;
      } else if (L.t === 'reserve' && L.id != null && before['c-' + L.id]) { // picked up into the hand
        const to = handSpot(who, seat), land = hideTill(who === seat ? to : null);
        fly(before['c-' + L.id].rect, to, Art.card(L.id), { card: true, rot: who === seat ? 6 : 0, onDone: land });
        lead = 380;
      } else if (L.t === 'reserve' && L.deck && before['d' + L.deck]) { // top card off the deck; you see it turn over, others don't
        const mine = who === seat && p.reserved.length && p.reserved[p.reserved.length - 1].id != null;
        const front = mine ? Art.card(p.reserved[p.reserved.length - 1].id) : Art.back(L.deck);
        const to = handSpot(who, seat), land = hideTill(who === seat ? to : null);
        fly(before['d' + L.deck].rect, to, front, { card: true, back: Art.back(L.deck), flip: mine ? 'up' : 'stay', rot: who === seat ? 6 : 0, onDone: land });
      }
      if (L.t === 'reserve' && v.bank[5] < prev.bank[5] && before['t-5']) flyChip(before['t-5'].rect, 5, gemSpot(who, seat, 5), 120);
      if (L.t === 'buy' && L.pay) { // the payment slides back to the bank, one chip per colour paid
        let n = 0;
        L.pay.forEach((x, k) => { const f = fromOf(k), to = $('#t-' + k); if (x > 0 && f && to) flyChip(f.rect, k, to, 140 + n++ * 60); });
      }
      if ((L.t === 'take' || L.t === 'take2') && L.g) {
        L.g.forEach((k, i) => { const b = before['t-' + k]; if (b) flyChip(b.rect, k, gemSpot(who, seat, k), i * 70); });
      }
    }
    if (L.returned) { // gems over the 10 limit go back
      let n = 0;
      L.returned.forEach((x, k) => { const f = fromOf(k), to = $('#t-' + k); if (x > 0 && f && to) flyChip(f.rect, k, to, (prev.phase === 'main' ? 380 : 0) + n++ * 60); });
    }
    return lead;
  }
  // a card that just appeared in the market is dealt from its deck: it slides off the stack face-down and turns over
  function dealNew(before, lead) {
    const news = [...vPlay.querySelectorAll('[data-dealt]')];
    if (!news.length || !anim() || !document.body.animate) return;
    news.forEach((el, n) => {
      const l = Number(el.dataset.dealt), id = Number(el.dataset.card);
      const deck = shown($('#deck-' + l)), from = deck ? deck.getBoundingClientRect() : before['d' + l] && before['d' + l].rect;
      if (!from) return;
      el.style.visibility = 'hidden';
      fly(from, el, Art.card(id), { card: true, back: Art.back(l), flip: 'up', scale: 1, delay: lead + n * 70, ms: 520,
        onDone: () => { el.style.visibility = ''; } });
    });
  }

  // sounds + the effects that go with them (sfx.js decides what happened; switches live in Settings)
  function meSeats(seat) {
    if (!table) return [seat];
    if (table.online) return [table.snap.mySeat];
    return table.g.kinds.map((k, i) => (k === 'human' ? i : -1)).filter(i => i >= 0);
  }
  const targetEl = (who, seat) => (who === seat ? $('#me-box') : $('#chip-' + who));
  // a key moment (a noble's visit, a city, the final round) shown big over the table for a moment; off with animations
  function moment(art, title, sub, tone) {
    if (!anim() || ui.tab !== 'play') return;
    const old = document.querySelector('.moment'); if (old) old.remove();
    const d = document.createElement('div');
    d.className = 'moment' + (tone ? ' ' + tone : '');
    d.setAttribute('aria-live', 'polite');
    d.innerHTML = (art ? '<div class="mo-pic">' + art + '</div>' : '') + '<div class="mo-txt"><b>' + title + '</b><span>' + sub + '</span></div>';
    document.body.appendChild(d);
    const ms = 1900 * spd();
    const a = d.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.06)', offset: 0.12 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.2 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.82 },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.96)' }], { duration: ms, easing: 'ease-out', fill: 'forwards' });
    a.onfinish = () => d.remove();
    setTimeout(() => d.remove(), ms + 300);
  }
  const scoreEls = (who, seat) => [who === seat ? $('#my-pts') : null, $('#chip-' + who + ' .pts')].filter(Boolean);
  function sfx(prev, v, seat, myPrev, myNow, visuals) {
    let list;
    try { list = SpSfx.events(prev, v, seat, { meSeats: meSeats(seat), myPrev, myNow }); } catch (e) { return; }
    if (!list.length) return;
    // scores count up from the old number once the card lands
    if (visuals && anim()) list.forEach(e => { if (e.fx === 'score') scoreEls(e.who, seat).forEach(el => { el.textContent = e.from; }); });
    const live = () => visuals && ui.tab === 'play' && table;
    SpSfx.run(list, FX, {
      el: who => (live() ? targetEl(who, seat) : null),
      colors: w => (Array.isArray(w) ? w.map(i => SEAT_COL[i]) : [SEAT_COL[w]]).concat(['#f0b354', '#e8eaf0', '#6ee7a8', '#f08c8c', '#b48cff']),
      visual: e => {
        if (!live()) return;
        if (e.fx === 'score') {
          scoreEls(e.who, seat).forEach(el => FX.countUp(el, e.from, e.to, { duration: 500 }));
          const t = targetEl(e.who, seat); if (t) FX.floatText(t, '+' + (e.to - e.from), 'var(--accent-warm)');
        } else if (e.fx === 'big') {
          const t = targetEl(e.who, seat); if (t) FX.pop(t);
          const p = v.players[e.who], mine = meSeats(seat).indexOf(e.who) >= 0;
          const art = e.what === 'city' ? Art.city(p.cities[p.cities.length - 1], 'mo-art') : Art.noble(p.nobles[p.nobles.length - 1], 'mo-art');
          moment(art, e.what === 'city' ? (mine ? 'You take a city' : esc(p.name) + ' takes a city') : (mine ? 'A noble visits you' : 'A noble visits ' + esc(p.name)),
            e.what === 'city' ? 'Only a player with a city can win' : '+3 points', mine ? 'good' : '');
        } else if (e.fx === 'final') {
          const r = $('.nobles .rnd'); if (r) FX.pulse(r);
          const lead = v.players.reduce((b, p, i) => (p.points > v.players[b].points ? i : b), 0);
          moment('', 'Final round', (v.mode === 'cities' ? 'A city is taken.' : (meSeats(seat).indexOf(lead) >= 0 ? 'You have ' : esc(v.players[lead].name) + ' has ') + v.players[lead].points + ' points.') + ' Play ends with this round.', 'warn');
        }
        else if (e.fx === 'turn') { const m = $('#me-box'); if (m) FX.flash(m, 'rgba(110,168,254,.5)'); }
      },
    });
  }

  // ------------------------------------------------------------------ input
  vPlay.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-q]')) return;
    const go = t.closest('[data-go]');
    if (go) { showTab(go.dataset.go, true); return; }
    const ssw = t.closest('[data-setup-sw]');
    if (ssw) { store.settings[ssw.dataset.setupSw] = ssw.checked; save(); return; }
    const sk = t.closest('[data-seat-kind] button');
    if (sk) { store.settings.seats[Number(sk.parentElement.dataset.seatKind)] = sk.dataset.v; save(); renderPlay(); return; }
    const segb = t.closest('[data-set] button');
    if (segb) { store.settings[segb.parentElement.dataset.set] = segb.dataset.v; save(); renderPlay(); return; }
    if (t.closest('[data-start]')) { startGame(); return; }
    if (t.closest('[data-daily]')) { startDaily(); return; }
    if (t.closest('[data-chal]')) { openChallenges(); return; }
    if (t.closest('[data-rules]')) { openRules(); return; }
    if (t.closest('[data-stats]')) { openStats(); return; }
    const on = t.closest('[data-on]');
    if (on) { onlineBtn(on.dataset.on); return; }
    const sb = t.closest('[data-seat]');
    if (sb && net.room) { net.room.setSeat(Number(sb.dataset.seat), sb.dataset.kind); return; }
    if (!table) return;
    if (t.closest('[data-ready]')) { if (!table.online) ui.shownSeat = table.g.state.turn; renderPlay(); return; }
    const seat = mySeat();
    const v = table.view(seat);
    if (!v) return;
    const pl = t.closest('[data-player]');
    if (pl) { showPlayer(v, Number(pl.dataset.player), seat); return; }
    if (t.closest('[data-menu]')) { menu(v); return; }
    if (t.closest('[data-posts]')) { showPosts(v, seat); return; }
    if (t.closest('[data-end]')) { showEnd(v, seat); return; }
    if (t.closest('[data-new]')) { newGameAsk(); return; }
    if (t.closest('[data-leave]')) { leaveOnline(); return; }
    const my = canAct(v) && v.turn === seat;
    if (!my) {
      { const hit = t.closest('[data-card], [data-tok], [data-deck]'); if (hit) nope(v.over ? 'The game is over' : 'Not your turn yet', hit); }
      return;
    }
    const me = v.players[seat];
    if (t.closest('[data-undo]')) { undo(); return; }
    if (t.closest('[data-hint]')) {
      if (!table.online) {
        const g = table.g;
        if (!g.hinted && countsInStats(g)) toast('Hints are on: this game counts as “with help” in My stats');
        else if (!g.hinted && g.challenge) toast('With a Hint this challenge earns 1 star at most');
        g.helped = true; g.hinted = true; save();
      }
      const h = B.explain(v, seat);
      ui.hint = h.action; ui.hintWhy = h.why; ui.sel = null; ui.take = [];
      renderPlay(); return;
    }
    if (t.closest('[data-pass]')) { act({ t: 'pass' }); return; }
    if (v.phase === 'gem') {
      const tk = t.closest('[data-tok]');
      if (tk) { const k = Number(tk.dataset.tok); if (E.gemChoices(v, v.gemNot).indexOf(k) >= 0) act({ t: 'gem', c: k }); else nope(k === 5 ? 'The free gem can’t be gold' : !v.bank[k] ? 'No ' + COLW[k] + ' left' : 'Take a colour other than ' + COLW[k], tk); return; }
      const h = t.closest('[data-card], [data-deck]'); if (h) nope('Take your free gem from the bank first', h);
      return;
    }
    if (v.phase === 'fort') {
      if (t.closest('[data-fcancel]')) { ui.fortFrom = null; renderPlay(); return; }
      const cd = t.closest('.market [data-card]');
      if (!cd) { const h = t.closest('[data-card], [data-tok], [data-deck]'); if (h) nope('Put your stronghold on a card on the table first', h); return; }
      const id = Number(cd.dataset.card), moves = E.legal(v, seat);
      if (ui.fortFrom != null) {
        if (id === ui.fortFrom) { ui.fortFrom = null; renderPlay(); return; }
        const m = moves.find(x => x.from === ui.fortFrom && x.id === id);
        if (m) act(m); else nope('A stronghold can’t go there', cd);
        return;
      }
      const m = moves.find(x => x.rm === id) || moves.find(x => x.id === id && x.from === undefined);
      if (m) { act(m); return; }
      if (moves.some(x => x.from === id)) { ui.fortFrom = id; renderPlay(); return; }
      nope(v.forts[id] && v.forts[id].n >= 3 ? 'A card holds 3 strongholds at most' : 'A stronghold can’t go there', cd);
      return;
    }
    if (v.phase === 'conquer') {
      if (t.closest('[data-cq]')) { act({ t: 'conquer' }); return; }
      if (t.closest('[data-cq-skip]')) { act({ t: 'skip' }); return; }
      const h = t.closest('[data-card], [data-tok], [data-deck]'); if (h) nope('Buy the card your strongholds hold, or Skip', h);
      return;
    }
    if (v.phase === 'city') { const c = t.closest('[data-city]'); if (c && v.nobleChoice.indexOf(Number(c.dataset.city)) >= 0) act({ t: 'city', id: Number(c.dataset.city) }); return; }
    if (v.phase === 'noble') { const n = t.closest('[data-noble]'); if (n && v.nobleChoice.indexOf(Number(n.dataset.noble)) >= 0) act({ t: 'noble', id: Number(n.dataset.noble) }); return; }
    if (v.phase === 'discard') {
      const h = t.closest('[data-ret]');
      if (h) {
        const k = Number(h.dataset.ret);
        const need = sum(me.gems) - 10;
        if (!me.gems[k]) { nope('You hold no ' + COLW[k] + ' gems', h); return; }
        if (ui.ret[k] < me.gems[k] && sum(ui.ret) < need) ui.ret[k]++;
        else if (ui.ret[k] > 0) ui.ret[k]--;
        renderPlay(); return;
      }
      if (t.closest('[data-clear]')) { ui.ret = [0, 0, 0, 0, 0, 0]; renderPlay(); return; }
      if (t.closest('[data-return]')) { act({ t: 'discard', g: ui.ret.slice() }); return; }
      return;
    }
    if (t.closest('[data-clear]')) { resetSel(); renderPlay(); return; }
    if (t.closest('[data-take]')) { const a = takeAction(v); if (a) act(a); return; }
    if (t.closest('[data-buy]') && ui.sel && ui.sel.kind === 'card') { act({ t: 'buy', id: ui.sel.id }); return; }
    if (t.closest('[data-reserve]') && ui.sel) { act(ui.sel.kind === 'deck' ? { t: 'reserve', deck: ui.sel.level } : { t: 'reserve', id: ui.sel.id }); return; }
    const tok = t.closest('[data-tok]');
    if (tok) {
      const k = Number(tok.dataset.tok);
      ui.sel = null; ui.hint = null;
      if (k === 5) { nope('Gold comes only from reserving a card', tok); return; }
      if (!v.bank[k]) { nope('No ' + COLW[k] + ' left', tok); return; }
      const has = ui.take.indexOf(k) >= 0;
      if (has && ui.take.length === 1) {
        if (v.bank[k] >= 4) ui.take = [k, k]; else { nope('2 of a colour needs 4 left in the bank', tok); }
      } else if (has) ui.take.splice(ui.take.indexOf(k), 1);
      else if (ui.take.length === 2 && ui.take[0] === ui.take[1]) ui.take = [k];
      else if (ui.take.length < 3) ui.take.push(k);
      else { nope('3 gems at most. Tap one you picked to put it back.', tok); return; }
      renderPlay(); return;
    }
    const cd = t.closest('[data-card]');
    if (cd) {
      const id = Number(cd.dataset.card);
      if (cd.dataset.card === 'null') return;
      ui.take = []; ui.hint = null;
      ui.sel = ui.sel && ui.sel.kind === 'card' && ui.sel.id === id ? null : { kind: 'card', id };
      renderPlay(); return;
    }
    const dk = t.closest('[data-deck]');
    if (dk) {
      const l = Number(dk.dataset.deck);
      ui.take = []; ui.hint = null;
      ui.sel = ui.sel && ui.sel.kind === 'deck' && ui.sel.level === l ? null : { kind: 'deck', level: l };
      renderPlay(); return;
    }
  });

  function showPlayer(v, i, seat) {
    const p = v.players[i];
    const rows = [0, 1, 2, 3, 4, 5].map(k => '<tr><td>' + Art.gem(k) + ' ' + COLW[k] + '</td><td class="pct">' + (k < 5 ? p.bonus[k] : '') + '</td><td class="pct">' + p.gems[k] + '</td></tr>').join('');
    const res = p.reserved.map(r => '<div style="height:84px">' + (r.id !== null ? Art.card(r.id) : Art.back(r.level)) + '</div>').join('');
    sheet(p.name + ' · ' + p.points + ' points',
      '<table class="turns"><tr><th>Colour</th><th>Cards</th><th>Gems</th></tr>' + rows + '</table>' +
      '<p class="small muted" style="margin:8px 0 4px">' + p.cards.length + ' cards bought · ' + p.nobles.length + ' noble' + (p.nobles.length === 1 ? '' : 's') + '</p>' +
      (res ? '<span class="label">Reserved</span><div class="row" style="margin-top:6px">' + res + '</div>' : '') +
      '<span class="label" style="display:block;margin-top:10px">Recent moves</span><ul class="log">' + logHTML(v, seat) + '</ul>');
    document.querySelectorAll('#sheet .row svg.card').forEach(s => { s.style.height = '84px'; s.style.width = 'auto'; });
  }
  // Trading posts: the five tiles with their powers and who holds each
  const POST_TXT = ['After each buy, take 1 gem (any colour but gold).', 'When you take 2 of one colour, take 1 gem of another colour too.',
    'Each gold you pay with counts as 2 gems of one colour.', '5 points.', '1 point for each of your coats of arms, this one included.'];
  function showPosts(v, seat) {
    const rows = SpCards.POSTS.map(t => {
      const who = v.players.map((p, j) => ((p.posts || []).indexOf(t.id) >= 0 ? (j === seat ? 'You' : p.name) : null)).filter(Boolean);
      const need = t.req.map((x, k) => (x ? x + ' ' + COLW[k] : '')).filter(Boolean).join(' + ') + ' cards' + (t.noble ? ' and a noble' : '');
      return '<div class="post-row">' + Art.post(t.id, v.players.map((p, j) => ((p.posts || []).indexOf(t.id) >= 0 ? SEAT_COL[j] : null)).filter(Boolean), 'post') +
        '<div class="grow"><b>' + esc(need) + '</b><br>' + esc(POST_TXT[t.id]) + '<br><span class="muted small">' + (who.length ? esc(who.join(', ')) : 'Nobody yet') + '</span></div></div>';
    }).join('');
    sheet('Trading posts', '<p class="muted small" style="margin:0 0 8px">Own the cards a post asks for and your coat of arms goes on it at the end of your turn, for the rest of the game. Everyone can hold every post.</p>' + rows);
  }
  function menu(v) {
    const online = table.online;
    sheet('Game', '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<button class="btn" data-m="log">Game log</button>' +
      (online ? '<button class="btn" data-m="leave">Leave room</button>' : '<button class="btn" data-m="new">New game</button><button class="btn ghost" data-m="quit">Quit to setup</button>') + '</div>');
    $('#sheet').addEventListener('click', e => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      closeSheet();
      if (b.dataset.m === 'log') sheet('Game log', '<ul class="log">' + logHTML(v, mySeat()) + '</ul>');
      if (b.dataset.m === 'leave') confirmBox(v.over ? 'Leave this room?' : 'Leave this online game? A computer takes your seat.', 'Leave', leaveOnline);
      if (b.dataset.m === 'new') newGameAsk();
      if (b.dataset.m === 'quit') confirmBox('Quit this game?' + (quitLoses() ? ' It counts as a loss in My stats.' : ''), 'Quit', () => { endLocalGame(); });
    });
  }
  function newGameAsk() {
    if (table && !table.online && !table.g.state.over) confirmBox('Start a new game? This one ends' + (quitLoses() ? ' and counts as a loss in My stats.' : '.'), 'New game', endLocalGame);
    else endLocalGame();
  }
  // a game vs computers that would be recorded in My stats (not the guided game, a challenge or friends on this device)
  const countsInStats = g => !!(SP && g && soloVsComputers(g) && !g.tutorial && !g.challenge);
  const quitLoses = () => !!(table && !table.online && !table.g.state.over && countsInStats(table.g) && table.g.myTurns > 0);
  function endLocalGame() {
    clearTimeout(ui.botTimer);
    if (table && !table.online && !table.g.state.over) recordGame(); // leaving after your first move = a loss
    if (tour && table && !table.online && table.g.tutorial) tour.stop();
    store.game = null; table = null; ui.prev = null; save(); renderPlay();
  }
  function showEnd(v, seat) {
    if (!v.result) return;
    const order = v.result.scores.slice().sort((a, b) => b.points - a.points || a.cards - b.cards);
    const rows = order.map(s => '<div class="end-row' + (v.result.winners.indexOf(s.seat) >= 0 ? ' win' : '') + '"><span class="dot" style="width:10px;height:10px;border-radius:50%;background:' + SEAT_COL[s.seat] + '"></span><span class="grow">' + esc(v.players[s.seat].name) + '</span><b>' + s.points + '</b><span class="muted small">' + s.cards + ' cards</span></div>').join('');
    const rec = ui.study.rec.filter(r => r.seat === seat);
    const matched = rec.length ? Math.round(100 * rec.filter(r => r.same).length / rec.length) : null;
    // what this game did for you: challenge stars, rating, awards
    let extra = '';
    const g = table && !table.online ? table.g : null;
    const gr = g && g.challenge ? gradeChallenge() : null;
    if (gr) extra += '<div class="end-chal"><b>' + esc(gr.c.title) + '</b>' + starTxt(gr.stars) + '<span class="muted small">' +
      (gr.done ? 'Goal met in ' + g.myTurns + ' of your turns' + (gr.best ? ' · new best' : '') + (g.hinted ? ' · Hint used (1 star at most)' : '') : 'Goal not met: ' + esc(CH.goalText(gr.c))) + '</span></div>';
    const got = ui.lastRecord;
    if (g && got && countsInStats(g)) {
      const bits = [];
      if (got.elo) bits.push('Rating ' + got.elo.after + ' (' + (got.elo.change >= 0 ? '+' : '') + got.elo.change + ')');
      else if (g.helped) bits.push('With help: not rated');
      if (got.unlocked && got.unlocked.length) bits.push('Award: ' + got.unlocked.map(a => a.title).join(', '));
      if (g.daily) bits.push('Daily deal done');
      if (bits.length) extra += '<p class="muted small" style="margin:2px 0 0">' + esc(bits.join(' · ')) + '</p>';
    }
    const again = g && g.challenge ? '<button class="btn" data-chal-again>Try again</button>' :
      g && !g.daily && !g.tutorial ? '<button class="btn" data-again>Play again</button>' : '';
    sheet(v.result.winners.length > 1 ? 'Shared win' : (v.result.winners[0] === seat ? 'You win!' : v.players[v.result.winners[0]].name + ' wins'),
      '<div class="end-card">' + rows + extra + (matched !== null ? '<p class="muted small" style="margin:4px 0 0">You matched the Hard computer on ' + matched + '% of your moves.</p>' : '') +
      '<div class="row end-btns">' + again + '<button class="btn primary grow" data-go-study>Study this game</button></div></div>');
    $('#sheet').addEventListener('click', e => {
      if (e.target.closest('[data-go-study]')) { closeSheet(); showTab('study', true); }
      if (e.target.closest('[data-chal-again]')) { const id = g.challenge; closeSheet(); dropOverlay(); endLocalGame(); startChallenge(id); }
      if (e.target.closest('[data-again]')) { // the same table again: same seats, levels, styles and rules, a new deal
        const o = { kinds: g.kinds.slice(), level: g.level, levels: g.levels, styles: g.styles, target: E.targetOf(g.state), cities: g.state.mode === 'cities', module: g.state.mod || null };
        closeSheet(); dropOverlay(); endLocalGame(); startGame(o);
      }
    });
  }

  // ================================================================== CARDS (efficiency + turns from scratch)
  const vCards = $('#v-cards');
  function cardStats(id) {
    const c = CARDS[id];
    const total = sum(c.cost);
    const t0 = E.turnsToAfford({ gems: [0, 0, 0, 0, 0, 0], bonus: [0, 0, 0, 0, 0] }, id, [7, 7, 7, 7, 7, 5]);
    const S = window.SpStrength && window.SpStrength.byCard && window.SpStrength.byCard[id];
    return { total, ppg: c.points / total, t0, win: S ? S[1] / Math.max(1, S[0]) : null, bought: S ? S[0] : 0 };
  }
  function renderCards() {
    const lv = ui.cardsLevel;
    let ids = CARDS.map(c => c.id).filter(id => !lv || CARDS[id].level === lv);
    const st = {}; ids.forEach(id => { st[id] = cardStats(id); });
    const sorters = {
      value: (a, b) => st[b].ppg - st[a].ppg || st[a].total - st[b].total,
      cheap: (a, b) => st[a].total - st[b].total || CARDS[b].points - CARDS[a].points,
      win: (a, b) => (st[b].win || 0) - (st[a].win || 0),
    };
    ids.sort(sorters[ui.cardsSort] || sorters.value);
    const S = window.SpStrength;
    const list = ids.map(id => {
      const c = CARDS[id], s = st[id];
      return '<div class="crow">' + Art.card(id) + '<div class="ct"><b>' + (c.points ? c.points + ' pt' + (c.points > 1 ? 's' : '') : 'No points') + '</b> · ' + COLW[c.bonus] + ' bonus<br><span class="muted">Costs ' + s.total + ' gems · ' + s.t0 + ' turns from nothing</span></div>' +
        '<div class="st"><span class="pct" style="color:' + heat(s.ppg, 0, 0.6) + '">' + s.ppg.toFixed(2) + '</span>pts/gem' +
        (s.win !== null ? '<br><span class="pct" style="color:' + heat(s.win, 0.4, 0.7) + ';font-size:13px;display:inline">' + Math.round(s.win * 100) + '%</span> wins' : '') + '</div></div>';
    }).join('');
    const nob = NOBLES.map(n => Art.noble(n.id)).join('');
    vCards.innerHTML = '<div class="cwrap">' +
      '<div class="chead"><div class="seg grow" data-cl>' + [0, 1, 2, 3].map(l => '<button aria-pressed="' + (lv === l) + '" data-v="' + l + '">' + (l ? 'Level ' + l : 'All 90') + '</button>').join('') + '</div>' +
      '<div class="row"><span class="label">Sort</span><select id="csort"><option value="value"' + (ui.cardsSort === 'value' ? ' selected' : '') + '>Points per gem</option><option value="cheap"' + (ui.cardsSort === 'cheap' ? ' selected' : '') + '>Cheapest</option>' +
      (S ? '<option value="win"' + (ui.cardsSort === 'win' ? ' selected' : '') + '>Win rate</option>' : '') + '</select>' +
      qBtn('Points per gem = prestige ÷ total printed cost. Turns from nothing = fewest gem-taking turns to afford it with no cards or gems. Win rate = how often the player who bought it won, over ' + (S ? S.cardGames : 'many') + ' Hard-vs-Hard computer games.') + '</div></div>' +
      '<div class="cbody"><div class="clist">' + list + '</div>' +
      '<div class="cside">' + insightPanel() + '<div class="panel" style="margin-top:10px"><span class="label">The 10 nobles · 3 points each</span><div class="nob-grid">' + nob + '</div></div>' +
      '<div class="panel" style="margin-top:10px"><span class="label">The 14 cities (Cities variant)</span><div class="nob-grid">' + CITIES.map(c => Art.city(c.id)).join('') + '</div></div></div>' +
      '</div></div>';
  }
  function insightPanel() {
    const S = window.SpStrength;
    let s = '<div class="panel"><span class="label">What the numbers say</span>';
    s += '<p class="small" style="margin:0">Level 3 single-colour 4-pointers pay the most per gem (0.57), but take 4+ turns from nothing. Level 1 cards pay almost nothing in points; their worth is the permanent discount.</p>';
    if (S) {
      s += '<p class="small" style="margin:0">First player wins <b>' + S.firstPlayer + '%</b> of Hard-vs-Hard two-player games. A typical game lasts <b>' + S.avgRounds + '</b> rounds.</p>';
    }
    return s + '</div>';
  }
  vCards.addEventListener('click', e => {
    const b = e.target.closest('[data-cl] button');
    if (b) { ui.cardsLevel = Number(b.dataset.v); renderCards(); }
  });
  vCards.addEventListener('change', e => { if (e.target.id === 'csort') { ui.cardsSort = e.target.value; renderCards(); } });

  // ================================================================== STUDY
  const vStudy = $('#v-study');
  const renderStudy = safely(renderStudyRaw, 'study');
  function renderStudyRaw() {
    const L = (table && !table.online && !table.g.state.over) ? null : store.last;
    const live = table && !table.online && !table.g.state.over ? table.g : null;
    const src = live ? { rec: live.study.rec, race: live.study.race, players: live.state.players.map(p => ({ name: p.name, points: p.points })), me: 0 } : L;
    if (!src || !src.rec) {
      vStudy.innerHTML = '<div class="setup"><div class="panel"><b>No game yet</b><p class="muted small" style="margin:0">Play a game; this tab then shows each of your moves next to what the Hard computer would do, and the points race.</p><button class="btn primary" data-go-play>Play</button></div></div>';
      return;
    }
    const mine = src.rec.filter(r => r.seat === src.me || (live && live.kinds[r.seat] === 'human'));
    const matched = mine.length ? Math.round(100 * mine.filter(r => r.same).length / mine.length) : 0;
    const lost = mine.reduce((s, r) => s + (r.lost || 0), 0);
    const head = '<div class="s-head panel"><div class="row"><span class="label grow">' + (live ? 'This game so far' : 'Your last game') + '</span>' +
      qBtn('Each move is compared with what the Hard computer would play from the same spot. "Points lost" is how much worse the position scores by the Hard computer’s yardstick (points now plus how close your next good cards are), in prestige points.') + '</div>' +
      '<div class="sum"><span><span class="big" style="color:' + (mine.length ? heat(matched, 30, 80) : 'var(--muted)') + '">' + (mine.length ? matched + '%' : '–') + '</span> matched Hard</span><span><span class="big" style="color:' + (mine.length ? heat(-lost, -12, 0) : 'var(--muted)') + '">' + (mine.length ? lost.toFixed(1) : '–') + '</span> points lost</span><span class="muted small">' + mine.length + ' moves</span></div></div>';
    const chart = '<div class="s-chart panel"><span class="label">Points race</span><div class="chart race">' + raceSVG(src) + '</div>' +
      '<div class="row small" style="flex-wrap:wrap">' + src.players.map((p, i) => '<span><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + SEAT_COL[i] + '"></span> ' + esc(p.name) + ' ' + p.points + '</span>').join('') + '</div></div>';
    const rows = mine.map(r => '<tr><td class="n">' + (Math.floor(r.t / src.players.length) + 1) + '</td><td>' + esc(r.did) + '</td><td>' + (r.same ? '<span class="ok">Same</span>' : esc(r.best)) + '</td><td class="n" style="color:' + (r.same ? 'var(--good)' : heat(-(r.lost || 0), -2, 0)) + '">' + (r.same ? '0' : r.lost === null ? '–' : r.lost.toFixed(1)) + '</td></tr>').join('');
    const list = !mine.length ? '<div class="s-list"></div>' : '<div class="s-list scroll"><table class="turns"><tr><th>Rd</th><th>You</th><th>Hard</th><th>Lost</th></tr>' + rows + '</table></div>';
    vStudy.innerHTML = '<div class="study">' + head + chart + list + '</div>';
  }
  function raceSVG(src) {
    const race = src.race || [];
    if (race.length < 2) return '<p class="muted small">Not enough moves yet.</p>';
    const W = 300, H = 120, n = src.players.length;
    const maxT = race[race.length - 1][0] || 1;
    const x = t => 4 + (t / maxT) * (W - 8), y = p => H - 6 - (Math.min(p, 22) / 22) * (H - 12);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><line x1="0" x2="' + W + '" y1="' + y(15) + '" y2="' + y(15) + '" stroke="#f0b354" stroke-dasharray="4 4" stroke-width="1" opacity=".6"/>';
    for (let i = 0; i < n; i++) s += '<polyline fill="none" stroke="' + SEAT_COL[i] + '" stroke-width="2.2" vector-effect="non-scaling-stroke" points="' + race.map(r => x(r[0]).toFixed(1) + ',' + y(r[1][i]).toFixed(1)).join(' ') + '"/>';
    return s + '</svg>';
  }
  vStudy.addEventListener('click', e => { if (e.target.closest('[data-go-play]')) showTab('play', true); });

  // ================================================================== SETTINGS
  const vSet = $('#v-settings');
  function renderSettings() {
    const s = store.settings;
    const sw = (key, title, sub) => '<div class="setrow"><div class="grow"><b>' + title + '</b><span>' + sub + '</span></div><label class="switch"><input type="checkbox" data-sw="' + key + '"' + (s[key] ? ' checked' : '') + '><span></span></label></div>';
    vSet.innerHTML = '<div class="set scroll">' +
      '<div class="panel">' + sw('showTurns', 'Turns on cards', 'How many turns of gems each card is from you.') + sw('hints', 'Hint button', 'Shows what the Hard computer would do.') + '</div>' +
      '<div class="panel"><div class="setrow"><div class="grow"><b>Points to win</b><span>15 is the standard game. Your next game vs computers.</span></div></div>' +
      '<div class="seg" data-set-opt="target">' + E.TARGETS.map(n => '<button aria-pressed="' + (s.target === n) + '" data-v="' + n + '">' + n + '</button>').join('') + '</div>' +
      '<div class="setrow" style="margin-top:6px"><div class="grow"><b>Hard computers’ styles</b><span>Mixed: each Hard computer plays its own way (' + Object.keys(B.STYLES).map(k => B.STYLES[k].name).join(', ') + '), all about as strong.</span></div></div>' +
      '<div class="seg" data-set-opt="styles"><button aria-pressed="' + (s.styles !== 'mixed') + '" data-v="balanced">All balanced</button><button aria-pressed="' + (s.styles === 'mixed') + '" data-v="mixed">Mixed</button></div>' +
      '<div class="setrow" style="margin-top:6px"><div class="grow"><b>Computer speed</b><span>How long a computer takes over each move.</span></div></div>' +
      '<div class="seg" data-set-opt="botSpeed">' + [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']].map(([k, t]) => '<button aria-pressed="' + (s.botSpeed === k) + '" data-v="' + k + '">' + t + '</button>').join('') + '</div></div>' +
      '<div class="panel" id="mod-panel"><div class="setrow"><div class="grow"><b>Cities of Splendor modules</b><span>One at a time, for your next game vs computers or online. Off is the standard game; the Daily, challenges and the guided game always play it.' + (s.cities ? ' The Cities variant is on (Play screen), so these wait until it is off.' : '') + '</span></div></div>' +
      '<div class="seg" data-set-opt="module"><button aria-pressed="' + (!modOn()) + '" data-v="none">Off</button>' + E.MODS.map(k => '<button aria-pressed="' + (s.module === k) + '" data-v="' + k + '">' + MOD_NAME[k] + '</button>').join('') + '</div>' +
      (modOn() ? '<p class="small muted" style="margin:6px 0 0">' + esc(MOD_NOTE[modOn()]) + '</p>' : '') + '</div>' +
      (SC || SP ? '<div class="panel">' +
        (SC ? '<div class="setrow"><div class="grow"><b>Rules</b><span>How to play, in short sections.</span></div><button class="btn small" data-rules>Open</button></div>' +
          '<div class="setrow"><div class="grow"><b>Guided game</b><span>One game against Easy with tips on screen.</span></div><button class="btn small" data-tutorial>Start</button></div>' : '') +
        (SP ? '<div class="setrow"><div class="grow"><b>My stats</b><span>Wins per level, rating, awards and the Daily.</span></div><button class="btn small" data-stats>Open</button></div>' : '') +
        (CH ? '<div class="setrow"><div class="grow"><b>Challenges</b><span>' + CH.LIST.length + ' set deals with a goal and stars.</span></div><button class="btn small" data-chal>Open</button></div>' : '') +
        '</div>' : '') +
      '<div class="panel" id="fx-panel"><span class="label">Sound & effects</span></div>' +
      '<div class="panel"><div class="setrow"><div class="grow"><b>Your name</b><span>Shown to friends online.</span></div><input class="txt" id="set-name" maxlength="20" style="max-width:170px" value="' + esc(s.name) + '" placeholder="Name"></div></div>' +
      '<div class="panel"><div class="row"><b class="grow">How strong are the computers?</b></div><p class="small muted" style="margin:6px 0 0">' + esc(strengthNote()) + '</p></div>' +
      '<details class="panel"><summary style="cursor:pointer;font-weight:650">How Splendor works</summary><p class="muted" style="margin:8px 0 0;font-size:13.5px">' +
      'On your turn do one thing: take 3 gems of different colours; take 2 of one colour (only if 4+ are left); reserve a card (from the table or blind from a deck) and take a gold, holding at most 3 reserved; or buy a card from the table or your reserve. ' +
      'Each card you own is a permanent gem discount of its colour. Hold 10 gems at most. A noble (3 points) visits at the end of your turn once your cards match it. ' +
      'Reaching 15 points triggers the last round; most points wins, ties go to fewer cards.</p></details>' +
      '<p class="ver">Splendor Lab · game facts only, original art · <a href="https://github.com/TimothyHadfield/splendor">source</a></p></div>';
    FX.renderSettings($('#fx-panel'));
  }
  vSet.addEventListener('click', e => {
    const b = e.target.closest('[data-set-opt] button');
    if (b) { const k = b.parentElement.dataset.setOpt; store.settings[k] = k === 'target' ? Number(b.dataset.v) : b.dataset.v; save(); renderSettings(); return; }
    if (e.target.closest('[data-rules]')) { openRules(); return; }
    if (e.target.closest('[data-stats]')) { openStats(); return; }
    if (e.target.closest('[data-tutorial]')) { startTutorial(); return; }
    if (e.target.closest('[data-chal]')) { openChallenges(); return; }
  });
  vSet.addEventListener('change', e => {
    const k = e.target.dataset && e.target.dataset.sw;
    if (k) { store.settings[k] = e.target.checked; save(); }
    if (e.target.id === 'set-name') { store.settings.name = name20(e.target.value); save(); }
  });

  // ------------------------------------------------------------------ boot
  if (SP) {
    SP.init(startDaily);
    window.Profile.onChange(what => {
      if (what === 'close' && !ui.closingQuiet) dropOverlay();
      if ((what === 'result' || what === 'me' || what === 'reset' || what === 'import') && ui.tab === 'play' && !table && !ui.online) renderPlay();
    });
  }
  if (SC) {
    const live = () => (table && !table.online && table.g.tutorial ? table.g.state : null);
    tour = COACH.tour({
      id: SC.ID, steps: SC.steps(live),
      pauseIf: () => ui.tab !== 'play' || !live() || modalOpen() || !!$('.flyer'),
    });
    new MutationObserver(() => COACH.update()).observe(vPlay, { childList: true });
    if (table && !table.online && table.g.tutorial && !table.g.state.over) tour.resume();
  }
  if (window.PWA) window.PWA.safeToReload = () => {
    if (modalOpen() || store.online || ui.online || (table && table.online) || $('.flyer')) return false;
    const a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')) return false;
    // a game in progress is saved after every move; reload only between games or away from the table
    return !table || table.g.state.over || ui.tab !== 'play';
  };
  const startTab = (location.hash || '').slice(1);
  try { history.replaceState({ tab: 'play' }, '', location.pathname + location.search); } catch (e) { /* file:// */ }
  if (['cards', 'study', 'settings'].indexOf(startTab) >= 0) { showTab('play', false); showTab(startTab, true); } else showTab('play', false);
  if (store.online) {
    ui.online = true; net.connecting = true; renderPlay();
    loadOnline().then(r => r.resume()).then(ok => {
      net.connecting = false;
      if (!ok) { store.online = false; ui.online = false; save(); }
      renderPlay();
    }).catch(() => { net.connecting = false; store.online = false; ui.online = false; save(); renderPlay(); });
  }
  if (!table && !store.online) offerTutorial();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleBot(); else clearTimeout(ui.botTimer); });
  // the same game open in two tabs: a move made in the other tab shows up here, instead of one tab overwriting the other
  window.addEventListener('storage', e => {
    if (e.key !== KEY || !e.newValue) return;
    let other;
    try { other = JSON.parse(e.newValue); } catch (err) { return; }
    if (!other || typeof other !== 'object') return;
    if (other.settings && typeof other.settings === 'object') Object.assign(store.settings, other.settings);
    if ('last' in other) store.last = other.last;
    if (table && table.online) return;
    const g = other.game;
    if (g && g.state && validState(g.state) && Array.isArray(g.kinds) && g.kinds.length === g.state.n) {
      if (!g.study || !Array.isArray(g.study.rec)) g.study = { rec: [], race: [] };
      const same = table && store.game && store.game.started === g.started;
      if (same && g.state.turns < table.g.state.turns) return; // never step back to an older position
      store.game = g; ui.study = g.study;
      if (!same) { ui.prev = null; ui.dealAll = true; }
      table = new LocalTable(g); resetSel();
    } else if (!g && table) { clearTimeout(ui.botTimer); store.game = null; table = null; ui.prev = null; }
    else return render();
    render();
  });

  // test hook for headless checks (no effect on play)
  window.__sp = { state: () => table && !table.online ? table.g.state : null, view: () => table ? table.view(mySeat()) : null,
    game: () => (table && !table.online ? table.g : null), act: a => act(a), startGame, startDaily, startChallenge, startTutorial, undo, canUndo, openRules, openStats, openChallenges, ui };
})();
