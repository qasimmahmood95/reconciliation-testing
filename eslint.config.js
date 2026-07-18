import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // CLAUDE.md hard rules 1 (no floats for money) and 3 (determinism)
    // enforced in library code. Fractional literals, parseFloat, Date.now
    // and Math.random have no legitimate use in src/.
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[raw=/^\\d[\\d_]*\\.\\d/]',
          message:
            'Fractional number literals are banned in library code: amounts are bigint minor units (CLAUDE.md rule 1).',
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'parseFloat',
          message: 'Floats are banned for money (CLAUDE.md rule 1).',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message:
            'Core logic is deterministic; time must be an explicit input (CLAUDE.md rule 3).',
        },
        {
          object: 'Math',
          property: 'random',
          message:
            'Core logic is deterministic; randomness lives only in fast-check generators (CLAUDE.md rule 3).',
        },
        {
          object: 'Number',
          property: 'parseFloat',
          message: 'Floats are banned for money (CLAUDE.md rule 1).',
        },
      ],
    },
  },
);
