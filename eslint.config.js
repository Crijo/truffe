import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  {
    // sim/ est pur : seulement data/ et sim/, ni DOM, ni horloge, ni hasard.
    files: ['src/sim/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['../render/*', '../ui/*', '../input/*', '../audio/*', '../save/*', '../core/*', 'pixi.js', 'idb'] },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Passer un Rng à graine.' },
        { object: 'Date', property: 'now', message: "Passer l'heure en paramètre." },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'performance', 'localStorage', 'indexedDB'],
      'no-restricted-syntax': ['error', { selector: "NewExpression[callee.name='Date']", message: "Passer l'heure en paramètre." }],
    },
  },
);
