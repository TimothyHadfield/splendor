// Sounds, celebrations and the Sound & effects switches. Run: node tests/fx.test.js
// Plays real Hard-vs-Hard games through the engine and checks that every move maps to the right sounds
// (FX.play is spied on), that Sound off plays nothing, and that game over celebrates win or lose correctly.
const assert = require('node:assert/strict');

// ---- fake Web Audio, so fx.js really "plays" in node (counts plays) ----
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
const node = extra => Object.assign({ connect() {}, disconnect() {} }, extra);
let clock = 0;
class FakeAC {
  get currentTime() { return clock; }
  constructor() { this.sampleRate = 8000; this.state = 'running'; this.destination = {}; }
  createGain() { return node({ gain: param() }); }
  createOscillator() { return node({ type: 'sine', frequency: param(), start() {}, stop() {} }); }
  createBufferSource() { return node({ buffer: null, loop: false, start() {}, stop() {} }); }
  createBiquadFilter() { return node({ type: 'lowpass', frequency: param(), Q: param() }); }
  createStereoPanner() { return node({ pan: param() }); }
  createDynamicsCompressor() { return node({}); }
  createBuffer(ch, n) { return { getChannelData: () => new Float32Array(n) }; }
  resume() { return Promise.resolve(); }
}
globalThis.AudioContext = FakeAC;
require('../js/fx.js');
const FX = globalThis.FX;
const Sfx = require('../js/sfx.js');
const E = require('../js/engine.js');
const Bots = require('../js/bots.js');
const { mulberry } = require('../tools/measure.js');
const sum = a => a.reduce((s, x) => s + x, 0);

let pass = 0;
function t(label, fn) { fn(); pass++; console.log('  PASS  ' + label); }

// one full game; at every state change we hand the before/after views (seat 0 = "you") to sfx.js, like the screen does
function playGame(seed, n, opts) {
  const rng = mulberry(seed);
  let s = E.setup(n, { cities: !!(opts && opts.cities) }, rng, Array.from({ length: n }, (_, i) => 'P' + i));
  const steps = [];
  while (!s.over) {
    const seat = s.turn, prev = E.view(s, 0);
    const a = Bots.decide(E.view(s, seat), seat, 'hard', rng);
    s = E.apply(s, seat, a);
    const v = E.view(s, 0);
    const myPrev = prev.turn === 0 && !prev.over, myNow = v.turn === 0 && !v.over;
    steps.push({ prev, v, list: Sfx.events(prev, v, 0, { meSeats: [0], myPrev, myNow }), myPrev, myNow });
  }
  return { s, steps };
}
// run a step's list through sfx.run with spies, instantly
function spyRun(list) {
  const got = { play: [], celebrate: [] };
  const fake = { play: (name, o) => { got.play.push(name); return true; }, celebrate: o => { got.celebrate.push(o.kind); return Promise.resolve(); }, settings: { animSpeed: 'normal' } };
  Sfx.run(list, fake, {}, fn => fn());
  return got;
}

const games = [];
for (let g = 0; g < 12; g++) games.push(playGame(100 + g, 2 + (g % 3), { cities: g % 4 === 3 }));

