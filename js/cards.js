/* Splendor game facts: the 90 development cards and 10 nobles (base game).
   Card row = [level, bonus colour, prestige points, cost by colour].
   Colour order everywhere: 0 white (diamond), 1 blue (sapphire), 2 green (emerald), 3 red (ruby), 4 black (onyx), 5 gold (joker).
   Cross-checked: bouk/splendimax "Splendor Cards.csv" and mcandocia/splendor_ai card_data.csv agree card for card;
   every colour has the same cost/point pattern per level (see docs/rules-check.md). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpCards = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const COLORS = ['white', 'blue', 'green', 'red', 'black', 'gold'];
  const GEM = ['Diamond', 'Sapphire', 'Emerald', 'Ruby', 'Onyx', 'Gold'];
  const ROWS = [
    [1,0,0,[0,0,0,2,1]],
    [1,0,0,[0,1,1,1,1]],
    [1,0,0,[0,1,2,1,1]],
    [1,0,0,[0,2,0,0,2]],
    [1,0,0,[0,2,2,0,1]],
    [1,0,0,[0,3,0,0,0]],
    [1,0,0,[3,1,0,0,1]],
    [1,0,1,[0,0,4,0,0]],
    [1,1,0,[0,0,0,0,3]],
    [1,1,0,[0,0,2,0,2]],
    [1,1,0,[0,1,3,1,0]],
    [1,1,0,[1,0,0,0,2]],
    [1,1,0,[1,0,1,1,1]],
    [1,1,0,[1,0,1,2,1]],
    [1,1,0,[1,0,2,2,0]],
    [1,1,1,[0,0,0,4,0]],
    [1,2,0,[0,0,0,3,0]],
    [1,2,0,[0,1,0,2,2]],
    [1,2,0,[0,2,0,2,0]],
    [1,2,0,[1,1,0,1,1]],
    [1,2,0,[1,1,0,1,2]],
    [1,2,0,[1,3,1,0,0]],
    [1,2,0,[2,1,0,0,0]],
    [1,2,1,[0,0,0,0,4]],
    [1,3,0,[0,2,1,0,0]],
    [1,3,0,[1,0,0,1,3]],
    [1,3,0,[1,1,1,0,1]],
    [1,3,0,[2,0,0,2,0]],
    [1,3,0,[2,0,1,0,2]],
    [1,3,0,[2,1,1,0,1]],
    [1,3,0,[3,0,0,0,0]],
    [1,3,1,[4,0,0,0,0]],
    [1,4,0,[0,0,1,3,1]],
    [1,4,0,[0,0,2,1,0]],
    [1,4,0,[0,0,3,0,0]],
    [1,4,0,[1,1,1,1,0]],
    [1,4,0,[1,2,1,1,0]],
    [1,4,0,[2,0,2,0,0]],
    [1,4,0,[2,2,0,1,0]],
    [1,4,1,[0,4,0,0,0]],
    [2,0,1,[0,0,3,2,2]],
    [2,0,1,[2,3,0,3,0]],
    [2,0,2,[0,0,0,5,0]],
    [2,0,2,[0,0,0,5,3]],
    [2,0,2,[0,0,1,4,2]],
    [2,0,3,[6,0,0,0,0]],
    [2,1,1,[0,2,2,3,0]],
    [2,1,1,[0,2,3,0,3]],
    [2,1,2,[0,5,0,0,0]],
    [2,1,2,[2,0,0,1,4]],
    [2,1,2,[5,3,0,0,0]],
    [2,1,3,[0,6,0,0,0]],
    [2,2,1,[2,3,0,0,2]],
    [2,2,1,[3,0,2,3,0]],
    [2,2,2,[0,0,5,0,0]],
    [2,2,2,[0,5,3,0,0]],
    [2,2,2,[4,2,0,0,1]],
    [2,2,3,[0,0,6,0,0]],
    [2,3,1,[0,3,0,2,3]],
    [2,3,1,[2,0,0,2,3]],
    [2,3,2,[0,0,0,0,5]],
    [2,3,2,[1,4,2,0,0]],
    [2,3,2,[3,0,0,0,5]],
    [2,3,3,[0,0,0,6,0]],
    [2,4,1,[3,0,3,0,2]],
    [2,4,1,[3,2,2,0,0]],
    [2,4,2,[0,0,5,3,0]],
    [2,4,2,[0,1,4,2,0]],
    [2,4,2,[5,0,0,0,0]],
    [2,4,3,[0,0,0,0,6]],
    [3,0,3,[0,3,3,5,3]],
    [3,0,4,[0,0,0,0,7]],
    [3,0,4,[3,0,0,3,6]],
    [3,0,5,[3,0,0,0,7]],
    [3,1,3,[3,0,3,3,5]],
    [3,1,4,[6,3,0,0,3]],
    [3,1,4,[7,0,0,0,0]],
    [3,1,5,[7,3,0,0,0]],
    [3,2,3,[5,3,0,3,3]],
    [3,2,4,[0,7,0,0,0]],
    [3,2,4,[3,6,3,0,0]],
    [3,2,5,[0,7,3,0,0]],
    [3,3,3,[3,5,3,0,3]],
    [3,3,4,[0,0,7,0,0]],
    [3,3,4,[0,3,6,3,0]],
    [3,3,5,[0,0,7,3,0]],
    [3,4,3,[3,3,5,3,0]],
    [3,4,4,[0,0,0,7,0]],
    [3,4,4,[0,0,3,6,3]],
    [3,4,5,[0,0,0,7,3]]
  ];
  const CARDS = ROWS.map((r, id) => ({ id, level: r[0], bonus: r[1], points: r[2], cost: r[3] }));
  // Nobles: 3 prestige each; requirement = bonus cards per colour.
  const NOBLE_ROWS = [
    [0, 4, 4, 0, 0], [0, 0, 4, 4, 0], [0, 0, 0, 4, 4], [4, 0, 0, 0, 4], [4, 4, 0, 0, 0],
    [3, 3, 3, 0, 0], [0, 3, 3, 3, 0], [0, 0, 3, 3, 3], [3, 0, 0, 3, 3], [3, 3, 0, 0, 3],
  ];
  const NOBLES = NOBLE_ROWS.map((req, id) => ({ id, points: 3, req }));
  // Cities of Splendor, "Cities" module: 7 double-sided tiles (sides a/b). A city needs at least `pts` prestige
  // AND bonuses: `req` per colour, plus `same` = that many bonuses of any ONE colour, or `other` = that many of one
  // colour not already named in req. Cross-checked: official rulebook (2017) examples + LeCodex cities.xml +
  // hexanome-04 citycards.csv + hexanome-08 cardinfo_citycard.json (tile pairing from hexanome-08 only).
  const CITY_ROWS = [
    [1, 13, [0, 0, 0, 4, 3]], [1, 13, [0, 0, 3, 0, 4]],
    [2, 13, [3, 4, 0, 0, 0]], [2, 13, [4, 0, 0, 3, 0]],
    [3, 17, [0, 0, 0, 0, 0]], [3, 16, [1, 1, 1, 1, 1]],
    [4, 11, [3, 0, 3, 3, 3]], [4, 11, [3, 3, 0, 3, 3]],
    [5, 15, [0, 0, 0, 0, 0], 5, 0], [5, 12, [0, 0, 0, 0, 0], 6, 0],
    [6, 13, [0, 3, 4, 0, 0]], [6, 14, [0, 0, 4, 0, 0], 0, 4],
    [7, 13, [2, 2, 2, 2, 2]], [7, 14, [2, 1, 1, 2, 2]],
  ];
  const CITIES = CITY_ROWS.map((r, id) => ({ id, tile: r[0], pts: r[1], req: r[2], same: r[3] || 0, other: r[4] || 0 }));
  // tokens of each gem colour by player count; gold is always 5
  const GEMS_BY_PLAYERS = { 2: 4, 3: 5, 4: 7 };
  const GOLD = 5;
  return { COLORS, GEM, CARDS, NOBLES, CITIES, GEMS_BY_PLAYERS, GOLD, WIN_POINTS: 15, MAX_TOKENS: 10, MAX_RESERVED: 3 };
});
