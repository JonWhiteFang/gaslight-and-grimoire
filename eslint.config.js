import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// Flat config (ESLint 9). Intentionally lean: TypeScript recommended rules +
// the react-hooks plugin (the reason ESLint was added — F-035). tsc already
// handles type-level correctness, so ESLint's job here is the lint-only
// concerns tsc can't see: hook dependency arrays and conditional hooks.
export default tseslint.config(
  {
    ignores: ['dist', 'coverage', 'build', 'node_modules', '**/*.mjs'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // The codebase deliberately annotates unused vars/args with a leading
      // underscore; honour that convention rather than flagging them.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Test files lean on cast-heavy mock plumbing; `any` there is pragmatic,
    // not a smell worth failing CI over.
    files: ['**/*.{test,property.test}.{ts,tsx}', 'src/test-setup.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
