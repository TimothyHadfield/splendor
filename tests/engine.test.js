// Splendor engine tests. Run: node tests/engine.test.js
const assert = require('node:assert/strict');
const Cards = require('../js/cards.js');
const E = require('../js/engine.js');
const Bots = require('../js/bots.js');
const { mulberry } = require('../tools/measure.js');
const { CARDS, NOBLES } = Cards;
const sum = a => a.reduce((s, x) => s + x, 0);

let pass = 0;
function t(label, fn) { fn(); pass++; console.log('  PASS  ' + label); }

// ------------------------------------------------------------------ game facts
t('90 development cards: 40 / 30 / 20 by level, 8 / 6 / 4 per colour per level', () => {
  assert.equal(CARDS.length, 90);
  for (const [l, n] of [[1, 40], [2, 30], [3, 20]]) {
    assert.equal(CARDS.filter(c => c.level === l).length, n);
    for (let k = 0; k < 5; k++) assert.equal(CARDS.filter(c => c.level === l && c.bonus === k).length, n / 5);
  }
});
t('points per level: L1 five 1-pointers; L2 1/2/3; L3 3/4/5; totals 5 / 60 / 80', () => {
  const pts = l => CARDS.filter(c => c.level === l).map(c => c.points);
  assert.equal(sum(pts(1)), 5);
  assert.equal(pts(1).filter(p => p === 1).length, 5);
  assert.deepEqual([...new Set(pts(2))].sort(), [1, 2, 3]);
  assert.equal(sum(pts(2)), 5 * (1 + 1 + 2 + 2 + 2 + 3));
  assert.deepEqual([...new Set(pts(3))].sort(), [3, 4, 5]);
  assert.equal(sum(pts(3)), 5 * (3 + 4 + 4 + 5));
});
t('every colour has the same cost pattern within a level (the printed set is symmetric)', () => {
  for (const l of [1, 2, 3]) {
    const sig = k => CARDS.filter(c => c.level === l && c.bonus === k).map(c => c.points + ':' + c.cost.slice().sort((a, b) => b - a).join('')).sort().join(' ');
    for (let k = 1; k < 5; k++) assert.equal(sig(k), sig(0));
  }
  // no card costs its own colour at level 1 single-colour 1-pointers: 4 of another colour
  CARDS.filter(c => c.level === 1 && c.points === 1).forEach(c => { assert.equal(sum(c.cost), 4); assert.equal(c.cost[c.bonus], 0); });
});
t('specific cards: L1 white 1pt = 4 green; L3 white 5pt = 7 black + 3 white; L2 blue 3pt = 6 blue', () => {
  const find = (l, b, p, cost) => CARDS.some(c => c.level === l && c.bonus === b && c.points === p && c.cost.join() === cost.join());
  assert.ok(find(1, 0, 1, [0, 0, 4, 0, 0]));
  assert.ok(find(3, 0, 5, [3, 0, 0, 0, 7]));
  assert.ok(find(2, 1, 3, [0, 6, 0, 0, 0]));
  assert.ok(find(3, 3, 4, [0, 0, 7, 0, 0]));
});
t('10 nobles, 3 points each: five need 4+4 of two colours, five need 3+3+3', () => {
  assert.equal(NOBLES.length, 10);
  NOBLES.forEach(n => assert.equal(n.points, 3));
  assert.equal(NOBLES.filter(n => sum(n.req) === 8 && n.req.filter(x => x === 4).length === 2).length, 5);
  assert.equal(NOBLES.filter(n => sum(n.req) === 9 && n.req.filter(x => x === 3).length === 3).length, 5);
  assert.equal(new Set(NOBLES.map(n => n.req.join())).size, 10);
});

// ------------------------------------------------------------------ setup
t('setup: 4 / 5 / 7 gems per colour for 2 / 3 / 4 players, 5 gold, players + 1 nobles, 4 cards per row', () => {
  for (const [n, g] of [[2, 4], [3, 5], [4, 7]]) {
    const s = E.setup(n, {}, mulberry(n), []);
    assert.deepEqual(s.bank, [g, g, g, g, g, 5]);
    assert.equal(s.nobles.length, n + 1);
    s.market.forEach((row, l) => { assert.equal(row.length, 4); row.forEach(id => assert.equal(CARDS[id].level, l + 1)); });
    assert.deepEqual(s.decks.map(d => d.length), [36, 26, 16]);
  }
});

