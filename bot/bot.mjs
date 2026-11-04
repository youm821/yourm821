import { Client, EmbedBuilder } from 'yapin.js';
import { GALLERY, find, sets, random, makePack } from './lib.mjs';

// Prints the moment the bot file starts, before logging in. If this line is missing from the logs, the site never started the bot.
console.log('\u25B6\uFE0F  Gallery bot file started at ' + new Date().toISOString());
console.log('   Token set: ' + ((process.env.YAPIN_TOKEN || process.env.YAPPER_BOT_TOKEN) ? 'yes' : 'NO') + ' | BOT_KEY set: ' + (process.env.BOT_KEY ? 'yes' : 'no') + ' | Node ' + process.version);

// Works as /random and as .random
const client = new Client({ prefixes: ['/', '.'], commands: { help: true } });
const ORANGE = '#fc6a39';
const STARTED_AT = Date.now();

// Every answer is an embed card with the picture inside it.
// Yapin' only accepts embed pictures from some hosts. If it refuses the gallery's address, the bot falls back (once, then remembers)
// to a plain image link above the card, which Yapin' still shows as a picture.
let embedPictures = true;
const embedFor = (d, withImage, extra) => {
  const e = new EmbedBuilder().setTitle(d.title).setURL(d.url).setDescription('Set: ' + d.set).setColor(ORANGE).setFooter({ text: 'Pixel Decorations' });
  if (extra) e.addFields({ name: 'Also close', value: extra });
  if (withImage) e.setImage(d.image);
  return e;
};
async function show(ctx, d, heading) {
  const extra = d.others?.length ? d.others.join(', ') : '';
  if (embedPictures) {
    try { return await ctx.reply({ content: heading, embeds: [embedFor(d, true, extra)] }); }
    catch (err) { embedPictures = false; console.warn('Yapin\u2019 refused the picture inside the card, using a plain image link instead:', err?.message || err); }
  }
  return ctx.reply({ content: (heading ? heading + '\n' : '') + d.image, embeds: [embedFor(d, false, extra)] });
}

const formatDuration = ms => {
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return [d && d + 'd', (d || h) && h + 'h', m + 'm'].filter(Boolean).join(' ');
};

// ---------------------------------------------------------------- existing commands

client.commands.register({
  name: 'decoration',
  description: 'Show a decoration from the gallery, like /decoration bear santa',
  category: 'Gallery',
  aliases: ['deco'],
  options: [{ name: 'name', rest: true, required: true, description: 'Part of its name' }],
  cooldown: 3,
  examples: ['/decoration bear santa'],
  async run(ctx) {
    const d = await find(ctx.values.name);
    if (!d.found) return ctx.reply('No decoration matches that. Try /sets to see the sets: ' + (d.sets || []).slice(0, 8).join(', '));
    return show(ctx, d);
  },
});

client.commands.register({
  name: 'random',
  description: 'Show a random decoration',
  category: 'Gallery',
  cooldown: 3,
  async run(ctx) { const d = await random(); return d.found ? show(ctx, d) : ctx.reply('The gallery is empty.'); },
});

client.commands.register({
  name: 'sets',
  description: 'List the sets in the gallery',
  category: 'Gallery',
  cooldown: 5,
  async run(ctx) {
    const list = await sets();
    const total = list.reduce((n, [, c]) => n + c, 0);
    return ctx.reply({ embeds: [new EmbedBuilder().setTitle('Sets').setURL(GALLERY + '/gallery').setColor(ORANGE).setDescription(list.map(([n, c]) => '**' + n + '** (' + c + ')').join('\n') || 'Nothing yet.').setFooter({ text: total + ' decorations. Use /decoration <name> to look one up' })] });
  },
});

client.commands.register({
  name: 'gallery',
  description: 'Link to the gallery',
  category: 'Gallery',
  run: ctx => ctx.reply(GALLERY + '/gallery'),
});

