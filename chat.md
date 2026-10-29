# Splendor Lab — chat log

## 2026-10-20 — first build + phase 2
- **Asked** (via the manager): "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games." Brief: exact 90 cards / 10 nobles / 4-5-7 gems + 5 gold, reserve, 10-gem limit, 15 points; Cities variant if feasible; measured computers; turns-to-afford and card efficiency; hint/study; online seats via `_online`.
- **Built:** engine (`js/engine.js`), card data (`js/cards.js`, two sources agree), bots Easy/Medium/Hard (`js/bots.js`), original SVG art (`js/art.js`), app with Play / Cards / Study / Settings tabs (`js/app.js`, `index.html`), online rooms (`js/online-game.js` + copied `js/online.js`), Cities variant, docs/rules-check.md, docs/ideas.md, icons.
- **Measured:** 1,000 games per pair: Hard beats Easy 93.2%, Medium 69.7%; Medium beats Easy 82.7% (Cities 92.3 / 76.6 / 70.8). First player wins 44.7% of Hard-vs-Hard; 28.2 rounds average.
- **Verified:** 25 engine + 6 online tests pass; `tools/mutants.js` 9/9 broken engines caught. Full games through UI taps (Chromium mobile 393×659 with a reload mid-game; desktop 1440×900 4 players; Cities 3 players): finished, no console errors, no overflow, page height = screen height, Back works. phone-view (WebKit) screenshots of every tab at 393 and desktop.
- **Bugs found and fixed while testing:** Cities games crashed (bots ignored the city choice); bot timer typo; SVG class clash `.chip`; log class clash `.me`; setup panel under the tab bar; market cards overflowing late-game (`fitMarket`); Cards tab list squeezed to zero height on phone (now one scroll area).
- **Open:** QA pass by a fresh agent and the two-browser online room test (results go in progress.md).

