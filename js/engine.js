/* Splendor rules engine. Pure functions over a JSON-safe state.
   setup(n, options, rng, names) -> state      apply(state, seat, action) -> new state (throws on illegal)
   view(state, seat) -> what that seat may see (seat -1 = public only)
   Colours: 0 white, 1 blue, 2 green, 3 red, 4 black, 5 gold. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cards.js'));
  else root.SpEngine = factory(root.SpCards);
})(typeof self !== 'undefined' ? self : this, function (Cards) {
  'use strict';
  const { CARDS, NOBLES, CITIES, GEMS_BY_PLAYERS, GOLD, WIN_POINTS, MAX_TOKENS, MAX_RESERVED } = Cards;
  const NAMES = ['white', 'blue', 'green', 'red', 'black', 'gold'];
  const clone = x => JSON.parse(JSON.stringify(x));
  const sum = a => a.reduce((s, x) => s + x, 0);

  function shuffle(a, rng) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function setup(n, options, rng, names) {
    n = Math.max(2, Math.min(4, n | 0));
    const o = options || {};
    const decks = [1, 2, 3].map(l => shuffle(CARDS.filter(c => c.level === l).map(c => c.id), rng));
    const market = decks.map(d => d.splice(0, 4));
    const cities = !!o.cities;
    // Cities: no nobles; 3 of the 7 tiles, each on a random side, whatever the player count
    const nobles = cities ? [] : shuffle(NOBLES.map(x => x.id), rng).slice(0, n + 1);
    const cityIds = cities ? shuffle([1, 2, 3, 4, 5, 6, 7], rng).slice(0, 3).map(t => CITIES.filter(c => c.tile === t)[rng() < 0.5 ? 0 : 1].id) : [];
    const g = GEMS_BY_PLAYERS[n];
    const start = o.firstSeat === 0 ? 0 : Math.floor(rng() * n);
    const players = [];
    for (let i = 0; i < n; i++) {
      players.push({ name: String((names && names[i]) || 'Player ' + (i + 1)).slice(0, 24),
        gems: [0, 0, 0, 0, 0, 0], bonus: [0, 0, 0, 0, 0], cards: [], reserved: [], nobles: [], cities: [], points: 0 });
    }
    return {
      v: 1, n, mode: cities ? 'cities' : 'base', decks, market, bank: [g, g, g, g, g, GOLD], nobles, cities: cityIds, players,
      start, turn: start, phase: 'main', turns: 0, finalRound: false, over: false, result: null,
      nobleChoice: [], last: null, log: [],
    };
  }

  // ---------------------------------------------------------------- helpers
  function bonusOf(p) { return p.bonus; }
  // cheapest legal payment: coloured gems first, gold covers the rest. null if unaffordable.
  function autoPay(p, cardId) {
    const c = CARDS[cardId].cost;
    const pay = [0, 0, 0, 0, 0, 0];
    let goldNeed = 0;
    for (let k = 0; k < 5; k++) {
      const need = Math.max(0, c[k] - p.bonus[k]);
      const use = Math.min(need, p.gems[k]);
      pay[k] = use; goldNeed += need - use;
    }
    if (goldNeed > p.gems[5]) return null;
    pay[5] = goldNeed;
    return pay;
  }
  function payOk(p, cardId, pay) {
    if (!Array.isArray(pay) || pay.length !== 6) return false;
    const c = CARDS[cardId].cost;
    let gold = pay[5];
    if (!(Number.isInteger(gold) && gold >= 0 && gold <= p.gems[5])) return false;
    for (let k = 0; k < 5; k++) {
      const x = pay[k], need = Math.max(0, c[k] - p.bonus[k]);
      if (!(Number.isInteger(x) && x >= 0 && x <= p.gems[k] && x <= need)) return false;
      gold -= need - x;
    }
    return gold === 0; // gold exactly covers the shortfall (no overpaying)
  }
  function marketPos(s, id) {
    for (let l = 0; l < 3; l++) { const i = s.market[l].indexOf(id); if (i >= 0) return [l, i]; }
    return null;
  }
  function refill(s, l, i) { s.market[l][i] = s.decks[l].length ? s.decks[l].shift() : null; }
  function qualifies(p, nobleId) { const r = NOBLES[nobleId].req; return r.every((x, k) => p.bonus[k] >= x); }
  // a city: enough prestige and the bonuses shown (named colours, then "N of one colour" / "N of one other colour")
  function cityOk(p, cityId, points, bonus) {
    const c = CITIES[cityId];
    const pts = points === undefined ? p.points : points, b = bonus || p.bonus;
    if (pts < c.pts) return false;
    if (!c.req.every((x, k) => b[k] >= x)) return false;
    if (c.same && !b.some(x => x >= c.same)) return false;
    if (c.other && !b.some((x, k) => c.req[k] === 0 && x >= c.other)) return false;
    return true;
  }
  function tokens(p) { return sum(p.gems); }
  function log(s, seat, text) { s.log.push({ seat, text, t: s.turns }); if (s.log.length > 40) s.log.splice(0, s.log.length - 40); }
  const colorsAvail = s => [0, 1, 2, 3, 4].filter(k => s.bank[k] > 0);

  // Every legal action for the seat to move (used by bots, tests and the "pass" check).
  function legal(s, seat) {
    if (s.over || seat !== s.turn) return [];
    const p = s.players[seat];
    const out = [];
    if (s.phase === 'discard') { out.push({ t: 'discard' }); return out; } // any valid return set; see apply
    if (s.phase === 'noble') { s.nobleChoice.forEach(id => out.push({ t: 'noble', id })); return out; }
    if (s.phase === 'city') { s.nobleChoice.forEach(id => out.push({ t: 'city', id })); return out; }
    const av = colorsAvail(s);
    if (av.length >= 3) {
      for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) for (let c = b + 1; c < 5; c++)
        if (s.bank[a] && s.bank[b] && s.bank[c]) out.push({ t: 'take', g: [a, b, c] });
    } else if (av.length > 0) out.push({ t: 'take', g: av.slice() });
    for (let k = 0; k < 5; k++) if (s.bank[k] >= 4) out.push({ t: 'take2', c: k });
    for (let l = 0; l < 3; l++) for (const id of s.market[l]) if (id !== null && autoPay(p, id)) out.push({ t: 'buy', id });
    for (const r of p.reserved) if (autoPay(p, r.id)) out.push({ t: 'buy', id: r.id });
    if (p.reserved.length < MAX_RESERVED) {
      for (let l = 0; l < 3; l++) for (const id of s.market[l]) if (id !== null) out.push({ t: 'reserve', id });
      for (let l = 0; l < 3; l++) if (s.decks ? s.decks[l].length : s.deckSizes[l]) out.push({ t: 'reserve', deck: l + 1 });
    }
    if (!out.length) out.push({ t: 'pass' });
    return out;
  }

  // ---------------------------------------------------------------- apply
  function apply(state, seat, a) {
    const s = clone(state);
    if (s.over) throw new Error('The game is over');
    if (seat !== s.turn) throw new Error('Not your turn');
    if (!a || typeof a !== 'object' || typeof a.t !== 'string') throw new Error('Bad move');
    const p = s.players[seat];
    const nm = p.name;
    if (s.phase === 'discard') {
      if (a.t !== 'discard') throw new Error('Return gems first');
      const g = a.g;
      if (!Array.isArray(g) || g.length !== 6 || !g.every((x, k) => Number.isInteger(x) && x >= 0 && x <= p.gems[k])) throw new Error('Bad return');
      if (tokens(p) - sum(g) !== MAX_TOKENS) throw new Error('Return down to exactly 10 gems');
      for (let k = 0; k < 6; k++) { p.gems[k] -= g[k]; s.bank[k] += g[k]; }
      log(s, seat, nm + ' returned ' + sum(g) + ' gem' + (sum(g) > 1 ? 's' : ''));
      s.last = Object.assign({}, s.last || {}, { returned: g });
      return afterAction(s, seat);
    }
    if (s.phase === 'noble') {
      if (a.t !== 'noble' || s.nobleChoice.indexOf(a.id) < 0) throw new Error('Pick one of the nobles');
      takeNoble(s, seat, a.id);
      return endTurn(s, seat);
    }
    if (s.phase === 'city') {
      if (a.t !== 'city' || s.nobleChoice.indexOf(a.id) < 0) throw new Error('Pick one of the cities');
      takeCity(s, seat, a.id);
      return endTurn(s, seat);
    }
    s.last = { seat, t: a.t };
    if (a.t === 'take') {
      const g = a.g;
      if (!Array.isArray(g) || !g.length || g.length > 3 || new Set(g).size !== g.length) throw new Error('Take up to 3 different colours');
      if (!g.every(k => Number.isInteger(k) && k >= 0 && k < 5 && s.bank[k] > 0)) throw new Error('That colour is empty');
      // fewer than 3 only when fewer than 3 colours are left
      if (g.length < Math.min(3, colorsAvail(s).length)) throw new Error('Take 3 different colours');
      g.forEach(k => { s.bank[k]--; p.gems[k]++; });
      s.last.g = g.slice();
      log(s, seat, nm + ' took ' + g.map(k => NAMES[k]).join(', '));
    } else if (a.t === 'take2') {
      const k = a.c;
      if (!(Number.isInteger(k) && k >= 0 && k < 5)) throw new Error('Bad colour');
      if (s.bank[k] < 4) throw new Error('Two of a colour needs 4 in the bank');
      s.bank[k] -= 2; p.gems[k] += 2;
      s.last.g = [k, k];
      log(s, seat, nm + ' took 2 ' + NAMES[k]);
    } else if (a.t === 'reserve') {
      if (p.reserved.length >= MAX_RESERVED) throw new Error('You can hold only 3 reserved cards');
      let id, blind = false;
      if (a.deck) {
        const l = a.deck - 1;
        if (!(l >= 0 && l < 3) || !s.decks[l].length) throw new Error('That deck is empty');
        id = s.decks[l].shift(); blind = true;
      } else {
        const pos = marketPos(s, a.id);
        if (!pos) throw new Error('That card is not on the table');
        id = a.id; refill(s, pos[0], pos[1]);
        s.last.from = pos;
      }
      p.reserved.push({ id, blind });
      let gold = false;
      if (s.bank[5] > 0) { s.bank[5]--; p.gems[5]++; gold = true; }
      s.last.id = blind ? null : id; s.last.deck = blind ? CARDS[id].level : 0; s.last.gold = gold;
      log(s, seat, nm + ' reserved ' + (blind ? 'a level ' + CARDS[id].level + ' card from the deck' : 'a card') + (gold ? ' and took a gold' : ''));
    } else if (a.t === 'buy') {
      const id = a.id;
      if (!(Number.isInteger(id) && id >= 0 && id < CARDS.length)) throw new Error('Bad card');
      const ri = p.reserved.findIndex(r => r.id === id);
      const pos = ri >= 0 ? null : marketPos(s, id);
      if (ri < 0 && !pos) throw new Error('That card is not on the table');
      let pay = a.pay;
      if (pay !== undefined) { if (!payOk(p, id, pay)) throw new Error('That payment doesn’t match the cost'); } else pay = autoPay(p, id);
      if (!pay) throw new Error('You can’t afford that card');
      for (let k = 0; k < 6; k++) { p.gems[k] -= pay[k]; s.bank[k] += pay[k]; }
      if (ri >= 0) p.reserved.splice(ri, 1); else refill(s, pos[0], pos[1]);
      const c = CARDS[id];
      p.cards.push(id); p.bonus[c.bonus]++; p.points += c.points;
      s.last.id = id; s.last.from = pos; s.last.reserved = ri >= 0; s.last.pay = pay;
      log(s, seat, nm + ' bought a ' + NAMES[c.bonus] + (c.points ? ' (' + c.points + ' pt' + (c.points > 1 ? 's' : '') + ')' : '') + (ri >= 0 ? ' from reserve' : ''));
    } else if (a.t === 'pass') {
      const l = legal(s, seat);
      if (!(l.length === 1 && l[0].t === 'pass')) throw new Error('You have a legal move');
      log(s, seat, nm + ' had no move and passed');
    } else throw new Error('Bad move');
    return afterAction(s, seat);
  }

  function afterAction(s, seat) {
    const p = s.players[seat];
    if (tokens(p) > MAX_TOKENS) { s.phase = 'discard'; return s; }
    if (s.mode === 'cities') {
      const qc = p.cities.length ? [] : s.cities.filter(id => cityOk(p, id));
      if (qc.length > 1) { s.phase = 'city'; s.nobleChoice = qc; return s; }
      if (qc.length === 1) takeCity(s, seat, qc[0]);
      return endTurn(s, seat);
    }
    const q = s.nobles.filter(id => qualifies(p, id));
    if (q.length > 1) { s.phase = 'noble'; s.nobleChoice = q; return s; }
    if (q.length === 1) takeNoble(s, seat, q[0]);
    return endTurn(s, seat);
  }
  function takeNoble(s, seat, id) {
    const p = s.players[seat];
    s.nobles.splice(s.nobles.indexOf(id), 1);
    p.nobles.push(id); p.points += NOBLES[id].points;
    s.last = Object.assign({}, s.last || {}, { noble: id });
    log(s, seat, p.name + ' was visited by a noble (+3)');
  }
  function takeCity(s, seat, id) {
    const p = s.players[seat];
    s.cities.splice(s.cities.indexOf(id), 1);
    p.cities.push(id);
    s.last = Object.assign({}, s.last || {}, { city: id });
    log(s, seat, p.name + ' took a city!');
  }
  function endTurn(s, seat) {
    s.phase = 'main'; s.nobleChoice = [];
    s.turns++;
    if (s.mode === 'cities' ? s.players[seat].cities.length > 0 : s.players[seat].points >= WIN_POINTS) s.finalRound = true;
    const next = (seat + 1) % s.n;
    if (s.finalRound && next === s.start) { finish(s); return s; }
    if (s.turns >= 600) { finish(s); return s; } // safety net; no real game comes near it
    // stalemate guard: if a whole round passes with nobody able to move, the game ends
    if (s.last && s.last.t === 'pass') { s.passes = (s.passes || 0) + 1; if (s.passes >= s.n) { finish(s); return s; } }
    else s.passes = 0;
    s.turn = next;
    return s;
  }
  // most prestige; tie -> fewest development cards bought; still tied -> shared win
  function finish(s) {
    s.over = true;
    let sc = s.players.map((p, i) => ({ seat: i, points: p.points, cards: p.cards.length, city: p.cities ? p.cities.length : 0 }));
    // Cities: only players who took a city can win (rulebook); among them most points, then (our tie-break) fewer cards
    const pool = s.mode === 'cities' && sc.some(x => x.city) ? sc.filter(x => x.city) : sc;
    const best = pool.slice().sort((a, b) => b.points - a.points || a.cards - b.cards)[0];
    const winners = pool.filter(x => x.points === best.points && x.cards === best.cards).map(x => x.seat);
    s.result = { winners, scores: sc };
    log(s, -1, 'Game over');
  }

  // ---------------------------------------------------------------- views
  // seat -1 = public. Hidden: deck order, other players' blind reserves.
  function view(s, seat) {
    const v = {
      n: s.n, mode: s.mode || 'base', cities: s.cities || [], market: s.market, deckSizes: s.decks.map(d => d.length), bank: s.bank, nobles: s.nobles,
      start: s.start, turn: s.turn, phase: s.phase, turns: s.turns, finalRound: s.finalRound, over: s.over,
      result: s.result, nobleChoice: s.phase === 'noble' || s.phase === 'city' ? s.nobleChoice : [], last: publicLast(s.last, s, seat), log: s.log, seat,
      players: s.players.map((p, i) => ({
        name: p.name, gems: p.gems, bonus: p.bonus, cards: p.cards, nobles: p.nobles, cities: p.cities || [], points: p.points,
        reserved: p.reserved.map(r => (r.blind && i !== seat && !s.over) ? { id: null, blind: true, level: CARDS[r.id].level } : { id: r.id, blind: r.blind, level: CARDS[r.id].level }),
      })),
    };
    return clone(v);
  }
  function publicLast(last, s, seat) {
    if (!last) return null;
    return last; // blind-reserve id is already null in last
  }

  // ---------------------------------------------------------------- analysis
  // Fewest gem-taking turns before `need` (per colour, after bonuses and held gems) can be bought.
  // Moves per turn: 1 each from up to 3 different colours, or 2 of one colour (bank must hold 4+).
  // Gold held covers any colour. Ignores what opponents take. Returns Infinity if the bank can't cover it
  // or it would need more than 10 gems in hand.
  const memo = new Map();
  function turnsFor(d, two) {
    const key = d.join(',') + '|' + two.join('');
    if (memo.has(key)) return memo.get(key);
    const pos = [];
    for (let k = 0; k < 5; k++) if (d[k] > 0) pos.push(k);
    let best;
    if (!pos.length) best = 0;
    else {
      best = Infinity;
      // take one each of up to 3 (always take as many as useful)
      const m = Math.min(3, pos.length);
      const combos = [];
      (function rec(st, cur) { if (cur.length === m) { combos.push(cur.slice()); return; } for (let i = st; i < pos.length; i++) { cur.push(pos[i]); rec(i + 1, cur); cur.pop(); } })(0, []);
      for (const c of combos) { const e = d.slice(); c.forEach(k => e[k]--); best = Math.min(best, 1 + turnsFor(e, two)); }
      for (const k of pos) if (two[k] && d[k] >= 2) { const e = d.slice(); e[k] -= 2; best = Math.min(best, 1 + turnsFor(e, two)); }
    }
    memo.set(key, best);
    return best;
  }
  function turnsToAfford(p, cardId, bank) {
    const c = CARDS[cardId].cost;
    const d = [0, 0, 0, 0, 0];
    let held = 0;
    for (let k = 0; k < 5; k++) { d[k] = Math.max(0, c[k] - p.bonus[k] - p.gems[k]); }
    const shortTotal = sum(d);
    let gold = p.gems[5];
    if (shortTotal <= gold) return 0;
    // gems still in hand that count toward the card + gold all stay in hand while collecting
    for (let k = 0; k < 5; k++) held += Math.min(p.gems[k], Math.max(0, c[k] - p.bonus[k]));
    if (held + gold + (shortTotal - gold) > MAX_TOKENS) return Infinity;
    const two = [0, 1, 2, 3, 4].map(k => (bank ? bank[k] >= 4 : true) ? 1 : 0);
    // spend gold where it saves the most turns
    let best = Infinity;
    (function rec(k, g, e) {
      if (k === 5) {
        if (bank && e.some((x, i) => x > bank[i])) return;
        best = Math.min(best, turnsFor(e, two)); return;
      }
      for (let x = 0; x <= Math.min(g, d[k]); x++) { const f = e.slice(); f[k] = d[k] - x; rec(k + 1, g - x, f); }
    })(0, gold, d.slice());
    return best;
  }

  return { setup, apply, legal, view, autoPay, payOk, qualifies, cityOk, turnsToAfford, tokens, NAMES, clone };
});
