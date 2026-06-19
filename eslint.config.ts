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
    ignores: ['dist/**', '.astro/**', '.claude/**', 'public/**', 'pocketbase/**', 'listmonk/**', '**/*.min.js'],
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
    },
  },

  // CLI scripts and the server adapter log to the console by design.
  {
    files: ['scripts/**', 'adapter/**'],
    rules: { 'no-console': 'off' },
  },

  // Turn off everything Prettier owns — keep this last.
  eslintConfigPrettier,
]);