client.commands.register({
  name: 'pack',
  description: 'Recommend a set to this server, like /pack Starter Pack',
  category: 'Gallery',
  serverOnly: true,
  permissions: ['manage_server'], // the server owner always passes
  options: [{ name: 'set', rest: true, required: true, description: 'The name of a set (see /sets)' }],
  cooldown: 10,
  examples: ['/pack Starter Pack'],
  async run(ctx) {
    const wanted = ctx.values.set.trim().toLowerCase(), known = await sets();
    const match = known.find(([n]) => n.toLowerCase() === wanted) || known.find(([n]) => n.toLowerCase().includes(wanted));
    if (!match) return ctx.reply('There is no set called that. Sets: ' + known.map(([n]) => n).join(', '));
    const serverId = ctx.server?.id ?? ctx.message.serverId;
    const pack = await makePack({ serverId: String(serverId), server: ctx.server?.name ?? 'This server', set: match[0] });
    return ctx.reply('Done. Share this link with your members: ' + pack.url);
  },
});

// ---------------------------------------------------------------- new commands

// /daily: the same decoration for everyone until the day changes (UTC). Kept in memory, so it resets if the bot restarts.
let daily = { day: '', d: null };
client.commands.register({
  name: 'daily',
  description: 'The decoration of the day',
  category: 'Gallery',
  aliases: ['today'],
  cooldown: 5,
  async run(ctx) {
    const day = new Date().toISOString().slice(0, 10);
    if (daily.day !== day || !daily.d) {
      const d = await random();
      if (!d.found) return ctx.reply('The gallery is empty.');
      daily = { day, d };
    }
    return show(ctx, daily.d, '\u2B50 Decoration of the day (' + day + ')');
  },
});

// /compare bear santa | cat witch  -> two cards in one reply
client.commands.register({
  name: 'compare',
  description: 'Show two decorations side by side, separated by |',
  category: 'Gallery',
  options: [{ name: 'names', rest: true, required: true, description: 'Two names separated by |' }],
  cooldown: 5,
  examples: ['/compare bear santa | cat witch'],
  async run(ctx) {
    const parts = ctx.values.names.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length !== 2) return ctx.reply('Give me exactly two names separated by |, like /compare bear santa | cat witch');
    const [a, b] = await Promise.all(parts.map(p => find(p)));
    const missing = [[parts[0], a], [parts[1], b]].filter(([, d]) => !d.found).map(([p]) => '"' + p + '"');
    if (missing.length) return ctx.reply('No decoration matches ' + missing.join(' and ') + '.');
    try { return await ctx.reply({ embeds: [embedFor(a, true), embedFor(b, true)] }); }
    catch (err) {
      console.warn('Compare could not use card pictures:', err?.message || err);
      return ctx.reply({ content: a.image + '\n' + b.image, embeds: [embedFor(a, false), embedFor(b, false)] });
    }
  },
});

// /link: just the page address, handy for pasting
client.commands.register({
  name: 'link',
  description: 'Get the link to a decoration',
  category: 'Gallery',
  options: [{ name: 'name', rest: true, required: true, description: 'Part of its name' }],
  cooldown: 3,
  examples: ['/link bear santa'],
  async run(ctx) {
    const d = await find(ctx.values.name);
    return d.found ? ctx.reply(d.title + ': ' + d.url) : ctx.reply('No decoration matches that.');
  },
});

// /randomset: pick a set at random
client.commands.register({
  name: 'randomset',
  description: 'Suggest a random set to browse',
  category: 'Gallery',
  cooldown: 5,
  async run(ctx) {
    const list = await sets();
    if (!list.length) return ctx.reply('There are no sets yet.');
    const [name, count] = list[Math.floor(Math.random() * list.length)];
    return ctx.reply('Try **' + name + '** (' + count + ' decorations). Browse it at ' + GALLERY + '/gallery');
  },
});

