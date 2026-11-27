// Builds the crowded late-game saves the fit test loads: real games played by the Hard computer (seeded), stopped
// late (leader 11-14 points) at the moment the most reserved cards are held. Long names. Used by tests/fit-ui.mjs.
// node tests/fit-state.js  -> prints JSON { four, two } (each a localStorage 'splendor.v1' value)
'use strict';
const E = require('../js/engine.js');
const B = require('../js/bots.js');

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function crowded(n, names) {
  let best = null, bestScore = -1;
  for (let seed = 1; seed <= 60; seed++) {
    const rng = mulberry(seed * 7919);
    let s = E.setup(n, { cities: false, target: 15, firstSeat: 0 }, rng, names);
    for (let k = 0; k < 400 && !s.over; k++) {
      const seat = s.turn;
      s = E.apply(s, seat, B.decide(E.view(s, seat), seat, 'hard', rng));
      const lead = Math.max.apply(null, s.players.map(p => p.points));
      if (s.phase !== 'main' || s.turn !== 0 || lead < 11 || lead > 14) continue;
      const me = s.players[0];
      const score = me.reserved.length * 10 + s.players.reduce((a, p) => a + p.reserved.length + p.cards.length / 10 + p.nobles.length, 0)
        + Math.min(10, me.gems.reduce((a, b) => a + b, 0));
      if (score > bestScore) { bestScore = score; best = JSON.parse(JSON.stringify(s)); }
    }
  }
  // the human seat always holds three reserved cards in the crowded test (the most a player can hold)
  const me = best.players[0];
  for (let r = 0; r < 3 && me.reserved.length < 3; r++) {
    const lv = r % 3;
    if (best.decks[lv].length) me.reserved.push({ id: best.decks[lv].pop(), blind: false });
  }
  return best;
}
function save(state) {
  const kinds = state.players.map((p, i) => (i === 0 ? 'human' : 'computer'));
  return { settings: { seats: ['computer', state.n > 2 ? 'computer' : 'off', state.n > 3 ? 'computer' : 'off'], level: 'hard', cities: false, showTurns: true, hints: true, name: state.players[0].name, target: 15, styles: 'balanced', module: 'none', botSpeed: 'normal' },
    coachSeen: true,
    game: { state, kinds, level: 'hard', levels: kinds.map(k => (k === 'computer' ? 'hard' : null)), styles: kinds.map(() => null), started: Date.now(), lastHuman: 0,
      study: { rec: [], race: [] }, undo: [], helped: false, hinted: false, recorded: false, myTurns: 20, reserves: 0, daily: null, tutorial: false, challenge: null } };
}
const out = {
  four: save(crowded(4, ['Alexandria', 'Hard 1', 'Hard 2', 'Hard 3'])),
  two: save(crowded(2, ['Alexandria', 'Hard'])),
};
if (require.main === module) process.stdout.write(JSON.stringify(out));
module.exports = out;
