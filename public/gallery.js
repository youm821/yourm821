const $ = s => document.querySelector(s);
const state = { items: [], trending: [], set: 'All', q: '', sort: 'default', open: new Set() };
try { state.set = localStorage.getItem('set') || 'All'; state.sort = localStorage.getItem('sort') || 'default'; } catch { /* storage blocked */ }
{ const ws = new URLSearchParams(location.search).get('set'); if (ws) state.set = ws; } // /gallery?set=Name from the home page
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
// The Name Banners tab and its (empty) panel are created here if gallery.html does not have them yet,
// so the page keeps working whichever version of gallery.html is deployed.
if (!$('#tab-ban')) { const b = el('button', 'tab', 'Name Banners'); b.id = 'tab-ban'; b.type = 'button'; const old = document.querySelector('a.tab[href="/name-banners"]'); if (old) old.replaceWith(b); else $('#tab-show').after(b); }
if (!$('#tab-fx')) { const b = el('button', 'tab', 'Profile Effects'); b.id = 'tab-fx'; b.type = 'button'; $('#tab-ban').after(b); }
if (!$('#fxwrap')) { const w = el('section', 'showwrap'); w.id = 'fxwrap'; w.hidden = true; $('#favwrap').before(w); }
if (!$('#banwrap')) { const w = el('section', 'showwrap'); w.id = 'banwrap'; w.hidden = true; $('#favwrap').before(w); }

