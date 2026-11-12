# Development status

_Snapshot: 12 November 2026 · WorkEarn 1.0.0 (versionCode 1) · branch `claude/admiring-heisenberg-2fqqev`_

Legend: **Completed** = implemented and verified by the evidence listed · **Not implemented** · **Blocked** = could not be done in this environment · **Requires developer action**.

## 1. Features

| Spec area | Status | Evidence / notes |
| --- | --- | --- |
| Live earnings (select employer, start / pause / resume / stop, live every second, elapsed time, current rate, today, week) | **Completed** | `tests/home-screen.test.tsx` drives the real Home screen on a real SQLite database: EUR 12/h after 29 min shows exactly EUR 5.80, pause freezes the amount, 60 min shows EUR 12.00. |
| Restore an active shift after the app is closed / killed | **Completed** | `tests/persistence.test.ts` (file database closed and reopened, open pause restored) and the Home restore test. State lives only in SQLite. |
| Employers and pay rules (weekday rates, Sat / Sun / holiday bonuses, custom hourly bonuses, fixed bonuses, currency, intervals, rounding, add vs replace) | **Completed** | `tests/engine.test.ts` (matrix of intervals × modes, premiums, stacking, replace vs add), `tests/form-model.test.ts`, `tests/database.test.ts`. |
| Historical shifts keep their original pay configuration | **Completed** | Versioned `pay_rules`; `tests/database.test.ts` and `tests/shifts.test.ts` (editing a shift keeps the old rate unless the employer changes or re-pricing is requested). |
| Shifts: pauses, paid / unpaid breaks, manual editing, tips, extras, notes, deletion, midnight crossing | **Completed** | `tests/shifts.test.ts`, engine tests incl. DST nights (23 h and 25 h days). |
| Live estimate vs final rounded earnings | **Completed** | Stop summary (`src/features/home/StopSheet.tsx`), engine `estimate` vs final mode, tested. |
| Calendar (month, daily earnings, shift count, day detail, employer filter) | **Completed** | `tests/screens.test.tsx`; real render in `store/screenshots/03-calendar.png`. |
| History (list, edit, delete) with immediate statistics update | **Completed** | `tests/screens.test.tsx`, `tests/shifts.test.ts` (totals change after edit / delete). |
| Statistics (day / week / month / year, hours, average per hour, employer comparison) | **Completed** | `tests/stats-csv.test.ts`, `tests/screens.test.tsx`; computed from DB rows only. |
| Settings: theme (persisted), currency, language, week start, time format, earnings preferences, holidays, CSV export, privacy, app info | **Completed** | `tests/screens.test.tsx` (theme + Dutch persisted, CSV content). |
| Relational SQLite schema, migrations, FKs, indexes | **Completed** | `src/db/migrations.ts`; `tests/database.test.ts`. |
| Privacy (local only, no analytics / ads, no unnecessary permissions) | **Completed** | Generated manifest removes `INTERNET`, storage, overlay and vibrate permissions (see §4). |
| Languages | **Partly** | English (default) and Dutch. Other languages are **not implemented**. |
| Statistics / calendar attribute a shift to its **start** date | Design decision | A shift across midnight is *priced* across rate periods but reported on the day it started. |
| Amounts in different currencies | Design decision | Never added together; screens show one currency at a time (chips appear when several exist). No conversion. |
| Import / restore from CSV, cloud backup, ongoing notification for a running shift | **Not implemented** | Out of scope for v1 (a notification would need a permission). |
| Tablet-specific layout | **Not implemented** | Portrait phone layout. |

## 2. Automated checks (all run in this environment)

| Check | Result |
| --- | --- |
| `npm test` (Jest, 13 suites) | **144 tests pass** |
| `npm run typecheck` (`tsc --noEmit`, strict) | **pass** |
| `npm run lint` (`expo lint`, ESLint 9 + React-compiler rules) | **pass, 0 problems** |
| `expo export --platform android` (Metro + Hermes) | **pass** (4.4 MB Hermes bytecode) |
| Web-only preview code absent from the Android bundle | **verified** (grep of the plain-JS export: no `sql.js`, seed or demo data) |
| Same checks on GitHub-hosted runners (Node 22) | **pass** in both release runs (`quality` job) |

What the tests do **not** cover: they cannot run the app on a real Android device or emulator (none is available here). UI tests run in Jest with mocked native modules
(reanimated, svg, router, keyboard controller, pickers) and a **real** SQLite engine. Behaviour that depends on the Android runtime (Hermes `Intl`, native date/time
dialogs, keyboard handling under edge-to-edge, expo-sqlite itself) has therefore **not been exercised on a device**. Do a quick smoke test on a phone before releasing.

## 3. Visual QA

The production screens were rendered through `react-native-web` and inspected (`store/screenshots`). This found and fixed real layout bugs (hero gradient
size, clipped chip rows and tab labels, noisy compact amounts, an incoherent stop summary). It is a web rendering, not a device capture.

## 4. Android configuration (from the generated native project)

