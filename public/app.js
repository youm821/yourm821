const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.flat().forEach((k) => n.append(k));
  return n;
};
const store = {
  get: () => { try { return localStorage.getItem('visitor-mode'); } catch { return null; } },
  set: (v) => { try { localStorage.setItem('visitor-mode', v); } catch {} }
};
const KINDS = { image: 'Images', video: 'Video', audio: 'Audio', pdf: 'Documents', text: 'Notes' };
let gallery = [], gi = 0;

function setMode(m) {
  document.documentElement.dataset.mode = m;
  const b = $('#modeBtn');
  b.setAttribute('aria-pressed', String(m === 'dark'));
  b.textContent = m === 'dark' ? 'Light mode' : 'Dark mode';
  $('meta[name="theme-color"]').content = m === 'dark' ? '#15171B' : '#EEF0F3';
}

function applyTheme(site) {
  const r = document.documentElement, t = site.theme;
  r.style.setProperty('--accent', t.accent);
  r.dataset.font = t.font;
  const n = parseInt(t.accent.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  r.style.setProperty('--on-accent', lum > 0.62 ? '#111' : '#fff');
  r.style.setProperty('--overlay', (t.overlay ?? 60) / 100);
  $('#bg').style.backgroundImage = t.background ? 'url("/uploads/' + encodeURIComponent(t.background) + '")' : '';
  setMode(store.get() || t.mode);
}

function seo(site) {
  const p = site.profile, title = p.name + (p.tagline ? ' | ' + p.tagline : '');
  const desc = (p.tagline ? p.tagline + '. ' : '') + p.bio.replace(/\s+/g, ' ').slice(0, 150);
  const firstImg = site.works.find((w) => w.kind === 'image');
  const img = firstImg ? firstImg.file : site.theme.background;
  const set = (sel, v) => { const m = $(sel); if (m) m.setAttribute('content', v); };
  document.title = title;
  set('meta[name="description"]', desc);
  set('meta[property="og:title"]', title);
  set('meta[property="og:description"]', desc);
  if (img) {
    let m = $('meta[property="og:image"]');
    if (!m) { m = el('meta'); m.setAttribute('property', 'og:image'); document.head.append(m); }
    m.setAttribute('content', location.origin + '/uploads/' + encodeURIComponent(img));
  }
  const ld = el('script', { type: 'application/ld+json' });
  ld.textContent = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Person', name: p.name, description: p.tagline || undefined,
    email: p.email || undefined, url: location.origin, sameAs: p.links.map((l) => l.url).filter((u) => /^https?:/.test(u))
  });
  document.head.append(ld);
}

function render(site) {
  const p = site.profile;
  applyTheme(site);
  seo(site);
  $('#name').textContent = p.name;
  $('#navName').textContent = p.name;
  $('#tagline').textContent = p.tagline; $('#tagline').hidden = !p.tagline;
  $('#bio').textContent = p.bio; $('#bio').hidden = !p.bio;
  const meta = $('#meta');
  meta.replaceChildren();
  if (p.location) meta.append(el('li', { textContent: p.location }));
  p.links.forEach((l) => meta.append(el('li', {}, el('a', { href: l.url, textContent: l.label, target: '_blank', rel: 'noopener noreferrer' }))));
  $('#year').textContent = '© ' + new Date().getFullYear() + ' ' + p.name;
  if (p.email) {
    $('#cta').hidden = false;
    $('#cta').href = 'mailto:' + p.email;
    $('#contact').hidden = false;
    $('#contactMail').href = 'mailto:' + p.email;
    $('#contactMail').textContent = p.email;
  }
  renderWork(site.works);
}

function renderWork(works) {
  const box = $('#work');
  box.replaceChildren();
  gallery = works.filter((w) => w.kind === 'image');
  box.classList.toggle('empty', !works.length);
  if (!works.length) { box.append(el('p', { textContent: 'New work is on the way.' })); return; }
  works.forEach((w) => {
    const kind = w.kind || 'text';
    const item = el('article', { className: 'item' });
    item.dataset.kind = kind;
    const src = w.file ? '/uploads/' + encodeURIComponent(w.file) : '';
    if (kind === 'image') {
      const img = el('img', { src, alt: w.title, loading: 'lazy', decoding: 'async' });
      const done = () => img.classList.add('loaded');
      img.addEventListener('load', done); img.addEventListener('error', done);
      if (img.complete) done();
      const b = el('button', { className: 'media', type: 'button', ariaLabel: 'View ' + w.title + ' larger' }, img);
      b.addEventListener('click', () => openViewer(gallery.indexOf(w)));
      item.append(b);
    } else if (kind === 'video') {
      item.append(el('div', { className: 'media' }, el('video', { src, controls: true, preload: 'metadata', playsInline: true })));
    } else if (kind === 'audio') {
      item.append(el('div', { className: 'media' }, el('audio', { src, controls: true, preload: 'none' })));
    } else if (kind === 'pdf') {
      item.append(el('a', { className: 'tile', href: src, target: '_blank', rel: 'noopener', textContent: 'Open PDF' }));
    }
    item.append(el('h2', { textContent: w.title }));
    if (w.description) item.append(el('p', { textContent: w.description }));
    if (w.link) item.append(el('a', { className: 'go', href: w.link, target: '_blank', rel: 'noopener noreferrer', textContent: 'Visit link' }));
    box.append(item);
  });
  buildFilters(works);
}

function buildFilters(works) {
  const bar = $('#filters');
  bar.replaceChildren();
  const kinds = [...new Set(works.map((w) => w.kind || 'text'))];
  bar.hidden = kinds.length < 2;
  if (bar.hidden) return;
  const make = (label, kind) => {
    const b = el('button', { type: 'button', className: 'ghost', textContent: label });
    b.setAttribute('aria-pressed', String(kind === 'all'));
    b.addEventListener('click', () => {
      bar.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      document.querySelectorAll('.item').forEach((it) => { it.hidden = kind !== 'all' && it.dataset.kind !== kind; });
    });
    bar.append(b);
  };
  make('All', 'all');
  kinds.forEach((k) => make(KINDS[k] || k, k));
}

/* ---------- image viewer ---------- */
function openViewer(i) {
  gi = i;
  showImage();
  if (!$('#viewDlg').open) $('#viewDlg').showModal();
}
function showImage() {
  const w = gallery[gi];
  const cap = el('figcaption', {}, el('strong', { textContent: w.title }));
  if (w.description) cap.append(el('span', { textContent: w.description }));
  $('#viewBody').replaceChildren(el('img', { src: '/uploads/' + encodeURIComponent(w.file), alt: w.title }), cap);
  const multi = gallery.length > 1;
  $('#prev').hidden = $('#next').hidden = !multi;
  if (multi) [1, -1].forEach((d) => { new Image().src = '/uploads/' + encodeURIComponent(gallery[(gi + d + gallery.length) % gallery.length].file); });
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

$('#modeBtn').addEventListener('click', () => {
  const next = document.documentElement.dataset.mode === 'dark' ? 'light' : 'dark';
  store.set(next);
  setMode(next);
});

fetch('/api/site').then((r) => r.json()).then(render).catch(() => {
  $('#work').replaceChildren(el('p', { textContent: 'Could not load the portfolio. Refresh the page to try again.' }));
});