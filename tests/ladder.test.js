// The level ladder, the mechanics each level uses, and that no computer replays a deal the same way.
// node tests/ladder.test.js   (about 40 s; BOTS=<path> runs it against another copy of bots.js)
const path = require('path');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const B = require(process.env.BOTS ? path.resolve(process.env.BOTS) : '../js/bots.js');
const { mulberry } = require('../tools/measure.js');

let pass = 0, fail = 0;
function t(label, fn) { try { fn(); pass++; console.log('  PASS  ' + label); } catch (e) { fail++; console.log('  FAIL  ' + label + ' :: ' + e.message.split('\n')[0]); } }

function play(levels, seed, botSeed, style) {
  const rng = mulberry(seed);
  let s = E.setup(levels.length, {}, rng, levels);
  const brng = botSeed == null ? rng : mulberry(botSeed);
  const use = levels.map(() => ({ reserves: 0, take2: 0, buys: 0 }));
  const moves = [];
  while (!s.over) {
    const seat = s.turn;
    const a = B.decide(E.view(s, seat), seat, levels[seat], brng, style && style[seat]);
    if (s.phase === 'main') { if (a.t === 'reserve') use[seat].reserves++; if (a.t === 'take2') use[seat].take2++; if (a.t === 'buy') use[seat].buys++; }
    moves.push(JSON.stringify(a));
    s = E.apply(s, seat, a);
  }
  return { s, use, moves };
}
function duel(a, b, n, seed0, styles) {
  let wa = 0; const use = { [a]: { reserves: 0, take2: 0, games: 0 }, [b]: { reserves: 0, take2: 0, games: 0 } };
  for (let g = 0; g < n; g++) {
    const flip = g % 2 === 1, lv = flip ? [b, a] : [a, b];
    const st = styles ? (flip ? [styles[1], styles[0]] : styles) : null;
    const r = play(lv, seed0 + g * 7919, null, st), iA = flip ? 1 : 0, w = r.s.result.winners;
    wa += w.length > 1 ? (w.includes(iA) ? 0.5 : 0) : (w[0] === iA ? 1 : 0);
    r.use.forEach((u, i) => { const x = use[lv[i]]; x.reserves += u.reserves; x.take2 += u.take2; x.games++; });
  }
  return { pct: 100 * wa / n, use };
}

const N = 300;
const hm = duel('hard', 'medium', N, 2024), he = duel('hard', 'easy', N, 3024), me = duel('medium', 'easy', N, 4024);
console.log('  hard>medium ' + hm.pct.toFixed(1) + '%  hard>easy ' + he.pct.toFixed(1) + '%  medium>easy ' + me.pct.toFixed(1) + '%');
t('ladder: Hard beats Medium at least 65% (2-player, ' + N + ' games)', () => assert.ok(hm.pct >= 65, hm.pct));
t('ladder: Hard beats Easy at least 85%', () => assert.ok(he.pct >= 85, he.pct));
t('ladder: Medium beats Easy at least 70%', () => assert.ok(me.pct >= 70, me.pct));
t('mechanics: every level reserves cards in some games (Medium and Hard too)', () => {
  const per = lv => { const u = [hm, he, me].map(d => d.use[lv]).filter(Boolean); return u.reduce((s, x) => s + x.reserves, 0) / u.reduce((s, x) => s + x.games, 0); };
  for (const lv of ['easy', 'medium', 'hard']) assert.ok(per(lv) >= 0.15, lv + ' reserves ' + per(lv).toFixed(2) + ' a game');
});
t('mechanics: every level takes 2 of a colour sometimes', () => {
  for (const lv of ['easy', 'medium', 'hard']) { const u = [hm, he, me].map(d => d.use[lv]).filter(Boolean); const x = u.reduce((s, y) => s + y.take2, 0) / u.reduce((s, y) => s + y.games, 0); assert.ok(x >= 0.5, lv + ' ' + x); }
});
t('not predictable: the same deal played twice by Medium / Hard (different dice for the computer) goes differently', () => {
  for (const lv of ['medium', 'hard']) {
    let same = 0;
    for (let g = 0; g < 20; g++) if (play([lv, lv], 900 + g, 1 + g).moves.join() === play([lv, lv], 900 + g, 5001 + g).moves.join()) same++;
    assert.ok(same <= 2, lv + ' replayed ' + same + '/20 deals move for move');
  }
});
t('hints stay the same every time (explain uses no random numbers)', () => {
  const s = E.setup(2, {}, mulberry(5), ['A', 'B']);
  const a = JSON.stringify(B.explain(E.view(s, s.turn), s.turn).action);
  for (let i = 0; i < 5; i++) assert.equal(JSON.stringify(B.explain(E.view(s, s.turn), s.turn).action), a);
});
if (B.STYLES) {
  t('styles: each Hard style holds its own against plain Hard (at least 42%) and beats Medium (at least 58%)', () => {
    for (const st of Object.keys(B.STYLES).filter(k => k !== 'balanced')) {
      const vsH = duel('hard', 'hard', 200, 7000, [st, 'balanced']).pct;
      const vsM = duel('hard', 'medium', 200, 8000, [st, null]).pct;
      console.log('    ' + st + ': vs Hard ' + vsH.toFixed(1) + '%, vs Medium ' + vsM.toFixed(1) + '%');
      assert.ok(vsH >= 42 && vsM >= 58, st + ' ' + vsH + ' / ' + vsM);
    }
  });
}
console.log(pass + ' passed' + (fail ? ', ' + fail + ' FAILED' : ''));
if (fail) process.exit(1);
