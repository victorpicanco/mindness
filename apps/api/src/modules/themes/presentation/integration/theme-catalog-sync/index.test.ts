import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  buildCatalogReport,
  parseThemeCatalogCommand,
  synchronizeThemeCatalog,
  validateThemeCatalog,
} from '@scripts/sync-themes.js'
import {
  createThemesIntegrationContainer,
  type ThemesIntegrationContainer,
} from '@/modules/themes/composition/integration-container.js'
import { clearThemeData } from '@/modules/themes/composition/integration-fixtures.js'
import { ThemeRejected } from '@/modules/themes/domain/events/theme-rejected/index.js'
import { ValidationFailedError } from '@/shared/errors/validation-failed-error/index.js'

let integration: ThemesIntegrationContainer

beforeAll(() => {
  integration = createThemesIntegrationContainer({ databaseUrl: inject('databaseUrl') })
})

afterAll(async () => {
  await integration.close()
})

beforeEach(async () => {
  await clearThemeData(integration.prisma)
  integration.reset()
})

describe('theme catalog sync integration', () => {
  it('validates the catalog without requiring runtime dependencies', () => {
    const catalog: unknown = { categories: [] }

    expect(validateThemeCatalog(catalog)).toEqual(catalog)
    expect(parseThemeCatalogCommand('validate')).toBe('validate')
    expect(parseThemeCatalogCommand('preview')).toBe('preview')
    expect(parseThemeCatalogCommand('apply')).toBe('apply')
    expect(() => parseThemeCatalogCommand('unknown')).toThrow(ValidationFailedError)
  })

  it('previews the catalog against PostgreSQL without persisting it', async () => {
    const catalog: unknown = {
      categories: [
        {
          slug: 'mindfulness',
          name: 'Mindfulness',
          themes: [
            { title: 'Notice your breathing', difficulty: 'easy', publicationStatus: 'published' },
          ],
        },
      ],
    }

    const result = await synchronizeThemeCatalog(catalog, integration.container.useCases, {
      mode: 'preview',
    })

    expect(result.changes).toEqual({
      categories: { created: 1, updated: 0, unchanged: 0 },
      themes: { created: 1, updated: 0, unchanged: 0 },
    })
    expect(result.poolReports).toMatchObject([{ publishedCount: 1 }])
    await expect(integration.prisma.themeCategory.count()).resolves.toBe(0)
    await expect(integration.prisma.theme.count()).resolves.toBe(0)
    expect(integration.eventBus.published).toEqual([])
  })

  it('synchronizes the complete production catalog idempotently', async () => {
    const catalogPath = new URL('../../../../../../prisma/catalog/themes.json', import.meta.url)
    const catalog: unknown = JSON.parse(await readFile(catalogPath, 'utf8'))

    await synchronizeThemeCatalog(catalog, integration.container.useCases)
    await synchronizeThemeCatalog(catalog, integration.container.useCases)

    await expect(integration.prisma.themeCategory.count()).resolves.toBe(5)
    await expect(integration.prisma.theme.count()).resolves.toBe(640)
  })

  it('reports structured validation issues for an invalid catalog', async () => {
    const catalog: unknown = { categories: 'invalid' }

    await expect(
      synchronizeThemeCatalog(catalog, integration.container.useCases),
    ).rejects.toMatchObject({
      code: 'shared.VALIDATION_FAILED',
      context: {
        issues: [{ field: 'categories', message: 'Theme catalog categories is invalid' }],
      },
    })
    await expect(
      synchronizeThemeCatalog(catalog, integration.container.useCases),
    ).rejects.toBeInstanceOf(ValidationFailedError)
  })

  it('is idempotent and preserves a theme manually withdrawn after the first sync', async () => {
    const catalog: unknown = {
      categories: [
        {
          slug: 'mindfulness',
          name: 'Mindfulness',
          themes: [
            { title: 'Notice your breathing', difficulty: 'easy', publicationStatus: 'published' },
          ],
        },
      ],
    }

    await synchronizeThemeCatalog(catalog, integration.container.useCases)
    await synchronizeThemeCatalog(catalog, integration.container.useCases)
    const created = await integration.repositories.themes.drawPublished({
      categoryId: (await integration.repositories.categories.findBySlug('mindfulness'))?.id ?? '',
      difficulty: 'easy',
    })

    expect(created).not.toBeNull()
    if (created === null) return

    await integration.container.useCases.withdrawTheme.execute({ themeId: created.id })
    integration.reset()

    const revisedCatalog: unknown = {
      categories: [
        {
          slug: 'mindfulness',
          name: 'Mindful attention',
          themes: [
            {
              title: 'Notice   your breathing',
              difficulty: 'easy',
              publicationStatus: 'published',
            },
          ],
        },
      ],
    }

    const result = await synchronizeThemeCatalog(revisedCatalog, integration.container.useCases)

    await expect(integration.repositories.themes.findById(created.id)).resolves.toMatchObject({
      title: { value: 'Notice   your breathing' },
      publicationStatus: 'withdrawn',
    })
    await expect(
      integration.repositories.categories.findBySlug('mindfulness'),
    ).resolves.toMatchObject({
      name: 'Mindful attention',
    })
    await expect(integration.prisma.theme.count()).resolves.toBe(1)
    expect(integration.eventBus.published).toHaveLength(1)
    expect(integration.eventBus.published[0]).toMatchObject({ eventName: 'theme_pool_low' })
    expect(result.divergences).toEqual([
      {
        categorySlug: 'mindfulness',
        title: 'Notice   your breathing',
        reason: 'manual_withdrawal_preserved',
      },
    ])
  })

  it('reports pool shortfalls and manual withdrawals to the operator', async () => {
    const catalog: unknown = {
      categories: [
        {
          slug: 'mindfulness',
          name: 'Mindfulness',
          themes: [
            { title: 'Notice your breathing', difficulty: 'easy', publicationStatus: 'published' },
          ],
        },
      ],
    }

    await synchronizeThemeCatalog(catalog, integration.container.useCases)
    const withdrawn = await integration.repositories.themes.drawPublished({
      categoryId: (await integration.repositories.categories.findBySlug('mindfulness'))?.id ?? '',
      difficulty: 'easy',
    })
    expect(withdrawn).not.toBeNull()
    if (withdrawn === null) return
    await integration.container.useCases.withdrawTheme.execute({ themeId: withdrawn.id })

    const report = buildCatalogReport(
      await synchronizeThemeCatalog(catalog, integration.container.useCases),
    )

    expect(report.lines).toEqual([
      'change categories: 0 created, 0 updated, 1 unchanged',
      'change themes: 0 created, 0 updated, 1 unchanged',
      'pool  mindfulness / easy: 0/10 published',
      'drift mindfulness / "Notice your breathing": manual withdrawal preserved',
    ])
    expect(report.hasFindings).toBe(true)
  })

  it('reports no findings when every combination meets the minimum', async () => {
    const catalog: unknown = {
      categories: [
        {
          slug: 'mindfulness',
          name: 'Mindfulness',
          themes: Array.from({ length: 10 }, (_unused, index) => ({
            title: `Notice your breathing ${index + 1}`,
            difficulty: 'easy',
            publicationStatus: 'published',
          })),
        },
      ],
    }

    const report = buildCatalogReport(
      await synchronizeThemeCatalog(catalog, integration.container.useCases),
    )

    expect(report.lines).toEqual([
      'change categories: 1 created, 0 updated, 0 unchanged',
      'change themes: 10 created, 0 updated, 0 unchanged',
      'pool  mindfulness / easy: 10/10 published',
    ])
    expect(report.hasFindings).toBe(false)
  })

  it('rejects an invalid catalog record and continues synchronizing valid records', async () => {
    const catalog: unknown = {
      categories: [
        {
          slug: 'mindfulness',
          name: 'Mindfulness',
          themes: [
            { title: 'No', difficulty: 'easy', publicationStatus: 'published' },
            {
              title: 'Observe the sounds around you',
              difficulty: 'balanced',
              publicationStatus: 'published',
            },
          ],
        },
      ],
    }

    await synchronizeThemeCatalog(catalog, integration.container.useCases)

    await expect(integration.prisma.theme.count()).resolves.toBe(1)
    expect(integration.eventBus.published).toHaveLength(2)
    expect(integration.eventBus.published[0]).toBeInstanceOf(ThemeRejected)
    if (integration.eventBus.published[0] instanceof ThemeRejected) {
      expect(integration.eventBus.published[0].payload.issues).toEqual([
        { field: 'title', reason: 'is invalid' },
      ])
    }
  })

  it('rejects an invalid category name and continues synchronizing other categories', async () => {
    const catalog: unknown = {
      categories: [
        {
          slug: 'invalid-category',
          name: 'x',
          themes: [
            { title: 'Notice your breathing', difficulty: 'easy', publicationStatus: 'published' },
          ],
        },
        {
          slug: 'mindfulness',
          name: 'Mindfulness',
          themes: [
            {
              title: 'Observe the sounds around you',
              difficulty: 'balanced',
              publicationStatus: 'published',
            },
          ],
        },
      ],
    }

    await synchronizeThemeCatalog(catalog, integration.container.useCases)

    await expect(integration.prisma.theme.count()).resolves.toBe(1)
    const rejected = integration.eventBus.published.find(
      (event) =>
        event instanceof ThemeRejected && event.payload.categorySlug === 'invalid-category',
    )
    expect(rejected).toBeInstanceOf(ThemeRejected)
    if (rejected instanceof ThemeRejected) {
      expect(rejected.payload.issues).toEqual([{ field: 'name', reason: 'is invalid' }])
    }
  })

  it('updates difficulty and rejects duplicate normalized titles in one catalog', async () => {
    const initialCatalog: unknown = {
      categories: [
        {
          slug: 'mindfulness',
          name: 'Mindfulness',
          themes: [
            { title: 'Notice your breathing', difficulty: 'easy', publicationStatus: 'published' },
          ],
        },
      ],
    }
    const revisedCatalog: unknown = {
      categories: [
        {
          slug: 'mindfulness',
          name: 'Mindfulness',
          themes: [
            { title: 'Notice your breathing', difficulty: 'hard', publicationStatus: 'published' },
            {
              title: 'Notice   your breathing',
              difficulty: 'balanced',
              publicationStatus: 'published',
            },
          ],
        },
      ],
    }

    await synchronizeThemeCatalog(initialCatalog, integration.container.useCases)
    integration.reset()
    await synchronizeThemeCatalog(revisedCatalog, integration.container.useCases)

    await expect(
      integration.repositories.themes.drawPublished({
        categoryId: (await integration.repositories.categories.findBySlug('mindfulness'))?.id ?? '',
        difficulty: 'hard',
      }),
    ).resolves.toMatchObject({ title: { value: 'Notice your breathing' } })
    expect(integration.eventBus.published).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventName: 'theme_rejected' }),
        expect.objectContaining({ eventName: 'theme_pool_low' }),
      ]),
    )
  })
})
import { readFile } from 'node:fs/promises'
