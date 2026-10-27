/* spprofile.js: Splendor's part of the player profile (shared kit js/profile.js, never edit that one here):
   the computer levels' ratings, the achievements, the Daily game and turning a game into a result.

   What counts: a whole game where every other seat is a computer on this device. Leaving after your first
   move counts as a loss. A game where you used Hint or Undo counts as "with help" and isn't rated.
   The guided game, challenges, friends on this device and online games aren't counted.
   Plain script: window.SpProfile in the browser, module.exports in node. */
(function (root) {
  'use strict';
  // Elo of each level from head-to-head games (tools/build-strength.js, 1,000 two-player games a pair):
  // difference = 400·log10(p / (1 − p)), rounded to 10, Easy anchored at 1200. Ladder of 2026-10-27:
  // Medium beats Easy 78.8% (+230), Hard beats Medium 67.6% (+130) and Easy 92.6% (+440): Hard = mean of 1560 and 1640.
  const LEVELS = [{ id: 'easy', name: 'Easy', rating: 1200 }, { id: 'medium', name: 'Medium', rating: 1430 }, { id: 'hard', name: 'Hard', rating: 1600 }];
  const RANK = { easy: 0, medium: 1, hard: 2 };

  const won = c => !!(c.last && c.last.won);
  const ex = c => (c.last && c.last.extra) || {};
  const ACH = [
    { id: 'first', title: 'First win', desc: 'Win a game of Splendor', test: c => c.stats.wins >= 1 },
    { id: 'medium', title: 'Merchant', desc: 'Win against Medium', test: c => won(c) && RANK[c.last.level] >= 1 },
    { id: 'hard', title: 'Master jeweller', desc: 'Win against Hard', test: c => won(c) && c.last.level === 'hard' },
    { id: 'table', title: 'Full table', desc: 'Win against 3 computers', test: c => won(c) && ex(c).opps >= 3 },
    { id: 'nobles', title: 'Royal favour', desc: 'Have 3 nobles visit you in one game', test: c => ex(c).nobles >= 3 },
    { id: 'five', title: 'Crown jewel', desc: 'Buy a 5-point card', test: c => ex(c).five >= 1 },
    { id: 'quick', title: 'Quick fortune', desc: 'Win in 22 of your turns or fewer', test: c => won(c) && ex(c).myTurns > 0 && ex(c).myTurns <= 22 },
    { id: 'clean', title: 'Cash only', desc: 'Win without reserving a card', test: c => won(c) && ex(c).reserved === 0 },
    { id: 'city', title: 'City builder', desc: 'Win a Cities game', test: c => won(c) && ex(c).cities },
    { id: 'streak', title: 'Hat trick', desc: 'Win 3 in a row', test: c => c.stats.bestStreak >= 3 },
    { id: 'daily', title: 'Daily trader', desc: '3-day Daily streak', test: c => c.daily.streak >= 3 },
  ];

  // Today's Daily game: the same deal for everyone that day, you first, against 1 Hard computer, standard rules.
  const DAILY = { level: 'hard', opps: 1 };

  function init(onDaily) {
    if (!root.Profile) return false;
    root.Profile.init({
      game: 'splendor', levels: LEVELS, achievements: ACH, draws: true,
      modes: { computer: { name: 'vs computer' }, help: { name: 'With help' }, online: { hide: true } },
      daily: { title: 'Daily deal', onPlay: () => onDaily && onDaily() },
    });
    return true;
  }

  /** What a game adds up to for seat `me` (s = the engine state; `turns` = my turns taken; `reserved` = my reserves). */
  function summary(s, me, g) {
    const p = s.players[me];
    let opp = -Infinity;
    s.players.forEach((q, i) => { if (i !== me) opp = Math.max(opp, q.points); });
    const CARDS = (root.SpCards || (typeof require === 'function' ? require('./cards.js') : null)).CARDS;
    return {
      points: p.points, margin: p.points - opp, opps: s.n - 1, nobles: p.nobles.length,
      five: p.cards.filter(id => CARDS[id].points === 5).length, cards: p.cards.length,
      myTurns: (g && g.myTurns) || 0, reserved: (g && g.reserves) || 0, cities: s.mode === 'cities',
      target: s.target || 15,
    };
  }

  /** A finished (or abandoned) game -> Profile.recordResult input. g: { state, me, level, helped, daily, myTurns, reserves } */
  function result(g) {
    const s = g.state, me = g.me || 0;
    let w = false, draw = false;
    if (s.over && s.result) {
      const win = s.result.winners;
      if (win.indexOf(me) >= 0) { if (win.length > 1) draw = true; else w = true; }
    }
    const mode = g.helped ? 'help' : 'computer';
    const extra = summary(s, me, g);
    if (!s.over) extra.quit = true;
    return { mode, level: mode === 'computer' ? g.level : null, won: w, draw, score: extra.points, daily: !!g.daily, extra };
  }

  const api = { LEVELS, ACH, DAILY, RANK, init, summary, result };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SpProfile = api;
})(typeof window !== 'undefined' ? window : globalThis);
