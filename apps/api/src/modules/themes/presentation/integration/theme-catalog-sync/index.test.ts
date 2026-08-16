import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import { synchronizeThemeCatalog } from '../../../../../../scripts/sync-themes.js'
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

    await synchronizeThemeCatalog(revisedCatalog, integration.container.useCases)

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
    expect(integration.eventBus.published).toHaveLength(0)
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
    expect(integration.eventBus.published).toHaveLength(1)
    expect(integration.eventBus.published[0]).toBeInstanceOf(ThemeRejected)
    if (integration.eventBus.published[0] instanceof ThemeRejected) {
      expect(integration.eventBus.published[0].payload.issues).toEqual([
        { field: 'title', reason: 'is invalid' },
      ])
    }
  })
})
