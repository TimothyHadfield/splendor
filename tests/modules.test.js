// Cities of Splendor modules: Trading posts and Strongholds (rules per docs/rules-check.md).
// node tests/modules.test.js      (ENGINE=<dir with engine.js + cards.js> runs it against another copy)
const path = require('path');
const assert = require('node:assert/strict');
const dir = process.env.ENGINE ? path.resolve(process.env.ENGINE) : path.join(__dirname, '../js');
const Cards = require(path.join(dir, 'cards.js'));
const E = require(path.join(dir, 'engine.js'));
const { mulberry } = require('../tools/measure.js');
const { CARDS } = Cards;
const sum = a => a.reduce((s, x) => s + x, 0);

let pass = 0, fail = 0;
function t(label, fn) { try { fn(); pass++; console.log('  PASS  ' + label); } catch (e) { fail++; console.log('  FAIL  ' + label + ' :: ' + String(e.message).split('\n')[0]); } }

// a 2-player game with seat 0 to move, its hand and bonuses set by hand
function game(mod, seed) {
  const s = E.setup(2, { module: mod, firstSeat: 0 }, mulberry(seed || 7), ['A', 'B']);
  return s;
}
function giveBonus(s, seat, bonus) { const p = s.players[seat]; p.bonus = bonus.slice(); }
// a market card (not in anyone's hand) of the given level
const marketCard = (s, l, i) => s.market[l - 1][i || 0];
// make seat able to buy card id outright with coloured gems (bank keeps its count)
function fund(s, seat, id) {
  const p = s.players[seat], c = CARDS[id].cost;
  for (let k = 0; k < 5; k++) { const need = Math.max(0, c[k] - p.bonus[k]); p.gems[k] = need; }
}
function passTurn(s) { // seat to move takes gems (or anything legal) so play comes back
  const L = E.legal(s, s.turn).filter(a => a.t === 'take');
  return E.apply(s, s.turn, L[0] || E.legal(s, s.turn)[0]);
}

// ------------------------------------------------------------------ setup
t('setup: Trading posts gives every player an empty coat-of-arms row; Strongholds an empty board; same deal as base', () => {
  const b = E.setup(3, {}, mulberry(3), []), p = E.setup(3, { module: 'posts' }, mulberry(3), []), f = E.setup(3, { module: 'forts' }, mulberry(3), []);
  assert.equal(p.mod, 'posts'); assert.deepEqual(p.players.map(x => x.posts), [[], [], []]);
  assert.equal(f.mod, 'forts'); assert.deepEqual(f.forts, {});
  assert.deepEqual(p.market, b.market); assert.deepEqual(f.market, b.market); assert.deepEqual(p.nobles, b.nobles);
  assert.equal(b.mod, undefined); assert.equal(b.forts, undefined); assert.equal(b.players[0].posts, undefined);
});
t('setup: the modules are played one at a time (Cities wins over a module)', () => {
  const s = E.setup(2, { cities: true, module: 'posts' }, mulberry(1), []);
  assert.equal(s.mode, 'cities'); assert.equal(s.mod, undefined);
});

