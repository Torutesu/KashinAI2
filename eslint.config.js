// eslint.config.js — flat config
//
// Pragmatic ruleset: catch real mistakes (unused vars, unsafe patterns) without
// forcing a large stylistic churn on the existing codebase. Type-checked rules
// are intentionally NOT enabled to keep lint fast and independent of tsconfig.

const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const globals = require('globals');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'lancedb/**', 'prisma/**', 'coverage/**', 'public/**', '*.config.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // `any` is used deliberately at SDK boundaries (LLM providers, LanceDB).
      '@typescript-eslint/no-explicit-any': 'off',
      // Allow intentionally-unused args/vars when prefixed with `_`.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      // require() is used for lazy loading of native modules.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Tests use assertion helpers and occasional loose typing.
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // The Chrome extension runs in the browser / extension context.
    files: ['kashinai-extension/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  }
);
