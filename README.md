# EggPro

Offline-first poultry management Android APK and installable web app for Android and iPhone. React + TypeScript on a **free Render Static Site**, with **Supabase Auth and Postgres** for account access and cloud records.

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

The Android APK includes its app files and opens without internet. After the first online sign-in and farm download, account records and edits are stored durably on the phone, including when an existing login token expires offline. Web installations cache the app shell and keep account data in IndexedDB. Native account data is saved in SQLite. Saved login information stays on the device until logout, removal of app storage, or invalidation by the authentication service; server access always requires valid authentication.

Changes show **Saved on phone · waiting to sync** until acknowledged by the cloud. Sync retries while the app is open, when it returns to the foreground, and when connectivity returns. This is not an Android background service: open EggPro while connected to finish backup. A new phone needs internet for its first login and download. Unsynced edits cannot be recovered from the internet if the phone is lost or the app is uninstalled.

### Build an Android APK

Keep application ID `com.farmtrack.app` and the original signing certificate to update the old APK without deleting its data. Version 3 uses the visible name EggPro. Export a JSON backup before installing any update; do not uninstall the old app.

```sh
npm ci
# Configure the real public Supabase settings in .env.local first.
npm run build:online
npx cap sync android
cd android
./gradlew assembleDebug
```

The APK is `android/app/build/outputs/apk/debug/app-debug.apk`. Use the Android Studio JDK and configured Android SDK. This is a directly installable debug build; a Play Store release requires a separately managed release-signing setup.

Without Supabase settings, a native `npm run build` produces a clearly labelled **offline edition** using the existing local farm database. That APK does not offer login/cloud sync until updated with a configured build. No fake test project is included in the distributed offline edition. Render hosts the companion web app; native APKs bundle their own UI.

## Move records from the old APK

1. Keep the old offline app installed. In it choose **More → Backup & restore → Export backup**, and save the JSON file.
2. Sign in to EggPro online. On the new farm screen choose **Import backup from the offline app**.
3. Review the farm name and confirm the import. The records are saved on this phone. Open Account & sync and wait until they are saved on phone and cloud.
4. Open the same account on a second phone and verify production, stock, customer balances and sales before removing the old app.

The compatibility marker inside JSON files remains `FarmTrack`, so earlier backups continue to import. Visible branding is EggPro. Importing replaces this phone's farm and queues it for cloud sync; export a copy first.

## Data and concurrency

`eggpro_farms` holds each account's structured JSON farm document in Supabase Postgres. All 16 ledgers are retained. SQLite calculations and constraints validate edits, then each completed transaction is saved locally before the UI reports success. A per-account, per-project cache prevents one account from opening another account's local records. Logout hides that cache but retains unsynced changes for the same account's next login.

Only the owner can read a cloud document. Direct client writes are revoked; the SQL function checks `auth.uid()`, locks the account and compares its revision. Persistent request IDs recognize a lost upload acknowledgement. Network requests do not block local farm editing. Local cache revisions reject stale app windows.

If two phones edit the same old version, EggPro keeps both versions and requires review in **Account & sync**. Export both, then choose the entire phone or cloud version. Both are retained in local **Recovery backups** before replacement; this is not a record-by-record merge. Recovery copies must be exported before uninstalling. New cloud records are offered with **Reload cloud copy**, rather than replacing an open form. Pending phone records cannot be silently discarded by reload.

This is a small-farm document architecture: the full structured document is uploaded per sync, with a 10 MB server maximum. Monitor bandwidth/storage as records grow. Canonical checksums preserve compatibility with PostgreSQL JSONB property ordering.

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

For the legacy offline mode only: `VITE_LOCAL_ONLY=true npm run dev`. Never set this on Render. Android is also supported as an offline-first APK. iOS native builds have not been verified.

## Source recovery

The original local project was deleted. This repository was recovered from its local source backup and the saved custom-size patch, then updated for EggPro online. It has a new Git history; it does not replace or claim to contain the lost history.
