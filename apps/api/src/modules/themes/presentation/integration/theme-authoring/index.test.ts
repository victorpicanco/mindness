import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import { createThemesContainer } from '@/modules/themes/composition/container.js'
import { ThemePoolLow } from '@/modules/themes/domain/events/theme-pool-low/index.js'
import { createPrismaClient } from '@/shared/database/prisma-client/index.js'
import { UuidGenerator } from '@/shared/id/uuid-generator/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'
import { ControllableClock } from '@/shared/time/controllable-clock/index.js'

const now = new Date('2026-08-16T12:00:00.000Z')

let prisma: ReturnType<typeof createPrismaClient>
let eventBus: FakeEventBus
let container: ReturnType<typeof createThemesContainer>

beforeAll(() => {
  prisma = createPrismaClient({ databaseUrl: inject('databaseUrl'), logQueries: false })
  eventBus = new FakeEventBus()
  container = createThemesContainer({
    prisma,
    clock: new ControllableClock(now),
    eventPublisher: eventBus,
    idGenerator: new UuidGenerator(),
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})

beforeEach(async () => {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE themes, theme_categories RESTART IDENTITY CASCADE')
  eventBus.published.length = 0
})

describe('theme authoring composition', () => {
  it('creates, publishes, persists, and draws a theme through the composed module', async () => {
    await container.useCases.createThemeCategory.execute({
      slug: 'mindfulness',
      name: 'Mindfulness',
    })
    const created = await container.useCases.createTheme.execute({
      title: 'Notice your breathing',
      categorySlug: 'mindfulness',
      difficulty: 'easy',
    })

    await container.useCases.publishTheme.execute({ themeId: created.themeId })

    await expect(container.repositories.themes.findById(created.themeId)).resolves.toMatchObject({
      id: created.themeId,
      publicationStatus: 'published',
    })
    await expect(
      container.publicApi.drawEligibleTheme({ categorySlug: 'mindfulness', difficulty: 'easy' }),
    ).resolves.toEqual({
      themeId: created.themeId,
      title: 'Notice your breathing',
      categorySlug: 'mindfulness',
      difficulty: 'easy',
    })
    const poolLow = eventBus.published.find(
      (event): event is ThemePoolLow => event instanceof ThemePoolLow,
    )

    expect(poolLow?.payload.publishedCount).toBe(1)
  })
})
