import { InvalidAccountValueError } from '@/modules/accounts/domain/errors/invalid-account-value-error/index.js'

export interface CreateAccountDeletionRequestParams {
  readonly id: string
  readonly accountId: string
  readonly requestedAt: Date
  readonly scheduledFor: Date
}

export class AccountDeletionRequest {
  private constructor(
    readonly id: string,
    readonly accountId: string,
    private readonly requestedAtEpoch: number,
    private readonly scheduledForEpoch: number,
  ) {}

  get requestedAt(): Date {
    return new Date(this.requestedAtEpoch)
  }
  get scheduledFor(): Date {
    return new Date(this.scheduledForEpoch)
  }

  static create(params: CreateAccountDeletionRequestParams): AccountDeletionRequest {
    if (params.id.trim().length === 0) throw new InvalidAccountValueError('id')
    if (params.accountId.trim().length === 0) throw new InvalidAccountValueError('accountId')
    if (params.scheduledFor.getTime() <= params.requestedAt.getTime()) {
      throw new InvalidAccountValueError('scheduledFor')
    }
    return new AccountDeletionRequest(
      params.id,
      params.accountId,
      params.requestedAt.getTime(),
      params.scheduledFor.getTime(),
    )
  }
}
