import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import typescriptEslintPlugin from '@typescript-eslint/eslint-plugin';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: ['**/eslint.config.mjs'],
  },
  ...compat.extends(
    'prettier',
    'plugin:prettier/recommended',
    'plugin:@typescript-eslint/recommended',
    "plugin:import/recommended",
    "plugin:import/typescript",
  ),
  {
    plugins: {
      '@typescript-eslint': typescriptEslintPlugin,
      'unused-imports': unusedImportsPlugin,
    },

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },

      parser: tsParser,
      ecmaVersion: 5,
      sourceType: 'module',

      parserOptions: {
        project: path.resolve(__dirname, 'tsconfig.json'),
      },
    },

    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      'prettier/prettier': [
        'warn',
        {
          endOfLine: 'auto',
        },
      ],
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksConditionals: true,
          checksVoidReturn: false,
        },
      ],
      '@typescript-eslint/prefer-namespace-keyword': 'off',
      '@typescript-eslint/no-namespace': 'off',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal'],
          alphabetize: {
            order: 'asc',
          },
        },
      ],
      'import/no-unresolved': 0,
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['libs/*'],
              message: 'Use path alias instead (e.g., @app/core/..., @app/grpc/..., @app/mikro/..., @app/cache/..., @app/kafka/..., @app/auth/...).',
            },
          ],
        },
      ],
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_'
        },
      ],
    },
  },
];