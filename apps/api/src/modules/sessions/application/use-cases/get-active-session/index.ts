import type {
  GetActiveSessionDependencies,
  GetActiveSessionInput,
  GetActiveSessionOutput,
} from './types.js'

export class GetActiveSessionUseCase {
  constructor(private readonly dependencies: GetActiveSessionDependencies) {}

  async execute(input: GetActiveSessionInput): Promise<GetActiveSessionOutput | null> {
    const session = await this.dependencies.sessions.findActiveByAccountId(input.accountId)

    if (session === null) return null

    if (session.expiresAt.getTime() <= this.dependencies.clock.now().getTime()) {
      await this.dependencies.expireSession.execute({
        accountId: input.accountId,
        sessionId: session.id,
        reason: 'timeout',
      })
      return null
    }

    return {
      sessionId: session.id,
      themeId: session.themeId,
      configuration: {
        difficulty: session.configuration.difficulty,
        categorySlug: session.configuration.categorySlug,
        searchWindowMinutes: session.configuration.searchWindowMinutes,
      },
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    }
  }
}

export type {
  GetActiveSessionDependencies,
  GetActiveSessionInput,
  GetActiveSessionOutput,
} from './types.js'