// ------------------------------------------------------------------ Trading posts
t('posts: a coat of arms goes on a power at the end of the turn you meet it (3 red + 1 white -> power 1)', () => {
  let s = game('posts');
  giveBonus(s, 0, [1, 0, 0, 3, 0]);
  s = E.apply(s, 0, E.legal(s, 0).find(a => a.t === 'take'));
  assert.deepEqual(s.players[0].posts, [0]);
  assert.deepEqual(s.players[1].posts, []);
});
t('posts: requirements are exact: 2 white -> power 2; 3 blue + 1 black -> power 3; 3 black -> power 5; 5 green needs a noble too', () => {
  const check = (bonus, nobles, want) => {
    let s = game('posts'); giveBonus(s, 0, bonus); s.players[0].nobles = nobles;
    s = E.apply(s, 0, E.legal(s, 0).find(a => a.t === 'take'));
    assert.deepEqual(s.players[0].posts.slice().sort(), want, JSON.stringify(bonus));
  };
  check([2, 0, 0, 0, 0], [], [1]);
  check([1, 0, 0, 0, 0], [], []);
  check([0, 3, 0, 0, 1], [], [2]);
  check([0, 3, 0, 0, 0], [], []);
  check([0, 0, 0, 0, 3], [], [4]);
  check([0, 0, 5, 0, 0], [], []);
  check([0, 0, 5, 0, 0], [0], [3]);
});
t('posts: several powers met at once all get a coat of arms that turn', () => {
  let s = game('posts'); giveBonus(s, 0, [2, 3, 0, 3, 1]);
  s = E.apply(s, 0, E.legal(s, 0).find(a => a.t === 'take'));
  assert.deepEqual(s.players[0].posts.slice().sort(), [0, 1, 2]);
});
t('posts: power 1 - after buying a card take 1 gem (any colour, even one just paid); not on the turn the coat goes on', () => {
  let s = game('posts');
  giveBonus(s, 0, [1, 0, 0, 3, 0]);
  const id = marketCard(s, 1, 0); fund(s, 0, id);
  s = E.apply(s, 0, { t: 'buy', id }); // coat placed at the end of this turn: no free gem yet
  assert.equal(s.phase, 'main'); assert.equal(s.turn, 1); assert.ok(s.players[0].posts.includes(0));
  s = passTurn(s);
  const id2 = marketCard(s, 1, 1); fund(s, 0, id2);
  const paid = CARDS[id2].cost.findIndex((x, k) => x - s.players[0].bonus[k] > 0);
  s = E.apply(s, 0, { t: 'buy', id: id2 });
  assert.equal(s.phase, 'gem'); assert.equal(s.turn, 0);
  assert.ok(E.legal(s, 0).some(a => a.c === paid), 'may take a colour just spent');
  assert.ok(!E.legal(s, 0).some(a => a.c === 5), 'never gold');
  const before = sum(s.players[0].gems);
  s = E.apply(s, 0, { t: 'gem', c: paid });
  assert.equal(sum(s.players[0].gems), before + 1); assert.equal(s.turn, 1);
});
t('posts: power 2 - taking 2 of a colour also gives 1 gem of ANOTHER colour', () => {
  let s = game('posts'); s.players[0].posts = [1];
  const k = [0, 1, 2, 3, 4].find(x => s.bank[x] >= 4);
  s = E.apply(s, 0, { t: 'take2', c: k });
  assert.equal(s.phase, 'gem');
  assert.ok(!E.legal(s, 0).some(a => a.c === k), 'not the colour just taken');
  assert.throws(() => E.apply(s, 0, { t: 'gem', c: k }));
  const o = (k + 1) % 5;
  s = E.apply(s, 0, { t: 'gem', c: o });
  assert.equal(s.players[0].gems[k], 2); assert.equal(s.players[0].gems[o], 1); assert.equal(s.turn, 1);
  // without the power: no extra gem
  let b = game('posts'); b = E.apply(b, 0, { t: 'take2', c: k });
  assert.equal(b.turn, 1); assert.equal(sum(b.players[0].gems), 2);
});
t('posts: power 3 - each gold pays for 2 gems of one colour (still 1 token toward the 10)', () => {
  const s = game('posts');
  const id = CARDS.findIndex(c => c.level === 1 && sum(c.cost) === 4 && c.cost.some(x => x === 4)); // 4 of one colour
  const p = s.players[0]; p.gems = [0, 0, 0, 0, 0, 2];
  assert.equal(E.autoPay(p, id), null);
  p.posts = [2];
  const pay = E.autoPay(p, id);
  assert.equal(pay[5], 2);
  p.gems[5] = 1; assert.equal(E.autoPay(p, id), null, 'one gold covers 2, not 4');
  p.gems = [0, 0, 0, 0, 0, 2];
  assert.ok(E.payOk(p, id, [0, 0, 0, 0, 0, 2]));
  assert.ok(!E.payOk(p, id, [0, 0, 0, 0, 0, 1]));
  assert.equal(E.turnsToAfford(p, id, s.bank), 0);
});
t('posts: power 3 - two different colours short by 1 each still need 2 gold (a gold pays one colour)', () => {
  const id = CARDS.findIndex(c => c.level === 1 && c.cost.filter(x => x).length >= 2);
  const ks = [0, 1, 2, 3, 4].filter(k => CARDS[id].cost[k]);
  const p = { gems: CARDS[id].cost.concat([0]), bonus: [0, 0, 0, 0, 0], posts: [2] };
  p.gems[ks[0]]--; p.gems[ks[1]]--; p.gems[5] = 1;
  assert.equal(E.autoPay(p, id), null);
  p.gems[5] = 2; assert.equal(E.autoPay(p, id)[5], 2);
});
t('posts: power 4 - 5 points once (with a noble); power 5 - 1 point per coat of arms, growing as more are placed', () => {
  let s = game('posts'); giveBonus(s, 0, [0, 0, 5, 0, 0]); s.players[0].nobles = [0]; s.players[0].points = 3;
  s = E.apply(s, 0, E.legal(s, 0).find(a => a.t === 'take'));
  assert.equal(s.players[0].points, 8);
  s = passTurn(s); s = E.apply(s, 0, E.legal(s, 0).find(a => a.t === 'take'));
  assert.equal(s.players[0].points, 8, 'once only');
  // power 5 placed second: counts both coats (2); a third coat later: 3
  giveBonus(s, 0, [0, 0, 5, 0, 3]); s = passTurn(s); s = E.apply(s, 0, E.legal(s, 0).find(a => a.t === 'take'));
  assert.equal(s.players[0].points, 8 + 2);
  giveBonus(s, 0, [2, 0, 5, 0, 3]); s = passTurn(s); s = E.apply(s, 0, E.legal(s, 0).find(a => a.t === 'take'));
  assert.equal(s.players[0].points, 8 + 3 + 0 /* power 2 has no points */);
});
t('posts: points from a coat of arms can trigger the final round', () => {
  let s = game('posts'); giveBonus(s, 0, [0, 0, 5, 0, 0]); s.players[0].nobles = [0]; s.players[0].points = 11;
  s = E.apply(s, 0, E.legal(s, 0).find(a => a.t === 'take'));
  assert.equal(s.players[0].points, 16); assert.ok(s.finalRound);
});

