/* challenges.js: preset deals with a goal and up to 3 stars (like the official app's challenge mode, our own set).
   Every deal is fixed (same cards, same nobles, you go first); the computers still think for themselves.
   Stars: 1 = goal met; 2 and 3 = met within the number of your turns shown. The turn marks come from our Hard
   computer playing your seat 80 times on each deal (tools/challenges.js writes js/challenge-pars.js):
   2 stars = within Hard's slower fifth (its 80th percentile), 3 stars = as fast as Hard's median game. No Undo in a challenge, and a Hint caps it at 1 star.
   Plain script: window.SpChallenges in the browser, module.exports in node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpChallenges = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // goal: win | nobles n | noreserve | margin n | l3 n (level-3 cards) | few n (win with at most n cards)
  const LIST = [
    { id: 'c1', title: 'First fortune', opps: ['easy'], seed: 101, goal: { t: 'win' } },
    { id: 'c2', title: 'A noble guest', opps: ['easy'], seed: 102, goal: { t: 'nobles', n: 1 } },
    { id: 'c3', title: 'Cash only', opps: ['easy'], seed: 103, goal: { t: 'noreserve' } },
    { id: 'c4', title: 'Clear lead', opps: ['easy'], seed: 104, goal: { t: 'margin', n: 6 } },
    { id: 'c5', title: 'Two at the table', opps: ['easy', 'easy'], seed: 105, goal: { t: 'win' } },
    { id: 'c6', title: 'High rollers', opps: ['easy'], seed: 106, goal: { t: 'l3', n: 2 } },
    { id: 'c7', title: 'Short race', opps: ['easy'], seed: 107, target: 10, goal: { t: 'win' } },
    { id: 'c8', title: 'Long road', opps: ['easy'], seed: 108, target: 21, goal: { t: 'win' } },
    { id: 'c9', title: 'Merchant', opps: ['medium'], seed: 201, goal: { t: 'win' } },
    { id: 'c10', title: 'Court favour', opps: ['medium'], seed: 202, goal: { t: 'nobles', n: 2 } },
    { id: 'c11', title: 'No holding back', opps: ['medium'], seed: 203, goal: { t: 'noreserve' } },
    { id: 'c12', title: 'Lean and rich', opps: ['medium'], seed: 204, goal: { t: 'few', n: 14 } },
    { id: 'c13', title: 'Crowded market', opps: ['medium', 'medium'], seed: 205, goal: { t: 'win' } },
    { id: 'c14', title: 'City charter', opps: ['medium'], seed: 206, cities: true, goal: { t: 'win' } },
    { id: 'c15', title: 'Big buyer', opps: ['medium'], seed: 207, goal: { t: 'l3', n: 2 } },
    { id: 'c16', title: 'Full house', opps: ['medium', 'medium', 'medium'], seed: 208, goal: { t: 'win' } },
    { id: 'c17', title: 'Master', opps: ['hard'], seed: 301, goal: { t: 'win' } },
    { id: 'c18', title: 'Royal court', opps: ['hard'], seed: 302, goal: { t: 'nobles', n: 2 } },
    { id: 'c19', title: 'Pay as you go', opps: ['hard'], seed: 303, goal: { t: 'noreserve' } },
    { id: 'c20', title: 'Outclass', opps: ['hard'], seed: 304, goal: { t: 'margin', n: 3 } },
    { id: 'c21', title: 'Two masters', opps: ['hard', 'hard'], seed: 305, goal: { t: 'win' } },
    { id: 'c22', title: 'City of masters', opps: ['hard'], seed: 306, cities: true, goal: { t: 'win' } },
    { id: 'c23', title: 'The long game', opps: ['hard'], seed: 307, target: 21, goal: { t: 'win' } },
    { id: 'c24', title: 'Grand table', opps: ['hard', 'hard', 'medium'], seed: 308, goal: { t: 'win' } },
  ];
  const LV = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

  function goalText(c) {
    const g = c.goal, n = g.n;
    const base = g.t === 'nobles' ? 'Win with ' + (n === 1 ? 'a noble' : n + ' nobles') :
      g.t === 'noreserve' ? 'Win without reserving a card' :
      g.t === 'margin' ? 'Win by ' + n + ' points or more' :
      g.t === 'l3' ? 'Win with ' + n + ' level-3 cards' :
      g.t === 'few' ? 'Win with ' + n + ' cards or fewer' : 'Win';
    return base + (c.target && c.target !== 15 ? ' (first to ' + c.target + ')' : c.cities ? ' (Cities variant)' : '');
  }
  function oppText(c) {
    const cnt = {};
    c.opps.forEach(o => { cnt[o] = (cnt[o] || 0) + 1; });
    return 'vs ' + ['hard', 'medium', 'easy'].filter(o => cnt[o]).map(o => (cnt[o] > 1 ? cnt[o] + ' ' : '') + LV[o]).join(' + ');
  }

  /** How a finished game went for seat `me`. info: { myTurns, reserves, hinted } -> { done, stars } */
  function grade(c, s, me, info, pars) {
    if (!s || !s.over || !s.result) return { done: false, stars: 0 };
    const p = s.players[me], w = s.result.winners;
    const CARDS = (typeof self !== 'undefined' && self.SpCards ? self.SpCards : require('./cards.js')).CARDS;
    let ok = w.length === 1 && w[0] === me;
    const g = c.goal;
    if (ok && g.t === 'nobles') ok = p.nobles.length >= g.n;
    if (ok && g.t === 'noreserve') ok = !(info && info.reserves);
    if (ok && g.t === 'margin') ok = s.players.every((q, i) => i === me || p.points - q.points >= g.n);
    if (ok && g.t === 'l3') ok = p.cards.filter(id => CARDS[id].level === 3).length >= g.n;
    if (ok && g.t === 'few') ok = p.cards.length <= g.n;
    if (!ok) return { done: false, stars: 0 };
    const par = pars && pars[c.id];
    const t = info && info.myTurns;
    let stars = 1;
    if (!(info && info.hinted) && par && t) { if (t <= par[0]) stars = 2; if (t <= par[1]) stars = 3; }
    return { done: true, stars };
  }

  const api = { LIST, goalText, oppText, grade };
  return api;
});