## 2026-10-20 — QA fixes
- **Asked** (manager, from the QA agent's report): fix held-gem overlap / 4-player chips / hidden Deal; online points race empty; corrupt saves blanking the page; JSON-array save; Back with a sheet, hash nav, 4th colour tap, "Pick 2 more" count, "-3xnull", a pass-the-phone cover; verify city tile numbers against a source.
- **Built:** all of the above (`js/app.js`, `index.html`), plus "You has a city" → "You have a city". City tiles compared by script: all 14 match lecodex XML + hexanome JSON + CSV and the rulebook's 3 examples (docs/rules-check.md).
- **Verified:** 25 + 6 tests, mutants 9/9, `sp-fix.mjs` 36/36 (320/375/393 px, 10 corrupt-save variants, nav, cover), e2e phone + desktop Cities 4-player clean, two-browser online room on real Firebase finished with 0 errors and B's Study shows the points race.
- **Open:** real iPhone; two real devices online.

## 2026-10-20 — visual design pass
- **Asked** (manager): "once you're finished with all the games, review them again for design improvements especially visually… Don't come to me when you're done, just start working."
- **Built:** laptop board layout (nobles | market | bank columns), reserved-card panel collapse fix, card art shading, new card backs, deck count pill, turns badge rework, ring-not-lift selection, disabled-button look, "Your turn" colour, dark sort dropdown, Study empty dashes, results sheet only on Play (`index.html`, `js/app.js`, `js/art.js`).
- **Verified:** 25 + 6 tests; phone-view WebKit at 393x659 and 1440x900 for setup, 2p, 2p with reserved cards, 4p, Cities 3p, card selected, gems picked, game over, Cards, Study, Settings: 0 console errors, no overflow, page height = screen height in all 22; Chrome flow: Deal, take 3 gems, turn passes.
- **Open:** real iPhone look.

## 2026-10-20 — sound & effects
- **Asked** (via the manager): "add opptional sounds ... win celebrations, and other fun annimations ... customizable in the settings". Ideas: gem clinks per chip, reserve with gold, card flies to tableau, noble fanfare = big, final round alert, winner.
- **Built:** `js/fx.js` (shared copy), `js/sfx.js` (view diff -> events), hooks in `js/app.js` (sounds, payment/return gem glides, count-up + "+N", error shake, turn flash, Animations off/Fast obeyed by existing flyers and CSS animations), Sound & effects panel in Settings (`index.html` styles). Map in progress.md.
- **Verified:** `tests/fx.test.js` 13/13 (failed first: no sfx.js), engine 25 + online 6; Chromium e2e full game through taps (sounds, chimes, noble fanfare, win/lose), Sound off 0 played, Animations off 0 flyers/animations; phone-view 393 + desktop of Settings, mid-game, win with confetti; 0 console errors, no overflow.
- **Open:** hear it on a real iPhone; two-browser online fx.

## 2026-10-20 — table look (4cb5682)
- **Asked** (via the manager): "looks almost identical to how the board or card layout looks like in real life ... like you're looking through a camera that is connected to a user's glasses". Also: fix stray cost digits on flying cards in WebKit.
- **Built:**
  - The play screen is now a wood table, seen from your seat (full description in progress.md). Changed `index.html` and `js/app.js`, plus copies of `_table` and fx.js 1.0.3.
  - Physical deal, buy and reserve flights.
  - Flights now redraw the card fresh instead of cloning it (that was the digit bug).
  - Two read-only review rounds. Their fixes: the "me" panel box is gone; empty spots are bare wood; nobles sit in a row above level 3 on laptop; cards lie slightly off-square.
- **Verified:**
  - Tests: engine 25, fx 13 and online 6 all pass.
  - The Chromium e2e full game passes.
  - `flyshot.mjs` failed on the old build and passes now.
  - `sizes.mjs` in WebKit, 5 states × 320/393/659-landscape/1280/1440: no overflow, no scroll, no clipping, no errors.
  - Live check at 4cb5682.
- **Open:**
  - real iPhone
  - the landscape seat placement
  - larger cascades for your bought cards

## 2026-10-20 — edge pass (weird scenarios)
- **Asked** (via the manager): "Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird." Also fix 3 look gaps: bought cards as tabs, landscape opponents beside the bank, laptop opponents' reserved cards face up.
- **Built:** 48 scenarios tested, 23 failed before, all pass now (list in the manager scratchpad `edge/splendor/scenarios.md`). Engine guards (empty-spot reserve, odd deck numbers, names). App: two-tab sync, Back closes boxes, no stray flying cards, one toast, clearer messages, computers pause in a hidden tab. Layout fixes at SE / landscape / 768–800 px laptops / 200% zoom. Real card columns, opponents across the top in landscape, opponents' hands as backs.
- **Verified:** engine 35 (10 new edge tests, failing first where buggy), fx 13, online 6; edge.mjs 40+ checks in Chromium mobile + WebKit; sp-fix 35/35, sp-fx-e2e, flyshot pass.
- **Open:** online-only oddities not re-run on real Firebase; real iPhone.

## 2026-10-21 — visibility pass
- **Asked** (via the manager): "the cards or board layout is too small to easily see what's going on ... Fix this so the view of what's happening and where everything is is very clear. Consider parts of the board that are dense".
- **Built:** bigger cost/noble/city numbers in the art; phone bands thinned so the market grows; opponents' gem colours on phones; SE bank column; landscape market full height; laptop nobles column; bigger opponent pieces on laptop. Files: `index.html`, `js/art.js`, `js/app.js` (fitMarket).
- **Verified:** check.mjs on 34 shots (6 real bot-game states x 5 sizes + 2 tabs) fails 160 before, passes after in WebKit and Chromium; real taps (card select, take 3) at 4 sizes in both engines; engine 35, fx 13, online 6; sp-fix 35/35; edge.mjs 41/42 (look-landscape fails on purpose); one read-only reviewer, its clip bug fixed.
- **Open:** SE still under the 12 px floor; real iPhone.

## 2026-10-27 — improvement pass vs the official app / BGA
- **Asked** (manager brief): fix the phone band under the bank and the laptop's empty log column; check the level ladder; add rival options; challenges, AI personalities, Undo, end review; kits `_coach`, `_profile`, `_pwa` 1.2.0, `_fx` re-copy; richer original art and bigger key moments.
- **Built:** points to win 10/15/18/21; Medium reserves, every level jitters; Hard styles; Undo vs computers; Daily; 24 challenges with measured stars; My stats + awards; guided game + Rules sheet; install/offline; spare phone height to your area + card spots; laptop Race panel; two scenes per card level, richer nobles; noble/city/final-round moments; Play again; last move on the your-turn line.
- **Verified:** engine 37 (2 new, failed first), ladder 8 (failed 2 on old bots), profile 13, fx 13, online 6; pwa-check 18/18 (10 fails on the old build); screenshots 393/320/659×393/1280/1440 in Chromium + 393/1440 WebKit, 0 errors, 0 overflow; one read-only reviewer, 5 of its 10 points fixed.
- **Open:** real iPhone; reviewer's set-position puzzles, per-seat styles, Expert level, opponents' bonus counts on phones.

## 2026-10-28 — wave 3: modules, speed, videos
- **Asked** (manager wave-3 brief, Tim: "Just make the games better… variations… links to youtube videos"): Videos in Rules; Trading posts + Strongholds modules (off by default, computers at every level, ladder per module); practical settings; iPhone check.
- **Built:** engine phases gem / fort / conquer + bot weights per module; Settings "Cities of Splendor modules" + Computer speed; posts tile + sheet, stronghold towers, tap flows; original post / tower art; Rules tabs Posts, Strongholds, Videos (5 links).
- **Verified:** engine 37, modules 21 (18 failed on the old engine), ladder 10, fx 13, online 6, profile 13; ladders posts 71.5/89.0/74.5, forts 68.0/95.5/87.5, base unchanged. Shots 393/320/659×393/1280/1440 Chromium + 393 WebKit, 0 errors, 0 overflow; WebKit click test of place / remove / free gem / posts sheet / conquest / settings→deal. The click test caught saves on the free-gem step being dropped (fixed).
- **Open:** modules online on real Firebase; real iPhone.

## 2026-10-28 — wave 3 kit sweep (builder b3)
- Kits game-coach 1.2.0 (offer `place:'auto'`, avoid `#deal`) + game-pwa 1.4.0; coach ?v=3, pwa data-version 15, app ?v=14. Verified: 6 suites green, pwa-check 18/18, offer clear of tab bar and Deal at 393x659/320x568/659x393 (WebKit, fresh storage), settings 320 sw=cw=320, select already themed. Commit 0791ee2, live.