// Each set has its own hue; unknown sets (added in /admin) get a stable one from their name.
const SET_HUE = { 'Dude': 205, 'Slime': 135, 'Christmas': 352, 'Thanksgiving': 32, 'Hanukkah': 218, 'Bear': 24, 'Halloween': 275, 'Starter Pack': 175, 'Rings': 262, 'Orbiting & Falling': 190, 'Ears, Hats & Peeking': 328, 'Corner Sets': 52, 'Extras': 300, 'Trending': 85, 'New': 240 };
const hueOf = n => SET_HUE[n] != null ? SET_HUE[n] : [...String(n)].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 360, 7);
const tint = (e, n) => { e.classList.add('setc'); e.style.setProperty('--h', hueOf(n)); return e; };
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
      if (!$('#favwrap').hidden) renderFavs();
    } catch { /* offline: ignore */ }
  };
  return b;
}
function setPreviewPhoto(url) {
  document.documentElement.style.setProperty('--photo-bg', `url("${url}") center/cover no-repeat`);
}
async function loadAccount() {
  let me; try { me = await (await fetch('/api/me', { credentials: 'same-origin' })).json(); } catch { return; }
  ME = me; $('#tab-fav').hidden = !me.user;
  const box = $('#acct'); box.replaceChildren();
  if (me.user) {
    const name = me.user.display_name || me.user.username || 'You';
    if (me.user.avatar_url) { const im = el('img'); im.src = me.user.avatar_url; im.alt = ''; im.referrerPolicy = 'no-referrer'; box.append(im); setPreviewPhoto(me.user.avatar_url); }
    else box.append(el('div', 'ini', name.slice(0, 1).toUpperCase()));
    const w = el('div', 'who');
    if (me.user.username) { const a = el('a', '', name); a.href = '/u/' + encodeURIComponent(me.user.username); a.style.color = 'inherit'; a.title = 'Your profile'; w.append(a); } else w.append(name);
    w.append(badgeSafe(me.user.badges)); if (me.user.username) w.append(el('small', '', '@' + me.user.username)); box.append(w);
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
  if (!location.pathname.startsWith('/d/')) document.title = d.settings.title;
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
  try { state.trending = (await (await fetch('/api/trending', { cache: 'no-cache' })).json()).ids || []; } catch { /* optional */ }
  render();
  openFromHash();
}
function emptyBox(title, sub, action) {
  const d = el('div', 'empty rich'); d.append(el('b', '', title), el('span', '', sub));
  if (action) { const b = el('button', 'btn ghost sm', action[0]); b.type = 'button'; b.onclick = action[1]; d.append(b); }
  return d;
}
function makeCard(i) {
  const f = tint(el('figure', 'card'), i.set);
  const st = el('div', 'stage ld'); st.append(el('div', 'av'));
  const img = el('img'); img.src = i.src; img.alt = i.title; img.loading = 'lazy'; img.decoding = 'async'; img.onload = img.onerror = () => st.classList.remove('ld'); st.append(img);
  f.append(st, el('figcaption', '', i.title), likeBtn(i));
  cardKeys(f, () => openModal(i));
  return f;
}
function skeletons(n) { const g = el('div', 'grid'); for (let k = 0; k < n; k++) { const f = el('div', 'card skel'); f.append(el('div', 'stage ld'), el('div', 'cap')); g.append(f); } return g; }
function renderFavs() {
  const box = $('#favgrid'); box.replaceChildren();
  const mine = state.items.filter(i => i.liked);
  if (!mine.length) { box.append(emptyBox('No favorites yet', 'Tap the heart on any decoration to keep it here.', ['Browse the gallery', () => tab('gal')])); return; }
  const g = el('div', 'grid'); for (const i of mine) g.append(makeCard(i)); box.append(g);
}
function render() {
  const counts = new Map();
  for (const i of state.items) counts.set(i.set, (counts.get(i.set) || 0) + 1);
  if (state.set !== 'All' && !counts.has(state.set)) state.set = 'All';
  const chips = $('#chips'); chips.replaceChildren();
  for (const name of ['All', ...counts.keys()]) {
    const b = el('button', 'chip' + (name === state.set ? ' on' : ''), name);
    if (name !== 'All') tint(b, name);
    b.append(el('b', '', name === 'All' ? state.items.length : counts.get(name)));
    b.onclick = () => { state.set = name; try { localStorage.setItem('set', name); } catch { /* ignore */ } render(); };
    chips.append(b);
  }
  const q = state.q.toLowerCase();
  const shown = state.items.filter(i => (state.set === 'All' || i.set === state.set) && (!q || (i.title + ' ' + i.set).toLowerCase().includes(q)));
  if (state.sort === 'loved') shown.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  else if (state.sort === 'az') shown.sort((a, b) => a.title.localeCompare(b.title));
  const grid = $('#grid'); grid.replaceChildren();
  if (!shown.length) grid.append(emptyBox(q ? 'No decorations match \u201c' + state.q + '\u201d' : 'Nothing in this set yet', q ? 'Try a shorter word, or clear the search.' : 'Pick another set above.', q ? ['Clear search', () => { state.q = ''; $('#q').value = ''; render(); }] : ['Show all sets', () => { state.set = 'All'; render(); }]));
  const groups = new Map();
  for (const i of shown) { if (!groups.has(i.set)) groups.set(i.set, []); groups.get(i.set).push(i); }
  if (state.set === 'All' && !q && state.sort === 'default') { // highlight rows above the sets
    const hot = state.trending.map(id => shown.find(i => i.id === id)).filter(Boolean);
    const fresh = shown.filter(i => i.fresh).slice(0, 8);
    const lead = new Map(); if (hot.length) lead.set('Trending', hot); if (fresh.length) lead.set('New', fresh);
    for (const [k, v] of groups) lead.set(k, v);
    groups.clear(); for (const [k, v] of lead) groups.set(k, v);
  }
  for (const [name, list] of groups) {
    if (state.set === 'All') { const h = tint(el('h2', 'set', name), name); h.append(el('span', '', list.length)); grid.append(h); }
    const foldable = state.set === 'All' && !q && list.length > 8, folded = foldable && !state.open.has(name);
    const g = el('div', 'grid');
    for (const i of folded ? list.slice(0, 8) : list) {
      const f = makeCard(i);
      g.append(f);
    }
    grid.append(g);
    if (foldable) { const more = el('button', 'btn ghost sm more', folded ? 'Show all ' + list.length : 'Show less'); more.onclick = () => { if (folded) state.open.add(name); else state.open.delete(name); render(); }; grid.append(more); }
  }
  $('#count').textContent = shown.length + ' of ' + state.items.length + ' shown';
  const st = $('#stats'); if (st) { st.replaceChildren(); for (const [n, w] of [[state.items.length, 'decorations'], [counts.size, 'sets']]) { const s = el('span'); s.append(el('b', '', n), ' ' + w); st.append(s); } st.hidden = !state.items.length; }
}
function cardKeys(f, open) {
  f.tabIndex = 0; f.setAttribute('role', 'button');
  f.onclick = open;
  f.onkeydown = e => { if (e.target === f && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } };
}
const shareHash = id => !id ? '' : (String(id).startsWith('sc-') ? '/gallery#showcase/' : '/d/') + encodeURIComponent(id);
function openFromHash() {
  let m = /^\/d\/([^/]+)$/.exec(location.pathname) || /^#d\/(.+)$/.exec(location.hash);
  if (m) { let id; try { id = decodeURIComponent(m[1]); } catch { return; } const it = state.items.find(x => x.id === id); if (it) openModal(it); return; }
  m = /^#showcase\/(.+)$/.exec(location.hash);
  if (m) {
    let id; try { id = decodeURIComponent(m[1]); } catch { return; }
    Promise.resolve(tab('show')).then(() => { const i = (state.showItems || []).find(x => x.id === id && x.status === 'approved'); if (i) openModal({ id: i.id, src: i.src, title: i.title, set: 'by ' + i.by.name }); });
  }
}
addEventListener('hashchange', openFromHash);
async function copyLink() {
  const b = $('#copy'), url = location.origin + b.dataset.hash;
  try { await navigator.clipboard.writeText(url); b.textContent = 'Link copied'; }
  catch { prompt('Copy this link:', url); b.textContent = 'Copy link'; return; }
  setTimeout(() => { b.textContent = 'Copy link'; }, 1800);
}
function openModal(i) {
  if (i.id) fetch('/api/view', { ...JSON_POST, body: JSON.stringify({ id: i.id }) }).catch(() => {}); // popularity count
  $('#mimg').src = i.src; $('#mimg').alt = i.title;
  $('#mtitle').textContent = i.title; $('#mset').textContent = i.set;
  const sheet = document.querySelector('#modal .sheet'); sheet.classList.remove('setc'); sheet.style.removeProperty('--h'); if (i.set && !String(i.set).startsWith('by ')) tint(sheet, i.set);
  modalItem = i; resetTryOn();
  const gal = state.items.some(x => x.id === i.id), sameSet = gal ? state.items.filter(x => x.set === i.set) : [];
  for (const id of ['#prev', '#next']) $(id).hidden = sameSet.length < 2;
  const rel = []; if (sameSet.length > 1) { const at = sameSet.findIndex(x => x.id === i.id); for (let k = 1; k < sameSet.length && rel.length < 6; k++) rel.push(sameSet[(at + k) % sameSet.length]); }
  const rg = $('#rgrid'); rg.replaceChildren(); $('#related').hidden = !rel.length; $('#rset').textContent = i.set;
  for (const r of rel) { const b = el('button', 'rel'); b.type = 'button'; b.title = r.title; tint(b, r.set); const im = el('img'); im.src = r.src; im.alt = r.title; im.loading = 'lazy'; b.append(el('div', 'av'), im); b.onclick = () => openModal(r); rg.append(b); }
  const cp = $('#copy'), sh = shareHash(i.id); cp.hidden = !sh; cp.dataset.hash = sh; cp.textContent = 'Copy link';
  if (sh) history.replaceState(null, '', sh);
  if ($('#modal').hidden) lastCard = document.activeElement; $('#modal').hidden = false; $('#close').focus();
}
let lastCard = null, modalItem = null;
const closeModal = () => { $('#modal').hidden = true; if (location.pathname.startsWith('/d/') || location.hash.startsWith('#d/')) history.replaceState(null, '', '/gallery' + location.search); else if (location.hash.startsWith('#showcase/')) history.replaceState(null, '', '#showcase'); if (lastCard && lastCard.focus) lastCard.focus(); };
$('#close').onclick = closeModal; $('#copy').onclick = copyLink;
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
// try it on: colour or your own picture, kept in this browser only
let tryUrl = null;
function setTry(bg) { const st = document.querySelector('#modal .stage'); st.style.setProperty('--photo-bg', bg); $('#tryreset').hidden = false; }
function resetTryOn() { const st = document.querySelector('#modal .stage'); st.style.removeProperty('--photo-bg'); $('#tryreset').hidden = true; $('#tryfile').value = ''; if (tryUrl) { URL.revokeObjectURL(tryUrl); tryUrl = null; } }
document.querySelectorAll('#tryon .sw button').forEach(b => { b.onclick = () => setTry(b.dataset.bg); });
$('#tryreset').onclick = resetTryOn;
$('#tryfile').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  if (!/^image\//.test(f.type) || f.size > 15 * 1048576) { alert('Please choose a picture under 15 MB.'); e.target.value = ''; return; }
  if (tryUrl) URL.revokeObjectURL(tryUrl); tryUrl = URL.createObjectURL(f); setTry('url("' + tryUrl + '") center/cover no-repeat');
};
// previous / next inside the same set
function step(dir) {
  if (!modalItem || $('#modal').hidden) return;
  const list = state.items.filter(x => x.set === modalItem.set); if (list.length < 2) return;
  const at = list.findIndex(x => x.id === modalItem.id); openModal(list[(at + dir + list.length) % list.length]);
}
$('#prev').onclick = () => step(-1); $('#next').onclick = () => step(1);
// surprise me
$('#rand').onclick = () => { const list = state.items.filter(i => (state.set === 'All' || i.set === state.set)); if (list.length) openModal(list[Math.floor(Math.random() * list.length)]); };
// keyboard: / searches, arrows browse the open preview
addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
  if (e.key === '/' && !typing && $('#modal').hidden && !$('#galwrap').hidden) { e.preventDefault(); $('#q').focus(); }
  else if (!$('#modal').hidden && !typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) step(e.key === 'ArrowLeft' ? -1 : 1);
});
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
$('#grid').replaceChildren(skeletons(12));
const boot = () => load().then(loadAccount).then(() => { if (state.items.length) render(); }).catch(() => {
  $('#grid').replaceChildren(emptyBox('Could not load the gallery', 'Check your connection. If the site was asleep, give it a few seconds.', ['Try again', () => { $('#grid').replaceChildren(skeletons(12)); boot(); }]));
});
boot();

