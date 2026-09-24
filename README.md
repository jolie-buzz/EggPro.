# FarmTrack

An offline poultry farm ledger for iPhone, built with React, strict TypeScript, Capacitor, and native SQLite. Android uses the same application and repository code. No server, login, hosted database, analytics endpoint, or recurring API is used. All UI assets are bundled.

## Run locally

Requirements: Node 20.19+ and npm.

```sh
npm install
npm test
npm run build
npm run preview
```

The preview opens at `http://127.0.0.1:4173`. It is a development preview, **not a hosted service or installable native build**. The preview uses real SQLite WASM and IndexedDB; native apps use a device SQLite file. Browser storage can be cleared by the browser, so use backups and the native app for farm operations.

```sh
npm run dev
npm run test:e2e
```

End-to-end tests use installed Google Chrome and their own isolated browser profiles. They never modify a real farm. `npm run check` runs calculations/repository tests, the production build, and browser workflows. If Chrome is unavailable, install Playwright Chromium and remove the `channel: 'chrome'` launch option from `playwright.config.ts`.

## Install on a physical iPhone

1. Install full **Xcode 16 or later**, open it once, accept its license, and install an iOS platform. FarmTrack targets iOS 16+. Apple Command Line Tools alone cannot build the app.
2. Select Xcode's developer directory if needed:
   ```sh
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
3. Install CocoaPods (`brew install cocoapods`). This project deliberately uses CocoaPods: the Capacitor 7 SQLite plugin does not ship Swift Package Manager support.
4. From this repository:
   ```sh
   npm install
   npm run build
   npx cap sync ios
   npx cap open ios
   ```
5. In the **App workspace**, choose the App target. In Signing & Capabilities select your Apple development team, enable automatic signing, and use a unique bundle ID if required. The default ID is `com.farmtrack.app`.
6. Connect and trust your iPhone, enable Developer Mode on the phone, select it in Xcode, and run. Apple signing/provisioning is required; free personal-team installations may need renewal. App Store distribution is a separate signing/review workflow.
7. Create a clean farm, enter production, close and reopen the app, and verify the same records. Turn on airplane mode and check production, inventory, a designated test sale, and backup restore. Native iOS verification remains mandatory before relying on it for live farm records.

The Xcode project, workspace, Podfile, lockfile, Info.plist, privacy manifest, FarmTrack placeholder icons, and launch assets are included. SQLite stays in the app's private Library/CapacitorDatabase directory. No broad filesystem or network permission is needed for core data. Backup export writes a cache file and opens the system share sheet; choose **Save to Files** to keep it. Import uses the system file picker. iCloud and AirDrop are user-selected OS destinations and are not app backend dependencies.

To validate an unsigned simulator build after Xcode is installed:

```sh
npm run build
npx cap sync ios
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

## Android

The Android project is included, so do not run `cap add android` again in this checkout. For a checkout without that folder, `npx cap add android` generates it using the installed platform package.

