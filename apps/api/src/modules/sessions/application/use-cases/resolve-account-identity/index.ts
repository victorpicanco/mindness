import type {
  ResolveAccountIdentityDependencies,
  ResolveAccountIdentityInput,
  ResolveAccountIdentityOutput,
} from './types.js'

export class ResolveAccountIdentityUseCase {
  constructor(private readonly dependencies: ResolveAccountIdentityDependencies) {}

  async execute(input: ResolveAccountIdentityInput): Promise<ResolveAccountIdentityOutput> {
    const accountId = await this.dependencies.accounts.resolveAccountId(input.accessToken)
    return { accountId }
  }
}

export type {
  ResolveAccountIdentityDependencies,
  ResolveAccountIdentityInput,
  ResolveAccountIdentityOutput,
} from './types.js'
