import pino from 'pino'
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
import type { ThemeDifficulty } from '@/modules/themes/domain/entities/theme/index.js'
import {
  ThemePoolLow,
  type ThemePoolLowPayload,
} from '@/modules/themes/domain/events/theme-pool-low/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'
import { buildApp } from '@/shared/http/build-app/index.js'

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

async function createPublishedTheme(
  title: string,
  difficulty: ThemeDifficulty = 'easy',
): Promise<string> {
  const created = await integration.container.useCases.createTheme.execute(
    createThemeFixture({ title, difficulty }),
  )
  await integration.container.useCases.publishTheme.execute({ themeId: created.themeId })

  return created.themeId
}

function expectThemePoolLowEvent(
  event: IntegrationEvent | undefined,
  payload: ThemePoolLowPayload,
): void {
  expect(event).toBeInstanceOf(ThemePoolLow)
  if (event instanceof ThemePoolLow) {
    expect(event.payload).toEqual(payload)
  }
}

describe('theme eligibility integration', () => {
  it('draws only a published theme from the requested combination', async () => {
    await integration.container.useCases.createThemeCategory.execute(createThemeCategoryFixture())
    const publishedThemeId = await createPublishedTheme('Published easy theme')
    await integration.container.useCases.createTheme.execute(
      createThemeFixture({ title: 'Draft easy theme' }),
    )
    const withdrawnThemeId = await createPublishedTheme('Withdrawn easy theme')
    await integration.container.useCases.withdrawTheme.execute({ themeId: withdrawnThemeId })
    const hardThemeId = await createPublishedTheme('Published hard theme', 'hard')

    integration.reset()

    await expect(
      integration.container.publicApi.drawEligibleTheme({
        categorySlug: 'mindfulness',
        difficulty: 'easy',
      }),
    ).resolves.toEqual({
      themeId: publishedThemeId,
      title: 'Published easy theme',
      categorySlug: 'mindfulness',
      difficulty: 'easy',
    })
    await expect(integration.repositories.themes.findById(publishedThemeId)).resolves.toMatchObject(
      {
        publicationStatus: 'published',
        difficulty: 'easy',
      },
    )
    await expect(integration.repositories.themes.findById(withdrawnThemeId)).resolves.toMatchObject(
      {
        publicationStatus: 'withdrawn',
      },
    )
    await expect(integration.repositories.themes.findById(hardThemeId)).resolves.toMatchObject({
      publicationStatus: 'published',
      difficulty: 'hard',
    })
    expect(integration.eventBus.published).toHaveLength(1)
    expectThemePoolLowEvent(integration.eventBus.published[0], {
      categorySlug: 'mindfulness',
      difficulty: 'easy',
      publishedCount: 1,
      minimum: 10,
    })
  })

  it('publishes theme_pool_low with nine published themes after a draw', async () => {
    const category = await integration.container.useCases.createThemeCategory.execute(
      createThemeCategoryFixture(),
    )
    for (let index = 1; index <= 9; index += 1) {
      await createPublishedTheme(`Published theme ${index}`)
    }

    integration.reset()

    const drawn = await integration.container.publicApi.drawEligibleTheme({
      categorySlug: 'mindfulness',
      difficulty: 'easy',
    })

    expect(drawn).not.toBeNull()
    await expect(
      integration.repositories.themes.countPublishedBy({
        categoryId: category.categoryId,
        difficulty: 'easy',
      }),
    ).resolves.toBe(9)
    expect(integration.eventBus.published).toHaveLength(1)
    expectThemePoolLowEvent(integration.eventBus.published[0], {
      categorySlug: 'mindfulness',
      difficulty: 'easy',
      publishedCount: 9,
      minimum: 10,
    })
  })

  it('returns null and publishes theme_pool_low when the combination is empty', async () => {
    const category = await integration.container.useCases.createThemeCategory.execute(
      createThemeCategoryFixture(),
    )
    integration.reset()

    await expect(
      integration.container.publicApi.drawEligibleTheme({
        categorySlug: 'mindfulness',
        difficulty: 'easy',
      }),
    ).resolves.toBeNull()
    await expect(
      integration.repositories.themes.countPublishedBy({
        categoryId: category.categoryId,
        difficulty: 'easy',
      }),
    ).resolves.toBe(0)
    expect(integration.eventBus.published).toHaveLength(1)
    expectThemePoolLowEvent(integration.eventBus.published[0], {
      categorySlug: 'mindfulness',
      difficulty: 'easy',
      publishedCount: 0,
      minimum: 10,
    })
  })

  it('keeps a drawn theme readable after it is withdrawn', async () => {
    await integration.container.useCases.createThemeCategory.execute(createThemeCategoryFixture())
    const themeId = await createPublishedTheme('Withdrawn after draw')
    integration.reset()

    const drawn = await integration.container.publicApi.drawEligibleTheme({
      categorySlug: 'mindfulness',
      difficulty: 'easy',
    })
    await integration.container.useCases.withdrawTheme.execute({ themeId })

    await expect(integration.container.publicApi.findThemeById(themeId)).resolves.toEqual(drawn)
    await expect(integration.repositories.themes.findById(themeId)).resolves.toMatchObject({
      publicationStatus: 'withdrawn',
    })
    expect(integration.eventBus.published).toHaveLength(2)
    for (const event of integration.eventBus.published) {
      expect(event).toBeInstanceOf(ThemePoolLow)
    }
  })

  it('does not expose the catalog through an HTTP route', async () => {
    const app = buildApp({ logger: pino({ level: 'silent' }) })

    const response = await app.inject({ method: 'GET', url: '/themes' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      message: 'Route GET:/themes not found',
      error: 'Not Found',
      statusCode: 404,
    })
  })
})
