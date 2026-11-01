// Partners for the Pixel Decorations gallery.
// Plugs into server.js: it reuses your admin login, items.json, /uploads and the GitHub backup.
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const MAX_PHOTOS = 12;

export function createPartners(d) {
  const db = () => d.getDb();

  const view = p => ({
    id: p.id, name: p.name, category: p.category, tagline: p.tagline, description: p.description, website: p.website,
    logo: p.logo?.src || null, images: p.images.map(i => i.src)
  });

  const multiline = (v, max) => String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f<>]/g, '').trim().slice(0, max);

  async function saveFile(f, created) {
    const ext = d.imageExt(f.body);
    const file = `pt_${crypto.randomBytes(6).toString('hex')}.${ext}`;
    await fsp.writeFile(path.join(d.UPLOAD_DIR, file), f.body);
    d.ghTask(() => d.ghPut('uploads/' + file, f.body));
    const rec = { file, src: '/uploads/' + file };
    created.push(rec);
    return rec;
  }

  async function dropFiles(list) {
    for (const f of list) {
      const name = path.basename(f.file);
      try { await fsp.unlink(path.join(d.UPLOAD_DIR, name)); } catch { /* already gone */ }
      d.ghTask(() => d.ghDel('uploads/' + name));
    }
  }

  async function parseForm(req) {
    const bm = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(req.headers['content-type'] || '');
    if (!bm) return { error: 'Expected a form upload.' };
    const parts = d.parseMultipart(await d.readBody(req, d.MAX_BODY), bm[1] || bm[2]);
    const text = n => parts.find(x => x.name === n && x.filename === undefined)?.body.toString('utf8');
    const files = n => parts.filter(x => x.name === n && x.filename);

    const name = d.clean(text('name'), 80);
    if (!name) return { error: 'Add a name for the partner.' };

    let site = String(text('website') || '').trim();
    if (site && !/^https?:\/\//i.test(site)) site = 'https://' + site;
    const website = site ? d.cleanUrl(site) : '';
    if (site && !website) return { error: 'The website link must be a full https:// address.' };

    const logoFile = files('logo')[0] || null;
    const photoFiles = files('photos');
    if (photoFiles.length > MAX_PHOTOS) return { error: `A partner can have up to ${MAX_PHOTOS} photos.` };
    for (const f of [logoFile, ...photoFiles].filter(Boolean)) {
      if (!d.imageExt(f.body)) return { error: `${f.filename} is not a JPG, PNG, WebP or GIF image.` };
      if (f.body.length > d.MAX_FILE) return { error: `${f.filename} is over 10 MB.` };
    }
    return {
      fields: { name, category: d.clean(text('category'), 40), tagline: d.clean(text('tagline'), 140), description: multiline(text('description'), 4000), website },
      logoFile, photoFiles, order: text('order') || '[]', logoMode: text('logo') || ''
    };
  }

  async function api(req, res, p, m) {
    if (p === '/api/partners' && m === 'GET') return d.json(res, 200, { partners: db().partners.map(view) });

    if (!d.isAdmin(req)) return d.json(res, 401, { error: 'Login required' });
    if (m !== 'GET' && !d.sameOrigin(req)) return d.json(res, 403, { error: 'Bad origin' });

    if (p === '/api/partners' && m === 'POST') {
      const form = await parseForm(req);
      if (form.error) return d.json(res, 400, { error: form.error });
      const created = [];
      try {
        const logo = form.logoFile ? await saveFile(form.logoFile, created) : null;
        const images = [];
        for (const f of form.photoFiles) images.push(await saveFile(f, created));
        const entry = { id: 'pt-' + crypto.randomBytes(6).toString('hex'), ...form.fields, logo, images, created: Date.now() };
        db().partners.push(entry);
        await d.saveDb();
        return d.json(res, 200, view(entry));
      } catch (e) { await dropFiles(created); throw e; }
    }

    if (p === '/api/partners/order' && m === 'PUT') {
      const b = JSON.parse((await d.readBody(req, 1024 * 1024)).toString('utf8') || '{}');
      const ids = Array.isArray(b.ids) ? b.ids.map(String) : [];
      const list = db().partners, byId = new Map(list.map(x => [x.id, x]));
      const next = ids.filter(id => byId.has(id)).map(id => byId.get(id));
      for (const x of list) if (!next.includes(x)) next.push(x);
      db().partners = next;
      await d.saveDb();
      return d.json(res, 200, { ok: true });
    }

    const pm = /^\/api\/partners\/([\w-]+)$/.exec(p);
    if (pm) {
      const cur = db().partners.find(x => x.id === pm[1]);
      if (!cur) return d.json(res, 404, { error: 'Not found' });

      if (m === 'PATCH') {
        const form = await parseForm(req);
        if (form.error) return d.json(res, 400, { error: form.error });
        const created = [];
        try {
          const newLogo = form.logoFile ? await saveFile(form.logoFile, created) : null;
          const fresh = [];
          for (const f of form.photoFiles) fresh.push(await saveFile(f, created));

          let order = []; try { order = JSON.parse(form.order); } catch { /* keep empty */ }
          const byClientSrc = new Map(cur.images.map(i => [i.src, i]));
          const images = [];
          for (const o of Array.isArray(order) ? order : []) {
            const rec = typeof o === 'string' && o.startsWith('new:') ? fresh[Number(o.slice(4))] : byClientSrc.get(o);
            if (rec && !images.includes(rec)) images.push(rec);
          }
          for (const f of fresh) if (!images.includes(f)) images.push(f);
          images.length = Math.min(images.length, MAX_PHOTOS);

          const logo = newLogo || (form.logoMode === 'remove' ? null : cur.logo);
          const keep = new Set([...images, logo].filter(Boolean).map(x => x.file));
          const everything = [...cur.images, cur.logo, ...created].filter(Boolean);
          const unused = everything.filter((x, i) => !keep.has(x.file) && everything.findIndex(y => y.file === x.file) === i);

          Object.assign(cur, form.fields, { logo, images });
          await d.saveDb();
          await dropFiles(unused);
          return d.json(res, 200, view(cur));
        } catch (e) { await dropFiles(created); throw e; }
      }

      if (m === 'DELETE') {
        db().partners = db().partners.filter(x => x !== cur);
        await d.saveDb();
        await dropFiles([cur.logo, ...cur.images].filter(Boolean));
        return d.json(res, 200, { ok: true });
      }
    }
    return d.json(res, 404, { error: 'Not found' });
  }

  return { api };
}
