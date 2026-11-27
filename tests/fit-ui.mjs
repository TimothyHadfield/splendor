// Fit check (2026-11-27, Tim: "the cards on splendor are really small and the numbers are hard to see"):
// a crowded late game (4 players, everyone's cards out, you hold 3 reserved) and a 2-player late game, in Safari's
// engine (WebKit) at 393x659, 320x568, 659x393 (phone on its side), taller phones 393x852 / 390x844 / 430x932
// (no empty band: the cards take the height), 1280x800 and 1440x900. Every number that
// matters (card costs and points, noble needs, bank counts, your gems and bonuses, opponents' counts) must draw at
// >= 12 px, the market must use the room it has, and nothing may scroll the page or spill out of the screen.
// Run: node tests/fit-ui.mjs [--shots <dir>]   (Playwright from ~/.claude/tools/node_modules; FIT_PORT, default any free port)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pwPath = process.env.FIT_PW || path.join(os.homedir(), '.claude/tools/node_modules/playwright/index.mjs');
if (!fs.existsSync(pwPath)) { console.log('fit-ui: SKIPPED (Playwright not found at ' + pwPath + ')'); process.exit(0); }
const pw = (await import(pathToFileURL(pwPath).href)).default;
const SAVES = require('./fit-state.js');
const shotDir = process.argv.indexOf('--shots') > 0 ? process.argv[process.argv.indexOf('--shots') + 1] : null;
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });

const T = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
let port = +process.env.FIT_PORT || 0; // 0 = any free port
const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { r.writeHead(403); r.end(); return; }
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(d); });
});
await new Promise(res => server.listen(port, '127.0.0.1', res));
port = server.address().port;

const SIZES = [
  { id: 'p393', w: 393, h: 659, mobile: true },
  { id: 'p320', w: 320, h: 568, mobile: true },
  { id: 'l659', w: 659, h: 393, mobile: true },
  // taller phones: the cards must take the extra height (no empty band under the market)
  { id: 't393', w: 393, h: 852, mobile: true, tall: true },
  { id: 't390', w: 390, h: 844, mobile: true, tall: true },
  { id: 't430', w: 430, h: 932, mobile: true, tall: true },
  { id: 'd1280', w: 1280, h: 800, mobile: false },
  { id: 'd1440', w: 1440, h: 900, mobile: false },
];
const FLOOR = 12;

// measured in the page: the drawn size of every number (SVG text = font-size x its screen scale)
function measure() {
  const px = t => parseFloat(t.getAttribute('font-size')) * (t.getScreenCTM() ? t.getScreenCTM().a : 0);
  const minOf = (sel, f) => { let m = Infinity; document.querySelectorAll(sel).forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.height) m = Math.min(m, f(el)); }); return m === Infinity ? null : +m.toFixed(1); };
  const fs = el => parseFloat(getComputedStyle(el).fontSize);
  const cards = [...document.querySelectorAll('.market .slot:not(.deck):not(.empty)')].map(s => s.getBoundingClientRect());
  const costPx = minOf('.market .slot:not(.deck) svg.card text[text-anchor="middle"]', px);
  const ptsPx = minOf('.market .slot:not(.deck) svg.card text[x="9"]', px);
  const gemW = (() => { const g = document.querySelector('.market .slot:not(.deck) svg.card > g[transform]'); return g ? +g.getBoundingClientRect().width.toFixed(1) : null; })();
  const nobPx = minOf('.nobles svg.noble text', px);
  const nob = document.querySelector('.nobles svg.noble'); const nobW = nob ? +nob.getBoundingClientRect().width.toFixed(1) : null;
  const handPx = minOf('.me .hand .slot svg.card text[text-anchor="middle"]', px);
  const hand = document.querySelector('.me .hand .slot'); const handH = hand ? +hand.getBoundingClientRect().height.toFixed(1) : null;
  // the room around the market: the widest strip of bare wood beside or under the cards
  const m = document.querySelector('.market').getBoundingClientRect();
  const all = [...document.querySelectorAll('.market .slot')].map(s => s.getBoundingClientRect());
  const left = Math.min(...all.map(r => r.left)), right = Math.max(...all.map(r => r.right)), bottom = Math.max(...all.map(r => r.bottom)), top = Math.min(...all.map(r => r.top));
  const box = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return Math.round(r.top) + '+' + Math.round(r.height); };
  const vw = innerWidth, vh = innerHeight;
  const tabs = document.querySelector('nav.tabs').getBoundingClientRect();
  const out = []; // things that matter that are off screen or under the tab bar
  const limitB = tabs.top > vh / 2 ? tabs.top : vh;
  document.querySelectorAll('.market .slot, .nobles .noble, .bank .tok, .me, .acts .btn, .seat').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && (r.right > vw + 1 || r.left < -1 || r.bottom > limitB + 1 || r.top < -1)) out.push(el.className.baseVal || el.className); });
  // your gem counts must not be covered (by the bonus counts or the held cards)
  const hidden = [...document.querySelectorAll('.me .htok:not(.zero) b')].filter(b => { const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !(e && b.closest('.htok').contains(e)); }).length;
  const toks = [...document.querySelectorAll('.bank .tok')].map(t => t.getBoundingClientRect());
  return {
    card: cards.length ? Math.round(cards[0].width) + 'x' + Math.round(cards[0].height) : null,
    costPx, ptsPx, gemW, nobW, nobPx, handH, handPx,
    bankPx: minOf('.bank .tok:not(.zero) .n', fs), tok: toks.length ? Math.round(toks[0].width) + 'x' + Math.round(toks[0].height) : null,
    myGemHidden: hidden, myGemPx: minOf('.me .htok:not(.zero) b', fs), myBonusPx: minOf('.me .ccol .cn', fs), myPtsPx: minOf('.mine-info b', fs),
    oppCardPx: minOf('.seat .ccol .cn', fs), oppGemPx: minOf('.seat .og:not(.zero) b, .seat .gtot', fs), oppPtsPx: minOf('.plate .pts', fs), oppHandPx: minOf('.seat .hand-ph .hn', fs),
    spareW: Math.round(Math.max(left - m.left, m.right - right)), spareH: (() => { // the market's height not covered by a row of cards or decks (bands above, between and under them)
      const iv = all.map(r => [Math.max(r.top, m.top), Math.min(r.bottom, m.bottom)]).sort((a, b) => a[0] - b[0]), merged = [];
      iv.forEach(([a, b]) => { const l = merged[merged.length - 1]; if (l && a <= l[1] + 1) l[1] = Math.max(l[1], b); else merged.push([a, b]); });
      const rg = parseFloat(getComputedStyle(document.querySelector('.market')).rowGap) || 0;
      return Math.round(m.height - merged.reduce((s, [a, b]) => s + b - a, 0) - (merged.length - 1) * rg); })(), marketW: Math.round(m.width), marketH: Math.round(m.height),
    scrollX: document.documentElement.scrollWidth > vw + 1, scrollY: document.scrollingElement.scrollTop > 0 || document.documentElement.scrollHeight > vh + 1,
    out, parts: ['.status', '.nobles', '.market', '.bank', '.me', '.acts', 'nav.tabs'].map(box).join(' '),
  };
}

