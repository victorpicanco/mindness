import type {
  CheckSessionReadabilityDependencies,
  CheckSessionReadabilityInput,
  CheckSessionReadabilityOutput,
} from './types.js'

export class CheckSessionReadabilityUseCase {
  constructor(private readonly dependencies: CheckSessionReadabilityDependencies) {}

  async execute(input: CheckSessionReadabilityInput): Promise<CheckSessionReadabilityOutput> {
    const session = await this.dependencies.sessions.findById(input.sessionId)

    return {
      readable:
        session !== null && session.accountId === input.accountId && session.state !== 'deleted',
    }
  }
}

export type {
  CheckSessionReadabilityDependencies,
  CheckSessionReadabilityInput,
  CheckSessionReadabilityOutput,
} from './types.js'
