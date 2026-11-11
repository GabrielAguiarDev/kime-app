const { withMod } = require('expo/config-plugins');

/** Keep apple-targets' synchronized groups in a format supported by Xcodeproj. */
module.exports = function withCocoaPodsProjectVersion(config) {
  // Register before apple-targets installs the provider for its custom project mod.
  return withMod(config, {
    platform: 'ios',
    mod: 'xcodeProjectBeta2',
    action(config) {
      const project = config.modResults;
      if (Number(project.objectVersion) === 70) {
        project.objectVersion = 77;
        project.rootObject.props.compatibilityVersion = 'Xcode 16.0';
      }
      return config;
    },
  });
};
