import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Lint gate for the storefront.
 *
 * The important rule here is `react/jsx-uses-vars` plus `no-undef`: a missing
 * import (like a bare `<Link>` in a page that forgot to import it) builds fine
 * under Vite and then crashes the whole page at runtime. ESLint is the only
 * thing that catches it before the browser does.
 */
export default [
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      // Take only the `rules` map from each preset. Spreading the whole preset
      // object also splats in a `plugins` key, which ESLint rejects because
      // "rules" expects severities only.
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.flat.recommended.rules,
      // the JSX runtime means React need not be in scope
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // This app fetches in effects and resets state when a route param changes
      // (`setData(null); load()`), which is the normal shape for that. The rule
      // flags a real perf footgun, not a bug, so it stays a warning.
      'react-hooks/set-state-in-effect': 'warn',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
