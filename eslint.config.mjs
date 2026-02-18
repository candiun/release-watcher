import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const tsFiles = ['src/**/*.ts', 'src/**/*.d.ts'];

const typedRecommended = tseslint.configs.recommendedTypeChecked.map((config) => ({
  ...config,
  files: tsFiles,
  languageOptions: {
    ...(config.languageOptions ?? {}),
    parserOptions: {
      ...(config.languageOptions?.parserOptions ?? {}),
      project: ['./tsconfig.main.json', './tsconfig.renderer.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
}));

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'release/**', '.codex/**'],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ...(js.configs.recommended.languageOptions ?? {}),
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...(js.configs.recommended.rules ?? {}),
      'no-console': 'off',
    },
  },
  ...typedRecommended,
  {
    files: tsFiles,
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['src/main/yaml-compat.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['src/renderer/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  eslintConfigPrettier,
];
