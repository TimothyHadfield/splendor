/* The Splendor engine as the shared online module's `game` object (see _online/README.md).
   publicView = everything on the table (no deck order, others' blind reserves shown by level only).
   privateView = the ids of this seat's own blind reserves (the only secret a player holds). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'), require('./bots.js'));
  else root.SpOnlineGame = factory(root.SpEngine, root.SpBots);
})(typeof self !== 'undefined' ? self : this, function (Engine, Bots) {
  'use strict';
  const LEVELS = ['easy', 'medium', 'hard'];
  const game = {
    id: 'splendor',
    minSeats: 2,
    maxSeats: 4,
    // options: { level: 'easy'|'medium'|'hard' }
    setup(nSeats, options, rng, seats) {
      const names = (seats || []).map((s, i) => (s && s.name) || (s && s.kind === 'computer' ? 'Computer ' + (i + 1) : 'Player ' + (i + 1)));
      const s = Engine.setup(nSeats, { cities: !!(options && options.cities) }, rng, names);
      s.level = LEVELS.indexOf(options && options.level) >= 0 ? options.level : 'hard';
      return s;
    },
    toAct(state) { return state.over ? [] : [state.turn]; },
    apply(state, seat, action) { return Engine.apply(state, seat, action); },
    publicView(state) {
      const v = Engine.view(state, -1);
      delete v.seat;
      return v;
    },
    privateView(state, seat) {
      const p = state.players[seat];
      if (!p) return {};
      return { seat, blind: p.reserved.filter(r => r.blind).map(r => r.id) };
    },
    bot(ctx, seat, rng) {
      const v = viewFromParts(ctx.pub || game.publicView(ctx.state), ctx.mine || game.privateView(ctx.state, seat), seat);
      return Bots.decide(v, seat, (ctx.state && ctx.state.level) || 'hard', rng);
    },
    isOver(state) { return !!state.over; },
  };
  // rebuild Engine.view(state, seat) from the two halves of a snapshot
  function viewFromParts(pub, mine, seat) {
    const v = JSON.parse(JSON.stringify(pub));
    v.seat = seat;
    if (seat >= 0 && v.players[seat] && mine && Array.isArray(mine.blind)) {
      let i = 0;
      v.players[seat].reserved.forEach(r => { if (r.blind && r.id === null && i < mine.blind.length) r.id = mine.blind[i++]; });
    }
    return v;
  }
  function viewFromSnap(snap) { return snap.pub ? viewFromParts(snap.pub, snap.mine, snap.mySeat) : null; }
  return { game, viewFromParts, viewFromSnap };
});
