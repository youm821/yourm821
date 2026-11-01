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

function badgeRow(list) { const r = el('span', 'badges'); for (const b of list || []) r.append(el('span', 'badge ' + b, b.charAt(0).toUpperCase() + b.slice(1))); return r; }
function showLogin() { $('#app').hidden = true; $('#login').hidden = false; $('#pw').focus(); }
async function boot() {
  const me = await (await fetch('/api/me', { credentials: 'same-origin' })).json();
  $('#ylogin').hidden = !me.login;
  if (!me.admin) { showLogin(); if (!me.configured) say('#lmsg', 'ADMIN_PASSWORD is not set on the server yet.', 'err'); return; }
  $('#login').hidden = true; $('#app').hidden = false;
  await refresh();
  loadSync(); setInterval(loadSync, 15000); loadPhotos(); loadUsers(); loadShowcase(); loadUptime(); setInterval(loadUptime, 20000);
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
  $('#s-auto').checked = !!d.settings.showcaseAuto; $('#s-title').value = d.settings.title; $('#s-sub').value = d.settings.subtitle || ''; $('#s-support').value = d.settings.supportUrl || '';
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

$('#s-save').onclick = async () => {
  try { await api('PUT', '/api/settings', { title: $('#s-title').value, subtitle: $('#s-sub').value, showcaseAuto: $('#s-auto').checked, supportUrl: $('#s-support').value }); say('#s-msg', 'Saved.', 'ok'); }
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
async function loadUsers() {
  const d = await api('GET', '/api/admin/users'); const box = $('#users'); box.replaceChildren();
  $('#u-n').textContent = '(' + d.users.length + ')';
  $('#u-info').textContent = d.login ? 'Login with Yapin\u2019 is on. Everyone who logged in appears here.' : 'Login with Yapin\u2019 is off. Set YAPPER_CLIENT_ID and YAPPER_CLIENT_SECRET on the server (see the README).';
  const info = $('#u-info');
  info.append(el('br'), 'Redirect URL to register in Yapin\u2019 (must match exactly): ', el('b', '', d.redirectUrl));
  info.append(el('br'), 'Client ID: ' + (d.hasId ? 'set' : 'MISSING') + ' \u00b7 Client secret: ' + (d.hasSecret ? 'set' : 'MISSING') + ' \u00b7 Yapin\u2019 address: ' + d.yapin);
  if (d.lastError) info.append(el('br'), el('b', '', 'Last login problem' + (d.lastErrorAt ? ' (' + new Date(d.lastErrorAt).toLocaleString() + ')' : '') + ': '), d.lastError);
  if (!d.users.length) box.append(el('div', 'empty', 'Nobody has logged in yet.'));
  for (const u of d.users) {
    const c = el('div', 'u'); const name = u.display_name || u.username || u.id;
    if (u.avatar_url) { const im = el('img'); im.src = u.avatar_url; im.alt = ''; im.referrerPolicy = 'no-referrer'; c.append(im); } else c.append(el('div', 'ini', name.slice(0, 1).toUpperCase()));
    const t = el('div', 't'); t.append(el('b', '', name), badgeRow(u.badges), el('span', '', (u.username ? '@' + u.username + ' · ' : '') + (u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : ''))); c.append(t);
    const rm = el('button', 'btn danger sm', 'Remove'); rm.onclick = async () => { if (!confirm('Remove ' + name + '? They can log in again.')) return; await api('DELETE', '/api/users/' + encodeURIComponent(u.id)); loadUsers(); };
    if (d.owner) {
      const ad = el('button', 'btn ghost sm', u.admin ? 'Remove admin' : 'Make admin');
      ad.onclick = async () => { if (!confirm((u.admin ? 'Remove admin from ' : 'Give admin to ') + name + '?' + (u.admin ? '' : ' They will be able to change everything on the site except adding other admins.'))) return; await api('PUT', '/api/admin/users/' + encodeURIComponent(u.id) + '/admin', { admin: !u.admin }); loadUsers(); };
      c.append(ad);
    }
    if (d.owner) for (const [key, label] of Object.entries(d.badgeList || {})) {
      const has = (u.badges || []).includes(key);
      const bb = el('button', 'btn ghost sm', (has ? 'Remove ' : 'Give ') + label + ' badge');
      bb.onclick = async () => { const next = has ? u.badges.filter(x => x !== key) : [...(u.badges || []), key]; try { await api('PUT', '/api/admin/users/' + encodeURIComponent(u.id) + '/badges', { badges: next }); loadUsers(); } catch (e) { alert(e.message); } };
      c.append(bb);
    }
    if (u.admin) t.append(el('span', '', ' \u00b7 admin'));
    c.append(rm); box.append(c);
  }
}

// ---------- showcase review ----------
async function loadShowcase() {
  const d = await api('GET', '/api/admin/showcase'); const box = $('#sc-list'); box.replaceChildren();
  $('#sc-n').textContent = '(' + d.items.length + ')';
  if (!d.items.length) box.append(el('div', 'empty', 'Nothing submitted yet.'));
  for (const i of d.items) {
    const c = el('div', 'u'); const im = el('img'); im.src = i.src; im.alt = ''; im.style.borderRadius = '8px'; c.append(im);
    const t = el('div', 't'); t.append(el('b', '', i.title), el('span', '', 'by ' + i.by.name)); c.append(t);
    c.append(el('span', 'status ' + (i.status === 'approved' ? 'ok' : 'wait'), i.status === 'approved' ? 'live' : 'waiting'));
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