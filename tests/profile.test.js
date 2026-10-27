// What a game counts as in My stats, and how a challenge is graded. node tests/profile.test.js
const E = require('../js/engine.js');
const B = require('../js/bots.js');
const P = require('../js/spprofile.js');
const C = require('../js/challenges.js');
const { mulberry } = require('../tools/measure.js');
let pass = 0, fail = 0;
function t(name, ok) { console.log((ok ? '  PASS  ' : '  FAIL  ') + name); ok ? pass++ : fail++; }
function play(n, levels, seed, opts) {
  const rng = mulberry(seed);
  let s = E.setup(n, Object.assign({ firstSeat: 0 }, opts || {}), mulberry(seed), null);
  let myTurns = 0, reserves = 0;
  while (!s.over) { const seat = s.turn; const a = B.decide(E.view(s, seat), seat, levels[seat], rng); if (seat === 0 && s.phase === 'main') { myTurns++; if (a.t === 'reserve') reserves++; } s = E.apply(s, seat, a); }
  return { s, myTurns, reserves };
}
// a finished game Hard (seat 0) wins and one it loses
let win = null, loss = null;
for (let k = 1; k < 60 && (!win || !loss); k++) { const r = play(2, ['hard', 'easy'], k); const w = r.s.result.winners; if (w.length === 1 && w[0] === 0) win = win || r; else if (w.indexOf(0) < 0) loss = loss || r; }
t('fixtures found (a win and a loss for seat 0)', !!(win && loss));
const rw = P.result({ state: win.s, me: 0, level: 'medium', myTurns: win.myTurns, reserves: win.reserves });
t('a plain win vs Medium is rated, mode computer, level medium', rw.won && rw.mode === 'computer' && rw.level === 'medium' && !rw.draw);
t('summary carries points, turns and reserves', rw.extra.points === win.s.players[0].points && rw.extra.myTurns === win.myTurns && rw.extra.reserved === win.reserves);
const rh = P.result({ state: win.s, me: 0, level: 'hard', helped: true });
t('a game with Hint or Undo is "with help" and has no level (unrated)', rh.mode === 'help' && rh.level === null);
t('a lost game is not a win', P.result({ state: loss.s, me: 0, level: 'easy' }).won === false);
// quitting mid-game
let s = E.setup(2, { firstSeat: 0 }, mulberry(5), null);
s = E.apply(s, 0, E.legal(s, 0)[0]);
const rq = P.result({ state: s, me: 0, level: 'hard', myTurns: 1 });
t('quitting after your first move counts as a loss, marked quit', rq.won === false && rq.draw === false && rq.extra.quit === true);
// achievements see the extras
const ach = id => P.ACH.find(a => a.id === id);
t('Cash only needs a win with no reserve', ach('clean').test({ last: { won: true, extra: { reserved: 0 } }, stats: {} }) && !ach('clean').test({ last: { won: true, extra: { reserved: 1 } }, stats: {} }));
// challenges
const c1 = C.LIST.find(c => c.id === 'c1');
t('24 challenges with unique ids and seeds', C.LIST.length === 24 && new Set(C.LIST.map(c => c.id)).size === 24 && new Set(C.LIST.map(c => c.seed)).size === 24);
const pars = { c1: [win.myTurns, win.myTurns - 1] };
t('challenge: win within the 2-star mark gets 2 stars', C.grade(c1, win.s, 0, { myTurns: win.myTurns }, pars).stars === 2);
t('challenge: a Hint caps it at 1 star', C.grade(c1, win.s, 0, { myTurns: 1, hinted: true }, pars).stars === 1);
t('challenge: a loss is not done', C.grade(c1, loss.s, 0, { myTurns: 5 }, pars).done === false);
const c3 = C.LIST.find(c => c.id === 'c3');
t('challenge: "without reserving" fails if you reserved', C.grade(c3, win.s, 0, { myTurns: 9, reserves: 1 }, null).done === false && C.grade(c3, win.s, 0, { myTurns: 9, reserves: 0 }, null).done === true);
t('goal text names a non-15 target', /first to 21/.test(C.goalText(C.LIST.find(c => c.id === 'c8'))));
console.log(pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
