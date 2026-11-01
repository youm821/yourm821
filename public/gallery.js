const $ = s => document.querySelector(s);
const state = { items: [], set: 'All', q: '', sort: 'default', open: new Set() };
try { state.set = localStorage.getItem('set') || 'All'; state.sort = localStorage.getItem('sort') || 'default'; } catch { /* storage blocked */ }
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

const badgeSafe = l => { try { return badgeRow(l); } catch { return document.createElement('span'); } }; // badges.js is optional
const LOGIN = 'Login with Yapin\u2019';
let ME = null;
const JSON_POST = { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } };
function likeBtn(i) {
  const b = el('button', 'like' + (i.liked ? ' on' : ''), '\u2665 ' + (i.likes || 0)); b.type = 'button';
  b.title = ME && ME.user ? (i.liked ? 'Remove your like' : 'Like this') : 'Log in with Yapin\u2019 to like';
  b.onclick = async e => {
    e.stopPropagation();
    if (!ME || !ME.user) { if (ME && ME.login) location.href = '/signin'; return; }
    try {
      const r = await fetch('/api/like', { ...JSON_POST, body: JSON.stringify({ id: i.id }) }); if (!r.ok) return;
      const d = await r.json(); i.likes = d.likes; i.liked = d.liked;
      b.className = 'like' + (i.liked ? ' on' : ''); b.textContent = '\u2665 ' + i.likes;
      b.title = i.liked ? 'Remove your like' : 'Like this';
    } catch { /* offline: ignore */ }
  };
  return b;
}
function setPreviewPhoto(url) {
  document.documentElement.style.setProperty('--photo-bg', `url("${url}") center/cover no-repeat`);
}
async function loadAccount() {
  let me; try { me = await (await fetch('/api/me', { credentials: 'same-origin' })).json(); } catch { return; }
  ME = me;
  const box = $('#acct'); box.replaceChildren();
  if (me.user) {
    const name = me.user.display_name || me.user.username || 'You';
    if (me.user.avatar_url) { const im = el('img'); im.src = me.user.avatar_url; im.alt = ''; im.referrerPolicy = 'no-referrer'; box.append(im); setPreviewPhoto(me.user.avatar_url); }
    else box.append(el('div', 'ini', name.slice(0, 1).toUpperCase()));
    const w = el('div', 'who', name); w.append(badgeSafe(me.user.badges)); if (me.user.username) w.append(el('small', '', '@' + me.user.username)); box.append(w);
    const out = el('button', 'btn ghost sm', 'Log out');
    out.onclick = async () => { await fetch('/api/user/logout', { method: 'POST', credentials: 'same-origin' }); location.reload(); };
    box.append(out);
  } else if (me.login) {
    const a = el('a', 'btn nowrap'); a.href = '/signin'; a.append(el('span', 'full', LOGIN), el('span', 'short', 'Log in')); box.append(a);
  }
}
function showNote() {
  const r = new URLSearchParams(location.search).get('login'); if (!r) return;
  const msg = { ok: ['ok', 'You are logged in. Your profile picture now shows in the previews.'], cancelled: ['', 'Login cancelled.'], failed: ['bad', 'Login did not work. Please try again.'], banned: ['bad', 'This account is not allowed to log in.'] }[r];
  if (msg) { const n = $('#note'); n.textContent = msg[1]; n.className = 'note ' + msg[0]; n.hidden = false; setTimeout(() => { n.hidden = true; }, 6000); }
  history.replaceState(null, '', location.pathname);
}
async function load() {
  const d = await (await fetch('/api/items', { cache: 'no-cache' })).json();
  document.title = d.settings.title;
  $('#title').textContent = d.settings.title;
  $('#subtitle').textContent = d.settings.subtitle || '';
  try { applyBanner($('#banner'), d.settings); $('#hero').classList.toggle('hasbanner', !$('#banner').hidden); } catch { /* banner.js missing: the gallery still works */ }
  const sup = d.settings.supportUrl;
  for (const id of ['#support', '#support2']) { const a = $(id); if (sup && sup.startsWith('https://')) { a.href = sup; a.hidden = false; } else a.hidden = true; }
  if (d.photo) {
    $('#me').src = d.photo; $('#me').hidden = false;
    document.documentElement.style.setProperty('--photo-bg', `url("${d.photo}") center/cover no-repeat`);
  }
  state.items = d.items;
  render();
}
function render() {
  const counts = new Map();
  for (const i of state.items) counts.set(i.set, (counts.get(i.set) || 0) + 1);
  if (state.set !== 'All' && !counts.has(state.set)) state.set = 'All';
  const chips = $('#chips'); chips.replaceChildren();
  for (const name of ['All', ...counts.keys()]) {
    const b = el('button', 'chip' + (name === state.set ? ' on' : ''), name);
    b.append(el('b', '', name === 'All' ? state.items.length : counts.get(name)));
    b.onclick = () => { state.set = name; try { localStorage.setItem('set', name); } catch { /* ignore */ } render(); };
    chips.append(b);
  }
  const q = state.q.toLowerCase();
  const shown = state.items.filter(i => (state.set === 'All' || i.set === state.set) && (!q || (i.title + ' ' + i.set).toLowerCase().includes(q)));
  if (state.sort === 'loved') shown.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  const grid = $('#grid'); grid.replaceChildren();
  if (!shown.length) grid.append(el('div', 'empty', 'Nothing here yet.'));
  const groups = new Map();
  for (const i of shown) { if (!groups.has(i.set)) groups.set(i.set, []); groups.get(i.set).push(i); }
  for (const [name, list] of groups) {
    if (state.set === 'All') { const h = el('h2', 'set', name); h.append(el('span', '', list.length)); grid.append(h); }
    const foldable = state.set === 'All' && !q && list.length > 8, folded = foldable && !state.open.has(name);
    const g = el('div', 'grid');
    for (const i of folded ? list.slice(0, 8) : list) {
      const f = el('figure', 'card');
      const st = el('div', 'stage ld'); st.append(el('div', 'av'));
      const img = el('img'); img.src = i.src; img.alt = i.title; img.loading = 'lazy'; img.onload = img.onerror = () => st.classList.remove('ld'); st.append(img);
      f.append(st, el('figcaption', '', i.title), likeBtn(i));
      f.onclick = () => openModal(i);
      g.append(f);
    }
    grid.append(g);
    if (foldable) { const more = el('button', 'btn ghost sm more', folded ? 'Show all ' + list.length : 'Show less'); more.onclick = () => { if (folded) state.open.add(name); else state.open.delete(name); render(); }; grid.append(more); }
  }
  $('#count').textContent = shown.length + ' of ' + state.items.length + ' shown';
}
function openModal(i) {
  if (i.id) fetch('/api/view', { ...JSON_POST, body: JSON.stringify({ id: i.id }) }).catch(() => {}); // popularity count
  $('#mimg').src = i.src; $('#mimg').alt = i.title;
  $('#mtitle').textContent = i.title; $('#mset').textContent = i.set;
  $('#modal').hidden = false;
}
const closeModal = () => { $('#modal').hidden = true; };
$('#close').onclick = closeModal;
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
$('#q').oninput = e => { state.q = e.target.value; render(); };
$('#sort').value = state.sort; if ($('#sort').value !== state.sort) state.sort = 'default';
$('#sort').onchange = e => { state.sort = e.target.value; try { localStorage.setItem('sort', state.sort); } catch { /* ignore */ } render(); };
$('#av').onchange = e => document.body.classList.toggle('showav', e.target.checked);
// grid size (S / M / L), remembered
function setGrid(g) {
  document.body.classList.remove('g-s', 'g-l'); if (g === 's' || g === 'l') document.body.classList.add('g-' + g);
  document.querySelectorAll('#gsz button').forEach(b => b.classList.toggle('on', b.dataset.g === g));
  try { localStorage.setItem('gsz', g); } catch { /* ignore */ }
}
document.querySelectorAll('#gsz button').forEach(b => { b.onclick = () => setGrid(b.dataset.g); });
{ let g = 'm'; try { g = localStorage.getItem('gsz') || 'm'; } catch { /* ignore */ } setGrid(g); }
// back to top
const topBtn = $('#totop');
addEventListener('scroll', () => { topBtn.hidden = scrollY < 700; }, { passive: true });
topBtn.onclick = () => scrollTo({ top: 0, behavior: 'smooth' });
showNote();
load().then(loadAccount).then(() => { if (state.items.length) render(); });

