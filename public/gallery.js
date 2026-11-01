const $ = s => document.querySelector(s);
const state = { items: [], set: 'All', q: '' };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

const LOGIN = 'Login with Yapin\u2019';
let ME = null;
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
    const w = el('div', 'who', name); if (me.user.username) w.append(el('small', '', '@' + me.user.username)); box.append(w);
    const out = el('button', 'btn ghost sm', 'Log out');
    out.onclick = async () => { await fetch('/api/user/logout', { method: 'POST', credentials: 'same-origin' }); location.reload(); };
    box.append(out);
  } else if (me.login) {
    const a = el('a', 'btn', LOGIN); a.href = '/login'; box.append(a);
  }
}
function showNote() {
  const r = new URLSearchParams(location.search).get('login'); if (!r) return;
  const msg = { ok: ['ok', 'You are logged in. Your profile picture now shows in the previews.'], cancelled: ['', 'Login cancelled.'], failed: ['bad', 'Login did not work. Please try again.'] }[r];
  if (msg) { const n = $('#note'); n.textContent = msg[1]; n.className = 'note ' + msg[0]; n.hidden = false; setTimeout(() => { n.hidden = true; }, 6000); }
  history.replaceState(null, '', location.pathname);
}
async function load() {
  const d = await (await fetch('/api/items', { cache: 'no-cache' })).json();
  document.title = d.settings.title;
  $('#title').textContent = d.settings.title;
  $('#subtitle').textContent = d.settings.subtitle || '';
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
    b.onclick = () => { state.set = name; render(); };
    chips.append(b);
  }
  const q = state.q.toLowerCase();
  const shown = state.items.filter(i => (state.set === 'All' || i.set === state.set) && (!q || (i.title + ' ' + i.set).toLowerCase().includes(q)));
  const grid = $('#grid'); grid.replaceChildren();
  if (!shown.length) grid.append(el('div', 'empty', 'Nothing here yet.'));
  const groups = new Map();
  for (const i of shown) { if (!groups.has(i.set)) groups.set(i.set, []); groups.get(i.set).push(i); }
  for (const [name, list] of groups) {
    if (state.set === 'All') { const h = el('h2', 'set', name); h.append(el('span', '', list.length)); grid.append(h); }
    const g = el('div', 'grid');
    for (const i of list) {
      const f = el('figure', 'card');
      const st = el('div', 'stage'); st.append(el('div', 'av'));
      const img = el('img'); img.src = i.src; img.alt = i.title; img.loading = 'lazy'; st.append(img);
      f.append(st, el('figcaption', '', i.title));
      f.onclick = () => openModal(i);
      g.append(f);
    }
    grid.append(g);
  }
  $('#count').textContent = shown.length + ' of ' + state.items.length + ' shown';
}
function openModal(i) {
  $('#mimg').src = i.src; $('#mimg').alt = i.title;
  $('#mtitle').textContent = i.title; $('#mset').textContent = i.set;
  const dl = $('#mdl'); dl.href = i.src; dl.download = i.title.replace(/[^\w-]+/g, '_') + i.src.slice(i.src.lastIndexOf('.'));
  $('#mcopy').onclick = async () => {
    try { await navigator.clipboard.writeText(location.origin + i.src); $('#mcopy').textContent = 'Copied!'; }
    catch { $('#mcopy').textContent = 'Press Ctrl+C on the address'; }
    setTimeout(() => { $('#mcopy').textContent = 'Copy link'; }, 1500);
  };
  $('#modal').hidden = false;
}
const closeModal = () => { $('#modal').hidden = true; };
$('#close').onclick = closeModal;
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
$('#q').oninput = e => { state.q = e.target.value; render(); };
$('#av').onchange = e => document.body.classList.toggle('showav', e.target.checked);
showNote();
load().then(loadAccount);

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
  d.append(el('span', '', 'by ' + by.name)); return d;
}
async function loadShowcase() {
  if (!ME) { try { ME = await (await fetch('/api/me', { credentials: 'same-origin' })).json(); } catch { ME = {}; } }
  const d = await (await fetch('/api/showcase', { credentials: 'same-origin', cache: 'no-cache' })).json();
  const box = $('#shareBox'); box.replaceChildren();
  if (ME.user) { const b = el('button', 'btn', 'Share your work'); b.onclick = () => { $('#shareForm').hidden = !$('#shareForm').hidden; }; box.append(b); }
  else if (ME.login) { const a = el('a', 'btn', LOGIN); a.href = '/login'; box.append(a); }
  const grid = $('#showgrid'); grid.replaceChildren();
  if (!d.items.length) { grid.append(el('div', 'empty', 'Nothing shared yet. Be the first!')); return; }
  const g = el('div', 'grid');
  for (const i of d.items) {
    const f = el('figure', 'card'); const st = el('div', 'stage'); st.append(el('div', 'av'));
    const img = el('img'); img.src = i.src; img.alt = i.title; img.loading = 'lazy'; st.append(img);
    f.append(st, el('figcaption', '', i.title), byLine(i.by));
    if (i.mine) {
      if (i.status !== 'approved') f.append(el('div', 'pend', 'Waiting for approval'));
      const del = el('button', 'btn danger sm x2', 'Delete');
      del.onclick = async e => { e.stopPropagation(); if (!confirm('Delete "' + i.title + '"?')) return; await fetch('/api/showcase/' + i.id, { method: 'DELETE', credentials: 'same-origin' }); loadShowcase(); };
      f.append(del);
    }
    f.onclick = () => openModal({ src: i.src, title: i.title, set: 'by ' + i.by.name });
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
