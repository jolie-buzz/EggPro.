# EggPro online verification

Automated coverage:
- SQLite ledgers, custom sizes, stock/sales constraints, backup restore.
- Two independent client databases using the same cloud account: new farm, custom size, sorting, sale, reload.
- Stale-version saves rejected; failed network writes rolled back and blocked until reload.
- Lost save acknowledgements recognized by request ID.
- Separate cloud accounts remain isolated; legacy backup imports into a new account.
- Canonical checksums survive PostgreSQL JSONB property ordering.
- Real Postgres engine (PGlite): anonymous access denied; other account reads hidden; direct updates denied; RPC ownership enforced; stale revisions rejected; idempotent request accepted.
- Browser: persistent login after reload, same farm/custom sizes on another browser context, logout and reload remove account data from view.

Live deployment remains pending until a Supabase project is configured, its migration is applied, and Render is connected with the public project settings. Automated tests use designated fake data and do not send real confirmation/reset emails. Run the live checklist in README.md before declaring the online deployment complete.

Local results (September 24, 2026): 26 automated tests passed; 5 legacy browser workflows passed; the mocked-cloud login/two-phone/logout workflow passed; production PWA metadata, service-worker installation and offline-shell reload passed. TypeScript/Vite build and npm dependency audit passed. Mobile login screenshot inspected at 390 px. No live Supabase account was used and no real email was sent.
