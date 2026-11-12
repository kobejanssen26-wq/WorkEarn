# Changelog

All notable changes to WorkEarn. Versions follow `versionName` in `app.json`; `android.versionCode` increases with every upload to Google Play.

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
- 129 automated tests (calculation engine, intervals and rounding, weekend / holiday bonuses, breaks, midnight and DST, tips and extras,
  shift editing, SQLite persistence and restart recovery, statistics, CSV, i18n parity, signing plugin, UI integration on a real database).
- TypeScript strict and ESLint clean.
