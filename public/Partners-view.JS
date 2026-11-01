/* Shared partners view. Used by the Partners tab on the gallery and by /partners.
   PartnersView.mount(element) draws the filter chips, the grid and the detail popup. */
window.PartnersView = (() => {
  let root = null, chipsEl, gridEl, stateEl, modal;
  const ui = {};
  let all = [], category = '', current = null, idx = 0, opener = null;

  function h(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(kid));
    return n;
  }

  function buildModal() {
    ui.big = h('img', { class: 'big', alt: '' });
    ui.thumbs = h('div', { class: 'pthumbs' });
    ui.logo = h('img', { class: 'plogo', alt: '' });
    ui.title = h('h2', { id: 'ptitle' });
    ui.cat = h('p', { class: 'cat' });
    ui.tag = h('p', { class: 'tag' });
    ui.desc = h('p', { class: 'desc' });
    ui.link = h('a', { class: 'btn', target: '_blank', rel: 'noopener noreferrer' }, 'Visit website');
    ui.close = h('button', { class: 'x', type: 'button', 'aria-label': 'Close', onclick: closeModal }, '\u00d7');
    const info = h('div', { class: 'pinfo' }, h('div', { class: 'head' }, ui.logo, ui.title), ui.cat, ui.tag, ui.desc, ui.link);
    const sheet = h('div', { class: 'sheet wide', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ptitle' },
      ui.close, h('div', { class: 'pdetail' }, h('div', { class: 'pstage' }, ui.big, ui.thumbs), info));
    modal = h('div', { class: 'modal', hidden: true }, sheet);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.body.append(modal);
    document.addEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (!modal || modal.hidden) return;
    if (e.key === 'Escape') closeModal();
    else if (e.key === 'ArrowRight' && current.images.length > 1) show(idx + 1);
    else if (e.key === 'ArrowLeft' && current.images.length > 1) show(idx - 1);
    else if (e.key === 'Tab') {
      const f = [...modal.querySelectorAll('button, a[href]')].filter((n) => !n.hidden && n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function show(i) {
    const imgs = current.images;
    idx = imgs.length ? (i + imgs.length) % imgs.length : 0;
    ui.big.hidden = !imgs.length;
    if (imgs.length) { ui.big.src = imgs[idx]; ui.big.alt = current.name + ', photo ' + (idx + 1) + ' of ' + imgs.length; }
    ui.thumbs.replaceChildren();
    ui.thumbs.hidden = imgs.length < 2;
    imgs.forEach((src, n) => ui.thumbs.append(h('button', {
      type: 'button', 'aria-label': 'Show photo ' + (n + 1), 'aria-current': String(n === idx), onclick: () => show(n),
    }, h('img', { src, alt: '' }))));
  }

  function openModal(p, trigger) {
    current = p; opener = trigger;
    ui.title.textContent = p.name;
    for (const [node, v] of [[ui.cat, p.category], [ui.tag, p.tagline], [ui.desc, p.description]]) { node.textContent = v || ''; node.hidden = !v; }
    ui.logo.hidden = !p.logo; if (p.logo) ui.logo.src = p.logo;
    ui.link.hidden = !p.website; if (p.website) ui.link.href = p.website;
    show(0);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    ui.close.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (opener && opener.focus) opener.focus();
  }

  function renderChips() {
    const cats = [...new Set(all.map((p) => p.category).filter(Boolean))].sort();
    chipsEl.replaceChildren();
    chipsEl.hidden = cats.length < 2;
    if (category && !cats.includes(category)) category = '';
    if (cats.length < 2) return;
    for (const c of ['', ...cats]) {
      const n = c ? all.filter((p) => p.category === c).length : all.length;
      chipsEl.append(h('button', {
        class: 'chip' + (c === category ? ' on' : ''), type: 'button', 'aria-pressed': String(c === category),
        onclick: () => { category = c; renderChips(); renderGrid(); },
      }, c || 'All', h('b', {}, String(n))));
    }
  }

  function renderGrid() {
    const list = category ? all.filter((p) => p.category === category) : all;
    gridEl.replaceChildren();
    for (const p of list) {
      const cover = h('div', { class: 'pcover' });
      if (p.images[0]) cover.append(h('img', { src: p.images[0], alt: '', loading: 'lazy' }));
      else cover.append(h('div', { class: 'ini', 'aria-hidden': 'true' }, p.name.charAt(0).toUpperCase()));
      if (p.images.length > 1) cover.append(h('span', { class: 'pcount' }, p.images.length + ' photos'));
      const text = h('div', {}, h('h2', {}, p.name));
      const sub = p.tagline || p.category;
      if (sub) text.append(h('p', {}, sub));
      gridEl.append(h('button', {
        class: 'card pcard', type: 'button', 'aria-label': 'Open ' + p.name,
        onclick: (e) => openModal(p, e.currentTarget),
      }, cover, h('div', { class: 'pmeta' }, p.logo ? h('img', { class: 'plogo', src: p.logo, alt: '', loading: 'lazy' }) : null, text)));
    }
    stateEl.hidden = list.length > 0;
    if (!list.length) stateEl.textContent = all.length ? 'No partners in this category.' : 'No partners yet. Check back soon.';
  }

  async function load() {
    try {
      const r = await fetch('/api/partners', { cache: 'no-cache', credentials: 'same-origin' });
      if (!r.ok) throw new Error();
      all = (await r.json()).partners || [];
      renderChips(); renderGrid();
    } catch {
      stateEl.hidden = false;
      stateEl.textContent = 'Partners could not be loaded. Refresh the page to try again.';
    }
  }

  function mount(el) {
    if (root !== el) {
      root = el;
      root.replaceChildren();
      chipsEl = h('div', { class: 'pchips', role: 'group', 'aria-label': 'Filter partners by category', hidden: true });
      gridEl = h('div', { class: 'grid pgrid' });
      stateEl = h('p', { class: 'empty', role: 'status' }, 'Loading partners\u2026');
      root.append(chipsEl, gridEl, stateEl);
      if (!modal) buildModal();
    }
    return load();
  }

  return { mount };
})();