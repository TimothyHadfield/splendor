// The level ladder + how each level uses the game's mechanics (plain node, no browser).
// node tools/ladder.js [gamesPerPair] [seed0]
//   - head-to-head win % for every pair (seats alternate who goes first; a shared win = half)
//   - per level, per game: take-3, take-2, reserves (table / blind), gold spent, nobles, cards bought, points
//   - repeat check: the same deal played twice by the same level gives the same game how often (predictability)
const E = require('../js/engine.js');
const B = require('../js/bots.js');
const { mulberry } = require('./measure.js');

const N = Number(process.argv[2]) || 400;
const SEED0 = Number(process.argv[3]) || 424242;

function play(levels, seed, botSeed) {
  const rng = mulberry(seed);
  let s = E.setup(levels.length, {}, rng, levels);
  const brng = botSeed == null ? rng : mulberry(botSeed);
  const use = levels.map(() => ({ take3: 0, take2: 0, resTable: 0, resBlind: 0, goldSpent: 0, buys: 0 }));
  const moves = [];
  while (!s.over) {
    const seat = s.turn;
    const a = B.decide(E.view(s, seat), seat, levels[seat], brng);
    const u = use[seat];
    if (s.phase === 'main') {
      if (a.t === 'take') u.take3++;
      else if (a.t === 'take2') u.take2++;
      else if (a.t === 'reserve') { if (a.deck) u.resBlind++; else u.resTable++; }
      else if (a.t === 'buy') { u.buys++; const pay = E.autoPay(s.players[seat], a.id); if (pay) u.goldSpent += pay[5]; }
    }
    moves.push(JSON.stringify(a));
    s = E.apply(s, seat, a);
  }
  s.players.forEach((p, i) => { use[i].nobles = p.nobles.length; use[i].points = p.points; });
  return { s, use, moves };
}

const pairs = [['hard', 'medium'], ['hard', 'easy'], ['medium', 'easy']];
const usage = {};
const add = (lv, u) => { const t = usage[lv] || (usage[lv] = { games: 0 }); t.games++; for (const k in u) t[k] = (t[k] || 0) + u[k]; };
const t0 = Date.now();
const out = {};
for (const [a, b] of pairs) {
  let wa = 0;
  for (let g = 0; g < N; g++) {
    const flip = g % 2 === 1;
    const lv = flip ? [b, a] : [a, b];
    const r = play(lv, SEED0 + g * 7919);
    const iA = flip ? 1 : 0, w = r.s.result.winners;
    wa += w.length > 1 ? (w.includes(iA) ? 0.5 : 0) : (w[0] === iA ? 1 : 0);
    r.use.forEach((u, i) => add(lv[i], u));
  }
  out[a + ':' + b] = Math.round(1000 * wa / N) / 10;
  console.log(a, 'beats', b, out[a + ':' + b] + '%', '(' + N + ' games, ' + ((Date.now() - t0) / 1000).toFixed(0) + 's)');
}
console.log('\nper game (mechanics used):');
for (const lv of ['easy', 'medium', 'hard']) {
  const u = usage[lv]; if (!u) continue;
  const f = k => (u[k] / u.games).toFixed(2);
  console.log(lv.padEnd(7), 'take3', f('take3'), 'take2', f('take2'), 'reserve table', f('resTable'), 'blind', f('resBlind'), 'gold spent', f('goldSpent'), 'nobles', f('nobles'), 'cards', f('buys'), 'points', f('points'));
}
// predictability: same deal, same level both seats, two different bot random streams -> identical games?
let same = 0; const R = 60;
for (const lv of ['medium', 'hard']) {
  same = 0;
  for (let g = 0; g < R; g++) {
    const x = play([lv, lv], 777 + g, 1000 + g), y = play([lv, lv], 777 + g, 5000 + g);
    if (x.moves.join() === y.moves.join()) same++;
  }
  console.log(lv, 'replays the same deal move for move in', same + '/' + R, 'games');
}
console.log(JSON.stringify(out));
