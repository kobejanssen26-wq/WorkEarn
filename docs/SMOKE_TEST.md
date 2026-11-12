# On-device smoke test (≈ 15 minutes)

The automated tests run on a real SQLite engine but **not on an Android device**. Before you upload to Google Play, run this checklist once on a
physical phone (ideally Android 14 or newer; also try Android 16, which this release targets).

An automated emulator run (workflow *Signing and device self-test*, Android 14) already covers a small part of this on every release candidate: install, first-run screen, Calendar /
History / Statistics opening, restart after a kill, and a crash-free log. The checklist below covers everything else, with real data and real fingers.

## Install the bundle on a phone

Option A — a Play Console **testing** track (needs the *signed* bundle from the workflow): upload it to your closed test (see [`PLAY_STORE_STAPPENPLAN_NL.md`](PLAY_STORE_STAPPENPLAN_NL.md)),
add your own Google account as a tester and install from the Play Store link.

Option B — sideload with bundletool (works with the unsigned bundle too; bundletool signs the generated APKs with a debug key for testing only):

```bash
java -jar bundletool.jar build-apks --bundle=WorkEarn-1.0.0-UNSIGNED.aab --output=workearn.apks --connected-device
java -jar bundletool.jar install-apks --apks=workearn.apks
```

## Checklist

| # | Do this | Expect |
| --- | --- | --- |
| 1 | Open the app for the first time | Splash, then Home with "Add your first employer". No permission prompts. |
| 2 | Add employer: name, wage 12.00, Saturday +50 %, Sunday +100 %, calculation interval 15 min / down | Saved; appears on Home and in Employers. |
| 3 | Start a shift | Status "Live", amount grows every second, "Worked" counts up. |
| 4 | Wait 2 minutes, lock the screen, unlock | Amount and time are correct (timestamps, not ticks). |
| 5 | **Swipe the app away and reopen it** | The shift is still running with the right elapsed time and earnings. |
| 6 | Pause (unpaid), wait, Resume | Amount stands still while paused; resumes afterwards. |
| 7 | Add a tip of 2.50 | "Bonuses & extras" shows +2.50. |
| 8 | Stop | Summary shows live estimate and final earnings (rounded down to 15 min); save. |
| 9 | History | The shift is listed with employer, times, duration and earnings. Open, edit the end time, save; the amount changes. |
| 10 | Calendar | Today shows the amount and a dot; tapping the day lists the shift. |
| 11 | Statistics | Totals match the history; the chart has a bar for the current week. |
| 12 | Add a shift by hand that crosses midnight (22:00 → 02:00) | Preview and saved amount reflect both days' rates (e.g. Saturday bonus after midnight). |
| 13 | Settings: theme Dark, then System; language Nederlands | UI switches immediately; the choice survives a restart. |
| 14 | Settings → Export to CSV | Android share sheet opens with a `.csv` file; opens correctly in a spreadsheet (semicolon format). |
| 15 | Android Settings → Apps → WorkEarn → Permissions | "No permissions requested". |
| 16 | Rotate the phone / use gesture navigation / Android back button | Layout stays usable; back navigates as expected. |
| 17 | Settings → Delete all data | Confirmation, then Home shows the empty state. |

Report any failure with the step number and, if possible, a screenshot.
