# EggPro

Offline-first poultry management for Android APK and iPhone/Android PWA. The current deployment uses a **Render Node Web Service** and **Neon Postgres**. React/SQLite validate farm records locally; a private API handles accounts and cloud backup. Supabase support is retained only for existing deployments/tests.

## Render + Neon deployment

For the existing Render EggPro Web Service, use:

| Setting | Value |
| --- | --- |
| Repository | `jolie-buzz/EggPro.` |
| Branch | `main` |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check | `/api/health` |
| Node version | `22` |
| Server environment variable | `DATABASE_URL` = private Neon PostgreSQL connection string |

`render.yaml` describes this Node service on the free plan. Changing the file does not automatically reconfigure a service that was created manually: update its commands in Render's Settings. Do not use `yarn.start`, Vite's preview server, or a Static Site for the Neon backend.

Keep `DATABASE_URL` exclusively in Render's server environment. Never prefix it with `VITE_`, put it in a frontend bundle, or commit it. Remove old `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` settings when selecting Neon. Ordinary browser/PWA builds use the same origin for the API and need no public database settings. Neon TLS certificates are verified. The server initializes its dedicated `eggpro` schema without altering unrelated tables.

For APK builds only, set the public `VITE_API_URL=https://eggpro.onrender.com` to the deployed EggPro API. This URL contains no database credentials. Default CORS allows native Capacitor origins; `ALLOWED_ORIGINS` can override that comma-separated list. Web clients use the same origin. Authentication uses bearer tokens, not cookies.

After deploying, `/api/health` must return JSON with `ok: true`, `backend: neon` and `version: 3.1.0`. Verify signup, login, offline saves, reconnect, another device, and logout against the actual deployment. A successful frontend build alone does not prove the API works.

Free hosting is subject to provider quotas and cold starts. An installed app can continue recording offline while its server is unavailable. Keep exported backups of important records.

## Install on iPhone or iPad

1. Open the deployed HTTPS URL in **Safari**.
2. Tap **Share**, then **Add to Home Screen**. Depending on the Safari version, Share may be in the More menu.
3. If shown, keep **Open as Web App** enabled, then tap **Add**.
4. Open the **EggPro** Home Screen icon. Sign in online and wait for the farm to load before using it offline.

The in-app **Install EggPro on iPhone / iPad** guide explains these steps. An iPhone cannot install an Android APK. Login from Safari and login from the installed app may use separate storage, so sign in from the Home Screen app itself. There is no guarantee that an OS/browser will retain local data after uninstall, storage clearing or device loss.

Android browsers offer **Install app** or **Add to Home Screen**. The Android APK bundles its own UI. App-shell assets are cached by a service worker on web/PWA; API responses and auth data are never put in its asset cache. New service-worker versions activate after older app windows are closed, avoiding replacement while the user is editing.

## Accounts and recovery

One account owns one farm. Email is the account identifier; email verification and password-reset emails are **not enabled**. At signup, save the private **recovery key** shown before entering the app. Use **Forgot password?** with that key to reset the password. A reset rotates the recovery key, revokes old server sessions and retains the farm. The server stores scrypt password hashes and SHA-256 hashes of random session/recovery tokens, not plaintext passwords/tokens. Auth endpoints have durable IP rate limits.

A session is valid for 90 days of inactivity and extends when used online. Saved identity and per-account data permit later offline use; revoked/expired sessions cannot sync until login again. Logout hides the local cache but retains unsynced records for that account. Offline logout clears this device's token; if the server is unreachable it cannot immediately revoke that token server-side. Use the app on personal devices and export pending records before removing it.

## Offline saves and conflicts

Edits commit locally first: IndexedDB on web/PWA and SQLite for native account caches. The UI shows **Saved on phone · waiting to sync** until the server acknowledges the upload. Automatic sync retries while the app is open, on reconnect, and when resumed. It is not an OS background service: reopen EggPro online to finish backup. A new phone needs internet for its first login and farm download.

The API derives the owner only from the authenticated session. Each save uses a transaction, per-owner lock, expected revision, and persistent request ID. A lost upload acknowledgement is recognized without applying the same revision twice. Local edits remain usable during an upload; newer edits stay pending for the next sync.

If two phones edit the same old version, both whole-farm versions are retained and **Account & sync** offers review/export. Choosing phone or cloud first stores both in local Recovery backups. This is not an automatic record-by-record merge. Reload cannot discard pending records. Local cache revision checks reject stale app windows.

Each account's full farm is uploaded as a structured JSON document with a 10 MB limit. This is for small farms; monitor bandwidth/storage as records grow. JSON backups retain the `FarmTrack` compatibility marker and canonical checksums.

## Import the old offline APK

Before installing a cloud-enabled APK update, use **More → Backup & restore → Export backup** in the old app. Log into the new app and choose **Import backup from the offline app** during farm setup. Wait for **Saved on phone & cloud**, then verify stock, production, sales and customer balances on another device. Exporting is necessary because the old local farm and per-account cloud farm use separate stores. Do not uninstall the old app before exporting.

Keep application ID `com.farmtrack.app` and the original signing certificate when updating Android. The existing downloadable `v3.0.0-offline-preview` is explicitly offline-only; it does not become cloud-enabled merely because the server is deployed.

## Development and validation

```sh
npm ci
# Set DATABASE_URL privately in the server process environment.
npm run build
npm start
# In another terminal:
npm run check
```

For frontend development, `npm run dev` proxies `/api` to the local server at port 3000. `VITE_LOCAL_ONLY=true npm run dev` runs the legacy offline app. Do not use this flag in deployment. Tests use SQLite, PGlite Postgres, browser workflows and Chromium/WebKit PWA checks. Install test browsers with `npx playwright install webkit` and use an installed Chrome.

Android: set public `VITE_API_URL` at build time, run `npm run build`, `npx cap sync android`, then build `android` with the Android Studio JDK/SDK. A Play Store release needs separately managed release signing. iOS native builds are unverified; iPhone delivery is the PWA.

The project was recovered after its original source folder was deleted. This repository has a new Git history and does not contain the lost history.
