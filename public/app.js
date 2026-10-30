const $ = (s, r = document) => r.querySelector(s);
let site = null;
let token = localStorage.getItem('portfolio-token') || '';
let editingId = null;

async function api(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(url, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) signOut();
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}
const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.flat().forEach((k) => n.append(k));
  return n;
};

/* ---------- render ---------- */
function applyTheme() {
  const r = document.documentElement;
  r.style.setProperty('--accent', site.theme.accent);
  r.dataset.mode = site.theme.mode;
  r.dataset.font = site.theme.font;
  // pick readable text colour for the accent
  const n = parseInt(site.theme.accent.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  r.style.setProperty('--on-accent', lum > 0.62 ? '#111' : '#fff');
  document.title = site.profile.name + (site.profile.tagline ? ' | ' + site.profile.tagline : '');
}

function render() {
  const p = site.profile;
  applyTheme();
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
  renderWorks();
  $('#bar').hidden = !token;
  $('#ownerBtn').hidden = !!token;
}

function renderWorks() {
  const box = $('#work');
  box.replaceChildren();
  box.classList.toggle('empty', !site.works.length);
  if (!site.works.length) {
    box.append(el('p', { textContent: token ? 'No work yet. Choose Add work to upload your first piece.' : 'New work is on the way.' }));
    return;
  }
  site.works.forEach((w) => {
    const item = el('article', { className: 'item' });
    const src = w.file ? '/uploads/' + encodeURIComponent(w.file) : '';
    if (w.kind === 'image') {
      const b = el('button', { className: 'media', type: 'button', ariaLabel: 'View ' + w.title + ' larger' }, el('img', { src, alt: w.title, loading: 'lazy' }));
      b.addEventListener('click', () => openView(src, w.title));
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
    if (token) {
      const edit = el('button', { className: 'ghost small', type: 'button', textContent: 'Edit' });
      const del = el('button', { className: 'ghost small', type: 'button', textContent: 'Delete' });
      edit.addEventListener('click', () => openWork(w));
      del.addEventListener('click', () => removeWork(w));
      item.append(el('div', { className: 'admin-row' }, edit, del));
    }
    box.append(item);
  });
}

function openView(src, title) {
  $('#viewBody').replaceChildren(el('img', { src, alt: title }));
  $('#viewDlg').showModal();
}

/* ---------- auth ---------- */
function signOut() {
  token = '';
  localStorage.removeItem('portfolio-token');
  if (site) render();
}
$('#ownerBtn').addEventListener('click', () => { $('#loginErr').textContent = ''; $('#pass').value = ''; $('#loginDlg').showModal(); $('#pass').focus(); });
$('#outBtn').addEventListener('click', signOut);
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const d = await api('/api/login', json('POST', { passcode: $('#pass').value }));
    token = d.token;
    localStorage.setItem('portfolio-token', token);
    $('#loginDlg').close();
    render();
  } catch (err) { $('#loginErr').textContent = err.message; }
});

/* ---------- works ---------- */
function openWork(w) {
  editingId = w ? w.id : null;
  const f = $('#workForm');
  f.reset();
  $('#workTitle').textContent = w ? 'Edit work' : 'Add work';
  $('#workErr').textContent = '';
  $('#fileHint').textContent = w && w.file ? 'Leave the file empty to keep the current one.' : '';
  if (w) { f.title.value = w.title; f.description.value = w.description || ''; f.link.value = w.link || ''; }
  $('#workDlg').showModal();
}
$('#addBtn').addEventListener('click', () => openWork(null));
$('#workForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#workSave');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const body = new FormData(e.target);
    if (!body.get('file') || !body.get('file').size) body.delete('file');
    await api(editingId ? '/api/works/' + editingId : '/api/works', { method: editingId ? 'PUT' : 'POST', body });
    site = await api('/api/site');
    $('#workDlg').close();
    render();
  } catch (err) { $('#workErr').textContent = err.message; }
  btn.disabled = false; btn.textContent = 'Save work';
});
async function removeWork(w) {
  if (!confirm('Delete "' + w.title + '"? This cannot be undone.')) return;
  try { await api('/api/works/' + w.id, { method: 'DELETE' }); site = await api('/api/site'); render(); }
  catch (err) { alert(err.message); }
}

/* ---------- site settings ---------- */
$('#siteBtn').addEventListener('click', () => {
  const f = $('#siteForm'), p = site.profile, t = site.theme;
  $('#siteErr').textContent = '';
  f.name.value = p.name; f.tagline.value = p.tagline; f.bio.value = p.bio;
  f.location.value = p.location; f.email.value = p.email;
  f.links.value = p.links.map((l) => l.label + ' | ' + l.url).join('\n');
  f.accent.value = t.accent; f.mode.value = t.mode; f.font.value = t.font;
  $('#siteDlg').showModal();
});
$('#siteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const links = f.links.value.split('\n').map((line) => {
    const i = line.indexOf('|');
    return i < 0 ? null : { label: line.slice(0, i).trim(), url: line.slice(i + 1).trim() };
  }).filter(Boolean);
  try {
    site = await api('/api/site', json('PUT', {
      profile: { name: f.name.value, tagline: f.tagline.value, bio: f.bio.value, location: f.location.value, email: f.email.value, links },
      theme: { accent: f.accent.value, mode: f.mode.value, font: f.font.value }
    }));
    $('#siteDlg').close();
    render();
  } catch (err) { $('#siteErr').textContent = err.message; }
});

/* ---------- misc ---------- */
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog.view').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

(async function init() {
  site = await api('/api/site');
  if (token) { try { await api('/api/me'); } catch { token = ''; } }
  render();
})();
