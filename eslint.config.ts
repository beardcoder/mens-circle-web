import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import astro from 'eslint-plugin-astro';
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

  // The home-page block dispatcher: one `switch` over the block union with a component per case (CLAUDE.md: adding a block means adding a case here).
  {
    files: ['src/components/PageContent.astro'],
    rules: { complexity: 'off' },
  },

  // CLI scripts log to the console by design.
  {
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },

  // Turn off everything Prettier owns — keep this last.
  eslintConfigPrettier,
]);
