// Pixel Decorations gallery: zero dependencies, Node 18+.
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const PASSWORD = process.env.ADMIN_PASSWORD || '';
const DATA_DIR = process.env.DATA_DIR || (fs.existsSync('/data') ? '/data' : path.join(ROOT, 'data'));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'items.json');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SEED_DIR = path.join(ROOT, 'seed');
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('gallery:' + PASSWORD).digest('hex');
const YAPIN = (process.env.YAPIN_BASE || 'https://www.yapin.gg').replace(/\/$/, '');
const Y_ID = process.env.YAPPER_CLIENT_ID || '';
const Y_SECRET = process.env.YAPPER_CLIENT_SECRET || '';
const loginOn = !!(Y_ID && Y_SECRET);
const CB_PATH = (process.env.CALLBACK_PATH || '/auth/callback').replace(/^\/?/, '/'); // must match the redirect URL registered in Yapin'
const MAX_FILE = 10 * 1024 * 1024;
const MAX_BODY = 80 * 1024 * 1024;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- cloud backup (GitHub) ----------
// Optional. With GITHUB_TOKEN + GITHUB_REPO set, every change is copied to a branch of a private repo,
// and a fresh/wiped server restores itself from it on startup. Works on Render's free plan.
const GH_TOKEN = process.env.GITHUB_TOKEN || '';
const GH_REPO = process.env.GITHUB_REPO || '';
const GH_BRANCH = process.env.GITHUB_BRANCH || 'gallery-data';
const GH_API = process.env.GITHUB_API || 'https://api.github.com';
const ghOn = !!(GH_TOKEN && GH_REPO);
const sync = { on: ghOn, repo: GH_REPO, branch: GH_BRANCH, last: null, error: null, pending: 0, restored: false };
async function gh(method, pathq, body, raw) {
  return fetch(`${GH_API}/repos/${GH_REPO}${pathq}`, {
    method,
    headers: { Authorization: 'Bearer ' + GH_TOKEN, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'User-Agent': 'pixel-gallery', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
}
let cloudSafe = !ghOn; // never overwrite the cloud copy until we know what is in it
let branchReady = false;
async function ensureBranch() {
  if (branchReady) return;
  if ((await gh('GET', `/git/ref/heads/${GH_BRANCH}`)).ok) { branchReady = true; return; }
  const repo = await gh('GET', '');
  if (!repo.ok) throw new Error(`GitHub repo not reachable (${repo.status}). Check GITHUB_REPO and the token.`);
  const def = (await repo.json()).default_branch;
  const ref = await gh('GET', `/git/ref/heads/${def}`);
  if (!ref.ok) throw new Error('The repo needs at least one commit (add a README).');
  const made = await gh('POST', '/git/refs', { ref: `refs/heads/${GH_BRANCH}`, sha: (await ref.json()).object.sha });
  if (!made.ok) throw new Error(`Could not create branch (${made.status}).`);
  branchReady = true;
}
const enc = p => p.split('/').map(encodeURIComponent).join('/');
async function ghPut(p, buf) {
  await ensureBranch();
  let sha; const g = await gh('GET', `/contents/${enc(p)}?ref=${encodeURIComponent(GH_BRANCH)}`);
  if (g.ok) sha = (await g.json()).sha;
  const r = await gh('PUT', `/contents/${enc(p)}`, { message: 'gallery: ' + p, content: buf.toString('base64'), branch: GH_BRANCH, sha });
  if (!r.ok) throw new Error(`GitHub save failed (${r.status}) ${(await r.text()).slice(0, 120)}`);
}
async function ghDel(p) {
  await ensureBranch();
  const g = await gh('GET', `/contents/${enc(p)}?ref=${encodeURIComponent(GH_BRANCH)}`);
  if (!g.ok) return;
  await gh('DELETE', `/contents/${enc(p)}`, { message: 'gallery: remove ' + p, sha: (await g.json()).sha, branch: GH_BRANCH });
}
let gq = Promise.resolve();
function ghTask(fn) {
  if (!ghOn) return;
  sync.pending++;
  gq = gq.then(fn).then(() => { sync.last = Date.now(); sync.error = null; })
    .catch(e => { sync.error = String(e.message || e); console.error('cloud sync:', sync.error); })
    .finally(() => { sync.pending--; });
}
let dbTimer;
function pushDb() {
  if (!ghOn || !cloudSafe) return;
  clearTimeout(dbTimer);
  dbTimer = setTimeout(() => ghTask(() => ghPut('items.json', Buffer.from(JSON.stringify(db, null, 1)))), 2500);
}
async function restoreFromCloud(force = false) {
  if (!ghOn) return;
  if (!force && fs.existsSync(DB_FILE)) { cloudSafe = true; return; }
  try {
    await ensureBranch();
    const r = await gh('GET', `/contents/items.json?ref=${encodeURIComponent(GH_BRANCH)}`, null, true);
    if (r.status === 404) { cloudSafe = true; console.log('Cloud backup: nothing saved yet.'); return; }
    if (!r.ok) throw new Error('GitHub answered ' + r.status);
    const remote = JSON.parse(await r.text());
    db = { ...db, ...remote };
    for (const i of [...db.items, ...db.photos, ...db.showcase].filter(x => !x.seed)) {
      const fp = path.join(UPLOAD_DIR, path.basename(i.file));
      if (fs.existsSync(fp)) continue;
      const f = await gh('GET', `/contents/${enc('uploads/' + path.basename(i.file))}?ref=${encodeURIComponent(GH_BRANCH)}`, null, true);
      if (f.ok) await fsp.writeFile(fp, Buffer.from(await f.arrayBuffer()));
    }
    cloudSafe = true; sync.restored = true; sync.error = null; console.log('Restored gallery from GitHub backup.');
  } catch (e) {
    cloudSafe = false; sync.error = 'Could not read the cloud backup yet (' + e.message + '). Saving to it is paused; retrying.';
    console.error(sync.error);
    setTimeout(async () => { await restoreFromCloud(true); if (cloudSafe) { db.settings = { title: 'Pixel Decorations', subtitle: '', ...db.settings }; syncSeed(); syncSeedPhotos(); await saveDb(); } }, 60000).unref();
  }
}
function syncEverything() {
  pushDb();
  for (const i of [...db.items, ...db.photos, ...db.showcase].filter(x => !x.seed)) {
    ghTask(async () => { try { await ghPut('uploads/' + i.file, await fsp.readFile(path.join(UPLOAD_DIR, i.file))); } catch (e) { if (e.code !== 'ENOENT') throw e; } });
  }
}

// ---------- data ----------
let db = { settings: { title: 'Pixel Decorations', subtitle: 'Avatar decorations, made in pixels.' }, items: [], removedSeed: [], photos: [], removedSeedPhotos: [], activePhoto: null, users: [], showcase: [] };
try { db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch { /* first run */ }
await restoreFromCloud();
db.settings = { title: 'Pixel Decorations', subtitle: '', ...db.settings };

function syncSeed() {
  let manifest = [];
  try { manifest = JSON.parse(fs.readFileSync(path.join(SEED_DIR, 'manifest.json'), 'utf8')); } catch { return; }
  const have = new Set(db.items.map(i => i.id));
  const gone = new Set(db.removedSeed);
  const fresh = [];
  for (const m of manifest) {
    const id = m.file.replace(/\.[^.]+$/, '');
    if (have.has(id) || gone.has(id)) continue;
    fresh.push({ id, src: '/seed/' + m.file, file: m.file, title: m.title, set: m.set, hidden: false, seed: true });
  }
  if (fresh.length) { db.items.push(...fresh); }
}
syncSeed();
function syncSeedPhotos() {
  let list = [];
  try { list = JSON.parse(fs.readFileSync(path.join(SEED_DIR, 'photos.json'), 'utf8')); } catch { return; }
  const have = new Set(db.photos.map(p => p.id)), gone = new Set(db.removedSeedPhotos);
  for (const m of list) {
    const id = 'photo-' + m.file.replace(/\.[^.]+$/, '');
    if (have.has(id) || gone.has(id)) continue;
    db.photos.push({ id, src: '/seed/' + m.file, file: m.file, seed: true });
  }
  if (!db.photos.some(p => p.id === db.activePhoto)) db.activePhoto = db.photos[0]?.id || null;
}
syncSeedPhotos();

let saving = Promise.resolve();
function saveDb() {
  saving = saving.then(async () => {
    const tmp = DB_FILE + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(db));
    await fsp.rename(tmp, DB_FILE);
    pushDb();
  }).catch(e => console.error('save failed', e));
  return saving;
}
await saveDb();

const pub = i => ({ id: i.id, src: i.src, title: i.title, set: i.set });
const photoView = p => ({ id: p.id, src: p.src, seed: !!p.seed, active: p.id === db.activePhoto });
const activePhotoSrc = () => db.photos.find(p => p.id === db.activePhoto)?.src || null;
const adminView = i => ({ ...pub(i), hidden: !!i.hidden, seed: !!i.seed });

// ---------- auth ----------
const sign = p => crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
const makeToken = () => { const p = String(Date.now() + 7 * 864e5); return p + '.' + sign(p); };
function checkToken(t) {
  if (!t) return false;
  const [p, s] = t.split('.');
  if (!p || !s) return false;
  const a = Buffer.from(s), b = Buffer.from(sign(p));
  return a.length === b.length && crypto.timingSafeEqual(a, b) && Number(p) > Date.now();
}
function cookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
const isOwner = req => !!PASSWORD && checkToken(cookies(req).sid); // logged in with the admin password
const isAdmin = req => isOwner(req) || !!userFromReq(req)?.admin; // owner, or a Yapin' account the owner made an admin
function passwordOk(input) {
  const a = crypto.createHash('sha256').update(String(input)).digest();
  const b = crypto.createHash('sha256').update(PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}
const attempts = new Map();
function limited(ip) {
  const now = Date.now(); const a = attempts.get(ip);
  if (!a || a.reset < now) { attempts.set(ip, { n: 0, reset: now + 10 * 60 * 1000 }); return false; }
  return a.n >= 8;
}
const failed = ip => { const a = attempts.get(ip); if (a) a.n++; };
const clientIp = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
function sameOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}
const isHttps = req => req.headers['x-forwarded-proto'] === 'https';
const baseUrl = req => (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `${isHttps(req) ? 'https' : 'http'}://${req.headers.host}`).replace(/\/$/, '');
const secure = req => (isHttps(req) ? '; Secure' : '');
const makeUserToken = id => { const p = `${id}.${Date.now() + 30 * 864e5}`; return p + '.' + sign('u:' + p); };
function userFromReq(req) {
  const t = cookies(req).usid; if (!t) return null;
  const i = t.lastIndexOf('.'); if (i < 1) return null;
  const p = t.slice(0, i), a = Buffer.from(t.slice(i + 1)), b = Buffer.from(sign('u:' + p));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const j = p.lastIndexOf('.');
  if (!(Number(p.slice(j + 1)) > Date.now())) return null;
  const id = p.slice(0, j);
  return db.users.find(u => u.id === id) || null;
}
const pubUser = u => (u ? { id: u.id, username: u.username, display_name: u.display_name, avatar_url: u.avatar_url } : null);
const okUrl = u => (typeof u === 'string' && /^https:\/\/[^\s"'()<>\\]{1,480}$/.test(u) ? u : null);

// ---------- http helpers ----------
const SEC = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'"
};
function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  res.writeHead(status, { 'Content-Length': buf.length, 'Content-Type': 'text/plain; charset=utf-8', ...SEC, ...headers });
  res.end(res.req.method === 'HEAD' ? undefined : buf);
}
const json = (res, status, obj, headers = {}) =>
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > limit) { reject(Object.assign(new Error('Too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req) {
  const buf = await readBody(req, 1024 * 1024);
  try { return JSON.parse(buf.toString('utf8') || '{}'); } catch { throw Object.assign(new Error('Bad JSON'), { code: 400 }); }
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.gif': 'image/gif', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const TEXTY = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);

async function serveStatic(req, res, base, rel, cache) {
  let p; try { p = decodeURIComponent(rel); } catch { return send(res, 400, 'Bad request'); }
  const full = path.resolve(base, p);
  if (!full.startsWith(base + path.sep)) return send(res, 404, 'Not found');
  let st; try { st = await fsp.stat(full); } catch { return send(res, 404, 'Not found'); }
  if (!st.isFile()) return send(res, 404, 'Not found');
  const ext = path.extname(full).toLowerCase();
  const etag = '"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"';
  const base_h = { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache, ETag: etag, ...SEC };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, base_h); return res.end(); }
  if (TEXTY.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    const gz = await new Promise((ok, no) => zlib.gzip(fs.readFileSync(full), (e, b) => e ? no(e) : ok(b)));
    return send(res, 200, gz, { ...base_h, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
  }
  res.writeHead(200, { ...base_h, 'Content-Length': st.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(full).pipe(res);
}

// ---------- multipart + zip ----------
function parseMultipart(buf, boundary) {
  const delim = Buffer.from('--' + boundary); const parts = [];
  let pos = buf.indexOf(delim);
  while (pos !== -1) {
    let start = pos + delim.length;
    if (buf[start] === 45 && buf[start + 1] === 45) break;
    if (buf[start] === 13 && buf[start + 1] === 10) start += 2;
    const next = buf.indexOf(delim, start);
    if (next === -1) break;
    const end = next - 2; const headEnd = buf.indexOf('\r\n\r\n', start);
    if (headEnd !== -1 && headEnd <= end) {
      const head = buf.slice(start, headEnd).toString('utf8');
      const name = /name="([^"]*)"/i.exec(head)?.[1];
      const filename = /filename="([^"]*)"/i.exec(head)?.[1];
      parts.push({ name, filename, body: buf.slice(headEnd + 4, end) });
    }
    pos = next;
  }
  return parts;
}
function imageExt(b) {
  if (b.length > 12 && b.slice(0, 4).toString('latin1') === 'GIF8') return 'gif';
  if (b.length > 12 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';
  if (b.length > 12 && b[0] === 0x89 && b.slice(1, 4).toString('latin1') === 'PNG') return 'png';
  if (b.length > 12 && b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function buildZip(entries) {
  const out = [], central = []; let off = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name), crc = crc32(e.data), size = e.data.length;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(0x21, 12);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(size, 18); lh.writeUInt32LE(size, 22); lh.writeUInt16LE(name.length, 26);
    out.push(lh, name, e.data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(size, 20); ch.writeUInt32LE(size, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(off, 42);
    central.push(ch, name);
    off += 30 + name.length + size;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...out, cd, end]);
}

// ---------- api ----------
const clean = (s, max) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const titleFrom = name => clean(name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), 80) || 'Untitled';

function dims(buf, ext) {
  try { if (ext === 'gif') return [buf.readUInt16LE(6), buf.readUInt16LE(8)]; if (ext === 'png') return [buf.readUInt32BE(16), buf.readUInt32BE(20)]; } catch { /* short file */ }
  return null;
}
const userBy = id => { const u = db.users.find(x => x.id === id); return u ? { name: u.display_name || u.username || 'Someone', username: u.username, avatar_url: u.avatar_url } : null; };
const scView = (x, me) => ({ id: x.id, src: x.src, title: x.title, status: x.status, mine: !!(me && x.ownerId === me.id), by: userBy(x.ownerId) || { name: x.ownerName || 'Someone', username: null, avatar_url: null } });
async function removeShowcase(id) {
  const x = db.showcase.find(i => i.id === id); if (!x) return;
  try { await fsp.unlink(path.join(UPLOAD_DIR, path.basename(x.file))); } catch { /* gone */ }
  ghTask(() => ghDel('uploads/' + path.basename(x.file)));
  db.showcase = db.showcase.filter(i => i.id !== id); await saveDb();
}

async function api(req, res, p, m) {
  if (p === '/api/items' && m === 'GET') return json(res, 200, { settings: db.settings, photo: activePhotoSrc(), items: db.items.filter(i => !i.hidden).map(pub) });
  if (p === '/api/me' && m === 'GET') return json(res, 200, { admin: isAdmin(req), owner: isOwner(req), configured: !!PASSWORD, login: loginOn, user: pubUser(userFromReq(req)) });
  if (p === '/api/user/logout' && m === 'POST') {
    if (!sameOrigin(req)) return json(res, 403, { error: 'Bad origin' });
    return json(res, 200, { ok: true }, { 'Set-Cookie': `usid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure(req)}` });
  }

  if (p === '/api/login' && m === 'POST') {
    if (!PASSWORD) return json(res, 503, { error: 'ADMIN_PASSWORD is not set on the server.' });
    if (!sameOrigin(req)) return json(res, 403, { error: 'Bad origin' });
    const ip = clientIp(req);
    if (limited(ip)) return json(res, 429, { error: 'Too many tries. Wait 10 minutes.' });
    const body = await readJson(req);
    if (!passwordOk(body.password ?? '')) { failed(ip); return json(res, 401, { error: 'Wrong password' }); }
    attempts.delete(ip);
    return json(res, 200, { ok: true }, { 'Set-Cookie': `sid=${makeToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${isHttps(req) ? '; Secure' : ''}` });
  }
  if (p === '/api/logout' && m === 'POST')
    return json(res, 200, { ok: true }, { 'Set-Cookie': ['sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0', `usid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure(req)}`] });

  if (p === '/api/showcase' && m === 'GET') {
    const me = userFromReq(req);
    return json(res, 200, { enabled: loginOn, auto: !!db.settings.showcaseAuto, items: db.showcase.filter(x => x.status === 'approved' || (me && x.ownerId === me.id)).map(x => scView(x, me)) });
  }
  if (p === '/api/showcase' && m === 'POST') {
    const me = userFromReq(req);
    if (!me) return json(res, 401, { error: 'Log in with Yapin\u2019 first.' });
    if (!sameOrigin(req)) return json(res, 403, { error: 'Bad origin' });
    const mine = db.showcase.filter(x => x.ownerId === me.id);
    if (mine.length >= 12) return json(res, 400, { error: 'You can have up to 12 works up at once. Delete one first.' });
    if (mine.filter(x => Date.now() - x.created < 3600e3).length >= 5) return json(res, 429, { error: 'Slow down. Try again in a little while.' });
    const bm = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(req.headers['content-type'] || '');
    if (!bm) return json(res, 400, { error: 'Expected an upload' });
    const parts = parseMultipart(await readBody(req, 6 * 1024 * 1024), bm[1] || bm[2]);
    const f = parts.find(x => x.name === 'file' && x.filename);
    if (!f) return json(res, 400, { error: 'Choose a file first.' });
    const ext = imageExt(f.body);
    if (!ext || ext === 'jpg') return json(res, 400, { error: 'GIF, PNG or WebP only.' });
    if (f.body.length > 5 * 1024 * 1024) return json(res, 400, { error: 'That file is over 5 MB.' });
    const d = dims(f.body, ext);
    if (d && (d[0] > 1024 || d[1] > 1024 || d[0] < 16 || d[1] < 16)) return json(res, 400, { error: 'Keep it between 16 and 1024 pixels on each side.' });
    const id = crypto.randomBytes(6).toString('hex'), file = `sc_${id}.${ext}`;
    await fsp.writeFile(path.join(UPLOAD_DIR, file), f.body);
    ghTask(() => ghPut('uploads/' + file, f.body));
    const title = clean(parts.find(x => x.name === 'title' && x.filename === undefined)?.body.toString('utf8'), 60) || titleFrom(f.filename);
    const entry = { id: 'sc-' + id, src: '/uploads/' + file, file, title, ownerId: me.id, ownerName: me.display_name || me.username || '', status: db.settings.showcaseAuto ? 'approved' : 'pending', created: Date.now() };
    db.showcase.unshift(entry); await saveDb();
    return json(res, 200, scView(entry, me));
  }
  let sm;
  if ((sm = /^\/api\/showcase\/([\w-]+)$/.exec(p)) && m === 'DELETE') {
    const me = userFromReq(req), x = db.showcase.find(i => i.id === sm[1]);
    if (!me || !x || x.ownerId !== me.id) return json(res, 404, { error: 'Not found' });
    if (!sameOrigin(req)) return json(res, 403, { error: 'Bad origin' });
    await removeShowcase(x.id); return json(res, 200, { ok: true });
  }

  if (!isAdmin(req)) return json(res, 401, { error: 'Login required' });
  if (m !== 'GET' && !sameOrigin(req)) return json(res, 403, { error: 'Bad origin' });

  if (p === '/api/admin/items' && m === 'GET') return json(res, 200, { settings: db.settings, items: db.items.map(adminView) });

  if (p === '/api/settings' && m === 'PUT') {
    const b = await readJson(req);
    db.settings = { title: clean(b.title, 60) || 'Pixel Decorations', subtitle: clean(b.subtitle, 160), showcaseAuto: !!b.showcaseAuto };
    await saveDb(); return json(res, 200, db.settings);
  }

  if (p === '/api/upload' && m === 'POST') {
    const ct = req.headers['content-type'] || '';
    const bm = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ct);
    if (!bm) return json(res, 400, { error: 'Expected multipart upload' });
    const parts = parseMultipart(await readBody(req, MAX_BODY), bm[1] || bm[2]);
    const field = n => parts.find(x => x.name === n && x.filename === undefined)?.body.toString('utf8');
    const set = clean(field('set'), 40) || 'Uploads';
    const customTitle = clean(field('title'), 80);
    const files = parts.filter(x => x.name === 'files' && x.filename);
    if (!files.length) return json(res, 400, { error: 'No files received' });
    const added = [], rejected = [];
    for (const f of files.slice(0, 60)) {
      const ext = imageExt(f.body);
      if (!ext || ext === 'jpg') { rejected.push(f.filename + ' (not a GIF, PNG or WebP)'); continue; }
      if (f.body.length > MAX_FILE) { rejected.push(f.filename + ' (over 10 MB)'); continue; }
      const id = crypto.randomBytes(6).toString('hex');
      await fsp.writeFile(path.join(UPLOAD_DIR, `${id}.${ext}`), f.body);
      ghTask(() => ghPut(`uploads/${id}.${ext}`, f.body));
      added.push({ id, src: `/uploads/${id}.${ext}`, file: `${id}.${ext}`, title: (files.length === 1 && customTitle) || titleFrom(f.filename), set, hidden: false, seed: false });
    }
    db.items.unshift(...added);
    await saveDb();
    return json(res, 200, { added: added.map(adminView), rejected });
  }

  if (p === '/api/admin/photos' && m === 'GET') return json(res, 200, { photos: db.photos.map(photoView) });
  if (p === '/api/photos' && m === 'POST') {
    const bm = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(req.headers['content-type'] || '');
    if (!bm) return json(res, 400, { error: 'Expected multipart upload' });
    const files = parseMultipart(await readBody(req, MAX_BODY), bm[1] || bm[2]).filter(x => x.name === 'files' && x.filename);
    if (!files.length) return json(res, 400, { error: 'No files received' });
    const added = [], rejected = [];
    for (const f of files.slice(0, 10)) {
      const ext = imageExt(f.body);
      if (!ext) { rejected.push(f.filename + ' (not an image)'); continue; }
      if (f.body.length > MAX_FILE) { rejected.push(f.filename + ' (over 10 MB)'); continue; }
      const id = crypto.randomBytes(6).toString('hex'), file = `ph_${id}.${ext}`;
      await fsp.writeFile(path.join(UPLOAD_DIR, file), f.body);
      ghTask(() => ghPut('uploads/' + file, f.body));
      added.push({ id: 'photo-' + id, src: '/uploads/' + file, file, seed: false });
    }
    db.photos.push(...added);
    if (added.length) db.activePhoto = added[added.length - 1].id;
    await saveDb();
    return json(res, 200, { added: added.map(photoView), rejected });
  }
  if (p === '/api/admin/users' && m === 'GET')
    return json(res, 200, { login: loginOn, redirectUrl: baseUrl(req) + CB_PATH, yapin: YAPIN, hasId: !!Y_ID, hasSecret: !!Y_SECRET, lastError: loginDiag.error, lastErrorAt: loginDiag.at, owner: isOwner(req), users: [...db.users].sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0)).map(u => ({ ...pubUser(u), admin: !!u.admin, firstSeen: u.firstSeen, lastLogin: u.lastLogin })) });
  if (p === '/api/admin/showcase' && m === 'GET') return json(res, 200, { auto: !!db.settings.showcaseAuto, items: db.showcase.map(x => scView(x, null)) });
  let am;
  if ((am = /^\/api\/admin\/users\/([\w-]{1,64})\/admin$/.exec(p)) && m === 'PUT') {
    if (!isOwner(req)) return json(res, 403, { error: 'Only the main admin (password login) can make or remove admins.' });
    const u = db.users.find(x => x.id === am[1]); if (!u) return json(res, 404, { error: 'Not found' });
    const b = await readJson(req); u.admin = !!b.admin;
    await saveDb();
    return json(res, 200, { ok: true, admin: u.admin });
  }
  if ((am = /^\/api\/admin\/showcase\/([\w-]+)$/.exec(p))) {
    const x = db.showcase.find(i => i.id === am[1]);
    if (!x) return json(res, 404, { error: 'Not found' });
    if (m === 'PATCH') { const b = await readJson(req); if (b.status === 'approved' || b.status === 'pending') x.status = b.status; await saveDb(); return json(res, 200, scView(x, null)); }
    if (m === 'DELETE') { await removeShowcase(x.id); return json(res, 200, { ok: true }); }
  }
  if (p === '/api/status' && m === 'GET')
    return json(res, 200, { uptime: Math.round(process.uptime()), node: process.version, rssMB: Math.round(process.memoryUsage().rss / 1048576), keep });
  let um;
  if ((um = /^\/api\/users\/([\w-]+)$/.exec(p)) && m === 'DELETE') {
    db.users = db.users.filter(u => u.id !== um[1]); await saveDb(); return json(res, 200, { ok: true });
  }
  let pm;
  if ((pm = /^\/api\/photos\/([\w-]+)$/.exec(p))) {
    const ph = db.photos.find(x => x.id === pm[1]);
    if (!ph) return json(res, 404, { error: 'Not found' });
    if (m === 'PATCH') { db.activePhoto = ph.id; await saveDb(); return json(res, 200, photoView(ph)); }
    if (m === 'DELETE') {
      if (ph.seed) db.removedSeedPhotos.push(ph.id);
      else { try { await fsp.unlink(path.join(UPLOAD_DIR, path.basename(ph.file))); } catch { /* gone */ } ghTask(() => ghDel('uploads/' + path.basename(ph.file))); }
      db.photos = db.photos.filter(x => x.id !== ph.id);
      if (db.activePhoto === ph.id) db.activePhoto = db.photos[0]?.id || null;
      await saveDb(); return json(res, 200, { ok: true });
    }
  }

  let mm;
  if ((mm = /^\/api\/items\/([\w-]+)$/.exec(p))) {
    const item = db.items.find(i => i.id === mm[1]);
    if (!item) return json(res, 404, { error: 'Not found' });
    if (m === 'PATCH') {
      const b = await readJson(req);
      if ('title' in b) item.title = clean(b.title, 80) || item.title;
      if ('set' in b) item.set = clean(b.set, 40) || item.set;
      if ('hidden' in b) item.hidden = !!b.hidden;
      await saveDb(); return json(res, 200, adminView(item));
    }
    if (m === 'DELETE') { await removeItems([item.id]); return json(res, 200, { ok: true }); }
  }

  if (p === '/api/bulk' && m === 'POST') {
    const b = await readJson(req);
    const ids = new Set(Array.isArray(b.ids) ? b.ids.map(String) : []);
    const hit = db.items.filter(i => ids.has(i.id));
    if (b.action === 'delete') await removeItems(hit.map(i => i.id));
    else if (b.action === 'hide' || b.action === 'show') { hit.forEach(i => { i.hidden = b.action === 'hide'; }); await saveDb(); }
    else if (b.action === 'move') { const s = clean(b.set, 40); if (!s) return json(res, 400, { error: 'Pick a set name' }); hit.forEach(i => { i.set = s; }); await saveDb(); }
    else return json(res, 400, { error: 'Unknown action' });
    return json(res, 200, { ok: true, count: hit.length });
  }

  if (p === '/api/sync' && m === 'GET') return json(res, 200, { on: sync.on, repo: sync.repo, branch: sync.branch, last: sync.last, error: sync.error, pending: sync.pending, restored: sync.restored });
  if (p === '/api/sync' && m === 'POST') { if (!ghOn) return json(res, 400, { error: 'Cloud backup is not set up.' }); syncEverything(); return json(res, 200, { ok: true }); }

  if (p === '/api/backup.zip' && m === 'GET') {
    const entries = [{ name: 'items.json', data: Buffer.from(JSON.stringify(db, null, 1)) }];
    for (const i of [...db.items, ...db.photos, ...db.showcase]) if (!i.seed) { try { entries.push({ name: 'uploads/' + i.file, data: await fsp.readFile(path.join(UPLOAD_DIR, i.file)) }); } catch { /* missing file */ } }
    return send(res, 200, buildZip(entries), { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="gallery-backup.zip"', 'Cache-Control': 'no-store' });
  }
  return json(res, 404, { error: 'Not found' });
}
async function removeItems(ids) {
  const set = new Set(ids);
  for (const i of db.items.filter(x => set.has(x.id))) {
    if (i.seed) db.removedSeed.push(i.id);
    else { try { await fsp.unlink(path.join(UPLOAD_DIR, path.basename(i.file))); } catch { /* already gone */ } ghTask(() => ghDel('uploads/' + path.basename(i.file))); }
  }
  db.items = db.items.filter(x => !set.has(x.id));
  await saveDb();
}

// ---------- Login with Yapin' ----------
const stateCookie = (v, req, age) => `oauth_state=${v}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${secure(req)}`; // Lax: the return trip from Yapin' is a cross-site redirect
function startLogin(req, res) {
  const next = new URL(req.url, 'http://x').searchParams.get('next') === 'admin' ? 'admin' : '';
  if (!loginOn) return send(res, 503, 'Login with Yapin\u2019 is not set up on this server yet.');
  const state = crypto.randomBytes(16).toString('hex');
  const q = new URLSearchParams({ client_id: Y_ID, redirect_uri: baseUrl(req) + CB_PATH, response_type: 'code', scope: 'identify', state });
  res.writeHead(302, { Location: `${YAPIN}/oauth/authorize?${q}`, 'Set-Cookie': [stateCookie(state, req, 600), `oauth_next=${next}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600${secure(req)}`], 'Cache-Control': 'no-store', ...SEC });
  res.end();
}
const loginDiag = { at: null, error: null };
const loginFail = why => { loginDiag.at = Date.now(); loginDiag.error = why; console.error('login failed:', why); };
async function finishLogin(req, res, url) {
  const back = m => { res.writeHead(302, { Location: '/?login=' + m, 'Set-Cookie': stateCookie('', req, 0), 'Cache-Control': 'no-store', ...SEC }); res.end(); };
  if (!loginOn) return back('failed');
  const q = url.searchParams, state = q.get('state') || '', saved = cookies(req).oauth_state || '';
  const a = Buffer.from(state), b = Buffer.from(saved);
  if (!saved || a.length !== b.length || !crypto.timingSafeEqual(a, b)) { loginFail('The browser lost its login cookie on the way back (state mismatch). Try again in a normal, non-private tab and make sure cookies are allowed.'); return back('failed'); }
  if (q.get('error')) { if (q.get('error') !== 'access_denied') loginFail('Yapin\u2019 sent back an error: ' + clean(q.get('error') + ' ' + (q.get('error_description') || ''), 200)); return back(q.get('error') === 'access_denied' ? 'cancelled' : 'failed'); }
  const code = q.get('code'); if (!code) return back('failed');
  try {
    const tr = await fetch(`${YAPIN}/api/oauth/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: baseUrl(req) + CB_PATH, client_id: Y_ID, client_secret: Y_SECRET })
    });
    if (!tr.ok) { const t = clean(await tr.text().catch(() => ''), 200); throw new Error(`Yapin\u2019 refused the code swap (HTTP ${tr.status}${t ? ': ' + t : ''}). Usually the redirect URL registered in Yapin\u2019 doesn\u2019t match ${baseUrl(req)}${CB_PATH} exactly, or the client secret is wrong.`); }
    const { access_token } = await tr.json();
    if (!access_token) throw new Error('no access token');
    const mr = await fetch(`${YAPIN}/api/oauth/me`, { headers: { Authorization: 'Bearer ' + access_token }, signal: AbortSignal.timeout(10000) });
    if (!mr.ok) throw new Error(`Yapin\u2019 would not return the profile (HTTP ${mr.status}).`);
    const me = await mr.json(), id = String(me.id ?? '');
    if (!/^[\w-]{1,64}$/.test(id)) throw new Error('unexpected id');
    let u = db.users.find(x => x.id === id);
    if (!u) { u = { id, firstSeen: Date.now() }; db.users.push(u); }
    Object.assign(u, { username: clean(me.username, 40), display_name: me.display_name ? clean(me.display_name, 60) : null, avatar_url: okUrl(me.avatar_url), lastLogin: Date.now() });
    await saveDb();
    res.writeHead(302, { Location: cookies(req).oauth_next === 'admin' ? '/admin' : '/?login=ok', 'Set-Cookie': [`usid=${makeUserToken(id)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure(req)}`, stateCookie('', req, 0)], 'Cache-Control': 'no-store', ...SEC });
    res.end();
  } catch (e) { loginFail(e.name === 'TimeoutError' ? `Could not reach ${YAPIN} (timed out). Check YAPIN_BASE.` : String(e.message || e)); back('failed'); }
}

// ---------- server ----------
async function handle(req, res) {
  const p = new URL(req.url, 'http://x').pathname, m = req.method;
  if (p === '/healthz') return send(res, 200, 'ok', { 'Cache-Control': 'no-store' });
  if (p === '/login' && m === 'GET') return startLogin(req, res);
  if ((p === CB_PATH || p === '/callback' || p === '/auth/callback') && m === 'GET') return finishLogin(req, res, new URL(req.url, 'http://x'));
  if (p.startsWith('/api/')) return api(req, res, p, m);
  if (m !== 'GET' && m !== 'HEAD') return send(res, 405, 'Method not allowed');
  if (p === '/') return serveStatic(req, res, PUBLIC_DIR, 'index.html', 'no-cache');
  if (p === '/admin') return serveStatic(req, res, PUBLIC_DIR, 'admin.html', 'no-cache');
  if (p.startsWith('/seed/')) return serveStatic(req, res, SEED_DIR, p.slice(6), 'public, max-age=86400');
  if (p.startsWith('/uploads/')) return serveStatic(req, res, UPLOAD_DIR, p.slice(9), 'public, max-age=86400');
  return serveStatic(req, res, PUBLIC_DIR, p.slice(1), 'no-cache');
}
const server = http.createServer((req, res) => {
  handle(req, res).catch(e => {
    if (e && e.code === 413) return json(res, 413, { error: 'Upload too large' });
    if (e && e.code === 400) return json(res, 400, { error: e.message });
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: 'Server error' }); else res.end();
  });
});
// ---------- keep awake ----------
// Render's free plan sleeps a site after 15 minutes without a visitor. This makes the site visit itself
// through its public address every few minutes, which counts as a visit. (It can only keep an awake site awake.)
const KEEP_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
const KEEP_MIN = Number(process.env.KEEP_ALIVE_MINUTES) || 4;
const keep = { on: !!KEEP_URL && process.env.KEEP_ALIVE !== '0', url: KEEP_URL, everyMin: KEEP_MIN, last: null, ok: null, error: null, count: 0 };
async function pingSelf() {
  try {
    const r = await fetch(KEEP_URL + '/healthz', { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'pixel-gallery-keepalive' } });
    keep.ok = r.ok; keep.error = r.ok ? null : 'HTTP ' + r.status;
  } catch (e) { keep.ok = false; keep.error = String(e.message || e); }
  keep.last = Date.now(); keep.count++;
}
if (keep.on) { setTimeout(pingSelf, 45000).unref(); setInterval(pingSelf, KEEP_MIN * 60 * 1000).unref(); }

server.keepAliveTimeout = 65000; // longer than Render's proxy idle timeout
server.headersTimeout = 66000;
server.listen(PORT, '0.0.0.0', () => console.log(`Gallery on :${PORT}  data=${DATA_DIR}  admin=${PASSWORD ? 'on' : 'DISABLED (set ADMIN_PASSWORD)'}`));

// Never die on a stray error; shut down cleanly when Render redeploys.
process.on('uncaughtException', e => console.error('uncaught', e));
process.on('unhandledRejection', e => console.error('unhandled', e));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 8000).unref(); });