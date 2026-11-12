# Android release guide

## Google Play requirements (checked against the official documentation)

Source: <https://developer.android.com/google/play/requirements/target-sdk> (read on 12 November 2026).

> Starting August 31 2026: new apps and app updates must target **Android 16 (API level 36) or higher** to be submitted to Google Play
> (Wear OS / Automotive: API 35; TV / XR: API 34). An extension to November 1, 2026 could be requested.

WorkEarn is configured accordingly (`app.json` → `expo-build-properties`): `targetSdkVersion 36`, `compileSdkVersion 37`, `minSdkVersion 24`.
The release workflow asserts `android:targetSdkVersion="36"` in the built bundle.

## One-time: create the upload key

Google Play signs your app for users with the *app signing key* it manages (Play App Signing). You sign each upload with your own
**upload key**. Create it once on your own machine and keep it safe (password manager + offline backup). **Never commit it.**

```bash
keytool -genkeypair -v -storetype JKS -keystore workearn-upload.jks \
  -alias workearn-upload -keyalg RSA -keysize 2048 -validity 10000
```

Keep the keystore file, its password, the alias and the key password. If you lose the key, Play support can reset the upload key, but it takes time.

## Route 1 — GitHub Actions (no Expo account)

1. Add four repository secrets (**Settings → Secrets and variables → Actions**):

   | Secret | Value |
   | --- | --- |
   | `ANDROID_UPLOAD_KEYSTORE_BASE64` | output of `base64 -w0 workearn-upload.jks` |
   | `ANDROID_UPLOAD_STORE_PASSWORD` | keystore password |
   | `ANDROID_UPLOAD_KEY_ALIAS` | `workearn-upload` |
   | `ANDROID_UPLOAD_KEY_PASSWORD` | key password |

2. **Actions → Android release bundle (AAB) → Run workflow** (it also runs on pushes to `claude/**` branches and `v*` tags).
3. When it finishes, open the run and download the artifact **`workearn-release-aab`** (contains `WorkEarn-<version>-release.aab` and
   `aab-report.txt` with checksum, bundletool validation, manifest and signature check).
4. Upload the `.aab` in **Play Console → Testing / Production → Create new release**.

Without the secrets the workflow still builds and verifies the bundle but labels it **`workearn-UNSIGNED-aab`**: Play Console rejects unsigned bundles.
The release build is *never* signed with the debug key (`plugins/withReleaseSigning.js`).

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
export WORKEARN_UPLOAD_STORE_FILE=/abs/path/workearn-upload.jks
export WORKEARN_UPLOAD_STORE_PASSWORD=...  WORKEARN_UPLOAD_KEY_ALIAS=workearn-upload  WORKEARN_UPLOAD_KEY_PASSWORD=...
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
