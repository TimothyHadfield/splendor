# Splendor Lab — progress

## START HERE
Read order: this file → CLAUDE.md → docs/rules-check.md → docs/ideas.md → chat.md.
Last updated: 2026-10-20 (first build + phase 2: online, rules check, ideas, QA).
Live: https://timothyhadfield.github.io/splendor/ · Repo: https://github.com/TimothyHadfield/splendor

## Goal right now
Splendor (base + Cities variant) vs 1–3 computers or online friends, with turns-to-afford on every card, a card
efficiency table, hints and a Study screen. Built; waiting on Tim's feedback.

## Status
| Part | State |
|---|---|
| Engine: exact 90 cards, 10 nobles, 4/5/7 gems + 5 gold, reserve (max 3, gold), 10-gem limit, nobles, 15-point final round, tie-breaks | Done. 25 engine tests; 9/9 deliberately broken rules caught (`tools/mutants.js`). |
| Cities of Splendor "Cities" variant (3 of 7 double-sided tiles, no nobles) | Done, Settings switch on the setup screen. 4 tests. |
| Computers Easy / Medium / Hard | Done, measured, 1,000 two-player games per pair: Hard beats Easy 93.2%, Medium 69.7%; Medium beats Easy 82.7%. Cities: 92.3 / 76.6 / 70.8%. |
| Turns-to-afford badges, Hint ("what Hard would do and why") | Done. Turns-to-afford matches brute force on 300 cases. |
| Cards tab: 90 cards sorted by points per gem / cheapest / win rate; nobles; 14 cities; measured notes | Done. First player wins 44.7% of Hard-vs-Hard games; 28.2 rounds average. |
| Study tab: % matched Hard, points lost, points race, per-move table | Done (local games). |
| Online rooms (shared `_online` module, Firebase `th-board-games`, gameId `splendor`) | Wired like Dominion. 6 online tests (createLocal room, secrecy, snapshot = engine view). Two-browser room test: see NOT verified / QA. |
| Screens at 393 px (WebKit + Chromium) and 1440 px | Done: every tab, a full game with a reload mid-game, Cities 3-player game; no console errors, no overflow, no page scroll. |

## Standing instructions (Tim's words)
- "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games."
- "build regular play online with a computer or other online players for all the games and their common varients that match exactly the play of the in-person game."
- "Really work on the webdesign of the games, aswell as art, fitting it with an iphone and computer"
- "make sure that everything works properlly without errors or whatnot... Make sure to get everything right like rules and artwork and specific numbers of cards"
- Common brief: $0, no copyrighted art or rulebook text, no page scroll on main screens, bottom tabs on phone, "?" explains why, choices in Settings.

## Traps
- `js/online.js` is a COPY of `../_online/online.js`. Never edit it here.
- Headless **WebKit on Windows is ~50x slower than Chromium** (no JIT): a full game through UI taps times out. Use
  Chromium with mobile emulation (393×659, touch) for long e2e runs; keep WebKit (phone-view) for screenshots.
  phone-view `click:` steps can time out under load; `--eval "document.querySelector(...).click()"` works.
- createLocal runs computers on a timer: tests must wait for `snap.myTurn` before acting.
- CSS class clashes found once: the SVG gem chip is `.gchip` (not `.chip`), log rows are `.mine` (not `.me`).
- `fitMarket()` sets `--ch` (card height) from the row height AND the width; without it cards overflow late-game.
- No build step: bump `?v=` in index.html when a JS file changes.
- Local test server used port 8473.

## Decisions
- Card list = bouk/splendimax + mcandocia/splendor_ai (agree exactly); filipmlynarski rejected (2 cards differ).
- "Take fewer than 3 colours" only when fewer than 3 colours are left (rulebook silent). See rules-check.md.
- Full tie (points and cards) = shared win. Cities tie among holders = fewest cards, then shared.
- First player random (rulebook: youngest).
- Hard does not reserve to grab gold (measured worse: 58% vs baseline in tuning).
- Strength is measured in 2-player games only.
- Study records only local games (online games skip it).

## NOT verified
- Real iPhone (only Safari's engine at iPhone size).
- Which two city sides share one physical tile: one data source only.
- Online room across two real devices (see the QA result in chat.md for the two-browser run).

## Rejected / parked
- ~~Trading Posts, Strongholds, The Orient modules~~ parked: bigger rule sets, not asked for; data was found.
- ~~Undo~~ not in the real game.
