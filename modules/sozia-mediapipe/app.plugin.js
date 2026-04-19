// Expo config plugin for sozia-mediapipe.
// Injects SoziaMediaPipePlugin.load() into AppDelegate (iOS) and
// MainApplication (Android) so the "extractLandmarks" frame processor
// plugin is registered before VisionCamera initialises.

const path = require('path');
const { withPlugins, withAppDelegate, withMainApplication, withSettingsGradle, withAppBuildGradle } = require('@expo/config-plugins');

// ---------------------------------------------------------------------------
// iOS — AppDelegate.swift
// ---------------------------------------------------------------------------
// Inserts `SoziaMediaPipePlugin.load()` just before the return statement
// in application(_:didFinishLaunchingWithOptions:).

function withIosRegistration(config) {
  return withAppDelegate(config, (cfg) => {
    const src = cfg.modResults.contents;

    if (src.includes('SoziaMediaPipePlugin.load()')) {
      return cfg; // already patched
    }

    // Insert before the first `return super.application` or `return true`
    // that appears inside application(_:didFinishLaunchingWithOptions:).
    cfg.modResults.contents = src.replace(
      /(return super\.application\(|return true)/,
      'SoziaMediaPipePlugin.load()\n    $1',
    );

    return cfg;
  });
}

// ---------------------------------------------------------------------------
// Android — MainApplication.kt
// ---------------------------------------------------------------------------
// Adds the import and calls SoziaMediaPipePlugin.load() at the top of onCreate().

function withAndroidRegistration(config) {
  return withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;

    if (src.includes('SoziaMediaPipePlugin.load()')) {
      return cfg; // already patched
    }

    // 1. Add import after the package declaration line.
    src = src.replace(
      /^(package .+)$/m,
      '$1\nimport com.sozia.mediapipe.SoziaMediaPipePlugin',
    );

    // 2. Call load() at the top of onCreate().
    src = src.replace(
      /(override fun onCreate\(\) \{)/,
      '$1\n    SoziaMediaPipePlugin.load()',
    );

    cfg.modResults.contents = src;
    return cfg;
  });
}

// ---------------------------------------------------------------------------
// Android — settings.gradle
// ---------------------------------------------------------------------------
// Registers the :sozia-mediapipe Gradle subproject so the app can depend on it.

function withAndroidSettingsGradle(config) {
  return withSettingsGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(':sozia-mediapipe')) {
      return cfg; // already included
    }

    const modulePath = path.resolve(__dirname, 'android').replace(/\\/g, '/');
    cfg.modResults.contents += [
      '',
      "include ':sozia-mediapipe'",
      `project(':sozia-mediapipe').projectDir = new File('${modulePath}')`,
    ].join('\n');

    return cfg;
  });
}

// ---------------------------------------------------------------------------
// Android — app/build.gradle
// ---------------------------------------------------------------------------
// Adds implementation project(':sozia-mediapipe') to the app dependencies.

function withAndroidAppBuildGradle(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes("project(':sozia-mediapipe')")) {
      return cfg; // already linked
    }

    cfg.modResults.contents = cfg.modResults.contents.replace(
      /dependencies\s*\{/,
      "dependencies {\n    implementation project(':sozia-mediapipe')",
    );

    return cfg;
  });
}

// ---------------------------------------------------------------------------

module.exports = (config) =>
  withPlugins(config, [
    withIosRegistration,
    withAndroidSettingsGradle,
    withAndroidAppBuildGradle,
    withAndroidRegistration,
  ]);
