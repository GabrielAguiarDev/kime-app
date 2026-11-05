// iOS widget extension (WidgetKit), generated into ios/ by @bacons/apple-targets on prebuild.
// Colors come from tokens.json; the App Group mirrors the app's (app.json ios.entitlements).
const tokens = require('../../tokens.json');

/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'KimiWidgets',
  displayName: 'Kimi',
  bundleIdentifier: '.widgets',
  // Button(intent:) in widgets needs iOS 17.
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents', 'ActivityKit'],
  colors: {
    $accent: { color: tokens.color.light.accent, darkColor: tokens.color.dark.accent },
    $widgetBackground: { color: tokens.color.light.surface, darkColor: tokens.color.dark.surface },
  },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
