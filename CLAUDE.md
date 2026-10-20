# Splendor Lab — project rules

Static site (GitHub Pages, repo `TimothyHadfield/splendor`, live https://timothyhadfield.github.io/splendor/).
Splendor (base game + the Cities of Splendor "Cities" variant) vs measured computers, turns-to-afford on every card,
card-efficiency tables, hint + study mode, and online rooms through the shared module in `../_online/`.
Read `progress.md` first.

- **No build step.** Plain UMD scripts in `js/` shared by the browser and the node tests. Bump `?v=N` on the
  script tags in `index.html` when a JS file changes after a deploy.
- **Engine contract:** `SpEngine.setup(n, {cities}, rng, names)`, `apply(state, seat, action)` returns a new state
  and throws on an illegal move, `view(state, seat)` hides deck order and other players' blind reserves.
  State is plain JSON. Bots decide from views only. `js/online-game.js` adapts this to the shared online
  module's `game` interface; keep it that way.
- **`js/online.js` is a copy** of `../_online/online.js`. Never edit it here; recopy when the shared one changes.
- **Card data** (`js/cards.js`) matches two independent lists card for card; see `docs/rules-check.md` before
  touching a number. Art is our own SVG (`js/art.js`), wording is our own. No publisher art or rulebook text.
- Tests: `node tests/engine.test.js` (~25 s) and `node tests/online.test.mjs`. `node tools/mutants.js` proves the
  tests catch 9 deliberately broken rules (~3 min).
- Strength numbers: `node tools/build-strength.js 1000` (~7 min) rewrites `js/strength-data.js`. Rerun after any
  change to `js/bots.js`; the level "?" note in `js/app.js` reads the numbers from that file.
- Tim's global rules apply: $0, no permission prompts, explicit `git add` paths, nothing inside `.claude` folders.
