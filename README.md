# Gallery bot

A Yapin' bot for the pixel decorations gallery. Built on [yapin.js](https://github.com/yapin-js/yapin.js).

Every command works with `/` or `.` in front, like `/random` or `.random`.

| Command | What it does |
| --- | --- |
| `/decoration <name>` (or `/deco`) | Shows the best match, with a link to its page. Also lists a few close names. |
| `/random` | A random decoration. |
| `/sets` | Every set and how many decorations it has. |
| `/gallery` | Link to the gallery. |
| `/pack <set>` | Server owners and people who can manage the server: recommends a set to the server and replies with a `/pack/...` link. |
| `/help` | Built in. |

## Setup
1. In Yapin', open **Settings > Developer**, type a name, press **Create**, and copy the token (shown once).
2. Copy `.env.example` to `.env` and fill it in. `BOT_KEY` must match the `BOT_KEY` you set on the gallery in Render.
3. `npm install`, then `npm start` (or `npm run dev` to load `.env`). Needs Node 18.17 or newer.
4. Add the bot to your server.

On the gallery (Render > Environment) set `BOT_KEY` to a long random string. Without it, `/pack` is switched off on the site and the other commands still work.

`npm test` checks the gallery calls against a running site (`GALLERY_URL=http://localhost:3000 BOT_KEY=test npm test`).

## Notes
- Every answer is an embed card with the picture inside it. Yapin' only allows card pictures from some hosts. If it refuses your site's address, the bot notices once and from then on posts the picture as a plain image link above the card instead (check the bot's log for the line "refused the picture").
- The site posts "new in the showcase / name banners / profile effects" messages by itself through `APPROVAL_WEBHOOK_URL`. The bot is not needed for that.
- A free Render site that has gone to sleep can take about 30 seconds to answer the first command.
