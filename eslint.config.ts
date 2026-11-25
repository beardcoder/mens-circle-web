import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import { defineConfig } from 'eslint/config'
import eslintConfigPrettier from 'eslint-config-prettier'
import astro from 'eslint-plugin-astro'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import eslintPluginAstro from 'eslint-plugin-astro'

export default defineConfig([
  {
    ignores: ['dist/**', '.astro/**', '.claude/**', 'public/**', '**/*.min.js'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx,mts,cts}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'warn',
      complexity: ['error', 12],
      'max-depth': ['error', 4],
    },
  },
  {
    files: ['src/components/**', 'src/lib/shared/**', 'src/layouts/**', 'src/scripts/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@lib/server/*', '**/lib/server/*', '**/server/*'],
              message: 'Server code stays in src/lib/server; pass the data in as props or move pure code to src/lib/shared.',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['scripts/**', 'server.ts'],
    rules: { 'no-console': 'off' },
  },
  eslintConfigPrettier,
  { ...stylistic.configs.recommended, ignores: ['**/*.astro'] },
  { ...eslintPluginAstro.configs.recommended, rules: {} },
])
