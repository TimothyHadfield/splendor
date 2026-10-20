// Measure the computers and card win rates; writes js/strength-data.js (about 10 minutes).
// node tools/build-strength.js [gamesPerPair]
const fs = require('fs');
const path = require('path');
const E = require('../js/engine.js');
const B = require('../js/bots.js');
const { mulberry } = require('./measure.js');

const N = Number(process.argv[2]) || 1000;
function play(levels, seed, opts) {
  const rng = mulberry(seed);
  let s = E.setup(levels.length, opts || {}, rng, levels);
  while (!s.over) { const seat = s.turn; s = E.apply(s, seat, B.decide(E.view(s, seat), seat, levels[seat], rng)); }
  return s;
}
function duel(a, b, games, opts, seed0) {
  let wa = 0, rounds = 0;
  for (let g = 0; g < games; g++) {
    const flip = g % 2 === 1;
    const s = play(flip ? [b, a] : [a, b], seed0 + g * 7919, opts);
    const iA = flip ? 1 : 0;
    const w = s.result.winners;
    wa += w.length > 1 ? (w.includes(iA) ? 0.5 : 0) : (w[0] === iA ? 1 : 0);
    rounds += s.turns / 2;
  }
  return { pct: Math.round(1000 * wa / games) / 10, rounds: rounds / games };
}
const t0 = Date.now();
const duels = {}, cities = {};
for (const pr of ['hard:easy', 'hard:medium', 'medium:easy']) {
  const [a, b] = pr.split(':');
  duels[pr] = duel(a, b, N, {}, 1).pct;
  cities[pr] = duel(a, b, Math.round(N / 2), { cities: true }, 5).pct;
  console.log(pr, duels[pr] + '%', 'cities', cities[pr] + '%', ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
// Hard vs Hard: first-player edge, game length, and how often the buyer of each card won
const byCard = {};
let firstWins = 0, rounds = 0;
const H = N * 2;
for (let g = 0; g < H; g++) {
  const s = play(['hard', 'hard'], 100000 + g * 31);
  const w = s.result.winners;
  if (w.length === 1 && w[0] === s.start) firstWins++;
  else if (w.length > 1) firstWins += 0.5;
  rounds += s.turns / 2;
  s.players.forEach((p, i) => p.cards.forEach(id => {
    const r = byCard[id] || (byCard[id] = [0, 0]);
    r[0]++; if (w.length === 1 && w[0] === i) r[1]++;
  }));
}
const out = { games: N, cardGames: H, duels, cities, firstPlayer: Math.round(1000 * firstWins / H) / 10, avgRounds: Math.round(10 * rounds / H) / 10, byCard, measured: new Date().toISOString().slice(0, 10) };
fs.writeFileSync(path.join(__dirname, '../js/strength-data.js'),
  '/* Measured by tools/build-strength.js — do not edit by hand. */\nself.SpStrength = ' + JSON.stringify(out) + ';\n');
console.log('first player', out.firstPlayer + '%', 'rounds', out.avgRounds, 'total', ((Date.now() - t0) / 1000).toFixed(0) + 's');
