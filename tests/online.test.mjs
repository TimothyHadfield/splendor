// The Splendor engine behind the shared online module's game interface (_online/README.md).
// Run: node tests/online.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createLocal } from '../js/online.js';
const require = createRequire(import.meta.url);
const { game, viewFromSnap } = require('../js/online-game.js');
const Engine = require('../js/engine.js');

let pass = 0;
const ok = label => { pass++; console.log('  PASS  ' + label); };
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const humans = n => Array.from({ length: n }, (_, i) => ({ kind: 'human', name: 'P' + (i + 1) }));
const clone = x => JSON.parse(JSON.stringify(x));
const step = (s, rng) => { const seat = game.toAct(s)[0]; return game.apply(clone(s), seat, clone(game.bot({ pub: game.publicView(s), mine: game.privateView(s, seat), state: s }, seat, rng))); };

// 1. Every seat "human", every move made by game.bot through JSON copies and the two snapshot halves (the online path).
{
  let games = 0, moves = 0;
  for (let g = 0; g < 30; g++) {
    const rng = mulberry(g + 11);
    const n = 2 + (g % 3);
    let s = game.setup(n, { level: ['easy', 'medium', 'hard'][g % 3], cities: g % 2 === 1 }, rng, humans(n));
    assert.equal(JSON.stringify(clone(s)), JSON.stringify(s), 'state survives JSON');
    while (!game.isOver(s)) {
      assert.equal(game.toAct(s).length, 1, 'exactly one seat to act');
      s = step(s, rng);
      assert.ok(++moves < 100000, 'runaway');
    }
    assert.deepEqual(game.toAct(s), []);
    const pub = game.publicView(s);
    assert.ok(pub.over && pub.result && pub.result.winners.length >= 1);
    games++;
  }
  ok(games + ' online-path games (2-4 seats, base and Cities) end cleanly; ' + moves + ' moves, never an illegal bot move');
}

// 2. Illegal moves throw (online.js drops them).
{
  const s = game.setup(2, {}, mulberry(3), humans(2));
  const seat = game.toAct(s)[0], other = 1 - seat;
  assert.throws(() => game.apply(clone(s), other, { t: 'take', g: [0, 1, 2] }), /Not your turn/);
  assert.throws(() => game.apply(clone(s), seat, { t: 'take', g: [0, 0, 0] }));
  assert.throws(() => game.apply(clone(s), seat, { t: 'buy', id: 999 }));
  assert.throws(() => game.apply(clone(s), seat, {}));
  assert.throws(() => game.apply(clone(s), seat, null));
  ok('moves out of turn, bad picks and malformed moves throw');
}

// 3. Secrecy: the public view has no deck order and no blind-reserve ids; a private view is one seat's own blind reserves.
{
  const rng = mulberry(40);
  let s = game.setup(3, {}, rng, humans(3));
  const seat0 = game.toAct(s)[0];
  s = game.apply(clone(s), seat0, { t: 'reserve', deck: 3 });
  const secret = s.players[seat0].reserved[0].id;
  const pub = game.publicView(s), pubJ = JSON.stringify(pub);
  assert.ok(!('decks' in pub) && !('seat' in pub));
  assert.ok(!pubJ.includes('"id":' + secret + ','), 'blind reserve id hidden');
  assert.deepEqual(game.privateView(s, seat0), { seat: seat0, blind: [secret] });
  for (let j = 0; j < 3; j++) if (j !== seat0) assert.deepEqual(game.privateView(s, j).blind, []);
  ok('public view: no deck order or blind ids; private view: own blind reserves only');
}

// 4. The screens' view equals Engine.view for the same seat.
{
  const rng = mulberry(5);
  let s = game.setup(3, {}, rng, humans(3));
  for (let i = 0; i < 40; i++) s = step(s, rng);
  for (const seat of [0, 1, 2]) {
    const v = viewFromSnap({ pub: game.publicView(s), mine: game.privateView(s, seat), mySeat: seat });
    assert.deepEqual(clone(v), clone(Engine.view(s, seat)));
  }
  ok('snapshot view equals the local engine view seat for seat');
}

// 5. A local room (createLocal) plays a human + computer game to "finished".
{
  const room = createLocal({ game, seats: ['human', 'computer'], options: { level: 'hard' }, botDelayMs: 0, rng: mulberry(21) });
  let last = null;
  room.on('change', snap => { last = snap; });
  let err = null;
  room.on('error', e => { err = e; });
  room.start();
  let guard = 0, waits = 0;
  while (last.status !== 'finished') {
    if (!last.myTurn) { await new Promise(r => setTimeout(r, 1)); assert.ok(++waits < 20000, 'computer never moved'); continue; }
    const r = room.act(game.bot({ state: room.state }, last.mySeat, Math.random));
    assert.ok(r.ok, r.message);
    assert.ok(++guard < 5000);
  }
  assert.equal(err, null);
  room.close();
  assert.ok(last.pub.over);
  ok('createLocal room plays to finished (' + guard + ' human moves)');
}

// 6. Bad options fall back to safe defaults.
{
  const s = game.setup(2, { level: 'godlike', cities: 'yes' }, mulberry(1), humans(2));
  assert.equal(s.level, 'hard'); assert.equal(s.mode, 'cities');
  const t = game.setup(2, null, mulberry(1), null);
  assert.equal(t.mode, 'base'); assert.equal(t.players[0].name, 'Player 1');
  ok('junk options give a valid game');
}

console.log(pass + ' passed');
