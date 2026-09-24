# EggPro

Installable poultry farm management web app for Android and iPhone. React + TypeScript on a **free Render Static Site**, with **Supabase Auth and Postgres** for account access and cloud records.

One account owns one farm. Sign in to the same account on another phone to open its records. Sessions persist and refresh automatically until logout, revoked credentials, or browser storage clearing. Installing the site does not itself copy data: the account is the source of the farm records.

## Deploy on the free plans

1. Create a **Free** Supabase project named **EggPro**. Keep its database password private.
2. Open **SQL Editor → New query** and run [the database migration](supabase/migrations/202609240001_eggpro.sql). It creates the farm table, owner-only row security, and the atomic save function. Run this once on the new project.
3. In Supabase's **Connect/API settings**, copy the Project URL and **publishable key** (or legacy anon public key). Never use a secret or service-role key in this frontend.
4. In Render, choose **New → Blueprint**, select `jolie-buzz/EggPro.` and the `main` branch. This repository includes `render.yaml`. It creates a static site, not a paid web service. Supply:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Deploy. The build is `npm ci && npm run build:online`, with publish directory `dist`. The online build fails if the keys are missing or a private key/local-only mode is supplied.
6. In **Supabase → Authentication → URL Configuration**, set **Site URL** and the allowed redirect URL to the exact Render HTTPS URL (including `/`). Keep email confirmation enabled. Use Supabase's default long-lived sessions; do not enable single-session restrictions.
7. Configure your own SMTP provider in Supabase before opening public registrations. Supabase's default email sender is restricted and is intended for testing; email confirmation/password reset must be verified with your intended recipients.
8. Verify the live site with a designated test account: sign in, create/import a test farm, save a record, reload, open on a second device, test owner isolation, log out, and install to the home screen. Do not describe deployment as complete until these checks pass.

No subscription or paid add-on is required by this configuration. Free-tier quotas still apply. Supabase can pause inactive Free projects; monitor its dashboard and keep exported backups. Free-tier cloud storage is not a guarantee against every form of data loss.

## Install on a phone

Open the deployed HTTPS URL. On Android choose **Install EggPro** or the browser's **Install app** menu. On iPhone open in Safari, choose **Share → Add to Home Screen**. Use the same account on every phone that should open that farm.

Internet is required to open and save cloud records. The installed shell can open offline, but it does not accept unsynced farm edits or pretend that a local-only save is online. Records already displayed remain visible until the app closes; reconnect to reload or save. No API responses or farm records are cached by the service worker.

## Move records from the old APK

1. Keep the old offline app installed. In it choose **More → Backup & restore → Export backup**, and save the JSON file.
2. Sign in to EggPro online. On the new farm screen choose **Import backup from the offline app**.
3. Review the farm name and confirm the import. The records are then saved to this account.
4. Open the same account on a second phone and verify production, stock, customer balances and sales before removing the old app.

The compatibility marker inside JSON files remains `FarmTrack`, so earlier backups continue to import. Visible branding is EggPro. Importing a backup into an existing online farm replaces that account's records on all phones; export a copy first.

## Data and concurrency

`eggpro_farms` holds each account's structured JSON farm document in Supabase Postgres. All 16 ledgers are retained. Existing SQLite calculations and constraints validate changes in memory before an atomic cloud save. There is no persistent browser cache of farm records in online mode.

Only the owner can read a document. Direct client writes are revoked; the SQL function checks `auth.uid()`, locks the account and compares its revision. If two devices edit an old version, the stale save is rejected without overwriting the newer farm. **Account & sync → Reload farm** fetches current records; it explicitly clears unsaved form entries. Failed or ambiguous writes require reload before another attempt. Request IDs recognize a lost acknowledgement and prevent accidental double application.

The app checks for remote updates while open and when refocused. This is a small-farm document architecture, not a high-volume multi-tenant analytics warehouse: the full structured document is sent per save, with a 10 MB maximum. Monitor Supabase bandwidth/storage as records grow. Farm documents use a canonical checksum so Postgres JSON key ordering does not break backup validation.

## Local development and tests

Use Node 22 (Render configuration) and npm:

```sh
npm ci
cp .env.example .env.local
# Fill in public Supabase values in .env.local
npm run dev
npm run check
```

`npm run check` runs real SQLite repository/cloud tests, Postgres RLS/RPC tests using PGlite, a production build, legacy farm browser workflows and a mocked-cloud two-phone/auth workflow. Browser mocks do not replace required live Supabase and Render verification.

For the legacy offline mode only: `VITE_LOCAL_ONLY=true npm run dev`. Never set this on Render. The native Android/iOS directories are retained for the old offline app; this delivery targets the installable web app.

## Source recovery

The original local project was deleted. This repository was recovered from its local source backup and the saved custom-size patch, then updated for EggPro online. It has a new Git history; it does not replace or claim to contain the lost history.