function blank(n) { const s = E.setup(n || 2, { firstSeat: 0 }, mulberry(77), ['A', 'B', 'C', 'D']); return s; }

// ------------------------------------------------------------------ taking gems
t('take 3 different colours; not 2 the same colour; not the same colour twice', () => {
  const s = blank();
  const s2 = E.apply(s, 0, { t: 'take', g: [0, 1, 2] });
  assert.deepEqual(s2.players[0].gems, [1, 1, 1, 0, 0, 0]);
  assert.deepEqual(s2.bank.slice(0, 5), [3, 3, 3, 4, 4]);
  assert.equal(s2.turn, 1);
  assert.throws(() => E.apply(s, 0, { t: 'take', g: [0, 0, 1] }));
  assert.throws(() => E.apply(s, 0, { t: 'take', g: [0, 1] }), /3 different/);
  assert.throws(() => E.apply(s, 1, { t: 'take', g: [0, 1, 2] }), /Not your turn/);
});
t('take 2 of one colour only when the bank holds 4 or more of it', () => {
  const s = blank();
  const s2 = E.apply(s, 0, { t: 'take2', c: 3 });
  assert.deepEqual(s2.players[0].gems, [0, 0, 0, 2, 0, 0]);
  assert.equal(s2.bank[3], 2);
  assert.throws(() => E.apply(s2, 1, { t: 'take2', c: 3 }), /needs 4/);
  const s3 = blank(); s3.bank[2] = 3;
  assert.throws(() => E.apply(s3, 0, { t: 'take2', c: 2 }), /needs 4/);
});
t('fewer than 3 different colours only when fewer than 3 colours are left; never gold', () => {
  const s = blank(); s.bank = [0, 0, 0, 2, 1, 5];
  const s2 = E.apply(s, 0, { t: 'take', g: [3, 4] });
  assert.deepEqual(s2.players[0].gems, [0, 0, 0, 1, 1, 0]);
  assert.throws(() => E.apply(s, 0, { t: 'take', g: [3] }), /3 different/);
  assert.throws(() => E.apply(blank(), 0, { t: 'take', g: [5, 0, 1] }));
});

// ------------------------------------------------------------------ reserving
t('reserve: from the table or blind from a deck, take a gold, refill, max 3', () => {
  let s = blank();
  const id = s.market[1][2];
  s = E.apply(s, 0, { t: 'reserve', id });
  assert.equal(s.players[0].gems[5], 1);
  assert.equal(s.bank[5], 4);
  assert.deepEqual(s.players[0].reserved, [{ id, blind: false }]);
  assert.notEqual(s.market[1][2], id);
  assert.equal(s.decks[1].length, 25);
  s = E.apply(s, 1, { t: 'take', g: [0, 1, 2] });
  const top = s.decks[2][0];
  s = E.apply(s, 0, { t: 'reserve', deck: 3 });
  assert.deepEqual(s.players[0].reserved[1], { id: top, blind: true });
  s = E.apply(s, 1, { t: 'take', g: [0, 1, 2] });
  s = E.apply(s, 0, { t: 'reserve', deck: 1 });
  s = E.apply(s, 1, { t: 'take', g: [0, 1, 2] });
  assert.throws(() => E.apply(s, 0, { t: 'reserve', deck: 1 }), /only 3/);
});
t('reserving with no gold left is allowed (you just get no gold)', () => {
  const s = blank(); s.bank[5] = 0;
  const s2 = E.apply(s, 0, { t: 'reserve', id: s.market[0][0] });
  assert.equal(s2.players[0].gems[5], 0);
  assert.equal(s2.players[0].reserved.length, 1);
});

