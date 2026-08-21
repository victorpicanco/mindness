import type {
  ListStuckProcessingSessionsDependencies,
  ListStuckProcessingSessionsInput,
  ListStuckProcessingSessionsOutput,
} from './types.js'

export class ListStuckProcessingSessionsUseCase {
  constructor(private readonly dependencies: ListStuckProcessingSessionsDependencies) {}

  async execute(
    input: ListStuckProcessingSessionsInput,
  ): Promise<ListStuckProcessingSessionsOutput> {
    const sessions = await this.dependencies.sessions.findStuckProcessing(input.before, input.limit)
    return sessions.map((session) => session.id)
  }
}

export type {
  ListStuckProcessingSessionsDependencies,
  ListStuckProcessingSessionsInput,
  ListStuckProcessingSessionsOutput,
} from './types.js'
