const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.flat().forEach((k) => n.append(k));
  return n;
};

function applyTheme(site) {
  const r = document.documentElement;
  const t = site.theme;
  r.style.setProperty('--accent', t.accent);
  r.dataset.mode = t.mode;
  r.dataset.font = t.font;
  const n = parseInt(t.accent.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  r.style.setProperty('--on-accent', lum > 0.62 ? '#111' : '#fff');
  r.style.setProperty('--overlay', (t.overlay ?? 60) / 100);
  const bg = document.getElementById('bg');
  if (bg) bg.style.backgroundImage = t.background ? 'url("/uploads/' + encodeURIComponent(t.background) + '")' : '';
  document.title = site.profile.name + (site.profile.tagline ? ' | ' + site.profile.tagline : '');
}

function render(site) {
  const p = site.profile;
  applyTheme(site);
  $('#name').textContent = p.name;
  $('#tagline').textContent = p.tagline;
  $('#tagline').hidden = !p.tagline;
  $('#bio').textContent = p.bio;
  $('#bio').hidden = !p.bio;
  const meta = $('#meta');
  meta.replaceChildren();
  if (p.location) meta.append(el('li', { textContent: p.location }));
  if (p.email) meta.append(el('li', {}, el('a', { href: 'mailto:' + p.email, textContent: p.email })));
  p.links.forEach((l) => meta.append(el('li', {}, el('a', { href: l.url, textContent: l.label, target: '_blank', rel: 'noopener noreferrer' }))));
  $('#year').textContent = '© ' + new Date().getFullYear() + ' ' + p.name;

  const box = $('#work');
  box.replaceChildren();
  box.classList.toggle('empty', !site.works.length);
  if (!site.works.length) { box.append(el('p', { textContent: 'New work is on the way.' })); return; }
  site.works.forEach((w) => {
    const item = el('article', { className: 'item' });
    const src = w.file ? '/uploads/' + encodeURIComponent(w.file) : '';
    if (w.kind === 'image') {
      const b = el('button', { className: 'media', type: 'button', ariaLabel: 'View ' + w.title + ' larger' }, el('img', { src, alt: w.title, loading: 'lazy' }));
      b.addEventListener('click', () => { $('#viewBody').replaceChildren(el('img', { src, alt: w.title })); $('#viewDlg').showModal(); });
      item.append(b);
    } else if (w.kind === 'video') {
      item.append(el('div', { className: 'media' }, el('video', { src, controls: true, preload: 'metadata', playsInline: true })));
    } else if (w.kind === 'audio') {
      item.append(el('div', { className: 'media' }, el('audio', { src, controls: true, preload: 'none' })));
    } else if (w.kind === 'pdf') {
      item.append(el('a', { className: 'tile', href: src, target: '_blank', rel: 'noopener', textContent: 'Open PDF' }));
    }
    item.append(el('h2', { textContent: w.title }));
    if (w.description) item.append(el('p', { textContent: w.description }));
    if (w.link) item.append(el('a', { className: 'go', href: w.link, target: '_blank', rel: 'noopener noreferrer', textContent: 'Visit link' }));
    box.append(item);
  });
}

document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
$('#viewDlg').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
fetch('/api/site').then((r) => r.json()).then(render);
