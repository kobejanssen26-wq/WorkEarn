// eslint-disable-next-line @typescript-eslint/no-require-imports
const { patchBuildGradle } = require('../plugins/withReleaseSigning.js') as { patchBuildGradle: (s: string) => string };

/** The relevant part of the Expo SDK 58 app/build.gradle template. */
const TEMPLATE = `apply plugin: "com.android.application"

android {
    compileSdk rootProject.ext.compileSdkVersion
    defaultConfig {
        applicationId 'com.workearn.app'
    }
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'
            minifyEnabled true
        }
    }
}
`;

describe('release signing config plugin', () => {
  const patched = patchBuildGradle(TEMPLATE);

  it('never signs the release build with the debug key', () => {
    const release = patched.slice(patched.indexOf('release {'));
    expect(release).not.toMatch(/signingConfig signingConfigs\.debug/);
    expect(release).toMatch(/if \(workearnHasUploadKey\) \{\s*signingConfig signingConfigs\.upload/);
    // the debug build type keeps the debug key
    expect(patched.slice(patched.indexOf('debug {\n            signingConfig'))).toMatch(/signingConfigs\.debug/);
  });

  it('reads credentials only from the environment, keystore.properties or Gradle properties, never from the repository', () => {
    expect(patched).toContain('WORKEARN_UPLOAD_STORE_FILE');
    expect(patched).toContain('System.getenv(name)');
    expect(patched).toContain('keystore.properties');
    expect(patched).not.toMatch(/storePassword\s+['"][^'"]+['"]\s*\n\s*keyAlias\s+['"]workearn/i);
  });

  it('is idempotent', () => {
    expect(patchBuildGradle(patched)).toBe(patched);
  });

  it('fails loudly if the template changes shape instead of silently shipping the debug key', () => {
    expect(() => patchBuildGradle('plugins { }\n')).toThrow(/android \{/);
    expect(() => patchBuildGradle(TEMPLATE.replace('signingConfig signingConfigs.debug\n            def enable', 'def enable'))).toThrow(/release signingConfig/);
  });
});
