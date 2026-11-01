(() => {
  const $ = (s) => document.querySelector(s);
  const MAX_PHOTOS = 12;
  let partners = [];
  // form.images: { src } for photos already saved, { blob, url } for new ones
  let form = blank();

  function blank() { return { id: null, logo: null, hadLogo: false, images: [] }; }

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

  function say(text, kind) { const m = $('#msg'); m.textContent = text; m.className = 'msg' + (kind ? ' ' + kind : ''); }

  async function api(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    let data = {};
    try { data = await res.json(); } catch { /* no body */ }
    if (res.status === 401) { location.reload(); throw new Error('Your session ended. Sign in again.'); }
    if (!res.ok) throw new Error(data.error || 'Something went wrong (' + res.status + ').');
    return data;
  }

  /* ---------- list ---------- */
  async function refresh() {
    partners = (await fetch('/api/partners').then((r) => r.json())).partners || [];
    renderList();
  }

  function renderList() {
    const ul = $('#list');
    ul.replaceChildren();
    $('#empty').hidden = partners.length > 0;
    partners.forEach((p, i) => {
      const pic = p.images[0] || p.logo;
      ul.append(el('li', { class: 'prow', 'aria-current': String(p.id === form.id) },
        pic ? el('img', { class: 'pic', src: pic, alt: '' }) : el('div', { class: 'pic' }),
        el('button', { type: 'button', class: 'nm', onclick: () => fillForm(p) }, p.name, p.category ? el('small', {}, p.category) : null),
        el('div', { class: 'moves' },
          el('button', { type: 'button', class: 'btn ghost', 'aria-label': 'Move ' + p.name + ' up', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
          el('button', { type: 'button', class: 'btn ghost', 'aria-label': 'Move ' + p.name + ' down', disabled: i === partners.length - 1, onclick: () => move(i, 1) }, '↓'))));
    });
  }

  async function move(i, d) {
    const j = i + d;
    [partners[i], partners[j]] = [partners[j], partners[i]];
    renderList();
    try { await api('PUT', '/api/partners/order', { ids: partners.map((p) => p.id) }); say('Saved', 'ok'); }
    catch (e) { say(e.message, 'err'); refresh(); }
  }

  /* ---------- form ---------- */
  function fillForm(p) {
    form = {
      id: p.id || null,
      logo: p.logo ? { src: p.logo } : null,
      hadLogo: !!p.logo,
      images: (p.images || []).map((src) => ({ src })),
    };
    $('#f-name').value = p.name || '';
    $('#f-cat').value = p.category || '';
    $('#f-tag').value = p.tagline || '';
    $('#f-web').value = p.website || '';
    $('#f-desc').value = p.description || '';
    $('#form-h').textContent = form.id ? 'Edit ' + p.name : 'New partner';
    $('#delete').hidden = !form.id;
    say('');
    renderMedia(); renderList();
  }

  function renderMedia() {
    const img = $('#logo-img');
    const logoUrl = form.logo && (form.logo.url || form.logo.src);
    img.hidden = !logoUrl; if (logoUrl) img.src = logoUrl;
    $('#logo-clear').hidden = !logoUrl;
    $('#logo-pick').textContent = logoUrl ? 'Change logo' : 'Choose logo';

    const box = $('#photos');
    box.replaceChildren();
    form.images.forEach((im, i) => box.append(el('div', { class: 'pphoto' },
      el('img', { src: im.url || im.src, alt: 'Photo ' + (i + 1) }),
      i === 0 ? el('span', { class: 'badge' }, 'Cover') : null,
      el('div', { class: 'tools' },
        i === 0 ? el('span') : el('button', { type: 'button', class: 'btn ghost sm', onclick: () => { form.images.unshift(form.images.splice(i, 1)[0]); renderMedia(); } }, 'Make cover'),
        el('button', { type: 'button', class: 'btn ghost sm', 'aria-label': 'Remove photo ' + (i + 1), onclick: () => { form.images.splice(i, 1); renderMedia(); } }, 'Remove')))));
    $('#photo-pick').disabled = form.images.length >= MAX_PHOTOS;
  }

  async function shrink(file, max, type, quality) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { throw new Error(file.name + ' could not be read. Use a JPEG, PNG, WebP or GIF image.'); }
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = c.getContext('2d');
    if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((ok) => c.toBlob(ok, type, quality));
    if (!blob) throw new Error(file.name + ' could not be prepared for upload.');
    return { blob, url: URL.createObjectURL(blob) };
  }

  async function addPhotos(files) {
    try {
      for (const f of files) {
        if (form.images.length >= MAX_PHOTOS) { say('A partner can have up to ' + MAX_PHOTOS + ' photos.', 'err'); break; }
        form.images.push(await shrink(f, 1600, 'image/jpeg', 0.82));
        renderMedia();
      }
    } catch (e) { say(e.message, 'err'); }
  }

  async function save() {
    const btn = $('#save'); btn.disabled = true; say('Saving…');
    const fd = new FormData();
    fd.append('name', $('#f-name').value);
    fd.append('category', $('#f-cat').value);
    fd.append('tagline', $('#f-tag').value);
    fd.append('website', $('#f-web').value);
    fd.append('description', $('#f-desc').value);
    if (form.logo && form.logo.blob) fd.append('logo', form.logo.blob, 'logo.png');
    else if (!form.logo && form.hadLogo) fd.append('logo', 'remove');
    const order = []; let n = 0;
    for (const im of form.images) {
      if (im.blob) { fd.append('photos', im.blob, 'photo-' + n + '.jpg'); order.push('new:' + n++); }
      else order.push(im.src);
    }
    fd.append('order', JSON.stringify(order));
    try {
      const p = form.id ? await api('PATCH', '/api/partners/' + form.id, fd) : await api('POST', '/api/partners', fd);
      await refresh();
      fillForm(p);
      say('Saved', 'ok');
    } catch (e) { say(e.message, 'err'); }
    btn.disabled = false;
  }

  async function remove() {
    if (!confirm('Delete ' + ($('#f-name').value || 'this partner') + ' and all of its photos? This cannot be undone.')) return;
    try { await api('DELETE', '/api/partners/' + form.id); await refresh(); fillForm(blank()); say('Deleted', 'ok'); }
    catch (e) { say(e.message, 'err'); }
  }

  $('#new').addEventListener('click', () => fillForm(blank()));
  $('#clear').addEventListener('click', () => fillForm(blank()));
  $('#save').addEventListener('click', save);
  $('#delete').addEventListener('click', remove);
  $('#photo-pick').addEventListener('click', () => $('#photo-file').click());
  $('#photo-file').addEventListener('change', (e) => { addPhotos([...e.target.files]); e.target.value = ''; });
  $('#logo-pick').addEventListener('click', () => $('#logo-file').click());
  $('#logo-file').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { form.logo = await shrink(f, 512, 'image/png'); renderMedia(); } catch (err) { say(err.message, 'err'); }
  });
  $('#logo-clear').addEventListener('click', () => { form.logo = null; renderMedia(); });

  /* ---------- start: use the gallery's own admin login ---------- */
  fetch('/api/me').then((r) => r.json()).then(async (me) => {
    if (!me.admin) { $('#gate').hidden = false; return; }
    $('#app').hidden = false;
    await refresh();
    fillForm(blank());
  }).catch(() => { $('#gate').hidden = false; });
})();