// /topsets: the biggest sets first
client.commands.register({
  name: 'topsets',
  description: 'The biggest sets in the gallery',
  category: 'Gallery',
  cooldown: 5,
  async run(ctx) {
    const list = [...await sets()].sort((x, y) => y[1] - x[1]).slice(0, 5);
    if (!list.length) return ctx.reply('There are no sets yet.');
    const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];
    return ctx.reply({ embeds: [new EmbedBuilder().setTitle('Biggest sets').setColor(ORANGE)
      .setDescription(list.map(([n, c], i) => (medals[i] || (i + 1) + '.') + ' **' + n + '** (' + c + ')').join('\n'))] });
  },
});

// /count: how big is the gallery
client.commands.register({
  name: 'count',
  description: 'How many decorations and sets there are',
  category: 'Gallery',
  cooldown: 5,
  async run(ctx) {
    const list = await sets();
    const total = list.reduce((n, [, c]) => n + c, 0);
    return ctx.reply('The gallery has **' + total + '** decorations in **' + list.length + '** sets.');
  },
});

// /suggest: where to send ideas (edit the address if you have a better place)
client.commands.register({
  name: 'suggest',
  description: 'How to suggest a new decoration',
  category: 'Info',
  run: ctx => ctx.reply('Have an idea for a decoration? Check ' + GALLERY + '/gallery to see what exists, then tell the gallery owner.'),
});

// /about and /status
client.commands.register({
  name: 'about',
  description: 'About this bot',
  category: 'Info',
  run: ctx => ctx.reply({ embeds: [new EmbedBuilder().setTitle('Pixel Decorations bot').setURL(GALLERY + '/gallery').setColor(ORANGE)
    .setDescription('Look up decorations from the gallery, get a random one, or recommend a set to your server.\nTry /decoration, /random, /daily, /compare or /sets. /help lists everything.')] }),
});

client.commands.register({
  name: 'status',
  description: 'Bot uptime and health',
  category: 'Info',
  cooldown: 10,
  async run(ctx) {
    let galleryState = 'unreachable';
    try { const r = await fetch(GALLERY, { signal: AbortSignal.timeout(8000) }); galleryState = 'up (' + r.status + ')'; } catch {}
    return ctx.reply('Online for ' + formatDuration(Date.now() - STARTED_AT) + ' | Gallery: ' + galleryState + ' | Node ' + process.version);
  },
});

// ---------------------------------------------------------------- startup

// Keep the bot from crashing the process (and the site, if the bot runs inside it) on a stray error.
process.on('unhandledRejection', err => console.error('Unhandled rejection:', err?.message || err));
process.on('uncaughtException', err => console.error('Uncaught exception:', err?.message || err));

// Keep-alive: a free Render service sleeps after ~15 minutes without web traffic, and the bot goes offline with it.
// Pinging the gallery every 5 minutes counts as traffic. Set KEEP_ALIVE=off to disable (e.g. on a paid plan).
function startKeepAlive() {
  if (/^(off|false|0|no)$/i.test(process.env.KEEP_ALIVE || '')) return console.log('Keep-alive is off.');
  const target = process.env.RENDER_EXTERNAL_URL || GALLERY;
  const ping = () => fetch(target, { signal: AbortSignal.timeout(25000) })
    .then(r => console.log('Keep-alive ping ' + r.status))
    .catch(err => console.warn('Keep-alive ping failed:', err?.message || err));
  setInterval(ping, 5 * 60 * 1000);
  console.log('Keep-alive on: pinging ' + target + ' every 5 minutes.');
}

client.on('ready', () => {
  console.log('==============================================');
  console.log('  \u2705 GALLERY BOT HAS BEEN TURNED ON');
  console.log('  Gallery: ' + GALLERY);
  console.log('  Started: ' + new Date().toISOString());
  console.log('==============================================');
  startKeepAlive();
});

const token = process.env.YAPIN_TOKEN || process.env.YAPPER_BOT_TOKEN;
if (!token) {
  console.error('\u274C Gallery bot NOT started: no YAPIN_TOKEN (or YAPPER_BOT_TOKEN) is set in the environment.');
} else {
  console.log('Gallery bot is starting up and logging in to Yapin\u2019...');
  Promise.resolve(client.login(token)).catch(err => console.error('\u274C Gallery bot failed to log in:', err?.message || err));
}
