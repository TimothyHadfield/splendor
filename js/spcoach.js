/* spcoach.js: Splendor's guided first game and rules sheet, for the shared kit js/coach.js (never edit that one here).
   SpCoach.RULES   -> COACH.rules() options (our own words, no rulebook text)
   SpCoach.steps(get) -> the tour steps; get() returns the engine state of the guided game on screen (or null)
   SpCoach.GAME    -> the guided game: you first vs 1 Easy computer, a fixed deal (seed 12) */
(function (root) {
  'use strict';
  const ID = 'splendor-first-game';
  const GAME = { seed: 12, level: 'easy', opps: 1 };

  const RULES = {
    title: 'How to play Splendor',
    intro: 'You are a gem merchant. Collect gems, buy cards that give you points and permanent discounts, and win the favour of nobles. First to 15 points ends the game.',
    sections: [
      { id: 'goal', title: 'Goal', short: 'Goal', html:
        '<p>Have the most <b>prestige points</b> when the game ends. Points come from cards (the big number at the top left) and from nobles (3 each).</p>' +
        '<p>When someone reaches <b>15 points</b>, the round is finished so everyone has had the same number of turns. Most points wins; on a tie, whoever bought fewer cards wins.</p>' },
      { id: 'setup', title: 'Setup', short: 'Setup', html:
        '<p>Three rows of 4 face-up cards, one row per level (1 cheapest, 3 most points), each with its deck beside it. Nobles: one more than the number of players.</p>' +
        '<table><tr><th>Players</th><th>Each gem colour</th><th>Gold</th></tr><tr><td>2</td><td>4</td><td>5</td></tr><tr><td>3</td><td>5</td><td>5</td></tr><tr><td>4</td><td>7</td><td>5</td></tr></table>' },
      { id: 'turn', title: 'Your turn', short: 'Turn', html:
        '<p>Do exactly <b>one</b> of these:</p>' +
        '<ol><li><b>Take 3 gems</b> of 3 different colours.</li>' +
        '<li><b>Take 2 gems</b> of one colour, only if 4 or more of it are in the bank.</li>' +
        '<li><b>Reserve a card</b> from the table (or the top of a deck, unseen) and take 1 gold. You may hold 3 reserved cards.</li>' +
        '<li><b>Buy a card</b> from the table or from your reserved cards.</li></ol>' +
        '<p class="tip">You may hold 10 gems at most (gold counts). Over 10 at the end of your turn, you give some back.</p>' },
      { id: 'cards', title: 'Cards and bonuses', short: 'Cards', html:
        '<p>The coloured dots on the left of a card are its <b>cost</b>. Pay it in gems; gold stands in for any colour.</p>' +
        '<p>Every card you own is a <b>permanent bonus</b> of its colour (the gem at the top right): it takes 1 off that colour on every card you buy later. Enough bonuses and cards become free.</p>' +
        '<p class="tip">Cheap level-1 cards have few points, but their discounts are what let you buy the big cards later.</p>' },
      { id: 'nobles', title: 'Nobles', short: 'Nobles', html:
        '<p>A noble shows the <b>bonuses</b> (cards, not gems) it wants. At the end of your turn, if your cards match a noble, it visits you: <b>3 points</b>. Only one noble per turn; if two qualify, you choose.</p>' +
        '<p>You never spend a turn on a noble. It just comes.</p>' },
      { id: 'end', title: 'Game end', short: 'End', html:
        '<p>Reaching 15 points starts the last round: play on until the player before the first player has had their turn. Most points wins; tie: fewer cards bought wins; still tied: a shared win.</p>' },
      { id: 'cities', title: 'Cities variant', short: 'Cities', html:
        '<p>An option from the <i>Cities of Splendor</i> expansion. No nobles: 3 city tiles instead. A city needs the points shown <b>and</b> the bonuses shown (grey squares mean "this many of one colour" or "of one other colour").</p>' +
        '<p>Taking a city ends the game after the round; only players with a city can win.</p>' },
      { id: 'site', title: 'This site', short: 'Site', html:
        '<ul><li><b>Turn badges</b> on each card: how many turns of gems it is from you. ✓ = you can buy it now.</li>' +
        '<li><b>Hint</b>: what the Hard computer would do, and why.</li>' +
        '<li><b>Undo</b> (vs computers): takes back your last move. A game with Hint or Undo counts as "with help" in My stats.</li>' +
        '<li><b>Points to win</b> (Settings): 10, 15, 18 or 21. 15 is the standard game; the computers play to whatever is set.</li>' +
        '<li><b>Daily</b>: the same deal for everyone today, against Hard. <b>Challenges</b>: set deals with a goal and up to 3 stars.</li>' +
        '<li><b>Study</b>: after a game, each of your moves next to Hard\'s, and the points race.</li></ul>' },
    ],
  };

  // the tour; get() -> the guided game's engine state or null
  function steps(get) {
    const s = () => get();
    const me = () => { const x = s(); return x ? x.players[0] : null; };
    const myTurn = () => { const x = s(); return !!(x && !x.over && x.turn === 0 && x.phase === 'main'); };
    const gems = () => { const p = me(); return p ? p.gems.reduce((a, b) => a + b, 0) : 0; };
    const cards = () => { const p = me(); return p ? p.cards.length : 0; };
    const turns = () => { const x = s(); return x ? x.turns : 0; };
    return [
      { title: 'The cards', target: '.market', text: 'Three rows of cards: level 1 at the bottom, level 3 at the top. The coloured dots on a card\'s left are its cost; the big number is its points; the gem at the top right is the discount it gives you for good.' },
      { title: 'Take 3 gems', target: '#bank', text: 'Your turn. Tap 3 different colours in the bank, then Take.', until: () => gems() > 0 || cards() > 0 },
      { title: 'Turns to afford', target: '.market', text: 'The small number in each card\'s corner is how many turns of gems it is from you. A green ✓ means you can buy it now.', when: () => myTurn() && turns() >= 2 },
      { title: 'Buy a card', target: '.market', text: 'Keep taking gems toward a card, then tap it and Buy. Its gem becomes a permanent discount on later cards.', when: myTurn, until: () => cards() >= 1, next: true },
      { title: 'Your cards and gems', target: '#me-box', text: 'Your cards lie here by colour, with your gems below them. 10 gems at most.', when: () => cards() >= 1 },
      { title: 'Nobles', target: '.nobles', text: 'Nobles want bonuses (cards), not gems. Match one and it visits you at the end of your turn: 3 points, free.', when: myTurn },
      { title: 'Reserving', target: '.market .deck', text: 'Stuck? Tap any card (or a deck) and Reserve it: it is yours to buy later, and you get a gold that counts as any colour.', when: myTurn },
      { title: 'You\'re set', target: '#acts', text: 'Hint shows what the Hard computer would do. Play on to 15 points; Rules are on the Play screen and in Settings.', when: myTurn, next: true },
    ];
  }

  const api = { ID, GAME, RULES, steps };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SpCoach = api;
})(typeof window !== 'undefined' ? window : globalThis);