// ------------------------------------------------------------------ buying
t('buy: bonuses discount, gold covers the gap, paid gems go back to the bank, row refills', () => {
  const s = blank();
  const id = CARDS.findIndex(c => c.level === 1 && c.points === 1 && c.bonus === 0); // 4 green
  s.market[0][0] = id; s.decks[0] = s.decks[0].filter(x => x !== id);
  const p = s.players[0];
  p.bonus[2] = 1; p.gems = [0, 0, 2, 0, 0, 1]; s.bank[2] -= 2; s.bank[5] -= 1;
  const before = s.decks[0][0];
  const s2 = E.apply(s, 0, { t: 'buy', id });
  const q = s2.players[0];
  assert.deepEqual(q.gems, [0, 0, 0, 0, 0, 0]);
  assert.equal(q.points, 1); assert.equal(q.bonus[0], 1); assert.deepEqual(q.cards, [id]);
  assert.deepEqual(s2.bank, [4, 4, 4, 4, 4, 5]);
  assert.equal(s2.market[0][0], before);
  assert.throws(() => E.apply(blank(), 0, { t: 'buy', id: blank().market[2][0] }), /afford/);
});
t('buy with a chosen payment: may spend gold instead of a held gem; overpaying is refused', () => {
  const s = blank();
  const id = s.market[0][0];
  const c = CARDS[id];
  const p = s.players[0];
  p.gems = c.cost.concat([2]);
  const k = c.cost.findIndex(x => x > 0);
  const pay = c.cost.concat([0]); pay[k]--; pay[5] = 1;
  const s2 = E.apply(s, 0, { t: 'buy', id, pay });
  assert.equal(s2.players[0].gems[5], 1);
  const bad = c.cost.concat([1]);
  assert.throws(() => E.apply(s, 0, { t: 'buy', id, pay: bad }), /payment/);
});
t('buy a reserved card from your hand', () => {
  let s = blank();
  const id = s.market[0][1];
  s = E.apply(s, 0, { t: 'reserve', id });
  s.players[0].gems = CARDS[id].cost.concat([1]);
  s = E.apply(s, 1, { t: 'take', g: [0, 1, 2] });
  s = E.apply(s, 0, { t: 'buy', id });
  assert.equal(s.players[0].reserved.length, 0);
  assert.ok(s.players[0].cards.includes(id));
});

// ------------------------------------------------------------------ 10-gem limit
t('more than 10 gems: return down to exactly 10 before the turn ends', () => {
  const s = blank(); s.players[0].gems = [2, 2, 2, 2, 1, 0];
  let s2 = E.apply(s, 0, { t: 'take', g: [0, 1, 2] });
  assert.equal(s2.phase, 'discard'); assert.equal(s2.turn, 0);
  assert.throws(() => E.apply(s2, 0, { t: 'discard', g: [1, 0, 0, 0, 0, 0] }), /exactly 10/);
  assert.throws(() => E.apply(s2, 0, { t: 'take', g: [0, 1, 2] }), /Return/);
  s2 = E.apply(s2, 0, { t: 'discard', g: [1, 1, 0, 0, 0, 0] });
  assert.equal(E.tokens(s2.players[0]), 10); assert.equal(s2.turn, 1);
});

// ------------------------------------------------------------------ nobles
t('a noble visits automatically when your bonuses meet it; you choose if two qualify; one per turn', () => {
  let s = blank();
  s.nobles = [0, 3]; // [0,4,4,0,0] and [4,0,0,0,4]
  const p = s.players[0];
  p.bonus = [4, 4, 3, 0, 4];
  const id = s.market[0].find(x => true);
  // buy a green card -> bonus green 4 -> noble 0 qualifies; noble 3 already qualifies -> choose
  const g = CARDS.findIndex(c => c.level === 1 && c.bonus === 2 && sum(c.cost) <= 4);
  s.market[0][0] = g; p.gems = CARDS[g].cost.concat([0]);
  s = E.apply(s, 0, { t: 'buy', id: g });
  assert.equal(s.phase, 'noble'); assert.deepEqual(s.nobleChoice.sort(), [0, 3]);
  s = E.apply(s, 0, { t: 'noble', id: 3 });
  assert.deepEqual(s.players[0].nobles, [3]); assert.equal(s.players[0].points, CARDS[g].points + 3);
  assert.deepEqual(s.nobles, [0]); assert.equal(s.turn, 1);
  // next own turn, the other noble arrives on its own
  s = E.apply(s, 1, { t: 'take', g: [0, 1, 2] });
  s = E.apply(s, 0, { t: 'take', g: [0, 1, 2] });
  assert.deepEqual(s.players[0].nobles.sort(), [0, 3]);
});

