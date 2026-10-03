module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // Shared modules are written with `@/*` path aliases (the same spec the
    // web build resolves through its bundler). This maps `@` -> ./src so the
    // identical source files bundle unchanged here too.
    [
      'module-resolver',
      {
        alias: { '@': './src' },
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      },
    ],
  ],
};
