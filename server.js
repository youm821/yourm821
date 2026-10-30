const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'site.json');
const PASSCODE = process.env.ADMIN_PASSCODE || '';
const SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_MS = 12 * 60 * 60 * 1000;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!PASSCODE) console.warn('ADMIN_PASSCODE is not set. Nobody can sign in or upload until you set it.');

/* ---------- storage ---------- */
const DEFAULT_SITE = {
  profile: {
    name: 'Your Name',
    tagline: 'What you do, in one line.',
    bio: 'Write a short intro here. Sign in as owner (bottom of the page) to edit this text and add your work.',
    location: '',
    email: '',
    links: []
  },
  theme: { accent: '#2B4EFF', mode: 'light', font: 'bricolage' },
  works: []
};

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return {
      profile: { ...DEFAULT_SITE.profile, ...d.profile },
      theme: { ...DEFAULT_SITE.theme, ...d.theme },
      works: Array.isArray(d.works) ? d.works : []
    };
  } catch {
    return structuredClone(DEFAULT_SITE);
  }
}
function save(data) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
let site = load();
if (!fs.existsSync(DB_FILE)) save(site);

/* ---------- helpers ---------- */
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const safeUrl = (v) => {
  const s = str(v, 500);
  return /^(https?:\/\/|mailto:)/i.test(s) ? s : '';
};
const MIME = {
  'image/jpeg': ['.jpg', 'image'], 'image/png': ['.png', 'image'], 'image/webp': ['.webp', 'image'],
  'image/gif': ['.gif', 'image'], 'video/mp4': ['.mp4', 'video'], 'video/webm': ['.webm', 'video'],
  'audio/mpeg': ['.mp3', 'audio'], 'audio/wav': ['.wav', 'audio'], 'application/pdf': ['.pdf', 'pdf']
};

/* ---------- auth ---------- */
const sign = (p) => crypto.createHmac('sha256', SECRET).update(p).digest('hex');
const safeEq = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
function makeToken() {
  const exp = String(Date.now() + SESSION_MS);
  return exp + '.' + sign(exp);
}
function validToken(t) {
  if (typeof t !== 'string') return false;
  const [exp, sig] = t.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEq(sig, sign(exp));
}
function requireAuth(req, res, next) {
  const t = (req.headers.authorization || '').replace(/^Bearer /, '');
  if (!validToken(t)) return res.status(401).json({ error: 'Please sign in again.' });
  next();
}

const attempts = new Map(); // ip -> {n, reset}
function limited(ip) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || a.reset < now) { attempts.set(ip, { n: 0, reset: now + 15 * 60 * 1000 }); return false; }
  return a.n >= 8;
}

/* ---------- uploads ---------- */
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + MIME[file.mimetype][0])
  }),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    MIME[file.mimetype] ? cb(null, true) : cb(new Error('That file type is not supported. Use JPG, PNG, WebP, GIF, MP4, WebM, MP3, WAV or PDF.'))
});
const removeFile = (name) => {
  if (name) fs.rm(path.join(UPLOAD_DIR, path.basename(name)), { force: true }, () => {});
};

/* ---------- app ---------- */
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json({ limit: '100kb' }));

app.get('/healthz', (req, res) => res.send('ok'));
app.get('/api/site', (req, res) => res.json(site));

app.post('/api/login', (req, res) => {
  if (!PASSCODE) return res.status(503).json({ error: 'The owner passcode has not been set on the server yet.' });
  if (limited(req.ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  if (!safeEq(str(req.body.passcode, 200), PASSCODE)) {
    attempts.get(req.ip).n++;
    return res.status(401).json({ error: 'Wrong passcode.' });
  }
  res.json({ token: makeToken() });
});
app.get('/api/me', requireAuth, (req, res) => res.json({ ok: true }));

app.put('/api/site', requireAuth, (req, res) => {
  const p = req.body.profile || {};
  const t = req.body.theme || {};
  site.profile = {
    name: str(p.name, 80) || 'Your Name',
    tagline: str(p.tagline, 160),
    bio: str(p.bio, 2000),
    location: str(p.location, 80),
    email: str(p.email, 120),
    links: (Array.isArray(p.links) ? p.links : []).slice(0, 8)
      .map((l) => ({ label: str(l.label, 40), url: safeUrl(l.url) })).filter((l) => l.label && l.url)
  };
  site.theme = {
    accent: /^#[0-9a-f]{6}$/i.test(t.accent) ? t.accent : site.theme.accent,
    mode: t.mode === 'dark' ? 'dark' : 'light',
    font: ['bricolage', 'fraunces', 'dmsans'].includes(t.font) ? t.font : 'bricolage'
  };
  save(site);
  res.json(site);
});

function workFields(body) {
  return {
    title: str(body.title, 120) || 'Untitled',
    description: str(body.description, 1000),
    link: safeUrl(body.link)
  };
}

app.post('/api/works', requireAuth, upload.single('file'), (req, res) => {
  const work = { id: crypto.randomBytes(6).toString('hex'), ...workFields(req.body), created: Date.now() };
  if (req.file) { work.file = req.file.filename; work.kind = MIME[req.file.mimetype][1]; }
  site.works.unshift(work);
  save(site);
  res.json(work);
});

app.put('/api/works/:id', requireAuth, upload.single('file'), (req, res) => {
  const w = site.works.find((x) => x.id === req.params.id);
  if (!w) { if (req.file) removeFile(req.file.filename); return res.status(404).json({ error: 'Work not found.' }); }
  Object.assign(w, workFields(req.body));
  if (req.file) {
    removeFile(w.file);
    w.file = req.file.filename;
    w.kind = MIME[req.file.mimetype][1];
  }
  save(site);
  res.json(w);
});

app.delete('/api/works/:id', requireAuth, (req, res) => {
  const i = site.works.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'Work not found.' });
  removeFile(site.works[i].file);
  site.works.splice(i, 1);
  save(site);
  res.json({ ok: true });
});

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => {
  const msg = err.code === 'LIMIT_FILE_SIZE' ? 'That file is over the 100 MB limit.' : err.message || 'Something went wrong.';
  res.status(400).json({ error: msg });
});

app.listen(PORT, () => console.log('Portfolio running on port ' + PORT));
