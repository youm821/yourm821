# Pixel Decorations gallery

Shows all your decorations. `/admin` (password) lets you upload, rename, move, hide and delete.
No dependencies, runs on Node 18+. Start it with `npm start`.
Your profile photo shows in the header and inside every preview circle. Add more in `/admin` → Profile photos (you crop each one, then press Use to choose which shows).

## Put it on Render

1. Make a **GitHub repo** and upload this folder to it.
2. Render → **New → Blueprint** → pick that repo (it reads `render.yaml`).
   Or **New → Web Service**: build `npm install`, start `npm start`, health check path `/healthz`.
3. In Render → Environment, set `ADMIN_PASSWORD` to a long password. Visit `/admin` and log in.

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

- **Best: the paid plan.** `render.yaml` is set to `starter`, which never sleeps, plus a 1 GB disk at `/data`
  (the site uses it automatically). With the disk you don't need the GitHub backup, but it's a good second copy.
- **Free plan:** in `render.yaml` change `plan: starter` to `plan: free` and delete the `disk:` block.
  Render puts free sites to sleep after 15 minutes without visitors. Make a free monitor on
  **UptimeRobot** or **cron-job.org** that opens `https://YOUR-APP.onrender.com/healthz` every 5 minutes.
  Free plans get 750 hours a month shared across all your free services, and one always-awake site uses about 744,
  so a second free service (like your bot) can run you out. Render may also restart a free site at any time;
  the cloud backup covers that.
- The server logs and ignores stray errors instead of crashing, and shuts down cleanly when Render redeploys.

## Adding things for good without the admin page

Drop the GIF into `seed/` and add a line to `seed/manifest.json` (`file`, `title`, `set`), then redeploy.
