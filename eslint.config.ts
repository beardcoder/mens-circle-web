import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import astro from 'eslint-plugin-astro';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  // Build output and vendored assets are never linted.
  // (node_modules and .git are ignored by ESLint out of the box.)
  {
    ignores: ['dist/**', '.astro/**', '.claude/**', 'public/**', '**/*.min.js'],
  },

  // Base rule sets.
  js.configs.recommended,
  tseslint.configs.recommended,
  ...astro.configs.recommended,

  // Browser + Node globals for plain script files.
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  // Project-wide rule tweaks.
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'warn',

      // Set at the code's measured ceiling; raising it needs a reason.
      complexity: ['error', 12],
      'max-depth': ['error', 4],
    },
  },

  // CLI scripts log to the console by design.
  {
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },

  // Turn off everything Prettier owns.
  eslintConfigPrettier,

  // What Prettier leaves alone: blank lines between statements and the order of
  // imports. `bun run lint:fix` sets both.
  {
    plugins: { '@stylistic': stylistic, 'simple-import-sort': simpleImportSort },
    rules: {
      '@stylistic/padding-line-between-statements': [
        'error',
        // A blank line after declarations; one-line declarations may stand together.
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        {
          blankLine: 'any',
          prev: ['singleline-const', 'singleline-let', 'singleline-var'],
          next: ['singleline-const', 'singleline-let', 'singleline-var'],
        },
        // The same for exported declarations.
        { blankLine: 'always', prev: 'export', next: '*' },
        { blankLine: 'any', prev: 'singleline-export', next: 'singleline-export' },
        // Blank lines around conditions and loops.
        { blankLine: 'always', prev: '*', next: ['if', 'for', 'while', 'do', 'switch', 'try'] },
        { blankLine: 'always', prev: ['if', 'for', 'while', 'do', 'switch', 'try'], next: '*' },
        // And one before every return.
        { blankLine: 'always', prev: '*', next: 'return' },
      ],
      'simple-import-sort/imports': [
        'error',
        {
          groups: [
            // Side effects (the stylesheets), in their written order.
            ['^\\u0000'],
            // Runtime built-ins.
            ['^node:', '^bun(:|$)'],
            // Astro's virtual modules, then packages.
            ['^astro:', '^virtual:', '^@?\\w'],
            // Path aliases (tsconfig.json).
            ['^@(lib|components|data)(/|$)'],
            // Relative imports.
            ['^\\.'],
          ],
        },
      ],
    },
  },
]);
