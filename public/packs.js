'use strict';
// /pack/<id>  shows one server's recommended set.   /packs  lets a logged-in person make one.
const $ = s => document.querySelector(s);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const main = $('#pmain'), POST = { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } };
const get = async u => { const r = await fetch(u, { credentials: 'same-origin', cache: 'no-cache' }); return { ok: r.ok, d: await r.json().catch(() => ({})) }; };

function card(i) {
  const a = el('a', 'card'); a.href = '/d/' + encodeURIComponent(i.id); a.style.textDecoration = 'none';
  const st = el('div', 'stage'), im = el('img'); im.src = i.src; im.alt = i.title; im.loading = 'lazy';
  st.append(el('div', 'av'), im); a.append(st, el('figcaption', '', i.title)); return a;
}
async function view(id) {
  const { ok, d } = await get('/api/packs/' + id);
  if (!ok) { $('#ptitle').textContent = 'Pack not found'; main.append(el('p', 'empty', 'This link is not a pack, or it was removed.')); return; }
  $('#ptitle').textContent = d.server + ' recommends the ' + d.set + ' set';
  $('#psub').textContent = d.message || '';
  document.title = d.server + ' \u00b7 ' + d.set;
  const g = el('div', 'grid'); for (const i of d.items) g.append(card(i)); main.append(g);
}
async function manage() {
  $('#psub').textContent = 'Pick a set to recommend to the members of your server, and get a link to post there.';
  const [me, mine] = await Promise.all([get('/api/me'), get('/api/packs')]);
  if (!me.d.user) {
    const p = el('p', 'empty', me.d.login ? 'Log in with Yapin\u2019 to make a pack. ' : 'Logging in is not set up on this site yet.');
    if (me.d.login) { const a = el('a', 'btn', 'Log in'); a.href = '/signin'; p.append(a); }
    main.append(p); return;
  }
  const box = el('section', 'panel'), name = el('input'), sel = el('select'), msg = el('input'), go = el('button', 'btn', 'Make link'), out = el('p');
  name.type = 'text'; name.placeholder = 'Server name'; name.maxLength = 60; msg.type = 'text'; msg.placeholder = 'A short note (optional)'; msg.maxLength = 160; go.type = 'button';
  for (const s of mine.d.sets) sel.append(new Option(s, s));
  box.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:16px'; out.style.cssText = 'flex-basis:100%;margin:0';
  box.append(name, sel, msg, go, out);
  go.onclick = async () => {
    out.textContent = ''; const r = await fetch('/api/packs', { ...POST, body: JSON.stringify({ server: name.value, set: sel.value, message: msg.value }) }), d = await r.json().catch(() => ({}));
    if (!r.ok) { out.textContent = d.error || 'Something went wrong.'; return; }
    const link = location.origin + '/pack/' + d.id; out.textContent = 'Your link: ' + link + ' '; const c = el('button', 'btn ghost sm', 'Copy'); c.type = 'button';
    c.onclick = () => navigator.clipboard.writeText(link).then(() => { c.textContent = 'Copied'; }); out.append(c); list(d);
  };
  const ul = el('div'); ul.style.marginTop = '24px';
  function list(added) {
    if (added && !mine.d.mine.some(x => x.id === added.id)) mine.d.mine.unshift(added); else if (added) Object.assign(mine.d.mine.find(x => x.id === added.id), added);
    ul.replaceChildren(); if (mine.d.mine.length) ul.append(el('h2', '', 'Your packs'));
    for (const x of mine.d.mine) {
      const row = el('p'), a = el('a', '', x.server + ' \u2192 ' + x.set), del = el('button', 'btn ghost sm', 'Delete'); a.href = '/pack/' + x.id; del.type = 'button'; del.style.marginLeft = '10px';
      del.onclick = async () => { if (!confirm('Delete this pack?')) return; const r = await fetch('/api/packs/' + x.id, { method: 'DELETE', credentials: 'same-origin' }); if (r.ok) { mine.d.mine = mine.d.mine.filter(y => y.id !== x.id); list(); } };
      row.append(a, del); ul.append(row);
    }
  }
  list(); main.append(box, ul);
}
const m = /^\/pack\/([a-f0-9]{8})$/.exec(location.pathname);
(m ? view(m[1]) : manage()).catch(() => main.append(el('p', 'empty', 'Could not load. Try again in a moment.')));