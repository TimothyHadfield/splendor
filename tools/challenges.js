// Check every challenge with our Hard computer in your seat and set its star marks; writes js/challenge-pars.js.
// node tools/challenges.js [runs]   (about 1 minute for 80 runs)
// Each challenge must be met by Hard in at least 20% of runs (else it fails and says so).
// 2 stars = your turns <= Hard's 80th percentile when it meets the goal; 3 stars = <= Hard's median.
const fs = require('fs');
const path = require('path');
const E = require('../js/engine.js');
const B = require('../js/bots.js');
const C = require('../js/challenges.js');
const { mulberry } = require('./measure.js');

const RUNS = Number(process.argv[2]) || 80;
function setupOf(c) { return E.setup(c.opps.length + 1, { firstSeat: 0, cities: !!c.cities, target: c.target }, mulberry(c.seed), ['You'].concat(c.opps)); }
function run(c, k) {
  const rng = mulberry(c.seed * 1000 + k);
  let s = setupOf(c);
  const lv = ['hard'].concat(c.opps);
  let myTurns = 0, reserves = 0;
  while (!s.over) {
    const seat = s.turn;
    const a = B.decide(E.view(s, seat), seat, lv[seat], rng);
    if (seat === 0 && s.phase === 'main') { myTurns++; if (a.t === 'reserve') reserves++; }
    s = E.apply(s, seat, a);
  }
  return { s, myTurns, reserves };
}
const pars = {}, report = [];
let bad = 0;
for (const c of C.LIST) {
  const ok = [];
  for (let k = 0; k < RUNS; k++) {
    const r = run(c, k);
    const g = C.grade(c, r.s, 0, { myTurns: r.myTurns, reserves: r.reserves }, null);
    if (g.done) ok.push(r.myTurns);
  }
  ok.sort((a, b) => a - b);
  const rate = ok.length / RUNS;
  if (rate < 0.2) bad++;
  const q = f => ok[Math.min(ok.length - 1, Math.floor(f * ok.length))];
  pars[c.id] = ok.length ? [q(0.8), q(0.5)] : [0, 0];
  report.push(c.id.padEnd(4) + ' ' + C.goalText(c).padEnd(44) + ' ' + C.oppText(c).padEnd(12) + ' Hard meets it ' + Math.round(rate * 100) + '%  stars at ' + pars[c.id].join(' / ') + ' turns' + (rate < 0.2 ? '   <-- TOO HARD' : ''));
}
console.log(report.join('\n'));
fs.writeFileSync(path.join(__dirname, '../js/challenge-pars.js'),
  '/* Written by tools/challenges.js (' + RUNS + ' Hard runs per challenge, ' + new Date().toISOString().slice(0, 10) + ') — do not edit by hand.\n' +
  '   [2-star turns, 3-star turns] per challenge. */\nself.SpChallengePars = ' + JSON.stringify(pars) + ';\n');
if (bad) { console.log(bad + ' challenge(s) too hard'); process.exit(1); }
