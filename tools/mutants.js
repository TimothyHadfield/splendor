// Proves the tests are not vacuous: copies the game into a temp folder, breaks one rule at a time,
// runs the test suites and expects them to FAIL. Run: node tools/mutants.js
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const MUTANTS = [
  ['2 players get 5 gems, not 4', 'js/cards.js', 'GEMS_BY_PLAYERS = { 2: 4', 'GEMS_BY_PLAYERS = { 2: 5'],
  ['take 2 allowed with only 3 in the bank', 'js/engine.js', 'if (s.bank[k] < 4) throw', 'if (s.bank[k] < 3) throw'],
  ['4 reserved cards allowed', 'js/engine.js', 'if (p.reserved.length >= MAX_RESERVED) throw', 'if (p.reserved.length > MAX_RESERVED) throw'],
  ['11 gems allowed', 'js/engine.js', 'if (tokens(p) > MAX_TOKENS) { s.phase', 'if (tokens(p) > MAX_TOKENS + 1) { s.phase'],
  ['game ends at once, no final round', 'js/engine.js', 'if (s.finalRound && next === s.start)', 'if (s.finalRound)'],
  ['tie-break: more cards wins', 'js/engine.js', 'b.points - a.points || a.cards - b.cards', 'b.points - a.points || b.cards - a.cards'],
  ['blind reserves visible to others', 'js/engine.js', "(r.blind && i !== seat && !s.over) ?", '(false) ?'],
  ['Cities "other colour" may reuse a named colour', 'js/engine.js', 'c.req[k] === 0 && x >= c.other', 'x >= c.other'],
  ['turns-to-afford ignores the 10-gem cap', 'js/engine.js', '(shortTotal - gold) > MAX_TOKENS) return Infinity', '(shortTotal - gold) > 99) return Infinity'],
];
let caught = 0;
for (const [label, file, from, to] of MUTANTS) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-mut-'));
  for (const d of ['js', 'tests', 'tools']) fs.cpSync(path.join(root, d), path.join(dir, d), { recursive: true });
  const f = path.join(dir, file), src = fs.readFileSync(f, 'utf8');
  if (!src.includes(from)) { console.log('  MISSING  ' + label + ' (pattern not found)'); process.exitCode = 1; continue; }
  fs.writeFileSync(f, src.replace(from, to));
  const a = spawnSync(process.execPath, [path.join(dir, 'tests/engine.test.js')], { encoding: 'utf8' });
  const b = a.status === 0 ? spawnSync(process.execPath, [path.join(dir, 'tests/online.test.mjs')], { encoding: 'utf8' }) : { status: 1 };
  const failed = a.status !== 0 || b.status !== 0;
  const which = (a.stdout + (a.stderr || '')).match(/AssertionError[^\n]*|Error: [^\n]*/);
  console.log((failed ? '  CAUGHT   ' : '  MISSED   ') + label + (which ? '  <- ' + which[0].slice(0, 90) : ''));
  if (failed) caught++; else process.exitCode = 1;
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(caught + ' of ' + MUTANTS.length + ' broken engines caught by the tests');
