import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

const API_MODULES = ['accounts', 'themes']

const CROSS_MODULE_MESSAGE =
  "LAW-001.4 / LAW-008.4: import the other module's index.ts, and only from module-adapters/."

// A module reaches its own layers through the `@/` alias (LAW-007.8), so the cross-module
// guard has to exclude the importing module itself.
function otherModules(self) {
  return { group: ['@/modules/*/**', `!@/modules/${self}/**`], message: CROSS_MODULE_MESSAGE }
}

function restrictedImports(patterns) {
  return { 'no-restricted-imports': ['error', { patterns }] }
}

function moduleConfigs(self) {
  const module = `apps/api/src/modules/${self}`

  return [
    {
      files: [`${module}/domain/**/*.ts`],
      rules: restrictedImports([
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
            '@/modules/*/application/**',
            '@/modules/*/infrastructure/**',
            '@/modules/*/presentation/**',
            '@/modules/*/composition/**',
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
        otherModules(self),
      ]),
    },
    {
      files: [`${module}/application/**/*.ts`],
      rules: restrictedImports([
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
          group: ['@/modules/*/infrastructure/**', '@/modules/*/presentation/**'],
          message: 'LAW-003.6: application does not import infrastructure or presentation.',
        },
        otherModules(self),
      ]),
    },
    {
      files: [`${module}/infrastructure/**/*.ts`],
      ignores: [`${module}/infrastructure/module-adapters/**`],
      rules: restrictedImports([
        {
          group: ['fastify', '@fastify/*'],
          message: 'LAW-005.1: Fastify only exists in presentation/ and composition/.',
        },
        {
          group: ['@/modules/*/presentation/**', '@/modules/*/composition/**'],
          message: 'LAW-004.1: infrastructure does not import presentation or composition.',
        },
        otherModules(self),
      ]),
    },
    {
      files: [`${module}/presentation/**/*.ts`],
      // LAW-011.2/11.3: integration tests live under presentation/ but are driven by the
      // module's own integration container, so the presentation import guard cannot apply.
      ignores: [`${module}/presentation/integration/**`],
      rules: restrictedImports([
        {
          group: ['@/generated/prisma*', '@/generated/prisma/*'],
          message: 'LAW-004.5: Prisma types stay contained in infrastructure/.',
        },
        {
          group: [
            '@/modules/*/infrastructure/**',
            '@/modules/*/composition/**',
            '@/modules/*/domain/entities/**',
            '@/modules/*/domain/value-objects/**',
            '@/modules/*/domain/repositories/**',
            '@/modules/*/domain/ports/**',
          ],
          message:
            'LAW-005.8: presentation imports use cases and domain errors, never entities, VOs, repositories, ports or infrastructure.',
        },
        otherModules(self),
      ]),
    },
    {
      files: [`${module}/composition/**/*.ts`, `${module}/presentation/integration/**/*.ts`],
      rules: restrictedImports([otherModules(self)]),
    },
  ]
}

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
        {
          selector: "CallExpression[callee.object.name='Reflect'][callee.property.name='get']",
          message:
            'Convenções §2.2: Reflect.get returns any and hides the real contract. Call the member directly.',
        },
      ],
    },
  },
  ...API_MODULES.flatMap(moduleConfigs),
  // LAW-010.3 — shared never imports modules
  {
    files: ['apps/api/src/shared/**/*.ts'],
    rules: restrictedImports([
      { group: ['@/modules/*'], message: 'LAW-010.3: shared/ never imports from modules/.' },
    ]),
  },
  prettier,
)
