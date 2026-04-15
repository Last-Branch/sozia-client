const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const reactHooks = require('eslint-plugin-react-hooks');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  {
    files: ['sozia/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      // React hooks correctness
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // No console.log in production code (console.warn/error allowed)
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Prefer const
      'prefer-const': 'error',

      // Enforce alias import discipline:
      //   - Use @common/ for anything in sozia/common/
      //   - Use @/ for cross-package imports within sozia/client/
      //   - Never use relative paths that escape into src/ (old layout)
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/src/**'],
              message: "Do not import from src/. Use '@/' or '@common/' aliases instead.",
            },
            {
              group: [
                '../common/**',
                '../../common/**',
                '../../../common/**',
                '../../../../common/**',
              ],
              message: "Import from sozia/common using the '@common/' alias (e.g. '@common/models').",
            },
          ],
        },
      ],
    },
  },
];
