import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'dev-dist/**', 'node_modules/**', 'proxy/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // Untrusted archive data must never be written as HTML.
      'no-restricted-properties': [
        'error',
        { property: 'innerHTML', message: 'Use the h() helper / textContent instead.' },
        { property: 'outerHTML', message: 'Use the h() helper / textContent instead.' },
      ],
    },
  },
);
