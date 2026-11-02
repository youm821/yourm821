const $ = s => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const S = { items: [], sel: new Set() };

async function api(method, url, body) {
  const opt = { method, credentials: 'same-origin', headers: {} };
  if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  const r = await fetch(url, opt);
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/api/login') { showLogin(); throw new Error('Login required'); }
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}
const say = (id, text, kind) => { const m = $(id); m.textContent = text || ''; m.className = 'msg' + (kind ? ' ' + kind : ''); };

// ---------- partners ----------
async function form(method, url, fd) {
  const r = await fetch(url, { method, body: fd, credentials: 'same-origin' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Something went wrong');
  return d;
}
const kindSelect = v => { const s = el('select'); for (const [k, l] of [['server', 'Server'], ['creator', 'Creator'], ['partner', 'Partner']]) { const o = el('option', '', l); o.value = k; s.append(o); } s.value = v; return s; };
async function loadPartners() {
  const d = await api('GET', '/api/partners'); const box = $('#pt-list'); box.replaceChildren();
  if (!d.partners.length) box.append(el('div', 'empty', 'No partners yet.'));
  d.partners.forEach((p, idx) => {
    const c = el('div', 'ptcard');
    if (p.cover) { const im = el('img', 'thumb'); im.src = p.cover; im.alt = ''; c.append(im); } else c.append(el('div', 'thumb', 'No cover'));
    const r = el('div');
    const f = el('div', 'fields'); const name = el('input'); name.type = 'text'; name.value = p.name; name.maxLength = 60; const kind = kindSelect(p.kind); const url = el('input'); url.type = 'url'; url.value = p.url; url.placeholder = 'https://…'; url.maxLength = 300;
    f.append(name, kind, url);
    const f2 = el('div', 'fields'); const blurb = el('input'); blurb.type = 'text'; blurb.value = p.blurb; blurb.maxLength = 400; blurb.style.flex = '1'; f2.append(blurb);
    const msg = el('div', 'msg');
    const save = el('button', 'btn sm', 'Save'); save.onclick = async () => { try { await api('PUT', '/api/partners/' + p.id, { name: name.value, kind: kind.value, url: url.value, blurb: blurb.value }); msg.textContent = 'Saved.'; msg.className = 'msg ok'; } catch (e) { msg.textContent = e.message; msg.className = 'msg err'; } };
    f2.append(save);
    const works = el('div', 'ptw');
    for (const w of p.works) { const d1 = el('div'); const im = el('img'); im.src = w.src; im.alt = ''; const x = el('button', '', '\u00d7'); x.title = 'Remove'; x.onclick = async () => { await api('DELETE', '/api/partners/' + p.id + '/images/' + encodeURIComponent(w.file)); loadPartners(); }; d1.append(im, x); works.append(d1); }
    const row = el('div', 'fields');
    const cov = el('input'); cov.type = 'file'; cov.accept = 'image/gif,image/png,image/webp,image/jpeg';
    const wk = el('input'); wk.type = 'file'; wk.accept = cov.accept; wk.multiple = true;
    const up = el('button', 'btn ghost sm', 'Upload pictures'); up.onclick = async () => {
      const fd = new FormData(); if (cov.files[0]) fd.append('cover', cov.files[0]); for (const x of wk.files) fd.append('works', x);
      if ([...fd.keys()].length === 0) { msg.textContent = 'Choose a cover and/or work pictures first.'; msg.className = 'msg err'; return; }
      try { await form('POST', '/api/partners/' + p.id + '/images', fd); loadPartners(); } catch (e) { msg.textContent = e.message; msg.className = 'msg err'; }
    };
    const lc = el('label', '', 'Cover '); lc.style.color = 'var(--mute)'; lc.append(cov); const lw = el('label', '', 'Work '); lw.style.color = 'var(--mute)'; lw.append(wk);
    row.append(lc, lw, up);
    const ctl = el('div', 'fields'); ctl.style.marginTop = '8px';
    const mv = (dir, label) => { const b = el('button', 'btn ghost sm', label); b.onclick = async () => { await api('POST', '/api/partners/' + p.id + '/move', { dir }); loadPartners(); }; return b; };
    const del = el('button', 'btn danger sm', 'Delete'); del.onclick = async () => { if (!confirm('Delete ' + p.name + ' and its pictures?')) return; await api('DELETE', '/api/partners/' + p.id); loadPartners(); };
    ctl.append(mv(-1, 'Move up'), mv(1, 'Move down'), del);
    r.append(f, f2, works, row, ctl, msg); c.append(r); box.append(c);
  });
}
$('#pt-add').onclick = async () => {
  const fd = new FormData(); fd.append('name', $('#pt-name').value); fd.append('kind', $('#pt-kind').value); fd.append('url', $('#pt-url').value); fd.append('blurb', $('#pt-blurb').value);
  if ($('#pt-cover').files[0]) fd.append('cover', $('#pt-cover').files[0]);
  for (const x of [...$('#pt-works').files].slice(0, 4)) fd.append('works', x);
  try { await form('POST', '/api/partners', fd); say('#pt-msg', 'Added.', 'ok'); for (const id of ['#pt-name', '#pt-url', '#pt-blurb', '#pt-cover', '#pt-works']) $(id).value = ''; loadPartners(); }
  catch (e) { say('#pt-msg', e.message, 'err'); }
};
function showLogin() { $('#app').hidden = true; $('#login').hidden = false; $('#pw').focus(); }
// ---- backup status strip + tabs ----
async function loadStrip() {
  const s = $('#strip');
  try {
    const d = await api('GET', '/api/sync');
    if (!d.on) { s.className = 'strip bad'; s.textContent = 'Cloud backup is OFF. Uploads can be lost if the server restarts. Set GITHUB_TOKEN and GITHUB_REPO in Render.'; }
    else if (d.error) { s.className = 'strip bad'; s.textContent = 'Cloud backup problem: ' + d.error; }
    else { s.className = 'strip ok'; s.textContent = 'Cloud backup is on' + (d.repo ? ' (' + d.repo + ')' : '') + (d.last ? ' \u00b7 last saved ' + new Date(d.last).toLocaleString() : ''); }
  } catch { s.className = 'strip'; s.textContent = 'Could not check the cloud backup.'; }
}
const TAB_NAMES = ['Site & partners', 'Gallery', 'Accounts', 'Backup'];
function tabOf(title) { const t = title.toLowerCase(); if (/^site|^partners/.test(t)) return 'Site & partners'; if (/account/.test(t)) return 'Accounts'; if (/awake|cloud|download/.test(t)) return 'Backup'; return 'Gallery'; }
function setupTabs() {
  const nav = $('#atabs'); const panels = [...document.querySelectorAll('#app > section.panel')];
  let cur = 'Site & partners'; try { cur = localStorage.getItem('atab') || cur; } catch { /* ignore */ }
  const show = name => {
    cur = name; try { localStorage.setItem('atab', name); } catch { /* ignore */ }
    for (const p of panels) p.hidden = tabOf((p.querySelector('h3') || {}).textContent || '') !== name;
    nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.textContent === name));
  };
  nav.replaceChildren(); for (const n of TAB_NAMES) { const b = el('button', '', n); b.onclick = () => show(n); nav.append(b); }
  show(TAB_NAMES.includes(cur) ? cur : TAB_NAMES[0]);
}
async function boot() {
  const me = await (await fetch('/api/me', { credentials: 'same-origin' })).json();
  $('#ylogin').hidden = !me.login;
  if (!me.admin) { showLogin(); if (!me.configured) say('#lmsg', 'ADMIN_PASSWORD is not set on the server yet.', 'err'); return; }
  $('#login').hidden = true; $('#app').hidden = false;
  await refresh();
  setupTabs(); loadStrip(); setInterval(loadStrip, 20000);
  loadSync(); setInterval(loadSync, 15000); loadPhotos(); loadPartners(); loadUsers().catch(e => { console.error(e); $('#users').replaceChildren(el('div', 'empty', 'Could not load accounts: ' + e.message)); }); loadShowcase(); loadPopular().catch(e => console.error(e)); loadUptime(); setInterval(loadUptime, 20000);
}
async function loadSync() {
  try {
    const d = await api('GET', '/api/sync'); const box = $('#c-status');
    if (!d.on) { box.textContent = 'Off. Your uploads live only on this server. See the README to switch on the GitHub backup (free).'; $('#c-now').hidden = true; return; }
    $('#c-now').hidden = false;
    const when = d.last ? new Date(d.last).toLocaleString() : 'not yet';
    box.textContent = (d.error ? 'Problem: ' + d.error : 'On, saving to ' + d.repo + ' (' + d.branch + ').') + (d.pending ? ' Saving…' : ' Last saved: ' + when + '.');
    box.style.color = d.error ? '#ff7b86' : 'var(--mute)';
  } catch { /* logged out */ }
}
$('#c-now').onclick = async () => { try { await api('POST', '/api/sync', {}); say('#c-msg', 'Started. This can take a minute if you have many uploads.', 'ok'); setTimeout(loadSync, 2000); } catch (e) { say('#c-msg', e.message, 'err'); } };
async function login() {
  try { await api('POST', '/api/login', { password: $('#pw').value }); $('#pw').value = ''; say('#lmsg', ''); boot(); }
  catch (e) { say('#lmsg', e.message, 'err'); }
}
$('#go').onclick = login;
$('#pw').onkeydown = e => { if (e.key === 'Enter') login(); };
$('#logout').onclick = async () => { await api('POST', '/api/logout', {}).catch(() => {}); showLogin(); };

