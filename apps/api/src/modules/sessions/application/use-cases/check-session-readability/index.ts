import type {
  CheckSessionReadabilityDependencies,
  CheckSessionReadabilityInput,
  CheckSessionReadabilityOutput,
} from './types.js'

export class CheckSessionReadabilityUseCase {
  constructor(private readonly dependencies: CheckSessionReadabilityDependencies) {}

  async execute(input: CheckSessionReadabilityInput): Promise<CheckSessionReadabilityOutput> {
    const session = await this.dependencies.sessions.findById(input.sessionId)

    if (session === null || session.accountId !== input.accountId || session.state === 'deleted') {
      return { readable: false, failureReason: null }
    }

    return {
      readable: true,
      failureReason: session.state === 'failed' ? session.failureReason : null,
    }
  }
}

export type {
  CheckSessionReadabilityDependencies,
  CheckSessionReadabilityInput,
  CheckSessionReadabilityOutput,
} from './types.js'