// ---------- showcase ----------
// Name Banners and Profile Effects: whatever the admin uploaded, newest first. Nothing is shown until something is uploaded.
const DECO_TABS = { ban: { url: '/api/banners', box: '#banwrap', cols: 'minmax(260px, 1fr)' }, fx: { url: '/api/effects', box: '#fxwrap', cols: 'repeat(auto-fill, minmax(150px, 190px))' } };
async function loadDeco(which) {
  const c = DECO_TABS[which], box = $(c.box); let d;
  try { d = await (await fetch(c.url, { cache: 'no-cache' })).json(); } catch { return; }
  box.replaceChildren(); if (!d.items.length) return;
  const g = el('div'); g.style.cssText = 'display:grid;gap:14px;padding:6px 0 30px;grid-template-columns:' + (which === 'ban' ? 'repeat(auto-fill, ' + c.cols + ')' : c.cols);
  for (const i of d.items) {
    const f = el('figure', 'card'), im = el('img'); f.style.margin = '0'; im.src = i.src; im.alt = i.title; im.loading = 'lazy';
    im.style.cssText = 'display:block;width:100%;height:auto;border-radius:8px'; f.append(im, el('figcaption', '', i.title)); g.append(f);
  }
  box.append(g);
}
function tab(which) {
  const show = which === 'show', fav = which === 'fav', ban = which === 'ban', fx = which === 'fx';
  $('#galwrap').hidden = show || fav || ban || fx; $('#showwrap').hidden = !show; $('#favwrap').hidden = !fav; $('#banwrap').hidden = !ban; $('#fxwrap').hidden = !fx;
  $('#tab-gal').classList.toggle('on', which === 'gal' || !which); $('#tab-ban').classList.toggle('on', ban); $('#tab-fx').classList.toggle('on', fx); $('#tab-fav').classList.toggle('on', fav); $('#tab-show').classList.toggle('on', show);
  const base = location.pathname.startsWith('/d/') ? '/gallery' : location.pathname;
  history.replaceState(null, '', fx ? base + location.search + '#profile-effects' : ban ? base + location.search + '#name-banners' : show ? base + location.search + '#showcase' : fav ? base + location.search + '#favorites' : base + location.search);
  if (fav) renderFavs();
  if (ban) loadDeco('ban');
  if (fx) loadDeco('fx');
  if (show) return loadShowcase();
}
$('#tab-gal').onclick = () => tab('gal'); $('#tab-show').onclick = () => tab('show'); $('#tab-fav').onclick = () => tab('fav'); $('#tab-ban').onclick = () => tab('ban'); $('#tab-fx').onclick = () => tab('fx');
function byLine(by) {
  const d = el('div', 'by');
  if (by.avatar_url) { const im = el('img'); im.src = by.avatar_url; im.alt = ''; im.referrerPolicy = 'no-referrer'; d.append(im); } else d.append(el('div', 'ini', (by.name || '?').slice(0, 1).toUpperCase()));
  const who = el('span', '', 'by ');
  if (by.username) { const a = el('a', '', by.name); a.href = '/u/' + encodeURIComponent(by.username); a.style.color = 'inherit'; a.onclick = e => e.stopPropagation(); who.append(a); } else who.append(by.name);
  who.append(badgeSafe(by.badges)); d.append(who); return d;
}
async function loadShowcase() {
  if (!ME) { try { ME = await (await fetch('/api/me', { credentials: 'same-origin' })).json(); } catch { ME = {}; } }
  const d = await (await fetch('/api/showcase', { credentials: 'same-origin', cache: 'no-cache' })).json();
  state.showItems = d.items;
  const box = $('#shareBox'); box.replaceChildren();
  if (ME.user) { const b = el('button', 'btn', 'Share your work'); b.onclick = () => { $('#shareForm').hidden = !$('#shareForm').hidden; }; box.append(b); }
  else if (ME.login) { const a = el('a', 'btn', LOGIN); a.href = '/signin'; box.append(a); }
  const grid = $('#showgrid'); grid.replaceChildren();
  if (!d.items.length) { grid.append(emptyBox('Nothing shared yet', ME.user ? 'Be the first to share your pixel art.' : 'Log in with Yapin\u2019 to share the first one.', ME.user ? ['Share your work', () => { $('#shareForm').hidden = false; $('#sh-title').focus(); }] : (ME.login ? ['Log in', () => { location.href = '/signin'; }] : null))); return; }
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
    } else if (ME.user && i.status === 'approved') {
      const rp = el('button', 'linkbtn x2 report', 'Report'); rp.type = 'button'; rp.title = 'Tell the site owner something is wrong with this work';
      rp.onclick = async e => {
        e.stopPropagation(); if (!confirm('Report "' + i.title + '" to the site owner?')) return;
        try { const r = await fetch('/api/showcase/' + i.id + '/report', { ...JSON_POST }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Could not send');
          rp.textContent = 'Reported'; rp.disabled = true; if (j.hidden) loadShowcase(); } catch (err) { rp.textContent = err.message; }
      };
      f.append(rp);
    }
    cardKeys(f, () => openModal({ id: i.status === 'approved' ? i.id : null, src: i.src, title: i.title, set: 'by ' + i.by.name }));
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
if (location.hash === '#profile-effects') tab('fx');
else if (location.hash === '#name-banners') tab('ban');
else if (location.hash === '#showcase') tab('show');
else if (location.hash === '#favorites') { const w = setInterval(() => { if (ME) { clearInterval(w); if (ME.user) tab('fav'); } }, 200); setTimeout(() => clearInterval(w), 5000); }