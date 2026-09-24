# EggPro offline and cloud verification

Verified locally on September 24, 2026:

- `npm run check`: **33 unit/integration tests**, **5 farm browser workflows**, **2 mocked-cloud browser workflows**, and **1 production PWA check** passed. TypeScript and Vite production build passed.
- SQLite ledgers, custom egg sizes, stock/sales constraints, valid/invalid backup restores, and legacy backup compatibility.
- Durable pending records survive a cold reopen; they sync once when connectivity returns and can then open on another phone.
- Offline records and an expired saved login survive browser reload with the backend unavailable.
- Local editing stays usable while an upload is slow. Edits made during upload remain pending for the next sync.
- Conflicting phone/cloud versions are preserved. Choosing a version first stores both local recovery copies.
- Persistent request IDs recover an upload whose acknowledgement was lost. Local disk failures restore the last durable state. Stale local tabs cannot replace newer cache data.
- Owner isolation, canonical checksums after PostgreSQL JSONB ordering, and PGlite Postgres RLS/RPC checks: anonymous access denied; other account reads hidden; direct updates denied; RPC ownership enforced; stale revisions rejected; idempotent request accepted.
- Native Android debug build installed on a Pixel 8 emulator. Using a mock backend and designated test account, farm setup/sync succeeded; a custom size saved locally while the backend was unavailable; force-stop and cold launch with Wi-Fi and mobile data disabled retained farm, custom size and login; reconnect uploaded the pending version. Account data persisted through the native SQLite plugin.

The native sync check uses fake public configuration only in a temporary QA build. The distributed `EggPro-offline-preview.apk` is rebuilt without that configuration, retains application ID `com.farmtrack.app`, and displays that cloud backup is not connected. It uses the existing local farm database and does not claim to provide a live online backup.

The final unconfigured APK was also installed as an update without uninstalling. The existing QA farm and Jumbo size remained available with network disabled. APK ZIP integrity and signing verification passed; its signer matches the earlier FarmTrack APK. No mock Supabase URL is present in the distributed assets.

No actual Supabase project, live Render URL, or real authentication email flow was available. The required project URL/public key and applied migration are still pending. Browser access to the provider dashboards was blocked by the tool's administrator security check. Do not bypass that block. These automated/mock checks do not replace the live checklist in README.md.

Once configured, validate the release against the real Supabase project with a designated test account, including signup/confirmation/reset, owner isolation, offline native restart, reconnect upload and second-device download. Sync runs while EggPro is open or resumed; it is not an OS background service.

## Neon and iPhone PWA update — September 24, 2026

The owner selected Neon instead of Supabase. Version 3.1 adds a private Node/Express API on Render, a separate `eggpro` Postgres schema, scrypt password hashing, hashed opaque sessions, recovery-key password resets, IP throttling and owner-scoped transactional revision checks. No private database value is built into the PWA/APK.

Validation completed before push:

- 33 existing unit/integration tests, 5 server tests, 5 farm browser workflows and 2 legacy Supabase browser workflows.
- 4 production PWA checks across Chromium and WebKit: manifest/icons, shell reload with the actual asset server stopped, iPhone guide interaction and hidden install control in standalone mode. Stopping the test origin avoids a WebKit automation offline-mode navigation error and tests genuinely unavailable network transport.
- Real Neon connection and isolated schema initialization. The supplied database had no existing user tables.
- Local production server with the actual Neon database and a designated QA account: signup/recovery-key display, farm setup/upload, offline custom-size entry and reload, reconnect upload, another WebKit iPhone context reading the same account, persisted login, logout, and iPhone installation instructions. No messages or emails sent. QA records retained separately from real farm data.
- Manual screenshot inspection and checks that the database password is absent from tracked files and frontend assets.

Physical iPhone Home Screen installation has not been performed by automation. Real Render API deployment must still be verified; the local-server/real-database result is not a claim that Render's current Start Command has been changed. For a manually created Web Service, set `npm start` and server-only `DATABASE_URL` in Render. The published 3.0 APK remains an offline preview.
