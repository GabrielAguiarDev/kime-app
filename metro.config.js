// https://docs.expo.dev/guides/customizing-metro
const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Rive files (assets/brand/kimi.riv) are bundled as assets.
config.resolver.assetExts.push('riv');

// Until assets/brand/kimi.riv exists, KimiMascot's `./kimiRiv` resolves to a
// stub (null) and the mascot stays the static SVG. After adding the file,
// restart the bundler with a clean cache: `npx expo start --clear`.
const KIMI_RIV = path.join(__dirname, 'assets/brand/kimi.riv');
const KIMI_RIV_MISSING = path.join(__dirname, 'src/components/KimiMascot/kimiRivMissing.ts');
const defaultResolve = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === './kimiRiv' && context.originModulePath.includes('KimiMascot') && !fs.existsSync(KIMI_RIV)) {
    return { type: 'sourceFile', filePath: KIMI_RIV_MISSING };
  }
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
