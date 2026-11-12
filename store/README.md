# Google Play graphics

| File | Size | How it was made |
| --- | --- | --- |
| `icon-512.png` | 512 × 512 | Rendered from `assets/images/icon.png` (`npm run store:feature-graphic`). Play applies its own corner mask. |
| `feature-graphic-1024x500.png` | 1024 × 500 | Composed from the design system and two of the screenshots below (`npm run store:feature-graphic`). |
| `screenshots/01 … 08-*.png` | 1080 × 1920 | Rendered from the **real app code** (`npm run store:screenshots`). |

## About the screenshots

No Android emulator or device is available in the build environment, so the screenshots are **renderings of the production screens**
(the same React Native code, executed on the web platform through `react-native-web` in headless Chromium) running against an
in-memory SQLite database that `src/preview/seed.ts` fills with **sample data**. The time is fixed to *Thursday 12 November 2026, 10:42*
so the output is reproducible. Fonts, shadows and the status bar can differ slightly from a physical Android phone.

The web-only files (`src/db/expoDriver.web.ts`, `src/preview/seed.ts`, `sql.js`) are resolved only by Metro's web platform and are not part of the
Android app bundle.

If you prefer genuine device screenshots (Google's guidance is that screenshots should show the real app), capture them on a phone or emulator
and replace these files; the sample data shown here is not data from a real user.

| Screenshot | Shows |
| --- | --- |
| `01-live-earnings.png` | Live earnings of a running shift with unpaid pause and a tip (light) |
| `02-stop-summary.png` | Stop summary: live estimate next to the final, interval-rounded earnings |
| `03-calendar.png` | Month calendar with daily earnings, shift dots and public holidays |
| `04-statistics.png` | Weekly earnings chart, hours, average per hour (dark) |
| `05-history.png` | Shift history (dark) |
| `06-employer-pay-rules.png` | Employer form with pay rules |
| `07-dark-live-earnings.png` | Live earnings in the dark theme |
| `08-nl-live-earnings.png` | Live earnings in Dutch |

## Regenerating

```bash
npm run store:icons                 # app icon, adaptive icon layers, splash images (assets/images)
npm run store:screenshots           # screenshots (needs Playwright + Chromium; exports the web build first)
npm run store:feature-graphic       # feature graphic and 512 px icon
```