// ------------------------------------------------------------------ end of game
t('15 points finishes the round: the last seat before the starter still plays; tie -> fewer cards wins', () => {
  let s = blank(3); // starter is seat 0
  s.players[1].points = 15; s.players[1].cards = [1, 2, 3];
  s.players[2].points = 14; s.players[2].cards = [4];
  s = E.apply(s, 0, { t: 'take', g: [0, 1, 2] });
  s = E.apply(s, 1, { t: 'take', g: [0, 1, 2] });
  assert.equal(s.finalRound, true); assert.equal(s.over, false);
  // seat 2 buys a 1-pointer to tie on 15 with fewer cards
  const id = CARDS.findIndex(c => c.level === 1 && c.points === 1);
  s.market[0][0] = id; s.players[2].gems = CARDS[id].cost.concat([0]);
  s = E.apply(s, 2, { t: 'buy', id });
  assert.equal(s.over, true);
  assert.deepEqual(s.result.winners, [2]);
  assert.throws(() => E.apply(s, 0, { t: 'take', g: [0, 1, 2] }), /over/);
});
t('exact tie on points and cards is a shared win', () => {
  let s = blank(2);
  s.players[0].points = 15; s.players[1].points = 15;
  s = E.apply(s, 0, { t: 'take', g: [0, 1, 2] });
  s = E.apply(s, 1, { t: 'take', g: [0, 1, 2] });
  assert.deepEqual(s.result.winners, [0, 1]);
});

// ------------------------------------------------------------------ turns to afford
function brute(d, two) { // iterative deepening over real moves
  const ok = x => x.every(v => v <= 0);
  function go(x, depth) {
    if (ok(x)) return true; if (!depth) return false;
    const pos = [0, 1, 2, 3, 4].filter(k => x[k] > 0);
    const others = [0, 1, 2, 3, 4];
    for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) for (let c = b + 1; c < 5; c++) { const y = x.slice(); y[a]--; y[b]--; y[c]--; if (go(y, depth - 1)) return true; }
    for (const k of others) if (two[k]) { const y = x.slice(); y[k] -= 2; if (go(y, depth - 1)) return true; }
    return pos.length === 0;
  }
  for (let dpt = 0; dpt < 12; dpt++) if (go(d, dpt)) return dpt;
  return Infinity;
}
t('turns-to-afford matches a brute-force search over real gem-taking moves (300 random cases)', () => {
  const rng = mulberry(5);
  const memoTwo = [1, 1, 1, 1, 1];
  // hand-worked
  const P = (gems, bonus) => ({ gems, bonus });
  const L3 = CARDS.findIndex(c => c.level === 3 && c.points === 4 && Math.max(...c.cost) === 7);
  assert.equal(E.turnsToAfford(P([0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0]), L3, [7, 7, 7, 7, 7, 5]), 4); // 7 of one colour: 2+2+2+1
  let n = 0;
  for (let i = 0; i < 300; i++) {
    const id = Math.floor(rng() * 90);
    const gems = [0, 1, 2, 3, 4].map(() => Math.floor(rng() * 2)).concat([Math.floor(rng() * 2)]);
    const bonus = [0, 1, 2, 3, 4].map(() => Math.floor(rng() * 3));
    const bank = [7, 7, 7, 7, 7, 5].map((x, k) => k < 5 && rng() < 0.2 ? 3 : x);
    const got = E.turnsToAfford({ gems, bonus }, id, bank);
    const c = CARDS[id].cost;
    const d = [0, 1, 2, 3, 4].map(k => Math.max(0, c[k] - bonus[k] - gems[k]));
    const held = [0, 1, 2, 3, 4].reduce((s, k) => s + Math.min(gems[k], Math.max(0, c[k] - bonus[k])), 0);
    if (held + sum(d) > 10) { assert.equal(got, Infinity); continue; }
    // best over gold placements
    let want = Infinity;
    const two = bank.slice(0, 5).map(x => x >= 4 ? 1 : 0);
    (function rec(k, g, e) {
      if (k === 5) { if (!e.some((x, j) => x > bank[j])) want = Math.min(want, brute(e, two)); return; }
      for (let x = 0; x <= Math.min(g, d[k]); x++) { const f = e.slice(); f[k] = d[k] - x; rec(k + 1, g - x, f); }
    })(0, gems[5], d.slice());
    assert.equal(got, want, 'card ' + id + ' gems ' + gems + ' bonus ' + bonus);
    n++;
  }
  assert.ok(n > 100);
});

