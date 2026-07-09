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
      // ESLint 10 + eslint-plugin-react-hooks 7 add these to their `recommended`
      // presets. They flag working, intentional code — not the hook-deps /
      // conditional-hooks bugs this lean config exists to catch — so keeping the
      // pre-migration lint contract, we opt out rather than fold a behavioural
      // refactor into a dependency bump:
      //   - set-state-in-effect: a performance heuristic; our effects that call
      //     setState (init-from-storage, animation resets) are deliberate and
      //     correct. Revisit as its own change if we adopt the React Compiler.
      //   - no-useless-assignment (core): flags defensive final assignments in
      //     the save-migration ladder and the onEnter guard that document intent.
      //   - refs: flags reading ref.current during render — which the Evidence
      //     Board does by design to measure DOM positions for connection threads.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'no-useless-assignment': 'off',
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
