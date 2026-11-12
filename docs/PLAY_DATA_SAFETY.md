# Google Play — Data safety form (preparation)

Answers to enter in **Play Console → App content → Data safety** for WorkEarn 1.0.0. They follow from how the app is built; re-check them
if you ever add a library that uses the network.

## Why "no data collected"

Google defines *collecting* as transmitting data off the device. WorkEarn has no network permission, no server, no analytics, no
advertising and no third-party SDK that sends data anywhere. Data that only ever lives on the device (employers, shifts, settings) is not
"collected" and is not "shared". The CSV export is a user-initiated hand-off to an app the user selects in the Android share sheet; that is
not collection by the developer.

## Form answers

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | Not shown (no data collected) |
| Do you provide a way for users to request that their data is deleted? | Not shown (no data collected). In-app deletion exists anyway: Settings → Delete all data |
| Data types (location, personal info, financial info, health, messages, photos, audio, files, calendar, contacts, app activity, web history, app info, device IDs) | **None collected, none shared** |

Note on **financial info**: the app lets users record their own earnings, but this stays on the device and is never transmitted, so it is not declared as collected.

## Related declarations

| Declaration | Answer |
| --- | --- |
| Ads | **No ads** |
| Privacy policy URL | **Developer must supply** a public URL hosting `docs/PRIVACY_POLICY.md` (completed with real contact details). No URL is provided in this repository. |
| Target audience | 18 and over (work and earnings tracking) |
| Financial features declaration | "My app doesn't provide any financial features" (it only records user-entered work hours and wages; no payments, loans, banking or trading) |
| Health apps declaration | Not a health app |
| Government app | No |
| News app | No |
| App access | All functionality available without login |
| Content rating | See `docs/PLAY_CONTENT_RATING.md` |

## Permissions

The Android manifest removes the default `INTERNET`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `SYSTEM_ALERT_WINDOW` and `VIBRATE`
permissions, and the app does not include Google's Install Referrer library. The release workflow dumps the **merged** manifest of the built
bundle and **fails** if any `uses-permission` other than `<package>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` appears. That one is an internal,
signature-level permission that AndroidX adds to every app; it is not shown to users and gives no access to data.
