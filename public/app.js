const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.flat().forEach((k) => n.append(k));
  return n;
};
const preview = new URLSearchParams(location.search).has('preview');
const url = (f) => '/uploads/' + encodeURIComponent(f);
let gallery = [], gi = 0, fxType = 'none', accent = '#8B5CF6', lastWorks = '', audio = null;

function applyTheme(site) {
  const r = document.documentElement, t = site.theme;
  r.style.setProperty('--accent', t.accent);
  r.dataset.mode = t.mode; r.dataset.font = t.font; r.dataset.namefx = t.nameFx;
  const n = parseInt(t.accent.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  r.style.setProperty('--on-accent', lum > 0.62 ? '#111' : '#fff');
  r.style.setProperty('--overlay', (t.overlay ?? 60) / 100);
  r.style.setProperty('--card-a', t.cardOpacity);
  r.style.setProperty('--blur', t.cardBlur + 'px');
  r.style.setProperty('--radius', t.radius + 'px');
  r.style.setProperty('--glow', t.glow);
  $('#bg').style.backgroundImage = t.background ? 'url("' + url(t.background) + '")' : '';
  fxType = t.fx; accent = t.accent;
}

function seo(site) {
  const p = site.profile, title = p.name + (p.tagline ? ' | ' + p.tagline : '');
  const desc = (p.tagline ? p.tagline + '. ' : '') + p.bio.replace(/\s+/g, ' ').slice(0, 150);
  const set = (sel, v) => { const m = $(sel); if (m) m.setAttribute('content', v); };
  document.title = title;
  set('meta[name="description"]', desc); set('meta[property="og:title"]', title); set('meta[property="og:description"]', desc);
  const img = site.theme.avatar || site.theme.background;
  if (img) { const m = el('meta'); m.setAttribute('property', 'og:image'); m.setAttribute('content', location.origin + url(img)); document.head.append(m); }
  const ld = el('script', { type: 'application/ld+json' });
  ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Person', name: p.name, description: p.tagline || undefined, email: p.email || undefined, url: location.origin, sameAs: p.links.map((l) => l.url).filter((u) => /^https?:/.test(u)) });
  document.head.append(ld);
}

function setMusic(file) {
  const b = $('#music');
  if (audio && audio.dataset.f !== file) { audio.pause(); audio = null; b.textContent = 'Play music'; }
  if (file && !audio) { audio = new Audio(url(file)); audio.loop = true; audio.dataset.f = file; }
  b.hidden = !file;
}

function render(site) {
  const p = site.profile, t = site.theme;
  applyTheme(site);
  const av = $('#avatar');
  av.hidden = !t.avatar;
  if (t.avatar) av.src = url(t.avatar);
  $('#name').textContent = p.name;
  $('#tagline').textContent = p.tagline; $('#tagline').hidden = !p.tagline;
  $('#bio').textContent = p.bio; $('#bio').hidden = !p.bio;
  const links = (p.email ? [{ label: 'Email me', url: 'mailto:' + p.email }] : []).concat(p.links);
  $('#links').replaceChildren(...links.map((l) => el('li', {}, el('a', { href: l.url, textContent: l.label, target: l.url.startsWith('mailto:') ? '_self' : '_blank', rel: 'noopener noreferrer' }))));
  $('#loc').textContent = p.location;
  $('#views').textContent = site.views ? site.views.toLocaleString() + ' views' : '';
  $('#year').textContent = '© ' + new Date().getFullYear() + ' ' + p.name;
  setMusic(t.music);
  const sig = JSON.stringify(site.works);
  if (sig !== lastWorks) { lastWorks = sig; renderWork(site.works); }
}

function renderWork(works) {
  const box = $('#work');
  box.replaceChildren();
  $('#workWrap').hidden = !works.length;
  gallery = works.filter((w) => w.kind === 'image');
  works.forEach((w) => {
    const kind = w.kind || 'text';
    const item = el('article', { className: 'item' });
    const src = w.file ? url(w.file) : '';
    if (kind === 'image') {
      const img = el('img', { src, alt: w.title, loading: 'lazy', decoding: 'async' });
      const done = () => img.classList.add('loaded');
      img.addEventListener('load', done); img.addEventListener('error', done);
      if (img.complete) done();
      const b = el('button', { className: 'media', type: 'button', ariaLabel: 'View ' + w.title + ' larger' }, img);
      b.addEventListener('click', () => { gi = gallery.indexOf(w); showImage(); $('#viewDlg').showModal(); });
      item.append(b);
    } else if (kind === 'video') item.append(el('div', { className: 'media' }, el('video', { src, controls: true, preload: 'metadata', playsInline: true })));
    else if (kind === 'audio') item.append(el('div', { className: 'media' }, el('audio', { src, controls: true, preload: 'none' })));
    else if (kind === 'pdf') item.append(el('a', { className: 'tile', href: src, target: '_blank', rel: 'noopener', textContent: 'Open PDF' }));
    item.append(el('h2', { textContent: w.title }));
    if (w.description) item.append(el('p', { textContent: w.description }));
    if (w.link) item.append(el('a', { className: 'go', href: w.link, target: '_blank', rel: 'noopener noreferrer', textContent: 'Visit link' }));
    box.append(item);
  });
}

/* ---------- image viewer ---------- */
function showImage() {
  const w = gallery[gi];
  const cap = el('figcaption', {}, el('strong', { textContent: w.title }));
  if (w.description) cap.append(el('span', { textContent: w.description }));
  $('#viewBody').replaceChildren(el('img', { src: url(w.file), alt: w.title }), cap);
  $('#prev').hidden = $('#next').hidden = gallery.length < 2;
}
const step = (d) => { gi = (gi + d + gallery.length) % gallery.length; showImage(); };
$('#prev').addEventListener('click', () => step(-1));
$('#next').addEventListener('click', () => step(1));
document.addEventListener('keydown', (e) => {
  if (!$('#viewDlg').open || gallery.length < 2) return;
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});
$('#viewDlg').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

$('#music').addEventListener('click', () => {
  if (!audio) return;
  if (audio.paused) { audio.play().catch(() => {}); $('#music').textContent = 'Pause music'; }
  else { audio.pause(); $('#music').textContent = 'Play music'; }
});

/* ---------- background effects ---------- */
const cv = $('#fx'), cx = cv.getContext('2d');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let parts = [];
function sizeFx() {
  cv.width = innerWidth; cv.height = innerHeight;
  parts = Array.from({ length: 70 }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: Math.random() * 2 + 0.6, v: Math.random() * 0.6 + 0.25, p: Math.random() * 6.28 }));
}
addEventListener('resize', sizeFx); sizeFx();
function tick(t) {
  cx.clearRect(0, 0, cv.width, cv.height);
  if (fxType !== 'none' && !reduce) {
    parts.forEach((q) => {
      if (fxType === 'snow') { q.y += q.v; q.x += Math.sin(t / 1500 + q.p) * 0.4; cx.fillStyle = 'rgba(255,255,255,.75)'; }
      else if (fxType === 'embers') { q.y -= q.v * 1.2; q.x += Math.sin(t / 900 + q.p) * 0.5; cx.fillStyle = accent; cx.globalAlpha = 0.5 + 0.4 * Math.sin(t / 400 + q.p); }
      else { cx.fillStyle = '#fff'; cx.globalAlpha = 0.45 + 0.55 * Math.sin(t / 700 + q.p); }
      if (q.y > cv.height) q.y = -4; if (q.y < -4) q.y = cv.height;
      cx.beginPath(); cx.arc(q.x, q.y, q.r, 0, 6.28); cx.fill(); cx.globalAlpha = 1;
    });
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---------- start ---------- */
addEventListener('message', (e) => { if (e.origin === location.origin && e.data && e.data.preview) render(e.data.site); });
fetch('/api/site').then((r) => r.json()).then((site) => {
  render(site);
  if (!preview) { seo(site); fetch('/api/view', { method: 'POST' }).then((r) => r.json()).then((d) => { $('#views').textContent = d.views.toLocaleString() + ' views'; }).catch(() => {}); }
}).catch(() => { $('#bio').textContent = 'Could not load this page. Refresh to try again.'; });