/* Computer players and the hint engine. They decide from a seat's VIEW (what that seat may see),
   never from the hidden deck order or others' blind reserves.
   decide(view, seat, level, rng) -> action        levels: 'easy' | 'medium' | 'hard'
   explain(view, seat) -> { action, why, scores } (the Hard player's choice, for hints/study) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cards.js'), require('./engine.js'));
  else root.SpBots = factory(root.SpCards, root.SpEngine);
})(typeof self !== 'undefined' ? self : this, function (Cards, Engine) {
  'use strict';
  const { CARDS, NOBLES, CITIES, WIN_POINTS, MAX_TOKENS } = Cards;
  const sum = a => a.reduce((s, x) => s + x, 0);

  // ------------------------------------------------------------ weights per level
  const LEVELS = {
    // Medium: chases points per turn, ignores what bonuses and nobles are worth
    // (it also reserves a level-3 target when the gold gets it there a turn sooner, so it uses every kind of move)
    medium: { bonus: 0.35, noble: 0, block: 0, reserve: 1, resLvl: 3, resVal: 4, early: 0, horizon: 1.0, jit: 0.1 },
    // Hard: values bonuses by what they unlock, chases nobles, reserves and blocks
    hard: { bonus: 0.9, noble: 0.55, block: 1, reserve: 0, early: 1, horizon: 1.0, jit: 0.03 }, // reserving for gold measured worse (42% vs this), so Hard reserves only to block
  };
  // jit: near-equal choices are broken at random (scores nudged by up to ±jit/2), so the same deal is never
  // played the same way twice and a repeat player can't learn a fixed line. Hints and Study use no random
  // numbers, so they always give the same advice.
  // Styles for Hard computers (a "personality" on top of the level). Each one measured about as strong as plain Hard
  // (600 two-player games each vs plain Hard, 2026-10-27): Nobles 56%, Big cards 53%, Reserver 54%.
  const STYLES = {
    balanced: { name: 'Balanced', note: 'Plain Hard', w: {} },
    nobles: { name: 'Nobles', note: 'Builds bonuses toward the nobles', w: { noble: 1.3, bonus: 1.05 } },
    big: { name: 'Big cards', note: 'Saves up for the big level-3 cards', w: { den: 0.9, pow: 1.15 } },
    reserver: { name: 'Reserver', note: 'Reserves its targets for the gold', w: { reserve: 1, resLvl: 3, resVal: 3, resTok: 9 } },
  };
  const nudge = W => (W.rng && W.jit ? 1 + W.jit * (W.rng() - 0.5) : 1);

  function visibleCards(v) {
    const out = [];
    v.market.forEach(row => row.forEach(id => { if (id !== null) out.push(id); }));
    return out;
  }

  // How useful one more bonus of colour k is to player p right now (cards it makes cheaper + noble progress).
  function bonusWorth(v, p, W) {
    const cards = visibleCards(v).concat(p.reserved.filter(r => r.id !== null).map(r => r.id));
    const w = [0, 0, 0, 0, 0];
    for (const id of cards) {
      const c = CARDS[id];
      const lvlW = c.level === 1 ? 0.5 : c.level === 2 ? 0.8 : 1;
      for (let k = 0; k < 5; k++) if (c.cost[k] > p.bonus[k]) w[k] += lvlW * (0.4 + c.points * 0.25);
    }
    const n = cards.length || 1;
    for (let k = 0; k < 5; k++) w[k] = (w[k] / n) * 3.2;
    if (W.noble) {
      for (const nid of v.nobles) {
        const r = NOBLES[nid].req;
        const missing = r.reduce((s, x, k) => s + Math.max(0, x - p.bonus[k]), 0);
        if (missing === 0) continue;
        for (let k = 0; k < 5; k++) if (r[k] > p.bonus[k]) w[k] += W.noble * 3 / missing;
      }
    }
    if (W.noble && v.mode === 'cities') {
      for (const cid of v.cities) {
        const c = CITIES[cid];
        for (let k = 0; k < 5; k++) if (c.req[k] > p.bonus[k]) w[k] += W.noble * 2 / Math.max(1, c.req[k] - p.bonus[k]);
        if (c.same || c.other) {
          let top = -1, tb = -1;
          for (let k = 0; k < 5; k++) if ((c.other ? c.req[k] === 0 : true) && p.bonus[k] > tb) { tb = p.bonus[k]; top = k; }
          if (top >= 0 && tb < (c.same || c.other)) w[top] += W.noble * 1.5;
        }
      }
    }
    return w;
  }

  // does buying card id give player p a city (Cities variant)?
  function cityAfter(v, p, id) {
    if (v.mode !== 'cities' || p.cities && p.cities.length) return false;
    const c = CARDS[id];
    const b = p.bonus.slice(); b[c.bonus]++;
    return v.cities.some(cid => Engine.cityOk(p, cid, p.points + c.points, b));
  }

  function cardValue(v, p, id, W, bw) {
    const c = CARDS[id];
    let val = c.points + W.bonus * bw[c.bonus];
    // a noble this purchase completes
    if (W.noble) {
      for (const nid of v.nobles) {
        const r = NOBLES[nid].req;
        const before = r.every((x, k) => p.bonus[k] >= x);
        if (before) continue;
        const after = r.every((x, k) => p.bonus[k] + (k === c.bonus ? 1 : 0) >= x);
        if (after) { val += 3; break; }
      }
    }
    // late game: points are what count
    if (W.noble && cityAfter(v, p, id)) val += 6;
    const lead = Math.max.apply(null, v.players.map(q => q.points));
    if (lead >= Engine.targetOf(v) - 5) val = c.points * 1.4 + (val - c.points) * 0.4;
    return val;
  }

  // ------------------------------------------------------------ the shared planner
  function plan(v, seat, W) {
    const p = v.players[seat];
    const bw = bonusWorth(v, p, W);
    const cands = [];
    v.market.forEach(row => row.forEach(id => { if (id !== null) cands.push({ id, reserved: false }); }));
    p.reserved.forEach(r => { if (r.id !== null) cands.push({ id: r.id, reserved: true }); });
    for (const c of cands) {
      c.turns = Engine.turnsToAfford(p, c.id, v.bank);
      c.value = cardValue(v, p, c.id, W, bw);
      c.score = c.turns === Infinity ? -1 : nudge(W) * c.value / Math.pow(c.turns + (W.den || 1.15), W.pow || 1);
    }
    cands.sort((a, b) => b.score - a.score);
    return { p, bw, cands };
  }

  // gems that bring the top targets closest (weighted), avoiding going over 10
  function bestTake(v, seat, legalTakes, targets, bw, W) {
    const p = v.players[seat];
    let best = null, bestS = -Infinity;
    for (const a of legalTakes) {
      const g = a.t === 'take2' ? [a.c, a.c] : a.g;
      const q = { gems: p.gems.slice(), bonus: p.bonus };
      g.forEach(k => q.gems[k]++);
      const bank = v.bank.slice(); g.forEach(k => bank[k]--);
      let s = 0;
      targets.forEach((t, i) => {
        const before = t.turns, after = Engine.turnsToAfford(q, t.id, bank);
        const wt = i === 0 ? 1 : i === 1 ? 0.45 : 0.2;
        if (after < before) s += wt * (before - after) * (1 + t.value * 0.15);
      });
      // general usefulness of the gems taken
      g.forEach(k => { s += 0.02 * bw[k]; });
      const over = Engine.tokens(q) - MAX_TOKENS;
      if (over > 0) s -= over * 0.35;
      s += g.length * 0.01;
      s *= nudge(W || {});
      if (s > bestS) { bestS = s; best = a; }
    }
    return best;
  }

  function chooseDiscard(v, seat, targets) {
    const p = v.players[seat];
    const g = p.gems.slice();
    const ret = [0, 0, 0, 0, 0, 0];
    let extra = sum(g) - MAX_TOKENS;
    const need = [0, 0, 0, 0, 0];
    targets.slice(0, 2).forEach((t, i) => {
      const c = CARDS[t.id].cost;
      for (let k = 0; k < 5; k++) need[k] += (i === 0 ? 2 : 1) * Math.max(0, c[k] - p.bonus[k]);
    });
    while (extra > 0) {
      // give back the colour with the most surplus over what targets need; never gold unless forced
      let pick = -1, ps = -Infinity;
      for (let k = 0; k < 5; k++) if (g[k] > 0) { const sc = g[k] - need[k] / 2; if (sc > ps) { ps = sc; pick = k; } }
      if (pick < 0) pick = 5;
      g[pick]--; ret[pick]++; extra--;
    }
    return { t: 'discard', g: ret };
  }

  function randDiscard(v, seat, rng) {
    const p = v.players[seat];
    const g = p.gems.slice(), ret = [0, 0, 0, 0, 0, 0];
    let extra = sum(g) - MAX_TOKENS;
    while (extra > 0) { const ks = [0, 1, 2, 3, 4, 5].filter(k => g[k] > 0 && (k < 5 || g.slice(0, 5).every(x => x === 0))); const k = ks[Math.floor(rng() * ks.length)]; g[k]--; ret[k]++; extra--; }
    return { t: 'discard', g: ret };
  }

  // ------------------------------------------------------------ levels
  function easy(v, seat, rng) {
    const legal = Engine.legal(v, seat);
    if (v.phase === 'discard') return randDiscard(v, seat, rng);
    if (v.phase === 'noble' || v.phase === 'city') return legal[0];
    const buys = legal.filter(a => a.t === 'buy');
    if (buys.length && rng() < 0.85) {
      const top = Math.max.apply(null, buys.map(a => CARDS[a.id].points));
      const pool = buys.filter(a => CARDS[a.id].points === top);
      return pool[Math.floor(rng() * pool.length)];
    }
    const takes = legal.filter(a => a.t === 'take' || a.t === 'take2');
    const p = v.players[seat];
    if (takes.length && Engine.tokens(p) <= 7 && rng() < 0.92) return takes[Math.floor(rng() * takes.length)];
    const res = legal.filter(a => a.t === 'reserve' && a.id !== undefined);
    if (res.length && rng() < 0.5) return res[Math.floor(rng() * res.length)];
    if (takes.length) return takes[Math.floor(rng() * takes.length)];
    return legal[Math.floor(rng() * legal.length)];
  }

  function smart(v, seat, W) {
    const legal = Engine.legal(v, seat);
    const { p, bw, cands } = plan(v, seat, W);
    const why = [];
    if (v.phase === 'discard') return { action: chooseDiscard(v, seat, cands), why: 'Keep the gems your best targets need.' };
    if (v.phase === 'city') return { action: legal[0], why: 'Any city ends it the same way.' };
    if (v.phase === 'noble') {
      // any is fine (both give 3); take the one others are closest to, to deny it
      let best = legal[0], bs = -1;
      for (const a of legal) {
        const r = NOBLES[a.id].req;
        const close = Math.max.apply(null, v.players.map((q, i) => i === seat ? 0 : r.reduce((s, x, k) => s + Math.min(x, q.bonus[k]), 0)));
        if (close > bs) { bs = close; best = a; }
      }
      return { action: best, why: 'Take the noble an opponent is closest to.' };
    }
    const buys = legal.filter(a => a.t === 'buy');
    const takes = legal.filter(a => a.t === 'take' || a.t === 'take2');
    // 1. a purchase that wins the game outright (or reaches 15 with the most points)
    for (const a of buys) {
      const after = p.points + CARDS[a.id].points + nobleGain(v, p, a.id);
      if (v.mode === 'cities') {
        if (cityAfter(v, p, a.id)) {
          const others = v.players.filter((q, i) => i !== seat).map(q => q.points);
          if (after >= Math.max.apply(null, others) || !W.block) return { action: a, why: 'This card earns you a city.' };
        }
        continue;
      }
      if (after >= Engine.targetOf(v)) {
        const others = v.players.filter((q, i) => i !== seat).map(q => q.points);
        if (after > Math.max.apply(null, others)) return { action: a, why: 'This card takes you to ' + after + ' points.' };
      }
    }
    // 2. block: an opponent who can buy a big card next turn that we can reserve (Hard only)
    if (W.block && p.reserved.length < 3) {
      const threat = blockTarget(v, seat);
      if (threat !== null) {
        const canBuy = buys.find(a => a.id === threat);
        if (canBuy) return { action: canBuy, why: 'Buy the card an opponent was about to win with.' };
        return { action: { t: 'reserve', id: threat }, why: 'Reserve it so the next player can’t win with it.' };
      }
    }
    const top = cands[0];
    // 3. buy the best affordable card if it's (nearly) as good as chasing the top target
    let bestBuy = null, bbs = -Infinity;
    for (const a of buys) {
      const c = cands.find(x => x.id === a.id);
      const s = (c.value + (c.reserved ? 0.35 : 0)) * nudge(W);
      if (s > bbs) { bbs = s; bestBuy = a; }
    }
    if (bestBuy) {
      const topVal = top ? top.score : 0;
      if (bbs / Math.pow(W.den || 1.15, W.pow || 1) >= topVal * (W.buyRatio || 0.8) || !takes.length || Engine.tokens(p) >= 9) return { action: bestBuy, why: 'Best card you can buy now.' };
    }
    // 4. reserve a strong target when gold would get it there quicker (Hard only)
    if (W.reserve && top && !top.reserved && p.reserved.length < 2 && v.bank[5] > 0 && CARDS[top.id].level >= (W.resLvl || 2) && top.turns >= 1) {
      const q = { gems: p.gems.slice(), bonus: p.bonus }; q.gems[5]++;
      const t2 = Engine.turnsToAfford(q, top.id, v.bank);
      if (t2 < top.turns && top.value >= (W.resVal || 3) && Engine.tokens(p) <= (W.resTok || 8)) return { action: { t: 'reserve', id: top.id }, why: 'Reserve your best target; the gold saves a turn.' };
    }
    // 5. take gems toward the top targets
    const reach = cands.filter(c => c.turns !== Infinity).slice(0, 3);
    if (takes.length) {
      const a = bestTake(v, seat, takes, reach, bw, W);
      if (a) return { action: a, why: top ? 'Gems toward your best target.' : 'Most useful gems.' };
    }
    if (bestBuy) return { action: bestBuy, why: 'Best card you can buy now.' };
    const res = legal.find(a => a.t === 'reserve' && a.id !== undefined) || legal.find(a => a.t === 'reserve');
    if (res) return { action: res, why: 'Nothing else to do; reserve for the gold.' };
    return { action: legal[0], why: '' };
  }

  function nobleGain(v, p, id) {
    const c = CARDS[id];
    for (const nid of v.nobles) {
      const r = NOBLES[nid].req;
      if (r.every((x, k) => p.bonus[k] >= x)) continue;
      if (r.every((x, k) => p.bonus[k] + (k === c.bonus ? 1 : 0) >= x)) return 3;
    }
    return 0;
  }

  // a face-up card the NEXT player can buy next turn that would put them at 15+ (or gain 4+ with a noble late)
  function blockTarget(v, seat) {
    const nxt = (seat + 1) % v.n;
    const q = v.players[nxt];
    let best = null, bs = 0;
    v.market.forEach(row => row.forEach(id => {
      if (id === null) return;
      if (Engine.turnsToAfford(q, id, v.bank) !== 0) return;
      const gain = CARDS[id].points + nobleGain(v, q, id);
      if (v.mode === 'cities') { if (cityAfter(v, q, id) && gain + 1 > bs) { bs = gain + 1; best = id; } return; }
      if (q.points + gain >= Engine.targetOf(v) && gain > bs) { bs = gain; best = id; }
    }));
    return best;
  }

  // style: one of STYLES (Hard only; other levels ignore it)
  function decide(v, seat, level, rng, style) {
    rng = rng || Math.random;
    if (level === 'easy') return easy(v, seat, rng);
    const st = level === 'hard' && STYLES[style] ? STYLES[style].w : {};
    const W = Object.assign({}, typeof level === 'object' ? level : (LEVELS[level] || LEVELS.hard), st, { rng });
    return smart(v, seat, W).action;
  }
  function explain(v, seat) { return smart(v, seat, LEVELS.hard); }

  // score of the position for a seat (used for "points lost" in study): points + value of the plan ahead
  function evalFor(v, seat) {
    const W = LEVELS.hard;
    const { p, cands } = plan(v, seat, W);
    const top = cands.slice(0, 3).filter(c => c.turns !== Infinity);
    const future = top.reduce((s, c, i) => s + c.score * (i === 0 ? 1 : 0.4), 0);
    return p.points + sum(p.bonus) * 0.45 + p.nobles.length * 0 + future * 0.6 + sum(p.gems.slice(0, 5)) * 0.08 + p.gems[5] * 0.12;
  }

  return { decide, explain, evalFor, LEVELS, STYLES, plan };
});
