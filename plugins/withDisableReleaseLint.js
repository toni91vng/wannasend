// Desactiva el análisis "lint" de Android en las builds de release.
// Motivo: @stripe/stripe-react-native declara una dependencia opcional (push provisioning de tarjetas emitidas)
// que arrastra play-services-tapandpay, que no está publicada en los repositorios públicos. El lint de release
// intenta resolverla y la build falla. La app no usa esa función, así que no afecta a nada.
const { withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withDisableReleaseLint(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes('checkReleaseBuilds false')) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /android\s*\{/,
        'android {\n    lint {\n        checkReleaseBuilds false\n        abortOnError false\n    }',
      );
    }
    return cfg;
  });
};
