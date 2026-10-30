const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  kids.flat().forEach((k) => n.append(k));
  return n;
};
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
const thumbUrl = (w) => '/uploads/' + encodeURIComponent(w.file);

function theme() {
  const r = document.documentElement, t = site.theme;
  r.style.setProperty('--accent', t.accent);
  r.dataset.mode = t.mode;
  r.dataset.font = t.font;
  const n = parseInt(t.accent.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  r.style.setProperty('--on-accent', lum > 0.62 ? '#111' : '#fff');
}

function signOut() {
  token = '';
  localStorage.removeItem('portfolio-token');
  show();
}

function show() {
  theme();
  $('#login').hidden = !!token;
  $('#dash').hidden = !token;
  if (token) { fillSettings(); renderList(); }
}

/* ---------- sign in ---------- */
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const d = await api('/api/login', json('POST', { passcode: $('#pass').value }));
    token = d.token;
    localStorage.setItem('portfolio-token', token);
    $('#pass').value = '';
    $('#loginErr').textContent = '';
    show();
  } catch (err) { $('#loginErr').textContent = err.message; }
});
$('#outBtn').addEventListener('click', signOut);

/* ---------- add work (one request per file) ---------- */
$('#addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, fe = f.elements;
  const files = [...fe.files.files];
  const jobs = files.length ? files : [null];
  const status = $('#addStatus'), btn = $('#addBtn');
  status.className = 'status';
  btn.disabled = true;
  let ok = 0;
  const failed = [];
  for (let i = 0; i < jobs.length; i++) {
    const file = jobs[i];
    status.textContent = jobs.length > 1 ? 'Uploading ' + (i + 1) + ' of ' + jobs.length + '...' : 'Uploading...';
    const fd = new FormData();
    const fromName = file ? file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') : '';
    fd.append('title', jobs.length === 1 && fe.title.value.trim() ? fe.title.value : fromName || 'Untitled');
    fd.append('description', fe.description.value);
    fd.append('link', fe.link.value);
    if (file) fd.append('file', file);
    try { await api('/api/works', { method: 'POST', body: fd }); ok++; }
    catch (err) { failed.push((file ? file.name : 'Entry') + ': ' + err.message); }
  }
  btn.disabled = false;
  if (ok) { site = await api('/api/site'); renderList(); }
  if (failed.length) {
    status.className = 'status bad';
    status.textContent = ok + ' uploaded. ' + failed.length + ' failed:\n' + failed.join('\n');
  } else {
    status.textContent = ok + (ok === 1 ? ' item added.' : ' items added.');
    f.reset();
  }
});

/* ---------- list, edit, delete ---------- */
function renderList() {
  const box = $('#list');
  box.replaceChildren();
  if (!site.works.length) { box.append(el('p', { className: 'status', textContent: 'Nothing here yet. Add your first piece above.' })); return; }
  site.works.forEach((w) => {
    const thumb = w.kind === 'image'
      ? el('img', { className: 'thumb', src: thumbUrl(w), alt: '', loading: 'lazy' })
      : el('div', { className: 'thumb', textContent: w.kind ? w.kind.toUpperCase() : 'Text' });
    const edit = el('button', { className: 'ghost small', type: 'button', textContent: 'Edit' });
    const del = el('button', { className: 'ghost small', type: 'button', textContent: 'Delete' });
    edit.addEventListener('click', () => openEdit(w));
    del.addEventListener('click', () => removeWork(w));
    box.append(el('div', { className: 'rowitem' }, thumb,
      el('div', {}, el('strong', { textContent: w.title }), el('small', { textContent: w.description || (w.kind || 'text only') })),
      el('div', { className: 'btns' }, edit, del)));
  });
}
function openEdit(w) {
  editingId = w.id;
  const fe = $('#workForm').elements;
  $('#workForm').reset();
  $('#workErr').textContent = '';
  fe.title.value = w.title; fe.description.value = w.description || ''; fe.link.value = w.link || '';
  $('#workDlg').showModal();
}
$('#workForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#workSave');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const body = new FormData(e.target);
    if (!body.get('file') || !body.get('file').size) body.delete('file');
    await api('/api/works/' + editingId, { method: 'PUT', body });
    site = await api('/api/site');
    $('#workDlg').close();
    renderList();
  } catch (err) { $('#workErr').textContent = err.message; }
  btn.disabled = false; btn.textContent = 'Save work';
});
async function removeWork(w) {
  if (!confirm('Delete "' + w.title + '"? This cannot be undone.')) return;
  try { await api('/api/works/' + w.id, { method: 'DELETE' }); site = await api('/api/site'); renderList(); }
  catch (err) { alert(err.message); }
}

/* ---------- settings ---------- */
function fillSettings() {
  const fe = $('#siteForm').elements, p = site.profile, t = site.theme;
  fe.name.value = p.name; fe.tagline.value = p.tagline; fe.bio.value = p.bio;
  fe.location.value = p.location; fe.email.value = p.email;
  fe.links.value = p.links.map((l) => l.label + ' | ' + l.url).join('\n');
  fe.accent.value = t.accent; fe.mode.value = t.mode; fe.font.value = t.font;
  fe.overlay.value = t.overlay ?? 60;
  $('#ovVal').textContent = fe.overlay.value;
  showBg();
}
$('#siteForm').elements.overlay.addEventListener('input', (e) => { $('#ovVal').textContent = e.target.value; });
$('#siteForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fe = e.target.elements;
  const links = fe.links.value.split('\n').map((line) => {
    const i = line.indexOf('|');
    return i < 0 ? null : { label: line.slice(0, i).trim(), url: line.slice(i + 1).trim() };
  }).filter(Boolean);
  try {
    site = await api('/api/site', json('PUT', {
      profile: { name: fe.name.value, tagline: fe.tagline.value, bio: fe.bio.value, location: fe.location.value, email: fe.email.value, links },
      theme: { accent: fe.accent.value, mode: fe.mode.value, font: fe.font.value, overlay: fe.overlay.value }
    }));
    theme();
    $('#siteErr').style.color = 'var(--muted)';
    $('#siteErr').textContent = 'Saved.';
  } catch (err) { $('#siteErr').style.color = ''; $('#siteErr').textContent = err.message; }
});

/* ---------- background image ---------- */
function showBg() {
  const prev = $('#bgPrev');
  const b = site.theme.background;
  prev.style.backgroundImage = b ? 'url("/uploads/' + encodeURIComponent(b) + '")' : '';
  prev.textContent = b ? '' : 'No background image';
  $('#bgRemove').hidden = !b;
}
$('#bgFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const s = $('#bgStatus');
  s.className = 'status'; s.textContent = 'Uploading...';
  try {
    const fd = new FormData();
    fd.append('image', file);
    site = await api('/api/background', { method: 'POST', body: fd });
    s.textContent = 'Background saved. Use the fade slider above if text is hard to read.';
    showBg();
  } catch (err) { s.className = 'status bad'; s.textContent = err.message; }
  e.target.value = '';
});
$('#bgRemove').addEventListener('click', async () => {
  try { site = await api('/api/background', { method: 'DELETE' }); $('#bgStatus').textContent = 'Background removed.'; showBg(); }
  catch (err) { $('#bgStatus').textContent = err.message; }
});

document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
(async function init() {
  site = await api('/api/site');
  if (token) { try { await api('/api/me'); } catch { token = ''; } }
  show();
})();