Requirements: Android Studio, SDK platform 35, and Java 21 (Android Studio's bundled JBR works).

```sh
npm run build
npx cap sync android
npx cap open android
```

Build an installable debug APK:

```sh
cd android
./gradlew assembleDebug
```

Set `JAVA_HOME` to the JDK and `ANDROID_HOME` to your SDK if needed. Output: `android/app/build/outputs/apk/debug/app-debug.apk`. This is a development-signed build, not a Play Store release. No Internet permission is declared by the application; automatic Android cloud backup is disabled in favor of explicit backup export.

## Daily workflow

1. **Setup:** farm/owner name, cages, hens per cage (default 4), prices, feed defaults, and currency. Setup adds no production or stock.
2. **Production:** a single scrollable cage list, plus/minus buttons and numeric entry. Valid numeric changes save immediately; a row says “Saving…” until the operation finishes. Unrecorded differs from an explicit zero. Save Day confirms the saved records. Bulk copy, zero, and clear require confirmation.
3. **Sorting:** enter Small, Medium, Large and XL, plus losses. A production mismatch requires confirmation. Resaving updates only the difference. Cracked/damaged/dirty eggs do not enter saleable inventory.
4. **Feed:** add types, buy sacks, and record daily kilograms. Each purchase creates exactly one feed expense. Usage entries are additive, so enter only the additional amount if recording twice in a day.
5. **Sales:** one or more size/unit lines, partial trays that convert to whole eggs, price snapshots, discount, customer, and payment. A walk-in must be fully paid. Credit requires a customer. Receive subsequent payments against each outstanding sale.
6. **More:** cages, customers, receivables, expenses, finances, reports, settings, and backups. Deactivation preserves history. The setup currency stays fixed to avoid relabeling historical amounts.
7. **Backup:** export regularly and after important corrections. Save the JSON outside the app. Import first validates and previews the farm, then asks before replacing current data. A failed restore preserves existing data. Exports contain personal/financial information and are not encrypted.

Optional sample records are under More → Sample data. With the default setup they populate 50 cages × 4 hens, seven days of production, feed purchases/use, stock, a customer, a partially paid sale, and labor. Loading is explicit and only allowed before operating records exist. Back up your clean farm first and restore it after practice. Production builds always begin with the setup screen and empty stock.

## Accounting and data conventions

- Money is integer minor units (centavos for PHP). Item totals are rounded per line; prices are saved on each line.
- Today’s dashboard production rate is total recorded eggs / current active hens × 100. Historical recorded rates use saved hen counts. Cage rankings are the arithmetic mean of each recorded day's percentage; missing records and zero-hen records are excluded from ranking.
- Alerts use the latest three **recorded** days, which need not be adjacent calendar dates. Correcting a record recomputes the alert. Thresholds: green ≥75%, amber ≥50%, red <50%, gray unrecorded.
- Egg stock = saleable sorting − eggs sold. One tray = 30 eggs. Sorting corrections cannot take sold stock away or make stock negative on any historical date. Sorting is considered available before sales on the same date.
- Feed events are replayed in date order. Purchases on a date precede that date's consumption. A purchase reweights the value of remaining stock. Late-dated entries recompute affected usage cost snapshots from the actual purchase ledger, never from current settings. Consumption before available stock is rejected.
- Feed forecast averages the last seven calendar days, or the elapsed days since the first usage in that window; days without entries within that span count as zero. It is an estimate based on recorded use, not an assumed feeding schedule.
- **Net cash = payments received − cash expenses.** This includes collection of older sales.
- **Estimated operating profit = sales revenue − consumed feed cost − other operating expenses.** Feed purchases do not get counted again as operating cost. Equipment and chicken purchases are treated as capital for this estimate; depreciation and egg inventory cost are not allocated in V1. This is not full accrual accounting.
- Period-end receivables include sales and payments through the selected end date. Customer profiles show current balances. Egg inventory reports show stock as of period end.
- Sales/feed-use ledgers are append-only in V1; operational corrections beyond production/sorting and ordinary expense edits should be handled by restoring a known backup. Returns, sale voids, inventory adjustments, tax accounting, and feed purchase reversal are not implemented.

## Architecture

```text
src/
  components/     Shared fields, dialogs, date filters and chart
  pages/          Mobile application screens
  database/       Serialized driver abstraction, native/web adapters, migrations
  repositories/   Farm, production, inventory, sales and expense writes
  services/       Analytics, validation, backup integrity, demo data
  types/          Domain models
  utils/          Shared formulas, currency and local-calendar helpers
```

Every multi-record mutation runs in a database transaction, including setup, sorting, sales, feed purchase/use and backup import. Repository reads and writes are serialized so the interface cannot observe partial transactions. Native SQLite commits persist on-device; the browser adapter saves the SQLite image to IndexedDB before showing success and returns to its last durable image if storage fails. Foreign keys, unique cage/day entries, check constraints, Zod validation, and chronological inventory audits provide independent safeguards.

Schema migrations are append-only in `src/database/migrations.ts`. Add a new migration for schema changes; do not rewrite a shipped migration. JSON backup format and schema version are explicit. Import verifies SHA-256 corruption detection, row schemas, foreign keys, inventories, purchase expenses and payment totals inside a rollback-capable transaction. The checksum detects accidental file changes; it does not authenticate who created a backup.

No authentication, cloud synchronization, worker accounts, vaccination system, or forecasting backend is implemented. Separate domain repositories and farm IDs allow future additions without putting service logic inside UI components.

## Verification and current environment limits

See [QA inventory](docs/QA.md) for coverage and [verification results](docs/VERIFICATION.md) for actual execution results. Do not treat successful web tests as proof of an iPhone installation. This workspace initially has no Git remote configured, so a push requires the repository URL. No hosted live URL is applicable to this native offline app.

Reference documentation: [Capacitor iOS](https://capacitorjs.com/docs/v7/ios), [Capacitor SQLite](https://github.com/capacitor-community/sqlite), and [filesystem privacy manifest](https://capacitorjs.com/docs/ios/privacy-manifest). Native dependencies are resolved at development/build time; the installed app does not need those services.
