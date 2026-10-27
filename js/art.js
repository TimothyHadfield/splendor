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

  // card illustration: an original scene tinted by the bonus colour, two scenes per level so a row isn't all alike.
  // Level 1: a gem mine at dusk with a loaded cart, or a crystal outcrop in the hills; level 2: a merchant ship under the
  // moon, or a lighthouse over the harbour; level 3: a city at night with a domed palace, or a great hall with a rose window.
  // Every scene gets a soft light from the gem's corner and a vignette, so the cards read as lit, not flat.
  function scene(card) {
    const k = card.bonus, [f, l, d] = PAL[k];
    const seed = card.id * 37 + 11;
    const r = i => ((Math.sin(seed + i * 12.9898) * 43758.5453) % 1 + 1) % 1;
    const n1 = v => v.toFixed(1);
    const id = 'g' + (uid++);
    const SKIES = [
      [['#2c3654', '#6a6a8a', '#b8806a'], ['#24304a', '#4f6a8a', '#8aa0b0'], ['#3a3050', '#8a6a7a', '#d0906a']],
      [['#3a2e52', '#7a5a78', '#c08a7a'], ['#1e2c48', '#3e5a80', '#7a98b0'], ['#2a2440', '#5a4a70', '#a07a8a']],
      [['#141f3a', '#28406e', '#3c5a8a'], ['#1a1630', '#3a2e5a', '#5a4a7a'], ['#10202e', '#24485a', '#3a6a74']]];
    const sky = SKIES[card.level - 1][Math.floor(r(90) * 3)];
    const alt = r(91) < 0.45;
    const glow = k === 4 ? '#b9b4d6' : l;
    let s = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset=".7" stop-color="${sky[1]}"/><stop offset="1" stop-color="${sky[2]}"/></linearGradient>
        <radialGradient id="${id}l" cx=".78" cy=".12" r=".75"><stop offset="0" stop-color="${glow}" stop-opacity=".45"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
        <radialGradient id="${id}v" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
        <radialGradient id="${id}w" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs>
      <rect width="100" height="100" fill="url(#${id})"/>`;
    // stars in the upper sky (fewer at dusk)
    const nst = card.level === 3 ? 9 : card.level === 2 ? 5 : 3;
    for (let i = 0; i < nst; i++) s += `<circle cx="${n1(4 + r(30 + i) * 52)}" cy="${n1(3 + r(40 + i) * 30)}" r="${n1(0.5 + r(50 + i) * 0.7)}" fill="#fff" opacity="${n1(0.45 + r(60 + i) * 0.5)}"/>`;
    if (card.level === 1 && alt) { // a crystal outcrop: big crystals of the gem's colour breaking out of the rock, a pick left by it
      const cx = 34 + r(3) * 30;
      s += `<path d="M0 62 L18 ${n1(50 + r(8) * 6)} L36 58 L58 ${n1(46 + r(9) * 6)} L78 60 L100 ${n1(52 + r(10) * 6)} V100 H0Z" fill="#4a4f62" opacity=".8"/>
        <path d="M0 80 Q20 66 46 74 Q70 64 100 72 V100 H0Z" fill="#3a3f36"/>
        <circle cx="${n1(cx)}" cy="70" r="20" fill="${glow}" opacity=".18"/>`;
      const cr = [[-9, 13, -14], [0, 22, 0], [9, 15, 12], [-16, 8, -26], [16, 9, 24]];
      cr.forEach(([dx, h, rot], i) => {
        const x = cx + dx, w = i === 1 ? 7 : 5;
        s += `<g transform="rotate(${rot} ${n1(x)} 78)"><path d="M${n1(x - w / 2)} 78 V${n1(78 - h)} L${n1(x)} ${n1(78 - h - w * 0.9)} L${n1(x + w / 2)} ${n1(78 - h)} V78Z" fill="${f}" stroke="${d}" stroke-width=".8"/>
          <path d="M${n1(x - w / 2)} ${n1(78 - h)} L${n1(x)} ${n1(78 - h - w * 0.9)} V78 H${n1(x - w / 2)}Z" fill="${l}" opacity=".55"/></g>`;
      });
      s += `<path d="M0 86 Q30 76 60 84 T100 82 V100 H0Z" fill="#2a2e27"/>
        <path d="M${n1(cx + 20)} 90 l10 -12" stroke="#6b5233" stroke-width="1.6"/><path d="M${n1(cx + 26)} 76 q4 1 7 5 M${n1(cx + 26)} 76 q-1 4 -5 6" stroke="#8a8a96" stroke-width="1.6" fill="none"/>`;
    } else if (card.level === 2 && alt) { // a lighthouse on the cliff, its beam over the harbour, a ship coming in
      const sx = 30 + r(1) * 18;
      // the cliff and lighthouse stand on the right (the left edge is under the card's cost dots)
      s += `<path d="M0 66 H100 V100 H0Z" fill="#284057"/>
        <path d="M0 66 Q25 62 50 66 T100 66" stroke="#5f86a8" stroke-width="1.5" fill="none"/>
        <g transform="translate(100 16) scale(-1 1)"><path d="M14 30 L100 18 L100 34 Z" fill="#f6e7b0" opacity=".16"/>
        <path d="M0 50 Q8 44 18 48 L30 60 Q34 66 36 100 H0Z" fill="#3a3a44"/>
        <rect x="9" y="26" width="9" height="22" fill="#e8dcc0"/><rect x="9" y="33" width="9" height="4" fill="${f}"/><rect x="9" y="41" width="9" height="3" fill="${f}"/>
        <rect x="8" y="22" width="11" height="5" fill="#2a2a33"/><circle cx="13.5" cy="24.5" r="2.6" fill="#ffd27a"/><circle cx="13.5" cy="24.5" r="7" fill="url(#${id}w)" opacity=".7"/>
        <path d="M7 22 L13.5 17 L20 22Z" fill="${d}"/></g>
        <path d="M6 80 q6 -2 12 0 M50 88 q7 -2 14 0 M74 94 q5 -2 10 0" stroke="#5f86a8" stroke-width="1" fill="none" opacity=".7"/>
        <path d="M${n1(sx)} 70 h18 l-3 5 h-12z" fill="#5a3b22"/><path d="M${n1(sx + 9)} 69 V54 L${n1(sx + 18)} 68Z" fill="#efe4c8"/>
        <path d="M${n1(sx + 8)} 68 V58 L${n1(sx + 2)} 68Z" fill="#d9ccae"/><path d="M${n1(sx + 9)} 54 l5 1.5 l-5 1.5z" fill="${f}"/>
        <path d="M${n1(sx - 2)} 77 h22" stroke="#7aa0c0" stroke-width=".8" opacity=".6"/>`;
    } else if (card.level === 3 && alt) { // a great hall at night: two towers, steps, a rose window of the gem's colour lit from inside
      const hx = 22 + r(3) * 8;
      s += `<path d="M84 12 a7 7 0 1 0 5 10 a5.6 5.6 0 1 1 -5 -10z" fill="#f3e3b0" opacity=".8"/>
        <rect x="${n1(hx)}" y="40" width="56" height="38" fill="#5d596c"/>
        <rect x="${n1(hx - 8)}" y="26" width="12" height="52" fill="#4a4757"/><rect x="${n1(hx + 52)}" y="26" width="12" height="52" fill="#4a4757"/>
        <path d="M${n1(hx - 9)} 26 l7 -12 l7 12z M${n1(hx + 51)} 26 l7 -12 l7 12z" fill="${d}"/>
        <path d="M${n1(hx)} 40 L${n1(hx + 28)} 24 L${n1(hx + 56)} 40Z" fill="#4a4757"/>
        <circle cx="${n1(hx + 28)}" cy="51" r="10" fill="${f}" stroke="#2a2833" stroke-width="2"/>
        <circle cx="${n1(hx + 28)}" cy="51" r="10" fill="url(#${id}w)" opacity=".45"/>
        <path d="M${n1(hx + 18)} 51 h20 M${n1(hx + 28)} 41 v20 M${n1(hx + 21)} 44 l14 14 M${n1(hx + 35)} 44 l-14 14" stroke="#2a2833" stroke-width="1"/>
        <circle cx="${n1(hx + 28)}" cy="51" r="3" fill="${l}"/>
        <path d="M${n1(hx + 22)} 78 v-9 a6 6 0 0 1 12 0 v9z" fill="#ffd27a" opacity=".85"/>
        <rect x="${n1(hx - 5)}" y="36" width="3" height="5" fill="#f3d27a"/><rect x="${n1(hx + 57)}" y="36" width="3" height="5" fill="#f3d27a"/>
        <rect x="${n1(hx + 6)}" y="60" width="4" height="7" fill="#f3d27a" opacity=".8"/><rect x="${n1(hx + 46)}" y="60" width="4" height="7" fill="#f3d27a" opacity=".8"/>
        <path d="M0 78 H100 V100 H0Z" fill="#2b2a33"/><path d="M${n1(hx + 14)} 78 h28 l4 4 h-36z M${n1(hx + 8)} 82 h40 l4 4 h-48z" fill="#4a4757"/>`;
    } else if (card.level === 1) { // a gem mine in the hills: far ridge, near hill, the mine mouth with lantern light, rails and a loaded cart
      const mx = 30 + r(3) * 30;
      s += `<path d="M0 60 L14 ${n1(46 + r(8) * 6)} L28 56 L44 ${n1(42 + r(9) * 8)} L62 58 L80 ${n1(44 + r(10) * 6)} L100 54 V100 H0Z" fill="#4a4f62" opacity=".8"/>
        <path d="M0 70 Q25 ${n1(48 + r(1) * 12)} 50 62 T100 ${n1(56 + r(2) * 10)} V100 H0Z" fill="#3f4a3c"/>
        <path d="M0 82 Q30 70 60 80 T100 76 V100 H0Z" fill="#2c3529"/>
        <circle cx="${n1(mx + 12)}" cy="72" r="16" fill="url(#${id}w)" opacity=".55"/>
        <path d="M${n1(mx)} 78 a12 12 0 0 1 24 0 Z" fill="#14130f"/>
        <path d="M${n1(mx - 1)} 78 a13 13 0 0 1 26 0" fill="none" stroke="#6b5233" stroke-width="2.4"/>
        <rect x="${n1(mx - 2)}" y="76" width="28" height="3" fill="#6b5233"/>
        <circle cx="${n1(mx + 2)}" cy="70" r="1.6" fill="#ffd27a"/>
        <path d="M${n1(mx + 4)} 79 L${n1(mx - 14)} 99 M${n1(mx + 20)} 79 L${n1(mx + 34)} 99" stroke="#8a7a62" stroke-width="1" opacity=".8"/>`;
      const cx = mx + (r(11) < 0.5 ? -16 : 22);
      s += `<g transform="translate(${n1(cx)} 82)"><path d="M0 0 h16 l-2 8 h-12 z" fill="#5a3b22" stroke="#2a1a0e" stroke-width=".8"/>
        <circle cx="4" cy="9" r="1.8" fill="#222"/><circle cx="12" cy="9" r="1.8" fill="#222"/>
        <circle cx="5" cy="-1" r="2.6" fill="${f}" stroke="${d}" stroke-width=".7"/><circle cx="10" cy="-2" r="2.8" fill="${l}" stroke="${d}" stroke-width=".7"/><circle cx="8" cy="1" r="2.4" fill="${f}" stroke="${d}" stroke-width=".7"/></g>`;
      for (let i = 0; i < 3; i++) s += `<circle cx="${n1(12 + i * 32 + r(4 + i) * 8)}" cy="${n1(90 + r(7 + i) * 6)}" r="2" fill="${l}" stroke="${d}" stroke-width=".6" opacity=".9"/>`;
    } else if (card.level === 2) { // a merchant ship on a moonlit sea, a far coast, the gem's pennant on the mast
      const sx = 22 + r(1) * 30, top = 28 + r(2) * 8, mn = { x: 16 + r(3) * 30, y: 16 + r(4) * 10 };
      s += `<circle cx="${n1(mn.x)}" cy="${n1(mn.y)}" r="11" fill="#f3e3b0" opacity=".18"/><circle cx="${n1(mn.x)}" cy="${n1(mn.y)}" r="6" fill="#f6ead0" opacity=".9"/>
        <path d="M0 64 Q12 58 22 62 Q34 55 46 62 L46 66 H0Z" fill="#2c2a3e" opacity=".85"/>
        <path d="M0 66 H100 V100 H0Z" fill="#284057"/>
        <path d="M${n1(mn.x - 6)} 70 h12 M${n1(mn.x - 4)} 75 h8 M${n1(mn.x - 3)} 80 h6" stroke="#f3e3b0" stroke-width="1.1" opacity=".5"/>
        <path d="M0 66 Q25 62 50 66 T100 66" stroke="#5f86a8" stroke-width="1.5" fill="none"/>
        <path d="M6 86 q6 -2 12 0 M60 90 q7 -2 14 0 M30 95 q5 -2 10 0" stroke="#5f86a8" stroke-width="1" fill="none" opacity=".7"/>
        <path d="M${n1(sx)} 66 h36 l-6 9 h-24 z" fill="#5a3b22" stroke="#2a1a0e" stroke-width=".8"/>
        <path d="M${n1(sx + 4)} 69 h28" stroke="#8a6a42" stroke-width="1"/>
        <path d="M${n1(sx + 18)} 64 V${n1(top)} L${n1(sx + 36)} 60 Z" fill="#efe4c8"/>
        <path d="M${n1(sx + 16)} 63 V${n1(top + 8)} L${n1(sx + 4)} 62 Z" fill="#d9ccae"/>
        <path d="M${n1(sx + 17)} 64 V${n1(top - 3)}" stroke="#3a2614" stroke-width="1.5"/>
        <path d="M${n1(sx + 17)} ${n1(top - 3)} l7 2 l-7 2 z" fill="${f}" stroke="${d}" stroke-width=".5"/>
        <circle cx="${n1(sx + 8)}" cy="70.5" r="1.1" fill="#ffd27a"/>`;
    } else { // a city at night: stars, a crescent moon, towers with lit windows and a palace dome in the gem's colour
      s += `<path d="M44 12 a8 8 0 1 0 6 12 a6.5 6.5 0 1 1 -6 -12z" fill="#f3e3b0" opacity=".85"/>
        <path d="M0 64 h8 v-6 h6 v6 h10 v-10 h5 v10 h12 v-4 h8 v4 h51 V100 H0Z" fill="#232838" opacity=".9"/>`;
      const pal = Math.floor(r(12) * 3) + 1;
      for (let i = 0; i < 5; i++) {
        const x = 6 + i * 18 + r(i) * 6, h = 24 + r(i + 5) * 32, w = 11 + r(i + 9) * 5;
        if (i === pal) { // the palace: a wide hall under a dome of the gem's colour
          const pw = w + 8, px = x - 4, ph = Math.min(h, 30);
          s += `<rect x="${n1(px)}" y="${n1(78 - ph)}" width="${n1(pw)}" height="${n1(ph)}" fill="#5d596c"/>
            <path d="M${n1(px + 1)} ${n1(78 - ph)} a${n1(pw / 2 - 1)} ${n1(pw / 2 - 1)} 0 0 1 ${n1(pw - 2)} 0z" fill="${f}" stroke="${d}" stroke-width="1"/>
            <path d="M${n1(px + pw * 0.3)} ${n1(78 - ph - pw * 0.28)} q${n1(pw * 0.1)} -3 ${n1(pw * 0.25)} -3" stroke="${l}" stroke-width="1.4" fill="none"/>
            <rect x="${n1(px + pw / 2 - 0.6)}" y="${n1(78 - ph - pw / 2 - 5)}" width="1.2" height="6" fill="${d}"/>
            <path d="M${n1(px + pw / 2 - 4)} 78 v-7 a4 4 0 0 1 8 0 v7z" fill="#ffd27a" opacity=".85"/>`;
          continue;
        }
        const yy = 78 - h;
        s += `<rect x="${n1(x)}" y="${n1(yy)}" width="${n1(w)}" height="${n1(h)}" fill="${i % 2 ? '#4a4757' : '#5d596c'}"/>
          <rect x="${n1(x + w - 3)}" y="${n1(yy)}" width="3" height="${n1(h)}" fill="#000" opacity=".18"/>
          <path d="M${n1(x - 1)} ${n1(yy)} l${n1(w / 2 + 1)} -9 l${n1(w / 2 + 1)} 9z" fill="${d}"/>`;
        for (let j = 0; j < 3; j++) if (r(70 + i * 3 + j) > 0.35 && 6 + j * 9 < h - 6) s += `<rect x="${n1(x + 2.5 + (j % 2) * (w - 8))}" y="${n1(yy + 6 + j * 9)}" width="3" height="4" fill="#f3d27a" opacity="${n1(0.6 + r(80 + j) * 0.4)}"/>`;
      }
      s += `<path d="M0 78 H100 V100 H0Z" fill="#2b2a33"/><path d="M0 78 h100" stroke="#5a5866" stroke-width="1.2"/>`;
      for (let i = 0; i < 12; i++) s += `<rect x="${i * 9}" y="75.5" width="5" height="3" fill="#2b2a33"/>`;
    }
    s += `<rect width="100" height="100" fill="url(#${id}l)"/><rect width="100" height="100" fill="url(#${id}v)"/>
      <g transform="translate(${n1(60 + r(20) * 8)} ${n1(4 + r(21) * 6)}) scale(.3)" opacity=".95">${gemShape(k)}</g>`;
    return s;
  }

  const LV_COL = ['#3f9f5f', '#d8a73a', '#4f7fd0'];
  // a development card face (SVG, 100 x 140)
  function card(id, cls) {
    const c = C.CARDS[id];
    const ink = c.bonus === 0 ? '#e9edf5' : PAL[c.bonus][0];
    // cost dots: big enough that the numbers read on a phone (up to 4 colours fit between the header and the edge)
    let costs = '', y = 136;
    for (let k = 4; k >= 0; k--) {
      if (!c.cost[k]) continue;
      costs += `<circle cx="16" cy="${y - 13}" r="13" fill="${PAL[k][0]}" stroke="${PAL[k][3]}" stroke-width="2"/>
        <text x="16" y="${y - 6.6}" text-anchor="middle" font-size="19" font-weight="850" fill="${k === 0 ? '#222' : '#fff'}" stroke="${k === 0 ? 'none' : 'rgba(0,0,0,.5)'}" stroke-width=".7">${c.cost[k]}</text>`;
      y -= 26.5;
    }
    return `<svg class="${cls || 'card'}" viewBox="0 0 100 140" aria-label="Level ${c.level} ${C.COLORS[c.bonus]} card, ${c.points} points">
      <defs><linearGradient id="cs${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0b0d14" stop-opacity=".55"/><stop offset="1" stop-color="#0b0d14" stop-opacity="0"/></linearGradient>
        <linearGradient id="ch${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <rect x="1" y="1" width="98" height="138" rx="9" fill="#f3ead6" stroke="${LV_COL[c.level - 1]}" stroke-width="2.5"/>
      <g><svg x="3" y="30" width="94" height="106" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${scene(c)}</svg></g>
      <rect x="3" y="30" width="30" height="106" fill="url(#cs${id})"/>
      <rect x="3" y="3" width="94" height="28" rx="7" fill="${ink}" opacity=".95"/>
      <rect x="3" y="3" width="94" height="28" rx="7" fill="url(#ch${id})"/>
      <line x1="3" y1="30.5" x2="97" y2="30.5" stroke="rgba(0,0,0,.35)" stroke-width="1"/>
      ${c.points ? `<text x="9" y="25.5" font-size="25" font-weight="900" fill="#fff" stroke="#1a1a22" stroke-width="2.4" paint-order="stroke">${c.points}</text>` : ''}
      <g transform="translate(66 1) scale(.32)">${gemShape(c.bonus)}</g>
      ${costs}</svg>`;
  }
  // card back: a lattice of facets in the level colour, a framed medallion and the level's dots
  function back(level, cls) {
    const col = LV_COL[level - 1];
    const pid = 'bk' + (uid++);
    let dots = '';
    for (let i = 0; i < level; i++) dots += `<circle cx="${50 + (i - (level - 1) / 2) * 15}" cy="70" r="5" fill="#f3ead6" stroke="rgba(0,0,0,.35)" stroke-width="1"/>`;
    return `<svg class="${cls || 'card'}" viewBox="0 0 100 140" aria-label="Level ${level} deck">
      <defs><pattern id="${pid}" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M7 0 L14 7 L7 14 L0 7 Z" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="1"/></pattern>
        <linearGradient id="${pid}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>
      <rect x="1" y="1" width="98" height="138" rx="9" fill="${col}" stroke="rgba(0,0,0,.4)" stroke-width="2"/>
      <rect x="1" y="1" width="98" height="138" rx="9" fill="url(#${pid})"/>
      <rect x="1" y="1" width="98" height="138" rx="9" fill="url(#${pid}g)"/>
      <rect x="7" y="7" width="86" height="126" rx="6" fill="none" stroke="rgba(243,234,214,.55)" stroke-width="1.6"/>
      <polygon points="50,38 78,70 50,102 22,70" fill="rgba(0,0,0,.22)" stroke="rgba(243,234,214,.7)" stroke-width="1.6"/>${dots}</svg>`;
  }
  // noble tile (100 x 100): 3 points, requirement chips, a crowned figure
  function noble(nid, cls) {
    const n = C.NOBLES[nid];
    let req = '', y = 5;
    for (let k = 0; k < 5; k++) {
      if (!n.req[k]) continue;
      req += `<rect x="4" y="${y}" width="28" height="28" rx="4" fill="${PAL[k][0]}" stroke="${PAL[k][3]}" stroke-width="2"/>
        <text x="18" y="${y + 21.5}" text-anchor="middle" font-size="23" font-weight="900" fill="${k === 0 ? '#222' : '#fff'}">${n.req[k]}</text>`;
      y += 30.5;
    }
    const hue = ['#7a4a8a', '#3d6a8a', '#8a5a3a', '#4a7a5a', '#8a3d4f'][nid % 5];
    const hair = ['#3a2616', '#6b4a2a', '#c9b48a', '#2a2222', '#8a5a2a'][(nid * 3) % 5];
    const pid = 'nb' + (uid++);
    // the jewel at the neck: the colour this noble wants most
    let top = 0; for (let k = 1; k < 5; k++) if (n.req[k] > n.req[top]) top = k;
    return `<svg class="${cls || 'noble'}" viewBox="0 0 100 100" aria-label="Noble, 3 points">
      <defs><pattern id="${pid}" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M5 0 L10 5 L5 10 L0 5Z" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="1"/></pattern>
        <linearGradient id="${pid}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient></defs>
      <rect x="1" y="1" width="98" height="98" rx="8" fill="#efe3c4" stroke="#b49a5c" stroke-width="2.5"/>
      <rect x="34" y="6" width="60" height="88" rx="5" fill="${hue}"/>
      <rect x="34" y="6" width="60" height="88" rx="5" fill="url(#${pid})"/>
      <rect x="34" y="6" width="60" height="88" rx="5" fill="url(#${pid}g)"/>
      <rect x="36.5" y="8.5" width="55" height="83" rx="4" fill="none" stroke="#e8c76a" stroke-opacity=".55" stroke-width="1.2"/>
      <path d="M40 94 q0 -26 24 -31 q24 5 24 31 z" fill="${hue}" stroke="#2a1a22" stroke-opacity=".35" stroke-width="1"/>
      <path d="M40 94 q0 -26 24 -31 q24 5 24 31 z" fill="#000" opacity=".22"/>
      <path d="M52 66 q12 10 24 0 l-3 -4 q-9 6 -18 0z" fill="#f3ead6"/>
      <path d="M56 70 q8 6 16 0" fill="none" stroke="#f0c040" stroke-width="1.4"/>
      <g transform="translate(59.5 69) scale(.11)">${gemShape(top)}</g>
      <rect x="60" y="54" width="8" height="8" fill="#e6c4a0"/>
      <ellipse cx="64" cy="45" rx="11.5" ry="13" fill="#f2d4b0"/>
      <path d="M52.5 44 q0 -14 11.5 -14 q11.5 0 11.5 14 q-3 -7 -11.5 -7 q-8.5 0 -11.5 7z" fill="${hair}"/>
      <ellipse cx="69" cy="48" rx="5" ry="6" fill="#000" opacity=".08"/>
      <circle cx="60" cy="45" r="1.1" fill="#3a2a22"/><circle cx="68" cy="45" r="1.1" fill="#3a2a22"/>
      <path d="M61 51 q3 2 6 0" stroke="#a0604a" stroke-width="1" fill="none"/>
      <path d="M51 32 l4 -10 l5 7 l4 -9 l4 9 l5 -7 l4 10 z" fill="#f0c040" stroke="#8a6406" stroke-width="1.2"/>
      <circle cx="64" cy="22.5" r="1.8" fill="#de3f4a"/><circle cx="55.5" cy="25" r="1.2" fill="#3b7ddd"/><circle cx="72.5" cy="25" r="1.2" fill="#25a065"/>
      <text x="90" y="24" text-anchor="end" font-size="22" font-weight="900" fill="#fff" stroke="#1a1a22" stroke-width="2.2" paint-order="stroke">3</text>
      ${req}</svg>`;
  }
  // city tile (Cities variant): prestige needed + bonuses needed; grey squares = "any one colour" / "one other colour"
  function city(cid, cls) {
    const c = C.CITIES[cid];
    // squares as wide as the tile allows (up to 5 fit), numbers as big as the square
    const n = c.req.filter(v => v).length + (c.same ? 1 : 0) + (c.other ? 1 : 0);
    const step = Math.min(23, 94 / n), w = +(step - 2).toFixed(1), fs = Math.min(21, Math.round(w * 1.05));
    let req = '', x = 3;
    const sq = (fill, stroke, txt, ink, mark) => {
      const r = `<rect x="${x.toFixed(1)}" y="64" width="${w}" height="31" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        <text x="${(x + w / 2).toFixed(1)}" y="${86 - (21 - fs) / 3}" text-anchor="middle" font-size="${fs}" font-weight="900" fill="${ink}">${txt}</text>` + (mark ? `<text x="${(x + w / 2).toFixed(1)}" y="60" text-anchor="middle" font-size="10" font-weight="800" fill="#5a4a2a">${mark}</text>` : '');
      x += step; return r;
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
