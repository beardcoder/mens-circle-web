import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from 'eslint-config-prettier';
import astro from 'eslint-plugin-astro';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default defineConfig([
  // Build output, vendored assets and external services are never linted.
  // (node_modules and .git are ignored by ESLint out of the box.)
  {
    ignores: ['dist/**', '.astro/**', '.claude/**', 'public/**', 'listmonk/**', '**/*.min.js'],
  },

  // Base rule sets.
  js.configs.recommended,
  tseslint.configs.recommended,
  ...astro.configs.recommended,
  ...svelte.configs.recommended,

  // Browser + Node globals for plain script files.
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },

  // Svelte needs the TS parser for <script lang="ts"> and the project's svelte.config.
  {
    files: ['**/*.svelte', '**/*.svelte.{js,ts}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte'],
        svelteConfig,
      },
    },
  },

  // Project-wide rule tweaks.
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'warn',

      // A complexity budget, set at the measured ceiling of the code as it
      // stands rather than as an aspiration — so raising either number is a
      // deliberate admission that something got harder to read, not a drive-by.
      // The two functions that legitimately sit above it are exempted by name
      // below; everything else is under it.
      complexity: ['error', 12],
      'max-depth': ['error', 4],
    },
  },

  // The home-page block dispatcher: one `switch` over the block union with a
  // component per case (CLAUDE.md: adding a block means adding a case here).
  // The cyclomatic count reads that table as branching; splitting it would
  // scatter one lookup across several functions and read worse. The file holds
  // nothing else, so the exemption cannot quietly cover unrelated code.
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