t('take 3 / take 2: one chip clink per gem, for you and the computers', () => {
  let n = 0;
  for (const { steps } of games) for (const st of steps) {
    const L = st.v.last;
    if (st.prev.phase !== 'main' || !L || (L.t !== 'take' && L.t !== 'take2')) continue;
    const got = spyRun(st.list);
    assert.equal(got.play.filter(x => x === 'chip').length, L.g.length, 'chips = gems taken');
    n++;
  }
  assert.ok(n > 100, 'enough takes seen: ' + n);
});
t('reserve: card swish (deck = deal sound), a gold coin only when gold was taken', () => {
  let n = 0;
  for (const { steps } of games) for (const st of steps) {
    const L = st.v.last;
    if (st.prev.phase !== 'main' || !L || L.t !== 'reserve') continue;
    const got = spyRun(st.list);
    assert.ok(got.play.includes(L.deck ? 'cardDeal' : 'cardSlide'));
    assert.equal(got.play.includes('coin'), !!L.gold);
    n++;
  }
  assert.ok(n > 5, 'reserves seen: ' + n);
});
t('buy: card slides to the tableau, paid gems clink back to the bank, a new card flips in', () => {
  let n = 0;
  for (const { steps } of games) for (const st of steps) {
    const L = st.v.last;
    if (st.prev.phase !== 'main' || !L || L.t !== 'buy') continue;
    const got = spyRun(st.list);
    assert.ok(got.play.includes('cardSlide'));
    assert.equal(got.play.includes('chips'), sum(L.pay) > 0);
    assert.equal(got.play.includes('cardFlip'), !L.reserved && st.v.deckSizes[CARDLV(L.id) - 1] + 1 === st.prev.deckSizes[CARDLV(L.id) - 1]);
    n++;
  }
  assert.ok(n > 100, 'buys seen: ' + n);
});
function CARDLV(id) { return require('../js/cards.js').CARDS[id].level; }
t('noble visit (or city) = the big moment; final round = alarm, once per game', () => {
  let nobles = 0;
  for (const { steps } of games) {
    let alarms = 0;
    for (const st of steps) {
      const got = spyRun(st.list);
      const gained = st.v.players.some((p, i) => p.nobles.length > st.prev.players[i].nobles.length || p.cities.length > st.prev.players[i].cities.length);
      assert.equal(got.celebrate.includes('big'), gained);
      if (gained) nobles++;
      alarms += got.play.filter(x => x === 'alarm').length;
    }
    const last = steps[steps.length - 1];
    assert.ok(alarms <= 1, 'final round alert at most once');
    if (!steps.some(st => st.v.finalRound && !st.v.over)) assert.equal(alarms, 0);
    else assert.equal(alarms, 1);
    assert.ok(last.v.over);
  }
  assert.ok(nobles > 5, 'noble/city visits seen: ' + nobles);
});
t('your-turn chime only when the turn comes back to you', () => {
  for (const { steps } of games) for (const st of steps) {
    const got = spyRun(st.list);
    assert.equal(got.play.includes('turn'), !st.myPrev && st.myNow);
  }
});
t('game over: celebrate win when you win, lose when you lose (online: your own seat)', () => {
  let wins = 0, losses = 0;
  for (const { s, steps } of games) {
    const last = steps[steps.length - 1];
    const got = spyRun(last.list);
    const iWon = s.result.winners.indexOf(0) >= 0;
    assert.deepEqual(got.celebrate.filter(k => k !== 'big'), [iWon ? 'win' : 'lose']);
    iWon ? wins++ : losses++;
    // the same finish seen from seat 1 (an online friend) celebrates their own result
    const v1 = E.view(s, 1);
    const got1 = spyRun(Sfx.events(Object.assign({}, v1, { over: false, result: null }), v1, 1, { meSeats: [1] }));
    assert.deepEqual(got1.celebrate.filter(k => k !== 'big'), [s.result.winners.indexOf(1) >= 0 ? 'win' : 'lose']);
  }
  assert.ok(wins > 0 && losses > 0, 'both outcomes seen: ' + wins + ' / ' + losses);
});
t('no change between renders (a tap that only selects) = no sound', () => {
  const st = games[0].steps[3];
  assert.deepEqual(Sfx.events(st.v, st.v, 0, { meSeats: [0], myPrev: true, myNow: true }), []);
  assert.deepEqual(Sfx.events(null, st.v, 0, { meSeats: [0] }), []);
});
t('computer moves are never louder than yours', () => {
  for (const { steps } of games) for (const st of steps) for (const e of st.list) if (e.play && st.v.last && st.v.last.seat !== 0) assert.ok((e.vol == null ? 1 : e.vol) <= 1);
});

// ---- the real fx.js: switches gate everything ----
function realRun(setup) {
  FX.init({ game: 'splendor-test', clicks: false }); FX.reset(); setup();
  FX.unlock();
  const before = FX.stats.plays;
  for (const st of games[1].steps) { clock += 1; Sfx.run(st.list, FX, {}, fn => { clock += 0.2; fn(); }); }
  return FX.stats.plays - before;
}
t('Sound on: a whole game plays real sounds', () => { assert.ok(realRun(() => {}) > 50); });
t('Sound off: a whole game plays nothing', () => { assert.equal(realRun(() => FX.set('sound', false)), 0); });
t('Game sounds off: only alerts and celebrations play', () => {
  const n = realRun(() => FX.set('moves', false));
  const exp = games[1].steps.reduce((s, st) => s + st.list.filter(e => e.play === 'turn' || e.play === 'alarm').length + st.list.filter(e => e.fx === 'end').length * 2 - 0, 0);
  assert.ok(n > 0 && n <= exp + 1, 'alerts/celebrations only: ' + n + ' vs ' + exp);
});
t('Celebrations off: game over plays no fanfare', () => {
  FX.init({ game: 'splendor-test', clicks: false }); FX.reset(); FX.set('celebrations', false); FX.unlock();
  const last = games[1].steps[games[1].steps.length - 1];
  const end = last.list.filter(e => e.fx === 'end');
  assert.equal(end.length, 1);
  const before = FX.stats.plays;
  Sfx.run(end, FX, {}, fn => fn());
  assert.equal(FX.stats.plays, before);
});
t('Fast speed shortens the timing of the sounds', () => {
  const list = games[0].steps.find(st => st.v.last && st.v.last.t === 'take' && st.v.last.g.length === 3).list;
  const at = sp => { const ms = []; Sfx.run(list, { play() { return true; }, celebrate() { return Promise.resolve(); }, settings: { animSpeed: sp } }, {}, (fn, m) => { ms.push(m); fn(); }); return Math.max(...ms); };
  assert.ok(at('fast') < at('normal') * 0.6);
});

console.log('\n' + pass + ' fx tests passed');
