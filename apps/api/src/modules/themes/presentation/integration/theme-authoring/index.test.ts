import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  createThemesIntegrationContainer,
  type ThemesIntegrationContainer,
} from '@/modules/themes/composition/integration-container.js'
import {
  clearThemeData,
  createThemeCategoryFixture,
  createThemeFixture,
} from '@/modules/themes/composition/integration-fixtures.js'
import { ThemePoolLow } from '@/modules/themes/domain/events/theme-pool-low/index.js'
import { ThemeRejected } from '@/modules/themes/domain/events/theme-rejected/index.js'

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

describe('theme authoring integration', () => {
  it('creates and persists a draft theme', async () => {
    await integration.container.useCases.createThemeCategory.execute(createThemeCategoryFixture())

    const created = await integration.container.useCases.createTheme.execute(createThemeFixture())

    expect(created.publicationStatus).toBe('draft')
    await expect(integration.repositories.themes.findById(created.themeId)).resolves.toMatchObject({
      id: created.themeId,
      publicationStatus: 'draft',
    })
    expect(integration.eventBus.published).toEqual([])
  })

  it('rejects a duplicate title in the same category and publishes theme_rejected', async () => {
    await integration.container.useCases.createThemeCategory.execute(createThemeCategoryFixture())

    const results = await Promise.allSettled([
      integration.container.useCases.createTheme.execute(createThemeFixture()),
      integration.container.useCases.createTheme.execute(
        createThemeFixture({ title: ' notice   your BREATHING ' }),
      ),
    ])
    const fulfilled = results.filter((result) => result.status === 'fulfilled')
    const rejected = results.filter((result) => result.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]).toMatchObject({ reason: { code: 'themes.THEME_TITLE_ALREADY_USED' } })
    expect(integration.eventBus.published).toHaveLength(1)
    expect(integration.eventBus.published[0]).toBeInstanceOf(ThemeRejected)
    expect(integration.eventBus.published[0]).toMatchObject({
      eventName: 'theme_rejected',
      payload: { issues: [{ field: 'title', reason: 'already used' }] },
    })
  })

  it('accepts the same title in a different category', async () => {
    await integration.container.useCases.createThemeCategory.execute(createThemeCategoryFixture())
    await integration.container.useCases.createThemeCategory.execute(
      createThemeCategoryFixture({ slug: 'focus', name: 'Focus' }),
    )
    await integration.container.useCases.createTheme.execute(createThemeFixture())

    const created = await integration.container.useCases.createTheme.execute(
      createThemeFixture({ categorySlug: 'focus' }),
    )

    await expect(integration.repositories.themes.findById(created.themeId)).resolves.not.toBeNull()
    expect(integration.eventBus.published).toEqual([])
  })

  it('publishes and withdraws a theme reversibly', async () => {
    await integration.container.useCases.createThemeCategory.execute(createThemeCategoryFixture())
    const created = await integration.container.useCases.createTheme.execute(createThemeFixture())

    await integration.container.useCases.publishTheme.execute({ themeId: created.themeId })
    await integration.container.useCases.withdrawTheme.execute({ themeId: created.themeId })

    await expect(integration.repositories.themes.findById(created.themeId)).resolves.toMatchObject({
      publicationStatus: 'withdrawn',
    })
    await integration.container.useCases.publishTheme.execute({ themeId: created.themeId })
    await expect(integration.repositories.themes.findById(created.themeId)).resolves.toMatchObject({
      publicationStatus: 'published',
    })
    expect(integration.eventBus.published).toHaveLength(3)
    for (const event of integration.eventBus.published) {
      expect(event).toBeInstanceOf(ThemePoolLow)
    }
  })

  it('publishes theme_pool_low with nine published themes after withdrawing the tenth', async () => {
    await integration.container.useCases.createThemeCategory.execute(createThemeCategoryFixture())
    let tenthThemeId = ''
    for (let index = 1; index <= 10; index += 1) {
      const created = await integration.container.useCases.createTheme.execute(
        createThemeFixture({ title: `Notice your breathing ${index}` }),
      )
      await integration.container.useCases.publishTheme.execute({ themeId: created.themeId })
      tenthThemeId = created.themeId
    }
    integration.reset()

    await integration.container.useCases.withdrawTheme.execute({ themeId: tenthThemeId })

    expect(integration.eventBus.published).toHaveLength(1)
    expect(integration.eventBus.published[0]).toMatchObject({
      eventName: 'theme_pool_low',
      payload: {
        categorySlug: 'mindfulness',
        difficulty: 'easy',
        publishedCount: 9,
        minimum: 10,
      },
    })
  })

  it('keeps a withdrawn theme readable after it leaves the draw', async () => {
    await integration.container.useCases.createThemeCategory.execute(createThemeCategoryFixture())
    const created = await integration.container.useCases.createTheme.execute(createThemeFixture())
    await integration.container.useCases.publishTheme.execute({ themeId: created.themeId })
    await integration.container.useCases.withdrawTheme.execute({ themeId: created.themeId })

    await expect(
      integration.container.publicApi.drawEligibleTheme({
        categorySlug: 'mindfulness',
        difficulty: 'easy',
      }),
    ).resolves.toBeNull()
    await expect(integration.container.publicApi.findThemeById(created.themeId)).resolves.toEqual({
      themeId: created.themeId,
      title: 'Notice your breathing',
      categorySlug: 'mindfulness',
      difficulty: 'easy',
    })
  })
})
