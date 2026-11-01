# Pixel Decorations gallery

Shows all your decorations. `/admin` (password) lets you upload, rename, move, hide and delete.
No dependencies, runs on Node 18+. Start it with `npm start`.
Your profile photo shows in the header and inside every preview circle. Add more in `/admin` → Profile photos (you crop each one, then press Use to choose which shows).

## Put it on Render

1. Make a **GitHub repo** and upload this folder to it.
2. Render → **New → Blueprint** → pick that repo (it reads `render.yaml`).
   Or **New → Web Service**: build `npm install`, start `npm start`, health check path `/healthz`.
3. In Render → Environment, set `ADMIN_PASSWORD` to a long password. Visit `/admin` and log in.

## Login with Yapin’

Visitors press **Login with Yapin’**, approve, and their Yapin’ profile picture shows in every preview circle.
The site only asks for the `identify` scope (id, username, display name, picture). It never stores the access token.
Logged-in people appear in `/admin` → Accounts, where you can remove them.

1. In Yapin’: **Settings → Developer → Login with Yapin’** → make an app. Copy the **client ID** and **client secret**
   (the secret is shown once).
2. Add this as the app's redirect URL, exactly: `https://yourm821.onrender.com/callback`
   (your own address plus `/callback`; https only).
3. Render → Environment, add `YAPPER_CLIENT_ID` and `YAPPER_CLIENT_SECRET`. Redeploy.
   If you use your own domain instead of the onrender.com address, also set `PUBLIC_URL` to it (no trailing slash).
4. Open the site. The button shows up once both values are set.

If login ever says "did not work": the redirect URL in Yapin’ doesn't match exactly, or the secret is wrong.

## Saving your data (so nothing is ever lost)

Render's free plan wipes the server's files on every restart, redeploy and sleep. Fix: the site backs itself up to GitHub.

1. Make a second repo, **private**, called e.g. `gallery-backup`. Tick "Add a README" (it needs one commit).
2. GitHub → Settings → Developer settings → **Fine-grained tokens** → new token. Give it that one repo only,
   permission **Contents: Read and write**.
3. In Render → Environment add:
   - `GITHUB_TOKEN` = the token
   - `GITHUB_REPO` = `yourname/gallery-backup`
4. Redeploy. In `/admin` the **Cloud backup** panel should say "On". Press **Back up everything now** once.

Every upload and edit is then copied to the `gallery-data` branch (a branch, so it never triggers a redeploy).
If the server is ever wiped, it restores itself from there on start-up. It will not overwrite your backup if GitHub
can't be reached when it wakes. You can also download a `.zip` of your uploads from `/admin` any time.

## Keeping it alive

Three layers, so one failing doesn't matter:

1. **Built in.** The site visits its own address every 4 minutes (on automatically on Render; it uses
   `RENDER_EXTERNAL_URL`, or `PUBLIC_URL` if you set it). Render counts that as a visitor, so the free plan's
   15-minute sleep never starts. `/admin` → **Staying awake** shows whether it's working.
2. **GitHub.** `.github/workflows/keepalive.yml` visits `/healthz` every 5 minutes from outside Render.
   It starts working once this folder is in your GitHub repo. (GitHub can run these a few minutes late, and turns
   scheduled jobs off on a public repo after 60 days without any commits. Re-enable under the Actions tab if so.)
3. **The paid plan** (`plan: starter` in `render.yaml`) never sleeps at all. It's the only guaranteed option.

A site can't wake *itself* once Render has put it to sleep, which is why layer 2 is outside Render. Also, on the free plan
Render gives 750 hours a month shared by all your free services, and one always-awake site uses about 744, so a second
free service (like your bot) can run you out. Render may also restart a free site at any time; the GitHub cloud backup
below covers that. Set `KEEP_ALIVE=0` to turn the built-in check off.

The server logs and ignores stray errors instead of crashing, and shuts down cleanly when Render redeploys.

## Showcase

The **Showcase** tab lets anyone logged in with Yapin’ share their own work (GIF, PNG or WebP, up to 5 MB,
16 to 1024 pixels, 12 works each). New work waits for you to approve it in `/admin` → **Showcase submissions**.
Tick "Show new showcase submissions right away" in the Site box if you'd rather skip approval. People can delete their own
work, and you can delete anything. Showcase files are included in the cloud backup.

## Adding things for good without the admin page

Drop the GIF into `seed/` and add a line to `seed/manifest.json` (`file`, `title`, `set`), then redeploy.