const fails = [], rows = [];
const browser = await pw.webkit.launch();
try {
  for (const sz of SIZES.filter(s => !process.env.FIT_ONLY || process.env.FIT_ONLY.split(',').includes(s.id))) {
    for (const key of ['four', 'two']) {
      const ctx = await browser.newContext({ viewport: { width: sz.w, height: sz.h }, deviceScaleFactor: 2, isMobile: sz.mobile, hasTouch: sz.mobile });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(String(e)));
      page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      await page.addInitScript(s => { try { if (!sessionStorage.getItem('fit')) { localStorage.clear(); localStorage.setItem('splendor.v1', s); sessionStorage.setItem('fit', '1'); } } catch (e) {} }, JSON.stringify(SAVES[key]));
      await page.goto('http://127.0.0.1:' + port + '/index.html');
      await page.waitForFunction(() => !!document.querySelector('#v-play .market .slot'), null, { timeout: 30000 });
      await page.evaluate(() => { if (window.COACH && COACH.closeOffer) COACH.closeOffer(); });
      await page.waitForTimeout(900);
      const r = await page.evaluate(measure);
      r.errs = errs.length;
      rows.push([sz.id, key, r]);
      if (shotDir) await page.screenshot({ path: path.join(shotDir, key + '-' + sz.id + '.png') });
      const bad = (what, v) => fails.push(sz.id + ' ' + key + ': ' + what + ' = ' + v);
      for (const k of ['costPx', 'ptsPx', 'nobPx', 'bankPx', 'myGemPx', 'myBonusPx', 'oppCardPx', 'oppGemPx', 'oppPtsPx', 'oppHandPx', 'handPx']) if (r[k] != null && r[k] < FLOOR) bad(k, r[k]);
      // the cards fill the market: no strip of bare wood wider than a card beside them, nor a band taller than a third of one under them
      const [cw, chh] = (r.card || '0x0').split('x').map(Number);
      if (r.spareW > cw * 0.6) bad('bare wood beside the cards (px)', r.spareW + ' (card ' + r.card + ')');
      if (sz.tall && r.spareH > Math.max(12, chh * 0.15)) bad('tall phone: empty band in the market (px)', r.spareH + ' (card ' + r.card + ')');
      if (r.spareH > chh * 0.5) bad('bare wood under/over the cards (px)', r.spareH + ' (card ' + r.card + ')');
      if (r.myGemHidden) bad('your gem counts covered', r.myGemHidden);
      if (r.scrollX || r.scrollY) bad('page scroll', JSON.stringify({ x: r.scrollX, y: r.scrollY }));
      if (r.out.length) bad('off screen', r.out.slice(0, 4).join(', '));
      if (errs.length) bad('console errors', errs.slice(0, 2).join(' | '));
      await ctx.close();
    }
  }
} finally { await browser.close(); server.close(); }
for (const [id, key, r] of rows) console.log(id.padEnd(6), key.padEnd(5), JSON.stringify(Object.assign({}, r, { out: r.out.length })));
if (fails.length) { console.log('\nfit-ui: ' + fails.length + ' FAIL'); fails.forEach(f => console.log('  ' + f)); process.exit(1); }
console.log('\nfit-ui: all ' + rows.length + ' checks OK');
