import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/out/**', '**/node_modules/**', '**/playwright-report/**', '**/test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.es2022 } } },
  {
    files: ['packages/relay-state/src/core/**/*.{ts,tsx}', 'packages/relay-state/src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: ['electron', 'react', 'react-dom'],
        patterns: ['node:*', '@relay-state/tasks/**']
      }]
    }
  }
);
