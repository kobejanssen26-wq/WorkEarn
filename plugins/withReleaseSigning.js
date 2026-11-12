/**
 * Expo config plugin: production signing for the Android release build.
 *
 * The default template signs `release` with the public debug keystore, which Google Play must never
 * receive. This plugin makes the release build use an UPLOAD key that is supplied from outside the
 * repository, in this order of precedence:
 *   1. environment variables (CI / GitHub Actions secrets)
 *   2. android/keystore.properties (git-ignored, local builds)
 *   3. Gradle properties (~/.gradle/gradle.properties)
 *
 *   WORKEARN_UPLOAD_STORE_FILE      absolute path to the .jks / .keystore
 *   WORKEARN_UPLOAD_STORE_PASSWORD
 *   WORKEARN_UPLOAD_KEY_ALIAS
 *   WORKEARN_UPLOAD_KEY_PASSWORD
 *
 * If any value is missing the release bundle is left UNSIGNED (Play Console rejects it) instead of being
 * signed with the debug key. EAS Build injects its own managed credentials and is unaffected.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const HELPER = `// --- WorkEarn release signing (plugins/withReleaseSigning.js) ---
def workearnKeystoreProps = new Properties()
def workearnKeystorePropsFile = rootProject.file("keystore.properties")
if (workearnKeystorePropsFile.exists()) {
    workearnKeystorePropsFile.withInputStream { workearnKeystoreProps.load(it) }
}
def workearnProp = { String name ->
    def fromEnv = System.getenv(name)
    if (fromEnv != null && !fromEnv.isEmpty()) return fromEnv
    def fromFile = workearnKeystoreProps.getProperty(name)
    if (fromFile != null && !fromFile.isEmpty()) return fromFile
    def fromGradle = findProperty(name)
    return fromGradle != null ? fromGradle.toString() : null
}
def workearnStoreFile = workearnProp("WORKEARN_UPLOAD_STORE_FILE")
def workearnHasUploadKey = workearnStoreFile != null &&
    new File(workearnStoreFile).exists() &&
    workearnProp("WORKEARN_UPLOAD_STORE_PASSWORD") != null &&
    workearnProp("WORKEARN_UPLOAD_KEY_ALIAS") != null &&
    workearnProp("WORKEARN_UPLOAD_KEY_PASSWORD") != null
if (!workearnHasUploadKey) {
    logger.warn("WorkEarn: no upload keystore configured - the release bundle will be UNSIGNED (not uploadable to Google Play).")
}
// --- end WorkEarn release signing ---

`;

const UPLOAD_CONFIG = `        if (workearnHasUploadKey) {
            upload {
                storeFile new File(workearnStoreFile)
                storePassword workearnProp("WORKEARN_UPLOAD_STORE_PASSWORD")
                keyAlias workearnProp("WORKEARN_UPLOAD_KEY_ALIAS")
                keyPassword workearnProp("WORKEARN_UPLOAD_KEY_PASSWORD")
            }
        }
`;

const RELEASE_SIGNING = `            // WorkEarn: sign with the upload key if one was provided, never with the debug key.
            if (workearnHasUploadKey) {
                signingConfig signingConfigs.upload
            }
`;

function patchBuildGradle(contents) {
  if (contents.includes('WorkEarn release signing')) return contents; // idempotent

  // 1. helper before the android { } block
  if (!/^android \{/m.test(contents)) throw new Error('withReleaseSigning: could not find the android { } block');
  let out = contents.replace(/^android \{/m, `${HELPER}android {`);

  // 2. upload signing config next to the debug one
  if (!/signingConfigs \{\n/.test(out)) throw new Error('withReleaseSigning: could not find signingConfigs { }');
  out = out.replace(/signingConfigs \{\n/, `signingConfigs {\n${UPLOAD_CONFIG}`);

  // 3. release build type must not use the debug key
  const releaseRegex = /(release \{\n(?:\s*\/\/[^\n]*\n)*)\s*signingConfig signingConfigs\.debug\n/;
  if (!releaseRegex.test(out)) throw new Error('withReleaseSigning: could not find the release signingConfig line');
  out = out.replace(releaseRegex, `$1${RELEASE_SIGNING}`);
  return out;
}

const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error('withReleaseSigning supports Groovy build.gradle only');
    mod.modResults.contents = patchBuildGradle(mod.modResults.contents);
    return mod;
  });

module.exports = withReleaseSigning;
module.exports.patchBuildGradle = patchBuildGradle;
module.exports.HELPER = HELPER;
