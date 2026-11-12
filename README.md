# WorkEarn

**Your time. Your money. Live.**

WorkEarn is a local-first Android app that shows what you earn *while you work*. Pick an employer, start a shift
and watch your earnings grow second by second. Everything is calculated from exact timestamps and stored in a private
SQLite database on your device: no account, no server, no tracking.

- Package: `com.workearn.app` · Platform: Android (primary) · Default language: English (Dutch included)
- Stack: Expo SDK 58 · React Native 0.88 · React 19.3 · TypeScript 6 · Expo Router · expo-sqlite · Reanimated 4 · react-native-svg

## Features

| Area | What it does |
| --- | --- |
| **Live earnings (Home)** | Select employer, start / pause / resume / stop, live earnings every second, elapsed time, current hourly rate (incl. active bonuses), today's and this week's earnings. A running shift survives closing the app or Android killing the process. |
| **Employers & pay rules** | Unlimited employers; hourly wage, currency, weekday-specific rates, Saturday / Sunday / public-holiday bonuses (percentage or amount per hour, *add to* or *replace* the wage), custom hourly bonus windows (e.g. night 22:00–06:00), fixed bonuses, calculation interval (continuous, 1, 5, 10, 15, 30, 60 min) with rounding down / up / nearest. |
| **Shifts** | Start/end timestamps, pauses, paid and unpaid breaks, manual entry and editing, tips, extra earnings, notes, deletion, shifts across midnight. |
| **Calendar** | Month view with worked days, daily earnings, number of shifts, employer filter, day detail. |
| **History** | All shifts with employer, date, times, duration and earnings; edit and delete. |
| **Statistics** | Daily / weekly / monthly / yearly earnings, total hours, average earnings per hour, employer comparison. Calculated from real database rows, never fabricated. |
| **Settings** | Light / dark / system theme, language (English, Dutch), default currency, public-holiday country, week start, time format, earnings preferences, CSV export, privacy and app information. |

Historical shifts keep the pay configuration they were recorded with: editing an employer creates a new pay-rule
version only when existing shifts already use the current one.

## How earnings are calculated

The engine (`src/core/engine.ts`) is pure TypeScript and fully unit-tested.

1. Unpaid breaks are removed from the shift; paid breaks stay paid.
2. Paid time is split at every local midnight and at the edges of custom bonus windows, so every slice has one hourly rate
   (weekend / holiday / night boundaries and DST changes are handled exactly).
3. Each slice is priced with **integer** arithmetic (`rate × milliseconds`, BigInt for the multiplication) and rounded to a cent
   **once** at the end. Nothing is accumulated tick by tick, so there is no drift: EUR 12/h for 29 minutes is exactly EUR 5.80.
4. The live display is an *estimate* (never rounded to the calculation interval). When you stop, the **final** result applies the
   employer's interval and rounding mode and shows both numbers side by side.
5. Fixed bonuses, tips and extra earnings are added last.

Bonus rules: the highest-priority day premium wins (public holiday > Sunday > Saturday), custom hourly bonuses stack, percentages
always refer to the day's base wage (so they add up instead of compounding), "replace" replaces the base wage.

## Getting started

```bash
npm ci                # install exact dependency versions
npm start             # Expo dev server (needs a development build or Expo Go-compatible setup)
npm run check         # TypeScript + ESLint + all tests
npm test              # Jest (unit, SQLite persistence and UI integration tests)
```

Requirements: Node ≥ 22.13. The tests use Node's built-in SQLite engine, so no extra database tooling is needed.

## Project structure

```
src/app/            Expo Router routes (tabs, employers, shifts, settings)
src/core/           Pure business logic: money, time, holidays, pay engine, stats, CSV (no React, no I/O)
src/db/             SQLite schema + migrations, repositories, driver abstraction (expo-sqlite in the app)
src/services/       Use-cases: shift lifecycle, whole-database operations, CSV export
src/features/       Screens grouped by feature (home, employers, shifts, calendar, statistics, settings)
src/ui/             Design system components (Text, Button, Card, Fields, Sheet, charts, ...)
src/theme/          Colour palettes, spacing, typography
src/i18n/           English (default) and Dutch dictionaries, locale formatting
plugins/            Expo config plugin: production signing for the release build
tests/              Jest tests (real SQLite via node:sqlite; UI tests with React Native Testing Library)
docs/               Release guide, privacy policy, Play Data safety, Play listing
store/              Google Play graphics (icon, feature graphic, screenshots)
scripts/            Asset generation (icons/splash, store screenshots, feature graphic)
```

## Building the Android App Bundle (AAB)

Three supported routes; details in [`docs/ANDROID_RELEASE.md`](docs/ANDROID_RELEASE.md).

1. **GitHub Actions** (works without an Expo account): the *Android release bundle (AAB)* workflow builds with Gradle, validates the
   bundle with bundletool, asserts package / version / target API and stores the AAB as a workflow artifact. Add the four upload-key
   secrets to get a Play-uploadable, signed bundle.
2. **EAS Build**: `npx eas-cli build --platform android --profile production` (requires `eas login` / `EXPO_TOKEN`).
3. **Local**: `npx expo prebuild --platform android && cd android && ./gradlew :app:bundleRelease` (needs JDK 21 and the Android SDK).

Target API level: **36** (Android 16), as required by Google Play for new apps and updates since 31 August 2026.

## Store assets

`npm run store:icons` regenerates the app icon / adaptive icon / splash images, `npm run store:screenshots` renders the real screens
(react-native-web + an in-memory sql.js database with sample data, web-only code that is not part of the Android bundle) and
`npm run store:feature-graphic` builds the Play feature graphic. Details and provenance: [`store/README.md`](store/README.md).

## Privacy

No account, analytics, advertising or tracking; the app has no internet permission and no access to personal data, and keeps all data on the device.
See [`docs/PRIVACY_POLICY.md`](docs/PRIVACY_POLICY.md).

## Status

Before a release run the on-device checklist in [`docs/SMOKE_TEST.md`](docs/SMOKE_TEST.md). See [`DEVELOPMENT_STATUS.md`](DEVELOPMENT_STATUS.md) for an honest list of what is verified and what is not, and
[`CHANGELOG.md`](CHANGELOG.md) for the release history.
