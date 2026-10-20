/* Splendor Lab — which sounds and effects a change of the table makes. Pure: compares the view before and
   after (local moves, computer moves and online snapshots all arrive this way), so every player hears the
   same events. app.js draws the visuals; fx.js (the shared library) plays the sounds and obeys Settings.
     events(prev, v, seat, { meSeats, myPrev, myNow }) -> [{ at: ms, play: name, vol, pitch } | { at, fx, ... }]
     run(list, FX, hooks, schedule)  -> plays/celebrates each item at its time (Fast speed shortens times) */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.SpSfx = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const sum = a => a.reduce((s, x) => s + x, 0);
  const OTHER_VOL = 0.8; // other players' moves: a little quieter than yours, never louder

  const refilled = (prev, v, L) => !!(L.from && v.deckSizes && prev.deckSizes && v.deckSizes[L.from[0]] < prev.deckSizes[L.from[0]]);

  function events(prev, v, seat, o) {
    o = o || {};
    if (!prev || !v || !prev.players || !v.players || prev.players.length !== v.players.length) return [];
    const changed = prev.turns !== v.turns || prev.phase !== v.phase || prev.over !== v.over ||
      JSON.stringify(prev.bank) !== JSON.stringify(v.bank);
    if (!changed) return [];
    const out = [], L = v.last || {};
    const vol = L.seat === seat ? 1 : OTHER_VOL;
    const add = (at, play, extra) => out.push(Object.assign({ at, play, vol }, extra || {}));

    // the main action (take / reserve / buy) happened if we were in the main phase before
    if (prev.phase === 'main' && L.t) {
      if ((L.t === 'take' || L.t === 'take2') && L.g) {
        L.g.forEach((k, i) => add(i * 70, 'chip', { pitch: 0.94 + 0.06 * i })); // one clink per gem, with each gem's glide
      } else if (L.t === 'reserve') {
        add(0, L.deck ? 'cardDeal' : 'cardSlide');
        if (L.gold) add(260, 'coin');
        if (refilled(prev, v, L)) add(320, 'cardFlip'); // a new card is dealt into the gap
      } else if (L.t === 'buy') {
        add(0, 'cardSlide');
        if (L.pay && sum(L.pay) > 0) add(140, 'chips'); // payment back to the bank
        if (refilled(prev, v, L)) add(320, 'cardFlip');
      }
    }
    // gems returned over the 10 limit
    if (L.returned && (prev.phase === 'discard' || prev.phase === 'main')) add(prev.phase === 'discard' ? 0 : 380, 'chips');

    // points, nobles and cities per player
    v.players.forEach((p, i) => {
      const q = prev.players[i];
      if (p.points > q.points) out.push({ at: 420, fx: 'score', who: i, from: q.points, to: p.points });
      if (p.nobles.length > q.nobles.length || (p.cities || []).length > (q.cities || []).length) {
        out.push({ at: 520, fx: 'big', who: i, what: p.nobles.length > q.nobles.length ? 'noble' : 'city' });
      }
    });

    // 15 points reached (or a city taken): the last round starts
    if (v.finalRound && !prev.finalRound && !v.over) out.push({ at: 760, play: 'alarm', fx: 'final', vol: 0.8 });

    // game over: each player sees their own result
    if (v.over && !prev.over && v.result) {
      const me = o.meSeats || [seat];
      const won = v.result.winners.some(w => me.indexOf(w) >= 0);
      out.push({ at: 800, fx: 'end', kind: won ? 'win' : 'lose', winners: v.result.winners.slice() });
    } else if (!o.myPrev && o.myNow && !v.over) out.push({ at: 600, play: 'turn', fx: 'turn' });
    return out;
  }

  function run(list, FX, hooks, schedule) {
    hooks = hooks || {};
    schedule = schedule || ((fn, ms) => setTimeout(fn, ms));
    const sp = FX && FX.settings && FX.settings.animSpeed === 'fast' ? 0.5 : 1;
    list.forEach(e => schedule(() => {
      try {
        if (e.play) FX.play(e.play, { vol: e.vol, pitch: e.pitch });
        if (e.fx === 'big') FX.celebrate({ kind: 'big', at: hooks.el ? hooks.el(e.who) : null, colors: hooks.colors ? hooks.colors(e.who) : undefined });
        if (e.fx === 'end') FX.celebrate({ kind: e.kind, colors: hooks.colors ? hooks.colors(e.winners) : undefined });
        if (hooks.visual) hooks.visual(e);
      } catch (err) { /* effects never break the game */ }
    }, Math.round(e.at * sp)));
  }

  return { events, run };
});
