# My portfolio

A portfolio site you edit from the site itself. Only someone with your passcode can add, edit or delete work.

## Put it online with Render

1. Create a GitHub repo and upload everything in this folder (do not upload `node_modules`).
2. In Render choose **New > Blueprint**, pick the repo, and approve the plan.
3. When asked for `ADMIN_PASSCODE`, type the passcode you want. Make it long.
4. Open `yourapp.onrender.com/admin`, enter your passcode, and manage everything there: add work (several files at once), edit your details and colours, and set a background image. The public site has no sign-in button, so visitors never see the link.

`render.yaml` sets up the Starter plan with a 2 GB disk. Your uploads and text live on that disk, so they survive restarts and redeploys. Starter also stays awake. The free plan sleeps after 15 minutes and wipes uploads on every restart, so it cannot do what you asked.

## Change your passcode

Render dashboard > your service > Environment > edit `ADMIN_PASSCODE` > save. It restarts and the new passcode works.

## Run on your computer

    npm install
    ADMIN_PASSCODE=pick-something npm start

Then open http://localhost:3000. Local data is saved in `./data`.
