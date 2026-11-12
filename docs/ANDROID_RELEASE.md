# Android release guide

## Google Play requirements (checked against the official documentation)

Source: <https://developer.android.com/google/play/requirements/target-sdk> (read on 12 November 2026).

> Starting August 31 2026: new apps and app updates must target **Android 16 (API level 36) or higher** to be submitted to Google Play
> (Wear OS / Automotive: API 35; TV / XR: API 34). An extension to November 1, 2026 could be requested.

WorkEarn is configured accordingly (`app.json` → `expo-build-properties`): `targetSdkVersion 36`, `compileSdkVersion 37`, `minSdkVersion 24`.
The release workflow asserts `android:targetSdkVersion="36"` in the built bundle.

## One-time: create the upload key

Google Play signs your app for users with the *app signing key* it manages (Play App Signing, mandatory for new apps). You sign each upload with your own
**upload key**. Keep it safe (password manager + offline backup). **Never commit it.** If it is ever lost or leaked, Play Console lets you request an
upload-key reset; the app signing key is not affected.

```bash
keytool -genkeypair -storetype PKCS12 -keystore workearn-upload.p12 -alias upload -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 workearn-upload.p12        # the text for the GitHub secret below
```

A PKCS12 keystore has a single password: use the same one for the key. The key must be valid beyond 22 October 2033 (10 000 days is plenty).

## Route 1 — GitHub Actions (no Expo account)

1. Add repository secrets (**Settings → Secrets and variables → Actions → New repository secret**):

   | Secret | Required | Value |
   | --- | --- | --- |
   | `ANDROID_UPLOAD_KEYSTORE_BASE64` | yes | the whole output of `base64 -w0 workearn-upload.p12` |
   | `ANDROID_UPLOAD_STORE_PASSWORD` | yes | the keystore password |
   | `ANDROID_UPLOAD_KEY_ALIAS` | no | alias inside the keystore (default `upload`) |
   | `ANDROID_UPLOAD_KEY_PASSWORD` | no | key password (default: the keystore password) |

   Spaces or line breaks that sneak in while pasting are removed automatically. The workflow opens the keystore early and stops with a readable message if the secrets do not belong together.
2. **Actions → Android release bundle (AAB) → Run workflow** (it also runs on pushes to `claude/**` and `main` branches and on `v*` tags; pushes that only touch `*.md`, `docs/` or `store/` are skipped, and a running build is never cancelled — a newer push waits in the queue).
3. When it finishes, open the run and download the artifact **`workearn-release-aab`** (contains `WorkEarn-<version>-release.aab` and
   `aab-report.txt` with checksum, bundletool validation, the merged manifest, the signature check and the fingerprint of the certificate that signed the bundle). The workflow **fails** if the bundle declares any permission other than AndroidX's internal `<package>.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, if package / versionCode / versionName / targetSdk 36 do not match `app.json`, or if a bundle built with the upload key does not verify with `jarsigner`.
   Artifacts are kept for 30 days; downloading needs a GitHub login with access to the repository.
4. Upload the `.aab` in **Play Console → Testing / Production → Create new release**. The step-by-step version for beginners (Dutch): [`PLAY_STORE_STAPPENPLAN_NL.md`](PLAY_STORE_STAPPENPLAN_NL.md).

Without the secrets the workflow still builds and verifies the bundle but labels it **`workearn-UNSIGNED-aab`**: Play Console rejects unsigned bundles.
The release build is *never* signed with the debug key (`plugins/withReleaseSigning.js`).

### Proof that signing and launch work — no secrets needed

**Actions → Signing and device self-test → Run workflow.** It creates a *throwaway* upload key on the runner, builds the AAB and a release APK through the same signing code path,
verifies both signatures against that key, then installs the APK on an Android 14 emulator and checks: the first-run screen, Calendar / History / Statistics, a restart after the app is
killed, and no crash in the log. Screenshots, UI dumps and the log are kept for 7 days as the artifact `device-check-evidence`. It is a smoke test; it does not replace [`SMOKE_TEST.md`](SMOKE_TEST.md).

## Route 2 — EAS Build

```bash
npx eas-cli login                       # or set EXPO_TOKEN (create one at expo.dev -> Account settings -> Access tokens)
npx eas-cli init                        # once: creates the EAS project and writes extra.eas.projectId into app.json
npx eas-cli build --platform android --profile production
```

Without `eas login` / `EXPO_TOKEN` the command stops with: *"An Expo user account is required to proceed."*

EAS creates and stores the keystore for you the first time (interactive run required for credential generation). Download the `.aab` from the
build page. `eas.json` uses `appVersionSource: local`, so bump `android.versionCode` in `app.json` before every upload.

## Route 3 — local build

Requires JDK 21 and the Android SDK (platform 37, build-tools 37.0.0, NDK 27.1.12297006, CMake 3.22.1; Gradle downloads missing parts when licences are accepted).

```bash
npm ci
npx expo prebuild --platform android --no-install
export WORKEARN_UPLOAD_STORE_FILE=/abs/path/workearn-upload.p12
export WORKEARN_UPLOAD_STORE_PASSWORD=...  WORKEARN_UPLOAD_KEY_ALIAS=upload  WORKEARN_UPLOAD_KEY_PASSWORD=...
cd android && ./gradlew :app:bundleRelease
# -> android/app/build/outputs/bundle/release/app-release.aab
```

(Alternatively put the four values in `android/keystore.properties`, which is git-ignored.)

## Versioning

For every upload to Google Play increase `expo.android.versionCode` (integer, must be higher than any previous upload) and, for user-visible
releases, `expo.version` in `app.json`. The workflow reads both values from `app.json` and verifies that the built bundle matches.

## Verifying a bundle yourself

```bash
java -jar bundletool.jar validate --bundle=app-release.aab
java -jar bundletool.jar dump manifest --bundle=app-release.aab     # package, versionCode, versionName, targetSdkVersion, permissions
jarsigner -verify -verbose:summary app-release.aab                  # signature present?
```
