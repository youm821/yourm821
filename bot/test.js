// Offline check of lib.js against a running gallery: GALLERY_URL=http://localhost:3000 BOT_KEY=test node test.js
import assert from 'node:assert/strict';
import { GALLERY, find, sets, random, makePack } from './lib.js';
console.log('Gallery:', GALLERY);
const s = await sets(); assert.ok(s.length > 0, 'at least one set'); console.log('sets:', s.length);
const r = await random(); assert.ok(r.found && r.image.startsWith(GALLERY) && r.url.includes('/d/')); console.log('random:', r.title);
const f = await find(r.title); assert.ok(f.found); assert.equal(f.set, r.set); console.log('find:', f.title, '->', f.url);
const none = await find('zzzz-not-a-thing'); assert.equal(none.found, false); assert.ok(none.sets.length > 0); console.log('miss lists sets:', none.sets.length);
if (process.env.BOT_KEY) { const p = await makePack({ serverId: 'test-1', server: 'Test Server', set: s[0][0] }); assert.ok(p.url.includes('/pack/')); console.log('pack:', p.url); }
console.log('ok');