| Item | Value |
| --- | --- |
| Package / application id | `com.workearn.app` |
| versionName / versionCode | `1.0.0` / `1` |
| targetSdk / compileSdk / minSdk | **36** / 37 / 24 |
| Why target 36 | Official Google requirement quoted from <https://developer.android.com/google/play/requirements/target-sdk> (read 12 Nov 2026): from 31 Aug 2026 new apps and updates must target Android 16 (API 36) or higher. |
| Permissions (merged manifest of the built bundle) | No network, storage, overlay, vibrate or install-referrer permission. The only `uses-permission` is the app-internal, signature-level `com.workearn.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` that AndroidX adds to every app (not visible to users). The release workflow **fails** on anything else. |
| Backups | `allowBackup="false"` |
| Icons / splash | Adaptive icon (foreground + background + monochrome), splash with dark variant (`#FFFFFF` / `#0F1113`) |
| Shrinking | R8 minification and resource shrinking enabled |
| Release signing | Upload key from env / secrets / `keystore.properties` via `plugins/withReleaseSigning.js`; never the debug key (unit-tested, Gradle snippet validated with Gradle 8.14) |

## 5. Android App Bundle

| Route | Result |
| --- | --- |
| **EAS Build** — `npx eas-cli build --platform android --profile production --non-interactive` (attempted 12 Nov 2026) | **Blocked — requires developer action.** Output: *"An Expo user account is required to proceed. Either log in with `eas login` or set the `EXPO_TOKEN` environment variable…"* then *"Error: build command failed."* (`api.expo.dev` and `expo.dev` are also denied by this environment's network policy.) |
| **Local Gradle build in the agent sandbox** | **Blocked.** `dl.google.com` (Android SDK, NDK, Google Maven) is denied by the sandbox network policy (HTTP 403) and no Android SDK is installed. |
| **GitHub Actions** (ubuntu-latest, JDK 21, Expo prebuild, Gradle `bundleRelease`) | **Completed — two successful runs.** |

**Final bundle (run #2, commit `230e743`)**

- Run: <https://github.com/kobejanssen26-wq/WorkEarn/actions/runs/43205520385>
- **Artifact: `workearn-UNSIGNED-aab`** (id 13939975897): <https://github.com/kobejanssen26-wq/WorkEarn/actions/runs/43205520385/artifacts/13939975897>
  — a zip of 71,344,571 bytes (SHA-256 of the zip `b8fefebf2405a5c1b4b4624a34164360f22804472144e4a36a2de6385bb0a442`) containing `WorkEarn-1.0.0-UNSIGNED.aab` and `aab-report.txt`.
  Kept until 12 Dec 2026; downloading needs a GitHub login with access to the repository.
- Verified inside the job with Google's bundletool (from the job log): `validate` → **VALID**; `package="com.workearn.app"`; `versionCode="1"`; `versionName="1.0.0"`;
  `minSdkVersion="24"`, **`targetSdkVersion="36"`**, `compileSdkVersion="37"`; `allowBackup="false"`;
  only the internal signature permission listed above; **signature: unsigned** (`jar is unsigned`).
  The workflow does not list the bundle's native-library ABIs, so no claim is made about them here.
- **The bundle is UNSIGNED, so Google Play will reject it.** Add the four upload-key secrets (`docs/ANDROID_RELEASE.md`) and re-run the workflow to get `workearn-release-aab`.
- **Not verified here:** I could not download the AAB into this environment (the artifact storage host is blocked), so the checks above are the workflow's own bundletool output, not a local inspection. The app has not been run from this bundle on a device.
- Run #1 (commit `df1443d`) also succeeded but its bundle additionally declared the Google Play *install referrer* permission (pulled in by `expo-application`, which was only used to show the version).
  That dependency was removed in `230e743`; **do not use run #1's artifact.**

Build time on GitHub (run #2, from the job timestamps): the `build-aab` job took about 16 minutes (Gradle `bundleRelease` about 14.5 minutes); the whole workflow, including the `quality` job, about 17.5 minutes.

## 6. Google Play preparation

| Item | Status |
| --- | --- |
| Title, short and full description (EN + NL), category recommendation | **Completed** — `docs/PLAY_LISTING.md` (limits enforced by a test) |
| App icon 512, feature graphic 1024 × 500, 8 screenshots 1080 × 1920 | **Completed** — `store/` (screenshots are renderings of the real UI with sample data, see `store/README.md`) |
| Privacy policy text | **Completed**, needs your name and email — `docs/PRIVACY_POLICY.md`; **you must host it and supply the URL** |
| Data safety answers, content rating preparation | **Completed** — `docs/PLAY_DATA_SAFETY.md`, `docs/PLAY_CONTENT_RATING.md` |
| Publication / approval | **Not claimed.** The developer uploads the AAB manually. |

## 7. Remaining manual actions (requires developer action)

1. Create the upload keystore and add the four GitHub secrets (`docs/ANDROID_RELEASE.md`), then run the *Android release bundle (AAB)* workflow to get a **signed** `.aab`.
2. Smoke-test the build on a real phone (`docs/SMOKE_TEST.md`, about 15 minutes).
3. Fill in developer name / support email, host the privacy policy and enter its URL in the Play Console.
4. Complete the Play Console declarations (Data safety, content rating, target audience, ads = none, financial features = none).
5. Optionally replace the generated screenshots with device screenshots.
6. Merge the development branch into your default branch (a pull request is not opened automatically).
7. Git history: the first five commits on the branch (`ffb02de` … `df1443d`, pushed early in the session) are not signed, so GitHub shows them as *Unverified*; all later commits are signed.
   Re-signing already-pushed commits would need a force-push, which was not done without your approval.
