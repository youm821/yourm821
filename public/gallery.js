const $ = s => document.querySelector(s);
const state = { items: [], set: 'All', q: '' };
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

async function load() {
  const d = await (await fetch('/api/items', { cache: 'no-cache' })).json();
  document.title = d.settings.title;
  $('#title').textContent = d.settings.title;
  $('#subtitle').textContent = d.settings.subtitle || '';
  if (d.photo) {
    $('#me').src = d.photo; $('#me').hidden = false;
    document.documentElement.style.setProperty('--photo-bg', `url("${d.photo}") center/cover no-repeat`);
  }
  state.items = d.items;
  render();
}
function render() {
  const counts = new Map();
  for (const i of state.items) counts.set(i.set, (counts.get(i.set) || 0) + 1);
  if (state.set !== 'All' && !counts.has(state.set)) state.set = 'All';
  const chips = $('#chips'); chips.replaceChildren();
  for (const name of ['All', ...counts.keys()]) {
    const b = el('button', 'chip' + (name === state.set ? ' on' : ''), name);
    b.append(el('b', '', name === 'All' ? state.items.length : counts.get(name)));
    b.onclick = () => { state.set = name; render(); };
    chips.append(b);
  }
  const q = state.q.toLowerCase();
  const shown = state.items.filter(i => (state.set === 'All' || i.set === state.set) && (!q || (i.title + ' ' + i.set).toLowerCase().includes(q)));
  const grid = $('#grid'); grid.replaceChildren();
  if (!shown.length) grid.append(el('div', 'empty', 'Nothing here yet.'));
  const groups = new Map();
  for (const i of shown) { if (!groups.has(i.set)) groups.set(i.set, []); groups.get(i.set).push(i); }
  for (const [name, list] of groups) {
    if (state.set === 'All') { const h = el('h2', 'set', name); h.append(el('span', '', list.length)); grid.append(h); }
    const g = el('div', 'grid');
    for (const i of list) {
      const f = el('figure', 'card');
      const st = el('div', 'stage'); st.append(el('div', 'av'));
      const img = el('img'); img.src = i.src; img.alt = i.title; img.loading = 'lazy'; st.append(img);
      f.append(st, el('figcaption', '', i.title));
      f.onclick = () => openModal(i);
      g.append(f);
    }
    grid.append(g);
  }
  $('#count').textContent = shown.length + ' of ' + state.items.length + ' shown';
}
function openModal(i) {
  $('#mimg').src = i.src; $('#mimg').alt = i.title;
  $('#mtitle').textContent = i.title; $('#mset').textContent = i.set;
  const dl = $('#mdl'); dl.href = i.src; dl.download = i.title.replace(/[^\w-]+/g, '_') + i.src.slice(i.src.lastIndexOf('.'));
  $('#mcopy').onclick = async () => {
    try { await navigator.clipboard.writeText(location.origin + i.src); $('#mcopy').textContent = 'Copied!'; }
    catch { $('#mcopy').textContent = 'Press Ctrl+C on the address'; }
    setTimeout(() => { $('#mcopy').textContent = 'Copy link'; }, 1500);
  };
  $('#modal').hidden = false;
}
const closeModal = () => { $('#modal').hidden = true; };
$('#close').onclick = closeModal;
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
$('#q').oninput = e => { state.q = e.target.value; render(); };
$('#av').onchange = e => document.body.classList.toggle('showav', e.target.checked);
load();
