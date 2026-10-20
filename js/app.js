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
  const BOT_MS = 750;

  // ------------------------------------------------------------------ storage (try/catch: private mode etc.)
  const KEY = 'splendor.v1';
  let store;
  try { store = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { store = null; }
  if (!store || typeof store !== 'object' || Array.isArray(store)) store = {};
  if (!store.settings || typeof store.settings !== 'object' || Array.isArray(store.settings)) store.settings = {};
  const defSettings = { seats: ['computer', 'off', 'off'], level: 'hard', cities: false, showTurns: true, hints: true, name: '' };
  store.settings = Object.assign({}, defSettings, store.settings || {});
  { // clamp anything odd from an old or edited save
    const st = store.settings;
    if (!Array.isArray(st.seats) || st.seats.length !== 3) st.seats = defSettings.seats.slice();
    st.seats = st.seats.map((k, i) => (['computer', 'human', 'off'].indexOf(k) >= 0 && !(i === 0 && k === 'off')) ? k : (i === 0 ? 'computer' : 'off'));
    if (!LV_NAME[st.level]) st.level = 'hard';
    st.name = String(st.name || '').slice(0, 20);
    st.cities = st.cities === true;
  }
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
    if (['main', 'discard', 'noble', 'city'].indexOf(s.phase) < 0 || !isArr(s.log) || !gems(s.bank, 6)) return false;
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
    return import(new URL('js/online.js?v=1', location.href).href).then(mod => {
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
      if (!table || !table.online) { table = new OnlineTable(net.room); resetSel(); ui.prev = null; net.savedLast = false; ui.study = { rec: [], race: [] }; }
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
    if (nameEl) { store.settings.name = nameEl.value.trim().slice(0, 20); save(); }
    const name = store.settings.name || 'Player';
    const codeEl = $('#on-code');
    const code = codeEl ? codeEl.value.trim().toUpperCase() : '';
    if (k === 'join' && code.length !== 5) { toast('Room codes have 5 letters'); return; }
    if (net.connecting) return;
    net.connecting = true; renderPlay();
    let r;
    try {
      const room = await loadOnline();
      if (k === 'create') r = await room.createRoom({ name, seats: onlineSeatsFromSettings(), options: { level: store.settings.level, cities: store.settings.cities } });
      else r = await room.joinRoom(code, name);
    } catch (e) { r = { ok: false, message: 'Online play couldn’t load. Check your internet.' }; }
    net.connecting = false;
    if (r.ok) { store.online = true; save(); } else toast(r.message);
    renderPlay();
  }

  // ------------------------------------------------------------------ ui state
  const ui = { online: false, tab: 'play', sel: null, take: [], ret: [0, 0, 0, 0, 0, 0], hint: null, prev: null, botTimer: null,
    cardsLevel: 0, cardsSort: 'value', shownSeat: null, study: (store.game && store.game.study) || { rec: [], race: [] } };
  function resetSel() { ui.sel = null; ui.take = []; ui.ret = [0, 0, 0, 0, 0, 0]; ui.hint = null; }

  // ------------------------------------------------------------------ helpers
  function heat(x, lo, hi) { const f = Math.max(0, Math.min(1, (x - lo) / (hi - lo))); return 'hsl(' + Math.round(f * 130) + ', 70%, 62%)'; }
  const qBtn = text => '<button class="q" data-q="' + esc(text) + '" aria-label="Why?">?</button>';
  function toast(msg) {
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
      if (e.target === back || b) { back.remove(); if (b && b.dataset.c === 'yes') onYes(); }
    });
    document.body.appendChild(back);
  }
  function sheet(title, html) {
    closeSheet();
    const back = document.createElement('div');
    back.className = 'sheet-back'; back.id = 'sheet';
    back.innerHTML = '<div class="sheet"><div class="row"><h3 class="grow">' + esc(title) + '</h3><button class="btn small ghost" data-close>Close</button></div><div class="scroll">' + html + '</div></div>';
    back.addEventListener('click', e => { if (e.target === back || e.target.closest('[data-close]')) closeSheet(); });
    document.body.appendChild(back);
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
    render();
  }
  const TABS = ['play', 'cards', 'study', 'settings'];
  window.addEventListener('popstate', e => {
    // Back with a sheet or a confirm box open just closes it and stays on this tab
    const open = $('#sheet') || $('.confirm-back');
    if (open) {
      document.querySelectorAll('#sheet, .confirm-back').forEach(x => x.remove());
      try { history.pushState({ tab: ui.tab }, '', '#' + ui.tab); } catch (err) { /* file:// */ }
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
  const renderPlay = safely(function () { if (table) renderGame(); else if (ui.online) renderOnline(); else renderSetup(); }, 'play');

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
          '<p class="muted small" style="margin:0">' + (o.cities ? 'Cities variant. ' : '') + 'Open seats become ' + esc(LV_NAME[o.level] || 'Hard') + ' computers.</p>' :
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
    vPlay.innerHTML = '<div class="setup">' +
      '<div class="hero"><img src="icon.svg" alt=""><div><h1>Splendor Lab</h1><p>Play Splendor with turns-to-afford on every card.</p></div></div>' +
      '<div class="demo-row">' + demo.map(id => Art.card(id)).join('') + Art.chip(5) + '</div>' +
      '<div class="panel">' +
      '<span class="label">Players · seat 1 is you</span>' +
      '<div class="seats">' + seatRows + '</div>' +
      '<div class="row"><span class="label grow">Computer</span>' + qBtn(strengthNote()) + '</div>' +
      '<div class="seg" data-set="level">' + ['easy', 'medium', 'hard'].map(l => '<button aria-pressed="' + (s.level === l) + '" data-v="' + l + '">' + LV_NAME[l] + '<small>' + LEVEL_NOTE[l] + '</small></button>').join('') + '</div>' +
      '<div class="setrow" style="min-height:40px"><div class="grow row" style="gap:6px"><b>Cities variant</b>' + qBtn('From the Cities of Splendor expansion: no nobles; 3 city tiles instead. Taking a city (enough points plus the bonuses shown) ends the game after the round, and only city holders can win.') + '</div><label class="switch"><input type="checkbox" data-setup-sw="cities"' + (s.cities ? ' checked' : '') + '><span></span></label></div>' +
      '<button class="btn primary" data-start id="deal" style="width:100%">Deal</button>' +
      '<button class="btn" data-on="open" id="open-online" style="width:100%">Play online</button>' +
      '</div>' +
      (store.last ? '<button class="btn ghost" data-go="study">Study your last game</button>' : '') +
      '</div>';
  }

  function startGame() {
    const s = store.settings;
    const kinds = ['human'].concat(s.seats.filter(k => k !== 'off'));
    let ci = 0;
    const comps = kinds.filter(k => k === 'computer').length;
    let fi = 1;
    const names = kinds.map((k, i) => i === 0 ? (s.name || 'You') : k === 'computer' ? LV_NAME[s.level] + (comps > 1 ? ' ' + (++ci) : '') : 'Friend ' + (fi++));
    const rng = Math.random;
    const state = E.setup(kinds.length, { cities: s.cities }, rng, names);
    store.game = { state, kinds, level: s.level, started: Date.now(), lastHuman: 0, study: { rec: [], race: [[0, state.players.map(() => 0)]] } };
    ui.study = store.game.study;
    table = new LocalTable(store.game);
    resetSel(); ui.prev = null; ui.shownSeat = 0;
    save();
    renderPlay();
  }

  // ------------------------------------------------------------------ making a move
  function act(action) {
    if (!table) return;
    const v = table.view(mySeat());
    if (!canAct(v)) return;
    const seat = v.turn;
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
    try { table.g.state = E.apply(table.g.state, seat, action); }
    catch (e) { toast(e.message); return; }
    table.g.lastHuman = seat;
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
    ui.botTimer = setTimeout(() => {
      if (!table || table.online || table.g !== g) return;
      const st = g.state;
      if (st.over || g.kinds[st.turn] !== 'computer') return;
      const seat = st.turn;
      try { g.state = E.apply(st, seat, B.decide(E.view(st, seat), seat, g.level || 'hard')); }
      catch (e) { g.state = E.apply(st, seat, E.legal(st, seat)[0]); }
      afterLocalMove();
    }, BOT_MS);
  }

  // ------------------------------------------------------------------ the table screen
  function renderGame() {
    const seat = mySeat();
    const v = table.view(seat);
    if (!v) { vPlay.innerHTML = '<div class="setup"><div class="panel"><b>Connecting…</b></div></div>'; return; }
    // friends sharing one phone: cover the table until the next friend is holding it (blind reserves stay secret)
    if (!table.online && !v.over && table.g.kinds.filter(k => k === 'human').length > 1 &&
      table.g.kinds[v.turn] === 'human' && ui.shownSeat !== v.turn) {
      ui.prev = null;
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

    // status chips
    const chips = v.players.map((p, i) => '<div class="chip' + (i === v.turn && !v.over ? ' turn' : '') + (away(i) ? ' away' : '') + '" data-player="' + i + '" id="chip-' + i + '">' +
      '<span class="dot" style="background:' + SEAT_COL[i] + '"></span><span class="nmx">' + esc(i === seat ? (table.online ? p.name : 'You') : p.name) + '</span>' +
      '<span class="sub" title="gems held"><i></i>' + sum(p.gems) + '</span><span class="pts">' + p.points + '</span></div>').join('');
    const status = '<div class="status"><div class="chips' + (v.players.length > 3 ? ' many' : '') + '">' + chips + '</div><button class="icon-btn" data-menu aria-label="Menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg></button></div>';

    // nobles
    const choose = (v.phase === 'noble' || v.phase === 'city') && my;
    const isCities = v.mode === 'cities';
    const nob = isCities ? v.cities.map(id => Art.city(id, 'noble' + (choose && v.nobleChoice.indexOf(id) >= 0 ? ' choose' : '')).replace('<svg ', '<svg data-city="' + id + '" ')).join('') +
      v.players.filter(p => p.cities.length).map(p => '<span class="small muted">' + esc(p.name) + (p.name === 'You' ? ' have' : ' has') + ' a city</span>').join('') : v.nobles.map(id => {
      const close = NOBLES[id].req.reduce((s, x, k) => s + Math.max(0, x - me.bonus[k]), 0);
      const cls = choose && v.nobleChoice.indexOf(id) >= 0 ? ' choose' : close <= 2 ? ' close' : '';
      return Art.noble(id, 'noble' + cls).replace('<svg ', '<svg data-noble="' + id + '" ');
    }).join('');
    const rnd = '<div class="rnd">' + (v.finalRound && !v.over ? '<span class="final">Final round</span><br>' : '') + 'Round <b>' + (Math.floor(v.turns / v.n) + 1) + '</b>' +
      qBtn(isCities ? 'A city comes to you at the end of your turn once you have its prestige and bonuses (grey = that many of one colour; "other" = one colour not already shown). Then the round finishes; only city holders can win, most points first.' :
        'First to 15 prestige ends the game, but the round is finished so everyone has the same number of turns. Most points wins; a tie goes to whoever bought fewer cards.') + '</div>';
    const nobles = '<div class="nobles">' + nob + rnd + '</div>';

    // market
    let market = '<div class="market">';
    for (let l = 2; l >= 0; l--) {
      market += '<div class="mrow">';
      const dsel = ui.sel && ui.sel.kind === 'deck' && ui.sel.level === l + 1;
      market += v.deckSizes[l] ? '<div class="slot deck' + (dsel ? ' sel' : '') + (ui.hint && ui.hint.deck === l + 1 ? ' hint' : '') + '" data-deck="' + (l + 1) + '">' + Art.back(l + 1) + '<span class="cnt">' + v.deckSizes[l] + '</span></div>' : '<div class="slot empty"></div>';
      v.market[l].forEach((id, i) => {
        if (id === null) { market += '<div class="slot empty"></div>'; return; }
        const t = E.turnsToAfford(me, id, v.bank);
        const badge = showT ? '<span class="tta" style="color:' + (t === 0 ? 'var(--good)' : t === Infinity ? '#59607a' : heat(4 - t, 0, 3)) + '">' + (t === 0 ? '✓' : t === Infinity ? '—' : t) + '</span>' : '';
        const isNew = prev && prev.market[l][i] !== id;
        const sel = ui.sel && ui.sel.kind === 'card' && ui.sel.id === id;
        const hint = ui.hint && (ui.hint.t === 'buy' || ui.hint.t === 'reserve') && ui.hint.id === id;
        market += '<div class="slot' + (sel ? ' sel' : '') + (hint ? ' hint' : '') + (isNew ? ' deal' : '') + '" data-card="' + id + '" id="c-' + id + '">' + Art.card(id) + badge + '</div>';
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
        Art.chip(k) + '<span class="n">' + v.bank[k] + '</span></button>';
    }
    bank += '<div class="side">Bank' + qBtn('Take 3 gems of different colours, or 2 of one colour if 4 or more of it are left. Gold only comes from reserving a card. You may hold 10 gems at most.') + '</div></div>';

    // my area
    const discard = v.phase === 'discard' && my;
    let holds = '<div class="holds">';
    for (let k = 0; k < 6; k++) {
      const r = ui.ret[k];
      holds += '<div class="hold' + (discard ? ' ret' : '') + '"' + (discard ? ' data-ret="' + k + '"' : '') + '>' + (k < 5 ? '<div class="bon' + (me.bonus[k] ? '' : ' none') + '" style="background:' + Art.PAL[k][0] + ';color:' + (k === 0 ? '#222' : '#fff') + '" title="' + COLW[k] + ' cards">' + me.bonus[k] + '</div>' : '<div class="bon none" style="visibility:hidden"></div>') +
        '<button class="htok' + (me.gems[k] ? '' : ' zero') + (discard ? ' ret' : '') + (r ? ' retd' : '') + '" data-r="' + r + '" id="h-' + k + '" aria-label="' + COLW[k] + ' gems held: ' + me.gems[k] + '">' + Art.chip(k) + '<b>' + me.gems[k] + '</b></button></div>';
    }
    holds += '</div>';
    let res = '<div class="res">';
    for (let i = 0; i < 3; i++) {
      const r = me.reserved[i];
      if (!r) { res += '<div class="slot empty"></div>'; continue; }
      const sel = ui.sel && ui.sel.kind === 'card' && ui.sel.id === r.id;
      const hint = ui.hint && ui.hint.t === 'buy' && ui.hint.id === r.id;
      res += '<div class="slot' + (sel ? ' sel' : '') + (hint ? ' hint' : '') + '" data-card="' + r.id + '" data-res="1" id="c-' + r.id + '">' + (r.id !== null ? Art.card(r.id) : Art.back(r.level)) + '</div>';
    }
    res += '</div>';
    const meBox = '<div class="me' + (my ? ' turn' : '') + '" id="me-box"><div class="mine-info"><b id="my-pts">' + me.points + '</b>pts<br>' + sum(me.gems) + '/10</div>' + holds + res + '</div>';

    // action bar
    const acts = '<div class="acts" id="acts">' + actionBar(v, seat, my) + '</div>';

    // laptop side panel
    const side = '<div id="g-side"><div class="panel scroll" style="flex:1.3">' + v.players.map((p, i) => i === seat ? '' : oppHTML(p, i)).join('') + '</div>' +
      '<div class="panel" style="flex:1;min-height:0;display:flex;flex-direction:column;gap:6px"><span class="label">Log</span><div class="scroll" id="logbox"><ul class="log">' + logHTML(v, seat) + '</ul></div></div></div>';

    vPlay.innerHTML = '<div id="game">' + status + nobles + market + bank + meBox + acts + side + '</div>';
    fitMarket();
    const lb = $('#logbox'); if (lb) lb.scrollTop = lb.scrollHeight;
    if (prev) animateMove(prev, v, before, seat);
    ui.prev = v;
    scheduleBot();
    if (v.over && !ui.endShown) { ui.endShown = true; setTimeout(() => showEnd(v, seat), 900); }
    if (!v.over) ui.endShown = false;
  }

  // cards keep their shape: as tall as a row allows, but never wider than a fifth of the row
  function fitMarket() {
    const m = $('.market');
    if (!m) return;
    const gap = parseFloat(getComputedStyle(m).rowGap) || 6;
    const h = (m.clientHeight - 2 * gap) / 3, w = (m.clientWidth - 4 * gap) / 5;
    m.style.setProperty('--ch', Math.max(40, Math.floor(Math.min(h, w * 1.4))) + 'px');
  }
  window.addEventListener('resize', fitMarket);
  function oppHTML(p, i) {
    const mini = '<div class="minirow"><span class="lb">Cards</span>' + [0, 1, 2, 3, 4].map(k => '<span class="mini" style="width:30px"><span class="sq" style="background:' + Art.PAL[k][0] + '"></span>' + p.bonus[k] + '</span>').join('') + '</div>' +
      '<div class="minirow"><span class="lb">Gems</span>' + [0, 1, 2, 3, 4, 5].map(k => '<span class="mini" style="width:30px"><span class="ci" style="background:' + Art.PAL[k][0] + '"></span>' + p.gems[k] + '</span>').join('') + '</div>';
    const res = p.reserved.map(r => '<div class="slot">' + (r.id !== null ? Art.card(r.id) : Art.back(r.level)) + '</div>').join('');
    return '<div class="opp"><div class="top"><span class="dot" style="width:9px;height:9px;border-radius:50%;background:' + SEAT_COL[i] + '"></span><span class="grow">' + esc(p.name) + '</span>' +
      (p.nobles.length ? '<span class="muted small">' + p.nobles.length + ' noble' + (p.nobles.length > 1 ? 's' : '') + '</span>' : '') + '<b>' + p.points + '</b></div>' +
      mini + (res ? '<div class="res">' + res + '</div>' : '') + '</div>';
  }
  function logHTML(v, seat) {
    return v.log.slice(-30).map(l => '<li class="' + (l.seat === seat ? 'mine' : '') + '">' + esc(l.text) + '</li>').join('');
  }

  function actionBar(v, seat, my) {
    const me = v.players[seat];
    const hintBtn = store.settings.hints && my && v.phase === 'main' ? '<button class="btn ghost" data-hint id="hint">Hint</button>' : '';
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
    if (v.phase === 'noble') return '<div class="say"><b>Two nobles want to visit.</b> Tap the one you want.</div>';
    if (v.phase === 'city') return '<div class="say"><b>You qualify for more than one city.</b> Tap the one you take.</div>';
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
      return '<div class="say"><b>Level ' + ui.sel.level + ' deck</b><br>Reserve the top card unseen' + (v.bank[5] ? ' + 1 gold.' : '.') + '</div>' +
        '<button class="btn primary" data-reserve id="do-reserve"' + (me.reserved.length < 3 ? '' : ' disabled') + '>Reserve</button>';
    }
    if (ui.hint) return '<div class="say"><b>Hint: ' + esc(describe(ui.hint)) + '</b><br>' + esc(ui.hintWhy || '') + '</div>' + hintBtn;
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
    vPlay.querySelectorAll('[data-card], [data-tok], .chip[data-player], #me-box, [data-deck]').forEach(el => { r[el.id || ('d' + el.dataset.deck)] = { rect: el.getBoundingClientRect(), html: el.innerHTML }; });
    return r;
  }
  function fly(fromRect, toEl, html, w) {
    if (!fromRect || !toEl || !document.body.animate) return;
    const to = toEl.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'flyer'; f.innerHTML = html;
    const W = w || fromRect.width, H = w ? w * fromRect.height / fromRect.width : fromRect.height;
    Object.assign(f.style, { left: fromRect.left + 'px', top: fromRect.top + 'px', width: W + 'px', height: H + 'px' });
    document.body.appendChild(f);
    const dx = to.left + to.width / 2 - (fromRect.left + W / 2), dy = to.top + to.height / 2 - (fromRect.top + H / 2);
    const a = f.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.45)', opacity: 0.2 }], { duration: 520, easing: 'cubic-bezier(.3,.7,.3,1)' });
    a.onfinish = () => f.remove();
    setTimeout(() => f.remove(), 900);
  }
  function animateMove(prev, v, before, seat) {
    const L = v.last;
    if (!L || v.turns === prev.turns && v.phase === prev.phase && JSON.stringify(v.bank) === JSON.stringify(prev.bank)) return;
    const who = L.seat;
    const target = who === seat ? $('#me-box') : $('#chip-' + who);
    if (!target) return;
    if ((L.t === 'buy' || L.t === 'reserve') && L.id !== null && L.id !== undefined && before['c-' + L.id]) fly(before['c-' + L.id].rect, target, before['c-' + L.id].html);
    else if (L.t === 'reserve' && L.deck && before['d' + L.deck]) fly(before['d' + L.deck].rect, target, before['d' + L.deck].html);
    if ((L.t === 'take' || L.t === 'take2') && L.g && prev.turns !== v.turns || (L.t === 'take' || L.t === 'take2') && v.phase === 'discard' && prev.phase === 'main') {
      L.g.forEach((k, i) => { const b = before['t-' + k]; if (b) setTimeout(() => fly(b.rect, target, b.html), i * 70); });
    }
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
    if (t.closest('[data-end]')) { showEnd(v, seat); return; }
    if (t.closest('[data-new]')) { newGameAsk(); return; }
    if (t.closest('[data-leave]')) { leaveOnline(); return; }
    const my = canAct(v) && v.turn === seat;
    if (!my) {
      if (t.closest('[data-card], [data-tok], [data-deck]')) toast(v.over ? 'The game is over' : 'Not your turn yet');
      return;
    }
    const me = v.players[seat];
    if (t.closest('[data-hint]')) {
      const h = B.explain(v, seat);
      ui.hint = h.action; ui.hintWhy = h.why; ui.sel = null; ui.take = [];
      renderPlay(); return;
    }
    if (t.closest('[data-pass]')) { act({ t: 'pass' }); return; }
    if (v.phase === 'city') { const c = t.closest('[data-city]'); if (c && v.nobleChoice.indexOf(Number(c.dataset.city)) >= 0) act({ t: 'city', id: Number(c.dataset.city) }); return; }
    if (v.phase === 'noble') { const n = t.closest('[data-noble]'); if (n && v.nobleChoice.indexOf(Number(n.dataset.noble)) >= 0) act({ t: 'noble', id: Number(n.dataset.noble) }); return; }
    if (v.phase === 'discard') {
      const h = t.closest('[data-ret]');
      if (h) {
        const k = Number(h.dataset.ret);
        const need = sum(me.gems) - 10;
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
      if (k === 5) { toast('Gold comes only from reserving a card'); return; }
      if (!v.bank[k]) { toast('No ' + COLW[k] + ' left'); return; }
      const has = ui.take.indexOf(k) >= 0;
      if (has && ui.take.length === 1) {
        if (v.bank[k] >= 4) ui.take = [k, k]; else { toast('2 of a colour needs 4 left in the bank'); }
      } else if (has) ui.take.splice(ui.take.indexOf(k), 1);
      else if (ui.take.length === 2 && ui.take[0] === ui.take[1]) ui.take = [k];
      else if (ui.take.length < 3) ui.take.push(k);
      else { toast('3 gems at most. Tap one you picked to put it back.'); return; }
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
      if (b.dataset.m === 'quit') confirmBox('Quit this game?', 'Quit', () => { clearTimeout(ui.botTimer); store.game = null; table = null; save(); renderPlay(); });
    });
  }
  function newGameAsk() {
    if (table && !table.online && !table.g.state.over) confirmBox('Start a new game? This one ends.', 'New game', () => { clearTimeout(ui.botTimer); store.game = null; table = null; save(); renderPlay(); });
    else { clearTimeout(ui.botTimer); store.game = null; table = null; save(); renderPlay(); }
  }
  function showEnd(v, seat) {
    if (!v.result) return;
    const order = v.result.scores.slice().sort((a, b) => b.points - a.points || a.cards - b.cards);
    const rows = order.map(s => '<div class="end-row' + (v.result.winners.indexOf(s.seat) >= 0 ? ' win' : '') + '"><span class="dot" style="width:10px;height:10px;border-radius:50%;background:' + SEAT_COL[s.seat] + '"></span><span class="grow">' + esc(v.players[s.seat].name) + '</span><b>' + s.points + '</b><span class="muted small">' + s.cards + ' cards</span></div>').join('');
    const rec = ui.study.rec.filter(r => r.seat === seat);
    const matched = rec.length ? Math.round(100 * rec.filter(r => r.same).length / rec.length) : null;
    sheet(v.result.winners.length > 1 ? 'Shared win' : (v.result.winners[0] === seat ? 'You win!' : v.players[v.result.winners[0]].name + ' wins'),
      '<div class="end-card">' + rows + (matched !== null ? '<p class="muted small" style="margin:4px 0 0">You matched the Hard computer on ' + matched + '% of your moves.</p>' : '') +
      '<button class="btn primary" data-go-study>Study this game</button></div>');
    $('#sheet').addEventListener('click', e => { if (e.target.closest('[data-go-study]')) { closeSheet(); showTab('study', true); } });
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
      '<div class="sum"><span><span class="big" style="color:' + heat(matched, 30, 80) + '">' + matched + '%</span> matched Hard</span><span><span class="big" style="color:' + heat(-lost, -12, 0) + '">' + lost.toFixed(1) + '</span> points lost</span><span class="muted small">' + mine.length + ' moves</span></div></div>';
    const chart = '<div class="s-chart panel"><span class="label">Points race</span><div class="chart race">' + raceSVG(src) + '</div>' +
      '<div class="row small" style="flex-wrap:wrap">' + src.players.map((p, i) => '<span><span class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:' + SEAT_COL[i] + '"></span> ' + esc(p.name) + ' ' + p.points + '</span>').join('') + '</div></div>';
    const rows = mine.map(r => '<tr><td class="n">' + (Math.floor(r.t / src.players.length) + 1) + '</td><td>' + esc(r.did) + '</td><td>' + (r.same ? '<span class="ok">Same</span>' : esc(r.best)) + '</td><td class="n" style="color:' + (r.same ? 'var(--good)' : heat(-(r.lost || 0), -2, 0)) + '">' + (r.same ? '0' : r.lost === null ? '–' : r.lost.toFixed(1)) + '</td></tr>').join('');
    const list = '<div class="s-list scroll"><table class="turns"><tr><th>Rd</th><th>You</th><th>Hard</th><th>Lost</th></tr>' + rows + '</table></div>';
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
      '<div class="panel"><div class="setrow"><div class="grow"><b>Your name</b><span>Shown to friends online.</span></div><input class="txt" id="set-name" maxlength="20" style="max-width:170px" value="' + esc(s.name) + '" placeholder="Name"></div></div>' +
      '<div class="panel"><div class="row"><b class="grow">How strong are the computers?</b></div><p class="small muted" style="margin:6px 0 0">' + esc(strengthNote()) + '</p></div>' +
      '<details class="panel"><summary style="cursor:pointer;font-weight:650">How Splendor works</summary><p class="muted" style="margin:8px 0 0;font-size:13.5px">' +
      'On your turn do one thing: take 3 gems of different colours; take 2 of one colour (only if 4+ are left); reserve a card (from the table or blind from a deck) and take a gold, holding at most 3 reserved; or buy a card from the table or your reserve. ' +
      'Each card you own is a permanent gem discount of its colour. Hold 10 gems at most. A noble (3 points) visits at the end of your turn once your cards match it. ' +
      'Reaching 15 points triggers the last round; most points wins, ties go to fewer cards.</p></details>' +
      '<p class="ver">Splendor Lab · game facts only, original art · <a href="https://github.com/TimothyHadfield/splendor">source</a></p></div>';
  }
  vSet.addEventListener('change', e => {
    const k = e.target.dataset && e.target.dataset.sw;
    if (k) { store.settings[k] = e.target.checked; save(); }
    if (e.target.id === 'set-name') { store.settings.name = e.target.value.trim().slice(0, 20); save(); }
  });

  // ------------------------------------------------------------------ boot
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
  // test hook for headless checks (no effect on play)
  window.__sp = { state: () => table && !table.online ? table.g.state : null, view: () => table ? table.view(mySeat()) : null };
})();
