# Changelog

All notable changes to WorkEarn. Versions follow `versionName` in `app.json`; `android.versionCode` increases with every upload to Google Play.

## Unreleased

### Added
- Manual workflow *Signing and device self-test*: a throwaway upload key, signed AAB + APK, signature verification, and an Android 14 emulator smoke test (install, first-run screen,
  Calendar / History / Statistics, restart after a kill, crash scan). Uses no real secret and publishes nothing.
- Dutch beginner's guide for publishing on Google Play (`docs/PLAY_STORE_STAPPENPLAN_NL.md`) and a Dutch version of the privacy policy.

### Verified
- Signing path and app launch in CI (run 43242278257): throwaway-key signing of AAB and APK verified; the release APK installs and starts on an Android 14 emulator, renders Home, Calendar,
  History and Statistics, survives a kill and restart, and logs no crash.

### Changed
- The release workflow needs only two secrets (keystore + password); alias and key password have defaults, pasted whitespace is stripped, the keystore is opened early with a readable
  error, a signed bundle must verify with `jarsigner`, and the signing-certificate fingerprint is added to the report. It also runs on pushes to `main`.
- The privacy policy has no placeholders any more: it names the developer by GitHub account and gives GitHub Issues and the Play-listing contact email as contacts.

## 1.0.0 (versionCode 1) — first release candidate

### Added
- Live earnings dashboard: employer selection, start / pause / resume / stop, earnings recomputed from timestamps every second,
  elapsed time, current hourly rate, today and this week, recovery of a running shift after the app is closed or killed.
- Employers with unlimited pay rules: hourly wage, currency, weekday-specific rates, Saturday / Sunday / public-holiday bonuses
  (percentage or amount, add or replace), custom hourly bonus windows, fixed bonuses, calculation intervals and rounding.
- Shift management: pauses, paid and unpaid breaks, manual entry and editing, tips, extra earnings, notes, deletion, midnight crossing.
- Month calendar, history, and statistics (day / week / month / year, total hours, average per hour, employer comparison).
- Settings: theme (light / dark / system), language (English, Dutch), default currency, public-holiday country (BE, NL, FR, DE, LU, none),
  week start, time format, earnings preferences, CSV export (Excel-Europe or international dialect), privacy information, app information.
- Relational SQLite schema with migrations, foreign keys, check constraints and indexes; a single running shift is enforced by the database.
- Versioned pay rules so historical shifts keep their original configuration.
- Production Android configuration: package `com.workearn.app`, target API 36, no network / storage / personal-data permissions (verified on the merged manifest of the built bundle), backups disabled, adaptive and
  monochrome icons, splash screen, R8 minification and resource shrinking, upload-key release signing via environment / secrets.
- GitHub Actions: CI (typecheck, lint, tests, JS bundle) and an Android release workflow that builds, validates (bundletool) and stores the AAB.
- EAS Build profiles (development, preview, production).

### Quality
- 144 automated tests (calculation engine, intervals and rounding, weekend / holiday bonuses, breaks, midnight and DST, tips and extras,
  shift editing, SQLite persistence and restart recovery, statistics, CSV, i18n parity, signing plugin, UI integration on a real database).
- TypeScript strict and ESLint clean.
