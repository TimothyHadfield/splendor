// Measure computer strength: many seeded 2-player games, seats alternate who goes first.
// node tools/measure.js [games] [pairs...]   e.g. node tools/measure.js 2000 hard:easy hard:medium medium:easy
const Engine = require('../js/engine.js');
const Bots = require('../js/bots.js');

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function play(levels, seed) {
  const rng = mulberry(seed);
  let s = Engine.setup(levels.length, {}, rng, levels);
  let guard = 0;
  while (!s.over) {
    const seat = s.turn;
    const a = Bots.decide(Engine.view(s, seat), seat, levels[seat], rng);
    s = Engine.apply(s, seat, a);
    if (++guard > 3000) throw new Error('runaway game seed ' + seed);
  }
  return s;
}

function duel(a, b, games, seed0) {
  let wa = 0, wb = 0, ties = 0, rounds = 0;
  for (let g = 0; g < games; g++) {
    const flip = g % 2 === 1;
    const lv = flip ? [b, a] : [a, b];
    const s = play(lv, (seed0 || 1) + g * 7919);
    const iA = flip ? 1 : 0;
    const w = s.result.winners;
    if (w.length > 1) ties++; else if (w[0] === iA) wa++; else wb++;
    rounds += s.turns / 2;
  }
  return { a, b, games, aWins: wa / games, bWins: wb / games, ties: ties / games, avgRounds: rounds / games };
}

module.exports = { play, duel, mulberry };

if (require.main === module) {
  const games = Number(process.argv[2]) || 1000;
  const pairs = process.argv.slice(3).length ? process.argv.slice(3) : ['hard:easy', 'hard:medium', 'medium:easy'];
  for (const pr of pairs) {
    const [a, b] = pr.split(':');
    const t = Date.now();
    const r = duel(a, b, games, 12345);
    console.log(`${a} vs ${b}: ${a} wins ${(r.aWins * 100).toFixed(1)}%, ${b} ${(r.bWins * 100).toFixed(1)}%, ties ${(r.ties * 100).toFixed(1)}%, avg ${r.avgRounds.toFixed(1)} rounds (${games} games, ${((Date.now() - t) / 1000).toFixed(1)}s)`);
  }
}
