'use strict';
// Pixel-art banner presets. Each one is drawn as crisp 1x1 "pixels" on a 192x24 grid and stretched to fit.
const BANNER_STYLES = { aurora: 'Aurora', sunset: 'Sunset', forest: 'Forest', neon: 'Neon grid', confetti: 'Confetti', ocean: 'Ocean', candy: 'Candy', city: 'Night city' };
const BW = 192, BH = 24, BNS = 'http://www.w3.org/2000/svg';
function rngFor(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hx = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mixc = (a, b, t) => { const A = hx(a), B = hx(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const gradc = (stops, t) => { const n = stops.length - 1, p = Math.min(0.9999, Math.max(0, t)) * n, i = Math.floor(p); return mixc(stops[i], stops[i + 1], p - i); };

function makeBanner(style) {
  const svg = document.createElementNS(BNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${BW} ${BH}`); svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.setAttribute('shape-rendering', 'crispEdges'); svg.setAttribute('aria-hidden', 'true');
  const R = (x, y, w, h, c, o) => {
    if (x < 0) { w += x; x = 0; } if (x + w > BW) w = BW - x; if (y < 0) { h += y; y = 0; } if (y + h > BH) h = BH - y; if (w <= 0 || h <= 0) return;
    const r = document.createElementNS(BNS, 'rect'); r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', w); r.setAttribute('height', h); r.setAttribute('fill', c); if (o != null) r.setAttribute('fill-opacity', o); svg.append(r);
  };
  const bands = (stops, steps) => { for (let y = 0; y < BH; y++) R(0, y, BW, 1, gradc(stops, Math.min(steps - 1, Math.floor(y / BH * steps)) / (steps - 1))); };
  const seed = [...style].reduce((s, c) => s * 31 + c.charCodeAt(0), 7), rnd = rngFor(seed);
  const stars = (n, maxY) => { for (let i = 0; i < n; i++) R(Math.floor(rnd() * BW), Math.floor(rnd() * maxY), 1, 1, '#ffffff', 0.35 + rnd() * 0.65); };
  const disc = (cx, cy, r, c, keep) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r && (!keep || keep(dx, dy))) R(cx + dx, cy + dy, 1, 1, c); };

  if (style === 'aurora') {
    bands(['#0b0d2b', '#161a4a', '#1d2a5e'], 6); stars(46, 12);
    for (let x = 0; x < BW; x++) { const b = 7 + Math.round(3 * Math.sin(x / 14) + 2 * Math.sin(x / 5.5)); for (let k = 0; k < 6; k++) R(x, b + k, 1, 1, k < 2 ? '#7cffcb' : k < 4 ? '#2fbf8f' : '#7a5cff', 0.85 - k * 0.1); }
    for (let x = 0; x < BW; x++) { const h = 2 + Math.round(1.5 * Math.sin(x / 9) + 1.2 * Math.sin(x / 3.1)); R(x, BH - h, 1, h, '#080a1f'); }
  } else if (style === 'sunset') {
    bands(['#2a1055', '#8a2a8a', '#ff5c8a', '#ffb020', '#ffe08a'], 10);
    disc(96, 15, 8, '#fff0b0', (dx, dy) => !(dy > 0 && (dy % 3) === 2));
    for (let x = 0; x < BW; x++) { const h = 4 + Math.round(3 * Math.sin(x / 17) + 2 * Math.sin(x / 6)); R(x, BH - h, 1, h, '#3a1450'); }
    for (let x = 0; x < BW; x++) { const h = 2 + Math.round(1.2 * Math.sin(x / 8 + 2)); R(x, BH - h, 1, h, '#1d0a2e'); }
  } else if (style === 'forest') {
    bands(['#0a1f24', '#12453a', '#1f7a55'], 6); stars(18, 9); disc(158, 6, 3, '#ecebf5', (dx, dy) => ((dx - 2) ** 2 + (dy + 1) ** 2) > 5);
    for (let x = 2, i = 0; x < BW + 6; x += 5 + Math.floor(rnd() * 5), i++) { const h = 8 + Math.floor(rnd() * 9), col = i % 2 ? '#06140f' : '#0b2a20'; for (let r = 0; r < h; r++) { const half = Math.floor(r / 2.5); R(x - half, BH - h - 2 + r, half * 2 + 1, 1, col); } R(x, BH - 2, 1, 2, '#06140f'); }
    for (let i = 0; i < 14; i++) R(Math.floor(rnd() * BW), 10 + Math.floor(rnd() * 11), 1, 1, '#ffe08a', 0.8);
  } else if (style === 'neon') {
    bands(['#12041f', '#2b0a4a', '#4a0f6e'], 8);
    disc(96, 12, 8, '#ff2fd2', (dx, dy) => dy <= 0 && !(dy < -1 && (dy % 2) === 0)); disc(96, 12, 5, '#ffdf5a', (dx, dy) => dy <= 0 && dy > -5 && !((dy % 2) === 0 && dy < 0));
    R(0, 12, BW, 12, '#0f0318'); R(0, 12, BW, 1, '#ff2fd2');
    for (const y of [14, 16, 19, 23]) R(0, y, BW, 1, '#ff2fd2', 0.8);
    for (let y = 14; y < BH; y++) for (let i = -14; i <= 14; i++) { const a = Math.round(96 + i * 2.6 * (y - 12)), b2 = Math.round(96 + i * 2.6 * (y - 11)); R(Math.min(a, b2), y, Math.min(3, Math.abs(b2 - a) + 1), 1, '#2fe6ff', 0.85); }
  } else if (style === 'confetti') {
    bands(['#14141c', '#1d1d29'], 4); const pal = ['#fc6a39', '#7a5cff', '#2fbf8f', '#ffb020', '#ff5c8a', '#4aa3ff', '#5ee0e0', '#ecebf5'];
    for (let i = 0; i < 160; i++) { const s = rnd() < 0.3 ? 2 : 1; R(Math.floor(rnd() * BW), Math.floor(rnd() * BH), s, s, pal[Math.floor(rnd() * pal.length)], 0.55 + rnd() * 0.45); }
    for (let i = 0; i < 9; i++) { const x = 4 + Math.floor(rnd() * (BW - 8)), y = 3 + Math.floor(rnd() * (BH - 6)), c = pal[Math.floor(rnd() * pal.length)]; R(x, y - 1, 1, 3, c); R(x - 1, y, 3, 1, c); }
  } else if (style === 'ocean') {
    bands(['#0b2b5c', '#17559c', '#2a7fd4', '#6fb7f0'], 8);
    for (const [cx, cy] of [[30, 5], [92, 3], [150, 6]]) { R(cx, cy, 9, 1, '#ffffff', 0.85); R(cx - 2, cy + 1, 13, 1, '#ffffff', 0.85); R(cx + 1, cy - 1, 5, 1, '#ffffff', 0.85); }
    for (let l = 0; l < 3; l++) for (let x = 0; x < BW; x++) { const y = 11 + l * 4 + Math.round(1.3 * Math.sin(x / 5 + l * 2)); R(x, y, 1, 1, '#bfe4ff', 0.95 - l * 0.2); R(x, y + 1, 1, BH - y, '#0b2b5c', 0.2); }
  } else if (style === 'candy') {
    for (let y = 0; y < BH; y += 4) for (let x = 0; x < BW; x += 4) R(x, y, 4, 4, ((x + y) / 4) % 2 ? '#ffb3d1' : '#fff1f6');
    const heart = ['.#.#.', '#####', '#####', '.###.', '..#..'];
    for (let i = 0; i < 9; i++) { const x = 4 + Math.floor(rnd() * (BW - 12)), y = 2 + Math.floor(rnd() * (BH - 8)); heart.forEach((row, j) => [...row].forEach((ch, k) => { if (ch === '#') R(x + k, y + j, 1, 1, '#ff5c8a'); })); }
  } else if (style === 'city') {
    bands(['#1a0f3a', '#4a2a7a', '#c0508a'], 8); stars(30, 10); disc(30, 6, 3, '#fff0b0', (dx, dy) => ((dx - 2) ** 2 + (dy + 1) ** 2) > 5);
    for (const [col, minH, maxH, win] of [['#2b1752', 5, 12, 0.15], ['#0d0820', 6, 16, 0.35]]) for (let x = 0; x < BW;) { const w = 6 + Math.floor(rnd() * 8), h = minH + Math.floor(rnd() * (maxH - minH)); R(x, BH - h, w, h, col); for (let wy = BH - h + 2; wy < BH - 1; wy += 3) for (let wx = x + 1; wx < x + w - 1; wx += 2) if (rnd() < win) R(wx, wy, 1, 1, '#ffd36b'); x += w; }
  } else return null;
  return svg;
}

// Fill a banner box from the site settings (bannerStyle, bannerText, bannerFile).
function applyBanner(box, s) {
  if (!box) return; box.replaceChildren();
  const style = (s && s.bannerStyle) || 'none';
  let art = null;
  if (style === 'custom' && s.bannerFile) { art = document.createElement('img'); art.src = '/uploads/' + encodeURIComponent(s.bannerFile); art.alt = ''; art.className = 'bimg'; }
  else if (BANNER_STYLES[style]) art = makeBanner(style);
  if (!art) { box.hidden = true; return; }
  box.append(art);
  if (s.bannerText) { const t = document.createElement('div'); t.className = 'bt'; t.textContent = s.bannerText; box.append(t); }
  box.hidden = false;
}