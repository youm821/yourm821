import { Client, EmbedBuilder } from 'yapin.js';
import { GALLERY, find, sets, random, makePack } from './lib.mjs';

// Works as /random and as .random
const client = new Client({ prefixes: ['/', '.'], commands: { help: true } });
const ORANGE = '#fc6a39';

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
async function show(ctx, d) {
  const extra = d.others?.length ? d.others.join(', ') : '';
  if (embedPictures) {
    try { return await ctx.reply({ embeds: [embedFor(d, true, extra)] }); }
    catch (err) { embedPictures = false; console.warn('Yapin\u2019 refused the picture inside the card, using a plain image link instead:', err?.message || err); }
  }
  return ctx.reply({ content: d.image, embeds: [embedFor(d, false, extra)] });
}

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

client.on('ready', () => { console.log('Gallery bot is online. Gallery: ' + GALLERY); startKeepAlive(); });
client.login(process.env.YAPIN_TOKEN || process.env.YAPPER_BOT_TOKEN);
