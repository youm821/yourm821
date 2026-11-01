(() => {
  const $ = (s) => document.querySelector(s);
  const grid = $('#grid'), chips = $('#chips'), state = $('#state'), modal = $('#modal');
  let all = [], category = '', current = null, idx = 0, opener = null;

  function el(tag, props = {}, ...kids) {
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

  /* Same title and custom background as the gallery. */
  fetch('/api/items').then((r) => r.json()).then((d) => {
    if (d.settings && d.settings.title) { $('#site').textContent = d.settings.title; document.title = 'Partners · ' + d.settings.title; }
    if (d.background && d.background.src) {
      document.body.style.setProperty('--bg-img', 'url("' + d.background.src + '")');
      document.body.style.setProperty('--bg-dim', String((d.background.dim ?? 55) / 100));
      document.body.classList.add('hasbg');
    }
  }).catch(() => {});

  function renderChips() {
    const cats = [...new Set(all.map((p) => p.category).filter(Boolean))].sort();
    chips.replaceChildren();
    chips.hidden = cats.length < 2;
    if (cats.length < 2) return;
    for (const c of ['', ...cats]) {
      const n = c ? all.filter((p) => p.category === c).length : all.length;
      chips.append(el('button', {
        class: 'chip' + (c === category ? ' on' : ''), type: 'button', 'aria-pressed': String(c === category),
        onclick: () => { category = c; renderChips(); renderGrid(); },
      }, c || 'All', el('b', {}, String(n))));
    }
  }

  function renderGrid() {
    const list = category ? all.filter((p) => p.category === category) : all;
    grid.replaceChildren();
    for (const p of list) {
      const cover = el('div', { class: 'pcover' });
      if (p.images[0]) cover.append(el('img', { src: p.images[0], alt: '', loading: 'lazy' }));
      else cover.append(el('div', { class: 'ini', 'aria-hidden': 'true' }, p.name.charAt(0).toUpperCase()));
      if (p.images.length > 1) cover.append(el('span', { class: 'pcount' }, p.images.length + ' photos'));
      const text = el('div', {}, el('h2', {}, p.name));
      const sub = p.tagline || p.category;
      if (sub) text.append(el('p', {}, sub));
      grid.append(el('button', {
        class: 'card pcard', type: 'button', 'aria-label': 'Open ' + p.name,
        onclick: (e) => openModal(p, e.currentTarget),
      }, cover, el('div', { class: 'pmeta' }, p.logo ? el('img', { class: 'plogo', src: p.logo, alt: '', loading: 'lazy' }) : null, text)));
    }
    state.hidden = list.length > 0;
    if (!list.length) state.textContent = all.length ? 'No partners in this category.' : 'No partners yet. Check back soon.';
  }

  function show(i) {
    const imgs = current.images;
    idx = imgs.length ? (i + imgs.length) % imgs.length : 0;
    const big = $('#m-big');
    big.hidden = !imgs.length;
    if (imgs.length) { big.src = imgs[idx]; big.alt = current.name + ', photo ' + (idx + 1) + ' of ' + imgs.length; }
    const thumbs = $('#m-thumbs');
    thumbs.replaceChildren();
    thumbs.hidden = imgs.length < 2;
    imgs.forEach((src, n) => thumbs.append(el('button', {
      type: 'button', 'aria-label': 'Show photo ' + (n + 1), 'aria-current': String(n === idx),
      onclick: () => show(n),
    }, el('img', { src, alt: '' }))));
  }

  function openModal(p, trigger) {
    current = p; opener = trigger;
    $('#m-title').textContent = p.name;
    for (const [id, v] of [['#m-cat', p.category], ['#m-tag', p.tagline], ['#m-desc', p.description]]) {
      $(id).textContent = v; $(id).hidden = !v;
    }
    const logo = $('#m-logo'); logo.hidden = !p.logo; if (p.logo) logo.src = p.logo;
    const link = $('#m-link'); link.hidden = !p.website; if (p.website) link.href = p.website;
    show(0);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    $('#m-close').focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (opener) opener.focus();
  }

  $('#m-close').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
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
  });

  fetch('/api/partners')
    .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
    .then((d) => { all = d.partners || []; renderChips(); renderGrid(); })
    .catch(() => { state.textContent = 'Partners could not be loaded. Refresh the page to try again.'; });
})();