// ---------- showcase ----------
function tab(which) {
  const show = which === 'show';
  $('#galwrap').hidden = show; $('#showwrap').hidden = !show;
  $('#tab-gal').classList.toggle('on', !show); $('#tab-show').classList.toggle('on', show);
  history.replaceState(null, '', show ? '#showcase' : location.pathname + location.search);
  if (show) loadShowcase();
}
$('#tab-gal').onclick = () => tab('gal'); $('#tab-show').onclick = () => tab('show');
function byLine(by) {
  const d = el('div', 'by');
  if (by.avatar_url) { const im = el('img'); im.src = by.avatar_url; im.alt = ''; im.referrerPolicy = 'no-referrer'; d.append(im); } else d.append(el('div', 'ini', (by.name || '?').slice(0, 1).toUpperCase()));
  const who = el('span', '', 'by ' + by.name); who.append(badgeSafe(by.badges)); d.append(who); return d;
}
async function loadShowcase() {
  if (!ME) { try { ME = await (await fetch('/api/me', { credentials: 'same-origin' })).json(); } catch { ME = {}; } }
  const d = await (await fetch('/api/showcase', { credentials: 'same-origin', cache: 'no-cache' })).json();
  const box = $('#shareBox'); box.replaceChildren();
  if (ME.user) { const b = el('button', 'btn', 'Share your work'); b.onclick = () => { $('#shareForm').hidden = !$('#shareForm').hidden; }; box.append(b); }
  else if (ME.login) { const a = el('a', 'btn', LOGIN); a.href = '/signin'; box.append(a); }
  const grid = $('#showgrid'); grid.replaceChildren();
  if (!d.items.length) { grid.append(el('div', 'empty', 'Nothing shared yet. Be the first!')); return; }
  const g = el('div', 'grid');
  for (const i of d.items) {
    const f = el('figure', 'card'); const st = el('div', 'stage'); st.append(el('div', 'av'));
    const img = el('img'); img.src = i.src; img.alt = i.title; img.loading = 'lazy'; st.append(img);
    f.append(st, el('figcaption', '', i.title), byLine(i.by));
    if (i.status === 'approved') f.append(likeBtn(i));
    if (i.mine) {
      if (i.status !== 'approved') f.append(el('div', 'pend', 'Waiting for approval'));
      const del = el('button', 'btn danger sm x2', 'Delete');
      del.onclick = async e => { e.stopPropagation(); if (!confirm('Delete "' + i.title + '"?')) return; await fetch('/api/showcase/' + i.id, { method: 'DELETE', credentials: 'same-origin' }); loadShowcase(); };
      f.append(del);
    }
    f.onclick = () => openModal({ id: i.status === 'approved' ? i.id : null, src: i.src, title: i.title, set: 'by ' + i.by.name });
    g.append(f);
  }
  grid.append(g);
}
$('#sh-go').onclick = async () => {
  const file = $('#sh-file').files[0], msg = $('#sh-msg');
  const say = (t, c) => { msg.textContent = t; msg.className = 'msg' + (c ? ' ' + c : ''); };
  if (!file) return say('Choose a file first.', 'err');
  const fd = new FormData(); fd.append('title', $('#sh-title').value); fd.append('file', file);
  say('Uploading…');
  try {
    const r = await fetch('/api/showcase', { method: 'POST', body: fd, credentials: 'same-origin' });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Upload failed');
    say(d.status === 'approved' ? 'Shared! It is live now.' : 'Thanks! It will show once approved.', 'ok');
    $('#sh-file').value = ''; $('#sh-title').value = ''; loadShowcase();
  } catch (e) { say(e.message, 'err'); }
};
if (location.hash === '#showcase') tab('show');

// Discourage saving: no right-click menu or dragging on images
document.addEventListener('contextmenu', e => { if (e.target.tagName === 'IMG') e.preventDefault(); });
document.addEventListener('dragstart', e => { if (e.target.tagName === 'IMG') e.preventDefault(); });