async function refresh() {
  const d = await api('GET', '/api/admin/items');
  S.items = d.items;
  bannerInit(d.settings); $('#s-auto').checked = !!d.settings.showcaseAuto; $('#s-title').value = d.settings.title; $('#s-sub').value = d.settings.subtitle || ''; $('#s-support').value = d.settings.supportUrl || '';
  const sets = [...new Set(S.items.map(i => i.set))];
  $('#sets').replaceChildren(...sets.map(s => { const o = el('option'); o.value = s; return o; }));
  const cur = $('#f-set').value;
  $('#f-set').replaceChildren(...['All sets', ...sets].map(s => { const o = el('option', '', s); o.value = s === 'All sets' ? '' : s; return o; }));
  $('#f-set').value = sets.includes(cur) ? cur : '';
  const ids = new Set(S.items.map(i => i.id)); S.sel = new Set([...S.sel].filter(x => ids.has(x)));
  draw();
}
function shown() {
  const q = $('#f-q').value.toLowerCase(), s = $('#f-set').value;
  return S.items.filter(i => (!s || i.set === s) && (!q || (i.title + ' ' + i.set).toLowerCase().includes(q)));
}
function draw() {
  const list = shown(), g = $('#agrid'); g.replaceChildren();
  $('#n').textContent = `(${S.items.length})`;
  $('#selcount').textContent = S.sel.size ? S.sel.size + ' selected' : '';
  for (const i of list) {
    const c = el('div', 'acard' + (S.sel.has(i.id) ? ' sel' : '') + (i.hidden ? ' hid' : ''));
    const st = el('div', 'stage'); st.append(el('div', 'av')); const img = el('img'); img.src = i.src; img.alt = ''; img.loading = 'lazy'; st.append(img);
    const top = el('div', 'r'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = S.sel.has(i.id);
    cb.onchange = () => { cb.checked ? S.sel.add(i.id) : S.sel.delete(i.id); c.classList.toggle('sel', cb.checked); $('#selcount').textContent = S.sel.size ? S.sel.size + ' selected' : ''; };
    top.append(cb, el('span', '', i.hidden ? 'hidden' : ''));
    const t = el('input'); t.type = 'text'; t.value = i.title; t.maxLength = 80;
    const s = el('input'); s.type = 'text'; s.value = i.set; s.maxLength = 40; s.setAttribute('list', 'sets');
    const save = async (field, input) => {
      if (input.value.trim() === i[field] || !input.value.trim()) { input.value = i[field]; return; }
      try { const u = await api('PATCH', '/api/items/' + i.id, { [field]: input.value }); Object.assign(i, u); if (field === 'set') refresh(); }
      catch (e) { say('#a-msg', e.message, 'err'); }
    };
    t.onchange = () => save('title', t); s.onchange = () => save('set', s);
    const row = el('div', 'r');
    const hide = el('button', 'btn ghost sm', i.hidden ? 'Show' : 'Hide');
    hide.onclick = async () => { const u = await api('PATCH', '/api/items/' + i.id, { hidden: !i.hidden }); Object.assign(i, u); draw(); };
    const del = el('button', 'btn danger sm', 'Delete');
    del.onclick = async () => { if (!confirm('Delete "' + i.title + '"?')) return; await api('DELETE', '/api/items/' + i.id); refresh(); };
    row.append(hide, del);
    c.append(st, top, t, s, row); g.append(c);
  }
  if (!list.length) g.append(el('div', 'empty', 'Nothing matches.'));
}
$('#f-q').oninput = draw; $('#f-set').onchange = draw;
$('#selall').onclick = () => { shown().forEach(i => S.sel.add(i.id)); draw(); };
$('#selnone').onclick = () => { S.sel.clear(); draw(); };

async function bulk(action, extra = {}) {
  if (!S.sel.size) return say('#a-msg', 'Select some items first.', 'err');
  if (action === 'delete' && !confirm('Delete ' + S.sel.size + ' items for good?')) return;
  try { const r = await api('POST', '/api/bulk', { ids: [...S.sel], action, ...extra }); say('#a-msg', r.count + ' updated.', 'ok'); if (action === 'delete') S.sel.clear(); await refresh(); }
  catch (e) { say('#a-msg', e.message, 'err'); }
}
$('#b-move').onclick = () => bulk('move', { set: $('#b-set').value });
$('#b-hide').onclick = () => bulk('hide'); $('#b-show').onclick = () => bulk('show'); $('#b-del').onclick = () => bulk('delete');

let bannerFile = '';
function bannerPreview() { applyBanner($('#s-bprev'), { bannerStyle: $('#s-bstyle').value, bannerText: $('#s-btext').value, bannerFile }); }
function bannerInit(s) {
  const sel = $('#s-bstyle'); if (!sel.options.length) for (const [k, l] of [['none', 'No banner'], ...Object.entries(BANNER_STYLES), ['custom', 'My own image']]) { const o = el('option', '', l); o.value = k; sel.append(o); }
  sel.value = s.bannerStyle || 'none'; $('#s-btext').value = s.bannerText || ''; bannerFile = s.bannerFile || ''; bannerPreview();
  sel.onchange = bannerPreview; $('#s-btext').oninput = bannerPreview;
}
$('#s-bup').onclick = async () => {
  const f = $('#s-bfile').files[0]; if (!f) { say('#s-msg', 'Choose a banner image first.', 'err'); return; }
  const fd = new FormData(); fd.append('image', f);
  try { const d = await form('POST', '/api/banner/image', fd); bannerFile = d.bannerFile; $('#s-bstyle').value = 'custom'; $('#s-bfile').value = ''; bannerPreview(); say('#s-msg', 'Banner image uploaded.', 'ok'); } catch (e) { say('#s-msg', e.message, 'err'); }
};
$('#s-bdel').onclick = async () => { try { await api('DELETE', '/api/banner/image'); bannerFile = ''; if ($('#s-bstyle').value === 'custom') $('#s-bstyle').value = 'none'; bannerPreview(); say('#s-msg', 'Image removed.', 'ok'); } catch (e) { say('#s-msg', e.message, 'err'); } };
$('#s-save').onclick = async () => {
  try { await api('PUT', '/api/settings', { title: $('#s-title').value, subtitle: $('#s-sub').value, showcaseAuto: $('#s-auto').checked, supportUrl: $('#s-support').value, bannerStyle: $('#s-bstyle').value, bannerText: $('#s-btext').value }); say('#s-msg', 'Saved.', 'ok'); }
  catch (e) { say('#s-msg', e.message, 'err'); }
};

async function upload(files) {
  files = [...files]; if (!files.length) return say('#u-msg', 'Choose files first.', 'err');
  const fd = new FormData(); fd.append('set', $('#u-set').value || 'Uploads');
  for (const f of files) fd.append('files', f);
  say('#u-msg', 'Uploading ' + files.length + '…');
  try {
    const r = await fetch('/api/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) return showLogin();
    if (!r.ok) throw new Error(d.error || 'Upload failed');
    say('#u-msg', d.added.length + ' added' + (d.rejected.length ? '. Skipped: ' + d.rejected.join(', ') : '.'), d.added.length ? 'ok' : 'err');
    $('#u-files').value = ''; await refresh();
  } catch (e) { say('#u-msg', e.message, 'err'); }
}
$('#u-go').onclick = () => upload($('#u-files').files);
const drop = $('#drop');
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => upload(e.dataTransfer.files));
boot();

// ---------- profile photos ----------
async function loadPhotos() {
  const d = await api('GET', '/api/admin/photos');
  const box = $('#photos'); box.replaceChildren();
  const active = d.photos.find(p => p.active);
  if (active) document.documentElement.style.setProperty('--photo-bg', `url("${active.src}") center/cover no-repeat`);
  else document.documentElement.style.removeProperty('--photo-bg');
  if (!d.photos.length) box.append(el('div', 'empty', 'No photo yet. Add one below.'));
  for (const p of d.photos) {
    const w = el('div', 'ph' + (p.active ? ' on' : '')); const im = el('img'); im.src = p.src; im.alt = '';
    const row = el('div', 'row');
    if (!p.active) { const use = el('button', 'btn ghost sm', 'Use'); use.onclick = async () => { await api('PATCH', '/api/photos/' + p.id, {}); loadPhotos(); }; row.append(use); }
    const del = el('button', 'btn danger sm', 'Delete'); del.onclick = async () => { if (!confirm('Delete this photo?')) return; await api('DELETE', '/api/photos/' + p.id); loadPhotos(); };
    row.append(del); w.append(im, p.active ? el('div', '', 'showing') : el('div', ''), row); box.append(w);
  }
}
function cropFile(file) {
  return new Promise(resolve => {
    const V = 300, modal = $('#crop'), img = $('#cimg'), zoom = $('#czoom'), view = $('#cview');
    const url = URL.createObjectURL(file); let nw = 1, nh = 1, s0 = 1, z = 1, x = 0, y = 0, drag = null;
    const clamp = () => { const w = nw * s0 * z, h = nh * s0 * z; x = Math.min(0, Math.max(V - w, x)); y = Math.min(0, Math.max(V - h, y)); };
    const paint = () => { clamp(); img.style.transform = `translate(${x}px,${y}px) scale(${s0 * z})`; };
    const done = blob => { modal.hidden = true; URL.revokeObjectURL(url); view.onpointerdown = view.onpointermove = view.onpointerup = null; $('#cok').onclick = $('#ccancel').onclick = zoom.oninput = null; resolve(blob); };
    img.onload = () => {
      nw = img.naturalWidth; nh = img.naturalHeight; s0 = Math.max(V / nw, V / nh); z = 1; zoom.value = 1;
      x = (V - nw * s0) / 2; y = (V - nh * s0) / 2; paint(); modal.hidden = false;
    };
    img.onerror = () => done(null);
    img.src = url;
    zoom.oninput = () => { const cx = (V / 2 - x) / (nw * s0 * z), cy = (V / 2 - y) / (nh * s0 * z); z = Number(zoom.value); x = V / 2 - cx * nw * s0 * z; y = V / 2 - cy * nh * s0 * z; paint(); };
    view.onpointerdown = e => { drag = { px: e.clientX, py: e.clientY, x, y }; view.setPointerCapture(e.pointerId); };
    view.onpointermove = e => { if (!drag) return; x = drag.x + e.clientX - drag.px; y = drag.y + e.clientY - drag.py; paint(); };
    view.onpointerup = () => { drag = null; };
    $('#ccancel').onclick = () => done(null);
    $('#cok').onclick = () => {
      const k = s0 * z, c = document.createElement('canvas'); c.width = c.height = 512;
      c.getContext('2d').drawImage(img, -x / k, -y / k, V / k, V / k, 0, 0, 512, 512);
      c.toBlob(b => done(b), 'image/png');
    };
  });
}
$('#p-file').onchange = async e => {
  const files = [...e.target.files]; e.target.value = '';
  let ok = 0;
  for (const f of files) {
    const blob = await cropFile(f); if (!blob) continue;
    const fd = new FormData(); fd.append('files', blob, 'photo.png');
    try {
      const r = await fetch('/api/photos', { method: 'POST', body: fd, credentials: 'same-origin' });
      const d = await r.json().catch(() => ({})); if (r.status === 401) return showLogin(); if (!r.ok) throw new Error(d.error || 'Upload failed'); ok++;
    } catch (err) { say('#p-msg', err.message, 'err'); return; }
  }
  if (ok) say('#p-msg', ok + ' added. The newest one is now showing on the site.', 'ok');
  loadPhotos();
};

// ---------- accounts (people who logged in with Yapin') ----------
let USERS = null;
async function loadUsers() { USERS = await api('GET', '/api/admin/users'); drawUsers(); }
function drawUsers() {
  const d = USERS; if (!d) return;
  const box = $('#users'); box.replaceChildren();
  $('#u-n').textContent = '(' + d.users.length + ')';
  $('#u-info').textContent = d.login ? 'Login with Yapin\u2019 is on. Everyone who logged in appears here.' : 'Login with Yapin\u2019 is off. Set YAPPER_CLIENT_ID and YAPPER_CLIENT_SECRET on the server (see the README).';
  const info = $('#u-info');
  info.append(el('br'), 'Redirect URL to register in Yapin\u2019 (must match exactly): ', el('b', '', d.redirectUrl));
  info.append(el('br'), 'Client ID: ' + (d.hasId ? 'set' : 'MISSING') + ' \u00b7 Client secret: ' + (d.hasSecret ? 'set' : 'MISSING') + ' \u00b7 Yapin\u2019 address: ' + d.yapin);
  if (typeof badgeRow !== 'function') info.append(el('br'), el('b', '', 'Badge icons are not loading: upload public/badges.js to your site and redeploy.'));
  if (d.lastError) info.append(el('br'), el('b', '', 'Last login problem' + (d.lastErrorAt ? ' (' + new Date(d.lastErrorAt).toLocaleString() + ')' : '') + ': '), d.lastError);

  // owner tool: OG badge for the first accounts
  const og = $('#u-og'); og.replaceChildren(); og.hidden = !d.owner;
  if (d.owner) {
    const n = el('input'); n.type = 'number'; n.min = 1; n.max = 500; n.value = 10; n.style.width = '80px';
    const go = el('button', 'btn ghost sm', 'Give the OG badge to the first accounts');
    go.onclick = async () => {
      const c = Math.max(1, Math.min(500, Number(n.value) || 0));
      if (!confirm('Give the OG badge to the first ' + c + ' accounts that ever logged in?')) return;
      try { const r = await api('POST', '/api/admin/users/grant-og', { count: c }); alert('Done. ' + r.given + ' accounts now have the OG badge.'); loadUsers(); } catch (e) { alert(e.message); }
    };
    og.append(n, go);
  }

  const q = (($('#u-q') || {}).value || '').trim().toLowerCase(), sort = ($('#u-sort') || {}).value || 'recent';
  const nm = u => String(u.display_name || u.username || u.id || '').toLowerCase();
  const sorts = {
    recent: (a, b) => (b.lastLogin || 0) - (a.lastLogin || 0), newest: (a, b) => (b.firstSeen || 0) - (a.firstSeen || 0),
    oldest: (a, b) => (a.firstSeen || 0) - (b.firstSeen || 0), name: (a, b) => nm(a).localeCompare(nm(b)),
    admins: (a, b) => (b.admin ? 1 : 0) - (a.admin ? 1 : 0) || nm(a).localeCompare(nm(b))
  };
  const list = d.users.filter(u => !q || [u.display_name, u.username, u.id].join(' ').toLowerCase().includes(q)).sort(sorts[sort] || sorts.recent);
  if (!list.length) box.append(el('div', 'empty', d.users.length ? 'No accounts match your search.' : 'Nobody has logged in yet.'));
  for (const u of list) { try {
    const name = String(u.display_name || u.username || u.id || 'Someone'); const c = el('div', 'u');
    if (u.banned) c.style.opacity = '.6';
    if (u.avatar_url) { const im = el('img'); im.src = u.avatar_url; im.alt = ''; im.referrerPolicy = 'no-referrer'; c.append(im); } else c.append(el('div', 'ini', name.slice(0, 1).toUpperCase()));
    const t = el('div', 't'); t.append(el('b', '', name), (typeof badgeRow === 'function' ? badgeRow(u.badges) : el('span')), el('span', '', (u.username ? '@' + u.username + ' \u00b7 ' : '') + (u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : ''))); c.append(t);
    if (u.admin || u.banned) t.append(el('span', '', (u.admin ? 'admin' : '') + (u.admin && u.banned ? ' \u00b7 ' : '') + (u.banned ? 'banned' : '')));
    const rm = el('button', 'btn danger sm', 'Remove'); rm.title = 'Deletes the account record. They can log in again.';
    rm.onclick = async () => { if (!confirm('Remove ' + name + '? They can log in again.')) return; await api('DELETE', '/api/users/' + encodeURIComponent(u.id)); loadUsers(); };
    const bn = el('button', 'btn ghost sm', u.banned ? 'Unban' : 'Ban'); bn.title = u.banned ? 'Let them log in again' : 'Blocks login and hides their showcase work';
    bn.onclick = async () => {
      if (!confirm((u.banned ? 'Unban ' : 'Ban ') + name + '?' + (u.banned ? '' : ' They will not be able to log in and their showcase work is hidden.'))) return;
      try { await api('PUT', '/api/admin/users/' + encodeURIComponent(u.id) + '/ban', { banned: !u.banned }); loadUsers(); } catch (e) { alert(e.message); }
    };
    if (d.owner) {
      const ad = el('button', 'btn ghost sm', u.admin ? 'Remove admin' : 'Make admin');
      ad.onclick = async () => { if (!confirm((u.admin ? 'Remove admin from ' : 'Give admin to ') + name + '?' + (u.admin ? '' : ' They will be able to change everything on the site except adding other admins.'))) return; await api('PUT', '/api/admin/users/' + encodeURIComponent(u.id) + '/admin', { admin: !u.admin }); loadUsers(); };
      c.append(ad);
    }
    c.append(bn, rm);
    if (d.owner) {
      const tg = el('div', 'bdgpick');
      for (const [key, label] of Object.entries(d.badgeList || {})) {
        const has = (u.badges || []).includes(key);
        const bb = el('button', 'bdgbtn' + (has ? ' on' : '')); bb.title = (has ? 'Remove ' : 'Give ') + label + ' badge' + (typeof BADGE_DESC !== 'undefined' && BADGE_DESC[key] ? ' (' + BADGE_DESC[key] + ')' : '');
        bb.style.setProperty('--bc', ((typeof BADGE_DEFS !== 'undefined' && BADGE_DEFS[key]) || {}).color || '#888');
        const ic = typeof badgeIcon === 'function' ? badgeIcon(key, 16) : null; if (ic) bb.append(ic); else bb.textContent = label;
        bb.onclick = async () => { const next = has ? u.badges.filter(x => x !== key) : [...(u.badges || []), key]; try { await api('PUT', '/api/admin/users/' + encodeURIComponent(u.id) + '/badges', { badges: next }); loadUsers(); } catch (e) { alert(e.message); } };
        tg.append(bb);
      }
      c.append(tg);
    }
    box.append(c);
  } catch (e) { console.error(e); box.append(el('div', 'empty', 'Could not show account ' + ((u && u.id) || '?') + ': ' + e.message)); } }
}
if ($('#u-q')) { $('#u-q').oninput = drawUsers; $('#u-sort').onchange = drawUsers; }

// ---------- popular (views + likes) ----------
async function loadPopular() {
  const d = await api('GET', '/api/admin/popular'), box = $('#pop'); box.replaceChildren();
  if (!d.byViews.length && !d.byLikes.length) { box.append(el('div', 'empty', 'Nothing yet. Counts start when people open or like decorations.')); return; }
  for (const [title, list, key] of [['Most viewed', d.byViews, 'views'], ['Most loved', d.byLikes, 'likes']]) {
    if (!list.length) continue;
    const h = el('h4', '', title); h.style.margin = '14px 0 8px'; box.append(h);
    const max = Math.max(...list.map(i => i[key])), g = el('div', 'bars');
    for (const i of list) {
      const row = el('div', 'brow'); const im = el('img'); im.src = i.src; im.alt = ''; row.append(im);
      const mid = el('div', 'bmid'); mid.append(el('b', '', i.title), el('small', '', i.set));
      const track = el('div', 'btrack'), fill = el('div', 'bfill ' + key); fill.style.width = Math.max(4, Math.round(i[key] / max * 100)) + '%'; track.append(fill); mid.append(track);
      row.append(mid, el('span', 'bnum', String(i[key]))); g.append(row);
    }
    box.append(g);
  }
}

// ---------- showcase review ----------
async function loadShowcase() {
  const d = await api('GET', '/api/admin/showcase'); const box = $('#sc-list'); box.replaceChildren();
  $('#sc-n').textContent = '(' + d.items.length + ')';
  if (!d.items.length) box.append(el('div', 'empty', 'Nothing submitted yet.'));
  for (const i of [...d.items].sort((a, b) => (b.reports || 0) - (a.reports || 0))) {
    const c = el('div', 'u'); const im = el('img'); im.src = i.src; im.alt = ''; im.style.borderRadius = '8px'; c.append(im);
    const t = el('div', 't'); t.append(el('b', '', i.title), el('span', '', 'by ' + i.by.name)); c.append(t);
    c.append(el('span', 'status ' + (i.status === 'approved' ? 'ok' : 'wait'), i.status === 'approved' ? 'live' : 'waiting'));
    if (i.reports) { const fl = el('span', 'status bad', i.reports + (i.reports === 1 ? ' report' : ' reports')); c.append(fl); const ok = el('button', 'btn ghost sm', 'Dismiss'); ok.title = 'Clear the reports and keep it as is'; ok.onclick = async () => { await api('PATCH', '/api/admin/showcase/' + i.id, { clearReports: true }); loadShowcase(); }; c.append(ok); }
    const tog = el('button', 'btn ghost sm', i.status === 'approved' ? 'Hide' : 'Approve');
    tog.onclick = async () => { await api('PATCH', '/api/admin/showcase/' + i.id, { status: i.status === 'approved' ? 'pending' : 'approved' }); loadShowcase(); };
    const rm = el('button', 'btn danger sm', 'Delete'); rm.onclick = async () => { if (!confirm('Delete "' + i.title + '"?')) return; await api('DELETE', '/api/admin/showcase/' + i.id); loadShowcase(); };
    c.append(tog, rm); box.append(c);
  }
}
// ---------- uptime ----------
const dur = s => { const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return (d ? d + 'd ' : '') + (h ? h + 'h ' : '') + m + 'm'; };
async function loadUptime() {
  try {
    const d = await api('GET', '/api/status'), box = $('#up'); box.replaceChildren();
    const stat = (l, v) => { const s = el('div', 'stat'); s.append(el('small', '', l), el('b', '', v)); box.append(s); };
    stat('Running for', dur(d.uptime));
    stat('Self-check', d.keep.on ? (d.keep.ok === null ? 'starting…' : d.keep.ok ? 'working' : 'failing') : 'off');
    stat('Last self-check', d.keep.last ? new Date(d.keep.last).toLocaleTimeString() : 'not yet');
    stat('Checks so far', String(d.keep.count));
    $('#up-note').textContent = d.keep.on
      ? 'The site visits itself every ' + d.keep.everyMin + ' minutes so Render does not put it to sleep.' + (d.keep.error ? ' Problem: ' + d.keep.error : '')
      : 'Self-check is off (no site address known). Set PUBLIC_URL to your site address to turn it on.';
  } catch { /* logged out */ }
}
