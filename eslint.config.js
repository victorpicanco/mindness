import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', 'apps/api/src/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 20,
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Error']",
          message: 'LAW-009.1: throw a BaseError subclass, never Error.',
        },
      ],
    },
  },
  // LAW-002.1 — pure domain (merged with LAW-001.4/008.4 module boundaries)
  {
    files: ['apps/api/src/modules/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/generated/prisma*',
                '@/generated/prisma/*',
                'fastify',
                '@fastify/*',
                'typebox',
                'pino',
                'pg-boss',
              ],
              message:
                'LAW-002.1: domain does not import frameworks, ORMs, validation or transport libs.',
            },
            {
              group: [
                '@/modules/*/application/*',
                '@/modules/*/infrastructure/*',
                '@/modules/*/presentation/*',
                '@/modules/*/composition/*',
              ],
              message: 'LAW-002.1: domain does not import other layers.',
            },
            {
              group: [
                '@/shared/database/*',
                '@/shared/logger/*',
                '@/shared/http/*',
                '@/shared/crypto/*',
              ],
              message: 'LAW-010.4: domain only imports shared/types and shared/errors.',
            },
            {
              group: [
                '@/modules/*/domain/*',
                '@/modules/*/application/*',
                '@/modules/*/infrastructure/*',
                '@/modules/*/presentation/*',
                '@/modules/*/composition/*',
              ],
              message:
                "LAW-001.4 / LAW-008.4: import the other module's index.ts, and only from module-adapters/.",
            },
          ],
        },
      ],
    },
  },
  // LAW-003.6 — application without concretions (merged with LAW-001.4/008.4)
  {
    files: ['apps/api/src/modules/*/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/generated/prisma*',
                '@/generated/prisma/*',
                'fastify',
                '@fastify/*',
                'pg-boss',
              ],
              message: 'LAW-003.6: a use case depends on a domain interface, not on technology.',
            },
            {
              group: ['@/modules/*/infrastructure/*', '@/modules/*/presentation/*'],
              message: 'LAW-003.6: application does not import infrastructure or presentation.',
            },
            {
              group: [
                '@/modules/*/domain/*',
                '@/modules/*/application/*',
                '@/modules/*/infrastructure/*',
                '@/modules/*/presentation/*',
                '@/modules/*/composition/*',
              ],
              message:
                "LAW-001.4 / LAW-008.4: import the other module's index.ts, and only from module-adapters/.",
            },
          ],
        },
      ],
    },
  },
  // LAW-004.5 + LAW-005.1 + LAW-001.4/008.4 — infrastructure (non module-adapters)
  {
    files: ['apps/api/src/modules/*/infrastructure/**/*.ts'],
    ignores: ['apps/api/src/modules/*/infrastructure/module-adapters/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['fastify', '@fastify/*'],
              message: 'LAW-005.1: Fastify only exists in presentation/ and composition/.',
            },
            {
              group: [
                '@/modules/*/domain/*',
                '@/modules/*/application/*',
                '@/modules/*/infrastructure/*',
                '@/modules/*/presentation/*',
                '@/modules/*/composition/*',
              ],
              message:
                "LAW-001.4 / LAW-008.4: import the other module's index.ts, and only from module-adapters/.",
            },
          ],
        },
      ],
    },
  },
  // LAW-004.5 + LAW-001.4/008.4 — presentation
  {
    files: ['apps/api/src/modules/*/presentation/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/generated/prisma*', '@/generated/prisma/*'],
              message: 'LAW-004.5: Prisma types stay contained in infrastructure/.',
            },
            {
              group: [
                '@/modules/*/domain/*',
                '@/modules/*/application/*',
                '@/modules/*/infrastructure/*',
                '@/modules/*/presentation/*',
                '@/modules/*/composition/*',
              ],
              message:
                "LAW-001.4 / LAW-008.4: import the other module's index.ts, and only from module-adapters/.",
            },
          ],
        },
      ],
    },
  },
  // LAW-001.4/008.4 — composition
  {
    files: ['apps/api/src/modules/*/composition/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@/modules/*/domain/*',
                '@/modules/*/application/*',
                '@/modules/*/infrastructure/*',
                '@/modules/*/presentation/*',
                '@/modules/*/composition/*',
              ],
              message:
                "LAW-001.4 / LAW-008.4: import the other module's index.ts, and only from module-adapters/.",
            },
          ],
        },
      ],
    },
  },
  // LAW-010.3 — shared never imports modules
  {
    files: ['apps/api/src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/modules/*'],
              message: 'LAW-010.3: shared/ never imports from modules/.',
            },
          ],
        },
      ],
    },
  },
  prettier,
)
