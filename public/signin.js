'use strict';
const $ = s => document.querySelector(s);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
const LOGIN = 'Log in with Yapin\u2019';
const BADGE_NAMES = { owner: 'Owner', dev: 'Dev', staff: 'Staff' };

async function boot() {
  try { const s = await (await fetch('/api/items', { credentials: 'same-origin' })).json(); if (s.settings) { document.title = 'Log in \u00b7 ' + s.settings.title; const u = s.settings.supportUrl; if (u && u.startsWith('https://')) { const a = $('#s-support'); a.href = u; a.hidden = false; } } } catch { /* optional */ }

  const r = new URLSearchParams(location.search).get('login');
  if (r === 'failed' || r === 'cancelled') {
    const n = $('#s-note'); n.hidden = false; n.className = 'note ' + (r === 'failed' ? 'bad' : '');
    n.textContent = r === 'failed' ? 'Login did not work. Please try again.' : 'Login cancelled.';
  }

  let me; try { me = await (await fetch('/api/me', { credentials: 'same-origin' })).json(); } catch { me = null; }
  const body = $('#s-body'); body.replaceChildren();
  if (!me) { body.append(el('p', 'sigsub', 'Could not reach the site. Please refresh.')); return; }

  if (me.user) {
    $('#s-title').textContent = 'You are logged in';
    $('#s-sub').textContent = '';
    const card = el('div', 'sigme');
    if (me.user.avatar_url) { const im = el('img'); im.src = me.user.avatar_url; im.alt = ''; im.referrerPolicy = 'no-referrer'; card.append(im); }
    else card.append(el('div', 'ini', (me.user.display_name || me.user.username || '?').slice(0, 1).toUpperCase()));
    const w = el('div', 'who', me.user.display_name || me.user.username || 'You');
    for (const b of me.user.badges || []) if (BADGE_NAMES[b]) w.append(el('span', 'badge ' + b, BADGE_NAMES[b]));
    if (me.user.username) w.append(el('small', '', '@' + me.user.username));
    card.append(w); body.append(card);
    const go = el('a', 'btn', 'Go to the gallery'); go.href = '/';
    const out = el('button', 'btn ghost', 'Log out');
    out.onclick = async () => { await fetch('/api/user/logout', { method: 'POST', credentials: 'same-origin' }); location.href = '/signin'; };
    const row = el('div', 'sigrow'); row.append(go, out); body.append(row);
  } else if (me.login) {
    const a = el('a', 'btn big', LOGIN); a.href = '/login'; body.append(a);
    $('#s-facts').hidden = false;
  } else {
    body.append(el('p', 'sigsub', 'Login is not turned on for this site yet.'));
  }
}
boot();