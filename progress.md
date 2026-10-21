# Splendor Lab — progress

## START HERE
Read order: this file → CLAUDE.md → docs/rules-check.md → docs/ideas.md → chat.md.
Last updated: 2026-10-20 (first build + phase 2: online, rules check, ideas, QA, QA fixes, visual design pass; sound & effects; table look @ 4cb5682; edge pass — weird scenarios + 3 table-look gaps).
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
| Study tab: % matched Hard, points lost, points race, per-move table | Done. Online games now feed the points race too. |
| Online rooms (shared `_online` module, Firebase `th-board-games`, gameId `splendor`) | Done. 6 online tests + a two-browser Chromium room on real Firebase (3 seats incl. a computer, 60 taps, both reloads, blind reserve hidden, 0 errors). |
| QA fixes (10-20) | Held gems no longer overlap at 320/375/393 (any gem tappable when returning); 4-player chips 2×2 with names at ≤430 px; Deal visible at 320×568; corrupt/old saves are dropped instead of blanking (try/catch render + deep save check); JSON-array save fixed; Back closes a sheet first; hash nav; 4th colour tap explains; "Pick N more" count right; pass-the-phone cover between friends. Checked by `scratchpad/sp-fix.mjs` 36/36. |
| Visual design pass (10-20) | Laptop board = nobles column, market, bank column, centred (cards ~20% bigger); fixed a reserved card collapsing your gem panel (phone + laptop); card cost shade + header sheen; patterned card backs; turns badge inside the corner (✓ solid green, out of reach = small ring); gem/card picks ring instead of lifting; dark sort dropdown; Study dashes when no moves; results sheet only on Play. Before/after shots of 11 states x 2 widths in the manager scratchpad `design/splendor/`. |
| Sound & effects (10-20) | Shared `js/fx.js` (byte copy of `../_fx/fx.js`) + game-local `js/sfx.js` (pure: before/after view -> events, so local, computer and online moves all sound the same). Settings tab has a "Sound & effects" panel (8 rows, styled like the page's own switches). `node tests/fx.test.js` 13 tests (12 real games; failed before sfx.js existed). Headless Chromium e2e (`scratchpad/sp-fx-e2e.mjs`): full game through taps, Sound off = 0 played, Animations off = 0 flyers / 0 running animations, 0 console errors. |
| Table look (10-20, 4cb5682) | Play screen = dark wood table (`_table` kit copies `css/table.css`, `js/table.js`). Far edge: opponents as wooden name plates with card columns, chip stacks, hand backs. Middle: nobles row (above level 3 on laptop too), 3 rows with level-coloured deck stacks at the left, 6 chip-stack bank piles. Near edge: your colour card columns + chip stacks, reserved cards held as a fan. Cards ±1° off-square. Motion: dealt from the deck with a 3-D flip, bought/reserved cards fly to your columns/hand, chips glide. Flights redraw the card solid (fixed stray cost digits in WebKit; `flyshot.mjs` failed before, passes after). Laptop side panel = log only. Phone landscape = two columns. Shots: manager scratchpad `table/splendor/before|after|sizes`. |
| Edge pass (10-20) | 48 weird scenarios (list + before/after in the manager scratchpad `edge/splendor/scenarios.md`): 23 failed before, all pass now. Engine: an empty market spot can't be reserved (was a phantom card online), odd deck numbers give a message, names trimmed / never half an emoji / blank -> "Player N". App: two tabs of one game stay in step (storage event; computers only move in the visible tab), Back with a sheet on the first screen closes it instead of leaving the site, no flying cards over other tabs, one toast at a time, "Three nobles" wording, messages for empty-colour returns and a 4th reserve. Layout: hand fan inside your area at every size, bank clear of your hand on 768–800 px laptops, iPhone SE landscape, setup at 320×568. Look gaps fixed: your and opponents' bought cards are real overlapping cards in colour columns (newest in front, count on the front card); phone landscape puts opponents along the top; laptop opponents hold reserved cards as backs (tap the seat for the known ones). 10 new engine tests (failed first where it was a bug). |
| Screens at 393 px (WebKit + Chromium) and 1440 px | Done: every tab, a full game with a reload mid-game, Cities 3-player game; no console errors, no overflow, no page scroll. |

## Standing instructions (Tim's words)
- "add risk, clue, battleship, connect four, stratego, clue, checkers, pandemic, splendor, king of tokyo, 7 wonders, and evolution to the list of games."
- "build regular play online with a computer or other online players for all the games and their common varients that match exactly the play of the in-person game."
- "Really work on the webdesign of the games, aswell as art, fitting it with an iphone and computer"
- "make sure that everything works properlly without errors or whatnot... Make sure to get everything right like rules and artwork and specific numbers of cards"
- "add opptional sounds you can add to the games that reflect what's happening in the game accurately as well as win celebrations, and other fun annimations to go along with everything. Just make sure everything is customizable in the settings so the user can play as preffered." (2026-10-20)
- "could you also make sure that each of the games also have a look to them so that the game (either board or card layout) looks almost identical to how the board or card layout looks like in real life ... Make the decks look like actual decks. Make the board have the same design as it does in real life with the same layouts. It should look kind of like you're looking through a camera that is connected to a user's glasses that is playing in real life" (2026-10-20)
- "I've noticed the games often have good user interfaces but could be improved especially when a scenario happens that the game might've not really thought about or whatnot. Could you focus on making each game perfect especially in scenarios that the game doesn't expect or are a little weird." (2026-10-20)
- Common brief: $0, no copyrighted art or rulebook text, no page scroll on main screens, bottom tabs on phone, "?" explains why, choices in Settings.

## Traps
- `js/online.js` is a COPY of `../_online/online.js`. Never edit it here. Same for `js/fx.js` (copy of `../_fx/fx.js`) and `js/table.js` / `css/table.css` (copies of `../_table/`). Working copies show CRLF (autocrlf); the committed blobs are byte-identical.
- The click handler treats `[data-new]` as "New game": newly dealt market cards are marked `data-dealt`, never `data-new`.
- Never clone a card's innerHTML for a flight (badges and digits ride along); `fly()` redraws it with `Art.card`.
- Play CSS: the phone-only media blocks (one/three opponents, landscape) sit at the END of the style block on purpose, after the base rules they override.
- fx.js's injected switch/seg styles beat the page's (same specificity, injected later): `#fx-panel` rules in index.html restyle them.
- python http.server sometimes refuses a file under Chrome load; the e2e script reloads once.
- Headless **WebKit on Windows is ~50x slower than Chromium** (no JIT): a full game through UI taps times out. Use
  Chromium with mobile emulation (393×659, touch) for long e2e runs; keep WebKit (phone-view) for screenshots.
  phone-view `click:` steps can time out under load; `--eval "document.querySelector(...).click()"` works.
- createLocal runs computers on a timer: tests must wait for `snap.myTurn` before acting.
- CSS class clashes found once: the SVG gem chip is `.gchip` (not `.chip`), log rows are `.mine` (not `.me`).
- `fitMarket()` sets `--ch` (card height) from the row height AND the width; without it cards overflow late-game. On the laptop the market column is `auto`, so fitMarket measures the room from `#game` minus side panel and bank (nobles are now a row above it).
- Card SVGs inside `.slot` are `position:absolute`: an SVG's intrinsic 300px width otherwise inflates the slot and squeezes the gem panel when you hold a reserved card.
- No build step: bump `?v=` in index.html when a JS file changes.
- Local test server used port 8473. python http.server drops connections under Playwright load; the edge pass used a tiny node static server (manager scratchpad `edge/splendor/serve.mjs`) on a random port. Other builders hold ports like 8593.
- Bought-card columns use CSS container units (`container-type: size` on `.ccol`, `cqw/cqh`): the offset between cards closes up so the front card's band always shows. Change `--cwmax` / the `.ccol` height per layout, not the formula.
- Sheets and confirm boxes push a history step (`markOverlay`); closing one by its button steps back (`dropOverlay` + `ui.skipPop`). Open new overlays through `sheet()` / `confirmBox()` so Back keeps working.
- `scheduleBot` doesn't run while the tab is hidden (visibilitychange resumes it); the `storage` listener adopts another tab's newer save.
- `tests/engine.test.js` now reports every failure and exits 1 (it used to stop at the first).

## Event -> sound map (js/sfx.js; others' moves at 0.8 volume)
| Event | Sound | Effect |
|---|---|---|
| Take 3 / take 2 | `chip` per gem, 70 ms apart, rising pitch | each gem glides bank -> you / their chip |
| Reserve (table / blind deck) | `cardSlide` / `cardDeal`; `coin` if gold taken | card flies to you |
| Buy | `cardSlide`; `chips` if you paid gems | card flies to you, paid gems glide back to the bank |
| New card dealt into the gap | `cardFlip` | existing deal-in animation |
| Gems returned over 10 | `chips` | gems glide back to the bank |
| Points gained | - | score counts up, "+N" floats |
| Noble visit / city taken | `celebrate big` (ding + star sparkles) | holder's box pops |
| Final round starts (15 pts) | `alarm` | "Final round" label pulses |
| Turn comes back to you | `turn` | your area flashes blue |
| Illegal tap (not your turn, gold, empty colour, 4th gem) | `error` | tapped thing shakes |
| Deal / online game starts | `shuffle` | - |
| Game over | `celebrate win` (seat colours) / `lose` | own result per player online; hot-seat: any human winning = win |
| Any button | `tap` (fx.js auto) | - |

## Decisions
- Card list = bouk/splendimax + mcandocia/splendor_ai (agree exactly); filipmlynarski rejected (2 cards differ).
- "Take fewer than 3 colours" only when fewer than 3 colours are left (rulebook silent). See rules-check.md.
- Full tie (points and cards) = shared win. Cities tie among holders = fewest cards, then shared.
- First player random (rulebook: youngest).
- Hard does not reserve to grab gold (measured worse: 58% vs baseline in tuning).
- Strength is measured in 2-player games only.
- Table look: dark wood; empty piles/columns are bare wood (no ghost chips, no "0"); counts, turns badges, Hint and "?" kept as helpers.
- Study's points race also records online games (from snapshots); move-by-move review stays local-only.
- Pass-the-phone: a plain cover ("Pass the phone to X") before each friend's turn when 2+ humans share a device.
- Short screens (height ≤620) hide the 3 demo cards on setup so Deal stays above the tab bar.
- Edge pass: phone your-area 86 -> 100 px to fit real card columns; opponents' hands are card backs everywhere (known ones visible in the seat sheet); the count pill shows on a column from 2 cards.
- Computers don't move while the page is in the background; they continue when you return.

## NOT verified
- Real iPhone (only Safari's engine at iPhone size). Sounds never heard by a person (headless only; Web Audio ran in Chromium).
- fx in an online room with two browsers (online sounds come from the same view diff, tested in node only).
- Table look: not seen on a real iPhone (WebKit headless only).
- Edge pass: online-only oddities (host leaving, AFK, Firestore offline, two people in one seat) not re-run on real Firebase; they live in the shared online.js. Two tabs both visible side by side could still race a computer move (only the hidden-tab case is guarded).
- Which two city sides share one physical tile: one data source only.
- Online room across two real devices (two headless browsers only).
- City tile numbers: match the rulebook's 3 printed examples + 3 data sets (lecodex, hexanome JSON, CSV); not checked against a physical tile.

## Rejected / parked
- ~~Trading Posts, Strongholds, The Orient modules~~ parked: bigger rule sets, not asked for; data was found.
- ~~Undo~~ not in the real game.
