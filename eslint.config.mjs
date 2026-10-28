import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/** Mimari kurallar dependency-cruiser'da (.dependency-cruiser.cjs); burada kod düzeyi kurallar var (CODING_STANDARDS §11). */
const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [
      '.next/**',
      '.next-e2e/**',
      'node_modules/**',
      'drizzle/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: 'sql',
          property: 'raw',
          message: 'sql.raw yasak; parametreli sql şablonu kullan (SECURITY §5).',
        },
      ],
    },
  },
  {
    // dangerouslySetInnerHTML yalnızca SafeMarkdown bileşeninde (SECURITY §5).
    files: ['**/*.tsx'],
    rules: { 'react/no-danger': 'error' },
  },
  {
    // Domain ve application katmanında zaman yalnızca Clock portundan gelir (CODING_STANDARDS §3).
    files: ['src/modules/*/domain/**', 'src/modules/*/application/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'new Date() yerine Clock kullan.',
        },
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Date.now() yerine Clock kullan.',
        },
      ],
    },
  },
];

export default config;
