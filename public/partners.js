'use strict';
const $ = s => document.querySelector(s);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const KIND = { server: 'Server', creator: 'Creator', partner: 'Partner' };

function openImg(src) { $('#lbimg').src = src; $('#lb').hidden = false; }
$('#lbx').onclick = () => { $('#lb').hidden = true; };
$('#lb').onclick = e => { if (e.target.id === 'lb') $('#lb').hidden = true; };
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#lb').hidden = true; });

function card(p) {
  const c = el('article', 'pcard');
  const top = el('div', 'pcover');
  if (p.cover) { const im = el('img'); im.src = p.cover; im.alt = ''; im.loading = 'lazy'; top.append(im); }
  else top.append(el('span', 'pinit', (p.name || '?').slice(0, 1).toUpperCase()));
  c.append(top);
  const b = el('div', 'pbody');
  const h = el('div', 'phead'); h.append(el('span', 'pkind ' + p.kind, KIND[p.kind] || 'Partner'), el('h2', '', p.name)); b.append(h);
  if (p.blurb) b.append(el('p', 'pblurb', p.blurb));
  if (p.works.length) {
    const row = el('div', 'pworks');
    for (const w of p.works) { const t = el('button', 'pw'); t.setAttribute('aria-label', 'View image'); const im = el('img'); im.src = w.src; im.alt = ''; im.loading = 'lazy'; t.append(im); t.onclick = () => openImg(w.src); row.append(t); }
    b.append(row);
  }
  if (p.url && p.url.startsWith('https://')) { const a = el('a', 'btn sm', p.kind === 'server' ? 'Join server' : 'Visit'); a.href = p.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; b.append(a); }
  c.append(b); return c;
}

async function boot() {
  try {
    const s = await (await fetch('/api/items')).json();
    if (s.settings) { applyBanner($('#banner'), s.settings); $('#hero').classList.toggle('hasbanner', !$('#banner').hidden); document.title = 'Partners \u00b7 ' + s.settings.title; const u = s.settings.supportUrl; if (u && u.startsWith('https://')) { const a = $('#support'); a.href = u; a.hidden = false; } }
  } catch { /* optional */ }
  const box = $('#pgrid');
  try {
    const d = await (await fetch('/api/partners')).json();
    if (!d.partners.length) { box.append(el('div', 'empty', 'No partners yet. Check back soon.')); return; }
    for (const p of d.partners) box.append(card(p));
    $('#count').textContent = d.partners.length + (d.partners.length === 1 ? ' partner' : ' partners');
  } catch { box.append(el('div', 'empty', 'Could not load partners. Please refresh.')); }
}
boot();