// ------------------------------------------------------------------ whole games
function playOut(levels, seed, check) {
  const rng = mulberry(seed);
  let s = E.setup(levels.length, {}, rng, levels);
  const total = s.bank.slice();
  let guard = 0;
  while (!s.over) {
    const seat = s.turn;
    const v = E.view(s, seat);
    const a = levels[seat] === 'random' ? randomLegal(s, seat, rng) : Bots.decide(v, seat, levels[seat], rng);
    s = E.apply(JSON.parse(JSON.stringify(s)), seat, JSON.parse(JSON.stringify(a)));
    if (check) check(s, total);
    assert.ok(++guard < 4000, 'runaway');
  }
  return s;
}
function randomLegal(s, seat, rng) {
  const p = s.players[seat];
  if (s.phase === 'discard') {
    const g = p.gems.slice(), ret = [0, 0, 0, 0, 0, 0]; let x = sum(g) - 10;
    while (x > 0) { const ks = [0, 1, 2, 3, 4, 5].filter(k => g[k] > 0); const k = ks[Math.floor(rng() * ks.length)]; g[k]--; ret[k]++; x--; }
    return { t: 'discard', g: ret };
  }
  const l = E.legal(s, seat);
  return l[Math.floor(rng() * l.length)];
}
t('150 full games (2-4 players, random movers and all computer levels): gems and cards are conserved, every game ends', () => {
  const lv = ['easy', 'medium', 'hard', 'random'];
  let games = 0;
  for (let g = 0; g < 150; g++) {
    const n = 2 + (g % 3);
    const levels = Array.from({ length: n }, (_, i) => lv[(g + i) % 4]);
    const s = playOut(levels, 1000 + g, (st, total) => {
      for (let k = 0; k < 6; k++) assert.equal(st.bank[k] + sum(st.players.map(p => p.gems[k])), total[k]);
      st.players.forEach(p => { assert.ok(p.gems.every(x => x >= 0)); assert.ok(p.reserved.length <= 3); if (st.phase === 'main' || st.turn !== st.players.indexOf(p)) assert.ok(sum(p.gems) <= 10); });
      const all = st.decks.flat().concat(st.market.flat().filter(x => x !== null), st.players.flatMap(p => p.cards.concat(p.reserved.map(r => r.id))));
      assert.equal(all.length, 90); assert.equal(new Set(all).size, 90);
      st.players.forEach(p => assert.equal(p.points, sum(p.cards.map(id => CARDS[id].points)) + 3 * p.nobles.length));
    });
    assert.ok(s.result.winners.length >= 1);
    if (!s.passes || s.passes < s.n) assert.ok(s.players.some(p => p.points >= 15));
    games++;
  }
  assert.equal(games, 150);
});

