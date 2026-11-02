'use strict';
// /u/<username>: a person's public profile and their approved showcase works.
const $ = s => document.querySelector(s);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const main = $('#pmain');
function work(w) {
  const a = el('a', 'card'); a.href = '/gallery#showcase/' + encodeURIComponent(w.id); a.style.textDecoration = 'none';
  const st = el('div', 'stage'), im = el('img'); im.src = w.src; im.alt = w.title; im.loading = 'lazy'; st.append(el('div', 'av'), im);
  a.append(st, el('figcaption', '', w.status === 'approved' ? w.title : w.title + ' (waiting for review)'));
  if (w.likes) { const l = el('span', 'like on', '\u2665 ' + w.likes); l.style.pointerEvents = 'none'; l.style.opacity = '1'; a.append(l); }
  return a;
}
(async () => {
  const handle = decodeURIComponent(location.pathname.split('/')[2] || '');
  const r = await fetch('/api/profile/' + encodeURIComponent(handle), { credentials: 'same-origin', cache: 'no-cache' });
  if (!r.ok) { $('#pname').textContent = 'Profile not found'; main.append(el('p', 'empty', 'There is no one with that name here.')); return; }
  const d = await r.json();
  $('#pname').textContent = d.name; document.title = d.name + ' \u00b7 Profile';
  if (d.avatar_url) { const im = $('#pav'); im.referrerPolicy = 'no-referrer'; im.src = d.avatar_url; im.hidden = false; }
  const sub = []; if (d.username) sub.push('@' + d.username); if (d.since) sub.push('Joined ' + new Date(d.since).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
  $('#psub').textContent = sub.join(' \u00b7 ');
  try { $('#pbadges').append(badgeRow(d.badges)); } catch { /* badges.js is optional */ }
  const approved = d.works.filter(w => w.status === 'approved').length, st = $('#pstats');
  for (const [n, w] of [[approved, approved === 1 ? 'work' : 'works'], [d.hearts, d.hearts === 1 ? 'heart' : 'hearts']]) { const s = el('span'); s.append(el('b', '', n), ' ' + w); st.append(s); } st.hidden = false;
  const tabs = $('#ptabs'), ban = $('#pban'), show = b => { main.hidden = b; ban.hidden = !b; $('#pt-works').classList.toggle('on', !b); $('#pt-ban').classList.toggle('on', b); history.replaceState(null, '', b ? '#name-banners' : location.pathname); };
  $('#pt-works').onclick = () => show(false); $('#pt-ban').onclick = () => show(true); tabs.hidden = false; if (location.hash === '#name-banners') show(true);
  if (!d.works.length) { main.append(el('p', 'empty', d.own ? 'You have not shared anything yet. Open the Showcase tab to submit your first work.' : 'No showcase works yet.')); return; }
  const g = el('div', 'grid'); for (const w of d.works) g.append(work(w)); main.append(g);
})().catch(() => main.append(el('p', 'empty', 'Could not load this profile. Try again in a moment.')));