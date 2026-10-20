# Rules check — Splendor (base game) + Cities of Splendor "Cities" module

Checked 2026-10-20. Rows marked ✓ are also asserted by a test in `tests/engine.test.js` (named in the last column).
`node tools/mutants.js` breaks 9 of these rules one at a time and confirms the tests fail each time (9 / 9 caught).

**Sources**
- **R** = official Splendor rulebook (Marc André, Space Cowboys, 2014), as quoted on
  [rulespal.com/splendor/rulebook](https://rulespal.com/splendor/rulebook). Publisher page:
  [spacecowboys.fr/how-to-play-splendor](https://www.spacecowboys.fr/how-to-play-splendor).
- **W** = [Wikipedia: Splendor (game)](https://en.wikipedia.org/wiki/Splendor_(game)) and
  [gamerules.com/rules/splendor](https://gamerules.com/rules/splendor/).
- **C1 / C2** = two independent machine-readable card lists that agree card for card:
  [bouk/splendimax](https://github.com/bouk/splendimax) (cards CSV, nobles in Rust) and
  [mcandocia/splendor_ai](https://github.com/mcandocia/splendor_ai) (cards CSV). A third list
  (filipmlynarski) differs on 2 level-2 cards and breaks the colour symmetry every printed set has, so it was rejected.
- **X** = Cities of Splendor expansion rulebook (Space Cowboys 2017), "Cities" pages. City tile data cross-checked with
  the open-source McGill "hexanome" Splendor projects (city card JSON / CSV) and the lecodex card list (3 sources).

## Components and setup

| Rule / number | Source | In the app | Test |
|---|---|---|---|
| 90 development cards: 40 level 1, 30 level 2, 20 level 3 | R, C1, C2 | ✓ | 90 development cards |
| Each level has the same count per colour (8 / 6 / 4) and the same cost pattern per colour | C1, C2 | ✓ | every colour has the same cost pattern |
| Points: level 1 has five 1-pointers (rest 0); level 2 is 1/2/3; level 3 is 3/4/5 | C1, C2, W | ✓ | points per level |
| Every exact cost (spot checks: L1 white 1 pt = 4 green; L3 white 5 pt = 7 black + 3 white; L2 blue 3 pt = 6 blue) | C1, C2 | ✓ | specific cards |
| 10 nobles, 3 points each: five need 4+4 of two colours, five need 3+3+3 | R, C1 (9 of 10 listed), C2, filip | ✓ | 10 nobles |
| Gem tokens: 7 of each of 5 colours, 5 gold | R | ✓ | setup |
| 2 players: remove 3 of each colour (4 left); 3 players: remove 2 (5 left); 4 players: all 7; gold always 5 | R | ✓ | setup |
| Reveal players + 1 nobles | R, W | ✓ | setup |
| 4 face-up cards per level, rest in 3 face-down decks | R | ✓ | setup |
| First player | R: youngest player | random (no ages in an app) | — |

## A turn (exactly one action)

| Rule | Source | In the app | Test |
|---|---|---|---|
| Take 3 gems of 3 different colours | R, W | ✓ | take 3 different colours |
| Take 2 of one colour only if 4 or more of it are in the bank before taking | R, W | ✓ | take 2 of one colour |
| Gold can never be taken directly | R | ✓ | fewer than 3 ... never gold |
| Taking fewer than 3 different colours | R says nothing; W says "up to three" | **Our call:** allowed only when fewer than 3 colours are left in the bank (most common house ruling; keeps "take 1 gem" from being a free stall) | fewer than 3 different colours |
| Reserve: a face-up card or the top of a deck (blind, not shown to others); take 1 gold if any is left | R | ✓ | reserve |
| Reserving with no gold left is allowed, you just get no gold | R | ✓ | reserving with no gold |
| At most 3 reserved cards; they can't be discarded; only bought | R | ✓ | reserve ... max 3 |
| Buy a face-up card or one of your reserved cards; bonuses discount, gold is a joker; spent gems go back to the bank | R, W | ✓ | buy, buy a reserved card |
| You may choose to spend gold instead of a gem you hold | R (gold = joker) | ✓ (Buy → pay screen) | buy with a chosen payment |
| An emptied face-up slot is refilled from the same level's deck; if the deck is empty the slot stays empty | R | ✓ | buy / reserve (row refills) |
| If you have no legal action at all, you pass | not in R (can't happen in normal play) | ✓ safety net | 150 full games |

## End of turn

| Rule | Source | In the app | Test |
|---|---|---|---|
| Never more than 10 tokens (gold counts) at the end of a turn; return any of them, including ones just taken | R, W | ✓ | more than 10 gems |
| A noble visits automatically when your bonuses meet it; it can't be refused | R | ✓ | a noble visits automatically |
| Only one noble per turn; if several qualify you choose | R, W | ✓ | a noble visits ... one per turn |

## End of the game

| Rule | Source | In the app | Test |
|---|---|---|---|
| Reaching 15 points finishes the current round so everyone has the same number of turns | R, W | ✓ | 15 points finishes the round |
| Most points wins; tie → fewest development cards bought | R | ✓ | tie -> fewer cards wins |
| Still tied | R is silent | **Our call:** shared win | exact tie |

## Cities module (Cities of Splendor)

| Rule | Source | In the app | Test |
|---|---|---|---|
| No nobles; 3 of the 7 double-sided city tiles, each on a random side, any player count | X | ✓ | Cities: 14 city sides on 7 tiles |
| Take a city at the end of your turn if you have its points and its bonuses | X | ✓ | Cities: requirement checks |
| "N of one colour" = N bonuses of any single colour | X | ✓ | Cities: requirement checks |
| "N of another colour" = N of one colour other than the named one | X | ✓ | Cities: requirement checks ("green cannot count twice") |
| If several cities qualify, choose one; you keep only one | X | ✓ | Cities: 60 full games |
| Taking a city ends the round; only city holders can win; among them most points | X | ✓ | Cities: taking a city starts the final round |
| Tie among city holders | X is silent | **Our call:** fewest cards, then shared (same as base) | — |
| Exact tile values (13 / 13 / 13 / 13 / 17 / 16 / 11 / 11 / 15 / 12 / 13 / 14 / 13 / 14 points) | X + 2 data sets | ✓ (`js/cards.js` CITY_ROWS) | Cities tests |
| Which two sides share a physical tile | one data set only (hexanome) | used for "one side per tile" | NOT independently verified |

## Not built (parked)
Trading Posts, Strongholds and The Orient (the other three Cities of Splendor modules). Their data was found but they
are not built; see docs/ideas.md.
