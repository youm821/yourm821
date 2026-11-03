// Talks to the gallery site. No Yapin' code in here, so it can be tested on its own (npm test).
export const GALLERY = (process.env.GALLERY_URL || 'https://decoration-instanity.onrender.com').replace(/\/+$/, '');

async function call(path, options) {
  // A sleeping free Render service can take a while to wake up, so wait up to 25 seconds.
  const res = await fetch(GALLERY + path, { ...options, signal: AbortSignal.timeout(25000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'The gallery answered with ' + res.status);
  return body;
}

const view = i => ({ id: i.id, title: i.title, set: i.set, image: GALLERY + i.src, url: GALLERY + '/d/' + encodeURIComponent(i.id) });

/** Best match for a name: { found, title, set, image, url, others[], sets[] } */
export const find = q => call('/api/find?q=' + encodeURIComponent(q));

/** [[set name, how many decorations], ...] */
export async function sets() {
  const d = await call('/api/items'), count = new Map();
  for (const i of d.items || []) count.set(i.set, (count.get(i.set) || 0) + 1);
  return [...count];
}

/** One random decoration, in the same shape as find() */
export async function random() {
  const items = ((await call('/api/items')).items || []).filter(i => !i.hidden);
  return items.length ? { found: true, ...view(items[Math.floor(Math.random() * items.length)]) } : { found: false };
}

/** Make or update the pack for one server. Needs BOT_KEY, the same value the gallery has. */
export function makePack({ serverId, server, set }, key = process.env.BOT_KEY) {
  if (!key) throw new Error('BOT_KEY is not set on the bot.');
  return call('/api/bot/packs', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify({ serverId, server, set }) });
}