// ------------------------------------------------------------------ Strongholds
t('forts: buying a card is followed by a stronghold action, before the empty spot is refilled', () => {
  let s = game('forts');
  const id = marketCard(s, 1, 0); fund(s, 0, id);
  s = E.apply(s, 0, { t: 'buy', id });
  assert.equal(s.phase, 'fort'); assert.equal(s.turn, 0);
  assert.equal(s.market[0][0], null, 'refill waits');
  assert.ok(!E.legal(s, 0).some(a => a.id === null || a.id === id));
  const target = s.market[2][0];
  s = E.apply(s, 0, { t: 'fort', id: target });
  assert.deepEqual(s.forts[target], { seat: 0, n: 1 });
  assert.notEqual(s.market[0][0], null, 'refilled after');
  assert.equal(s.turn, 1);
});
t('forts: taking gems or reserving gives no stronghold action', () => {
  let s = game('forts');
  s = E.apply(s, 0, E.legal(s, 0).find(a => a.t === 'take'));
  assert.equal(s.turn, 1); assert.deepEqual(s.forts, {});
});
t('forts: a card with another player\'s stronghold can\'t be bought or reserved by anyone else', () => {
  let s = game('forts');
  const id = s.market[1][2];
  s.forts[id] = { seat: 1, n: 1 }; fund(s, 0, id);
  assert.ok(!E.legal(s, 0).some(a => a.id === id));
  assert.throws(() => E.apply(s, 0, { t: 'buy', id }));
  assert.throws(() => E.apply(s, 0, { t: 'reserve', id }));
});
t('forts: the owner may buy or reserve it and gets the strongholds back', () => {
  let s = game('forts');
  const id = s.market[1][2];
  s.forts[id] = { seat: 0, n: 2 };
  assert.equal(E.fortsLeft(s, 0), 1);
  s = E.apply(s, 0, { t: 'reserve', id });
  assert.equal(s.forts[id], undefined); assert.equal(E.fortsLeft(s, 0), 3);
});
t('forts: place on your own card (up to 3), never on another colour\'s; move one; or remove one of another player\'s', () => {
  let s = game('forts');
  const [a, b, c] = [s.market[2][0], s.market[2][1], s.market[2][2]];
  s.forts[a] = { seat: 0, n: 2 }; s.forts[b] = { seat: 1, n: 1 };
  const id = marketCard(s, 1, 0); fund(s, 0, id);
  s = E.apply(s, 0, { t: 'buy', id });
  const L = E.legal(s, 0);
  assert.ok(L.some(m => m.id === a && m.from === undefined), 'add a third to my own');
  assert.ok(!L.some(m => m.id === b && m.rm === undefined), 'not onto another colour');
  assert.ok(L.some(m => m.rm === b), 'remove theirs');
  assert.ok(L.some(m => m.id === c && m.from === a), 'move mine');
  const r = E.apply(s, 0, { t: 'fort', rm: b });
  assert.equal(r.forts[b], undefined);
  const mv = E.apply(s, 0, { t: 'fort', id: c, from: a });
  assert.deepEqual(mv.forts[a], { seat: 0, n: 1 }); assert.deepEqual(mv.forts[c], { seat: 0, n: 1 });
});
t('forts: 3 strongholds each; with none left you can only move or remove', () => {
  let s = game('forts');
  const [a, b] = [s.market[2][0], s.market[2][1]];
  s.forts[a] = { seat: 0, n: 2 }; s.forts[b] = { seat: 0, n: 1 };
  const id = marketCard(s, 1, 0); fund(s, 0, id);
  s = E.apply(s, 0, { t: 'buy', id });
  assert.ok(E.legal(s, 0).every(m => m.from !== undefined || m.rm !== undefined));
});
t('forts: all 3 on one card -> after your action you may also buy it (before nobles and the 10-gem check), then a stronghold action', () => {
  let s = game('forts');
  const id = s.market[2][3];
  s.forts[id] = { seat: 0, n: 3 };
  fund(s, 0, id);
  const p = s.players[0]; const extra = 10 - sum(p.gems); p.gems[5] += Math.max(0, extra); // 10 gems in hand: taking 3 goes over
  s.bank[5] = 5 - p.gems[5];
  const take = E.legal(s, 0).find(a => a.t === 'take');
  s = E.apply(s, 0, take);
  assert.equal(s.phase, 'conquer'); assert.deepEqual(E.legal(s, 0).map(a => a.t), ['conquer', 'skip']);
  const pts = s.players[0].points;
  s = E.apply(s, 0, { t: 'conquer' });
  assert.ok(s.players[0].cards.includes(id)); assert.equal(s.players[0].points, pts + CARDS[id].points);
  assert.equal(s.forts[id], undefined);
  assert.equal(s.phase, 'fort');
  s = E.apply(s, 0, E.legal(s, 0)[0]);
  assert.notEqual(s.market[2][3], null, 'its spot refilled');
  assert.ok(s.phase === 'main' || s.phase === 'discard');
});
t('forts: the conquest may be skipped, and is only offered when you can pay', () => {
  let s = game('forts');
  const id = s.market[2][3];
  s.forts[id] = { seat: 0, n: 3 };
  let a = E.apply(s, 0, E.legal(s, 0).find(x => x.t === 'take'));
  assert.equal(a.turn, 1, 'can\'t pay: no offer');
  fund(s, 0, id);
  a = E.apply(s, 0, { t: 'reserve', deck: 1 });
  assert.equal(a.phase, 'conquer');
  a = E.apply(a, 0, { t: 'skip' });
  assert.equal(a.phase, 'discard', 'the 10-gem check comes after'); assert.deepEqual(a.forts[id], { seat: 0, n: 3 });
});
t('views: everyone sees the strongholds and coats of arms; legal moves from a view match the state', () => {
  let s = game('forts'); const id = s.market[0][1]; s.forts[id] = { seat: 1, n: 2 };
  const v = E.view(s, 0);
  assert.deepEqual(v.forts, s.forts); assert.equal(v.mod, 'forts');
  assert.deepEqual(E.legal(v, 0), E.legal(s, 0));
  let q = game('posts'); q.players[1].posts = [4];
  assert.deepEqual(E.view(q, 0).players[1].posts, [4]);
});
t('random play: both modules always finish, gems are conserved, strongholds only on face-up cards', () => {
  for (const mod of ['posts', 'forts']) for (let g = 0; g < 60; g++) {
    const r = mulberry(100 + g); let s = E.setup(2 + g % 3, { module: mod }, r, []);
    while (!s.over) {
      const seat = s.turn, L = E.legal(s, seat);
      let a;
      if (s.phase === 'discard') { const ret = [0, 0, 0, 0, 0, 0], gg = s.players[seat].gems.slice(); let ex = sum(gg) - 10; while (ex > 0) { const k = gg.findIndex(x => x > 0); gg[k]--; ret[k]++; ex--; } a = { t: 'discard', g: ret }; }
      else { const buys = L.filter(x => x.t === 'buy'); a = buys.length && r() < 0.7 ? buys[0] : L[Math.floor(r() * L.length)]; }
      s = E.apply(s, seat, a);
    }
    const tot = [0, 0, 0, 0, 0, 0]; s.players.forEach(p => p.gems.forEach((x, k) => { tot[k] += x; })); s.bank.forEach((x, k) => { tot[k] += x; });
    const G = { 2: 4, 3: 5, 4: 7 }[s.n];
    assert.deepEqual(tot, [G, G, G, G, G, 5]);
    for (const k in (s.forts || {})) assert.ok(s.market.some(row => row.includes(Number(k))));
  }
});

console.log(pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
if (fail) process.exit(1);
