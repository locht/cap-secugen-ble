export default {
  input: 'dist/esm/index.js',
  external: ['@capacitor/core'],
  output: [
    {
      file: 'dist/plugin.js',
      format: 'iife',
      name: 'capacitorSecuGenBLE',
      globals: {
        '@capacitor/core': 'capacitorExports',
      },
      sourcemap: true,
      inlineDynamicImports: true,
    },
    {
      file: 'dist/plugin.cjs.js',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true,
    },
  ],
};
