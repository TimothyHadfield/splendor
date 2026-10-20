# Splendor Lab — chat log

## 2026-10-20 — first build + phase 2
- **Asked** (via the manager): "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." Brief: exact 90 cards / 10 nobles / 4-5-7 gems + 5 gold, reserve, 10-gem limit, 15 points; Cities variant if feasible; measured computers; turns-to-afford and card efficiency; hint/study; online seats via `_online`.
- **Built:** engine (`js/engine.js`), card data (`js/cards.js`, two sources agree), bots Easy/Medium/Hard (`js/bots.js`), original SVG art (`js/art.js`), app with Play / Cards / Study / Settings tabs (`js/app.js`, `index.html`), online rooms (`js/online-game.js` + copied `js/online.js`), Cities variant, docs/rules-check.md, docs/ideas.md, icons.
- **Measured:** 1,000 games per pair: Hard beats Easy 93.2%, Medium 69.7%; Medium beats Easy 82.7% (Cities 92.3 / 76.6 / 70.8). First player wins 44.7% of Hard-vs-Hard; 28.2 rounds average.
- **Verified:** 25 engine + 6 online tests pass; `tools/mutants.js` 9/9 broken engines caught. Full games through UI taps (Chromium mobile 393×659 with a reload mid-game; desktop 1440×900 4 players; Cities 3 players): finished, no console errors, no overflow, page height = screen height, Back works. phone-view (WebKit) screenshots of every tab at 393 and desktop.
- **Bugs found and fixed while testing:** Cities games crashed (bots ignored the city choice); bot timer typo; SVG class clash `.chip`; log class clash `.me`; setup panel under the tab bar; market cards overflowing late-game (`fitMarket`); Cards tab list squeezed to zero height on phone (now one scroll area).
- **Open:** QA pass by a fresh agent and the two-browser online room test (results go in progress.md).