// ------------------------------------------------------------------ Cities of Splendor variant
const { CITIES } = Cards;
t('Cities: 14 city sides on 7 tiles; a game uses 3 tiles, one side each, and no nobles', () => {
  assert.equal(CITIES.length, 14);
  for (let tile = 1; tile <= 7; tile++) assert.equal(CITIES.filter(c => c.tile === tile).length, 2);
  for (let seed = 1; seed < 30; seed++) {
    const s = E.setup(2 + seed % 3, { cities: true }, mulberry(seed), []);
    assert.equal(s.mode, 'cities'); assert.deepEqual(s.nobles, []); assert.equal(s.cities.length, 3);
    assert.equal(new Set(s.cities.map(id => CITIES[id].tile)).size, 3);
  }
});
t('Cities: requirement checks for named colours, "N of one colour" and "N of one other colour"', () => {
  const P = (points, bonus) => ({ points, bonus });
  const named = CITIES.findIndex(c => c.pts === 11 && c.req.join() === '3,0,3,3,3');
  assert.ok(E.cityOk(P(11, [3, 0, 3, 3, 3]), named));
  assert.ok(!E.cityOk(P(10, [3, 0, 3, 3, 3]), named), 'needs the points too');
  assert.ok(!E.cityOk(P(11, [3, 9, 2, 3, 3]), named), 'a named colour short');
  const same5 = CITIES.findIndex(c => c.same === 5);
  assert.ok(E.cityOk(P(15, [0, 0, 5, 0, 0]), same5));
  assert.ok(!E.cityOk(P(15, [4, 4, 4, 4, 4]), same5));
  const other = CITIES.findIndex(c => c.other === 4); // 4 green + 4 of one other colour
  assert.ok(E.cityOk(P(14, [0, 0, 4, 0, 4]), other));
  assert.ok(!E.cityOk(P(14, [0, 0, 8, 0, 0]), other), 'the green cannot count twice');
  const free = CITIES.findIndex(c => c.pts === 17);
  assert.ok(E.cityOk(P(17, [0, 0, 0, 0, 0]), free));
});
t('Cities: taking a city starts the final round; only city holders can win, even with fewer points', () => {
  let s = E.setup(3, { cities: true, firstSeat: 0 }, mulberry(9), ['A', 'B', 'C']);
  const free = CITIES.findIndex(c => c.pts === 17);
  s.cities = [free];
  s.players[0].points = 17;
  s.players[1].points = 20; // no city: cannot win
  s = E.apply(s, 0, { t: 'take', g: [0, 1, 2] });
  assert.deepEqual(s.players[0].cities, [free]); assert.equal(s.finalRound, true); assert.equal(s.over, false);
  s = E.apply(s, 1, { t: 'take', g: [0, 1, 2] });
  s = E.apply(s, 2, { t: 'take', g: [0, 1, 2] });
  assert.equal(s.over, true); assert.deepEqual(s.result.winners, [0]);
});
t('Cities: 60 full games end with a city holder winning (or a stall), gems conserved', () => {
  const lv = ['easy', 'medium', 'hard', 'random'];
  for (let g = 0; g < 60; g++) {
    const n = 2 + (g % 3);
    const rng = mulberry(5000 + g);
    let s = E.setup(n, { cities: true }, rng, []);
    const total = s.bank.slice(); let guard = 0;
    while (!s.over) {
      const seat = s.turn, L = lv[(g + seat) % 4];
      const a = L === 'random' ? randomLegal(s, seat, rng) : Bots.decide(E.view(s, seat), seat, L, rng);
      s = E.apply(JSON.parse(JSON.stringify(s)), seat, a);
      for (let k = 0; k < 6; k++) assert.equal(s.bank[k] + sum(s.players.map(p => p.gems[k])), total[k]);
      assert.ok(++guard < 4000);
    }
    if (s.players.some(p => p.cities.length)) s.result.winners.forEach(w => assert.ok(s.players[w].cities.length > 0));
  }
});

// ------------------------------------------------------------------ secrecy
t('views: no deck order; others see only the level of your blind reserves', () => {
  let s = blank(3);
  s = E.apply(s, 0, { t: 'reserve', deck: 3 });
  const secret = s.players[0].reserved[0].id;
  const pub = JSON.stringify(E.view(s, -1));
  assert.ok(!('decks' in E.view(s, -1)));
  assert.deepEqual(E.view(s, 1).players[0].reserved[0], { id: null, blind: true, level: 3 });
  assert.equal(E.view(s, 0).players[0].reserved[0].id, secret);
  assert.ok(!pub.includes('"id":' + secret));
});

console.log(pass + ' passed');
