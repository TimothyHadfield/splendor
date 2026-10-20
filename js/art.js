/* Original SVG art: gems, gem chips, development cards, card backs, nobles. No publisher art. */
(function (root) {
  'use strict';
  const C = root.SpCards;
  // fill, light facet, dark facet, outline
  const PAL = [
    ['#e9edf5', '#ffffff', '#b9c2d6', '#8a93a8'], // white / diamond
    ['#3b7ddd', '#8fbaf5', '#1f4d99', '#163a75'], // blue / sapphire
    ['#25a065', '#7fdcae', '#13623d', '#0e4a2e'], // green / emerald
    ['#de3f4a', '#ff9aa0', '#8e1d27', '#6c141c'], // red / ruby
    ['#3b3a44', '#7d7b8c', '#1b1a21', '#0d0c11'], // black / onyx
    ['#f0c040', '#fff0a6', '#b8860b', '#8a6406'], // gold
  ];
  const CHIP = ['#d9dde8', '#2d64b8', '#1d8152', '#b8323c', '#2a2930', '#c99a1f'];
  let uid = 0;

  // a cut gem, centred in a 0..100 box
  function gemShape(k) {
    const [f, l, d, o] = PAL[k];
    switch (k) {
      case 0: // brilliant cut diamond (side view)
        return `<polygon points="22,38 34,22 66,22 78,38 50,82" fill="${f}" stroke="${o}" stroke-width="3" stroke-linejoin="round"/>
          <polygon points="34,22 42,38 58,38 66,22" fill="${l}"/><polygon points="22,38 42,38 50,82" fill="${d}" opacity=".55"/>
          <polygon points="58,38 78,38 50,82" fill="${d}" opacity=".3"/><line x1="22" y1="38" x2="78" y2="38" stroke="${o}" stroke-width="2"/>`;
      case 1: // oval sapphire
        return `<ellipse cx="50" cy="52" rx="27" ry="31" fill="${f}" stroke="${o}" stroke-width="3"/>
          <ellipse cx="50" cy="52" rx="15" ry="18" fill="${d}" opacity=".45"/>
          <path d="M33 38 Q40 26 52 25" stroke="${l}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      case 2: // emerald step cut
        return `<polygon points="34,20 66,20 78,32 78,72 66,84 34,84 22,72 22,32" fill="${f}" stroke="${o}" stroke-width="3" stroke-linejoin="round"/>
          <polygon points="38,30 62,30 68,36 68,68 62,74 38,74 32,68 32,36" fill="${d}" opacity=".45"/>
          <polygon points="42,38 58,38 58,66 42,66" fill="${l}" opacity=".55"/>`;
      case 3: // round ruby
        return `<polygon points="50,18 74,28 84,52 74,76 50,86 26,76 16,52 26,28" fill="${f}" stroke="${o}" stroke-width="3" stroke-linejoin="round"/>
          <polygon points="50,34 66,52 50,70 34,52" fill="${d}" opacity=".5"/>
          <polygon points="50,18 26,28 34,52 50,34" fill="${l}" opacity=".7"/>`;
      case 4: // onyx cabochon
        return `<circle cx="50" cy="52" r="31" fill="${f}" stroke="#9a98aa" stroke-width="3"/>
          <circle cx="50" cy="52" r="19" fill="${d}" opacity=".7"/>
          <path d="M31 42 Q38 28 54 26" stroke="${l}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      default: // gold coin with a star
        return `<circle cx="50" cy="52" r="31" fill="${f}" stroke="${o}" stroke-width="3"/><circle cx="50" cy="52" r="23" fill="none" stroke="${d}" stroke-width="2.5"/>
          <polygon points="50,36 54.5,47 66,47.5 57,54.5 60,66 50,59.5 40,66 43,54.5 34,47.5 45.5,47" fill="${l}" stroke="${d}" stroke-width="1.5"/>`;
    }
  }
  function gem(k, cls) {
    return `<svg class="${cls || 'gem'}" viewBox="10 12 80 80" aria-hidden="true">${gemShape(k)}</svg>`;
  }
  // a poker-chip style token with the gem in the middle
  function chip(k, cls) {
    const ring = CHIP[k];
    let notches = '';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x = 50 + Math.cos(a) * 43, y = 50 + Math.sin(a) * 43;
      notches += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${k === 0 ? '#9aa3b8' : '#ffffff'}" opacity="${k === 0 ? 0.8 : 0.55}"/>`;
    }
    return `<svg class="${cls || 'gchip'}" viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill="${ring}" stroke="rgba(0,0,0,.45)" stroke-width="2"/>${notches}
      <circle cx="50" cy="50" r="34" fill="${k === 0 ? '#f6f7fb' : k === 4 ? '#55535f' : '#ffffff22'}" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>
      <g transform="translate(19 17) scale(.62)">${gemShape(k)}</g></svg>`;
  }

  // card illustration: an abstract scene (mine / caravan / city) tinted by the bonus colour
  function scene(card) {
    const k = card.bonus, [f, l, d] = PAL[k];
    const seed = card.id * 37 + 11;
    const r = i => ((Math.sin(seed + i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const id = 'g' + (uid++);
    const sky = card.level === 1 ? ['#33405e', '#5a6a8c'] : card.level === 2 ? ['#4a3a5e', '#8a6a7c'] : ['#1d2c4a', '#3c5a8a'];
    let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>
      <rect width="100" height="100" fill="url(#${id})"/>`;
    if (card.level === 1) { // a mine in the hills
      s += `<path d="M0 70 Q25 ${48 + r(1) * 12} 50 62 T100 ${56 + r(2) * 10} V100 H0Z" fill="#3f4a3c"/>
        <path d="M0 82 Q30 70 60 80 T100 76 V100 H0Z" fill="#2c3529"/>
        <path d="M${30 + r(3) * 30} 78 a12 12 0 0 1 24 0 Z" fill="#14130f"/>
        <rect x="${28 + r(3) * 30}" y="76" width="28" height="3" fill="#6b5233"/>`;
      for (let i = 0; i < 3; i++) s += `<circle cx="${15 + i * 30 + r(4 + i) * 10}" cy="${86 + r(7 + i) * 6}" r="2.6" fill="${l}" stroke="${d}" stroke-width=".8"/>`;
    } else if (card.level === 2) { // a ship / caravan route
      s += `<path d="M0 66 H100 V100 H0Z" fill="#284057"/><path d="M0 66 Q25 62 50 66 T100 66" stroke="#5f86a8" stroke-width="1.5" fill="none"/>
        <path d="M${22 + r(1) * 30} 66 h36 l-6 9 h-24 z" fill="#5a3b22"/>
        <path d="M${40 + r(1) * 30} 64 V${30 + r(2) * 8} L${58 + r(1) * 30} 60 Z" fill="#e8dcc0"/>
        <path d="M${39 + r(1) * 30} 64 V${30 + r(2) * 8}" stroke="#3a2614" stroke-width="1.5"/>
        <circle cx="${78 - r(3) * 50}" cy="${20 + r(4) * 10}" r="6" fill="#f3e3b0" opacity=".8"/>`;
    } else { // a city of towers
      s += `<path d="M0 78 H100 V100 H0Z" fill="#2b2a33"/>`;
      for (let i = 0; i < 5; i++) {
        const x = 8 + i * 18 + r(i) * 6, h = 22 + r(i + 5) * 34, w = 11 + r(i + 9) * 5;
        s += `<rect x="${x.toFixed(1)}" y="${(78 - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${i % 2 ? '#4a4757' : '#5d596c'}"/>
          <path d="M${x.toFixed(1)} ${(78 - h).toFixed(1)} l${(w / 2).toFixed(1)} -9 l${(w / 2).toFixed(1)} 9z" fill="${d}"/>
          <rect x="${(x + w / 2 - 1.5).toFixed(1)}" y="${(84 - h).toFixed(1)}" width="3" height="4" fill="#f3d27a"/>`;
      }
    }
    s += `<g transform="translate(${60 + r(20) * 8} ${4 + r(21) * 6}) scale(.3)" opacity=".95">${gemShape(k)}</g>`;
    return s;
  }

  const LV_COL = ['#3f9f5f', '#d8a73a', '#4f7fd0'];
  // a development card face (SVG, 100 x 140)
  function card(id, cls) {
    const c = C.CARDS[id];
    const ink = c.bonus === 0 ? '#e9edf5' : PAL[c.bonus][0];
    let costs = '', y = 132;
    for (let k = 4; k >= 0; k--) {
      if (!c.cost[k]) continue;
      costs += `<circle cx="14" cy="${y - 10}" r="10.5" fill="${PAL[k][0]}" stroke="${PAL[k][3]}" stroke-width="2"/>
        <text x="14" y="${y - 5.6}" text-anchor="middle" font-size="13.5" font-weight="800" fill="${k === 0 ? '#222' : '#fff'}" stroke="${k === 0 ? 'none' : 'rgba(0,0,0,.5)'}" stroke-width=".6">${c.cost[k]}</text>`;
      y -= 23;
    }
    return `<svg class="${cls || 'card'}" viewBox="0 0 100 140" aria-label="Level ${c.level} ${C.COLORS[c.bonus]} card, ${c.points} points">
      <rect x="1" y="1" width="98" height="138" rx="9" fill="#f3ead6" stroke="${LV_COL[c.level - 1]}" stroke-width="2.5"/>
      <g><svg x="3" y="30" width="94" height="106" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${scene(c)}</svg></g>
      <rect x="3" y="3" width="94" height="28" rx="7" fill="${ink}" opacity=".93"/>
      ${c.points ? `<text x="9" y="25.5" font-size="25" font-weight="900" fill="#fff" stroke="#1a1a22" stroke-width="2.4" paint-order="stroke">${c.points}</text>` : ''}
      <g transform="translate(66 1) scale(.32)">${gemShape(c.bonus)}</g>
      ${costs}</svg>`;
  }
  function back(level, cls) {
    const col = LV_COL[level - 1];
    let dots = '';
    for (let i = 0; i < level; i++) dots += `<circle cx="${50 + (i - (level - 1) / 2) * 16}" cy="70" r="5.5" fill="#f3ead6"/>`;
    return `<svg class="${cls || 'card'}" viewBox="0 0 100 140" aria-label="Level ${level} deck">
      <rect x="1" y="1" width="98" height="138" rx="9" fill="${col}" stroke="rgba(0,0,0,.35)" stroke-width="2"/>
      <rect x="9" y="9" width="82" height="122" rx="6" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="2" stroke-dasharray="4 4"/>
      <circle cx="50" cy="70" r="26" fill="rgba(0,0,0,.18)"/>${dots}</svg>`;
  }
  // noble tile (100 x 100): 3 points, requirement chips, a crowned figure
  function noble(nid, cls) {
    const n = C.NOBLES[nid];
    let req = '', y = 8;
    for (let k = 0; k < 5; k++) {
      if (!n.req[k]) continue;
      req += `<rect x="6" y="${y}" width="22" height="26" rx="4" fill="${PAL[k][0]}" stroke="${PAL[k][3]}" stroke-width="2"/>
        <text x="17" y="${y + 19}" text-anchor="middle" font-size="17" font-weight="850" fill="${k === 0 ? '#222' : '#fff'}">${n.req[k]}</text>`;
      y += 30;
    }
    const hue = ['#7a4a8a', '#3d6a8a', '#8a5a3a', '#4a7a5a', '#8a3d4f'][nid % 5];
    return `<svg class="${cls || 'noble'}" viewBox="0 0 100 100" aria-label="Noble, 3 points">
      <rect x="1" y="1" width="98" height="98" rx="8" fill="#efe3c4" stroke="#b49a5c" stroke-width="2.5"/>
      <rect x="34" y="6" width="60" height="88" rx="5" fill="${hue}" opacity=".85"/>
      <circle cx="64" cy="46" r="13" fill="#f2d4b0"/>
      <path d="M50 34 l4 -10 l5 7 l5 -9 l5 9 l5 -7 l4 10 z" fill="#f0c040" stroke="#8a6406" stroke-width="1.2"/>
      <path d="M42 94 q0 -26 22 -30 q22 4 22 30 z" fill="#f3ead6" opacity=".9"/>
      <text x="88" y="24" text-anchor="end" font-size="22" font-weight="900" fill="#fff" stroke="#1a1a22" stroke-width="2.2" paint-order="stroke">3</text>
      ${req}</svg>`;
  }
  // city tile (Cities variant): prestige needed + bonuses needed; grey squares = "any one colour" / "one other colour"
  function city(cid, cls) {
    const c = C.CITIES[cid];
    let req = '', x = 6;
    const sq = (fill, stroke, txt, ink, mark) => {
      const r = `<rect x="${x}" y="64" width="20" height="26" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        <text x="${x + 10}" y="82" text-anchor="middle" font-size="15" font-weight="850" fill="${ink}">${txt}</text>` + (mark ? `<text x="${x + 10}" y="60" text-anchor="middle" font-size="10" font-weight="800" fill="#5a4a2a">${mark}</text>` : '');
      x += 23; return r;
    };
    for (let k = 0; k < 5; k++) if (c.req[k]) req += sq(PAL[k][0], PAL[k][3], c.req[k], k === 0 ? '#222' : '#fff');
    if (c.same) req += sq('#8d8d99', '#55555f', c.same, '#fff', 'same');
    if (c.other) req += sq('#8d8d99', '#55555f', c.other, '#fff', 'other');
    return `<svg class="${cls || 'noble'}" viewBox="0 0 100 100" aria-label="City: ${c.pts} points">
      <rect x="1" y="1" width="98" height="98" rx="8" fill="#e8dcc0" stroke="#8a7346" stroke-width="2.5"/>
      <path d="M8 56 V34 h8 v-8 h6 v8 h8 V20 l6 -8 l6 8 V34 h8 v-12 h10 v12 h8 v-6 h6 v6 h8 V56 Z" fill="#7d6a8f" opacity=".75"/>
      <rect x="8" y="54" width="84" height="3" fill="#5a4a2a" opacity=".5"/>
      <circle cx="80" cy="22" r="15" fill="#2a2433" stroke="#f0c040" stroke-width="2.5"/>
      <text x="80" y="29" text-anchor="middle" font-size="19" font-weight="900" fill="#f0c040">${c.pts}</text>
      ${req}</svg>`;
  }
  root.SpArt = { gem, chip, card, back, noble, city, PAL, LV_COL };
})(typeof self !== 'undefined' ? self : this);
