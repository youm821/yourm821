'use strict';
const $ = s => document.querySelector(s);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

// Old share links used the home page (/#d/<id>, /#showcase): send them to the gallery.
if (/^#(d\/|showcase|favorites)/.test(location.hash)) location.replace('/gallery' + location.hash);

// Same set colours as the gallery (keep in sync with SET_HUE in gallery.js).
const SET_HUE = { 'Dude': 205, 'Slime': 135, 'Christmas': 352, 'Thanksgiving': 32, 'Hanukkah': 218, 'Bear': 24, 'Halloween': 275, 'Starter Pack': 175, 'Rings': 262, 'Orbiting & Falling': 190, 'Ears, Hats & Peeking': 328, 'Corner Sets': 52, 'Extras': 300 };
const hueOf = n => SET_HUE[n] != null ? SET_HUE[n] : [...String(n)].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 360, 7);
const tint = (e, n) => { e.classList.add('setc'); e.style.setProperty('--h', hueOf(n)); return e; };
const setPhoto = url => document.documentElement.style.setProperty('--photo-bg', `url("${url}") center/cover no-repeat`);

function stage(item) {
  const st = el('div', 'stage'), av = el('div', 'av'), img = el('img');
  img.src = item.src; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
  st.append(av, img); return st;
}

function pickMosaic(items) {
  // One decoration from each of up to 9 different sets, so the hero shows variety.
  const seen = new Set(), out = [];
  for (const i of items) { if (!seen.has(i.set)) { seen.add(i.set); out.push(i); } }
  return out.slice(0, 9);
}

async function boot() {
  let d;
  try { d = await (await fetch('/api/items', { cache: 'no-cache' })).json(); } catch { return; }
  const items = d.items || [];
  if (d.settings) {
    if (d.settings.title) { document.title = d.settings.title; $('#brand').textContent = d.settings.title; }
    const u = d.settings.supportUrl;
    if (u && u.startsWith('https://')) { const a = $('#support2'); a.href = u; a.hidden = false; }
  }
  if (d.photo) setPhoto(d.photo);
  fetch('/api/me', { credentials: 'same-origin' }).then(r => r.json()).then(me => { if (me && me.user && me.user.avatar_url && me.user.avatar_url.startsWith('https://')) setPhoto(me.user.avatar_url); }).catch(() => {});
  if (!items.length) return;

  // Group by set, keeping the gallery's order.
  const sets = new Map();
  for (const i of items) { if (!sets.has(i.set)) sets.set(i.set, []); sets.get(i.set).push(i); }

  const st = $('#lstats'); st.hidden = false;
  for (const [n, label] of [[items.length, 'decorations'], [sets.size, 'sets']]) { const s = el('span'); s.append(el('b', null, n), ' ' + label); st.append(s); }
  $('#count').textContent = items.length + ' decorations';

  // Hero mosaic
  const mos = $('#mosaic');
  pickMosaic(items).forEach((it, k) => { const t = tint(el('div', 'tile'), it.set); t.style.setProperty('--i', k); t.append(stage(it)); mos.append(t); });

  // Set cards
  const grid = $('#setgrid');
  for (const [name, list] of sets) {
    const a = tint(el('a', 'setcard'), name); a.href = '/gallery?set=' + encodeURIComponent(name); a.setAttribute('aria-label', name + ', ' + list.length + ' decorations');
    const m = el('div', 'meta'); m.append(el('b', null, name), el('span', null, list.length));
    a.append(stage(list[0]), m); grid.append(a);
  }

  // Surprise me: open a random decoration in the gallery
  $('#surprise').addEventListener('click', e => { e.preventDefault(); location.href = '/d/' + encodeURIComponent(items[Math.floor(Math.random() * items.length)].id); });

  // Popular row (stays hidden until people have used the site)
  try {
    const { ids } = await (await fetch('/api/trending')).json();
    const byId = new Map(items.map(i => [i.id, i]));
    const hot = (ids || []).map(id => byId.get(id)).filter(Boolean).slice(0, 6);
    if (hot.length) {
      const g = $('#hotgrid');
      for (const it of hot) {
        const f = tint(el('a', 'card'), it.set); f.href = '/d/' + encodeURIComponent(it.id);
        f.style.textDecoration = 'none'; f.append(stage(it), el('div', 'cap', it.title)); f.lastChild.style.cssText = 'margin-top:8px;font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
        g.append(f);
      }
      $('#hot').hidden = false;
    }
  } catch { /* optional */ }
}
boot();