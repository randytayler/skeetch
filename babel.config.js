module.exports = function (api) {
  // The Babel config API is untyped in this plain CJS file.
  // oxlint-disable-next-line typescript/no-unsafe-call, typescript/no-unsafe-member-access
  api.cache(true)
  const isTestEnv = process.env.NODE_ENV === 'test'
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          lazyImports: true,
          native: {
            // Disable ESM -> CJS compilation because Metro takes care of it.
            // However, we need it in Jest tests since those run without Metro.
            disableImportExportTransform: !isTestEnv,
          },
        },
      ],
    ],
    plugins: [
      // babel-preset-expo no longer transforms the static class blocks shipped
      // by newer @formatjs polyfills (e.g. intl-displaynames), so enable the
      // transform explicitly for native/web too - not just the test env below.
      '@babel/plugin-transform-class-static-block',
      '@lingui/babel-plugin-lingui-macro',
      ['babel-plugin-react-compiler', {target: '19'}],
      'module:react-native-dotenv', // used by web build! can remove when we drop webpack
      [
        'module-resolver',
        {
          alias: {
            // This needs to be mirrored in tsconfig.json
            '#': './src',
            crypto: './src/platform/crypto.ts',
          },
        },
      ],
      'react-native-reanimated/plugin', // NOTE: this plugin MUST be last
    ],
    env: {
      production: {
        plugins: ['transform-remove-console'],
      },
      test: {
        plugins: ['@babel/plugin-transform-class-static-block'],
      },
    },
  }
}
